# Local Environment Setup — Implementation Plan
## LOS Platform: Mock Services, Test Data & Open Issue Fixes

> **Goal:** A fully functional local dev environment where the entire loan origination
> flow can be exercised end-to-end using mock external APIs and realistic test data.
> No real credentials needed. One command to start everything.

---

## User Review Required

> [!IMPORTANT]
> This plan creates **one new Docker service** (`mock-server` on port 8080) that intercepts
> all 7 external API groups. It uses [WireMock](https://wiremock.org/) (Java-based, free,
> battle-tested for enterprise mocking). If you prefer a Node.js mock instead, let me know
> and I'll swap it for `json-server` + custom express handlers.

> [!WARNING]
> The JWT key fix (ISSUE-007) generates a real RSA key pair and writes it to
> `backend/keys/` (already in `.gitignore`). This is the correct approach for local dev.
> **Never commit the `.pem` files.**

> [!CAUTION]
> **Windows note:** The startup script (`scripts/local-setup.sh`) requires Git Bash or WSL.
> A `scripts/local-setup.ps1` PowerShell version will also be created for native Windows use.

---

## What Will Be Built

### 1. External API Mock Server (`devops/docker/mock-server/`)
A single WireMock container replacing all 7 external API groups:

| External API | Endpoints Mocked | Mock Port |
|---|---|---|
| UIDAI Aadhaar OTP init | `POST /uid/otp` | 8080 |
| UIDAI Aadhaar OTP verify | `POST /uid/verify` | 8080 |
| NSDL PAN verification | `POST /tin/pan` | 8080 |
| CIBIL bureau report | `POST /bureau/cibil/report` | 8080 |
| Experian bureau report | `POST /bureau/experian/report` | 8080 |
| CRIF + Equifax | `POST /bureau/*/report` | 8080 |
| NPCI NACH mandate | `POST /npci/nach/mandate` | 8080 |
| NPCI IMPS disburse | `POST /npci/imps/transfer` | 8080 |
| CBS (Finacle) SOAP | `POST /cbs/*` | 8080 |
| NSDL eSign initiate | `POST /esign/initiate` | 8080 |
| NSDL eSign verify OTP | `POST /esign/verify` | 8080 |
| Kaleyra SMS OTP | `POST /sms/send` | 8080 |
| Karza OCR (salary slip) | `POST /ocr/salary` | 8080 |
| Karza OCR (bank statement) | `POST /ocr/bank` | 8080 |
| Face match | `POST /facematch/verify` | 8080 |

### 2. Comprehensive Seed Data (`database/seeds/`)
New files covering realistic test scenarios:

| File | Content |
|---|---|
| `01_seed_users.sql` | 5 bank staff users (officer, analyst, manager, compliance, admin) |
| `02_seed_loan_applications.sql` | 15 loan applications in different states (DRAFT→DISBURSED) |
| `03_seed_kyc_records.sql` | KYC records for all 15 applicants |
| `04_seed_bureau_reports.sql` | Bureau reports with varied credit scores (550–820) |
| `05_seed_decision_results.sql` | Decision outcomes (APPROVED, REJECTED, CONDITIONALLY_APPROVED) |
| `06_seed_documents.sql` | Document records with MinIO reference paths |
| `07_seed_dsa_partners.sql` | 3 DSA partners + 5 officers + commission records |
| `08_seed_disbursements.sql` | 5 disbursement records with IMPS UTR numbers |
| `09_seed_audit_logs.sql` | 20+ audit log entries for the compliance viewer |

### 3. JWT Key Fix (ISSUE-007)
- Generate RSA-2048 key pair into `backend/keys/` (gitignored)
- Patch `docker-compose.yml` to mount and load the key
- Patch `backend/.env` to reference the key file

### 4. `docker-compose.local.yml` (extension file)
- Adds `mock-server` service
- Adds `kafka-ui` (Redpanda Console) for event inspection
- Adds `mailhog` for email notification capture
- Overrides URL env vars in all services to point to mock server

### 5. Startup Scripts
- `scripts/local-setup.sh` — Bash (Git Bash/WSL on Windows)
- `scripts/local-setup.ps1` — PowerShell native Windows

### 6. Fix: Remaining Open Issues
- **ISSUE-007:** JWT private key → generated RSA-2048 key, mounted in Docker
- **ISSUE-004:** NPCI NACH → pointing to mock server URL in docker-compose
- **ISSUE-006:** SMS DLT → mock server returns success for all SMS sends
- **BUG-004 (infra side):** `auth-service` now reads JWT key from mounted file, not ephemeral

---

## Proposed Changes

### Component 1: Mock Server

#### [NEW] `devops/docker/mock-server/docker-compose.local.yml`
Extension compose file; add `mock-server`, `kafka-ui`, `mailhog`.

#### [NEW] `devops/docker/mock-server/mappings/uidai.json`
WireMock stub: UIDAI OTP init/verify – returns signed XML-like success response.

#### [NEW] `devops/docker/mock-server/mappings/bureau.json`
WireMock stub: CIBIL, Experian, Equifax, CRIF – 4 mock applicant personas (score 720, 650, 580, 820).

#### [NEW] `devops/docker/mock-server/mappings/npci.json`
WireMock stub: NACH mandate registration, IMPS transfer, penny drop verification.

#### [NEW] `devops/docker/mock-server/mappings/cbs.json`
WireMock stub: Finacle SOAP customer creation, loan account creation.

#### [NEW] `devops/docker/mock-server/mappings/nsdl.json`
WireMock stub: PAN verification, eSign initiate/verify OTP.

#### [NEW] `devops/docker/mock-server/mappings/notifications.json`
WireMock stub: Kaleyra SMS, Gupshup WhatsApp – always returns 200 OK.

#### [NEW] `devops/docker/mock-server/mappings/ocr.json`
WireMock stub: Karza salary slip OCR, bank statement OCR, face match.

---

### Component 2: Seed Data

#### [NEW] `database/seeds/01_seed_users.sql`
5 users in `los_auth.users` — bank staff with hashed mobile numbers.

#### [NEW] `database/seeds/02_seed_loan_applications.sql`
15 loan applications in `los_loan.loan_applications` spanning all lifecycle stages.

#### [NEW] `database/seeds/03_seed_kyc_records.sql`
KYC & bureau consent records for all 15 applicants.

#### [NEW] `database/seeds/04_seed_bureau_reports.sql`
4 CIBIL bureau reports with different score profiles.

#### [NEW] `database/seeds/05_seed_decision_results.sql`
Decision outcomes + rule evaluation results.

#### [NEW] `database/seeds/06_seed_documents.sql`
Document metadata with mock MinIO paths.

#### [NEW] `database/seeds/07_seed_dsa.sql`
3 DSA partners + 5 officers + 10 commission records.

#### [NEW] `database/seeds/08_seed_disbursements.sql`
5 completed disbursements with mock UTR numbers.

#### [NEW] `database/seeds/09_seed_audit_logs.sql`
20 audit log entries for compliance viewer testing.

#### [MODIFY] `database/seeds/seed-runner.sh`
New shell script to run all seed files in order.

---

### Component 3: JWT Fix

#### [NEW] `scripts/gen-jwt-keys.sh`
Bash script: `openssl genrsa` → `backend/keys/jwt-private.pem`, `jwt-public.pem`.

#### [NEW] `scripts/gen-jwt-keys.ps1`
PowerShell version for Windows without Git Bash.

#### [MODIFY] `devops/docker/docker-compose.yml`
Mount `backend/keys/` volume into `auth-service`. Set `JWT_PRIVATE_KEY_FILE` env var.

---

### Component 4: Local Startup Scripts

#### [NEW] `scripts/local-setup.sh`
Full setup: generate keys → `docker-compose up` → wait for healthy → run migrations → run seeds → print URLs.

#### [NEW] `scripts/local-setup.ps1`
Same flow for PowerShell/Windows.

---

## Open Questions

> [!IMPORTANT]
> **Mock server choice:** WireMock (Java container, ~150MB) vs a lightweight Node.js
> express mock (team builds and owns). WireMock requires no code; Node mock requires more
> code but is more flexible. Which do you prefer?

> [!IMPORTANT]
> **Test OTP behavior:** For local testing, should OTP always be `123456` (simplest)
> or should the actual Redis OTP still be read (but SMS goes to mock/MailHog)? Suggest: `123456` fixed.

---

## Verification Plan

### Automated Tests
```bash
# 1. Start full stack
bash scripts/local-setup.sh

# 2. Verify all services healthy
curl http://localhost:8000/auth/health   # auth
curl http://localhost:8000/kyc/health    # kyc
curl http://localhost:8000/decisions/health  # decision-engine

# 3. Run E2E flow (Playwright)
cd frontend && npx playwright test

# 4. Test mock server directly
curl -X POST http://localhost:8080/bureau/cibil/report \
  -H 'Content-Type: application/json' \
  -d '{"pan":"ABCDE1234F"}' | jq .

# 5. Run seed data verification
psql -h localhost -U los_user -d los_loan \
  -c "SELECT status, count(*) FROM los_loan.loan_applications GROUP BY status"
```

### Manual Verification
- Login with test mobile: `9999999991` → OTP `123456`
- Submit a personal loan application → verify it goes through SUBMITTED state
- Run KYC (mocked UIDAI) → verify KYC_COMPLETE
- Bureau pull → verify APPROVED decision
- Manager sanction → verify API call goes to loan-service
- Check Kafka events in kafka-ui at `http://localhost:8090`
- Check email notifications in MailHog at `http://localhost:8025`
