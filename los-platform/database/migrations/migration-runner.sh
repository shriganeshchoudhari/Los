#!/usr/bin/env bash
# ============================================================
# LOS Platform — Migration Runner
# Runs per-service SQL migrations against all 9 databases.
# Designed for:
#   - Docker: run as init container before services start
#   - Local:  ./migration-runner.sh --env=dev
#   - CI/CD:  ./migration-runner.sh --env=prod --dry-run
#
# Usage:
#   ./migration-runner.sh --env=dev|uat|prod [--dry-run] [--service=auth|loan|kyc|...]
# ============================================================

set -euo pipefail

ENV="dev"
DRY_RUN=false
SERVICES=""

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --env=*)
        ENV="${1#*=}"
        shift
        ;;
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --service=*)
        SERVICES="${SERVICES} ${1#*=}"
        shift
        ;;
      *)
        echo "Unknown option: $1"
        exit 1
        ;;
    esac
  done
}

load_env() {
  local env_file
  env_file="$(dirname "$0")/../.env.${ENV}"
  if [[ -f "$env_file" ]]; then
    set -a
    source "$env_file"
    set +a
  fi

  export DB_HOST "${DB_HOST:-localhost}"
  export DB_PORT "${DB_PORT:-5432}"
  export DB_USERNAME "${DB_USERNAME:-los_user}"
  export DB_PASSWORD "${DB_PASSWORD:-los_password}"
  export MIGRATIONS_DIR "${MIGRATIONS_DIR:-$(dirname "$0")}"
}

declare -A SERVICE_DB_MAP=(
  [auth]=los_auth
  [loan]=los_loan
  [kyc]=los_kyc
  [decision]=los_decision
  [integration]=los_integration
  [document]=los_document
  [notification]=los_notification
  [dsa]=los_dsa
  [shared]=los_shared
)

declare -A SERVICE_MIGRATION_MAP=(
  [auth]=002_auth_schema.sql
  [loan]=003_loan_schema.sql
  [kyc]=004_kyc_schema.sql
  [decision]=005_decision_schema.sql
  [integration]=006_integration_schema.sql
  [document]=007_document_schema.sql
  [notification]=008_notification_schema.sql
  [dsa]=009_dsa_schema.sql
  [shared]=010_shared_schema.sql
)

run_migration() {
  local service="$1"
  local db="${SERVICE_DB_MAP[$service]}"
  local migration_file="${SERVICE_MIGRATION_MAP[$service]}"
  local full_path="${MIGRATIONS_DIR}/${migration_file}"

  if [[ ! -f "$full_path" ]]; then
    echo "[SKIP]  $service ($db) — $migration_file not found"
    return 0
  fi

  echo "[RUN]   $service ($db) ← $migration_file"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "        (dry-run: would execute)"
    return 0
  fi

  PGPASSWORD="$DB_PASSWORD" psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USERNAME" \
    --dbname="$db" \
    --set=ON_ERROR_STOP=1 \
    --file="$full_path" \
    >> "${MIGRATIONS_DIR}/migration.log" 2>&1

  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    echo "[OK]    $service ($db) — migrated successfully"
  else
    echo "[ERROR] $service ($db) — migration failed (exit $exit_code). Check migration.log"
    exit $exit_code
  fi
}

record_migration() {
  local service="$1"
  local db="${SERVICE_DB_MAP[$service]}"
  local migration_file="${SERVICE_MIGRATION_MAP[$service]}"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "        (dry-run: would record)"
    return 0
  fi

  PGPASSWORD="$DB_PASSWORD" psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USERNAME" \
    --dbname="$db" \
    --quiet \
    --no-align \
    --tuples-only \
    --command="INSERT INTO schema_migrations (migration_id) VALUES ('${migration_file%.sql}') ON CONFLICT DO NOTHING;" \
    >> "${MIGRATIONS_DIR}/migration.log" 2>&1 || true
}

main() {
  parse_args "$@"
  load_env

  echo "=========================================="
  echo "LOS Platform Migration Runner"
  echo "=========================================="
  echo "Environment : $ENV"
  echo "Dry run     : $DRY_RUN"
  echo "DB host     : $DB_HOST:$DB_PORT"
  echo "DB user     : $DB_USERNAME"
  echo "Migrations  : $MIGRATIONS_DIR"
  echo "=========================================="
  echo ""

  if [[ -n "$SERVICES" ]]; then
    service_list="$SERVICES"
  else
    service_list="${!SERVICE_DB_MAP[@]}"
  fi

  local failed=0
  for service in $service_list; do
    service=$(echo "$service" | xargs)
    if [[ -z "${SERVICE_DB_MAP[$service]:-}" ]]; then
      echo "[SKIP]  Unknown service: $service"
      continue
    fi

    run_migration "$service" || ((failed++))
  done

  echo ""
  if [[ $failed -gt 0 ]]; then
    echo "[FAILED] $failed service(s) failed migration. See migration.log"
    exit 1
  else
    echo "[DONE]   All migrations completed successfully"
  fi
}

main "$@"
