export type MCLOverage = 'OVERNIGHT' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y';

export enum InterestRateType {
  FLOATING = 'FLOATING',
  FIXED = 'FIXED',
  HYBRID = 'HYBRID',
}

export enum RateBenchmarkType {
  MCLR_1Y = 'MCLR_1Y',
  MCLR_3M = 'MCLR_3M',
  REPO_RATE = 'REPO_RATE',
  T_BILL_91D = 'T_BILL_91D',
  BASE_RATE = 'BASE_RATE',
}

export enum CreditGrade {
  A_PLUS = 'A+',
  A = 'A',
  B_PLUS = 'B+',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F',
}

export enum EmploymentCategory {
  SALARIED = 'SALARIED',
  SELF_EMPLOYED = 'SELF_EMPLOYED',
  AGRICULTURALIST = 'AGRICULTURALIST',
  PENSIONER = 'PENSIONER',
}

export interface TenureSpreadBand {
  minTenureMonths: number;
  maxTenureMonths: number;
  benchmarkType: RateBenchmarkType;
  additionalSpreadBps: number;
  description: string;
}

export interface CreditGradeSpreadConfig {
  grade: CreditGrade;
  minSpreadBps: number;
  maxSpreadBps: number;
  description: string;
}

export interface RateCalculationInput {
  productCode: string;
  loanType: string;
  approvedAmount: number;
  approvedTenureMonths: number;
  creditGrade: CreditGrade;
  bureauScore: number;
  employmentType: string;
  grossMonthlyIncome: number;
  isSalaried: boolean;
  employerCategory?: string;
}

export interface RateCalculationResult {
  benchmarkType: RateBenchmarkType;
  benchmarkRate: number;
  baseSpreadBps: number;
  tenureAdjustmentBps: number;
  creditGradeAdjustmentBps: number;
  employmentAdjustmentBps: number;
  amountRiskAdjustmentBps: number;
  totalSpreadBps: number;
  finalRateBps: number;
  finalRatePercent: number;
  minRateBps: number;
  maxRateBps: number;
  isRateCapped: boolean;
  rateCappingReason?: string;
  calculationBreakdown: {
    mclrRate: number;
    baseSpread: number;
    tenureAdjustment: string;
    gradeAdjustment: string;
    employmentAdjustment: string;
    amountRiskPremium: string;
    totalSpread: number;
    finalRate: number;
  };
}

export interface ProductRateRule {
  productCode: string;
  benchmarkType: RateBenchmarkType;
  minRateBps: number;
  maxRateBps: number;
  defaultSpreadBps: number;
  tenureBands: TenureSpreadBand[];
  creditGradeSpreads: CreditGradeSpreadConfig[];
  employmentSpreadAdjustmentBps: Record<EmploymentCategory, number>;
  employerRiskPremiumBps: Record<string, number>;
  amountRiskThresholds: { minAmount: number; maxAmount: number; additionalBps: number }[];
  roiPreviewTable: { tenure: number; grade: string; ratePercent: number }[];
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface SanctionLetterData {
  applicationNumber: string;
  customerName: string;
  customerAddress: string;
  sanctionedAmount: number;
  sanctionedAmountInWords: string;
  rateOfInterestPercent: number;
  rateOfInterestBps: number;
  tenureMonths: number;
  emiAmount: number;
  processingFeeAmount: number;
  insurancePremium?: number;
  totalPayableAmount: number;
  firstEmiDate: string;
  lastEmiDate: string;
  productName: string;
  productCode: string;
  bankName: string;
  bankAddress: string;
  sanctionDate: string;
  validUntil: string;
  disbursementConditions: string[];
  sanctioningAuthority: string;
  authorityDesignation: string;
  loanAccountNumber?: string;
  ifscCode?: string;
  branchName?: string;
}
