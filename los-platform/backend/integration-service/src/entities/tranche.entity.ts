import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { DisbursementStatus } from './payment.entity';

export enum TrancheStatus {
  PLANNED = 'PLANNED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  PARTIALLY_DISBURSED = 'PARTIALLY_DISBURSED',
  FULLY_DISBURSED = 'FULLY_DISBURSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum TrancheMilestone {
  PLANNING = 'PLANNING',
  AGREEMENT_SIGNED = 'AGREEMENT_SIGNED',
  FIRST_DISBURSEMENT = 'FIRST_DISBURSEMENT',
  PROPERTY_REGISTRATION = 'PROPERTY_REGISTRATION',
  CONSTRUCTION_RCPP = 'CONSTRUCTION_RCPP',
  POSSESSION = 'POSSESSION',
  LEGAL_VERIFICATION = 'LEGAL_VERIFICATION',
  TECHNICAL_VERIFICATION = 'TECHNICAL_VERIFICATION',
  FINAL_INSPECTION = 'FINAL_INSPECTION',
  NOC_ISSUED = 'NOC_ISSUED',
  DISBURSEMENT = 'DISBURSEMENT',
  HANDING_OVER = 'HANDING_OVER',
}

@Entity('disbursement_tranches')
@Index(['applicationId'])
@Index(['status'])
@Index(['applicationId', 'status'])
export class DisbursementTranche {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'loan_account_id', type: 'varchar', length: 30, nullable: true })
  loanAccountId: string;

  @Column({ name: 'tranche_number', type: 'smallint' })
  trancheNumber: number;

  @Column({ name: 'tranche_code', type: 'varchar', length: 30 })
  trancheCode: string;

  @Column({ name: 'tranche_name', type: 'varchar', length: 100 })
  trancheName: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ name: 'cumulative_disbursed', type: 'decimal', precision: 18, scale: 2, default: 0 })
  cumulativeDisbursed: number;

  @Column({ name: 'cumulative_amount', type: 'decimal', precision: 18, scale: 2 })
  cumulativeAmount: number;

  @Column({ name: 'percentage_of_sanction', type: 'decimal', precision: 5, scale: 2 })
  percentageOfSanction: number;

  @Column({ name: 'milestone', type: 'varchar', length: 50 })
  milestone: TrancheMilestone;

  @Column({ name: 'milestone_description', type: 'text', nullable: true })
  milestoneDescription: string;

  @Column({ type: 'enum', enum: TrancheStatus, default: TrancheStatus.PLANNED })
  status: TrancheStatus;

  @Column({ name: 'planned_date', type: 'date' })
  plannedDate: Date;

  @Column({ name: 'scheduled_date', type: 'date', nullable: true })
  scheduledDate: Date;

  @Column({ name: 'actual_disbursement_date', type: 'date', nullable: true })
  actualDisbursementDate: Date;

  @Column({ name: 'latest_allowed_date', type: 'date' })
  latestAllowedDate: Date;

  @Column({ name: 'benefit_description', type: 'text', nullable: true })
  benefitDescription: string;

  @Column({ name: 'required_documents', type: 'jsonb', nullable: true })
  requiredDocuments: string[];

  @Column({ name: 'submitted_documents', type: 'jsonb', nullable: true })
  submittedDocuments: string[];

  @Column({ name: 'documents_approved', type: 'boolean', default: false })
  documentsApproved: boolean;

  @Column({ name: 'inspection_required', type: 'boolean', default: false })
  inspectionRequired: boolean;

  @Column({ name: 'inspection_report_key', type: 'varchar', length: 500, nullable: true })
  inspectionReportKey: string;

  @Column({ name: 'inspection_conducted_at', type: 'timestamp with time zone', nullable: true })
  inspectionConductedAt: Date;

  @Column({ name: 'inspection_approved_by', type: 'uuid', nullable: true })
  inspectionApprovedBy: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp with time zone', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejected_by', type: 'uuid', nullable: true })
  rejectedBy: string;

  @Column({ name: 'rejected_at', type: 'timestamp with time zone', nullable: true })
  rejectedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('disbursement_plans')
@Index(['applicationId'], { unique: true })
export class DisbursementPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'loan_account_id', type: 'varchar', length: 30, nullable: true })
  loanAccountId: string;

  @Column({ name: 'total_sanctioned_amount', type: 'decimal', precision: 18, scale: 2 })
  totalSanctionedAmount: number;

  @Column({ name: 'total_planned_amount', type: 'decimal', precision: 18, scale: 2 })
  totalPlannedAmount: number;

  @Column({ name: 'total_disbursed_amount', type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalDisbursedAmount: number;

  @Column({ name: 'total_tranches', type: 'smallint' })
  totalTranches: number;

  @Column({ name: 'max_tranches', type: 'smallint', default: 10 })
  maxTranches: number;

  @Column({ name: 'first_tranche_min_percent', type: 'decimal', precision: 5, scale: 2, default: 10 })
  firstTrancheMinPercent: number;

  @Column({ name: 'subsequent_tranche_min_percent', type: 'decimal', precision: 5, scale: 2, default: 5 })
  subsequentTrancheMinPercent: number;

  @Column({ name: 'first_disbursement_min_amount', type: 'decimal', precision: 18, scale: 2, default: 100000 })
  firstDisbursementMinAmount: number;

  @Column({ name: 'stage_release_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  stageReleasePercent: number;

  @Column({ name: 'stage_name', type: 'varchar', length: 100, nullable: true })
  stageName: string;

  @Column({ name: 'project_type', type: 'varchar', length: 50, default: 'CONSTRUCTION' })
  projectType: string;

  @Column({ name: 'expected_completion_months', type: 'smallint', nullable: true })
  expectedCompletionMonths: number;

  @Column({ name: 'plan_status', type: 'varchar', length: 20, default: 'DRAFT' })
  planStatus: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'lock_version', type: 'int', default: 1 })
  lockVersion: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string;

  @Column({ name: 'prepared_by', type: 'uuid', nullable: true })
  preparedBy: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('disbursement_inspections')
@Index(['trancheId'])
@Index(['applicationId'])
export class DisbursementInspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'tranche_id', type: 'uuid' })
  trancheId: string;

  @Column({ name: 'inspection_type', type: 'varchar', length: 30 })
  inspectionType: string;

  @Column({ name: 'inspection_date', type: 'date' })
  inspectionDate: Date;

  @Column({ name: 'inspector_name', type: 'varchar', length: 200 })
  inspectorName: string;

  @Column({ name: 'inspector_agency', type: 'varchar', length: 200, nullable: true })
  inspectorAgency: string;

  @Column({ name: 'site_address', type: 'text' })
  siteAddress: string;

  @Column({ name: 'stage_of_construction', type: 'varchar', length: 100 })
  stageOfConstruction: string;

  @Column({ name: 'completion_percent', type: 'decimal', precision: 5, scale: 2 })
  completionPercent: number;

  @Column({ name: 'previous_completion_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  previousCompletionPercent: number;

  @Column({ name: 'stage_wise_progress', type: 'jsonb', nullable: true })
  stageWiseProgress: { stage: string; planned: number; actual: number; status: string }[];

  @Column({ name: 'quality_observations', type: 'text', nullable: true })
  qualityObservations: string;

  @Column({ name: 'risk_flags', type: 'jsonb', nullable: true })
  riskFlags: string[];

  @Column({ name: 'recommended_disbursement_percent', type: 'decimal', precision: 5, scale: 2 })
  recommendedDisbursementPercent: number;

  @Column({ name: 'recommended_amount', type: 'decimal', precision: 18, scale: 2 })
  recommendedAmount: number;

  @Column({ name: 'inspection_report_key', type: 'varchar', length: 500 })
  inspectionReportKey: string;

  @Column({ name: 'photos', type: 'jsonb', nullable: true })
  photos: string[];

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp with time zone', nullable: true })
  approvedAt: Date;

  @Column({ name: 'approval_remarks', type: 'text', nullable: true })
  approvalRemarks: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
