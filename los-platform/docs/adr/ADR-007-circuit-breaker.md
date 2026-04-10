# ADR-007: Circuit Breaker for External APIs

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform integrates with multiple external services that are outside the bank's control:
- **UIDAI Aadhaar API**: government service, may be slow or unavailable
- **NSDL PAN API**: may timeout during peak hours
- **Credit Bureaus (CIBIL, Experian, Equifax, CRIF)**: financial data APIs with variable SLA
- **Finacle CBS**: core banking system, critical but can be slow
- **NPCI (IMPS/NEFT/RTGS/UPI/NACH)**: payment infrastructure, 24/7 but can have outages

A cascading failure (slow external API → thread pool exhaustion → local service crash) would take down the entire LOS.

---

## Decision

A **custom circuit breaker** (`backend/common/src/utils/circuit-breaker.util.ts`) wraps all external API calls in integration-service and kyc-service.

### States

| State | Behavior |
|-------|----------|
| CLOSED | Normal operation; requests pass through |
| OPEN | After `failureThreshold` consecutive failures; requests fail immediately with `CircuitOpenError` |
| HALF_OPEN | After `openDuration` elapses; allows `halfOpenRequests` through to test recovery |

### Configuration per integration

```typescript
DEFAULT:   { failureThreshold: 5, successThreshold: 2, timeout: 5000,  openDuration: 30000,  halfOpenRequests: 3 }
UIDAI:     { failureThreshold: 3, successThreshold: 2, timeout: 10000, openDuration: 60000,  halfOpenRequests: 2 }
NSDL:      { failureThreshold: 3, successThreshold: 2, timeout: 8000,  openDuration: 60000,  halfOpenRequests: 2 }
CIBIL:     { failureThreshold: 3, successThreshold: 2, timeout: 15000, openDuration: 120000, halfOpenRequests: 1 }
NPCI:      { failureThreshold: 2, successThreshold: 3, timeout: 3000,  openDuration: 30000,  halfOpenRequests: 5 }
```

### Health monitoring

`GET /integration/health/metrics` exposes circuit breaker state for each integration. Prometheus alerting rules fire when `CircuitBreakerOpen > 0` for 5 minutes.

---

## Consequences

### Positive
- **Cascading failure prevention**: slow/failed bureau API does not exhaust loan-service threads
- **Graceful degradation**: when bureau is OPEN, new applications can proceed without bureau check
- **Self-healing**: automatic recovery after `openDuration` elapses
- **Observability**: circuit state is metrics-exported and alerted on
- **Tail latency reduction**: requests to OPEN circuits fail fast (no waiting)

### Negative
- **Complexity**: circuit breaker logic adds mental overhead when debugging
- **Race conditions**: during HALF_OPEN, some requests may still fail
- **Fallback responsibility**: callers must handle `CircuitOpenError` with a fallback strategy
- **Threshold tuning**: wrong thresholds can cause false opens or delayed opens

### Mitigations
- Graceful mock fallbacks when circuit is OPEN (bureau returns `status: PENDING`)
- Prometheus `CircuitBreakerOpen` metric + alert: `CircuitBreakerOpen{integration="cibil"} > 0`
- Circuit breaker states exposed in Grafana dashboard panels
- Health metrics endpoint aggregates state across all integrations

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-003: Kafka as Event Bus
