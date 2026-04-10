import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  readonly userGreeting: Locator;
  readonly newApplicationButton: Locator;
  readonly applicationsList: Locator;
  readonly logoutButton: Locator;
  readonly notificationBell: Locator;
  readonly profileMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userGreeting = page.locator('[data-testid="user-greeting"]');
    this.newApplicationButton = page.locator('[data-testid="new-application-button"]');
    this.applicationsList = page.locator('[data-testid="applications-list"]');
    this.logoutButton = page.locator('[data-testid="logout-button"]');
    this.notificationBell = page.locator('[data-testid="notification-bell"]');
    this.profileMenu = page.locator('[data-testid="profile-menu"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }

  async openNewApplication(): Promise<void> {
    await this.newApplicationButton.click();
  }

  async selectApplication(index = 0): Promise<void> {
    await this.applicationsList.nth(index).click();
  }

  async logout(): Promise<void> {
    await this.profileMenu.click();
    await this.logoutButton.click();
  }

  async expectLoggedIn(): Promise<void> {
    await expect(this.userGreeting).toBeVisible();
  }

  async expectApplicationCount(greaterThanOrEqual: number): Promise<void> {
    const count = await this.applicationsList.count();
    expect(count).toBeGreaterThanOrEqual(greaterThanOrEqual);
  }
}
