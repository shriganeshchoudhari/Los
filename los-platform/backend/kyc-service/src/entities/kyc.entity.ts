import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '@los/auth-service';

export enum KYCStatus {
  NOT_STARTED = 'NOT_STARTED',
  AADHAAR_OTP_SENT = 'AADHAAR_OTP_SENT',
  AADHAAR_VERIFIED = 'AADHAAR_VERIFIED',
  PAN_VERIFIED = 'PAN_VERIFIED',
  FACE_MATCH_PENDING = 'FACE_MATCH_PENDING',
  FACE_MATCH_PASSED = 'FACE_MATCH_PASSED',
  FACE_MATCH_FAILED = 'FACE_MATCH_FAILED',
  KYC_COMPLETE = 'KYC_COMPLETE',
  KYC_FAILED = 'KYC_FAILED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

@Entity('kyc_records')
@Index('idx_kyc_application', ['applicationId'], { unique: true })
@Index('idx_kyc_user', ['userId', 'status'])
export class KYCREcord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 30, default: KYCStatus.NOT_STARTED })
  status: KYCStatus;

  @Column({ name: 'overall_risk_score', type: 'smallint', nullable: true })
  overallRiskScore?: number;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy?: string;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('aadhaar_kyc_results')
@Index('idx_aadhaar_kyc_id', ['kycId'], { unique: true })
@Index('idx_aadhaar_hash', ['aadhaarNumberHash'])
export class AadhaarKYCResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'kyc_id' })
  kycId: string;

  @ManyToOne(() => KYCREcord)
  @JoinColumn({ name: 'kyc_id' })
  kyc: KYCREcord;

  @Column({ name: 'txn_id', length: 100 })
  txnId: string;

  @Column({ name: 'uidai_ref_id', length: 100 })
  uidaiRefId: string;

  @Column({ name: 'aadhaar_number_hash', length: 64 })
  aadhaarNumberHash: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'date' })
  dob: Date;

  @Column({ length: 1 })
  gender: string;

  @Column({ name: 'address_json', type: 'jsonb', nullable: true })
  addressJson?: Record<string, any>;

  @Column({ name: 'photo_storage_key', length: 500, nullable: true })
  photoStorageKey?: string;

  @Column({ name: 'photo_encryption_key_ref', length: 100, nullable: true })
  photoEncryptionKeyRef?: string;

  @Column({ name: 'xml_storage_key', length: 500, nullable: true })
  xmlStorageKey?: string;

  @Column({ name: 'signature_valid', default: false })
  signatureValid: boolean;

  @Column({ name: 'uidai_response_code', length: 10, nullable: true })
  uidaiResponseCode?: string;

  @Column({ name: 'auth_code', length: 100, nullable: true })
  authCode?: string;

  @Column({ name: 'verified_at', type: 'timestamptz', default: () => 'NOW()' })
  verifiedAt: Date;

  @Column({ name: 'ip_metadata', type: 'jsonb', nullable: true })
  ipMetadata?: Record<string, any>;
}

@Entity('pan_verification_results')
export class PANVerificationResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'kyc_id' })
  kycId: string;

  @ManyToOne(() => KYCREcord)
  @JoinColumn({ name: 'kyc_id' })
  kyc: KYCREcord;

  @Column({ name: 'pan_number_masked', length: 10 })
  panNumberMasked: string;

  @Column({ name: 'pan_number_encrypted', type: 'jsonb' })
  panNumberEncrypted: Record<string, unknown>;

  @Column({ name: 'name_match_score', type: 'smallint' })
  nameMatchScore: number;

  @Column({ name: 'name_on_pan', length: 200 })
  nameOnPan: string;

  @Column({ name: 'dob_match', default: false })
  dobMatch: boolean;

  @Column({ name: 'pan_status', length: 10 })
  panStatus: string;

  @Column({ name: 'linked_aadhaar', default: false })
  linkedAadhaar: boolean;

  @Column({ name: 'aadhaar_seeding_status', length: 15, nullable: true })
  aadhaarSeedingStatus?: string;

  @Column({ name: 'nsdl_transaction_id', length: 100, nullable: true })
  nsdlTransactionId?: string;

  @Column({ name: 'verified_at', type: 'timestamptz', default: () => 'NOW()' })
  verifiedAt: Date;
}

@Entity('face_match_results')
export class FaceMatchResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'kyc_id' })
  kycId: string;

  @ManyToOne(() => KYCREcord)
  @JoinColumn({ name: 'kyc_id' })
  kyc: KYCREcord;

  @Column({ name: 'match_score', type: 'smallint' })
  matchScore: number;

  @Column({ default: false })
  passed: boolean;

  @Column({ name: 'liveness_score', type: 'smallint', nullable: true })
  livenessScore?: number;

  @Column({ name: 'liveness_check_passed', default: false })
  livenessCheckPassed: boolean;

  @Column({ length: 30 })
  provider: string;

  @Column({ name: 'request_id', length: 100, nullable: true })
  requestId?: string;

  @Column({ name: 'failure_reason', length: 50, nullable: true })
  failureReason?: string;

  @Column({ name: 'processed_at', type: 'timestamptz', default: () => 'NOW()' })
  processedAt: Date;
}

@Entity('consent_records')
@Index('idx_consent_user_app', ['userId', 'applicationId', 'consentType'])
@Index('idx_consent_active', ['applicationId', 'consentType'])
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({ name: 'consent_type', length: 30 })
  consentType: string;

  @Column({ name: 'consent_text', type: 'text' })
  consentText: string;

  @Column({ name: 'consent_version', length: 10 })
  consentVersion: string;

  @Column({ name: 'is_granted', default: true })
  isGranted: boolean;

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'NOW()' })
  grantedAt: Date;

  @Column({ name: 'ip_address', type: 'inet' })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'signed_otp_session_id', nullable: true })
  signedOtpSessionId?: string;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;
}
