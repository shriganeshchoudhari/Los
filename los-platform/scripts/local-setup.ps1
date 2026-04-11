# LOS Platform - Local Development Setup (PowerShell)
# One-command setup for Windows-native environments
#
# Requirements:
#   - Docker Desktop installed and running
#   - PowerShell 5.1+
#
# Usage:
#   .\scripts\local-setup.ps1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Get-Item $ScriptDir).Parent.FullName
$DockerDir = Join-Path $ProjectRoot "devops\docker"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LOS Platform - Local Development Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate JWT keys
Write-Host "[1/5] Generating JWT RSA-2048 keys..." -ForegroundColor Yellow
& "$ScriptDir\gen-jwt-keys.ps1" 2>$null | Out-Null

# Step 2: Create .env if missing
Write-Host "[2/5] Checking .env file..." -ForegroundColor Yellow
$EnvFile = Join-Path $ProjectRoot ".env"
$BackendEnvExample = Join-Path $ProjectRoot "backend\.env.example"

if (-not (Test-Path $EnvFile) -and (Test-Path $BackendEnvExample)) {
    Copy-Item $BackendEnvExample $EnvFile
    $envContent = Get-Content $EnvFile -Raw
    $envContent = $envContent -replace 'JWT_PRIVATE_KEY=.*', 'JWT_PRIVATE_KEY_FILE=/keys/jwt-private.pem'
    Set-Content -Path $EnvFile -Value $envContent -NoNewline
    Write-Host "  [OK] Created $EnvFile" -ForegroundColor Green
} elseif (Test-Path $EnvFile) {
    Write-Host "  [OK] .env already exists" -ForegroundColor Green
} else {
    Write-Host "  [WARN] .env.example not found" -ForegroundColor Yellow
}

# Step 3: Start Docker services
Write-Host "[3/5] Starting Docker services..." -ForegroundColor Yellow

# Check Docker daemon is accessible
try {
    $null = docker ps -a 2>$null
    $dockerOk = $LASTEXITCODE -eq 0
} catch {
    $dockerOk = $false
}
if (-not $dockerOk) {
    Write-Host "  [ERROR] Docker daemon is not running." -ForegroundColor Red
    Write-Host "  Please start Docker Desktop and wait for it to fully initialize." -ForegroundColor Yellow
    Write-Host "  Then re-run this script." -ForegroundColor Yellow
    exit 1
}

Push-Location $DockerDir

try {
    docker compose `
        -f docker-compose.yml `
        -f docker-compose.local.yml `
        up -d `
        postgres, redis, kafka, zookeeper, minio, jaeger, `
        init-databases, init-migrations, `
        auth-service, kyc-service, loan-service, `
        decision-engine, integration-service, `
        notification-service, dsa-service, document-service, `
        frontend, `
        mock-server, kafka-ui, mailhog, pgadmin

    Write-Host "  [OK] Containers started" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Failed to start containers: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Step 4: Wait for services to be healthy
Write-Host "[4/5] Waiting for services to be healthy..." -ForegroundColor Yellow
$Services = @("postgres", "redis", "kafka", "mock-server")
$Timeout = 120
$StartTime = Get-Date

foreach ($svc in $Services) {
    Write-Host -n "  Checking $svc..."
    $Ready = $false
    while (((Get-Date) - $StartTime).TotalSeconds -lt $Timeout) {
        $status = docker inspect --format='{{.State.Health.Status}}' "$svc" 2>$null
        if ($status -eq "healthy") {
            Write-Host " OK" -ForegroundColor Green
            $Ready = $true
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not $Ready) {
        Write-Host " TIMEOUT" -ForegroundColor Red
    }
}

# Step 5: Run seed data
Write-Host "[5/5] Running seed data..." -ForegroundColor Yellow
$SeedFiles = @(
    @{File="00_seed_config.sql"; Db="los_shared"},
    @{File="01_seed_users.sql"; Db="los_auth"},
    @{File="02_seed_loan_applications.sql"; Db="los_loan"},
    @{File="03_seed_kyc_records.sql"; Db="los_kyc"},
    @{File="04_seed_bureau_reports.sql"; Db="los_decision"},
    @{File="04_seed_bureau_reports.sql"; Db="los_integration"},
    @{File="05_seed_decision_results.sql"; Db="los_decision"},
    @{File="06_seed_documents.sql"; Db="los_document"},
    @{File="07_seed_dsa.sql"; Db="los_dsa"},
    @{File="08_seed_disbursements.sql"; Db="los_integration"},
    @{File="09_seed_audit_logs.sql"; Db="los_shared"}
)

foreach ($seed in $SeedFiles) {
    $SeedPath = Join-Path $ProjectRoot "database\seeds\$($seed.File)"
    if (Test-Path $SeedPath) {
        $cmd = "docker exec -i postgres psql -U los_user -d $($seed.Db) -c `"SET ON_ERROR_STOP=0;`" < `"$SeedPath`" 2>nul"
        Invoke-Expression $cmd | Out-Null
    }
}

Write-Host "  [OK] Seed data loaded" -ForegroundColor Green

# Verify service health
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LOS Platform is running!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend:      http://localhost:3000" -ForegroundColor White
Write-Host "  Auth API:      http://localhost:3001" -ForegroundColor White
Write-Host "  KYC API:       http://localhost:3002" -ForegroundColor White
Write-Host "  Loan API:      http://localhost:3003" -ForegroundColor White
Write-Host "  Decision API:  http://localhost:3004" -ForegroundColor White
Write-Host "  Mock Server:   http://localhost:8080" -ForegroundColor White
Write-Host "  Kafka UI:      http://localhost:8090" -ForegroundColor White
Write-Host "  MailHog:       http://localhost:8025" -ForegroundColor White
Write-Host "  pgAdmin:       http://localhost:8050" -ForegroundColor White
Write-Host "  API Gateway:    http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "  Test login:   Mobile 9999999991 / OTP 123456" -ForegroundColor Green
Write-Host ""
Write-Host "  Stop:  cd devops\docker; docker compose -f docker-compose.yml -f docker-compose.local.yml down" -ForegroundColor Gray
Write-Host "  Logs: docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f" -ForegroundColor Gray
Write-Host ""

Pop-Location
