# Product Requirements Document (PRD)
## Loan Origination System (LOS) — Indian Banking Context
**Version:** 2.0 | **Status:** Approved | **Date:** 2024-07-15
**Author:** Product Management | **Reviewed by:** CTO, Chief Risk Officer, Compliance Head

---

## 1. Executive Summary

The Loan Origination System (LOS) is a production-grade, cloud-native platform that digitizes the end-to-end loan lifecycle for an Indian commercial bank — from application intake through KYC, underwriting, credit decisioning, sanction, and disbursement. The platform complies with RBI Master Directions on KYC (2016/2023), Digital Lending Guidelines (2022), and UIDAI eKYC regulations.

The system replaces a 14-year-old legacy platform with average TAT of 21 days (home loans) and 9 days (personal loans). Target post-LOS: 45 minutes (personal), 5 days (home).

---

## 2. Problem Statement

**For Applicants:** No self-service channel. Physical document submission. No real-time tracking. KYC re-done for every product.

**For Loan Officers:** Manual data entry into CBS (3.2 errors/application). No automated decision support. Bureau pull takes 48 hours via email request.

**For Credit Analysts:** No centralized worklist. FOIR calculated manually. Decision rationale not captured.

**For Compliance:** Consent in physical forms. No field-level audit trail. Aadhaar data not masked — UIDAI breach risk.

**Quantified impact:** INR 12 Cr annual processing cost, 34% application abandonment, 8.7% CBS entry error rate, 3 RBI KYC observations in last audit.

---

## 3. Success Metrics

| Metric | Baseline | Target 6M | Target 12M |
|---|---|---|---|
| Personal loan TAT | 9 days | 4 hours | 45 min |
| Home loan TAT | 21 days | 10 days | 5 days |
| STP rate | 0% | 30% | 60% |
| Abandonment rate | 34% | 20% | 15% |
| CBS error rate | 8.7% | 0.5% | 0.1% |
| Digital KYC rate | 0% | 70% | 90% |
| Bureau pull TAT | 48 hours | 2 min | <1 min |
| KYC audit findings | 3/cycle | 0 | 0 |

---

## 4. Personas

### P1: Ravi Sharma — Retail Applicant (Tech-Savvy)
Age 34, Software Engineer, Pune. Income ₹1.2L/month. Wants ₹60L home loan. Prefers mobile self-service. Needs transparent tracking and quick decision.

### P2: Lakshmi Devi — Semi-Urban Applicant
Age 45, Kirana owner, Gulbarga. Income ₹45K/month (ITR). Wants ₹15L MSME loan. Low digital literacy. Relies on DSA. Needs WhatsApp updates.

### P3: Amit Kulkarni — Loan Officer
Age 28, Andheri Branch. Processes 9/day, target 15. Needs clear worklist, one-click bureau pull, auto FOIR calculation.

### P4: Priya Nair — Credit Analyst
Age 32, Regional Credit Centre. Needs complete applications, auto-calculated ratios, bureau summary, decision recommendation.

### P5: Ramesh Iyer — Branch Manager
Age 51, Coimbatore. Sanctions within delegated authority. Needs digital sanction workflow, delegation matrix, one-click letter generation.

### P6: Sunita Verma — Compliance Officer
Age 44, HO Mumbai. Read-only audit access. Needs consent log, immutable audit trail, Aadhaar access log.

---

## 5. Loan Products in Scope

| Product | Min | Max | Max Tenure | STP Target |
|---|---|---|---|---|
| Personal Loan (Salaried) | ₹50K | ₹25L | 60M | 45 min |
| Personal Loan (Self-Employed) | ₹1L | ₹15L | 48M | 4 hrs |
| Home Loan | ₹10L | ₹5Cr | 30 yrs | 5 days |
| Home Loan Top-Up | ₹1L | ₹50L | Remaining | 2 days |
| LAP | ₹5L | ₹2Cr | 15 yrs | 7 days |
| Two-Wheeler Loan | ₹30K | ₹3L | 48M | 30 min |
| Four-Wheeler Loan | ₹2L | ₹30L | 84M | 2 hrs |
| Gold Loan | ₹10K | ₹20L | 12M | 30 min |
| Education Loan | ₹1L | ₹75L | 15 yrs | 3 days |
| MSME Term Loan | ₹5L | ₹2Cr | 84M | 5 days |
| MUDRA Kishore/Tarun | ₹50K | ₹10L | 60M | 2 days |
| Kisan Credit Card | ₹25K | ₹3L | 12M | 3 days |

---

## 6. User Journeys

### Journey 1: Salaried Personal Loan — Straight-Through Processing

**Pre-conditions:** Active Aadhaar-mobile linkage. PAN-Aadhaar linked. CIBIL ≥ 720.

```
Step 1 — Application (2 min)
  Open app → select Personal Loan → OTP login
  Enter: ₹5L, 36 months, purpose "Medical"

Step 2 — Aadhaar eKYC (3 min)
  Enter Aadhaar number (encrypted) → UIDAI OTP → verify
  PAN verification via NSDL → name match 91% ✓
  Selfie capture → face match score 88/100 ✓

Step 3 — Document Upload (5 min)
  System generates checklist: 3 salary slips, 3M bank statement
  Upload via camera → OCR validates fields → auto-populates form

Step 4 — Bureau Pull (1 min)
  Auto-trigger CIBIL + Experian with OTP consent
  CIBIL: 751, 0 DPD 24M, FOIR 32%, no write-off

Step 5 — Decision (<10 sec)
  47 rules evaluated — all PASS
  ML scorecard: 742/1000, Grade A, PD 1.2%
  Decision: APPROVE ₹5L @ 10.75% p.a., EMI ₹16,285

Step 6 — Sanction & eSign (5 min)
  Sanction letter + KFS displayed → Aadhaar eSign
  NACH mandate authorized

Step 7 — Disbursement (30 min)
  CBS customer created (SOAP) → loan account opened
  IMPS to salary account → UTR generated → SMS confirmation
```

### Journey 2: Home Loan
Day 0: Application + KYC + document upload
Day 1-2: Legal verification (empaneled lawyer)
Day 2-3: Technical valuation + field investigation
Day 4-5: Credit committee (if >₹50L) → sanction
Day 5: RTGS to builder/seller account

---

## 7. Functional Requirements

### Authentication (FR-AUTH)
- FR-AUTH-001: OTP login via SMS/WhatsApp for applicants
- FR-AUTH-002: LDAP/AD SSO for bank staff
- FR-AUTH-003: 8-role RBAC enforcement
- FR-AUTH-004: Account lock after 5 failed OTP attempts (30 min)
- FR-AUTH-005: Remote session revocation
- FR-AUTH-006: JWT 15-min expiry, refresh token 7-day expiry

### KYC (FR-KYC)
- FR-KYC-001: Aadhaar eKYC via UIDAI AUA/KUA licensed integration
- FR-KYC-002: Aadhaar offline XML as fallback
- FR-KYC-003: PAN verification via NSDL ITD API; Aadhaar-PAN linkage check
- FR-KYC-004: Face match minimum threshold 70/100
- FR-KYC-005: Liveness detection (anti-spoofing)
- FR-KYC-006: KYC reuse within 10 years (low-risk customer) per RBI
- FR-KYC-007: Aadhaar number stored as SHA-256 hash only
- FR-KYC-008: Aadhaar photo AES-256 encrypted, role-based access

### Application (FR-APP)
- FR-APP-001: 12 loan products with product-specific field sets
- FR-APP-002: Duplicate detection — same PAN + product within 30 days
- FR-APP-003: Auto-save draft every 60 seconds
- FR-APP-004: Application number: LOS-{YYYY}-{STATE}-{SEQNO}
- FR-APP-005: Co-applicants (max 3), guarantors (max 2)
- FR-APP-006: FOIR validation and warning at entry
- FR-APP-007: State machine — enforce valid transitions only
- FR-APP-008: Field-level audit trail for all updates

### Documents (FR-DOC)
- FR-DOC-001: Product-specific document checklists
- FR-DOC-002: OCR for salary slips, bank statements, PAN, Aadhaar
- FR-DOC-003: Watermark all documents: "FOR LOAN PURPOSE ONLY – [AppNo]"
- FR-DOC-004: Max 10MB; PDF, JPG, PNG accepted
- FR-DOC-005: DigiLocker integration for ITR, PAN, driving licence, vehicle RC
- FR-DOC-006: AES-256 encryption at rest in object storage with versioning

### Credit Bureau (FR-BUR)
- FR-BUR-001: Pull from CIBIL, Experian, Equifax, CRIF High Mark
- FR-BUR-002: OTP-confirmed timestamped consent before pull
- FR-BUR-003: Retry 3x with exponential backoff on timeout
- FR-BUR-004: No duplicate pull within 30 days (same PAN)
- FR-BUR-005: Encrypted bureau report storage; logged consent for access
- FR-BUR-006: Display: score, DPD, active accounts, total exposure, enquiries

### Decision Engine (FR-DEC)
- FR-DEC-001: Configurable rule engine (47 base rules)
- FR-DEC-002: Hard-stop rules trigger immediate rejection
- FR-DEC-003: ML scorecard for salaried personal + vehicle loans
- FR-DEC-004: Auto-calculate FOIR, LTV, age at maturity
- FR-DEC-005: Manual override by Branch Manager/Credit Head with reason
- FR-DEC-006: Maker-checker for sanctions above ₹10L
- FR-DEC-007: Immutable decision audit trail

### Loan & Disbursement (FR-LOAN)
- FR-LOAN-001: CBS customer creation via SOAP (Finacle/BaNCS)
- FR-LOAN-002: Auto CBS loan account creation post acceptance
- FR-LOAN-003: Amortization schedule generation and display
- FR-LOAN-004: Multi-tranche disbursement (up to 10 tranches, home loans)
- FR-LOAN-005: Payment via NEFT/RTGS/IMPS/UPI based on amount rules
- FR-LOAN-006: NACH mandate registration and debit tracking
- FR-LOAN-007: Digitally signed sanction letter and loan agreement

---

## 8. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Availability | Production uptime | 99.9% |
| Availability | Core APIs | 99.95% |
| Performance | P50 response time | <200ms |
| Performance | P95 response time | <500ms |
| Performance | P99 response time | <2000ms |
| Performance | Bureau pull E2E | <3 min |
| Performance | Decision engine | <10 sec |
| Scalability | Concurrent users | 10,000 |
| Scalability | Applications/day | 50,000 |
| Scalability | Peak throughput | 5,000 req/min |
| Data | Loan record retention | 10 years post closure |
| Data | Audit log retention | 10 years |
| Security | Encryption at rest | AES-256 |
| Security | Encryption in transit | TLS 1.3 |
| DR | RTO | 4 hours |
| DR | RPO | 30 minutes |

---

## 9. Regulatory Requirements

**RBI Digital Lending Guidelines (2022):** Direct disbursement to borrower only. KFS before acceptance. APR disclosure. 3-day cooling-off (≤₹50K).

**RBI KYC Master Direction (2023):** Re-KYC cycles: 10yr (low), 8yr (medium), 2yr (high). V-CIP acceptable. CKYCR upload mandatory.

**UIDAI Regulations:** OTP consent mandatory. No plain-text Aadhaar storage. AUA/KUA license required. 6-month transaction log.

**Data Localisation:** All data within India. AWS Mumbai (ap-south-1) or Azure Central India.

**PSL Tagging:** MSME/Agri/Education/Housing tagged for CRILC submission.

---

## 10. Out of Scope (v1.0)

- Post-disbursement LMS / collections / NPA management
- Credit card origination
- NRI/FEMA applications (v2.0)
- Vernacular beyond Hindi/English (v2.0)
- Full Account Aggregator integration (partial in v1.0)

---

## 11. Release Milestones

| Release | Scope | Target |
|---|---|---|
| v0.1 MVP | Auth, KYC, Application, Document upload | M3 |
| v0.5 | Bureau pull, Decision engine, Manual sanction | M5 |
| v0.8 | CBS integration, Disbursement, NACH | M7 |
| v1.0 GA | Full personal loan + vehicle loan STP | M9 |
| v1.5 | Home loan + MSME + Gold loan | M12 |
| v2.0 | NRI, Account Aggregator, Vernacular | M18 |

---
*End of PRD v2.0*
