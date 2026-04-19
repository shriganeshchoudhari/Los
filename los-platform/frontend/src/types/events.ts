// ─────────────────────────────────────────────────────────────
// 13. EVENT BUS (KAFKA TOPICS)
// ─────────────────────────────────────────────────────────────

import type { UUID, PaisaAmount, ISODateTimeString } from './shared';
import type { LoanType, ChannelCode, ApplicationStatus, KYCStatus, BureauProvider, BureauJobStatus } from './loan';
import type { DecisionStatus } from './decision';

export type KafkaTopic =
  | 'los.application.submitted'
  | 'los.kyc.initiated'
  | 'los.kyc.completed'
  | 'los.bureau.pull.requested'
  | 'los.bureau.pull.completed'
  | 'los.decision.requested'
  | 'los.decision.completed'
  | 'los.loan.sanctioned'
  | 'los.disbursement.initiated'
  | 'los.disbursement.completed'
  | 'los.payment.received'
  | 'los.payment.failed'
  | 'los.notification.requested'
  | 'los.audit.event'
  | 'los.cbs.sync.requested';

export interface KafkaHeaders {
  correlationId: UUID;
  sourceService: string;
  traceId: string;
  spanId: string;
}

export interface KafkaMessage<T> {
  messageId: UUID;
  topic: KafkaTopic;
  key: string;
  payload: T;
  headers: KafkaHeaders;
  timestamp: ISODateTimeString;
  version: string;
  retryCount: number;
  maxRetries: number;
  deadLetterAfter?: ISODateTimeString;
}

// ── Event Payloads ──

export interface ApplicationSubmittedEvent {
  applicationId: UUID;
  userId: UUID;
  loanType: LoanType;
  requestedAmount: PaisaAmount;
  channelCode: ChannelCode;
  branchCode: string;
}

export interface KYCCompletedEvent {
  applicationId: UUID;
  userId: UUID;
  kycId: UUID;
  status: KYCStatus;
  overallRiskScore: number;
}

export interface BureauPullCompletedEvent {
  applicationId: UUID;
  jobId: UUID;
  creditScore: number;
  providers: BureauProvider[];
  status: BureauJobStatus;
}

export interface DecisionCompletedEvent {
  applicationId: UUID;
  decisionId: UUID;
  decision: 'APPROVE' | 'REJECT' | 'MANUAL';
  approvedAmount?: PaisaAmount;
  rateOfInterestBps?: number;
}

export interface DisbursementCompletedEvent {
  loanId: UUID;
  disbursementId: UUID;
  amount: PaisaAmount;
  utrNumber: string;
  settledAt: ISODateTimeString;
}
