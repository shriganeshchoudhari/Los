import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { KafkaService, KAFKA_TOPICS } from '@los/common';
import {
  DisbursementTranche,
  DisbursementPlan,
  DisbursementInspection,
  TrancheStatus,
  TrancheMilestone,
} from '../entities/tranche.entity';
import {
  Disbursement,
  DisbursementStatus,
  PaymentMode,
} from '../entities/payment.entity';
import {
  CreateTrancheDto,
  BatchCreateTrancheDto,
  UpdateTrancheDto,
  ApproveTrancheDto,
  RejectTrancheDto,
  ScheduleDisbursementDto,
  DisbursementInspectionDto,
  TranchePlanDto,
} from '../dto/tranche.dto';

const MAX_TRANCHES = 10;
const DEFAULT_FIRST_TRANCHE_MIN_PCT = 10;
const DEFAULT_SUBSEQUENT_MIN_PCT = 5;
const DEFAULT_FIRST_DISBURSEMENT_MIN = 100000;

@Injectable()
export class TrancheService {
  private readonly logger = new Logger(TrancheService.name);

  constructor(
    @InjectRepository(DisbursementTranche)
    private readonly trancheRepo: Repository<DisbursementTranche>,
    @InjectRepository(DisbursementPlan)
    private readonly planRepo: Repository<DisbursementPlan>,
    @InjectRepository(DisbursementInspection)
    private readonly inspectionRepo: Repository<DisbursementInspection>,
    @InjectRepository(Disbursement)
    private readonly disbursementRepo: Repository<Disbursement>,
    private readonly dataSource: DataSource,
    private readonly kafka: KafkaService,
    private readonly configService: ConfigService,
  ) {}

  async createPlan(dto: TranchePlanDto): Promise<{ planId: string }> {
    const existing = await this.planRepo.findOne({ where: { applicationId: dto.applicationId, isActive: true } });
    if (existing) {
      throw new ConflictException(`Active disbursement plan already exists for application ${dto.applicationId}`);
    }

    const plan = this.planRepo.create({
      applicationId: dto.applicationId,
      totalTranches: dto.totalTranches,
      totalPlannedAmount: 0,
      totalDisbursedAmount: 0,
      firstTrancheMinPercent: dto.firstTrancheMinPercent ?? DEFAULT_FIRST_TRANCHE_MIN_PCT,
      subsequentTrancheMinPercent: dto.subsequentTrancheMinPercent ?? DEFAULT_SUBSEQUENT_MIN_PCT,
      stageName: dto.stageName || 'Under Construction',
      projectType: dto.projectType || 'CONSTRUCTION',
      expectedCompletionMonths: dto.expectedCompletionMonths,
      planStatus: 'DRAFT',
      maxTranches: MAX_TRANCHES,
    });

    if (dto.totalTranches > MAX_TRANCHES) {
      throw new BadRequestException(`Maximum ${MAX_TRANCHES} tranches allowed per loan`);
    }

    const saved = await this.planRepo.save(plan);
    this.logger.log(`Disbursement plan created for application ${dto.applicationId}: ${dto.totalTranches} tranches`);
    return { planId: saved.id };
  }

  async createTranche(dto: CreateTrancheDto): Promise<DisbursementTranche> {
    const plan = await this.planRepo.findOne({ where: { applicationId: dto.applicationId, isActive: true } });
    if (!plan) {
      throw new NotFoundException('Active disbursement plan not found for this application');
    }

    if (dto.trancheNumber > plan.totalTranches) {
      throw new BadRequestException(`Tranche number ${dto.trancheNumber} exceeds plan total of ${plan.totalTranches}`);
    }

    const existing = await this.trancheRepo.findOne({ where: { applicationId: dto.applicationId, trancheNumber: dto.trancheNumber } });
    if (existing) {
      throw new ConflictException(`Tranche ${dto.trancheNumber} already exists`);
    }

    const percentageOfSanction = Number(((dto.amount / Number(plan.totalSanctionedAmount)) * 100).toFixed(2));

    if (dto.trancheNumber === 1) {
      const minFirstAmt = Math.max(
        Number(plan.totalSanctionedAmount) * (plan.firstTrancheMinPercent / 100),
        plan.firstDisbursementMinAmount,
      );
      if (dto.amount < minFirstAmt) {
        throw new BadRequestException(
          `First tranche amount must be at least ₹${minFirstAmt.toLocaleString('en-IN')} ` +
          `(${plan.firstTrancheMinPercent}% of sanctioned or minimum ${plan.firstDisbursementMinAmount})`,
        );
      }
    } else {
      const minSubsequentAmt = Number(plan.totalSanctionedAmount) * (plan.subsequentTrancheMinPercent / 100);
      if (dto.amount < minSubsequentAmt) {
        throw new BadRequestException(
          `Subsequent tranche minimum is ₹${minSubsequentAmt.toLocaleString('en-IN')} (${plan.subsequentTrancheMinPercent}% of sanctioned)`,
        );
      }
    }

    const totalPlanned = await this.trancheRepo
      .createQueryBuilder('t')
      .where('t.application_id = :appId', { appId: dto.applicationId })
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .getRawOne();

    const newTotal = Number(totalPlanned?.total || 0) + dto.amount;
    if (newTotal > Number(plan.totalSanctionedAmount)) {
      throw new BadRequestException(
        `Total planned amount ₹${newTotal.toLocaleString('en-IN')} exceeds sanctioned amount ₹${Number(plan.totalSanctionedAmount).toLocaleString('en-IN')}`,
      );
    }

    const latestAllowedDate = new Date(dto.plannedDate);
    if (dto.trancheNumber === 1) {
      latestAllowedDate.setMonth(latestAllowedDate.getMonth() + 1);
    } else {
      latestAllowedDate.setDate(latestAllowedDate.getDate() + 30);
    }

    const trancheCode = `TRANCHE-${dto.applicationId.slice(0, 8).toUpperCase()}-${String(dto.trancheNumber).padStart(2, '0')}`;

    const tranche = this.trancheRepo.create({
      applicationId: dto.applicationId,
      trancheNumber: dto.trancheNumber,
      trancheCode,
      trancheName: dto.trancheName,
      amount: dto.amount,
      cumulativeAmount: newTotal,
      cumulativeDisbursed: 0,
      percentageOfSanction,
      milestone: dto.milestone,
      milestoneDescription: dto.milestoneDescription,
      plannedDate: new Date(dto.plannedDate),
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
      latestAllowedDate,
      benefitDescription: dto.benefitDescription,
      requiredDocuments: dto.requiredDocuments || [],
      documentsApproved: false,
      inspectionRequired: dto.inspectionRequired ?? false,
      status: TrancheStatus.PLANNED,
    });

    const saved = await this.trancheRepo.save(tranche);

    await this.planRepo.update(plan.id, { totalPlannedAmount: newTotal });

    this.logger.log(`Tranche ${trancheCode} created: ₹${dto.amount.toLocaleString('en-IN')} for ${dto.milestone}`);

    return saved;
  }

  async batchCreateTranches(dto: BatchCreateTrancheDto): Promise<{ planId: string; tranches: DisbursementTranche[] }> {
    const plan = await this.planRepo.findOne({ where: { applicationId: dto.applicationId, isActive: true } });
    if (!plan) {
      throw new NotFoundException('Active disbursement plan not found');
    }

    const sortedTranches = [...dto.tranches].sort((a, b) => a.trancheNumber - b.trancheNumber);
    let runningTotal = 0;

    for (const t of sortedTranches) {
      const newTotal = runningTotal + t.amount;
      if (newTotal > Number(plan.totalSanctionedAmount)) {
        throw new BadRequestException(
          `Batch total exceeds sanctioned amount at tranche ${t.trancheNumber}`,
        );
      }

      const minAmt = t.trancheNumber === 1
        ? Math.max(Number(plan.totalSanctionedAmount) * (plan.firstTrancheMinPercent / 100), plan.firstDisbursementMinAmount)
        : Number(plan.totalSanctionedAmount) * (plan.subsequentTrancheMinPercent / 100);

      if (t.amount < minAmt) {
        throw new BadRequestException(
          `Tranche ${t.trancheNumber}: minimum amount is ₹${minAmt.toLocaleString('en-IN')}`,
        );
      }

      runningTotal = newTotal;
    }

    if (sortedTranches.length !== plan.totalTranches) {
      throw new BadRequestException(
        `Batch must contain exactly ${plan.totalTranches} tranches (got ${sortedTranches.length})`,
      );
    }

    const created: DisbursementTranche[] = [];
    for (const t of sortedTranches) {
      const tranche = await this.createTranche(t);
      created.push(tranche);
    }

    return { planId: plan.id, tranches: created };
  }

  async updateTranche(trancheId: string, dto: UpdateTrancheDto, userId: string): Promise<DisbursementTranche> {
    const tranche = await this.trancheRepo.findOne({ where: { id: trancheId } });
    if (!tranche) {
      throw new NotFoundException('Tranche not found');
    }

    if (![TrancheStatus.PLANNED, TrancheStatus.SUBMITTED].includes(tranche.status)) {
      throw new BadRequestException(`Cannot modify tranche in ${tranche.status} status`);
    }

    if (dto.amount !== undefined && dto.amount !== Number(tranche.amount)) {
      const plan = await this.planRepo.findOne({ where: { applicationId: tranche.applicationId, isActive: true } });
      if (!plan) throw new NotFoundException('Plan not found');

      const otherTranches = await this.trancheRepo
        .createQueryBuilder('t')
        .where('t.application_id = :appId AND t.id != :trancheId', { appId: tranche.applicationId, trancheId })
        .select('COALESCE(SUM(t.amount), 0)', 'total')
        .getRawOne();

      const newTotal = Number(otherTranches?.total || 0) + dto.amount;
      if (newTotal > Number(plan.totalSanctionedAmount)) {
        throw new BadRequestException(`Total would exceed sanctioned amount`);
      }

      tranche.amount = dto.amount;
      tranche.cumulativeAmount = newTotal;
      tranche.percentageOfSanction = Number(((dto.amount / Number(plan.totalSanctionedAmount)) * 100).toFixed(2));
    }

    if (dto.scheduledDate) tranche.scheduledDate = new Date(dto.scheduledDate);
    if (dto.milestone) tranche.milestone = dto.milestone;
    if (dto.milestoneDescription) tranche.milestoneDescription = dto.milestoneDescription;
    if (dto.benefitDescription) tranche.benefitDescription = dto.benefitDescription;
    if (dto.submittedDocuments) tranche.submittedDocuments = dto.submittedDocuments;
    if (dto.documentsApproved !== undefined) tranche.documentsApproved = dto.documentsApproved;
    if (dto.remarks) tranche.remarks = dto.remarks;

    tranche.version += 1;
    const saved = await this.trancheRepo.save(tranche);

    this.logger.log(`Tranche ${saved.trancheCode} updated by ${userId}`);

    return saved;
  }

  async approveTranche(trancheId: string, dto: ApproveTrancheDto, approverId: string): Promise<DisbursementTranche> {
    const tranche = await this.trancheRepo.findOne({ where: { id: trancheId } });
    if (!tranche) {
      throw new NotFoundException('Tranche not found');
    }

    if (tranche.status !== TrancheStatus.SUBMITTED) {
      throw new BadRequestException(`Tranche must be in SUBMITTED status to approve (current: ${tranche.status})`);
    }

    if (tranche.inspectionRequired && !tranche.documentsApproved) {
      throw new BadRequestException('Inspection required but documents not yet approved');
    }

    const pendingInspection = await this.inspectionRepo.findOne({
      where: { trancheId, status: 'PENDING' },
    });
    if (pendingInspection) {
      throw new BadRequestException('Pending inspection must be approved before tranche approval');
    }

    tranche.status = TrancheStatus.APPROVED;
    tranche.approvedBy = approverId;
    tranche.approvedAt = new Date();
    if (dto.remarks) tranche.remarks = dto.remarks;

    const saved = await this.trancheRepo.save(tranche);

    await this.kafka.emit(KAFKA_TOPICS.TRANCHE_APPROVED, {
      trancheId: saved.id,
      trancheCode: saved.trancheCode,
      applicationId: saved.applicationId,
      amount: Number(saved.amount),
      milestone: saved.milestone,
      approvedBy: approverId,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async rejectTranche(trancheId: string, dto: RejectTrancheDto, rejectedBy: string): Promise<DisbursementTranche> {
    const tranche = await this.trancheRepo.findOne({ where: { id: trancheId } });
    if (!tranche) {
      throw new NotFoundException('Tranche not found');
    }

    if (![TrancheStatus.SUBMITTED, TrancheStatus.APPROVED].includes(tranche.status)) {
      throw new BadRequestException(`Cannot reject tranche in ${tranche.status} status`);
    }

    tranche.status = TrancheStatus.CANCELLED;
    tranche.rejectedBy = rejectedBy;
    tranche.rejectedAt = new Date();
    tranche.rejectionReason = dto.rejectionReason;
    if (dto.remarks) tranche.remarks = dto.remarks;

    const saved = await this.trancheRepo.save(tranche);

    await this.kafka.emit(KAFKA_TOPICS.TRANCHE_REJECTED, {
      trancheId: saved.id,
      trancheCode: saved.trancheCode,
      applicationId: saved.applicationId,
      rejectedBy,
      rejectionReason: dto.rejectionReason,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async scheduleDisbursement(dto: ScheduleDisbursementDto): Promise<DisbursementTranche> {
    const tranche = await this.trancheRepo.findOne({ where: { id: dto.trancheId } });
    if (!tranche) {
      throw new NotFoundException('Tranche not found');
    }

    if (tranche.status !== TrancheStatus.APPROVED) {
      throw new BadRequestException(`Tranche must be APPROVED to schedule disbursement (current: ${tranche.status})`);
    }

    if (new Date() > tranche.latestAllowedDate) {
      tranche.status = TrancheStatus.EXPIRED;
      await this.trancheRepo.save(tranche);
      throw new BadRequestException('Tranche has expired — latest allowed date exceeded');
    }

    const disbursementAmount = dto.overrideAmount || Number(tranche.amount);
    if (dto.overrideAmount && dto.overrideAmount > Number(tranche.amount)) {
      throw new BadRequestException('Override amount cannot exceed approved tranche amount');
    }

    const existingDisb = await this.disbursementRepo.findOne({
      where: { applicationId: tranche.applicationId, trancheNumber: tranche.trancheNumber },
    });
    if (existingDisb && existingDisb.status === DisbursementStatus.PAYMENT_SUCCESS) {
      throw new ConflictException('Disbursement already completed for this tranche');
    }

    const disbursement = this.disbursementRepo.create({
      applicationId: tranche.applicationId,
      disbursementNumber: `DISB-${tranche.trancheCode}-${Date.now()}`,
      trancheNumber: tranche.trancheNumber,
      amount: disbursementAmount,
      paymentMode: PaymentMode.IMPS,
      beneficiaryAccountNumber: 'XXXXXXXXXX',
      beneficiaryIfsc: 'SBIN0000000',
      beneficiaryName: 'Customer',
      status: DisbursementStatus.PENDING,
      initiatedBy: 'system',
    });

    await this.disbursementRepo.save(disbursement);

    tranche.scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : tranche.scheduledDate || new Date();
    tranche.cumulativeDisbursed = disbursementAmount;
    const saved = await this.trancheRepo.save(tranche);

    await this.kafka.emit(KAFKA_TOPICS.TRANCHE_DISBURSEMENT_SCHEDULED, {
      trancheId: saved.id,
      trancheCode: saved.trancheCode,
      disbursementId: disbursement.id,
      applicationId: saved.applicationId,
      scheduledDate: saved.scheduledDate,
      amount: disbursementAmount,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async recordDisbursementSuccess(
    trancheId: string,
    disbursementId: string,
    utrNumber: string,
  ): Promise<void> {
    const tranche = await this.trancheRepo.findOne({ where: { id: trancheId } });
    if (!tranche) {
      this.logger.warn(`Tranche ${trancheId} not found during disbursement success callback`);
      return;
    }

    const disbursement = await this.disbursementRepo.findOne({ where: { id: disbursementId } });
    if (!disbursement) {
      this.logger.warn(`Disbursement ${disbursementId} not found`);
      return;
    }

    const allTranches = await this.trancheRepo.find({ where: { applicationId: tranche.applicationId } });
    const allDisb = await this.disbursementRepo.find({ where: { applicationId: tranche.applicationId } });

    const totalDisbursed = allDisb
      .filter((d) => d.status === DisbursementStatus.PAYMENT_SUCCESS)
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const fullyDisbCount = allTranches.filter((t) => t.cumulativeDisbursed >= Number(t.amount)).length;

    tranche.actualDisbursementDate = new Date();
    tranche.cumulativeDisbursed = Number(tranche.cumulativeDisbursed) + Number(disbursement.amount);

    if (fullyDisbCount === allTranches.length) {
      tranche.status = TrancheStatus.FULLY_DISBURSED;
    } else {
      tranche.status = TrancheStatus.PARTIALLY_DISBURSED;
    }

    await this.trancheRepo.save(tranche);
    await this.planRepo.update({ applicationId: tranche.applicationId, isActive: true }, { totalDisbursedAmount: totalDisbursed });

    await this.kafka.emit(KAFKA_TOPICS.TRANCHE_DISBURSEMENT_SUCCESS, {
      trancheId: tranche.id,
      trancheCode: tranche.trancheCode,
      disbursementId,
      applicationId: tranche.applicationId,
      utrNumber,
      amount: Number(disbursement.amount),
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Tranche ${tranche.trancheCode} disbursement confirmed: UTR ${utrNumber}`);
  }

  async submitTranche(trancheId: string): Promise<DisbursementTranche> {
    const tranche = await this.trancheRepo.findOne({ where: { id: trancheId } });
    if (!tranche) throw new NotFoundException('Tranche not found');
    if (tranche.status !== TrancheStatus.PLANNED) {
      throw new BadRequestException(`Only PLANNNED tranches can be submitted (current: ${tranche.status})`);
    }

    if (!tranche.submittedDocuments?.length && tranche.requiredDocuments?.length) {
      throw new BadRequestException('Required documents must be submitted before sending for approval');
    }

    tranche.status = TrancheStatus.SUBMITTED;
    const saved = await this.trancheRepo.save(tranche);

    await this.kafka.emit(KAFKA_TOPICS.TRANCHE_SUBMITTED, {
      trancheId: saved.id,
      trancheCode: saved.trancheCode,
      applicationId: saved.applicationId,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async createInspection(dto: DisbursementInspectionDto, inspectorId: string): Promise<DisbursementInspection> {
    const tranche = await this.trancheRepo.findOne({ where: { id: dto.trancheId } });
    if (!tranche) throw new NotFoundException('Tranche not found');

    const recommendedAmount = Number(tranche.amount) * (dto.completionPercent / 100);

    const inspection = this.inspectionRepo.create({
      applicationId: tranche.applicationId,
      trancheId: dto.trancheId,
      inspectionType: dto.inspectionType,
      inspectionDate: new Date(dto.inspectionDate),
      inspectorName: dto.inspectorName,
      inspectorAgency: dto.inspectorAgency,
      siteAddress: dto.siteAddress,
      stageOfConstruction: dto.stageOfConstruction,
      completionPercent: dto.completionPercent,
      previousCompletionPercent: dto.previousCompletionPercent,
      stageWiseProgress: dto.stageWiseProgress,
      qualityObservations: dto.qualityObservations,
      riskFlags: dto.riskFlags,
      recommendedDisbursementPercent: dto.completionPercent,
      recommendedAmount,
      inspectionReportKey: dto.inspectionReportKey,
      photos: dto.photos,
      status: 'PENDING',
    });

    const saved = await this.inspectionRepo.save(inspection);

    await this.kafka.emit(KAFKA_TOPICS.INSPECTION_CREATED, {
      inspectionId: saved.id,
      trancheId: tranche.id,
      trancheCode: tranche.trancheCode,
      applicationId: tranche.applicationId,
      completionPercent: dto.completionPercent,
      recommendedAmount,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async approveInspection(inspectionId: string, approvedBy: string, remarks?: string): Promise<DisbursementInspection> {
    const inspection = await this.inspectionRepo.findOne({ where: { id: inspectionId } });
    if (!inspection) throw new NotFoundException('Inspection not found');

    inspection.status = 'APPROVED';
    inspection.approvedBy = approvedBy;
    inspection.approvedAt = new Date();
    inspection.approvalRemarks = remarks;

    const saved = await this.inspectionRepo.save(inspection);

    await this.trancheRepo.update(inspection.trancheId, { documentsApproved: true });

    return saved;
  }

  async getPlanByApplication(applicationId: string) {
    const plan = await this.planRepo.findOne({ where: { applicationId, isActive: true } });
    if (!plan) throw new NotFoundException('Disbursement plan not found');

    const tranches = await this.trancheRepo.find({
      where: { applicationId },
      order: { trancheNumber: 'ASC' },
    });

    const disbursements = await this.disbursementRepo.find({ where: { applicationId } });

    return {
      planId: plan.id,
      applicationId: plan.applicationId,
      totalSanctionedAmount: Number(plan.totalSanctionedAmount),
      totalPlannedAmount: Number(plan.totalPlannedAmount),
      totalDisbursedAmount: Number(plan.totalDisbursedAmount),
      totalTranches: plan.totalTranches,
      disbursedTranches: tranches.filter((t) =>
        [TrancheStatus.PARTIALLY_DISBURSED, TrancheStatus.FULLY_DISBURSED].includes(t.status),
      ).length,
      planStatus: plan.planStatus,
      tranches: tranches.map((t) => ({
        trancheId: t.id,
        trancheCode: t.trancheCode,
        trancheNumber: t.trancheNumber,
        trancheName: t.trancheName,
        amount: Number(t.amount),
        cumulativeAmount: Number(t.cumulativeAmount),
        percentageOfSanction: Number(t.percentageOfSanction),
        milestone: t.milestone,
        status: t.status,
        plannedDate: t.plannedDate,
        scheduledDate: t.scheduledDate,
        actualDisbursementDate: t.actualDisbursementDate,
        documentsApproved: t.documentsApproved,
        inspectionRequired: t.inspectionRequired,
        latestAllowedDate: t.latestAllowedDate,
        inspectionReportKey: t.inspectionRequired ? null : undefined,
      })),
    };
  }

  async getTrancheById(trancheId: string): Promise<DisbursementTranche> {
    const tranche = await this.trancheRepo.findOne({ where: { id: trancheId } });
    if (!tranche) throw new NotFoundException('Tranche not found');
    return tranche;
  }

  async getInspectionsByTranche(trancheId: string): Promise<DisbursementInspection[]> {
    return this.inspectionRepo.find({ where: { trancheId }, order: { inspectionDate: 'DESC' } });
  }

  async setPlanSanctionedAmount(applicationId: string, sanctionedAmount: number, userId: string): Promise<void> {
    const plan = await this.planRepo.findOne({ where: { applicationId, isActive: true } });
    if (!plan) throw new NotFoundException('Disbursement plan not found');

    if (plan.totalDisbursedAmount > 0) {
      throw new BadRequestException('Cannot modify sanctioned amount after disbursements have been made');
    }

    await this.planRepo.update(plan.id, { totalSanctionedAmount: sanctionedAmount });
    this.logger.log(`Sanctioned amount set to ₹${sanctionedAmount} for application ${applicationId} by ${userId}`);
  }
}
