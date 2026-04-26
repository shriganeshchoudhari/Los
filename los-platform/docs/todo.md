# TODO — LOS Platform
**Last updated:** April 25, 2026  
**Based on:** Deep analysis of `backend-java/` and `frontend/` source files + Implementation Guides

Items are ordered by priority within each section. 🔴 = blocking / P0, 🟡 = important / P1, 🟢 = nice-to-have / P2.

---

## IMMEDIATE — Must fix before first end-to-end test run

### Backend Java

- [x] 🔴 **Fix Aadhaar hash** — `KycService.hashAadhaar()` currently returns a weak prefix. Replace with SHA-256 implementation to comply with security standards.
- [x] 🔴 **Add SSE endpoint for real-time status** — Frontend `use-application-sse.ts` subscribes to `GET /api/applications/{id}/events`. Add `SseEmitter` support in `LoanApplicationController`.
- [x] 🔴 **Add `GET /api/documents/{id}/ocr` endpoint** — `DocumentController` only has `POST /api/documents/ocr`, but frontend calls `GET`. Map to `documentService.getOcrResult(id)`.
- [x] 🔴 **Rewrite `docker-compose.yml` for Spring Boot monolith** — Remove 8 legacy NestJS containers and replace with a single `backend` service using the Java Dockerfile.
- [x] 🔴 **Run `mvn test`** — Execute full test suite to identify bean wiring or Lombok issues.

### Frontend

- [x] 🔴 **Create `/api/auth/refresh` Next.js route** — Implement the missing route in `src/app/api/auth/refresh/route.ts` to handle token rotation via the backend `authApi.refresh()`.

---

## HIGH PRIORITY — Complete before feature testing

### Backend Java

- [x] 🟡 **Wire KYC/Bureau/Disbursement to WireMock** — Replace hardcoded mock responses in services with real `RestTemplate` calls to WireMock endpoints (port 8080).
- [x] 🟡 **Convert `LoanApplication.status` to enum** — Replace plain `String` with a typed `LoanApplicationStatus` enum and state-machine validation.
- [x] 🟡 **Implement PDF watermarking** — Use Apache PDFBox to apply watermarks to sanctioned documents as per PRD.
- [x] 🟡 **Implement real notification sending** — Route SMS/Email service calls to WireMock (dev) or Kaleyra/SMTP (prod).
- [x] 🟡 **Fix PAN name fuzzy match** — Ensure `jaroWinklerSimilarity` in `KycService` is correctly calibrated for Indian name variations.

### Frontend

- [x] 🟡 **Add loading skeletons / error states** — Replace "Loading..." text with shadcn/ui `Skeleton` components on dashboard and application pages.
- [ ] 🟡 **Test all 25+ pages with real backend** — Perform full user-flow walkthrough from product selection to eSign.

---

## COMPLETED ✅

### Backend Java
- [x] **Decision Engine rule evaluation logic** — Implemented loop for JSONB rule parsing and evaluation in `DecisionEngineService`.
- [x] **Domain Synchronization** — `DecisionEngineService` now updates `LoanApplication` status (SANCTIONED/REJECTED/UNDER_REVIEW).
- [x] **Audit Header Integration** — `DecisionController` captures `X-User-Id` for manual overrides.
- [x] **Spring Boot 3.5 migration** — Backend successfully builds with Maven.
- [x] **RS256 JWT Security** — `JwtTokenProvider` implemented with RSA key pairs.

### Frontend
- [x] **Staff Underwriting Dashboard** — Created application review page with rule visualization and decision forms.
- [x] **Applicant Decision UI** — Added "Under Review" state handling and enhanced status visualization.
- [x] **25+ pages complete** — Including KFS, co-applicants, and eSign flow.

---

## Infrastructure / Polish

- [ ] 🟡 **GitHub Actions CI for Java** — Add Maven build step to `ci.yml`.
- [x] **Aadhaar Hash Hardening**: Replace weak hash with SHA-256 (Verified in `KycService.java`)
- [x] **OCR API Parity**: Implement `GET /api/documents/{id}/ocr` (Verified in `DocumentController.java`)
- [x] **SSE Integration**: Implement real-time status stream in `LoanApplicationController`
- [x] **Auth Refresh Route**: Implement Next.js `/api/auth/refresh` for interceptor
- [ ] 🟡 **Vault integration** — Replace hardcoded encryption keys with Vault/External Secrets.
- [ ] 🟢 **FOIR calculation** — Implement automatic FOIR checks during application creation.
- [ ] 🟢 **Add audit log entries** — Implement `@Aspect` or explicit calls for all state-changing operations.

These are procurement/legal items that block production go-live:

| Item | Owner | Status |
|------|-------|--------|
| UIDAI AUA/KUA licence application | Legal/Compliance | ❌ Not submitted (ISSUE-001) |
| CBS Finacle/BaNCS WSDL + test environment | IT | ❌ Not confirmed (ISSUE-002) |
| CIBIL commercial agreement | PMO | ❌ Pending procurement (ISSUE-003) |
| CERT-In VAPT firm selection | Security | ❌ Not selected (ISSUE-005) |
| ArgoCD admin password rotation post-bootstrap | DevOps | 🟡 Post-first-deploy |
| DLT SMS template registration (TRAI) | Marketing | ✅ WireMock covers dev |
| NPCI SOR submission for NACH | Integration | ✅ WireMock covers dev |

---

## Completed (Reference)

- ✅ Spring Boot 3.5 migration from NestJS (Phase 58) — `mvn package -DskipTests` builds successfully
- ✅ 17 Flyway migrations (V001–V017) — all schemas + seed data
- ✅ RS256 JWT with RSA key pair (`JwtTokenProvider`)
- ✅ Resilience4j circuit breaker config in `application-dev.yml`
- ✅ Frontend: 25+ pages complete including KFS, co-applicants, eSign flow, mobile responsive, WCAG 2.1 AA
- ✅ WireMock mock server with 7 mapping files covering all external APIs
- ✅ JWT key generation scripts (`gen-jwt-keys.sh` + `.ps1`)
- ✅ 9 seed data SQL files
- ✅ K8s manifests, Terraform IaC, ArgoCD, Istio, Vault, Prometheus
- ✅ Postman collection (85 requests, 13 folders)
- ✅ OpenAPI 3.0 spec (`apis/openapi/los-platform-api.yaml`)
- ✅ 17 ADRs + DR runbook + incident runbook + Kafka event flow doc
- ✅ GitHub Actions CI/CD pipelines
