import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PddChecklist,
  PddChecklistItem,
  PddStatus,
} from '../entities/pdd.entity';
import { LoanApplicationService } from './loan-application.service';
import { KafkaService, KAFKA_TOPICS } from '@los/common';
import { AuditService, AuditEventCategory, AuditEventType } from '@los/common';

@Injectable()
export class PddSchedulerService {
  private readonly logger = new Logger(PddSchedulerService.name);

  constructor(
    @InjectRepository(PddChecklist)
    private readonly checklistRepo: Repository<PddChecklist>,
    @InjectRepository(PddChecklistItem)
    private readonly itemRepo: Repository<PddChecklistItem>,
    private readonly applicationService: LoanApplicationService,
    private readonly kafka: KafkaService,
    private readonly auditService: AuditService,
  ) {}

  @Cron('0 9 * * 1-6', { name: 'pdd-overdue-check' })
  async handleOverdueCheck() {
    this.logger.log('Running daily PDD overdue check');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueChecklists = await this.checklistRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: PddStatus.PENDING })
      .andWhere('(c.extended_due_date < :today OR (c.extended_due_date IS NULL AND c.due_date < :today))')
      .setParameter('today', today)
      .getMany();

    for (const checklist of overdueChecklists) {
      await this.processOverdueChecklist(checklist, today);
    }

    this.logger.log(`PDD overdue check complete. Processed ${overdueChecklists.length} checklists.`);
  }

  private async processOverdueChecklist(checklist: PddChecklist, today: Date): Promise<void> {
    const dueDate = new Date(checklist.extendedDueDate || checklist.dueDate);
    const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    checklist.overdueDays = overdueDays;

    if (overdueDays >= 30 && checklist.status !== PddStatus.BREACHED) {
      await this.markBreached(checklist);
    } else {
      await this.publishOverdueEvent(checklist, overdueDays);
    }
  }

  private async markBreached(checklist: PddChecklist): Promise<void> {
    checklist.status = PddStatus.BREACHED;
    await this.checklistRepo.save(checklist);

    await this.auditService.log({
      eventCategory: AuditEventCategory.PDD,
      eventType: AuditEventType.PDD_BREACH,
      entityType: 'PddChecklist',
      entityId: checklist.id,
      metadata: {
        applicationId: checklist.applicationId,
        overdueDays: checklist.overdueDays,
        reason: 'PDD overdue > 30 days',
      },
    });

    const app = await this.applicationService.getApplicationRaw(checklist.applicationId);

    await this.kafka.emit(KAFKA_TOPICS.PDD_BREACHED, {
      checklistId: checklist.id,
      applicationId: checklist.applicationId,
      applicationNumber: app?.applicationNumber || null,
      disbursementDate: checklist.disbursementDate?.toISOString(),
      dueDate: (checklist.extendedDueDate || checklist.dueDate)?.toString(),
      overdueDays: checklist.overdueDays,
      loanAccountNumber: checklist.loanAccountNumber || null,
      customerMobile: app?.applicantProfile?.mobileNumber || null,
      customerEmail: app?.applicantProfile?.email || null,
      branchCode: app?.branchCode || null,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`PDD breach recorded for checklist ${checklist.id}, overdue ${checklist.overdueDays} days`);
  }

  private async publishOverdueEvent(checklist: PddChecklist, overdueDays: number): Promise<void> {
    const app = await this.applicationService.getApplicationRaw(checklist.applicationId);

    await this.kafka.emit(KAFKA_TOPICS.PDD_OVERDUE, {
      checklistId: checklist.id,
      applicationId: checklist.applicationId,
      applicationNumber: app?.applicationNumber || null,
      overdueDays,
      disbursementDate: checklist.disbursementDate?.toISOString(),
      dueDate: (checklist.extendedDueDate || checklist.dueDate)?.toString(),
      loanAccountNumber: checklist.loanAccountNumber || null,
      customerName: app?.applicantFullName || app?.applicantProfile?.fullName || null,
      customerMobile: app?.applicantProfile?.mobileNumber || null,
      customerEmail: app?.applicantProfile?.email || null,
      branchCode: app?.branchCode || null,
      assignedOfficerId: app?.assignedTo || null,
      totalItems: checklist.totalItems,
      completedItems: checklist.completedItems,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `PDD overdue event published for checklist ${checklist.id} (${overdueDays} days overdue)`,
    );
  }

  @Cron('0 9 * * 1-6', { name: 'pdd-reminder-check' })
  async handleReminderCheck() {
    this.logger.log('Running daily PDD reminder check');

    const today = new Date();
    const reminderDates = [
      new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
      new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
    ];

    const reminderChecklists = await this.checklistRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: PddStatus.PENDING })
      .getMany();

    for (const checklist of reminderChecklists) {
      for (const reminderDate of reminderDates) {
        const dueDate = new Date(checklist.extendedDueDate || checklist.dueDate);
        if (this.isSameDay(dueDate, reminderDate)) {
          const itemsDue = await this.getPendingItems(checklist.id);
          if (itemsDue.length > 0) {
            await this.publishReminderEvent(checklist, itemsDue, dueDate);
          }
        }
      }
    }
  }

  private async getPendingItems(checklistId: string): Promise<PddChecklistItem[]> {
    return this.itemRepo.find({
      where: { checklistId, status: PddStatus.PENDING },
      order: { dueDate: 'ASC' },
    });
  }

  private async publishReminderEvent(
    checklist: PddChecklist,
    items: PddChecklistItem[],
    dueDate: Date,
  ): Promise<void> {
    const app = await this.applicationService.getApplicationRaw(checklist.applicationId);
    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    await this.kafka.emit(KAFKA_TOPICS.PDD_REMINDER, {
      checklistId: checklist.id,
      applicationId: checklist.applicationId,
      applicationNumber: app?.applicationNumber || null,
      customerName: app?.applicantFullName || app?.applicantProfile?.fullName || null,
      customerMobile: app?.applicantProfile?.mobileNumber || null,
      customerEmail: app?.applicantProfile?.email || null,
      daysUntilDue,
      dueDate: dueDate.toISOString(),
      pendingItems: items.map((i) => ({
        itemCode: i.itemCode,
        itemDescription: i.itemDescription,
        isMandatory: i.isMandatory,
      })),
      branchCode: app?.branchCode || null,
      assignedOfficerId: app?.assignedTo || null,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `PDD reminder event published for checklist ${checklist.id}, ${daysUntilDue} days until due`,
    );
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
