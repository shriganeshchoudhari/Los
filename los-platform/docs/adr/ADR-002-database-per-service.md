# ADR-002: Database per Service Pattern

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

Each microservice in the LOS Platform must own its data completely. The system handles sensitive financial and personal data (PAN, Aadhaar, income, credit scores) subject to RBI data residency and audit requirements. Multiple teams need to evolve their data models independently without coordinating schema changes across service boundaries.

---

## Decision

Each service connects to its **own dedicated PostgreSQL database**:

```
auth-service        → los_auth
kyc-service         → los_kyc
loan-service        → los_loan
decision-engine     → los_decision
integration-service → los_integration
notification-service→ los_notification
document-service    → los_document
dsa-service         → los_dsa
```

- TypeORM is the ORM for all services
- Migrations are managed per-service (Flyway via `database/migrations/`)
- Seeding scripts run per-service (`backend/scripts/seed.ts`)
- Cross-service data sharing happens via **Kafka events** (not direct DB queries)
- The `loan-application-id` (UUID) is the correlation key across services

---

## Consequences

### Positive
- **Service independence**: each team owns their schema, no cross-team migration coordination
- **Failure isolation**: a DB issue in integration-service does not affect auth-service
- **Security isolation**: bank auditors can be given access to only specific service DBs
- **Performance**: each service can tune its own indexes, connection pool, and query patterns
- **RBI compliance**: clear data ownership per service simplifies data residency and audit trails

### Negative
- **No ACID transactions across services**: distributed sagas needed for multi-service workflows
- **Data duplication**: application data is denormalized across services (e.g., `applicantId` stored in multiple DBs)
- **Reporting complexity**: cross-service reporting requires a data warehouse or event sourcing
- **Consistency model**: eventual consistency, not immediate consistency

### Mitigations
- Kafka events carry the `applicationId` to correlate records across services
- Idempotency keys on all Kafka consumers prevent duplicate processing
- The loan-service is the system of record for application status; other services reference it via events
- Audit log (`@los/common`) provides cross-service event history

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-003: Kafka as Event Bus
