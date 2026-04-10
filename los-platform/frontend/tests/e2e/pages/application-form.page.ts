import { Page, Locator, expect } from '@playwright/test';

export class ApplicationFormPage {
  readonly page: Page;

  readonly loanTypeSelect: Locator;
  readonly fullNameInput: Locator;
  readonly dobInput: Locator;
  readonly genderSelect: Locator;
  readonly emailInput: Locator;
  readonly nextStepButton: Locator;
  readonly prevStepButton: Locator;
  readonly stepIndicator: Locator;

  readonly employmentTypeSelect: Locator;
  readonly employerNameInput: Locator;
  readonly grossIncomeInput: Locator;
  readonly netIncomeInput: Locator;

  readonly loanAmountInput: Locator;
  readonly tenureInput: Locator;
  readonly tenureSlider: Locator;
  readonly emiPreview: Locator;
  readonly foirWarning: Locator;

  readonly submitApplicationButton: Locator;
  readonly applicationNumber: Locator;
  readonly applicationStatus: Locator;
  readonly amountError: Locator;
  readonly duplicateError: Locator;
  readonly autoSaveIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    this.loanTypeSelect = page.locator('[data-testid="loan-type-select"]');
    this.fullNameInput = page.locator('[data-testid="full-name-input"]');
    this.dobInput = page.locator('[data-testid="dob-input"]');
    this.genderSelect = page.locator('[data-testid="gender-select"]');
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.nextStepButton = page.locator('[data-testid="next-step-button"]');
    this.prevStepButton = page.locator('[data-testid="prev-step-button"]');
    this.stepIndicator = page.locator('[data-testid="step-indicator"]');

    this.employmentTypeSelect = page.locator('[data-testid="employment-type-select"]');
    this.employerNameInput = page.locator('[data-testid="employer-name-input"]');
    this.grossIncomeInput = page.locator('[data-testid="gross-income-input"]');
    this.netIncomeInput = page.locator('[data-testid="net-income-input"]');

    this.loanAmountInput = page.locator('[data-testid="loan-amount-input"]');
    this.tenureInput = page.locator('[data-testid="tenure-input"]');
    this.tenureSlider = page.locator('[data-testid="tenure-slider"]');
    this.emiPreview = page.locator('[data-testid="emi-preview"]');
    this.foirWarning = page.locator('[data-testid="foir-warning"]');

    this.submitApplicationButton = page.locator('[data-testid="submit-application-button"]');
    this.applicationNumber = page.locator('[data-testid="application-number"]');
    this.applicationStatus = page.locator('[data-testid="application-status"]');
    this.amountError = page.locator('[data-testid="amount-error"]');
    this.duplicateError = page.locator('[data-testid="duplicate-error"]');
    this.autoSaveIndicator = page.locator('[data-testid="autosave-indicator"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/apply');
  }

  async gotoApplication(applicationId: string): Promise<void> {
    await this.page.goto(`/applications/${applicationId}`);
  }

  async fillStep1_PersonalDetails(data: {
    loanType?: string;
    fullName: string;
    dob: string;
    gender?: string;
    email?: string;
  }): Promise<void> {
    if (data.loanType) await this.loanTypeSelect.selectOption(data.loanType);
    await this.fullNameInput.fill(data.fullName);
    await this.dobInput.fill(data.dob);
    if (data.gender) await this.genderSelect.selectOption(data.gender);
    if (data.email) await this.emailInput.fill(data.email);
  }

  async fillStep2_EmploymentDetails(data: {
    employmentType: string;
    employerName?: string;
    grossIncome: number;
    netIncome: number;
  }): Promise<void> {
    await this.employmentTypeSelect.selectOption(data.employmentType);
    if (data.employerName) await this.employerNameInput.fill(data.employerName);
    await this.grossIncomeInput.fill(String(data.grossIncome));
    await this.netIncomeInput.fill(String(data.netIncome));
  }

  async fillStep3_LoanRequirement(data: {
    loanAmount: number;
    tenureMonths: number;
  }): Promise<void> {
    await this.loanAmountInput.fill(String(data.loanAmount));
    await this.tenureInput.fill(String(data.tenureMonths));
  }

  async nextStep(): Promise<void> {
    await this.nextStepButton.click();
  }

  async submitApplication(): Promise<void> {
    await this.submitApplicationButton.click();
  }

  async expectApplicationNumber(): Promise<void> {
    await expect(this.applicationNumber).toMatchText(/^LOS-\d{4}-[A-Z]{2}-\d{6}$/);
  }

  async expectStatus(status: string): Promise<void> {
    await expect(this.applicationStatus).toContainText(status);
  }

  async expectAmountErrorContains(text: string): Promise<void> {
    await expect(this.amountError).toContainText(text);
  }

  async expectFoirWarningVisible(): Promise<void> {
    await expect(this.foirWarning).toBeVisible();
  }

  async expectDuplicateErrorContains(text: string): Promise<void> {
    await expect(this.duplicateError).toContainText(text);
  }
}
