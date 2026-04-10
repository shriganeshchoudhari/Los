# LOS Platform — Loan Origination System

A production-grade microservices-based Loan Origination System for an Indian bank, built with NestJS, Next.js, PostgreSQL, Kafka, Redis, and MinIO.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (Kong)                       │
└──────┬───────┬───────┬───────┬───────┬───────┬──────┬──────┘
       │       │       │       │       │       │      │
   ┌───┴─┐ ┌──┴─┐ ┌───┴─┐ ┌───┴─┐ ┌───┴─┐ ┌───┴─┐  ┌──┴──┐
   │Auth │ │KYC │ │Loan │ │Docs │ │Dec. │ │Int. │  │DSA  │
   │:3001│ │:3002│ │:3003│ │:3004│ │:3005│ │:3006│  │:3008│
   └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘  └──┬──┘
      │       │       │       │       │       │       │
  ┌───┴───────┴───────┴───────┴───────┴───────┴───────┴───┐
  │                    Kafka Event Bus                     │
  └───┬───────┬───────┬───────┬───────┬───────┬───────────┘
      │       │       │       │       │       │
 ┌────┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──┐ ┌──┴──────┐
 │Redis  │ │Post-│ │Post-│ │Post-│ │Post-│ │PostgreSQL│
 │Sentinel│ │greSQL│ │greSQL│ │greSQL│ │greSQL│ │(Shared) │
 └───────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────────┘
```

## Services

| Service | Port | Database | Description |
|---------|------|----------|-------------|
| Auth Service | 3001 | `los_auth` | OTP (SMS/WhatsApp), JWT, LDAP, sessions |
| KYC Service | 3002 | `los_kyc` | Aadhaar eKYC, PAN verify, face match |
| Loan Service | 3003 | `los_loan` | Applications, EMI, sanction letters, agreements |
| Document Service | 3009 | `los_document` | Presigned URLs, OCR, watermarking, checklists |
| Decision Engine | 3005 | `los_decision` | Rule engine (47 rules), ML scorecard, decisions |
| Integration Service | 3006 | `los_integration` | Bureau (CIBIL/Experian/Equifax/CRIF), NACH, disbursement |
| Notification Service | 3007 | `los_notification` | SMS (Kaleyra/Gupshup), email templates |
| DSA Service | 3008 | `los_dsa` | DSA partner portal, officer management |

## Tech Stack

- **Backend:** NestJS, TypeORM, PostgreSQL 15, Kafka (KafkaJS), Redis Sentinel, MinIO
- **Frontend:** Next.js 14, React 18, Tailwind CSS, shadcn/ui, React Query, React Hook Form
- **Observability:** OpenTelemetry, Prometheus, Grafana, Jaeger
- **Infrastructure:** Docker Compose (local), Kubernetes (EKS), ArgoCD, GitHub Actions, Kong API Gateway, HashiCorp Vault

## Quick Start

### Prerequisites
- Docker Desktop 4.x
- Node.js 20+

### 1. Clone and start
```bash
git clone <repo>
cd los-platform

# Start all services (includes DBs, Kafka, Redis, MinIO)
docker compose -f devops/docker/docker-compose.yml up -d

# Run migrations
bash database/migrations/migration-runner.sh --env dev
```

### 2. Seed data
```bash
docker exec -it los-backend psql -U los_user -d los_shared -f /seeds/00_seed_config.sql
```

### 3. Access services
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Auth Service | http://localhost:3001 |
| KYC Service | http://localhost:3002 |
| Loan Service | http://localhost:3003 |
| Grafana | http://localhost:3009 |
| Jaeger | http://localhost:16686 |

### Development Credentials

**OTP Login (dev mode):**
- Mobile: `9876543210`
- OTP: `123456` (mock — bypasses actual SMS)

**Staff Login (LDAP):**
- Username: `loan_officer_01`
- Password: `BankPass123!`

**DSA Partner:**
- Partner Code: `ABC001`
- Password: `DSA@Pass123!`

## Project Structure

```
los-platform/
├── backend/                    # NestJS monorepo
│   ├── auth-service/          # Authentication
│   ├── kyc-service/            # KYC & identity verification
│   ├── loan-service/          # Loan applications & agreements
│   ├── document-service/       # Document management
│   ├── decision-engine/        # Credit decision engine
│   ├── integration-service/    # Bureau, CBS, NACH, disbursement
│   ├── notification-service/   # SMS/email notifications
│   ├── dsa-service/            # DSA partner portal
│   ├── common/                # Shared libs (Kafka, auth guards, metrics)
│   └── test/                   # E2E tests (Jest + Supertest)
├── frontend/                   # Next.js 14 app
│   └── src/
│       ├── app/               # App router pages
│       ├── components/        # UI components
│       ├── lib/                # API clients, utilities
│       ├── hooks/              # Custom React hooks
│       ├── services/           # Service-specific API clients
│       └── types/              # TypeScript type definitions
├── database/
│   ├── migrations/            # Per-service SQL migrations (002–010)
│   ├── schemas/                # Schema copies
│   └── seeds/                  # Seed data (benchmark rates, rules, templates)
├── devops/
│   ├── docker/                 # docker-compose.yml
│   ├── k8s/                    # Kubernetes manifests (dev/uat/prod)
│   ├── k6/                     # Load testing scripts
│   └── grafana-dashboards/
├── docs/
│   └── adr/                    # Architecture Decision Records (ADR-001–017)
├── apis/
│   ├── postman/               # Postman collection (85 requests)
│   ├── http/                  # VS Code REST Client file
│   └── openapi/              # OpenAPI 3.0 specification
└── scripts/                   # Utility scripts
```

## API Testing

**Postman:** Import `apis/postman/LOS_Platform_API.postman_collection.json`
- 85 requests across 13 folders covering all 8 services
- Collection variables for auth token chaining
- Test assertions on all endpoints

**VS Code REST Client:** Open `apis/http/los-api-tests.http`

See [apis/README.md](apis/README.md) for full API documentation.

## Loan Flow

```
OTP → Application Form → Submit
  → KYC (Consent → Aadhaar OTP → PAN → Face Match)
  → Documents (Upload → OCR → Review)
  → Credit Decision (Bureau Pull → Rules + ML Scorecard)
  → Sanction Letter (Review → Accept)
  → Loan Agreement (Generate → NSDL eSign)
  → NACH Registration → Disbursement (IMPS/NEFT/RTGS)
  → Post-Disbursement Discovery
```

## Configuration

Environment variables are managed via Docker Compose. See `devops/docker/docker-compose.yml` for all service configurations.

Key variables:
- `NODE_ENV=development` — Enables mock data (UIDAI, CIBIL, NSDL)
- `JWT_PRIVATE_KEY_PATH` — Path to Vault-mounted RSA private key
- `KAFKA_BROKERS` — Comma-separated Kafka broker addresses
- `REDIS_URL` — Redis Sentinel URL

## Testing

```bash
# Backend unit tests
npm run test --workspace=@los/auth-service

# Backend E2E tests
npm run test:e2e --workspace=@los/backend

# Frontend Playwright tests
npm test --workspace=@los/frontend

# Load tests (k6)
docker run --rm -v $(pwd)/devops/k6:/k6 -w /k6 \
  grafana/k6:latest run smoke-test.ts
```

## Documentation

- [ADR-001 to ADR-017](docs/adr/) — Architecture decisions
- [API Documentation](apis/README.md) — Testing guides and credentials
- [Database Migrations](database/README.md) — Per-service schema management
- [Postman Collection](apis/postman/) — 85 API test requests

## External API Dependencies

These require credentials (see `task.md` Open Issues):

| API | Purpose | Status |
|-----|---------|--------|
| UIDAI AUA | Aadhaar eKYC | License application pending |
| CIBIL TransUnion | Credit bureau | Commercial agreement pending |
| NSDL ITD | PAN verification | Configured |
| NPCI | NACH, IMPS/NEFT/RTGS | SOR submission pending |
| Karza/Signzy | Document OCR | Configured |
| NSDL eSign | Digital signatures | Configured |

## License

Proprietary — Internal use only.
