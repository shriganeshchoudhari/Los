import { Injectable, OnModuleInit, OnModuleDestroy, Logger, NotFoundException } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { PddService } from './pdd.service';
import { LoanApplicationService } from './loan-application.service';
import { LoanApplication } from '../entities';
import { KAFKA_TOPICS, AuditService, AuditEventCategory, AuditEventType, extractTraceContext, getKafkaMessageTraceInfo } from '@los/common';

@Injectable()
export class PddEventListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PddEventListener.name);
  private consumer: Consumer;
  private readonly kafka: Kafka;

  constructor(
    private readonly pddService: PddService,
    private readonly applicationService: LoanApplicationService,
    private readonly auditService: AuditService,
  ) {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    this.kafka = new Kafka({
      clientId: 'loan-service-pdd-listener',
      brokers,
      logLevel: 3,
    });
    this.consumer = this.kafka.consumer({ groupId: 'loan-service-pdd-group' });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: KAFKA_TOPICS.AGREEMENT_SIGNED, fromBeginning: false });
      await this.consumer.subscribe({ topic: 'los.tranche.disbursement_success', fromBeginning: false });
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });
      this.logger.log('PddEventListener subscribed to los.agreement.signed + los.tranche.disbursement_success');
    } catch (error) {
      this.logger.warn(`Kafka consumer connection failed: ${error.message}. PDD auto-initiation will not work.`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
    } catch {}
  }

  private async handleMessage(payload: EachMessagePayload) {
    const { topic, message } = payload;
    try {
      const headers = message.headers || {};
      const traceInfo = getKafkaMessageTraceInfo(headers);
      extractTraceContext(headers);
      const data = JSON.parse(message.value?.toString() || '{}');
      this.logger.log(`[traceId=${traceInfo.traceId || 'n/a'}] PddEventListener received: ${topic}`);

      if (topic === KAFKA_TOPICS.AGREEMENT_SIGNED) {
        await this.handleAgreementSigned(data);
      } else if (topic === 'los.tranche.disbursement_success') {
        await this.handleDisbursementSuccess(data);
      }
    } catch (error) {
      this.logger.error(`Failed to handle Kafka message on ${topic}: ${error.message}`);
    }
  }

  private async handleAgreementSigned(data: {
    agreementId: string;
    applicationId: string;
    agreementNumber: string;
    signedAt: string;
    allSignatures: Array<{ signerType: string; signerName: string; certificateSerialNumber: string }>;
  }) {
    const { applicationId, agreementNumber, signedAt } = data;

    const app = await this.applicationService.getApplicationRaw(applicationId);
    if (!app) {
      this.logger.warn(`Application ${applicationId} not found for PDD initiation`);
      return;
    }

    const disbursementDate = new Date(signedAt);
    await this.initiatePddForApplication(app, disbursementDate, `Agreement ${agreementNumber} signed`);
  }

  private async handleDisbursementSuccess(data: {
    applicationId: string;
    amount: number;
    trancheCode: string;
    disbursementId: string;
    utrNumber: string;
    timestamp: string;
  }) {
    const { applicationId, amount, trancheCode, disbursementId, utrNumber, timestamp } = data;

    const app = await this.applicationService.getApplicationRaw(applicationId);
    if (!app) {
      this.logger.warn(`Application ${applicationId} not found for PDD initiation`);
      return;
    }

    const disbursementDate = new Date(timestamp);

    await this.initiatePddForApplication(app, disbursementDate, `Tranche ${trancheCode} disbursed (UTR: ${utrNumber})`);

    this.logger.log(
      `PDD initiated via tranche disbursement: ${trancheCode} for application ${applicationId}, amount ${amount}`,
    );
  }

  private async initiatePddForApplication(
    app: LoanApplication,
    disbursementDate: Date,
    triggeredBy: string,
  ): Promise<void> {
    try {
      const existing = await this.pddService.getChecklist(app.id).catch(() => null);
      if (existing) {
        this.logger.log(`PDD already exists for application ${app.id}, skipping`);
        return;
      }

      const loanTypeMap: Record<string, string> = {
        HOME_LOAN: 'HOME_LOAN',
        LAP: 'LAP',
        PERSONAL_LOAN: 'PL',
        VEHICLE_LOAN_TWO_WHEELER: 'VEHICLE_LOAN_TWO_WHEELER',
        VEHICLE_LOAN_FOUR_WHEELER: 'VEHICLE_LOAN_FOUR_WHEELER',
        BUSINESS_LOAN: 'BL',
      };

      const loanType = loanTypeMap[app.loanType] || 'DEFAULT';
      const initiatedBy = app.userId || 'SYSTEM';

      const checklist = await this.pddService.initiatePdd(
        app.id,
        loanType,
        disbursementDate,
        initiatedBy,
      );

      await this.auditService.log({
        eventCategory: AuditEventCategory.PDD,
        eventType: AuditEventType.PDD_INITIATED,
        entityType: 'PddChecklist',
        entityId: checklist.id,
        context: { actorId: initiatedBy },
        metadata: {
          applicationId: app.id,
          applicationNumber: app.applicationNumber,
          loanType: app.loanType,
          disbursementDate: disbursementDate.toISOString(),
          triggeredBy,
          totalItems: checklist.totalItems,
        },
      });

      this.logger.log(
        `PDD checklist ${checklist.id} created for application ${app.id} (${app.applicationNumber}), ${checklist.totalItems} items`,
      );
    } catch (error) {
      if (error instanceof NotFoundException || error.message?.includes('already')) {
        this.logger.warn(`PDD initiation skipped: ${error.message}`);
      } else {
        this.logger.error(`Failed to initiate PDD for application ${app.id}: ${error.message}`);
      }
    }
  }
}
