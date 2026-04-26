# Mock APIs Reference

**Mock server:** WireMock — `devops/docker/mock-server/mappings/`  
**Local port:** `8080` (via `devops/docker/docker-compose.local.yml`)  
**Purpose:** Simulate all external third-party APIs so the platform runs end-to-end locally without real credentials.

---

## Overview

| Mapping file | APIs mocked | Used by module |
|-------------|------------|----------------|
| `uidai.json` | UIDAI Aadhaar OTP + verify | KYC |
| `nsdl.json` | NSDL PAN verify + NSDL eSign | KYC, Loan |
| `bureau.json` | CIBIL, Experian, CRIF, Equifax | Integration |
| `npci.json` | NACH mandate, IMPS transfer, penny-drop, UPI collect | Integration |
| `cbs.json` | CBS (Finacle) customer create, loan create, account inquiry | Integration |
| `ocr.json` | Salary slip OCR, bank statement OCR, PAN OCR, face-match/liveness | Document |
| `notifications.json` | SMS (Kaleyra), WhatsApp (Gupshup) | Notification |

WireMock uses `{{jsonPath originalRequest body '$.fieldName'}}` and `{{randomValue length=N}}` helpers to echo request data and generate realistic random values.

---

## 1. UIDAI Aadhaar (`uidai.json`)

### POST `/uid/otp` — Initiate Aadhaar OTP

**Request:**
```json
{ "aadhaarNumber": "XXXX-XXXX-1234", "txnId": "..." }
```

**Mock response:**
```json
{
  "success": true,
  "statusCode": "101",
  "message": "OTP sent successfully",
  "txnId": "uid-otp-txn-<random16>",
  "retry": false,
  "otpLength": 6
}
```

Note: The `txnId` field in the mock mapping has a leading space: `" txnId"` — this is a bug in the WireMock mapping. Fix to `"txnId"` before use.

---

### POST `/uid/verify` — Verify Aadhaar OTP

**Request:**
```json
{ "txnId": "...", "otp": "123456", "name": "Ravi Sharma", "dob": "1990-01-15", "gender": "M", "mobile": "9876543210", "address": { ... } }
```

**Mock response:**
```json
{
  "success": true,
  "statusCode": "200",
  "txnId": "uid-verify-txn-<random16>",
  "resident": {
    "aadhaarNumber": "XXXX-XXXX-7842",
    "name": "<echoed from request>",
    "dateOfBirth": "<echoed from request>",
    "gender": "<echoed from request>",
    "photo": "base64_encoded_photo_data_here"
  },
  "eKycXML": "<base64 mock XML>",
  "signature": "MOCK_XML_SIGNATURE_BASE64"
}
```

**Spring Boot wiring:** `KycService.verifyAadhaarOtp()` must call `${los.kyc.uidai.base-url}/uid/verify` and parse the XML. Currently hardcodes mock data instead of calling this endpoint. Set `los.kyc.uidai.base-url=http://localhost:8080` in dev to route to WireMock.

---

## 2. NSDL PAN + eSign (`nsdl.json`)

### POST `/tin/pan` — PAN Verification

**Request:**
```json
{ "pan": "ABCDE1234F", "fullName": "Ravi Sharma", "dob": "1990-01-15" }
```

**Mock response:**
```json
{
  "success": true,
  "statusCode": "100",
  "result": {
    "panNumber": "<echoed>",
    "fullName": "<echoed>",
    "dateOfBirth": "<echoed>",
    "panStatus": "VALID",
    "nameMatchScore": 95,
    "aadhaarLinked": true,
    "last4Aadhaar": "XXXX"
  }
}
```

**Spring Boot wiring:** `KycService.verifyPan()` must call `${los.kyc.nsdl.base-url}/tin/pan`. Set `los.kyc.nsdl.base-url=http://localhost:8080` to route to WireMock.

---

### POST `/esign/initiate` — NSDL eSign Initiation

**Request:** `{ applicationId, signerName, signerMobile, signerEmail }`

**Mock response:**
```json
{
  "success": true,
  "statusCode": "200",
  "esignTxnId": "esign-txn-<random16>",
  "message": "eSign OTP sent to registered mobile",
  "otpRefNumber": "OTP-REF-<random10>",
  "expiryMinutes": 15
}
```

---

### POST `/esign/verify` — NSDL eSign OTP Verification

**Request:** `{ esignTxnId, otp, signerName, aadhaarLast4 }`

**Mock response:**
```json
{
  "success": true,
  "statusCode": "200",
  "esignTxnId": "<echoed>",
  "message": "eSign completed successfully",
  "documentHash": "mock_sha256_document_hash",
  "signerName": "<echoed>",
  "signatureBase64": "TVNUAQADAAAAAgAAAAA=",
  "certificate": "MIIDXTCCAkWgAwIBAgIJA==",
  "signedAt": "<ISO timestamp>"
}
```

---

## 3. Credit Bureaus (`bureau.json`)

All bureau endpoints accept `{ name, pan, dob, mobile }` in the request body and echo `name`/`pan` in the response.

### POST `/bureau/cibil/report`

**Mock response (key fields):**
```json
{
  "bureau": "CIBIL",
  "reportId": "CIB-<random8>",
  "score": 720,
  "grade": "B",
  "totalAccounts": 2,
  "activeAccounts": 1,
  "totalMonthlyEmi": 15000,
  "dpdBucket": { "current": 1, "dpd0To30": 0, "dpd90Plus": 0 },
  "enquiries": { "last30Days": 0, "last12Months": 2 },
  "creditUtilization": 28,
  "suitFiled": false,
  "writeOff": false,
  "accounts": [ { "accountType": "Home Loan", "status": "Active", ... } ]
}
```

### POST `/bureau/experian/report`
Returns `score: 735`, `creditUtilization: 35`.

### POST `/bureau/crif/report`
Returns `score: 710`, `creditUtilization: 42`.

### POST `/bureau/equifax/report`
Returns `score: 705`, `creditUtilization: 38`.

**Spring Boot wiring:** All four bureau stubs. Set `CIBIL_API_BASE_URL=http://localhost:8080` etc. to route to WireMock. Add `@CircuitBreaker(name="cibil")` to `BureauIntegrationService.pullBureauData()`.

---

## 4. NPCI Payments (`npci.json`)

### POST `/npci/nach/mandate` — Register NACH Mandate

**Mock response:**
```json
{
  "statusCode": "MDS-000",
  "mandateId": "NACH-MOCK-<random12>",
  "umrn": "UMRN-MOCK-<random15>",
  "status": "PENDING",
  "expiryDate": "<now + 5 years>"
}
```

### POST `/npci/nach/mandate/confirm` — Confirm NACH Mandate

**Mock response:**
```json
{
  "statusCode": "MDS-000",
  "umrn": "<echoed>",
  "status": "ACTIVE",
  "activatedDate": "<today>"
}
```

### POST `/npci/imps/transfer` — IMPS Disbursement

**Mock response:**
```json
{
  "statusCode": "MDS-000",
  "referenceNumber": "IMPS-MOCK-<random12>",
  "utrNumber": "UTR<random12 numeric>",
  "amount": "<echoed>",
  "transactionDate": "<now>",
  "status": "SUCCESS"
}
```

### POST `/npci/imps/penny-drop` — Penny Drop Verification

**Mock response:**
```json
{
  "statusCode": "MDS-000",
  "accountNumber": "<echoed>",
  "accountHolderName": "<echoed>",
  "nameMatch": true,
  "matchScore": 100
}
```

### POST `/npci/upi/collect` — UPI Collect

**Mock response:**
```json
{
  "statusCode": "MDS-000",
  "referenceNumber": "UPI-MOCK-<random12>",
  "status": "SUCCESS",
  "payerVpa": "success@vpa.mockbank"
}
```

---

## 5. CBS / Finacle (`cbs.json`)

### POST `/cbs/customer/create` — Create Customer in CBS

**Mock response:**
```json
{
  "statusCode": "CBS-000",
  "customerId": "CUST-MOCK-<random10>",
  "customerName": "<echoed>",
  "customerSince": "<today>",
  "cbsReference": "CBS-REF-<random12>"
}
```

### POST `/cbs/loan/create` — Create Loan Account in CBS

**Mock response:**
```json
{
  "statusCode": "CBS-000",
  "loanAccountNumber": "LA-MOCK-<random12>",
  "customerId": "<echoed>",
  "sanctionedAmount": "<echoed>",
  "accountStatus": "ACTIVE",
  "cbsReference": "CBS-REF-<random12>"
}
```

### POST `/cbs/account/inquire` — Account Inquiry

**Mock response:**
```json
{
  "statusCode": "CBS-000",
  "accountNumber": "<echoed>",
  "accountHolderName": "<echoed>",
  "accountStatus": "ACTIVE",
  "accountBalance": 50000.00
}
```

### POST `/cbs/account/verify-penny` — CBS Penny Drop

**Mock response:**
```json
{
  "statusCode": "CBS-000",
  "accountHolderName": "<echoed>",
  "nameMatch": true,
  "verificationDate": "<now>"
}
```

---

## 6. OCR & Face Match (`ocr.json`)

### POST `/ocr/salary` — Salary Slip OCR

**Mock response:**
```json
{
  "documentType": "SALARY_SLIP",
  "confidence": 92,
  "extractedData": {
    "employerName": "TechCorp India Pvt Ltd",
    "employeeName": "<echoed from request.name>",
    "netSalary": 75000,
    "grossSalary": 95000,
    "deductions": 20000,
    "accountNumber": "XXXXXXXX1234",
    "month": "July",
    "year": 2024
  },
  "validation": { "panMatches": true, "salaryReasonable": true, "documentReadable": true }
}
```

### POST `/ocr/bank` — Bank Statement OCR

**Mock response:**
```json
{
  "documentType": "BANK_STATEMENT",
  "confidence": 87,
  "extractedData": {
    "bankName": "HDFC Bank",
    "accountNumberMasked": "XXXXXX1234",
    "statementPeriod": { "from": "2024-01-01", "to": "2024-06-30" },
    "averageMonthlyBalance": 45000,
    "totalCredits": 580000,
    "bouncedCheques": 0,
    "overdraftUsed": false
  }
}
```

### POST `/ocr/pan` — PAN Card OCR

**Mock response:**
```json
{
  "documentType": "PAN_CARD",
  "confidence": 96,
  "extractedData": {
    "panNumber": "<echoed>",
    "fullName": "<echoed>",
    "dateOfBirth": "<echoed>",
    "panStatus": "VALID"
  }
}
```

### POST `/facematch/verify` — Face Match + Liveness

**Mock response:**
```json
{
  "matchScore": 92,
  "confidence": "HIGH",
  "matchResult": "MATCH",
  "aadhaarPhotoMatch": true,
  "livenessScore": 95,
  "livenessResult": "REAL",
  "spoofDetection": { "score": 5, "result": "REAL_FACE" }
}
```

---

## 7. Notifications (`notifications.json`)

### POST `/sms/send` — Kaleyra SMS

**Mock response:**
```json
{
  "success": true,
  "messageId": "MSG-<random10>",
  "mobile": "<echoed>",
  "status": "SENT",
  "sentAt": "<now>"
}
```

### POST `/whatsapp/send` — Gupshup WhatsApp

**Mock response:**
```json
{
  "success": true,
  "messageId": "WA-<random10>",
  "mobile": "<echoed>",
  "status": "DELIVERED"
}
```

---

## Running WireMock Locally

```bash
# Start WireMock alongside infrastructure
cd devops/docker
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d mock-server

# Verify it's running
curl http://localhost:8080/__admin/mappings
```

The `docker-compose.local.yml` also starts:
- **Kafka UI** at `http://localhost:8090`
- **MailHog** (email mock) at `http://localhost:8025`
- **pgAdmin** at `http://localhost:8050`

---

## Environment Variable Wiring

For Spring Boot to route external calls through WireMock, set these in `.env` or `application-dev.yml`:

```yaml
los:
  kyc:
    uidai:
      base-url: http://localhost:8080
    nsdl:
      base-url: http://localhost:8080
    face-match:
      url: http://localhost:8080/facematch/verify
  integration:
    cibil-url: http://localhost:8080/bureau/cibil/report
    experian-url: http://localhost:8080/bureau/experian/report
    equifax-url: http://localhost:8080/bureau/equifax/report
    crif-url: http://localhost:8080/bureau/crif/report
    npci-url: http://localhost:8080
    cbs-url: http://localhost:8080
  notification:
    sms-url: http://localhost:8080/sms/send
    whatsapp-url: http://localhost:8080/whatsapp/send
  document:
    ocr-url: http://localhost:8080
```

---

## Known Issues in WireMock Mappings

| File | Issue | Fix |
|------|-------|-----|
| `uidai.json` | `" txnId"` has a leading space | Change to `"txnId"` |
| `bureau.json` | Static scores (720, 735, 710, 705) — no variance | Use `{{randomValue type='DECIMAL' lower='620' upper='800'}}` for realistic testing |
| `cbs.json` | SOAP endpoints not mocked — CBS typically uses SOAP | Add SOAP XML mappings for Finacle `CreateCustomer` / `CreateLoanAccount` WSDL operations |
| All | WireMock template variables like `{{now offset='+5 years'}}` require WireMock 3.x | Verify WireMock version in docker-compose.local.yml |

---

## Adding New Mock Mappings

Create a JSON file in `devops/docker/mock-server/mappings/` following WireMock's stub format:

```json
[
  {
    "request": {
      "method": "POST",
      "urlPath": "/your/api/endpoint"
    },
    "response": {
      "status": 200,
      "jsonBody": {
        "success": true,
        "data": "{{randomValue length=8}}"
      },
      "headers": { "Content-Type": "application/json" }
    }
  }
]
```

WireMock hot-reloads mappings — no restart needed when running in Docker.
