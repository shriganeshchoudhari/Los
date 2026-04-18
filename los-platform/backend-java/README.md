# LOS Platform Backend — Spring Boot (Java 21)

Monolithic Spring Boot application containing all 8 LOS service modules.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           Spring Boot JAR (port 8080)                        │
│                                                             │
│  com.los.auth.*         → /auth/**                         │
│  com.los.kyc.*         → /kyc/**                          │
│  com.los.loan.*         → /applications/**                  │
│  com.los.document.*    → /documents/**                     │
│  com.los.decision.*     → /decisions/**                   │
│  com.los.integration.*  → /integration/**                  │
│  com.los.notification.* → /notifications/**                │
│  com.los.dsa.*         → /dsa/**                          │
└─────────────────────────────────────────────────────────────┘
         │
         ├── PostgreSQL: los_platform (9 schemas)
         ├── Kafka (topics unchanged from legacy NestJS)
         ├── Redis (sessions, cache, distributed locks)
         └── MinIO (document storage)
```

## Modules

| Module | Route | Schema | Description |
|--------|-------|--------|-------------|
| Auth | /api/auth | auth | OTP, JWT (RS256), LDAP, sessions |
| KYC | /api/kyc | kyc | Aadhaar eKYC, PAN, face match, DigiLocker |
| Loan | /api/loan | loan | Applications, EMI, sanction letters, agreements, PDD |
| Document | /api/documents | document | Presigned URLs, OCR, watermarking |
| Decision | /api/decision | decision | 47 rules, ML mock, credit decisions |
| Integration | /api/int | integration | Bureau, CBS, NACH, disbursement |
| Notification | /api/notifications | notification | SMS, email, WhatsApp, push |
| DSA | /api/dsa | dsa | Partner portal, officer management |

## Tech Stack

- Java 21 (LTS, virtual threads)
- Spring Boot 3.4
- Spring Data JPA + Hibernate
- Spring Security + JJWT (RS256)
- Spring Kafka
- Spring Data Redis
- Flyway (migrations)
- Resilience4j (circuit breakers)
- Spring Web Services (SOAP)
- Apache PDFBox (PDF generation)
- MinIO Java SDK
- springdoc-openapi (Swagger at /swagger-ui.html)
- Micrometer + Prometheus

## Prerequisites

- Java 21 (JDK)
- Maven 3.9+
- Docker Desktop (for Postgres, Redis, Kafka, MinIO)

## Setup

### 1. Docker Infrastructure
```bash
cd devops/docker
docker compose up -d
```

### 2. Build
```bash
cd backend-java
mvn clean package -DskipTests
```

### 3. Run
```bash
java -jar target/los-platform-1.0.0.jar
# Or with Maven:
mvn spring-boot:run
```

### 4. Access
| Service | URL |
|---------|-----|
| Backend | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Actuator | http://localhost:8080/actuator/health |
| Metrics | http://localhost:8080/actuator/prometheus |

## Database

Migrations run automatically on startup (Flyway).

```
src/main/resources/db/migration/
├── V001__auth_schema.sql           ✅ DONE (Phase 58)
├── V002__kyc_schema.sql           ✅ DONE
├── V003__loan_schema.sql          ✅ DONE
├── V004__decision_schema.sql      ✅ DONE
├── V005__integration_schema.sql   ✅ DONE
├── V006__notification_schema.sql  ✅ DONE
├── V007__dsa_schema.sql          ✅ DONE
├── V008__document_schema.sql      ✅ DONE
└── V009__shared_schema.sql        ✅ DONE
```

## Configuration

Configuration is via `src/main/resources/application.yml` with overrides in `application-dev.yml`.

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5433/los_platform
    username: los_user
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
      default_schema: auth  # Per module
  kafka:
    bootstrap-servers: localhost:9092
  data:
    redis:
      host: localhost
      port: 6379
los:
  jwt:
    public-key-file: ../backend/keys/jwt-public.pem
  encryption:
    master-key: ${ENCRYPTION_MASTER_KEY}
```

## Migration from NestJS

See `task.md` Phase 58 for the full migration plan and task breakdown.

- **ADR-018:** `docs/adr/ADR-018-spring-boot-migration.md` — Tech decision record
- **Legacy NestJS:** `backend/` (archived, non-functional)
- **All NestJS ADRs (ADR-001, 002, 006):** Updated with migration notes

## Adding a New Module

1. Create package: `src/main/java/com/los/newmodule/`
2. Add Flyway migration: `src/main/resources/db/migration/V010__newmodule_schema.sql`
3. Configure Hibernate default schema in module's `@Configuration` class
4. Add `@Entity` classes with `@Table(schema = "newmodule")`
5. Add REST controllers

## Testing

```bash
mvn test
mvn verify
```
