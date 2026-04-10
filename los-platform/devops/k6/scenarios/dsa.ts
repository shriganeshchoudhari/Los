import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend } from 'k6/metrics';
import { getBaseUrls } from '../lib/config';
import { generateMobile, generatePAN, handleError, generateUUID } from '../lib/helpers';

const urls = getBaseUrls();

export const dsaRegisterSuccess = new Counter('dsa_register_success');
export const dsaLoginSuccess = new Counter('dsa_login_success');
export const dsaApplicationCreateSuccess = new Counter('dsa_application_create_success');
export const dsaDashboardSuccess = new Counter('dsa_dashboard_success');
export const dsaOfficerLoginSuccess = new Counter('dsa_officer_login_success');

export const dsaLoginDuration = new Trend('dsa_login_duration');
export const dsaAppCreateDuration = new Trend('dsa_app_create_duration');

export function scenarios() {
  const vu = __VU;
  const vuMod = vu % 7;

  if (vuMod === 0) {
    testDsaRegister();
  } else if (vuMod === 1) {
    testDsaLogin();
  } else if (vuMod === 2) {
    testDsaDashboard();
  } else if (vuMod === 3) {
    testDsaApplicationList();
  } else if (vuMod === 4) {
    testDsaProfile();
  } else if (vuMod === 5) {
    testDsaCommissions();
  } else {
    testDsaOfficerLogin();
  }

  sleep(1 + Math.random() * 2);
}

export function testDsaRegister() {
  const mobile = generateMobile();
  const pan = generatePAN();
  const timestamp = Date.now();

  const res = http.post(
    `${urls.dsa}/api/auth/register`,
    JSON.stringify({
      companyName: `LoadTest Solutions ${timestamp}`,
      partnerType: ['PRIVATE_LIMITED', 'LLP', 'PROPRIETORSHIP'][Math.floor(Math.random() * 3)],
      pan,
      email: `loadtest.${timestamp}@example.com`,
      mobile,
      gstin: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}A${String(timestamp).substring(7)}Z1`,
      address: {
        line1: `${Math.floor(Math.random() * 999)} Load Test Street`,
        city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune'][Math.floor(Math.random() * 5)],
        state: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Maharashtra'][Math.floor(Math.random() * 5)],
        pincode: String(400000 + Math.floor(Math.random() * 1000)),
      },
      contactPersonName: `LoadTest Contact ${timestamp}`,
      contactPersonMobile: mobile,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'dsa/register' },
    },
  );

  handleError(res, 'DSA register');

  check(res, {
    'dsa register returns 201 or 409': (r) => r.status === 201 || r.status === 409,
    'register returns partnerId or conflict': (r) => {
      const b = r.json() as any;
      return b && (!!b.partnerId || r.status === 409);
    },
  });

  if (res.status === 201) {
    dsaRegisterSuccess.add(1);
  }
}

export function testDsaLogin() {
  const partnerCode = `DSA${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

  const res = http.post(
    `${urls.dsa}/api/auth/login`,
    JSON.stringify({
      partnerCode,
      password: 'TestPassword123!',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'dsa/login' },
    },
  );

  dsaLoginDuration.add(res.timings.duration);
  handleError(res, 'DSA login');

  check(res, {
    'dsa login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  if (res.status === 200) {
    const body = res.json() as any;
    if (body.accessToken) {
      testDsaAuthenticatedFlow(body.accessToken);
      dsaLoginSuccess.add(1);
    }
  }
}

export function testDsaAuthenticatedFlow(token: string) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const dashboardRes = http.get(`${urls.dsa}/api/dashboard`, {
    headers,
    tags: { name: 'dsa/dashboard' },
  });

  if (dashboardRes.status === 200) {
    dsaDashboardSuccess.add(1);
  }
}

export function testDsaDashboard() {
  const partnerCode = `DSA${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

  const loginRes = http.post(
    `${urls.dsa}/api/auth/login`,
    JSON.stringify({ partnerCode, password: 'TestPassword123!' }),
  );

  if (loginRes.status !== 200) return;

  const body = loginRes.json() as any;
  const token = body.accessToken;
  if (!token) return;

  const res = http.get(
    `${urls.dsa}/api/dashboard`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      tags: { name: 'dsa/dashboard' },
    },
  );

  handleError(res, 'DSA dashboard');

  check(res, {
    'dashboard returns 200': (r) => r.status === 200,
    'dashboard returns summary': (r) => {
      const b = r.json() as any;
      return b && b.summary;
    },
    'dashboard returns recentApplications': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.recentApplications);
    },
  });

  if (res.status === 200) {
    dsaDashboardSuccess.add(1);
  }
}

export function testDsaApplicationList() {
  const partnerCode = `DSA${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

  const loginRes = http.post(
    `${urls.dsa}/api/auth/login`,
    JSON.stringify({ partnerCode, password: 'TestPassword123!' }),
  );

  if (loginRes.status !== 200) return;

  const body = loginRes.json() as any;
  const token = body.accessToken;
  if (!token) return;

  const statuses = [undefined, 'SUBMITTED', 'KYC_IN_PROGRESS', 'APPROVED', 'REJECTED', 'DISBURSED'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  const params: Record<string, string | number> = { page: 1, size: 20 };
  if (status) params['status'] = status;

  const res = http.get(
    `${urls.dsa}/api/applications`,
    {
      params,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      tags: { name: 'dsa/application/list' },
    },
  );

  handleError(res, 'DSA application list');

  check(res, {
    'application list returns 200': (r) => r.status === 200,
    'returns applications': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.applications);
    },
  });
}

export function testDsaProfile() {
  const partnerCode = `DSA${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

  const loginRes = http.post(
    `${urls.dsa}/api/auth/login`,
    JSON.stringify({ partnerCode, password: 'TestPassword123!' }),
  );

  if (loginRes.status !== 200) return;

  const body = loginRes.json() as any;
  const token = body.accessToken;
  if (!token) return;

  const res = http.get(
    `${urls.dsa}/api/profile`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      tags: { name: 'dsa/profile' },
    },
  );

  handleError(res, 'DSA profile');

  check(res, {
    'profile returns 200': (r) => r.status === 200,
    'profile returns partnerCode': (r) => {
      const b = r.json() as any;
      return b && !!b.partnerCode;
    },
  });
}

export function testDsaCommissions() {
  const partnerCode = `DSA${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

  const loginRes = http.post(
    `${urls.dsa}/api/auth/login`,
    JSON.stringify({ partnerCode, password: 'TestPassword123!' }),
  );

  if (loginRes.status !== 200) return;

  const body = loginRes.json() as any;
  const token = body.accessToken;
  if (!token) return;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const summaryRes = http.get(`${urls.dsa}/api/commissions`, {
    headers,
    tags: { name: 'dsa/commissions/summary' },
  });

  handleError(summaryRes, 'Commission summary');

  check(summaryRes, {
    'commission summary returns 200': (r) => r.status === 200,
    'returns commission data': (r) => {
      const b = r.json() as any;
      return b && typeof b.totalEarned === 'number';
    },
  });

  const historyRes = http.get(`${urls.dsa}/api/commissions/history`, {
    params: { page: 0, size: 20 },
    headers,
    tags: { name: 'dsa/commissions/history' },
  });

  handleError(historyRes, 'Commission history');

  check(historyRes, {
    'commission history returns 200': (r) => r.status === 200,
    'returns commission data array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.data);
    },
  });
}

export function testDsaOfficerLogin() {
  const employeeCode = `DSAEMP${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

  const res = http.post(
    `${urls.dsa}/api/officers/login`,
    JSON.stringify({
      employeeCode,
      password: 'OfficerPass123!',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'dsa/officer/login' },
    },
  );

  handleError(res, 'DSA officer login');

  check(res, {
    'officer login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
    'officer login returns access token': (r) => {
      const b = r.json() as any;
      return b && !!b.accessToken;
    },
  });

  if (res.status === 200) {
    dsaOfficerLoginSuccess.add(1);
  }
}
