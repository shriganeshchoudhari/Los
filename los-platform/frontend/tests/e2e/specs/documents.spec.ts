import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { ApplicationFormPage } from '../pages/application-form.page';
import { DocumentsPage } from '../pages/documents.page';
import { generateUniqueMobile } from '../test-data';

async function createApplication(page: any): Promise<void> {
  const mobile = generateUniqueMobile();
  await new LoginPage(page).loginWithOtp(mobile);
  await new DashboardPage(page).openNewApplication();
  const applicationPage = new ApplicationFormPage(page);
  await applicationPage.fillStep1_PersonalDetails({ loanType: 'PERSONAL_LOAN', fullName: 'Doc Test User', dob: '1990-04-21' });
  await applicationPage.nextStep();
  await applicationPage.fillStep2_EmploymentDetails({ employmentType: 'SALARIED_PRIVATE', grossIncome: 120000, netIncome: 95000 });
  await applicationPage.nextStep();
  await applicationPage.fillStep3_LoanRequirement({ loanAmount: 500000, tenureMonths: 36 });
  await applicationPage.submitApplication();
}

test.describe('TC-DOC-001: Document Upload Flow', () => {

  test('C001-P01: Upload salary slip — success', async ({ page }) => {
    await createApplication(page);
    const documentsPage = new DocumentsPage(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();

    await documentsPage.uploadDocument('salary-slip', './fixtures/salary_slip.pdf');
    await documentsPage.expectUploadProgress();
    await documentsPage.expectUploadSuccess();
  });

  test('C001-P02: Upload salary slip — oversized file rejected', async ({ page }) => {
    await createApplication(page);
    const documentsPage = new DocumentsPage(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();

    await documentsPage.uploadDocument('salary-slip', './fixtures/oversized_file.pdf');
    await documentsPage.expectFileSizeErrorContains('exceeds 10MB');
  });

  test('C001-P03: Upload unsupported MIME type rejected', async ({ page }) => {
    await createApplication(page);
    const documentsPage = new DocumentsPage(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();

    await documentsPage.uploadDocument('salary-slip', './fixtures/document.txt');
    await expect(page.locator('[data-testid="mime-type-error"]')).toContainText('File type not allowed');
  });

  test('C001-P04: All required documents uploaded — checklist completion', async ({ page }) => {
    await createApplication(page);
    const documentsPage = new DocumentsPage(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();

    const requiredDocs = ['salary-slip', 'bank-statement', 'pan-card', 'address-proof', 'photo'];
    for (const doc of requiredDocs) {
      await documentsPage.uploadDocument(doc, `./fixtures/${doc}.pdf`);
      await documentsPage.expectUploadSuccess();
    }

    await expect(documentsPage.checklistSection).toBeVisible();
    const completedCount = await documentsPage.checklistItem.filter({ hasText: '✓' }).count();
    expect(completedCount).toBe(requiredDocs.length);
  });

  test('C001-P05: Duplicate upload of same type increments version', async ({ page }) => {
    await createApplication(page);
    const documentsPage = new DocumentsPage(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();

    await documentsPage.uploadDocument('salary-slip', './fixtures/salary_slip_v1.pdf');
    await documentsPage.expectUploadSuccess();

    await documentsPage.uploadDocument('salary-slip', './fixtures/salary_slip_v2.pdf');
    await documentsPage.expectUploadSuccess();

    const salaryDocs = await page.locator('[data-testid="doc-type-SALARY_SLIP"]').count();
    expect(salaryDocs).toBe(2);
  });

  test('C001-P06: Bank statement upload — 6-month history required', async ({ page }) => {
    await createApplication(page);
    const documentsPage = new DocumentsPage(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();

    await documentsPage.uploadDocument('bank-statement', './fixtures/bank_statement_3months.pdf');
    await expect(page.locator('[data-testid="doc-validation-error"]')).toContainText('6 months of history required');
  });
});

test.describe('TC-DOC-002: Document Review Workflow', () => {

  test('C002-P01: Reviewer approves document', async ({ page }) => {
    const documentsPage = new DocumentsPage(page);
    await createApplication(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();
    await documentsPage.uploadDocument('salary-slip', './fixtures/salary_slip.pdf');
    await documentsPage.expectUploadSuccess();

    await documentsPage.reviewDocument(0, 'APPROVED');
    await expect(page.locator('[data-testid="doc-review-status-0"]')).toContainText('APPROVED');
  });

  test('C002-P02: Reviewer rejects document with reason', async ({ page }) => {
    const documentsPage = new DocumentsPage(page);
    await createApplication(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();
    await documentsPage.uploadDocument('salary-slip', './fixtures/salary_slip_blurry.pdf');
    await documentsPage.expectUploadSuccess();

    await documentsPage.reviewDocument(0, 'REJECTED', 'Document is illegible, please resubmit');
    await expect(page.locator('[data-testid="doc-review-status-0"]')).toContainText('REJECTED');
  });

  test('C002-P03: Rejection without reason blocked', async ({ page }) => {
    const documentsPage = new DocumentsPage(page);
    await createApplication(page);
    await documentsPage.gotoApplication('');
    await documentsPage.documentsTab.click();
    await documentsPage.uploadDocument('salary-slip', './fixtures/salary_slip.pdf');
    await documentsPage.expectUploadSuccess();

    await page.locator('[data-testid="review-doc-button"]').first().click();
    await page.locator('[data-testid="reject-doc-button"]').click();
    await page.locator('[data-testid="submit-review-button"]').click();
    await expect(page.locator('[data-testid="rejection-reason-error"]')).toContainText('Reason is required');
  });
});
