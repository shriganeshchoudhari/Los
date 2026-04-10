import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Not, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  PddChecklist,
  PddChecklistItem,
  PddStatus,
  PddCategory,
} from '../entities/pdd.entity';
import { AuditService } from '@los/common';
import { AuditContext, AuditEventCategory, AuditEventType } from '@los/common';

const DEFAULT_PDD_ITEMS: Array<{ category: PddCategory; itemCode: string; itemDescription: string; isMandatory: boolean; daysAfterDisbursement: number }> = [
  { category: PddCategory.DOCUMENT, itemCode: 'PDC_CHEQUES', itemDescription: 'Post-dated cheques (PDCs) for all EMIs', isMandatory: true, daysAfterDisbursement: 7 },
  { category: PddCategory.DOCUMENT, itemCode: 'LOAN_AGREEMENT', itemDescription: 'Signed loan agreement / loan schedule', isMandatory: true, daysAfterDisbursement: 3 },
  { category: PddCategory.DOCUMENT, itemCode: 'SANCTION_LETTER_ack', itemDescription: 'Acknowledged copy of sanction letter', isMandatory: true, daysAfterDisbursement: 3 },
  { category: PddCategory.INSURANCE, itemCode: 'LIFE_INSURANCE', itemDescription: 'Life insurance / keyman insurance policy', isMandatory: true, daysAfterDisbursement: 15 },
  { category: PddCategory.DOCUMENT, itemCode: 'ADDRESS_PROOF', itemDescription: 'Updated address proof / NOC from existing lender', isMandatory: true, daysAfterDisbursement: 30 },
  { category: PddCategory.DOCUMENT, itemCode: 'BANK_STATEMENT', itemDescription: 'Post-disbursement bank statement (1 month)', isMandatory: false, daysAfterDisbursement: 45 },
];

const LOAN_TYPE_PDD_MAP: Record<string, Array<{ category: PddCategory; itemCode: string; itemDescription: string; isMandatory: boolean; daysAfterDisbursement: number }>> = {
  HOME_LOAN: [
    ...DEFAULT_PDD_ITEMS,
    { category: PddCategory.LEGAL, itemCode: 'PROPERTY_DOCS', itemDescription: 'Registered property documents / title deed', isMandatory: true, daysAfterDisbursement: 90 },
    { category: PddCategory.TECHNICAL, itemCode: 'TECHNICAL_REPORT', itemDescription: 'Technical / valuation report for property', isMandatory: true, daysAfterDisbursement: 30 },
    { category: PddCategory.INSURANCE, itemCode: 'PROPERTY_INSURANCE', itemDescription: 'Property insurance (fire & special perils)', isMandatory: true, daysAfterDisbursement: 30 },
  ],
  LAP: [
    ...DEFAULT_PDD_ITEMS,
    { category: PddCategory.LEGAL, itemCode: 'PROPERTY_DOCS', itemDescription: 'Registered property documents', isMandatory: true, daysAfterDisbursement: 60 },
    { category: PddCategory.TECHNICAL, itemCode: 'TECHNICAL_REPORT', itemDescription: 'Technical valuation report', isMandatory: true, daysAfterDisbursement: 30 },
  ],
  VEHICLE_LOAN_TWO_WHEELER: [
    { category: PddCategory.DOCUMENT, itemCode: 'PDC_CHEQUES', itemDescription: 'Post-dated cheques for all EMIs', isMandatory: true, daysAfterDisbursement: 7 },
    { category: PddCategory.DOCUMENT, itemCode: 'RC_BOOK', itemDescription: 'RC Book (registration certificate)', isMandatory: true, daysAfterDisbursement: 30 },
    { category: PddCategory.DOCUMENT, itemCode: 'INSURANCE_POLICY', itemDescription: 'Vehicle insurance policy', isMandatory: true, daysAfterDisbursement: 7 },
    { category: PddCategory.DOCUMENT, itemCode: 'LOAN_AGREEMENT', itemDescription: 'Signed loan agreement', isMandatory: true, daysAfterDisbursement: 3 },
  ],
  VEHICLE_LOAN_FOUR_WHEELER: [
    { category: PddCategory.DOCUMENT, itemCode: 'PDC_CHEQUES', itemDescription: 'Post-dated cheques for all EMIs', isMandatory: true, daysAfterDisbursement: 7 },
    { category: PddCategory.DOCUMENT, itemCode: 'RC_BOOK', itemDescription: 'RC Book (registration certificate)', isMandatory: true, daysAfterDisbursement: 30 },
    { category: PddCategory.DOCUMENT, itemCode: 'INSURANCE_POLICY', itemDescription: 'Comprehensive vehicle insurance', isMandatory: true, daysAfterDisbursement: 7 },
    { category: PddCategory.DOCUMENT, itemCode: 'LOAN_AGREEMENT', itemDescription: 'Signed loan agreement', isMandatory: true, daysAfterDisbursement: 3 },
    { category: PddCategory.DOCUMENT, itemCode: 'NOC_PREV_LENDER', itemDescription: 'NOC from previous financier (if applicable)', isMandatory: false, daysAfterDisbursement: 45 },
  ],
};

@Injectable()
export class PddService {
  private readonly logger = new Logger(PddService.name);

  constructor(
    @InjectRepository(PddChecklist)
    private readonly checklistRepo: Repository<PddChecklist>,
    @InjectRepository(PddChecklistItem)
    private readonly itemRepo: Repository<PddChecklistItem>,
    private readonly auditService: AuditService,
  ) {}

  async initiatePdd(
    applicationId: string,
    loanType: string,
    disbursementDate: Date,
    initiatedBy: string,
    customItems?: Array<{ category: PddCategory; itemCode: string; itemDescription: string; isMandatory: boolean; daysAfterDisbursement: number }>,
    auditContext?: AuditContext,
  ): Promise<PddChecklist> {
    const existing = await this.checklistRepo.findOne({ where: { applicationId } });
    if (existing) {
      throw new BadRequestException('PDD already initiated for this application');
    }

    const items = customItems || LOAN_TYPE_PDD_MAP[loanType] || DEFAULT_PDD_ITEMS;
    const checklist = this.checklistRepo.create({
      id: uuidv4(),
      applicationId,
      disbursementDate,
      initiationDate: new Date(),
      dueDate: this.calculateOverdueDueDate(disbursementDate, items),
      status: PddStatus.PENDING,
      totalItems: items.length,
      completedItems: 0,
      verifiedItems: 0,
      overdueDays: 0,
      initiatedBy,
    });

    const savedChecklist = await this.checklistRepo.save(checklist);

    for (const item of items) {
      const dueDate = new Date(disbursementDate);
      dueDate.setDate(dueDate.getDate() + item.daysAfterDisbursement);

      const checklistItem = this.itemRepo.create({
        id: uuidv4(),
        checklistId: savedChecklist.id,
        category: item.category,
        itemCode: item.itemCode,
        itemDescription: item.itemDescription,
        status: PddStatus.PENDING,
        isMandatory: item.isMandatory,
        dueDate,
      });
      await this.itemRepo.save(checklistItem);
    }

    savedChecklist.totalItems = items.length;
    await this.checklistRepo.save(savedChecklist);

    await this.auditService.log({
      eventCategory: AuditEventCategory.PDD,
      eventType: AuditEventType.PDD_INITIATED,
      entityType: 'PddChecklist',
      entityId: savedChecklist.id,
      afterState: JSON.stringify({ applicationId, loanType, totalItems: items.length }),
      context: auditContext,
    });

    this.logger.log(`PDD initiated for application ${applicationId} with ${items.length} items`);
    return savedChecklist;
  }

  async getChecklist(applicationId: string): Promise<PddChecklist & { items: PddChecklistItem[] }> {
    const checklist = await this.checklistRepo.findOne({ where: { applicationId } });
    if (!checklist) {
      throw new NotFoundException('PDD checklist not found for this application');
    }

    const items = await this.itemRepo.find({
      where: { checklistId: checklist.id },
      order: { dueDate: 'ASC' },
    });

    return { ...checklist, items };
  }

  async submitItem(
    checklistItemId: string,
    documentRefId: string | null,
    remarks: string | null,
    submittedBy: string,
    auditContext?: AuditContext,
  ): Promise<PddChecklistItem> {
    const item = await this.itemRepo.findOne({ where: { id: checklistItemId } });
    if (!item) {
      throw new NotFoundException('PDD checklist item not found');
    }

    const beforeStatus = item.status;
    item.status = PddStatus.SUBMITTED;
    item.submittedDate = new Date();
    item.documentRefId = documentRefId;
    item.remarks = remarks;

    const saved = await this.itemRepo.save(item);
    await this.updateChecklistProgress(item.checklistId);

    await this.auditService.log({
      eventCategory: AuditEventCategory.PDD,
      eventType: AuditEventType.PDD_SUBMITTED,
      entityType: 'PddChecklistItem',
      entityId: checklistItemId,
      beforeState: JSON.stringify({ status: beforeStatus }),
      afterState: JSON.stringify({ status: PddStatus.SUBMITTED }),
      context: auditContext,
      metadata: { itemCode: item.itemCode },
    });

    return saved;
  }

  async verifyItem(
    checklistItemId: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason: string | null,
    verifiedBy: string,
    auditContext?: AuditContext,
  ): Promise<PddChecklistItem> {
    const item = await this.itemRepo.findOne({ where: { id: checklistItemId } });
    if (!item) {
      throw new NotFoundException('PDD checklist item not found');
    }

    const beforeStatus = item.status;
    if (decision === 'APPROVED') {
      item.status = PddStatus.VERIFIED;
      item.verifiedDate = new Date();
      item.verifiedBy = verifiedBy;
      item.rejectionReason = null;
    } else {
      item.status = PddStatus.REJECTED;
      item.rejectionReason = rejectionReason;
    }

    const saved = await this.itemRepo.save(item);
    await this.updateChecklistProgress(item.checklistId);

    await this.auditService.log({
      eventCategory: AuditEventCategory.PDD,
      eventType: AuditEventType.DOCUMENT_REVIEW,
      entityType: 'PddChecklistItem',
      entityId: checklistItemId,
      beforeState: JSON.stringify({ status: beforeStatus }),
      afterState: JSON.stringify({ status: saved.status }),
      context: auditContext,
      metadata: { itemCode: item.itemCode, decision, rejectionReason },
    });

    return saved;
  }

  async waiveItem(
    checklistItemId: string,
    reason: string,
    waivedBy: string,
    auditContext?: AuditContext,
  ): Promise<PddChecklistItem> {
    const item = await this.itemRepo.findOne({ where: { id: checklistItemId } });
    if (!item) {
      throw new NotFoundException('PDD checklist item not found');
    }

    item.status = PddStatus.WAIVED;
    item.waivedBy = waivedBy;
    item.wavierReason = reason;
    item.waivedAt = new Date();

    const saved = await this.itemRepo.save(item);
    await this.updateChecklistProgress(item.checklistId);

    await this.auditService.log({
      eventCategory: AuditEventCategory.PDD,
      eventType: AuditEventType.PDD_WAIVED,
      entityType: 'PddChecklistItem',
      entityId: checklistItemId,
      afterState: JSON.stringify({ status: PddStatus.WAIVED, reason }),
      context: auditContext,
    });

    return saved;
  }

  async extendDueDate(
    checklistId: string,
    newDueDate: Date,
    reason: string,
    auditContext?: AuditContext,
  ): Promise<PddChecklist> {
    const checklist = await this.checklistRepo.findOne({ where: { id: checklistId } });
    if (!checklist) {
      throw new NotFoundException('PDD checklist not found');
    }

    checklist.extendedDueDate = newDueDate;
    const saved = await this.checklistRepo.save(checklist);

    await this.auditService.log({
      eventCategory: AuditEventCategory.PDD,
      eventType: AuditEventType.UPDATE,
      entityType: 'PddChecklist',
      entityId: checklistId,
      beforeState: JSON.stringify({ dueDate: checklist.dueDate }),
      afterState: JSON.stringify({ extendedDueDate: newDueDate, reason }),
      context: auditContext,
    });

    return saved;
  }

  async getOverdueChecklists(daysThreshold = 1): Promise<PddChecklist[]> {
    const today = new Date();
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() - daysThreshold);

    return this.checklistRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: PddStatus.PENDING })
      .andWhere('(c.extended_due_date < :today OR (c.extended_due_date IS NULL AND c.due_date < :today))', { today })
      .getMany();
  }

  async markBreached(checklistId: string, auditContext?: AuditContext): Promise<PddChecklist> {
    const checklist = await this.checklistRepo.findOne({ where: { id: checklistId } });
    if (!checklist) {
      throw new NotFoundException('PDD checklist not found');
    }

    checklist.status = PddStatus.BREACHED;
    const overdueDays = Math.max(
      0,
      Math.floor((Date.now() - new Date(checklist.extendedDueDate || checklist.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
    );
    checklist.overdueDays = overdueDays;

    const saved = await this.checklistRepo.save(checklist);

    await this.auditService.log({
      eventCategory: AuditEventCategory.PDD,
      eventType: AuditEventType.PDD_BREACH,
      entityType: 'PddChecklist',
      entityId: checklistId,
      afterState: JSON.stringify({ status: PddStatus.BREACHED, overdueDays }),
      context: auditContext,
    });

    return saved;
  }

  async getPddDashboard(branchCode?: string): Promise<{
    totalPdd: number;
    pending: number;
    overdue: number;
    breached: number;
    completed: number;
    averageCompletionDays: number;
  }> {
    const qb = this.checklistRepo.createQueryBuilder('c');

    if (branchCode) {
      qb.where('c.branch_code = :branchCode', { branchCode });
    }

    const all = await qb.getMany();
    const today = new Date();

    const pending = all.filter(c => c.status === PddStatus.PENDING);
    const overdue = pending.filter(c => {
      const dueDate = c.extendedDueDate || c.dueDate;
      return new Date(dueDate) < today;
    });
    const breached = all.filter(c => c.status === PddStatus.BREACHED);
    const completed = all.filter(c =>
      c.status !== PddStatus.PENDING && c.status !== PddStatus.BREACHED,
    );

    const completedWithDates = completed.filter(c => c.completionDate);
    const avgDays = completedWithDates.length > 0
      ? completedWithDates.reduce((sum, c) =>
          sum + Math.floor((new Date(c.completionDate!).getTime() - new Date(c.disbursementDate).getTime()) / (1000 * 60 * 60 * 24)), 0) / completedWithDates.length
      : 0;

    return {
      totalPdd: all.length,
      pending: pending.length,
      overdue: overdue.length,
      breached: breached.length,
      completed: completed.length,
      averageCompletionDays: Math.round(avgDays),
    };
  }

  private async updateChecklistProgress(checklistId: string): Promise<void> {
    const checklist = await this.checklistRepo.findOne({ where: { id: checklistId } });
    if (!checklist) return;

    const items = await this.itemRepo.find({ where: { checklistId } });
    const completed = items.filter(i => [PddStatus.SUBMITTED, PddStatus.VERIFIED, PddStatus.WAIVED].includes(i.status));
    const verified = items.filter(i => i.status === PddStatus.VERIFIED);

    checklist.completedItems = completed.length;
    checklist.verifiedItems = verified.length;

    const allMandatoryDone = items
      .filter(i => i.isMandatory)
      .every(i => [PddStatus.VERIFIED, PddStatus.WAIVED].includes(i.status));

    if (allMandatoryDone) {
      checklist.status = PddStatus.SUBMITTED;
      checklist.completionDate = new Date();
    }

    await this.checklistRepo.save(checklist);
  }

  private calculateOverdueDueDate(
    disbursementDate: Date,
    items: Array<{ daysAfterDisbursement: number }>,
  ): Date {
    const maxDays = Math.max(...items.map(i => i.daysAfterDisbursement));
    const dueDate = new Date(disbursementDate);
    dueDate.setDate(dueDate.getDate() + maxDays);
    return dueDate;
  }
}
