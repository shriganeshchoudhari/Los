# Architecture Decision Records — Index

> This directory contains Architecture Decision Records (ADRs) for the LOS Platform.
> ADRs document significant architectural decisions, the context that drove them,
> and their consequences. New ADRs should be added here as they are created.

## Format

ADRs follow the [Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
- **Status**: Proposed / Accepted / Deprecated / Superseded
- **Context**: The problem or situation that necessitated a decision
- **Decision**: What was decided
- **Consequences**: Both positive and negative effects

## ADRs

| # | Title | Status | Key Decision |
|---|-------|--------|-------------|
| ADR-001 | [Microservices Architecture](ADR-001-microservices-architecture.md) | Accepted | 8 services with dedicated DBs per service |
| ADR-002 | [Database per Service Pattern](ADR-002-database-per-service.md) | Accepted | Each service owns its PostgreSQL database |
| ADR-003 | [Kafka as Event Bus](ADR-003-kafka-event-bus.md) | Accepted | Async cross-service communication via Kafka |
| ADR-004 | [JWT + OTP Authentication](ADR-004-jwt-otp-authentication.md) | Accepted | Bank employees: LDAP+JWT; Customers: OTP+JWT; DSA: separate JWT namespace |
| ADR-005 | [Redis for Sessions and Caching](ADR-005-redis-sessions-caching.md) | Accepted | Global Redis for rate limiting, idempotency, caching |
| ADR-006 | [NestJS + TypeORM](ADR-006-nestjs-typeorm.md) | Accepted | NestJS framework + TypeORM ORM across all services |
| ADR-007 | [Circuit Breaker for External APIs](ADR-007-circuit-breaker.md) | Accepted | Custom circuit breaker protecting external API calls |
| ADR-008 | [MinIO for Document Storage](ADR-008-minio-document-storage.md) | Accepted | S3-compatible object storage for documents, agreements, eSign |
| ADR-009 | [OpenTelemetry Distributed Tracing](ADR-009-opentelemetry-tracing.md) | Accepted | OTel with Kafka header propagation for cross-service traces |
| ADR-010 | [Prometheus + Grafana for Monitoring](ADR-010-prometheus-grafana-monitoring.md) | Accepted | Metrics, alerting, SLO definitions across all services |
| ADR-011 | [DSA Channel Partner Model](ADR-011-dsa-channel-partner-model.md) | Accepted | Separate dsa-service with isolated auth, DB, commission tracking |
| ADR-012 | [eSign + NSDL Integration](ADR-012-esign-nsdl-integration.md) | Accepted | NSDL eSign 2.0 with graceful fallback for offline scenarios |
| ADR-013 | [PDD Workflow](ADR-013-pdd-post-disbursement-documentation.md) | Accepted | Automated post-disbursement checklist, reminders, breach escalation |
| ADR-014 | [GitHub Actions for CI/CD](ADR-014-github-actions-cicd.md) | Accepted | GHA pipelines: lint → test → docker build → K8s deploy |
| ADR-015 | [Maker-Checker for Financial Operations](ADR-015-maker-checker-financial-operations.md) | Accepted | Two-step approval for disbursements and manual credit decisions |
| ADR-016 | [Credit Decision Engine](ADR-016-credit-decision-engine.md) | Accepted | Hybrid rules engine + ML model with full explainability |
| ADR-017 | [Security & RBI Compliance](ADR-017-security-rbi-compliance.md) | Accepted | Encryption, RBAC, audit logging, Aadhaar handling, consent capture |

---

## Deprecated ADRs

None currently.

## Superseded ADRs

None currently.

---

## Creating a New ADR

1. Copy this template:
```
# ADR-NNN: Title

**Status:** Proposed  
**Date:** YYYY-MM-DD  
**Deciders:** LOS Platform Architecture Team

---

## Context



## Decision



## Consequences

### Positive



### Negative



## Related Decisions

- ADR-001: ...
```

2. Save as `ADR-NNN-title-slug.md` in this directory
3. Update this index with the new ADR
4. Submit for review (PR)

## When to Create an ADR

Create an ADR when a decision:
- Affects multiple services
- Involves a technology choice with significant consequences
- Has no easy rollback path
- Requires team-wide coordination
- Is mandated by regulatory requirements
