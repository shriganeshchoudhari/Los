# ADR-009: OpenTelemetry Distributed Tracing

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform has 8 microservices communicating via REST and Kafka. When a loan application takes 10 seconds instead of 2 seconds, the operations team needs to identify which service (or external API) introduced the delay. Kafka message propagation across multiple services creates traces that span many seconds and multiple services.

Traditional logging (per-service log files) cannot correlate a trace ID across all 8 services in real-time.

---

## Decision

**OpenTelemetry** (OTel) is the observability backbone. Every service is instrumented with automatic and manual spans.

### Implementation

`backend/common/src/tracing/tracing.ts` provides:
- `initTracing(serviceName)`: initializes OTLP exporter, BatchSpanProcessor, B3 + W3C propagators
- `getTracer()`: singleton tracer per service
- `getTraceId()` / `getSpanId()`: helpers for logging
- `shutdownTracing()`: graceful shutdown on SIGTERM

**Auto-instrumented**: HTTP (Express), PostgreSQL (pg), Redis (ioredis), KafkaJS (Kafka produce/consume)

**Manual spans**: Kafka message handlers create child spans, external API calls have named spans (e.g., `CibilClient.pullReport`)

**Kafka header propagation**: `backend/common/src/tracing/kafka-propagation.ts`:
- `injectTraceIntoKafkaHeaders()`: adds `traceparent`, `X-Trace-Id`, `X-Span-Id` to outgoing Kafka messages
- `extractTraceFromKafkaHeaders()`: reads trace context from incoming Kafka messages
- Results in full trace DAG: HTTP request → loan-service → Kafka event → kyc-service → Kafka event → decision-engine

**Response headers**: all HTTP responses include `traceparent`, `X-Trace-Id`, `X-Span-Id` via `TracingMiddleware`

### Backend

| Component | Product | Endpoint |
|-----------|---------|----------|
| Trace storage | Tempo (Grafana Cloud / self-hosted) | OTLP gRPC on port 4317 |
| Metrics | Prometheus | Scraped from `/metrics` endpoint |
| Logs | Loki | Promtail scrapes K8s logs |
| Dashboards | Grafana | Links logs → traces → metrics |

### Configuration

```yaml
OTEL_SERVICE_NAME: loan-service
OTEL_EXPORTER_OTLP_ENDPOINT: http://tempo:4317
OTEL_TRACES_SAMPLER: parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG: "0.1"  # 10% sampling in prod, 100% in dev
OTEL_PROPAGATORS: b3,tracecontext
```

---

## Consequences

### Positive
- **End-to-end visibility**: single trace ID spans HTTP → Kafka → multiple services
- **Performance debugging**: Grafana Explore links latency spike to specific slow span
- **Error correlation**: exceptions tagged with trace ID appear in Loki logs
- **No vendor lock-in**: OTel is CNCF standard, exporter can switch backends
- **Zero code change for auto-instrumentation**: just `initTracing()` call in main.ts

### Negative
- **Sampling complexity**: 100% trace collection is expensive; sampling must be tuned
- **Kafka trace propagation**: consumer creates new span for each batch, not each message
- **Storage cost**: Tempo storage grows with trace volume
- **Performance overhead**: ~0.5ms per request for span creation

### Mitigations
- Parent-based sampling: if parent is sampled, children are too (no orphan spans)
- Tail-based sampling in Tempo for error traces (always capture failed requests)
- 10% sampling in production (sufficient for performance analysis)
- 100% sampling in dev/uat
- Grafana dashboard links logs (Loki) → traces (Tempo) via trace ID regex

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-003: Kafka as Event Bus
- ADR-011: Prometheus + Grafana for Monitoring
