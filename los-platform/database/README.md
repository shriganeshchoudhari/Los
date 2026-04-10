# LOS Platform — Database Setup

## Structure

```
database/
├── init-databases.sql           # Creates all 9 databases (run once)
├── migrations/
│   ├── migration-runner.sh      # Runs all per-service migrations
│   ├── 002_auth_schema.sql      # los_auth (auth-service)
│   ├── 003_loan_schema.sql      # los_loan (loan-service)
│   ├── 004_kyc_schema.sql       # los_kyc (kyc-service)
│   ├── 005_decision_schema.sql  # los_decision (decision-service)
│   ├── 006_integration_schema.sql # los_integration (integration-service)
│   ├── 007_document_schema.sql  # los_document (document-service)
│   ├── 008_notification_schema.sql # los_notification (notification-service)
│   ├── 009_dsa_schema.sql       # los_dsa (dsa-service)
│   └── 010_shared_schema.sql    # los_shared (cross-service)
├── schemas/                     # Per-service schema files (same as migrations)
│   ├── schema-auth.sql
│   ├── schema-loan.sql
│   └── ...
└── seeds/
    └── 00_seed_config.sql       # Dev seed data (benchmark rates, feature flags,
                                  # notification templates, decision rules)
```

## Databases

| Database | Service | Owner Schema |
|----------|---------|-------------|
| `los_auth` | auth-service | `los_auth` |
| `los_loan` | loan-service | `los_loan` |
| `los_kyc` | kyc-service | `los_kyc` |
| `los_decision` | decision-service | `los_decision` |
| `los_integration` | integration-service | `los_integration` |
| `los_document` | document-service | `los_document` |
| `los_notification` | notification-service | `los_notification` |
| `los_dsa` | dsa-service | `los_dsa` |
| `los_shared` | cross-service | `los_shared` |

## Running Migrations

### Docker Compose (recommended)

```bash
# Start everything (init-databases + init-migrations run automatically before services)
docker-compose -f devops/docker/docker-compose.yml up -d

# Watch migration logs
docker-compose -f devops/docker/docker-compose.yml logs init-migrations
```

### Local Development

```bash
# 1. Create databases
psql -h localhost -U los_user -f database/init-databases.sql

# 2. Run migrations
DB_HOST=localhost DB_USERNAME=los_user DB_PASSWORD=los_password \
  ./database/migrations/migration-runner.sh --env=dev

# 3. Seed dev data (optional)
DB_HOST=localhost DB_USERNAME=los_user DB_PASSWORD=los_password \
  psql -h localhost -U los_user -d los_loan -f database/seeds/00_seed_config.sql
DB_HOST=localhost DB_USERNAME=los_user DB_PASSWORD=los_password \
  psql -h localhost -U los_user -d los_notification -f database/seeds/00_seed_config.sql
DB_HOST=localhost DB_USERNAME=los_user DB_PASSWORD=los_password \
  psql -h localhost -U los_user -d los_decision -f database/seeds/00_seed_config.sql

# Or seed all at once
for db in los_loan los_notification los_decision; do
  psql -h localhost -U los_user -d "$db" -f database/seeds/00_seed_config.sql
done
```

### CI/CD

```bash
# Dry run (validate without executing)
./database/migrations/migration-runner.sh --env=prod --dry-run

# Single service migration
./database/migrations/migration-runner.sh --env=prod --service=loan

# All migrations (prod)
./database/migrations/migration-runner.sh --env=prod
```

### Migration Runner Options

```bash
--env=dev|uat|prod   # Load .env.{env}, default: dev
--dry-run            # Validate SQL files without executing
--service=name       # Run only specific service (auth, loan, kyc, decision,
                     # integration, document, notification, dsa, shared)
```

### Checking Migration Status

```sql
-- Per database:
SELECT * FROM los_auth.schema_migrations ORDER BY applied_at;
SELECT * FROM los_loan.schema_migrations ORDER BY applied_at;
-- ... etc
```

## Docker Compose Init Order

1. `postgres` — healthy
2. `init-databases` — completes → creates all 9 DBs
3. `init-migrations` — completes → runs 002–010 migrations on correct DBs
4. All backend services — start (depend on init-migrations)
5. `frontend` — starts

## Rolling Back a Migration

Migrations are idempotent via `schema_migrations` tracking. To re-run a migration:

```sql
-- Delete the tracking record
DELETE FROM los_auth.schema_migrations WHERE migration_id = '002_auth_schema';

-- Re-run
DB_HOST=localhost DB_USERNAME=los_user DB_PASSWORD=los \
  psql -h localhost -U los_user -d los_auth \
  -f database/migrations/002_auth_schema.sql
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `los_user` | Database user |
| `DB_PASSWORD` | `los_password` | Database password |
| `MIGRATIONS_DIR` | `./migrations` | Path to migration files |

## Key Design Notes

- Each database has its own schema (`los_auth`, `los_loan`, etc.) matching the DB name
- Cross-service FK references (e.g., `user_id` in `loan_applications`) are plain UUID columns — no DB-level FK constraints across service boundaries
- Referintegrity enforced via application code and Kafka events
- `001_initial_schema.sql` is deprecated — do not use for new deployments
