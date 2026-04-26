# LOS Platform — Smoke Test Script (PowerShell)
# Verifies connectivity and health for all 9 modules in the monolith.

$baseUrl = if ($args[0]) { $args[0] } else { "http://localhost:8000" }
Write-Host "🚀 Starting LOS Platform Smoke Tests on $baseUrl..." -ForegroundColor Cyan

function Test-Endpoint {
    param($name, $path)
    Write-Host "Testing $name ($path)... " -NoNewline
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$path" -Method Get -ErrorAction SilentlyContinue
        $status = $response.StatusCode
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
    }

    if ($status -eq 200 -or $status -eq 201 -or $status -eq 401) {
        Write-Host "✅ $status" -ForegroundColor Green
    } else {
        Write-Host "❌ $status" -ForegroundColor Red
        # exit 1 # Don't exit in PS if we want to see all results
    }
}

Test-Endpoint "API Gateway Health" "/health"
Test-Endpoint "Auth Service" "/api/auth/.well-known/jwks.json"
Test-Endpoint "Loan Service (List)" "/api/applications"
Test-Endpoint "KYC Service (Status)" "/api/kyc/test-app-id"
Test-Endpoint "Decision Engine (Rules)" "/api/decisions/rules"
Test-Endpoint "Document Service (App Documents)" "/api/documents/application/test-app-id"
Test-Endpoint "Integration Service (Bureau)" "/api/integration/bureau/test-app-id"
Test-Endpoint "Notification Service (Templates)" "/api/notifications/templates"
Test-Endpoint "DSA Service (Activities)" "/api/dsa/activities/test-partner-id"
Test-Endpoint "Audit Logs" "/api/audit-logs?applicationId=test"

Write-Host "🎉 Smoke tests completed!" -ForegroundColor Yellow
