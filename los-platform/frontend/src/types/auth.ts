// ─────────────────────────────────────────────────────────────
// 2. USER & AUTH SERVICE
// ─────────────────────────────────────────────────────────────

import type { UUID, MobileNumber, PANNumber, ISODateTimeString } from './shared';

export type UserRole =
  | 'APPLICANT'
  | 'LOAN_OFFICER'
  | 'CREDIT_ANALYST'
  | 'BRANCH_MANAGER'
  | 'ZONAL_CREDIT_HEAD'
  | 'COMPLIANCE_OFFICER'
  | 'SYSTEM'
  | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface User {
  id: UUID;
  employeeId?: string;
  fullName: string;
  email: string;
  mobile: MobileNumber;
  role: UserRole;
  status: UserStatus;
  branchCode?: string;
  panNumber?: PANNumber;
  lastLoginAt?: ISODateTimeString;
  failedLoginAttempts: number;
  lockedUntil?: ISODateTimeString;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface OtpSession {
  sessionId: UUID;
  mobile: MobileNumber;
  otpHash: string;
  purpose: OtpPurpose;
  attempts: number;
  expiresAt: ISODateTimeString;
  isUsed: boolean;
  ipAddress: string;
  userAgent: string;
}

export type OtpPurpose =
  | 'LOGIN'
  | 'AADHAAR_CONSENT'
  | 'LOAN_APPLICATION_SUBMIT'
  | 'DISBURSEMENT_CONFIRM'
  | 'PASSWORD_RESET';

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string[];
}

export interface JWTPayload {
  sub: UUID;
  role: UserRole;
  branchCode?: string;
  sessionId: UUID;
  iat: number;
  exp: number;
  jti: UUID;
}

export interface RefreshTokenRecord {
  tokenId: UUID;
  userId: UUID;
  hashedToken: string;
  deviceFingerprint?: string;
  createdAt: ISODateTimeString;
  expiresAt: ISODateTimeString;
  revokedAt?: ISODateTimeString;
}

export interface LoginWithOtpRequest {
  mobile: MobileNumber;
  otp: string;
  sessionId: UUID;
  deviceFingerprint?: string;
}

export interface SendOtpRequest {
  mobile: MobileNumber;
  purpose: OtpPurpose;
  channel: 'SMS' | 'WHATSAPP';
}

export interface SendOtpResponse {
  sessionId: UUID;
  expiresIn: number;
  maskedMobile: string;
}
