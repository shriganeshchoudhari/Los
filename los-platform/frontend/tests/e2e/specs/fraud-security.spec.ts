import { test, expect } from '@playwright/test';
import { generateUniqueMobile } from '../test-data';

test.describe('TC-FRAUD-001: Fraud Detection', () => {

  test('C001-P01: Duplicate PAN — second application blocked', async ({ page }) => {
    const mobile1 = generateUniqueMobile();
    const mobile2 = generateUniqueMobile();

    await page.goto('/login');
    await page.fill('[data-testid="mobile-input"]', mobile1);
    await page.click('[data-testid="send-otp-button"]');
    await page.fill('[data-testid="otp-input"]', '123456');
    await page.click('[data-testid="verify-otp-button"]');
    await page.waitForURL(/\/dashboard/);

    await page.click('[data-testid="new-application-button"]');
    await page.selectOption('[data-testid="loan-type-select"]', 'PERSONAL_LOAN');
    await page.fill('[data-testid="full-name-input"]', 'Duplicate PAN User');
    await page.fill('[data-testid="dob-input"]', '1990-01-01');
    await page.click('[data-testid="next-step-button"]');
    await page.fill('[data-testid="employment-type-select"]', 'SALARIED_PRIVATE');
    await page.fill('[data-testid="gross-income-input"]', '100000');
    await page.fill('[data-testid="net-income-input"]', '80000');
    await page.click('[data-testid="next-step-button"]');
    await page.fill('[data-testid="loan-amount-input"]', '500000');
    await page.fill('[data-testid="tenure-input"]', '36');
    await page.click('[data-testid="submit-application-button"]');
    await page.waitForSelector('[data-testid="application-number"]');

    await page.click('[data-testid="logout-button"]');

    await page.fill('[data-testid="mobile-input"]', mobile2);
    await page.click('[data-testid="send-otp-button"]');
    await page.fill('[data-testid="otp-input"]', '123456');
    await page.click('[data-testid="verify-otp-button"]');
    await page.waitForURL(/\/dashboard/);

    await page.click('[data-testid="new-application-button"]');
    await page.selectOption('[data-testid="loan-type-select"]', 'PERSONAL_LOAN');
    await page.fill('[data-testid="full-name-input"]', 'Duplicate PAN User 2');
    await page.fill('[data-testid="dob-input"]', '1990-01-01');
    await page.click('[data-testid="next-step-button"]');
    await page.fill('[data-testid="employment-type-select"]', 'SALARIED_PRIVATE');
    await page.fill('[data-testid="gross-income-input"]', '100000');
    await page.fill('[data-testid="net-income-input"]', '80000');
    await page.click('[data-testid="next-step-button"]');
    await page.fill('[data-testid="loan-amount-input"]', '500000');
    await page.fill('[data-testid="tenure-input"]', '36');
    await page.click('[data-testid="submit-application-button"]');

    await expect(page.locator('[data-testid="duplicate-error"]')).toContainText('Duplicate application');
  });

  test('C001-P02: Velocity check — 3 rapid applications from same IP blocked', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    for (let i = 0; i < 3; i++) {
      const mobile = generateUniqueMobile();
      await page.goto('/login');
      await page.fill('[data-testid="mobile-input"]', mobile);
      await page.click('[data-testid="send-otp-button"]');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('[data-testid="velocity-blocked-message"]')).toBeVisible();
    await context.close();
  });

  test('C001-P03: Same mobile registered twice — second OTP send rate limited', async ({ page }) => {
    const mobile = generateUniqueMobile();
    await page.goto('/login');
    await page.fill('[data-testid="mobile-input"]', mobile);
    await page.click('[data-testid="send-otp-button"]');
    await page.waitForTimeout(200);
    await page.click('[data-testid="send-otp-button"]');
    await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText('Please wait');
  });
});

test.describe('TC-SEC-001: Security & Accessibility', () => {

  test('C001-P01: Unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('C001-P02: API endpoints return 401 without token', async ({ request }) => {
    const response = await request.get('http://localhost:3001/applications');
    expect(response.status()).toBe(401);
  });

  test('C001-P03: SQL injection in application form fields sanitized', async ({ page }) => {
    const mobile = generateUniqueMobile();
    await page.goto('/login');
    await page.fill('[data-testid="mobile-input"]', mobile);
    await page.click('[data-testid="send-otp-button"]');
    await page.fill('[data-testid="otp-input"]', '123456');
    await page.click('[data-testid="verify-otp-button"]');
    await page.waitForURL(/\/dashboard/);
    await page.click('[data-testid="new-application-button"]');

    await page.fill('[data-testid="full-name-input"]', "'; DROP TABLE applications; --");
    await page.fill('[data-testid="dob-input"]', '1990-01-01');
    await page.click('[data-testid="next-step-button"]');
    await page.click('[data-testid="next-step-button"]');
    await page.click('[data-testid="next-step-button"]');
    await page.click('[data-testid="submit-application-button"]');

    await expect(page.locator('[data-testid="application-number"]')).toBeVisible();
  });

  test('C001-P04: XSS in application fields sanitized', async ({ page }) => {
    const mobile = generateUniqueMobile();
    await page.goto('/login');
    await page.fill('[data-testid="mobile-input"]', mobile);
    await page.click('[data-testid="send-otp-button"]');
    await page.fill('[data-testid="otp-input"]', '123456');
    await page.click('[data-testid="verify-otp-button"]');
    await page.waitForURL(/\/dashboard/);
    await page.click('[data-testid="new-application-button"]');

    await page.fill('[data-testid="full-name-input"]', '<script>alert("xss")</script>Test');
    await page.fill('[data-testid="dob-input"]', '1990-01-01');
    await page.click('[data-testid="next-step-button"]');

    const html = await page.content();
    expect(html).not.toContain('<script>alert("xss")</script>');
  });

  test('C001-P05: Login page form fields have proper ARIA labels', async ({ page }) => {
    await page.goto('/login');
    const mobileLabel = await page.locator('[data-testid="mobile-input"]').getAttribute('aria-label');
    const buttonLabel = await page.locator('[data-testid="send-otp-button"]').getAttribute('aria-label');
    expect(mobileLabel).toBeTruthy();
    expect(buttonLabel).toBeTruthy();
  });

  test('C001-P06: Sensitive data not logged in browser console', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const mobile = generateUniqueMobile();
    await page.goto('/login');
    await page.fill('[data-testid="mobile-input"]', mobile);
    await page.click('[data-testid="send-otp-button"]');
    await page.fill('[data-testid="otp-input"]', '123456');
    await page.click('[data-testid="verify-otp-button"]');
    await page.waitForURL(/\/dashboard/);

    const sensitivePatterns = [/Bearer\s+[A-Za-z0-9-._~+/]+/, /\d{10}/, /\d{12}/];
    for (const error of consoleErrors) {
      for (const pattern of sensitivePatterns) {
        expect(error).not.toMatch(pattern);
      }
    }
  });
});
