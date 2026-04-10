# ADR-003: Kafka as Event Bus

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform has 8 microservices that need to communicate state changes asynchronously. Key cross-service workflows include: KYC completion → triggers bureau pull, Bureau pull complete → triggers credit decision, Decision approved → triggers sanction letter generation, eSign completed → triggers disbursement, PDD overdue → triggers recovery workflow.

The system must handle high throughput (1000+ applications/day at peak), guarantee at-least-once delivery for financial events, and provide auditability of all state transitions.

---

## Decision

Apache Kafka is the **central event bus**. All cross-service communication happens via Kafka topics. Synchronous REST calls are only used for synchronous user-facing operations (e.g., EMI calculation, KYC status check).

**Key topics** (defined in `backend/common/src/kafka/kafka.module.ts`):

| Topic | Producer | Consumers |
|-------|----------|-----------|
| `los.application.submitted` | loan-service | kyc-service, decision-engine |
| `los.kyc.completed` | kyc-service | decision-engine, loan-service |
| `los.bureau.pull.completed` | integration-service | decision-engine, loan-service |
| `los.decision.completed` | decision-engine | loan-service, notification-service |
| `los.agreement.signed` | loan-service | loan-service (PDD listener) |
| `los.pdd.completed` | loan-service | integration-service (disbursement) |
| `los.tranche.disbursement_success` | integration-service | loan-service, notification-service |
| `los.dsa.application.created` | dsa-service | loan-service |
| `los.notification.*` | various | notification-service |

All Kafka messages include:
- `traceparent` / `X-Trace-Id` headers for distributed tracing
- `applicationId` as the primary correlation key
- `version` field for schema evolution

---

## Consequences

### Positive
- **Decoupling**: services are producers or consumers, not both aware of each other's APIs
- **Throughput**: Kafka handles bursts better than synchronous HTTP chains
- **At-least-once delivery**: idempotency keys on consumers ensure financial events are processed exactly once
- **Audit trail**: Kafka retention stores all events for replay and audit
- **Scalability**: consumers can be scaled independently per topic partition
- **Fan-out**: one event can trigger multiple downstream actions (e.g., `APPLICATION_SUBMITTED` → KYC + notification + analytics)

### Negative
- **Eventual consistency**: downstream services process events with some delay
- **Complexity**: Kafka cluster management, consumer group lag monitoring, dead-letter queues
- **Debugging difficulty**: tracing a request across 5 services via Kafka is harder than HTTP chains
- **Ordering**: only per-partition ordering guaranteed; applicationId as partition key ensures ordering per loan

### Mitigations
- OpenTelemetry trace context injected into Kafka headers (trace propagation)
- `KafkaLagPanel` in Grafana dashboard for real-time lag monitoring
- Kafka health checks in Prometheus alerting (no leader, high lag, producer errors)
- Dead-letter topic pattern for failed message handling
- Kafka service waits for `service_healthy` in docker-compose before starting

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-002: Database per Service Pattern
- ADR-010: OpenTelemetry for Distributed Tracing
