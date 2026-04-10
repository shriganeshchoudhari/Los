import { test as base, Page, BrowserContext, APIRequestContext, expect } from '@playwright/test';
import { testData, generateUniqueMobile, generateUniquePAN, TestCustomer, cleanUpCustomer } from './test-data';
import { AuthApi } from './api/auth.api';
import { LoanApplicationApi } from './api/loan.api';
import { KycApi } from './api/kyc.api';
import { DocumentApi } from './api/document.api';
import { DecisionApi } from './api/decision.api';

export interface ApiFixtures {
  authApi: AuthApi;
  loanApi: LoanApplicationApi;
  kycApi: KycApi;
  documentApi: DocumentApi;
  decisionApi: DecisionApi;
  authenticatedCustomer: TestCustomer;
  accessToken: string;
}

export interface PageFixtures {
  mobile: string;
  testCustomer: TestCustomer;
  cleanupCustomer: () => Promise<void>;
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';

export const test = base.extend<PageFixtures & ApiFixtures>({
  mobile: generateUniqueMobile(),
  testCustomer: async ({ mobile }, use) => {
    const customer = await testData.createCustomer(mobile);
    await use(customer);
    await cleanUpCustomer(customer.id);
  },
  cleanupCustomer: async ({ testCustomer }, use) => {
    await use(async () => {
      await cleanUpCustomer(testCustomer.id);
    });
  },

  authApi: async ({}, use) => {
    const api = new AuthApi(API_BASE);
    await use(api);
  },
  loanApi: async ({ accessToken }, use) => {
    const api = new LoanApplicationApi(API_BASE, accessToken);
    await use(api);
  },
  kycApi: async ({ accessToken }, use) => {
    const api = new KycApi(API_BASE, accessToken);
    await use(api);
  },
  documentApi: async ({ accessToken }, use) => {
    const api = new DocumentApi(API_BASE, accessToken);
    await use(api);
  },
  decisionApi: async ({ accessToken }, use) => {
    const api = new DecisionApi(API_BASE, accessToken);
    await use(api);
  },
  authenticatedCustomer: async ({ authApi, testCustomer }, use) => {
    const loginResult = await authApi.otpLogin(testCustomer.mobile);
    await use({ ...testCustomer, ...loginResult });
  },
  accessToken: async ({ authApi, testCustomer }, use) => {
    const result = await authApi.otpLogin(testCustomer.mobile);
    await use(result.accessToken);
  },
});

export { expect, BASE_URL, API_BASE };
