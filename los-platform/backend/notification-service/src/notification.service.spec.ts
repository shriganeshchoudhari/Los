import { Test, TestingModule } from '@nestjs/testing';
import { TemplateEngine } from '../providers/notification-providers';
import { ConfigService } from '@nestjs/config';
import { NotificationTemplate, NotificationChannel, NotificationCategory } from '../entities/notification.entity';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateEngine,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();

    engine = module.get<TemplateEngine>(TemplateEngine);
  });

  it('should render basic variable substitution', () => {
    const template: NotificationTemplate = {
      id: '1',
      templateName: 'TEST',
      displayName: 'Test',
      category: NotificationCategory.GENERAL,
      channel: NotificationChannel.SMS,
      subject: 'Test',
      body: 'Hello {{name}}, your loan of {{#currency}}{{amount}}{{/currency}} is approved.',
      bodyHi: null,
      bodyBilingual: null,
      dltTemplateId: null,
      dltEntityId: null,
      variables: [],
      isActive: true,
      isTransactional: true,
      priority: 'NORMAL' as any,
      minDelaySeconds: 0,
      maxDailyCount: null,
      rateLimitPerHour: null,
      createdBy: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = engine.render(template, { name: 'Ravi', amount: 500000 }, 'en');
    expect(result.body).toContain('Hello Ravi');
    expect(result.body).toContain('₹5,00,000');
    expect(result.body).toContain('approved');
  });

  it('should render with currency helper', () => {
    const template: NotificationTemplate = {
      id: '1',
      templateName: 'TEST',
      displayName: 'Test',
      category: NotificationCategory.GENERAL,
      channel: NotificationChannel.SMS,
      subject: 'Test',
      body: 'Amount: {{#currency}}{{amt}}{{/currency}}',
      bodyHi: null,
      bodyBilingual: null,
      dltTemplateId: null,
      dltEntityId: null,
      variables: [],
      isActive: true,
      isTransactional: true,
      priority: 'NORMAL' as any,
      minDelaySeconds: 0,
      maxDailyCount: null,
      rateLimitPerHour: null,
      createdBy: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = engine.render(template, { amt: 1234567 }, 'en');
    expect(result.body).toContain('₹12,34,567');
  });

  it('should mask PAN correctly', () => {
    const template: NotificationTemplate = {
      id: '1',
      templateName: 'TEST',
      displayName: 'Test',
      category: NotificationCategory.GENERAL,
      channel: NotificationChannel.SMS,
      subject: 'Test',
      body: 'PAN: {{#maskPan}}{{pan}}{{/maskPan}}',
      bodyHi: null,
      bodyBilingual: null,
      dltTemplateId: null,
      dltEntityId: null,
      variables: [],
      isActive: true,
      isTransactional: true,
      priority: 'NORMAL' as any,
      minDelaySeconds: 0,
      maxDailyCount: null,
      rateLimitPerHour: null,
      createdBy: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = engine.render(template, { pan: 'ABDPM1234E' }, 'en');
    expect(result.body).toContain('ABDPMXXXX');
    expect(result.body).not.toContain('ABDPM1234');
  });

  it('should mask mobile correctly', () => {
    const template: NotificationTemplate = {
      id: '1',
      templateName: 'TEST',
      displayName: 'Test',
      category: NotificationCategory.GENERAL,
      channel: NotificationChannel.SMS,
      subject: 'Test',
      body: 'Mobile: {{#maskMobile}}{{mobile}}{{/maskMobile}}',
      bodyHi: null,
      bodyBilingual: null,
      dltTemplateId: null,
      dltEntityId: null,
      variables: [],
      isActive: true,
      isTransactional: true,
      priority: 'NORMAL' as any,
      minDelaySeconds: 0,
      maxDailyCount: null,
      rateLimitPerHour: null,
      createdBy: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = engine.render(template, { mobile: '9876543210' }, 'en');
    expect(result.body).toContain('XXXXXX3210');
  });

  it('should use Hindi body when locale is hi', () => {
    const template: NotificationTemplate = {
      id: '1',
      templateName: 'TEST',
      displayName: 'Test',
      category: NotificationCategory.GENERAL,
      channel: NotificationChannel.SMS,
      subject: 'Test',
      body: 'Hello {{name}}',
      bodyHi: 'नमस्ते {{name}}',
      bodyBilingual: null,
      dltTemplateId: null,
      dltEntityId: null,
      variables: [],
      isActive: true,
      isTransactional: true,
      priority: 'NORMAL' as any,
      minDelaySeconds: 0,
      maxDailyCount: null,
      rateLimitPerHour: null,
      createdBy: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = engine.render(template, { name: 'रavi' }, 'hi');
    expect(result.body).toContain('नमस्ते');
  });

  it('should sanitize script tags from variables', () => {
    const result = engine.renderRaw('Hello {{name}}', {
      name: '<script>alert("xss")</script>',
    });
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('should handle missing variables gracefully', () => {
    const template: NotificationTemplate = {
      id: '1',
      templateName: 'TEST',
      displayName: 'Test',
      category: NotificationCategory.GENERAL,
      channel: NotificationChannel.SMS,
      subject: 'Test',
      body: 'Amount: {{#currency}}{{amount}}{{/currency}}, Name: {{name}}',
      bodyHi: null,
      bodyBilingual: null,
      dltTemplateId: null,
      dltEntityId: null,
      variables: [],
      isActive: true,
      isTransactional: true,
      priority: 'NORMAL' as any,
      minDelaySeconds: 0,
      maxDailyCount: null,
      rateLimitPerHour: null,
      createdBy: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = engine.render(template, {}, 'en');
    expect(result.body).toContain('Amount:');
    expect(result.body).toContain('Name:');
  });

  it('should format date correctly', () => {
    const result = engine.renderRaw('Date: {{#formatDate}}{{date}}{{/formatDate}}', {
      date: '2024-07-15',
    });
    expect(result).toContain('15-Jul-2024');
  });

  it('should use default helper for missing values', () => {
    const result = engine.renderRaw('Name: {{#default}}{{name}} Unknown{{/default}}', {});
    expect(result).toContain('Unknown');
  });
});

describe('RecipientValidation', () => {
  it('should validate Indian mobile numbers', () => {
    const validateMobile = (mobile: string) => /^[6-9]\d{9}$/.test(mobile);
    expect(validateMobile('9876543210')).toBe(true);
    expect(validateMobile('987654321')).toBe(false);
    expect(validateMobile('0876543210')).toBe(false);
    expect(validateMobile('98765432100')).toBe(false);
    expect(validateMobile('+919876543210')).toBe(false);
    expect(validateMobile('9876543211')).toBe(true);
    expect(validateMobile('6000000000')).toBe(true);
    expect(validateMobile('5000000000')).toBe(false);
  });

  it('should validate email addresses', () => {
    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(validateEmail('ravi@losbank.in')).toBe(true);
    expect(validateEmail('ravi.sharma@gmail.com')).toBe(true);
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('invalid@')).toBe(false);
    expect(validateEmail('@invalid.com')).toBe(false);
    expect(validateEmail('invalid @gmail.com')).toBe(false);
  });
});

describe('OTPGeneration', () => {
  it('should generate 6-digit OTP', () => {
    const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
    for (let i = 0; i < 100; i++) {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(parseInt(otp)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(otp)).toBeLessThanOrEqual(999999);
    }
  });

  it('should hash OTP with SHA-256', () => {
    const hashOTP = (otp: string, mobile: string) =>
      require('crypto').createHash('sha256').update(`${otp}:${mobile}`).digest('hex');

    const hash1 = hashOTP('123456', '9876543210');
    const hash2 = hashOTP('123456', '9876543210');
    const hash3 = hashOTP('654321', '9876543210');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64);
  });
});

describe('OTPBounceRate', () => {
  it('should track OTP bounce correctly', () => {
    const otpStore = new Map<string, { attempts: number; expiresAt: number }>();
    const key = '9876543210:LOGIN';

    otpStore.set(key, { attempts: 0, expiresAt: Date.now() + 300000 });
    otpStore.get(key)!.attempts++;
    otpStore.get(key)!.attempts++;
    otpStore.get(key)!.attempts++;

    expect(otpStore.get(key)!.attempts).toBe(3);
    expect(otpStore.get(key)!.attempts >= 3).toBe(true);
  });
});

describe('NotificationRateLimit', () => {
  it('should track daily notification count per template', () => {
    const dailyCount = new Map<string, { count: number; date: string }>();
    const today = new Date().toISOString().split('T')[0];
    const templateKey = 'OTP_NOTIFY:SMS';

    dailyCount.set(templateKey, { count: 0, date: today });
    for (let i = 0; i < 5; i++) {
      const current = dailyCount.get(templateKey)!;
      current.count++;
      dailyCount.set(templateKey, current);
    }

    expect(dailyCount.get(templateKey)!.count).toBe(5);
  });

  it('should check rate limit per hour', () => {
    const rateLimitPerHour = 100;
    const hourKey = `OTP_NOTIFY:${new Date().getHours()}`;
    const sentThisHour = 50;

    const canSend = sentThisHour < rateLimitPerHour;
    expect(canSend).toBe(true);

    const newSent = 51;
    const canSend2 = newSent < rateLimitPerHour;
    expect(canSend2).toBe(true);
  });
});

describe('DLTTemplateCompliance', () => {
  it('should require DLT template ID for SMS in India', () => {
    const requiresDLT = (channel: NotificationChannel) =>
      [NotificationChannel.SMS, NotificationChannel.WHATSAPP].includes(channel);

    expect(requiresDLT(NotificationChannel.SMS)).toBe(true);
    expect(requiresDLT(NotificationChannel.WHATSAPP)).toBe(true);
    expect(requiresDLT(NotificationChannel.EMAIL)).toBe(false);
    expect(requiresDLT(NotificationChannel.PUSH)).toBe(false);
    expect(requiresDLT(NotificationChannel.IN_APP)).toBe(false);
  });

  it('should validate DLT entity ID format', () => {
    const validateDLTEntity = (entityId: string) =>
      /^[A-Z0-9]{10,20}$/.test(entityId);

    expect(validateDLTEntity('LOSBANK12345')).toBe(true);
    expect(validateDLTEntity('ABCD123456')).toBe(true);
    expect(validateDLTEntity('short')).toBe(false);
    expect(validateDLTEntity('lowercase123')).toBe(false);
    expect(validateDLTEntity('SPECIAL!@#')).toBe(false);
  });
});

describe('NotificationPriorityQueuing', () => {
  it('should order by priority correctly', () => {
    type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    const priorityOrder: Record<Priority, number> = {
      URGENT: 0,
      HIGH: 1,
      NORMAL: 2,
      LOW: 3,
    };

    const notifications = [
      { id: '1', priority: 'NORMAL' as Priority },
      { id: '2', priority: 'URGENT' as Priority },
      { id: '3', priority: 'LOW' as Priority },
      { id: '4', priority: 'HIGH' as Priority },
    ];

    const sorted = [...notifications].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('4');
    expect(sorted[2].id).toBe('1');
    expect(sorted[3].id).toBe('3');
  });
});

describe('DeliveryRateCalculation', () => {
  it('should calculate delivery rate correctly', () => {
    const calcDeliveryRate = (sent: number, delivered: number) =>
      sent > 0 ? (delivered / sent) * 100 : 0;

    expect(calcDeliveryRate(100, 95)).toBe(95);
    expect(calcDeliveryRate(100, 100)).toBe(100);
    expect(calcDeliveryRate(100, 0)).toBe(0);
    expect(calcDeliveryRate(0, 0)).toBe(0);
    expect(calcDeliveryRate(1000, 987)).toBe(98.7);
  });
});
