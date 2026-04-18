# ADR-018: NestJS to Spring Boot Migration

**Status:** Accepted  
**Date:** 2026-04-12  
**Deciders:** LOS Platform Architecture Team

---

## Context

The NestJS backend has unresolvable TypeScript decorator build failures. Despite multiple debugging sessions, the TypeScript compiler throws `TS1241` (unable to resolve signature of method decorator), `TS1270` (decorator return type incompatibility), and `TS1206` (decorators not valid here) across all 8 services.

Root cause: The combination of `@nestjs/swagger@^7.2.0`, `reflect-metadata@^0.2.1`, and `typescript@^5.3.0` creates an unresolvable decorator version conflict when compiled in Docker's multi-stage build environment. The `lib.decorators.legacy.d.ts` from TypeScript conflicts with NestJS's custom decorator implementations.

Attempts to fix:
1. `tsconfig` adjustments (target, lib, experimentalDecorators ordering) — failed
2. Package version downgrades (reflect-metadata, typescript, @nestjs/swagger) — failed
3. `reflect-metadata` import ordering in `main.ts` — failed
4. `skipLibCheck: true` in tsconfig — fails silently (decorator errors persist)
5. `@types/node-sok` removal — creates new dependency problems

The NestJS codebase is production-quality (99% complete, all services, no stubs) but the build cannot succeed in Docker.

---

## Decision

Rewrite the entire backend as a **single monolithic Spring Boot application** (Java 21, Maven).

### Architecture
- Single Maven JAR containing all 8 service modules
- Single port: **8080**
- Path-based routing: `/auth/**`, `/kyc/**`, `/applications/**`, etc.
- Single PostgreSQL database (`los_platform`) with **9 schemas**
- Spring Security with JWT (RS256, existing RSA keys preserved)
- Flyway for migrations
- Resilience4j for circuit breakers
- Spring Web Services (`WebServiceTemplate`) for SOAP integrations (CBS, eSign)
- Apache PDFBox for PDF generation (sanction letters, agreements)
- MinIO Java SDK for document storage
- Spring Kafka for event streaming (topics unchanged)
- Spring Data Redis for sessions/cache
- Micrometer/Prometheus for metrics
- springdoc-openapi for Swagger UI at `/swagger-ui.html`

### Why Monolithic Over Microservices?
The 8 NestJS services already have significant cross-service coupling:
- `decision-engine` makes HTTP calls to `loan-service`, `kyc-service`, `integration-service`
- `loan-service` handles sanction letters that need data from multiple services
- Kafka topics already act as async coordination layer

A true microservices split would require redesigning inter-service communication. A monolith keeps all logic in one JVM (direct method calls) while preserving the same API contract. Services can be split later if needed.

### Database: 9 Schemas in 1 DB
PostgreSQL schemas act as namespaces. Each module uses `@Table(schema = "auth")`, etc. This:
- Eliminates coordination overhead of 9 separate DB connections
- Preserves logical service isolation for RBAC and auditing
- Simplifies Flyway migration management
- Allows bank auditors to get schema-level access

### Routing Strategy
Path-based routing (no gateway needed):
```
GET  /auth/otp/send         → AuthController
POST /kyc/aadhaar/init      → KycController
GET  /applications           → LoanApplicationController
POST /decisions/trigger      → DecisionController
POST /integration/bureau/pull → IntegrationController
POST /notifications/send      → NotificationController
POST /dsa/auth/login         → DsaController
POST /documents/presigned-url → DocumentController
```

### Frontend Impact: Zero Code Changes
The Next.js frontend only needs environment variable updates:
```
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:8080
NEXT_PUBLIC_KYC_SERVICE_URL=http://localhost:8080
NEXT_PUBLIC_LOAN_SERVICE_URL=http://localhost:8080
# ... all 8 services pointing to same port
```
JWT format (RS256) is identical. OTP flow unchanged. All DTO field names preserved.

### External APIs: WireMock Continues
The WireMock mock server (`devops/docker/mock-server/`) continues to work unchanged. All external API URLs in `application.yml` point to `mock-server:8080` in local dev.

---

## Consequences

### Positive
- **Build reliability**: Maven builds are deterministic and well-understood
- **Enterprise Java**: Team has strong Java expertise; better ecosystem for banking apps
- **Java 21 virtual threads**: Excellent concurrency for I/O-bound workloads (external API calls)
- **IDE support**: IntelliJ has superior Java/Maven support vs TypeScript/nx
- **Simpler deployment**: Single JAR vs 8 Docker images
- **No decorator conflicts**: JPA annotations don't have the same version issues
- **Same API contract**: Frontend unchanged (env vars only)

### Negative
- **Migration effort**: ~86 working days to port all services
- **Single point of failure**: One JVM means one crash affects all services
- **Database coupling**: All services share one DB (mitigated by schemas)
- **No true isolation**: Can't scale individual services independently
- **Existing NestJS work**: ~99% complete NestJS codebase becomes archived

### Mitigations
- Monolith can be split later with Spring Cloud Gateway if needed
- PostgreSQL schemas provide namespace isolation
- Kubernetes PodDisruptionBudgets protect availability
- Circuit breakers prevent cascade failures

---

## Migration Deliverables

| Phase | Work | Days | Status |
|-------|------|------|--------|
| 1 | Project scaffold + Common layer | 5 | ✅ DONE |
| 2 | Auth module | 7 | ✅ DONE |
| 3 | KYC module | 8 | ☐ |
| 4 | Loan module | 15 | ☐ |
| 5 | Decision engine | 9 | ☐ |
| 6 | Integration module | 11 | ☐ |
| 7 | Notification module | 7 | ☐ |
| 8 | DSA module | 6 | ☐ |
| 9 | Document module | 7 | ☐ |
| 10 | Docker + Compose | 4 | ☐ |
| 11 | Seed data | 1 | ☐ |
| 12 | Integration testing | 5 | ☐ |

**Total: ~86 working days (~4 months) with 5-person team**

---

## Related Decisions

- **ADR-001:** Updated — migration note added explaining monolith vs microservices
- **ADR-002:** Superseded by ADR-002b — single DB with 9 schemas
- **ADR-006:** NestJS Stack — marked SUPERSEDED by this ADR
- **ADR-003:** Kafka Event Bus — unchanged (topics, producers, consumers preserved)
- **ADR-004:** JWT + OTP Authentication — unchanged (same JWT format, same OTP flow)
