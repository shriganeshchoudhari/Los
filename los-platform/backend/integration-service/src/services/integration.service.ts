import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { KafkaService, KAFKA_TOPICS } from '@los/common';
import {
  BureauPullJob,
  BureauReport,
  BureauAggregatedScore,
  BureauProvider,
  BureauPullStatus,
  BureauReportStatus,
} from '../entities/bureau.entity';
import {
  Disbursement,
  PaymentTransaction,
  NACHMandate,
  DisbursementStatus,
  PaymentMode,
} from '../entities/payment.entity';
import { BureauPullRequestDto, BureauBulkPullRequestDto, BureauBulkPullResponseDto, BureauReportQueryDto } from '../dto/bureau.dto';
import { DisbursementInitDto, NACHMandateInitDto, PaymentCallbackDto, PennyDropVerifyDto, CBSCustomerCreateDto, CBSLoanAccountCreateDto } from '../dto/payment.dto';
import { CibilClient, ExperianClient, EquifaxClient, CrifClient } from '../clients/bureau-clients';
import { CBSClient } from '../clients/cbs-client';
import { IMPSClient, NEFTClient, RTGSClient, UPIClient, NACHClient } from '../clients/npci-clients';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    @InjectRepository(BureauPullJob)
    private readonly bureauJobRepo: Repository<BureauPullJob>,
    @InjectRepository(BureauReport)
    private readonly bureauReportRepo: Repository<BureauReport>,
    @InjectRepository(BureauAggregatedScore)
    private readonly bureauAggRepo: Repository<BureauAggregatedScore>,
    @InjectRepository(Disbursement)
    private readonly disbursementRepo: Repository<Disbursement>,
    @InjectRepository(PaymentTransaction)
    private readonly paymentTxnRepo: Repository<PaymentTransaction>,
    @InjectRepository(NACHMandate)
    private readonly nachRepo: Repository<NACHMandate>,
    private readonly cibilClient: CibilClient,
    private readonly experianClient: ExperianClient,
    private readonly equifaxClient: EquifaxClient,
    private readonly crifClient: CrifClient,
    private readonly cbsClient: CBSClient,
    private readonly impsClient: IMPSClient,
    private readonly neftClient: NEFTClient,
    private readonly rtgsClient: RTGSClient,
    private readonly upiClient: UPIClient,
    private readonly nachClient: NACHClient,
    private readonly kafkaService: KafkaService,
  ) {}

  async processBureauConsent(applicationId: string, applicantId: string, panHash: string, consentOtp: string): Promise<{ consentId: string; expiresAt: Date }> {
    const consentHash = crypto.createHash('sha256').update(`${panHash}:${consentOtp}:${applicationId}`).digest('hex');
    const consentId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.bureauJobRepo.save(
      this.bureauJobRepo.create({
        applicationId,
        applicantId,
        panHash,
        consentOtpHash: consentHash,
        consentTimestamp: new Date(),
        provider: BureauProvider.CIBIL,
        status: BureauPullStatus.PENDING_CONSENT,
        requestTimestamp: new Date(),
        lockExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }),
    );

    this.logger.log(`Bureau consent recorded for application ${applicationId}, expires at ${expiresAt}`);
    return { consentId, expiresAt };
  }

  async pullBureauBulk(dto: BureauBulkPullRequestDto): Promise<BureauBulkPullResponseDto> {
    const providers = [BureauProvider.CIBIL, BureauProvider.EXPERIAN, BureauProvider.EQUIFAX, BureauProvider.CRIF];
    const existingLock = await this.bureauJobRepo.findOne({
      where: { panHash: dto.panHash, lockExpiresAt: LessThan(new Date()), status: BureauPullStatus.IN_PROGRESS },
    });
    if (existingLock) {
      throw new ConflictException({
        code: 'BUREAU_DUPLICATE_LOCK',
        message: 'Duplicate bureau pull blocked — 30-day lock active',
      });
    }

    const consentVerified = await this.verifyBureauConsent(dto.applicationId, dto.panHash, dto.consentOtp);
    if (!consentVerified) {
      throw new BadRequestException({ code: 'CONSENT_INVALID', message: 'Invalid or expired bureau consent OTP' });
    }

    const pullRequests: BureauPullRequestDto[] = providers.map(p => ({
      provider: p,
      panHash: dto.panHash,
      consumerName: dto.consumerName,
      dateOfBirth: dto.dateOfBirth,
      mobileNumber: dto.mobileNumber,
    }));

    const pullJobs = await Promise.all(
      pullRequests.map(req => this.bureauJobRepo.save(this.bureauJobRepo.create({
        applicationId: dto.applicationId,
        applicantId: dto.applicantId,
        panHash: dto.panHash,
        provider: req.provider,
        status: BureauPullStatus.IN_PROGRESS,
        requestTimestamp: new Date(),
        lockExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }))),
    );

    const results = await Promise.allSettled(
      pullRequests.map((req, idx) => this.executeBureauPull(req, pullJobs[idx].id)),
    );

    const successfulPulls = results
      .map((r, i) => ({ result: r as PromiseFulfilledResult<unknown>, index: i }))
      .filter(x => x.result.status === 'fulfilled')
      .map(x => x.result.value);

    const failedPulls = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    const aggregated = successfulPulls.length > 0 ? this.aggregateScores(successfulPulls.map(p => p as BureauPullResult)) : null;

    await this.kafkaService.emit(KAFKA_TOPICS.BUREAU_PULL_COMPLETED, {
      applicationId: dto.applicationId,
      providersRequested: providers.length,
      providersSucceeded: successfulPulls.length,
      providersFailed: failedPulls.length,
      primaryScore: aggregated?.primaryScore,
      timestamp: new Date().toISOString(),
    });

    return {
      applicationId: dto.applicationId,
      totalRequested: providers.length,
      totalSucceeded: successfulPulls.length,
      totalFailed: failedPulls.length,
      results: successfulPulls.map(p => p as BureauPullResult),
      aggregated: aggregated || undefined,
    };
  }

  private async executeBureauPull(dto: BureauPullRequestDto, jobId: string): Promise<BureauPullResult> {
    let result: BureauPullResult;

    switch (dto.provider) {
      case BureauProvider.CIBIL:
        result = await this.cibilClient.pullReport(dto);
        break;
      case BureauProvider.EXPERIAN:
        result = await this.experianClient.pullReport(dto);
        break;
      case BureauProvider.EQUIFAX:
        result = await this.equifaxClient.pullReport(dto);
        break;
      case BureauProvider.CRIF:
        result = await this.crifClient.pullReport(dto);
        break;
    }

    await this.bureauJobRepo.update(jobId, {
      status: result.success ? BureauPullStatus.SUCCESS : BureauPullStatus.FAILED,
      responseTimestamp: new Date(),
      responsePayload: result as unknown as Record<string, unknown>,
      timeoutMs: result.latencyMs,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });

    if (result.success && result.rawResponse) {
      const report = this.bureauReportRepo.create({
        applicationId: (await this.bureauJobRepo.findOne({ where: { id: jobId } }))!.applicationId,
        pullJobId: jobId,
        provider: dto.provider,
        panHash: dto.panHash,
        status: BureauReportStatus.RAW,
        rawJson: result.rawResponse,
        parsedScore: result.score || null,
        parsedGrade: this.scoreToGrade(result.score || 0),
      });
      await this.bureauReportRepo.save(report);
      await this.bureauJobRepo.update(jobId, { reportId: report.id });
    }

    return result;
  }

  private async verifyBureauConsent(applicationId: string, panHash: string, consentOtp: string): Promise<boolean> {
    const storedConsent = await this.bureauJobRepo.findOne({
      where: {
        applicationId,
        panHash,
        status: BureauPullStatus.PENDING_CONSENT,
      },
      order: { consentTimestamp: 'DESC' },
    });

    if (!storedConsent?.consentOtpHash) {
      this.logger.warn(`No consent found for application ${applicationId}`);
      return false;
    }

    const expectedHash = crypto
      .createHash('sha256')
      .update(`${panHash}:${consentOtp}:${applicationId}`)
      .digest('hex');

    const valid = storedConsent.consentOtpHash === expectedHash;
    if (!valid) {
      this.logger.warn(`Consent OTP mismatch for application ${applicationId}`);
    }

    if (valid) {
      await this.bureauJobRepo.update(storedConsent.id, { status: BureauPullStatus.PENDING });
    }

    return valid;
  }

  private aggregateScores(pulls: BureauPullResult[]): {
    primaryProvider: BureauProvider;
    primaryScore: number;
    totalExposure: number;
    totalEmi: number;
    maxDpd: number;
    activeAccounts: number;
    enquiries30d: number;
  } {
    const sorted = pulls.filter(p => p.score != null).sort((a, b) => (b.score || 0) - (a.score || 0));
    const primary = sorted[0];

    let totalExposure = 0;
    let totalEmi = 0;
    let maxDpd = 0;
    let activeAccounts = 0;
    let enquiries30d = 0;

    for (const pull of pulls) {
      const resp = pull.rawResponse as Record<string, any>;
      if (!resp) continue;

      if (typeof resp.totalExposure === 'number') totalExposure += resp.totalExposure;
      if (typeof resp.totalEmi === 'number') totalEmi += resp.totalEmi;
      if (typeof resp.maxDpd === 'number') maxDpd = Math.max(maxDpd, resp.maxDpd);
      if (typeof resp.activeAccounts === 'number') activeAccounts += resp.activeAccounts;
      if (typeof resp.enquiries30d === 'number') enquiries30d += resp.enquiries30d;

      if (resp.accounts && Array.isArray(resp.accounts)) {
        activeAccounts = Math.max(activeAccounts, resp.accounts.length);
        for (const account of resp.accounts) {
          if (account.exposure) totalExposure += account.exposure;
          if (account.currentEmi) totalEmi += account.currentEmi;
          if (account.dpd && account.dpd > maxDpd) maxDpd = account.dpd;
        }
      }

      if (resp.enquiries && Array.isArray(resp.enquiries)) {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (const enquiry of resp.enquiries) {
          if (enquiry.date && new Date(enquiry.date).getTime() > thirtyDaysAgo) {
            enquiries30d++;
          }
        }
      }
    }

    return {
      primaryProvider: primary?.provider || BureauProvider.CIBIL,
      primaryScore: primary?.score || 0,
      totalExposure,
      totalEmi,
      maxDpd,
      activeAccounts,
      enquiries30d,
    };
  }

  private scoreToGrade(score: number): string {
    if (score >= 800) return 'A+';
    if (score >= 750) return 'A';
    if (score >= 700) return 'B+';
    if (score >= 650) return 'B';
    if (score >= 600) return 'C';
    if (score >= 550) return 'D';
    return 'E';
  }

  async getBureauReports(query: BureauReportQueryDto): Promise<BureauReport[]> {
    const where: Record<string, unknown> = { applicationId: query.applicationId };
    if (query.provider) where.provider = query.provider;
    return this.bureauReportRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async createCBSCustomer(dto: CBSCustomerCreateDto): Promise<{ customerId: string; cifNumber: string; success: boolean }> {
    const result = await this.cbsClient.createCustomer(dto);
    if (result.errorCode) {
      throw new BadRequestException({ code: result.errorCode, message: result.errorMessage });
    }
    await this.kafkaService.emit(KAFKA_TOPICS.CBS_CUSTOMER_CREATED, {
      applicationId: dto.applicationId,
      cbsCustomerId: result.customerId,
      cifNumber: result.cifNumber,
      timestamp: new Date().toISOString(),
    });
    return { customerId: result.customerId, cifNumber: result.cifNumber, success: true };
  }

  async createCBSLoanAccount(dto: CBSLoanAccountCreateDto): Promise<{ accountId: string; accountNumber: string; success: boolean }> {
    const result = await this.cbsClient.createLoanAccount(dto);
    if (result.errorCode) {
      throw new BadRequestException({ code: result.errorCode, message: result.errorMessage });
    }
    await this.kafkaService.emit(KAFKA_TOPICS.CBS_LOANACCOUNT_CREATED, {
      applicationId: dto.applicationId,
      cbsCustomerId: dto.cbsCustomerId,
      accountId: result.accountId,
      accountNumber: result.accountNumber,
      timestamp: new Date().toISOString(),
    });
    return { accountId: result.accountId, accountNumber: result.accountNumber, success: true };
  }

  async initiateDisbursement(dto: DisbursementInitDto): Promise<Disbursement> {
    if (dto.idempotencyKey) {
      const existing = await this.disbursementRepo.findOne({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) {
        this.logger.log(`Duplicate disbursement request blocked: ${dto.idempotencyKey}`);
        return existing;
      }
    }

    const disbursement = await this.disbursementRepo.save(this.disbursementRepo.create({
      applicationId: dto.applicationId,
      loanId: dto.loanId || null,
      disbursementNumber: `DISB-${Date.now()}`,
      trancheNumber: dto.trancheNumber,
      amount: dto.amount,
      paymentMode: this.determinePaymentMode(dto.amount),
      beneficiaryAccountNumber: dto.beneficiaryAccountNumber,
      beneficiaryIfsc: dto.beneficiaryIfsc,
      beneficiaryName: dto.beneficiaryName,
      beneficiaryMobile: dto.beneficiaryMobile,
      status: DisbursementStatus.PENDING,
      idempotencyKey: dto.idempotencyKey,
      initiatedAt: new Date(),
      remarks: dto.remarks,
    }));

    this.processDisbursementAsync(disbursement.id);
    return disbursement;
  }

  private determinePaymentMode(amount: number): PaymentMode {
    if (amount >= 2_000_000) return PaymentMode.RTGS;
    if (amount >= 100_000) return PaymentMode.NEFT;
    return PaymentMode.IMPS;
  }

  private async processDisbursementAsync(disbursementId: string): Promise<void> {
    try {
      const disbursement = await this.disbursementRepo.findOne({ where: { id: disbursementId } });
      if (!disbursement) return;

      const paymentClient = this.getPaymentClient(disbursement.paymentMode);
      const result = await paymentClient.initiatePayment({
        senderAccount: 'LOAN_POOL_ACCOUNT',
        senderIfsc: 'LOSB0000001',
        beneficiaryAccount: disbursement.beneficiaryAccountNumber,
        beneficiaryIfsc: disbursement.beneficiaryIfsc,
        beneficiaryName: disbursement.beneficiaryName,
        beneficiaryMobile: disbursement.beneficiaryMobile,
        amount: Number(disbursement.amount),
        reference: disbursement.disbursementNumber,
      });

      await this.paymentTxnRepo.save(this.paymentTxnRepo.create({
        disbursementId: disbursement.id,
        paymentMode: disbursement.paymentMode,
        amount: Number(disbursement.amount),
        senderAccount: 'LOAN_POOL_ACCOUNT',
        senderIfsc: 'LOSB0000001',
        beneficiaryAccount: disbursement.beneficiaryAccountNumber,
        beneficiaryIfsc: disbursement.beneficiaryIfsc,
        beneficiaryName: disbursement.beneficiaryName,
        utrNumber: result.utrNumber || null,
        npciReference: result.npciReferenceId || null,
        requestPayload: { amount: disbursement.amount },
        responsePayload: result as unknown as Record<string, unknown>,
        statusCode: result.statusCode || '',
        statusMessage: result.statusMessage || '',
        requestTimestamp: new Date(),
        responseTimestamp: new Date(),
        latencyMs: result.latencyMs,
      }));

      if (result.success) {
        await this.disbursementRepo.update(disbursementId, {
          status: DisbursementStatus.PAYMENT_INITIATED,
          utrNumber: result.utrNumber || null,
          npciReferenceId: result.npciReferenceId || null,
        });
        await this.kafkaService.emit(KAFKA_TOPICS.PAYMENT_INITIATED, {
          disbursementId,
          utrNumber: result.utrNumber,
          npciReferenceId: result.npciReferenceId,
          amount: disbursement.amount,
          paymentMode: disbursement.paymentMode,
          timestamp: new Date().toISOString(),
        });
      } else {
        await this.disbursementRepo.update(disbursementId, {
          status: DisbursementStatus.PAYMENT_FAILED,
          failureDetails: { errorCode: result.errorCode, errorMessage: result.errorMessage },
        });
      }
    } catch (error) {
      this.logger.error(`Disbursement processing failed for ${disbursementId}: ${(error as Error).message}`);
      await this.disbursementRepo.update(disbursementId, {
        status: DisbursementStatus.PAYMENT_FAILED,
        failureDetails: { error: (error as Error).message },
      });
    }
  }

  private getPaymentClient(mode: PaymentMode): { initiatePayment(req: { senderAccount: string; senderIfsc: string; beneficiaryAccount: string; beneficiaryIfsc: string; beneficiaryName: string; beneficiaryMobile?: string; amount: number; reference?: string; remarks?: string; }): Promise<{ success: boolean; npciReferenceId?: string; utrNumber?: string; statusCode?: string; statusMessage?: string; errorCode?: string; errorMessage?: string; latencyMs: number; }> } {
    switch (mode) {
      case PaymentMode.IMPS: return this.impsClient;
      case PaymentMode.NEFT: return this.neftClient;
      case PaymentMode.RTGS: return this.rtgsClient;
      case PaymentMode.UPI: return this.upiClient;
      default: return this.impsClient;
    }
  }

  async handlePaymentCallback(dto: PaymentCallbackDto): Promise<{ processed: boolean; disbursementId?: string }> {
    const transaction = await this.paymentTxnRepo.findOne({ where: { utrNumber: dto.utrNumber } });
    if (!transaction) {
      this.logger.warn(`Payment callback received for unknown UTR: ${dto.utrNumber}`);
      return { processed: false };
    }

    const disbursement = await this.disbursementRepo.findOne({ where: { id: transaction.disbursementId } });
    if (!disbursement) return { processed: false };

    transaction.callbackReceivedAt = new Date();
    transaction.statusCode = dto.statusCode;
    transaction.statusMessage = dto.reasonDescription;
    await this.paymentTxnRepo.save(transaction);

    let newStatus: DisbursementStatus;
    switch (dto.status) {
      case 'SUCCESS': newStatus = DisbursementStatus.PAYMENT_SUCCESS; break;
      case 'FAILED': newStatus = DisbursementStatus.PAYMENT_FAILED; break;
      case 'RETURNED': newStatus = DisbursementStatus.PAYMENT_RETURNED; break;
      default: newStatus = disbursement.status;
    }

    await this.disbursementRepo.update(disbursement.id, {
      status: newStatus,
      settlementAt: dto.settlementDate ? new Date(dto.settlementDate) : new Date(),
      failureDetails: dto.status !== 'SUCCESS' ? { reasonCode: dto.reasonCode, reasonDescription: dto.reasonDescription } : null,
    });

    if (dto.status === 'SUCCESS') {
      await this.kafkaService.emit(KAFKA_TOPICS.PAYMENT_SUCCESS, {
        disbursementId: disbursement.id,
        applicationId: disbursement.applicationId,
        utrNumber: dto.utrNumber,
        amount: disbursement.amount,
        timestamp: new Date().toISOString(),
      });
    }

    return { processed: true, disbursementId: disbursement.id };
  }

  async initiateNACHMandate(dto: NACHMandateInitDto): Promise<NACHMandate> {
    const mandate = await this.nachRepo.save(this.nachRepo.create({
      applicationId: dto.applicationId,
      loanId: dto.loanId,
      loanAccountId: dto.loanAccountId,
      sponsorCode: 'LOSBANK',
      utilityCode: 'LOSUTIL001',
      debtorAccountNumber: dto.debtorAccountNumber,
      debtorIfsc: dto.debtorIfsc,
      debtorName: dto.debtorName,
      maxAmount: dto.maxAmount,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      frequency: dto.frequency || 'MONTHLY',
      registrationStatus: 'PENDING',
      confirmationStatus: 'PENDING',
    }));

    const result = await this.nachClient.registerMandate({
      applicationId: dto.applicationId,
      loanId: dto.loanId,
      loanAccountId: dto.loanAccountId,
      debtorAccountNumber: dto.debtorAccountNumber,
      debtorIfsc: dto.debtorIfsc,
      debtorName: dto.debtorName,
      maxAmount: dto.maxAmount,
      startDate: dto.startDate,
      endDate: dto.endDate,
      frequency: dto.frequency,
    });

    await this.nachRepo.update(mandate.id, {
      emandateId: result.emandateId,
      umrn: result.umrn,
      registrationStatus: result.success ? 'SUBMITTED' : 'FAILED',
    });

    return this.nachRepo.findOne({ where: { id: mandate.id } })!;
  }

  async verifyPennyDrop(dto: PennyDropVerifyDto) {
    const result = await this.impsClient.initiatePennyDrop({
      accountNumber: dto.accountNumber,
      ifsc: dto.ifsc,
      beneficiaryName: dto.beneficiaryName,
    });
    return result;
  }

  async getDisbursements(applicationId?: string, status?: DisbursementStatus): Promise<Disbursement[]> {
    const where: Record<string, unknown> = {};
    if (applicationId) where.applicationId = applicationId;
    if (status) where.status = status;
    return this.disbursementRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  getHealthMetrics() {
    return {
      cbs: this.cbsClient.getCircuitMetrics(),
      cibil: this.cibilClient.getCircuitMetrics(),
      experian: this.experianClient.getCircuitMetrics(),
      equifax: this.equifaxClient.getCircuitMetrics(),
      crif: this.crifClient.getCircuitMetrics(),
      imps: this.impsClient.getCircuitMetrics(),
      neft: this.neftClient.getCircuitMetrics(),
      rtgs: this.rtgsClient.getCircuitMetrics(),
      upi: this.upiClient.getCircuitMetrics(),
      nach: this.nachClient.getCircuitMetrics(),
    };
  }
}

interface BureauPullResult {
  success: boolean;
  provider: BureauProvider;
  score?: number | null;
  rawResponse?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  latencyMs: number;
}
