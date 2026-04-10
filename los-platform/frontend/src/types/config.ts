// ─────────────────────────────────────────────────────────────
// 16. CONFIGURATION & FEATURE FLAGS
// ─────────────────────────────────────────────────────────────

import type { UUID, PaisaAmount, ISODateString, ISODateTimeString } from './shared';
import type { LoanType, EmploymentType, DocumentType } from './loan';
import type { UserRole } from './auth';

export interface ConditionalDocumentRule {
  condition: string;
  requiredDocuments: DocumentType[];
}

export interface LoanProductConfig {
  productCode: string;
  loanType: LoanType;
  minAmount: PaisaAmount;
  maxAmount: PaisaAmount;
  minTenureMonths: number;
  maxTenureMonths: number;
  minAge: number;
  maxAge: number;
  minCreditScore: number;
  maxFOIR: number;
  maxLTV?: number;
  baseRateBps: number;
  spreadBps: number;
  processingFeePercent: number;
  prepaymentPenaltyPercent: number;
  allowedEmploymentTypes: EmploymentType[];
  mandatoryDocuments: DocumentType[];
  conditionalDocuments: ConditionalDocumentRule[];
  isActive: boolean;
  effectiveFrom: ISODateString;
  effectiveTo?: ISODateString;
}

export interface FeatureFlag {
  flagKey: string;
  description: string;
  isEnabled: boolean;
  enabledForRoles?: UserRole[];
  enabledForBranches?: string[];
  rolloutPercentage?: number;
  updatedBy: UUID;
  updatedAt: ISODateTimeString;
}

export interface RateLimitConfig {
  endpoint: string;
  windowSeconds: number;
  maxRequests: number;
  burstLimit: number;
  keyStrategy: 'IP' | 'USER_ID' | 'API_KEY' | 'IP_AND_USER';
}

export type BenchmarkRateType = 'MCLR_1Y' | 'MCLR_3M' | 'REPO_RATE' | 'T_BILL_91D';

export interface BenchmarkRate {
  type: BenchmarkRateType;
  rate: number;
  effectiveFrom: ISODateString;
  publishedBy: string;
  updatedAt: ISODateTimeString;
}
