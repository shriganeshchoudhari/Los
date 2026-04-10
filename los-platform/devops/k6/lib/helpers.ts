import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

export const authSuccess = new Counter('auth_otp_verify_success');
export const authFailure = new Counter('auth_otp_verify_failure');
export const authDuration = new Trend('auth_duration');
export const applicationCreationDuration = new Trend('application_creation_duration');
export const bureauPullDuration = new Trend('bureau_pull_duration');
export const decisionTriggerDuration = new Trend('decision_trigger_duration');
export const disbursementDuration = new Trend('disbursement_duration');
export const errorRate = new Rate('error_rate');
export const loanCreationRate = new Rate('loan_creation_success');

const ERROR_CODES = new Set([
  'AUTH_001', 'AUTH_002', 'AUTH_003',
  'APP_001', 'APP_002', 'APP_003',
  'KYC_001', 'KYC_002', 'KYC_003',
  'GEN_001', 'GEN_002', 'GEN_003',
]);

export function generateMobile(): string {
  const prefixes = ['9', '8', '7', '6'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  return prefix + number;
}

export function generatePAN(): string {
  const letters = 'ABCDEFGH';
  const l1 = letters[Math.floor(Math.random() * letters.length)];
  const l2 = letters[Math.floor(Math.random() * letters.length)];
  const l3 = letters[Math.floor(Math.random() * letters.length)];
  const num = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const l4 = letters[Math.floor(Math.random() * letters.length)];
  const l5 = letters[Math.floor(Math.random() * letters.length)];
  return `${l1}${l2}${l3}${num}${l4}${l5}`;
}

export function generateUUID(): string {
  return `${crypto.randomUUID()}`;
}

export function generateApplicationData() {
  const products = ['PERSONAL_LOAN', 'HOME_LOAN', 'LAP', 'VEHICLE_LOAN_FOUR_WHEELER', 'GOLD_LOAN', 'EDUCATION_LOAN'];
  const product = products[Math.floor(Math.random() * products.length)];

  const amountByProduct: Record<string, [number, number]> = {
    PERSONAL_LOAN: [50000, 5000000],
    HOME_LOAN: [500000, 50000000],
    LAP: [500000, 20000000],
    VEHICLE_LOAN_FOUR_WHEELER: [100000, 5000000],
    GOLD_LOAN: [10000, 5000000],
    EDUCATION_LOAN: [50000, 3000000],
  };

  const [minAmt, maxAmt] = amountByProduct[product] || [50000, 5000000];
  const amount = Math.floor((minAmt + Math.random() * (maxAmt - minAmt)) / 10000) * 10000;

  const tenureByProduct: Record<string, [number, number]> = {
    PERSONAL_LOAN: [12, 60],
    HOME_LOAN: [60, 360],
    LAP: [24, 240],
    VEHICLE_LOAN_FOUR_WHEELER: [12, 84],
    GOLD_LOAN: [3, 36],
    EDUCATION_LOAN: [12, 120],
  };

  const [minTenure, maxTenure] = tenureByProduct[product] || [12, 60];
  const tenure = Math.floor(Math.random() * (maxTenure - minTenure + 1)) + minTenure;

  const dobYear = 1970 + Math.floor(Math.random() * 35);
  const dobMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const dobDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');

  return {
    loanType: product,
    applicantFullName: `LoadTest Applicant ${Date.now() % 10000}`,
    applicantDob: `${dobYear}-${dobMonth}-${dobDay}`,
    applicantMobile: generateMobile(),
    applicantPan: generatePAN(),
    requestedAmount: amount,
    tenurePreferenceMonths: tenure,
    branchCode: `BR${String(Math.floor(Math.random() * 20) + 1).padStart(3, '0')}`,
    employmentDetails: {
      employmentType: 'SALARIED_PRIVATE',
      monthlyIncome: Math.floor(amount / tenure) + Math.floor(Math.random() * 50000),
      designation: 'Software Engineer',
      companyName: 'TechCorp India',
    },
  };
}

export function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Request-ID': generateUUID(),
  };
}

export function handleError(res: http.Response, operation: string): void {
  if (res.status >= 400) {
    errorRate.add(1);
    const body = tryParseBody(res);
    const code = body?.code || body?.error?.code || 'UNKNOWN';
    console.error(`[ERROR] ${operation} failed: ${res.status} code=${code} body=${res.body?.substring?.(0, 200) || res.body}`);
  } else {
    errorRate.add(0);
  }
}

export function tryParseBody(res: http.Response): any {
  try {
    return JSON.parse(res.body as string);
  } catch {
    return null;
  }
}

export function isBusinessError(body: any): boolean {
  if (!body) return false;
  const code = body.code || body.error?.code;
  return code && ERROR_CODES.has(code);
}

export async function loginAndGetToken(
  authBaseUrl: string,
  role: string = 'LOAN_OFFICER',
): Promise<{ token: string; userId: string }> {
  const mobile = generateMobile();
  const panHash = generatePAN();

  const sendRes = await http.post(
    `${authBaseUrl}/api/auth/otp/send`,
    JSON.stringify({ mobile, purpose: 'LOGIN', channel: 'SMS' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (sendRes.status !== 200) {
    fail(`OTP send failed: ${sendRes.status} ${sendRes.body}`);
  }

  const sessionId = sendRes.json('sessionId') as string;
  if (!sessionId) {
    fail(`No sessionId in OTP send response: ${sendRes.body}`);
  }

  const verifyRes = await http.post(
    `${authBaseUrl}/api/auth/otp/verify`,
    JSON.stringify({ mobile, otp: '123456', sessionId }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  authDuration.add(verifyRes.timings.duration);

  if (verifyRes.status !== 200) {
    authFailure.add(1);
    fail(`OTP verify failed: ${verifyRes.status} ${verifyRes.body}`);
  }

  authSuccess.add(1);

  const body = verifyRes.json() as any;
  return {
    token: body.accessToken,
    userId: body.userId,
  };
}
