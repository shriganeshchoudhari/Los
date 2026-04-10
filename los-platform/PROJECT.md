# LOS Platform - Loan Origination System

Production-grade Loan Origination System for Indian Banking

## Project Structure

```
los-platform/
├── frontend/                    # Next.js + React Application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Next.js pages (routes)
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/             # API service layers
│   │   ├── types/                # TypeScript interfaces
│   │   └── utils/                # Utility functions
│   ├── tests/e2e/               # Playwright E2E tests
│   └── public/                   # Static assets
│
├── backend/                     # NestJS Microservices
│   ├── common/                   # Shared modules
│   │   ├── config/               # Configuration management
│   │   ├── exceptions/           # Custom exceptions
│   │   ├── filters/              # Exception filters
│   │   ├── guards/               # Auth guards
│   │   ├── interceptors/         # Logging, caching
│   │   ├── middleware/           # Request middleware
│   │   └── utils/                 # Common utilities
│   │
│   ├── auth-service/             # Authentication & Authorization
│   │   ├── src/
│   │   │   ├── controllers/      # REST endpoints
│   │   │   ├── services/          # Business logic
│   │   │   ├── dto/               # Data transfer objects
│   │   │   ├── entities/          # TypeORM entities
│   │   │   └── repositories/       # Data access
│   │   └── test/                  # Unit tests
│   │
│   ├── kyc-service/              # KYC Verification Service
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   └── repositories/
│   │   └── test/
│   │
│   ├── loan-service/             # Loan Processing Service
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   └── repositories/
│   │   └── test/
│   │
│   ├── decision-engine/          # Credit Decision Engine
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── dto/
│   │   │   ├── models/            # ML/Rules models
│   │   │   └── repositories/
│   │   └── test/
│   │
│   ├── integration-service/      # External Integrations
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── dto/
│   │   │   ├── clients/           # REST/SOAP clients
│   │   │   └── transformers/      # Data transformers
│   │   └── test/
│   │
│   └── notification-service/     # Notifications
│       ├── src/
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── dto/
│       │   └── providers/        # SMS, Email, Push
│       └── test/
│
├── database/                     # Database Artifacts
│   ├── migrations/               # Flyway migrations
│   ├── schemas/                  # ER diagrams, specs
│   └── seeds/                    # Test data seeds
│
├── apis/                         # API Specifications
│   ├── openapi/                  # OpenAPI 3.0 specs
│   ├── postman/                  # Postman collections
│   └── http/                     # api.http files
│
├── devops/                       # DevOps & Infrastructure
│   ├── docker/                   # Dockerfiles
│   ├── k8s/
│   │   ├── base/                 # K8s base manifests
│   │   └── overlays/             # Environment-specific
│   │       ├── dev/
│   │       ├── uat/
│   │       └── prod/
│   └── ci/                       # CI/CD pipelines
│
├── docs/                         # Documentation
│   ├── adr/                      # Architecture Decision Records
│   ├── architecture/             # Architecture diagrams
│   ├── api/                      # API documentation
│   └── compliance/               # Regulatory docs
│
└── scripts/                      # Utility scripts
```

## Microservices Overview

| Service | Port | Purpose |
|---------|------|---------|
| auth-service | 3001 | OAuth2/JWT authentication |
| kyc-service | 3002 | Aadhaar/PAN verification |
| loan-service | 3003 | Loan application processing |
| decision-engine | 3004 | Credit scoring & decisions |
| integration-service | 3005 | External API gateway |
| notification-service | 3006 | SMS/Email/Push notifications |
| frontend | 3000 | Customer-facing application |

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS
- **Backend**: NestJS, TypeScript, Node.js 20
- **Database**: PostgreSQL 15, Redis 7
- **Messaging**: Apache Kafka
- **Container**: Docker, Kubernetes
- **Testing**: Jest, Playwright, Postman

## Phases

- [x] Phase 0: Project Structure
- [ ] Phase 1: PRD + Tech Stack
- [ ] Phase 2: Architecture + TDD
- [ ] Phase 3: API + Database
- [ ] Phase 4: Testing + Automation
- [ ] Phase 5: DevOps + Deployment
- [ ] Phase 6: Security & Compliance
