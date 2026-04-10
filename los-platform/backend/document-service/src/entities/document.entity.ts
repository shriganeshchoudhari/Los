import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum DocumentType {
  PAN = 'PAN',
  AADHAAR_FRONT = 'AADHAAR_FRONT',
  AADHAAR_BACK = 'AADHAAR_BACK',
  PASSPORT = 'PASSPORT',
  VOTER_ID = 'VOTER_ID',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  BANK_STATEMENT = 'BANK_STATEMENT',
  SALARY_SLIP_1 = 'SALARY_SLIP_1',
  SALARY_SLIP_2 = 'SALARY_SLIP_2',
  SALARY_SLIP_3 = 'SALARY_SLIP_3',
  ITR = 'ITR',
  FORM_16 = 'FORM_16',
  VEHICLE_RC = 'VEHICLE_RC',
  PROPERTY_DOCUMENT = 'PROPERTY_DOCUMENT',
  NOC = 'NOC',
  AGREEMENT_TO_SALE = 'AGREEMENT_TO_SALE',
  APPROVAL_LETTER = 'APPROVAL_LETTER',
  VALUATION_REPORT = 'VALUATION_REPORT',
  PHOTO = 'PHOTO',
  SIGNATURE = 'SIGNATURE',
  ADDRESS_PROOF = 'ADDRESS_PROOF',
  INCOME_PROOF = 'INCOME_PROOF',
  IDENTITY_PROOF = 'IDENTITY_PROOF',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  OCR_IN_PROGRESS = 'OCR_IN_PROGRESS',
  OCR_COMPLETED = 'OCR_COMPLETED',
  OCR_FAILED = 'OCR_FAILED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum OcrProvider {
  KARZA = 'KARZA',
  SIGNZY = 'SIGNZY',
  INTERNAL = 'INTERNAL',
}

@Entity('documents')
@Index('idx_doc_application_type', ['applicationId', 'documentType'])
@Index('idx_doc_status', ['status'])
@Index('idx_doc_created', ['createdAt'])
export class Document {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({ name: 'document_type', length: 30 })
  documentType: DocumentType;

  @Column({ length: 10 })
  status: DocumentStatus;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'original_name', length: 255 })
  originalName: string;

  @Column({ length: 100 })
  mimeType: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ length: 64 })
  checksum: string;

  @Column({ name: 'bucket_name', length: 100 })
  bucketName: string;

  @Column({ name: 'object_key', length: 500 })
  objectKey: string;

  @Column({ name: 'presigned_url', type: 'text', nullable: true })
  presignedUrl?: string;

  @Column({ name: 'presigned_url_expires_at', type: 'timestamptz', nullable: true })
  presignedUrlExpiresAt?: Date;

  @Column({ name: 'ocr_provider', length: 20, nullable: true })
  ocrProvider?: OcrProvider;

  @Column({ name: 'ocr_result', type: 'jsonb', nullable: true })
  ocrResult?: Record<string, unknown>;

  @Column({ name: 'ocr_confidence', type: 'decimal', precision: 5, scale: 2, nullable: true })
  ocrConfidence?: number;

  @Column({ name: 'ocr_error', type: 'text', nullable: true })
  ocrError?: string;

  @Column({ name: 'ocr_attempts', default: 0 })
  ocrAttempts: number;

  @Column({ name: 'watermarked_object_key', length: 500, nullable: true })
  watermarkedObjectKey?: string;

  @Column({ name: 'reviewer_id', nullable: true })
  reviewerId?: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'review_remarks', type: 'text', nullable: true })
  reviewRemarks?: string;

  @Column({ length: 50, nullable: true })
  expiryDate?: string;

  @Column({ name: 'is_expired', default: false })
  isExpired: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

export enum ChecklistStatus {
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WAIVED = 'WAIVED',
}

@Entity('document_checklists')
@Index('idx_checklist_application', ['applicationId'])
export class DocumentChecklist {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({ name: 'document_type', length: 30 })
  documentType: DocumentType;

  @Column({ length: 20 })
  status: ChecklistStatus;

  @Column({ name: 'is_required', default: true })
  isRequired: boolean;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'document_id', nullable: true })
  documentId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('document_reviews')
@Index('idx_review_document', ['documentId'])
export class DocumentReview {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({ name: 'reviewer_id' })
  reviewerId: string;

  @Column({ name: 'reviewer_role', length: 50 })
  reviewerRole: string;

  @Column({ length: 20 })
  action: string;

  @Column({ name: 'previous_status', length: 20 })
  previousStatus: string;

  @Column({ name: 'new_status', length: 20 })
  newStatus: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks?: string;

  @Column({ name: 'rejection_reason_code', length: 30, nullable: true })
  rejectionReasonCode?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
