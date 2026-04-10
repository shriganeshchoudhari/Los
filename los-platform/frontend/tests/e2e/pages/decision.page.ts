import { Page, Locator, expect } from '@playwright/test';

export class DecisionPage {
  readonly page: Page;

  readonly triggerDecisionButton: Locator;
  readonly decisionResult: Locator;
  readonly decisionStatus: Locator;
  readonly rejectionReason: Locator;
  readonly sanctionDetails: Locator;
  readonly ratePreview: Locator;
  readonly overrideRequestButton: Locator;
  readonly overrideReasonInput: Locator;
  readonly submitOverrideButton: Locator;
  readonly overrideStatus: Locator;
  readonly approveOverrideButton: Locator;
  readonly rejectOverrideButton: Locator;
  readonly disbursementButton: Locator;
  readonly disbursementConfirmModal: Locator;
  readonly disbursementConfirmButton: Locator;
  readonly disbursementSuccess: Locator;
  readonly pendingOverridesList: Locator;
  readonly bureauScoreCard: Locator;
  readonly foirCard: Locator;
  readonly loanAmountCard: Locator;
  readonly emiCalculator: Locator;

  constructor(page: Page) {
    this.page = page;

    this.triggerDecisionButton = page.locator('[data-testid="trigger-decision-button"]');
    this.decisionResult = page.locator('[data-testid="decision-result"]');
    this.decisionStatus = page.locator('[data-testid="decision-status"]');
    this.rejectionReason = page.locator('[data-testid="rejection-reason"]');
    this.sanctionDetails = page.locator('[data-testid="sanction-details"]');
    this.ratePreview = page.locator('[data-testid="rate-preview"]');
    this.overrideRequestButton = page.locator('[data-testid="override-request-button"]');
    this.overrideReasonInput = page.locator('[data-testid="override-reason-input"]');
    this.submitOverrideButton = page.locator('[data-testid="submit-override-button"]');
    this.overrideStatus = page.locator('[data-testid="override-status"]');
    this.approveOverrideButton = page.locator('[data-testid="approve-override-button"]');
    this.rejectOverrideButton = page.locator('[data-testid="reject-override-button"]');
    this.disbursementButton = page.locator('[data-testid="disbursement-button"]');
    this.disbursementConfirmModal = page.locator('[data-testid="disbursement-confirm-modal"]');
    this.disbursementConfirmButton = page.locator('[data-testid="disbursement-confirm-button"]');
    this.disbursementSuccess = page.locator('[data-testid="disbursement-success"]');
    this.pendingOverridesList = page.locator('[data-testid="pending-overrides-list"]');
    this.bureauScoreCard = page.locator('[data-testid="bureau-score-card"]');
    this.foirCard = page.locator('[data-testid="foir-card"]');
    this.loanAmountCard = page.locator('[data-testid="loan-amount-card"]');
    this.emiCalculator = page.locator('[data-testid="emi-calculator"]');
  }

  async gotoApplication(applicationId: string): Promise<void> {
    await this.page.goto(`/applications/${applicationId}/decision`);
  }

  async triggerDecision(): Promise<void> {
    await this.triggerDecisionButton.click();
  }

  async requestOverride(reason: string): Promise<void> {
    await this.overrideRequestButton.click();
    await this.overrideReasonInput.fill(reason);
    await this.submitOverrideButton.click();
  }

  async approveOverride(overrideIndex = 0): Promise<void> {
    await this.pendingOverridesList.nth(overrideIndex).locator('[data-testid="approve-override-button"]').click();
  }

  async rejectOverride(overrideIndex = 0): Promise<void> {
    await this.pendingOverridesList.nth(overrideIndex).locator('[data-testid="reject-override-button"]').click();
  }

  async confirmDisbursement(): Promise<void> {
    await this.disbursementButton.click();
    await this.disbursementConfirmModal.waitFor({ state: 'visible' });
    await this.disbursementConfirmButton.click();
  }

  async expectDecisionStatus(status: string): Promise<void> {
    await this.decisionResult.waitFor({ state: 'visible' });
    await expect(this.decisionStatus).toContainText(status);
  }

  async expectRejectionReasonContains(text: string): Promise<void> {
    await expect(this.rejectionReason).toContainText(text);
  }

  async expectSanctionDetailsVisible(): Promise<void> {
    await expect(this.sanctionDetails).toBeVisible();
  }

  async expectOverrideStatus(status: string): Promise<void> {
    await expect(this.overrideStatus).toContainText(status);
  }

  async expectDisbursementSuccess(): Promise<void> {
    await expect(this.disbursementSuccess).toBeVisible();
  }
}
