import { HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule as AuthAppModule } from '../../auth-service/src/app.module';
import { AppModule as LoanAppModule } from '../../loan-service/src/app.module';
import { AppModule as DocumentAppModule } from '../../document-service/src/app.module';
import { User, OtpSession } from '../../auth-service/src/entities';
import { LoanApplication } from '../../loan-service/src/entities';
import { Document } from '../../document-service/src/entities/document.entity';
import { OtpPurpose } from '@los/common';
import { TestConfig, generateMobile, generatePAN, AuthTokens } from '../helpers/test-config';
import { ApplicationStatus, LoanType } from '../../loan-service/src/entities/loan-application.entity';

const cfg = TestConfig.get();

function hashMobile(mobile: string): string {
  return crypto.createHash('sha256').update(mobile).update(mobile).digest('hex');
}

async function createAuthenticatedUser(
  app: INestApplication,
  dataSource: DataSource,
  role: string = 'LOAN_OFFICER',
): Promise<AuthTokens> {
  const bcrypt = require('bcrypt');
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

async function createApplication(
  app: INestApplication,
  tokens: AuthTokens,
  dataSource: DataSource,
): Promise<{ appId: string; appNumber: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/applications')
    .set('Authorization', `Bearer ${tokens.accessToken}`)
    .send({
      loanType: LoanType.PERSONAL_LOAN,
      applicantFullName: 'Doc Test Applicant',
      applicantDob: '1988-03-10',
      applicantMobile: generateMobile(),
      applicantPan: generatePAN(),
      requestedAmount: 500000,
      tenurePreferenceMonths: 36,
      branchCode: 'BR001',
    });
  return { appId: res.body.id, appNumber: res.body.applicationNumber };
}

describe('Document Management E2E', () => {
  let authApp: INestApplication;
  let loanApp: INestApplication;
  let documentApp: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const authModule: TestingModule = await Test.createTestingModule({
      imports: [AuthAppModule],
    }).compile();

    const loanModule: TestingModule = await Test.createTestingModule({
      imports: [LoanAppModule],
    }).compile();

    const documentModule: TestingModule = await Test.createTestingModule({
      imports: [DocumentAppModule],
    }).compile();

    authApp = authModule.createNestApplication();
    loanApp = loanModule.createNestApplication();
    documentApp = documentModule.createNestApplication();

    const apps: INestApplication[] = [authApp, loanApp, documentApp];
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
    await Promise.all([authApp.close(), loanApp.close(), documentApp.close()]);
  });

  describe('Document Upload Flow', () => {
    it('should get presigned URL for document upload', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const res = await request(documentApp.getHttpServer())
        .post('/api/documents/presigned-url')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          documentType: 'PAN_CARD',
          fileName: 'pan_card.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 102400,
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('uploadId');
      expect(res.body).toHaveProperty('uploadUrl');
      expect(res.body).toHaveProperty('objectKey');
      expect(res.body).toHaveProperty('expiresIn');
    });

    it('should confirm document upload and create record', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const presignedRes = await request(documentApp.getHttpServer())
        .post('/api/documents/presigned-url')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          documentType: 'AADHAAR_CARD',
          fileName: 'aadhaar.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 204800,
        })
        .expect(HttpStatus.CREATED);

      const confirmRes = await request(documentApp.getHttpServer())
        .post('/api/documents/confirm-upload')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          uploadId: presignedRes.body.uploadId,
          applicationId: appId,
          documentType: 'AADHAAR_CARD',
          ocrRequired: true,
        })
        .expect(HttpStatus.OK);

      expect(confirmRes.body).toHaveProperty('id');
      expect(confirmRes.body).toHaveProperty('documentType', 'AADHAAR_CARD');
      expect(confirmRes.body).toHaveProperty('applicationId', appId);
    });

    it('should list documents for an application', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const presignedRes = await request(documentApp.getHttpServer())
        .post('/api/documents/presigned-url')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          documentType: 'BANK_STATEMENT',
          fileName: 'statement.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 512000,
        })
        .expect(HttpStatus.CREATED);

      await request(documentApp.getHttpServer())
        .post('/api/documents/confirm-upload')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          uploadId: presignedRes.body.uploadId,
          applicationId: appId,
          documentType: 'BANK_STATEMENT',
          ocrRequired: true,
        });

      const listRes = await request(documentApp.getHttpServer())
        .get(`/api/applications/${appId}/documents`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(listRes.body).toHaveProperty('documents');
      expect(Array.isArray(listRes.body.documents)).toBe(true);
    });

    it('should get document by ID', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const presignedRes = await request(documentApp.getHttpServer())
        .post('/api/documents/presigned-url')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          documentType: 'SALARY_SLIP',
          fileName: 'salary.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 102400,
        })
        .expect(HttpStatus.CREATED);

      const confirmRes = await request(documentApp.getHttpServer())
        .post('/api/documents/confirm-upload')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          uploadId: presignedRes.body.uploadId,
          applicationId: appId,
          documentType: 'SALARY_SLIP',
          ocrRequired: false,
        });

      const docId = confirmRes.body.id;
      const getRes = await request(documentApp.getHttpServer())
        .get(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(getRes.body).toHaveProperty('id', docId);
      expect(getRes.body).toHaveProperty('documentType', 'SALARY_SLIP');
    });

    it('should reject document upload without auth', async () => {
      await request(documentApp.getHttpServer())
        .post('/api/documents/presigned-url')
        .send({
          applicationId: crypto.randomUUID(),
          documentType: 'PAN_CARD',
          fileName: 'pan.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 102400,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should create document checklist for application', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const res = await request(documentApp.getHttpServer())
        .post('/api/documents/checklist')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          loanType: LoanType.PERSONAL_LOAN,
          checklistType: 'PDD',
        })
        .expect(HttpStatus.CREATED);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('applicationId', appId);
      expect(res.body[0]).toHaveProperty('documentType');
    });

    it('should get document checklist for application', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      await request(documentApp.getHttpServer())
        .post('/api/documents/checklist')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          loanType: LoanType.HOME_LOAN,
          checklistType: 'PDD',
        });

      const res = await request(documentApp.getHttpServer())
        .get(`/api/applications/${appId}/checklist`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toBeInstanceOf(Array);
      for (const item of res.body) {
        expect(item).toHaveProperty('applicationId', appId);
      }
    });

    it('should review a document (approve)', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const presignedRes = await request(documentApp.getHttpServer())
        .post('/api/documents/presigned-url')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          documentType: 'ADDRESS_PROOF',
          fileName: 'address.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 204800,
        })
        .expect(HttpStatus.CREATED);

      const confirmRes = await request(documentApp.getHttpServer())
        .post('/api/documents/confirm-upload')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          uploadId: presignedRes.body.uploadId,
          applicationId: appId,
          documentType: 'ADDRESS_PROOF',
          ocrRequired: false,
        });

      const docId = confirmRes.body.id;
      const reviewRes = await request(documentApp.getHttpServer())
        .post(`/api/documents/${docId}/review`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          status: 'APPROVED',
          remarks: 'Document verified successfully',
        })
        .expect(HttpStatus.OK);

      expect(reviewRes.body).toHaveProperty('id', docId);
      expect(reviewRes.body.reviews).toBeDefined();
      expect(reviewRes.body.reviews.length).toBeGreaterThan(0);
      expect(reviewRes.body.reviews[0].status).toBe('APPROVED');
    });

    it('should reject document review with invalid status', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const presignedRes = await request(documentApp.getHttpServer())
        .post('/api/documents/presigned-url')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          documentType: 'ITR',
          fileName: 'itr.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 512000,
        })
        .expect(HttpStatus.CREATED);

      const confirmRes = await request(documentApp.getHttpServer())
        .post('/api/documents/confirm-upload')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          uploadId: presignedRes.body.uploadId,
          applicationId: appId,
          documentType: 'ITR',
          ocrRequired: true,
        });

      const docId = confirmRes.body.id;
      await request(documentApp.getHttpServer())
        .post(`/api/documents/${docId}/review`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          status: 'INVALID_STATUS',
          remarks: 'Test',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should get document statistics', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const res = await request(documentApp.getHttpServer())
        .get('/api/documents/stats')
        .query({ applicationId: appId })
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('totalDocuments');
      expect(res.body).toHaveProperty('pendingDocuments');
      expect(res.body).toHaveProperty('approvedDocuments');
    });

    it('should get document review history', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const presignedRes = await request(documentApp.getHttpServer())
        .post('/api/documents/presigned-url')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          documentType: 'FORM_16',
          fileName: 'form16.pdf',
          contentType: 'application/pdf',
          fileSizeBytes: 102400,
        })
        .expect(HttpStatus.CREATED);

      const confirmRes = await request(documentApp.getHttpServer())
        .post('/api/documents/confirm-upload')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          uploadId: presignedRes.body.uploadId,
          applicationId: appId,
          documentType: 'FORM_16',
          ocrRequired: false,
        });

      const docId = confirmRes.body.id;

      await request(documentApp.getHttpServer())
        .post(`/api/documents/${docId}/review`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: 'UNDER_REVIEW', remarks: 'Initial review' });

      await request(documentApp.getHttpServer())
        .post(`/api/documents/${docId}/review`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({ status: 'APPROVED', remarks: 'Final approval' });

      const historyRes = await request(documentApp.getHttpServer())
        .get(`/api/documents/${docId}/reviews`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .expect(HttpStatus.OK);

      expect(historyRes.body).toBeInstanceOf(Array);
      expect(historyRes.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should update checklist item status', async () => {
      const officer = await createAuthenticatedUser(authApp, dataSource);
      const { appId } = await createApplication(loanApp, officer, dataSource);

      const checklistRes = await request(documentApp.getHttpServer())
        .post('/api/documents/checklist')
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          applicationId: appId,
          loanType: LoanType.VEHICLE_LOAN_FOUR_WHEELER,
          checklistType: 'PDD',
        })
        .expect(HttpStatus.CREATED);

      const checklistId = checklistRes.body[0].id;
      const updateRes = await request(documentApp.getHttpServer())
        .patch(`/api/documents/checklist/${checklistId}`)
        .set('Authorization', `Bearer ${officer.accessToken}`)
        .send({
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
        })
        .expect(HttpStatus.OK);

      expect(updateRes.body).toHaveProperty('id', checklistId);
      expect(updateRes.body).toHaveProperty('status', 'SUBMITTED');
    });
  });
});
