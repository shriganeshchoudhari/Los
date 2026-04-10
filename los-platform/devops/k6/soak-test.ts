import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend, Rate } from 'k6/metrics';
import { getEnv, getBaseUrls } from './lib/config';
import { loginAndGetToken, generateApplicationData, handleError, getAuthHeaders } from './lib/helpers';

const env = getEnv();
const urls = getBaseUrls();

export const options = {
  scenarios: {
    soak_load: {
      executor: 'constant-vus',
      vus: parseInt(__ENV.VUS || '10', 10),
      duration: __ENV.DURATION || '30m',
      tags: { test_type: 'soak' },
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<5000'],
    'http_req_failed': ['rate<0.01'],
    'error_rate': ['rate<0.005'],
  },
};

const memoryLeaks = new Counter('potential_memory_leaks');
const loanCreationRate = new Rate('loan_creation_rate');
const authFailureRate = new Rate('auth_failure_rate');
const errorRate = new Rate('error_rate');

export function setup() {
  console.log(`[SOAK] Starting soak test: ${env}`);
  console.log(`[SOAK] Duration: ${__ENV.DURATION || '30m'}`);
  console.log(`[SOAK] VUs: ${__ENV.VUS || '10'}`);
  return {};
}

export default function() {
  const vu = __VU;

  if (vu % 3 === 0) {
    testLoanCreationLoop();
  } else if (vu % 3 === 1) {
    testAuthLoop();
  } else {
    testEmiCalculationLoop();
  }

  sleep(1 + Math.random() * 2);
}

function testLoanCreationLoop() {
  const token = loginAndGetToken(urls.auth, 'LOAN_OFFICER').token;

  const data = generateApplicationData();

  const res = http.post(
    `${urls.loan}/api/applications`,
    JSON.stringify(data),
    { headers: getAuthHeaders(token) },
  );

  if (res.status === 201) {
    loanCreationRate.add(1);
  } else if (res.status >= 400 && res.status < 500) {
    loanCreationRate.add(0);
  }

  if (res.status === 201) {
    const body = res.json() as any;
    const appId = body.id;

    if (appId) {
      const statusRes = http.patch(
        `${urls.loan}/api/applications/${appId}/status`,
        JSON.stringify({ status: 'KYC_IN_PROGRESS', remarks: 'Soak test' }),
        { headers: getAuthHeaders(token) },
      );

      if (statusRes.status === 200) {
        loanCreationRate.add(0.5);
      }
    }
  }

  if (res.status >= 500) {
    errorRate.add(1);
    memoryLeaks.add(1);
  }
}

function testAuthLoop() {
  const mobile = `${9}${String(Date.now()).substring(7)}${Math.floor(Math.random() * 100)}`.substring(0, 10);

  const sendRes = http.post(
    `${urls.auth}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
  );

  if (sendRes.status !== 200) {
    authFailureRate.add(1);
  }

  if (sendRes.status === 200) {
    const sessionId = sendRes.json('sessionId') as string;
    if (sessionId) {
      const verifyRes = http.post(
        `${urls.auth}/api/auth/otp/verify`,
        JSON.stringify({ mobile, otp: '123456', sessionId }),
      );

      if (verifyRes.status === 200) {
        const body = verifyRes.json() as any;
        const accessToken = body.accessToken as string;
        const refreshToken = body.refreshToken as string;

        if (accessToken && refreshToken) {
          const refreshRes = http.post(
            `${urls.auth}/api/auth/refresh`,
            JSON.stringify({ refreshToken }),
          );

          const logoutRes = http.post(
            `${urls.auth}/api/auth/logout`,
            JSON.stringify({ refreshToken }),
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
        }
      }
    }
  }

  const healthRes = http.get(`${urls.auth}/api/auth/health`);
  if (healthRes.status !== 200) {
    errorRate.add(1);
  }
}

function testEmiCalculationLoop() {
  const token = loginAndGetToken(urls.auth, 'LOAN_OFFICER').token;

  const principals = [100000, 500000, 1000000, 2000000, 5000000];
  const rates = [8.5, 9, 10, 10.5, 11, 12];
  const tenures = [12, 24, 36, 60, 120];

  const principal = principals[Math.floor(Math.random() * principals.length)];
  const rate = rates[Math.floor(Math.random() * rates.length)];
  const tenure = tenures[Math.floor(Math.random() * tenures.length)];

  const calcRes = http.post(
    `${urls.loan}/api/emi/calculate`,
    JSON.stringify({ principal, annualRate: rate, tenureMonths: tenure }),
    { headers: getAuthHeaders(token) },
  );

  if (calcRes.status === 200) {
    const amortRes = http.post(
      `${urls.loan}/api/emi/amortization`,
      JSON.stringify({ principal, annualRate: rate, tenureMonths: tenure }),
      { headers: getAuthHeaders(token) },
    );

    if (amortRes.status === 200) {
      loanCreationRate.add(0.3);
    }
  }

  if (calcRes.status >= 500) {
    errorRate.add(1);
    memoryLeaks.add(1);
  }
}

export function handleSummary(data: any): Record<string, string | number> {
  const duration = data.state?.testRunDurationMs || 0;
  const durationMin = (duration / 60000).toFixed(1);
  const reqCount = data.metrics?.http_reqs?.values?.count || 0;
  const reqRate = data.metrics?.http_reqs?.values?.rate || 0;
  const errRate = (data.metrics?.error_rate?.values?.rate || 0) * 100;
  const loansCreated = data.metrics?.loan_creation_rate?.values?.count || 0;
  const errors = data.metrics?.error_rate?.values?.count || 0;
  const httpMetrics = data.metrics?.http_req_duration?.values || {};

  let summary = '\n';
  summary += '╔══════════════════════════════════════════════════════╗\n';
  summary += '║              SOAK TEST RESULTS                        ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Environment:  ${env.toUpperCase().padEnd(33)}║\n';
  summary += `║  Duration:    ${durationMin}m (${(duration / 1000).toFixed(0)}s)${''.padEnd(Math.max(0, 26 - durationMin.length - 10))}║\n`;
  summary += `║  VUs:         ${(__ENV.VUS || '10').padEnd(33)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  THROUGHPUT                                             ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Total Requests:     ${String(reqCount).padEnd(25)}║\n`;
  summary += `║  Avg Req/s:          ${reqRate.toFixed(2).padEnd(25)}║\n`;
  summary += `║  Loans Created:      ${String(loansCreated.toFixed(0)).padEnd(25)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  LATENCY (ms)                                              ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  p(50):              ${(httpMetrics['p(50)'] || 0).toFixed(0).padEnd(25)}║\n`;
  summary += `║  p(95):              ${(httpMetrics['p(95)'] || 0).toFixed(0).padEnd(25)}║\n';
  summary += `║  p(99):              ${(httpMetrics['p(99)'] || 0).toFixed(0).padEnd(25)}║\n`;
  summary += `║  avg:                ${(httpMetrics['avg'] || 0).toFixed(0).padEnd(25)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  STABILITY                                                  ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Error Rate:         ${errRate.toFixed(3).padEnd(25)}% ║\n`;
  summary += `║  Total Errors:       ${String(errors).padEnd(25)}║\n`;
  summary += `║  Memory Leak Flags:  ${String(data.metrics?.potential_memory_leaks?.values?.count || 0).padEnd(25)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  STABILITY VERDICT                                        ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';

  const stable = errRate < 1 && errors < 10;
  const latencyStable = (httpMetrics['p(95)'] || 0) < 5000;

  if (stable && latencyStable) {
    summary += '║  ✅ SYSTEM STABLE — No significant degradation detected  ║\n';
  } else if (errRate > 5) {
    summary += '║  ❌ SYSTEM UNSTABLE — High error rate or latency       ║\n';
  } else {
    summary += '║  ⚠️  MARGINAL — Some degradation detected              ║\n';
  }
  summary += '╚══════════════════════════════════════════════════════╝\n';

  return { stdout: summary };
}
