import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum StoredRuleCategory {
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

export enum StoredRuleSeverity {
  HARD_STOP = 'HARD_STOP',
  SOFT_STOP = 'SOFT_STOP',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

@Entity('rule_definitions')
@Index(['ruleId'], { unique: true })
@Index(['category', 'isActive'])
@Index(['effectiveFrom', 'effectiveTo'])
export class RuleDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rule_id', type: 'varchar', length: 20, unique: true })
  ruleId: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: StoredRuleCategory, name: 'category' })
  category: StoredRuleCategory;

  @Column({ type: 'enum', enum: StoredRuleSeverity, name: 'severity' })
  severity: StoredRuleSeverity;

  @Column({ name: 'version', type: 'varchar', length: 10, default: '1.0' })
  version: string;

  @Column({ type: 'int', default: 50 })
  priority: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: Date;

  @Column({ name: 'loan_types', type: 'jsonb', nullable: true })
  loanTypes: string[];

  @Column({ name: 'channels', type: 'jsonb', nullable: true })
  channels: string[];

  @Column({ type: 'jsonb', name: 'conditions' })
  conditions: any[];

  @Column({ type: 'jsonb', name: 'then_clause' })
  thenClause: any;

  @Column({ type: 'jsonb', name: 'product_overrides', nullable: true })
  productOverrides: any[];

  @Column({ type: 'jsonb', name: 'skip_conditions', nullable: true })
  skipConditions: any[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
