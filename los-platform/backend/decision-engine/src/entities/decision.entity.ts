import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';

export enum DecisionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  CONDITIONALLY_APPROVED = 'CONDITIONALLY_APPROVED',
  REJECTED = 'REJECTED',
  REFER_TO_CREDIT_COMMITTEE = 'REFER_TO_CREDIT_COMMITTEE',
  OVERRIDE_PENDING = 'OVERRIDE_PENDING',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
}

export enum DecisionType {
  RULE_ENGINE = 'RULE_ENGINE',
  ML_MODEL = 'ML_MODEL',
  MANUAL = 'MANUAL',
}

@Entity('decision_results')
@Index('idx_decision_application', ['applicationId'], { unique: true })
@Index('idx_decision_status', ['status', 'decidedAt'])
export class DecisionResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id' })
  applicationId: string;

  @Column({ length: 30, default: DecisionStatus.PENDING })
  status: DecisionStatus;

  @Column({ name: 'final_decision', length: 10, nullable: true })
  finalDecision?: string;

  @Column({ name: 'approved_amount', type: 'bigint', nullable: true })
  approvedAmount?: number;

  @Column({ name: 'approved_tenure_months', nullable: true })
  approvedTenureMonths?: number;

  @Column({ name: 'interest_rate_type', length: 10, nullable: true })
  interestRateType?: string;

  @Column({ name: 'rate_of_interest_bps', nullable: true })
  rateOfInterestBps?: number;

  @Column({ name: 'spread_bps', nullable: true })
  spreadBps?: number;

  @Column({ name: 'benchmark_rate', length: 15, nullable: true })
  benchmarkRate?: string;

  @Column({ name: 'processing_fee_paisa', type: 'bigint', default: 0 })
  processingFeePaisa: number;

  @Column({ name: 'insurance_mandatory', default: false })
  insuranceMandatory: boolean;

  @Column({ name: 'ltv_ratio', type: 'numeric', precision: 5, scale: 2, nullable: true })
  ltvRatio?: number;

  @Column({ name: 'foir_actual', type: 'numeric', precision: 5, scale: 2, nullable: true })
  foirActual?: number;

  @Column({ name: 'scorecard_result', type: 'jsonb', nullable: true })
  scorecardResult?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  conditions?: Record<string, any>[];

  @Column({ name: 'rejection_reason_code', length: 30, nullable: true })
  rejectionReasonCode?: string;

  @Column({ name: 'rejection_remarks', type: 'text', nullable: true })
  rejectionRemarks?: string;

  @Column({ name: 'decided_by', length: 15, default: DecisionType.RULE_ENGINE })
  decidedBy: DecisionType;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date;

  @Column({ name: 'policy_version', length: 10 })
  policyVersion: string;

  @Column({ name: 'override_by', nullable: true })
  overrideBy?: string;

  @Column({ name: 'override_remarks', type: 'text', nullable: true })
  overrideRemarks?: string;

  @Column({ name: 'override_request_by', nullable: true })
  overrideRequestBy?: string;

  @Column({ name: 'override_request_at', type: 'timestamptz', nullable: true })
  overrideRequestAt?: Date;

  @Column({ name: 'override_request_remarks', type: 'text', nullable: true })
  overrideRequestRemarks?: string;

  @Column({ name: 'override_requested_decision', length: 20, nullable: true })
  overrideRequestedDecision?: string;

  @Column({ name: 'override_requested_amount', type: 'bigint', nullable: true })
  overrideRequestedAmount?: number;

  @Column({ name: 'override_requested_tenure', nullable: true })
  overrideRequestedTenure?: number;

  @Column({ name: 'override_requested_rate', nullable: true })
  overrideRequestedRateBps?: number;

  @Column({ name: 'override_request_conditions', type: 'jsonb', nullable: true })
  overrideRequestConditions?: Record<string, any>[];

  @Column({ name: 'override_requested_rejection_code', length: 30, nullable: true })
  overrideRequestedRejectionCode?: string;

  @Column({ name: 'override_authority_level', length: 30, nullable: true })
  overrideAuthorityLevel?: string;

  @Column({ name: 'override_attachments', type: 'jsonb', nullable: true })
  overrideAttachments?: string[];

  @Column({ name: 'override_approved_by', nullable: true })
  overrideApprovedBy?: string;

  @Column({ name: 'override_approved_at', type: 'timestamptz', nullable: true })
  overrideApprovedAt?: Date;

  @Column({ name: 'override_approver_remarks', type: 'text', nullable: true })
  overrideApproverRemarks?: string;

  @Column({ name: 'override_approval_action', length: 10, nullable: true })
  overrideApprovalAction?: string;

  @Column({ name: 'override_rejected_reason', type: 'text', nullable: true })
  overrideRejectedReason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @VersionColumn()
  version: number;
}

@Entity('decision_rule_results')
@Index('idx_rule_results_decision', ['decisionId', 'outcome'])
export class DecisionRuleResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'decision_id' })
  decisionId: string;

  @ManyToOne(() => DecisionResult)
  @JoinColumn({ name: 'decision_id' })
  decision: DecisionResult;

  @Column({ name: 'rule_id', length: 20 })
  ruleId: string;

  @Column({ name: 'rule_name', length: 100 })
  ruleName: string;

  @Column({ length: 20 })
  category: string;

  @Column({ length: 5 })
  outcome: string;

  @Column({ length: 50, nullable: true })
  threshold?: string;

  @Column({ name: 'actual_value', length: 50, nullable: true })
  actualValue?: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ name: 'is_hard_stop', default: false })
  isHardStop: boolean;
}
