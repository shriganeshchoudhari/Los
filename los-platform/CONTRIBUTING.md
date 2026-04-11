# Contributing to LOS Platform

Thank you for contributing to the Loan Origination System. This document outlines the workflow, standards, and expectations for contributors.

---

## Table of Contents

1. [Branching Strategy](#branching-strategy)
2. [Commit Messages](#commit-messages)
3. [Pull Requests](#pull-requests)
4. [Code Review](#code-review)
5. [Development Setup](#development-setup)
6. [Running Tests](#running-tests)
7. [Code Standards](#code-standards)
8. [Security Requirements](#security-requirements)
9. [Adding New Services](#adding-new-services)
10. [Database Migrations](#database-migrations)
11. [Documentation](#documentation)

---

## Branching Strategy

```
main          ← Production (locked, requires PR + 2 reviewers)
develop       ← Integration branch (feature branches merge here)
feature/*     ← Feature development (e.g., feature/dsa-commission-tracker)
bugfix/*      ← Bug fixes (e.g., bugfix/otp-rate-limit)
hotfix/*      ← Urgent production fixes (branches from main, merges to main + develop)
```

**Rules:**
- Never commit directly to `main` or `develop`.
- Feature branches target `develop`.
- Hotfix branches target `main`, then merge back into `develop`.
- Branch names: `kebab-case`, max 64 chars. Include ticket ID when applicable:
  - `feature/TASK-123-loan-amount-validation`
  - `bugfix/TASK-456-otp-expiry-bug`
  - `hotfix/fix-cors-origin`

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructure, no feature/fix |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Build scripts, CI, dependencies |
| `revert` | Reverting a previous commit |
| `infra` | Infrastructure, Docker, K8s |

**Scope:** Use the service name or module affected:
- `feat(auth): add LDAP group sync`
- `fix(loan): correct EMI rounding for leap years`
- `docs(api): update bureau endpoint description`
- `chore(k8s): add readiness probe to loan-service`

**Subject rules:**
- Imperative mood: "add feature" not "added feature"
- No period at end
- Max 72 characters
- Reference ticket ID in footer: `Refs: TASK-123`

**Examples:**
```
feat(kyc): implement Aadhaar face liveness detection
fix(decision): correct LTV calculation for top-up loans
test(loan): add E2E for PDD checklist approval flow
refactor(integration): extract bureau client into common lib
chore: bump ts-jest from 29.1.2 to 29.2.0
```

---

## Pull Requests

### Before Opening a PR

1. **Sync with target branch** — rebase on `develop` (or `main` for hotfixes).
2. **Self-review** — run all checks locally before requesting review.
3. **Keep scope small** — one feature or fix per PR. Large PRs are harder to review.
4. **Fill out the PR template** completely.

### PR Template

```markdown
## Summary
<!-- What does this PR do? 2-3 sentences. -->

## Changes
<!-- Bullet list of specific changes made. -->

## Testing
<!-- How was this tested? Include test commands and results. -->

## Screenshots / API Changes
<!-- UI changes: screenshots. API changes: Postman or curl examples. -->

## Checklist
- [ ] Code follows project conventions (lint passes, typecheck passes)
- [ ] Unit tests added/updated (target 95% coverage on changed modules)
- [ ] E2E tests pass (if flow is end-to-end affected)
- [ ] No secrets or credentials in code
- [ ] Aadhaar/PII data is hashed, never stored in plain text
- [ ] Migration is backward-compatible (no column drops in same release)
- [ ] API docs updated (OpenAPI YAML + Postman collection)
- [ ] Kubernetes manifests updated (if applicable)
- [ ] Security impact considered (OWASP Top 10 implications)
```

### PR Size Guidelines

| Size | Lines Changed | Review Time |
|------|--------------|-------------|
| XS | < 50 | 10 min |
| S | 50–200 | 30 min |
| M | 200–500 | 1 hr |
| L | 500–1000 | 2 hr (break into smaller PRs if possible) |
| XL | > 1000 | Requires architecture discussion |

---

## Code Review

### Reviewers
- **All PRs** require at least 1 reviewer (2 for changes to `main`).
- Reviews must be requested from the relevant team.
- Security-sensitive changes (auth, KYC, payment, RBAC) require at least 2 reviewers, including the security owner.

### Review Checklist (for reviewers)

- [ ] Does the code do what the description says?
- [ ] Are there tests for the new logic?
- [ ] Are edge cases handled? (null, empty, negative, overflow)
- [ ] Are API contracts consistent? (request/response schemas match across services)
- [ ] Is sensitive data (Aadhaar, PAN, bank account) handled correctly?
- [ ] Are Kafka events emitted with correct topic and schema version?
- [ ] Are error codes descriptive and consistent?
- [ ] Does migration degrade gracefully (additive changes first)?
- [ ] Are logs free of PII?
- [ ] Do new env vars have defaults or are they required?
- [ ] Do Kubernetes manifests have resource limits and health checks?

### Response Time
- Initial review: within 1 business day.
- Re-review after changes: within 4 hours.

---

## Development Setup

### Prerequisites

- Docker Desktop 4.x
- Node.js 20+
- Git

### Initial Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd los-platform

# 2. Start all infrastructure (PostgreSQL, Redis, Kafka, MinIO)
docker compose -f devops/docker/docker-compose.yml up -d

# 3. Run database migrations (all 9 per-service databases)
bash database/migrations/migration-runner.sh --env dev

# 4. Seed reference data (rates, rules, templates)
docker exec -it los-backend psql -U los_user -d los_shared \
  -f database/seeds/00_seed_config.sql

# 5. Backend: install + start in watch mode
cd backend
cp .env.example .env   # Edit .env with your values
npm install
npm run start:dev

# 6. Frontend: install + start
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Auth | 3001 | http://localhost:3001 |
| KYC | 3002 | http://localhost:3002 |
| Loan | 3003 | http://localhost:3003 |
| Document | 3009 | http://localhost:3009 |
| Decision Engine | 3004/3005 | http://localhost:3005 |
| Integration | 3006 | http://localhost:3006 |
| Notification | 3007 | http://localhost:3007 |
| DSA | 3008 | http://localhost:3008 |

### Environment Files

- **Backend**: `backend/.env` (copy from `.env.example`)
- **Frontend**: `frontend/.env.local` (copy from `.env.local.example`)
- **Never commit** `.env`, `.env.local`, or `*.local` files.

---

## Running Tests

### Backend

```bash
cd backend

# All unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# E2E tests (requires running Docker services)
npm run test:e2e

# Single E2E suite
npm run test:e2e:auth
npm run test:e2e:loan
npm run test:e2e:kyc
npm run test:e2e:dsa
npm run test:e2e:document

# Type check
npm run typecheck

# Lint
npm run lint
```

### Frontend

```bash
cd frontend

# Unit tests (Vitest)
npm run test

# E2E tests (Playwright) — requires services running
npx playwright test

# Security tests (Playwright — OWASP Top 10)
npx playwright test tests/security/security.spec.ts
```

### Load Testing

```bash
cd devops/k6

# Smoke test (all services, 1 VU, 30s)
npx k6 run smoke-test.ts

# Stress test (loan endpoint, ramp up to 100 VUs)
npx k6 run --vus=100 --duration=2m stress-test.ts

# Soak test (sustained load for 1 hour)
npx k6 run --vus=50 --duration=1h soak-test.ts
```

---

## Code Standards

### TypeScript

- Strict mode enabled (`"strict": true` in all `tsconfig.json` files).
- No `any` — use `unknown` with type guards.
- All API contracts (request/response DTOs) must be defined as interfaces or classes with decorators.
- No `console.log` in production code — use the NestJS logger.
- Named exports preferred over default exports (except for Next.js pages).
- Import order: external → internal → relative.

### NestJS Conventions

- Each service follows the standard module/controller/service/repository structure.
- DTOs go in `src/` alongside the service, not in a separate `dto/` folder.
- Use `class-validator` decorators for all API input validation.
- Use `class-transformer` for DTO-to-entity transformations.
- All async operations must properly handle errors with try/catch or `.catch()`.
- Use the shared `common` library for guards, interceptors, and decorators — do not duplicate.

### Database

- All schema changes go through migrations in `database/migrations/`.
- Never modify an already-applied migration — create a new one.
- Migrations must be backward-compatible for zero-downtime deployments.
- Use snake_case for all database identifiers (tables, columns, constraints).
- Always add an `updated_at` trigger to new tables.
- No DB-level foreign keys across service boundaries (use UUID columns + application-level integrity).
- No plain-text PII storage — Aadhaar numbers must be SHA-256 hashed.

### API Design

- Follow REST conventions: `GET` (list/retrieve), `POST` (create), `PATCH` (partial update), `PUT` (full replace), `DELETE`.
- Use proper HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 422, 429, 500.
- All responses use the standard envelope: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- Pagination: cursor-based for large datasets. Use `limit`/`offset` for admin lists.
- Idempotency keys on all POST endpoints that create or modify financial data.

---

## Security Requirements

- **Never commit secrets, credentials, or API keys** — use `.env` files and HashiCorp Vault in production.
- **Aadhaar numbers** — SHA-256 hash only. Never store the plaintext value.
- **Audit logging** — all state-changing operations must emit an `audit_logs` entry (handled by the `AuditInterceptor`).
- **RBAC enforcement** — all endpoints must declare required roles via `@Roles()` decorator.
- **Input validation** — all user input must be validated with `class-validator` before processing.
- **Rate limiting** — OTP and auth endpoints are rate-limited per IP and per mobile number.
- **No SQL in string concatenation** — use parameterized queries (TypeORM QueryBuilder or repository methods).
- **SSRF protection** — external URL fetching must validate against an allowlist.
- Run `npm audit` before updating any dependency. Report vulnerabilities per `SECURITY.md`.

---

## Adding New Services

1. Create the NestJS service scaffold:
   ```bash
   cd backend
   npx nx generate @nestjs/schematics:application my-new-service
   ```
2. Add the service to `backend/package.json` workspaces array.
3. Create its database migration in `database/migrations/0XX_<service>_schema.sql`.
4. Add Docker Compose service definition in `devops/docker/docker-compose.yml`.
5. Add Kubernetes manifest in `devops/k8s/base/`.
6. Add to GitHub Actions CI matrix in `.github/workflows/ci.yml`.
7. Add to Kustomize overlays (`dev/`, `uat/`, `prod/`).
8. Add to `apis/openapi/los-platform-api.yaml` and `apis/postman/`.
9. Add E2E test scaffold in `backend/test/e2e/`.
10. Update `README.md`, `backend/README.md`, and this file.

---

## Database Migrations

### Creating a New Migration

Migrations are SQL files in `database/migrations/`. Follow the naming convention:

```
0XX_<service>_feature_description.sql
```

Example: `011_loan_topup_schema.sql`

### Migration Guidelines

1. **Never alter existing columns** in a backward-incompatible way during the same release cycle.
2. **Always include** the `schema_migrations` insert at the end:
   ```sql
   INSERT INTO schema_migrations (migration_id) VALUES ('011_loan_topup_schema');
   ```
3. **Use `CREATE TABLE IF NOT EXISTS`** and `ALTER TABLE ADD COLUMN IF NOT EXISTS` for idempotent migrations.
4. **Test migrations** on a seeded dev database before merging.

### Running Migrations

```bash
# All services
bash database/migrations/migration-runner.sh --env dev

# Specific service
bash database/migrations/migration-runner.sh --env dev --service=loan

# Dry run
bash database/migrations/migration-runner.sh --env prod --dry-run

# TypeScript runner (alternative)
cd backend && npm run migrate -- --env dev --service=loan
```

---

## Documentation

- **API changes** require updating:
  - `apis/openapi/los-platform-api.yaml` (OpenAPI 3.0 spec)
  - `apis/postman/LOS_Platform_API.postman_collection.json`
  - `apis/http/los-api-tests.http`
- **Architecture decisions** are documented as ADRs in `docs/adr/ADR-NNN_description.md`.
- **Database schema** is self-documenting through comments in migration files.
- **Service READMEs** exist for `backend/` and `frontend/` — keep them current.
- **Kubernetes changes** require updating both the base manifest and all three overlays (dev, uat, prod).

---

## Getting Help

- **Setup issues**: Check `README.md` and `backend/README.md` first.
- **Database questions**: See `database/README.md`.
- **API questions**: See `apis/README.md`.
- **Security concerns**: See `SECURITY.md` — do NOT file public issues for vulnerabilities.
- **General questions**: Open a discussion on the repository.

---

*Last updated: Phase 49 — Migration runner + CONTRIBUTING.md*
