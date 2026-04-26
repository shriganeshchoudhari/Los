# Backend Java — Implementation Reference

**Stack:** Spring Boot 3.5 · Java 21 · Maven · PostgreSQL (`los_platform`) · Redis · Kafka · MinIO  
**Entry point:** `com.los.LosApplication` — `@SpringBootApplication @EnableScheduling`  
**Server port:** `8082` (application.yml — **not** 8080; update every config that references 8080)  
**Context path:** `/` (no prefix)  
**Swagger UI:** `http://localhost:8082/swagger-ui.html`  
**Actuator:** `http://localhost:8082/actuator/health`  
**Build:** `mvn package -DskipTests` → `target/los-platform-1.0.0.jar`  
**Last verified:** April 21, 2026

---

## Module Status

| Module | Package | Route Prefix | Schema | Implementation status |
|--------|---------|-------------|--------|-----------------------|
| Auth | `com.los.auth` | `/api/auth/**` | `auth` | ✅ Complete |
| KYC | `com.los.kyc` | `/api/kyc/**` | `kyc` | ⚠️ Complete structure — UIDAI/NSDL calls are stubs |
| Loan | `com.los.loan` | `/api/applications/**` | `loan` | ⚠️ Complete structure — `status` is String not enum |
| Decision Engine | `com.los.decision` | `/api/decisions/**` | `decision` | ❌ Rule loop is a no-op — always returns APPROVED |
| Integration | `com.los.integration` | `/api/integration/**` | `integration` | ⚠️ Entities only — no real bureau/CBS/NPCI calls |
| Notification | `com.los.notification` | `/api/notifications/**` | `notification` | ⚠️ Complete structure — SMS/email are log-only stubs |
| DSA | `com.los.dsa` | `/api/dsa/**` | `dsa` | ✅ Complete |
| Document | `com.los.document` | `/api/documents/**` | `document` | ⚠️ S3 presigned URL works — OCR/watermark are stubs |
| Common | `com.los.common` | — | `shared` | ✅ Complete |

---

## Common Layer (`com.los.common`)

### `ApiResponse<T>`
Universal response wrapper returned by all endpoints:
```json
{ "success": true, "data": {}, "message": "...", "code": null, "timestamp": "2026-04-21T..." }
```
Factory methods: `ApiResponse.success(data, msg)` and `ApiResponse.error(code, msg)`.

### `LosException`
Domain exception with `code` (e.g. `AUTH_001`), `httpStatus`, `retryable`, `retryAfterSeconds`, `field`, `details`, `data`. Handled globally by `GlobalExceptionHandler` which maps it to the right HTTP status and `ApiResponse.error(...)`.

### `SecurityConfig`
- CSRF disabled, stateless session.
- **Public** (no JWT required): `/api/auth/otp/**`, `/api/auth/ldap/login`, `/api/auth/token/refresh`, `/api/auth/.well-known/jwks.json`, `/api-docs/**`, `/swagger-ui/**`, `/actuator/health`, `/actuator/info`, `/actuator/prometheus`.
- Everything else: JWT in `Authorization: Bearer` header **or** `access_token` cookie.
- CORS: allows `http://localhost:3000` and `http://localhost:3001`. Add production domain before go-live.

### `JwtTokenProvider`
RS256. Loads RSA key pair at startup via `@PostConstruct` from paths configured in `los.jwt.private-key-path` / `los.jwt.public-key-path` (defaults: `keys/private_key.pem`, `keys/public_key.pem` — relative to JVM working directory).

- Access token: 900 s (15 min). Claims: `sub` (userId), `role`, `sessionId`, `scope`, `jti`.
- Refresh token: 604800 s (7 days).
- `getPublicJwk()` returns RSA JWK for Kong's RS256 JWT plugin.

**⚠️ Key path is relative.** When running from `backend-java/` the path resolves correctly. In Docker the `Dockerfile` must `COPY keys/ /app/keys/` and set `WORKDIR /app`.

### `JwtAuthenticationFilter`
Once-per-request. Reads token from `Authorization: Bearer` or `access_token` cookie → calls `JwtTokenProvider.validateAndGetClaims()` → populates `SecurityContextHolder`.

### `BaseEntity` / `AuditableEntity`
`BaseEntity`: `id` (UUID String), `createdAt`, `updatedAt` (`@PrePersist`/`@PreUpdate`), `isDeleted`.  
`AuditableEntity` adds `createdBy`, `updatedBy`, `version` (optimistic lock).

---

## Auth Module

### Entities  (`auth` schema)
| Entity | Table | Key fields |
|--------|-------|------------|
| `User` | `auth.users` | `mobile`, `mobileHash` (SHA-256), `role` (enum), `status` (enum), `failedLoginAttempts`, `lockedUntil`, `branchCode`, `employeeId` |
| `OtpSession` | `auth.otp_sessions` | `mobileHash`, `otpHash` (bcrypt), `purpose`, `attempts`, `expiresAt`, `ipAddress` |
| `RefreshToken` | `auth.refresh_tokens` | `userId`, `tokenHash`, `deviceFingerprint`, `expiresAt`, `revoked` |

### Services
- **`OtpService`**: 6-digit OTP → bcrypt hash → Redis key `otp:{mobileHash}:{purpose}` TTL 300 s. Rate limits: 10/hr, 3 concurrent. Dispatches via `SmsSenderService` (stub — logs only; no real Kaleyra call).
- **`TokenService`**: Generates RS256 JWT pair. Stores refresh token hash in DB. Blacklists access JTI in Redis on revoke (key: `blacklist:{jti}`, TTL = remaining expiry).
- **`LdapAuthService`**: Binds to LDAP, fetches `cn`/`mail`/`employeeType`, maps to `UserRole`.
- **`AuthService`**: Orchestrates OTP verify → user upsert (creates `APPLICANT` role on first mobile login) → token generation.

### Endpoints

| Method | Path | Auth | Request body | Response |
|--------|------|------|-------------|----------|
| POST | `/api/auth/otp/send` | Public | `{ mobile, purpose, channel }` | `{ data: { sessionId, expiresIn } }` |
| POST | `/api/auth/otp/verify` | Public | `{ sessionId, mobile, otp }` | `{ data: LoginResponseDto }` |
| POST | `/api/auth/ldap/login` | Public | `{ username, password }` | `{ data: LoginResponseDto }` |
| POST | `/api/auth/token/refresh` | Public | `{ refreshToken }` | `{ data: LoginResponseDto }` |
| POST | `/api/auth/logout` | JWT | Cookie or `{ tokenOrJti }` | `{ success: true }` |
| POST | `/api/auth/revoke` | JWT | `{ tokenOrJti, reason }` | `{ success: true }` |
| POST | `/api/auth/sessions/revoke-all` | JWT | `{ userId, exceptSessionId }` | `{ success: true }` |
| GET | `/api/auth/profile` | JWT | — | `{ data: { userId, name, mobile, email, role } }` |
| GET | `/api/auth/.well-known/jwks.json` | Public | — | `{ keys: [ JWK ] }` |

`LoginResponseDto`: `{ accessToken, refreshToken, expiresIn, user: { userId, name, role } }`

### Known Issues
- `UserRole.APPLICANT` assigned automatically on mobile OTP login. Employee roles must be set by admin or LDAP attribute mapping.
- `User.mobile` stored in plain text alongside `mobileHash`. Ensure plain mobile is never logged.

---

## KYC Module

### Entities  (`kyc` schema)
| Entity | Key fields |
|--------|------------|
| `KycRecord` | `applicationId`, `userId`, `status` (enum 8 states), `overallRiskScore` |
| `AadhaarKycResult` | `kycId`, `aadhaarNumberHash` (**SHA-256 only**), `name`, `dob`, `gender`, `signatureValid`, `verifiedAt` |
| `PanVerificationResult` | `kycId`, `panNumberMasked`, `panNumberEncrypted` (JSONB), `nameMatchScore`, `panStatus` |
| `FaceMatchResult` | `kycId`, `matchScore`, `livenessScore`, `faceMatchStatus`, `provider` |
| `ConsentRecord` | `applicationId`, `userId`, `consentType`, `ipAddress`, `userAgent`, `grantedAt` |

KycRecord status flow: `NOT_STARTED` → `AADHAAR_OTP_SENT` → `AADHAAR_VERIFIED` → `PAN_VERIFIED` → `FACE_MATCH_PASSED` / `FACE_MATCH_FAILED` → `KYC_COMPLETE` / `KYC_FAILED`

### Service — `KycService` (critical stubs)
- `initiateAadhaarKyc()`: Sets status `AADHAAR_OTP_SENT`, returns hardcoded `txnId`/`uidaiRefId`. **No UIDAI AUA API call.**
- `verifyAadhaarOtp()`: Saves `AadhaarKycResult` with **hardcoded** name "John Doe" and DOB. **Must parse real UIDAI signed XML in production.**
- `hashAadhaar()`: Returns `"hash_" + aadhaar`. **NOT SHA-256. Fix before any data is stored.**
- `verifyPan()`: Character-position fuzzy match — not phonetic. Fails on common Indian name transliterations (e.g. "Ramesh" vs "Ramesh Kumar"). Replace with Apache Commons `JaroWinklerDistance`.
- `performFaceMatch()`: Hardcoded score 85. **No face-match vendor call.**

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/kyc/aadhaar/init` | Initiate Aadhaar eKYC |
| POST | `/api/kyc/aadhaar/verify` | Verify OTP |
| POST | `/api/kyc/pan/verify` | Verify PAN + name match |
| POST | `/api/kyc/face/match` | Face match |
| POST | `/api/kyc/face/liveness` | Liveness check |
| GET | `/api/kyc/status/{applicationId}` | KYC status |
| POST | `/api/kyc/complete/{applicationId}` | Mark KYC complete |
| POST | `/api/kyc/consent` | Capture consent |
| GET | `/api/kyc/consent/{applicationId}` | Get consents |

---

## Loan Module

### Entities  (`loan` schema)
| Entity | Key fields |
|--------|------------|
| `LoanApplication` | `applicationNumber` (`LA-{ms}` — should be `LOS-{YYYY}-{STATE}-{SEQ}`), `customerId`, `loanType`, `requestedAmount`, `tenureMonths`, `status` (**plain String**), `employmentType`, `annualIncome` |
| `LoanAgreement` | `applicationId`, `agreementNumber`, `agreementContent`, `signedAt`, `esignTransactionId` |
| `PddChecklist` | `applicationId`, `items` (JSONB), `status` |

### Services
- **`LoanApplicationService`**: CRUD + basic state transitions. `submitManagerDecision()` handles `APPROVED`/`APPROVE`/`CONDITIONALLY_APPROVED`/`REJECTED`. No FOIR calculation — `annualIncome` stored but unused.
- **`EmiCalculatorService`**: Amortization schedule generation (implemented).
- **`SanctionLetterService`**: PDF generation (Apache PDFBox — needs verification).
- **`LoanAgreementService`** + **`EsignService`**: NSDL eSign stub.
- **`PddService`**: PDD checklist management.

### Application Controller Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/applications` | Create application (status: `DRAFT`) |
| GET | `/api/applications` | Paginated list — `?page&limit&status` |
| GET | `/api/applications/{id}` | Get application |
| PATCH | `/api/applications/{id}` | Update (only allowed in `DRAFT`) |
| POST | `/api/applications/{id}/submit` | Submit (`DRAFT` → `SUBMITTED`) |
| PATCH | `/api/applications/{id}/decision` | Manager decision (APPROVE/REJECT/CONDITIONALLY_APPROVED) |
| GET | `/api/applications/{id}/history` | Stage history |
| POST | `/api/applications/{id}/assign` | Assign loan officer |
| PATCH | `/api/applications/{id}/autosave` | Auto-save draft |

### Other Loan Endpoints
- `GET /api/emi/calculate` — EMI calculation
- `GET /api/sanction-letter/{id}/preview` — Sanction letter preview
- `GET /api/sanction-letter/{id}/pdf` — Download PDF
- `POST /api/loan-agreement/generate` — Generate agreement
- `POST /api/loan-agreement/esign/initiate` — Start NSDL eSign
- `POST /api/loan-agreement/esign/verify` — Verify eSign OTP
- `GET /api/audit-logs` — Audit trail

### Known Issues
- `applicationNumber` uses `System.currentTimeMillis()` — PRD requires `LOS-{YYYY}-{STATE}-{SEQ}`.
- `status` is a plain `String` — risk of invalid values. Convert to enum with state-machine validator.
- `submitManagerDecision()` accepts legacy `"APPROVE"` alias as well as `"APPROVED"` — keep for frontend compatibility.
- No FOIR is calculated or enforced in the service layer.

---

## Decision Engine Module

### Entities  (`decision` schema)
| Entity | Key fields |
|--------|------------|
| `Decision` | `applicationId`, `status` (enum), `decisionType` (enum), `finalDecision`, `approvedAmount`, `interestRateBps`, `foirActual`, `ltvRatio`, `conditions`, `rejectionReason`, `decidedAt`, `decidedBy` |
| `DecisionRule` | `ruleCode`, `ruleName`, `priority`, `isActive`, `productType`, `ruleVersion`, `ruleDefinition` (JSONB) |
| `DecisionHistory` | Immutable audit trail of status changes |

### Service — `DecisionEngineService` (CRITICAL GAP)
`triggerDecision()` loads all `DecisionRule` rows, calls `evaluateRules(decision)` which contains only `log.debug(...)` with no actual evaluation, then **unconditionally sets status = `APPROVED`**.

Every application will be approved. This is the highest-priority functional gap.

**What needs to be implemented:**
1. Fetch `LoanApplication` + `BureauScore` + applicant data for the given `applicationId`.
2. Parse each `DecisionRule.ruleDefinition` JSONB (contains field path, operator, threshold).
3. Evaluate all rules; collect failures with reason codes.
4. If any hard-stop rule fails → `REJECTED` with `rejectionReason`.
5. If all rules pass → `APPROVED` with computed `approvedAmount`, `interestRateBps`, `foirActual`.
6. Record decision in DB + publish Kafka event `los.decision.completed`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/decisions/trigger` | Run decision engine |
| GET | `/api/decisions/{applicationId}` | Get decision |
| POST | `/api/decisions/override` | Manual override |
| POST | `/api/decisions/override/request` | Request override (maker) |
| GET | `/api/decisions/rules` | List active rules |
| GET | `/api/decisions/status/{status}` | Filter by status |
| GET | `/api/decisions/{applicationId}/history` | Full audit trail |

---

## Integration Module

### Entities  (`integration` schema)
| Entity | Key fields |
|--------|------------|
| `BureauScore` | `applicationId`, `provider` (CIBIL/EXPERIAN/EQUIFAX/CRIF), `status`, `creditScore`, `panHash` |
| `NachMandate` | `applicationId`, `umrn`, `bankAccount`, `ifsc`, `amount`, `status` |
| `DisbursementRecord` | `applicationId`, `loanId`, `amount`, `paymentMode`, `utr`, `status` |
| `OnusCheck` | AML/sanctions check record |

### Services (all external calls are stubs)
- **`BureauIntegrationService.pullBureauData()`**: Creates `BureauScore` row with status `IN_PROGRESS` and returns. **No HTTP call to CIBIL/Experian.** Real implementation must add `@CircuitBreaker(name="cibil")` + REST client.
- **`DisbursementService`**: Creates `DisbursementRecord`. No NPCI/IMPS call.
- **`NachService`**: Creates `NachMandate`. No NPCI call.
- **`OnusService`**: AML check stub.

Resilience4j config exists in `application-dev.yml` for `uidai`, `nsdl`, `cibil`, `bureau` — but `@CircuitBreaker` annotations are not yet applied to any method.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integration/bureau/pull` | Pull bureau score |
| GET | `/api/integration/bureau/{applicationId}` | Get bureau scores |
| POST | `/api/integration/onus/check` | AML/sanctions check |
| POST | `/api/integration/nach/create` | Create NACH mandate |
| POST | `/api/integration/disburse` | Trigger disbursement |
| GET | `/api/integration/disburse/{loanId}` | List disbursements |

---

## Notification Module

### Entities  (`notification` schema)
| Entity | Key fields |
|--------|------------|
| `Notification` | `recipientId`, `mobile`, `email`, `channel` (enum), `status` (enum), `title`, `message`, `templateId`, `sentAt` |
| `NotificationTemplate` | `templateName`, `channel`, `titleTemplate`, `messageTemplate`, `variables` (JSONB), `isActive` |
| `MessageLog` | Raw provider response |

### Service
`sendNotification()` dispatches to `SmsSenderService` or `EmailSenderService`. Both **log the message and return — no actual HTTP call to Kaleyra or SMTP**. Template CRUD is fully functional.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notifications/send` | Send notification |
| GET | `/api/notifications/status/{id}` | Get delivery status |
| POST | `/api/notifications/template` | Create template |
| GET | `/api/notifications/templates` | List templates |
| GET | `/api/notifications/history/{recipientId}` | History |

---

## DSA Module

### Entities  (`dsa` schema)
`DsaPartner` (partnerCode, companyName, status, commissionRate), `PartnerProfile`, `ResourceMapping`, `DealActivity`.

### Services
`DsaAuthService` (partner JWT), `ResourceService` (officer assignments), `ActivityTrackingService`, `PartnerReportService`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dsa/auth/login` | Partner login |
| GET | `/api/dsa/dashboard/{partnerId}` | Dashboard |
| POST | `/api/dsa/resources/assign` | Assign officers |
| GET | `/api/dsa/resources/{partnerId}` | Resources |
| GET | `/api/dsa/activities/{partnerId}` | Activity log |
| GET | `/api/dsa/reports/{partnerId}` | Performance report |
| GET | `/api/dsa/stats/{partnerId}` | Statistics |

---

## Document Module

### Entities  (`document` schema)
| Entity | Key fields |
|--------|------------|
| `Document` | `applicationId`, `documentType` (enum, 13 types), `s3Key`, `mimeType`, `fileSize`, `status` (enum), `verifiedBy`, `verificationRemarks` |
| `DocumentMetadata` | OCR extraction results |
| `SigningLog` | `signingRequestId`, `signerName`, `status`, `signedAt` |

### Services
- `S3Service`: **Functional** — uses MinIO Java SDK to generate presigned URLs.
- `OcrService`: **Stub** — returns empty `OcrResponseDto`. Must call Karza/Signzy.
- `PdfWatermarkingService`: **Stub** — logs only. Must use Apache PDFBox.
- `DocumentSigningService`: **Stub** — eSign initiation logs only.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/documents/presigned-url` | Get MinIO presigned upload URL |
| GET | `/api/documents/{id}` | Get document |
| GET | `/api/documents/{id}/ocr` | OCR result (**endpoint missing — only POST /ocr exists**) |
| POST | `/api/documents/{id}/watermark` | Apply watermark |
| GET | `/api/documents/signing-status/{id}` | eSign status |
| GET | `/api/documents/application/{appId}` | List by application |
| POST | `/api/documents/{id}/approve` | Approve document |
| POST | `/api/documents/{id}/reject` | Reject document |

---

## Database

- **DB:** `los_platform` (single PostgreSQL database, 9 schemas)
- **Dev:** `localhost:5433`, user `los_user`, password `los_password`
- **Default (prod template):** `localhost:5432`, user `postgres`, password `postgres`
- **Pool:** HikariCP max 20 / min 5

Flyway runs automatically on startup. Migrations V001–V017 are present and verified.  
`ddl-auto: none` — schema changes must go through Flyway scripts.

---

## Configuration Reference

| Property | Dev default | Description |
|----------|------------|-------------|
| `server.port` | **8082** | HTTP port |
| `los.jwt.private-key-path` | `keys/private_key.pem` | RSA private key (relative path) |
| `los.jwt.public-key-path` | `keys/public_key.pem` | RSA public key |
| `los.jwt.access-token-expiry` | `900` | Seconds |
| `los.jwt.refresh-token-expiry` | `604800` | Seconds (7 days) |
| `los.otp.ttl-seconds` | `300` | OTP validity |
| `los.otp.max-attempts` | `3` | Before account lock |
| `los.otp.max-per-hour` | `10` | Rate limit |
| `los.minio.endpoint` | `localhost` | MinIO hostname |
| `los.minio.port` | `9000` | MinIO port |
| `los.minio.bucket` | `los-documents` | Document bucket |
| `los.kyc.uidai.base-url` | `https://www.uidai.gov.in` | UIDAI AUA API base |
| `los.kyc.nsdl.base-url` | NSDL sandbox | PAN verification |
| `los.encryption.master-key` | `default-key-replace-in-prod-32chars!` | AES-256 master key |

---

## Build & Run

```bash
# 1. Generate JWT keys (one-time)
cd los-platform/scripts
bash gen-jwt-keys.sh          # Linux/Mac
.\gen-jwt-keys.ps1             # Windows PowerShell

# 2. Start infrastructure
cd los-platform/devops/docker
docker compose up -d postgres redis kafka minio

# 3. Build
cd los-platform/backend-java
mvn package -DskipTests

# 4a. Run with Maven
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 4b. Or run the JAR
java -jar target/los-platform-1.0.0.jar --spring.profiles.active=dev
```

**Working directory must be `backend-java/`** so `keys/private_key.pem` resolves correctly.

---

## Critical Issues — Fix Before Any Integration Testing

| Priority | Issue | File | Fix |
|----------|-------|------|-----|
| 🔴 P0 | Port is `8082` but README/Docker/frontend reference `8080` | `application.yml` | Either change to `8080` or update all other references |
| 🔴 P0 | `hashAadhaar()` returns `"hash_" + aadhaar` — not SHA-256 | `KycService.java` | `MessageDigest.getInstance("SHA-256")` + Base64 encode |
| 🔴 P0 | Decision rule evaluation is a no-op — all apps approved | `DecisionEngineService.java` | Implement rule condition evaluator against `LoanApplication` + `BureauScore` data |
| 🔴 P0 | Bureau API calls create DB record only — no HTTP call | `BureauIntegrationService.java` | Add `RestTemplate`/`WebClient` call to WireMock or real API; add `@CircuitBreaker` |
| 🟡 P1 | `docker-compose.yml` still references NestJS services | `devops/docker/docker-compose.yml` | Rewrite for single Spring Boot JAR |
| 🟡 P1 | No `mvn test` has been run — bean wiring untested | — | Run `mvn test` and fix Lombok/proxy errors |
| 🟡 P1 | OCR endpoint mismatch: frontend calls `GET /documents/{id}/ocr` | `DocumentController.java` | Add `GET` mapping; currently only `POST /documents/ocr` exists |
| 🟡 P1 | SSE endpoint missing: frontend hook targets `/applications/{id}/events` | `LoanApplicationController.java` | Add `SseEmitter`-based endpoint |
| 🟡 P1 | CORS only allows `localhost:3000`/`3001` | `SecurityConfig.java` | Add Docker-internal hostname and production domain |
| 🟡 P1 | Lombok ECJ bootstrap may not work on `ubuntu-latest` CI | `.mvn/jvm.config` | Test `mvn package` on GitHub Actions runner |
| 🟢 P2 | `applicationNumber` format wrong | `LoanApplicationService.java` | Use `LOS-{YYYY}-{STATE}-{SEQ}` format |
| 🟢 P2 | `LoanApplication.status` is plain String | `LoanApplication.java` | Convert to enum + add transition guard |
