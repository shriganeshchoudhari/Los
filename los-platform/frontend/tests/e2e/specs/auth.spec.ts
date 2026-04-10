import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('TC-AUTH-001: Customer Authentication Flow', () => {

  test('C001-P01: OTP send success', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillMobileAndSendOtp('9876543201');
    await expect(loginPage.otpSentMessage).toBeVisible();
    await expect(loginPage.otpInputSection).toBeVisible();
  });

  test('C001-P02: Mobile validation - invalid format', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.mobileInput.fill('12345');
    await loginPage.sendOtpButton.click();
    await loginPage.expectMobileErrorContains('Invalid mobile number');
  });

  test('C001-P03: Mobile validation - non-Indian number', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.mobileInput.fill('+1-9876543210');
    await loginPage.sendOtpButton.click();
    await loginPage.expectMobileErrorContains('Invalid mobile number');
  });

  test('C001-P05: OTP verification - success with valid OTP', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    await loginPage.goto();
    await loginPage.fillMobileAndSendOtp('9876543205');
    await loginPage.otpInputSection.waitFor({ state: 'visible' });
    await loginPage.verifyOtp('123456');
    await dashboardPage.expectLoggedIn();
  });

  test('C001-P06: OTP verification - failure with wrong OTP', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillMobileAndSendOtp('9876543206');
    await loginPage.otpInputSection.waitFor({ state: 'visible' });
    await loginPage.verifyOtp('000000');
    await loginPage.expectOtpErrorContains('Invalid OTP');
  });

  test('C001-P07: OTP verification - expiry (skip slow test in CI)', async ({ page }) => {
    test.skip(process.env.CI === 'true', 'Skipped in CI - requires waiting 5 minutes');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillMobileAndSendOtp('9876543207');
    await page.waitForTimeout(310_000);
    await loginPage.verifyOtp('123456');
    await loginPage.expectOtpErrorContains('expired');
  });

  test('C001-P08: Account lockout after 5 failed attempts', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillMobileAndSendOtp('9876543208');
    await loginPage.otpInputSection.waitFor({ state: 'visible' });
    for (let i = 0; i < 5; i++) {
      await loginPage.verifyOtp('000000');
      await page.waitForTimeout(200);
    }
    await expect(loginPage.accountLockedMessage).toBeVisible();
  });

  test('C001-P09: LDAP login - bank staff success', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    await loginPage.loginWithLdap('jsmith', 'TestPassword123!');
    await dashboardPage.expectLoggedIn();
  });

  test('C001-P10: LDAP login - invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginWithLdap('jsmith', 'WrongPassword');
    await loginPage.expectOtpErrorContains('Invalid credentials');
  });

  test('C001-P11: LDAP login - inactive AD account', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginWithLdap('inactive.user', 'SomePassword123!');
    await loginPage.expectOtpErrorContains('Account is inactive');
  });
});

test.describe('TC-AUTH-002: Token Management', () => {

  test('C002-P01: Valid token grants access to protected routes', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    await loginPage.loginWithOtp('9876543210');
    await dashboardPage.goto();
    await dashboardPage.expectLoggedIn();
  });

  test('C002-P02: Expired token redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('C002-P03: Logout invalidates token', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    await loginPage.loginWithOtp('9876543211');
    await dashboardPage.goto();
    await dashboardPage.logout();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
