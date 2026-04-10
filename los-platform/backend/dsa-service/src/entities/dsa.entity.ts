import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export enum DSAPartnerStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

export enum DSAPartnerType {
  INDIVIDUAL = 'INDIVIDUAL',
  SoleProprietorship = 'SOLE_PROPRIETORSHIP',
  PARTNERSHIP = 'PARTNERSHIP',
  PRIVATE_LIMITED = 'PRIVATE_LIMITED',
  PUBLIC_LIMITED = 'PUBLIC_LIMITED',
  NBFC = 'NBFC',
}

export enum CommissionType {
  UPFRONT = 'UPFRONT',
  TRAIL = 'TRAIL',
  HYBRID = 'HYBRID',
}

@Entity('dsa_partners')
@Index(['partnerCode'], { unique: true })
@Index(['status', 'createdAt'])
@Index(['panHash'])
export class DSAPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'partner_code', type: 'varchar', length: 20, unique: true })
  partnerCode: string;

  @Column({ name: 'partner_name', type: 'varchar', length: 200 })
  partnerName: string;

  @Column({ type: 'enum', enum: DSAPartnerType, name: 'partner_type' })
  partnerType: DSAPartnerType;

  @Column({ type: 'enum', enum: DSAPartnerStatus, name: 'status' })
  status: DSAPartnerStatus;

  @Column({ name: 'pan_hash', type: 'char', length: 64 })
  panHash: string;

  @Column({ name: 'pan_enc', type: 'bytea' })
  panEnc: Buffer;

  @Column({ name: 'gstin', type: 'varchar', length: 15, nullable: true })
  gstin: string;

  @Column({ name: 'gstin_hash', type: 'char', length: 64, nullable: true })
  gstinHash: string;

  @Column({ name: 'password_hash', type: 'char', length: 64, nullable: true })
  passwordHash: string;

  @Column({ name: 'registered_address', type: 'text' })
  registeredAddress: string;

  @Column({ name: 'city', type: 'varchar', length: 50 })
  city: string;

  @Column({ name: 'state', type: 'varchar', length: 4 })
  state: string;

  @Column({ name: 'pincode', type: 'varchar', length: 6 })
  pincode: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 200 })
  contactName: string;

  @Column({ name: 'contact_mobile', type: 'varchar', length: 10 })
  contactMobile: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 254 })
  contactEmail: string;

  @Column({ name: 'primary_bank_account', type: 'varchar', length: 30 })
  primaryBankAccount: string;

  @Column({ name: 'primary_ifsc', type: 'varchar', length: 11 })
  primaryIfsc: string;

  @Column({ name: 'bank_account_holder', type: 'varchar', length: 200 })
  bankAccountHolder: string;

  @Column({ type: 'enum', enum: CommissionType, default: CommissionType.HYBRID, name: 'commission_type' })
  commissionType: CommissionType;

  @Column({ name: 'upfront_commission_bps', type: 'int', default: 0 })
  upfrontCommissionBps: number;

  @Column({ name: 'trail_commission_bps', type: 'int', default: 0 })
  trailCommissionBps: number;

  @Column({ name: 'payout_frequency', type: 'varchar', length: 20, default: 'MONTHLY' })
  payoutFrequency: string;

  @Column({ name: 'min_loan_amount', type: 'bigint', default: 0 })
  minLoanAmount: number;

  @Column({ name: 'max_loan_amount', type: 'bigint', default: 0 })
  maxLoanAmount: number;

  @Column({ name: 'territory_codes', type: 'jsonb', nullable: true })
  territoryCodes: string[];

  @Column({ name: 'allowed_products', type: 'jsonb', nullable: true })
  allowedProducts: string[];

  @Column({ name: 'agreement_doc_key', type: 'varchar', length: 500, nullable: true })
  agreementDocKey: string;

  @Column({ name: 'agreement_signed_at', type: 'timestamp with time zone', nullable: true })
  agreementSignedAt: Date;

  @Column({ name: 'agreement_valid_from', type: 'date', nullable: true })
  agreementValidFrom: Date;

  @Column({ name: 'agreement_valid_to', type: 'date', nullable: true })
  agreementValidTo: Date;

  @Column({ name: 'total_disbursed_amount', type: 'bigint', default: 0 })
  totalDisbursedAmount: number;

  @Column({ name: 'total_applications', type: 'int', default: 0 })
  totalApplications: number;

  @Column({ name: 'total_disbursements', type: 'int', default: 0 })
  totalDisbursements: number;

  @Column({ name: 'total_commission_paid', type: 'bigint', default: 0 })
  totalCommissionPaid: number;

  @Column({ name: 'rejected_by', type: 'uuid', nullable: true })
  rejectedBy: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string;

  @Column({ name: 'onboarding_officer_id', type: 'uuid', nullable: true })
  onboardingOfficerId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('dsa_officers')
@Index(['partnerId', 'status'])
@Index(['mobileHash'])
@Index(['emailHash'])
export class DSAOfficer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ name: 'employee_code', type: 'varchar', length: 20, unique: true })
  employeeCode: string;

  @Column({ name: 'full_name', type: 'varchar', length: 200 })
  fullName: string;

  @Column({ name: 'mobile_hash', type: 'char', length: 64 })
  mobileHash: string;

  @Column({ name: 'mobile_enc', type: 'bytea' })
  mobileEnc: Buffer;

  @Column({ name: 'email_hash', type: 'char', length: 64 })
  emailHash: string;

  @Column({ name: 'email_enc', type: 'bytea', nullable: true })
  emailEnc: Buffer;

  @Column({ name: 'password_hash', type: 'char', length: 64, nullable: true })
  passwordHash: string;

  @Column({ name: 'designation', type: 'varchar', length: 100 })
  designation: string;

  @Column({ name: 'department', type: 'varchar', length: 100 })
  department: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'reporting_manager_id', type: 'uuid', nullable: true })
  reportingManagerId: string;

  @Column({ name: 'territory_codes', type: 'jsonb', nullable: true })
  territoryCodes: string[];

  @Column({ name: 'allowed_products', type: 'jsonb', nullable: true })
  allowedProducts: string[];

  @Column({ name: 'max_sanction_authority', type: 'bigint', default: 0 })
  maxSanctionAuthority: number;

  @Column({ name: 'total_applications', type: 'int', default: 0 })
  totalApplications: number;

  @Column({ name: 'total_disbursements', type: 'int', default: 0 })
  totalDisbursements: number;

  @Column({ name: 'last_login_at', type: 'timestamp with time zone', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('dsa_applications')
@Index(['partnerId', 'status'])
@Index(['officerId'])
@Index(['applicationNumber'], { unique: true })
@Index(['createdAt'])
export class DSAApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_number', type: 'varchar', length: 30, unique: true })
  applicationNumber: string;

  @Column({ name: 'loan_application_id', type: 'uuid', nullable: true })
  loanApplicationId: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ name: 'officer_id', type: 'uuid' })
  officerId: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 200 })
  customerName: string;

  @Column({ name: 'customer_mobile_hash', type: 'char', length: 64 })
  customerMobileHash: string;

  @Column({ name: 'customer_pan_hash', type: 'char', length: 64, nullable: true })
  customerPanHash: string;

  @Column({ name: 'loan_type', type: 'varchar', length: 30 })
  loanType: string;

  @Column({ name: 'requested_amount', type: 'bigint' })
  requestedAmount: number;

  @Column({ name: 'requested_tenure_months', type: 'smallint' })
  requestedTenureMonths: number;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'SUBMITTED' })
  status: string;

  @Column({ name: 'branch_code', type: 'varchar', length: 10, nullable: true })
  branchCode: string;

  @Column({ name: 'assigned_officer_id', type: 'uuid', nullable: true })
  assignedOfficerId: string;

  @Column({ name: 'source_lead_id', type: 'varchar', length: 50, nullable: true })
  sourceLeadId: string;

  @Column({ name: 'utm_source', type: 'varchar', length: 50, nullable: true })
  utmSource: string;

  @Column({ name: 'utm_medium', type: 'varchar', length: 50, nullable: true })
  utmMedium: string;

  @Column({ name: 'utm_campaign', type: 'varchar', length: 50, nullable: true })
  utmCampaign: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string;

  @Column({ name: 'converted_at', type: 'timestamp with time zone', nullable: true })
  convertedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('dsa_commission')
@Index(['partnerId', 'payoutMonth'])
@Index(['applicationId'])
@Index(['status', 'createdAt'])
export class DSACommission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ name: 'officer_id', type: 'uuid', nullable: true })
  officerId: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'loan_application_id', type: 'uuid' })
  loanApplicationId: string;

  @Column({ name: 'loan_type', type: 'varchar', length: 30 })
  loanType: string;

  @Column({ name: 'disbursed_amount', type: 'bigint' })
  disbursedAmount: number;

  @Column({ name: 'commission_type', type: 'enum', enum: CommissionType, name: 'commission_type' })
  commissionType: CommissionType;

  @Column({ name: 'commission_rate_bps', type: 'int' })
  commissionRateBps: number;

  @Column({ name: 'commission_amount', type: 'bigint' })
  commissionAmount: number;

  @Column({ name: 'gst_amount', type: 'bigint', default: 0 })
  gstAmount: number;

  @Column({ name: 'tds_amount', type: 'bigint', default: 0 })
  tdsAmount: number;

  @Column({ name: 'net_payable', type: 'bigint' })
  netPayable: number;

  @Column({ name: 'disbursement_date', type: 'date' })
  disbursementDate: Date;

  @Column({ name: 'payout_month', type: 'varchar', length: 7 })
  payoutMonth: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'EARNED' })
  status: string;

  @Column({ name: 'processed_at', type: 'timestamp with time zone', nullable: true })
  processedAt: Date;

  @Column({ name: 'processed_by', type: 'uuid', nullable: true })
  processedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
