import { Page, Locator, expect, FileChooser } from '@playwright/test';

export class DocumentsPage {
  readonly page: Page;

  readonly documentsTab: Locator;
  readonly uploadSalarySlipButton: Locator;
  readonly uploadBankStatementButton: Locator;
  readonly uploadPanCardButton: Locator;
  readonly uploadAddressProofButton: Locator;
  readonly uploadPhotoButton: Locator;
  readonly uploadProgress: Locator;
  readonly documentUploaded: Locator;
  readonly documentList: Locator;
  readonly fileSizeError: Locator;
  readonly uploadError: Locator;
  readonly docTypeFilter: Locator;
  readonly docStatusFilter: Locator;
  readonly reviewButton: Locator;
  readonly approveDocButton: Locator;
  readonly rejectDocButton: Locator;
  readonly rejectionReasonInput: Locator;
  readonly submitReviewButton: Locator;
  readonly checklistSection: Locator;
  readonly checklistItem: Locator;
  readonly statsCards: Locator;

  constructor(page: Page) {
    this.page = page;

    this.documentsTab = page.locator('[data-testid="documents-tab"]');
    this.uploadSalarySlipButton = page.locator('[data-testid="upload-salary-slip-button"]');
    this.uploadBankStatementButton = page.locator('[data-testid="upload-bank-statement-button"]');
    this.uploadPanCardButton = page.locator('[data-testid="upload-pan-card-button"]');
    this.uploadAddressProofButton = page.locator('[data-testid="upload-address-proof-button"]');
    this.uploadPhotoButton = page.locator('[data-testid="upload-photo-button"]');
    this.uploadProgress = page.locator('[data-testid="upload-progress"]');
    this.documentUploaded = page.locator('[data-testid="document-uploaded"]');
    this.documentList = page.locator('[data-testid="document-list"]');
    this.fileSizeError = page.locator('[data-testid="file-size-error"]');
    this.uploadError = page.locator('[data-testid="upload-error"]');
    this.docTypeFilter = page.locator('[data-testid="doc-type-filter"]');
    this.docStatusFilter = page.locator('[data-testid="doc-status-filter"]');
    this.reviewButton = page.locator('[data-testid="review-doc-button"]');
    this.approveDocButton = page.locator('[data-testid="approve-doc-button"]');
    this.rejectDocButton = page.locator('[data-testid="reject-doc-button"]');
    this.rejectionReasonInput = page.locator('[data-testid="rejection-reason-input"]');
    this.submitReviewButton = page.locator('[data-testid="submit-review-button"]');
    this.checklistSection = page.locator('[data-testid="checklist-section"]');
    this.checklistItem = page.locator('[data-testid="checklist-item"]');
    this.statsCards = page.locator('[data-testid="doc-stats-cards"]');
  }

  async gotoApplication(applicationId: string): Promise<void> {
    await this.page.goto(`/applications/${applicationId}/documents`);
  }

  async uploadDocument(docType: string, filePath: string): Promise<FileChooser> {
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.page.locator(`[data-testid="upload-${docType}-button"]`).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    return fileChooser;
  }

  async expectUploadProgress(): Promise<void> {
    await expect(this.uploadProgress).toBeVisible();
  }

  async expectUploadSuccess(): Promise<void> {
    await expect(this.documentUploaded).toBeVisible();
  }

  async expectFileSizeErrorContains(text: string): Promise<void> {
    await expect(this.fileSizeError).toContainText(text);
  }

  async reviewDocument(docIndex: number, decision: 'APPROVED' | 'REJECTED', reason?: string): Promise<void> {
    await this.documentList.nth(docIndex).locator('[data-testid="review-doc-button"]').click();
    if (decision === 'APPROVED') {
      await this.approveDocButton.click();
    } else {
      await this.rejectDocButton.click();
      if (reason) await this.rejectionReasonInput.fill(reason);
    }
    await this.submitReviewButton.click();
  }

  async expectDocumentCount(greaterThanOrEqual: number): Promise<void> {
    const count = await this.documentList.count();
    expect(count).toBeGreaterThanOrEqual(greaterThanOrEqual);
  }
}
