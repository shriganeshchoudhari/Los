#!/usr/bin/env bash
# ============================================================
# LOS Platform — Generate JWT RSA-2048 Key Pair
# Outputs keys to backend/keys/ (gitignored)
#
# Usage:
#   bash scripts/gen-jwt-keys.sh
# ============================================================

set -euo pipefail

KEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../backend/keys" && pwd)"
PRIVATE_KEY="$KEYS_DIR/jwt-private.pem"
PUBLIC_KEY="$KEYS_DIR/jwt-public.pem"

echo "=== JWT Key Generation ==="
echo "Keys directory: $KEYS_DIR"

mkdir -p "$KEYS_DIR"

if [[ -f "$PRIVATE_KEY" ]]; then
  echo "  [INFO] Private key already exists — skipping generation"
  echo "  To regenerate, delete $PRIVATE_KEY first"
  exit 0
fi

echo "  Generating RSA-2048 private key..."
openssl genrsa -out "$PRIVATE_KEY" 2048

echo "  Extracting public key..."
openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY"

chmod 600 "$PRIVATE_KEY"
chmod 644 "$PUBLIC_KEY"

echo ""
echo "  [OK] Keys generated:"
echo "    Private: $PRIVATE_KEY"
echo "    Public:  $PUBLIC_KEY"
echo ""
echo "  Add to docker-compose.yml:"
echo "    JWT_PRIVATE_KEY_FILE: /keys/jwt-private.pem"
echo "  Add volume mount:"
echo "    - ./backend/keys:/keys:ro"
echo ""
echo "  NEVER commit these files to Git!"
