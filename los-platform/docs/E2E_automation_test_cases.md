# E2E Automation Test Cases
## Loan Origination System (LOS) — Playwright Tests
**Framework:** Playwright 1.43 | **Language:** TypeScript

---

## TC-E2E-001: Personal Loan STP — Full Happy Path

```typescript
import { test, expect } from '../fixtures/auth.fixture';
import { ApplicationFormPage } from '../pages/ApplicationFormPage';
import { KYCPage } from '../pages/KYCPage';
import { DocumentUploadPage } from '../pages/DocumentUploadPage';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Personal Loan — Straight Through Processing', () => {
  test('@critical TC-E2E-001: Complete STP from application to disbursement', async ({ applicantPage }) => {
    // Step 1: Navigate to new application
    const dashboard = new DashboardPage(applicantPage);
    await dashboard.clickApplyForLoan();

    // Step 2: Fill application
    const form = new ApplicationFormPage(applicantPage);
    await form.selectLoanType('Personal Loan');
    await form.fillPersonalDetails({
      fullName: 'Ravi Kumar Sharma',
      dob: '21/04/1990',
      gender: 'Male',
      maritalStatus: 'Married'
    });
    await form.fillEmploymentDetails({
      type: 'Salaried - Private',
      employer: 'Infosys Limited',
      grossIncome: 120000,
      netIncome: 95000
    });
    await form.fillLoanRequirement({ amount: 500000, tenure: 36, purpose: 'Medical emergency' });

    // Verify FOIR preview
    const foir = await form.getFOIRPreview();
    expect(foir).toBeLessThan(55);

    const appNumber = await form.submitApplication();
    expect(appNumber).toMatch(/^LOS-\d{4}-[A-Z]{2}-\d{6}$/);

    // Step 3: Complete KYC
    const kyc = new KYCPage(applicantPage);
    await applicantPage.goto(`/kyc/${appNumber}`);
    await kyc.initiateAadhaarKYC(process.env.TEST_AADHAAR!);
    await kyc.verifyAadhaarOTP(process.env.TEST_OTP!);
    await kyc.verifyPAN(process.env.TEST_PAN!);
    await kyc.captureSelfie();

    const kycStatus = await kyc.getKYCStatus();
    expect(kycStatus).toBe('KYC Complete');

    // Step 4: Upload Documents
    const docs = new DocumentUploadPage(applicantPage);
    await applicantPage.goto(`/documents/${appNumber}`);

    const required = await docs.getRequiredDocuments();
    expect(required).toContain('Salary Slip (Month 1)');

    await docs.uploadDocument('SALARY_SLIP_1', './fixtures/mock-data/salary_slip_jun.pdf');
    await docs.uploadDocument('SALARY_SLIP_2', './fixtures/mock-data/salary_slip_may.pdf');
    await docs.uploadDocument('SALARY_SLIP_3', './fixtures/mock-data/salary_slip_apr.pdf');
    await docs.uploadDocument('BANK_STATEMENT_3M', './fixtures/mock-data/bank_stmt_3m.pdf');

    // Wait for OCR to process all documents
    await expect(applicantPage.getByTestId('all-documents-ready')).toBeVisible({ timeout: 60000 });

    // Step 5: Wait for Decision
    await applicantPage.goto(`/applications/${appNumber}/status`);
    await expect(applicantPage.getByTestId('status-badge'))
      .toContainText('Approved', { timeout: 30000 });

    // Step 6: Review and accept sanction
    await applicantPage.getByRole('button', { name: 'View Sanction Letter' }).click();
    await expect(applicantPage.getByTestId('sanction-amount')).toContainText('₹5,00,000');
    await expect(applicantPage.getByTestId('sanction-roi')).toContainText('10.75%');
    await expect(applicantPage.getByTestId('emi-amount')).toContainText('₹16,285');

    await applicantPage.getByRole('button', { name: 'Accept and Sign' }).click();
    // e-Sign via Aadhaar OTP
    await kyc.verifyAadhaarOTP(process.env.TEST_OTP!);
    await expect(applicantPage.getByTestId('agreement-signed-badge')).toBeVisible();

    // Step 7: Enter repayment account
    await applicantPage.getByLabel('Account Number').fill('30123456789');
    await applicantPage.getByLabel('IFSC Code').fill('SBIN0001234');
    await applicantPage.getByRole('button', { name: 'Verify Account' }).click();
    await expect(applicantPage.getByTestId('account-verified-badge')).toBeVisible({ timeout: 15000 });

    // Step 8: Verify disbursement (officer action — use officer fixture via API)
    // In UAT, disbursement auto-processes in test mode
    await expect(applicantPage.getByTestId('disbursement-success-banner'))
      .toBeVisible({ timeout: 120000 }); // Allow up to 2 min for IMPS

    const utr = await applicantPage.getByTestId('utr-number').textContent();
    expect(utr).toMatch(/^[A-Z]{4}\d{12,20}$/);

    // Verify notification received
    await applicantPage.goto('/notifications');
    await expect(applicantPage.getByTestId('notif-DISBURSEMENT_SUCCESS')).toBeVisible();
  });
});
```

---

## TC-E2E-002: KYC Failure — UIDAI Unavailable

```typescript
test('@critical TC-E2E-002: Should show user-friendly error when UIDAI is down', async ({ applicantPage }) => {
  // Force circuit open via test API
  await applicantPage.request.post('/api/test/circuit-breakers/UIDAI/open');

  const appNumber = await createAndSubmitApplication(applicantPage);
  const kyc = new KYCPage(applicantPage);

  await applicantPage.goto(`/kyc/${appNumber}`);
  await kyc.initiateAadhaarKYC(process.env.TEST_AADHAAR!);

  // Should show user-friendly error, not raw 503
  await expect(applicantPage.getByTestId('kyc-error-banner')).toBeVisible();
  await expect(applicantPage.getByTestId('kyc-error-message'))
    .toContainText('Aadhaar service is temporarily unavailable. Please try again in a few minutes.');

  // Retry button present
  await expect(applicantPage.getByRole('button', { name: 'Retry' })).toBeVisible();

  // Restore circuit
  await applicantPage.request.post('/api/test/circuit-breakers/UIDAI/close');
});
```

---

## TC-E2E-003: Document Upload — OCR Failure Handling

```typescript
test('TC-E2E-003: Should prompt re-upload when OCR fails', async ({ applicantPage }) => {
  const appNumber = await createKYCCompleteApplication(applicantPage);
  const docs = new DocumentUploadPage(applicantPage);
  await applicantPage.goto(`/documents/${appNumber}`);

  // Upload blurry image
  await docs.uploadDocument('SALARY_SLIP_1', './fixtures/mock-data/blurry_salary_slip.jpg');

  // Should show OCR failure message
  await expect(applicantPage.getByTestId('doc-status-SALARY_SLIP_1'))
    .toContainText('OCR Failed', { timeout: 30000 });

  await expect(applicantPage.getByTestId('ocr-failure-hint'))
    .toContainText('Image quality too low');

  // Should offer re-upload
  const reUploadBtn = applicantPage.getByTestId('reupload-SALARY_SLIP_1');
  await expect(reUploadBtn).toBeVisible();

  // Re-upload with good image
  await reUploadBtn.setInputFiles('./fixtures/mock-data/salary_slip_jun.pdf');
  await expect(applicantPage.getByTestId('doc-status-SALARY_SLIP_1'))
    .toContainText('Approved', { timeout: 30000 });
});
```

---

## TC-E2E-004: Decision — Rejection Flow

```typescript
test('@critical TC-E2E-004: Rejection should display clear reason and next steps', async ({ applicantPage }) => {
  // Create application with rejection profile (CIBIL 580)
  const appNumber = await createApplicationWithProfile(applicantPage, 'REJECTION_PROFILE');

  await waitForApplicationStatus(applicantPage, appNumber, 'Rejected', 60000);

  await applicantPage.goto(`/applications/${appNumber}/decision`);

  // Verify rejection reason shown
  await expect(applicantPage.getByTestId('decision-status')).toContainText('Application Rejected');
  await expect(applicantPage.getByTestId('rejection-reason'))
    .toContainText('Credit Score Below Minimum');

  // Verify appeal / grievance option shown
  await expect(applicantPage.getByRole('button', { name: 'Raise Grievance' })).toBeVisible();
  await expect(applicantPage.getByRole('link', { name: 'View Decision Letter' })).toBeVisible();

  // Decision letter should be downloadable PDF
  const downloadPromise = applicantPage.waitForEvent('download');
  await applicantPage.getByRole('link', { name: 'View Decision Letter' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/decision-letter.*\.pdf/);
});
```

---

## TC-E2E-005: Officer Worklist — Assign and Process

```typescript
test('TC-E2E-005: Loan officer can manage worklist efficiently', async ({ officerPage }) => {
  // Seed 5 applications in UNDER_PROCESSING
  await seedApplicationsForOfficer(5);

  await officerPage.goto('/officer/worklist');

  // Verify worklist loads
  const appRows = officerPage.getByTestId('worklist-row');
  expect(await appRows.count()).toBeGreaterThanOrEqual(5);

  // Sort by submission date
  await officerPage.getByTestId('sort-submitted-at').click();

  // Filter by loan type
  await officerPage.getByTestId('filter-loan-type').selectOption('PERSONAL_LOAN');
  await officerPage.getByRole('button', { name: 'Apply Filter' }).click();

  // Open first application
  await appRows.first().click();

  // Verify all sections loaded
  await expect(officerPage.getByTestId('applicant-details-section')).toBeVisible();
  await expect(officerPage.getByTestId('bureau-summary-section')).toBeVisible();
  await expect(officerPage.getByTestId('decision-recommendation-section')).toBeVisible();

  // Verify FOIR and credit score prominently displayed
  await expect(officerPage.getByTestId('credit-score-display')).toBeVisible();
  await expect(officerPage.getByTestId('foir-display')).toBeVisible();
});
```

---

## TC-E2E-006: Branch Manager — Sanction Workflow

```typescript
test('@critical TC-E2E-006: Branch manager maker-checker sanction flow', async ({ officerPage, managerPage }) => {
  const appId = await createApprovedApplication();

  // Officer (maker) initiates sanction
  await officerPage.goto(`/applications/${appId}/sanction`);
  await officerPage.getByRole('button', { name: 'Initiate Sanction' }).click();
  await officerPage.getByTestId('sanction-remarks').fill('Verified all documents. Recommend sanction.');
  await officerPage.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(officerPage.getByText('Pending Checker Approval')).toBeVisible();

  // Manager (checker) approves
  await managerPage.goto('/manager/pending-sanctions');
  await managerPage.getByTestId(`sanction-item-${appId}`).click();

  // Verify sanction details visible
  await expect(managerPage.getByTestId('sanction-amount')).toBeVisible();
  await expect(managerPage.getByTestId('decision-summary')).toBeVisible();
  await expect(managerPage.getByTestId('bureau-summary')).toBeVisible();

  await managerPage.getByTestId('sanction-approve-btn').click();
  await managerPage.getByTestId('manager-remarks').fill('Approved. Within delegation authority.');
  await managerPage.getByRole('button', { name: 'Confirm Approval' }).click();

  // Verify sanction letter generated
  await expect(managerPage.getByTestId('sanction-letter-generated')).toBeVisible();
  await expect(managerPage.getByTestId('applicant-notified-badge')).toBeVisible();
});
```

---

## TC-E2E-007: Mobile Responsiveness — Applicant Journey

```typescript
test('TC-E2E-007: Application form works on mobile viewport', async ({ browser }) => {
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 }, // iPhone 14
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
  });
  const page = await mobileContext.newPage();

  // Login
  const loginPage = new LoginPage(page);
  await loginPage.login(process.env.TEST_APPLICANT_MOBILE!);

  // Navigate to apply
  await page.goto('/apply');

  // Verify no horizontal scroll
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // 5px tolerance

  // Verify touch targets large enough (min 44×44px per WCAG)
  const submitBtn = page.getByRole('button', { name: 'Submit Application' });
  const box = await submitBtn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);

  await mobileContext.close();
});
```

---

## TC-E2E-008: Compliance — Consent Flow

```typescript
test('@critical TC-E2E-008: Consent must be explicitly captured before bureau pull', async ({ applicantPage }) => {
  const appNumber = await createKYCCompleteApplication(applicantPage);

  // Verify bureau pull blocked until consent given
  await applicantPage.goto(`/applications/${appNumber}/bureau`);
  const pullBtn = applicantPage.getByRole('button', { name: 'Pull Credit Report' });
  await expect(pullBtn).toBeDisabled();

  // Consent section visible
  await expect(applicantPage.getByTestId('bureau-consent-section')).toBeVisible();
  await expect(applicantPage.getByTestId('consent-text'))
    .toContainText('I authorize the bank to obtain my credit information');

  // Check consent checkbox + enter OTP
  await applicantPage.getByRole('checkbox', { name: /I consent/ }).check();
  await applicantPage.getByRole('button', { name: 'Confirm with OTP' }).click();
  await applicantPage.getByTestId('consent-otp-input').fill(process.env.TEST_OTP!);
  await applicantPage.getByRole('button', { name: 'Verify' }).click();

  await expect(applicantPage.getByTestId('consent-confirmed-badge')).toBeVisible();
  await expect(pullBtn).toBeEnabled();
});
```

---

## TC-E2E-009: Notification — SMS + In-App

```typescript
test('TC-E2E-009: Applicant receives notifications at key stages', async ({ applicantPage }) => {
  const appNumber = await createAndSubmitApplication(applicantPage);

  // Navigate to notifications panel
  await applicantPage.goto('/notifications');
  const notifBell = applicantPage.getByTestId('notification-bell');
  await notifBell.click();

  // Should have APPLICATION_RECEIVED notification
  await expect(applicantPage.getByTestId('notif-APPLICATION_RECEIVED')).toBeVisible({ timeout: 10000 });

  const notifContent = await applicantPage.getByTestId('notif-APPLICATION_RECEIVED').textContent();
  expect(notifContent).toContain(appNumber);

  // Verify notification count badge
  const badge = applicantPage.getByTestId('notification-count-badge');
  const count = parseInt(await badge.textContent() || '0');
  expect(count).toBeGreaterThan(0);

  // Mark as read
  await applicantPage.getByTestId('mark-all-read').click();
  await expect(badge).not.toBeVisible();
});
```

---

## TC-E2E-010: Accessibility — WCAG 2.1 AA

```typescript
import AxeBuilder from '@axe-core/playwright';

test('TC-E2E-010: Application form meets WCAG 2.1 AA standards', async ({ applicantPage }) => {
  await applicantPage.goto('/apply/personal-loan');

  const results = await new AxeBuilder({ page: applicantPage })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  // Log violations for report
  if (results.violations.length > 0) {
    console.log('Accessibility violations:', JSON.stringify(results.violations, null, 2));
  }

  expect(results.violations).toHaveLength(0);
});
```

---

## Test Utilities

```typescript
// utils/wait-helpers.ts
export async function waitForApplicationStatus(
  page: Page,
  appNumber: string,
  expectedStatus: string,
  timeout: number = 30000
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    await page.goto(`/applications/${appNumber}/status`);
    const status = await page.getByTestId('status-badge').textContent();
    if (status?.includes(expectedStatus)) return;
    await page.waitForTimeout(3000); // Poll every 3s
  }
  throw new Error(`Application did not reach status '${expectedStatus}' within ${timeout}ms`);
}

// utils/api-helpers.ts
export async function createApplicationWithProfile(
  page: Page,
  profileType: 'REJECTION_PROFILE' | 'APPROVAL_PROFILE' | 'MANUAL_REVIEW_PROFILE'
): Promise<string> {
  const response = await page.request.post('/api/test/seed/application', {
    data: { profileType }
  });
  const data = await response.json();
  return data.applicationNumber;
}
```

---
*End of E2E Automation Test Cases*
