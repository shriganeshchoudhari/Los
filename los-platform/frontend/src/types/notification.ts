// ─────────────────────────────────────────────────────────────
// 11. NOTIFICATION SERVICE
// ─────────────────────────────────────────────────────────────

import type { UUID, ISODateTimeString } from './shared';

export type NotificationChannel = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'PUSH' | 'IN_APP';

export type NotificationEvent =
  | 'APPLICATION_RECEIVED'
  | 'KYC_SUCCESS'
  | 'KYC_FAILED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_REJECTED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'SANCTION_LETTER_READY'
  | 'DISBURSEMENT_INITIATED'
  | 'DISBURSEMENT_SUCCESS'
  | 'DISBURSEMENT_FAILED'
  | 'EMI_DUE_REMINDER_7D'
  | 'EMI_DUE_REMINDER_1D'
  | 'EMI_PAID'
  | 'EMI_OVERDUE'
  | 'NACH_REGISTERED'
  | 'NACH_DEBIT_FAILED'
  | 'LOAN_CLOSURE_INTIMATION'
  | 'OTP'
  | 'CONSENT_REQUEST';

export type NotificationStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'UNDELIVERED';

export interface NotificationRequest {
  recipientUserId: UUID;
  channel: NotificationChannel;
  event: NotificationEvent;
  templateId: string;
  variables: Record<string, string>;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  scheduleAt?: ISODateTimeString;
  referenceId: UUID;
  idempotencyKey: string;
}

export interface NotificationRecord {
  id: UUID;
  recipientUserId: UUID;
  recipientContact: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  templateId: string;
  status: NotificationStatus;
  provider: string;
  providerMessageId?: string;
  attempts: number;
  errorMessage?: string;
  createdAt: ISODateTimeString;
  sentAt?: ISODateTimeString;
  deliveredAt?: ISODateTimeString;
}
