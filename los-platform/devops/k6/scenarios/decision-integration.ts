import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend } from 'k6/metrics';
import { getBaseUrls } from '../lib/config';
import {
  generateApplicationData,
  handleError,
  getAuthHeaders,
  loginAndGetToken,
  generateUUID,
} from '../lib/helpers';

const urls = getBaseUrls();

export const decisionTriggerSuccess = new Counter('decision_trigger_success');
export const decisionGetSuccess = new Counter('decision_get_success');
export const disbursementInitSuccess = new Counter('disbursement_init_success');
export const disbursementListSuccess = new Counter('disbursement_list_success');
export const pennyDropSuccess = new Counter('penny_drop_success');
export const nachMandateSuccess = new Counter('nach_mandate_success');

export const decisionTriggerDuration = new Trend('decision_trigger_duration');
export const disbursementDuration = new Trend('disbursement_duration');

const createdApps: string[] = [];

async function ensureApplication(token: string): Promise<string> {
  const data = generateApplicationData();
  const res = await http.post(
    `${urls.loan}/api/applications`,
    JSON.stringify(data),
    { headers: getAuthHeaders(token) },
  );
  if (res.status === 201) {
    const body = res.json() as any;
    createdApps.push(body.id);
    return body.id;
  }
  return createdApps.length > 0 ? createdApps[0] : '';
}

export function scenarios() {
  const vu = __VU;
  const vuMod = vu % 9;

  const creditToken = loginAndGetToken(urls.auth, 'CREDIT_ANALYST');
  const officerToken = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const branchManagerToken = loginAndGetToken(urls.auth, 'BRANCH_MANAGER');

  if (vuMod === 0) {
    testDecisionTrigger(creditToken.token);
  } else if (vuMod === 1) {
    testGetDecision(creditToken.token);
  } else if (vuMod === 2) {
    testDisbursementInit(officerToken.token);
  } else if (vuMod === 3) {
    testDisbursementList(officerToken.token);
  } else if (vuMod === 4) {
    testPennyDropVerify(officerToken.token);
  } else if (vuMod === 5) {
    testNachMandate(officerToken.token);
  } else if (vuMod === 6) {
    testOverrideRequest(branchManagerToken.token);
  } else if (vuMod === 7) {
    testCbsCustomerCreate(officerToken.token);
  } else {
    testDecisionOverrideFlow(branchManagerToken.token);
  }

  sleep(1 + Math.random() * 2);
}

export function testDecisionTrigger(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const res = http.post(
    `${urls.decision}/api/decisions/trigger`,
    JSON.stringify({
      applicationId: appId,
      manualScore: 650 + Math.floor(Math.random() * 150),
      manualGrade: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
      remarks: 'Load test decision trigger',
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'decision/trigger' },
    },
  );

  decisionTriggerDuration.add(res.timings.duration);
  handleError(res, 'Decision trigger');

  check(res, {
    'decision trigger returns 200': (r) => r.status === 200,
    'returns applicationId': (r) => {
      const b = r.json() as any;
      return b && b.applicationId === appId;
    },
    'returns decision': (r) => {
      const b = r.json() as any;
      return b && b.decision;
    },
  });

  if (res.status === 200) {
    decisionTriggerSuccess.add(1);
  }
}

export function testGetDecision(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const res = http.get(
    `${urls.decision}/api/decisions/${appId}`,
    {
      headers: getAuthHeaders(token),
      tags: { name: 'decision/get' },
    },
  );

  handleError(res, 'Get decision');

  check(res, {
    'get decision returns 200': (r) => r.status === 200,
    'returns applicationId': (r) => {
      const b = r.json() as any;
      return b && b.applicationId === appId;
    },
  });

  if (res.status === 200) {
    decisionGetSuccess.add(1);
  }
}

export function testDisbursementInit(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const paymentModes = ['IMPS', 'NEFT', 'RTGS', 'UPI', 'NACH'];
  const paymentMode = paymentModes[Math.floor(Math.random() * paymentModes.length)];

  const res = http.post(
    `${urls.integration}/api/integration/disbursement`,
    JSON.stringify({
      applicationId: appId,
      amount: 100000 + Math.floor(Math.random() * 1000000),
      paymentMode,
      beneficiaryAccountNumber: '50100258198762',
      beneficiaryIfsc: 'HDFC0000001',
      beneficiaryName: `LoadTest Beneficiary ${Date.now()}`,
      beneficiaryBankName: 'HDFC Bank',
      beneficiaryMobile: '9876543210',
      remarks: 'Load test disbursement',
    }),
    {
      headers: {
        ...getAuthHeaders(token),
        'X-Idempotency-Key': generateUUID(),
      },
      tags: { name: 'disbursement/init' },
    },
  );

  disbursementDuration.add(res.timings.duration);
  handleError(res, 'Disbursement init');

  check(res, {
    'disbursement init returns 201 or 400': (r) => r.status === 201 || r.status === 400,
  });

  if (res.status === 201) {
    disbursementInitSuccess.add(1);
  }
}

export function testDisbursementList(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const statuses = ['PENDING', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', undefined];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  const params: Record<string, string> = { applicationId: appId };
  if (status) params['status'] = status;

  const res = http.get(
    `${urls.integration}/api/integration/disbursement`,
    {
      params,
      headers: getAuthHeaders(token),
      tags: { name: 'disbursement/list' },
    },
  );

  handleError(res, 'Disbursement list');

  check(res, {
    'disbursement list returns 200': (r) => r.status === 200,
    'returns disbursements array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.disbursements);
    },
  });

  if (res.status === 200) {
    disbursementListSuccess.add(1);
  }
}

export function testPennyDropVerify(token: string) {
  const accountNumbers = ['50100258198762', '50100258198763', '50100258198764', '50100258198765'];
  const ifscCodes = ['HDFC0000001', 'SBIN0000001', 'ICIC0000001', 'UTIB0000001'];

  const res = http.post(
    `${urls.integration}/api/integration/penny-drop/verify`,
    JSON.stringify({
      accountNumber: accountNumbers[Math.floor(Math.random() * accountNumbers.length)],
      ifscCode: ifscCodes[Math.floor(Math.random() * ifscCodes.length)],
      beneficiaryName: `LoadTest ${Date.now()}`,
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'penny-drop/verify' },
    },
  );

  handleError(res, 'Penny drop verify');

  check(res, {
    'penny drop returns 200': (r) => r.status === 200,
    'returns verified boolean': (r) => {
      const b = r.json() as any;
      return b && typeof b.verified === 'boolean';
    },
  });

  if (res.status === 200) {
    pennyDropSuccess.add(1);
  }
}

export function testNachMandate(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const res = http.post(
    `${urls.integration}/api/integration/nach/mandate`,
    JSON.stringify({
      applicationId: appId,
      loanId: generateUUID(),
      loanAccountId: `LA${Math.floor(Math.random() * 100000000)}`,
      sponsorCode: 'SPONSOR01',
      utilityCode: 'UTIL01',
      debtorAccountNumber: '50100258198762',
      debtorIfsc: 'HDFC0000001',
      debtorName: `LoadTest Mandate ${Date.now()}`,
      maxAmount: 500000,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'nach/mandate' },
    },
  );

  handleError(res, 'NACH mandate');

  check(res, {
    'nach mandate returns 201 or 400': (r) => r.status === 201 || r.status === 400,
  });

  if (res.status === 201) {
    nachMandateSuccess.add(1);
  }
}

export function testOverrideRequest(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const res = http.post(
    `${urls.decision}/api/decisions/override/request`,
    JSON.stringify({
      applicationId: appId,
      requestedDecision: 'APPROVED',
      requestedAmount: 2000000,
      requestedTenureMonths: 60,
      requestedRateOfInterestBps: 950,
      justification: 'Strong profile, high income, excellent bureau score',
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'decision/override/request' },
    },
  );

  handleError(res, 'Override request');

  check(res, {
    'override request returns 201 or 400': (r) => r.status === 201 || r.status === 400,
  });
}

export function testCbsCustomerCreate(token: string) {
  const customerId = `CUST${Date.now()}${Math.floor(Math.random() * 10000)}`;

  const res = http.post(
    `${urls.integration}/api/integration/cbs/customer`,
    JSON.stringify({
      customerId,
      firstName: 'LoadTest',
      lastName: 'Customer',
      dateOfBirth: '1990-01-15',
      mobile: '9876543210',
      email: `loadtest.${Date.now()}@example.com`,
      address: {
        line1: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India',
      },
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'cbs/customer/create' },
    },
  );

  handleError(res, 'CBS customer create');

  check(res, {
    'cbs customer returns 201 or 400': (r) => r.status === 201 || r.status === 400,
  });
}

export function testDecisionOverrideFlow(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const requestRes = http.post(
    `${urls.decision}/api/decisions/override/request`,
    JSON.stringify({
      applicationId: appId,
      requestedDecision: 'CONDITIONAL',
      requestedAmount: 1500000,
      justification: 'Override for load test',
    }),
    { headers: getAuthHeaders(token) },
  );

  if (requestRes.status !== 201) return;

  const requestBody = requestRes.json() as any;
  const requestId = requestBody.requestId;

  const pendingRes = http.get(
    `${urls.decision}/api/decisions/override/pending`,
    {
      headers: getAuthHeaders(token),
      tags: { name: 'decision/override/pending' },
    },
  );

  handleError(pendingRes, 'Override pending list');

  check(pendingRes, {
    'pending list returns 200': (r) => r.status === 200,
  });
}
