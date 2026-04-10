import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import { NotificationTemplate } from '../entities/notification.entity';

@Injectable()
export class TemplateEngine {
  private readonly logger = new Logger(TemplateEngine.name);
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();

  constructor(private readonly configService: ConfigService) {
    this.registerHelpers();
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('currency', (amount: number) => {
      if (typeof amount !== 'number') return amount;
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    });

    Handlebars.registerHelper('formatDate', (date: string | Date, format = 'en-IN') => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d);
    });

    Handlebars.registerHelper('formatDateTime', (date: string | Date) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    });

    Handlebars.registerHelper('maskPan', (pan: string) => {
      if (!pan || pan.length < 5) return 'XXXXX';
      return pan.substring(0, 5).toUpperCase() + 'XXXX';
    });

    Handlebars.registerHelper('maskMobile', (mobile: string) => {
      if (!mobile || mobile.length < 10) return 'XXXXXXX';
      return 'XXXXXX' + mobile.slice(-4);
    });

    Handlebars.registerHelper('maskAadhaar', (aadhaar: string) => {
      if (!aadhaar || aadhaar.length < 4) return 'XXXX';
      return 'XXXX-XXXX-' + aadhaar.slice(-4);
    });

    Handlebars.registerHelper('uppercase', (str: string) => {
      return str?.toUpperCase() || '';
    });

    Handlebars.registerHelper('lowercase', (str: string) => {
      return str?.toLowerCase() || '';
    });

    Handlebars.registerHelper('concat', (...args: string[]) => {
      return args.slice(0, -1).join('');
    });

    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    Handlebars.registerHelper('default', (value: unknown, defaultValue: unknown) => {
      return value ?? defaultValue;
    });

    Handlebars.registerHelper('add', (a: number, b: number) => {
      return a + b;
    });

    Handlebars.registerHelper('percent', (value: number, decimals = 2) => {
      if (typeof value !== 'number') return value;
      return value.toFixed(decimals) + '%';
    });
  }

  render(template: NotificationTemplate, variables: Record<string, unknown>, locale = 'en'): { subject: string; body: string } {
    let bodyTemplate = template.body;

    if (locale === 'hi' && template.bodyHi) {
      bodyTemplate = template.bodyHi;
    } else if (locale === 'bilingual' && template.bodyBilingual) {
      bodyTemplate = template.bodyBilingual;
    }

    let subjectTemplate = template.subject;
    if (locale === 'hi' && template.bodyHi) {
      subjectTemplate = ` [HI] ${template.subject}`;
    }

    const compiledBody = this.getCompiledTemplate(`${template.templateName}-body-${locale}`, bodyTemplate);
    const compiledSubject = this.getCompiledTemplate(`${template.templateName}-subject-${locale}`, subjectTemplate || '');

    const safeVariables = this.sanitizeVariables(variables);

    const body = compiledBody(safeVariables);
    const subject = template.channel === 'EMAIL' ? compiledSubject(safeVariables) : body.substring(0, 60);

    return { subject, body };
  }

  renderRaw(body: string, variables: Record<string, unknown>): string {
    const compiled = this.getCompiledTemplate('raw', body);
    return compiled(this.sanitizeVariables(variables));
  }

  private getCompiledTemplate(key: string, source: string): HandlebarsTemplateDelegate {
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const compiled = Handlebars.compile(source, {
        strict: false,
        data: true,
        noEscape: false,
      });
      this.cache.set(key, compiled);
      return compiled;
    } catch (err) {
      this.logger.error(`Template compilation failed for ${key}: ${(err as Error).message}`);
      return Handlebars.compile(source);
    }
  }

  private sanitizeVariables(variables: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (value === null || value === undefined) {
        sanitized[key] = '';
      } else if (typeof value === 'string') {
        sanitized[key] = value.replace(/[<>]/g, '');
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeVariables(value as Record<string, unknown>);
      } else {
        sanitized[key] = String(value);
      }
    }
    return sanitized;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: Record<string, unknown>;
}

export interface DeliveryReport {
  messageId: string;
  status: 'DELIVERED' | 'READ' | 'FAILED' | 'UNDELIVERED' | 'BOUNCED';
  errorCode?: string;
  errorMessage?: string;
  timestamp?: Date;
}

@Injectable()
export abstract class BaseNotificationProvider {
  protected readonly logger: Logger;
  protected readonly providerName: string;

  constructor(providerName: string) {
    this.providerName = providerName;
    this.logger = new Logger(`${BaseNotificationProvider.name}[${providerName}]`);
  }

  abstract send(to: string, subject: string, body: string, metadata?: Record<string, unknown>): Promise<SendResult>;
  abstract getDeliveryStatus(messageId: string): Promise<DeliveryReport>;
  abstract validateRecipient(to: string): boolean;

  protected createError(code: string, message: string): SendResult {
    return { success: false, errorCode: code, errorMessage: message };
  }

  protected createSuccess(messageId: string, rawResponse?: Record<string, unknown>): SendResult {
    return { success: true, providerMessageId: messageId, rawResponse };
  }
}

@Injectable()
export class SMSProvider extends BaseNotificationProvider {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(private readonly configService: ConfigService) {
    super('SMS');
    this.apiUrl = this.configService.get<string>('SMS_API_URL', 'https://api.kaleyra.io/v1/sms');
    this.apiKey = this.configService.get<string>('SMS_API_KEY', '');
    this.senderId = this.configService.get<string>('SMS_SENDER_ID', 'LOSBNK');
  }

  validateRecipient(to: string): boolean {
    return /^[6-9]\d{9}$/.test(to);
  }

  async send(to: string, _subject: string, body: string, metadata?: Record<string, unknown>): Promise<SendResult> {
    if (!this.validateRecipient(to)) {
      return this.createError('INVALID_MOBILE', `Invalid mobile number: ${to}`);
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Message-Max-Len': '1600',
        },
        body: JSON.stringify({
          to: [`91${to}`],
          sender: this.senderId,
          body,
          dlt_template_id: metadata?.dltTemplateId,
          dlt_entity_id: metadata?.dltEntityId,
          unicode: /[\u0900-\u097F]/.test(body) ? 1 : 0,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const error = await response.text();
        return this.createError(`SMS_API_ERROR_${response.status}`, error);
      }

      const data = await response.json() as { id?: string; status?: string; error?: string };
      if (data.error) {
        return this.createError('SMS_PROVIDER_ERROR', data.error);
      }

      return this.createSuccess(data.id || `sms-${Date.now()}`, data as Record<string, unknown>);
    } catch (err) {
      this.logger.error(`SMS send failed: ${(err as Error).message}`);
      return this.createError('SMS_TIMEOUT', (err as Error).message);
    }
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryReport> {
    try {
      const response = await fetch(`${this.apiUrl}/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        return { messageId, status: 'FAILED', errorCode: 'STATUS_CHECK_FAILED' };
      }

      const data = await response.json() as { status?: string };
      return {
        messageId,
        status: this.mapStatus(data.status),
        timestamp: new Date(),
      };
    } catch {
      return { messageId, status: 'UNDELIVERED', errorCode: 'STATUS_CHECK_TIMEOUT' };
    }
  }

  private mapStatus(providerStatus: string): DeliveryReport['status'] {
    const statusMap: Record<string, DeliveryReport['status']> = {
      DELIVERED: 'DELIVERED',
      SENT: 'DELIVERED',
      READ: 'READ',
      FAILED: 'FAILED',
      UNDELIVERED: 'UNDELIVERED',
      REJECTED: 'FAILED',
    };
    return statusMap[providerStatus] || 'UNDELIVERED';
  }
}

@Injectable()
export class EmailProvider extends BaseNotificationProvider {
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser: string;
  private readonly smtpPass: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    super('EMAIL');
    this.smtpHost = this.configService.get<string>('SMTP_HOST', 'smtp.sendgrid.net');
    this.smtpPort = parseInt(this.configService.get<string>('SMTP_PORT', '587') || '587', 10);
    this.smtpUser = this.configService.get<string>('SMTP_USER', '');
    this.smtpPass = this.configService.get<string>('SMTP_PASS', '');
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@losbank.in');
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'LOS Bank');
  }

  validateRecipient(to: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
  }

  async send(to: string, subject: string, body: string, metadata?: Record<string, unknown>): Promise<SendResult> {
    if (!this.validateRecipient(to)) {
      return this.createError('INVALID_EMAIL', `Invalid email address: ${to}`);
    }

    const isHtml = metadata?.isHtml === true;
    const htmlBody = isHtml ? body : this.wrapInHtmlTemplate(subject, body);

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpPort === 465,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        html: htmlBody,
        text: isHtml ? this.stripHtml(body) : body,
      });

      return this.createSuccess(info.messageId, { accepted: info.accepted, rejected: info.rejected });
    } catch (err) {
      this.logger.error(`Email send failed: ${(err as Error).message}`);
      return this.createError('EMAIL_ERROR', (err as Error).message);
    }
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryReport> {
    return { messageId, status: 'DELIVERED', timestamp: new Date() };
  }

  private wrapInHtmlTemplate(subject: string, body: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<div style="background: #003366; color: white; padding: 20px; text-align: center;">
  <h1 style="margin: 0; font-size: 24px;">LOS Bank</h1>
</div>
<div style="padding: 30px 20px; background: #f9f9f9;">
${body.split('\n').map(line => `<p style="margin: 10px 0;">${line}</p>`).join('')}
</div>
<div style="padding: 20px; background: #e0e0e0; font-size: 12px; color: #666; text-align: center;">
  <p>This is an automated message from LOS Bank. Please do not reply.</p>
  <p>If you have queries, contact us at support@losbank.in</p>
</div>
</body></html>`;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
  }
}

@Injectable()
export class WhatsAppProvider extends BaseNotificationProvider {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(private readonly configService: ConfigService) {
    super('WHATSAPP');
    this.apiUrl = this.configService.get<string>('WHATSAPP_API_URL', 'https://api.gupshup.io/partner/sms');
    this.apiKey = this.configService.get<string>('WHATSAPP_API_KEY', '');
    this.senderId = this.configService.get<string>('WHATSAPP_SENDER_ID', 'LOSBANK');
  }

  validateRecipient(to: string): boolean {
    return /^[6-9]\d{9}$/.test(to);
  }

  async send(to: string, _subject: string, body: string, metadata?: Record<string, unknown>): Promise<SendResult> {
    if (!this.validateRecipient(to)) {
      return this.createError('INVALID_MOBILE', `Invalid mobile number: ${to}`);
    }

    try {
      const response = await fetch(`${this.apiUrl}/template/msg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': this.apiKey,
        },
        body: new URLSearchParams({
          channel: 'whatsapp',
          source: this.senderId,
          destination: `91${to}`,
          template: metadata?.dltTemplateId as string || 'default_template',
          'template[params][0]': body,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const error = await response.text();
        return this.createError(`WHATSAPP_API_ERROR_${response.status}`, error);
      }

      const data = await response.json() as { id?: string; status?: string; error?: string };
      if (data.error) {
        return this.createError('WHATSAPP_PROVIDER_ERROR', data.error);
      }

      return this.createSuccess(data.id || `wa-${Date.now()}`, data as Record<string, unknown>);
    } catch (err) {
      this.logger.error(`WhatsApp send failed: ${(err as Error).message}`);
      return this.createError('WHATSAPP_TIMEOUT', (err as Error).message);
    }
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryReport> {
    return { messageId, status: 'DELIVERED', timestamp: new Date() };
  }
}

@Injectable()
export class PushProvider extends BaseNotificationProvider {
  private readonly fcmApiUrl: string;
  private readonly fcmServerKey: string;

  constructor(private readonly configService: ConfigService) {
    super('PUSH');
    this.fcmApiUrl = this.configService.get<string>('FCM_API_URL', 'https://fcm.googleapis.com/fcm/send');
    this.fcmServerKey = this.configService.get<string>('FCM_SERVER_KEY', '');
  }

  validateRecipient(to: string): boolean {
    return to.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(to);
  }

  async send(to: string, title: string, body: string, metadata?: Record<string, unknown>): Promise<SendResult> {
    if (!this.validateRecipient(to)) {
      return this.createError('INVALID_DEVICE_TOKEN', `Invalid FCM token: ${to}`);
    }

    try {
      const fcmPayload = {
        to,
        notification: {
          title,
          body,
          sound: 'default',
          click_action: metadata?.clickAction as string || 'FLUTTER_NOTIFICATION_CLICK',
        },
        data: {
          ...metadata,
          sentAt: new Date().toISOString(),
        },
        priority: 'high',
      };

      const response = await fetch(this.fcmApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${this.fcmServerKey}`,
        },
        body: JSON.stringify(fcmPayload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const error = await response.text();
        return this.createError(`FCM_API_ERROR_${response.status}`, error);
      }

      const data = await response.json() as { success?: number; failure?: number; results?: { error?: string }[] };
      if (data.failure && data.failure > 0 && data.results?.[0]?.error) {
        return this.createError('FCM_PROVIDER_ERROR', data.results[0].error);
      }

      return this.createSuccess(`push-${Date.now()}`, data as Record<string, unknown>);
    } catch (err) {
      this.logger.error(`Push send failed: ${(err as Error).message}`);
      return this.createError('PUSH_TIMEOUT', (err as Error).message);
    }
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryReport> {
    return { messageId, status: 'DELIVERED', timestamp: new Date() };
  }
}
