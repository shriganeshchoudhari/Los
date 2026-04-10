import { HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../auth-service/src/app.module';
import { AuthModule } from '../../auth-service/src/auth.module';
import { AuthController } from '../../auth-service/src/controllers/auth.controller';
import { AuthService } from '../../auth-service/src/services/auth.service';
import { User, OtpSession, RefreshToken } from '../../auth-service/src/entities';
import { OtpPurpose } from '@los/common';
import { TestConfig, generateMobile } from '../helpers/test-config';

const cfg = TestConfig.get();

function hashMobile(mobile: string): string {
  return crypto.createHash('sha256').update(mobile).update(mobile).digest('hex');
}

describe('Auth E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let dataSource: DataSource;
  let testUserMobile = generateMobile();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    authService = module.get<AuthService>(AuthService);

    dataSource = new DataSource({
      type: 'postgres',
      host: cfg.DB_HOST,
      port: cfg.DB_PORT,
      username: cfg.DB_USERNAME,
      password: cfg.DB_PASSWORD,
      database: cfg.DB_NAME,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    testUserMobile = generateMobile();
  });

  describe('POST /api/auth/otp/send', () => {
    it('should send OTP to valid mobile and return sessionId', async () => {
      const mobile = testUserMobile;
      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/send')
        .send({ mobile, purpose: OtpPurpose.LOGIN, channel: 'SMS' })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('sessionId');
      expect(res.body).toHaveProperty('expiresIn', 300);
      expect(res.body.maskedMobile).toMatch(/^XXXXX\d{2}$/);
    });

    it('should reject invalid mobile format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/otp/send')
        .send({ mobile: '123', purpose: OtpPurpose.LOGIN, channel: 'SMS' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject missing purpose', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/otp/send')
        .send({ mobile: testUserMobile, channel: 'SMS' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should create OtpSession record in DB after send', async () => {
      const mobile = testUserMobile;
      await request(app.getHttpServer())
        .post('/api/auth/otp/send')
        .send({ mobile, purpose: OtpPurpose.LOGIN, channel: 'SMS' });

      const sessions = await dataSource
        .getRepository(OtpSession)
        .find({ where: { mobileHash: hashMobile(mobile) } });

      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].otpHash).toBeDefined();
      expect(sessions[0].purpose).toBe(OtpPurpose.LOGIN);
      expect(sessions[0].expiresAt).toBeInstanceOf(Date);
    });

    it('should create User record with APPLICANT role on first OTP verification', async () => {
      const mobile = testUserMobile;

      const sendRes = await request(app.getHttpServer())
        .post('/api/auth/otp/send')
        .send({ mobile, purpose: OtpPurpose.LOGIN, channel: 'SMS' })
        .expect(HttpStatus.OK);

      const session = await dataSource
        .getRepository(OtpSession)
        .findOne({ where: { mobileHash: hashMobile(mobile) }, order: { createdAt: 'DESC' } });

      const userRes = await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile, otp: '123456', sessionId: session!.id })
        .expect(HttpStatus.OK);

      expect(userRes.body).toHaveProperty('accessToken');
      expect(userRes.body).toHaveProperty('refreshToken');
      expect(userRes.body.scope).toContain('application:read');

      const user = await dataSource
        .getRepository(User)
        .findOne({ where: { mobileHash: hashMobile(mobile) } });

      expect(user).not.toBeNull();
      expect(user!.mobile).toBe(mobile);
      expect(user!.role).toBe('APPLICANT');
      expect(user!.status).toBe('ACTIVE');
    });
  });

  describe('POST /api/auth/otp/verify — existing user', () => {
    let existingUser: User;
    let existingSession: OtpSession;

    beforeEach(async () => {
      const mobile = testUserMobile;
      const hash = hashMobile(mobile);

      const pwdHash = await bcrypt.hash('testpassword123', 12);

      existingUser = await dataSource.getRepository(User).save({
        mobile,
        mobileHash: hash,
        fullName: 'Test User',
        role: 'LOAN_OFFICER',
        status: 'ACTIVE',
        passwordHash: pwdHash,
      } as User);

      const sessionId = crypto.randomUUID();
      existingSession = await dataSource.getRepository(OtpSession).save({
        id: sessionId,
        mobileHash: hash,
        otpHash: await bcrypt.hash('999999', 10),
        purpose: OtpPurpose.LOGIN,
        attempts: 0,
        expiresAt: new Date(Date.now() + 300000),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as OtpSession);
    });

    it('should return JWT tokens on successful OTP verification', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile: testUserMobile, otp: '999999', sessionId: existingSession.id })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('expiresIn', 900);
      expect(res.body).toHaveProperty('tokenType', 'Bearer');
      expect(res.body).toHaveProperty('scope');
      expect(res.body).toHaveProperty('userId');
      expect(res.body.userId).toBe(existingUser.id);
    });

    it('should mark OTP session as used after successful verification', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile: testUserMobile, otp: '999999', sessionId: existingSession.id });

      const session = await dataSource.getRepository(OtpSession).findOne({
        where: { id: existingSession.id },
      });
      expect(session!.isUsed).toBe(true);
    });

    it('should reject expired session', async () => {
      await dataSource.getRepository(OtpSession).update(existingSession.id, {
        expiresAt: new Date(Date.now() - 60000),
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile: testUserMobile, otp: '999999', sessionId: existingSession.id })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.code).toBe('AUTH_001');
    });

    it('should reject already-used session', async () => {
      await dataSource.getRepository(OtpSession).update(existingSession.id, { isUsed: true });

      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile: testUserMobile, otp: '999999', sessionId: existingSession.id })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.code).toBe('AUTH_001');
    });

    it('should reject wrong OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile: testUserMobile, otp: '000000', sessionId: existingSession.id })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.code).toBe('AUTH_002');
    });

    it('should reject suspended user', async () => {
      await dataSource.getRepository(User).update(existingUser.id, { status: 'SUSPENDED' });

      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile: testUserMobile, otp: '999999', sessionId: existingSession.id })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(res.body.code).toBe('AUTH_003');
    });

    it('should generate correct scopes for BRANCH_MANAGER', async () => {
      await dataSource.getRepository(User).update(existingUser.id, {
        role: 'BRANCH_MANAGER',
        branchCode: 'BR001',
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile: testUserMobile, otp: '999999', sessionId: existingSession.id })
        .expect(HttpStatus.OK);

      const scope = res.body.scope as string[];
      expect(scope).toContain('decision:trigger');
      expect(scope).toContain('decision:override');
      expect(scope).toContain('disbursement:maker');
      expect(scope).toContain('branch:read');
    });

    it('should generate correct scopes for CREDIT_ANALYST', async () => {
      await dataSource.getRepository(User).update(existingUser.id, { role: 'CREDIT_ANALYST' });

      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/verify')
        .send({ mobile: testUserMobile, otp: '999999', sessionId: existingSession.id })
        .expect(HttpStatus.OK);

      const scope = res.body.scope as string[];
      expect(scope).toContain('application:read');
      expect(scope).toContain('decision:trigger');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      const mobile = testUserMobile;
      userId = crypto.randomUUID();
      const hash = hashMobile(mobile);

      await dataSource.getRepository(User).save({
        id: userId,
        mobile,
        mobileHash: hash,
        fullName: 'Refresh Test User',
        role: 'LOAN_OFFICER',
        status: 'ACTIVE',
      } as User);

      const token = crypto.randomBytes(64).toString('hex');
      await dataSource.getRepository(RefreshToken).save({
        id: crypto.randomUUID(),
        userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      refreshToken = token;
    });

    it('should issue new access token from valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('expiresIn', 900);
    });

    it('should revoke old refresh token after use', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken });

      const revoked = await dataSource.getRepository(RefreshToken).findOne({
        where: { token: refreshToken },
      });
      expect(revoked!.revokedAt).toBeInstanceOf(Date);
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-xyz' })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let userId: string;
    let refreshToken: string;

    beforeEach(async () => {
      const mobile = testUserMobile;
      userId = crypto.randomUUID();
      const hash = hashMobile(mobile);

      await dataSource.getRepository(User).save({
        id: userId,
        mobile,
        mobileHash: hash,
        fullName: 'Logout Test User',
        role: 'LOAN_OFFICER',
        status: 'ACTIVE',
      } as User);

      const rt = crypto.randomBytes(64).toString('hex');
      await dataSource.getRepository(RefreshToken).save({
        id: crypto.randomUUID(),
        userId,
        token: rt,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      refreshToken = rt;

      accessToken = crypto.randomBytes(64).toString('base64');
    });

    it('should revoke all sessions on logout', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(HttpStatus.OK);

      const revoked = await dataSource.getRepository(RefreshToken).findOne({
        where: { token: refreshToken },
      });
      expect(revoked!.revokedAt).toBeInstanceOf(Date);
    });

    it('should reject logout without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /api/auth/health', () => {
    it('should return 200 OK', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/health')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('service', 'auth-service');
        });
    });
  });

  describe('Rate limiting', () => {
    it('should rate limit after exceeding OTP send limit', async () => {
      const mobile = testUserMobile;

      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/otp/send')
          .send({ mobile, purpose: OtpPurpose.LOGIN, channel: 'SMS' });
      }

      const res = await request(app.getHttpServer())
        .post('/api/auth/otp/send')
        .send({ mobile, purpose: OtpPurpose.LOGIN, channel: 'SMS' });

      expect(res.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });
});
