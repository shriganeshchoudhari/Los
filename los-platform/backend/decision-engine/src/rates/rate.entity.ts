import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  RateBenchmarkType,
  CreditGrade,
  EmploymentCategory,
  TenureSpreadBand,
  CreditGradeSpreadConfig,
} from './rate.types';

@Entity('interest_rate_configs')
@Index(['productCode', 'isActive'])
@Index(['effectiveFrom'])
export class InterestRateConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_code', length: 20 })
  productCode: string;

  @Column({ name: 'benchmark_type', length: 15, default: RateBenchmarkType.MCLR_1Y })
  benchmarkType: RateBenchmarkType;

  @Column({ name: 'interest_rate_type', length: 10, default: 'FLOATING' })
  interestRateType: string;

  @Column({ name: 'min_rate_bps', type: 'smallint' })
  minRateBps: number;

  @Column({ name: 'max_rate_bps', type: 'smallint' })
  maxRateBps: number;

  @Column({ name: 'default_spread_bps', type: 'smallint' })
  defaultSpreadBps: number;

  @Column({ name: 'tenure_spread_bands', type: 'jsonb', nullable: true })
  tenureSpreadBands: TenureSpreadBand[];

  @Column({ name: 'credit_grade_spreads', type: 'jsonb', nullable: true })
  creditGradeSpreads: CreditGradeSpreadConfig[];

  @Column({ name: 'employment_adjustments_bps', type: 'jsonb', nullable: true })
  employmentAdjustmentsBps: Record<EmploymentCategory, number>;

  @Column({ name: 'employer_risk_premium_bps', type: 'jsonb', nullable: true })
  employerRiskPremiumBps: Record<string, number>;

  @Column({ name: 'amount_risk_thresholds', type: 'jsonb', nullable: true })
  amountRiskThresholds: { minAmount: number; maxAmount: number; additionalBps: number }[];

  @Column({ name: 'roi_preview_table', type: 'jsonb', nullable: true })
  roiPreviewTable: { tenure: number; grade: string; ratePercent: number }[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity('rate_history')
@Index(['productCode', 'createdAt'])
@Index(['applicationId'])
export class RateHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({ name: 'product_code', length: 20 })
  productCode: string;

  @Column({ name: 'credit_grade', length: 5 })
  creditGrade: string;

  @Column({ name: 'approved_amount', type: 'bigint' })
  approvedAmount: number;

  @Column({ name: 'tenure_months', type: 'smallint' })
  tenureMonths: number;

  @Column({ name: 'benchmark_type', length: 15 })
  benchmarkType: string;

  @Column({ name: 'benchmark_rate', type: 'numeric', precision: 10, scale: 4 })
  benchmarkRate: number;

  @Column({ name: 'total_spread_bps', type: 'smallint' })
  totalSpreadBps: number;

  @Column({ name: 'final_rate_bps', type: 'smallint' })
  finalRateBps: number;

  @Column({ name: 'final_rate_percent', type: 'numeric', precision: 6, scale: 4 })
  finalRatePercent: number;

  @Column({ name: 'is_rate_capped', default: false })
  isRateCapped: boolean;

  @Column({ name: 'calculation_breakdown', type: 'jsonb' })
  calculationBreakdown: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
