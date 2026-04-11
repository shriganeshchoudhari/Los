# LOS Platform -- Generate JWT RSA-2048 Key Pair (PowerShell)
# Outputs keys to backend/keys/ (gitignored)
#
# Usage:
#   .\scripts\gen-jwt-keys.ps1

$ErrorActionPreference = "Stop"

$KeysDir = Join-Path $PSScriptRoot "..\backend\keys"
$PrivateKey = Join-Path $KeysDir "jwt-private.pem"
$PublicKey = Join-Path $KeysDir "jwt-public.pem"

Write-Host "=== JWT Key Generation ===" -ForegroundColor Cyan
Write-Host "Keys directory: $KeysDir"

if (-not (Test-Path $KeysDir)) {
    New-Item -ItemType Directory -Path $KeysDir -Force | Out-Null
}

if (Test-Path $PrivateKey) {
    Write-Host "  [INFO] Private key already exists -- skipping generation" -ForegroundColor Yellow
    Write-Host "  To regenerate, delete $PrivateKey first" -ForegroundColor Yellow
    exit 0
}

# Try OpenSSL from Git bin first, then system PATH
$opensslExe = $null
$gitSsl = "C:\Program Files\Git\usr\bin\openssl.exe"
if (Test-Path $gitSsl) {
    $opensslExe = $gitSsl
} else {
    $opensslExe = (Get-Command openssl -ErrorAction SilentlyContinue).Source
}

if ($opensslExe) {
    Write-Host "  Generating RSA-2048 keys via OpenSSL..."
    $env:GIT_TERMINAL_PROMPT = "0"
    & $opensslExe genrsa -out $PrivateKey 2048 >$null 2>&1
    & $opensslExe rsa -in $PrivateKey -pubout -out $PublicKey >$null 2>&1
} else {
    Write-Host "  [ERROR] OpenSSL not found. Install Git (includes OpenSSL) or .NET 5+ SDK." -ForegroundColor Red
    Write-Host "  Manual steps:" -ForegroundColor Yellow
    Write-Host "    1. Install Git for Windows: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "    2. Re-run this script" -ForegroundColor Yellow
    exit 1
}

# Set restrictive permissions on private key (Windows)
$acl = Get-Acl $PrivateKey
$acl.SetAccessRuleProtection($true, $false)
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "Allow")
$acl.AddAccessRule($rule)
Set-Acl -Path $PrivateKey -AclObject $acl

Write-Host "  [OK] Keys generated:" -ForegroundColor Green
Write-Host "    Private: $PrivateKey"
Write-Host "    Public:  $PublicKey"
Write-Host ""
Write-Host "  Add to docker-compose.yml environment:" -ForegroundColor Cyan
Write-Host "    JWT_PRIVATE_KEY_FILE: /keys/jwt-private.pem"
Write-Host "  Add volume mount:" -ForegroundColor Cyan
Write-Host "    - ./backend/keys:/keys:ro"
Write-Host ""
Write-Host "  NEVER commit these files to Git!" -ForegroundColor Red
