# ADR-011: DSA Channel Partner Model

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The bank distributes loans through Direct Sales Agents (DSAs) — third-party individuals or firms who source loan applications on the bank's behalf. DSAs need their own portal to submit applications, track status, manage officers, and view commissions. DSAs must not access the bank's internal loan processing portal.

The bank needs: separate authentication for DSAs, commission tracking per DSA/officer, application sourcing attribution, and a distinct application numbering scheme.

---

## Decision

A **dedicated `dsa-service`** manages all DSA operations with its own database (`los_dsa`) and JWT token namespace.

### Data model

```
dsa_partners:     Company details, PAN, GSTIN, status (PENDING_APPROVAL/APPROVED/REJECTED)
dsa_officers:    Employee details, linked to partner, status (ACTIVE/SUSPENDED)
dsa_applications: Loan applications submitted by this DSA/officer
dsa_commissions:  Commission earned per disbursed loan (calculated vs. paid)
```

### Application flow

1. **Partner registration** → `POST /dsa/auth/register` → status `PENDING_APPROVAL`
2. **Bank approval** → `PATCH /dsa/admin/partners/:id/approve` → status `APPROVED`
3. **Officer creation** → `POST /dsa/officers` (partner admin) → `DSAEMP{nnnn}` employee code
4. **Officer login** → `POST /dsa/officers/login` → JWT with `DSA_OFFICER` role
5. **Application submission** → `POST /dsa/applications` → app number `DSA{year}{6digits}` prefixed `DSA`
6. **Bank processing** → normal LOS workflow (KYC → bureau → decision → disbursement)
7. **Commission calculation** → on disbursement, `dsa_commission` row created with `loan_type * rate * amount`
8. **Commission payout** → bank processes monthly → `dsa_commission.paid_at` set

### Authentication

- **Separate JWT namespace**: `dsa_access_token` / `dsa_refresh_token` cookies (different from bank portal `access_token`)
- **Partner login**: `partnerCode + password` → JWT with `DSA_PARTNER` role
- **Officer login**: `employeeCode + password` → JWT with `DSA_OFFICER` role
- **No bank portal access**: DSA JWTs are validated by `dsa-service` only, cannot access `loan-service`, `kyc-service`, etc.

---

## Consequences

### Positive
- **Complete isolation**: DSA portal is a separate service with separate DB and JWT — cannot access bank data
- **Commission transparency**: DSAs can see exactly what they've earned and pending payouts
- **Attribution**: every application knows which DSA/officer sourced it
- **Scalable**: dsa-service scales independently from loan-service
- **Separate team ownership**: bank ops team manages DSA onboarding; credit team manages loan processing

### Negative
- **Data duplication**: application data exists in both `loan_applications` and `dsa_applications`
- **Separate auth system**: two JWT validation systems to maintain
- **Commission complexity**: multiple loan products with different commission rates
- **Compliance risk**: DSA officers could submit fraudulent applications — requires bank review before processing

### Mitigations
- `dsa_applications.application_id` references `loan_applications.id` — single source of truth for loan data
- Kafka event `DSA_APPLICATION_CREATED` triggers loan-service to create the actual loan application
- Commission rates stored per loan product in `loan_product_configs`
- Audit log captures all DSA actions

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-004: JWT + OTP Authentication
- ADR-002: Database per Service Pattern
