# UIDAI AUA/KUA — Audit & Compliance Checklist

> **Reference:** UIDAI Circular on Audit Requirements for AUAs/KUAs  
> **License type:** AUA (Authentication Service Provider) — License No.: [LICENSE_NUMBER]  
> **KUA sub-license:** Yes / No  
> **Last audit:** [DATE]  
> **Next audit due:** [DATE + 1 year]  
> **Auditor:** [AUDITOR_NAME], CERT-In empanelled  
> **Owner:** UIDAI Nodal Officer / IT Security Team

---

## Overview

All entities performing Aadhaar-based authentication (eKYC, eSign) must comply with UIDAI's data security requirements, undergo annual third-party audits by CERT-In empanelled auditors, and submit audit reports to UIDAI within 30 days of audit completion.

**Critical deadlines:**
- Annual audit: within 12 months of previous audit
- Report submission to UIDAI: within 30 days of audit completion
- Corrective Action Plan (CAP): submitted within 60 days of audit findings

---

## A. Authentication Infrastructure

| # | Requirement | UIDAI Clause | Status | Evidence | Notes |
|---|-------------|-------------|--------|----------|-------|
| A.1 | Registered AUA with UIDAI (license valid and current) | CSA Agreement | ✅ Verified | License No.: [LICENSE_NUMBER] | Renewal due: [DATE] |
| A.2 | KUA sub-license obtained if providing limited KYC | KUA guidelines | ⚠️ Verify | [PENDING if applicable] | Only if doing limited KYC |
| A.3 | PSA (Payment Settling Agency) agreement if settling payments | UIDAI | ⚠️ Verify | [PENDING if applicable] | Not applicable for LOS |
| A.4 | NSDL eSign license valid and current (for eSign) | eSign guidelines | ✅ Verified | License No.: [NSDL_LICENSE] | Renewal due: [DATE] |
| A.5 | Authentication devices (ASAs/ASPs) registered with UIDAI | | ✅ Verified | Registered ASA: [NAME] | |
| A.6 | OTP generation via UIDAI OTP API only (no third-party OTP for Aadhaar auth) | | ✅ Verified | OTP via `auth-service` → UIDAI OTP API | Karza/Signzy handle OTP via their ASA |
| A.7 | No biometric storage — OTP-only authentication flow | UIDAI Circular 2017 | ✅ Verified | No biometric data stored; only SHA-256 hash of Aadhaar number | |

---

## B. Data Handling & Storage

| # | Requirement | UIDAI Clause | Status | Evidence | Notes |
|---|-------------|-------------|--------|----------|-------|
| B.1 | Aadhaar number stored as SHA-256 hash only | UIDAI Circular 2017 | ✅ Verified | `aadhaar_number_hash` CHAR(64) in `kyc_records` table | No plaintext Aadhaar |
| B.2 | Demographic data stored with AES-256 encryption at rest | Security Std | ✅ Verified | `aadhaar_demographic` column — AES-256 JSONB | |
| B.3 | Encryption keys stored separately from encrypted data | Security Std | ⚠️ Verify | KMS/Vault integration pending | |
| B.4 | No Aadhaar data stored on mobile devices | UIDAI | ✅ Verified | Backend only; no mobile SDK | |
| B.5 | Data retention: Aadhaar data deleted after KYC verification | UIDAI | ⚠️ Verify | Retention policy SOP not yet documented | |
| B.6 | No Aadhaar data shared with third parties without consent | UIDAI | ✅ Verified | No third-party sharing; Karza/Signzy only for OTP | |
| B.7 | Data Centre located in India (RBI data localisation) | | ✅ Verified | AWS ap-south-1 (Mumbai) | |
| B.8 | Data encrypted in transit (TLS 1.2+) | Security Std | ✅ Verified | All service-to-service communication over HTTPS/TLS | |
| B.9 | Document copies stored with same encryption as Aadhaar data | UIDAI | ✅ Verified | AES-256 encrypted in MinIO/S3 | |
| B.10 | Aadhaar data access logged with IP, timestamp, user ID | UIDAI | ✅ Verified | `audit_logs` table with actor_id, IP, timestamp | |

---

## C. eKYC Flow Compliance

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| C.1 | Explicit consent obtained before eKYC | ✅ Implemented | `consent_records` with `EKYC` type, timestamp, IP |
| C.2 | Consent screen shows UIDAI logo and data use disclosure | ⚠️ Pending | Consent UI needs UIDAI logo and "Used for KYC only" text |
| C.3 | OTP-based authentication (no biometric capture/store) | ✅ Implemented | OTP-only flow via UIDAI OTP API |
| C.4 | Face match result stored (not raw image) | ✅ Implemented | Face match score stored; images not retained |
| C.5 | eKYC XML / response not stored beyond KYC completion | ⚠️ Pending | XML currently stored in `kyc_records` — review retention |
| C.6 | PAN linked correctly post-eKYC | ✅ Implemented | PAN verification via Karza API post-Aadhaar verification |

---

## D. Access Control & Audit

| # | Requirement | UIDAI Clause | Status | Evidence |
|---|-------------|-------------|--------|----------|
| D.1 | MFA required for all systems accessing Aadhaar data | Security Std | ✅ Implemented | RBAC + JWT auth for all services |
| D.2 | Privileged access reviewed quarterly | Security Std | ⚠️ Pending | Access review SOP not yet documented |
| D.3 | All access to Aadhaar data logged (who/when/IP/purpose) | UIDAI | ✅ Verified | `audit_logs` table — 90-day retention |
| D.4 | Logs not modifiable/deleted by application users | Security Std | ⚠️ Verify | Log immutability via S3 Object Lock pending |
| D.5 | Incident response plan for Aadhaar data breach | UIDAI | ⚠️ Pending | Incident runbook includes breach notification |
| D.6 | Breach notification to UIDAI within 24 hours | UIDAI | ⚠️ Pending | SOP for 24-hr notification to UIDAI + MeitY |

---

## E. Network & Infrastructure Security

| # | Requirement | UIDAI Clause | Status | Evidence |
|---|-------------|-------------|--------|----------|
| E.1 | Perimeter firewall between internet and Aadhaar auth systems | Security Std | ✅ Implemented | AWS Security Groups + WAF |
| E.2 | Intrusion Detection/Prevention System (IDS/IPS) | Security Std | ⚠️ Pending | WAF enabled; IDS/IPS pending |
| E.3 | Annual penetration testing by CERT-In empanelled firm | UIDAI | ⚠️ Pending | VAPT required (in Phase 7 roadmap) |
| E.4 | Patch management policy (critical patches within 24h) | Security Std | ⚠️ Pending | Patch SOP not yet documented |
| E.5 | Database activity monitoring (DAM) | Security Std | ⚠️ Pending | CloudWatch Logs + GuardDuty pending |
| E.6 | TLS 1.3 preferred, TLS 1.2 minimum for all connections | Security Std | ✅ Verified | TLS 1.3 on ALBs |

---

## F. CKYC Compliance (Post-KYC Upload)

> **Reference:** CERSAI CKYC Portal — Master Direction on KYC  
> **Applicable to:** All loan customers (except specific exemptions)

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| F.1 | KYC data uploaded to CKYC within prescribed timelines | ⚠️ Not coded | `kyc-service` does not yet include CKYC upload |
| F.2 | CKYC reference number stored in application record | ⚠️ Not coded | Field not in `kyc_records` table |
| F.3 | 30-day timeline for CKYC upload (from KYC completion) | ⚠️ Pending | Not yet enforced in workflow |
| F.4 | XML upload via CKYC portal API | ⚠️ Pending | CKYC portal API integration not coded |

**Action items:**
- [ ] Add `ckyc_reference_number` field to `kyc_records` and `kyc_schema.sql` migration
- [ ] Implement CKYC XML generation in `kyc-service`
- [ ] Integrate with CKYC portal API for upload
- [ ] Add CKYC upload status tracking in application workflow
- [ ] Add SLA monitoring (30-day upload deadline)

---

## G. Annual Audit — Evidence Required

| Evidence Item | Format | Submitted |
|---------------|--------|-----------|
| Network diagram showing Aadhaar auth flow | Visio/PDF | [ ] |
| Data flow diagram (Aadhaar data) | Visio/PDF | [ ] |
| List of all systems with Aadhaar data access | Excel | [ ] |
| Access control matrix (who accesses what) | Excel | [ ] |
| List of all third parties with Aadhaar data access | Excel | [ ] |
| Consent records sample (10 applications) | Screenshots + DB export | [ ] |
| Audit logs sample (access by 5 users) | Log export | [ ] |
| Encryption key management SOP | Word/PDF | [ ] |
| Incident response plan | Word/PDF | [ ] |
| VAPT report (if conducted) | PDF | [ ] |
| UIDAI license copy | PDF | [ ] |
| NSDL eSign license copy | PDF | [ ] |
| List of encryption keys and rotation schedule | Excel | [ ] |

---

## Non-Compliance Findings — Previous Audit

| Finding ID | Description | Severity | Status | CAP Submitted | CAP Deadline |
|-----------|-------------|----------|--------|---------------|--------------|
| [ID-001] | [DESCRIPTION] | [HIGH/MEDIUM/LOW] | [OPEN/CLOSED] | [DATE] | [DATE] |

---

## UIDAI Reporting Calendar

| Report | Frequency | Deadline | Owner |
|--------|-----------|----------|-------|
| Annual Audit Report to UIDAI | Annual | 30 days post-audit | CCO + IT Security |
| Corrective Action Plan | As needed | 60 days post-audit | IT Security |
| AUA License Renewal | Annual | 60 days before expiry | Legal |
| NSDL eSign License Renewal | Annual | 60 days before expiry | Legal |
| CKYC upload stats | Monthly | 7th of next month | Ops Team |

---

## Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| UIDAI Nodal Officer | [NAME] | [EMAIL] | [PHONE] |
| UIDAI Grievance Officer | [NAME] | [EMAIL] | [PHONE] |
| IT Security Head | [NAME] | [EMAIL] | [PHONE] |
| eKYC Service Provider (Karza) | [NAME] | [EMAIL] | [PHONE] |
| eSign Provider (NSDL) | [NAME] | [EMAIL] | [PHONE] |
