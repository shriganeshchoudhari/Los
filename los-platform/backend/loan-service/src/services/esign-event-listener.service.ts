import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import {
  LoanAgreement,
  LoanAgreementStatus,
  LoanAgreementSignature,
  SignatureStatus,
} from '../entities';
import {
  AuditService,
  AuditEventCategory,
  AuditEventType,
  KAFKA_TOPICS,
  extractTraceContext,
  getKafkaMessageTraceInfo,
  getTraceId,
} from '@los/common';

@Injectable()
export class EsignEventListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EsignEventListener.name);
  private consumer: Consumer;
  private readonly kafka: Kafka;

  constructor(
    @InjectRepository(LoanAgreement)
    private readonly agreementRepo: Repository<LoanAgreement>,
    @InjectRepository(LoanAgreementSignature)
    private readonly signatureRepo: Repository<LoanAgreementSignature>,
    private readonly auditService: AuditService,
  ) {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    this.kafka = new Kafka({
      clientId: 'loan-service-esign-listener',
      brokers,
      logLevel: 3,
    });
    this.consumer = this.kafka.consumer({ groupId: 'loan-service-esign-group' });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: KAFKA_TOPICS.ESIGN_COMPLETED,
        fromBeginning: false,
      });
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleEsignCompleted(payload);
        },
      });
      this.logger.log('EsignEventListener subscribed to los.esign.completed');
    } catch (error) {
      this.logger.warn(`Kafka consumer connection failed: ${error.message}. eSign completion events will not be auto-processed.`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
    } catch {}
  }

  private async handleEsignCompleted(payload: EachMessagePayload) {
    const { topic, partition, message } = payload;
    try {
      const headers = message.headers || {};
      const traceInfo = getKafkaMessageTraceInfo(headers);
      const parentTraceCtx = extractTraceContext(headers);
      const data = JSON.parse(message.value?.toString() || '{}');
      this.logger.log(
        `[traceId=${traceInfo.traceId || 'n/a'}] Processing eSign completion: ${JSON.stringify(data)}`,
      );

      const { transactionId, status, signedDocumentHash, certificateSerialNumber } = data;

      if (status !== 'SIGNED') {
        this.logger.warn(`eSign event with non-SIGNED status: ${status}`);
        return;
      }

      const signature = await this.signatureRepo.findOne({
        where: { esignTransactionId: transactionId },
        relations: ['agreement'],
      });

      if (!signature) {
        this.logger.warn(`No signature record found for transaction: ${transactionId}`);
        return;
      }

      signature.signatureStatus = SignatureStatus.SIGNED;
      signature.documentHashAfterSign = signedDocumentHash || null;
      signature.certificateSerialNumber = certificateSerialNumber || null;
      signature.signedAt = new Date();
      await this.signatureRepo.save(signature);

      const allSigs = await this.signatureRepo.find({ where: { agreementId: signature.agreementId } });
      const allSigned = allSigs.every((s) => s.signatureStatus === SignatureStatus.SIGNED);
      const anySigned = allSigs.some((s) => s.signatureStatus === SignatureStatus.SIGNED);

      const agreement = await this.agreementRepo.findOne({ where: { id: signature.agreementId } });
      if (!agreement) return;

      if (allSigned) {
        agreement.status = LoanAgreementStatus.FULLY_SIGNED;
        await this.agreementRepo.save(agreement);

        await this.auditService.log({
          eventCategory: AuditEventCategory.APPLICATION,
          eventType: AuditEventType.STATUS_CHANGE,
          entityType: 'LoanAgreement',
          entityId: agreement.id,
          metadata: {
            applicationId: agreement.applicationId,
            status: LoanAgreementStatus.FULLY_SIGNED,
            allSignersSigned: true,
            transactionId,
          },
        });

        this.logger.log(`Agreement ${agreement.agreementNumber} fully signed. Triggering disbursement flow.`);
      } else if (anySigned) {
        agreement.status = LoanAgreementStatus.PARTIALLY_SIGNED;
        await this.agreementRepo.save(agreement);
      }

    } catch (error) {
      this.logger.error(`Failed to process eSign completed event: ${error.message}`);
    }
  }
}
