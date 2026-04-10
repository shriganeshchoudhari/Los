import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum PddStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  WAIVED = 'WAIVED',
  BREACHED = 'BREACHED',
}

export enum PddCategory {
  DOCUMENT = 'DOCUMENT',
  CONDITION = 'CONDITION',
  INSURANCE = 'INSURANCE',
  VALUATION = 'VALUATION',
  LEGAL = 'LEGAL',
  TECHNICAL = 'TECHNICAL',
}

@Entity('pdd_checklists')
@Index(['applicationId', 'status'])
@Index(['dueDate'])
export class PddChecklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'loan_account_number', length: 30, nullable: true })
  loanAccountNumber: string | null;

  @Column({ name: 'disbursement_date', type: 'date' })
  disbursementDate: Date;

  @Column({ name: 'initiation_date', type: 'date' })
  initiationDate: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'extended_due_date', type: 'date', nullable: true })
  extendedDueDate: Date | null;

  @Column({ length: 20, default: PddStatus.PENDING })
  status: PddStatus;

  @Column({ name: 'total_items', type: 'smallint', default: 0 })
  totalItems: number;

  @Column({ name: 'completed_items', type: 'smallint', default: 0 })
  completedItems: number;

  @Column({ name: 'verified_items', type: 'smallint', default: 0 })
  verifiedItems: number;

  @Column({ name: 'overdue_days', type: 'smallint', default: 0 })
  overdueDays: number;

  @Column({ name: 'initiated_by', type: 'uuid', nullable: true })
  initiatedBy: string | null;

  @Column({ name: 'completion_date', type: 'date', nullable: true })
  completionDate: Date | null;

  @Column({ name: 'waived_by', type: 'uuid', nullable: true })
  waivedBy: string | null;

  @Column({ name: 'waiver_reason', type: 'text', nullable: true })
  waiverReason: string | null;

  @Column({ name: 'waived_at', type: 'timestamptz', nullable: true })
  waivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('pdd_checklist_items')
@Index(['checklistId', 'status'])
export class PddChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'checklist_id', type: 'uuid' })
  checklistId: string;

  @ManyToOne(() => PddChecklist)
  @JoinColumn({ name: 'checklist_id' })
  checklist: PddChecklist;

  @Column({ length: 20 })
  category: PddCategory;

  @Column({ name: 'item_code', length: 30 })
  itemCode: string;

  @Column({ name: 'item_description', type: 'text' })
  itemDescription: string;

  @Column({ length: 20, default: PddStatus.PENDING })
  status: PddStatus;

  @Column({ name: 'is_mandatory', default: true })
  isMandatory: boolean;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'submitted_date', type: 'date', nullable: true })
  submittedDate: Date | null;

  @Column({ name: 'verified_date', type: 'date', nullable: true })
  verifiedDate: Date | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'document_ref_id', type: 'uuid', nullable: true })
  documentRefId: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
