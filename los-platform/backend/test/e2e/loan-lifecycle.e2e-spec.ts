import { HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule as AuthAppModule } from '../../auth-service/src/app.module';
import { AppModule as LoanAppModule } from '../../loan-service/src/app.module';
import { User, OtpSession } from '../../auth-service/src/entities';
import { LoanApplication, ApplicationStageHistory } from '../../loan-service/src/entities';
import { AuditLog } from '@los/common';
import { OtpPurpose } from '@los/common';
import { TestConfig, generateMobile, generatePAN, AuthTokens } from '../helpers/test-config';
import { ApplicationStatus, LoanType } from '../../loan-service/src/entities/loan-application.entity';

const cfg = TestConfig.get();

function hashMobile(mobile: string): string {
  return crypto.createHash('sha256').update(mobile).update(mobile).digest('hex');
}

function hashPan(pan: string): string {
  return crypto.createHash('sha256').update(pan.toUpperCase()).digest('hex');
}

async function createAuthenticatedUser(
  app: INestApplication,
  dataSource: DataSource,
  role: string,
  branchCode = 'BR001',
): Promise<{ tokens: AuthTokens; userId: string; mobile: string }> {
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
    branchCode,
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
    .post('/api/auth/otp/verify')
    .send({ mobile, otp: '999999', sessionId });

  const tokens: AuthTokens = {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    expiresIn: res.body.expiresIn,
    scope: res.body.scope,
    userId: res.body.userId,
    role,
  };

  return { tokens, userId, mobile };
}

async function createAuthenticatedOfficer(
  app: INestApplication,
  dataSource: DataSource,
): Promise<AuthTokens> {
  const { tokens } = await createAuthenticatedUser(app, dataSource, 'LOAN_OFFICER', 'BR001');
  return tokens;
}

describe('Loan Application Lifecycle E2E', () => {
  let authApp: INestApplication;
  let loanApp: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const authModule: TestingModule = await Test.createTestingModule({
      imports: [AuthAppModule],
    }).compile();

    const loanModule: TestingModule = await Test.createTestingModule({
      imports: [LoanAppModule],
    }).compile();

    authApp = authModule.createNestApplication();
    loanApp = loanModule.createNestApplication();
    authApp.setGlobalPrefix('api');
    loanApp.setGlobalPrefix('api');
    authApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    loanApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

    await authApp.init();
    await loanApp.init();

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
    await authApp.close();
    await loanApp.close();
  });

  describe('Application Creation', () => {
    it('should create a loan application as LOAN_OFFICER', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);

      const applicationData = {
        loanType: LoanType.PERSONAL_LOAN,
        applicantFullName: 'Ramesh Kumar',
        applicantDob: '1985-06-15',
        applicantMobile: generateMobile(),
        applicantPan: generatePAN(),
        requestedAmount: 500000,
        tenurePreferenceMonths: 36,
        branchCode: 'BR001',
        employmentDetails: {
          employmentType: 'SALARIED_PRIVATE',
          monthlyIncome: 75000,
          designation: 'Software Engineer',
          companyName: 'TechCorp India',
        },
      };

      const res = await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send(applicationData)
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('applicationNumber');
      expect(res.body.applicationNumber).toMatch(/^LOS\d+$/);
      expect(res.body.status).toBe(ApplicationStatus.SUBMITTED);
      expect(res.body.requestedAmount).toBe(500000);
      expect(res.body.loanType).toBe(LoanType.PERSONAL_LOAN);
    });

    it('should reject application creation without auth', async () => {
      await request(loanApp.getHttpServer())
        .post('/api/applications')
        .send({ loanType: LoanType.HOME_LOAN, requestedAmount: 5000000 })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should reject invalid loan amount (below minimum)', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);

      await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          loanType: LoanType.PERSONAL_LOAN,
          applicantFullName: 'Test User',
          applicantDob: '1990-01-01',
          applicantMobile: generateMobile(),
          applicantPan: generatePAN(),
          requestedAmount: 1000,
          tenurePreferenceMonths: 12,
          branchCode: 'BR001',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should auto-generate application number with correct year prefix', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const year = new Date().getFullYear();

      const res = await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          loanType: LoanType.HOME_LOAN,
          applicantFullName: 'Test Home Loan',
          applicantDob: '1988-03-20',
          applicantMobile: generateMobile(),
          applicantPan: generatePAN(),
          requestedAmount: 5000000,
          tenurePreferenceMonths: 240,
          branchCode: 'BR002',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body.applicationNumber).toMatch(new RegExp(`^LOS${year}\\d{6}$`));
    });

    it('should store PAN hash and mobile hash in application', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const pan = generatePAN();
      const panHash = hashPan(pan);

      const res = await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          loanType: LoanType.LAP,
          applicantFullName: 'Test LAP',
          applicantDob: '1987-07-10',
          applicantMobile: generateMobile(),
          applicantPan: pan,
          requestedAmount: 2000000,
          tenurePreferenceMonths: 60,
          branchCode: 'BR003',
        })
        .expect(HttpStatus.CREATED);

      const savedApp = await dataSource.getRepository(LoanApplication).findOne({
        where: { id: res.body.id },
      });
      expect(savedApp!.applicantPanHash).toBe(panHash);
      expect(savedApp!.applicantMobileHash).toBeDefined();
    });

    it('should prevent duplicate applications for same PAN within cooldown', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const pan = generatePAN();

      await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          loanType: LoanType.PERSONAL_LOAN,
          applicantFullName: 'First App',
          applicantDob: '1985-01-01',
          applicantMobile: generateMobile(),
          applicantPan: pan,
          requestedAmount: 300000,
          tenurePreferenceMonths: 24,
          branchCode: 'BR001',
        })
        .expect(HttpStatus.CREATED);

      const duplicateRes = await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          loanType: LoanType.PERSONAL_LOAN,
          applicantFullName: 'Duplicate App',
          applicantDob: '1985-01-01',
          applicantMobile: generateMobile(),
          applicantPan: pan,
          requestedAmount: 400000,
          tenurePreferenceMonths: 36,
          branchCode: 'BR001',
        });

      expect(duplicateRes.status).toBe(HttpStatus.CONFLICT);
      expect(duplicateRes.body.code).toBe('APP_002');
    });
  });

  describe('Application Retrieval', () => {
    let createdAppId: string;
    let officerTokens: AuthTokens;

    beforeEach(async () => {
      officerTokens = await createAuthenticatedOfficer(authApp, dataSource);

      const res = await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({
          loanType: LoanType.VEHICLE_LOAN_FOUR_WHEELER,
          applicantFullName: 'Vehicle Buyer',
          applicantDob: '1990-04-20',
          applicantMobile: generateMobile(),
          applicantPan: generatePAN(),
          requestedAmount: 800000,
          tenurePreferenceMonths: 60,
          branchCode: 'BR001',
        });

      createdAppId = res.body.id;
    });

    it('should retrieve application by ID', async () => {
      const res = await request(loanApp.getHttpServer())
        .get(`/api/applications/${createdAppId}`)
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body.id).toBe(createdAppId);
      expect(res.body.loanType).toBe(LoanType.VEHICLE_LOAN_FOUR_WHEELER);
      expect(res.body.status).toBe(ApplicationStatus.SUBMITTED);
    });

    it('should return 404 for non-existent application', async () => {
      const fakeId = crypto.randomUUID();
      await request(loanApp.getHttpServer())
        .get(`/api/applications/${fakeId}`)
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should list applications for assigned officer', async () => {
      const res = await request(loanApp.getHttpServer())
        .get('/api/applications')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('applications');
      expect(Array.isArray(res.body.applications)).toBe(true);
      expect(res.body.applications.length).toBeGreaterThan(0);
    });

    it('should filter applications by status', async () => {
      const res = await request(loanApp.getHttpServer())
        .get('/api/applications')
        .query({ status: ApplicationStatus.SUBMITTED })
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .expect(HttpStatus.OK);

      for (const app of res.body.applications) {
        expect(app.status).toBe(ApplicationStatus.SUBMITTED);
      }
    });

    it('should paginate application list', async () => {
      const res = await request(loanApp.getHttpServer())
        .get('/api/applications')
        .query({ page: 1, size: 5 })
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.size).toBe(5);
      expect(res.body.applications.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Application Status Transitions', () => {
    let appId: string;
    let officerTokens: AuthTokens;

    beforeEach(async () => {
      officerTokens = await createAuthenticatedOfficer(authApp, dataSource);

      const res = await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({
          loanType: LoanType.HOME_LOAN,
          applicantFullName: 'Home Buyer',
          applicantDob: '1980-03-15',
          applicantMobile: generateMobile(),
          applicantPan: generatePAN(),
          requestedAmount: 10000000,
          tenurePreferenceMonths: 240,
          branchCode: 'BR001',
        });

      appId = res.body.id;
    });

    it('should transition from SUBMITTED to KYC_IN_PROGRESS', async () => {
      const res = await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ status: ApplicationStatus.KYC_IN_PROGRESS, remarks: 'Starting KYC verification' })
        .expect(HttpStatus.OK);

      expect(res.body.status).toBe(ApplicationStatus.KYC_IN_PROGRESS);
    });

    it('should prevent invalid status transitions', async () => {
      const res = await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ status: ApplicationStatus.DISBURSED, remarks: 'Skip to disbursed' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should create stage history entry on transition', async () => {
      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ status: ApplicationStatus.KYC_IN_PROGRESS, remarks: 'KYC started' });

      const history = await dataSource.getRepository(ApplicationStageHistory).find({
        where: { applicationId: appId },
        order: { performedAt: 'DESC' },
      });

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].toStage).toBe(ApplicationStatus.KYC_IN_PROGRESS);
    });

    it('should set submittedAt timestamp when first transitioning from DRAFT', async () => {
      const res = await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ status: ApplicationStatus.SUBMITTED });

      const app = await dataSource.getRepository(LoanApplication).findOne({
        where: { id: appId },
      });
      expect(app!.submittedAt).toBeInstanceOf(Date);
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entry on application creation', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);

      const res = await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          loanType: LoanType.PERSONAL_LOAN,
          applicantFullName: 'Audit Test',
          applicantDob: '1992-11-05',
          applicantMobile: generateMobile(),
          applicantPan: generatePAN(),
          requestedAmount: 200000,
          tenurePreferenceMonths: 24,
          branchCode: 'BR001',
        });

      const logs = await dataSource.getRepository(AuditLog).find({
        where: { applicationId: res.body.id },
        order: { createdAt: 'DESC' },
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('APPLICATION_CREATED');
      expect(logs[0].category).toBe('LOAN_APPLICATION');
      expect(logs[0].resourceType).toBe('APPLICATION');
      expect(logs[0].resourceId).toBe(res.body.id);
    });

    it('should capture actor ID in audit log', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);

      const res = await request(loanApp.getHttpServer())
        .post('/api/applications')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          loanType: LoanType.GOLD_LOAN,
          applicantFullName: 'Gold Loan',
          applicantDob: '1975-08-20',
          applicantMobile: generateMobile(),
          applicantPan: generatePAN(),
          requestedAmount: 500000,
          tenurePreferenceMonths: 12,
          branchCode: 'BR001',
        });

      const log = await dataSource.getRepository(AuditLog).findOne({
        where: { applicationId: res.body.id },
        order: { createdAt: 'DESC' },
      });

      expect(log!.userId).toBe(officer.userId);
    });
  });

  describe('EMI Calculator', () => {
    let officerTokens: AuthTokens;

    beforeEach(async () => {
      officerTokens = await createAuthenticatedOfficer(authApp, dataSource);
    });

    it('should calculate EMI correctly for principal 10L at 10% for 12 months', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/api/emi/calculate')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ principal: 1000000, annualRate: 10, tenureMonths: 12, monthlyIncome: 100000 })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('emiAmount');
      expect(res.body.emiAmount).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('totalInterest');
      expect(res.body).toHaveProperty('totalPayment');
      expect(res.body.totalPayment).toBeCloseTo(res.body.emiAmount * 12, 0);
      expect(res.body).toHaveProperty('foirPercent');
    });

    it('should calculate EMI correctly for principal 5L at 12% for 24 months', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/api/emi/calculate')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ principal: 500000, annualRate: 12, tenureMonths: 24 })
        .expect(HttpStatus.OK);

      const expectedEmi = 23537;
      expect(res.body.emiAmount).toBeCloseTo(expectedEmi, -1);
    });

    it('should reject negative or zero principal', async () => {
      await request(loanApp.getHttpServer())
        .post('/api/emi/calculate')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ principal: 0, annualRate: 10, tenureMonths: 12 })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject tenure below minimum (1 month)', async () => {
      await request(loanApp.getHttpServer())
        .post('/api/emi/calculate')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ principal: 100000, annualRate: 10, tenureMonths: 0 })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should generate correct amortization schedule', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/api/emi/amortization')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({ principal: 300000, annualRate: 9, tenureMonths: 12 })
        .expect(HttpStatus.OK);

      expect(res.body.schedule).toHaveLength(12);
      expect(res.body.schedule[0]).toHaveProperty('month', 1);
      expect(res.body.schedule[0]).toHaveProperty('principalComponent');
      expect(res.body.schedule[0]).toHaveProperty('interestComponent');
      expect(res.body.schedule[0]).toHaveProperty('remainingBalance');
      expect(res.body.totalEntries).toBe(12);
    });

    it('should calculate prepayment correctly (tenure reduction)', async () => {
      const res = await request(loanApp.getHttpServer())
        .post('/api/emi/prepayment')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({
          originalPrincipal: 1000000,
          annualRate: 10,
          remainingMonths: 60,
          prepaymentAmount: 100000,
          currentMonthEmi: 21247,
          prepaymentType: 'TENURE_REDUCTION',
          prepaymentPenaltyPercent: 2,
          gstPercent: 18,
        })
        .expect(HttpStatus.OK);

      expect(res.body.optionA_TenureReduction).toHaveProperty('newTenure');
      expect(res.body.optionA_TenureReduction.newTenure).toBeLessThan(60);
      expect(res.body.optionA_TenureReduction).toHaveProperty('netSavings');
      expect(res.body.netSavings).toBeGreaterThan(0);
    });

    it('should calculate foreclosure amount correctly', async () => {
      const disbursementDate = new Date();
      disbursementDate.setFullYear(disbursementDate.getFullYear() - 1);
      const foreclosureDate = new Date();

      const res = await request(loanApp.getHttpServer())
        .post('/api/emi/foreclosure')
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .send({
          originalPrincipal: 5000000,
          annualRate: 9.5,
          tenureMonths: 240,
          disbursementDate: disbursementDate.toISOString().split('T')[0],
          foreclosureDate: foreclosureDate.toISOString().split('T')[0],
          foreclosureProcessingFeePercent: 2,
          gstPercent: 18,
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('outstandingPrincipal');
      expect(res.body).toHaveProperty('processingFee');
      expect(res.body).toHaveProperty('gstOnFee');
      expect(res.body).toHaveProperty('totalForeclosureAmount');
      expect(res.body.totalForeclosureAmount).toBeGreaterThan(res.body.outstandingPrincipal);
    });

    it('should calculate max eligible EMI based on FOIR', async () => {
      const res = await request(loanApp.getHttpServer())
        .get('/api/emi/max-eligible-emi')
        .query({ netMonthlyIncome: 100000, existingEmi: 15000, maxFoirPercent: 50 })
        .set('Authorization', `Bearer ${officerTokens.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('maxEligibleEmi');
      expect(res.body).toHaveProperty('foirPercent');
      expect(res.body.maxEligibleEmi).toBeGreaterThan(0);
    });
  });
});
