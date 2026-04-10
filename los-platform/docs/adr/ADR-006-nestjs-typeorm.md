# ADR-006: NestJS + TypeORM

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

All 8 backend microservices need a consistent framework for building REST APIs, managing dependency injection, handling validation, and interfacing with PostgreSQL. The team has TypeScript expertise and needs to maintain high developer velocity.

---

## Decision

**NestJS** is the framework for all backend microservices. **TypeORM** is the ORM for all database access.

### NestJS patterns used

- **Modules**: each service is organized into feature modules (auth, kyc, loan, etc.)
- **Controllers**: one controller per resource with standard REST verbs
- **Services**: business logic encapsulated in services, injected into controllers
- **Guards**: `RolesGuard` for RBAC, `JwtAuthGuard` for authentication
- **Interceptors**: `AuditInterceptor` for logging, `LoggingInterceptor` for request tracing
- **Filters**: global `HttpExceptionFilter` for consistent error responses
- **Pipes**: `ValidationPipe` (whitelist, transform, forbidNonWhitelisted) on all endpoints
- **Decorators**: custom `@Roles()`, `@SkipAuth()`, `@CurrentUser()` decorators

### TypeORM patterns used

- **One entity file per table** in `src/entities/`
- **Synchronize: false** in all production configs (migrations manage schema)
- **Index definitions** on frequently queried columns (e.g., `applicationId + status`, `mobileHash + expiresAt`)
- **Entity events**: `@CreateDateColumn`, `@UpdateDateColumn` for audit timestamps
- **JSONB columns** for flexible data (e.g., `rawResponse`, `requestPayload`, `responsePayload`)

### Shared package: `@los/common`

All services share `common/` workspace package (`backend/common/src/`) containing:
- Kafka service and topic constants
- Redis module and client
- JWT strategy and guards
- Audit service and entity
- Metrics service (prom-client)
- Tracing utilities (OpenTelemetry)
- Circuit breaker implementation
- Custom decorators, filters, guards, pipes
- Shared DTOs and interfaces (e.g., `AuthenticatedRequest`)

Published as a local workspace package, imported via `import { ... } from '@los/common'`.

---

## Consequences

### Positive
- **Consistency**: all 8 services follow the same patterns, making onboarding faster
- **DI container**: NestJS's IoC makes testing with `TestingModule` straightforward
- **TypeORM**: entity types flow through to controllers → better TypeScript safety
- **Decorator-based auth**: clean separation of concerns, easy to add new roles
- **Validation**: `class-validator` + `ValidationPipe` ensures DTOs are always sanitized
- **OpenAPI**: `@nestjs/swagger` generates live API docs from decorators

### Negative
- **Bundle size**: NestJS adds ~2MB overhead per service
- **Learning curve**: decorators and module system require familiarity
- **Magic**: DI container can make debugging harder when dependencies are complex
- **TypeORM performance**: complex queries benefit from raw SQL tuning

### Mitigations
- Docker multi-stage builds keep production images lean
- NestJS `TestingModule` + `jest.createTestingModule()` for clean unit testing
- TypeORM `QueryBuilder` for complex joins
- OpenAPI docs at `/api/docs` for each service

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-002: Database per Service Pattern
