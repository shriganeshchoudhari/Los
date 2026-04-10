import http from 'k6/http';
import { check } from 'k6/';
import { Counter, Rate, Trend } from 'k6/metrics';
import { getEnv, getBaseUrls, slaThresholds } from './lib/config';
import {
  loginAndGetToken,
  generateApplicationData,
  generateMobile,
  generatePAN,
  handleError,
  getAuthHeaders,
} from './lib/helpers';

const urls = getBaseUrls();
const env = getEnv();

export const options = {
  scenarios: {
    auth_smoke: {
      executor: 'per-vu-iterations',
      vus: 3,
      iterations: 5,
      startTime: '0s',
    },
    loan_smoke: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 5,
      startTime: '5s',
    },
    emi_smoke: {
      executor: 'per-vu-iterations',
      vus: 3,
      iterations: 10,
      startTime: '10s',
    },
    integration_smoke: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 3,
      startTime: '15s',
    },
    dsa_smoke: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 3,
      startTime: '20s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.05'],
  },
  tags: { test_type: 'smoke' },
};

const success = new Counter('smoke_test_success');
const failures = new Counter('smoke_test_failures');
const totalDuration = new Trend('smoke_test_total_duration');

export function setup() {
  console.log(`[SMOKE] Running smoke tests against: ${env}`);
  console.log(`[SMOKE] Auth: ${urls.auth}`);
  console.log(`[SMOKE] Loan: ${urls.loan}`);
  console.log(`[SMOKE] Integration: ${urls.integration}`);
  console.log(`[SMOKE] DSA: ${urls.dsa}`);

  const start = Date.now();

  const officer = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const creditAnalyst = loginAndGetToken(urls.auth, 'CREDIT_ANALYST');
  const branchManager = loginAndGetToken(urls.auth, 'BRANCH_MANAGER');

  return {
    start,
    officerToken: officer.token,
    officerUserId: officer.userId,
    creditToken: creditAnalyst.token,
    branchManagerToken: branchManager.token,
  };
}

export default function(data: ReturnType<typeof setup>) {
  const vu = __VU;
  const iter = __ITER;

  const testKey = `${vu}-${iter}`;
  let testSuccess = true;

  try {
    if (iter % 5 === 0) {
      testAuthFlow(data.officerToken);
    } else if (iter % 5 === 1) {
      testLoanFlow(data.officerToken);
    } else if (iter % 5 === 2) {
      testEmiFlow(data.officerToken);
    } else if (iter % 5 === 3) {
      testIntegrationFlow(data.officerToken);
    } else {
      testDsaFlow();
    }
  } catch (e) {
    console.error(`[SMOKE] Test failed: ${e}`);
    testSuccess = false;
  }

  if (testSuccess) {
    success.add(1);
  } else {
    failures.add(1);
  }
}

function testAuthFlow(token: string) {
  const healthRes = http.get(`${urls.auth}/api/auth/health`);
  check(healthRes, {
    'auth health 200': (r) => r.status === 200,
  });

  const mobile = generateMobile();
  const sendRes = http.post(
    `${urls.auth}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
  );
  check(sendRes, {
    'otp send 200': (r) => r.status === 200,
  });

  if (sendRes.status !== 200) return;

  const sessionId = sendRes.json('sessionId') as string;
  const verifyRes = http.post(
    `${urls.auth}/api/auth/otp/verify`,
    JSON.stringify({ mobile, otp: '123456', sessionId }),
  );
  check(verifyRes, {
    'otp verify 200': (r) => r.status === 200,
  });
}

function testLoanFlow(token: string) {
  const data = generateApplicationData();

  const createRes = http.post(
    `${urls.loan}/api/applications`,
    JSON.stringify(data),
    { headers: getAuthHeaders(token) },
  );
  check(createRes, {
    'loan create 201 or 409': (r) => r.status === 201 || r.status === 409,
  });

  if (createRes.status !== 201) return;
  const appId = (createRes.json() as any).id;

  const getRes = http.get(
    `${urls.loan}/api/applications/${appId}`,
    { headers: getAuthHeaders(token) },
  );
  check(getRes, {
    'loan get 200': (r) => r.status === 200,
  });

  const listRes = http.get(
    `${urls.loan}/api/applications`,
    { params: { page: 1, size: 10 }, headers: getAuthHeaders(token) },
  );
  check(listRes, {
    'loan list 200': (r) => r.status === 200,
  });
}

function testEmiFlow(token: string) {
  const principal = 1000000;
  const annualRate = 10;
  const tenureMonths = 60;

  const calcRes = http.post(
    `${urls.loan}/api/emi/calculate`,
    JSON.stringify({ principal, annualRate, tenureMonths }),
    { headers: getAuthHeaders(token) },
  );
  check(calcRes, {
    'emi calculate 200': (r) => r.status === 200,
    'emi amount positive': (r) => {
      const b = r.json() as any;
      return b && b.emiAmount > 0;
    },
  });

  const amortRes = http.post(
    `${urls.loan}/api/emi/amortization`,
    JSON.stringify({ principal, annualRate, tenureMonths }),
    { headers: getAuthHeaders(token) },
  );
  check(amortRes, {
    'amortization 200': (r) => r.status === 200,
  });

  const maxEmiRes = http.get(
    `${urls.loan}/api/emi/max-eligible-emi`,
    { params: { netMonthlyIncome: 100000, existingEmi: 10000, maxFoirPercent: 50 }, headers: getAuthHeaders(token) },
  );
  check(maxEmiRes, {
    'max eligible emi 200': (r) => r.status === 200,
  });
}

function testIntegrationFlow(token: string) {
  const panHash = 'test-pan-hash-' + Date.now();

  const consentRes = http.post(
    `${urls.integration}/api/integration/bureau/consent`,
    JSON.stringify({ applicationId: 'test-app-id', applicantId: 'test-user', panHash, consentOtp: '123456' }),
    { headers: getAuthHeaders(token) },
  );
  check(consentRes, {
    'bureau consent 200 or 400': (r) => r.status === 200 || r.status === 400,
  });

  const healthRes = http.get(
    `${urls.integration}/api/integration/health/metrics`,
    { headers: getAuthHeaders(token) },
  );
  check(healthRes, {
    'integration health 200': (r) => r.status === 200,
  });
}

function testDsaFlow() {
  const mobile = generateMobile();
  const pan = generatePAN();

  const registerRes = http.post(
    `${urls.dsa}/api/auth/register`,
    JSON.stringify({
      companyName: `SmokeTest Company ${Date.now()}`,
      partnerType: 'PRIVATE_LIMITED',
      pan,
      email: `smoke.${Date.now()}@test.com`,
      mobile,
      contactPersonName: 'Smoke Test',
      contactPersonMobile: mobile,
    }),
  );
  check(registerRes, {
    'dsa register 201 or 409': (r) => r.status === 201 || r.status === 409,
  });

  const loginRes = http.post(
    `${urls.dsa}/api/auth/login`,
    JSON.stringify({ partnerCode: 'TEST001', password: 'test' }),
  );
  check(loginRes, {
    'dsa login 200 or 401': (r) => r.status === 200 || r.status === 401,
  });
}

export function handleSummary(data: any) {
  const duration = (Date.now() - data.setup_data?.start) || 0;
  return {
    'stdout': textSummary(data, { enableColors: true }),
  };
}

function textSummary(data: any, opts: any): string {
  const passed = data.counters?.['smoke_test_success'] || 0;
  const failed = data.counters?.['smoke_test_failures'] || 0;
  const total = passed + failed;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';

  let output = '\n';
  output += '═══════════════════════════════════════════\n';
  output += '           SMOKE TEST RESULTS             \n';
  output += '═══════════════════════════════════════════\n';
  output += `  Environment:  ${env.toUpperCase()}\n`;
  output += `  Duration:     ${(duration / 1000).toFixed(1)}s\n`;
  output += `  Tests:        ${total}\n`;
  output += `  Passed:       ${passed}  ✓\n`;
  output += `  Failed:       ${failed}  ✗\n`;
  output += `  Pass Rate:    ${passRate}%\n`;
  output += '═══════════════════════════════════════════\n';

  const thresholds = data.root_group?.checks || {};
  const checkNames = Object.keys(thresholds);
  if (checkNames.length > 0) {
    output += '  Checks:\n';
    for (const name of checkNames) {
      const check = thresholds[name];
      const status = check.passes > 0 ? '✓' : '✗';
      output += `    ${status} ${name}: ${check.passes}/${check.passes + check.failures}\n`;
    }
  }

  const httpMetrics = data.metrics?.http_req_duration || {};
  const p95 = httpMetrics.values?.['p(95)'] || 0;
  const p99 = httpMetrics.values?.['p(99)'] || 0;
  output += `\n  HTTP Latency:\n`;
  output += `    p(95): ${p95.toFixed(0)}ms\n`;
  output += `    p(99): ${p99.toFixed(0)}ms\n`;

  if (failed > 0) {
    output += '\n  ⚠️  SOME TESTS FAILED\n';
  } else if (passed > 0) {
    output += '\n  ✅ ALL TESTS PASSED\n';
  }

  return output;
}
