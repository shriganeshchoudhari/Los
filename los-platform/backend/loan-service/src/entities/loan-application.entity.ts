import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';

export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  KYC_IN_PROGRESS = 'KYC_IN_PROGRESS',
  KYC_COMPLETE = 'KYC_COMPLETE',
  DOCUMENT_COLLECTION = 'DOCUMENT_COLLECTION',
  UNDER_PROCESSING = 'UNDER_PROCESSING',
  BUREAU_PULL_IN_PROGRESS = 'BUREAU_PULL_IN_PROGRESS',
  BUREAU_PULL_COMPLETE = 'BUREAU_PULL_COMPLETE',
  CREDIT_ASSESSMENT = 'CREDIT_ASSESSMENT',
  PENDING_FIELD_INVESTIGATION = 'PENDING_FIELD_INVESTIGATION',
  FIELD_INVESTIGATION_DONE = 'FIELD_INVESTIGATION_DONE',
  PENDING_LEGAL_TECHNICAL = 'PENDING_LEGAL_TECHNICAL',
  LEGAL_TECHNICAL_DONE = 'LEGAL_TECHNICAL_DONE',
  CREDIT_COMMITTEE = 'CREDIT_COMMITTEE',
  APPROVED = 'APPROVED',
  CONDITIONALLY_APPROVED = 'CONDITIONALLY_APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  CANCELLED = 'CANCELLED',
  SANCTIONED = 'SANCTIONED',
  DISBURSEMENT_IN_PROGRESS = 'DISBURSEMENT_IN_PROGRESS',
  DISBURSED = 'DISBURSED',
  CLOSED = 'CLOSED',
}

export enum LoanType {
  HOME_LOAN = 'HOME_LOAN',
  HOME_LOAN_TOP_UP = 'HOME_LOAN_TOP_UP',
  LAP = 'LAP',
  PERSONAL_LOAN = 'PERSONAL_LOAN',
  VEHICLE_LOAN_TWO_WHEELER = 'VEHICLE_LOAN_TWO_WHEELER',
  VEHICLE_LOAN_FOUR_WHEELER = 'VEHICLE_LOAN_FOUR_WHEELER',
  VEHICLE_LOAN_COMMERCIAL = 'VEHICLE_LOAN_COMMERCIAL',
  GOLD_LOAN = 'GOLD_LOAN',
  EDUCATION_LOAN = 'EDUCATION_LOAN',
  KISAN_CREDIT_CARD = 'KISAN_CREDIT_CARD',
  MUDRA_SHISHU = 'MUDRA_SHISHU',
  MUDRA_KISHORE = 'MUDRA_KISHORE',
  MUDRA_TARUN = 'MUDRA_TARUN',
  MSME_TERM_LOAN = 'MSME_TERM_LOAN',
  MSME_WORKING_CAPITAL = 'MSME_WORKING_CAPITAL',
  OVERDRAFT = 'OVERDRAFT',
}

export enum CustomerSegment {
  RETAIL = 'RETAIL',
  MSME = 'MSME',
  AGRI = 'AGRI',
  NRI = 'NRI',
}

export enum ChannelCode {
  BRANCH = 'BRANCH',
  ONLINE = 'ONLINE',
  DSA = 'DSA',
  MOBILE_APP = 'MOBILE_APP',
  API_PARTNER = 'API_PARTNER',
}

export enum EmploymentType {
  SALARIED_PRIVATE = 'SALARIED_PRIVATE',
  SALARIED_GOVERNMENT = 'SALARIED_GOVERNMENT',
  SALARIED_PSU = 'SALARIED_PSU',
  SELF_EMPLOYED_PROFESSIONAL = 'SELF_EMPLOYED_PROFESSIONAL',
  SELF_EMPLOYED_BUSINESS = 'SELF_EMPLOYED_BUSINESS',
  AGRICULTURALIST = 'AGRICULTURALIST',
  PENSIONER = 'PENSIONER',
  NRI = 'NRI',
  UNEMPLOYED = 'UNEMPLOYED',
}

@Entity('loan_applications')
@Index('idx_app_status_created', ['status', 'createdAt'])
@Index('idx_app_pan_hash', ['applicantPanHash', 'loanType', 'createdAt'])
@Index('idx_app_user_id', ['userId', 'createdAt'])
@Index('idx_app_officer', ['assignedOfficerId', 'status'])
@Index('idx_app_branch_status', ['branchCode', 'status', 'createdAt'])
export class LoanApplication {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'application_number', unique: true, length: 30 })
  applicationNumber: string;

  @Column({ length: 40, default: ApplicationStatus.DRAFT })
  status: ApplicationStatus;

  @Column({ name: 'loan_type', length: 30 })
  loanType: LoanType;

  @Column({ name: 'customer_segment', length: 10, default: CustomerSegment.RETAIL })
  customerSegment: CustomerSegment;

  @Column({ name: 'channel_code', length: 20 })
  channelCode: ChannelCode;

  @Column({ name: 'branch_code', length: 10 })
  branchCode: string;

  @Column({ name: 'applicant_full_name', length: 200 })
  applicantFullName: string;

  @Column({ name: 'applicant_dob', type: 'date' })
  applicantDob: Date;

  @Column({ name: 'applicant_mobile', length: 10 })
  applicantMobile: string;

  @Column({ name: 'applicant_mobile_hash', length: 64 })
  applicantMobileHash: string;

  @Column({ name: 'applicant_pan_hash', length: 64 })
  applicantPanHash: string;

  @Column({ name: 'applicant_pan_encrypted', type: 'jsonb' })
  applicantPanEncrypted: Record<string, unknown>;

  @Column({ name: 'applicant_gender', length: 15, nullable: true })
  applicantGender?: string;

  @Column({ name: 'applicant_pincode', length: 6, nullable: true })
  applicantPincode?: string;

  @Column({ name: 'applicant_state', length: 4, nullable: true })
  applicantState?: string;

  @Column({ name: 'applicant_profile', type: 'jsonb' })
  applicantProfile: Record<string, any>;

  @Column({ name: 'employment_details', type: 'jsonb' })
  employmentDetails: Record<string, any>;

  @Column({ name: 'loan_requirement', type: 'jsonb' })
  loanRequirement: Record<string, any>;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'kyc_id', nullable: true })
  kycId?: string;

  @Column({ name: 'bureau_report_id', nullable: true })
  bureauReportId?: string;

  @Column({ name: 'decision_id', nullable: true })
  decisionId?: string;

  @Column({ name: 'assigned_officer_id', nullable: true })
  assignedOfficerId?: string;

  @Column({ name: 'assigned_analyst_id', nullable: true })
  assignedAnalystId?: string;

  @Column({ name: 'requested_amount', type: 'bigint' })
  requestedAmount: number;

  @Column({ name: 'sanctioned_amount', type: 'bigint', nullable: true })
  sanctionedAmount?: number;

  @Column({ name: 'sanctioned_tenure_months', nullable: true })
  sanctionedTenureMonths?: number;

  @Column({ name: 'sanctioned_roi_bps', nullable: true })
  sanctionedRoiBps?: number;

  @Column({ name: 'dsa_code', length: 20, nullable: true })
  dsaCode?: string;

  @Column({ name: 'dsa_name', length: 100, nullable: true })
  dsaName?: string;

  @Column({ name: 'rejection_reason_code', length: 30, nullable: true })
  rejectionReasonCode?: string;

  @Column({ name: 'rejection_remarks', type: 'text', nullable: true })
  rejectionRemarks?: string;

  @Column({ name: 'conditions_pre_disbursal', type: 'text', array: true, nullable: true })
  conditionsPreDisbursal?: string[];

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'sanctioned_at', type: 'timestamptz', nullable: true })
  sanctionedAt?: Date;

  @Column({ name: 'disbursed_at', type: 'timestamptz', nullable: true })
  disbursedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn()
  version: number;
}
