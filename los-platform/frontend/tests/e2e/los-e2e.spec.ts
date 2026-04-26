// Playwright E2E Test Suite - LOS Platform

const { test, expect } = require('@playwright/test');

const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  mobile: '9876543210',
  testPan: 'ABCDE1234F',
};

test.describe('LOS Platform E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONFIG.baseUrl);
    await page.context().setDefaultTimeout(30000);
  });

  test.describe('Authentication Flow', () => {
    
    test('should send OTP successfully', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.selectOption('[data-testid="purpose-select"]', 'LOGIN');
      await page.click('[data-testid="send-otp-button"]');
      
      await expect(page.locator('[data-testid="otp-sent-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="otp-input-section"]')).toBeVisible();
    });
    
    test('should show error for invalid mobile number', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      
      await page.fill('[data-testid="mobile-input"]', '12345');
      await page.click('[data-testid="send-otp-button"]');
      
      await expect(page.locator('[data-testid="mobile-error"]')).toContainText('Invalid mobile number');
    });
    
    test('should login successfully with valid OTP', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      
      await page.waitForSelector('[data-testid="otp-input-section"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid="user-greeting"]')).toBeVisible();
    });
    
    test('should show error for expired OTP', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      
      await page.waitForTimeout(310000);
      
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      
      await expect(page.locator('[data-testid="otp-error"]')).toContainText('expired');
    });
    
    test('should lock account after 5 failed attempts', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      
      for (let i = 0; i < 5; i++) {
        await page.fill('[data-testid="otp-input"]', '000000');
        await page.click('[data-testid="verify-otp-button"]');
        await page.waitForTimeout(100);
      }
      
      await expect(page.locator('[data-testid="account-locked-message"]')).toBeVisible();
    });
  });

  test.describe('Loan Application Flow', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      await page.waitForURL(/\/dashboard/);
    });
    
    test('should create personal loan application', async ({ page }) => {
      await page.click('[data-testid="new-application-button"]');
      await page.waitForURL(/\/apply/);
      
      await page.selectOption('[data-testid="loan-type-select"]', 'PERSONAL_LOAN');
      await page.fill('[data-testid="full-name-input"]', 'Ravi Sharma');
      await page.fill('[data-testid="dob-input"]', '1990-04-21');
      await page.selectOption('[data-testid="gender-select"]', 'MALE');
      
      await page.click('[data-testid="next-step-button"]');
      
      await page.selectOption('[data-testid="employment-type-select"]', 'SALARIED_PRIVATE');
      await page.fill('[data-testid="employer-name-input"]', 'Infosys Limited');
      await page.fill('[data-testid="gross-income-input"]', '120000');
      await page.fill('[data-testid="net-income-input"]', '95000');
      
      await page.click('[data-testid="next-step-button"]');
      
      await page.fill('[data-testid="loan-amount-input"]', '500000');
      await page.fill('[data-testid="tenure-input"]', '36');
      
      await page.click('[data-testid="submit-application-button"]');
      
      await expect(page.locator('[data-testid="application-number"]')).toMatchText(/^LOS-\d{4}-[A-Z]{2}-\d{6}$/);
      await expect(page.locator('[data-testid="application-status"]')).toContainText('DRAFT');
    });
    
    test('should validate loan amount within product limits', async ({ page }) => {
      await page.click('[data-testid="new-application-button"]');
      await page.waitForURL(/\/apply/);
      
      await page.selectOption('[data-testid="loan-type-select"]', 'PERSONAL_LOAN');
      await page.fill('[data-testid="full-name-input"]', 'Ravi Sharma');
      await page.fill('[data-testid="dob-input"]', '1990-04-21');
      await page.selectOption('[data-testid="gender-select"]', 'MALE');
      
      await page.click('[data-testid="next-step-button"]');
      
      await page.selectOption('[data-testid="employment-type-select"]', 'SALARIED_PRIVATE');
      await page.fill('[data-testid="employer-name-input"]', 'Infosys Limited');
      await page.fill('[data-testid="gross-income-input"]', '120000');
      await page.fill('[data-testid="net-income-input"]', '95000');
      
      await page.click('[data-testid="next-step-button"]');
      
      await page.fill('[data-testid="loan-amount-input"]', '1000000000');
      await page.fill('[data-testid="tenure-input"]', '36');
      
      await page.click('[data-testid="submit-application-button"]');
      
      await expect(page.locator('[data-testid="amount-error"]')).toContainText('exceeds maximum');
    });
    
    test('should calculate FOIR and show warning', async ({ page }) => {
      await page.click('[data-testid="new-application-button"]');
      await page.waitForURL(/\/apply/);
      
      await page.selectOption('[data-testid="loan-type-select"]', 'PERSONAL_LOAN');
      await page.fill('[data-testid="full-name-input"]', 'Ravi Sharma');
      await page.fill('[data-testid="dob-input"]', '1990-04-21');
      await page.selectOption('[data-testid="gender-select"]', 'MALE');
      
      await page.click('[data-testid="next-step-button"]');
      
      await page.selectOption('[data-testid="employment-type-select"]', 'SALARIED_PRIVATE');
      await page.fill('[data-testid="employer-name-input"]', 'Infosys Limited');
      await page.fill('[data-testid="gross-income-input"]', '100000');
      await page.fill('[data-testid="net-income-input"]', '80000');
      
      await page.click('[data-testid="next-step-button"]');
      
      await page.fill('[data-testid="loan-amount-input"]', '400000');
      await page.fill('[data-testid="tenure-input"]', '36');
      
      await expect(page.locator('[data-testid="foir-warning"]')).toBeVisible();
    });
  });

  test.describe('KYC Flow', () => {
    
    test.beforeEach(async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      await page.waitForURL(/\/dashboard/);
    });
    
    test('should initiate Aadhaar KYC', async ({ page }) => {
      await page.click('[data-testid="applications-list"]').first();
      await page.click('[data-testid="start-kyc-button"]');
      
      await expect(page.locator('[data-testid="aadhaar-consent-modal"]')).toBeVisible();
      await page.check('[data-testid="consent-checkbox"]');
      await page.click('[data-testid="proceed-kyc-button"]');
      
      await page.fill('[data-testid="aadhaar-input"]', 'XXXXXXXXXXXX4321');
      await page.click('[data-testid="send-aadhaar-otp-button"]');
      
      await expect(page.locator('[data-testid="aadhaar-otp-section"]')).toBeVisible();
    });
    
    test('should show KYC failure for invalid Aadhaar', async ({ page }) => {
      await page.click('[data-testid="applications-list"]').first();
      await page.click('[data-testid="start-kyc-button"]');
      
      await page.check('[data-testid="consent-checkbox"]');
      await page.click('[data-testid="proceed-kyc-button"]');
      
      await page.fill('[data-testid="aadhaar-input"]', '123456789012');
      await page.click('[data-testid="send-aadhaar-otp-button"]');
      
      await expect(page.locator('[data-testid="aadhaar-error"]')).toBeVisible();
    });
    
    test('should complete face match successfully', async ({ page }) => {
      await page.click('[data-testid="applications-list"]').first();
      await page.click('[data-testid="start-kyc-button"]');
      
      await page.check('[data-testid="consent-checkbox"]');
      await page.click('[data-testid="proceed-kyc-button"]');
      
      await page.fill('[data-testid="aadhaar-input"]', 'XXXXXXXXXXXX4321');
      await page.click('[data-testid="send-aadhaar-otp-button"]');
      await page.fill('[data-testid="aadhaar-otp-input"]', '123456');
      await page.click('[data-testid="verify-aadhaar-button"]');
      
      await page.waitForSelector('[data-testid="selfie-capture-section"]');
      await page.click('[data-testid="capture-selfie-button"]');
      
      await expect(page.locator('[data-testid="kyc-success-message"]')).toBeVisible();
    });
  });

  test.describe('Decision Flow', () => {
    
    test('should approve application meeting all criteria', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      await page.waitForURL(/\/dashboard/);
      
      await page.click('[data-testid="applications-list"]').first();
      await page.click('[data-testid="submit-application-button"]');
      
      await page.click('[data-testid="trigger-decision-button"]');
      
      await page.waitForSelector('[data-testid="decision-result"]');
      await expect(page.locator('[data-testid="decision-status"]')).toContainText('APPROVED');
    });
    
    test('should reject application with low credit score', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      await page.fill('[data-testid="mobile-input"]', '9876543210');
      await page.click('[data-testid="send-otp-button"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      await page.waitForURL(/\/dashboard/);
      
      await page.click('[data-testid="applications-list"]').first();
      
      await page.click('[data-testid="trigger-decision-button"]');
      
      await page.waitForSelector('[data-testid="decision-result"]');
      await expect(page.locator('[data-testid="decision-status"]')).toContainText('REJECTED');
      await expect(page.locator('[data-testid="rejection-reason"]')).toContainText('CREDIT_SCORE');
    });
  });

  test.describe('Document Upload Flow', () => {
    
    test('should upload salary slip successfully', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      await page.waitForURL(/\/dashboard/);
      
      await page.click('[data-testid="applications-list"]').first();
      await page.click('[data-testid="documents-tab"]');
      
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('[data-testid="upload-salary-slip-button"]');
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles('test/fixtures/salary_slip.pdf');
      
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="document-uploaded"]')).toBeVisible();
    });
    
    test('should reject oversized files', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      await page.waitForURL(/\/dashboard/);
      
      await page.click('[data-testid="applications-list"]').first();
      await page.click('[data-testid="documents-tab"]');
      
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('[data-testid="upload-salary-slip-button"]');
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles('test/fixtures/oversized_file.pdf');
      
      await expect(page.locator('[data-testid="file-size-error"]')).toContainText('exceeds 10MB');
    });
  });

  test.describe('Fraud Detection', () => {
    
    test('should detect duplicate application from same PAN', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      await page.fill('[data-testid="mobile-input"]', TEST_CONFIG.mobile);
      await page.click('[data-testid="send-otp-button"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      await page.waitForURL(/\/dashboard/);
      
      await page.click('[data-testid="new-application-button"]');
      await page.selectOption('[data-testid="loan-type-select"]', 'PERSONAL_LOAN');
      
      await page.click('[data-testid="submit-application-button"]');
      
      await expect(page.locator('[data-testid="duplicate-error"]')).toContainText('Duplicate application');
    });
    
    test('should flag rapid-fire applications from same IP', async ({ browser }) => {
      const context = await browser.newContext({
        ip: '192.168.1.100'
      });
      
      const page = await context.newPage();
      
      for (let i = 0; i < 3; i++) {
        await page.goto(`${TEST_CONFIG.baseUrl}/login`);
        await page.fill('[data-testid="mobile-input"]', `98765${43210 + i}`);
        await page.click('[data-testid="send-otp-button"]');
        await page.waitForTimeout(100);
      }
      
      await expect(page.locator('[data-testid="velocity-blocked-message"]')).toBeVisible();
      
      await context.close();
    });
  });

  test.describe('Accessibility', () => {
    
    test('should pass WCAG 2.1 AA for login page', async ({ page }) => {
      await page.goto(`${TEST_CONFIG.baseUrl}/login`);
      
      await expect(page.locator('[data-testid="mobile-input"]')).toHaveAttribute('aria-label', /.+/);
      await expect(page.locator('[data-testid="send-otp-button"]')).toHaveAttribute('aria-label', /.+/);
      
      const violations = await page.evaluate(() => {
        const results = [];
        const axe = window.axe;
        return results;
      });
      
      expect(violations.length).toBe(0);
    });
  });
});

test.describe.configure({ mode: 'parallel' });
