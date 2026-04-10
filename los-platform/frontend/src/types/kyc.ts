// ─────────────────────────────────────────────────────────────
// 3. KYC SERVICE — Aadhaar eKYC + PAN Verification
// ─────────────────────────────────────────────────────────────

import type { UUID, AadhaarNumber, PANNumber, ISODateString, ISODateTimeString } from './shared';

export type KYCStatus =
  | 'NOT_STARTED'
  | 'AADHAAR_OTP_SENT'
  | 'AADHAAR_VERIFIED'
  | 'PAN_VERIFIED'
  | 'FACE_MATCH_PENDING'
  | 'FACE_MATCH_PASSED'
  | 'FACE_MATCH_FAILED'
  | 'KYC_COMPLETE'
  | 'KYC_FAILED'
  | 'MANUAL_REVIEW';

export interface KYCRecord {
  id: UUID;
  applicationId: UUID;
  userId: UUID;
  status: KYCStatus;
  aadhaarKyc?: AadhaarKYCResult;
  panVerification?: PANVerificationResult;
  faceMatchResult?: FaceMatchResult;
  overallRiskScore: number;
  reviewedBy?: UUID;
  reviewNotes?: string;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

// ── Aadhaar eKYC ──

export interface AadhaarOtpInitRequest {
  aadhaarNumber: AadhaarNumber;
  applicationId: UUID;
  consentOtpSessionId: UUID;
}

export interface AadhaarOtpInitResponse {
  txnId: string;
  uidaiRefId: string;
  expiresIn: number;
}

export interface AadhaarKYCVerifyRequest {
  txnId: string;
  otp: string;
  uidaiRefId: string;
  applicationId: UUID;
}

export interface AadhaarKYCData {
  name: string;
  dob: ISODateString;
  gender: 'M' | 'F' | 'T';
  address: AadhaarAddress;
  photo: string;
  mobile?: string;
  email?: string;
  xmlData?: string;
  signatureValid: boolean;
}

export interface AadhaarAddress {
  co?: string;
  street?: string;
  house?: string;
  locality?: string;
  vtc?: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  po?: string;
}

export interface AadhaarKYCResult {
  txnId: string;
  uidaiRefId: string;
  aadhaarNumberHash: string;
  kycData: AadhaarKYCData;
  verifiedAt: ISODateTimeString;
  uidaiResponseCode: string;
  ipMetadata: UIDAPIMetadata;
}

export interface UIDAPIMetadata {
  authCode: string;
  ts: string;
  info: string;
}

// ── PAN Verification ──

export interface PANVerifyRequest {
  panNumber: PANNumber;
  fullName: string;
  dob: ISODateString;
  applicationId: UUID;
}

export type PANStatus = 'VALID' | 'INVALID' | 'INACTIVE' | 'FAKE' | 'DUPLICATE';

export interface PANVerificationResult {
  panNumber: PANNumber;
  nameMatchScore: number;
  nameOnPAN: string;
  dobMatch: boolean;
  panStatus: PANStatus;
  linkedAadhaar: boolean;
  verifiedAt: ISODateTimeString;
  nsdlTransactionId: string;
  aadhaarSeedingStatus?: 'SEEDED' | 'NOT_SEEDED' | 'DEACTIVATED';
}

// ── Face Match ──

export interface FaceMatchRequest {
  applicationId: UUID;
  selfieImageBase64: string;
  aadhaarPhotoBase64: string;
}

export type FaceMatchProvider = 'AADHAAR_FACEAUTH' | 'INTERNAL_CV_MODEL' | 'THIRD_PARTY_VENDOR';
export type FaceMatchFailureReason =
  | 'SCORE_BELOW_THRESHOLD'
  | 'LIVENESS_FAILED'
  | 'IMAGE_QUALITY_POOR'
  | 'MULTIPLE_FACES'
  | 'PROVIDER_ERROR';

export interface FaceMatchResult {
  matchScore: number;
  passed: boolean;
  livenessScore: number;
  livenessCheckPassed: boolean;
  provider: FaceMatchProvider;
  requestId: string;
  processedAt: ISODateTimeString;
  failureReason?: FaceMatchFailureReason;
}
