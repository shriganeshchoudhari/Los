# Test Plan and Test Cases
## Loan Origination System (LOS)
**Version:** 1.0 | **Test Lead:** QA Team | **Date:** 2024-07-15

---

## 1. Test Strategy

### 1.1 Testing Pyramid
```
                    ┌─────────────┐
                    │     E2E     │  5% — Playwright
                    │  (20 flows) │
                   ┌┴─────────────┴┐
                   │  Integration  │  25% — Jest + Supertest
                   │  (150 tests)  │
                  ┌┴───────────────┴┐
                  │   Unit Tests    │  70% — Jest
                  │  (1200 tests)   │
                  └─────────────────┘
```

### 1.2 Coverage Requirements
| Service | Unit | Integration | E2E |
|---|---|---|---|
| Auth Service | 95% | 90% | Yes |
| Application Service | 95% | 90% | Yes |
| KYC Service | 90% | 85% | Yes |
| Decision Engine | 98% | 95% | Yes |
| Integration Service | 85% | 80% | No |
| Document Service | 90% | 85% | Yes |
| Notification Service | 85% | 75% | No |

### 1.3 Test Environments
| Env | Purpose | Data | Integrations |
|---|---|---|---|
| DEV | Developer testing | Synthetic | All mocked |
| SIT | Integration testing | Synthetic | Real (UAT endpoints) |
| UAT | User acceptance | Anonymized production clone | Real (sandbox APIs) |
| PERF | Performance testing | 10M records | Mocked external |
| PROD | Smoke only post-deploy | Real | Real |

---

## 2. Test Categories

### 2.1 Unit Test Cases

#### Auth Service Units

**TC-UNIT-AUTH-001: OTP Generator**
- Input: mobile number
- Expected: 6-digit numeric OTP
- Coverage: Range validation (100000-999999), no sequential patterns

**TC-UNIT-AUTH-002: JWT Generation**
- Input: userId, role, branchCode
- Expected: Valid RS256 JWT with correct claims
- Validate: `exp - iat == 900`, `jti` present, role claim matches input

**TC-UNIT-AUTH-003: Token Refresh Logic**
- Input: valid refresh token
- Expected: New access token + rotated refresh token
- Edge case: refreshToken 1 second before expiry → should succeed

**TC-UNIT-AUTH-004: RBAC Permission Matrix**
```
| Action                    | APPLICANT | LOAN_OFFICER | CREDIT_ANALYST | BRANCH_MANAGER |
|---------------------------|-----------|--------------|----------------|----------------|
| Create own application    | ✓         | ✓            | ✗              | ✗              |
| View any application      | ✗         | ✓(branch)    | ✓(regional)    | ✓(branch)      |
| Trigger bureau pull       | ✗         | ✓            | ✓              | ✓              |
| Manual decision override  | ✗         | ✗            | ✗              | ✓              |
| Initiate disbursement     | ✗         | ✓(maker)     | ✗              | ✓(checker)     |
```

#### Application Service Units

**TC-UNIT-APP-001: FOIR Calculation**
- Income: ₹1,00,000/month
- Existing EMIs: ₹35,000
- Requested EMI: ₹16,000
- Expected FOIR: (35,000 + 16,000) / 1,00,000 = 51%

**TC-UNIT-APP-002: Application Number Generation**
- Pattern: `LOS-{YYYY}-{STATE}-{SEQNO:6}`
- Input: created at 2024-07-15, state MH, sequence 342
- Expected: `LOS-2024-MH-000342`
- Edge case: Sequence number rollover at 999999

**TC-UNIT-APP-003: State Machine — Valid Transitions**
```typescript
const VALID_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['KYC_IN_PROGRESS', 'CANCELLED'],
  KYC_IN_PROGRESS: ['KYC_COMPLETE', 'KYC_FAILED'],
  KYC_COMPLETE: ['DOCUMENT_COLLECTION'],
  DOCUMENT_COLLECTION: ['UNDER_PROCESSING'],
  UNDER_PROCESSING: ['BUREAU_PULL_IN_PROGRESS'],
  BUREAU_PULL_IN_PROGRESS: ['BUREAU_PULL_COMPLETE'],
  BUREAU_PULL_COMPLETE: ['CREDIT_ASSESSMENT'],
  CREDIT_ASSESSMENT: ['APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'PENDING_FIELD_INVESTIGATION'],
  APPROVED: ['SANCTIONED', 'CANCELLED'],
  SANCTIONED: ['DISBURSEMENT_IN_PROGRESS'],
  DISBURSEMENT_IN_PROGRESS: ['DISBURSED', 'SANCTIONED'],
  DISBURSED: ['CLOSED']
};
// Test every invalid transition throws ApplicationStateTransitionError
```

**TC-UNIT-APP-004: Duplicate Application Detection**
- Same PAN + same product + status = ACTIVE within 30 days → DUPLICATE
- Same PAN + different product → NOT DUPLICATE
- Same PAN + same product + status = REJECTED within 30 days → NOT DUPLICATE (can reapply)
- Same PAN + same product + 31 days ago → NOT DUPLICATE

#### Decision Engine Units

**TC-UNIT-DEC-001: Rule Evaluation — Credit Score**
```
Score 750, threshold 700 → PASS
Score 700, threshold 700 → PASS (boundary)
Score 699, threshold 700 → FAIL (hard stop)
Score 0, threshold 700 → FAIL (edge case)
```

**TC-UNIT-DEC-002: LTV Calculation**
```
Loan amount: ₹40L, Property value: ₹50L → LTV = 80%
Max LTV for home loan: 80% → PASS
Loan amount: ₹45L, Property value: ₹50L → LTV = 90% → FAIL
```

**TC-UNIT-DEC-003: Age at Maturity**
```
Current age: 55, Tenure: 60 months → Age at maturity = 60 → PASS (max 60)
Current age: 56, Tenure: 60 months → Age at maturity = 61 → FAIL (hard stop)
Current age: 18, Tenure: 36 months → Age at maturity = 21 → PASS
Current age: 17 → FAIL (minimum age 18)
```

**TC-UNIT-DEC-004: Interest Rate Calculation**
```
Base MCLR 1Y: 8.60%
Spread: 0.15%
Final rate: 8.75%
In BPS: 875
EMI (₹10L, 12M, 8.75% p.a.): ₹87,378
```

#### KYC Service Units

**TC-UNIT-KYC-001: Aadhaar Number Validation**
- 12-digit Verhoeff algorithm check
- Valid: 234123412346 → true
- Invalid: 123456789012 → false (fails Verhoeff)
- Length check: 11 digits → false

**TC-UNIT-KYC-002: PAN Validation**
- Format: `[A-Z]{5}[0-9]{4}[A-Z]`
- Valid: ABCRS1234F → true
- Invalid: ABCRS123F → false (only 3 digits)
- Structural: 4th char = P (individual), B (company), F (firm) → validate type

**TC-UNIT-KYC-003: Name Fuzzy Match**
- "RAVI KUMAR SHARMA" vs "RAVI SHARMA" → score 85 (PASS)
- "RAVI KUMAR SHARMA" vs "SURESH PATEL" → score 12 (FAIL)
- "PRIYA DEVI" vs "PRIYA DEVI" → score 100 (exact match)

---

## 3. Integration Test Cases

### 3.1 Application → KYC Integration

**TC-INT-001: Application Submission Triggers KYC Event**
```
1. Create application
2. Submit application
3. Verify Kafka message published to 'los.kyc.initiated'
4. Verify application status transitions to KYC_IN_PROGRESS
5. Verify KYC record created in DB
```

**TC-INT-002: KYC Completion Updates Application**
```
1. Mock UIDAI and NSDL APIs
2. Complete full eKYC + PAN + face match
3. Verify Kafka event 'los.kyc.completed' published
4. Verify application status = KYC_COMPLETE
5. Verify document checklist generated based on employment type
```

### 3.2 Bureau → Decision Integration

**TC-INT-003: Bureau Completion Triggers Decision**
```
1. Complete bureau pull (CIBIL score: 751)
2. Verify 'los.bureau.pull.completed' Kafka event
3. Verify decision engine triggered automatically
4. Verify decision result stored in DB
5. Verify application status updated
```

**TC-INT-004: Decision → CBS Integration (Approval Path)**
```
1. Mock CIBIL (score: 780), decision: APPROVE
2. Trigger decision
3. Officer sanctions loan
4. Verify CBS SOAP call made for customer creation
5. Verify CBS SOAP call for loan account creation
6. Verify loan account number stored in loans table
7. Verify CBS-related audit log entries
```

### 3.3 Disbursement → Payment Integration

**TC-INT-005: Disbursement → NPCI → Webhook Flow**
```
1. Create active loan in SANCTIONED status
2. Initiate IMPS disbursement
3. Mock NPCI response: UTR = "UTIB324567123456"
4. POST to /webhooks/payment with success payload + valid HMAC
5. Verify disbursement status = SUCCESS
6. Verify loan status = ACTIVE
7. Verify EMI schedule generated
8. Verify notification sent to applicant
```

**TC-INT-006: Payment Webhook — Invalid HMAC Rejected**
```
1. POST to /webhooks/payment with tampered HMAC
2. Expected: 401 Unauthorized
3. Verify disbursement status unchanged
4. Verify security alert logged
```

---

## 4. Performance Test Cases

### 4.1 Load Tests (k6)

**TC-PERF-001: Application Creation Under Load**
```javascript
// k6 script
export const options = {
  scenarios: {
    normal_load: {
      executor: 'constant-vus',
      vus: 500,
      duration: '10m'
    },
    peak_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '5m', target: 2000 },
        { duration: '10m', target: 5000 },
        { duration: '5m', target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.01']
  }
};
```

**TC-PERF-002: Bureau Pull Concurrent Load**
- Target: 200 simultaneous bureau pulls
- Expected: All complete within 3 minutes
- Circuit breaker threshold: 20% failure rate

**TC-PERF-003: Decision Engine Throughput**
- Target: 1000 decisions/minute
- Expected P95: <10 seconds
- No degradation after 10K decisions in sequence

### 4.2 Stress Tests

**TC-STRESS-001: Database Connection Pool Exhaustion**
- Gradually increase load until connection pool exhausted
- Expected: Graceful queuing, not crash
- Recovery: Load reduced → system recovers within 60s

**TC-STRESS-002: Kafka Consumer Lag**
- Produce 100,000 events without consumers
- Start consumers → verify lag cleared within 5 minutes
- No data loss confirmed

---

## 5. Security Test Cases

**TC-SEC-001: SQL Injection Prevention**
```
POST /v1/applications
Body: { "applicant": { "fullName": "'; DROP TABLE users; --" } }
Expected: 422 with validation error; DB unchanged
```

**TC-SEC-002: JWT Algorithm Confusion Attack**
```
Forge JWT with alg=none
Expected: 401 — algorithm none not accepted
```

**TC-SEC-003: Aadhaar Data in Logs**
```
Trigger Aadhaar eKYC flow
Expected: grep for "234123412346" in all service logs → 0 matches
```

**TC-SEC-004: PAN Data in API Response**
```
GET /v1/applications/{id}
Expected: PAN in response is masked: "ABCDE####F"
Raw PAN never in response body
```

**TC-SEC-005: IDOR (Insecure Direct Object Reference)**
```
User A creates application → applicationId_A
User B authenticated
User B GET /v1/applications/applicationId_A
Expected: 403 Forbidden
```

**TC-SEC-006: Rate Limiting**
```
Send 101 requests in 60 seconds from same user
Expected: Request 101 → 429 Too Many Requests
X-RateLimit-Reset header present
```

---

## 6. Regression Test Suite

### Critical Path Regression (Run on every deploy)
1. TC-AUTH-001 to TC-AUTH-006
2. TC-APP-001, TC-APP-002 (duplicate detection)
3. TC-KYC-001 (full eKYC flow)
4. TC-BUR-001 (bureau pull success)
5. TC-DEC-001 (auto-approve)
6. TC-DEC-002 (hard stop rejection)
7. TC-DISB-001 (IMPS disbursement)
8. TC-INT-005 (full disbursement webhook flow)

### Nightly Full Regression
All test cases above + performance smoke test.

---

## 7. Test Data Management

### Synthetic Test Profiles
```
PROFILE_1: Premium — CIBIL 800, income ₹2L, salaried, clean history → Always APPROVE
PROFILE_2: Standard — CIBIL 720, income ₹80K, salaried, 1 DPD30 → APPROVE with condition
PROFILE_3: Borderline — CIBIL 700, income ₹60K, high FOIR → REFER_TO_CREDIT_COMMITTEE
PROFILE_4: Reject — CIBIL 620, multiple DPDs → REJECT (credit score hard stop)
PROFILE_5: Fraud — Wilful defaulter flag → REJECT (immediate hard stop)
PROFILE_6: Thin File — No bureau record → MANUAL (underwriter review)
```

### Mock API Responses (fixtures/)
- `uidai_kyc_success.xml` — Valid signed UIDAI XML
- `uidai_otp_expired.json` — Error code 201
- `cibil_750_clean.json` — Score 750, no DPDs
- `cibil_620_dpd.json` — Score 620, 3 DPD30
- `cibil_no_hit.json` — No bureau record
- `nsdl_pan_valid.json` — PAN VALID, seeded
- `nsdl_pan_inactive.json` — PAN INACTIVE

---
*End of Test Plan and Test Cases*
