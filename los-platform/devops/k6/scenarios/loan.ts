import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend } from 'k6/metrics';
import { getBaseUrls } from '../lib/config';
import {
  generateMobile,
  generateApplicationData,
  generateUUID,
  handleError,
  getAuthHeaders,
  loginAndGetToken,
} from '../lib/helpers';

const urls = getBaseUrls();

export const applicationCreated = new Counter('loan_application_created');
export const applicationDuplicate = new Counter('loan_application_duplicate');
export const applicationStatusUpdate = new Counter('loan_application_status_update');
export const applicationFetched = new Counter('loan_application_fetched');
export const applicationListFetched = new Counter('loan_application_list_fetched');

export const createDuration = new Trend('loan_create_duration');
export const fetchDuration = new Trend('loan_fetch_duration');
export const listDuration = new Trend('loan_list_duration');
export const statusUpdateDuration = new Trend('loan_status_update_duration');

const STATUS_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['KYC_IN_PROGRESS', 'WITHDRAWN'],
  KYC_IN_PROGRESS: ['BUREAU_REVIEW', 'KYC_FAILED'],
  BUREAU_REVIEW: ['DECISION_PENDING', 'BUREAU_FAILED'],
  DECISION_PENDING: ['APPROVED', 'REJECTED', 'CONDITIONAL'],
  APPROVED: ['SANCTIONED'],
  CONDITIONAL: ['APPROVED', 'REJECTED'],
  SANCTIONED: ['DISBURSED', 'CANCELLED'],
  DISBURSED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const createdApps: string[] = [];

export function scenarios() {
  const vu = __VU;

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  const vuMod = vu % 8;
  if (vuMod === 0) {
    testCreateApplication(token);
  } else if (vuMod === 1) {
    testGetApplication(token);
  } else if (vuMod === 2) {
    testListApplications(token);
  } else if (vuMod === 3) {
    testStatusTransition(token);
  } else if (vuMod === 4) {
    testDuplicateApplicationPrevention(token);
  } else if (vuMod === 5) {
    testApplicationFiltering(token);
  } else if (vuMod === 6) {
    testBulkStatusUpdate(token);
  } else {
    testApplicationSearch(token);
  }

  sleep(0.5 + Math.random() * 1.5);
}

export function testCreateApplication(token: string) {
  const data = generateApplicationData();

  const res = http.post(
    `${urls.loan}/api/applications`,
    JSON.stringify(data),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'loan/application/create' },
    },
  );

  createDuration.add(res.timings.duration);
  handleError(res, 'Create application');

  check(res, {
    'create returns 201': (r) => r.status === 201,
    'create returns application id': (r) => {
      const b = r.json() as any;
      return b && !!b.id;
    },
    'create returns application number': (r) => {
      const b = r.json() as any;
      return b && !!b.applicationNumber;
    },
    'create returns SUBMITTED status': (r) => {
      const b = r.json() as any;
      return b && b.status === 'SUBMITTED';
    },
  });

  if (res.status === 201) {
    const body = res.json() as any;
    if (body.id) {
      createdApps.push(body.id);
      applicationCreated.add(1);
    }
  } else if (res.status === 409) {
    applicationDuplicate.add(1);
  }
}

export function testGetApplication(token: string) {
  if (createdApps.length === 0) return;

  const appId = createdApps[Math.floor(Math.random() * createdApps.length)];

  const res = http.get(
    `${urls.loan}/api/applications/${appId}`,
    {
      headers: getAuthHeaders(token),
      tags: { name: 'loan/application/get' },
    },
  );

  fetchDuration.add(res.timings.duration);
  handleError(res, 'Get application');

  check(res, {
    'get returns 200': (r) => r.status === 200,
    'get returns correct id': (r) => {
      const b = r.json() as any;
      return b && b.id === appId;
    },
  });

  if (res.status === 200) {
    applicationFetched.add(1);
  }
}

export function testListApplications(token: string) {
  const page = Math.floor(Math.random() * 5) + 1;
  const size = [10, 20, 50][Math.floor(Math.random() * 3)];

  const res = http.get(
    `${urls.loan}/api/applications`,
    {
      params: { page, size },
      headers: getAuthHeaders(token),
      tags: { name: 'loan/application/list' },
    },
  );

  listDuration.add(res.timings.duration);
  handleError(res, 'List applications');

  check(res, {
    'list returns 200': (r) => r.status === 200,
    'list returns applications array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.applications);
    },
    'list returns pagination': (r) => {
      const b = r.json() as any;
      return b && b.pagination && typeof b.pagination.total === 'number';
    },
  });

  if (res.status === 200) {
    applicationListFetched.add(1);
  }
}

export function testStatusTransition(token: string) {
  if (createdApps.length === 0) {
    const data = generateApplicationData();
    const res = http.post(
      `${urls.loan}/api/applications`,
      JSON.stringify(data),
      { headers: getAuthHeaders(token) },
    );
    if (res.status === 201) {
      const body = res.json() as any;
      createdApps.push(body.id);
    } else {
      return;
    }
  }

  const appId = createdApps[createdApps.length - 1];

  const getRes = http.get(
    `${urls.loan}/api/applications/${appId}`,
    { headers: getAuthHeaders(token) },
  );
  if (getRes.status !== 200) return;

  const currentStatus = (getRes.json() as any).status as string;
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] || [];

  if (nextStatuses.length === 0) return;

  const nextStatus = nextStatuses[Math.floor(Math.random() * nextStatuses.length)];

  const updateRes = http.patch(
    `${urls.loan}/api/applications/${appId}/status`,
    JSON.stringify({ status: nextStatus, remarks: `Load test transition to ${nextStatus}` }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'loan/application/status' },
    },
  );

  statusUpdateDuration.add(updateRes.timings.duration);
  handleError(updateRes, 'Status transition');

  check(updateRes, {
    'status update returns 200 or 400': (r) => r.status === 200 || r.status === 400,
  });

  if (updateRes.status === 200) {
    applicationStatusUpdate.add(1);
  }
}

export function testDuplicateApplicationPrevention(token: string) {
  const data = generateApplicationData();

  const res1 = http.post(
    `${urls.loan}/api/applications`,
    JSON.stringify(data),
    { headers: getAuthHeaders(token) },
  );
  if (res1.status !== 201) return;

  const body1 = res1.json() as any;
  const appId = body1.id;

  const res2 = http.post(
    `${urls.loan}/api/applications`,
    JSON.stringify(data),
    {
      headers: {
        ...getAuthHeaders(token),
        'X-Idempotency-Key': generateUUID(),
      },
      tags: { name: 'loan/application/duplicate' },
    },
  );

  check(res2, {
    'duplicate application returns 409': (r) => r.status === 409,
    'duplicate returns APP_002': (r) => {
      const b = r.json() as any;
      return b && b.code === 'APP_002';
    },
  });

  if (res2.status === 409) {
    applicationDuplicate.add(1);
  }

  if (appId) {
    createdApps.push(appId);
  }
}

export function testApplicationFiltering(token: string) {
  const statuses = ['SUBMITTED', 'KYC_IN_PROGRESS', 'BUREAU_REVIEW', 'DECISION_PENDING', 'APPROVED', 'REJECTED'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  const res = http.get(
    `${urls.loan}/api/applications`,
    {
      params: { status, page: 1, size: 20 },
      headers: getAuthHeaders(token),
      tags: { name: 'loan/application/filter' },
    },
  );

  handleError(res, 'Filter applications');

  check(res, {
    'filter returns 200': (r) => r.status === 200,
  });
}

export function testBulkStatusUpdate(token: string) {
  const sample = createdApps.slice(0, Math.min(5, createdApps.length));
  if (sample.length === 0) return;

  const batch = sample.map((appId) => ({
    method: 'PATCH',
    url: `${urls.loan}/api/applications/${appId}/status`,
    body: JSON.stringify({ status: 'KYC_IN_PROGRESS', remarks: 'Bulk update' }),
    params: { headers: getAuthHeaders(token) },
  }));

  const responses = http.batch(batch, { tags: { name: 'loan/application/bulk' } });
  for (const res of responses) {
    handleError(res, 'Bulk status update');
  }
}

export function testApplicationSearch(token: string) {
  const branches = Array.from({ length: 20 }, (_, i) => `BR${String(i + 1).padStart(3, '0')}`);
  const branchCode = branches[Math.floor(Math.random() * branches.length)];

  const res = http.get(
    `${urls.loan}/api/applications`,
    {
      params: { branchCode, page: 1, size: 10 },
      headers: getAuthHeaders(token),
      tags: { name: 'loan/application/search' },
    },
  );

  handleError(res, 'Application search');
  check(res, {
    'search returns 200': (r) => r.status === 200,
  });
}
