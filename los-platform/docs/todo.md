# Los Platform v0.1 - Master Project Tracker & Todo List

**Project Goal**: Launch Los Platform v0.1 (Full Feature) in 8-10 weeks
**Status**: Planning Phase ✅ → Development Ready
**Last Updated**: April 20, 2026
**Target Launch**: June 30, 2026

---

## Executive Summary

| Phase | Duration | Target End | Backend Owner | Frontend Owner | Status |
|-------|----------|-----------|---------------|----------------|--------|
| **1: Core Services** | Weeks 1–2 | May 5 | Backend-1 | — | 🔄 Not Started |
| **2: External Integrations** | Weeks 2–4 | May 19 | Backend-2 | — | 🔄 Not Started |
| **3: Notifications & OCR** | Weeks 3–4 | May 19 | Backend-3 | — | 🔄 Not Started |
| **4: DSA & Maker-Checker** | Weeks 4–5 | May 26 | Backend-3 | — | 🔄 Not Started |
| **5: Frontend** | Weeks 5–7 | June 9 | — | Full-Stack | 🔄 Not Started |
| **6: Testing** | Weeks 7–8 | June 23 | All | All | 🔄 Not Started |
| **7: Launch Prep** | Weeks 8–10 | June 30 | All | All | 🔄 Not Started |

---

## PHASE 1: Core Service Stabilization (Weeks 1–2)

### Backend: Decision Engine & State Machine

#### 1.1 Decision Engine Rule Evaluator
- [ ] Create `RuleEvaluator.java` (SpEL-based rule evaluation)
- [ ] Create `ApplicationContext.java` DTO with nested classes
- [ ] Create `EvaluationResult.java` response object
- [ ] Implement `DecisionService.makeDecision()` method
- [ ] Create DB migration for `los_decision.rules` columns (product_id, priority, operator)
- [ ] Write unit tests for RuleEvaluator (10+ rule cases)
- [ ] Write integration test: 3 products (personal, home, vehicle) with different rules
- **Deadline**: May 2 (Friday)
- **Owner**: Backend-1
- **PR**: Link to PR upon completion

#### 1.2 Multi-Product Configuration Enforcement
- [ ] Create `ProductValidationRules.java` service
- [ ] Implement validation for applicant eligibility (age, employment, income)
- [ ] Implement loan amount & tenure validation
- [ ] Implement FOIR calculation & validation
- [ ] Create DB migration for `los_core.products` columns & constraints
- [ ] Seed 12 products into DB (personal, home, vehicle, gold, LAP, education, MSME, auto, motorcycle, two-wheeler, business-term, MUDRA)
- [ ] Update `LoanApplicationService.validateProductRequirements()`
- [ ] Write unit tests for each product validation rule
- **Deadline**: May 5 (Monday)
- **Owner**: Backend-1
- **PR**: Link to PR upon completion

#### 1.3 Loan State Machine Completion
- [ ] Add `ApplicationState` enum to `Application.java` (11 states)
- [ ] Create `ApplicationStateMachine.java` service
- [ ] Implement transition validation (prevent invalid state transitions)
- [ ] Implement state change event publishing to Kafka (`loan.state.changed` topic)
- [ ] Create `ApplicationStateChangedEvent.java` event class
- [ ] Create DB migration for state audit table (`los_loan.application_state_audit`)
- [ ] Add state-change listener that publishes Kafka events
- [ ] Write unit tests: valid & invalid transitions
- [ ] Write integration test: DRAFT → SUBMITTED → KYC → BUREAU → DECISION flow
- **Deadline**: May 5 (Monday)
- **Owner**: Backend-1
- **Dependencies**: None (can run parallel with 1.1 & 1.2)
- **PR**: Link to PR upon completion

### Database

#### 1.4 Database Migrations
- [ ] Create `V001__Initial_Schema.sql` (9 schemas, core tables)
- [ ] Create `V002__Phase1_Rules_And_Products.sql` (rules table, products table, seeding)
- [ ] Create `V003__State_Machine_Tables.sql` (application_state_audit, state columns)
- [ ] Run Flyway migrations locally & verify all tables created
- [ ] Test migration rollback (V003 → V002 → V001)
- **Deadline**: May 5 (Monday)
- **Owner**: Backend-1
- **Dependencies**: None
- **Verification**: `SELECT * FROM los_core.products;` returns 12 rows

---

## PHASE 2: External Integrations Foundation (Weeks 2–4)

### Backend: Bureau, CBS, eSign

#### 2.1 Bureau Integration Wrapper (Mock)
- [ ] Create `BureauClient.java` interface
- [ ] Create `CibilMockClient.java` (mock bureau scores)
- [ ] Create `ExperianMockClient.java` (mock scores)
- [ ] Create `EquifaxMockClient.java` (mock scores)
- [ ] Create `CrifMockClient.java` (mock scores)
- [ ] Create `BureauAggregatorService.java` (orchestrate calls, aggregate scores)
- [ ] Create `BureauResponseEntity.java` & repository
- [ ] Implement Resilience4j circuit breaker for bureau APIs
- [ ] Implement retry logic (3 attempts, exponential backoff)
- [ ] Create DB migration for `los_integration.bureau_responses` table
- [ ] Add `application.properties` config for mock flag
- [ ] Write unit tests for each bureau client (mock responses)
- [ ] Write integration test: call aggregator, verify all 4 scores in DB
- [ ] Write test: simulate circuit breaker open (3 failures → graceful fallback)
- **Deadline**: May 12 (Monday)
- **Owner**: Backend-2
- **Dependencies**: Phase 1 completion
- **Verification**: `SELECT * FROM los_integration.bureau_responses;` shows 4 entries per application

#### 2.2 CBS (Finacle) SOAP Integration (Mock)
- [ ] Create `FinacleMockClient.java` (mock account creation response)
- [ ] Create SOAP request builder (loan account, branch, product code)
- [ ] Create SOAP response parser (extract account number, transaction ID)
- [ ] Implement account creation method: `createLoanAccountInCbs(application, amount)`
- [ ] Implement idempotency key logic (24-hour Redis cache)
- [ ] Create DB migration for `los_integration.cbs_transactions` table
- [ ] Add CBS configuration to `application-integration.properties`
- [ ] Write unit tests for request builder & response parser
- [ ] Write integration test: application → CBS account created → account# stored in DB
- **Deadline**: May 16 (Friday)
- **Owner**: Backend-2
- **Dependencies**: Phase 1 completion
- **Verification**: `SELECT * FROM los_integration.cbs_transactions;` shows account number

#### 2.3 eSign Integration (Mock)
- [ ] Create `EsignMockClient.java` (mock signature callback)
- [ ] Implement async signature flow (submit PDF → get transaction ID → wait for webhook)
- [ ] Create webhook handler for eSign signature callback
- [ ] Create DB migration for `los_integration.esign_events` table
- [ ] Add eSign configuration (`application-esign.properties`)
- [ ] Implement document signing status tracking in `los_document.documents`
- [ ] Write unit tests for eSign client
- [ ] Write integration test: generate sanction letter → sign → verify DB status
- **Deadline**: May 19 (Monday)
- **Owner**: Backend-2
- **Dependencies**: Phase 1, Phase 2.1 (for Kafka integration)
- **Verification**: `SELECT * FROM los_integration.esign_events;` shows signature events

### Application

#### 2.4 Kafka Event Listeners
- [ ] Create state-change listener (publishes to `loan.state.changed` topic)
- [ ] Add listener trigger in `ApplicationStateMachine` state transitions
- [ ] Write test: KYC completed → state → BUREAU, event published
- **Deadline**: May 12 (Monday)
- **Owner**: Backend-2
- **Dependencies**: Phase 1.3
- **Verification**: Kafka topic `loan.state.changed` receives events

---

## PHASE 3: Notification & Document Services (Weeks 3–4)

### Backend: Notifications & OCR

#### 3.1 Multi-Channel Notification Service
- [ ] Create `SmsClient.java` interface
- [ ] Create `KaleyramockClient.java` (SMS mock)
- [ ] Create `Msg91mockClient.java` (SMS backup mock)
- [ ] Create `EmailClient.java` interface & SMTP implementation
- [ ] Create `GupshupMockClient.java` (WhatsApp mock)
- [ ] Create `FcmMockClient.java` (push notification mock)
- [ ] Create `NotificationService.java` orchestrator
- [ ] Create `StateChangeEventListener.java` (Kafka listener for state changes)
- [ ] Create DB migration for `los_notification.notifications` & `notification_templates` tables
- [ ] Seed notification templates (KYC_COMPLETE, DECISION_APPROVED, DECISION_REJECTED, etc.)
- [ ] Add Kafka listener config (`spring.kafka.listener.type=batch`)
- [ ] Write unit tests for each notification client
- [ ] Write integration test: state change → SMS/email sent → verified in DB
- [ ] Write test: WhatsApp template sending
- **Deadline**: May 16 (Friday)
- **Owner**: Backend-3
- **Dependencies**: Phase 1, Phase 2.4 (Kafka listeners)
- **Verification**: `SELECT * FROM los_notification.notifications;` shows sent messages

#### 3.2 Document OCR Pipeline
- [ ] Create `OcrClient.java` interface
- [ ] Create `TextractMockClient.java` (mock AWS Textract response)
- [ ] Create `SarvamAiMockClient.java` (mock Sarvam AI)
- [ ] Create `DocumentExtractionService.java` (orchestrate OCR)
- [ ] Create extractors: `SalarySlipExtractor.java`, `BankStatementExtractor.java`, `ItrExtractor.java`, `PanExtractor.java`
- [ ] Update `DocumentService.java` to call OCR after upload
- [ ] Create DB migration for `los_document.document_extractions` & `extractionStatus` column
- [ ] Add OCR configuration (`application-document.properties`)
- [ ] Write unit tests for each extractor (mock OCR responses)
- [ ] Write integration test: upload salary slip → OCR → extract salary & employer
- [ ] Write test: low-confidence extraction → flag for manual review
- **Deadline**: May 19 (Monday)
- **Owner**: Backend-3
- **Dependencies**: Phase 3.1 (for notifications on extraction completion)
- **Verification**: `SELECT * FROM los_document.document_extractions;` shows extracted data

---

## PHASE 4: DSA Service & Maker-Checker (Weeks 4–5)

### Backend: DSA & Compliance

#### 4.1 DSA Service Implementation
- [ ] Create `DsaPartner.java` entity with KYC fields
- [ ] Create `DsaOfficer.java` entity (officers under DSA partner)
- [ ] Create `DsaCommission.java` entity (commission log per loan)
- [ ] Create `DsaPartnerService.java` (registration, KYC, activation workflows)
- [ ] Create `DsaCommissionService.java` (calculate commissions, track payouts)
- [ ] Create `DsaPartnerController.java` (REST endpoints for DSA partner ops)
- [ ] Create DB migration for `los_dsa.dsa_partners`, `dsa_officers`, `dsa_commissions` tables
- [ ] Implement commission calculation: sanctionAmount × commissionPercentage
- [ ] Implement commission payout batch job (weekly/monthly aggregation)
- [ ] Add DSA configuration (`application-dsa.properties` with commission %)
- [ ] Write unit tests for DsaCommissionService (calculate ₹20L @ 2% = ₹4000)
- [ ] Write integration test: DSA partner registration → officer origination → commission calculated
- [ ] Write test: commission payout batch job → commissions marked PAID
- **Deadline**: May 23 (Friday)
- **Owner**: Backend-3
- **Dependencies**: Phase 1 completion
- **Verification**: `SELECT * FROM los_dsa.dsa_commissions;` shows calculated commissions

#### 4.2 Maker-Checker Workflow (₹10L+ Approvals)
- [ ] Add `requiresMakerChecker`, `checkerUserId`, `checkerComment`, `checkerApprovedAt` columns to `Application`
- [ ] Create `MakerCheckerService.java` (approval logic)
- [ ] Implement state: DECISION → PENDING_CHECKER_APPROVAL (if loan > ₹10L)
- [ ] Implement `approveOrRejectSanction()` method
- [ ] Create API endpoint: `PATCH /api/applications/{id}/sanction-approval`
- [ ] Create DB migration for `los_compliance.maker_checker_approvals` audit table
- [ ] Implement approval timeout rule (24h auto-escalate to compliance)
- [ ] Write unit tests: loan ₹8L → no maker-checker; ₹12L → requires maker-checker
- [ ] Write integration test: ₹15L loan → DECISION → PENDING_CHECKER_APPROVAL → approval → SANCTION
- [ ] Write test: checker rejects with comment → state = REJECTED, notification sent
- **Deadline**: May 26 (Monday)
- **Owner**: Backend-3
- **Dependencies**: Phase 1, Phase 3.1 (for notifications)
- **Verification**: Applications >₹10L stuck in PENDING_CHECKER_APPROVAL until approved

---

## PHASE 5: Frontend Implementation (Weeks 5–7)

### Frontend: Analyst, Manager, Compliance, DSA, Mobile

#### 5.1 Analyst Worklist & Decision Dashboard
- [ ] Create `/app/analyst/page.tsx` (worklist with filters, sorting)
  - [ ] Implement status filter (KYC, BUREAU, DECISION)
  - [ ] Implement product filter (personal, home, vehicle)
  - [ ] Implement ageing filter (>5 days, >10 days)
  - [ ] Implement sort by (createdAt, loanAmount, daysPending)
  - [ ] API call: `GET /api/applications?status=BUREAU&productId=...&sortBy=...`
- [ ] Create `/app/analyst/[id]/decision/page.tsx` (decision UI)
  - [ ] Display applicant profile (age, income, existing EMIs)
  - [ ] Display bureau scores (CIBIL, Experian, Equifax, CRIF aggregated)
  - [ ] Calculate & display FOIR
  - [ ] Display decision recommendation (APPROVED/REJECTED)
  - [ ] Manual override: APPROVE with sanctionAmount, REJECT with reason, PENDING
  - [ ] API call: `POST /api/applications/{id}/decision`
- [ ] Write unit tests for filter logic (Vitest)
- [ ] Write E2E test: analyst sees 50 apps, filters to >10 days → 5 apps (Cypress)
- [ ] Write E2E test: analyst approves decision → state updates to DECISION
- **Deadline**: May 30 (Friday)
- **Owner**: Full-Stack
- **Dependencies**: Phase 4.1, Phase 4.2 (backend APIs ready)
- **Verification**: Analyst can filter worklist & make decisions, state transitions

#### 5.2 Manager Sanction Approval (Maker-Checker UI)
- [ ] Create `/app/manager/page.tsx` (sanctioned loans pending approval)
  - [ ] Display loans in PENDING_CHECKER_APPROVAL state
  - [ ] KPI: count of pending approvals, total sanction amounts
  - [ ] API call: `GET /api/applications?currentState=PENDING_CHECKER_APPROVAL`
- [ ] Create `/app/manager/[id]/sanction-approval/page.tsx` (approval UI)
  - [ ] Display sanction letter preview
  - [ ] Display decision rationale & applicant KYC summary
  - [ ] Approve/Reject buttons with comment field
  - [ ] API call: `PATCH /api/applications/{id}/sanction-approval`
- [ ] Write E2E test: manager approves ₹15L loan → state = SANCTION
- [ ] Write E2E test: manager rejects with comment → state = REJECTED, notification sent
- **Deadline**: June 2 (Monday)
- **Owner**: Full-Stack
- **Dependencies**: Phase 5.1, Phase 4.2 (maker-checker backend)
- **Verification**: Manager can approve/reject, state transitions, comment logged

#### 5.3 Compliance & Audit Dashboard
- [ ] Create `/app/compliance/page.tsx` (dashboard home)
  - [ ] KPIs: total applications, approval rate, avg processing time
  - [ ] Recent activity log (10 latest state changes)
- [ ] Create `/app/compliance/audit-trail/page.tsx` (detailed audit log)
  - [ ] Table: applicationId, userId, action, timestamp, old → new values
  - [ ] Filters: date range, user, action type
  - [ ] Export to CSV
  - [ ] API call: `GET /api/compliance/audit-logs?fromDate=...&toDate=...`
- [ ] Create `/app/compliance/consent-audit/page.tsx` (consent verification)
  - [ ] Table: applicationId, consentType (KYC, bureau, eSign), timestamp, IP, device
  - [ ] Compliance sign-off checkbox
  - [ ] API call: `GET /api/compliance/consent-trail/{applicationId}`
- [ ] Create `/app/compliance/aadhaar-access-log/page.tsx` (RBI requirement)
  - [ ] Table: applicationId, accessed_by, accessed_at, purpose, action
  - [ ] Read-only, no download of raw Aadhaar
  - [ ] API call: `GET /api/compliance/aadhaar-access-log`
- [ ] Create `/app/compliance/reports/page.tsx` (compliance reports)
  - [ ] Generate reports: KYC quality, bureau utilization, decision quality
  - [ ] Export to PDF
  - [ ] API call: `GET /api/compliance/reports/kycQuality?fromDate=...&toDate=...`
- [ ] Write E2E test: staff changes application field → appears in audit log
- [ ] Write test: compliance officer exports consent audit → all consents with IP/device
- **Deadline**: June 6 (Friday)
- **Owner**: Full-Stack
- **Dependencies**: Phase 1.3 (state audit logging), Phase 3.1 (notification audit)
- **Verification**: Compliance team can view full audit trail & consent records

#### 5.4 DSA Commission Portal
- [ ] Create `/app/dsa/dashboard/page.tsx` (DSA home)
  - [ ] KPIs: total commissions earned, pending commissions, commissions paid (MTD/YTD)
  - [ ] Recent loans originated (last 10)
  - [ ] API call: `GET /api/dsa/metrics`
- [ ] Create `/app/dsa/officers/page.tsx` (officer management)
  - [ ] List: officer name, email, branch, status, commissions earned
  - [ ] Actions: add officer, deactivate, view detail
  - [ ] API call: `GET /api/dsa/officers`
- [ ] Create `/app/dsa/commissions/page.tsx` (commission tracking)
  - [ ] Table: applicationId, loan amount, commission amount, status (PENDING/APPROVED/PAID), payment date
  - [ ] Filters: date range, status
  - [ ] Export commission summary
  - [ ] API call: `GET /api/dsa/commissions?status=PENDING`
- [ ] Create `/app/dsa/loans/page.tsx` (DSA-originated loans)
  - [ ] Table: applicant name, loan amount, product, state, officer, created date
  - [ ] Filters: state, officer, date range
  - [ ] API call: `GET /api/dsa/loans?dsaPartnerId=...`
- [ ] Write E2E test: DSA partner logs in → sees dashboard with earnings
- [ ] Write E2E test: commission calculated on sanction → appears in portal next day
- [ ] Write test: payout batch job runs → commissions marked PAID
- **Deadline**: June 9 (Monday)
- **Owner**: Full-Stack
- **Dependencies**: Phase 4.1 (DSA service backend)
- **Verification**: DSA can track commissions & payouts

#### 5.5 Bureau Report Viewer
- [ ] Create `/app/analyst/[id]/bureau-report/page.tsx`
  - [ ] Tabs: CIBIL, Experian, Equifax, CRIF
  - [ ] Display: bureau score, active accounts, missed payments, defaults
  - [ ] Highlight: missed payments, defaults, inquiry count
  - [ ] API call: `GET /api/applications/{id}/bureau-data`
- [ ] Create bureau report formatters (components):
  - [ ] `CibilReport.tsx`, `ExperianReport.tsx`, `EquifaxReport.tsx`, `CrifReport.tsx`
- [ ] Write test: view application → see aggregated bureau scores
- **Deadline**: June 9 (Monday)
- **Owner**: Full-Stack
- **Dependencies**: Phase 2.1 (bureau aggregation API)
- **Verification**: Analyst can view all 4 bureau scores

#### 5.6 Mobile UX Optimization (Lakshmi Devi Persona)
- [ ] Create `/app/mobile/page.tsx` (mobile entry point)
  - [ ] Multi-step form (5 steps: personal, income, loan, documents, review)
  - [ ] Progress indicator (step 2/5)
  - [ ] Large touch-friendly buttons (h-16)
  - [ ] Simplified fields (1 per step)
- [ ] Update `LoanApplicationForm.tsx` to support mobile view
  - [ ] Responsive breakpoints (mobile-first)
  - [ ] Font sizes: text-lg on mobile, text-base on desktop
  - [ ] Button heights: h-16 (64px) on mobile, h-10 on desktop
- [ ] Implement WhatsApp notification deep-links
  - [ ] Link format: `https://wa.me/919999999999?text=...`
  - [ ] Include application link in WhatsApp message
- [ ] Write visual test: form renders on 320px width (old Android phones)
- [ ] Write E2E test: complete loan on mobile device (target <4 minutes)
- [ ] Write test: click WhatsApp notification → deep-link to application
- **Deadline**: June 9 (Monday)
- **Owner**: Full-Stack
- **Dependencies**: Phase 5.1 (application form exists)
- **Verification**: Loan can be completed on mobile in <4 minutes; WhatsApp links work

---

## PHASE 6: Integration Testing & Compliance (Weeks 7–8)

### Backend & Frontend: E2E Tests, Load Tests, Security

#### 6.1 Integration Tests (Layer 1 & 2)
- [ ] Create `LoanFlowE2ETest.java` (full personal loan origination)
  - [ ] Test: DRAFT → SUBMITTED → KYC → BUREAU → DECISION → SANCTION → DISBURSEMENT
  - [ ] Verify: each state transition, notifications sent, bureau scores aggregated
  - [ ] Tools: TestContainers (PostgreSQL, Redis, Kafka), Mockito (bureaus)
- [ ] Create `DsaOriginationE2ETest.java` (DSA flow)
- [ ] Create `MakerCheckerE2ETest.java` (high-value loan ₹15L)
- [ ] Create `NotificationE2ETest.java` (state changes → SMS/email sent)
- [ ] Update Postman collection with new endpoints (if not using automated generation)
- [ ] Run full integration suite: `mvn test`
- [ ] Verify test coverage >80%
- **Deadline**: June 16 (Monday)
- **Owner**: Backend-3, Full-Stack
- **Dependencies**: Phase 5 completion
- **Verification**: All tests pass, no flaky tests, coverage >80%

#### 6.2 Frontend E2E Tests (Cypress)
- [ ] Create `/tests/e2e/analyst-workflow.cy.ts`
  - [ ] Test: load worklist → filter by >10 days → click app → view decision → approve
- [ ] Create `/tests/e2e/manager-workflow.cy.ts`
  - [ ] Test: load pending approvals → review ₹15L loan → approve with comment
- [ ] Create `/tests/e2e/mobile-workflow.cy.ts`
  - [ ] Test: complete loan on mobile (5 steps) → submit
- [ ] Run all E2E tests: `npm run test:e2e`
- [ ] Verify no broken links, form validations work
- **Deadline**: June 16 (Monday)
- **Owner**: Full-Stack
- **Dependencies**: Phase 5 completion
- **Verification**: All E2E tests pass, no console errors

#### 6.3 Load Testing (K6)
- [ ] Create `devops/k6/loan-origination-load.js`
  - [ ] Scenario: ramp up to 100 concurrent users
  - [ ] 10 users create application, 50 view dashboard, 40 submit KYC
  - [ ] Target: P95 <500ms, error rate <1%
  - [ ] Duration: 5 minutes
- [ ] Create `devops/k6/bureau-integration-load.js`
  - [ ] Scenario: 20 concurrent bureau requests (30s timeout each)
  - [ ] Verify circuit breaker doesn't trip, all requests complete
- [ ] Run tests: `k6 run devops/k6/loan-origination-load.js`
- [ ] Collect Prometheus metrics, identify bottlenecks
- **Deadline**: June 20 (Friday)
- **Owner**: Backend-2, Backend-3
- **Dependencies**: Phase 5 completion, infrastructure ready (EKS, Prometheus)
- **Verification**: P95 <500ms achieved, no performance regressions

#### 6.4 Security Hardening & Compliance Audit
- [ ] Review JWT token generation (RS256, key rotation)
  - [ ] File: `JwtTokenProvider.java`
- [ ] Review PII encryption (Aadhaar hash, PAN encrypted, photos AES-256)
  - [ ] File: `CryptoUtil.java`
- [ ] Review audit logging (all writes logged with user ID)
  - [ ] File: `AuditFilter.java`
- [ ] Review consent capture (OTP + IP + device)
  - [ ] File: `ConsentService.java`
- [ ] Review CSRF tokens, CSP headers (frontend)
  - [ ] File: `middleware.ts`
- [ ] Compliance Checklist:
  - [ ] PII encrypted (Aadhaar, PAN, photos)
  - [ ] Audit logs: all state changes, data access
  - [ ] Consent: OTP + IP + device captured
  - [ ] Aadhaar access log: separate, read-only
  - [ ] Password policy: 12+ chars, complexity
  - [ ] Session timeout: 30 min inactivity
  - [ ] MFA: OTP on >₹10L operations
  - [ ] API rate limiting: Kong configured (100 req/min per user)
  - [ ] CORS: whitelisted origins only
- [ ] Run security audit tools (OWASP ZAP, SonarQube if available)
- [ ] Penetration test: external contractor (optional, if budget allows)
- **Deadline**: June 23 (Monday)
- **Owner**: All
- **Dependencies**: Phase 5 completion
- **Verification**: Security audit passed, compliance checklist 100%

---

## PHASE 7: Buffer & Launch Prep (Weeks 8–10)

### Backend & Frontend: Performance, Documentation, UAT

#### 7.1 Performance Optimization
- [ ] Database indexing review
  - [ ] Ensure filter columns indexed (product_id, currentState, createdAt)
  - [ ] Create indexes: `CREATE INDEX idx_app_state ON applications(currentState, createdAt);`
- [ ] Query optimization (N+1 problem fixes)
  - [ ] Review `LoanApplicationService` queries
  - [ ] Use JPA fetch=EAGER or projections
- [ ] Caching strategy
  - [ ] Cache decision rules (24h Redis TTL)
  - [ ] Cache product config (24h TTL)
  - [ ] Cache bureau response aggregation (24h TTL)
- [ ] API response compression
  - [ ] Enable Gzip in `application.properties` (already default in Spring)
- [ ] Frontend bundle optimization
  - [ ] Next.js tree-shaking & code splitting (automatic)
  - [ ] Verify bundle size <500KB
  - [ ] Test page load: P95 <2s
- [ ] Profiling & benchmarking
  - [ ] Baseline P95 response time (before)
  - [ ] Apply optimizations
  - [ ] Measure P95 again (after)
  - [ ] Target: P95 <500ms (achieved via caching, indexing)
- **Deadline**: June 27 (Friday)
- **Owner**: Backend-2, Full-Stack
- **Dependencies**: Phase 6 completion
- **Verification**: P95 <500ms, bundle size <500KB, no 404s or console errors

#### 7.2 Documentation Finalization
- [ ] Create `docs/IMPLEMENTATION_ROADMAP.md` (what was built, what's pending)
- [ ] Create `docs/INSTALLATION_GUIDE.md` (step-by-step deployment)
- [ ] Create `docs/OPERATIONS_MANUAL.md` (runbooks: commission payouts, token revocation, bureau retries)
- [ ] Update `docs/API_documentation.md` (new endpoints: DSA, maker-checker, compliance)
  - [ ] Generate from Springdoc OpenAPI annotations
  - [ ] Export to `apis/openapi/los-platform-api.yaml`
- [ ] Update `docs/Database_schema_doc.md` (new tables: dsa_partners, dsa_commissions, etc.)
- [ ] Update `README.md` (highlight v0.1 features)
- [ ] Create architecture diagram (draw.io or similar)
- [ ] Create deployment architecture diagram (EKS, Istio, Kong, etc.)
- **Deadline**: June 27 (Friday)
- **Owner**: All (documentation review)
- **Dependencies**: Phase 6 completion
- **Verification**: All docs complete, links verified, no orphaned sections

#### 7.3 UAT & Go-Live Checklist
- [ ] Happy Path Testing:
  - [ ] [ ] Personal loan ₹5L: end-to-end (create → sanction → disburse)
  - [ ] [ ] Home loan ₹30L: with maker-checker approval
  - [ ] [ ] DSA origination: commission calculation & payout
  - [ ] [ ] Multi-state transitions: validate state machine
- [ ] Error Cases:
  - [ ] [ ] Rejected application: decision REJECT → notification sent
  - [ ] [ ] Bureau timeout: retry logic triggers, "pending" status shown
  - [ ] [ ] CBS account creation fails: application stays in DISBURSEMENT, retry available
- [ ] Compliance Spot Checks:
  - [ ] [ ] Aadhaar access log: entries present (one per KYC check)
  - [ ] [ ] Consent audit: all consents recorded (timestamp, IP, device)
  - [ ] [ ] Audit trail: field-level changes visible
- [ ] Load Test Results Review:
  - [ ] [ ] Dashboard: 100 concurrent users, P95 <500ms
  - [ ] [ ] Bureau pull: 20 concurrent requests, all complete <30s
- [ ] Security Checks Review:
  - [ ] [ ] HTTPS: all traffic encrypted
  - [ ] [ ] JWT tokens: signed (RS256), expire correctly
  - [ ] [ ] API keys: not exposed in logs/frontend
  - [ ] [ ] SQL injection: parameterized queries verified
- [ ] Sign-offs:
  - [ ] [ ] All critical bugs fixed (P0 bugs = 0)
  - [ ] [ ] Performance baseline met
  - [ ] [ ] UAT sign-off from PO (Product Owner)
  - [ ] [ ] Compliance audit passed
  - [ ] [ ] Runbooks documented
- **Deadline**: June 30 (Monday — Launch Day)
- **Owner**: All
- **Dependencies**: Phase 7.1 & 7.2 completion
- **Verification**: All checkboxes checked, ready for go-live

---

## Weekly Milestones & Burn-Down

### Week 1 (April 22–26)
- [ ] Phase 1a: Decision Engine skeleton, unit tests
- [ ] Phase 1b: Product Validation rules
- [ ] Phase 1c: State Machine foundation
- **Target**: 50% of Phase 1 complete

### Week 2 (April 29–May 3)
- [ ] Phase 1: Complete all tasks (decision, product, state machine)
- [ ] Phase 2.1: Bureau clients & aggregator (in progress)
- **Target**: Phase 1 ✅, Phase 2.1 50% complete

### Week 3 (May 6–10)
- [ ] Phase 2: Bureau (✅), CBS (60%), eSign (20%)
- [ ] Phase 3.1: Notification service skeleton
- **Target**: Phase 2.1 ✅, Phase 2.2 70% complete

### Week 4 (May 13–17)
- [ ] Phase 2: CBS (✅), eSign (60%)
- [ ] Phase 3: Notifications (70%), OCR (30%)
- [ ] Phase 4.1: DSA service skeleton
- **Target**: Phase 2 60% ✅, Phase 3 50% in progress

### Week 5 (May 20–24)
- [ ] Phase 2: eSign ✅
- [ ] Phase 3: Notifications (✅), OCR (80%)
- [ ] Phase 4: DSA (✅), Maker-Checker (70%)
- [ ] Phase 5: Frontend skeleton (analyst, manager pages)
- **Target**: Phase 3 80% ✅, Phase 4 70% complete, Phase 5 starts

### Week 6 (May 27–31)
- [ ] Phase 3: OCR ✅
- [ ] Phase 4: Maker-Checker ✅
- [ ] Phase 5: Frontend 60% (analyst, manager, compliance, DSA started)
- **Target**: Phase 4 ✅, Phase 5 50% complete

### Week 7 (June 3–7)
- [ ] Phase 5: Frontend 90% (analyst, manager, compliance, DSA, bureau, mobile)
- [ ] Phase 6: E2E tests skeleton
- **Target**: Phase 5 85% complete, Phase 6 starts

### Week 8 (June 10–14)
- [ ] Phase 5: Frontend ✅
- [ ] Phase 6: E2E tests (Layer 1 & 2 ✅), Load tests (in progress)
- **Target**: Phase 5 ✅, Phase 6 50% complete

### Week 9 (June 17–21)
- [ ] Phase 6: Load tests (✅), Security audit (in progress)
- [ ] Phase 7: Performance optimization, documentation
- **Target**: Phase 6 80% ✅, Phase 7 starts

### Week 10 (June 24–28)
- [ ] Phase 6: Security audit ✅
- [ ] Phase 7: Documentation (✅), UAT (in progress)
- **Target**: Phase 6 ✅, Phase 7 90% complete

### Week 11 (June 29–30) — Launch Week
- [ ] Phase 7: UAT ✅, Go-live checklist ✅
- [ ] **LAUNCH**: June 30, 2026
- **Target**: Phase 7 ✅, v0.1 LIVE

---

## Risk Register & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Bureau API credentials delayed | Medium | High | Use mock APIs first; integrate real APIs in v0.5 |
| CBS SOAP WSDL unavailable | Medium | High | Prepare SOAP transformer in parallel; mock CBS for v0.1 |
| eSign provider integration delays | Low | Medium | Generate unsigned PDFs; add eSign in v0.5 |
| DSA partner KYC process slow | Low | Medium | Pre-register 5 test DSA partners for UAT |
| Textract API quota limits | Low | Medium | Use Sarvam AI fallback; batch OCR jobs |
| Mobile device unavailable | Low | Low | Use Android emulator; real device testing in week 9 |
| Key engineer(s) unavailable | Medium | High | Cross-train team members; detailed code documentation |
| Performance doesn't meet targets | Low | High | Identify bottlenecks in week 7; optimize in week 8 |

---

## Team Assignments

| Role | Name | Phases | Responsibilities |
|------|------|--------|------------------|
| **Backend-1** | [TBD] | 1 | Decision engine, state machine, product validation, DB migrations |
| **Backend-2** | [TBD] | 2 | Bureau, CBS, eSign integrations, Kafka setup |
| **Backend-3** | [TBD] | 3, 4 | Notifications, OCR, DSA service, maker-checker, compliance |
| **Full-Stack** | [TBD] | 5, 6, 7 | All frontend pages, E2E tests, UAT, documentation |
| **DevOps** | [TBD] | 2–7 | Infrastructure, K6 load tests, security setup, monitoring |
| **QA** | [TBD] | 6, 7 | E2E testing, UAT coordination, go-live checklist |

---

## Communication & Sync Schedule

### Daily Standups
- **Time**: 10:00 AM IST
- **Duration**: 15 minutes
- **Attendees**: All team members
- **Format**: What I did yesterday, what I'm doing today, blockers?

### Weekly Syncs
- **Time**: Friday 2:00 PM IST
- **Duration**: 30 minutes per phase
- **Attendees**: Phase lead + team
- **Format**: Phase progress, blockers, next week plan

### Bi-weekly Steering Committee
- **Time**: Every other Wednesday 3:00 PM IST
- **Duration**: 60 minutes
- **Attendees**: PO, Engineering Lead, Architects, QA Lead
- **Format**: Overall progress, risks, roadmap adjustments

### Documentation
- Update this tracker **weekly** (Friday 5:00 PM IST)
- Commit to GitHub with PR link when task complete
- Mark checkbox [x] when done

---

## Success Criteria (Go-Live Gate)

### Technical
- ✅ Phase 1–7 all complete
- ✅ Unit test coverage >80%
- ✅ Integration tests passing (TestContainers, E2E)
- ✅ Load tests: P95 <500ms, error rate <1%
- ✅ Security audit passed (OWASP Top 10, JWT, PII encryption)
- ✅ All critical bugs fixed (P0 = 0)
- ✅ Performance baselines met (caching, indexing, bundle size)

### Operational
- ✅ Runbooks documented (commission payouts, bureau retries, token revocation)
- ✅ Deployment tested (build, Docker image, K8s manifests)
- ✅ Monitoring configured (Prometheus, Grafana, Loki)
- ✅ Alerts configured (CPU, memory, error rates, SLA breaches)
- ✅ On-call rotation documented

### Compliance & Quality
- ✅ UAT sign-off from PO
- ✅ Compliance audit passed (audit logs, consent trail, Aadhaar access log)
- ✅ Privacy policy updated (PII handling, consent, data retention)
- ✅ API documentation complete & exported
- ✅ User guides written (analyst, manager, DSA, compliance workflows)

---

## Appendix: Key Files to Track

### Backend Java
| File | Phase | Status |
|------|-------|--------|
| `RuleEvaluator.java` | 1a | 🔄 Not Started |
| `ApplicationStateMachine.java` | 1c | 🔄 Not Started |
| `ProductValidationRules.java` | 1b | 🔄 Not Started |
| `BureauAggregatorService.java` | 2a | 🔄 Not Started |
| `FinacleMockClient.java` | 2b | 🔄 Not Started |
| `EsignMockClient.java` | 2c | 🔄 Not Started |
| `NotificationService.java` | 3a | 🔄 Not Started |
| `DocumentExtractionService.java` | 3b | 🔄 Not Started |
| `DsaPartnerService.java` | 4a | 🔄 Not Started |
| `MakerCheckerService.java` | 4b | 🔄 Not Started |

### Frontend React/Next.js
| File | Phase | Status |
|------|-------|--------|
| `/app/analyst/page.tsx` | 5a | 🔄 Not Started |
| `/app/analyst/[id]/decision/page.tsx` | 5a | 🔄 Not Started |
| `/app/manager/page.tsx` | 5a | 🔄 Not Started |
| `/app/manager/[id]/sanction-approval/page.tsx` | 5a | 🔄 Not Started |
| `/app/compliance/audit-trail/page.tsx` | 5b | 🔄 Not Started |
| `/app/compliance/consent-audit/page.tsx` | 5b | 🔄 Not Started |
| `/app/dsa/dashboard/page.tsx` | 5c | 🔄 Not Started |
| `/app/dsa/commissions/page.tsx` | 5c | 🔄 Not Started |
| `/app/analyst/[id]/bureau-report/page.tsx` | 5d | 🔄 Not Started |
| `/app/mobile/page.tsx` | 5e | 🔄 Not Started |

### Database Migrations
| File | Phase | Status |
|------|-------|--------|
| `V001__Initial_Schema.sql` | 1 | 🔄 Not Started |
| `V002__Phase1_Rules_And_Products.sql` | 1 | 🔄 Not Started |
| `V003__State_Machine_Tables.sql` | 1 | 🔄 Not Started |
| `V004__Bureau_Integration.sql` | 2a | 🔄 Not Started |
| `V005__CBS_Integration.sql` | 2b | 🔄 Not Started |
| `V006__eSign_Integration.sql` | 2c | 🔄 Not Started |
| `V007__Notifications_OCR.sql` | 3 | 🔄 Not Started |
| `V008__DSA_Service.sql` | 4a | 🔄 Not Started |
| `V009__Maker_Checker.sql` | 4b | 🔄 Not Started |

---

## How to Use This Tracker

1. **At start of week**: Review upcoming tasks, assign owners
2. **Daily standups**: Mention task progress (e.g., "1a: 70% → rules evaluation working, need to test SpEL")
3. **Task completion**: Mark checkbox [x], add PR link, move to next task
4. **Weekly sync**: Update phase % complete, adjust next week plan
5. **Weekly commit**: Push this file to GitHub (commit message: "Update tracker: Phase X YY% complete")

---

## Revision History

| Date | Version | Change | By |
|------|---------|--------|-----|
| 2026-04-20 | 1.0 | Initial tracker creation | [Your Name] |
| TBD | 1.1 | Week 1 progress update | [To be filled] |
| TBD | 1.2 | Week 2 progress update | [To be filled] |

---

**Last Updated**: April 20, 2026 @ 4:00 PM IST
**Next Review**: April 27, 2026 @ 10:00 AM IST (Week 1 Standup)
