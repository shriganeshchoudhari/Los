# ADR-004: JWT + OTP Authentication

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform serves multiple user types: Bank employees (loan officers, branch managers, credit analysts, compliance officers), Customers (loan applicants via OTP), DSA partners and officers (channel partners). The bank requires strong authentication for regulatory compliance (RBI guidelines on digital lending), and the system must support self-service onboarding without pre-registered credentials.

---

## Decision

**Two-tier authentication model:**

### 1. Customer / Applicant: OTP-based (passwordless)
- `POST /auth/otp/send` → generates 6-digit OTP, stores hashed in DB with 5-minute expiry
- `POST /auth/otp/verify` → validates OTP, issues JWT access token (15min) + refresh token (7 days)
- OTP is a cryptographic hash (bcrypt) stored in `otp_sessions` table
- Rate limited: 10 OTP requests per mobile per hour, max 3 failed verifications per session
- Sessions are single-use: once verified, the OTP session is marked `is_used = true`
- **Purpose enum**: `LOGIN`, `AADHAAR_CONSENT`, `LOAN_APPLICATION_SUBMIT`, `DISBURSEMENT_CONFIRM`, `PASSWORD_RESET`

### 2. Bank Employees: LDAP + JWT
- `POST /auth/login` → authenticates against LDAP, issues JWT
- JWT contains: `userId`, `role`, `branchCode`, `scope[]`
- JWT signed with RS256 (asymmetric), JWKS endpoint exposed for token validation by other services
- Scopes: `application:*`, `decision:*`, `disbursement:maker`, `disbursement:checker`, `branch:*`, etc.
- Roles: `ADMIN`, `BRANCH_MANAGER`, `CREDIT_ANALYST`, `LOAN_OFFICER`, `VIEWER`, `ZONAL_CREDIT_HEAD`, `COMPLIANCE_OFFICER`

### 3. DSA Portal: Separate JWT namespace
- DSA partners/officers use a separate JWT (`dsa_access_token` / `dsa_refresh_token` cookies)
- Different JWT secret (`DSA_JWT_SECRET`) to isolate from bank portal tokens
- Role: `DSA_PARTNER`, `DSA_OFFICER` — cannot access bank portal endpoints

### Shared: Refresh token rotation
- Refresh tokens are stored in `refresh_tokens` table with `revokedAt` timestamp
- On `/auth/refresh`: old token is revoked, new pair issued (rotation)
- On `/auth/logout`: all refresh tokens for the user are revoked

---

## Consequences

### Positive
- **Passwordless for customers**: eliminates credential storage risk for applicants
- **Scope-based RBAC**: fine-grained permissions per endpoint
- **Auditability**: all auth events (login, logout, refresh) are logged with IP/user-agent
- **LDAP integration**: bank employees use existing corporate credentials
- **DSA isolation**: separate token namespace prevents cross-portal access

### Negative
- **OTP delivery risk**: SMS delivery failures affect login UX
- **LDAP dependency**: auth-service unavailable = no bank employee login
- **JWT secret management**: requires secure secret rotation process
- **OTP brute force**: despite rate limiting, 6-digit OTP has 1M combinations

### Mitigations
- OTP hashed with bcrypt (cost factor 10) — not reversible
- Rate limiting via Redis counters with TTL
- LDAP health check in readiness probe
- JWT RS256 allows key rotation without breaking existing tokens

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-006: TypeORM as ORM
