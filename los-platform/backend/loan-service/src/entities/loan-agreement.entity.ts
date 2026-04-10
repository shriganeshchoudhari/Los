import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';

export enum LoanAgreementStatus {
  DRAFT = 'DRAFT',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  AWAITING_ESIGN = 'AWAITING_ESIGN',
  PARTIALLY_SIGNED = 'PARTIALLY_SIGNED',
  FULLY_SIGNED = 'FULLY_SIGNED',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
}

@Entity('loan_agreements')
@Index(['applicationId', 'status'])
@Index(['agreementNumber'], { unique: true })
export class LoanAgreement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'agreement_number', type: 'varchar', length: 50, unique: true })
  agreementNumber: string;

  @Column({ name: 'document_key', type: 'varchar', length: 500, nullable: true })
  documentKey: string | null;

  @Column({ name: 'document_hash', type: 'char', length: 64, nullable: true })
  documentHash: string | null;

  @Column({ name: 'agreement_date', type: 'date' })
  agreementDate: Date;

  @Column({ name: 'loan_account_number', type: 'varchar', length: 30, nullable: true })
  loanAccountNumber: string | null;

  @Column({ name: 'sanctioned_amount', type: 'decimal', precision: 18, scale: 2 })
  sanctionedAmount: number;

  @Column({ name: 'sanctioned_amount_words', type: 'varchar', length: 500 })
  sanctionedAmountWords: string;

  @Column({ name: 'rate_of_interest', type: 'decimal', precision: 6, scale: 3 })
  rateOfInterest: number;

  @Column({ name: 'rate_of_interest_bps', type: 'int' })
  rateOfInterestBps: number;

  @Column({ name: 'tenure_months', type: 'int' })
  tenureMonths: number;

  @Column({ name: 'emi_amount', type: 'decimal', precision: 18, scale: 2 })
  emiAmount: number;

  @Column({ name: 'moratorium_period_months', type: 'int', nullable: true })
  moratoriumPeriodMonths: number | null;

  @Column({ name: 'moratorium_emi', type: 'decimal', precision: 18, scale: 2, nullable: true })
  moratoriumEmi: number | null;

  @Column({ name: 'processing_fee', type: 'decimal', precision: 18, scale: 2, nullable: true })
  processingFee: number | null;

  @Column({ name: 'first_emi_date', type: 'date', nullable: true })
  firstEmiDate: Date | null;

  @Column({ name: 'last_emi_date', type: 'date', nullable: true })
  lastEmiDate: Date | null;

  @Column({ name: 'disbursement_account', type: 'varchar', length: 30, nullable: true })
  disbursementAccount: string | null;

  @Column({ name: 'disbursement_ifsc', type: 'varchar', length: 15, nullable: true })
  disbursementIfsc: string | null;

  @Column({ name: 'disbursement_bank', type: 'varchar', length: 100, nullable: true })
  disbursementBank: string | null;

  @Column({ name: 'branch_name', type: 'varchar', length: 200, nullable: true })
  branchName: string | null;

  @Column({ name: 'branch_address', type: 'text', nullable: true })
  branchAddress: string | null;

  @Column({ name: 'security_description', type: 'text', nullable: true })
  securityDescription: string | null;

  @Column({ name: 'insurance_policy_number', type: 'varchar', length: 50, nullable: true })
  insurancePolicyNumber: string | null;

  @Column({ name: 'insurance_premium', type: 'decimal', precision: 18, scale: 2, nullable: true })
  insurancePremium: number | null;

  @Column({ name: 'prepayment_penalty_clause', type: 'text', nullable: true })
  prepaymentPenaltyClause: string | null;

  @Column({ name: 'default_interest_rate', type: 'decimal', precision: 6, scale: 3, nullable: true })
  defaultInterestRate: number | null;

  @Column({ name: 'bounce_charge', type: 'decimal', precision: 18, scale: 2, nullable: true })
  bounceCharge: number | null;

  @Column({ name: 'part_payment_allowed', default: false })
  partPaymentAllowed: boolean;

  @Column({ name: 'part_payment_min_amount', type: 'decimal', precision: 18, scale: 2, nullable: true })
  partPaymentMinAmount: number | null;

  @Column({ name: 'part_payment_tenure_reduction', default: false })
  partPaymentTenureReduction: boolean;

  @Column({ name: 'foreclosure_allowed', default: false })
  foreclosureAllowed: boolean;

  @Column({ name: 'foreclosure_notice_period_days', type: 'int', nullable: true })
  foreclosureNoticePeriodDays: number | null;

  @Column({ name: 'foreclosure_penalty_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  foreclosurePenaltyPercent: number | null;

  @Column({ name: 'special_conditions', type: 'jsonb', nullable: true })
  specialConditions: string[] | null;

  @Column({ name: 'jurisdiction', type: 'varchar', length: 200, nullable: true })
  jurisdiction: string | null;

  @Column({ name: 'witnessing_officer_name', type: 'varchar', length: 200, nullable: true })
  witnessingOfficerName: string | null;

  @Column({ name: 'witnessing_officer_designation', type: 'varchar', length: 100, nullable: true })
  witnessingOfficerDesignation: string | null;

  @Column({ name: 'co_borrower_name', type: 'varchar', length: 200, nullable: true })
  coBorrowerName: string | null;

  @Column({ name: 'co_borrower_address', type: 'text', nullable: true })
  coBorrowerAddress: string | null;

  @Column({ name: 'co_borrower_pan', type: 'varchar', length: 20, nullable: true })
  coBorrowerPan: string | null;

  @Column({ name: 'guarantor_name', type: 'varchar', length: 200, nullable: true })
  guarantorName: string | null;

  @Column({ name: 'guarantor_address', type: 'text', nullable: true })
  guarantorAddress: string | null;

  @Column({ name: 'guarantor_pan', type: 'varchar', length: 20, nullable: true })
  guarantorPan: string | null;

  @Column({ type: 'varchar', length: 20, default: LoanAgreementStatus.DRAFT })
  status: LoanAgreementStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
