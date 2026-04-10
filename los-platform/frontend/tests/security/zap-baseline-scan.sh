#!/bin/bash
# OWASP ZAP Baseline Scan for LOS Platform
# Usage: ./zap-baseline-scan.sh [target-url]

TARGET_URL=${1:-"http://localhost:3000"}
REPORT_DIR="$(dirname "$0")/reports"

mkdir -p "$REPORT_DIR"

echo "Starting ZAP baseline scan against $TARGET_URL..."

docker run --rm \
  -v "$REPORT_DIR:/zap/wrkdir:rw" \
  owasp/zap2docker-stable:latest \
  zap-baseline.py \
    -t "$TARGET_URL" \
    -J "$REPORT_DIR/zap-baseline-results.json" \
    -r "$REPORT_DIR/zap-baseline-report.html" \
    -config api.key=zap \
    --hook /zap/scripts/hook_alert.py \
    -z "-authonfailure"

echo ""
echo "=== ZAP Baseline Scan Complete ==="
echo "Results: $REPORT_DIR/zap-baseline-results.json"
echo "HTML Report: $REPORT_DIR/zap-baseline-report.html"
echo ""

# Parse and display high/critical findings
if [ -f "$REPORT_DIR/zap-baseline-results.json" ]; then
  HIGH=$(grep -c '"risk":"High"\|"risk":"High"' "$REPORT_DIR/zap-baseline-results.json" 2>/dev/null || echo "0")
  CRITICAL=$(grep -c '"risk":"Critical"\|"risk":"Critical"' "$REPORT_DIR/zap-baseline-results.json" 2>/dev/null || echo "0")
  MEDIUM=$(grep -c '"risk":"Medium"\|"risk":"Medium"' "$REPORT_DIR/zap-baseline-results.json" 2>/dev/null || echo "0")

  echo "Summary:"
  echo "  Critical: $CRITICAL"
  echo "  High: $HIGH"
  echo "  Medium: $MEDIUM"

  if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
    echo ""
    echo "WARNING: Critical or High severity vulnerabilities found!"
    exit 1
  fi
fi
