import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import {
  User,
  OtpSession,
  RefreshToken,
  OtpPurpose,
} from '../entities';
import {
  SendOtpDto,
  VerifyOtpDto,
  SendOtpResponseDto,
  LoginResponseDto,
  RefreshTokenDto,
} from '../dto';
import {
  hashMobile,
  generateOtp,
  hashOtp,
  verifyOtp,
  maskMobile,
  generateIdempotencyKey,
  LOSException,
  createError,
  UserRole,
  getScopesForRole,
} from '@los/common';
import { LdapService } from './ldap.service';

const OTP_TTL_SECONDS = 300;
const MAX_OTP_ATTEMPTS = 3;
const ACCOUNT_LOCK_DURATION_MINUTES = 30;
const MAX_CONCURRENT_SESSIONS = 3;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly redis: Redis;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OtpSession)
    private readonly otpSessionRepository: Repository<OtpSession>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly ldapService: LdapService,
  ) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }

  async sendOtp(dto: SendOtpDto, ipAddress: string, userAgent: string): Promise<SendOtpResponseDto> {
    const mobileHash = hashMobile(dto.mobile);

    const existingUser = await this.userRepository.findOne({
      where: { mobileHash },
    });

    if (existingUser && existingUser.status === 'SUSPENDED') {
      throw createError('AUTH_003', 'Account is suspended');
    }

    if (existingUser && existingUser.lockedUntil && existingUser.lockedUntil > new Date()) {
      const lockRemaining = Math.ceil((existingUser.lockedUntil.getTime() - Date.now()) / 60000);
      throw createError('AUTH_003', `Account locked. Try again in ${lockRemaining} minutes`);
    }

    const rateLimitKey = `otp:ratelimit:${mobileHash}:${dto.purpose}`;
    const rateLimitCount = await this.redis.incr(rateLimitKey);
    
    if (rateLimitCount === 1) {
      await this.redis.expire(rateLimitKey, 3600);
    }

    if (rateLimitCount > 10) {
      throw createError('GEN_003', 'Too many OTP requests. Please try again later');
    }

    const activeSessions = await this.otpSessionRepository.count({
      where: {
        mobileHash,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (activeSessions >= 3) {
      throw createError('GEN_003', 'Maximum OTP sessions reached. Please wait for existing sessions to expire');
    }

    const otp = generateOtp(6);
    const otpHash = await hashOtp(otp);

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    const otpSession = this.otpSessionRepository.create({
      id: sessionId,
      mobileHash,
      otpHash,
      purpose: dto.purpose,
      expiresAt,
      ipAddress,
      userAgent,
    });

    await this.otpSessionRepository.save(otpSession);

    await this.sendOtpViaChannel(otp, dto.mobile, dto.channel || 'SMS');

    this.logger.log(`OTP sent to ${maskMobile(dto.mobile)} for ${dto.purpose}`, {
      sessionId,
      purpose: dto.purpose,
    });

    return {
      sessionId,
      expiresIn: OTP_TTL_SECONDS,
      maskedMobile: maskMobile(dto.mobile),
    };
  }

  async verifyOtp(dto: VerifyOtpDto, ipAddress: string): Promise<LoginResponseDto> {
    const mobileHash = hashMobile(dto.mobile);

    let user = await this.userRepository.findOne({ where: { mobileHash } });

    const otpSession = await this.otpSessionRepository.findOne({
      where: {
        id: dto.sessionId,
        mobileHash,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!otpSession) {
      throw createError('AUTH_001', 'OTP session expired or invalid');
    }

    if (otpSession.attempts >= MAX_OTP_ATTEMPTS) {
      await this.otpSessionRepository.update(otpSession.id, { isUsed: true });
      throw createError('AUTH_002', 'Maximum OTP attempts exceeded');
    }

    const isValid = await verifyOtp(dto.otp, otpSession.otpHash);

    await this.otpSessionRepository.increment({ id: otpSession.id }, 'attempts', 1);

    if (!isValid) {
      if (user) {
        const newAttempts = user.failedLoginAttempts + 1;
        const updates: Partial<User> = { failedLoginAttempts: newAttempts };

        if (newAttempts >= 5) {
          updates.lockedUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000);
          this.logger.warn(`Account locked due to failed attempts`, { userId: user.id });
        }

        await this.userRepository.update(user.id, updates);
      }

      throw createError('AUTH_002', 'Invalid OTP');
    }

    await this.otpSessionRepository.update(otpSession.id, { isUsed: true });

    if (!user) {
      user = await this.createUser(mobileHash, dto.mobile);
    }

    if (user.lockedUntil) {
      await this.userRepository.update(user.id, {
        lockedUntil: null,
        failedLoginAttempts: 0,
      });
    }

    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
    });

    const tokens = await this.issueTokens(user, dto.deviceFingerprint);

    this.logger.log(`User ${user.id} authenticated successfully`, {
      purpose: otpSession.purpose,
    });

    return tokens;
  }

  async refreshToken(dto: RefreshTokenDto): Promise<LoginResponseDto> {
    const hashedToken = await bcrypt.hash(dto.refreshToken, 10);

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: {
        tokenHash: hashedToken,
        revokedAt: null,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!refreshToken) {
      throw createError('AUTH_005', 'Invalid or expired refresh token');
    }

    const tokens = await this.issueTokens(refreshToken.user, refreshToken.deviceFingerprint);

    await this.refreshTokenRepository.update(refreshToken.id, { revokedAt: new Date() });

    return tokens;
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: null },
      { revokedAt: new Date() }
    );

    await this.redis.del(`session:${sessionId}`);

    this.logger.log(`User ${userId} logged out`, { sessionId });
  }

  async ldapLogin(
    username: string,
    password: string,
    deviceFingerprint?: string,
  ): Promise<LoginResponseDto> {
    const ldapResult = await this.ldapService.authenticate(username, password);

    if (!ldapResult.success || !ldapResult.user) {
      throw createError('AUTH_006', ldapResult.error || 'LDAP authentication failed');
    }

    const role = this.mapTitleToRole(ldapResult.user.title);
    const user = await this.ldapService.syncLdapUserToDatabase(ldapResult.user, role);

    if (user.status === 'INACTIVE') {
      throw createError('AUTH_007', 'Account is inactive');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw createError('AUTH_008', 'Account is locked');
    }

    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
    });

    const tokens = await this.issueTokens(user, deviceFingerprint);
    this.logger.log(`LDAP user ${username} authenticated successfully as ${role}`, {
      userId: user.id,
      employeeId: ldapResult.user.employeeID,
    });

    return tokens;
  }

  private mapTitleToRole(title?: string): UserRole {
    if (!title) return UserRole.LOAN_OFFICER;

    const titleLower = title.toLowerCase();

    if (titleLower.includes('branch manager') || titleLower.includes('bm')) {
      return UserRole.BRANCH_MANAGER;
    }
    if (titleLower.includes('zonal') || titleLower.includes('regional')) {
      return UserRole.ZONAL_CREDIT_HEAD;
    }
    if (titleLower.includes('credit analyst') || titleLower.includes('underwriter')) {
      return UserRole.CREDIT_ANALYST;
    }
    if (titleLower.includes('compliance') || titleLower.includes('audit')) {
      return UserRole.COMPLIANCE_OFFICER;
    }
    if (titleLower.includes('loan officer') || titleLower.includes('relationship manager')) {
      return UserRole.LOAN_OFFICER;
    }

    return UserRole.LOAN_OFFICER;
  }

  async revokeToken(token: string, reason: string): Promise<void> {
    const payload = this.jwtService.decode(token) as any;
    if (!payload) {
      throw createError('AUTH_005', 'Invalid token');
    }

    const expiry = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 86400 * 7;
    const key = `revoked:${payload.jti || payload.sub}`;

    await this.redis.setex(key, Math.max(60, expiry), JSON.stringify({ reason, revokedAt: new Date().toISOString() }));

    this.logger.log(`Token revoked: ${payload.jti || payload.sub}`, { reason });
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    const key = `revoked:${jti}`;
    const result = await this.redis.get(key);
    return result !== null;
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const refreshTokens = await this.refreshTokenRepository.find({
      where: { userId, revokedAt: null },
    });

    let count = 0;
    for (const token of refreshTokens) {
      if (exceptSessionId && token.id === exceptSessionId) continue;
      await this.revokeToken(token.tokenHash, 'All sessions revoked');
      count++;
    }

    return count;
  }

  private async createUser(mobileHash: string, mobile: string): Promise<User> {
    const user = this.userRepository.create({
      mobile,
      mobileHash,
      fullName: 'New User',
      role: UserRole.APPLICANT,
      status: 'ACTIVE',
    });

    return this.userRepository.save(user);
  }

  private async issueTokens(user: User, deviceFingerprint?: string): Promise<LoginResponseDto> {
    const sessionId = uuidv4();
    const jti = uuidv4();

    const payload = {
      sub: user.id,
      role: user.role,
      branchCode: user.branchCode,
      sessionId,
      jti,
      scope: this.getScopesForRole(user.role),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshTokenValue = generateIdempotencyKey();
    const refreshTokenHash = await bcrypt.hash(refreshTokenValue, 10);

    const refreshToken = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: refreshTokenHash,
      deviceFingerprint,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.refreshTokenRepository.save(refreshToken);

    await this.redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60,
      JSON.stringify({ userId: user.id, jti, role: user.role })
    );

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      tokenType: 'Bearer',
      expiresIn: 900,
      scope: payload.scope,
    };
  }

  private getScopesForRole(role: string): string[] {
    return getScopesForRole(role as UserRole);
  }

  private async sendOtpViaChannel(otp: string, mobile: string, channel: 'SMS' | 'WHATSAPP'): Promise<void> {
    try {
      if (channel === 'SMS') {
        await this.sendSms(mobile, `Your LOS verification code is ${otp}. Valid for 5 minutes. Do not share.`);
      } else {
        await this.sendWhatsApp(mobile, otp);
      }
    } catch (error) {
      this.logger.error(`Failed to send OTP via ${channel}`, { error: error.message });
      throw createError('GEN_002', 'Failed to send OTP. Please try again');
    }
  }

  private async sendSms(mobile: string, message: string): Promise<void> {
    const smsApiKey = this.configService.get<string>('SMS_API_KEY');
    const senderId = this.configService.get<string>('SMS_SENDER_ID');

    const response = await fetch('https://api.kaleyra.io/v1/HXIN17452HS142HS/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': smsApiKey || '',
      },
      body: JSON.stringify({
        to: mobile,
        from: senderId,
        type: 'OTP',
        body: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMS API error: ${response.status}`);
    }
  }

  private async sendWhatsApp(mobile: string, otp: string): Promise<void> {
    const gupshupApiKey = this.configService.get<string>('GUPSHUP_API_KEY');

    const response = await fetch(
      `https://api.gupshup.io/smsexpress/v1/otp/send?apikey=${gupshupApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          channel: 'whatsapp',
          phone: `91${mobile}`,
          'template_id': 'otp_verification',
          'vars': JSON.stringify({ '#VAR1#': otp }),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }
  }
}
