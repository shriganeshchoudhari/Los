# LOS Platform Backend

NestJS monorepo with 8 microservices + shared common library.

## Services

| Service | Port | DB Schema | Key Responsibilities |
|---------|------|-----------|-------------------|
| `auth-service` | 3001 | `los_auth` | OTP, JWT (RS256), LDAP, sessions |
| `kyc-service` | 3002 | `los_kyc` | Aadhaar eKYC, PAN verify, face match, DigiLocker |
| `loan-service` | 3003 | `los_loan` | Applications, EMI calculator, sanction letters, agreements, PDD |
| `document-service` | 3004 | `los_document` | Presigned URLs, OCR pipeline, watermarking |
| `decision-engine` | 3005 | `los_decision` | 47-rule engine, ML scorecard, credit decisions |
| `integration-service` | 3006 | `los_integration` | Bureau, CBS, NACH, disbursement (IMPS/NEFT/RTGS) |
| `notification-service` | 3007 | `los_notification` | SMS (Kaleyra/Gupshup), email, templates |
| `dsa-service` | 3008 | `los_dsa` | DSA partner portal, officer management, commissions |

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15 (via Docker)
- Redis Sentinel
- Apache Kafka

### Local Development

```bash
cd backend

# Install dependencies
npm install

# Copy environment files
cp .env.example .env  # Edit as needed

# Run all services in watch mode
npm run start:dev

# Run a specific service
npm run start:dev --workspace=@los/auth-service

# Build for production
npm run build

# Run tests
npm run test
npm run test:e2e
npm run typecheck
npm run lint
```

### Docker

```bash
cd devops/docker
docker compose up -d
```

All services, databases, Kafka, Redis, and MinIO start automatically.

## Common Library (`common/`)

The `common` workspace contains shared code used by all services:

```
common/src/
├── auth/           # JWT service, RBAC guards, role decorators
├── kafka/           # KafkaJS client, topics, producers, consumers
├── metrics/        # Prometheus metrics helpers
├── tracing/         # OpenTelemetry trace/span helpers
├── types/           # Shared TypeScript types (enums, DTOs, entities)
└── utils/          # Common utilities (formatting, validation, etc.)
```

## Adding a New Service

1. Create the service in `backend/`:
   ```bash
   nx g @nrwl/nest:application my-service
   ```

2. Add to `package.json` `workspaces`:
   ```json
   "my-service"
   ```

3. Add to `nx.json` `projects` map.

4. Create migration in `database/migrations/011_my_service_schema.sql`.

5. Add to `docker-compose.yml` with correct `DB_NAME` and port.

6. Add to GitHub Actions CI/CD workflow.

## Database Migrations

Each service has its own schema and migration file:

```
database/migrations/
├── 001_initial_schema.sql  # ⚠️ DEPRECATED — monolithic, do not use
├── 002_auth_schema.sql     # los_auth schema
├── 003_loan_schema.sql     # los_loan schema
├── 004_kyc_schema.sql      # los_kyc schema
├── 005_decision_schema.sql  # los_decision schema
├── 006_integration_schema.sql
├── 007_document_schema.sql
├── 008_notification_schema.sql
├── 009_dsa_schema.sql
└── 010_shared_schema.sql    # audit_logs (shared across all services)
```

**Run migrations:**
```bash
bash database/migrations/migration-runner.sh --env dev
bash database/migrations/migration-runner.sh --env dev --service auth-service  # single service
bash database/migrations/migration-runner.sh --dry-run                      # preview only
```

## Inter-Service Communication

Services communicate via:
1. **HTTP** (synchronous) — for request/response patterns (e.g., Decision Engine → Loan Service for context)
2. **Kafka** (async) — for event-driven patterns (e.g., application submitted → KYC initiated)

### Kafka Topics

| Topic | Publisher | Consumer |
|-------|-----------|----------|
| `los.application.submitted` | loan-service | kyc-service |
| `los.kyc.completed` | kyc-service | loan-service |
| `los.documents.reviewed` | document-service | loan-service |
| `los.decision.completed` | decision-engine | loan-service |
| `los.agreement.signed` | loan-service | disbursement-service |
| `los.disbursement.success` | integration-service | notification-service |
| `los.esign.completed` | loan-service | loan-service (PDD trigger) |

## Configuration

Each service uses `ConfigService` from `@nestjs/config`. Key config sources:
- `.env` file (local dev)
- Docker environment variables (production)
- HashiCorp Vault (production secrets)

### Important Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `NODE_ENV` | all | `development` enables mock data |
| `JWT_PRIVATE_KEY_PATH` | auth | Path to RSA private key |
| `KAFKA_BROKERS` | all | Comma-separated broker list |
| `REDIS_URL` | auth | Redis Sentinel URL |
| `DB_NAME` | all | Per-service database name |
| `DECISION_SERVICE_URL` | loan-service | For sanction letter fetches |
| `LOAN_SERVICE_URL` | decision-engine | For application context |

## Security

- **JWT (RS256)** — Access tokens (15 min) + Refresh tokens (7 days)
- **OTP** — bcrypt hashed, 5-min TTL, Redis storage
- **RBAC** — Role decorators on all protected endpoints
- **Aadhaar** — SHA-256 hashed, AES-256 encrypted photos in MinIO
- **Circuit Breakers** — on all external API calls (UIDAI, NSDL, CIBIL)
- **Audit Logs** — all state changes logged to `los_shared.audit_logs`

## Testing

```bash
# All tests
npm run test -- --all

# Specific service
npm run test --workspace=@los/auth-service

# E2E tests
npm run test:e2e
npm run test:e2e:auth     # Auth only
npm run test:e2e:loan     # Loan lifecycle only
npm run test:e2e:kyc      # KYC + Bureau only
npm run test:e2e:dsa       # DSA portal only
npm run test:e2e:document  # Document management only

# Coverage
npm run test:cov -- --all
```

## Performance

- **Connection pooling:** Each service has dedicated PostgreSQL pool (10-50 connections)
- **Kafka consumer groups:** Isolated consumer groups per service for parallel processing
- **Circuit breakers:** 5xx errors trigger 50% open, 10 failures → full open
- **Idempotency:** All state-changing operations are idempotent via Redis keys
