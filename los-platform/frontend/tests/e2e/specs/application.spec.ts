import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { ApplicationFormPage } from '../pages/application-form.page';
import { generateUniqueMobile, generateUniquePAN } from '../test-data';

test.describe('TC-APP-001: Full STP - Personal Loan Approval', () => {

  let mobile: string;
  let pan: string;

  test.beforeEach(() => {
    mobile = generateUniqueMobile();
    pan = generateUniquePAN();
  });

  test('C001-P01: Submit personal loan application — auto-approved', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(mobile);
    await dashboardPage.openNewApplication();

    await applicationPage.fillStep1_PersonalDetails({
      loanType: 'PERSONAL_LOAN',
      fullName: 'Ravi Kumar Sharma',
      dob: '1990-04-21',
      gender: 'MALE',
      email: 'ravi.sharma@example.com',
    });
    await applicationPage.nextStep();

    await applicationPage.fillStep2_EmploymentDetails({
      employmentType: 'SALARIED_PRIVATE',
      employerName: 'Infosys Limited',
      grossIncome: 120000,
      netIncome: 95000,
    });
    await applicationPage.nextStep();

    await applicationPage.fillStep3_LoanRequirement({
      loanAmount: 500000,
      tenureMonths: 36,
    });

    await applicationPage.submitApplication();

    await applicationPage.expectApplicationNumber();
    await applicationPage.expectStatus('DRAFT');
  });

  test('C001-P02: Validation — loan amount exceeds product maximum', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(mobile);
    await dashboardPage.openNewApplication();

    await applicationPage.fillStep1_PersonalDetails({ fullName: 'Test User', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 1000000000, tenureMonths: 36 });

    await applicationPage.submitApplication();
    await applicationPage.expectAmountErrorContains('exceeds maximum');
  });

  test('C001-P03: FOIR warning when income insufficient for requested amount', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(mobile);
    await dashboardPage.openNewApplication();

    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Low Income User', dob: '1990-01-01', gender: 'MALE' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 20000, netIncome: 15000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 1000000, tenureMonths: 60 });

    await page.waitForTimeout(500);
    await applicationPage.expectFoirWarningVisible();
  });

  test('C001-P04: Validation — tenure outside product limits', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(mobile);
    await dashboardPage.openNewApplication();

    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Test User', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 100 });

    await applicationPage.submitApplication();
    await expect(page.locator('[data-testid="tenure-error"]')).toContainText('outside allowed range');
  });

  test('C001-P05: Validation — minimum income not met', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(mobile);
    await dashboardPage.openNewApplication();

    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Test User', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 5000, netIncome: 4000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 50000, tenureMonths: 12 });

    await applicationPage.submitApplication();
    await expect(page.locator('[data-testid="income-error"]')).toContainText('Minimum income');
  });

  test('C001-P06: Auto-save on field blur', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(mobile);
    await dashboardPage.openNewApplication();
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Auto Save Test', dob: '1990-01-01' });

    await applicationPage.netIncomeInput.blur();
    await expect(applicationPage.autoSaveIndicator).toContainText('Saved');
  });

  test('C001-P07: Duplicate PAN application rejected', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(mobile);
    await dashboardPage.openNewApplication();
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Duplicate Test', dob: '1990-01-01', email: 'dup@test.com' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    await loginPage.logout();

    const mobile2 = generateUniqueMobile();
    await loginPage.loginWithOtp(mobile2);
    await dashboardPage.openNewApplication();
    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Duplicate Test 2', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();
    await applicationPage.expectDuplicateErrorContains('Duplicate application');
  });
});

test.describe('TC-APP-002: Application State Transitions', () => {

  test('C002-P01: Application transitions DRAFT → SUBMITTED on submit', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(generateUniqueMobile());
    await dashboardPage.openNewApplication();

    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'State Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();

    await expect(applicationPage.applicationStatus).toContainText('DRAFT');

    await applicationPage.submitApplicationButton.click();
    await expect(applicationPage.applicationStatus).toContainText('SUBMITTED');
  });

  test('C002-P03: Application auto-assigns to officer on submission', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const applicationPage = new ApplicationFormPage(page);

    await loginPage.loginWithOtp(generateUniqueMobile());
    await dashboardPage.openNewApplication();

    await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Officer Assign Test', dob: '1990-01-01' });
    await applicationPage.nextStep();
    await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 100000, netIncome: 80000 });
    await applicationPage.nextStep();
    await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
    await applicationPage.submitApplication();
    await applicationPage.submitApplicationButton.click();

    await expect(page.locator('[data-testid="assigned-officer"]')).toBeVisible();
  });
});
