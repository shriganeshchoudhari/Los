#!/bin/bash
# LOS Platform — Smoke Test Script
# Verifies connectivity and health for all 9 modules in the monolith.

BASE_URL=${1:-"http://localhost:8000"}
echo "🚀 Starting LOS Platform Smoke Tests on $BASE_URL..."

test_endpoint() {
    local name=$1
    local path=$2
    echo -n "Testing $name ($path)... "
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")
    if [ "$STATUS" -eq 200 ] || [ "$STATUS" -eq 201 ] || [ "$STATUS" -eq 401 ]; then
        echo "✅ $STATUS"
    else
        echo "❌ $STATUS"
        exit 1
    fi
}

test_endpoint "API Gateway Health" "/health"
test_endpoint "Auth Service" "/api/auth/.well-known/jwks.json"
test_endpoint "Loan Service (List)" "/api/applications"
test_endpoint "KYC Service (Status)" "/api/kyc/test-app-id"
test_endpoint "Decision Engine (Rules)" "/api/decisions/rules"
test_endpoint "Document Service (App Documents)" "/api/documents/application/test-app-id"
test_endpoint "Integration Service (Bureau)" "/api/integration/bureau/test-app-id"
test_endpoint "Notification Service (Templates)" "/api/notifications/templates"
test_endpoint "DSA Service (Activities)" "/api/dsa/activities/test-partner-id"
test_endpoint "Audit Logs" "/api/audit-logs?applicationId=test"

echo "🎉 All smoke tests passed!"
