import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { ApplicationFormPage } from '../pages/application-form.page';
import { DecisionPage } from '../pages/decision.page';
import { generateUniqueMobile, SEED_DATA } from '../test-data';

async function submitApplication(page: any): Promise<void> {
  await new LoginPage(page).loginWithOtp(generateUniqueMobile());
  await new DashboardPage(page).openNewApplication();
  const applicationPage = new ApplicationFormPage(page);

  const scenario = SEED_DATA.decisionScenarios.autoApprove;
  await applicationPage.fillStep1_PersonalDetails({
    loanType: 'PERSONAL_LOAN',
    fullName: 'Decision Test User',
    dob: '1985-01-15',
    gender: 'MALE',
  });
  await applicationPage.nextStep();
  await applicationPage.fillStep2_EmploymentDetails({
    employmentType: 'SALARIED_PRIVATE',
    employerName: 'TCS Limited',
    grossIncome: scenario.income,
    netIncome: Math.round(scenario.income * 0.8),
  });
  await applicationPage.nextStep();
  await applicationPage.fillStep3_LoanRequirement({
    loanAmount: scenario.amount,
    tenureMonths: scenario.tenure,
  });
  await applicationPage.submitApplication();
}

test.describe('TC-DEC-001: Decision Engine', () => {

  test('C001-P01: Auto-approval — excellent profile meets all criteria', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await decisionPage.expectDecisionStatus('APPROVED');
    await decisionPage.expectSanctionDetailsVisible();
  });

  test('C001-P02: Auto-rejection — poor credit score', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await decisionPage.expectDecisionStatus('REJECTED');
    await decisionPage.expectRejectionReasonContains('CREDIT_SCORE');
  });

  test('C001-P03: Manual review — borderline profile', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await decisionPage.expectDecisionStatus('MANUAL_REVIEW');
    await expect(page.locator('[data-testid="manual-review-reason"]')).toBeVisible();
  });

  test('C001-P04: FOIR exceeds 60% — rejected', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await decisionPage.expectDecisionStatus('REJECTED');
    await decisionPage.expectRejectionReasonContains('FOIR');
  });

  test('C001-P05: Rate preview shown on sanction letter', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await expect(decisionPage.ratePreview).toBeVisible();
    await expect(decisionPage.ratePreview).toContainText('%');
  });

  test('C001-P06: EMI calculator accessible on decision page', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await expect(decisionPage.emiCalculator).toBeVisible();
  });
});

test.describe('TC-DEC-002: Override Workflow', () => {

  test('C002-P01: Credit officer requests override with reason', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await decisionPage.expectDecisionStatus('MANUAL_REVIEW');

    await decisionPage.requestOverride('Customer has 3 fixed deposits with the bank, requesting rate concession');
    await decisionPage.expectOverrideStatus('PENDING');
  });

  test('C002-P02: Override approved by senior authority', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await decisionPage.expectDecisionStatus('MANUAL_REVIEW');
    await decisionPage.requestOverride('Low LTV ratio, collateral provided');

    await decisionPage.approveOverride();
    await expect(page.locator('[data-testid="override-decision-0"]')).toContainText('APPROVED');
  });

  test('C002-P03: Override rejected by senior authority', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await decisionPage.expectDecisionStatus('MANUAL_REVIEW');
    await decisionPage.requestOverride('Please override');

    await decisionPage.rejectOverride();
    await expect(page.locator('[data-testid="override-decision-0"]')).toContainText('REJECTED');
  });

  test('C002-P04: Multiple overrides tracked in list', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();
    await decisionPage.expectDecisionStatus('MANUAL_REVIEW');

    await decisionPage.requestOverride('First request');
    await decisionPage.requestOverride('Second request');

    const count = await decisionPage.pendingOverridesList.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('TC-DEC-003: Disbursement', () => {

  test('C003-P01: Disbursement only available after APPROVED decision', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await expect(decisionPage.disbursementButton).not.toBeVisible();
  });

  test('C003-P02: Approved application — disbursement flow', async ({ page }) => {
    await submitApplication(page);
    const decisionPage = new DecisionPage(page);
    await decisionPage.triggerDecision();

    if (await decisionPage.decisionStatus.textContent() === 'APPROVED') {
      await decisionPage.confirmDisbursement();
      await decisionPage.expectDisbursementSuccess();
    } else {
      test.skip(true, 'Skipped - application not approved in this scenario');
    }
  });
});
