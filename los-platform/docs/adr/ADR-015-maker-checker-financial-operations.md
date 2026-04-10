# ADR-015: Maker-Checker for Financial Operations

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

RBI guidelines require segregation of duties for critical financial operations: disbursement of loan amounts, interest rate overrides, and manual credit decisions. A single person should not be able to initiate AND approve a financial transaction. The system must enforce: role-based access (maker role ≠ checker role), two-step workflows, audit trail for both maker and checker actions, and rejection with reason.

---

## Decision

The LOS Platform implements **maker-checker** across three critical operations:

### 1. Disbursement

| Step | Actor | Action |
|------|-------|--------|
| Initiate | `LOAN_OFFICER` | Creates disbursement record (`status: PENDING`) |
| Maker | `DISBURSEMENT_MAKER` | Reviews, corrects beneficiary details, initiates payment |
| Checker | `DISBURSEMENT_CHECKER` | Reviews, approves → `PAYMENT_INITIATED` or rejects |

```typescript
// integration-service: DisbursementService
async initiateDisbursement(dto: DisbursementInitDto) {
  // Role check: must have disbursement:maker scope
  // Creates record with status: PENDING_CBS
  // Returns to workflow for checker approval
}
```

### 2. Manual Credit Decision Override

| Step | Actor | Action |
|------|-------|--------|
| Request | `BRANCH_MANAGER` or `CREDIT_ANALYST` | Requests override → `OVERRIDE_PENDING` |
| Approve | `ZONAL_CREDIT_HEAD` | Reviews justification, approves → decision updated |
| Reject | `ZONAL_CREDIT_HEAD` | Rejects with reason → `OVERRIDE_REJECTED` |

```typescript
// decision-engine: DecisionEngineService
async requestOverride(dto: OverrideRequestDto, userId: string) {
  // Creates OverrideRequest with status: PENDING
  // Captures: requestedDecision, amount deviation, justification, authorityLevel
}
async approveOverride(dto: OverrideApproveDto, approverId: string) {
  // Role check: ZONAL_CREDIT_HEAD only
  // Updates decision record
  // Emits Kafka event
}
```

### 3. DSA Partner Approval

| Step | Actor | Action |
|------|-------|--------|
| Register | DSA Partner | `POST /dsa/auth/register` → `PENDING_APPROVAL` |
| Review | `LOAN_OFFICER` or `ADMIN` | `GET /dsa/admin/partners` |
| Approve/Reject | `LOAN_OFFICER` or `ADMIN` | `PATCH /dsa/admin/partners/:id/approve` |

---

## Consequences

### Positive
- **RBI compliance**: segregation of duties enforced at the code level
- **Audit trail**: both maker and checker actions are logged with timestamps and user IDs
- **Role clarity**: scopes (`disbursement:maker`, `disbursement:checker`) prevent misuse
- **Automatic rejection**: unapproved requests expire after configurable timeout
- **Kafka events**: all state changes are event-sourced for audit

### Negative
- **Latency**: two-step process adds time to disbursement
- **Single point of failure**: if no checker is available, disbursements queue up
- **Complexity**: code must track workflow state (PENDING → APPROVED/REJECTED)
- **Override abuse**: makers may request excessive overrides if not monitored

### Mitigations
- Prometheus alert: `HighOverrideRequestRate (>15% conditional)` → Credit team notified
- Audit dashboard for compliance officers to review all override requests
- SLA: checker must act within 4 hours during business hours
- Audit log captures both maker and checker user IDs for every state change

---

## Related Decisions

- ADR-004: JWT + OTP Authentication
- ADR-011: DSA Channel Partner Model
