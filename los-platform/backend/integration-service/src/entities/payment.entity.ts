import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

export enum DisbursementStatus {
  PENDING = 'PENDING',
  CBS_CUSTOMER_CREATED = 'CBS_CUSTOMER_CREATED',
  CBS_ACCOUNT_CREATED = 'CBS_ACCOUNT_CREATED',
  MANDATE_PENDING = 'MANDATE_PENDING',
  MANDATE_REGISTERED = 'MANDATE_REGISTERED',
  MANDATE_CONFIRMED = 'MANDATE_CONFIRMED',
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_RETURNED = 'PAYMENT_RETURNED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED',
}

export enum PaymentMode {
  IMPS = 'IMPS',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  UPI = 'UPI',
  NACH = 'NACH',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH',
}

export enum DisbursementFailureReason {
  CBS_TIMEOUT = 'CBS_TIMEOUT',
  CBS_CONNECTION_FAILED = 'CBS_CONNECTION_FAILED',
  CBS_ACCOUNT_NOT_FOUND = 'CBS_ACCOUNT_NOT_FOUND',
  CBS_DUPLICATE_ACCOUNT = 'CBS_DUPLICATE_ACCOUNT',
  CBS_VALIDATION_ERROR = 'CBS_VALIDATION_ERROR',
  NACH_REGISTRATION_FAILED = 'NACH_REGISTRATION_FAILED',
  NACH_NOT_CONFIRMED = 'NACH_NOT_CONFIRMED',
  PAYMENT_TIMEOUT = 'PAYMENT_TIMEOUT',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  NPCI_CIRCUIT_OPEN = 'NPCI_CIRCUIT_OPEN',
  DUPLICATE_DISBURSEMENT = 'DUPLICATE_DISBURSEMENT',
  INVALID_ACCOUNT = 'INVALID_ACCOUNT',
  INVALID_IFSC = 'INVALID_IFSC',
  ACCOUNT_CLOSED = 'ACCOUNT_CLOSED',
  BENEFICIARY_MISMATCH = 'BENEFICIARY_MISMATCH',
  AMOUNT_LIMIT_EXCEEDED = 'AMOUNT_LIMIT_EXCEEDED',
  RTGS_CUTOFF_HOURS = 'RTGS_CUTOFF_HOURS',
  NEFT_CUTOFF_HOURS = 'NEFT_CUTOFF_HOURS',
}

@Entity('disbursements')
@Index(['applicationId', 'status'])
@Index(['loanAccountId'])
@Index(['utrNumber'], { unique: true, where: 'utr_number IS NOT NULL' })
@Index(['idempotencyKey'], { unique: true, where: 'idempotency_key IS NOT NULL' })
export class Disbursement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'loan_id', type: 'uuid', nullable: true })
  loanId: string;

  @Column({ name: 'loan_account_id', type: 'varchar', length: 30, nullable: true })
  loanAccountId: string;

  @Column({ name: 'cbs_customer_id', type: 'varchar', length: 30, nullable: true })
  cbsCustomerId: string;

  @Column({ name: 'disbursement_number', type: 'varchar', length: 30 })
  disbursementNumber: string;

  @Column({ name: 'tranche_number', type: 'int', default: 1 })
  trancheNumber: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMode, name: 'payment_mode' })
  paymentMode: PaymentMode;

  @Column({ name: 'beneficiary_account_number', type: 'varchar', length: 30 })
  beneficiaryAccountNumber: string;

  @Column({ name: 'beneficiary_ifsc', type: 'varchar', length: 11 })
  beneficiaryIfsc: string;

  @Column({ name: 'beneficiary_name', type: 'varchar', length: 100 })
  beneficiaryName: string;

  @Column({ name: 'beneficiary_bank_name', type: 'varchar', length: 100, nullable: true })
  beneficiaryBankName: string;

  @Column({ name: 'beneficiary_mobile', type: 'varchar', length: 10, nullable: true })
  beneficiaryMobile: string;

  @Column({ type: 'enum', enum: DisbursementStatus, default: DisbursementStatus.PENDING })
  status: DisbursementStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string;

  @Column({ name: 'utr_number', type: 'varchar', length: 30, nullable: true })
  utrNumber: string;

  @Column({ name: 'npci_reference_id', type: 'varchar', length: 30, nullable: true })
  npciReferenceId: string;

  @Column({ name: 'cbs_transaction_ref', type: 'varchar', length: 30, nullable: true })
  cbsTransactionRef: string;

  @Column({ name: 'nach_mandate_id', type: 'varchar', length: 30, nullable: true })
  nachMandateId: string;

  @Column({ name: 'initiated_at', type: 'timestamp with time zone', nullable: true })
  initiatedAt: Date;

  @Column({ name: 'settlement_at', type: 'timestamp with time zone', nullable: true })
  settlementAt: Date;

  @Column({ name: 'failure_reason', type: 'enum', enum: DisbursementFailureReason, nullable: true })
  failureReason: DisbursementFailureReason;

  @Column({ name: 'failure_details', type: 'jsonb', nullable: true })
  failureDetails: Record<string, unknown>;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  @Column({ name: 'next_retry_at', type: 'timestamp with time zone', nullable: true })
  nextRetryAt: Date;

  @Column({ name: 'initiated_by', type: 'uuid', nullable: true })
  initiatedBy: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('payment_transactions')
@Index(['disbursementId'])
@Index(['utrNumber'], { unique: true, where: 'utr_number IS NOT NULL' })
@Index(['status', 'createdAt'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'disbursement_id', type: 'uuid' })
  disbursementId: string;

  @Column({ type: 'enum', enum: PaymentMode, name: 'payment_mode' })
  paymentMode: PaymentMode;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ name: 'sender_account', type: 'varchar', length: 30 })
  senderAccount: string;

  @Column({ name: 'sender_ifsc', type: 'varchar', length: 11 })
  senderIfsc: string;

  @Column({ name: 'beneficiary_account', type: 'varchar', length: 30 })
  beneficiaryAccount: string;

  @Column({ name: 'beneficiary_ifsc', type: 'varchar', length: 11 })
  beneficiaryIfsc: string;

  @Column({ name: 'beneficiary_name', type: 'varchar', length: 100 })
  beneficiaryName: string;

  @Column({ name: 'utr_number', type: 'varchar', length: 30, nullable: true })
  utrNumber: string;

  @Column({ name: 'npci_reference', type: 'varchar', length: 30, nullable: true })
  npciReference: string;

  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload: Record<string, unknown>;

  @Column({ name: 'status_code', type: 'varchar', length: 10, nullable: true })
  statusCode: string;

  @Column({ name: 'status_message', type: 'text', nullable: true })
  statusMessage: string;

  @Column({ name: 'request_timestamp', type: 'timestamp with time zone' })
  requestTimestamp: Date;

  @Column({ name: 'response_timestamp', type: 'timestamp with time zone', nullable: true })
  responseTimestamp: Date;

  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs: number;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'callback_received_at', type: 'timestamp with time zone', nullable: true })
  callbackReceivedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}

@Entity('nach_mandates')
@Index(['applicationId'])
@Index(['loanAccountId'])
@Index(['umrn'], { unique: true, where: 'umrn IS NOT NULL' })
export class NACHMandate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'loan_id', type: 'uuid' })
  loanId: string;

  @Column({ name: 'loan_account_id', type: 'varchar', length: 30 })
  loanAccountId: string;

  @Column({ name: 'emandate_id', type: 'varchar', length: 30, nullable: true })
  emandateId: string;

  @Column({ name: 'umrn', type: 'varchar', length: 30, nullable: true })
  umrn: string;

  @Column({ name: 'sponsor_code', type: 'varchar', length: 20 })
  sponsorCode: string;

  @Column({ name: 'utility_code', type: 'varchar', length: 20 })
  utilityCode: string;

  @Column({ name: 'debtor_account_number', type: 'varchar', length: 30 })
  debtorAccountNumber: string;

  @Column({ name: 'debtor_ifsc', type: 'varchar', length: 11 })
  debtorIfsc: string;

  @Column({ name: 'debtor_name', type: 'varchar', length: 100 })
  debtorName: string;

  @Column({ name: 'debtor_bank_name', type: 'varchar', length: 100, nullable: true })
  debtorBankName: string;

  @Column({ name: 'max_amount', type: 'decimal', precision: 18, scale: 2 })
  maxAmount: number;

  @Column({ name: 'frequency', type: 'varchar', length: 20, default: 'MONTHLY' })
  frequency: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'registration_status', type: 'varchar', length: 30, default: 'PENDING' })
  registrationStatus: string;

  @Column({ name: 'confirmation_status', type: 'varchar', length: 30, default: 'PENDING' })
  confirmationStatus: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'callback_payload', type: 'jsonb', nullable: true })
  callbackPayload: Record<string, unknown>;

  @Column({ name: 'penny_drop_verified', type: 'boolean', default: false })
  pennyDropVerified: boolean;

  @Column({ name: 'penny_drop_verified_at', type: 'timestamp with time zone', nullable: true })
  pennyDropVerifiedAt: Date;

  @Column({ name: 'penny_drop_response', type: 'jsonb', nullable: true })
  pennyDropResponse: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
