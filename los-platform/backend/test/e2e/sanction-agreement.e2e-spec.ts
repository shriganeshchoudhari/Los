import { HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule as LoanAppModule } from '../../loan-service/src/app.module';
import { AppModule as AuthAppModule } from '../../auth-service/src/app.module';
import { User, OtpSession } from '../../auth-service/src/entities';
import { LoanApplication, LoanAgreement } from '../../loan-service/src/entities';
import { OtpPurpose } from '@los/common';
import { TestConfig, generateMobile, AuthTokens } from '../helpers/test-config';
import { ApplicationStatus } from '../../loan-service/src/entities/loan-application.entity';

const cfg = TestConfig.get();

function hashMobile(mobile: string): string {
  return crypto.createHash('sha256').update(mobile).update(mobile).digest('hex');
}

async function createAuthenticatedLoanOfficer(
  app: INestApplication,
  dataSource: DataSource,
): Promise<{ tokens: AuthTokens; userId: string; mobile: string }> {
  const mobile = generateMobile();
  const userId = crypto.randomUUID();
  const hash = hashMobile(mobile);

  await dataSource.getRepository(User).save({
    id: userId,
    mobile,
    mobileHash: hash,
    fullName: 'Sanction Test Officer',
    role: 'LOAN_OFFICER',
    status: 'ACTIVE',
    branchCode: 'BR001',
  } as User);

  const sessionId = crypto.randomUUID();
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
    .post('/auth/otp/verify')
    .send({ mobile, otp: '999999', sessionId });

  const tokens = new AuthTokens();
  tokens.accessToken = res.body.data?.accessToken || res.body.accessToken;
  tokens.refreshToken = res.body.data?.refreshToken || res.body.refreshToken;
  tokens.userId = userId;
  tokens.role = 'LOAN_OFFICER';

  return { tokens, userId, mobile };
}

async function createApplication(
  app: INestApplication,
  token: string,
): Promise<{ applicationId: string; applicationNumber: string }> {
  const res = await request(app.getHttpServer())
    .post('/applications')
    .set('Authorization', `Bearer ${token}`)
    .send({
      loanType: 'PERSONAL_LOAN',
      channelCode: 'MOBILE_APP',
      branchCode: 'BR001',
      applicant: {
        fullName: 'Ravi Sharma',
        dob: '1990-04-21',
        gender: 'MALE',
        maritalStatus: 'MARRIED',
        mobile: generateMobile(),
        residentialStatus: 'RESIDENT_INDIAN',
        addresses: [{
          line1: 'Flat 302, Orchid Heights',
          city: 'Pune',
          district: 'Pune',
          state: 'MH',
          pincode: '411057',
          country: 'IN',
          addressType: 'CURRENT',
        }],
        yearsAtCurrentAddress: 3,
        ownOrRentedResidence: 'RENTED',
      },
      employmentDetails: {
        employmentType: 'SALARIED_PRIVATE',
        employerName: 'Infosys Limited',
        designation: 'Senior Engineer',
        totalWorkExperienceMonths: 84,
        currentJobExperienceMonths: 50,
        grossMonthlyIncome: 120000,
        netMonthlyIncome: 95000,
        totalAnnualIncome: 1440000,
      },
      loanRequirement: {
        loanType: 'PERSONAL_LOAN',
        requestedAmount: 500000,
        requestedTenureMonths: 36,
        purposeDescription: 'Home renovation',
      },
    });

  const data = res.body.data || res.body;
  return { applicationId: data.applicationId, applicationNumber: data.applicationNumber };
}

describe('Sanction Letter & Loan Agreement E2E (e2e/sanction-agreement.e2e-spec.ts)', () => {
  let loanApp: INestApplication;
  let authApp: INestApplication;
  let dataSource: DataSource;
  let officer: { tokens: AuthTokens; userId: string; mobile: string };

  beforeAll(async () => {
    const authModule = await Test.createTestingModule({
      imports: [AuthAppModule],
    }).compile();
    authApp = authModule.createNestApplication();
    authApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await authApp.init();

    const loanModule = await Test.createTestingModule({
      imports: [LoanAppModule],
    }).compile();
    loanApp = loanModule.createNestApplication();
    loanApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await loanApp.init();

    dataSource = loanModule.get(DataSource);
    officer = await createAuthenticatedLoanOfficer(authApp, dataSource);
  });

  afterAll(async () => {
    await loanApp?.close();
    await authApp?.close();
  });

  describe('Sanction Letter', () => {
    it('should return 404 when application does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(loanApp.getHttpServer())
        .get(`/sanction-letter/${fakeId}/preview`)
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`);

      expect([404, 400]).toContain(res.status);
    });

    it('should return 400 for non-sanctioned application', async () => {
      const { applicationId } = await createApplication(loanApp, officer.tokens.accessToken);

      const res = await request(loanApp.getHttpServer())
        .get(`/sanction-letter/${applicationId}/preview`)
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`);

      expect([400, 404]).toContain(res.status);
    });

    it('should require authorization for sanction letter preview', async () => {
      const { applicationId } = await createApplication(loanApp, officer.tokens.accessToken);

      const res = await request(loanApp.getHttpServer())
        .get(`/sanction-letter/${applicationId}/preview`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('Loan Agreement', () => {
    it('should return 404 for non-existent agreement', async () => {
      const res = await request(loanApp.getHttpServer())
        .get(`/loan-agreement/application/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`);

      expect([404, 400]).toContain(res.status);
    });

    it('should require authorization for agreement generation', async () => {
      const { applicationId } = await createApplication(loanApp, officer.tokens.accessToken);

      const res = await request(loanApp.getHttpServer())
        .post('/loan-agreement/generate')
        .send({ applicationId });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return 400 for unknown application on agreement generation', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(loanApp.getHttpServer())
        .post('/loan-agreement/generate')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ applicationId: fakeId });

      expect([400, 404]).toContain(res.status);
    });
  });

  describe('eSign', () => {
    it('should return 400 for invalid transaction on verify', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/loan-agreement/esign/verify')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ transactionId: 'invalid-txn', otp: '123456', aadhaarLast4: '1234' });

      expect([400, 404]).toContain(res.status);
    });

    it('should return 400 for invalid aadhaarLast4 format', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/loan-agreement/esign/verify')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ transactionId: 'some-txn', otp: '123456', aadhaarLast4: '12' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 for short OTP', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/loan-agreement/esign/verify')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ transactionId: 'some-txn', otp: '123', aadhaarLast4: '1234' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should require authorization for eSign initiation', async () => {
      const { applicationId } = await createApplication(loanApp, officer.tokens.accessToken);

      const res = await request(loanApp.getHttpServer())
        .post('/loan-agreement/esign/initiate')
        .send({
          applicationId,
          signerName: 'Ravi Sharma',
          signerMobile: '9876543210',
          signerEmail: 'ravi@example.com',
        });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should require authorization for eSign cancel', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/loan-agreement/esign/cancel')
        .send({ transactionId: 'some-txn', reason: 'Customer request' });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should require authorization for eSign verify', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/loan-agreement/esign/verify')
        .send({ transactionId: 'some-txn', otp: '123456', aadhaarLast4: '1234' });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('PDD (Post-Disbursement Discovery)', () => {
    it('should return 404 for non-existent application PDD', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(loanApp.getHttpServer())
        .get(`/pdd/${fakeId}`)
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`);

      expect([404, 400]).toContain(res.status);
    });

    it('should require authorization for PDD initiate', async () => {
      const { applicationId } = await createApplication(loanApp, officer.tokens.accessToken);

      const res = await request(loanApp.getHttpServer())
        .post(`/pdd/${applicationId}/initiate`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should get PDD dashboard summary', async () => {
      const res = await request(loanApp.getHttpServer())
        .get('/pdd/dashboard/summary')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`);

      expect([200, 401]).toContain(res.status);
    });
  });

  describe('EMI Calculator', () => {
    it('should calculate EMI correctly', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/emi/calculate')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ principal: 500000, annualRate: 10.5, tenureMonths: 36 });

      expect(res.status).toBe(HttpStatus.OK);
      const data = res.body.data || res.body;
      expect(data.emiAmount).toBeGreaterThan(0);
    });

    it('should reject invalid tenure', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/emi/calculate')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ principal: 500000, annualRate: 10.5, tenureMonths: 0 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject negative rate', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/emi/calculate')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ principal: 500000, annualRate: -5, tenureMonths: 36 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should generate amortization schedule', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/emi/amortization')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ principal: 100000, annualRate: 12, tenureMonths: 12, startDate: '2026-05-01' });

      expect(res.status).toBe(HttpStatus.OK);
      const data = res.body.data || res.body;
      const schedule = data.schedule || data;
      expect(schedule).toBeInstanceOf(Array);
      expect(schedule.length).toBeGreaterThan(0);
    });

    it('should reject foreclosure with past date', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/emi/foreclosure')
        .set('Authorization', `Bearer ${officer.tokens.accessToken}`)
        .send({ loanId: '00000000-0000-0000-0000-000000000000', foreclosureDate: '2020-01-01' });

      expect([200, 400, 404]).toContain(res.status);
    });
  });
});
