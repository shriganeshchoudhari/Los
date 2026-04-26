# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\security\security.spec.ts >> Security Tests — LOS Platform >> A08: Software & Data Integrity Failures (OWASP) >> CI workflow does not use unverified third-party actions
- Location: tests\security\security.spec.ts:402:9

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 20
Received array:  ["uses: actions/checkout", "uses: actions/setup-node", "uses: actions/checkout", "uses: actions/setup-node", "uses: actions/checkout", "uses: actions/setup-node", "uses: actions/checkout", "uses: actions/setup-node", "uses: actions/checkout", "uses: actions/setup-node", …]
```

# Test source

```ts
  309 |     });
  310 | 
  311 |     test('Unauthorized access attempts logged', async () => {
  312 |       const ctx = await request.newContext({ baseURL: BASE_URL });
  313 |       await ctx.get('/applications');
  314 |       await ctx.get('/applications', {
  315 |         headers: { Authorization: 'Bearer wrong.token.here' },
  316 |       });
  317 |       const authRes = await ctx.get('/auth/audit', {
  318 |         headers: { Authorization: `Bearer ${await getAuthToken('9999999120')}` },
  319 |       });
  320 |       expect(authRes.status()).toBeGreaterThanOrEqual(200);
  321 |     });
  322 |   });
  323 | 
  324 |   test.describe('A10: Server-Side Request Forgery (OWASP)', () => {
  325 | 
  326 |     test('Internal metadata endpoint not accessible from external IP', async () => {
  327 |       const ctx = await request.newContext({ baseURL: AUTH_URL });
  328 |       const res = await ctx.get('http://169.254.169.254/latest/meta-data/');
  329 |       expect(res.status()).toBeGreaterThanOrEqual(400);
  330 |     });
  331 | 
  332 |     test('SSRF — bureau callback URL parameter sanitized', async () => {
  333 |       const token = await getAuthToken('9999999130');
  334 |       const ctx = await request.newContext({ baseURL: LOAN_URL });
  335 |       const res = await ctx.post('/bureau/pull', {
  336 |         headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  337 |         data: {
  338 |           applicationId: 'test-id',
  339 |           bureau: 'CIBIL',
  340 |           callbackUrl: 'http://evil.com/callback',
  341 |         },
  342 |       });
  343 |       const body = await res.text();
  344 |       expect(body.toLowerCase()).not.toContain('evil.com');
  345 |     });
  346 | 
  347 |     test('SSRF — webhook URL parameter validated against allowlist', async () => {
  348 |       const token = await getAuthToken('9999999140');
  349 |       const ctx = await request.newContext({ baseURL: LOAN_URL });
  350 |       const res = await ctx.post('/disbursements/webhook', {
  351 |         headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  352 |         data: {
  353 |           webhookUrl: 'http://localhost:5432/secret',
  354 |           event: 'DISBURSED',
  355 |         },
  356 |       });
  357 |       expect(res.status()).toBeGreaterThanOrEqual(400);
  358 |     });
  359 |   });
  360 | 
  361 |   test.describe('A06: Vulnerable & Outdated Components (OWASP)', () => {
  362 | 
  363 |     test('package-lock.json exists and is not empty', () => {
  364 |       const lockPath = join(process.cwd(), 'package-lock.json');
  365 |       const content = readFileSync(lockPath, 'utf8');
  366 |       expect(content.length).toBeGreaterThan(100);
  367 |     });
  368 | 
  369 |     test('package-lock.json integrity hashes present', () => {
  370 |       const lockPath = join(process.cwd(), 'package-lock.json');
  371 |       const content = readFileSync(lockPath, 'utf8');
  372 |       expect(content).toContain('"integrity":');
  373 |     });
  374 | 
  375 |     test('No dev-only packages in frontend production build manifest', () => {
  376 |       const lockPath = join(process.cwd(), 'package-lock.json');
  377 |       const content = readFileSync(lockPath, 'utf8');
  378 |       const dangerousDevPackages = ['webpack', 'ts-node', 'nodemon', 'jest', 'mocha'];
  379 |       for (const pkg of dangerousDevPackages) {
  380 |         const devDepPattern = new RegExp(`"${pkg}":\\s*"[^"]*",\\s*"dev":\\s*true`);
  381 |         expect(content).not.toMatch(devDepPattern);
  382 |       }
  383 |     });
  384 | 
  385 |     test('package.json has audited dependencies — no known CVE placeholders', () => {
  386 |       const pkgPath = join(process.cwd(), 'package.json');
  387 |       const content = readFileSync(pkgPath, 'utf8');
  388 |       expect(content).not.toContain('CVE-placeholder');
  389 |       expect(content).not.toContain('vulnerable');
  390 |     });
  391 |   });
  392 | 
  393 |   test.describe('A08: Software & Data Integrity Failures (OWASP)', () => {
  394 | 
  395 |     test('CI workflow uses pinned action versions (not @master/@main)', async () => {
  396 |       const workflowPath = join(process.cwd(), '../.github/workflows/ci.yml');
  397 |       const content = readFileSync(workflowPath, 'utf8');
  398 |       const unpinned = content.match(/uses:\s+\S+\/[^@]+@master/g) || content.match(/uses:\s+\S+\/[^@]+@main/g);
  399 |       expect(unpinned).toBeNull();
  400 |     });
  401 | 
  402 |     test('CI workflow does not use unverified third-party actions', async () => {
  403 |       const workflowPath = join(process.cwd(), '../.github/workflows/ci.yml');
  404 |       const content = readFileSync(workflowPath, 'utf8');
  405 |       const thirdPartyActions = content.match(/uses:\s+[\w-]+\/[\w-]+/g) || [];
  406 |       const suspiciousActions = thirdPartyActions.filter(
  407 |         (a) => !a.includes('github.com') && !a.includes('docker://')
  408 |       );
> 409 |       expect(suspiciousActions).toHaveLength(0);
      |                                 ^ Error: expect(received).toHaveLength(expected)
  410 |     });
  411 | 
  412 |     test('Dockerfile does not use unverified base images (alpine/latest tag)', async () => {
  413 |       const dockerfiles = [
  414 |         join(process.cwd(), '../backend/Dockerfile'),
  415 |         join(process.cwd(), '../Dockerfile'),
  416 |       ];
  417 |       for (const dfPath of dockerfiles) {
  418 |         try {
  419 |           const content = readFileSync(dfPath, 'utf8');
  420 |           const badBase = /FROM\s+\S+:(latest|alpine)$/m;
  421 |           expect(content).not.toMatch(badBase);
  422 |         } catch {
  423 |         }
  424 |       }
  425 |     });
  426 | 
  427 |     test('No secrets hardcoded in source files', async () => {
  428 |       const suspiciousPatterns = [
  429 |         /password\s*=\s*['"][^'"]+['"]/i,
  430 |         /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
  431 |         /secret\s*=\s*['"][^'"]+['"]/i,
  432 |       ];
  433 |       const dirs = ['backend', 'frontend'];
  434 |       for (const dir of dirs) {
  435 |         const dirPath = join(process.cwd(), '..', dir);
  436 |         for (const subDir of ['src', 'lib', 'services']) {
  437 |           const subPath = join(dirPath, subDir);
  438 |           try {
  439 |             const content = readFileSync(subPath, 'utf8');
  440 |             for (const pattern of suspiciousPatterns) {
  441 |               const matches = content.match(pattern);
  442 |               if (matches) {
  443 |                 for (const m of matches) {
  444 |                   expect(m).not.toMatch(/(password|api[_-]?key|secret)\s*=\s*['"][a-zA-Z0-9]{16,}/i);
  445 |                 }
  446 |               }
  447 |             }
  448 |           } catch {
  449 |           }
  450 |         }
  451 |       }
  452 |     });
  453 |   });
  454 | });
  455 | 
```