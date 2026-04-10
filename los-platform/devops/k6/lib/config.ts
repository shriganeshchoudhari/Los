import { Options } from 'k6/options';

export const baseUrls = {
  dev: {
    auth: 'http://localhost:3001',
    kyc: 'http://localhost:3002',
    loan: 'http://localhost:3003',
    decision: 'http://localhost:3004',
    integration: 'http://localhost:3005',
    notification: 'http://localhost:3006',
    document: 'http://localhost:3007',
    dsa: 'http://localhost:3008',
  },
  uat: {
    auth: 'https://los-api-uat.bank.in',
    kyc: 'https://los-api-uat.bank.in',
    loan: 'https://los-api-uat.bank.in',
    decision: 'https://los-api-uat.bank.in',
    integration: 'https://los-api-uat.bank.in',
    notification: 'https://los-api-uat.bank.in',
    document: 'https://los-api-uat.bank.in',
    dsa: 'https://los-dsa-uat.bank.in',
  },
  prod: {
    auth: 'https://los-api.bank.in',
    kyc: 'https://los-api.bank.in',
    loan: 'https://los-api.bank.in',
    decision: 'https://los-api.bank.in',
    integration: 'https://los-api.bank.in',
    notification: 'https://los-api.bank.in',
    document: 'https://los-api.bank.in',
    dsa: 'https://los-dsa.bank.in',
  },
};

export function getEnv(): 'dev' | 'uat' | 'prod' {
  return (__ENV.ENV as 'dev' | 'uat' | 'prod') || 'dev';
}

export function getBaseUrls() {
  return baseUrls[getEnv()];
}

export interface TestConfig {
  env: 'dev' | 'uat' | 'prod';
  urls: ReturnType<typeof getBaseUrls>;
  vus: number;
  duration: string;
  seedUsers: number;
}

export function getTestConfig(): TestConfig {
  const env = getEnv();
  return {
    env,
    urls: baseUrls[env],
    vus: parseInt(__ENV.VUS || '10', 10),
    duration: __ENV.DURATION || '5m',
    seedUsers: parseInt(__ENV.SEED_USERS || '50', 10),
  };
}

export const defaultThresholds = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.01'],
  http_req_waiting: ['p(95)<1000'],
};

export const slaThresholds = {
  p95: 1500,
  p99: 5000,
  errorRate: 0.005,
};

export const commonHeaders = {
  'Content-Type': 'application/json',
  'X-Request-ID': () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  'X-Idempotency-Key': () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
};

export function sleep(seconds = 1): void {
  const ms = seconds * 1000;
  const start = Date.now();
  while (Date.now() - start < ms) {}
}
