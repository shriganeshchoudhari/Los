import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend, Rate } from 'k6/metrics';
import { getEnv, getBaseUrls } from './lib/config';
import { loginAndGetToken, generateApplicationData, handleError, getAuthHeaders } from './lib/helpers';

const env = getEnv();
const urls = getBaseUrls();

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '3m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '3m', target: 200 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<5000', 'p(99)<10000'],
    'http_req_failed': ['rate<0.02'],
  },
};

const spike_rejections = new Counter('spike_rejections');
const latencySpikes = new Counter('latency_spikes');
const throughputDrop = new Counter('throughput_drops');

export function setup() {
  console.log(`[SPIKE] Starting spike test: ${env}`);
  return {};
}

export default function() {
  const vu = __VU;

  if (vu === 0) {
    testSystemHealth();
  } else if (vu % 3 === 0) {
    testHighLoadLoanCreation();
  } else if (vu % 3 === 1) {
    testHighLoadAuth();
  } else {
    testHighLoadEmi();
  }

  sleep(0.2 + Math.random() * 0.5);
}

function testSystemHealth() {
  const endpoints = [
    `${urls.auth}/api/auth/health`,
    `${urls.kyc}/api/kyc/health`,
    `${urls.loan}/api/health`,
    `${urls.decision}/api/health`,
    `${urls.integration}/api/integration/health/metrics`,
  ];

  const batch = endpoints.map((url) => ({
    method: 'GET',
    url,
    params: { headers: { 'Content-Type': 'application/json' } },
  }));

  const responses = http.batch(batch);
  for (const res of responses) {
    if (res.status !== 200) {
      spike_rejections.add(1);
    }
  }
}

function testHighLoadLoanCreation() {
  const token = loginAndGetToken(urls.auth, 'LOAN_OFFICER').token;
  const data = generateApplicationData();

  const res = http.post(
    `${urls.loan}/api/applications`,
    JSON.stringify(data),
    { headers: getAuthHeaders(token) },
  );

  if (res.status === 503 || res.status === 429) {
    spike_rejections.add(1);
  }

  if (res.status >= 500) {
    latencySpikes.add(1);
  }
}

function testHighLoadAuth() {
  const mobile = `${9}${String(Date.now()).substring(7)}${Math.floor(Math.random() * 100)}`.substring(0, 10);

  const sendRes = http.post(
    `${urls.auth}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
  );

  if (sendRes.status === 429) {
    spike_rejections.add(1);
  }
}

function testHighLoadEmi() {
  const token = loginAndGetToken(urls.auth, 'LOAN_OFFICER').token;

  const principals = [100000, 500000, 1000000, 2000000, 5000000, 10000000];
  const rates = [8.5, 9, 10, 10.5, 11, 12, 13, 14, 15];

  const batch = [];
  for (let i = 0; i < 3; i++) {
    const principal = principals[Math.floor(Math.random() * principals.length)];
    const rate = rates[Math.floor(Math.random() * rates.length)];

    batch.push({
      method: 'POST',
      url: `${urls.loan}/api/emi/calculate`,
      body: JSON.stringify({ principal, annualRate: rate, tenureMonths: 60 }),
      params: { headers: getAuthHeaders(token) },
    });
  }

  const responses = http.batch(batch);
  for (const res of responses) {
    if (res.status === 503) {
      spike_rejections.add(1);
    }

    if (res.timings.waiting > 3000) {
      latencySpikes.add(1);
    }
  }
}

export function handleSummary(data: any): Record<string, string | number> {
  const reqCount = data.metrics?.http_reqs?.values?.count || 0;
  const rejections = data.metrics?.spike_rejections?.values?.count || 0;
  const spikes = data.metrics?.latency_spikes?.values?.count || 0;
  const errRate = ((data.metrics?.http_req_failed?.values?.rate || 0) * 100).toFixed(3);
  const httpMetrics = data.metrics?.http_req_duration?.values || {};

  let summary = '\n';
  summary += '╔══════════════════════════════════════════════════════╗\n';
  summary += '║              SPIKE TEST RESULTS                      ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Environment:   ${env.toUpperCase().padEnd(33)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  LOAD PROFILE                                             ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  0 VUs → 50 (1m) → 50 (3m) → 100 (1m) → 100 (3m)  ║\n';
  summary += '║  → 200 (1m) → 200 (3m) → 100 (1m) → 100 (2m) → 0   ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  RESULTS                                                 ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Total Requests:    ${String(reqCount).padEnd(26)}║\n`;
  summary += `║  Spike Rejections: ${String(rejections).padEnd(26)}║\n`;
  summary += `║  Latency Spikes:   ${String(spikes).padEnd(26)}║\n`;
  summary += `║  Error Rate:       ${(errRate + '%').padEnd(26)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  LATENCY AT PEAK (200 VUs)                             ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  p(50): ${(httpMetrics['p(50)'] || 0).toFixed(0)}ms                               ║\n`;
  summary += `║  p(95): ${(httpMetrics['p(95)'] || 0).toFixed(0)}ms                               ║\n`;
  summary += `║  p(99): ${(httpMetrics['p(99)'] || 0).toFixed(0)}ms                               ║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  VERDICT                                                  ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';

  const p95Ok = (httpMetrics['p(95)'] || 0) <= 5000;
  const stable = rejections < reqCount * 0.02;

  if (p95Ok && stable) {
    summary += '║  ✅ SYSTEM HANDLED SPIKE — No degradation             ║\n';
  } else if (!stable) {
    summary += '║  ❌ HIGH REJECTION RATE — Scale may be insufficient     ║\n';
  } else {
    summary += '║  ⚠️  LATENCY DEGRADED — Performance tuning needed     ║\n';
  }
  summary += '╚══════════════════════════════════════════════════════╝\n';

  return { stdout: summary };
}
