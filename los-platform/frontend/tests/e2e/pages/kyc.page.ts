import { Page, Locator, expect } from '@playwright/test';

export class KycPage {
  readonly page: Page;

  readonly startKycButton: Locator;
  readonly aadhaarConsentModal: Locator;
  readonly consentCheckbox: Locator;
  readonly proceedKycButton: Locator;
  readonly aadhaarInput: Locator;
  readonly sendAadhaarOtpButton: Locator;
  readonly aadhaarOtpSection: Locator;
  readonly aadhaarOtpInput: Locator;
  readonly verifyAadhaarButton: Locator;
  readonly aadhaarError: Locator;
  readonly selfieCaptureSection: Locator;
  readonly captureSelfieButton: Locator;
  readonly kycSuccessMessage: Locator;
  readonly kycFailureMessage: Locator;
  readonly kycStatusBadge: Locator;
  readonly panInput: Locator;
  readonly verifyPanButton: Locator;
  readonly digilockerSection: Locator;
  readonly digilockerConnectButton: Locator;
  readonly offlineXmlUpload: Locator;
  readonly offlineXmlInput: Locator;
  readonly reuseKycButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.startKycButton = page.locator('[data-testid="start-kyc-button"]');
    this.aadhaarConsentModal = page.locator('[data-testid="aadhaar-consent-modal"]');
    this.consentCheckbox = page.locator('[data-testid="consent-checkbox"]');
    this.proceedKycButton = page.locator('[data-testid="proceed-kyc-button"]');
    this.aadhaarInput = page.locator('[data-testid="aadhaar-input"]');
    this.sendAadhaarOtpButton = page.locator('[data-testid="send-aadhaar-otp-button"]');
    this.aadhaarOtpSection = page.locator('[data-testid="aadhaar-otp-section"]');
    this.aadhaarOtpInput = page.locator('[data-testid="aadhaar-otp-input"]');
    this.verifyAadhaarButton = page.locator('[data-testid="verify-aadhaar-button"]');
    this.aadhaarError = page.locator('[data-testid="aadhaar-error"]');
    this.selfieCaptureSection = page.locator('[data-testid="selfie-capture-section"]');
    this.captureSelfieButton = page.locator('[data-testid="capture-selfie-button"]');
    this.kycSuccessMessage = page.locator('[data-testid="kyc-success-message"]');
    this.kycFailureMessage = page.locator('[data-testid="kyc-failure-message"]');
    this.kycStatusBadge = page.locator('[data-testid="kyc-status-badge"]');
    this.panInput = page.locator('[data-testid="pan-input"]');
    this.verifyPanButton = page.locator('[data-testid="verify-pan-button"]');
    this.digilockerSection = page.locator('[data-testid="digilocker-section"]');
    this.digilockerConnectButton = page.locator('[data-testid="digilocker-connect-button"]');
    this.offlineXmlUpload = page.locator('[data-testid="offline-xml-upload"]');
    this.offlineXmlInput = page.locator('[data-testid="offline-xml-input"]');
    this.reuseKycButton = page.locator('[data-testid="reuse-kyc-button"]');
  }

  async gotoApplication(applicationId: string): Promise<void> {
    await this.page.goto(`/applications/${applicationId}/kyc`);
  }

  async startKyc(): Promise<void> {
    await this.startKycButton.click();
  }

  async acceptConsent(): Promise<void> {
    await this.aadhaarConsentModal.waitFor({ state: 'visible' });
    await this.consentCheckbox.check();
    await this.proceedKycButton.click();
  }

  async enterAadhaar(aadhaar: string): Promise<void> {
    await this.aadhaarInput.fill(aadhaar);
    await this.sendAadhaarOtpButton.click();
  }

  async verifyAadhaarOtp(otp = '123456'): Promise<void> {
    await this.aadhaarOtpSection.waitFor({ state: 'visible' });
    await this.aadhaarOtpInput.fill(otp);
    await this.verifyAadhaarButton.click();
  }

  async captureSelfie(): Promise<void> {
    await this.selfieCaptureSection.waitFor({ state: 'visible' });
    await this.captureSelfieButton.click();
  }

  async verifyPan(pan: string, fullName: string, dob: string): Promise<void> {
    await this.panInput.fill(pan);
    await this.verifyPanButton.click();
  }

  async connectDigilocker(): Promise<void> {
    await this.digilockerConnectButton.click();
  }

  async uploadOfflineXml(filePath: string): Promise<void> {
    await this.offlineXmlInput.setInputFiles(filePath);
  }

  async tryReuseKyc(): Promise<void> {
    await this.reuseKycButton.click();
  }

  async expectAadhaarOtpSectionVisible(): Promise<void> {
    await expect(this.aadhaarOtpSection).toBeVisible();
  }

  async expectAadhaarErrorVisible(): Promise<void> {
    await expect(this.aadhaarError).toBeVisible();
  }

  async expectKycSuccess(): Promise<void> {
    await expect(this.kycSuccessMessage).toBeVisible();
  }

  async expectKycFailure(): Promise<void> {
    await expect(this.kycFailureMessage).toBeVisible();
  }

  async expectStatus(status: string): Promise<void> {
    await expect(this.kycStatusBadge).toContainText(status);
  }
}
