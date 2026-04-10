# ADR-010: Prometheus + Grafana for Monitoring

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform must maintain 99.5% SLA (per SLO definitions). Operations team needs to detect degradation within minutes, not hours. The system has 8 microservices + Kafka + PostgreSQL + Redis + MinIO — too many moving parts for manual monitoring.

---

## Decision

**Prometheus** (metrics collection) + **Grafana** (visualization) + **Alertmanager** (notifications) + **Loki** (log aggregation).

### Prometheus metrics per service

Every service exposes `/metrics` (Prometheus format) via `prom-client`:

| Metric type | Examples |
|------------|---------|
| Counter | `http_requests_total`, `bureau_pulls_total`, `kyc_verifications_total`, `kafka_messages_produced_total` |
| Histogram | `http_request_duration_seconds`, `bureau_pull_latency_seconds`, `db_query_duration_seconds` |
| Gauge | `kafka_consumer_lag`, `pdd_overdue_count`, `circuit_breaker_state`, `postgres_connections_active` |
| Summary | `http_request_size_bytes`, `emi_calculations_total` |

### Grafana dashboards

| Dashboard | Panels | Purpose |
|-----------|--------|---------|
| backend-overview.json | 21 | Service health, latency, error rate, Kafka lag |
| business-metrics.json | 18 | KPIs: applications, approvals, disbursements, FOIR |
| los-platform-dashboard.json | 40+ | Application funnel, KYC funnel, decision outcomes, PDD |

### Alerting rules

`devops/k8s/base/prometheus-rules/los-alerts.yaml` — 30+ rules across 7 groups:
- **Availability**: `ServiceDown`, `MultipleServicesDown`
- **Latency**: `HighLatencyP95`, `CriticalLatencyP99`
- **Kafka**: `ConsumerLagHigh`, `NoLeader`, `ProducerErrorRate`
- **Database**: `ConnectionExhausted`, `SlowQueries`, `ReplicationLag`
- **Redis**: `RedisOOM`, `RedisConnectionErrors`
- **Business**: `BureauPullSuccessRateLow`, `DisbursementSuccessRateLow`
- **SLO**: `AvailabilitySLOBreaching`, `LatencySLOBreaching`

### SLO definitions

`devops/k8s/base/prometheus-rules/los-slos.yaml` — 9 SLOs with error budget burn-rate alerts:
- Availability: 99.5% → 0.5% error budget → 14x/6x/3x burn rate alerts
- Auth: 99.9%
- Decision Engine: 99.8%
- Latency P95: 1.5s
- Bureau Pull Latency: 5s

### Alert routing

| Severity | Channel |
|----------|---------|
| Critical | PagerDuty (24/7) |
| Warning | Slack #platform-alerts |
| Info | Slack #platform-notifications |

---

## Consequences

### Positive
- **Proactive alerting**: operations team alerted before customers notice
- **Trend analysis**: Grafana dashboards show week-over-week performance
- **SLO accountability**: error budget tracking makes reliability measurable
- **Correlation**: Grafana Explore links logs → traces → metrics
- **Self-hosted**: no SaaS cost for metrics/logs (Tempo/Loki on-prem)

### Negative
- **Alert fatigue**: too many alerts can overwhelm operations team
- **Prometheus HA**: single Prometheus instance is a SPOF for metrics
- **Cardinality explosion**: too many label dimensions (e.g., `endpoint`) can crash Prometheus
- **Retention**: long-term metrics storage requires VictoriaMetrics or Thanos

### Mitigations
- Alert grouping and deduplication in Alertmanager
- Grafana recording rules for expensive queries
- Prometheus PVC for metrics persistence
- Severity tiers: P1 (PagerDuty), P2 (Slack), P3 (Slack #info)

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-009: OpenTelemetry for Distributed Tracing
