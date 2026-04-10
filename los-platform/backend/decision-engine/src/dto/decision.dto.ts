import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, IsArray, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DecisionStatus } from '../entities/decision.entity';

export class TriggerDecisionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiPropertyOptional({ description: 'Force rerun even if decision exists' })
  @IsOptional()
  @IsBoolean()
  forceRerun?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overrideNotes?: string;
}

export class ManualDecisionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsNotEmpty()
  @IsString()
  decision: string;

  @ApiPropertyOptional({ description: 'Approved amount in Paisa' })
  @IsOptional()
  @IsNumber()
  approvedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(360)
  approvedTenureMonths?: number;

  @ApiPropertyOptional({ description: 'Rate of interest in basis points' })
  @IsOptional()
  @IsNumber()
  rateOfInterestBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  conditions?: { conditionCode: string; description: string; isMandatory: boolean }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReasonCode?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  remarks: string;
}

export class OverrideRequestDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsNotEmpty()
  @IsString()
  requestedDecision: string;

  @ApiPropertyOptional({ description: 'Requested approved amount in Paisa' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  requestedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(360)
  requestedTenureMonths?: number;

  @ApiPropertyOptional({ description: 'Requested rate in basis points' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(3000)
  requestedRateBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  requestedConditions?: { conditionCode: string; description: string; isMandatory: boolean }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requestedRejectionCode?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  justification: string;

  @ApiProperty({ description: 'Delegation authority level of the requester' })
  @IsString()
  authorityLevel: string;

  @ApiPropertyOptional({ description: 'Supporting documents or references' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class OverrideApproveDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  overrideRequestId: string;

  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsNotEmpty()
  @IsString()
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ description: 'Amount approved (if different from requested)' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  approvedAmount?: number;

  @ApiPropertyOptional({ description: 'Tenure approved in months' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(360)
  approvedTenureMonths?: number;

  @ApiPropertyOptional({ description: 'Rate in bps (if different from requested)' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(3000)
  approvedRateBps?: number;
}

export class OverrideRequestResponseDto {
  @ApiProperty()
  overrideRequestId: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  requestedDecision: string;

  @ApiPropertyOptional()
  requestedAmount?: number;

  @ApiPropertyOptional()
  requestedTenureMonths?: number;

  @ApiPropertyOptional()
  requestedRateBps?: number;

  @ApiProperty()
  justification: string;

  @ApiProperty()
  authorityLevel: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  requestedBy: string;

  @ApiProperty()
  requestedAt: string;

  @ApiPropertyOptional()
  approvedBy?: string;

  @ApiPropertyOptional()
  approvedAt?: string;

  @ApiPropertyOptional()
  approverRemarks?: string;
}

export class RuleEvaluationDto {
  @ApiProperty()
  ruleId: string;

  @ApiProperty()
  ruleName: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ enum: ['PASS', 'FAIL', 'WARN', 'SKIP'] })
  outcome: string;

  @ApiPropertyOptional()
  threshold?: string;

  @ApiPropertyOptional()
  actualValue?: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  isHardStop: boolean;
}

export class ScorecardResultDto {
  @ApiProperty()
  modelId: string;

  @ApiProperty()
  modelVersion: string;

  @ApiProperty()
  totalScore: number;

  @ApiProperty()
  maxScore: number;

  @ApiProperty({ enum: ['A+', 'A', 'B', 'C', 'D', 'F'] })
  grade: string;

  @ApiProperty()
  bandLabel: string;

  @ApiProperty()
  predictionProbability: number;

  @ApiPropertyOptional()
  factorScores?: Record<string, number>;

  @ApiPropertyOptional({ description: 'ML model probability of default' })
  mlPd?: number;

  @ApiPropertyOptional({ description: 'ML model grade (A+/A/B+/B/C/D/F)' })
  mlGrade?: string;

  @ApiPropertyOptional({ description: 'ML model score (300-1000)' })
  mlScore?: number;

  @ApiPropertyOptional({ description: 'ML risk level (LOW/MEDIUM/HIGH/VERY_HIGH)' })
  mlRiskLevel?: string;

  @ApiPropertyOptional({ description: 'ML prediction confidence (0-1)' })
  mlConfidence?: number;

  @ApiPropertyOptional({ type: [String], description: 'Top contributing factors to ML decision' })
  mlExplanations?: string[];

  @ApiPropertyOptional({ description: 'Ensemble weights used (ML%, Rule%)' })
  ensembleWeights?: { mlWeight: number; ruleWeight: number };

  @ApiPropertyOptional({ description: 'Interest rate breakdown from rate engine' })
  interestRate?: InterestRateBreakdown;
}

export class InterestRateBreakdown {
  @ApiProperty()
  benchmarkType: string;

  @ApiProperty()
  benchmarkRate: number;

  @ApiProperty()
  totalSpreadBps: number;

  @ApiProperty()
  finalRateBps: number;

  @ApiProperty()
  finalRatePercent: number;

  @ApiPropertyOptional()
  isRateCapped?: boolean;

  @ApiPropertyOptional()
  rateCappingReason?: string;

  @ApiPropertyOptional({ type: Object, description: 'Spread calculation breakdown' })
  breakdown?: Record<string, number>;
}

export class DecisionResponseDto {
  @ApiProperty()
  decisionId: string;

  @ApiProperty({ enum: DecisionStatus })
  status: DecisionStatus;

  @ApiProperty()
  finalDecision: string;

  @ApiPropertyOptional()
  approvedAmount?: number;

  @ApiPropertyOptional()
  approvedTenureMonths?: number;

  @ApiProperty()
  rateOfInterestBps: number;

  @ApiProperty()
  processingFeePaisa: number;

  @ApiPropertyOptional()
  foirActual?: number;

  @ApiPropertyOptional()
  ltvRatio?: number;

  @ApiProperty()
  ruleResults: RuleEvaluationDto[];

  @ApiPropertyOptional({ type: ScorecardResultDto })
  scorecardResult?: ScorecardResultDto;

  @ApiPropertyOptional()
  conditions?: any[];

  @ApiPropertyOptional()
  rejectionReasonCode?: string;

  @ApiProperty()
  rejectionRemarks?: string;

  @ApiProperty()
  decidedAt: string;
}

export class BureauDataDto {
  @ApiProperty({ description: 'Credit score from bureau' })
  creditScore: number;

  @ApiProperty({ description: 'Score model used (e.g. CIBIL, Experian)' })
  scoreModel: string;

  @ApiProperty()
  activeAccounts: number;

  @ApiProperty()
  closedAccounts: number;

  @ApiProperty()
  overdueAccounts: number;

  @ApiProperty()
  totalExposure: number;

  @ApiProperty()
  dpd30: number;

  @ApiProperty()
  dpd60: number;

  @ApiProperty()
  dpd90: number;

  @ApiProperty()
  dpd180: number;

  @ApiProperty()
  fraudFlag: boolean;

  @ApiProperty()
  suitFiled: boolean;

  @ApiProperty()
  wilfulDefaulter: boolean;

  @ApiProperty({ type: [Object], description: 'Recent bureau enquiries' })
  enquiries: { date: string; institution: string; amount: number }[];
}

export class ApplicationContextDto {
  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  loanType: string;

  @ApiPropertyOptional()
  channelCode?: string;

  @ApiProperty()
  requestedAmount: number;

  @ApiProperty()
  requestedTenureMonths: number;

  @ApiProperty()
  applicantAge: number;

  @ApiProperty()
  employmentType: string;

  @ApiProperty()
  grossMonthlyIncome: number;

  @ApiProperty()
  netMonthlyIncome: number;

  @ApiProperty()
  totalAnnualIncome: number;

  @ApiPropertyOptional({ type: BureauDataDto })
  bureauData?: BureauDataDto;

  @ApiPropertyOptional()
  existingEmi?: number;

  @ApiPropertyOptional()
  collateralValue?: number;

  @ApiPropertyOptional()
  employerCategory?: string;
}
