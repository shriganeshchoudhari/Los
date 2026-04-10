import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsBoolean,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationChannel,
  NotificationCategory,
  NotificationStatus,
  Priority,
  NotificationVariable,
} from '../entities/notification.entity';

export class SendNotificationDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Mobile number (10 digits) or email or device token' })
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({ description: 'Template name (e.g., OTP_NOTIFY, LOAN_APPROVED)' })
  @IsString()
  @IsNotEmpty()
  templateName: string;

  @ApiPropertyOptional({ description: 'Application ID for linking' })
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional({ description: 'User ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  variables: Record<string, unknown>;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Schedule for future delivery (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: 'Override subject for email' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Override body content' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  initiatedBy?: string;
}

export class BulkNotificationDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  recipientIds: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateName: string;

  @ApiPropertyOptional()
  @IsOptional()
  variables: Record<string, unknown>;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string;
}

export class NotificationResponseDto {
  @ApiProperty()
  notificationId: string;

  @ApiProperty({ enum: NotificationStatus })
  status: NotificationStatus;

  @ApiPropertyOptional()
  providerMessageId?: string;

  @ApiPropertyOptional()
  renderedContent?: string;

  @ApiPropertyOptional()
  errorCode?: string;

  @ApiPropertyOptional()
  errorMessage?: string;
}

export class BulkNotificationResponseDto {
  @ApiProperty()
  totalRequested: number;

  @ApiProperty()
  totalQueued: number;

  @ApiProperty()
  totalFailed: number;

  @ApiProperty({ type: [NotificationResponseDto] })
  results: NotificationResponseDto[];
}

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ description: 'Hindi version of body' })
  @IsOptional()
  @IsString()
  bodyHi?: string;

  @ApiPropertyOptional({ description: 'Bilingual (Hindi + English) version' })
  @IsOptional()
  @IsString()
  bodyBilingual?: string;

  @ApiPropertyOptional({ description: 'TRAI DLT template ID for SMS/WhatsApp' })
  @IsOptional()
  @IsString()
  dltTemplateId?: string;

  @ApiPropertyOptional({ description: 'TRAI DLT entity ID' })
  @IsOptional()
  @IsString()
  dltEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  variables?: NotificationVariable[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isTransactional?: boolean;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minDelaySeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDailyCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitPerHour?: number;
}

export class UpdateTemplateDto extends CreateTemplateDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class NotificationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ enum: NotificationCategory })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class UpdatePreferenceDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty()
  @IsBoolean()
  isOptedIn: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dndEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dndStartTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dndEndTime?: string;

  @ApiPropertyOptional({ type: [String], enum: NotificationCategory })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationCategory, { each: true })
  categories?: NotificationCategory[];
}

export class OptOutDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationCategory, description: 'Category to opt out from (empty = all)' })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class WebhookCallbackDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty()
  @IsString()
  @IsEnum(['DELIVERED', 'READ', 'FAILED', 'UNDELIVERED', 'BOUNCED'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class OTPSendDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mobileNumber: string;

  @ApiProperty({ enum: ['LOGIN', 'CONSENT', 'eSign', 'LOAN_AGREEMENT', 'BUREAU_CONSENT'] })
  @IsEnum(['LOGIN', 'CONSENT', 'eSign', 'LOAN_AGREEMENT', 'BUREAU_CONSENT'])
  purpose: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class OTPVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mobileNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string;
}

export class NotificationStatsDto {
  @ApiProperty()
  totalSent: number;

  @ApiProperty()
  totalDelivered: number;

  @ApiProperty()
  totalFailed: number;

  @ApiProperty()
  deliveryRate: number;

  @ApiProperty()
  byChannel: Record<string, { sent: number; delivered: number; failed: number }>;

  @ApiProperty()
  byCategory: Record<string, { sent: number; delivered: number; failed: number }>;

  @ApiPropertyOptional()
  periodFrom?: Date;

  @ApiPropertyOptional()
  periodTo?: Date;
}
