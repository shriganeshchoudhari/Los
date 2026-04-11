import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, LessThan, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  LoanApplication,
  ApplicationStatus,
  LoanType,
  ChannelCode,
  CustomerSegment,
  ApplicationStageHistory,
} from '../entities';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  AutoSaveDto,
  ApplicationResponseDto,
  ManagerDecisionDto,
  ApplicationSummaryDto,
  FoirCalculationResultDto,
} from '../dto';
import {
  createError,
  hashMobile,
  hashPan,
  maskMobile,
  encryptAes256Gcm,
  deriveKeyFromMasterKey,
  AuditService,
  AuditContext,
  AuditEventCategory,
  AuditEventType,
} from '@los/common';

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED],
  [ApplicationStatus.SUBMITTED]: [ApplicationStatus.KYC_IN_PROGRESS, ApplicationStatus.WITHDRAWN],
  [ApplicationStatus.KYC_IN_PROGRESS]: [ApplicationStatus.KYC_COMPLETE, ApplicationStatus.KYC_FAILED],
  [ApplicationStatus.KYC_COMPLETE]: [ApplicationStatus.DOCUMENT_COLLECTION, ApplicationStatus.UNDER_PROCESSING],
  [ApplicationStatus.DOCUMENT_COLLECTION]: [ApplicationStatus.UNDER_PROCESSING, ApplicationStatus.WITHDRAWN],
  [ApplicationStatus.UNDER_PROCESSING]: [ApplicationStatus.BUREAU_PULL_IN_PROGRESS, ApplicationStatus.WITHDRAWN],
  [ApplicationStatus.BUREAU_PULL_IN_PROGRESS]: [ApplicationStatus.BUREAU_PULL_COMPLETE],
  [ApplicationStatus.BUREAU_PULL_COMPLETE]: [ApplicationStatus.CREDIT_ASSESSMENT],
  [ApplicationStatus.CREDIT_ASSESSMENT]: [
    ApplicationStatus.PENDING_FIELD_INVESTIGATION,
    ApplicationStatus.PENDING_LEGAL_TECHNICAL,
    ApplicationStatus.CREDIT_COMMITTEE,
    ApplicationStatus.APPROVED,
    ApplicationStatus.CONDITIONALLY_APPROVED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.PENDING_FIELD_INVESTIGATION]: [ApplicationStatus.FIELD_INVESTIGATION_DONE],
  [ApplicationStatus.FIELD_INVESTIGATION_DONE]: [ApplicationStatus.APPROVED, ApplicationStatus.CONDITIONALLY_APPROVED, ApplicationStatus.REJECTED],
  [ApplicationStatus.PENDING_LEGAL_TECHNICAL]: [ApplicationStatus.LEGAL_TECHNICAL_DONE],
  [ApplicationStatus.LEGAL_TECHNICAL_DONE]: [ApplicationStatus.APPROVED, ApplicationStatus.CONDITIONALLY_APPROVED, ApplicationStatus.REJECTED],
  [ApplicationStatus.CREDIT_COMMITTEE]: [ApplicationStatus.APPROVED, ApplicationStatus.CONDITIONALLY_APPROVED, ApplicationStatus.REJECTED],
  [ApplicationStatus.APPROVED]: [ApplicationStatus.SANCTIONED, ApplicationStatus.CANCELLED, ApplicationStatus.CANCELLATION_WINDOW],
  [ApplicationStatus.CONDITIONALLY_APPROVED]: [ApplicationStatus.SANCTIONED, ApplicationStatus.CANCELLED, ApplicationStatus.CANCELLATION_WINDOW],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WITHDRAWN]: [],
  [ApplicationStatus.CANCELLED]: [],
  [ApplicationStatus.CANCELLATION_WINDOW]: [ApplicationStatus.CANCELLED],
  [ApplicationStatus.SANCTIONED]: [ApplicationStatus.DISBURSEMENT_IN_PROGRESS, ApplicationStatus.CANCELLATION_WINDOW],
  [ApplicationStatus.DISBURSEMENT_IN_PROGRESS]: [ApplicationStatus.DISBURSED],
  [ApplicationStatus.DISBURSED]: [ApplicationStatus.CLOSED],
  [ApplicationStatus.CLOSED]: [],
};

@Injectable()
export class LoanApplicationService {
  private readonly logger = new Logger(LoanApplicationService.name);
  private readonly kafka: Kafka;
  private readonly redis: Redis;
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(LoanApplication)
    private readonly applicationRepository: Repository<LoanApplication>,
    @InjectRepository(ApplicationStageHistory)
    private readonly stageHistoryRepository: Repository<ApplicationStageHistory>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.kafka = new Kafka({
      clientId: 'loan-service',
      brokers: configService.get<string[]>('KAFKA_BROKERS', ['localhost:9092']),
    });

    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    const masterKey = this.configService.get<string>('ENCRYPTION_MASTER_KEY', 'default-key-replace-in-prod-32chars!');
    this.encryptionKey = deriveKeyFromMasterKey(masterKey, 'LOAN_PAN_ENCRYPTION');
  }

  async createApplication(
    dto: CreateApplicationDto,
    userId: string,
  ): Promise<ApplicationResponseDto> {
    const panNumber = dto.applicant.panNumber || dto.employmentDetails.employerPAN;
    
    if (!panNumber) {
      throw createError('GEN_004', 'PAN number is required');
    }

    const existingApplication = await this.applicationRepository.findOne({
      where: {
        applicantPanHash: hashPan(panNumber),
        loanType: dto.loanType,
        status: Not(In([ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN, ApplicationStatus.CANCELLED])),
        createdAt: MoreThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      },
    });

    if (existingApplication) {
      throw createError('APP_003', `Duplicate application found: ${existingApplication.applicationNumber}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const applicationNumber = await this.generateApplicationNumber(
        dto.applicant.addresses?.[0]?.state || 'MH'
      );

      const encryptedPan = encryptAes256Gcm(panNumber.toUpperCase(), this.encryptionKey);

      const application = this.applicationRepository.create({
        id: uuidv4(),
        applicationNumber,
        loanType: dto.loanType,
        customerSegment: this.getCustomerSegment(dto.employmentDetails.employmentType),
        channelCode: dto.channelCode,
        branchCode: dto.branchCode || 'HQ001',
        applicantFullName: dto.applicant.fullName,
        applicantDob: new Date(dto.applicant.dob),
        applicantMobile: dto.applicant.mobile,
        applicantMobileHash: hashMobile(dto.applicant.mobile),
        applicantPanHash: hashPan(panNumber),
        applicantPanEncrypted: encryptedPan,
        applicantGender: dto.applicant.gender,
        applicantPincode: dto.applicant.addresses?.[0]?.pincode,
        applicantState: dto.applicant.addresses?.[0]?.state,
        applicantProfile: dto.applicant as any,
        employmentDetails: dto.employmentDetails as any,
        loanRequirement: {
          ...dto.loanRequirement,
          coApplicants: [],
          collateral: null,
        } as any,
        userId,
        requestedAmount: dto.loanRequirement.requestedAmount,
        status: ApplicationStatus.DRAFT,
        dsaCode: dto.dsaCode,
      });

      const savedApplication = await queryRunner.manager.save(application);

      await this.recordStageChange(
        savedApplication.id,
        null,
        ApplicationStatus.DRAFT,
        userId,
        'SYSTEM',
        'Application created',
        queryRunner.manager,
      );

      await this.auditService.log({
        eventCategory: AuditEventCategory.APPLICATION,
        eventType: AuditEventType.CREATE,
        entityType: 'LoanApplication',
        entityId: savedApplication.id,
        actorId: userId,
        actorRole: 'APPLICANT',
        afterState: JSON.stringify({
          applicationNumber,
          loanType: dto.loanType,
          requestedAmount: dto.loanRequirement.requestedAmount,
          branchCode: dto.branchCode,
        }),
      });

      await queryRunner.commitTransaction();

      await this.publishEvent('los.application.created', {
        applicationId: savedApplication.id,
        userId,
        loanType: savedApplication.loanType,
        requestedAmount: savedApplication.requestedAmount,
        channelCode: savedApplication.channelCode,
        branchCode: savedApplication.branchCode,
      });

      this.logger.log(`Application created: ${applicationNumber}`, { applicationId: savedApplication.id });

      return {
        applicationId: savedApplication.id,
        applicationNumber: savedApplication.applicationNumber,
        status: savedApplication.status,
        nextStep: 'COMPLETE_KYC',
        createdAt: savedApplication.createdAt.toISOString(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getApplication(applicationId: string, userId: string, userRole: string): Promise<any> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    if (userRole === 'APPLICANT' && application.userId !== userId) {
      throw createError('AUTH_006', 'Access denied');
    }

    return this.formatApplicationResponse(application);
  }

  async getApplicationRaw(applicationId: string): Promise<any> {
    return this.applicationRepository.findOne({ where: { id: applicationId } });
  }

  async updateApplication(
    applicationId: string,
    dto: UpdateApplicationDto,
    userId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    if (application.status !== ApplicationStatus.DRAFT) {
      throw createError('APP_004', 'Cannot update application after submission');
    }

    if (application.version !== dto.version) {
      throw createError('APP_005', 'Version conflict. Please refresh and try again');
    }

    switch (dto.section) {
      case 'APPLICANT':
        application.applicantProfile = { ...application.applicantProfile, ...dto.data };
        application.applicantFullName = dto.data.fullName || application.applicantFullName;
        break;
      case 'EMPLOYMENT':
        application.employmentDetails = { ...application.employmentDetails, ...dto.data };
        break;
      case 'LOAN_REQUIREMENT':
        application.loanRequirement = { ...application.loanRequirement, ...dto.data };
        if (dto.data.requestedAmount) {
          application.requestedAmount = dto.data.requestedAmount;
        }
        break;
    }

    const updated = await this.applicationRepository.save(application);

    return {
      applicationId: updated.id,
      applicationNumber: updated.applicationNumber,
      status: updated.status,
      nextStep: 'COMPLETE_KYC',
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async submitApplication(applicationId: string, userId: string, userRole: string): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    if (application.status !== ApplicationStatus.DRAFT) {
      throw createError('APP_004', 'Application already submitted');
    }

    const validationErrors = await this.validateForSubmission(application);
    if (validationErrors.length > 0) {
      throw createError('APP_004', `Validation failed: ${validationErrors.join(', ')}`);
    }

    const previousStatus = application.status;
    application.status = ApplicationStatus.SUBMITTED;
    application.submittedAt = new Date();

    const saved = await this.applicationRepository.save(application);

    await this.recordStageChange(applicationId, previousStatus, ApplicationStatus.SUBMITTED, userId, userRole);

    await this.auditService.log({
      eventCategory: AuditEventCategory.APPLICATION,
      eventType: AuditEventType.SUBMIT,
      entityType: 'LoanApplication',
      entityId: saved.id,
      actorId: userId,
      actorRole: userRole,
      beforeState: JSON.stringify({ status: previousStatus }),
      afterState: JSON.stringify({ status: ApplicationStatus.SUBMITTED, submittedAt: saved.submittedAt }),
      metadata: { applicationNumber: saved.applicationNumber, loanType: saved.loanType, requestedAmount: saved.requestedAmount },
    });

    await this.publishEvent('los.application.submitted', {
      applicationId: saved.id,
      userId: saved.userId,
      loanType: saved.loanType,
      requestedAmount: saved.requestedAmount,
      channelCode: saved.channelCode,
      branchCode: saved.branchCode,
    });

    this.logger.log(`Application submitted: ${saved.applicationNumber}`);

    return {
      applicationId: saved.id,
      applicationNumber: saved.applicationNumber,
      status: saved.status,
      nextStep: 'COMPLETE_KYC',
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async getApplicationsByStatus(
    status?: ApplicationStatus,
    branchCode?: string,
    page: number = 0,
    size: number = 20,
  ): Promise<{ content: ApplicationSummaryDto[]; totalElements: number; totalPages: number }> {
    const queryBuilder = this.applicationRepository.createQueryBuilder('app')
      .orderBy('app.createdAt', 'DESC')
      .skip(page * size)
      .take(size);

    if (status) {
      queryBuilder.andWhere('app.status = :status', { status });
    }

    if (branchCode) {
      queryBuilder.andWhere('app.branchCode = :branchCode', { branchCode });
    }

    const [applications, totalElements] = await queryBuilder.getManyAndCount();

    return {
      content: applications.map(this.formatApplicationSummary),
      totalElements,
      totalPages: Math.ceil(totalElements / size),
    };
  }

  async transitionStatus(
    applicationId: string,
    newStatus: ApplicationStatus,
    userId: string,
    userRole: string,
    remarks?: string,
  ): Promise<void> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    const validTransitions = VALID_TRANSITIONS[application.status];
    if (!validTransitions.includes(newStatus)) {
      throw createError(
        'APP_004',
        `Invalid status transition from ${application.status} to ${newStatus}`,
      );
    }

    const previousStatus = application.status;
    application.status = newStatus;

    await this.applicationRepository.save(application);

    await this.recordStageChange(applicationId, previousStatus, newStatus, userId, userRole, remarks);

    await this.auditService.log({
      eventCategory: AuditEventCategory.APPLICATION,
      eventType: AuditEventType.STATUS_CHANGE,
      entityType: 'LoanApplication',
      entityId: application.id,
      actorId: userId,
      actorRole: userRole,
      beforeState: JSON.stringify({ status: previousStatus }),
      afterState: JSON.stringify({ status: newStatus }),
      metadata: { applicationNumber: application.applicationNumber, remarks },
    });

    await this.publishEvent('los.application.status_changed', {
      applicationId,
      previousStatus,
      newStatus,
      changedBy: userId,
    });

    this.logger.log(`Application ${application.applicationNumber} transitioned to ${newStatus}`);
  }

  private async validateForSubmission(application: LoanApplication): Promise<string[]> {
    const errors: string[] = [];

    if (!application.applicantProfile?.fullName) {
      errors.push('Applicant name is required');
    }

    if (!application.employmentDetails?.netMonthlyIncome) {
      errors.push('Income details are required');
    }

    if (!application.loanRequirement?.requestedAmount || application.requestedAmount <= 0) {
      errors.push('Requested amount must be greater than 0');
    }

    return errors;
  }

  private async generateApplicationNumber(state: string): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.applicationRepository.query(
      `SELECT nextval('los_application_seq') as seq`
    );
    const seq = String(result[0].seq).padStart(6, '0');
    return `LOS-${year}-${state}-${seq}`;
  }

  private async recordStageChange(
    applicationId: string,
    fromStatus: ApplicationStatus | null,
    toStatus: ApplicationStatus,
    actionBy: string,
    actionByRole: string,
    remarks?: string,
    manager?: any,
  ): Promise<void> {
    const history = this.stageHistoryRepository.create({
      id: uuidv4(),
      applicationId,
      fromStatus: fromStatus || undefined,
      toStatus,
      actionBy,
      actionByRole,
      remarks,
      timestamp: new Date(),
    });

    if (manager) {
      await manager.save(history);
    } else {
      await this.stageHistoryRepository.save(history);
    }
  }

  private getCustomerSegment(employmentType: string): CustomerSegment {
    switch (employmentType) {
      case 'AGRICULTURALIST':
        return CustomerSegment.AGRI;
      case 'SELF_EMPLOYED_BUSINESS':
      case 'SELF_EMPLOYED_PROFESSIONAL':
      case 'MUDRA_SHISHU':
      case 'MUDRA_KISHORE':
      case 'MUDRA_TARUN':
      case 'MSME_TERM_LOAN':
      case 'MSME_WORKING_CAPITAL':
        return CustomerSegment.MSME;
      case 'NRI':
        return CustomerSegment.NRI;
      default:
        return CustomerSegment.RETAIL;
    }
  }

  async autoSave(
    applicationId: string,
    dto: AutoSaveDto,
    userId: string,
  ): Promise<{ savedAt: string; dirtySections: string[]; version: number }> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    if (application.status !== ApplicationStatus.DRAFT) {
      throw createError('APP_004', 'Cannot autosave after submission');
    }

    const dirtySections: string[] = [];

    if (dto.applicantProfile) {
      application.applicantProfile = { ...application.applicantProfile, ...dto.applicantProfile };
      dirtySections.push('APPLICANT');
    }
    if (dto.employmentDetails) {
      application.employmentDetails = { ...application.employmentDetails, ...dto.employmentDetails };
      dirtySections.push('EMPLOYMENT');
    }
    if (dto.loanRequirement) {
      application.loanRequirement = { ...application.loanRequirement, ...dto.loanRequirement };
      dirtySections.push('LOAN_REQUIREMENT');
    }
    if (dto.coApplicants) {
      application.loanRequirement = {
        ...application.loanRequirement,
        coApplicants: dto.coApplicants,
      };
      dirtySections.push('CO_APPLICANT');
    }
    if (dto.collateral) {
      application.loanRequirement = {
        ...application.loanRequirement,
        collateral: dto.collateral,
      };
      dirtySections.push('COLLATERAL');
    }

    const saved = await this.applicationRepository.save(application);

    await this.redis.setex(
      `autosave:${applicationId}`,
      300,
      JSON.stringify({ sections: dirtySections, savedAt: new Date().toISOString() }),
    );

    this.logger.log(`Autosaved application ${application.applicationNumber}: ${dirtySections.join(', ')}`);

    return {
      savedAt: new Date().toISOString(),
      dirtySections,
      version: saved.version,
    };
  }

  async calculateFOIR(applicationId: string): Promise<FoirCalculationResultDto> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    const netIncome = application.employmentDetails?.netMonthlyIncome ?? 0;
    const requestedAmount = application.requestedAmount;
    const tenureMonths = application.loanRequirement?.requestedTenureMonths ?? 36;

    const existingEmi = application.employmentDetails?.existingEmi ?? 0;

    const monthlyRate = (application.loanRequirement?.indicativeRate ?? 10.5) / 12 / 100;
    const newEmi = this.calculateEMI(requestedAmount, monthlyRate, tenureMonths);
    const totalEmi = existingEmi + newEmi;
    const foir = netIncome > 0 ? (totalEmi / netIncome) * 100 : 0;

    const eligibleAmount = this.calculateMaxEligibleAmount(netIncome, existingEmi, 50, monthlyRate, tenureMonths);
    const eligibleTenure = this.calculateMaxEligibleTenure(netIncome, existingEmi, 50, monthlyRate);

    return {
      netMonthlyIncome: netIncome,
      existingEmi,
      newEmi,
      totalEmi,
      foir,
      foirPercent: Math.round(foir * 10) / 10,
      maxEligibleAmount: eligibleAmount,
      maxEligibleTenure: eligibleTenure,
      monthlyRateBps: Math.round(monthlyRate * 10000),
    };
  }

  async assignOfficerRoundRobin(applicationId: string): Promise<{ assignedOfficerId: string; assignedAt: string }> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    if (application.assignedOfficerId) {
      return {
        assignedOfficerId: application.assignedOfficerId,
        assignedAt: new Date().toISOString(),
      };
    }

    const branchCode = application.branchCode;

    const lockKey = `officer:assign:${branchCode}`;
    const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');

    if (!lockAcquired) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.assignOfficerRoundRobin(applicationId);
    }

    try {
      const counterKey = `officer:seq:${branchCode}`;
      const nextSeq = await this.redis.incr(counterKey);
      const officerSeq = ((nextSeq - 1) % 5) + 1;
      const officerId = `OFF-${branchCode}-${String(officerSeq).padStart(3, '0')}`;

      application.assignedOfficerId = officerId;
      await this.applicationRepository.save(application);

      await this.recordStageChange(
        applicationId,
        null,
        ApplicationStatus.SUBMITTED,
        'SYSTEM',
        'SYSTEM',
        `Officer ${officerId} assigned via round-robin`,
      );

      this.logger.log(`Officer ${officerId} assigned to ${application.applicationNumber}`);

      return {
        assignedOfficerId: officerId,
        assignedAt: new Date().toISOString(),
      };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private calculateEMI(principal: number, monthlyRate: number, tenureMonths: number): number {
    if (monthlyRate === 0) return principal / tenureMonths;
    return Math.round(
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1),
    );
  }

  private calculateMaxEligibleAmount(
    netIncome: number,
    existingEmi: number,
    maxFoir: number,
    monthlyRate: number,
    tenureMonths: number,
  ): number {
    const maxTotalEmi = netIncome * (maxFoir / 100);
    const availableForNewEmi = Math.max(0, maxTotalEmi - existingEmi);
    if (availableForNewEmi <= 0) return 0;

    if (monthlyRate === 0) return availableForNewEmi * tenureMonths;

    const eligible = availableForNewEmi *
      (Math.pow(1 + monthlyRate, tenureMonths) - 1) /
      (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));

    return Math.floor(eligible / 1000) * 1000;
  }

  private calculateMaxEligibleTenure(
    netIncome: number,
    existingEmi: number,
    maxFoir: number,
    monthlyRate: number,
  ): number {
    const maxTotalEmi = netIncome * (maxFoir / 100);
    const availableForNewEmi = Math.max(0, maxTotalEmi - existingEmi);
    if (availableForNewEmi <= 0) return 0;

    const maxByIncome = netIncome * (maxFoir / 100) * 360;
    return Math.min(360, Math.floor(maxByIncome / availableForNewEmi));
  }

  private formatApplicationResponse(application: LoanApplication): any {
    return {
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
      status: application.status,
      loanType: application.loanType,
      customerSegment: application.customerSegment,
      channelCode: application.channelCode,
      branchCode: application.branchCode,
      applicant: application.applicantProfile,
      employmentDetails: application.employmentDetails,
      loanRequirement: application.loanRequirement,
      kycId: application.kycId,
      bureauReportId: application.bureauReportId,
      decisionId: application.decisionId,
      assignedOfficerId: application.assignedOfficerId,
      assignedAnalystId: application.assignedAnalystId,
      requestedAmount: application.requestedAmount,
      sanctionedAmount: application.sanctionedAmount,
      sanctionedTenureMonths: application.sanctionedTenureMonths,
      sanctionedRoiBps: application.sanctionedRoiBps,
      rejectionReasonCode: application.rejectionReasonCode,
      rejectionRemarks: application.rejectionRemarks,
      conditionsPreDisbursal: application.conditionsPreDisbursal,
      submittedAt: application.submittedAt?.toISOString(),
      sanctionedAt: application.sanctionedAt?.toISOString(),
      disbursedAt: application.disbursedAt?.toISOString(),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      version: application.version,
    };
  }

  private formatApplicationSummary(application: LoanApplication): ApplicationSummaryDto {
    let nextStep: string | undefined;
    switch (application.status) {
      case ApplicationStatus.DRAFT:
        nextStep = 'COMPLETE_KYC';
        break;
      case ApplicationStatus.SUBMITTED:
      case ApplicationStatus.KYC_IN_PROGRESS:
        nextStep = 'COMPLETE_KYC';
        break;
      case ApplicationStatus.KYC_COMPLETE:
      case ApplicationStatus.DOCUMENT_COLLECTION:
        nextStep = 'UPLOAD_DOCUMENTS';
        break;
      case ApplicationStatus.APPROVED:
      case ApplicationStatus.CONDITIONALLY_APPROVED:
        nextStep = 'SIGN_AGREEMENT';
        break;
      case ApplicationStatus.SANCTIONED:
        nextStep = 'PAYMENT_PENDING';
        break;
      default:
        nextStep = 'AWAIT_PROCESSING';
    }

    return {
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
      status: application.status,
      loanType: application.loanType,
      applicantName: application.applicantFullName,
      requestedAmount: application.requestedAmount,
      sanctionedAmount: application.sanctionedAmount,
      nextStep,
      submittedAt: application.submittedAt?.toISOString(),
      lastUpdatedAt: application.updatedAt.toISOString(),
    };
  }

  private async publishEvent(topic: string, payload: any): Promise<void> {
    try {
      const producer = this.kafka.producer();
      await producer.connect();
      await producer.send({
        topic,
        messages: [
          {
            key: payload.applicationId,
            value: JSON.stringify({
              messageId: uuidv4(),
              payload,
              timestamp: new Date().toISOString(),
              version: '1.0',
            }),
          },
        ],
      });
      await producer.disconnect();
    } catch (error) {
      this.logger.error(`Failed to publish event to ${topic}`, { error: error.message });
    }
  }

  async submitManagerDecision(
    applicationId: string,
    dto: ManagerDecisionDto,
    userId: string,
    userRole: string,
  ): Promise<LoanApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    const REVIEWABLE_STATUSES: ApplicationStatus[] = [
      ApplicationStatus.CREDIT_ASSESSMENT,
      ApplicationStatus.PENDING_FIELD_INVESTIGATION,
      ApplicationStatus.PENDING_LEGAL_TECHNICAL,
      ApplicationStatus.FIELD_INVESTIGATION_DONE,
      ApplicationStatus.LEGAL_TECHNICAL_DONE,
      ApplicationStatus.CREDIT_COMMITTEE,
    ];

    if (!REVIEWABLE_STATUSES.includes(application.status)) {
      throw createError('APP_004', `Application is not in a reviewable state. Current status: ${application.status}`);
    }

    const AUTHORITY_LIMITS: Record<string, number> = {
      BRANCH_MANAGER: 50_00_000,
      ZONAL_CREDIT_HEAD: 2_00_00_000,
      CREDIT_HEAD: 10_00_00_000,
    };
    const limit = AUTHORITY_LIMITS[userRole] || 0;
    if (application.requestedAmount > limit) {
      throw createError('AUTH_006', `Insufficient authority. Your limit is ₹${limit.toLocaleString('en-IN')} but requested amount is ₹${application.requestedAmount.toLocaleString('en-IN')}`);
    }

    const targetStatus = dto.action;
    const validTransitions = VALID_TRANSITIONS[application.status];
    if (!validTransitions.includes(targetStatus)) {
      throw createError('APP_004', `Cannot ${dto.action} from status ${application.status}`);
    }

    if ((dto.action === 'REJECTED' || dto.action === 'CONDITIONALLY_APPROVED') && !dto.remarks) {
      throw createError('APP_004', 'Remarks are required for REJECTED and CONDITIONALLY_APPROVED decisions');
    }

    if (dto.sanctionedAmount && dto.sanctionedAmount > application.requestedAmount) {
      throw createError('APP_004', `Sanctioned amount (₹${dto.sanctionedAmount.toLocaleString('en-IN')}) cannot exceed requested amount (₹${application.requestedAmount.toLocaleString('en-IN')})`);
    }

    const previousStatus = application.status;
    application.status = targetStatus;

    if (dto.sanctionedAmount !== undefined) {
      application.sanctionedAmount = dto.sanctionedAmount;
    }
    if (dto.tenureMonths !== undefined) {
      application.sanctionedTenureMonths = dto.tenureMonths;
    }
    if (dto.rateOfInterestBps !== undefined) {
      application.sanctionedRoiBps = dto.rateOfInterestBps;
    }

    if (dto.action === 'REJECTED') {
      application.rejectionRemarks = dto.remarks;
    } else {
      application.sanctionedAt = new Date();
    }

    await this.applicationRepository.save(application);
    await this.recordStageChange(applicationId, previousStatus, targetStatus, userId, userRole, dto.remarks);

    await this.auditService.log({
      eventCategory: AuditEventCategory.APPLICATION,
      eventType: AuditEventType.STATUS_CHANGE,
      entityType: 'LoanApplication',
      entityId: application.id,
      actorId: userId,
      actorRole: userRole,
      beforeState: JSON.stringify({ status: previousStatus }),
      afterState: JSON.stringify({ status: targetStatus, sanctionedAmount: application.sanctionedAmount }),
      metadata: {
        applicationNumber: application.applicationNumber,
        decision: dto.action,
        remarks: dto.remarks,
        sanctionedAmount: application.sanctionedAmount,
        sanctionedRoiBps: application.sanctionedRoiBps,
        sanctionedTenureMonths: application.sanctionedTenureMonths,
      },
    });

    await this.publishEvent('los.application.manager_decision', {
      applicationId,
      applicationNumber: application.applicationNumber,
      previousStatus,
      newStatus: targetStatus,
      decision: dto.action,
      sanctionedAmount: application.sanctionedAmount,
      sanctionedRoiBps: application.sanctionedRoiBps,
      sanctionedTenureMonths: application.sanctionedTenureMonths,
      decidedBy: userId,
      decidedByRole: userRole,
      remarks: dto.remarks,
    });

    this.logger.log(`Manager decision: ${application.applicationNumber} -> ${targetStatus} by ${userRole} ${userId}`);

    return application;
  }

  async initiateCancellationWindow(
    applicationId: string,
    reason: string,
    userId: string,
    userRole: string,
  ): Promise<LoanApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    if (application.requestedAmount > 50_000) {
      throw createError(
        'APP_004',
        'Cooling-off window is only available for loans ≤ ₹50,000 as per RBI Digital Lending Guidelines',
      );
    }

    const ALLOWABLE_CANCELLATION_STATUSES: ApplicationStatus[] = [
      ApplicationStatus.SANCTIONED,
      ApplicationStatus.APPROVED,
      ApplicationStatus.CONDITIONALLY_APPROVED,
    ];

    if (!ALLOWABLE_CANCELLATION_STATUSES.includes(application.status)) {
      throw createError(
        'APP_004',
        `Cannot initiate cooling-off cancellation from status ${application.status}. Only SANCTIONED, APPROVED, or CONDITIONALLY_APPROVED applications are eligible.`,
      );
    }

    if (application.status === ApplicationStatus.SANCTIONED && application.disbursedAt) {
      throw createError('APP_004', 'Cannot cancel — disbursement has already been completed');
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const previousStatus = application.status;
    application.status = ApplicationStatus.CANCELLATION_WINDOW;
    application.cancellationWindowInitiatedAt = now;
    application.cancellationWindowDeadline = deadline;
    application.cancellationReason = reason;
    application.cancellationByUserId = userId;
    application.cancellationByRole = userRole;

    await this.applicationRepository.save(application);
    await this.recordStageChange(applicationId, previousStatus, ApplicationStatus.CANCELLATION_WINDOW, userId, userRole, reason);

    await this.auditService.log({
      eventCategory: AuditEventCategory.APPLICATION,
      eventType: AuditEventType.STATUS_CHANGE,
      entityType: 'LoanApplication',
      entityId: application.id,
      actorId: userId,
      actorRole: userRole,
      beforeState: JSON.stringify({ status: previousStatus }),
      afterState: JSON.stringify({ status: ApplicationStatus.CANCELLATION_WINDOW, cancellationDeadline: deadline.toISOString() }),
      metadata: { applicationNumber: application.applicationNumber, cancellationReason: reason, coolingOffDays: 3 },
    });

    await this.publishEvent('los.application.cancellation_initiated', {
      applicationId,
      applicationNumber: application.applicationNumber,
      previousStatus,
      cancellationDeadline: deadline.toISOString(),
      initiatedBy: userId,
      initiatedByRole: userRole,
      reason,
    });

    this.logger.log(
      `Cooling-off initiated: ${application.applicationNumber} by ${userRole} ${userId}. Deadline: ${deadline.toISOString()}`,
    );

    return application;
  }

  async confirmCancellation(applicationId: string, userId: string): Promise<LoanApplication> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw createError('APP_001', 'Application not found');
    }

    if (application.status !== ApplicationStatus.CANCELLATION_WINDOW) {
      throw createError('APP_004', `Cannot confirm cancellation — application is in ${application.status} status`);
    }

    if (!application.cancellationWindowDeadline) {
      throw createError('APP_004', 'Cancellation window deadline not set');
    }

    const now = new Date();
    if (now > application.cancellationWindowDeadline) {
      throw createError('APP_004', 'Cooling-off cancellation window has expired. Application proceeds to disbursement.');
    }

    const previousStatus = application.status;
    application.status = ApplicationStatus.CANCELLED;

    await this.applicationRepository.save(application);
    await this.recordStageChange(
      applicationId,
      previousStatus,
      ApplicationStatus.CANCELLED,
      userId,
      'APPLICANT',
      `Cooling-off cancellation confirmed. Reason: ${application.cancellationReason}`,
    );

    await this.auditService.log({
      eventCategory: AuditEventCategory.APPLICATION,
      eventType: AuditEventType.STATUS_CHANGE,
      entityType: 'LoanApplication',
      entityId: application.id,
      actorId: userId,
      actorRole: 'APPLICANT',
      beforeState: JSON.stringify({ status: previousStatus }),
      afterState: JSON.stringify({ status: ApplicationStatus.CANCELLED }),
      metadata: {
        applicationNumber: application.applicationNumber,
        cancellationReason: application.cancellationReason,
        windowInitiatedAt: application.cancellationWindowInitiatedAt?.toISOString(),
        confirmedAt: now.toISOString(),
      },
    });

    await this.publishEvent('los.application.cancelled', {
      applicationId,
      applicationNumber: application.applicationNumber,
      cancelledBy: userId,
      cancelledByRole: 'APPLICANT',
      cancellationReason: application.cancellationReason,
      coolingOffWindow: true,
    });

    this.logger.log(`Cooling-off cancellation confirmed: ${application.applicationNumber} by ${userId}`);

    return application;
  }
}
