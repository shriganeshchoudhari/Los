import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuthService } from '../services/auth.service';
import { User, OtpSession, RefreshToken, OtpPurpose } from '../entities';
import { SendOtpDto, VerifyOtpDto } from '../dto';
import { createError, hashMobile } from '@los/common';
import { JwtKeyManager } from '../utils/jwt-key-manager';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let otpSessionRepository: jest.Mocked<Repository<OtpSession>>;
  let refreshTokenRepository: jest.Mocked<Repository<RefreshToken>>;
  let configService: jest.Mocked<ConfigService>;

  const mockRedis = {
    incr: jest.fn(),
    expire: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            increment: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OtpSession),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            increment: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtKeyManager,
          useValue: new JwtKeyManager(),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
              const config: Record<string, any> = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                SMS_API_KEY: 'test-api-key',
                SMS_SENDER_ID: 'LOSBNK',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    
    userRepository = module.get(getRepositoryToken(User));
    otpSessionRepository = module.get(getRepositoryToken(OtpSession));
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    configService = module.get(ConfigService);

    (service as any).redis = mockRedis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOtp', () => {
    const sendOtpDto: SendOtpDto = {
      mobile: '9876543210',
      purpose: OtpPurpose.LOGIN,
      channel: 'SMS',
    };

    it('should send OTP successfully for new user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      otpSessionRepository.count.mockResolvedValue(0);
      otpSessionRepository.create.mockReturnValue({
        id: 'session-id',
        mobileHash: hashMobile(sendOtpDto.mobile),
        otpHash: 'hashed-otp',
        purpose: OtpPurpose.LOGIN,
      } as OtpSession);
      otpSessionRepository.save.mockResolvedValue({} as OtpSession);

      const result = await service.sendOtp(sendOtpDto, '127.0.0.1', 'test-agent');

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('expiresIn', 300);
      expect(result.maskedMobile).toBe('XXXXXX3210');
      expect(otpSessionRepository.save).toHaveBeenCalled();
    });

    it('should reject suspended users', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-id',
        status: 'SUSPENDED',
        mobileHash: hashMobile(sendOtpDto.mobile),
      } as User);

      await expect(service.sendOtp(sendOtpDto, '127.0.0.1', 'test-agent'))
        .rejects.toMatchObject({
          code: 'AUTH_003',
        });
    });

    it('should reject locked accounts', async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000);
      userRepository.findOne.mockResolvedValue({
        id: 'user-id',
        status: 'ACTIVE',
        lockedUntil: futureDate,
        mobileHash: hashMobile(sendOtpDto.mobile),
      } as User);

      await expect(service.sendOtp(sendOtpDto, '127.0.0.1', 'test-agent'))
        .rejects.toMatchObject({
          code: 'AUTH_003',
        });
    });

    it('should enforce rate limiting', async () => {
      userRepository.findOne.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(11);

      await expect(service.sendOtp(sendOtpDto, '127.0.0.1', 'test-agent'))
        .rejects.toMatchObject({
          code: 'GEN_003',
        });
    });

    it('should limit concurrent OTP sessions', async () => {
      userRepository.findOne.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);
      otpSessionRepository.count.mockResolvedValue(3);

      await expect(service.sendOtp(sendOtpDto, '127.0.0.1', 'test-agent'))
        .rejects.toMatchObject({
          code: 'GEN_003',
        });
    });
  });

  describe('verifyOtp', () => {
    const verifyOtpDto: VerifyOtpDto = {
      mobile: '9876543210',
      otp: '123456',
      sessionId: 'session-id',
    };

    it('should verify OTP and create user for new mobile', async () => {
      userRepository.findOne.mockResolvedValue(null);
      otpSessionRepository.findOne.mockResolvedValue({
        id: verifyOtpDto.sessionId,
        mobileHash: hashMobile(verifyOtpDto.mobile),
        otpHash: await bcrypt.hash('123456', 10),
        attempts: 0,
        isUsed: false,
        expiresAt: new Date(Date.now() + 300000),
      } as OtpSession);
      otpSessionRepository.update.mockResolvedValue({} as any);
      userRepository.create.mockReturnValue({
        id: 'new-user-id',
        mobile: verifyOtpDto.mobile,
        role: 'APPLICANT',
        status: 'ACTIVE',
      } as User);
      userRepository.save.mockResolvedValue({
        id: 'new-user-id',
        mobile: verifyOtpDto.mobile,
        role: 'APPLICANT',
        status: 'ACTIVE',
        mobileHash: hashMobile(verifyOtpDto.mobile),
      } as User);
      refreshTokenRepository.create.mockReturnValue({} as RefreshToken);
      refreshTokenRepository.save.mockResolvedValue({} as RefreshToken);

      const result = await service.verifyOtp(verifyOtpDto, '127.0.0.1');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(900);
    });

    it('should reject expired OTP session', async () => {
      otpSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyOtp(verifyOtpDto, '127.0.0.1'))
        .rejects.toMatchObject({
          code: 'AUTH_001',
        });
    });

    it('should reject after max attempts', async () => {
      otpSessionRepository.findOne.mockResolvedValue({
        id: verifyOtpDto.sessionId,
        mobileHash: hashMobile(verifyOtpDto.mobile),
        attempts: 3,
        isUsed: false,
        expiresAt: new Date(Date.now() + 300000),
      } as OtpSession);
      otpSessionRepository.update.mockResolvedValue({} as any);

      await expect(service.verifyOtp(verifyOtpDto, '127.0.0.1'))
        .rejects.toMatchObject({
          code: 'AUTH_002',
        });
    });

    it('should lock account after 5 failed OTP verifications', async () => {
      const hashedOtp = await bcrypt.hash('wrong-otp', 10);
      otpSessionRepository.findOne.mockResolvedValue({
        id: verifyOtpDto.sessionId,
        mobileHash: hashMobile(verifyOtpDto.mobile),
        otpHash: hashedOtp,
        attempts: 0,
        isUsed: false,
        expiresAt: new Date(Date.now() + 300000),
      } as OtpSession);
      userRepository.findOne.mockResolvedValue({
        id: 'user-id',
        mobileHash: hashMobile(verifyOtpDto.mobile),
        failedLoginAttempts: 4,
      } as User);
      userRepository.update.mockResolvedValue({} as any);
      otpSessionRepository.increment.mockResolvedValue({} as any);

      await expect(service.verifyOtp({ ...verifyOtpDto, otp: '000000' }, '127.0.0.1'))
        .rejects.toMatchObject({
          code: 'AUTH_002',
        });

      expect(userRepository.update).toHaveBeenCalledWith('user-id', expect.objectContaining({
        failedLoginAttempts: 5,
        lockedUntil: expect.any(Date),
      }));
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens and clear session', async () => {
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRedis.del.mockResolvedValue(1);

      await service.logout('user-id', 'session-id');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 'user-id', revokedAt: null },
        { revokedAt: expect.any(Date) }
      );
      expect(mockRedis.del).toHaveBeenCalledWith('session:session-id');
    });
  });

  describe('scope generation', () => {
    it('should generate correct scopes for APPLICANT role', async () => {
      const user = {
        id: 'user-id',
        role: 'APPLICANT' as const,
        mobileHash: 'hash',
        failedLoginAttempts: 0,
      };
      
      userRepository.findOne.mockResolvedValue(null);
      otpSessionRepository.findOne.mockResolvedValue({
        id: 'session',
        mobileHash: hashMobile('9876543210'),
        otpHash: await bcrypt.hash('123456', 10),
        attempts: 0,
        expiresAt: new Date(Date.now() + 300000),
      } as OtpSession);
      otpSessionRepository.update.mockResolvedValue({} as any);
      userRepository.create.mockReturnValue(user as User);
      userRepository.save.mockResolvedValue(user as User);
      refreshTokenRepository.create.mockReturnValue({} as RefreshToken);
      refreshTokenRepository.save.mockResolvedValue({} as RefreshToken);

      const result = await service.verifyOtp({
        mobile: '9876543210',
        otp: '123456',
        sessionId: 'session',
      }, '127.0.0.1');

      expect(result.scope).toContain('application:read');
      expect(result.scope).toContain('application:write');
    });

    it('should generate correct scopes for BRANCH_MANAGER role', async () => {
      const user = {
        id: 'user-id',
        role: 'BRANCH_MANAGER' as const,
        branchCode: 'MH001',
        mobileHash: 'hash',
        failedLoginAttempts: 0,
      };
      
      userRepository.findOne.mockResolvedValue(null);
      otpSessionRepository.findOne.mockResolvedValue({
        id: 'session',
        mobileHash: hashMobile('9876543210'),
        otpHash: await bcrypt.hash('123456', 10),
        attempts: 0,
        expiresAt: new Date(Date.now() + 300000),
      } as OtpSession);
      otpSessionRepository.update.mockResolvedValue({} as any);
      userRepository.create.mockReturnValue({ ...user, mobile: '9876543210' } as User);
      userRepository.save.mockResolvedValue({ ...user, mobile: '9876543210', mobileHash: hashMobile('9876543210') } as User);
      refreshTokenRepository.create.mockReturnValue({} as RefreshToken);
      refreshTokenRepository.save.mockResolvedValue({} as RefreshToken);

      const result = await service.verifyOtp({
        mobile: '9876543210',
        otp: '123456',
        sessionId: 'session',
      }, '127.0.0.1');

      expect(result.scope).toContain('decision:trigger');
      expect(result.scope).toContain('decision:override');
      expect(result.scope).toContain('disbursement:maker');
    });
  });
});
