// ─────────────────────────────────────────────────────────────
// 7. DECISION ENGINE
// ─────────────────────────────────────────────────────────────

import type { UUID, PaisaAmount, ISODateString, ISODateTimeString } from './shared';
import type { RejectionReasonCode } from './loan';

export type DecisionStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'CONDITIONALLY_APPROVED'
  | 'REJECTED'
  | 'REFER_TO_CREDIT_COMMITTEE'
  | 'MANUAL_OVERRIDE'
  | 'OVERRIDE_PENDING';

export type BenchmarkRateType = 'MCLR_1Y' | 'MCLR_3M' | 'REPO_RATE' | 'T_BILL_91D';

export interface DecisionRequest {
  applicationId: UUID;
  triggeredBy: UUID;
  triggeredByRole: string;
}

export interface RuleEngineResult {
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  outcome: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  threshold?: number | string;
  actualValue?: number | string;
  message: string;
  isHardStop: boolean;
}

export type RuleCategory =
  | 'CREDIT_SCORE'
  | 'FOIR'
  | 'LTV'
  | 'AGE'
  | 'INCOME'
  | 'EMPLOYMENT'
  | 'BUREAU_HISTORY'
  | 'DEDUPLICATION'
  | 'FRAUD'
  | 'POLICY'
  | 'REGULATORY'
  | 'GEOGRAPHY';

export interface ScorecardResult {
  modelId: string;
  modelVersion: string;
  totalScore: number;
  maxScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  bandLabel: string;
  featureScores: FeatureScore[];
  predictionProbability: number;
}

export interface FeatureScore {
  featureName: string;
  value: number | string;
  score: number;
  weight: number;
}

export interface ApprovalCondition {
  conditionCode: string;
  description: string;
  isMandatory: boolean;
  dueDate?: ISODateString;
  satisfiedAt?: ISODateTimeString;
  satisfiedBy?: UUID;
}

export interface DecisionResult {
  id: UUID;
  applicationId: UUID;
  status: DecisionStatus;
  decision: 'APPROVE' | 'REJECT' | 'MANUAL';
  approvedAmount?: PaisaAmount;
  approvedTenureMonths?: number;
  interestRateType: 'FIXED' | 'FLOATING';
  rateOfInterestBps: number;
  spreadBps?: number;
  benchmarkRate?: BenchmarkRateType;
  processingFeePaisa: PaisaAmount;
  insuranceMandatory: boolean;
  ltvRatio?: number;
  foirActual: number;
  ruleResults: RuleEngineResult[];
  scorecardResult?: ScorecardResult;
  conditions?: ApprovalCondition[];
  rejectionReasonCode?: RejectionReasonCode;
  rejectionRemarks?: string;
  decidedBy: 'RULE_ENGINE' | 'ML_MODEL' | 'MANUAL';
  decidedAt: ISODateTimeString;
  version: number;
}

export interface TriggerDecisionRequest {
  applicationId: UUID;
  forceRerun?: boolean;
  contextData?: string;
}

export interface ManualDecisionRequest {
  applicationId: UUID;
  status: DecisionStatus;
  decision: 'APPROVE' | 'REJECT'; // Renamed from finalDecision
  approvedAmount?: PaisaAmount;
  approvedTenureMonths?: number;
  rateOfInterestBps?: number;
  conditions?: Omit<ApprovalCondition, 'satisfiedAt' | 'satisfiedBy'>[];
  rejectionReasonCode?: RejectionReasonCode;
  remarks: string;
}

// Responses (DTOs) - added to align frontend typing with backend responses
export interface DecisionResponseDto {
  applicationId: UUID;
  status: DecisionStatus;
  decision: 'APPROVE' | 'REJECT' | 'MANUAL'; // Renamed from finalDecision
  approvedAmount?: PaisaAmount;
  approvedTenureMonths?: number;
  rejectionReasonCode?: RejectionReasonCode;
  remarks?: string;
  decidedAt?: ISODateTimeString;
}

export interface DecisionHistoryDto {
  id: UUID;
  applicationId: UUID;
  fromStatus: DecisionStatus;
  toStatus: DecisionStatus;
  changedAt: ISODateTimeString;
  changedBy?: string;
  remarks?: string;
}
