import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const errorRate = new Rate('errors');
const latency = new Trend('latency_ms');

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

export default function() {
  const mobile = `perf${__VU}`;
  let token;
  let applicationId;

  // Auth - send otp
  const t0 = Date.now();
  const sendRes = http.post(`${BASE_URL}/auth/otp/send`, JSON.stringify({
    mobile,
    purpose: 'LOGIN',
    channel: 'SMS',
  }), { headers: { 'Content-Type': 'application/json' } });
  latency.add(Date.now() - t0);
  const ok1 = check(sendRes, { 'send otp': (r) => r.status === 201 }) || errorRate.add(1);

  // Auth - verify otp
  const t1 = Date.now();
  const verifyRes = http.post(`${BASE_URL}/auth/otp/verify`, JSON.stringify({
    mobile,
    otp: '123456',
    sessionId: sendRes.json('sessionId'),
  }), { headers: { 'Content-Type': 'application/json' } });
  latency.add(Date.now() - t1);
  token = verifyRes.json('accessToken');
  const ok2 = check(verifyRes, { 'verify otp': (r) => r.status === 200 }) || errorRate.add(1);
  if (!token) return;

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Create application
  const t2 = Date.now();
  const appRes = http.post(`${BASE_URL}/applications`, JSON.stringify({
    loanType: 'PERSONAL_LOAN',
    branchCode: 'BR001',
    applicant: { fullName: `Perf ${__VU}`, dob: '1990-04-21', mobile, panNumber: `PPERF${__VU}Z` },
    employmentDetails: { employmentType: 'SALARIED_PRIVATE', employerName: 'Perf Org', netMonthlyIncome: 95000 },
    loanRequirement: { requestedAmount: 500000, tenureMonths: 36 },
  }), { headers });
  latency.add(Date.now() - t2);
  applicationId = appRes.json('applicationId');
  const ok3 = check(appRes, { 'create app': (r) => r.status === 201 }) || errorRate.add(1);

  if (!applicationId) return;

  // FOIR
  const t3 = Date.now();
  const foirRes = http.get(`${BASE_URL}/applications/${applicationId}/foir`, { headers });
  latency.add(Date.now() - t3);
  check(foirRes, { 'foir': (r) => r.status === 200 }) || errorRate.add(1);

  // Submit
  const t4 = Date.now();
  const submitRes = http.post(`${BASE_URL}/applications/${applicationId}/submit`, '{}', { headers });
  latency.add(Date.now() - t4);
  check(submitRes, { 'submit': (r) => r.status === 200 || r.status === 201 }) || errorRate.add(1);

  // List applications
  const t5 = Date.now();
  const listRes = http.get(`${BASE_URL}/applications?page=0&size=20`, { headers });
  latency.add(Date.now() - t5);
  check(listRes, { 'list': (r) => r.status === 200 }) || errorRate.add(1);

  sleep(0.1);
}
