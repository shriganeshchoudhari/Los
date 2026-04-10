# E2E Automation Setup Guide
## Loan Origination System (LOS) — Playwright Test Suite
**Framework:** Playwright 1.43 | **Language:** TypeScript | **Node:** 20 LTS

---

## 1. Prerequisites

```bash
# System requirements
node --version    # ≥ 20.0.0
npm --version     # ≥ 10.0.0
git --version     # ≥ 2.40.0

# Install Playwright and dependencies
npm install -D @playwright/test
npx playwright install --with-deps chromium firefox webkit
```

---

## 2. Project Structure

```
los-e2e/
├── playwright.config.ts
├── .env.test                    # Test environment variables
├── .env.uat                     # UAT environment variables
├── package.json
├── tsconfig.json
├── fixtures/
│   ├── auth.fixture.ts          # Authenticated page fixtures
│   ├── application.fixture.ts   # Application seeding fixtures
│   └── mock-data/
│       ├── uidai_kyc_success.xml
│       ├── cibil_750_clean.json
│       └── pan_valid.json
├── pages/                       # Page Object Model
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   ├── ApplicationFormPage.ts
│   ├── KYCPage.ts
│   ├── DocumentUploadPage.ts
│   ├── DecisionPage.ts
│   └── DisbursementPage.ts
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── rbac.spec.ts
│   ├── application/
│   │   ├── create-application.spec.ts
│   │   ├── document-upload.spec.ts
│   │   └── duplicate-detection.spec.ts
│   ├── kyc/
│   │   ├── aadhaar-ekyc.spec.ts
│   │   └── pan-verification.spec.ts
│   ├── decision/
│   │   ├── auto-approval.spec.ts
│   │   └── manual-override.spec.ts
│   ├── disbursement/
│   │   └── imps-disbursement.spec.ts
│   └── e2e/
│       ├── personal-loan-stp.spec.ts    # Full STP flow
│       ├── home-loan-full.spec.ts       # Full home loan flow
│       └── rejection-flow.spec.ts       # Rejection path
├── utils/
│   ├── api-helpers.ts           # Direct API calls for test setup
│   ├── db-helpers.ts            # DB seeding/cleanup
│   ├── crypto-helpers.ts        # Aadhaar encryption for tests
│   └── wait-helpers.ts          # Custom wait utilities
└── reports/                     # Auto-generated HTML reports
```

---

## 3. Configuration

### playwright.config.ts
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 60000,              // 60s per test
  expect: { timeout: 10000 },  // 10s for assertions

  reporter: [
    ['html', { open: 'never', outputFolder: 'reports/html' }],
    ['junit', { outputFile: 'reports/results.xml' }],
    ['list']
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://uat.los.bank.in',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    extraHTTPHeaders: {
      'X-Test-Mode': 'true',    // Tells backend to use test doubles for UIDAI/CIBIL
    }
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] }
    }
  ]
});
```

### .env.test
```bash
BASE_URL=https://uat.los.bank.in
API_BASE_URL=https://api.uat.los.bank.in/v1
DB_HOST=localhost
DB_PORT=5432
DB_NAME=los_test
DB_USER=los_test_user
DB_PASSWORD=test_password_not_prod

# Test user credentials
TEST_APPLICANT_MOBILE=9000000001
TEST_OFFICER_MOBILE=9000000002
TEST_MANAGER_MOBILE=9000000003
TEST_ANALYST_MOBILE=9000000004

# Mock OTP (UAT environment always accepts this OTP)
TEST_OTP=123456

# Test Aadhaar (UIDAI sandbox — always returns success)
TEST_AADHAAR=999999990019
TEST_PAN=TESTP1234Z
```

---

## 4. Page Object Models

### pages/LoginPage.ts
```typescript
import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await expect(this.page).toHaveTitle(/Loan Origination System/);
  }

  async enterMobile(mobile: string) {
    await this.page.getByLabel('Mobile Number').fill(mobile);
    await this.page.getByRole('button', { name: 'Send OTP' }).click();
    await expect(this.page.getByText('OTP sent to')).toBeVisible();
  }

  async enterOTP(otp: string) {
    // OTP input: 6 individual digit boxes
    for (let i = 0; i < 6; i++) {
      await this.page.locator(`[data-testid="otp-input-${i}"]`).fill(otp[i]);
    }
    await this.page.getByRole('button', { name: 'Verify OTP' }).click();
  }

  async login(mobile: string, otp: string = '123456') {
    await this.goto();
    await this.enterMobile(mobile);
    await this.enterOTP(otp);
    await expect(this.page).toHaveURL(/dashboard/);
  }
}
```

### pages/ApplicationFormPage.ts
```typescript
import { Page, expect } from '@playwright/test';

export class ApplicationFormPage {
  constructor(private page: Page) {}

  async selectLoanType(type: string) {
    await this.page.getByTestId('loan-type-selector').click();
    await this.page.getByRole('option', { name: type }).click();
    await expect(this.page.getByTestId('loan-type-selected')).toContainText(type);
  }

  async fillPersonalDetails(data: {
    fullName: string;
    dob: string;
    gender: string;
    maritalStatus: string;
  }) {
    await this.page.getByLabel('Full Name').fill(data.fullName);
    await this.page.getByLabel('Date of Birth').fill(data.dob);
    await this.page.getByLabel('Gender').selectOption(data.gender);
    await this.page.getByLabel('Marital Status').selectOption(data.maritalStatus);
  }

  async fillEmploymentDetails(data: {
    type: string;
    employer: string;
    grossIncome: number;
    netIncome: number;
  }) {
    await this.page.getByLabel('Employment Type').selectOption(data.type);
    if (data.employer) {
      await this.page.getByLabel('Employer Name').fill(data.employer);
    }
    await this.page.getByLabel('Gross Monthly Income').fill(data.grossIncome.toString());
    await this.page.getByLabel('Net Monthly Income').fill(data.netIncome.toString());
  }

  async fillLoanRequirement(data: {
    amount: number;
    tenure: number;
    purpose?: string;
  }) {
    await this.page.getByLabel('Loan Amount').fill(data.amount.toString());
    await this.page.getByLabel('Tenure (Months)').fill(data.tenure.toString());
    if (data.purpose) {
      await this.page.getByLabel('Purpose').fill(data.purpose);
    }
  }

  async getFOIRPreview(): Promise<number> {
    const foirText = await this.page.getByTestId('foir-preview').textContent();
    return parseFloat(foirText!.replace('%', ''));
  }

  async submitApplication() {
    await this.page.getByRole('button', { name: 'Submit Application' }).click();
    await this.page.getByRole('button', { name: 'Confirm Submit' }).click();
    await expect(this.page.getByTestId('application-submitted-banner')).toBeVisible();
    const appNumber = await this.page.getByTestId('application-number').textContent();
    return appNumber!.trim();
  }
}
```

### pages/KYCPage.ts
```typescript
import { Page, expect } from '@playwright/test';

export class KYCPage {
  constructor(private page: Page) {}

  async initiateAadhaarKYC(aadhaarNumber: string) {
    await this.page.getByTestId('aadhaar-input').fill(aadhaarNumber);
    await this.page.getByRole('checkbox', { name: /I consent/ }).check();
    await this.page.getByRole('button', { name: 'Send Aadhaar OTP' }).click();
    await expect(this.page.getByText('OTP sent to your Aadhaar-linked mobile')).toBeVisible({ timeout: 10000 });
  }

  async verifyAadhaarOTP(otp: string) {
    for (let i = 0; i < 6; i++) {
      await this.page.locator(`[data-testid="aadhaar-otp-${i}"]`).fill(otp[i]);
    }
    await this.page.getByRole('button', { name: 'Verify Aadhaar OTP' }).click();
    await expect(this.page.getByTestId('aadhaar-verified-badge')).toBeVisible({ timeout: 15000 });
  }

  async verifyPAN(panNumber: string) {
    await this.page.getByLabel('PAN Number').fill(panNumber);
    await this.page.getByRole('button', { name: 'Verify PAN' }).click();
    await expect(this.page.getByTestId('pan-verified-badge')).toBeVisible({ timeout: 10000 });
  }

  async captureSelfie() {
    // Trigger file upload for selfie (in test env, upload pre-approved test image)
    await this.page.getByTestId('selfie-upload').setInputFiles('./fixtures/mock-data/test_selfie.jpg');
    await this.page.getByRole('button', { name: 'Verify Face' }).click();
    await expect(this.page.getByTestId('face-match-passed')).toBeVisible({ timeout: 20000 });
  }

  async getKYCStatus(): Promise<string> {
    return await this.page.getByTestId('kyc-status-badge').textContent() || '';
  }
}
```

### pages/DocumentUploadPage.ts
```typescript
import { Page, expect } from '@playwright/test';
import path from 'path';

export class DocumentUploadPage {
  constructor(private page: Page) {}

  async getRequiredDocuments(): Promise<string[]> {
    const items = await this.page.getByTestId('document-checklist-item').all();
    return Promise.all(items.map(item => item.textContent()));
  }

  async uploadDocument(documentType: string, filePath: string) {
    const uploadBtn = this.page.getByTestId(`upload-${documentType}`);
    await uploadBtn.setInputFiles(path.resolve(filePath));

    // Wait for upload + OCR processing
    await expect(this.page.getByTestId(`doc-status-${documentType}`))
      .toContainText(/OCR Processing|Approved/, { timeout: 30000 });
  }

  async getOCRExtractedData(documentType: string): Promise<Record<string, string>> {
    await this.page.getByTestId(`ocr-preview-${documentType}`).click();
    const dataItems = await this.page.getByTestId('ocr-field').all();
    const data: Record<string, string> = {};
    for (const item of dataItems) {
      const label = await item.getByTestId('ocr-field-label').textContent();
      const value = await item.getByTestId('ocr-field-value').textContent();
      if (label && value) data[label] = value;
    }
    return data;
  }

  async confirmAllDocumentsReady(): Promise<boolean> {
    const allApproved = await this.page.getByTestId('all-documents-approved').isVisible();
    return allApproved;
  }
}
```

---

## 5. Test Fixtures

### fixtures/auth.fixture.ts
```typescript
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

type AuthFixtures = {
  applicantPage: Page;
  officerPage: Page;
  managerPage: Page;
};

export const test = base.extend<AuthFixtures>({
  applicantPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const loginPage = new LoginPage(page);
    await loginPage.login(process.env.TEST_APPLICANT_MOBILE!, process.env.TEST_OTP!);
    await use(page);
    await ctx.close();
  },

  officerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const loginPage = new LoginPage(page);
    await loginPage.login(process.env.TEST_OFFICER_MOBILE!, process.env.TEST_OTP!);
    await use(page);
    await ctx.close();
  },

  managerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const loginPage = new LoginPage(page);
    await loginPage.login(process.env.TEST_MANAGER_MOBILE!, process.env.TEST_OTP!);
    await use(page);
    await ctx.close();
  }
});
```

---

## 6. Running Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/personal-loan-stp.spec.ts

# Run with specific project (browser)
npx playwright test --project=chromium

# Run in headed mode (see browser)
npx playwright test --headed

# Run with debug
npx playwright test --debug tests/kyc/aadhaar-ekyc.spec.ts

# Generate HTML report
npx playwright show-report reports/html

# Run in CI mode
CI=true npx playwright test --workers=4

# Run specific tag
npx playwright test --grep "@critical"

# Update snapshots
npx playwright test --update-snapshots
```

---

## 7. CI/CD Integration

### GitHub Actions Workflow
```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Run E2E Tests
        env:
          BASE_URL: ${{ secrets.UAT_BASE_URL }}
          TEST_OTP: ${{ secrets.TEST_OTP }}
        run: npx playwright test --workers=4
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: reports/html/
          retention-days: 14
```

---

## 8. Debugging Failed Tests

```bash
# View trace of failed test
npx playwright show-trace reports/traces/test-failed.zip

# Re-run only failed tests
npx playwright test --last-failed

# Slow motion mode
PWDEBUG=1 npx playwright test --slow-mo=500

# Capture video for all tests
npx playwright test --video=on
```

---
*End of E2E Automation Setup Guide*
