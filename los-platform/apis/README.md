# LOS Platform API Testing

## Services

| Service | Port | Base URL | Description |
|---------|------|----------|-------------|
| Auth Service | 3001 | `http://localhost:3001` | OTP, JWT, LDAP, sessions |
| KYC Service | 3002 | `http://localhost:3002` | Aadhaar, PAN, face match |
| Loan Service | 3003 | `http://localhost:3003` | Applications, EMI, sanction, agreements |
| Document Service | 3009 | `http://localhost:3009` | Presigned URLs, OCR, checklists |
| Decision Engine | 3005 | `http://localhost:3005` | Rules, ML models, credit decisions |
| Integration Service | 3006 | `http://localhost:3006` | Bureau, disbursement, NACH |
| Notification Service | 3007 | `http://localhost:3007` | SMS, email, templates |
| DSA Service | 3008 | `http://localhost:3008` | DSA partner portal |

## Quick Start

### 1. Postman Collection

Import `postman/LOS_Platform_API.postman_collection.json` into Postman.

**Setup:**
1. Set `baseUrl` to your Auth Service URL (e.g., `http://localhost:3001`)
2. Update all service URLs in the collection variables
3. Run **Send OTP** → **Verify OTP** to get an `accessToken`
4. All authenticated requests use the `accessToken` variable

**Test Flow:**
1. `Send OTP` → captures `sessionId`
2. `Verify OTP` → captures `accessToken` + `refreshToken`
3. `Create Application` → captures `applicationId`
4. Continue through KYC → Documents → Decision → Sanction → eSign

### 2. VS Code REST Client

Open `http/los-api-tests.http` in VS Code. Install the **REST Client** extension.

The file uses collection-level variables set via `@name` directives and response scripts.

### 3. Environment Variables

```bash
# Docker Compose (local dev)
export BASE_URL=http://localhost:3001
export LOAN_SERVICE=http://localhost:3003
export KYC_SERVICE=http://localhost:3002
export DECISION_SERVICE=http://localhost:3005
export INTEGRATION_SERVICE=http://localhost:3006
export DSA_SERVICE=http://localhost:3008

# Production (behind Kong API Gateway)
export BASE_URL=https://api.losbank.example.com
```

## Test Credentials

### OTP (Development)
- **Mobile:** `9876543210`
- **OTP:** `123456` (mock — bypasses actual SMS in dev mode)
- **Session TTL:** 5 minutes

### LDAP / Staff Login
- **Username:** `loan_officer_01`
- **Password:** `BankPass123!`

### DSA Partner Login
- **Partner Code:** `ABC001`
- **Password:** `DSA@Pass123!`

## API Response Format

All APIs follow a standard envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-04-09T12:00:00.000Z",
  "requestId": "req-xxx"
}
```

Error responses:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [...]
  },
  "timestamp": "2026-04-09T12:00:00.000Z",
  "requestId": "req-xxx"
}
```

## Common Headers

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {token}` | Yes (protected routes) |
| `Content-Type` | `application/json` | POST/PATCH |
| `X-Request-ID` | UUID | Recommended |
| `X-Idempotency-Key` | UUID | POST requests |
| `X-Correlation-ID` | UUID | Distributed tracing |

## End-to-End Flow

```
OTP Send → OTP Verify → Create Application → Submit
  → KYC (Consent → Aadhaar → PAN → Face Match)
  → Documents (Upload → OCR → Review)
  → Decision (Bureau Pull → Credit Assessment)
  → Sanction Letter (Review → Accept)
  → Loan Agreement (Generate → eSign)
  → Disbursement (NACH → IMPS/NEFT/RTGS)
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/otp/send` | 3 requests | per mobile, per hour |
| `POST /auth/otp/verify` | 5 attempts | per session |
| General API | 100 requests | per IP, per minute |

## Mock Data

In development mode (`NODE_ENV=development`), the following are mocked:
- UIDAI Aadhaar API (OTP always succeeds with `123456`)
- NSDL PAN Verification (always returns valid)
- Bureau pull (returns mock CIBIL score 700-800)
- NPCI disbursement (async callback simulated)
- NSDL eSign (mock transaction flow)

## Postman Test Scripts

Every request in the Postman collection has test scripts that:
- Validate response status codes
- Assert response structure
- Set collection variables for chained requests
- Log key data for debugging

Run the full collection with:
```
npm run test:e2e -- --testPathPattern=auth
```

## Troubleshooting

**401 on all requests:**
- Token expired — run `Verify OTP` again or `Refresh Token`

**409 Duplicate Application:**
- Same PAN + loan type within 30 days — use a different PAN

**500 on KYC:**
- UIDAI in dev mode returns mock data — check `NODE_ENV`

**Presigned URL upload fails:**
- URL expires in 15 minutes — upload immediately after generation

**eSign stuck at PENDING:**
- In dev mode, use `POST /loan-agreement/esign/verify` directly with OTP `123456`
