import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  Notification,
  NotificationTemplate,
  NotificationPreference,
  NotificationOptOut,
  NotificationDeliveryLog,
  NotificationChannel,
  NotificationCategory,
  NotificationStatus,
  Priority,
} from '../entities/notification.entity';
import { KafkaService, KAFKA_TOPICS } from '@los/common';
import {
  SendNotificationDto,
  BulkNotificationDto,
  BulkNotificationResponseDto,
  NotificationResponseDto,
  NotificationQueryDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  UpdatePreferenceDto,
  OptOutDto,
  WebhookCallbackDto,
  OTPSendDto,
  OTPVerifyDto,
  NotificationStatsDto,
} from '../dto/notification.dto';
import {
  TemplateEngine,
  SMSProvider,
  EmailProvider,
  WhatsAppProvider,
  PushProvider,
} from '../providers/notification-providers';
import * as crypto from 'crypto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly otpStore = new Map<string, { otp: string; expiresAt: number; purpose: string; attempts: number }>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
    @InjectRepository(NotificationOptOut)
    private readonly optOutRepo: Repository<NotificationOptOut>,
    @InjectRepository(NotificationDeliveryLog)
    private readonly deliveryLogRepo: Repository<NotificationDeliveryLog>,
    private readonly kafkaService: KafkaService,
    private readonly templateEngine: TemplateEngine,
    private readonly smsProvider: SMSProvider,
    private readonly emailProvider: EmailProvider,
    private readonly whatsappProvider: WhatsAppProvider,
    private readonly pushProvider: PushProvider,
  ) {}

  async send(dto: SendNotificationDto): Promise<NotificationResponseDto> {
    const optOut = await this.optOutRepo.findOne({
      where: { recipientId: dto.recipientId, channel: dto.channel, category: dto.category },
    });
    if (optOut) {
      return { notificationId: '', status: NotificationStatus.OPTED_OUT, errorMessage: 'Recipient has opted out' };
    }

    const template = await this.templateRepo.findOne({
      where: { templateName: dto.templateName, channel: dto.channel, isActive: true },
    });
    if (!template) {
      throw new NotFoundException(`Template '${dto.templateName}' not found for channel '${dto.channel}'`);
    }

    const { subject, body } = dto.body
      ? { subject: dto.subject || '', body: dto.body }
      : this.templateEngine.render(template, dto.variables || {}, dto.locale || 'en');

    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        applicationId: dto.applicationId || null,
        userId: dto.userId || null,
        recipientId: dto.recipientId,
        channel: dto.channel,
        category: template.category,
        status: NotificationStatus.QUEUED,
        priority: dto.priority || template.priority,
        templateId: template.id,
        templateName: template.templateName,
        subject: subject || null,
        renderedContent: body,
        rawPayload: dto.variables || null,
        dltTemplateId: template.dltTemplateId || null,
        dltEntityId: template.dltEntityId || null,
        locale: dto.locale || 'en',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        initiatedBy: dto.initiatedBy || null,
        initiatedVia: 'SYSTEM',
      }),
    );

    if (dto.scheduledAt && new Date(dto.scheduledAt) > new Date()) {
      return { notificationId: notification.id, status: NotificationStatus.QUEUED };
    }

    return this.dispatch(notification, body, dto.variables || {});
  }

  private async dispatch(
    notification: Notification,
    body: string,
    variables: Record<string, unknown>,
  ): Promise<NotificationResponseDto> {
    let result;
    switch (notification.channel) {
      case NotificationChannel.SMS:
        result = await this.smsProvider.send(notification.recipientId, notification.subject || '', body, {
          dltTemplateId: notification.dltTemplateId,
          dltEntityId: notification.dltEntityId,
        });
        break;
      case NotificationChannel.EMAIL:
        result = await this.emailProvider.send(notification.recipientId, notification.subject || '', body, {
          isHtml: true,
        });
        break;
      case NotificationChannel.WHATSAPP:
        result = await this.whatsappProvider.send(notification.recipientId, notification.subject || '', body, {
          dltTemplateId: notification.dltTemplateId,
        });
        break;
      case NotificationChannel.PUSH:
        result = await this.pushProvider.send(notification.recipientId, notification.subject || '', body, variables);
        break;
      default:
        result = { success: false, errorCode: 'UNKNOWN_CHANNEL', errorMessage: `Unknown channel: ${notification.channel}` };
    }

    const newStatus = result.success ? NotificationStatus.SENT : NotificationStatus.FAILED;
    await this.notificationRepo.update(notification.id, {
      status: newStatus,
      providerMessageId: result.providerMessageId || null,
      providerResponse: result.rawResponse || null,
      sentAt: result.success ? new Date() : null,
      errorCode: result.errorCode || null,
      errorMessage: result.errorMessage || null,
    });

    if (result.success) {
      await this.deliveryLogRepo.save(
        this.deliveryLogRepo.create({
          notificationId: notification.id,
          status: NotificationStatus.SENT,
          timestamp: new Date(),
        }),
      );
    }

    return {
      notificationId: notification.id,
      status: newStatus,
      providerMessageId: result.providerMessageId,
      renderedContent: body.substring(0, 160),
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    };
  }

  async sendBulk(dto: BulkNotificationDto): Promise<BulkNotificationResponseDto> {
    const results: NotificationResponseDto[] = [];
    for (const recipientId of dto.recipientIds) {
      try {
        const result = await this.send({
          channel: dto.channel,
          recipientId,
          templateName: dto.templateName,
          applicationId: dto.applicationId,
          variables: dto.variables,
          priority: dto.priority,
          locale: 'en',
        });
        results.push(result);
      } catch (err) {
        results.push({
          notificationId: '',
          status: NotificationStatus.FAILED,
          errorMessage: (err as Error).message,
        });
      }
    }

    return {
      totalRequested: dto.recipientIds.length,
      totalQueued: results.filter(r => r.status === NotificationStatus.QUEUED).length,
      totalFailed: results.filter(r => r.status === NotificationStatus.FAILED).length,
      results,
    };
  }

  async sendOTP(dto: OTPSendDto): Promise<{ success: boolean; messageId?: string; expiresAt: Date }> {
    const otp = this.generateOTP();
    const hashedOtp = crypto.createHash('sha256').update(`${otp}:${dto.mobileNumber}`).digest('hex');
    const key = `${dto.mobileNumber}:${dto.purpose}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    this.otpStore.set(key, { otp: hashedOtp, expiresAt: expiresAt.getTime(), purpose: dto.purpose, attempts: 0 });
    this.otpStore.set(`${key}:${hashedOtp}`, { otp: hashedOtp, expiresAt: expiresAt.getTime(), purpose: dto.purpose, attempts: 0 });

    const templateName = 'OTP_NOTIFY';
    const template = await this.templateRepo.findOne({ where: { templateName, channel: NotificationChannel.SMS, isActive: true } });

    let body: string;
    if (template) {
      const rendered = this.templateEngine.render(template, { otp, purpose: dto.purpose }, 'en');
      body = rendered.body;
    } else {
      body = `Your LOS Bank OTP is ${otp}. Valid for 5 minutes. Do not share with anyone. LOS Bank never calls for OTP.`;
    }

    const result = await this.smsProvider.send(dto.mobileNumber, '', body, { dltTemplateId: template?.dltTemplateId });

    if (result.success) {
      await this.kafkaService.emit(KAFKA_TOPICS.NOTIFICATION_OTP_SENT, {
        mobileNumber: dto.mobileNumber.substring(0, 3) + 'XXXXX' + dto.mobileNumber.slice(-2),
        purpose: dto.purpose,
        applicationId: dto.applicationId,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: result.success, messageId: result.providerMessageId, expiresAt };
  }

  async verifyOTP(dto: OTPVerifyDto): Promise<{ valid: boolean; reason?: string }> {
    const key = `${dto.mobileNumber}:${dto.purpose}`;
    const session = this.otpStore.get(key);

    if (!session) {
      return { valid: false, reason: 'OTP expired or not found' };
    }

    if (Date.now() > session.expiresAt) {
      this.otpStore.delete(key);
      return { valid: false, reason: 'OTP has expired' };
    }

    if (session.attempts >= 3) {
      this.otpStore.delete(key);
      return { valid: false, reason: 'Too many attempts. Please request a new OTP.' };
    }

    const hashedInput = crypto.createHash('sha256').update(`${dto.otp}:${dto.mobileNumber}`).digest('hex');
    if (hashedInput !== session.otp) {
      session.attempts++;
      this.otpStore.set(key, session);
      return { valid: false, reason: `Invalid OTP. ${3 - session.attempts} attempts remaining.` };
    }

    this.otpStore.delete(key);
    return { valid: true };
  }

  async createTemplate(dto: CreateTemplateDto): Promise<NotificationTemplate> {
    const existing = await this.templateRepo.findOne({
      where: { templateName: dto.templateName, channel: dto.channel },
    });
    if (existing) {
      throw new BadRequestException(`Template '${dto.templateName}' already exists for channel '${dto.channel}'`);
    }

    return this.templateRepo.save(this.templateRepo.create(dto));
  }

  async updateTemplate(templateName: string, dto: UpdateTemplateDto): Promise<NotificationTemplate> {
    const template = await this.templateRepo.findOne({ where: { templateName } });
    if (!template) {
      throw new NotFoundException(`Template '${templateName}' not found`);
    }

    await this.templateRepo.update(template.id, { ...dto, version: template.version + 1 });
    return this.templateRepo.findOne({ where: { id: template.id } })!;
  }

  async getTemplates(channel?: NotificationChannel, category?: NotificationCategory): Promise<NotificationTemplate[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (channel) where.channel = channel;
    if (category) where.category = category;
    return this.templateRepo.find({ where, order: { displayName: 'ASC' } });
  }

  async getNotificationHistory(query: NotificationQueryDto): Promise<{ notifications: Notification[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (query.applicationId) where.applicationId = query.applicationId;
    if (query.userId) where.userId = query.userId;
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    if (query.fromDate && query.toDate) {
      where.createdAt = Between(new Date(query.fromDate), new Date(query.toDate));
    } else if (query.fromDate) {
      where.createdAt = MoreThanOrEqual(new Date(query.fromDate));
    } else if (query.toDate) {
      where.createdAt = LessThanOrEqual(new Date(query.toDate));
    }

    const [notifications, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { notifications, total };
  }

  async handleWebhook(dto: WebhookCallbackDto): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { providerMessageId: dto.messageId },
    });

    if (!notification) {
      this.logger.warn(`Webhook received for unknown message: ${dto.messageId}`);
      return;
    }

    const statusMap: Record<string, NotificationStatus> = {
      DELIVERED: NotificationStatus.DELIVERED,
      READ: NotificationStatus.READ,
      FAILED: NotificationStatus.FAILED,
      UNDELIVERED: NotificationStatus.UNDELIVERED,
      BOUNCED: NotificationStatus.BOUNCED,
    };

    const newStatus = statusMap[dto.status] || notification.status;

    await this.notificationRepo.update(notification.id, {
      status: newStatus,
      deliveredAt: newStatus === NotificationStatus.DELIVERED ? new Date() : null,
      readAt: newStatus === NotificationStatus.READ ? new Date() : null,
      errorCode: dto.errorCode || null,
      errorMessage: dto.errorMessage || null,
    });

    await this.deliveryLogRepo.save(
      this.deliveryLogRepo.create({
        notificationId: notification.id,
        status: newStatus,
        providerStatusCode: dto.errorCode,
        providerMessage: dto.errorMessage,
        metadata: dto.metadata,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      }),
    );

    await this.kafkaService.emit(KAFKA_TOPICS.NOTIFICATION_STATUS_UPDATED, {
      notificationId: notification.id,
      applicationId: notification.applicationId,
      channel: notification.channel,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });
  }

  async updatePreference(userId: string, dto: UpdatePreferenceDto): Promise<NotificationPreference> {
    let preference = await this.preferenceRepo.findOne({
      where: { userId, channel: dto.channel },
    });

    if (preference) {
      await this.preferenceRepo.update(preference.id, {
        isOptedIn: dto.isOptedIn,
        contactValue: dto.contactValue || preference.contactValue,
        dndEnabled: dto.dndEnabled,
        dndStartTime: dto.dndStartTime,
        dndEndTime: dto.dndEndTime,
        categories: dto.categories,
      });
    } else {
      preference = await this.preferenceRepo.save(
        this.preferenceRepo.create({
          userId,
          channel: dto.channel,
          isOptedIn: dto.isOptedIn,
          contactValue: dto.contactValue || '',
          dndEnabled: dto.dndEnabled || false,
          categories: dto.categories || [],
        }),
      );
    }

    return preference;
  }

  async optOut(recipientId: string, dto: OptOutDto, ipAddress?: string): Promise<void> {
    await this.optOutRepo.save(
      this.optOutRepo.create({
        recipientId,
        channel: dto.channel,
        category: dto.category || null,
        optedOutAt: new Date(),
        source: 'USER_REQUEST',
        ipAddress,
      }),
    );

    await this.kafkaService.emit(KAFKA_TOPICS.NOTIFICATION_OPTOUT, {
      recipientId,
      channel: dto.channel,
      category: dto.category,
      timestamp: new Date().toISOString(),
    });
  }

  async getStats(fromDate?: string, toDate?: string): Promise<NotificationStatsDto> {
    const where: Record<string, unknown> = {};
    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.createdAt = MoreThanOrEqual(new Date(fromDate));
    } else if (toDate) {
      where.createdAt = LessThanOrEqual(new Date(toDate));
    }

    const notifications = await this.notificationRepo.find({ where });

    const totalSent = notifications.filter(n => [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ].includes(n.status)).length;
    const totalDelivered = notifications.filter(n => [NotificationStatus.DELIVERED, NotificationStatus.READ].includes(n.status)).length;
    const totalFailed = notifications.filter(n => [NotificationStatus.FAILED, NotificationStatus.BOUNCED, NotificationStatus.UNDELIVERED].includes(n.status)).length;

    const byChannel: Record<string, { sent: number; delivered: number; failed: number }> = {};
    const byCategory: Record<string, { sent: number; delivered: number; failed: number }> = {};

    for (const n of notifications) {
      const ch = n.channel;
      const cat = n.category;
      if (!byChannel[ch]) byChannel[ch] = { sent: 0, delivered: 0, failed: 0 };
      if (!byCategory[cat]) byCategory[cat] = { sent: 0, delivered: 0, failed: 0 };

      if ([NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.READ].includes(n.status)) {
        byChannel[ch].sent++;
        byCategory[cat].sent++;
      }
      if ([NotificationStatus.DELIVERED, NotificationStatus.READ].includes(n.status)) {
        byChannel[ch].delivered++;
        byCategory[cat].delivered++;
      }
      if ([NotificationStatus.FAILED, NotificationStatus.BOUNCED, NotificationStatus.UNDELIVERED].includes(n.status)) {
        byChannel[ch].failed++;
        byCategory[cat].failed++;
      }
    }

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      byChannel,
      byCategory,
      periodFrom: fromDate ? new Date(fromDate) : undefined,
      periodTo: toDate ? new Date(toDate) : undefined,
    };
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
