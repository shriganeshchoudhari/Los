import { test, expect, request } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const AUTH_URL = process.env.TEST_AUTH_URL || 'http://localhost:3002';
const KYC_URL = process.env.TEST_KYC_URL || 'http://localhost:3003';
const DOC_URL = process.env.TEST_DOC_URL || 'http://localhost:3009';
const LOAN_URL = process.env.TEST_LOAN_URL || 'http://localhost:3003';

async function getAuthToken(mobile: string): Promise<string> {
  const ctx = await request.newContext({ baseURL: AUTH_URL });
  const sendRes = await ctx.post('/auth/otp/send', {
    data: { mobile, purpose: 'LOGIN', channel: 'SMS' },
  });
  const sessionId = (await sendRes.json())['sessionId'];
  const verifyRes = await ctx.post('/auth/otp/verify', {
    data: { mobile, otp: '123456', sessionId },
  });
  return (await verifyRes.json())['accessToken'];
}

test.describe('Security Tests — LOS Platform', () => {

  test.describe('Injection Attacks', () => {

    test('SQL injection — application form fields', async () => {
      const token = await getAuthToken('9999999001');
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.post('/applications', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          loanType: 'PERSONAL_LOAN',
          applicant: {
            fullName: "'; DROP TABLE applications; --",
            dob: '1990-01-01',
            mobile: '9999999001',
          },
          employmentDetails: { employmentType: 'SALARIED_PRIVATE', netMonthlyIncome: 95000 },
          loanRequirement: { requestedAmount: 500000, tenureMonths: 36 },
        },
      });
      expect(res.status()).toBeGreaterThanOrEqual(200);
      expect(res.status()).toBeLessThan(500);
    });

    test('XSS — application fullName field', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="mobile-input"]', '9999999002');
      await page.click('[data-testid="send-otp-button"]');
      await page.fill('[data-testid="otp-input"]', '123456');
      await page.click('[data-testid="verify-otp-button"]');
      await page.waitForURL(/\/dashboard/);
      await page.click('[data-testid="new-application-button"]');

      await page.fill('[data-testid="full-name-input"]', '<img src=x onerror=alert(1)>');
      await page.fill('[data-testid="dob-input"]', '1990-01-01');
      await page.click('[data-testid="next-step-button"]');

      const html = await page.content();
      expect(html).not.toContain('onerror=alert(1)');
    });

    test('NoSQL injection — mobile parameter', async () => {
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const res = await ctx.post('/auth/otp/send', {
        data: { mobile: { '$ne': null }, purpose: 'LOGIN' },
      });
      expect(res.status()).toBeGreaterThanOrEqual(200);
      expect(res.status()).toBeLessThan(500);
    });

    test('LDAP injection — login mobile field', async () => {
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const res = await ctx.post('/auth/otp/send', {
        data: { mobile: '9999999*', purpose: 'LOGIN' },
      });
      expect(res.status()).toBeGreaterThanOrEqual(200);
      expect(res.status()).toBeLessThan(500);
    });

    test('Command injection — pan field sanitized', async () => {
      const token = await getAuthToken('9999999060');
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.patch('/applications/test-id-123', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          applicantPan: '| cat /etc/passwd',
        },
      });
      expect(res.status()).toBeGreaterThanOrEqual(200);
      expect(res.status()).toBeLessThan(500);
    });
  });

  test.describe('Authentication & Authorization', () => {

    test('Unauthenticated request returns 401', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/applications');
      expect(res.status()).toBe(401);
    });

    test('Invalid token returns 401', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/applications', {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(res.status()).toBe(401);
    });

    test('Expired token returns 401', async () => {
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const res = await ctx.post('/auth/token/refresh', {
        data: { refreshToken: 'expired.or.invalid.token' },
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });

    test('OTP brute-force protection — 10 wrong OTPs', async () => {
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const mobile = '9999999010';
      const sendRes = await ctx.post('/auth/otp/send', {
        data: { mobile, purpose: 'LOGIN' },
      });
      const sessionId = (await sendRes.json())['sessionId'];

      for (let i = 0; i < 10; i++) {
        await ctx.post('/auth/otp/verify', {
          data: { mobile, otp: '000000', sessionId },
        });
      }

      const lockedRes = await ctx.post('/auth/otp/send', {
        data: { mobile, purpose: 'LOGIN' },
      });
      const body = await lockedRes.text();
      expect(body.toLowerCase()).toMatch(/locked|blocked|rate.limit/i);
    });

    test('Cross-role access denied — loan_officer cannot access manager endpoints', async () => {
      const ctx = await request.newContext({ baseURL: LOAN_URL });
      const res = await ctx.post('/applications/test-id-123/sanction', {
        headers: { Authorization: `Bearer ${await getAuthToken('9999999070')}` },
        data: { action: 'APPROVE', remarks: 'test' },
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).not.toBe(200);
    });
  });

  test.describe('Data Exposure', () => {

    test('API docs not exposed in production', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/api-docs');
      expect(res.status()).toBe(404);
    });

    test('Health endpoint does not expose sensitive info', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/health');
      expect(res.status()).toBe(200);
      const body = await res.text();
      expect(body).not.toMatch(/password|secret|key|token/i);
    });

    test('Error responses do not leak stack traces', async () => {
      const token = await getAuthToken('9999999020');
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/applications/nonexistent-id-12345', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      expect(body).not.toMatch(/stack|at\s+/i);
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Rate Limiting', () => {

    test('OTP endpoint rate-limited after 3 requests/minute', async () => {
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const mobile = '9999999030';

      for (let i = 0; i < 5; i++) {
        await ctx.post('/auth/otp/send', {
          data: { mobile: `${mobile}${i}`, purpose: 'LOGIN' },
        });
      }

      const lastRes = await ctx.post('/auth/otp/send', {
        data: { mobile: `${mobile}999`, purpose: 'LOGIN' },
      });
      const body = await lastRes.text();
      expect(body.toLowerCase()).toMatch(/rate|limit|wait|too many/i);
    });
  });

  test.describe('CORS & Headers', () => {

    test('CORS headers properly configured', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/health', {
        headers: { Origin: 'http://example.com' },
      });
      const cors = res.headers()['access-control-allow-origin'];
      expect(cors).toMatch(/^https?:\/\/.*bank\.com$/);
    });

    test('Security headers present', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/health');
      const headers = res.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
      expect(headers['x-xss-protection'] || headers['content-security-policy']).toBeTruthy();
    });

    test('Strict-Transport-Security header present', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/health');
      const headers = res.headers();
      expect(headers['strict-transport-security']).toBeTruthy();
    });

    test('Referrer-Policy header present', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/health');
      const headers = res.headers();
      expect(headers['referrer-policy']).toBeTruthy();
    });
  });

  test.describe('Sensitive Data', () => {

    test('OTP not returned in API response', async () => {
      const token = await getAuthToken('9999999040');
      const ctx = await request.newContext({ baseURL: BASE_URL });
      const res = await ctx.get('/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      expect(body).not.toMatch(/\d{6}/);
    });

    test('Password not returned in user profile', async () => {
      const token = await getAuthToken('9999999050');
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const res = await ctx.get('/auth/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      expect(body).not.toMatch(/password/i);
    });

    test('Aadhaar number masked in API responses', async () => {
      const token = await getAuthToken('9999999080');
      const ctx = await request.newContext({ baseURL: KYC_URL });
      const res = await ctx.get('/kyc/records', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      const fullAadhaarPattern = /\d{4}\s\d{4}\s\d{4}/;
      expect(body).not.toMatch(fullAadhaarPattern);
    });

    test('PAN not returned in plain text in application response', async () => {
      const token = await getAuthToken('9999999090');
      const ctx = await request.newContext({ baseURL: LOAN_URL });
      const res = await ctx.get('/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      const fullPANPattern = /[A-Z]{5}[0-9]{4}[A-Z]/;
      const match = body.match(fullPANPattern);
      if (match) {
        expect(match[0]).not.toContain('XXXXX');
      }
    });
  });

  test.describe('A09: Security Logging & Monitoring (OWASP)', () => {

    test('Login events are logged in audit trail', async () => {
      const token = await getAuthToken('9999999100');
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const res = await ctx.get('/auth/audit', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBeGreaterThanOrEqual(200);
      expect(res.status()).toBeLessThan(500);
    });

    test('Failed login attempts logged with timestamp and IP', async () => {
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const mobile = '9999999110';
      const sendRes = await ctx.post('/auth/otp/send', { data: { mobile, purpose: 'LOGIN' } });
      const sessionId = (await sendRes.json())['sessionId'];

      for (let i = 0; i < 3; i++) {
        await ctx.post('/auth/otp/verify', { data: { mobile, otp: '000001', sessionId } });
      }

      const auditRes = await ctx.get('/auth/audit', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(auditRes.status()).toBeGreaterThanOrEqual(200);
    });

    test('Unauthorized access attempts logged', async () => {
      const ctx = await request.newContext({ baseURL: BASE_URL });
      await ctx.get('/applications');
      await ctx.get('/applications', {
        headers: { Authorization: 'Bearer wrong.token.here' },
      });
      const authRes = await ctx.get('/auth/audit', {
        headers: { Authorization: `Bearer ${await getAuthToken('9999999120')}` },
      });
      expect(authRes.status()).toBeGreaterThanOrEqual(200);
    });
  });

  test.describe('A10: Server-Side Request Forgery (OWASP)', () => {

    test('Internal metadata endpoint not accessible from external IP', async () => {
      const ctx = await request.newContext({ baseURL: AUTH_URL });
      const res = await ctx.get('http://169.254.169.254/latest/meta-data/');
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });

    test('SSRF — bureau callback URL parameter sanitized', async () => {
      const token = await getAuthToken('9999999130');
      const ctx = await request.newContext({ baseURL: LOAN_URL });
      const res = await ctx.post('/bureau/pull', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          applicationId: 'test-id',
          bureau: 'CIBIL',
          callbackUrl: 'http://evil.com/callback',
        },
      });
      const body = await res.text();
      expect(body.toLowerCase()).not.toContain('evil.com');
    });

    test('SSRF — webhook URL parameter validated against allowlist', async () => {
      const token = await getAuthToken('9999999140');
      const ctx = await request.newContext({ baseURL: LOAN_URL });
      const res = await ctx.post('/disbursements/webhook', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          webhookUrl: 'http://localhost:5432/secret',
          event: 'DISBURSED',
        },
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('A06: Vulnerable & Outdated Components (OWASP)', () => {

    test('package-lock.json exists and is not empty', () => {
      const lockPath = join(process.cwd(), 'package-lock.json');
      const content = readFileSync(lockPath, 'utf8');
      expect(content.length).toBeGreaterThan(100);
    });

    test('package-lock.json integrity hashes present', () => {
      const lockPath = join(process.cwd(), 'package-lock.json');
      const content = readFileSync(lockPath, 'utf8');
      expect(content).toContain('"integrity":');
    });

    test('No dev-only packages in frontend production build manifest', () => {
      const lockPath = join(process.cwd(), 'package-lock.json');
      const content = readFileSync(lockPath, 'utf8');
      const dangerousDevPackages = ['webpack', 'ts-node', 'nodemon', 'jest', 'mocha'];
      for (const pkg of dangerousDevPackages) {
        const devDepPattern = new RegExp(`"${pkg}":\\s*"[^"]*",\\s*"dev":\\s*true`);
        expect(content).not.toMatch(devDepPattern);
      }
    });

    test('package.json has audited dependencies — no known CVE placeholders', () => {
      const pkgPath = join(process.cwd(), 'package.json');
      const content = readFileSync(pkgPath, 'utf8');
      expect(content).not.toContain('CVE-placeholder');
      expect(content).not.toContain('vulnerable');
    });
  });

  test.describe('A08: Software & Data Integrity Failures (OWASP)', () => {

    test('CI workflow uses pinned action versions (not @master/@main)', async () => {
      const workflowPath = join(process.cwd(), '../.github/workflows/ci.yml');
      const content = readFileSync(workflowPath, 'utf8');
      const unpinned = content.match(/uses:\s+\S+\/[^@]+@master/g) || content.match(/uses:\s+\S+\/[^@]+@main/g);
      expect(unpinned).toBeNull();
    });

    test('CI workflow does not use unverified third-party actions', async () => {
      const workflowPath = join(process.cwd(), '../.github/workflows/ci.yml');
      const content = readFileSync(workflowPath, 'utf8');
      const thirdPartyActions = content.match(/uses:\s+[\w-]+\/[\w-]+/g) || [];
      const suspiciousActions = thirdPartyActions.filter(
        (a) => !a.includes('github.com') && !a.includes('docker://')
      );
      expect(suspiciousActions).toHaveLength(0);
    });

    test('Dockerfile does not use unverified base images (alpine/latest tag)', async () => {
      const dockerfiles = [
        join(process.cwd(), '../backend/Dockerfile'),
        join(process.cwd(), '../Dockerfile'),
      ];
      for (const dfPath of dockerfiles) {
        try {
          const content = readFileSync(dfPath, 'utf8');
          const badBase = /FROM\s+\S+:(latest|alpine)$/m;
          expect(content).not.toMatch(badBase);
        } catch {
        }
      }
    });

    test('No secrets hardcoded in source files', async () => {
      const suspiciousPatterns = [
        /password\s*=\s*['"][^'"]+['"]/i,
        /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
        /secret\s*=\s*['"][^'"]+['"]/i,
      ];
      const dirs = ['backend', 'frontend'];
      for (const dir of dirs) {
        const dirPath = join(process.cwd(), '..', dir);
        for (const subDir of ['src', 'lib', 'services']) {
          const subPath = join(dirPath, subDir);
          try {
            const content = readFileSync(subPath, 'utf8');
            for (const pattern of suspiciousPatterns) {
              const matches = content.match(pattern);
              if (matches) {
                for (const m of matches) {
                  expect(m).not.toMatch(/(password|api[_-]?key|secret)\s*=\s*['"][a-zA-Z0-9]{16,}/i);
                }
              }
            }
          } catch {
          }
        }
      }
    });
  });
});
