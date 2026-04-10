import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationChannel {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
  UNDELIVERED = 'UNDELIVERED',
  OPTED_OUT = 'OPTED_OUT',
}

export enum NotificationCategory {
  OTP = 'OTP',
  APPLICATION_STATUS = 'APPLICATION_STATUS',
  KYC_UPDATE = 'KYC_UPDATE',
  DOCUMENT_REMINDER = 'DOCUMENT_REMINDER',
  DECISION = 'DECISION',
  SANCTION = 'SANCTION',
  DISBURSEMENT = 'DISBURSEMENT',
  EMI_REMINDER = 'EMI_REMINDER',
  PAYMENT_CONFIRMATION = 'PAYMENT_CONFIRMATION',
  GENERAL = 'GENERAL',
  MARKETING = 'MARKETING',
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('notifications')
@Index(['recipientId', 'createdAt'])
@Index(['applicationId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['channel', 'status'])
@Index(['category', 'createdAt'])
@Index(['templateId'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @Column({ name: 'recipient_id', type: 'varchar', length: 100 })
  recipientId: string;

  @Column({ type: 'enum', enum: NotificationChannel, name: 'channel' })
  channel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationCategory, name: 'category' })
  category: NotificationCategory;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.QUEUED })
  status: NotificationStatus;

  @Column({ type: 'enum', enum: Priority, default: Priority.NORMAL })
  priority: Priority;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string;

  @Column({ name: 'template_name', type: 'varchar', length: 50, nullable: true })
  templateName: string;

  @Column({ name: 'subject', type: 'varchar', length: 255, nullable: true })
  subject: string;

  @Column({ name: 'rendered_content', type: 'text', nullable: true })
  renderedContent: string;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown>;

  @Column({ name: 'dlt_template_id', type: 'varchar', length: 30, nullable: true })
  dltTemplateId: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 30, nullable: true })
  dltEntityId: string;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 100, nullable: true })
  providerMessageId: string;

  @Column({ name: 'provider_response', type: 'jsonb', nullable: true })
  providerResponse: Record<string, unknown>;

  @Column({ name: 'error_code', type: 'varchar', length: 30, nullable: true })
  errorCode: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  @Column({ name: 'scheduled_at', type: 'timestamp with time zone', nullable: true })
  scheduledAt: Date;

  @Column({ name: 'sent_at', type: 'timestamp with time zone', nullable: true })
  sentAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamp with time zone', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'read_at', type: 'timestamp with time zone', nullable: true })
  readAt: Date;

  @Column({ name: 'read_at', type: 'timestamp with time zone', nullable: true })
  read_at: Date;

  @Column({ name: 'locale', type: 'varchar', length: 10, default: 'en' })
  locale: string;

  @Column({ name: 'sender_id', type: 'varchar', length: 30, nullable: true })
  senderId: string;

  @Column({ name: 'initiated_by', type: 'uuid', nullable: true })
  initiatedBy: string;

  @Column({ name: 'initiated_via', type: 'varchar', length: 20, default: 'SYSTEM' })
  initiatedVia: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('notification_templates')
@Index(['name', 'channel'], { unique: true })
@Index(['category', 'isActive'])
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_name', type: 'varchar', length: 50, unique: true })
  templateName: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'enum', enum: NotificationCategory, name: 'category' })
  category: NotificationCategory;

  @Column({ type: 'enum', enum: NotificationChannel, name: 'channel' })
  channel: NotificationChannel;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  bodyHi: string;

  @Column({ type: 'text', nullable: true })
  bodyBilingual: string;

  @Column({ name: 'dlt_template_id', type: 'varchar', length: 30, nullable: true })
  dltTemplateId: string;

  @Column({ name: 'dlt_entity_id', type: 'varchar', length: 30, nullable: true })
  dltEntityId: string;

  @Column({ type: 'jsonb', nullable: true })
  variables: NotificationVariable[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'isTransactional', type: 'boolean', default: true })
  isTransactional: boolean;

  @Column({ type: 'enum', enum: Priority, default: Priority.NORMAL })
  priority: Priority;

  @Column({ name: 'min_delay_seconds', type: 'int', default: 0 })
  minDelaySeconds: number;

  @Column({ name: 'max_daily_count', type: 'int', nullable: true })
  maxDailyCount: number;

  @Column({ name: 'rate_limit_per_hour', type: 'int', nullable: true })
  rateLimitPerHour: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

export interface NotificationVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'link';
  required: boolean;
  description?: string;
  example?: string;
  maxLength?: number;
}

@Entity('notification_preferences')
@Index(['userId', 'channel'], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationChannel, name: 'channel' })
  channel: NotificationChannel;

  @Column({ name: 'is_opted_in', type: 'boolean', default: true })
  isOptedIn: boolean;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'contact_value', type: 'varchar', length: 255 })
  contactValue: string;

  @Column({ name: 'dnd_enabled', type: 'boolean', default: false })
  dndEnabled: boolean;

  @Column({ name: 'dnd_start_time', type: 'time', nullable: true })
  dndStartTime: string;

  @Column({ name: 'dnd_end_time', type: 'time', nullable: true })
  dndEndTime: string;

  @Column({ type: 'jsonb', nullable: true })
  categories: NotificationCategory[];

  @Column({ name: 'last_verified_at', type: 'timestamp with time zone', nullable: true })
  lastVerifiedAt: Date;

  @Column({ name: 'last_notified_at', type: 'timestamp with time zone', nullable: true })
  lastNotifiedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('notification_opt_outs')
@Index(['recipientId', 'channel'], { unique: true })
@Index(['recipientId', 'category'])
export class NotificationOptOut {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id', type: 'varchar', length: 100 })
  recipientId: string;

  @Column({ type: 'enum', enum: NotificationChannel, name: 'channel' })
  channel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationCategory, name: 'category', nullable: true })
  category: NotificationCategory;

  @Column({ name: 'opted_out_at', type: 'timestamp with time zone' })
  optedOutAt: Date;

  @Column({ name: 'source', type: 'varchar', length: 30, default: 'USER_REQUEST' })
  source: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}

@Entity('notification_delivery_logs')
@Index(['notificationId', 'timestamp'])
@Index(['providerMessageId'])
export class NotificationDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @Column({ type: 'enum', enum: NotificationStatus, name: 'status' })
  status: NotificationStatus;

  @Column({ name: 'provider_status_code', type: 'varchar', length: 20, nullable: true })
  providerStatusCode: string;

  @Column({ type: 'text', nullable: true })
  providerMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'timestamp', type: 'timestamp with time zone' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
