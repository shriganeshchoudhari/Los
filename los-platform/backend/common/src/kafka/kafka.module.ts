import { Module, Global } from '@nestjs/common';
import { KafkaService } from './kafka.service';

export const KAFKA_TOPICS = {
  APPLICATION_CREATED: 'los.application.created',
  APPLICATION_SUBMITTED: 'los.application.submitted',
  APPLICATION_STATUS_CHANGED: 'los.application.status_changed',
  KYC_COMPLETED: 'los.kyc.completed',
  DECISION_COMPLETED: 'los.decision.completed',
  BUREAU_PULL_COMPLETED: 'los.bureau.pull.completed',
  CBS_CUSTOMER_CREATED: 'los.cbs.customer.created',
  CBS_LOANACCOUNT_CREATED: 'los.cbs.loanaccount.created',
  PAYMENT_INITIATED: 'los.payment.initiated',
  PAYMENT_SUCCESS: 'los.payment.success',
  NOTIFICATION_OTP_SENT: 'los.notification.otp.sent',
  NOTIFICATION_STATUS_UPDATED: 'los.notification.status.updated',
  NOTIFICATION_OPTOUT: 'los.notification.optout',
  ESIGN_INITIATED: 'los.esign.initiated',
  ESIGN_COMPLETED: 'los.esign.completed',
  AGREEMENT_SIGNED: 'los.agreement.signed',
  PDD_INITIATED: 'los.pdd.initiated',
  PDD_OVERDUE: 'los.pdd.overdue',
  PDD_BREACHED: 'los.pdd.breached',
  PDD_COMPLETED: 'los.pdd.completed',
  PDD_REMINDER: 'los.pdd.reminder',
  ESIGN_CANCELLED: 'los.esign.cancelled',
  TRANCHE_APPROVED: 'los.tranche.approved',
  TRANCHE_REJECTED: 'los.tranche.rejected',
  TRANCHE_DISBURSEMENT_SCHEDULED: 'los.tranche.disbursement_scheduled',
  TRANCHE_DISBURSEMENT_SUCCESS: 'los.tranche.disbursement_success',
  TRANCHE_SUBMITTED: 'los.tranche.submitted',
  INSPECTION_CREATED: 'los.inspection.created',
  DSA_PARTNER_REGISTERED: 'los.dsa.partner.registered',
  DSA_PARTNER_STATUS_CHANGED: 'los.dsa.partner.status_changed',
  DSA_OFFICER_CREATED: 'los.dsa.officer.created',
  DSA_APPLICATION_CREATED: 'los.dsa.application.created',
  DSA_COMMISSION_EARNED: 'los.dsa.commission.earned',
  DSA_COMMISSION_PAID: 'los.dsa.commission.paid',
} as const;

@Global()
@Module({
  providers: [KafkaService],
  exports: [KafkaService, KAFKA_TOPICS],
})
export class KafkaModule {}
