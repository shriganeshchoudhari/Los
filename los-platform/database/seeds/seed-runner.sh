#!/usr/bin/env bash
# ============================================================
# LOS Platform — Seed Data Runner
# Runs all seed files against the 9 per-service databases.
# Run AFTER migrations are applied.
#
# Usage:
#   ./seed-runner.sh [--env=dev|uat|prod]
# ============================================================

set -euo pipefail

ENV="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-los_user}"
DB_PASSWORD="${DB_PASSWORD:-los_password}"

echo "=== LOS Platform Seed Runner ==="
echo "Environment: $ENV"
echo "Database: $DB_HOST:$DB_PORT"
echo ""

SEED_FILES=(
  "01_seed_users.sql"
  "02_seed_loan_applications.sql"
  "03_seed_kyc_records.sql"
  "04_seed_bureau_reports.sql"
  "05_seed_decision_results.sql"
  "06_seed_documents.sql"
  "07_seed_dsa.sql"
  "08_seed_disbursements.sql"
  "09_seed_audit_logs.sql"
)

declare -A DB_MAP=(
  ["01_seed_users.sql"]="los_auth"
  ["02_seed_loan_applications.sql"]="los_loan"
  ["03_seed_kyc_records.sql"]="los_kyc"
  ["04_seed_bureau_reports.sql"]="los_integration"
  ["05_seed_decision_results.sql"]="los_decision"
  ["06_seed_documents.sql"]="los_document"
  ["07_seed_dsa.sql"]="los_dsa"
  ["08_seed_disbursements.sql"]="los_integration"
  ["09_seed_audit_logs.sql"]="los_shared"
)

for seed_file in "${SEED_FILES[@]}"; do
  db_name="${DB_MAP[$seed_file]}"
  file_path="$SCRIPT_DIR/$seed_file"

  if [[ ! -f "$file_path" ]]; then
    echo "  [SKIP] $seed_file — file not found"
    continue
  fi

  echo "  Running $seed_file on $db_name..."
  PGPASSWORD="$DB_PASSWORD" psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$db_name" \
    --file="$file_path" \
    --set=ON_ERROR_STOP=1 \
    --quiet

  if [[ $? -eq 0 ]]; then
    echo "  [OK] $seed_file"
  else
    echo "  [ERROR] $seed_file failed"
    exit 1
  fi
done

echo ""
echo "=== Seed data loaded successfully ==="
echo ""
echo "Test credentials:"
echo "  Loan Officer:  9999999991 / OTP: 123456"
echo "  Credit Analyst: 9999999992 / OTP: 123456"
echo "  Branch Manager: 9999999993 / OTP: 123456"
echo "  Compliance:     9999999994 / OTP: 123456"
echo ""
echo "Sample applications: LOS-2024-DL-00001 through LOS-2024-DL-00015"
