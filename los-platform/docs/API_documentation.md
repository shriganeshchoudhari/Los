# API Documentation
## Loan Origination System (LOS) REST API
**Version:** v1 | **Base URL:** `https://api.los.bank.in/v1` | **Protocol:** HTTPS + TLS 1.3

---

## Authentication

All endpoints require `Authorization: Bearer <JWT>` header except `/auth/*`.

Service-to-service calls use mTLS + service account JWT.

```
X-Request-ID: <uuid>          # Mandatory — for tracing
X-Idempotency-Key: <uuid>     # Mandatory for POST/PUT mutating operations
Content-Type: application/json
```

---

## 1. Auth Service

### POST /auth/otp/send
Send OTP to mobile number.

**Request:**
```json
{
  "mobile": "9876543210",
  "purpose": "LOGIN",
  "channel": "SMS"
}
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresIn": 300,
    "maskedMobile": "XXXXXX3210"
  },
  "meta": { "requestId": "uuid", "timestamp": "2024-07-15T10:30:00Z", "version": "v1", "processingTimeMs": 45 }
}
```
**Errors:**
| Code | HTTP | Description |
|---|---|---|
| AUTH_003 | 429 | Max OTP attempts exceeded — locked 30 min |
| GEN_003 | 429 | Rate limit exceeded |

---

### POST /auth/otp/verify
Verify OTP and receive JWT.

**Request:**
```json
{
  "mobile": "9876543210",
  "otp": "482931",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceFingerprint": "abc123def456"
}
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "scope": ["application:read", "application:write", "kyc:write"]
  },
  "meta": { ... }
}
```
**Errors:**
| Code | HTTP | Description |
|---|---|---|
| AUTH_001 | 401 | OTP expired |
| AUTH_002 | 401 | OTP invalid |

---

### POST /auth/token/refresh
Refresh access token.

**Request:**
```json
{ "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..." }
```
**Response 200:** Same as `/auth/otp/verify`
**Errors:** AUTH_005 (token revoked), AUTH_004 (expired)

---

### POST /auth/logout
Revoke session.

**Request:** Empty body (token from Authorization header)
**Response 204:** No content

---

## 2. Application Service

### POST /applications
Create new loan application.

**Required Role:** APPLICANT, LOAN_OFFICER, DSA

**Request:**
```json
{
  "loanType": "PERSONAL_LOAN",
  "channelCode": "MOBILE_APP",
  "applicant": {
    "fullName": "Ravi Sharma",
    "dob": "1990-04-21",
    "gender": "MALE",
    "maritalStatus": "MARRIED",
    "mobile": "9876543210",
    "email": "ravi.sharma@email.com",
    "residentialStatus": "RESIDENT_INDIAN",
    "addresses": [{
      "line1": "Flat 302, Orchid Heights",
      "city": "Pune",
      "district": "Pune",
      "state": "MH",
      "pincode": "411057",
      "country": "IN",
      "addressType": "CURRENT"
    }],
    "yearsAtCurrentAddress": 3,
    "ownOrRentedResidence": "RENTED"
  },
  "employmentDetails": {
    "employmentType": "SALARIED_PRIVATE",
    "employerName": "Infosys Limited",
    "employerPAN": "AAACI1681G",
    "designation": "Senior Engineer",
    "totalWorkExperienceMonths": 84,
    "currentJobExperienceMonths": 50,
    "grossMonthlyIncome": 12000000,
    "netMonthlyIncome": 9500000,
    "totalAnnualIncome": 144000000
  },
  "loanRequirement": {
    "requestedAmount": 50000000,
    "requestedTenureMonths": 36,
    "purposeDescription": "Medical emergency"
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "applicationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "applicationNumber": "LOS-2024-MH-000342",
    "status": "DRAFT",
    "nextStep": "COMPLETE_KYC",
    "createdAt": "2024-07-15T10:30:00Z"
  },
  "meta": { ... }
}
```
**Errors:**
| Code | HTTP | Description |
|---|---|---|
| APP_003 | 409 | Duplicate application (same PAN + product, 30 days) |
| GEN_004 | 422 | Validation error — `field` indicates which field |

---

### GET /applications/{applicationId}
Fetch full application details.

**Required Role:** APPLICANT (own only), LOAN_OFFICER, CREDIT_ANALYST, BRANCH_MANAGER, COMPLIANCE_OFFICER

**Response 200:**
```json
{
  "success": true,
  "data": {
    "applicationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "applicationNumber": "LOS-2024-MH-000342",
    "status": "CREDIT_ASSESSMENT",
    "loanType": "PERSONAL_LOAN",
    "applicant": { /* ApplicantProfile */ },
    "employmentDetails": { /* EmploymentDetails */ },
    "loanRequirement": { /* LoanRequirement */ },
    "kycId": "uuid",
    "bureauReportId": "uuid",
    "assignedOfficerId": "uuid",
    "submittedAt": "2024-07-15T10:35:00Z",
    "createdAt": "2024-07-15T10:30:00Z",
    "updatedAt": "2024-07-15T11:00:00Z",
    "version": 7
  },
  "meta": { ... }
}
```
**Errors:** APP_001 (not found), AUTH_006 (insufficient role)

---

### PATCH /applications/{applicationId}
Update application section.

**Required Role:** APPLICANT (own DRAFT only), LOAN_OFFICER

**Request:**
```json
{
  "section": "EMPLOYMENT",
  "data": {
    "grossMonthlyIncome": 13000000
  },
  "version": 7
}
```
**Response 200:** Updated application summary
**Errors:** APP_004 (invalid state — not DRAFT/DOCUMENT_COLLECTION), APP_005 (version conflict)

---

### POST /applications/{applicationId}/submit
Submit draft application.

**Required Role:** APPLICANT, LOAN_OFFICER

**Response 200:**
```json
{
  "success": true,
  "data": {
    "applicationId": "uuid",
    "status": "SUBMITTED",
    "nextStep": "COMPLETE_KYC"
  }
}
```
**Errors:** APP_004 (not in DRAFT state)

---

### GET /applications
List applications (paginated, filtered).

**Required Role:** LOAN_OFFICER, CREDIT_ANALYST, BRANCH_MANAGER, ADMIN

**Query params:**
- `status` — filter by status
- `loanType` — filter by product
- `assignedOfficerId` — filter by officer
- `branchCode` — filter by branch
- `fromDate` / `toDate` — date range
- `page` (default 0), `size` (default 20, max 100)
- `sortBy` (default `createdAt`), `sortOrder` (default `DESC`)

**Response 200:** `PagedResponse<ApplicationSummaryResponse>`

---

### GET /applications/{applicationId}/stage-history
Get full state transition history.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fromStatus": "SUBMITTED",
      "toStatus": "KYC_IN_PROGRESS",
      "actionBy": "uuid",
      "actionByRole": "SYSTEM",
      "remarks": "Auto-triggered KYC on submission",
      "timestamp": "2024-07-15T10:35:00Z"
    }
  ]
}
```

---

## 3. KYC Service

### POST /kyc/{applicationId}/aadhaar/initiate
Initiate Aadhaar eKYC — sends OTP to Aadhaar-linked mobile.

**Required Role:** APPLICANT (own), LOAN_OFFICER

**Request:**
```json
{
  "aadhaarNumber": "ENCRYPTED_BASE64_AADHAAR",
  "consentOtpSessionId": "uuid"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "txnId": "txn_20240715_103045_001",
    "uidaiRefId": "UIDAI_REF_ABC123",
    "expiresIn": 300
  }
}
```
**Errors:** KYC_003 (UIDAI unavailable — circuit open), GEN_004 (invalid Aadhaar format)

---

### POST /kyc/{applicationId}/aadhaar/verify
Verify Aadhaar OTP and complete eKYC.

**Request:**
```json
{
  "txnId": "txn_20240715_103045_001",
  "otp": "ENCRYPTED_OTP_BASE64",
  "uidaiRefId": "UIDAI_REF_ABC123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "kycId": "uuid",
    "status": "AADHAAR_VERIFIED",
    "extractedData": {
      "name": "RAVI SHARMA",
      "dob": "1990-04-21",
      "gender": "M",
      "addressCity": "Pune",
      "addressState": "Maharashtra",
      "addressPincode": "411057"
    },
    "photoPresent": true,
    "signatureValid": true
  }
}
```
**Note:** Full Aadhaar address and photo not returned to client — stored server-side only.
**Errors:** KYC_001 (OTP expired), KYC_002 (OTP invalid), KYC_003 (UIDAI error)

---

### POST /kyc/{applicationId}/pan/verify
Verify PAN number.

**Request:**
```json
{
  "panNumber": "ABCRS1234F",
  "fullName": "RAVI SHARMA",
  "dob": "1990-04-21"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "panStatus": "VALID",
    "nameMatchScore": 94,
    "nameOnPAN": "RAVI KUMAR SHARMA",
    "dobMatch": true,
    "linkedAadhaar": true,
    "aadhaarSeedingStatus": "SEEDED"
  }
}
```
**Errors:** KYC_004 (name mismatch score < 60), KYC_005 (PAN invalid/inactive)

---

### POST /kyc/{applicationId}/face-match
Submit selfie for face match against Aadhaar photo.

**Request:** `multipart/form-data`
- `selfie` — JPG/PNG, max 2MB

**Response 200:**
```json
{
  "success": true,
  "data": {
    "matchScore": 88,
    "passed": true,
    "livenessScore": 92,
    "livenessCheckPassed": true,
    "processedAt": "2024-07-15T10:38:00Z"
  }
}
```
**Errors:** KYC_006 (score < 70), KYC_007 (liveness failed)

---

### GET /kyc/{applicationId}
Get KYC record status.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "kycId": "uuid",
    "status": "KYC_COMPLETE",
    "aadhaarVerified": true,
    "panVerified": true,
    "faceMatchPassed": true,
    "overallRiskScore": 12,
    "completedAt": "2024-07-15T10:40:00Z"
  }
}
```

---

## 4. Document Service

### POST /documents/{applicationId}/upload-url
Get presigned URL for direct S3 upload.

**Request:**
```json
{
  "documentType": "SALARY_SLIP_1",
  "mimeType": "application/pdf",
  "fileSizeBytes": 245000
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "uploadUrl": "https://minio.los.bank.in/docs/path?X-Amz-Signature=...",
    "expiresAt": "2024-07-15T10:45:00Z",
    "maxFileSizeBytes": 10485760,
    "allowedMimeTypes": ["application/pdf", "image/jpeg", "image/png"]
  }
}
```
**After upload:** Client must call `/documents/{documentId}/confirm`

---

### POST /documents/{documentId}/confirm
Confirm upload completion; triggers OCR.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "status": "OCR_PROCESSING",
    "estimatedProcessingSeconds": 30
  }
}
```

---

### GET /documents/{applicationId}
List all documents for an application.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "documentId": "uuid",
      "documentType": "SALARY_SLIP_1",
      "status": "APPROVED",
      "ocrExtracted": {
        "employerName": "Infosys Limited",
        "salary": "120000.00",
        "month": "June 2024"
      },
      "uploadedAt": "2024-07-15T10:41:00Z"
    }
  ]
}
```

---

### PATCH /documents/{documentId}/review
Officer reviews and approves/rejects document.

**Required Role:** LOAN_OFFICER, CREDIT_ANALYST

**Request:**
```json
{
  "decision": "REJECTED",
  "rejectionReason": "Salary slip illegible — request re-upload"
}
```
**Response 200:** Updated document record

---

## 5. Bureau Service

### POST /bureau/{applicationId}/pull
Initiate credit bureau pull.

**Required Role:** LOAN_OFFICER, SYSTEM

**Request:**
```json
{
  "providers": ["CIBIL", "EXPERIAN"],
  "consentTimestamp": "2024-07-15T10:30:00Z",
  "consentIpAddress": "103.21.58.142"
}
```

**Response 202:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "IN_PROGRESS",
    "providers": ["CIBIL", "EXPERIAN"],
    "estimatedCompletionSeconds": 60
  }
}
```
**Errors:** BUR_003 (no consent), BUR_004 (duplicate within 30 days)

---

### GET /bureau/{applicationId}/report
Get bureau report summary.

**Required Role:** LOAN_OFFICER, CREDIT_ANALYST, BRANCH_MANAGER

**Response 200:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "SUCCESS",
    "creditScore": 751,
    "scoreModel": "CIBIL TransUnion Score 3.0",
    "activeAccounts": 3,
    "totalExposure": 85000000,
    "overdueAmount": 0,
    "dpdSummary": {
      "dpd30": 0,
      "dpd60": 0,
      "dpd90": 0,
      "worstDpdLast24Months": 0
    },
    "enquiriesLast6Months": 2,
    "fraudFlag": false,
    "wilfulDefaulter": false,
    "providers": [
      { "provider": "CIBIL", "status": "SUCCESS", "score": 751 },
      { "provider": "EXPERIAN", "status": "SUCCESS", "score": 748 }
    ]
  }
}
```
**Errors:** BUR_001 (in progress/timeout), BUR_002 (no hit — thin file)

---

## 6. Decision Engine

### POST /decisions/{applicationId}/trigger
Trigger automated credit decision.

**Required Role:** LOAN_OFFICER, SYSTEM

**Request:**
```json
{
  "forceRerun": false
}
```

**Response 202:**
```json
{
  "success": true,
  "data": {
    "decisionId": "uuid",
    "status": "IN_PROGRESS",
    "estimatedCompletionSeconds": 15
  }
}
```

---

### GET /decisions/{applicationId}
Get decision result.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "decisionId": "uuid",
    "status": "APPROVED",
    "finalDecision": "APPROVE",
    "approvedAmount": 50000000,
    "approvedTenureMonths": 36,
    "rateOfInterestBps": 1075,
    "interestRateType": "FIXED",
    "processingFeePaisa": 50000,
    "foirActual": 34.2,
    "ltvRatio": null,
    "ruleResults": [
      {
        "ruleId": "RULE_CS_001",
        "ruleName": "Minimum Credit Score",
        "outcome": "PASS",
        "threshold": 700,
        "actualValue": 751,
        "isHardStop": true
      },
      {
        "ruleId": "RULE_FOIR_001",
        "ruleName": "Maximum FOIR",
        "outcome": "PASS",
        "threshold": 55,
        "actualValue": 34.2,
        "isHardStop": true
      }
    ],
    "scorecardResult": {
      "modelId": "pl_salaried_v2",
      "totalScore": 742,
      "grade": "A",
      "bandLabel": "PRIME",
      "predictionProbability": 0.012
    },
    "decidedBy": "RULE_ENGINE",
    "decidedAt": "2024-07-15T11:05:00Z"
  }
}
```

---

### POST /decisions/{applicationId}/manual-override
Manual decision override (senior officer).

**Required Role:** BRANCH_MANAGER, ZONAL_CREDIT_HEAD

**Request:**
```json
{
  "decision": "APPROVE",
  "approvedAmount": 50000000,
  "approvedTenureMonths": 36,
  "rateOfInterestBps": 1100,
  "conditions": [
    {
      "conditionCode": "COND_001",
      "description": "Submit Form 16 within 7 days",
      "isMandatory": true,
      "dueDate": "2024-07-22"
    }
  ],
  "remarks": "Policy exception approved — strong income, clean bureau history"
}
```
**Response 200:** Updated decision record

---

## 7. Loan Service

### POST /loans/{applicationId}/sanction
Issue sanction letter (post-decision approval).

**Required Role:** BRANCH_MANAGER (checker)

**Request:**
```json
{
  "checkerUserId": "uuid",
  "checkerRemarks": "Verified — approved"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "loanId": "uuid",
    "sanctionLetterUrl": "https://api.los.bank.in/v1/loans/uuid/sanction-letter",
    "sanctionedAmount": 50000000,
    "rateOfInterestBps": 1075,
    "tenureMonths": 36,
    "emiAmount": 1628500,
    "sanctionedAt": "2024-07-15T11:10:00Z"
  }
}
```

---

### POST /loans/{loanId}/disburse
Initiate disbursement.

**Required Role:** LOAN_OFFICER (maker) → BRANCH_MANAGER (checker)

**Request:**
```json
{
  "disbursementAmount": 50000000,
  "paymentMode": "IMPS",
  "beneficiary": {
    "name": "Ravi Sharma",
    "accountNumber": "30123456789",
    "ifscCode": "SBIN0001234",
    "accountType": "SAVINGS",
    "bankName": "State Bank of India"
  },
  "narration": "LOS-2024-MH-000342 Personal Loan Disbursal",
  "checkerUserId": "uuid"
}
```

**Response 202:**
```json
{
  "success": true,
  "data": {
    "disbursementId": "uuid",
    "status": "PROCESSING",
    "amount": 50000000,
    "mode": "IMPS",
    "estimatedSettlementMinutes": 5
  }
}
```

---

### GET /loans/{loanId}/emi-schedule
Get amortization schedule.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "loanId": "uuid",
    "installments": [
      {
        "installmentNumber": 1,
        "dueDate": "2024-09-01",
        "openingBalance": 50000000,
        "emiAmount": 1628500,
        "principalComponent": 1190000,
        "interestComponent": 438500,
        "closingBalance": 48810000,
        "status": "UPCOMING"
      }
    ]
  }
}
```

---

## 8. Webhooks

### POST /webhooks/payment (Internal — from NPCI/CBS)
Receive payment status updates.

**Verification:** `X-Webhook-Signature: HMAC-SHA256(secret, body)`

**Payload:**
```json
{
  "webhookId": "uuid",
  "eventType": "PAYMENT_SUCCESS",
  "transactionId": "uuid",
  "utrNumber": "UTIB324567123456",
  "amount": 50000000,
  "status": "SUCCESS",
  "timestamp": "2024-07-15T11:45:00Z",
  "signature": "sha256=abc123...",
  "provider": "NPCI"
}
```

**Response 200:** `{"received": true}`

---

## 9. Error Reference

All error responses follow:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_002",
    "message": "OTP is invalid",
    "details": "The provided OTP does not match",
    "field": null,
    "retryable": true,
    "retryAfterSeconds": null
  },
  "meta": { ... }
}
```

| HTTP Code | Meaning |
|---|---|
| 400 | Bad request — validation error |
| 401 | Unauthorized — invalid/expired token |
| 403 | Forbidden — insufficient role |
| 404 | Resource not found |
| 409 | Conflict — duplicate or version mismatch |
| 422 | Unprocessable entity — business rule violation |
| 429 | Rate limited |
| 500 | Internal server error |
| 502 | External service unavailable |
| 503 | Circuit breaker open |

---

## 10. SOAP API Reference (CBS Integration — Internal)

### CBS Customer Creation
```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:cus="http://los.bank.in/cbs/customer">
  <soapenv:Header>
    <cus:RequestId>550e8400-e29b-41d4-a716-446655440000</cus:RequestId>
    <cus:ChannelId>LOS</cus:ChannelId>
    <cus:Timestamp>20240715103000000</cus:Timestamp>
    <cus:BankCode>BANK001</cus:BankCode>
    <cus:BranchCode>MH001</cus:BranchCode>
    <cus:UserId>LOS_SVC</cus:UserId>
  </soapenv:Header>
  <soapenv:Body>
    <cus:CreateCustomerRequest>
      <CustomerType>INDIVIDUAL</CustomerType>
      <ShortName>RAVI SHA</ShortName>
      <FullName>RAVI KUMAR SHARMA</FullName>
      <DOB>21/04/1990</DOB>
      <Gender>M</Gender>
      <Mobile>9876543210</Mobile>
      <PANNumber>ABCRS1234F</PANNumber>
      <AadhaarHash>a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3</AadhaarHash>
      <Address>
        <AddressLine1>Flat 302 Orchid Heights</AddressLine1>
        <City>Pune</City>
        <State>Maharashtra</State>
        <Pincode>411057</Pincode>
        <Country>India</Country>
        <AddressType>02</AddressType>
      </Address>
      <KYCStatus>COMPLETED</KYCStatus>
      <KYCRefNumber>KYC-2024-MH-000342</KYCRefNumber>
      <Segment>RETAIL</Segment>
      <ConstitutionCode>01</ConstitutionCode>
    </cus:CreateCustomerRequest>
  </soapenv:Body>
</soapenv:Envelope>
```

**Response:**
```xml
<soapenv:Envelope ...>
  <soapenv:Header>
    <ResponseCode>00</ResponseCode>
    <ResponseMessage>SUCCESS</ResponseMessage>
    <Timestamp>20240715103045000</Timestamp>
  </soapenv:Header>
  <soapenv:Body>
    <CreateCustomerResponse>
      <CustomerId>CIF20240715001234</CustomerId>
      <Status>SUCCESS</Status>
    </CreateCustomerResponse>
  </soapenv:Body>
</soapenv:Envelope>
```

---
*End of API Documentation v1*
