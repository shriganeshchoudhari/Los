# API Test Cases
## Loan Origination System (LOS)
**Framework:** Jest + Supertest | **Environment:** UAT | **Coverage Target:** 95%

---

## 1. Auth Service Tests

### TC-AUTH-001: Send OTP — Success
```typescript
describe('POST /auth/otp/send', () => {
  it('TC-AUTH-001: Should send OTP successfully', async () => {
    const response = await request(app)
      .post('/v1/auth/otp/send')
      .set('X-Request-ID', 'test-req-001')
      .send({ mobile: '9876543210', purpose: 'LOGIN', channel: 'SMS' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.sessionId).toMatch(UUID_REGEX);
    expect(response.body.data.expiresIn).toBe(300);
    expect(response.body.data.maskedMobile).toBe('XXXXXX3210');
    // Verify OTP stored in Redis with correct TTL
    const session = await redisClient.get(`otp:${response.body.data.sessionId}`);
    expect(session).not.toBeNull();
  });
});
```

### TC-AUTH-002: Send OTP — Invalid Mobile Format
```typescript
it('TC-AUTH-002: Should reject invalid mobile number', async () => {
  const response = await request(app)
    .post('/v1/auth/otp/send')
    .send({ mobile: '1234567890', purpose: 'LOGIN', channel: 'SMS' }); // starts with 1

  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe('GEN_004');
  expect(response.body.error.field).toBe('mobile');
});
```

### TC-AUTH-003: Verify OTP — Success
```typescript
it('TC-AUTH-003: Should verify OTP and return JWT', async () => {
  // Setup: seed OTP session in Redis
  const sessionId = await seedOtpSession('9876543210', '482931');

  const response = await request(app)
    .post('/v1/auth/otp/verify')
    .send({ mobile: '9876543210', otp: '482931', sessionId });

  expect(response.status).toBe(200);
  expect(response.body.data.accessToken).toBeTruthy();
  expect(response.body.data.tokenType).toBe('Bearer');
  expect(response.body.data.expiresIn).toBe(900);

  // Decode and verify JWT claims
  const decoded = jwt.decode(response.body.data.accessToken) as JWTPayload;
  expect(decoded.role).toBe('APPLICANT');
  expect(decoded.exp - decoded.iat).toBe(900);
});
```

### TC-AUTH-004: Verify OTP — Expired
```typescript
it('TC-AUTH-004: Should reject expired OTP', async () => {
  const sessionId = await seedOtpSession('9876543210', '482931', -1); // expired 1 second ago

  const response = await request(app)
    .post('/v1/auth/otp/verify')
    .send({ mobile: '9876543210', otp: '482931', sessionId });

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe('AUTH_001');
  expect(response.body.error.retryable).toBe(false);
});
```

### TC-AUTH-005: Account Lock After Max Attempts
```typescript
it('TC-AUTH-005: Should lock account after 5 failed attempts', async () => {
  const sessionId = await seedOtpSession('9876543210', '482931');

  for (let i = 0; i < 5; i++) {
    await request(app)
      .post('/v1/auth/otp/verify')
      .send({ mobile: '9876543210', otp: '000000', sessionId });
  }

  const response = await request(app)
    .post('/v1/auth/otp/send')
    .send({ mobile: '9876543210', purpose: 'LOGIN', channel: 'SMS' });

  expect(response.status).toBe(429);
  expect(response.body.error.code).toBe('AUTH_003');
  expect(response.body.error.retryAfterSeconds).toBeLessThanOrEqual(1800);
});
```

### TC-AUTH-006: JWT Expiry Validation
```typescript
it('TC-AUTH-006: Should reject expired JWT on protected endpoint', async () => {
  const expiredToken = generateExpiredJWT(); // helper: creates JWT expired 1 sec ago

  const response = await request(app)
    .get('/v1/applications')
    .set('Authorization', `Bearer ${expiredToken}`);

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe('AUTH_004');
});
```

### TC-AUTH-007: Role-Based Access Control
```typescript
it('TC-AUTH-007: Applicant cannot access officer worklist', async () => {
  const applicantToken = await getTokenForRole('APPLICANT');

  const response = await request(app)
    .get('/v1/applications?status=UNDER_PROCESSING')
    .set('Authorization', `Bearer ${applicantToken}`);

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe('AUTH_006');
});
```

---

## 2. Application Service Tests

### TC-APP-001: Create Application — Success
```typescript
describe('POST /applications', () => {
  it('TC-APP-001: Should create application successfully', async () => {
    const token = await getTokenForRole('LOAN_OFFICER');

    const response = await request(app)
      .post('/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Idempotency-Key', uuid())
      .send(buildValidApplicationRequest());

    expect(response.status).toBe(201);
    expect(response.body.data.applicationNumber).toMatch(/^LOS-2024-MH-\d{6}$/);
    expect(response.body.data.status).toBe('DRAFT');
    expect(response.body.data.nextStep).toBe('COMPLETE_KYC');

    // Verify DB record
    const app = await db.query(
      'SELECT * FROM loan_applications WHERE id = $1',
      [response.body.data.applicationId]
    );
    expect(app.rows[0].status).toBe('DRAFT');
    expect(app.rows[0].applicant_pan_enc).not.toBeNull(); // Encrypted
  });
});
```

### TC-APP-002: Duplicate Application Detection
```typescript
it('TC-APP-002: Should block duplicate application same PAN + product within 30 days', async () => {
  const panHash = sha256('ABCRS1234F');
  await seedApplication({ panHash, loanType: 'PERSONAL_LOAN', status: 'CREDIT_ASSESSMENT' });

  const response = await request(app)
    .post('/v1/applications')
    .set('Authorization', `Bearer ${await getTokenForRole('LOAN_OFFICER')}`)
    .set('X-Idempotency-Key', uuid())
    .send(buildApplicationRequest({ panNumber: 'ABCRS1234F', loanType: 'PERSONAL_LOAN' }));

  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('APP_003');
  expect(response.body.error.message).toContain('duplicate');
});
```

### TC-APP-003: Idempotency on Application Create
```typescript
it('TC-APP-003: Duplicate idempotency key should return same response', async () => {
  const idemKey = uuid();
  const token = await getTokenForRole('LOAN_OFFICER');

  const r1 = await request(app)
    .post('/v1/applications')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Idempotency-Key', idemKey)
    .send(buildValidApplicationRequest());

  const r2 = await request(app)
    .post('/v1/applications')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Idempotency-Key', idemKey)
    .send(buildValidApplicationRequest());

  expect(r1.status).toBe(201);
  expect(r2.status).toBe(201);
  expect(r1.body.data.applicationId).toBe(r2.body.data.applicationId);

  // Verify only one DB record created
  const count = await db.query(
    "SELECT COUNT(*) FROM loan_applications WHERE application_number = $1",
    [r1.body.data.applicationNumber]
  );
  expect(parseInt(count.rows[0].count)).toBe(1);
});
```

### TC-APP-004: FOIR Validation Warning
```typescript
it('TC-APP-004: Should warn when FOIR exceeds 55%', async () => {
  const response = await request(app)
    .post('/v1/applications')
    .set('Authorization', `Bearer ${await getTokenForRole('LOAN_OFFICER')}`)
    .set('X-Idempotency-Key', uuid())
    .send(buildApplicationRequest({
      grossMonthlyIncome: 5000000,  // 50K
      existingObligations: 3000000, // 30K existing EMI → 60% FOIR
      requestedAmount: 20000000
    }));

  // Should still create but with warning
  expect(response.status).toBe(201);
  expect(response.body.data.warnings).toContain('FOIR_EXCEEDS_THRESHOLD');
});
```

### TC-APP-005: Invalid State Transition
```typescript
it('TC-APP-005: Cannot submit application already in CREDIT_ASSESSMENT', async () => {
  const appId = await seedApplication({ status: 'CREDIT_ASSESSMENT' });

  const response = await request(app)
    .post(`/v1/applications/${appId}/submit`)
    .set('Authorization', `Bearer ${await getTokenForRole('LOAN_OFFICER')}`);

  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe('APP_004');
});
```

### TC-APP-006: Optimistic Locking
```typescript
it('TC-APP-006: Should reject update with stale version', async () => {
  const { applicationId, version } = await createApplication();

  // First update succeeds
  await request(app)
    .patch(`/v1/applications/${applicationId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ section: 'EMPLOYMENT', data: { grossMonthlyIncome: 12000000 }, version });

  // Second update with same version fails
  const response = await request(app)
    .patch(`/v1/applications/${applicationId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ section: 'EMPLOYMENT', data: { grossMonthlyIncome: 13000000 }, version });

  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('APP_005');
});
```

---

## 3. KYC Service Tests

### TC-KYC-001: Aadhaar eKYC — Full Success Flow
```typescript
describe('Aadhaar eKYC', () => {
  it('TC-KYC-001: Full eKYC flow should complete successfully', async () => {
    // Mock UIDAI service
    nock('https://developer.uidai.gov.in')
      .post('/uidregistration/otp')
      .reply(200, { txnId: 'TXN_20240715_001', uidaiRefId: 'REF_ABC123' });

    nock('https://developer.uidai.gov.in')
      .post('/uidregistration/kyc')
      .reply(200, buildMockUIDAPIResponse()); // Valid signed XML

    const appId = await createSubmittedApplication();

    // Step 1: Initiate
    const initRes = await request(app)
      .post(`/v1/kyc/${appId}/aadhaar/initiate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aadhaarNumber: ENCRYPTED_AADHAAR, consentOtpSessionId: sessionId });

    expect(initRes.status).toBe(200);
    expect(initRes.body.data.txnId).toBeTruthy();

    // Step 2: Verify
    const verifyRes = await request(app)
      .post(`/v1/kyc/${appId}/aadhaar/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ txnId: initRes.body.data.txnId, otp: ENCRYPTED_OTP, uidaiRefId: initRes.body.data.uidaiRefId });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('AADHAAR_VERIFIED');
    expect(verifyRes.body.data.extractedData.name).toBeTruthy();
    // Verify photo NOT returned to client
    expect(verifyRes.body.data.photo).toBeUndefined();

    // Verify DB: Aadhaar number stored as hash only
    const kyc = await db.query('SELECT * FROM aadhaar_kyc_results WHERE kyc_id = $1', [verifyRes.body.data.kycId]);
    expect(kyc.rows[0].aadhaar_number_hash).toHaveLength(64);
    // No plain aadhaar in any column
    const rawRow = JSON.stringify(kyc.rows[0]);
    expect(rawRow).not.toContain('123456789012'); // raw aadhaar not present
  });
});
```

### TC-KYC-002: UIDAI Service Unavailable — Circuit Breaker
```typescript
it('TC-KYC-002: Should return 503 when UIDAI circuit is open', async () => {
  // Force circuit open
  await forceCircuitOpen('UIDAI');

  const response = await request(app)
    .post(`/v1/kyc/${appId}/aadhaar/initiate`)
    .set('Authorization', `Bearer ${token}`)
    .send({ aadhaarNumber: ENCRYPTED_AADHAAR, consentOtpSessionId: sessionId });

  expect(response.status).toBe(503);
  expect(response.body.error.code).toBe('KYC_003');
  expect(response.body.error.retryable).toBe(true);
  expect(response.body.error.retryAfterSeconds).toBeGreaterThan(0);
});
```

### TC-KYC-003: PAN-Aadhaar Name Mismatch
```typescript
it('TC-KYC-003: Should fail when PAN name does not match Aadhaar name', async () => {
  // Aadhaar name: "RAVI KUMAR SHARMA", PAN name: "SURESH PATEL" → 0% match
  nock('https://api.nsdl.com/pan/verify').reply(200, {
    panStatus: 'VALID',
    nameOnPAN: 'SURESH KUMAR PATEL',
    dobMatch: false
  });

  const response = await request(app)
    .post(`/v1/kyc/${appId}/pan/verify`)
    .send({ panNumber: 'ABCSP1234F', fullName: 'RAVI KUMAR SHARMA', dob: '1990-04-21' });

  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe('KYC_004');
  expect(response.body.error.details).toContain('name match score');
});
```

### TC-KYC-004: Face Match — Liveness Failure
```typescript
it('TC-KYC-004: Should fail when liveness check fails (photo spoof)', async () => {
  const fakePhotoBuffer = await loadFixture('photo_spoof.jpg');

  const response = await request(app)
    .post(`/v1/kyc/${appId}/face-match`)
    .set('Authorization', `Bearer ${token}`)
    .attach('selfie', fakePhotoBuffer, 'selfie.jpg');

  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe('KYC_007');
  expect(response.body.data.livenessCheckPassed).toBe(false);
});
```

### TC-KYC-005: Partial KYC — Aadhaar Success, PAN Failure
```typescript
it('TC-KYC-005: KYC record shows partial state when PAN fails', async () => {
  await completeAadhaarKYC(appId);

  nock('https://api.nsdl.com/pan/verify').reply(200, { panStatus: 'INACTIVE' });

  const panRes = await request(app)
    .post(`/v1/kyc/${appId}/pan/verify`)
    .send({ panNumber: 'ABCRS1234F', fullName: 'RAVI SHARMA', dob: '1990-04-21' });

  expect(panRes.status).toBe(422);
  expect(panRes.body.error.code).toBe('KYC_005');

  // KYC status should remain AADHAAR_VERIFIED, not fail entirely
  const kycRes = await request(app)
    .get(`/v1/kyc/${appId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(kycRes.body.data.status).toBe('AADHAAR_VERIFIED');
  expect(kycRes.body.data.panVerified).toBe(false);
  expect(kycRes.body.data.aadhaarVerified).toBe(true);
});
```

---

## 4. Bureau Service Tests

### TC-BUR-001: Bureau Pull — Success
```typescript
it('TC-BUR-001: Should successfully pull from CIBIL and Experian', async () => {
  nock('https://api.cibil.com/credit-report')
    .post('/').reply(200, buildCIBILResponse({ score: 751 }));

  nock('https://api.experian.com/credit-report')
    .post('/').reply(200, buildExperianResponse({ score: 748 }));

  const response = await request(app)
    .post(`/v1/bureau/${appId}/pull`)
    .set('Authorization', `Bearer ${token}`)
    .send({ providers: ['CIBIL', 'EXPERIAN'], consentTimestamp: new Date().toISOString(), consentIpAddress: '1.2.3.4' });

  expect(response.status).toBe(202);

  // Poll until complete
  const report = await pollUntilComplete(`/v1/bureau/${appId}/report`, 'SUCCESS', 30000);
  expect(report.creditScore).toBe(751); // CIBIL used as primary
  expect(report.wilfulDefaulter).toBe(false);
});
```

### TC-BUR-002: Bureau Timeout — Partial Success
```typescript
it('TC-BUR-002: Should handle partial success when one bureau times out', async () => {
  nock('https://api.cibil.com/credit-report')
    .post('/').reply(200, buildCIBILResponse({ score: 751 }));

  nock('https://api.experian.com/credit-report')
    .post('/').delayConnection(35000).reply(200, {}); // Simulate timeout

  const response = await request(app)
    .post(`/v1/bureau/${appId}/pull`)
    .send({ providers: ['CIBIL', 'EXPERIAN'], consentTimestamp: new Date().toISOString(), consentIpAddress: '1.2.3.4' });

  const report = await pollUntilComplete(`/v1/bureau/${appId}/report`, 'PARTIAL_SUCCESS', 60000);
  expect(report.status).toBe('PARTIAL_SUCCESS');
  expect(report.creditScore).toBe(751); // Derived from CIBIL only
  expect(report.providers.find(p => p.provider === 'EXPERIAN').status).toBe('TIMEOUT');
  // Application should still proceed with partial bureau data
});
```

### TC-BUR-003: No Consent — Blocked
```typescript
it('TC-BUR-003: Should block bureau pull without prior consent', async () => {
  // No consent record in DB for this application
  const response = await request(app)
    .post(`/v1/bureau/${appId}/pull`)
    .send({ providers: ['CIBIL'], consentTimestamp: new Date().toISOString(), consentIpAddress: '1.2.3.4' });

  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe('BUR_003');
});
```

### TC-BUR-004: Duplicate Pull Prevention
```typescript
it('TC-BUR-004: Should prevent duplicate bureau pull within 30 days', async () => {
  await seedBureauPullJob(appId, { status: 'SUCCESS', pulledAt: new Date() });

  const response = await request(app)
    .post(`/v1/bureau/${appId}/pull`)
    .send({ providers: ['CIBIL'], consentTimestamp: new Date().toISOString(), consentIpAddress: '1.2.3.4' });

  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('BUR_004');
});
```

---

## 5. Decision Engine Tests

### TC-DEC-001: Auto Decision — Approved
```typescript
it('TC-DEC-001: Should auto-approve high-quality profile', async () => {
  const appId = await createProfileWithBureau({
    creditScore: 780,
    foirActual: 30,
    employmentMonths: 60,
    dpd30: 0,
    wilfulDefaulter: false
  });

  const response = await request(app)
    .post(`/v1/decisions/${appId}/trigger`)
    .set('Authorization', `Bearer ${token}`);

  const decision = await pollDecision(appId, 'APPROVED', 30000);
  expect(decision.finalDecision).toBe('APPROVE');
  expect(decision.rateOfInterestBps).toBe(1075);
  expect(decision.ruleResults.every(r => r.outcome !== 'FAIL')).toBe(true);
  expect(decision.decidedBy).toBe('RULE_ENGINE');
});
```

### TC-DEC-002: Hard Stop — Low Credit Score
```typescript
it('TC-DEC-002: Should reject with hard stop on low credit score', async () => {
  const appId = await createProfileWithBureau({ creditScore: 580 });

  await triggerDecision(appId);
  const decision = await pollDecision(appId, 'REJECTED', 15000);

  expect(decision.finalDecision).toBe('REJECT');
  expect(decision.rejectionReasonCode).toBe('LOW_CREDIT_SCORE');
  const hardStopRule = decision.ruleResults.find(r => r.ruleId === 'RULE_CS_001');
  expect(hardStopRule.outcome).toBe('FAIL');
  expect(hardStopRule.isHardStop).toBe(true);
});
```

### TC-DEC-003: FOIR Breach — Hard Stop
```typescript
it('TC-DEC-003: Should reject when FOIR exceeds product maximum', async () => {
  const appId = await createProfileWithBureau({
    creditScore: 780,
    foirActual: 62 // Exceeds 55% max
  });

  const decision = await triggerAndPollDecision(appId, 'REJECTED');
  expect(decision.rejectionReasonCode).toBe('HIGH_FOIR');
  const foirRule = decision.ruleResults.find(r => r.ruleId === 'RULE_FOIR_001');
  expect(foirRule.outcome).toBe('FAIL');
});
```

### TC-DEC-004: Wilful Defaulter — Hard Stop
```typescript
it('TC-DEC-004: Should reject immediately on wilful defaulter flag', async () => {
  const appId = await createProfileWithBureau({ wilfulDefaulter: true, creditScore: 800 });

  const decision = await triggerAndPollDecision(appId, 'REJECTED');
  expect(decision.rejectionReasonCode).toBe('WILFUL_DEFAULTER');
  // Decision should be made without evaluating other rules
  expect(decision.decidedBy).toBe('RULE_ENGINE');
});
```

### TC-DEC-005: Manual Override — Branch Manager
```typescript
it('TC-DEC-005: Branch manager can override rejection', async () => {
  const managerToken = await getTokenForRole('BRANCH_MANAGER');
  const appId = await createRejectedApplication({ rejectionCode: 'LOW_CREDIT_SCORE' });

  const response = await request(app)
    .post(`/v1/decisions/${appId}/manual-override`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({
      decision: 'APPROVE',
      approvedAmount: 50000000,
      rateOfInterestBps: 1200,
      remarks: 'Policy exception: Strong salary growth trajectory'
    });

  expect(response.status).toBe(200);
  expect(response.body.data.finalDecision).toBe('APPROVE');
  expect(response.body.data.decidedBy).toBe('MANUAL');
  expect(response.body.data.override_by).toBeTruthy();

  // Verify audit log
  const auditLog = await getLatestAuditLog(appId, 'MANUAL_OVERRIDE');
  expect(auditLog.actor_role).toBe('BRANCH_MANAGER');
  expect(auditLog.metadata.remarks).toContain('Policy exception');
});
```

---

## 6. Disbursement Tests

### TC-DISB-001: IMPS Disbursement Success
```typescript
it('TC-DISB-001: IMPS disbursement should succeed and notify', async () => {
  const loanId = await createSanctionedLoan();

  nock('https://npci.org.in/imps')
    .post('/').reply(200, { utrNumber: 'UTIB324567123456', status: 'SUCCESS' });

  const disburseRes = await request(app)
    .post(`/v1/loans/${loanId}/disburse`)
    .set('Authorization', `Bearer ${officerToken}`)
    .send(buildDisbursementRequest({ mode: 'IMPS', amount: 50000000 }));

  expect(disburseRes.status).toBe(202);

  // Simulate NPCI webhook
  await simulatePaymentWebhook({ transactionId: disburseRes.body.data.disbursementId, status: 'SUCCESS', utrNumber: 'UTIB324567123456' });

  // Verify loan status updated
  const loan = await getLoan(loanId);
  expect(loan.status).toBe('ACTIVE');

  // Verify notification sent
  const notifications = await getNotifications(loan.userId);
  expect(notifications.find(n => n.event === 'DISBURSEMENT_SUCCESS')).toBeTruthy();
});
```

### TC-DISB-002: Payment Failure — Retry
```typescript
it('TC-DISB-002: Should retry failed disbursement up to 3 times', async () => {
  let callCount = 0;
  nock('https://npci.org.in/imps')
    .post('/').times(3).reply(200, () => {
      callCount++;
      return callCount < 3
        ? { status: 'FAILED', errorCode: 'BENEFICIARY_BANK_OFFLINE' }
        : { utrNumber: 'UTIB999', status: 'SUCCESS' };
    });

  await initiateDisbursement(loanId);
  await waitForRetries(3, 30000);

  const disb = await getDisbursement(loanId);
  expect(disb.status).toBe('SUCCESS');
  expect(disb.retryCount).toBe(2);
});
```

### TC-DISB-003: Duplicate Payment Prevention
```typescript
it('TC-DISB-003: Same idempotency key should not create duplicate payment', async () => {
  const idemKey = uuid();

  const r1 = await initiateDisbursement(loanId, { idempotencyKey: idemKey });
  const r2 = await initiateDisbursement(loanId, { idempotencyKey: idemKey });

  expect(r1.status).toBe(202);
  expect(r2.status).toBe(202);
  expect(r1.body.data.disbursementId).toBe(r2.body.data.disbursementId);

  const count = await countPaymentTransactions(loanId);
  expect(count).toBe(1);
});
```

---

## 7. Fraud Scenarios

### TC-FRAUD-001: Multiple Applications — Same Aadhaar Different PAN
```typescript
it('TC-FRAUD-001: Should flag when same Aadhaar used with different PAN numbers', async () => {
  const aadhaarHash = sha256('123456789012');
  await seedApplication({ aadhaarHash, panHash: sha256('ABCRS1234F'), status: 'ACTIVE' });

  const response = await createApplication({ aadhaarHash, panNumber: 'XYZDE9876A' }); // Different PAN

  expect(response.body.data.fraudFlags).toContain('AADHAAR_PAN_MISMATCH_HISTORY');
  // Application created but flagged for manual review
  expect(response.body.data.status).toBe('DRAFT');

  const auditLog = await getAuditLog(response.body.data.applicationId, 'FRAUD');
  expect(auditLog).toBeTruthy();
});
```

### TC-FRAUD-002: Velocity Check — Multiple Applications in 24 Hours
```typescript
it('TC-FRAUD-002: Should block after 3 applications from same IP in 1 hour', async () => {
  const ip = '192.168.1.100';

  for (let i = 0; i < 3; i++) {
    await createApplicationFromIP(ip);
  }

  const response = await request(app)
    .post('/v1/applications')
    .set('X-Forwarded-For', ip)
    .send(buildValidApplicationRequest());

  expect(response.status).toBe(429);
  expect(response.body.error.code).toBe('GEN_003');
});
```

---

## 8. Edge Case Tests

### TC-EDGE-001: CBS Unavailable During Disbursement
```typescript
it('TC-EDGE-001: Should queue disbursement when CBS is down', async () => {
  nock('http://cbs.bank.in/soap')
    .post('/').replyWithError('ECONNREFUSED');

  const response = await initiateDisbursement(loanId);

  expect(response.status).toBe(202);
  expect(response.body.data.status).toBe('PROCESSING');

  // Verify queued in Kafka dead-letter after circuit opens
  const dlqMessage = await consumeFromKafkaDLQ('los.cbs.sync.requested');
  expect(dlqMessage).toBeTruthy();
});
```

### TC-EDGE-002: Concurrent Application Updates
```typescript
it('TC-EDGE-002: Concurrent updates should not corrupt data', async () => {
  const appId = await createApplication();

  // Simulate two concurrent updates
  const [r1, r2] = await Promise.all([
    updateApplication(appId, { income: 12000000 }, version=1),
    updateApplication(appId, { income: 13000000 }, version=1)
  ]);

  // One should succeed, one should get 409
  const statuses = [r1.status, r2.status].sort();
  expect(statuses).toEqual([200, 409]);

  // Verify data integrity — only one value persisted
  const app = await getApplication(appId);
  expect([12000000, 13000000]).toContain(app.employmentDetails.grossMonthlyIncome);
});
```

---
*End of API Test Cases*
