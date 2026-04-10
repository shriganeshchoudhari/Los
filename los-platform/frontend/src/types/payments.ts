// ─────────────────────────────────────────────────────────────
// 10. PAYMENTS — UPI / NEFT / IMPS
// ─────────────────────────────────────────────────────────────

import type { UUID, PaisaAmount, ISODateTimeString, IFSCCode, UPIAddress, MobileNumber } from './shared';
import type { PaymentMode } from './loan-account';

export interface BeneficiaryDetails {
  name: string;
  accountNumber: string;
  ifscCode: IFSCCode;
  accountType: 'SAVINGS' | 'CURRENT' | 'OVERDRAFT' | 'NRE' | 'NRO';
  bankName?: string;
  upiAddress?: UPIAddress;
  mobileNumber?: MobileNumber;
}

export type PaymentTransactionStatus =
  | 'INITIATED'
  | 'SUBMITTED_TO_BANK'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REVERSED'
  | 'UNDER_INVESTIGATION'
  | 'TIMEOUT';

export interface PaymentInitiateRequest {
  loanId: UUID;
  disbursementId: UUID;
  amount: PaisaAmount;
  mode: PaymentMode;
  beneficiary: BeneficiaryDetails;
  narration: string;
  scheduledAt?: ISODateTimeString;
  idempotencyKey: string;
}

export interface PaymentTransaction {
  id: UUID;
  loanId: UUID;
  disbursementId: UUID;
  transactionType: 'DISBURSEMENT' | 'REFUND' | 'REVERSAL' | 'PENALTY_RECOVERY';
  amount: PaisaAmount;
  mode: PaymentMode;
  status: PaymentTransactionStatus;
  beneficiary: BeneficiaryDetails;
  utrNumber?: string;
  bankReferenceNumber?: string;
  npciReferenceId?: string;
  narration: string;
  initiatedAt: ISODateTimeString;
  processedAt?: ISODateTimeString;
  settledAt?: ISODateTimeString;
  failureCode?: string;
  failureMessage?: string;
  reversalReason?: string;
  retryCount: number;
  idempotencyKey: string;
}

// ── Penny Drop ──

export interface PennyDropRequest {
  applicationId: UUID;
  accountNumber: string;
  ifscCode: IFSCCode;
  accountHolderName: string;
  idempotencyKey: string;
}

export interface PennyDropResult {
  requestId: UUID;
  status: 'SUCCESS' | 'FAILED' | 'INVALID_ACCOUNT';
  accountHolderName?: string;
  nameMatchScore?: number;
  bankReferenceNumber?: string;
  processedAt: ISODateTimeString;
}

// ── Webhooks ──

export type PaymentWebhookEvent =
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REVERSED'
  | 'NACH_MANDATE_REGISTERED'
  | 'NACH_MANDATE_FAILED'
  | 'NACH_DEBIT_SUCCESS'
  | 'NACH_DEBIT_FAILED'
  | 'NACH_DEBIT_RETURNED';

export interface PaymentWebhookPayload {
  webhookId: UUID;
  eventType: PaymentWebhookEvent;
  transactionId: UUID;
  utrNumber?: string;
  amount: PaisaAmount;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  timestamp: ISODateTimeString;
  signature: string;
  provider: 'NPCI' | 'RBI_RTGS' | 'INTERNAL_CBS';
}
