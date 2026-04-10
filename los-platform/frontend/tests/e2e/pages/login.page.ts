import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly url: string;

  readonly mobileInput: Locator;
  readonly purposeSelect: Locator;
  readonly sendOtpButton: Locator;
  readonly otpSentMessage: Locator;
  readonly otpInputSection: Locator;
  readonly otpInput: Locator;
  readonly verifyOtpButton: Locator;
  readonly mobileError: Locator;
  readonly otpError: Locator;
  readonly accountLockedMessage: Locator;
  readonly ldapUsernameInput: Locator;
  readonly ldapPasswordInput: Locator;
  readonly ldapLoginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.url = '/login';

    this.mobileInput = page.locator('[data-testid="mobile-input"]');
    this.purposeSelect = page.locator('[data-testid="purpose-select"]');
    this.sendOtpButton = page.locator('[data-testid="send-otp-button"]');
    this.otpSentMessage = page.locator('[data-testid="otp-sent-message"]');
    this.otpInputSection = page.locator('[data-testid="otp-input-section"]');
    this.otpInput = page.locator('[data-testid="otp-input"]');
    this.verifyOtpButton = page.locator('[data-testid="verify-otp-button"]');
    this.mobileError = page.locator('[data-testid="mobile-error"]');
    this.otpError = page.locator('[data-testid="otp-error"]');
    this.accountLockedMessage = page.locator('[data-testid="account-locked-message"]');
    this.ldapUsernameInput = page.locator('[data-testid="ldap-username-input"]');
    this.ldapPasswordInput = page.locator('[data-testid="ldap-password-input"]');
    this.ldapLoginButton = page.locator('[data-testid="ldap-login-button"]');
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async fillMobileAndSendOtp(mobile: string): Promise<void> {
    await this.mobileInput.fill(mobile);
    await this.purposeSelect.selectOption('LOGIN');
    await this.sendOtpButton.click();
  }

  async verifyOtp(otp = '123456'): Promise<void> {
    await this.otpInput.fill(otp);
    await this.verifyOtpButton.click();
  }

  async loginWithOtp(mobile: string, otp = '123456'): Promise<void> {
    await this.goto();
    await this.fillMobileAndSendOtp(mobile);
    await this.otpInputSection.waitFor({ state: 'visible' });
    await this.verifyOtp(otp);
  }

  async loginWithLdap(username: string, password: string): Promise<void> {
    await this.goto();
    await this.ldapUsernameInput.fill(username);
    await this.ldapPasswordInput.fill(password);
    await this.ldapLoginButton.click();
  }

  async expectMobileErrorContains(text: string): Promise<void> {
    await expect(this.mobileError).toContainText(text);
  }

  async expectOtpErrorContains(text: string): Promise<void> {
    await expect(this.otpError).toContainText(text);
  }
}
