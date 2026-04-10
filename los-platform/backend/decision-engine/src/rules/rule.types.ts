import {
  DecisionResult,
  DecisionRuleResult,
  DecisionStatus,
  DecisionType,
} from '../entities/decision.entity';
import { LoanProductConfig, BenchmarkRate } from '../entities/product.entity';

export enum RuleCategory {
  CREDIT_SCORE = 'CREDIT_SCORE',
  FOIR = 'FOIR',
  INCOME = 'INCOME',
  AGE = 'AGE',
  AMOUNT_TENURE = 'AMOUNT_TENURE',
  BUREAU_HISTORY = 'BUREAU_HISTORY',
  FRAUD = 'FRAUD',
  EMPLOYMENT = 'EMPLOYMENT',
  LTV = 'LTV',
  PRODUCT_POLICY = 'PRODUCT_POLICY',
  LEGAL = 'LEGAL',
  DEDUPLICATION = 'DEDUPLICATION',
  CHANNEL = 'CHANNEL',
}

export enum RuleOutcome {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARN = 'WARN',
  SKIP = 'SKIP',
}

export enum RuleSeverity {
  HARD_STOP = 'HARD_STOP',
  SOFT_STOP = 'SOFT_STOP',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

export interface RuleDefinition {
  ruleId: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  version: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  loanTypes?: string[];
  channels?: string[];
  conditions: RuleCondition[];
  thenClause: RuleThenClause;
  productOverrides?: ProductOverride[];
  skipConditions?: RuleCondition[];
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'exists' | 'notExists' | 'and' | 'or';
  value?: any;
  conditions?: RuleCondition[];
}

export interface RuleThenClause {
  outcome: RuleOutcome;
  outcomeMessage: string;
  rejectionCode?: string;
  conditionCode?: string;
  isMandatory?: boolean;
  deviationAllowed?: boolean;
  maxDeviationPercent?: number;
}

export interface ProductOverride {
  loanType: string;
  threshold?: number;
  isHardStop?: boolean;
  customMessage?: string;
}

export interface RuleEvaluationContext {
  applicationId: string;
  loanType: string;
  channelCode: string;
  requestedAmount: number;
  requestedTenureMonths: number;
  applicantAge: number;
  employmentType: string;
  employmentTenureMonths?: number;
  companyCategory?: string;
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  totalAnnualIncome: number;
  collateralValue?: number;
  dsaCode?: string;
  bureauData?: BureauContextData;
  existingApplications?: ExistingApplicationData[];
  previousLoans?: PreviousLoanData[];
}

export interface BureauContextData {
  creditScore: number;
  scoreModel: string;
  scorePullDate?: string;
  activeAccounts: number;
  closedAccounts: number;
  overdueAccounts: number;
  totalExposure: number;
  securedExposure: number;
  unsecuredExposure: number;
  totalEmi: number;
  dpd30: number;
  dpd60: number;
  dpd90: number;
  dpd180: number;
  maxDpd: number;
  enquiries30d: number;
  enquiries90d: number;
  writeoffs: number;
  suitFiled: boolean;
  wilfulDefaulter: boolean;
  disputed: boolean;
  fraudFlag: boolean;
  lastScore?: number;
  scoreDrop?: number;
  enquiries: BureauEnquiry[];
  accounts: BureauAccount[];
}

export interface BureauEnquiry {
  date: string;
  amount: number;
  purpose: string;
  lender: string;
}

export interface BureauAccount {
  accountNumber: string;
  accountType: string;
  status: string;
  ownershipType: string;
  currentBalance: number;
  sanctionAmount: number;
  overdueAmount: number;
  dpd: number;
  openedDate: string;
  closedDate?: string;
  lastPaymentDate?: string;
  lender: string;
}

export interface ExistingApplicationData {
  applicationId: string;
  status: string;
  createdAt: string;
}

export interface PreviousLoanData {
  accountNumber: string;
  status: string;
  outstandingAmount: number;
  dpd: number;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  severity: RuleSeverity;
  outcome: RuleOutcome;
  threshold: string;
  actualValue: string;
  message: string;
  isHardStop: boolean;
  deviation?: number;
  conditionCode?: string;
  isMandatory?: boolean;
  evaluatedAt: Date;
}

export interface DecisionContext {
  ctx: RuleEvaluationContext;
  product: LoanProductConfig;
  benchmarkRates: Map<string, BenchmarkRate>;
}

export type RuleEvaluator = (ctx: DecisionContext) => RuleEvaluationResult;

export interface TriggerDecisionDto {
  applicationId: string;
  forceRerun?: boolean;
}

export interface ManualDecisionDto {
  applicationId: string;
  decision: 'APPROVE' | 'REJECT' | 'CONDITIONALLY_APPROVE';
  approvedAmount?: number;
  approvedTenureMonths?: number;
  rateOfInterestBps?: number;
  rejectionReasonCode?: string;
  remarks: string;
  conditions?: Array<{ conditionCode: string; description: string; isMandatory: boolean }>;
}

export interface DecisionResponseDto {
  decisionId: string;
  status: DecisionStatus;
  finalDecision: string;
  approvedAmount?: number;
  approvedTenureMonths?: number;
  rateOfInterestBps?: number;
  processingFeePaisa?: number;
  foirActual?: number;
  ltvRatio?: number;
  ruleResults: RuleEvaluationResult[];
  scorecardResult?: ScorecardResultDto;
  conditions?: Array<{ conditionCode: string; description: string; isMandatory: boolean }>;
  rejectionReasonCode?: string;
  rejectionRemarks?: string;
  decidedAt: string;
}

export interface ScorecardResultDto {
  modelId: string;
  modelVersion: string;
  totalScore: number;
  maxScore: number;
  grade: string;
  bandLabel: string;
  predictionProbability: number;
  factorScores?: Record<string, number>;
}

export interface RuleDefinitionEntity {
  id?: string;
  ruleId: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  version: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  loanTypes?: string[];
  channels?: string[];
  conditions: RuleCondition[];
  thenClause: RuleThenClause;
  productOverrides?: ProductOverride[];
  skipConditions?: RuleCondition[];
  createdAt?: Date;
  updatedAt?: Date;
}
