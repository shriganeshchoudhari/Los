// ─────────────────────────────────────────────────────────────
// 4. DOCUMENTS
// ─────────────────────────────────────────────────────────────

import type { UUID, ISODateString, ISODateTimeString } from './shared';

export type DocumentType =
  | 'AADHAAR_FRONT'
  | 'AADHAAR_BACK'
  | 'PAN_CARD'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'DRIVING_LICENCE'
  | 'SALARY_SLIP_1'
  | 'SALARY_SLIP_2'
  | 'SALARY_SLIP_3'
  | 'BANK_STATEMENT_3M'
  | 'BANK_STATEMENT_6M'
  | 'BANK_STATEMENT_12M'
  | 'ITR_1'
  | 'ITR_2'
  | 'ITR_3'
  | 'FORM_16'
  | 'PROPERTY_PAPERS'
  | 'PROPERTY_VALUATION'
  | 'PROPERTY_SALE_AGREEMENT'
  | 'BUSINESS_PAN'
  | 'GST_CERTIFICATE'
  | 'BUSINESS_REGISTRATION'
  | 'CA_BALANCE_SHEET'
  | 'NACH_MANDATE'
  | 'SIGNED_LOAN_AGREEMENT'
  | 'INSURANCE_PROPOSAL'
  | 'SELFIE'
  | 'VIDEO_KYC_RECORDING'
  | 'OTHER';

export type DocumentStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'OCR_PROCESSING'
  | 'OCR_COMPLETE'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export type OCRProvider = 'INTERNAL' | 'KARZA' | 'SIGNZY' | 'DIGILOCKER';

export interface OCRResult {
  provider: OCRProvider;
  extractedFields: Record<string, string>;
  confidence: number;
  processedAt: ISODateTimeString;
  rawResponse?: string;
}

export interface Document {
  id: UUID;
  applicationId: UUID;
  userId: UUID;
  documentType: DocumentType;
  status: DocumentStatus;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  checksumSha256: string;
  ocrResult?: OCRResult;
  reviewedBy?: UUID;
  rejectionReason?: string;
  expiryDate?: ISODateString;
  uploadedAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  isEncrypted: boolean;
  encryptionKeyRef?: string;
  watermark?: string;
}

export interface PresignedUploadUrl {
  uploadUrl: string;
  documentId: UUID;
  fields?: Record<string, string>;
  expiresAt: ISODateTimeString;
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
}
