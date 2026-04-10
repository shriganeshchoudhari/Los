import { vu, __VU, __ITER } from 'k6/execution';
import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend, Gauge } from 'k6/metrics';
import { getEnv, getBaseUrls, defaultThresholds, slaThresholds } from './lib/config';
import {
  loginAndGetToken,
  generateApplicationData,
  generateMobile,
  handleError,
  getAuthHeaders,
} from './lib/helpers';
import * as auth from './scenarios/auth';
import * as loan from './scenarios/loan';
import * as emi from './scenarios/emi';
import * as kycBureau from './scenarios/kyc-bureau';
import * as decisionIntegration from './scenarios/decision-integration';
import * as document from './scenarios/document';
import * as dsa from './scenarios/dsa';

const env = getEnv();
const urls = getBaseUrls();

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: parseInt(__ENV.VUS || '20', 10),
      duration: __ENV.DURATION || '5m',
      tags: { test_type: 'stress' },
    },
  },
  thresholds: {
    ...defaultThresholds,
    'http_req_duration': [
      `p(95)<${slaThresholds.p95}`,
      `p(99)<${slaThresholds.p99}`,
    ],
    'http_req_failed': [`rate<${slaThresholds.errorRate}`],
    'auth_duration': ['p(95)<1000', 'p(99)<3000'],
    'application_creation_duration': ['p(95)<3000', 'p(99)<8000'],
    'bureau_pull_duration': ['p(95)<10000', 'p(99)<20000'],
    'decision_trigger_duration': ['p(95)<5000', 'p(99)<15000'],
    'disbursement_duration': ['p(95)<5000', 'p(99)<10000'],
    'emi_calculate_duration': ['p(95)<500', 'p(99)<2000'],
  },
};

const activeUsers = new Gauge('active_test_users');
const scenarioRounds = new Counter('scenario_rounds');

export function setup() {
  console.log(`[STRESS] Environment: ${env}`);
  console.log(`[STRESS] VUs: ${__ENV.VUS || '20'}`);
  console.log(`[STRESS] Duration: ${__ENV.DURATION || '5m'}`);
  console.log(`[STRESS] Base URLs:`);
  console.log(`  auth:        ${urls.auth}`);
  console.log(`  kyc:         ${urls.kyc}`);
  console.log(`  loan:        ${urls.loan}`);
  console.log(`  decision:    ${urls.decision}`);
  console.log(`  integration: ${urls.integration}`);
  console.log(`  document:    ${urls.document}`);
  console.log(`  dsa:         ${urls.dsa}`);
  return {};
}

export default function() {
  activeUsers.add(1);
  scenarioRounds.add(1);

  const round = __ITER % 10;

  try {
    if (round === 0) auth.testOtpSendAndVerifyFlow();
    else if (round === 1) loan.scenarios();
    else if (round === 2) emi.scenarios();
    else if (round === 3) kycBureau.scenarios();
    else if (round === 4) decisionIntegration.scenarios();
    else if (round === 5) document.scenarios();
    else if (round === 6) dsa.scenarios();
    else if (round === 7) auth.testRefreshTokenFlow();
    else if (round === 8) loan.scenarios();
    else auth.testHealthEndpoint();
  } catch (e) {
    console.error(`[ERROR] Scenario failed: ${e}`);
  }

  activeUsers.add(-1);

  sleep(0.5 + Math.random());
}

export function handleSummary(data: any): Record<string, string | number> {
  const httpMetrics = data.metrics?.http_req_duration?.values || {};
  const errors = data.metrics?.['http_req_failed']?.values || {};
  const appCreated = data.metrics?.['loan_application_created']?.values?.count || 0;
  const authSuccess = data.metrics?.['auth_otp_verify_success']?.values?.count || 0;
  const authFailure = data.metrics?.['auth_otp_verify_failure']?.values?.count || 0;
  const emiCalcs = data.metrics?.['emi_calculate_success']?.values?.count || 0;
  const bureauPulls = data.metrics?.['bureau_pull_success']?.values?.count || 0;
  const decisions = data.metrics?.['decision_trigger_success']?.values?.count || 0;
  const disbursements = data.metrics?.['disbursement_init_success']?.values?.count || 0;

  const totalAuth = authSuccess + authFailure;
  const authRate = totalAuth > 0 ? ((authSuccess / totalAuth) * 100).toFixed(1) : '0';

  let summary = '\n';
  summary += '╔══════════════════════════════════════════════════════╗\n';
  summary += '║            STRESS TEST RESULTS                       ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Environment:    ${env.toUpperCase().padEnd(33)}║\n`;
  summary += `║  Duration:       ${(__ENV.DURATION || '5m').padEnd(33)}║\n`;
  summary += `║  Total VUs:     ${(__ENV.VUS || '20').padEnd(33)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  THROUGHPUT METRICS                                  ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Total Requests:  ${String(data.metrics?.http_reqs?.values?.count || 0).padEnd(30)}║\n`;
  summary += `║  Req/s:           ${(data.metrics?.http_reqs?.values?.rate || 0).toFixed(2).padEnd(30)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  LATENCY (ms)                                            ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  p(50):           ${(httpMetrics['p(50)'] || 0).toFixed(0).padEnd(30)}║\n`;
  summary += `║  p(75):           ${(httpMetrics['p(75)'] || 0).toFixed(0).padEnd(30)}║\n`;
  summary += `║  p(90):           ${(httpMetrics['p(90)'] || 0).toFixed(0).padEnd(30)}║\n`;
  summary += `║  p(95):           ${(httpMetrics['p(95)'] || 0).toFixed(0).padEnd(30)}║\n`;
  summary += `║  p(99):           ${(httpMetrics['p(99)'] || 0).toFixed(0).padEnd(30)}║\n`;
  summary += `║  avg:             ${(httpMetrics['avg'] || 0).toFixed(0).padEnd(30)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  ERROR RATE                                             ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Error Rate:      ${((errors.rate || 0) * 100).toFixed(3).padEnd(27)}% ║\n`;
  summary += `║  Errors:          ${String(errors.count || 0).padEnd(30)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  BUSINESS METRICS                                      ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += `║  Loan Applications Created:  ${String(appCreated).padEnd(17)}║\n`;
  summary += `║  Auth Success Rate:          ${(authRate + '%').padEnd(18)}║\n`;
  summary += `║  EMI Calculations:            ${String(emiCalcs).padEnd(17)}║\n`;
  summary += `║  Bureau Pulls:               ${String(bureauPulls).padEnd(17)}║\n`;
  summary += `║  Decisions Triggered:         ${String(decisions).padEnd(17)}║\n`;
  summary += `║  Disbursements Initiated:    ${String(disbursements).padEnd(17)}║\n`;
  summary += '╠══════════════════════════════════════════════════════╣\n';
  summary += '║  SLA STATUS                                           ║\n';
  summary += '╠══════════════════════════════════════════════════════╣\n';

  const p95Pass = (httpMetrics['p(95)'] || 0) <= slaThresholds.p95;
  const p99Pass = (httpMetrics['p(99)'] || 0) <= slaThresholds.p99;
  const errRatePass = (errors.rate || 0) <= slaThresholds.errorRate;

  summary += `║  p(95) < ${slaThresholds.p95}ms:  ${p95Pass ? '✅ PASS' : '❌ FAIL'.padEnd(21)}║\n`;
  summary += `║  p(99) < ${slaThresholds.p99}ms:  ${p99Pass ? '✅ PASS' : '❌ FAIL'.padEnd(21)}║\n`;
  summary += `║  Error Rate < ${(slaThresholds.errorRate * 100).toFixed(1)}%:   ${errRatePass ? '✅ PASS' : '❌ FAIL'.padEnd(21)}║\n`;
  summary += '╚══════════════════════════════════════════════════════╝\n';

  return { stdout: summary };
}
