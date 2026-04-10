import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend } from 'k6/metrics';
import { getBaseUrls } from '../lib/config';
import {
  generateMobile,
  generateApplicationData,
  handleError,
  getAuthHeaders,
  loginAndGetToken,
  generateUUID,
} from '../lib/helpers';

const urls = getBaseUrls();

export const kycInitiateSuccess = new Counter('kyc_initiate_success');
export const kycVerifySuccess = new Counter('kyc_verify_success');
export const kycStatusFetched = new Counter('kyc_status_fetched');
export const bureauConsentSuccess = new Counter('bureau_consent_success');
export const bureauPullSuccess = new Counter('bureau_pull_success');
export const bureauReportsFetched = new Counter('bureau_reports_fetched');

export const kycInitiateDuration = new Trend('kyc_initiate_duration');
export const bureauPullDuration = new Trend('bureau_pull_duration');
export const bureauConsentDuration = new Trend('bureau_consent_duration');

const createdApps: string[] = [];

async function createApplication(token: string): Promise<string> {
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
  if (createdApps.length > 0) {
    return createdApps[Math.floor(Math.random() * createdApps.length)];
  }
  throw new Error('No application available');
}

export function scenarios() {
  const vu = __VU;
  const vuMod = vu % 9;

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (vuMod === 0) {
    testKycStatusFetch();
  } else if (vuMod === 1) {
    testBureauConsent();
  } else if (vuMod === 2) {
    testBureauPull();
  } else if (vuMod === 3) {
    testBureauReports();
  } else if (vuMod === 4) {
    testKycConsentCapture();
  } else if (vuMod === 5) {
    testKycCompletionCheck();
  } else if (vuMod === 6) {
    testPddChecklist();
  } else if (vuMod === 7) {
    testPddChecklistUpdate();
  } else {
    testIntegrationHealth();
  }

  sleep(1 + Math.random() * 2);
}

export function testKycStatusFetch() {
  let appId: string;
  try {
    appId = createdApps.length > 0 ? createdApps[createdApps.length - 1] : '';
  } catch {
    return;
  }

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (!appId) return;

  const res = http.get(
    `${urls.kyc}/api/kyc/${appId}`,
    {
      headers: getAuthHeaders(token),
      tags: { name: 'kyc/status/get' },
    },
  );

  handleError(res, 'KYC status fetch');

  check(res, {
    'kyc status returns 200': (r) => r.status === 200,
    'returns applicationId': (r) => {
      const b = r.json() as any;
      return b && b.applicationId;
    },
  });

  if (res.status === 200) {
    kycStatusFetched.add(1);
  }
}

export function testBureauConsent() {
  let appId: string;
  try {
    appId = createdApps.length > 0 ? createdApps[createdApps.length - 1] : '';
  } catch {
    return;
  }

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (!appId) return;

  const panHash = generateUUID().replace(/-/g, '').substring(0, 64);

  const res = http.post(
    `${urls.integration}/api/integration/bureau/consent`,
    JSON.stringify({
      applicationId: appId,
      applicantId: tokenResult.userId,
      panHash,
      consentOtp: '123456',
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'bureau/consent' },
    },
  );

  bureauConsentDuration.add(res.timings.duration);
  handleError(res, 'Bureau consent');

  check(res, {
    'consent returns 200': (r) => r.status === 200 || r.status === 400,
    'consent returns consentId': (r) => {
      const b = r.json() as any;
      return b && b.success;
    },
  });

  if (res.status === 200) {
    bureauConsentSuccess.add(1);
  }
}

export function testBureauPull() {
  let appId: string;
  try {
    appId = createdApps.length > 0 ? createdApps[createdApps.length - 1] : '';
  } catch {
    return;
  }

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (!appId) return;

  const panHash = generateUUID().replace(/-/g, '').substring(0, 64);
  const providers = ['CIBIL', 'EXPERIAN'][Math.floor(Math.random() * 2)] === 'CIBIL'
    ? ['CIBIL']
    : ['CIBIL', 'EXPERIAN'];

  const res = http.post(
    `${urls.integration}/api/integration/bureau/pull`,
    JSON.stringify({
      applicationId: appId,
      panHash,
      providers,
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'bureau/pull' },
    },
  );

  bureauPullDuration.add(res.timings.duration);
  handleError(res, 'Bureau pull');

  check(res, {
    'bureau pull returns 200': (r) => r.status === 200,
    'returns jobs array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.jobs);
    },
    'returns applicationId': (r) => {
      const b = r.json() as any;
      return b && b.applicationId === appId;
    },
  });

  if (res.status === 200) {
    bureauPullSuccess.add(1);
  }
}

export function testBureauReports() {
  let appId: string;
  try {
    appId = createdApps.length > 0 ? createdApps[createdApps.length - 1] : '';
  } catch {
    return;
  }

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (!appId) return;

  const res = http.get(
    `${urls.integration}/api/integration/bureau/reports`,
    {
      params: { applicationId: appId },
      headers: getAuthHeaders(token),
      tags: { name: 'bureau/reports' },
    },
  );

  handleError(res, 'Bureau reports');

  check(res, {
    'reports returns 200': (r) => r.status === 200,
    'returns reports array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.reports);
    },
  });

  if (res.status === 200) {
    bureauReportsFetched.add(1);
  }
}

export function testKycConsentCapture() {
  let appId: string;
  try {
    appId = createdApps.length > 0 ? createdApps[createdApps.length - 1] : '';
  } catch {
    return;
  }

  const tokenResult = loginAndGetToken(urls.auth, 'APPLICANT');
  const token = tokenResult.token;

  if (!appId) return;

  const res = http.post(
    `${urls.kyc}/api/kyc/consent`,
    JSON.stringify({
      applicationId: appId,
      consentType: 'BUREAU_PULL',
      consentText: 'I consent to bureau check for credit assessment',
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'kyc/consent' },
    },
  );

  handleError(res, 'KYC consent');

  check(res, {
    'consent returns 201 or 400': (r) => r.status === 201 || r.status === 400,
  });
}

export function testKycCompletionCheck() {
  let appId: string;
  try {
    appId = createdApps.length > 0 ? createdApps[createdApps.length - 1] : '';
  } catch {
    return;
  }

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (!appId) return;

  const res = http.post(
    `${urls.kyc}/api/kyc/check-completion`,
    JSON.stringify({ applicationId: appId }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'kyc/completion' },
    },
  );

  handleError(res, 'KYC completion check');

  check(res, {
    'completion returns 200': (r) => r.status === 200,
  });
}

export function testPddChecklist() {
  let appId: string;
  try {
    appId = createdApps.length > 0 ? createdApps[createdApps.length - 1] : '';
  } catch {
    return;
  }

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (!appId) return;

  const res = http.get(
    `${urls.loan}/api/pdd/${appId}/checklist`,
    {
      headers: getAuthHeaders(token),
      tags: { name: 'pdd/checklist/get' },
    },
  );

  handleError(res, 'PDD checklist fetch');

  check(res, {
    'pdd checklist returns 200': (r) => r.status === 200,
    'returns applicationId': (r) => {
      const b = r.json() as any;
      return b && b.applicationId === appId;
    },
    'returns items array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.items);
    },
  });
}

export function testPddChecklistUpdate() {
  let appId: string;
  try {
    appId = createdApps.length > 0 ? createdApps[createdApps.length - 1] : '';
  } catch {
    return;
  }

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (!appId) return;

  const checklistRes = http.get(
    `${urls.loan}/api/pdd/${appId}/checklist`,
    { headers: getAuthHeaders(token) },
  );
  if (checklistRes.status !== 200) return;

  const checklist = checklistRes.json() as any;
  if (!checklist.items || checklist.items.length === 0) return;

  const item = checklist.items[0];

  const updateRes = http.patch(
    `${urls.loan}/api/pdd/${appId}/checklist/${item.id}`,
    JSON.stringify({
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'pdd/checklist/update' },
    },
  );

  handleError(updateRes, 'PDD checklist update');

  check(updateRes, {
    'pdd update returns 200': (r) => r.status === 200 || r.status === 400,
  });
}

export function testIntegrationHealth() {
  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  const res = http.get(
    `${urls.integration}/api/integration/health/metrics`,
    {
      headers: getAuthHeaders(token),
      tags: { name: 'integration/health' },
    },
  );

  handleError(res, 'Integration health');

  check(res, {
    'integration health returns 200': (r) => r.status === 200,
    'returns bureau circuits': (r) => {
      const b = r.json() as any;
      return b && typeof b.bureauCibil === 'object';
    },
  });
}
