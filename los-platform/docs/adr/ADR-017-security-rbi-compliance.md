# ADR-017: Security & RBI Compliance

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform processes sensitive personal and financial data subject to:
- **RBI Master Direction on Digital Lending** (2022): data collection consent, secure transmission, data minimization
- **RBI IT Governance guidelines**: audit trails, access controls, incident response
- **Information Technology Act, 2000**: data protection, cyber security
- **GST/Income Tax Act**: PAN data handling, encryption requirements
- **Aadhaar Act, 2016**: UIDAI data — no storage of Aadhaar numbers, masked display only

The bank requires: data encryption at rest and in transit, access control, audit logging, consent capture, and compliance reporting.

---

## Decision

### Data Encryption

| Layer | Technology | Scope |
|-------|-----------|-------|
| TLS 1.2/1.3 | K8s Ingress + cert-manager | All external traffic |
| TLS between services | mTLS via Istio (future) | Inter-service communication |
| PostgreSQL encryption | AES-256 (DB engine) | Sensitive fields: PAN, Aadhaar, OTP hash |
| MinIO encryption | SSE-S3 / MinIO server-side | All stored documents |
| Redis TLS | STARTTLS | If Redis auth enabled |
| Secret storage | Kubernetes Secrets | DB passwords, API keys |

**Sensitive field encryption**: PAN and Aadhaar numbers are stored encrypted (`encryptField()` utility using AES-256-GCM) in dedicated columns, with SHA-256 hash stored separately for lookups.

### Access Control

| Mechanism | Implementation |
|-----------|----------------|
| Authentication | JWT (bank employees), OTP (customers), DSA JWT (DSA portal) |
| Authorization | Role-based: `RolesGuard` + `@Roles('ADMIN')` decorator |
| Scopes | Fine-grained: `application:*`, `decision:trigger`, `disbursement:maker` |
| Network policy | K8s `NetworkPolicy`: services only communicate with required peers |
| DSA isolation | Separate service, separate DB, separate JWT secret |

### Aadhaar Data Handling

- **No Aadhaar storage**: only hashed Aadhaar (`e(":sha256(aadhaar + salt)"))`) stored for bureau consent
- **UIDAI API**: KYC done via UIDAI's eKYC API (no raw Aadhaar stored)
- **Offline XML**: XML processed, PII extracted, XML discarded
- **Display**: only masked Aadhaar shown in UI (`XXXX-XXXX-1234`)

### Consent Capture

- Every bureau pull requires explicit OTP-verified consent (`POST /integration/bureau/consent`)
- Every KYC verification captures consent with IP address, user-agent, timestamp
- Consent records stored with 8-year retention (regulatory requirement)
- Consent withdrawal supported (updates `consent_records` table)

### Audit Logging

All sensitive operations logged via `AuditService` (`backend/common/src/audit/`):
- `KYC_INITIATE`, `KYC_VERIFY`, `KYC_OFFLINE_XML`
- `APPLICATION_CREATED`, `APPLICATION_SUBMITTED`, `STATUS_CHANGE`
- `DOCUMENT_UPLOAD`, `DOCUMENT_REVIEW`, `DOCUMENT_DELETE`
- `DECISION_TRIGGER`, `OVERRIDE_REQUEST`, `OVERRIDE_APPROVE`
- `DISBURSEMENT_INITIATED`, `PAYMENT_SUCCESS`
- `LOGIN`, `LOGOUT`, `AUTH_FAILURE`

Each audit log entry: `userId`, `role`, `action`, `resourceType`, `resourceId`, `ipAddress`, `userAgent`, `requestId` (from trace), `timestamp`, `details` (JSON).

### Security Controls

| Control | Implementation |
|---------|---------------|
| Rate limiting | Redis counters: OTP 10/hour, API 100/minute |
| Input validation | `ValidationPipe` (whitelist, forbidNonWhitelisted) on all endpoints |
| SQL injection | TypeORM parameterized queries (no raw SQL) |
| XSS | NestJS Helmet middleware, Content-Security-Policy headers |
| CSRF | SameSite=Strict on JWT cookies, CSRF token for state-changing GET |
| Secrets rotation | K8s secret auto-rotation via external-secrets operator |
| Dependency scanning | `npm audit` in CI pipeline |
| Container scanning | Trivy in CI before pushing to ECR |

---

## Consequences

### Positive
- **RBI compliance**: consent capture, audit logging, data encryption satisfy regulatory requirements
- **Aadhaar Act compliance**: no raw Aadhaar stored
- **Defense in depth**: multiple security layers (network, transport, application)
- **Full audit trail**: every action attributable to a user + timestamp
- **Incident response**: trace ID + audit log enables forensic analysis

### Negative
- **Performance overhead**: TLS, encryption, audit logging add latency
- **Operational complexity**: secret rotation, certificate management
- **Compliance cost**: annual audit by external auditor
- **Data residency**: multi-region deployment may be required by some state regulations

### Mitigations
- TLS termination at K8s ingress (services behind cluster network)
- Async audit logging (don't block request for audit write)
- Audit log retention: 8 years (cold storage after 1 year)
- External auditor engagement before go-live

---

## Related Decisions

- ADR-004: JWT + OTP Authentication
- ADR-001: Microservices Architecture
- ADR-002: Database per Service Pattern
