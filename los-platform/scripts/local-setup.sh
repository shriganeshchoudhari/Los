#!/usr/bin/env bash
# ============================================================
# LOS Platform — Local Development Setup
# One-command setup: generates keys, starts full stack, runs migrations + seeds
#
# Requirements:
#   - Docker & Docker Compose installed
#   - Bash (Git Bash or WSL on Windows)
#
# Usage:
#   bash scripts/local-setup.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/devops/docker"

echo "╔══════════════════════════════════════════════╗"
echo "║  LOS Platform — Local Development Setup     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Generate JWT keys ──────────────────────────────────────────────
echo "[1/5] Generating JWT RSA-2048 keys..."
bash "$SCRIPT_DIR/gen-jwt-keys.sh" || true

# ── Step 2: Create .env if missing ─────────────────────────────────────────
ENV_FILE="$PROJECT_ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[2/5] Creating .env from example..."
  if [[ -f "$PROJECT_ROOT/backend/.env.example" ]]; then
    cp "$PROJECT_ROOT/backend/.env.example" "$ENV_FILE"
    # Override JWT_PRIVATE_KEY with file path for Docker mount
    sed -i "s|JWT_PRIVATE_KEY=.*|JWT_PRIVATE_KEY_FILE=/keys/jwt-private.pem|" "$ENV_FILE"
    echo "  [OK] Created $ENV_FILE"
  else
    echo "  [WARN] .env.example not found — using defaults"
  fi
else
  echo "[2/5] .env already exists — skipping"
fi

# ── Step 3: Start Docker services ──────────────────────────────────────────
echo "[3/5] Starting Docker services (postgres, redis, kafka, mock-server, etc.)..."
cd "$DOCKER_DIR"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.local.yml \
  up -d postgres redis kafka zookeeper minio jaeger \
     init-databases init-migrations \
     auth-service kyc-service loan-service \
     decision-engine integration-service \
     notification-service dsa-service document-service \
     api-gateway frontend \
     mock-server kafka-ui mailhog pgadmin

echo ""
echo "  Waiting for services to be healthy..."
for svc in postgres redis kafka mock-server; do
  echo -n "  Checking $svc..."
  for i in $(seq 1 60); do
    if docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null | grep -q "healthy"; then
      echo " OK"
      break
    fi
    if [[ $i -eq 60 ]]; then
      echo " TIMEOUT — check logs: docker compose logs $svc"
    fi
    sleep 2
  done
done

# ── Step 4: Run seed data ───────────────────────────────────────────────────
echo "[4/5] Running seed data..."
export PGPASSWORD="${DB_PASSWORD:-los_password}"
for db in los_auth los_loan los_kyc los_decision los_integration los_document los_notification los_dsa los_shared; do
  docker exec -i postgres psql -U los_user -d "$db" < "$PROJECT_ROOT/database/seeds/00_seed_config.sql" 2>/dev/null || true
done

docker exec -i postgres psql -U los_user -d los_auth \
  < "$PROJECT_ROOT/database/seeds/01_seed_users.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_loan \
  < "$PROJECT_ROOT/database/seeds/02_seed_loan_applications.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_kyc \
  < "$PROJECT_ROOT/database/seeds/03_seed_kyc_records.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_decision \
  < "$PROJECT_ROOT/database/seeds/04_seed_bureau_reports.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_integration \
  < "$PROJECT_ROOT/database/seeds/04_seed_bureau_reports.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_decision \
  < "$PROJECT_ROOT/database/seeds/05_seed_decision_results.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_document \
  < "$PROJECT_ROOT/database/seeds/06_seed_documents.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_dsa \
  < "$PROJECT_ROOT/database/seeds/07_seed_dsa.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_integration \
  < "$PROJECT_ROOT/database/seeds/08_seed_disbursements.sql" 2>/dev/null || true

docker exec -i postgres psql -U los_user -d los_shared \
  < "$PROJECT_ROOT/database/seeds/09_seed_audit_logs.sql" 2>/dev/null || true

echo "  [OK] Seed data loaded"

# ── Step 5: Verify services ───────────────────────────────────────────────
echo "[5/5] Verifying service health..."
sleep 5

for service in auth-service kyc-service loan-service decision-engine; do
  port=""
  case $service in
    auth-service) port=3001 ;;
    kyc-service) port=3002 ;;
    loan-service) port=3003 ;;
    decision-engine) port=3004 ;;
  esac
  echo -n "  $service..."
  if curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
    echo " OK (http://localhost:$port)"
  else
    echo " NOT READY (check: docker compose logs $service)"
  fi
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  LOS Platform is running!                   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Frontend:      http://localhost:3000"
echo "  Auth API:      http://localhost:3001"
echo "  KYC API:       http://localhost:3002"
echo "  Loan API:      http://localhost:3003"
echo "  Decision API:   http://localhost:3004"
echo "  Mock Server:    http://localhost:8080"
echo "  Kafka UI:       http://localhost:8090"
echo "  MailHog:        http://localhost:8025"
echo "  pgAdmin:        http://localhost:8050"
echo "  API Gateway:    http://localhost:8000"
echo ""
echo "  Test login:    Mobile 9999999991 / OTP 123456"
echo ""
echo "  Stop:          cd devops/docker && docker compose -f docker-compose.yml -f docker-compose.local.yml down"
echo "  Logs:          docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f"
