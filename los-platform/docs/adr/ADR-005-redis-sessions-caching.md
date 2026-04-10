# ADR-005: Redis for Sessions and Caching

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform has 8 microservices, some of which need shared state (rate limiting, OTP request counts, idempotency keys, session data). Additionally, repeated expensive computations (EMI calculations, bureau score lookups) should be cached to reduce load on PostgreSQL and external APIs.

---

## Decision

Redis (via `ioredis`) is used as a shared, global service across all backend microservices:

### Uses

| Use Case | Key Pattern | TTL | Details |
|----------|-------------|-----|---------|
| Rate limiting | `ratelimit:otp:{mobile}` | 1 hour | Counter, max 10 |
| Idempotency | `idempotency:{key}` | 24 hours | Prevents duplicate POST requests |
| OTP session | Not in Redis | — | Stored in PostgreSQL (`otp_sessions`) |
| EMI cache | `emi:{hash(principal,rate,tenure)}` | 5 min | Short TTL for calculation caching |
| Bureau cache | `bureau:{panHash}` | 1 hour | Avoid duplicate bureau pulls |
| JWT blacklist | `jwt:blacklist:{jti}` | Until token expiry | For logout |
| OTP attempt | `otp_attempts:{mobile}` | 30 min | Count failed verifications |

### Implementation

`RedisModule` (`backend/common/src/redis/redis.module.ts`) is a **global** module — all services get `REDIS_CLIENT` injected without explicit import. Configuration via environment variables (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`).

---

## Consequences

### Positive
- **Shared state across services**: rate limiting works across all 8 services
- **Reduced latency**: EMI cache saves ~50ms per calculation
- **Idempotency**: `IdempotencyMiddleware` prevents duplicate loan applications
- **JWT logout**: tokens can be blacklisted immediately
- **Simplicity**: single Redis connection string across all services

### Negative
- **Single point of failure**: Redis unavailable → rate limiting breaks, idempotency middleware fails
- **Cache invalidation**: stale bureau scores could lead to incorrect decisions
- **Connection overhead**: 8 services × Redis connections = connection pool sizing needed
- **TTL management**: cache invalidation requires careful TTL tuning

### Mitigations
- Redis `retryStrategy` with exponential backoff (max 2s)
- `maxRetriesPerRequest: 3` on all Redis calls
- Circuit breaker fallback when Redis is unavailable
- TTLs chosen carefully: 5min for EMI (financial data), 1hr for bureau (balance between freshness and performance)
- Redis health check in docker-compose before backend services start
- Prometheus alerts for Redis memory >85%, OOM, connection errors

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-003: Kafka as Event Bus
