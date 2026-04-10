import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditEventCategory {
  APPLICATION = 'APPLICATION',
  KYC = 'KYC',
  DOCUMENT = 'DOCUMENT',
  DECISION = 'DECISION',
  USER = 'USER',
  AUTH = 'AUTH',
  CONFIG = 'CONFIG',
  DISBURSEMENT = 'DISBURSEMENT',
  PDD = 'PDD',
  SYSTEM = 'SYSTEM',
}

export enum AuditEventType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  STATUS_CHANGE = 'STATUS_CHANGE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  DISBURSE = 'DISBURSE',
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  DOCUMENT_REVIEW = 'DOCUMENT_REVIEW',
  KYC_INITIATE = 'KYC_INITIATE',
  KYC_VERIFY = 'KYC_VERIFY',
  OVERRIDE_REQUEST = 'OVERRIDE_REQUEST',
  OVERRIDE_APPROVE = 'OVERRIDE_APPROVE',
  OVERRIDE_REJECT = 'OVERRIDE_REJECT',
  SANCTION_LETTER_GENERATED = 'SANCTION_LETTER_GENERATED',
  PDD_INITIATED = 'PDD_INITIATED',
  PDD_SUBMITTED = 'PDD_SUBMITTED',
  PDD_COMPLETED = 'PDD_COMPLETED',
  PDD_WAIVED = 'PDD_WAIVED',
  PDD_BREACH = 'PDD_BREACH',
  PDD_OVERDUE = 'PDD_OVERDUE',
}

@Entity('audit_logs')
@Index(['entityId', 'timestamp'])
@Index(['actorId', 'timestamp'])
@Index(['eventCategory', 'timestamp'])
@Index(['correlationId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_category', length: 20 })
  eventCategory: AuditEventCategory;

  @Column({ name: 'event_type', length: 60 })
  eventType: AuditEventType;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_role', length: 30, nullable: true })
  actorRole: string | null;

  @Column({ name: 'actor_ip', type: 'inet', nullable: true })
  actorIp: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'entity_type', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'before_state', type: 'text', nullable: true })
  beforeState: string | null;

  @Column({ name: 'after_state', type: 'text', nullable: true })
  afterState: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  correlationId: string | null;

  @Column({ name: 'service_origin', length: 50 })
  serviceOrigin: string;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamptz' })
  timestamp: Date;

  @Column({ name: 'chain_hash', length: 64 })
  chainHash: string;
}
