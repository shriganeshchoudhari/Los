import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend } from 'k6/metrics';
import { getBaseUrls } from '../lib/config';
import { generateMobile, generateUUID, handleError } from '../lib/helpers';

const urls = getBaseUrls();

export const otpSendSuccess = new Counter('auth_otp_send_success');
export const otpSendRateLimited = new Counter('auth_otp_send_ratelimited');
export const otpVerifySuccess = new Counter('auth_otp_verify_success');
export const otpVerifyExpired = new Counter('auth_otp_verify_expired');
export const otpVerifyWrong = new Counter('auth_otp_verify_wrong');
export const refreshSuccess = new Counter('auth_refresh_success');
export const refreshFailure = new Counter('auth_refresh_failure');
export const logoutSuccess = new Counter('auth_logout_success');

export const otpSendDuration = new Trend('auth_otp_send_duration');
export const otpVerifyDuration = new Trend('auth_otp_verify_duration');
export const refreshDuration = new Trend('auth_refresh_duration');

const purposes = ['LOGIN', 'AADHAAR_CONSENT', 'LOAN_APPLICATION_SUBMIT', 'DISBURSEMENT_CONFIRM'];

export function scenarios() {
  const vu = __ITER % 10;

  if (vu === 0) {
    testOtpSendAndVerifyFlow();
  } else if (vu === 1) {
    testRefreshTokenFlow();
  } else if (vu === 2) {
    testLogoutFlow();
  } else if (vu === 3) {
    testHealthEndpoint();
  } else if (vu === 4) {
    testConcurrentOtpSend();
  } else if (vu === 5) {
    testInvalidOtpFlow();
  } else if (vu === 6) {
    testRefreshTokenRotation();
  } else {
    testOtpSendAndVerifyFlow();
  }

  sleep(1);
}

export function testOtpSendAndVerifyFlow() {
  const mobile = generateMobile();
  const purpose = purposes[Math.floor(Math.random() * purposes.length)];

  const sendRes = http.post(
    `${urls.auth}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose, channel: 'SMS' }),
    { tags: { name: 'auth/otp/send' } },
  );
  otpSendDuration.add(sendRes.timings.duration);
  handleError(sendRes, 'OTP send');

  if (sendRes.status === 429) {
    otpSendRateLimited.add(1);
    return;
  }

  if (sendRes.status !== 200) return;
  otpSendSuccess.add(1);

  const sessionId = sendRes.json('sessionId') as string;
  if (!sessionId) return;

  const verifyRes = http.post(
    `${urls.auth}/api/auth/otp/verify`,
    JSON.stringify({ mobile, otp: '123456', sessionId }),
    { tags: { name: 'auth/otp/verify' } },
  );
  otpVerifyDuration.add(verifyRes.timings.duration);
  handleError(verifyRes, 'OTP verify');

  if (verifyRes.status === 200) {
    otpVerifySuccess.add(1);
  }
}

export function testRefreshTokenFlow() {
  const mobile = generateMobile();

  const sendRes = http.post(
    `${urls.auth}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
  );
  if (sendRes.status !== 200) return;

  const sessionId = sendRes.json('sessionId') as string;
  if (!sessionId) return;

  const verifyRes = http.post(
    `${urls.auth}/api/auth/otp/verify`,
    JSON.stringify({ mobile, otp: '123456', sessionId }),
  );
  if (verifyRes.status !== 200) return;

  const body = verifyRes.json() as any;
  const refreshToken = body.refreshToken as string;
  if (!refreshToken) return;

  const refreshRes = http.post(
    `${urls.auth}/api/auth/refresh`,
    JSON.stringify({ refreshToken }),
    { tags: { name: 'auth/refresh' } },
  );
  refreshDuration.add(refreshRes.timings.duration);
  handleError(refreshRes, 'Token refresh');

  check(refreshRes, {
    'refresh returns 200': (r) => r.status === 200,
    'refresh returns new access token': (r) => {
      const b = r.json() as any;
      return b && !!b.accessToken;
    },
  });

  if (refreshRes.status === 200) {
    refreshSuccess.add(1);
  } else {
    refreshFailure.add(1);
  }
}

export function testLogoutFlow() {
  const mobile = generateMobile();

  const sendRes = http.post(
    `${urls.auth}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
  );
  if (sendRes.status !== 200) return;

  const sessionId = sendRes.json('sessionId') as string;
  if (!sessionId) return;

  const verifyRes = http.post(
    `${urls.auth}/api/auth/otp/verify`,
    JSON.stringify({ mobile, otp: '123456', sessionId }),
  );
  if (verifyRes.status !== 200) return;

  const body = verifyRes.json() as any;
  const accessToken = body.accessToken as string;
  const refreshToken = body.refreshToken as string;
  if (!accessToken || !refreshToken) return;

  const logoutRes = http.post(
    `${urls.auth}/api/auth/logout`,
    JSON.stringify({ refreshToken }),
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      tags: { name: 'auth/logout' },
    },
  );
  handleError(logoutRes, 'Logout');

  check(logoutRes, {
    'logout returns 200': (r) => r.status === 200,
  });

  if (logoutRes.status === 200) {
    logoutSuccess.add(1);
  }
}

export function testHealthEndpoint() {
  const res = http.get(`${urls.auth}/api/auth/health`, {
    tags: { name: 'auth/health' },
  });
  check(res, {
    'health returns 200': (r) => r.status === 200,
    'health returns ok': (r) => {
      const b = r.json() as any;
      return b && b.status === 'ok';
    },
  });
}

export function testConcurrentOtpSend() {
  const mobile = generateMobile();

  const batch = [];
  for (let i = 0; i < 5; i++) {
    batch.push({
      method: 'POST',
      url: `${urls.auth}/api/auth/otp/send`,
      body: JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
      params: { headers: { 'Content-Type': 'application/json' } },
    }));
  }

  const responses = http.batch(batch, { tags: { name: 'auth/otp/batch' } });
  for (const res of responses) {
    handleError(res, 'Concurrent OTP send');
  }
}

export function testInvalidOtpFlow() {
  const mobile = generateMobile();

  const sendRes = http.post(
    `${urls.auth}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
  );
  if (sendRes.status !== 200) return;

  const sessionId = sendRes.json('sessionId') as string;
  if (!sessionId) return;

  const wrongOtpCodes = ['000000', '111111', '999998', '12345'];
  const otp = wrongOtpCodes[Math.floor(Math.random() * wrongOtpCodes.length)];

  const verifyRes = http.post(
    `${urls.auth}/api/auth/otp/verify`,
    JSON.stringify({ mobile, otp, sessionId }),
    { tags: { name: 'auth/otp/wrong' } },
  );

  check(verifyRes, {
    'wrong OTP returns 401': (r) => r.status === 401,
    'wrong OTP returns AUTH_002': (r) => {
      const b = r.json() as any;
      return b && b.code === 'AUTH_002';
    },
  });

  if (verifyRes.status === 401) {
    otpVerifyWrong.add(1);
  }
}

export function testRefreshTokenRotation() {
  const mobile = generateMobile();

  const sendRes = http.post(
    `${urls.auth}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
  );
  if (sendRes.status !== 200) return;

  const sessionId = sendRes.json('sessionId') as string;
  if (!sessionId) return;

  const verifyRes = http.post(
    `${urls.auth}/api/auth/otp/verify`,
    JSON.stringify({ mobile, otp: '123456', sessionId }),
  );
  if (verifyRes.status !== 200) return;

  const body1 = verifyRes.json() as any;
  const refreshToken1 = body1.refreshToken as string;
  if (!refreshToken1) return;

  const refresh1 = http.post(
    `${urls.auth}/api/auth/refresh`,
    JSON.stringify({ refreshToken: refreshToken1 }),
  );
  if (refresh1.status !== 200) return;

  const body2 = refresh1.json() as any;
  const refreshToken2 = body2.refreshToken as string;
  if (!refreshToken2) return;

  const reuseRefresh1 = http.post(
    `${urls.auth}/api/auth/refresh`,
    JSON.stringify({ refreshToken: refreshToken1 }),
  );

  check(reuseRefresh1, {
    'reused refresh token is revoked': (r) => r.status === 401,
  });

  refreshDuration.add(reuseRefresh1.timings.duration);
}
