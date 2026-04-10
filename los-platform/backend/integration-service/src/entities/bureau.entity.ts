import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum BureauProvider {
  CIBIL = 'CIBIL',
  EXPERIAN = 'EXPERIAN',
  EQUIFAX = 'EQUIFAX',
  CRIF = 'CRIF',
}

export enum BureauPullStatus {
  PENDING = 'PENDING',
  CONSENT_PENDING = 'CONSENT_PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCESS = 'SUCCESS',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  DUPLICATE_LOCKED = 'DUPLICATE_LOCKED',
}

export enum BureauReportStatus {
  RAW = 'RAW',
  PARSED = 'PARSED',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('bureau_pull_jobs')
@Index(['applicationId', 'provider'])
@Index(['panHash', 'createdAt'])
@Index(['status', 'createdAt'])
export class BureauPullJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'applicant_id', type: 'uuid' })
  applicantId: string;

  @Column({ name: 'pan_hash', type: 'varchar', length: 64 })
  panHash: string;

  @Column({ type: 'enum', enum: BureauProvider, name: 'provider' })
  provider: BureauProvider;

  @Column({ type: 'enum', enum: BureauPullStatus, default: BureauPullStatus.PENDING })
  status: BureauPullStatus;

  @Column({ name: 'consent_timestamp', type: 'timestamp with time zone', nullable: true })
  consentTimestamp: Date;

  @Column({ name: 'consent_otp_hash', type: 'varchar', length: 64, nullable: true })
  consentOtpHash: string;

  @Column({ name: 'request_timestamp', type: 'timestamp with time zone', nullable: true })
  requestTimestamp: Date;

  @Column({ name: 'response_timestamp', type: 'timestamp with time zone', nullable: true })
  responseTimestamp: Date;

  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload: Record<string, unknown>;

  @Column({ name: 'error_code', type: 'varchar', length: 20, nullable: true })
  errorCode: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'timeout_ms', type: 'int', nullable: true })
  timeoutMs: number;

  @Column({ name: 'lock_expires_at', type: 'timestamp with time zone', nullable: true })
  lockExpiresAt: Date;

  @Column({ name: 'report_id', type: 'uuid', nullable: true })
  reportId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('bureau_reports')
@Index(['applicationId', 'provider'], { unique: true })
@Index(['panHash', 'createdAt'])
export class BureauReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'pull_job_id', type: 'uuid' })
  pullJobId: string;

  @Column({ type: 'enum', enum: BureauProvider, name: 'provider' })
  provider: BureauProvider;

  @Column({ name: 'pan_hash', type: 'varchar', length: 64 })
  panHash: string;

  @Column({ type: 'enum', enum: BureauReportStatus, default: BureauReportStatus.RAW })
  status: BureauReportStatus;

  @Column({ name: 'raw_xml', type: 'text', nullable: true })
  rawXml: string;

  @Column({ name: 'raw_json', type: 'jsonb', nullable: true })
  rawJson: Record<string, unknown>;

  @Column({ name: 'parsed_score', type: 'int', nullable: true })
  parsedScore: number;

  @Column({ name: 'parsed_grade', type: 'varchar', length: 5, nullable: true })
  parsedGrade: string;

  @Column({ name: 'parsed_dpd_0_30', type: 'int', nullable: true })
  parsedDpd030: number;

  @Column({ name: 'parsed_dpd_31_60', type: 'int', nullable: true })
  parsedDpd3160: number;

  @Column({ name: 'parsed_dpd_61_90', type: 'int', nullable: true })
  parsedDpd6190: number;

  @Column({ name: 'parsed_dpd_over_90', type: 'int', nullable: true })
  parsedDpdOver90: number;

  @Column({ name: 'parsed_total_accounts', type: 'int', nullable: true })
  parsedTotalAccounts: number;

  @Column({ name: 'parsed_active_accounts', type: 'int', nullable: true })
  parsedActiveAccounts: number;

  @Column({ name: 'parsed_closed_accounts', type: 'int', nullable: true })
  parsedClosedAccounts: number;

  @Column({ name: 'parsed_total_exposure', type: 'decimal', precision: 18, scale: 2, nullable: true })
  parsedTotalExposure: number;

  @Column({ name: 'parsed_secured_exposure', type: 'decimal', precision: 18, scale: 2, nullable: true })
  parsedSecuredExposure: number;

  @Column({ name: 'parsed_unsecured_exposure', type: 'decimal', precision: 18, scale: 2, nullable: true })
  parsedUnsecuredExposure: number;

  @Column({ name: 'parsed_total_emi', type: 'decimal', precision: 18, scale: 2, nullable: true })
  parsedTotalEmi: number;

  @Column({ name: 'parsed_enquiries_30d', type: 'int', nullable: true })
  parsedEnquiries30d: number;

  @Column({ name: 'parsed_enquiries_90d', type: 'int', nullable: true })
  parsedEnquiries90d: number;

  @Column({ name: 'parsed_writeoffs', type: 'int', nullable: true })
  parsedWriteoffs: number;

  @Column({ name: 'parsed_suit_filed', type: 'boolean', default: false })
  parsedSuitFiled: boolean;

  @Column({ name: 'parsed_disputed', type: 'boolean', default: false })
  parsedDisputed: boolean;

  @Column({ name: 'parsed_account_summary', type: 'jsonb', nullable: true })
  parsedAccountSummary: BureauAccountSummary[];

  @Column({ name: 'parsed_enquiry_summary', type: 'jsonb', nullable: true })
  parsedEnquirySummary: BureauEnquiryRecord[];

  @Column({ name: 'parsed_error_code', type: 'varchar', length: 20, nullable: true })
  parsedErrorCode: string;

  @Column({ name: 'parsed_error_message', type: 'text', nullable: true })
  parsedErrorMessage: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

export interface BureauAccountSummary {
  accountNumber: string;
  accountType: string;
  bureauAccountType: string;
  status: string;
  ownershipType: string;
  currentBalance: number;
  sanctionAmount: number;
  overdueAmount: number;
  dpd: number;
  dpdMonths: number;
  openedDate: string;
  closedDate: string | null;
  lastPaymentDate: string | null;
  lender: string;
  product: string;
}

export interface BureauEnquiryRecord {
  enquiryDate: string;
  enquiryAmount: number;
  enquiryPurpose: string;
  lender: string;
  bureauAccountType: string;
}

@Entity('bureau_aggregated_scores')
@Index(['applicationId'], { unique: true })
export class BureauAggregatedScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'primary_provider', type: 'enum', enum: BureauProvider })
  primaryProvider: BureauProvider;

  @Column({ name: 'primary_score', type: 'int' })
  primaryScore: number;

  @Column({ name: 'cibil_score', type: 'int', nullable: true })
  cibilScore: number;

  @Column({ name: 'experian_score', type: 'int', nullable: true })
  experianScore: number;

  @Column({ name: 'equifax_score', type: 'int', nullable: true })
  equifaxScore: number;

  @Column({ name: 'crif_score', type: 'int', nullable: true })
  crifScore: number;

  @Column({ name: 'max_dpd', type: 'int' })
  maxDpd: number;

  @Column({ name: 'total_exposure', type: 'decimal', precision: 18, scale: 2 })
  totalExposure: number;

  @Column({ name: 'total_emi', type: 'decimal', precision: 18, scale: 2 })
  totalEmi: number;

  @Column({ name: 'active_accounts', type: 'int' })
  activeAccounts: number;

  @Column({ name: 'enquiries_30d', type: 'int' })
  enquiries30d: number;

  @Column({ name: 'writeoffs', type: 'int' })
  writeoffs: number;

  @Column({ name: 'suit_filed', type: 'boolean', default: false })
  suitFiled: boolean;

  @Column({ name: 'disputed', type: 'boolean', default: false })
  disputed: boolean;

  @Column({ name: 'bureau_report_ids', type: 'jsonb' })
  bureauReportIds: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
