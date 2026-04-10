import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/security',
  timeout: 30000,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report/security' }],
    ['json', { outputFile: 'playwright-report/security/results.json' }],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
