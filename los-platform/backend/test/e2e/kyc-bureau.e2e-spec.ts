import { HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule as AuthAppModule } from '../../auth-service/src/app.module';
import { AppModule as LoanAppModule } from '../../loan-service/src/app.module';
import { AppModule as KycAppModule } from '../../kyc-service/src/app.module';
import { AppModule as IntegrationAppModule } from '../../integration-service/src/app.module';
import { AppModule as DecisionAppModule } from '../../decision-engine/src/app.module';
import { User, OtpSession } from '../../auth-service/src/entities';
import { LoanApplication, ApplicationStageHistory } from '../../loan-service/src/entities';
import { OtpPurpose } from '@los/common';
import { TestConfig, generateMobile, generatePAN, AuthTokens } from '../helpers/test-config';
import { ApplicationStatus, LoanType } from '../../loan-service/src/entities/loan-application.entity';
import { BureauPullJob, BureauProvider } from '../../integration-service/src/entities/bureau.entity';

const cfg = TestConfig.get();

function hashMobile(mobile: string): string {
  return crypto.createHash('sha256').update(mobile).update(mobile).digest('hex');
}

function hashPan(pan: string): string {
  return crypto.createHash('sha256').update(pan.toUpperCase()).digest('hex');
}

async function createApplication(
  app: INestApplication,
  tokens: AuthTokens,
  dataSource: DataSource,
  loanType: LoanType = LoanType.PERSONAL_LOAN,
  amount: number = 500000,
): Promise<{ appId: string; appNumber: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/applications')
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .send({
      loanType,
      applicantFullName: 'Test Applicant',
      applicantDob: '1985-06-15',
      applicantMobile: generateMobile(),
      applicantPan: generatePAN(),
      requestedAmount: amount,
      tenurePreferenceMonths: 36,
      branchCode: 'BR001',
    });
  return { appId: res.body.id, appNumber: res.body.applicationNumber };
}

async function createAuthenticatedOfficer(
  app: INestApplication,
  dataSource: DataSource,
  role: string = 'LOAN_OFFICER',
): Promise<AuthTokens> {
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

  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    expiresIn: res.body.expiresIn,
    scope: res.body.scope,
    userId: res.body.userId,
    role,
  };
}

describe('KYC + Bureau + Decision E2E', () => {
  let authApp: INestApplication;
  let loanApp: INestApplication;
  let kycApp: INestApplication;
  let integrationApp: INestApplication;
  let decisionApp: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const authModule: TestingModule = await Test.createTestingModule({
      imports: [AuthAppModule],
    }).compile();

    const loanModule: TestingModule = await Test.createTestingModule({
      imports: [LoanAppModule],
    }).compile();

    const kycModule: TestingModule = await Test.createTestingModule({
      imports: [KycAppModule],
    }).compile();

    const integrationModule: TestingModule = await Test.createTestingModule({
      imports: [IntegrationAppModule],
    }).compile();

    const decisionModule: TestingModule = await Test.createTestingModule({
      imports: [DecisionAppModule],
    }).compile();

    authApp = authModule.createNestApplication();
    loanApp = loanModule.createNestApplication();
    kycApp = kycModule.createNestApplication();
    integrationApp = integrationModule.createNestApplication();
    decisionApp = decisionModule.createNestApplication();

    const apps: INestApplication[] = [authApp, loanApp, kycApp, integrationApp, decisionApp];
    for (const a of apps) {
      a.setGlobalPrefix('api');
      a.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    }

    await Promise.all(apps.map(a => a.init()));

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
    await Promise.all([authApp, loanApp, kycApp, integrationApp, decisionApp].map(a => a.close()));
  });

  describe('Application Lifecycle: KYC → Bureau → Decision → Disbursement', () => {
    it('should complete full loan lifecycle from submission through disbursement initiation', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);

      const { appId } = await createApplication(loanApp, officer, dataSource);

      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: ApplicationStatus.KYC_IN_PROGRESS, remarks: 'Starting KYC' })
        .expect(HttpStatus.OK);

      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: ApplicationStatus.BUREAU_REVIEW, remarks: 'KYC done, pulling bureau' })
        .expect(HttpStatus.OK);

      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: ApplicationStatus.DECISION_PENDING, remarks: 'Bureau pulled, awaiting decision' })
        .expect(HttpStatus.OK);

      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: ApplicationStatus.APPROVED, remarks: 'Application approved' })
        .expect(HttpStatus.OK);

      const bureauJob = await dataSource.getRepository(BureauPullJob).findOne({
        where: { applicationId: appId },
        order: { createdAt: 'DESC' },
      });

      const stageHistory = await dataSource.getRepository(ApplicationStageHistory).find({
        where: { applicationId: appId },
        order: { performedAt: 'ASC' },
      });

      expect(stageHistory.length).toBeGreaterThanOrEqual(4);
      expect(stageHistory[0].toStage).toBe(ApplicationStatus.KYC_IN_PROGRESS);
      expect(stageHistory[stageHistory.length - 1].toStage).toBe(ApplicationStatus.APPROVED);

      const approvedApp = await dataSource.getRepository(LoanApplication).findOne({
        where: { id: appId },
      });
      expect(approvedApp!.status).toBe(ApplicationStatus.APPROVED);
    });

    it('should get KYC status for an application', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const res = await request(kycApp.getHttpServer())
        .get(`/api/kyc/${appId}`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('applicationId', appId);
      expect(res.body).toHaveProperty('aadhaarStatus');
      expect(res.body).toHaveProperty('panStatus');
    });

    it('should record bureau consent for an application', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);
      const pan = generatePAN();

      const res = await request(integrationApp.getHttpServer())
        .post('/api/integration/bureau/consent')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          applicantId: officer.userId,
          panHash: hashPan(pan),
          consentOtp: '123456',
        })
        .expect(HttpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('consentId');
      expect(res.body).toHaveProperty('expiresAt');
    });

    it('should pull bureau reports for an application', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);
      const pan = generatePAN();

      const res = await request(integrationApp.getHttpServer())
        .post('/api/integration/bureau/pull')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          panHash: hashPan(pan),
          providers: [BureauProvider.CIBIL, BureauProvider.EXPERIAN],
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('jobs');
      expect(Array.isArray(res.body.jobs)).toBe(true);
      expect(res.body).toHaveProperty('applicationId', appId);
    });

    it('should get bureau reports for an application', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const res = await request(integrationApp.getHttpServer())
        .get('/api/integration/bureau/reports')
        .query({ applicationId })
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('applicationId', appId);
      expect(res.body).toHaveProperty('reports');
      expect(Array.isArray(res.body.reports)).toBe(true);
    });

    it('should trigger decision for an approved application', async () => {
      const creditAnalyst = await createAuthenticatedOfficer(authApp, dataSource, 'CREDIT_ANALYST');
      const { appId } = await createApplication(loanApp, creditAnalyst, dataSource);

      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${creditAnalyst.accessToken}`)
        .send({ status: ApplicationStatus.APPROVED });

      const res = await request(decisionApp.getHttpServer())
        .post('/api/decisions/trigger')
        .set('Authorization', `Bearer ${creditAnalyst.accessToken}`)
        .send({
          applicationId: appId,
          manualScore: 750,
          manualGrade: 'A',
          remarks: 'Manual approval',
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('applicationId', appId);
      expect(res.body).toHaveProperty('decision');
      expect(res.body).toHaveProperty('score');
    });

    it('should get disbursement history for an application', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const res = await request(integrationApp.getHttpServer())
        .get('/api/integration/disbursement')
        .query({ applicationId })
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('disbursements');
      expect(Array.isArray(res.body.disbursements)).toBe(true);
    });

    it('should verify penny drop for bank account', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);

      const res = await request(integrationApp.getHttpServer())
        .post('/api/integration/penny-drop/verify')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          accountNumber: '50100258198762',
          ifscCode: 'HDFC0000001',
          beneficiaryName: 'Test User',
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('verified');
    });

    it('should get integration health metrics', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);

      const res = await request(integrationApp.getHttpServer())
        .get('/api/integration/health/metrics')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('bureauCibil');
      expect(res.body).toHaveProperty('bureauExperian');
      expect(res.body).toHaveProperty('cbs');
      expect(res.body).toHaveProperty('npci');
    });

    it('should transition application to SANCTIONED after approval', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: ApplicationStatus.APPROVED, remarks: 'Approved' });

      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: ApplicationStatus.SANCTIONED, remarks: 'Sanctioned' })
        .expect(HttpStatus.OK);

      const app = await dataSource.getRepository(LoanApplication).findOne({
        where: { id: appId },
      });
      expect(app!.status).toBe(ApplicationStatus.SANCTIONED);
    });

    it('should get decision for application', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      await request(loanApp.getHttpServer())
        .patch(`/api/applications/${appId}/status`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: ApplicationStatus.APPROVED });

      const res = await request(decisionApp.getHttpServer())
        .get(`/api/decisions/${appId}`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('applicationId', appId);
    });
  });

  describe('PDD (Post Disbursement Documentation)', () => {
    it('should get PDD checklist for disbursed application', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const res = await request(loanApp.getHttpServer())
        .get(`/api/pdd/${appId}/checklist`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('applicationId', appId);
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('should update PDD checklist item', async () => {
      const officer = await createAuthenticatedOfficer(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const checklistRes = await request(loanApp.getHttpServer())
        .get(`/api/pdd/${appId}/checklist`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      const items = checklistRes.body.items;
      if (items.length > 0) {
        const itemId = items[0].id;
        const updateRes = await request(loanApp.getHttpServer())
          .patch(`/api/pdd/${appId}/checklist/${itemId}`)
          .set('Authorization', `Bearer ${officer.accessToken}`)
          .send({
            status: 'VERIFIED',
            remarks: 'Document verified',
            verifiedBy: officer.userId,
          })
          .expect(HttpStatus.OK);

        expect(updateRes.body).toHaveProperty('status', 'VERIFIED');
      }
    });
  });
});
