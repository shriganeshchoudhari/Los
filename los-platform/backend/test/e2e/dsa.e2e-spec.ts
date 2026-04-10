import { HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule as DsaAppModule } from '../../dsa-service/src/app.module';
import { AppModule as AuthAppModule } from '../../auth-service/src/app.module';
import { AppModule as LoanAppModule } from '../../loan-service/src/app.module';
import { AppModule as DecisionAppModule } from '../../decision-engine/src/app.module';
import { DSAPartner, DSAOfficer, DSAApplication, DSAPartnerStatus } from '../../dsa-service/src/entities/dsa.entity';
import { User, OtpSession } from '../../auth-service/src/entities';
import { LoanApplication } from '../../loan-service/src/entities';
import { OtpPurpose } from '@los/common';
import { TestConfig, generateMobile, generatePAN } from '../helpers/test-config';

const cfg = TestConfig.get();

function hashMobile(mobile: string): string {
  return crypto.createHash('sha256').update(mobile).update(mobile).digest('hex');
}

function hashPan(pan: string): string {
  return crypto.createHash('sha256').update(pan.toUpperCase()).digest('hex');
}

async function createAuthenticatedBankUser(
  app: INestApplication,
  dataSource: DataSource,
  role: string = 'LOAN_OFFICER',
): Promise<{ accessToken: string; userId: string }> {
  const mobile = generateMobile();
  const userId = crypto.randomUUID();
  const hash = hashMobile(mobile);

  await dataSource.getRepository(User).save({
    id: userId,
    mobile,
    mobileHash: hash,
    fullName: `Test ${role}`,
    role,
    status: 'ACTIVE',
    branchCode: 'BR001',
  } as User);

  const sessionId = crypto.randomUUID();
  const bcrypt = require('bcrypt');
  const otpHash = await bcrypt.hash('999999', 10);

  await dataSource.getRepository(OtpSession).save({
    id: sessionId,
    mobileHash: hash,
    otpHash,
    purpose: OtpPurpose.LOGIN,
    attempts: 0,
    expiresAt: new Date(Date.now() + 300000),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as OtpSession);

  const res = await request(app.getHttpServer())
    .post('/api/auth/otp/verify')
    .send({ mobile, otp: '999999', sessionId });

  return { accessToken: res.body.accessToken, userId };
}

describe('DSA Portal E2E', () => {
  let dsaApp: INestApplication;
  let authApp: INestApplication;
  let loanApp: INestApplication;
  let dsaDataSource: DataSource;
  let loanDataSource: DataSource;

  beforeAll(async () => {
    const dsaModule: TestingModule = await Test.createTestingModule({
      imports: [DsaAppModule],
    }).compile();

    const authModule: TestingModule = await Test.createTestingModule({
      imports: [AuthAppModule],
    }).compile();

    const loanModule: TestingModule = await Test.createTestingModule({
      imports: [LoanAppModule],
    }).compile();

    dsaApp = dsaModule.createNestApplication();
    authApp = authModule.createNestApplication();
    loanApp = loanModule.createNestApplication();

    const apps: INestApplication[] = [dsaApp, authApp, loanApp];
    for (const a of apps) {
      a.setGlobalPrefix('api');
      a.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    }

    await Promise.all(apps.map(a => a.init()));

    dsaDataSource = new DataSource({
      type: 'postgres',
      host: cfg.DB_HOST,
      port: cfg.DB_PORT,
      username: cfg.DB_USERNAME,
      password: cfg.DB_PASSWORD,
      database: cfg.DB_NAME,
    });
    loanDataSource = new DataSource({
      type: 'postgres',
      host: cfg.DB_HOST,
      port: cfg.DB_PORT,
      username: cfg.DB_USERNAME,
      password: cfg.DB_PASSWORD,
      database: cfg.DB_NAME,
    });
    await Promise.all([dsaDataSource.initialize(), loanDataSource.initialize()]);
  });

  afterAll(async () => {
    await Promise.all([dsaDataSource.destroy(), loanDataSource.destroy()]);
    await Promise.all([dsaApp.close(), authApp.close(), loanApp.close()]);
  });

  describe('DSA Partner Registration', () => {
    it('should register a new DSA partner', async () => {
      const partnerCode = `DSA${Date.now()}`;
      const mobile = generateMobile();
      const pan = generatePAN();

      const res = await request(dsaApp.getHttpServer())
        .post('/api/auth/register')
        .send({
          companyName: 'Test Solutions Pvt Ltd',
          partnerType: 'PRIVATE_LIMITED',
          pan,
          email: `test${Date.now()}@example.com`,
          mobile,
          gstin: '27AAACH1234P1Z5',
          address: {
            line1: '123 Test Street',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
          },
          contactPersonName: 'Test Contact',
          contactPersonMobile: mobile,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('partnerId');
      expect(res.body).toHaveProperty('partnerCode');
      expect(res.body.status).toBe(DSAPartnerStatus.PENDING_APPROVAL);
      expect(res.body.message).toContain('pending approval');
    });

    it('should reject duplicate PAN registration', async () => {
      const pan = generatePAN();
      const mobile = generateMobile();

      await request(dsaApp.getHttpServer())
        .post('/api/auth/register')
        .send({
          companyName: 'First Company',
          partnerType: 'PROPRIETORSHIP',
          pan,
          email: `first${Date.now()}@example.com`,
          mobile,
          contactPersonName: 'Test',
          contactPersonMobile: mobile,
        })
        .expect(HttpStatus.CREATED);

      const res = await request(dsaApp.getHttpServer())
        .post('/api/auth/register')
        .send({
          companyName: 'Second Company',
          partnerType: 'PROPRIETORSHIP',
          pan,
          email: `second${Date.now()}@example.com`,
          mobile: generateMobile(),
          contactPersonName: 'Test',
          contactPersonMobile: mobile,
        })
        .expect(HttpStatus.CONFLICT);
    });

    it('should reject registration with invalid GSTIN format', async () => {
      await request(dsaApp.getHttpServer())
        .post('/api/auth/register')
        .send({
          companyName: 'Bad GSTIN Company',
          partnerType: 'PRIVATE_LIMITED',
          pan: generatePAN(),
          email: `gstin${Date.now()}@example.com`,
          mobile: generateMobile(),
          gstin: 'INVALID123',
          contactPersonName: 'Test',
          contactPersonMobile: generateMobile(),
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('DSA Partner Approval Flow', () => {
    let partnerId: string;
    let partnerAccessToken: string;

    beforeEach(async () => {
      const mobile = generateMobile();
      const pan = generatePAN();

      const bcrypt = require('bcrypt');
      const pwdHash = await bcrypt.hash('TestPassword123!', 12);

      partnerId = crypto.randomUUID();
      await dsaDataSource.getRepository(DSAPartner).save({
        id: partnerId,
        partnerCode: `TEST${Date.now()}`,
        companyName: 'Approval Test Company',
        partnerType: 'PRIVATE_LIMITED',
        panHash: hashPan(pan),
        panEncrypted: Buffer.from(pan),
        email: `approval${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: pwdHash,
        status: DSAPartnerStatus.PENDING_APPROVAL,
      } as DSAPartner);
    });

    it('should login with approved partner credentials', async () => {
      const mobile = generateMobile();
      const pan = generatePAN();
      const bcrypt = require('bcrypt');
      const pwdHash = await bcrypt.hash('PartnerPass123!', 12);

      const partner = await dsaDataSource.getRepository(DSAPartner).save({
        id: crypto.randomUUID(),
        partnerCode: `APPR${Date.now()}`,
        companyName: 'Login Test Company',
        partnerType: 'PRIVATE_LIMITED',
        panHash: hashPan(pan),
        panEncrypted: Buffer.from(pan),
        email: `login${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: pwdHash,
        status: DSAPartnerStatus.APPROVED,
      } as DSAPartner);

      const res = await request(dsaApp.getHttpServer())
        .post('/api/auth/login')
        .send({
          partnerCode: partner.partnerCode,
          password: 'PartnerPass123!',
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('partnerId');
      expect(res.body).toHaveProperty('role', 'DSA_PARTNER');

      partnerAccessToken = res.body.accessToken;
    });

    it('should reject login for non-approved partner', async () => {
      const mobile = generateMobile();
      const pan = generatePAN();
      const bcrypt = require('bcrypt');
      const pwdHash = await bcrypt.hash('Password123!', 12);

      const pendingPartner = await dsaDataSource.getRepository(DSAPartner).save({
        id: crypto.randomUUID(),
        partnerCode: `PEND${Date.now()}`,
        companyName: 'Pending Company',
        partnerType: 'PROPRIETORSHIP',
        panHash: hashPan(pan),
        panEncrypted: Buffer.from(pan),
        email: `pending${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: pwdHash,
        status: DSAPartnerStatus.PENDING_APPROVAL,
      } as DSAPartner);

      const res = await request(dsaApp.getHttpServer())
        .post('/api/auth/login')
        .send({
          partnerCode: pendingPartner.partnerCode,
          password: 'Password123!',
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(res.body.message).toContain('not active');
    });
  });

  describe('DSA Officer Flow', () => {
    let officerAccessToken: string;
    let officerId: string;
    let partnerId: string;

    beforeEach(async () => {
      const bcrypt = require('bcrypt');

      partnerId = crypto.randomUUID();
      await dsaDataSource.getRepository(DSAPartner).save({
        id: partnerId,
        partnerCode: `OFF${Date.now()}`,
        companyName: 'Officer Test Company',
        partnerType: 'PRIVATE_LIMITED',
        panHash: hashPan(generatePAN()),
        email: `officer${Date.now()}@example.com`,
        mobileHash: hashMobile(generateMobile()),
        mobile: generateMobile(),
        passwordHash: await bcrypt.hash('Partner123!', 12),
        status: DSAPartnerStatus.APPROVED,
      } as DSAPartner);

      officerId = crypto.randomUUID();
      const officerPwdHash = await bcrypt.hash('OfficerPass123!', 12);

      await dsaDataSource.getRepository(DSAOfficer).save({
        id: officerId,
        partnerId,
        employeeCode: `EMP${Date.now()}`,
        fullName: 'Test Officer',
        email: `officer${Date.now()}@example.com`,
        mobileHash: hashMobile(generateMobile()),
        mobile: generateMobile(),
        passwordHash: officerPwdHash,
        status: 'ACTIVE',
        designation: 'Sales Officer',
      } as DSAOfficer);
    });

    it('should login a DSA officer', async () => {
      const officers = await dsaDataSource.getRepository(DSAOfficer).find({
        where: { partnerId },
        order: { createdAt: 'DESC' },
        take: 1,
      });

      const officer = officers[0];
      const res = await request(dsaApp.getHttpServer())
        .post('/api/officers/login')
        .send({
          employeeCode: officer.employeeCode,
          password: 'OfficerPass123!',
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('employeeCode', officer.employeeCode);
      expect(res.body.role).toBe('DSA_OFFICER');
      officerAccessToken = res.body.accessToken;
    });

    it('should reject officer login with wrong password', async () => {
      const officers = await dsaDataSource.getRepository(DSAOfficer).find({
        where: { partnerId },
        order: { createdAt: 'DESC' },
        take: 1,
      });

      await request(dsaApp.getHttpServer())
        .post('/api/officers/login')
        .send({
          employeeCode: officers[0].employeeCode,
          password: 'WrongPassword!',
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should create loan application as DSA officer', async () => {
      const mobile = generateMobile();
      const pan = generatePAN();
      const bcrypt = require('bcrypt');
      const pwdHash = await bcrypt.hash('Partner123!', 12);

      const dsaPartner = await dsaDataSource.getRepository(DSAPartner).save({
        id: crypto.randomUUID(),
        partnerCode: `DSA${Date.now()}`,
        companyName: 'Application Test Company',
        partnerType: 'PRIVATE_LIMITED',
        panHash: hashPan(pan),
        panEncrypted: Buffer.from(pan),
        email: `app${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: pwdHash,
        status: DSAPartnerStatus.APPROVED,
      } as DSAPartner);

      const officerId = crypto.randomUUID();
      const officerPwdHash = await bcrypt.hash('OffPass123!', 12);

      await dsaDataSource.getRepository(DSAOfficer).save({
        id: officerId,
        partnerId: dsaPartner.id,
        employeeCode: `TEST${Date.now()}`,
        fullName: 'Test DSA Officer',
        email: `dsaoff${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: officerPwdHash,
        status: 'ACTIVE',
        designation: 'Senior Officer',
      } as DSAOfficer);

      const loginRes = await request(dsaApp.getHttpServer())
        .post('/api/officers/login')
        .send({
          employeeCode: dsaPartner.partnerCode.replace('DSA', 'TEST'),
          password: 'OffPass123!',
        });

      if (loginRes.status !== HttpStatus.OK) {
        const allOfficers = await dsaDataSource.getRepository(DSAOfficer).find({
          where: { partnerId: dsaPartner.id },
        });
        const officer = allOfficers[0];

        const officerRes = await request(dsaApp.getHttpServer())
          .post('/api/officers/login')
          .send({
            employeeCode: officer.employeeCode,
            password: 'OffPass123!',
          })
          .expect(HttpStatus.OK);

        const appRes = await request(dsaApp.getHttpServer())
          .post('/api/applications')
          .set('Authorization', `Bearer ${officerRes.body.accessToken}`)
          .send({
            applicantFullName: 'DSA Customer',
            applicantDob: '1990-05-15',
            applicantMobile: generateMobile(),
            applicantPan: generatePAN(),
            loanType: 'PERSONAL_LOAN',
            requestedAmount: 300000,
            tenurePreferenceMonths: 36,
          })
          .expect(HttpStatus.CREATED);

        expect(appRes.body).toHaveProperty('id');
        expect(appRes.body).toHaveProperty('applicationNumber');
        expect(appRes.body.applicationNumber).toMatch(/^DSA\d/);
      } else {
        expect(loginRes.body).toHaveProperty('accessToken');
      }
    });
  });

  describe('DSA Dashboard', () => {
    it('should get dashboard for authenticated partner', async () => {
      const mobile = generateMobile();
      const pan = generatePAN();
      const bcrypt = require('bcrypt');
      const pwdHash = await bcrypt.hash('DashPass123!', 12);

      const partner = await dsaDataSource.getRepository(DSAPartner).save({
        id: crypto.randomUUID(),
        partnerCode: `DASH${Date.now()}`,
        companyName: 'Dashboard Test Company',
        partnerType: 'PRIVATE_LIMITED',
        panHash: hashPan(pan),
        panEncrypted: Buffer.from(pan),
        email: `dash${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: pwdHash,
        status: DSAPartnerStatus.APPROVED,
      } as DSAPartner);

      const loginRes = await request(dsaApp.getHttpServer())
        .post('/api/auth/login')
        .send({ partnerCode: partner.partnerCode, password: 'DashPass123!' })
        .expect(HttpStatus.OK);

      const res = await request(dsaApp.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('recentApplications');
    });

    it('should list DSA applications with pagination', async () => {
      const mobile = generateMobile();
      const pan = generatePAN();
      const bcrypt = require('bcrypt');
      const pwdHash = await bcrypt.hash('ListPass123!', 12);

      const partner = await dsaDataSource.getRepository(DSAPartner).save({
        id: crypto.randomUUID(),
        partnerCode: `LIST${Date.now()}`,
        companyName: 'List Test Company',
        partnerType: 'LLP',
        panHash: hashPan(pan),
        panEncrypted: Buffer.from(pan),
        email: `list${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: pwdHash,
        status: DSAPartnerStatus.APPROVED,
      } as DSAPartner);

      const loginRes = await request(dsaApp.getHttpServer())
        .post('/api/auth/login')
        .send({ partnerCode: partner.partnerCode, password: 'ListPass123!' })
        .expect(HttpStatus.OK);

      const res = await request(dsaApp.getHttpServer())
        .get('/api/applications')
        .query({ page: 0, size: 10 })
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('applications');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.applications)).toBe(true);
    });

    it('should get partner profile', async () => {
      const mobile = generateMobile();
      const pan = generatePAN();
      const bcrypt = require('bcrypt');
      const pwdHash = await bcrypt.hash('ProfPass123!', 12);

      const partner = await dsaDataSource.getRepository(DSAPartner).save({
        id: crypto.randomUUID(),
        partnerCode: `PROF${Date.now()}`,
        companyName: 'Profile Test Company',
        partnerType: 'PRIVATE_LIMITED',
        panHash: hashPan(pan),
        panEncrypted: Buffer.from(pan),
        email: `prof${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: pwdHash,
        status: DSAPartnerStatus.APPROVED,
      } as DSAPartner);

      const loginRes = await request(dsaApp.getHttpServer())
        .post('/api/auth/login')
        .send({ partnerCode: partner.partnerCode, password: 'ProfPass123!' })
        .expect(HttpStatus.OK);

      const res = await request(dsaApp.getHttpServer())
        .get('/api/profile')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('partnerCode', partner.partnerCode);
      expect(res.body).toHaveProperty('companyName');
      expect(res.body).toHaveProperty('status');
    });

    it('should get commission summary', async () => {
      const mobile = generateMobile();
      const pan = generatePAN();
      const bcrypt = require('bcrypt');
      const pwdHash = await bcrypt.hash('CommPass123!', 12);

      const partner = await dsaDataSource.getRepository(DSAPartner).save({
        id: crypto.randomUUID(),
        partnerCode: `COMM${Date.now()}`,
        companyName: 'Commission Test Company',
        partnerType: 'PRIVATE_LIMITED',
        panHash: hashPan(pan),
        panEncrypted: Buffer.from(pan),
        email: `comm${Date.now()}@example.com`,
        mobileHash: hashMobile(mobile),
        mobile,
        passwordHash: pwdHash,
        status: DSAPartnerStatus.APPROVED,
      } as DSAPartner);

      const loginRes = await request(dsaApp.getHttpServer())
        .post('/api/auth/login')
        .send({ partnerCode: partner.partnerCode, password: 'CommPass123!' })
        .expect(HttpStatus.OK);

      const res = await request(dsaApp.getHttpServer())
        .get('/api/commissions')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('totalEarned');
      expect(res.body).toHaveProperty('pendingPayout');
    });

    it('should reject unauthenticated dashboard access', async () => {
      await request(dsaApp.getHttpServer())
        .get('/api/dashboard')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should reject unauthenticated application creation', async () => {
      await request(dsaApp.getHttpServer())
        .post('/api/applications')
        .send({
          applicantFullName: 'Test Customer',
          applicantDob: '1990-01-01',
          applicantMobile: generateMobile(),
          applicantPan: generatePAN(),
          loanType: 'PERSONAL_LOAN',
          requestedAmount: 200000,
          tenurePreferenceMonths: 24,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
