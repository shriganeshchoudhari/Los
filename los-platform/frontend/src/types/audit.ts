// ─────────────────────────────────────────────────────────────
// 12. AUDIT & COMPLIANCE
// ─────────────────────────────────────────────────────────────

import type { UUID, ISODateTimeString } from './shared';
import type { UserRole } from './auth';

export type AuditEventCategory =
  | 'AUTH'
  | 'APPLICATION'
  | 'KYC'
  | 'DOCUMENT'
  | 'DECISION'
  | 'LOAN'
  | 'PAYMENT'
  | 'CBS'
  | 'CONFIGURATION'
  | 'ADMIN'
  | 'DATA_ACCESS';

export interface AuditLog {
  id: UUID;
  eventCategory: AuditEventCategory;
  eventType: string;
  actorId?: UUID;
  actorRole?: UserRole;
  actorIp?: string;
  userAgent?: string;
  entityType: string;
  entityId: UUID;
  beforeState?: string;
  afterState?: string;
  metadata?: Record<string, unknown>;
  requestId: UUID;
  correlationId?: UUID;
  serviceOrigin: string;
  timestamp: ISODateTimeString;
  isTamperEvident: boolean;
  chainHash: string;
}

export interface DataAccessLog {
  id: UUID;
  accessorId: UUID;
  accessorRole: UserRole;
  resourceType: 'AADHAAR_DATA' | 'PAN_DATA' | 'CREDIT_REPORT' | 'BANK_STATEMENT' | 'LOAN_DATA';
  resourceId: UUID;
  purpose: string;
  consentId?: UUID;
  accessedAt: ISODateTimeString;
  ipAddress: string;
}

export type ConsentType =
  | 'KYC_AADHAAR_EKYC'
  | 'CREDIT_BUREAU_PULL'
  | 'DATA_PROCESSING'
  | 'MARKETING_COMMUNICATIONS'
  | 'THIRD_PARTY_SHARE'
  | 'NACH_MANDATE'
  | 'LOAN_AGREEMENT';

export interface ConsentRecord {
  id: UUID;
  userId: UUID;
  applicationId: UUID;
  consentType: ConsentType;
  consentText: string;
  consentVersion: string;
  isGranted: boolean;
  grantedAt: ISODateTimeString;
  ipAddress: string;
  userAgent: string;
  signedOtpSessionId?: UUID;
  revokedAt?: ISODateTimeString;
  expiresAt?: ISODateTimeString;
}
