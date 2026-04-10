# ADR-012: eSign + NSDL Integration

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

RBI guidelines require electronic signatures on loan agreements for digital lending. The bank uses NSDL's eSign 2.0 API — an Aadhaar-based electronic signature service. The eSign flow requires: generating the agreement PDF, computing a SHA-256 hash of the document, redirecting the customer to NSDL's portal for OTP-based signing, and receiving a webhook callback with the signed document.

The signing flow must be idempotent (resending the same OTP should not create duplicate signatures), auditable (every signature attempt logged), and resilient (NSDL timeouts must not block disbursement).

---

## Decision

eSign is handled by `loan-service` via `eSignService` and `LoanAgreementController`.

### eSign flow

1. **Generate agreement** → `POST /loan-agreement/generate` → PDF stored in MinIO `los-agreements`
2. **Initiate signing** → `POST /loan-agreement/esign/initiate`:
   - Compute SHA-256 hash of PDF
   - Call NSDL `/sign` API with document hash + customer Aadhaar masked number
   - NSDL returns `transactionId` + `signingUrl` (redirect URL)
   - Create `loan_agreement_signatures` record with `AWAITING_ESIGN` status
   - Emit `los.esign.initiated` Kafka event
3. **Customer signs** → redirects to NSDL → enters OTP → NSDL signs PDF → callback to `/loan-agreement/esign/callback`
4. **Verify callback** → `POST /loan-agreement/esign/verify`:
   - NSDL returns signed PDF + certificate
   - Verify certificate chain
   - Update `loan_agreement_signatures.status` → `SIGNED`
   - Check if all signers signed → update `loan_agreement.status` → `FULLY_SIGNED`
   - Emit `los.agreement.signed` Kafka event → triggers PDD + disbursement
5. **Graceful fallback** → if NSDL API unavailable: generate mock transaction, store `status: MOCK_SIGNED`, log warning, emit `los.agreement.signed`

### Sanction letter

Generated at approval stage: `POST /sanction-letter/generate/:applicationId` → PDF stored in MinIO, served via presigned URL, includes: sanctioned amount, interest rate, tenure, EMI, terms & conditions.

---

## Consequences

### Positive
- **RBI compliance**: eSign satisfies digital lending regulations
- **Graceful degradation**: mock signing allows testing and demos without NSDL connectivity
- **Idempotency**: duplicate OTP verification does not create duplicate signature records
- **Audit trail**: every eSign attempt (initiated, completed, cancelled) is logged
- **Decoupled**: eSign completion → Kafka → triggers disbursement, not blocking HTTP call

### Negative
- **NSDL dependency**: eSign is unavailable if NSDL API is down
- **Customer friction**: requires Aadhaar-linked mobile for OTP
- **Certificate management**: NSDL certificates must be renewed periodically
- **Callback reliability**: NSDL webhook delivery is at-least-once; idempotency needed

### Mitigations
- Circuit breaker around NSDL calls (open after 3 failures, 60s recovery)
- Mock signing mode for UAT/dev environments
- Idempotency key on signature records prevents duplicate processing
- Manual override endpoint for operations team to force-sign in emergencies
- NSDL webhook re-called every 5 minutes on failure (retry logic)

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-007: Circuit Breaker for External APIs
- ADR-008: MinIO for Document Storage
