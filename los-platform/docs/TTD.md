# Technical Design Document (TDD)
## Loan Origination System (LOS)
**Version:** 1.0 | **Date:** 2024-07-15 | **Author:** Architecture Team

---

## 1. System Architecture Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL CLIENTS                               │
│  Mobile App (React Native)   Web Portal (Next.js)   DSA Portal (React)  │
└──────────────────┬──────────────────┬────────────────────┬──────────────┘
                   │                  │                    │
                   └──────────────────┴────────────────────┘
                                      │ HTTPS / WSS
                   ┌──────────────────▼──────────────────────┐
                   │            API GATEWAY (Kong)            │
                   │   Rate Limiting | Auth | SSL Termination │
                   │   Request Routing | mTLS to services     │
                   └──────────────────┬──────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
   ┌──────▼──────┐           ┌───────▼──────┐           ┌────────▼──────┐
   │Auth Service │           │  App Service │           │  KYC Service  │
   │  (NestJS)   │           │  (NestJS)    │           │  (NestJS)     │
   │  Port:3001  │           │  Port:3002   │           │  Port:3003    │
   └──────┬──────┘           └──────┬───────┘           └────────┬──────┘
          │                         │                            │
   ┌──────▼──────┐           ┌──────▼───────┐           ┌────────▼──────┐
   │  Decision   │           │  Document    │           │ Integration   │
   │  Engine     │           │  Service     │           │  Service      │
   │  (NestJS)   │           │  (NestJS)    │           │  (NestJS)     │
   │  Port:3004  │           │  Port:3005   │           │  Port:3006    │
   └──────┬──────┘           └──────┬───────┘           └────────┬──────┘
          │                         │                            │
   ┌──────▼──────┐           ┌──────▼────────────────────────────▼──────┐
   │Notification │           │           MESSAGE BUS (Kafka)             │
   │  Service    │           │  los.application.*  |  los.kyc.*          │
   │  (NestJS)   │           │  los.bureau.*       |  los.decision.*     │
   │  Port:3007  │           │  los.payment.*      |  los.audit.*        │
   └─────────────┘           └────────────────────────────────────────────┘
          │
   ┌──────▼──────────────────────────────────────────────────────────────┐
   │                         DATA LAYER                                   │
   │  PostgreSQL (Primary)    Redis (Cache/Sessions)    MinIO (Docs)      │
   │  PostgreSQL (Replica)    Elasticsearch (Search)    Vault (Secrets)   │
   └──────────────────────────────────────────────────────────────────────┘
          │
   ┌──────▼──────────────────────────────────────────────────────────────┐
   │                    EXTERNAL INTEGRATIONS                             │
   │  UIDAI (Aadhaar eKYC)    NSDL (PAN)         CIBIL/Experian/CRIF     │
   │  CBS (Finacle SOAP)      NPCI (IMPS/NEFT)   NACH (NPCI)             │
   │  DigiLocker              SMS/WhatsApp/Email  CKYCR                   │
   └──────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Frontend Web | Next.js 14 (App Router) | SSR for SEO, RSC for performance, TypeScript |
| Frontend Mobile | React Native + Expo | Code sharing with web, OTA updates |
| Backend Services | NestJS (Node.js 20 LTS) | TypeScript native, DI container, OpenAPI generation, decorator-based, fast dev |
| API Gateway | Kong OSS | Plugin ecosystem, rate limiting, JWT validation offload, mTLS |
| Message Broker | Apache Kafka 3.6 | High throughput, event replay, audit log durability, exactly-once semantics |
| Primary DB | PostgreSQL 15 | ACID, JSONB for flexible fields, partitioning, RLS for multi-tenancy |
| Cache / Sessions | Redis 7.2 (Sentinel) | O(1) session lookup, OTP storage with TTL, idempotency keys |
| Object Storage | MinIO (S3-compatible) | On-prem deployment option, compliance, S3 API compatible |
| Search | Elasticsearch 8 | Full-text search on applications, fraud detection queries |
| Secrets | HashiCorp Vault | Dynamic secrets, KMS integration, audit access log |
| Container | Docker + Kubernetes (EKS) | Horizontal scaling, self-healing, rolling deployments |
| Service Mesh | Istio | mTLS between services, traffic management, observability |
| Observability | Prometheus + Grafana + Loki + Jaeger | Metrics, logs, traces |

**Why NestJS over Spring Boot:** Team is TypeScript-first. NestJS provides same patterns (DI, decorators, modules) without JVM overhead. Node.js async I/O is better suited for high-concurrency integration-heavy workloads (bureau pulls, SOAP calls).

**Why Kafka over RabbitMQ:** Durable event log required for audit replay. Kafka's log retention enables re-processing failed events. CQRS pattern with Kafka Streams for read models.

---

## 2. Microservice Design

### 2.1 Auth Service

**Responsibility:** OTP generation/validation, JWT issuance, session management, RBAC enforcement, LDAP integration for staff.

**Key flows:**
- Applicant: Mobile → Send OTP → Validate OTP → Issue JWT + Refresh Token
- Staff: LDAP authenticate → Issue JWT with role claim
- Service-to-service: mTLS + service account JWT

**Data stores:**
- Redis: OTP sessions (TTL 300s), refresh tokens (TTL 7 days), session blacklist
- PostgreSQL: User records, refresh token metadata, failed attempt counters

**Failure handling:**
- LDAP unreachable: fallback to local credential store for emergency access
- Redis unavailable: degrade to stateless JWT (no refresh, shorter expiry)
- OTP delivery failure: return sessionId with error; allow resend after 60s

### 2.2 Application Service

**Responsibility:** Loan application CRUD, state machine transitions, duplicate detection, FOIR calculation, assignment to officers.

**State machine transitions (valid only):**
```
DRAFT → SUBMITTED → KYC_IN_PROGRESS → KYC_COMPLETE → DOCUMENT_COLLECTION
→ UNDER_PROCESSING → BUREAU_PULL_IN_PROGRESS → BUREAU_PULL_COMPLETE
→ CREDIT_ASSESSMENT → [PENDING_FIELD_INVESTIGATION →] [PENDING_LEGAL_TECHNICAL →]
→ [CREDIT_COMMITTEE →] → APPROVED/CONDITIONALLY_APPROVED/REJECTED
→ SANCTIONED → DISBURSEMENT_IN_PROGRESS → DISBURSED → CLOSED
```

**Optimistic locking:** Every update requires `version` field. Incremented on each write. Concurrent update returns 409 Conflict.

**Duplicate detection:** On submission, query:
```sql
SELECT id FROM loan_applications
WHERE applicant_pan_hash = $1
  AND loan_type = $2
  AND status NOT IN ('REJECTED','WITHDRAWN','CANCELLED')
  AND created_at > NOW() - INTERVAL '30 days'
```

### 2.3 KYC Service

**Responsibility:** Aadhaar eKYC orchestration, PAN verification, face match, KYC record management, consent capture.

**Aadhaar eKYC flow:**
```
1. Encrypt Aadhaar number with UIDAI public key (RSA-2048-OAEP)
2. POST /uidai/api/v2/ekyc/otp — initiate OTP
3. Receive txnId + uidaiRefId
4. Applicant enters OTP
5. POST /uidai/api/v2/ekyc/verify — submit encrypted OTP
6. Receive signed XML with KYC data
7. Validate UIDAI signature (X.509 cert)
8. Extract: name, DOB, gender, address, photo
9. Store: name/DOB/address in plain (required for loan), photo encrypted, Aadhaar hash only
```

**UIDAI failure scenarios:**
| Error Code | Meaning | Handling |
|---|---|---|
| 100 | Success | Proceed |
| 200 | OTP invalid | Return error KYC_002 |
| 201 | OTP expired | Return error KYC_001 |
| 500 | Internal UIDAI error | Retry once; fallback to offline XML |
| 998 | Aadhaar suspended | Return hard failure |

### 2.4 Integration Service

**Responsibility:** All external API calls — UIDAI, NSDL, bureaus, CBS (SOAP), NPCI payments, NACH. Circuit breakers. Retry logic. Response mapping.

**Circuit breaker config per integration:**
```typescript
// CIBIL circuit breaker
{
  failureThreshold: 5,        // open after 5 failures
  successThreshold: 2,        // close after 2 successes (half-open)
  timeout: 30000,             // 30s request timeout
  openDuration: 60000,        // stay open for 60s
  halfOpenRequests: 1
}
```

**CBS SOAP client:**
- Uses `node-soap` library with WSDL from Finacle
- Connection pool: min 5, max 20 connections
- Request timeout: 30s; total retry timeout: 90s
- All SOAP requests logged (request + response) with PII masked

### 2.5 Decision Engine

**Responsibility:** Rule evaluation, ML scorecard inference, decision aggregation, policy versioning.

**Rule engine (Drools-inspired, implemented in TypeScript):**
```typescript
// Rule definition example
{
  ruleId: 'RULE_CS_001',
  name: 'Minimum Credit Score',
  category: 'CREDIT_SCORE',
  isHardStop: true,
  condition: (ctx: DecisionContext) => ctx.creditScore >= ctx.product.minCreditScore,
  onFail: () => ({ message: `Credit score ${ctx.creditScore} below minimum ${ctx.product.minCreditScore}` })
}
```

**ML Model inference:**
- TensorFlow.js model loaded at startup
- Features: credit score, FOIR, employment tenure, DPD history, enquiry count, loan amount/income ratio
- Returns: probability of default (0-1), grade, score
- Model version stored with decision for audit

**Policy versioning:** Each ProductConfig has effectiveFrom/To dates. Decision engine uses policy version active at time of decision creation.

### 2.6 Document Service

**Responsibility:** Presigned URL generation, OCR trigger, document status management, watermarking, DigiLocker integration.

**OCR pipeline:**
```
Upload → S3 event → SQS → OCR worker → extract fields → validate → update document record
Timeout: 120s; if exceeded → status = OCR_FAILED, manual review flag set
```

**Watermarking:** Server-side using sharp (Node.js): adds text overlay on image, adds watermark page to PDF using pdf-lib.

### 2.7 Notification Service

**Responsibility:** Multi-channel notification dispatch, DLT template management, retry logic, delivery tracking.

**Provider priority:**
1. Primary: Kaleyra (SMS), Gupshup (WhatsApp), SendGrid (Email)
2. Fallback: MSG91 (SMS), Direct SMTP (Email)

**DLT compliance:** All SMS templates pre-registered on TRAI DLT. Template ID embedded in SMS dispatch request. Regulatory requirement for transactional SMS in India.

---

## 3. Database Architecture

### 3.1 PostgreSQL Schema Design Principles

- **Multi-tenancy:** Row-level security (RLS) by branch_code for data segregation
- **Partitioning:** `loan_applications` and `audit_logs` partitioned by created_at (monthly)
- **Encryption:** Sensitive columns (PAN, mobile) encrypted with pgcrypto using KMS-managed keys
- **Indexing strategy:** Composite indexes on (status, created_at) for worklist queries

### 3.2 Key Table Relationships

```
users (1) ────────────── (N) loan_applications
                               │
                    ┌──────────┼──────────────────────┐
                    │          │                      │
               kyc_records   documents          bureau_pull_jobs
                    │
               decision_results
                    │
               loans ────── disbursements
                    │
               emi_schedule
                    │
               payment_transactions
```

### 3.3 Partition Strategy

```sql
-- loan_applications partitioned monthly
CREATE TABLE loan_applications (
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE loan_applications_2024_07
PARTITION OF loan_applications
FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

-- audit_logs partitioned monthly, archived after 90 days to cold storage
CREATE TABLE audit_logs (
  ...
) PARTITION BY RANGE (timestamp);
```

---

## 4. Integration Architecture

### 4.1 UIDAI Aadhaar eKYC

**Endpoint:** `https://developer.uidai.gov.in/uidregistration/otp` (prod: AUA-specific URL)
**Protocol:** REST over HTTPS with mutual TLS
**Auth:** AUA code + ASA channel key
**Encryption:** Aadhaar + OTP encrypted with UIDAI session key (AES-256) wrapped with UIDAI public key (RSA-2048)

### 4.2 Credit Bureaus

| Bureau | Protocol | Endpoint Type | Avg Latency | Timeout |
|---|---|---|---|---|
| CIBIL TransUnion | REST/JSON | Synchronous | 8-12s | 30s |
| Experian | REST/JSON | Synchronous | 6-10s | 30s |
| Equifax | SOAP/XML | Synchronous | 10-15s | 30s |
| CRIF High Mark | REST/JSON | Synchronous | 5-8s | 30s |

**Parallel pull:** All bureaus pulled in parallel via Promise.allSettled(). Partial success (≥1 success) is acceptable.

### 4.3 CBS Integration (Finacle SOAP)

```
LOS Integration Service
    │
    ├── soap.createClient(wsdl_url) → soapClient
    ├── soapClient.CustomerService.createCustomer(req) → CIF
    ├── soapClient.LoanService.createLoanAccount(req) → Account Number
    └── soapClient.PaymentService.initiatePayment(req) → UTR
```

**WSDL cached** locally; refreshed nightly. CBS test environment available Monday-Friday 9am-6pm only (production constraint).

### 4.4 NPCI Payment Rails

| Mode | Max Amount | Cutoff Times | Latency |
|---|---|---|---|
| IMPS | ₹5L per txn | 24×7 | 30 sec |
| NEFT | No limit | Hourly batches (8am-7pm) | Up to 2 hours |
| RTGS | Min ₹2L | 8am-4:30pm (business days) | 30 min |
| UPI | ₹1L per txn | 24×7 | 10 sec |

**Disbursement routing logic:**
```
amount < 1L AND 24x7 → IMPS
amount >= 2L AND business hours → RTGS
amount between 1L-2L → NEFT (if business hours) else IMPS
```

---

## 5. Sequence Diagrams

### 5.1 Aadhaar eKYC Flow

```
Applicant    KYC-SVC    Integration-SVC    UIDAI      App-SVC    Kafka
    │            │              │              │          │          │
    │──initKYC──►│              │              │          │          │
    │            │──encryptAadhaar            │          │          │
    │            │──POST /otp──►│──────────────►         │          │
    │            │              │◄── txnId ────│          │          │
    │◄──sessionId┤              │              │          │          │
    │            │              │              │          │          │
    │──submitOTP─►              │              │          │          │
    │            │──POST /verify►──────────────►         │          │
    │            │              │◄── kycXML ───│          │          │
    │            │──validateSig─►              │          │          │
    │            │──storeMasked─►              │          │          │
    │            │──────────────────────────────────────publish(kyc.complete)
    │            │              │              │          │◄─consume─│
    │◄──KYC OK──┤              │              │          │          │
```

### 5.2 Decision Engine Flow

```
App-SVC    Decision-SVC    Bureau-SVC    ML-Model    CBS-SVC
    │            │              │              │          │
    │──triggerDec►             │              │          │
    │            │──getReport──►              │          │
    │            │◄── report ───│              │          │
    │            │──evalRules───────────────  │          │
    │            │──runScorecard────────────►│          │
    │            │◄─── PD + score ───────────│          │
    │            │──aggregate decision        │          │
    │            │──publish(decision.complete)│          │
    │            │──────────────────────────────────────►│ (if approved)
    │            │              │              │          │ createAccount
    │◄──decision─┤              │              │          │
```

---

## 6. Security Architecture

### 6.1 Zero Trust Networking
- All inter-service communication via mTLS (Istio service mesh)
- No service can call another without valid service certificate
- Network policies: whitelist-only ingress/egress per service

### 6.2 Data Encryption Strategy
- **In transit:** TLS 1.3 externally; mTLS internally
- **At rest:** AES-256-GCM for documents (MinIO SSE-KMS)
- **Database:** pgcrypto for PAN, mobile; transparent encryption via EBS/disk encryption
- **Secrets:** HashiCorp Vault; dynamic DB credentials rotated every 24 hours
- **Application-level:** Aadhaar photo — AES-256 with KMS key, accessible only via authorized service account

### 6.3 API Security
- JWT validation at Kong gateway (public key from Vault)
- Rate limiting: 100 req/min per user, 1000 req/min per IP
- WAF: AWS WAF (OWASP Core Rule Set + custom LOS rules)
- Input validation: class-validator on all DTOs; parameterized queries only

---

## 7. Observability

### 7.1 Metrics (Prometheus)
- `los_application_created_total{loan_type, channel}` — Counter
- `los_kyc_duration_seconds{provider, status}` — Histogram
- `los_bureau_pull_duration_seconds{provider}` — Histogram
- `los_decision_duration_seconds{decision}` — Histogram
- `los_payment_amount_total{mode, status}` — Counter/Sum

### 7.2 Distributed Tracing (Jaeger)
- All services instrumented with OpenTelemetry SDK
- Trace propagated via `traceparent` header (W3C standard)
- Traces sampled at 10% (100% for errors)

### 7.3 Log Format (Structured JSON)
```json
{
  "timestamp": "2024-07-15T10:30:00.000Z",
  "level": "INFO",
  "service": "kyc-service",
  "traceId": "abc123",
  "spanId": "def456",
  "requestId": "uuid-v4",
  "userId": "uuid-v4",
  "applicationId": "uuid-v4",
  "event": "AADHAAR_KYC_SUCCESS",
  "duration_ms": 2340,
  "maskedAadhaar": "XXXX-XXXX-4321"
}
```

---
*End of TDD v1.0*
