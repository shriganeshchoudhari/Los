import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LoanType {
  HOME_LOAN = 'HOME_LOAN',
  LAP = 'LAP',
  PERSONAL_LOAN = 'PERSONAL_LOAN',
  VEHICLE_LOAN_TWO_WHEELER = 'VEHICLE_LOAN_TWO_WHEELER',
  VEHICLE_LOAN_FOUR_WHEELER = 'VEHICLE_LOAN_FOUR_WHEELER',
  GOLD_LOAN = 'GOLD_LOAN',
  EDUCATION_LOAN = 'EDUCATION_LOAN',
  MSME_TERM_LOAN = 'MSME_TERM_LOAN',
  MUDRA_KISHORE = 'MUDRA_KISHORE',
  MUDRA_TARUN = 'MUDRA_TARUN',
  KISAN_CREDIT_CARD = 'KISAN_CREDIT_CARD',
}

export enum EmploymentType {
  SALARIED_PRIVATE = 'SALARIED_PRIVATE',
  SALARIED_GOVERNMENT = 'SALARIED_GOVERNMENT',
  SALARIED_PSU = 'SALARIED_PSU',
  SELF_EMPLOYED_PROFESSIONAL = 'SELF_EMPLOYED_PROFESSIONAL',
  SELF_EMPLOYED_BUSINESS = 'SELF_EMPLOYED_BUSINESS',
  AGRICULTURALIST = 'AGRICULTURALIST',
  PENSIONER = 'PENSIONER',
}

@Entity('loan_product_configs')
@Index('idx_product_type_active', ['loanType', 'isActive', 'effectiveFrom'])
export class LoanProductConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_code', unique: true, length: 20 })
  productCode: string;

  @Column({ name: 'loan_type', length: 30 })
  loanType: LoanType;

  @Column({ name: 'min_amount', type: 'bigint' })
  minAmount: number;

  @Column({ name: 'max_amount', type: 'bigint' })
  maxAmount: number;

  @Column({ name: 'min_tenure_months' })
  minTenureMonths: number;

  @Column({ name: 'max_tenure_months' })
  maxTenureMonths: number;

  @Column({ name: 'min_age' })
  minAge: number;

  @Column({ name: 'max_age' })
  maxAge: number;

  @Column({ name: 'min_credit_score' })
  minCreditScore: number;

  @Column({ name: 'max_foir', type: 'numeric', precision: 5, scale: 2 })
  maxFoir: number;

  @Column({ name: 'max_ltv', type: 'numeric', precision: 5, scale: 2, nullable: true })
  maxLtv?: number;

  @Column({ name: 'base_rate_bps' })
  baseRateBps: number;

  @Column({ name: 'spread_bps', default: 0 })
  spreadBps: number;

  @Column({ name: 'processing_fee_percent', type: 'numeric', precision: 5, scale: 2, default: 0 })
  processingFeePercent: number;

  @Column({ name: 'prepayment_penalty_pct', type: 'numeric', precision: 5, scale: 2, default: 0 })
  prepaymentPenaltyPct: number;

  @Column({ name: 'allowed_employment_types', type: 'text', array: true, nullable: true })
  allowedEmploymentTypes?: string[];

  @Column({ name: 'mandatory_documents', type: 'text', array: true, nullable: true })
  mandatoryDocuments?: string[];

  @Column({ name: 'conditional_rules', type: 'jsonb', nullable: true })
  conditionalRules?: Record<string, any>[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity('benchmark_rates')
export class BenchmarkRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 15 })
  type: string;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  rate: number;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: Date;

  @Column({ name: 'published_by', length: 50 })
  publishedBy: string;

  @CreateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
