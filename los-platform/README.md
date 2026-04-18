# LOS Platform — Loan Origination System

A production-grade Loan Origination System for an Indian bank, built with Spring Boot (Java 21), Next.js, PostgreSQL, Kafka, Redis, and MinIO.

> **Migration Note:** The backend was migrated from NestJS (8 microservices) to Spring Boot (1 monolithic JAR). The NestJS code is preserved in `backend/` for reference. The Spring Boot backend lives in `backend-java/`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Spring Boot Monolith                      │
│                     (Java 21, Port 8080)                    │
│  ┌────────┬─────────┬───────┬───────┬───────┬──────────┐ │
│  │ Auth   │   KYC   │ Loan  │Decision│  Int. │  Others  │ │
│  │ /api/  │ /api/   │/api/  │ /api/  │ /api/ │  /api/   │ │
│  │  auth  │   kyc   │ loan  │decision│  int. │   ...    │ │
│  └────────┴─────────┴───────┴───────┴───────┴──────────┘ │
└──────────────────────┬────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
  ┌────┴────┐   ┌─────┴─────┐   ┌────┴────┐
  │PostgreSQL│   │   Redis   │   │  Kafka  │
  │(9 schemas)│   │  Sentinel  │   │         │
  └──────────┘   └───────────┘   └─────────┘
```

## Services (Spring Boot Modules)

## Tech Stack

- **Backend:** Spring Boot 3.4 (Java 21, Maven), JPA/Hibernate, PostgreSQL 15, Kafka (Spring Kafka), Redis Sentinel, MinIO
- **Frontend:** Next.js 14, React 18, Tailwind CSS, shadcn/ui, React Query, React Hook Form
- **Observability:** OpenTelemetry, Prometheus, Grafana, Jaeger
- **Infrastructure:** Docker Compose (local), Kubernetes (EKS), ArgoCD, GitHub Actions, Kong API Gateway, HashiCorp Vault

## Quick Start

### Prerequisites
- Docker Desktop 4.x
- Java 21+
- Maven 3.9+
- Node.js 20+

### 1. Clone and start
```bash
git clone <repo>
cd los-platform

# Start infrastructure (DBs, Kafka, Redis, MinIO)
docker compose -f devops/docker/docker-compose.yml up -d

# Build and run Spring Boot backend
cd backend-java
mvn package -DskipTests
java -jar target/los-platform-1.0.0.jar

# Or with Docker
docker build -t los-platform backend-java
docker run -p 8080:8080 --env-file backend-java/.env.local los-platform
```

### 2. Start frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Access services
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Spring Boot API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
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
├── backend-java/              # Spring Boot monolith
│   ├── src/main/java/com/los/
│   │   ├── LosApplication.java
│   │   ├── auth/            # Authentication module
│   │   ├── kyc/              # KYC & identity verification
│   │   ├── loan/            # Loan applications & agreements
│   │   ├── decision/         # Credit decision engine
│   │   ├── integration/     # Bureau, CBS, NACH, disbursement
│   │   ├── notification/    # SMS/email notifications
│   │   ├── dsa/              # DSA partner portal
│   │   ├── document/         # Document management
│   │   ├── shared/           # Audit logs, idempotency
│   │   └── common/           # Shared: config, security, utils, DTOs
│   ├── src/main/resources/
│   │   ├── application.yml   # Main config
│   │   └── db/migration/    # Flyway migrations (V001–V009)
│   ├── Dockerfile
│   └── pom.xml
├── backend/                    # NestJS monorepo (legacy, preserved)
├── frontend/                   # Next.js 14 app
│   └── src/
│       ├── app/               # App router pages
│       ├── components/        # UI components
│       ├── lib/                # API clients, utilities
│       ├── hooks/              # Custom React hooks
│       ├── services/           # Service-specific API clients
│       └── types/              # TypeScript type definitions
├── database/
│   ├── init-databases.sql     # Creates single los_platform DB with 9 schemas
│   └── migrations/            # Per-service SQL migrations (legacy)
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
