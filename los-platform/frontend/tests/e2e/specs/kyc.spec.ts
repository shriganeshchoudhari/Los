import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { KycPage } from '../pages/kyc.page';
import { ApplicationFormPage } from '../pages/application-form.page';
import { generateUniqueMobile, generateUniquePAN } from '../test-data';

async function createAndOpenApplication(page: any): Promise<string> {
  const mobile = generateUniqueMobile();
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const applicationPage = new ApplicationFormPage(page);

  await loginPage.loginWithOtp(mobile);
  await dashboardPage.openNewApplication();
  await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'KYC Test User', dob: '1990-04-21' });
  await applicationPage.nextStep();
  await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 120000, netIncome: 95000 });
  await applicationPage.nextStep();
  await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
  await applicationPage.submitApplication();

  const appNumber = await applicationPage.applicationNumber.textContent();
  return appNumber!;
}

test.describe('TC-KYC-001: Aadhaar eKYC Flow', () => {

  test('C001-P01: Consent modal displayed before KYC', async ({ page }) => {
    const mobile = generateUniqueMobile();
    await new LoginPage(page).loginWithOtp(mobile);
    await new DashboardPage(page).openNewApplication();
    const applicationPage = new ApplicationFormPage(page);
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    const kycPage = new KycPage(page);
    await kycPage.startKyc();
    await expect(kycPage.aadhaarConsentModal).toBeVisible();
  });

  test('C001-P02: Cannot proceed without consent', async ({ page }) => {
    const mobile = generateUniqueMobile();
    await new LoginPage(page).loginWithOtp(mobile);
    await new DashboardPage(page).openNewApplication();
    const applicationPage = new ApplicationFormPage(page);
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    const kycPage = new KycPage(page);
    await kycPage.startKyc();
    await expect(kycPage.aadhaarConsentModal).toBeVisible();
    await kycPage.proceedKycButton.click();
    await expect(page.locator('[data-testid="consent-required-error"]')).toBeVisible();
  });

  test('C001-P03: Invalid Aadhaar number format rejected', async ({ page }) => {
    const mobile = generateUniqueMobile();
    await new LoginPage(page).loginWithOtp(mobile);
    await new DashboardPage(page).openNewApplication();
    const applicationPage = new ApplicationFormPage(page);
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    const kycPage = new KycPage(page);
    await kycPage.startKyc();
    await kycPage.acceptConsent();
    await kycPage.enterAadhaar('123456789012');
    await kycPage.expectAadhaarErrorVisible();
  });

  test('C001-P05: Aadhaar OTP section visible after send', async ({ page }) => {
    const mobile = generateUniqueMobile();
    await new LoginPage(page).loginWithOtp(mobile);
    await new DashboardPage(page).openNewApplication();
    const applicationPage = new ApplicationFormPage(page);
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    const kycPage = new KycPage(page);
    await kycPage.startKyc();
    await kycPage.acceptConsent();
    await kycPage.enterAadhaar('XXXXXXXX1234');
    await kycPage.expectAadhaarOtpSectionVisible();
  });

  test('C001-P06: Full KYC success — OTP + face match', async ({ page }) => {
    const mobile = generateUniqueMobile();
    await new LoginPage(page).loginWithOtp(mobile);
    await new DashboardPage(page).openNewApplication();
    const applicationPage = new ApplicationFormPage(page);
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    const kycPage = new KycPage(page);
    await kycPage.startKyc();
    await kycPage.acceptConsent();
    await kycPage.enterAadhaar('XXXXXXXX1234');
    await kycPage.verifyAadhaarOtp('123456');
    await kycPage.captureSelfie();
    await kycPage.expectKycSuccess();
  });

  test('C001-P07: UIDAI timeout / unavailable — fallback to offline XML', async ({ page }) => {
    test.skip(!process.env.TEST_ENABLE_OFFLINE_KYC, 'Offline KYC test requires TEST_ENABLE_OFFLINE_KYC flag');
    const mobile = generateUniqueMobile();
    await new LoginPage(page).loginWithOtp(mobile);
    await new DashboardPage(page).openNewApplication();
    const applicationPage = new ApplicationFormPage(page);
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    const kycPage = new KycPage(page);
    await kycPage.startKyc();
    await kycPage.acceptConsent();
    await kycPage.uploadOfflineXml('./test/fixtures/offline_kyc_sample.xml');
    await kycPage.expectKycSuccess();
  });
});

test.describe('TC-KYC-002: KYC Reuse', () => {

  test('C002-P01: Prior valid KYC reused within 10-year window', async ({ page }) => {
    test.skip(!process.env.TEST_ENABLE_KYC_REUSE, 'KYC reuse requires TEST_ENABLE_KYC_REUSE flag');
    const mobile = generateUniqueMobile();
    await new LoginPage(page).loginWithOtp(mobile);
    await new DashboardPage(page).openNewApplication();
    const applicationPage = new ApplicationFormPage(page);
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Reuse Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    const kycPage = new KycPage(page);
    await kycPage.startKyc();
    await kycPage.tryReuseKyc();
    await expect(page.locator('[data-testid="kyc-reused-badge"]')).toBeVisible();
  });
});
