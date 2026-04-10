# Security & Compliance Documentation
## Loan Origination System (LOS)
**Version:** 1.0 | **Classification:** CONFIDENTIAL | **Owner:** CISO & Compliance Head

---

## 1. Security Architecture

### 1.1 Defense in Depth

```
Internet
    │
    ▼
[ AWS WAF ] — OWASP CRS + Custom LOS rules
    │
[ CloudFront CDN ] — DDoS mitigation, TLS termination
    │
[ Internet Gateway ]
    │
┌──────────── VPC (10.0.0.0/16) ────────────────────────────────────────┐
│                                                                         │
│  ┌── Public Subnet (10.0.1.0/24) ────────────────────────────────────┐ │
│  │  API Gateway (Kong) — Rate limiting, JWT validation               │ │
│  │  NAT Gateway — Outbound for services                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌── Private Subnet — App (10.0.2.0/24) ─────────────────────────────┐ │
│  │  Microservices (EKS) — mTLS via Istio                             │ │
│  │  Service Mesh — Network policies whitelist-only                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌── Private Subnet — Data (10.0.3.0/24) ────────────────────────────┐ │
│  │  PostgreSQL RDS — Encrypted, no public access                     │ │
│  │  Redis ElastiCache — Encrypted, VPC-only                          │ │
│  │  MinIO S3 — Private endpoint                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌── Private Subnet — Management (10.0.4.0/24) ──────────────────────┐ │
│  │  HashiCorp Vault — Secrets, KMS                                   │ │
│  │  Bastion Host — MFA required                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Zero Trust Principles
- **Verify explicitly:** Every request authenticated + authorized. No implicit trust based on network location.
- **Least privilege:** Each service has minimum permissions. Dynamic secrets via Vault.
- **Assume breach:** All inter-service traffic mTLS encrypted. Comprehensive audit logging.

---

## 2. Authentication & Authorization

### 2.1 OAuth 2.0 / JWT Design

**Token structure:**
```json
{
  "header": { "alg": "RS256", "typ": "JWT", "kid": "key-2024-07" },
  "payload": {
    "sub": "user-uuid",
    "role": "LOAN_OFFICER",
    "branchCode": "MH001",
    "sessionId": "session-uuid",
    "scope": ["application:read", "application:write", "bureau:read"],
    "iat": 1720000000,
    "exp": 1720000900,
    "jti": "unique-token-id",
    "iss": "https://auth.los.bank.in",
    "aud": "https://api.los.bank.in"
  }
}
```

**Key management:**
- RS256 asymmetric — private key in Vault, public key exposed at `/.well-known/jwks.json`
- Key rotation: Every 90 days. Old keys retained 24 hours for token validity.
- Kong gateway validates JWT using JWKS public key — no private key on application servers.

### 2.2 RBAC Permission Matrix

| Permission | APPLICANT | LOAN_OFFICER | CREDIT_ANALYST | BRANCH_MANAGER | ZONAL_CREDIT_HEAD | COMPLIANCE_OFFICER |
|---|---|---|---|---|---|---|
| application:create | Own only | Branch | ✗ | ✗ | ✗ | ✗ |
| application:read | Own only | Branch | Regional | Branch | Zone | All (RO) |
| kyc:write | Own only | Assigned | ✗ | ✗ | ✗ | ✗ |
| bureau:trigger | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| decision:trigger | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| decision:override | ✗ | ✗ | ✗ | ≤₹25L | ≤₹1Cr | ✗ |
| disbursement:maker | ✗ | ✓ | ✗ | ✓ | ✓ | ✗ |
| disbursement:checker | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| audit:read | ✗ | ✗ | ✗ | Own branch | Zone | All |
| config:write | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (ADMIN only) |

### 2.3 Multi-Factor Authentication
- Applicants: OTP (SMS/WhatsApp) — required for login and key actions
- Staff: LDAP password + OTP (Google Authenticator) for login; OTP for disbursement, sanction
- Sensitive operations requiring additional auth: Disbursement initiation, manual decision override, config changes

### 2.4 Session Management
- Access token TTL: 15 minutes
- Refresh token TTL: 7 days (rolling)
- Max concurrent sessions per user: 3
- Idle session timeout: 30 minutes
- Refresh tokens stored hashed (bcrypt) in Redis + PostgreSQL backup
- Session revocation: Real-time via Redis blacklist; batch sync to DB

---

## 3. Data Encryption

### 3.1 Encryption at Rest

| Data Type | Storage | Encryption | Key Management |
|---|---|---|---|
| Documents (PDF/image) | MinIO | AES-256-GCM (SSE-KMS) | AWS KMS (CMK) |
| Aadhaar photo | MinIO | AES-256-GCM (SSE-KMS) | Separate CMK, restricted access |
| PAN number | PostgreSQL | pgcrypto (pgp_sym_encrypt) | Vault-managed key |
| Mobile number | PostgreSQL | pgcrypto for storage | Vault-managed key |
| Bureau report XML | MinIO | AES-256-GCM | AWS KMS |
| Database backups | S3 Glacier | AES-256 (S3 SSE) | AWS KMS |
| Application logs | CloudWatch | AES-256 | AWS-managed |

### 3.2 Encryption in Transit
- External (client ↔ API): TLS 1.3 minimum. TLS 1.0/1.1 disabled. HSTS enforced.
- Internal (service ↔ service): mTLS via Istio (Envoy). All traffic encrypted even within VPC.
- CBS SOAP: TLS 1.2 + IP allowlisting (CBS does not support TLS 1.3)
- Database: TLS for all PostgreSQL connections. `ssl_mode=verify-full`
- Redis: TLS for all ElastiCache connections

### 3.3 Field-Level Masking

**PAN number storage and display:**
- Input: `ABCRS1234F`
- Stored encrypted. Hash stored: `sha256("ABCRS1234F")` for dedup
- API response: `ABCDE####F` (last 4 chars + type char visible)

**Aadhaar number:**
- Never stored anywhere. Only `sha256(aadhaarNumber)` stored
- Display: `XXXX-XXXX-4321` (last 4 digits only)
- UIDAI regulation: No storage even encrypted after KYC completion

**Mobile number:**
- Stored AES encrypted. Hash stored for lookup
- API response: `XXXXXX3210`
- Logs: `XXXXXX3210`

**Bank account number:**
- Stored AES encrypted
- API response/logs: `XXXXXXXX789` (last 3 visible)

### 3.4 Aadhaar-Specific Security Controls (UIDAI Compliance)
```
1. AUA/KUA license — mandatory. All eKYC calls via licensed AUA.
2. Aadhaar number encrypted with UIDAI public key before any transmission.
3. No Aadhaar storage — only SHA-256 hash after verification.
4. Aadhaar photo stored encrypted separately — accessible only by KYC service account.
5. eKYC transaction log retained 6 months (UIDAI requirement).
6. Consent with OTP confirmation before every eKYC call.
7. Biometric data: Not used (text-OTP based eKYC only).
```

---

## 4. API Security

### 4.1 Kong Gateway Security Plugins

```yaml
# Rate limiting
- name: rate-limiting
  config:
    minute: 100         # per user
    hour: 2000
    policy: local
    fault_tolerant: true

# JWT validation
- name: jwt
  config:
    claims_to_verify: ["exp", "nbf", "iss", "aud"]
    key_claim_name: kid

# IP restriction for CBS/bureau webhooks
- name: ip-restriction
  config:
    allow: ["203.x.x.x/24"]  # NPCI/bureau IP ranges

# Request size limit
- name: request-size-limiting
  config:
    allowed_payload_size: 10  # MB

# CORS
- name: cors
  config:
    origins: ["https://app.los.bank.in", "https://dsa.los.bank.in"]
    methods: ["GET", "POST", "PATCH", "DELETE"]
    headers: ["Authorization", "Content-Type", "X-Request-ID", "X-Idempotency-Key"]
```

### 4.2 Input Validation
- All API inputs validated via `class-validator` decorators before processing
- SQL injection: Only parameterized queries via TypeORM / pg library. No string concatenation.
- XSS: All user input HTML-escaped. Content-Security-Policy headers set.
- SSRF prevention: Outbound HTTP only to allowlisted domains; no user-controlled URLs

### 4.3 Webhook Security
```typescript
// Validate NPCI/payment webhook signature
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expected}`),
    Buffer.from(signature)
  );
}
// Timing-safe comparison prevents timing attacks
```

---

## 5. Regulatory Compliance

### 5.1 RBI Guidelines Compliance Matrix

| Guideline | Requirement | Implementation | Status |
|---|---|---|---|
| Digital Lending (2022) | Disbursement direct to borrower | Payment service validates beneficiary = applicant | ✓ |
| Digital Lending (2022) | KFS before loan acceptance | KFS PDF generated and displayed at sanction stage | ✓ |
| Digital Lending (2022) | APR disclosure | APR calculated and displayed in sanction letter | ✓ |
| Digital Lending (2022) | Cooling-off 3 days (≤₹50K) | Disbursement blocked for 72 hours for small loans | ✓ |
| KYC Master Direction | CKYCR upload on new customer | CBS triggers CKYCR API post customer creation | ✓ |
| KYC Master Direction | Re-KYC cycles by risk | Customer risk segment stored; re-KYC flag triggered | ✓ |
| IT Act 2000 | Electronic records validity | Digital signatures via Aadhaar eSign (licensed provider) | ✓ |
| DPDP Act 2023 | Data minimization | Only loan-relevant fields collected; consent for each | ✓ |
| DPDP Act 2023 | Right to erasure | Applicant can request deletion (subject to legal hold) | Partial |
| PMLA 2002 | STR reporting | Fraud flags generate alerts to compliance officer | ✓ |

### 5.2 UIDAI Aadhaar Act Compliance

```
Section 29(1): No entity shall use Aadhaar number for authentication except...
  → LOS uses ONLY for KYC verification; no persistent storage

Section 8(3): Authentication only with consent
  → OTP-confirmed consent captured and stored with timestamp, IP, user agent

Section 37: Penalty for unauthorized use
  → UIDAI eKYC transaction log retained 6 months
  → All Aadhaar data access logged in data_access_logs table
  → Annual third-party audit of Aadhaar data handling

UIDAI Circular (2022): No storage of biometric data
  → LOS uses text-OTP eKYC only; no fingerprint/iris collection
```

### 5.3 Data Localisation (RBI 2019 + DPDP 2023)
```
- All production infrastructure: AWS ap-south-1 (Mumbai)
- No cross-region replication to non-Indian regions
- DR region: AWS ap-south-1 AZ-B (same region, different AZ)
- For CERT-In audit: Data residency certificate from AWS available
- CDN: CloudFront with edge locations restricted to India nodes only
- No data sent to: US, EU, or any country outside India
```

### 5.4 RBI IT Framework (2011, updated 2021)
| Control | Implementation |
|---|---|
| Change management | GitOps; all changes via PR + approval; no direct prod access |
| Patch management | Automated vulnerability scanning; critical patches within 24h |
| Access review | Quarterly access review; automatic deprovisioning on resignation |
| Business continuity | RTO 4h, RPO 30min; quarterly DR drill |
| Incident response | Defined playbooks; 6-hour RBI notification SLA for major incidents |
| Vendor risk | Third-party (UIDAI, bureaus) security assessments annually |
| VAPT | Quarterly by CERT-In empaneled firm |

---

## 6. Fraud Detection & Prevention

### 6.1 Real-Time Fraud Rules

| Rule | Trigger | Action |
|---|---|---|
| Velocity: 3+ applications same IP in 1 hour | IP tracking | Block + alert |
| Multiple PAN same Aadhaar hash | DB lookup | Flag for manual review |
| Same Aadhaar different PAN | KYC crosscheck | Flag + freeze application |
| Bureau fraud flag | CIBIL/Experian response | Hard stop rejection |
| Defaulter list match | Internal + RBI CRILC | Hard stop rejection |
| Face match score < 50 (very low) | KYC | Alert compliance + flag |
| Bureau pull within 30 days from multiple institutions | Bureau enquiry check | Warning to credit analyst |
| Unusual disbursement pattern (different account than usual) | Payment analytics | Additional checker approval |
| Device fingerprint: new device + high-value application | Risk score | OTP re-verification |

### 6.2 ML-Based Anomaly Detection
- Transaction monitoring: Isolation Forest model on application feature vectors
- Features: IP geolocation, application-to-submission time, device fingerprint consistency, OCR confidence scores
- Alert threshold: Anomaly score > 0.8 → flag for manual review
- Model retrained monthly on labeled fraud cases

### 6.3 Fraud Alert Workflow
```
1. Rule/ML trigger → create fraud_alert record
2. Alert severity: LOW (log only), MEDIUM (compliance notification), HIGH (freeze application)
3. Compliance officer reviews within 4 hours (SLA for HIGH severity)
4. PMLA: STR filed within 7 days for confirmed fraud
5. FIR lodged for fraud above ₹1L (bank's legal team)
```

---

## 7. Audit Trail

### 7.1 Tamper-Evident Audit Log

```typescript
// Chain hash calculation
async function computeChainHash(
  previousHash: string,
  currentRecord: Omit<AuditLog, 'chainHash'>
): Promise<string> {
  const content = `${previousHash}|${currentRecord.id}|${currentRecord.timestamp}|${currentRecord.entityId}|${currentRecord.eventType}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

// On every audit log insert:
const previousHash = await getLastChainHash();
const chainHash = await computeChainHash(previousHash, newRecord);
await insertAuditLog({ ...newRecord, chainHash });
```

### 7.2 Mandatory Audit Events

| Event | Logged Fields | Retention |
|---|---|---|
| User login | userId, IP, userAgent, success/fail | 10 years |
| OTP generation | maskedMobile, purpose, sessionId | 10 years |
| Application created/updated | Full before/after snapshot (PAN masked) | 10 years |
| KYC initiated/completed | kycId, provider, status, txnId | 10 years |
| Aadhaar data accessed | accessorId, accessorRole, purpose, IP | 10 years |
| Bureau pull triggered | jobId, providers, consentTimestamp, consentIP | 10 years |
| Decision generated | Full rule results, model score, decision | 10 years |
| Manual override | actorId, actorRole, beforeDecision, afterDecision, remarks | Permanent |
| Disbursement initiated | loanId, amount, mode, beneficiaryMasked, checkerID | Permanent |
| CBS call made | requestType, request (sanitized), response code | 7 years |
| Config change | field changed, before, after, actor | Permanent |

### 7.3 Log Integrity Verification

Monthly automated job:
```sql
-- Verify chain hash integrity for last month's logs
WITH ordered_logs AS (
  SELECT id, chain_hash, LAG(chain_hash) OVER (ORDER BY timestamp) AS prev_hash,
         timestamp, entity_id, event_type
  FROM audit_logs
  WHERE timestamp >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
),
expected_hashes AS (
  SELECT id,
    encode(sha256(CAST(CONCAT(prev_hash, '|', id, '|', timestamp, '|', entity_id, '|', event_type) AS BYTEA)), 'hex') AS expected_hash,
    chain_hash AS actual_hash
  FROM ordered_logs
  WHERE prev_hash IS NOT NULL
)
SELECT COUNT(*) AS tampered_records
FROM expected_hashes
WHERE expected_hash != actual_hash;
```

---

## 8. Incident Response

### 8.1 Severity Classification

| Severity | Definition | Response SLA | RBI Notification |
|---|---|---|---|
| P1 | Data breach / production down | 30 min | Within 6 hours |
| P2 | Partial service degradation | 2 hours | Within 24 hours if data involved |
| P3 | Non-critical service issue | 8 hours | Not required |
| P4 | Minor bug / performance | Next sprint | Not required |

### 8.2 Aadhaar Data Breach Response
1. Immediate: Notify CISO within 15 minutes
2. Within 1 hour: Isolate affected system, revoke service credentials
3. Within 6 hours: Notify UIDAI via prescribed format + RBI via incident report
4. Within 24 hours: Forensic analysis report
5. Within 72 hours: Affected customer notification per DPDP Act

---

## 9. Vulnerability Management

### 9.1 SAST/DAST Pipeline
```yaml
# Security scanning in CI/CD
stages:
  - sast:
      tool: SonarQube + Semgrep
      fail_on: CRITICAL severity
      run: every PR
  - dependency_scan:
      tool: Snyk
      fail_on: HIGH severity with fix available
      run: daily
  - container_scan:
      tool: Trivy
      fail_on: CRITICAL in base image
      run: every image build
  - dast:
      tool: OWASP ZAP
      target: UAT environment
      run: weekly
  - vapt:
      provider: CERT-In empaneled firm
      scope: Full application
      run: quarterly
```

### 9.2 Secrets Detection
- Pre-commit hook: Gitleaks scans every commit for credentials
- AWS Secrets Manager rotation: Database passwords rotated every 24 hours (Vault dynamic secrets)
- No secrets in code, environment variables, or Docker images

---
*End of Security & Compliance Documentation*
