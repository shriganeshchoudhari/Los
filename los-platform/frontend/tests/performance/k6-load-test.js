import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_URL = __ENV.AUTH_URL || 'http://localhost:3002';
const KYC_URL = __ENV.KYC_URL || 'http://localhost:3003';
const DOC_URL = __ENV.DOC_URL || 'http://localhost:3009';

const errorRate = new Rate('errors');
const authLatency = new Trend('auth_latency_ms');
const loanLatency = new Trend('loan_latency_ms');
const kycLatency = new Trend('kyc_latency_ms');
const docLatency = new Trend('doc_latency_ms');

const vuMobile = (vuId) => String(9876540000 + vuId);

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'load' },
    },
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },
    spike: {
      executor: 'spike',
      vus: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 500 },
        { duration: '1m', target: 10 },
      ],
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
    'auth_latency_ms': ['p(95)<300'],
    'loan_latency_ms': ['p(95)<500'],
    'kyc_latency_ms': ['p(95)<800'],
  },
};

function getToken(mobile) {
  const sendRes = http.post(`${AUTH_URL}/auth/otp/send`, JSON.stringify({
    mobile,
    purpose: 'LOGIN',
    channel: 'SMS',
  }), { headers: { 'Content-Type': 'application/json' } });

  const verifyRes = http.post(`${AUTH_URL}/auth/otp/verify`, JSON.stringify({
    mobile,
    otp: '123456',
    sessionId: sendRes.json('sessionId'),
  }), { headers: { 'Content-Type': 'application/json' } });

  return verifyRes.json('accessToken');
}

export function setup() {
  const tokens = [];
  for (let i = 0; i < 10; i++) {
    try {
      tokens.push(getToken(vuMobile(i)));
    } catch (e) {
      console.error(`Failed to get token for VU ${i}: ${e.message}`);
    }
    sleep(0.5);
  }
  return { tokens };
}

export default function(data) {
  const vuId = __VU;
  const token = data.tokens[vuId % data.tokens.length];
  const mobile = vuMobile(vuId);
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const groupEnd = (name) => {
    try {
      const res = http.get(`${BASE_URL}/health`, { tags: { name, test_type: 'health' } });
      check(res, { 'health check': (r) => r.status === 200 });
    } catch (e) {}
  };

  // Auth flow
  groupEnd('auth_send_otp');
  const t0 = Date.now();
  const sendRes = http.post(`${AUTH_URL}/auth/otp/send`, JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'send_otp' },
  });
  authLatency.add(Date.now() - t0);
  check(sendRes, {
    'send otp status 201': (r) => r.status === 201,
    'send otp has sessionId': (r) => !!r.json('sessionId'),
  }) || errorRate.add(1);

  sleep(Math.random() * 2 + 1);

  // Loan application creation
  const t1 = Date.now();
  const appRes = http.post(`${BASE_URL}/applications`, JSON.stringify({
    loanType: 'PERSONAL_LOAN',
    branchCode: 'BR001',
    applicant: {
      fullName: `Load Test User ${vuId}`,
      dob: '1990-04-21',
      mobile,
      panNumber: `AATLT${vuId}Z`,
    },
    employmentDetails: {
      employmentType: 'SALARIED_PRIVATE',
      employerName: 'TCS Limited',
      netMonthlyIncome: 95000,
    },
    loanRequirement: {
      requestedAmount: 500000,
      tenureMonths: 36,
    },
  }), { headers, tags: { name: 'create_application' } });
  loanLatency.add(Date.now() - t1);

  const appId = appRes.json('applicationId');
  if (!appId) {
    errorRate.add(1);
    return;
  }

  check(appRes, {
    'create app status 201': (r) => r.status === 201,
    'create app has applicationId': (r) => !!r.json('applicationId'),
  }) || errorRate.add(1);

  // Get application
  const t2 = Date.now();
  const getRes = http.get(`${BASE_URL}/applications/${appId}`, { headers, tags: { name: 'get_application' } });
  loanLatency.add(Date.now() - t2);
  check(getRes, { 'get app status 200': (r) => r.status === 200 }) || errorRate.add(1);

  // Auto-save
  const t3 = Date.now();
  const saveRes = http.patch(`${BASE_URL}/applications/${appId}/autosave`, JSON.stringify({
    section: 'applicant',
    data: { email: `loadtest${vuId}@test.com` },
  }), { headers, tags: { name: 'autosave' } });
  loanLatency.add(Date.now() - t3);
  check(saveRes, { 'autosave status 200': (r) => r.status === 200 }) || errorRate.add(1);

  // FOIR calculation
  const t4 = Date.now();
  const foirRes = http.get(`${BASE_URL}/applications/${appId}/foir`, { headers, tags: { name: 'foir' } });
  loanLatency.add(Date.now() - t4);
  check(foirRes, { 'foir status 200': (r) => r.status === 200 }) || errorRate.add(1);

  // Submit application
  const t5 = Date.now();
  const submitRes = http.post(`${BASE_URL}/applications/${appId}/submit`, '{}', { headers, tags: { name: 'submit_application' } });
  loanLatency.add(Date.now() - t5);
  check(submitRes, {
    'submit status 200 or 201': (r) => r.status === 200 || r.status === 201,
  }) || errorRate.add(1);

  // KYC consent
  const t6 = Date.now();
  const consentRes = http.post(`${KYC_URL}/kyc/consent`, JSON.stringify({
    applicationId: appId,
    consentType: 'KYC_AADHAAR_EKYC',
    consentText: 'Load test consent',
  }), { headers, tags: { name: 'kyc_consent' } });
  kycLatency.add(Date.now() - t6);
  check(consentRes, { 'consent status 201': (r) => r.status === 201 }) || errorRate.add(1);

  // KYC status
  const t7 = Date.now();
  const kycRes = http.get(`${KYC_URL}/kyc/${appId}`, { headers, tags: { name: 'kyc_status' } });
  kycLatency.add(Date.now() - t7);
  check(kycRes, { 'kyc status 200': (r) => r.status === 200 }) || errorRate.add(1);

  // Document presigned URL
  const t8 = Date.now();
  const uploadRes = http.post(`${DOC_URL}/documents/upload-url`, JSON.stringify({
    applicationId: appId,
    documentType: 'SALARY_SLIP',
    fileName: `salary_slip_${vuId}.pdf`,
    mimeType: 'application/pdf',
  }), { headers, tags: { name: 'doc_upload_url' } });
  docLatency.add(Date.now() - t8);
  check(uploadRes, { 'upload url status 200': (r) => r.status === 200 }) || errorRate.add(1);

  // Decision trigger
  const t9 = Date.now();
  const decisionRes = http.post(`${BASE_URL}/decision/trigger`, JSON.stringify({ applicationId: appId }), { headers, tags: { name: 'decision_trigger' } });
  loanLatency.add(Date.now() - t9);
  check(decisionRes, {
    'decision triggered': (r) => r.status === 200 || r.status === 201,
  }) || errorRate.add(1);

  sleep(Math.random() * 3 + 1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, opts) {
  const duration = data.metrics.http_req_duration;
  const failed = data.metrics.http_req_failed;
  const errors = data.metrics.errors;

  const rows = [
    '=== LOS Platform Load Test Summary ===',
    `Total VUs: ${data.metrics.vus ? data.metrics.vus.values.current : 'N/A'}`,
    `Duration: ${data.state.testRunDuration}`,
    '',
    '--- HTTP Response Times ---',
    `  p(50):  ${duration.values['p(50)']?.toFixed(2)}ms`,
    `  p(95):  ${duration.values['p(95)']?.toFixed(2)}ms`,
    `  p(99):  ${duration.values['p(99)']?.toFixed(2)}ms`,
    '',
    '--- HTTP Failures ---',
    `  Failure Rate: ${(failed.values.rate * 100).toFixed(2)}%`,
    '',
    '--- Custom Metrics ---',
    `  Auth Latency p(95): ${data.metrics.auth_latency_ms?.values['p(95)']?.toFixed(2) || 'N/A'}ms`,
    `  Loan Latency p(95): ${data.metrics.loan_latency_ms?.values['p(95)']?.toFixed(2) || 'N/A'}ms`,
    `  KYC Latency p(95):  ${data.metrics.kyc_latency_ms?.values['p(95)']?.toFixed(2) || 'N/A'}ms`,
    `  Doc Latency p(95):  ${data.metrics.doc_latency_ms?.values['p(95)']?.toFixed(2) || 'N/A'}ms`,
    '',
    '--- Error Rate ---',
    `  ${(errors.values.rate * 100).toFixed(2)}%`,
  ];
  return rows.join('\n');
}
