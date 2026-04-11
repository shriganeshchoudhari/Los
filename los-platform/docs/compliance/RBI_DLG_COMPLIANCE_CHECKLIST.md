# RBI Digital Lending Guidelines — Compliance Checklist

> **Reference:** RBI Circular No. RBI/2022-23/26 DOR.CRE.REC.No.21/18.10.002/2022-23 dated August 10, 2022  
> **Applies to:** All Digital Lending Products — Personal Loans, Home Loans, LAP, Business Loans  
> **Last reviewed:** [DATE]  
> **Review frequency:** Quarterly  
> **Owner:** Chief Compliance Officer (CCO)

---

## Overview

The RBI Digital Lending Guidelines (DLG) issued on August 10, 2022 apply to all Indian lenders offering digital lending products. Non-compliance attracts penalties under the RBI Act, 1934 and the Banking Regulation Act, 1949.

---

## Core Compliance Requirements

### 1. Key Facts Statement (KFS) — DLG Chapter III, Clause 6

**Requirement:** Every loan agreement must include a Key Facts Statement (KFS) before the sanction letter or loan agreement is presented to the borrower.

| # | Requirement | Status | Evidence | Last Verified |
|---|-------------|--------|----------|---------------|
| 1.1 | KFS displayed before sanction acceptance | ✅ Implemented | `frontend/src/app/application/[id]/sanction-letter/page.tsx` — `KFS_REVIEW` step | [DATE] |
| 1.2 | KFS includes Annual Percentage Rate (APR) | ✅ Implemented | APR displayed as "effective annual cost of credit" with all charges | [DATE] |
| 1.3 | KFS includes total amount payable | ✅ Implemented | Principal + interest + fees + GST breakdown shown | [DATE] |
| 1.4 | KFS includes processing fee + GST | ✅ Implemented | Processing fee shown separately with 18% GST | [DATE] |
| 1.5 | KFS includes net disbursement amount | ✅ Implemented | "Net Disbursement (after fees)" shown | [DATE] |
| 1.6 | KFS includes cooling-off period notice for ≤₹50,000 | ✅ Implemented | 3-day cancellation right displayed for loans ≤₹50,000 | [DATE] |
| 1.7 | KFS includes EMI amount and tenure | ✅ Implemented | EMI, tenure, first/last EMI dates shown | [DATE] |
| 1.8 | KFS includes simple annual rate of interest | ✅ Implemented | "Rate of Interest (p.a.) Simple Annual Rate" label | [DATE] |

---

### 2. Cooling-Off Period — DLG Clause 6(3)

**Requirement:** For digital loans up to ₹50,000, borrowers must have the right to cancel the loan within 3 working days from disbursement without penalty.

| # | Requirement | Status | Evidence | Last Verified |
|---|-------------|--------|----------|---------------|
| 2.1 | Cooling-off notice shown for loans ≤₹50,000 | ✅ Implemented | `sanction-letter/page.tsx` — conditional rendering based on `sanctionedAmount <= 50000` | [DATE] |
| 2.2 | Notice explains 3 working day cancellation right | ✅ Implemented | "3 working days from date of disbursement" stated explicitly | [DATE] |
| 2.3 | No foreclosure charges during cooling-off period | ⚠️ Policy required | Backend state machine for 3-day cancellation window not yet implemented | [DATE] |
| 2.4 | Cancellation process documented and communicated | ⏳ Pending | Cancellation API endpoint not yet coded | [DATE] |

**Action items:**
- [ ] Implement backend `POST /applications/:id/cancel` endpoint with `CANCELLATION_WINDOW` status
- [ ] Add `cancellationInitiatedAt` and `cancellationDeadline` fields to loan application
- [ ] Add notification trigger (SMS + email) on cancellation
- [ ] Test cancellation flow end-to-end before UAT

---

### 3. Data Collection & Privacy — DLG Chapter II

**Requirement:** Only collect data necessary for the credit decision. Obtain explicit consent. Do not access device permissions without disclosure.

| # | Requirement | Status | Evidence | Last Verified |
|---|-------------|--------|----------|---------------|
| 3.1 | Privacy policy displayed before data collection | ✅ Implemented | Consent screen at application start | [DATE] |
| 3.2 | Consent records stored with timestamp and IP | ✅ Implemented | `consent_records` table with `consent_type`, `captured_at`, `ip_address` | [DATE] |
| 3.3 | No access to device contacts/camera/gallery without consent | ⏳ Pending | Audit required — no camera/gallery access in current build | [DATE] |
| 3.4 | Data retention policy documented (7 years for loans) | ✅ Implemented | Document metadata has 7-year retention flag | [DATE] |
| 3.5 | Right to erasure process documented | ⏳ Pending | Erasure SOP not yet written | [DATE] |

---

### 4. Credit Bureau Pull — DLG Chapter IV

**Requirement:** OTP-based consent mandatory before each credit bureau data pull. Written/named consent in consent records table.

| # | Requirement | Status | Evidence | Last Verified |
|---|-------------|--------|----------|---------------|
| 4.1 | OTP consent before CIBIL/Experian/Equifax/CRIF pull | ✅ Implemented | `consent_records` with `CREDIT_BUREAU_PULL` type, OTP verified | [DATE] |
| 4.2 | Audit trail of bureau pulls maintained | ✅ Implemented | `bureau_jobs` table with timestamps, scores, report URLs | [DATE] |
| 4.3 | Bureau consent separate from loan application consent | ✅ Implemented | Separate consent record per bureau pull | [DATE] |
| 4.4 | Consumer dispute rights communicated (CIBIL) | ⏳ Pending | Add dispute rights notice to bureau pull consent screen | [DATE] |

---

### 5. Fair Practices Code

**Requirement:** No dark patterns, no misleading advertisements, no doorstep recovery.

| # | Requirement | Status | Evidence | Last Verified |
|---|-------------|--------|----------|---------------|
| 5.1 | Loan terms not buried in fine print | ✅ Implemented | KFS prominently displayed | [DATE] |
| 5.2 | No penalty for early repayment without disclosure | ✅ Implemented | Prepayment terms shown in sanction letter | [DATE] |
| 5.3 | No auto-debit without NACH mandate with explicit consent | ✅ Implemented | NACH mandate requires wet signature or Aadhaar eSign | [DATE] |
| 5.4 | Grievance redressal mechanism published | ✅ Implemented | GRO contact in sanction letter and KFS | [DATE] |
| 5.5 | Recovery agents trained and supervised | ⏳ Policy | Agent training program and monitoring SOP required | [DATE] |

---

### 6. Sanction Letter & Loan Agreement

**Requirement:** Sanction letter must contain all material terms. eSign must be Aadhaar-based.

| # | Requirement | Status | Evidence | Last Verified |
|---|-------------|--------|----------|---------------|
| 6.1 | Sanction letter includes all material terms | ✅ Implemented | Full sanction letter with ROI, fees, tenure, prepayment, foreclosure | [DATE] |
| 6.2 | Loan agreement generated post sanction acceptance | ✅ Implemented | eSign flow only after KFS + sanction terms accepted | [DATE] |
| 6.3 | eSign via Aadhaar OTP (NSDL/CDSL licensed) | ✅ Implemented | sanction-letter page — NSDL eSign with OTP | [DATE] |
| 6.4 | Loan agreement PDF stored with hash in DB | ✅ Implemented | `document-service` stores SHA-256 hash with document | [DATE] |
| 6.5 | Sanction letter valid for minimum period communicated | ✅ Implemented | `validUntil` date shown in KFS and sanction letter | [DATE] |

---

### 7. Lending through Online Platforms / DLAs

> **Note:** This section applies only if loans are disbursed through any Digital Lending App (DLA) or platform not owned by the bank.

| # | Requirement | Status | Evidence | Last Verified |
|---|-------------|--------|----------|---------------|
| 7.1 | If DLA used: DSA agreements disclosed to RBI | N/A | Not applicable — direct bank lending only | [DATE] |
| 7.2 | If DLA used: customer grievances routed to bank GRO | N/A | Not applicable | [DATE] |

---

## Periodic Reporting Requirements

| Requirement | Frequency | Owner | Template |
|-------------|-----------|-------|----------|
| Digital Lending Data (DL-1) submitted to RBI | Half-yearly (Jan/Jul) | Analytics Team | RBI DL-1 format |
| Customer complaints summary | Quarterly | CCO | Internal report |
| GRO effectiveness review | Quarterly | CCO + Ops | GRO report |
| Fair Practices Code compliance audit | Annual | CCO + Internal Audit | Audit report |

---

## Audit Evidence Checklist (for RBI inspection)

- [ ] Screenshots of KFS display (web + mobile)
- [ ] Sample loan agreements with KFS attached
- [ ] Consent records for 10 randomly sampled applications
- [ ] Bureau pull audit trail for sampled applications
- [ ] GRO complaint log for last 12 months
- [ ] DL-1 returns filed with RBI
- [ ] VAPT report from empanelled firm
- [ ] UIDAI AUA audit report

---

## Next Review

| Review date | Reviewer | Findings |
|-------------|----------|----------|
| [DATE] | CCO | [PENDING] |

---

## Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Chief Compliance Officer | [NAME] | [EMAIL] | [PHONE] |
| Grievance Redressal Officer | [NAME] | gro@bankname.com | 1800-XXX-XXXX |
| RBI Liaison | [NAME] | [EMAIL] | [PHONE] |
| UIDAI Nodal Officer | [NAME] | [EMAIL] | [PHONE] |
