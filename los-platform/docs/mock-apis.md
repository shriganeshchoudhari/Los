# Mock APIs Documentation - Los Platform v0.1

## Overview

Los Platform v0.1 uses **mocked external APIs** for all integrations with third-party services. This approach enables:

- **Rapid development** without waiting for external provider credentials
- **Disconnected testing** (work offline)
- **Consistent behavior** (no rate limiting, timeouts, or quota issues)
- **Easy migration** to real APIs later (swap implementation, not contract)

All mock implementations follow the **Strategy Pattern**: interface-based with conditional Spring bean creation. In production, simply enable real API clients via properties.

---

## Architecture: Mock vs. Real APIs

### Current Setup (v0.1 — Mocked)

```
┌─────────────────────────────────────────────────────┐
│             Spring Boot Application                 │
│                  (Port 8080)                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │   Bureau Aggregator Service                │   │
│  │  (orchestrates 4 clients)                  │   │
│  └────────────────────────────────────────────┘   │
│         ↓         ↓         ↓         ↓            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  │ CIBIL    │ │ Experian │ │ Equifax  │ │ CRIF │ │
│  │ MOCK ✓   │ │ MOCK ✓   │ │ MOCK ✓   │ │MOCK✓│ │
│  └──────────┘ └──────────┘ └──────────┘ └──────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  CBS Finacle (Loan Account Creation)        │ │
│  │  MOCK ✓ (returns fake account number)       │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  eSign (NSDL/DigiSign)                      │ │
│  │  MOCK ✓ (async signature callback)          │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  Notifications (SMS/Email/WhatsApp/Push)   │  │
│  │  MOCK ✓ (logs to console/DB)               │  │
│  └────────────────────────────────────────────┘  │
│    ├── Kaleyra SMS (MOCK ✓)                     │
│    ├── SMTP Email (MOCK ✓)                      │
│    ├── Gupshup WhatsApp (MOCK ✓)                │
│    └── FCM Push (MOCK ✓)                        │
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │  Document OCR (Textract/Sarvam AI)           ││
│  │  MOCK ✓ (returns sample extracted text)      ││
│  └──────────────────────────────────────────────┘│
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │  PostgreSQL Database                         ││
│  │  (Real — all data persisted)                 ││
│  └──────────────────────────────────────────────┘│
│                                                   │
└─────────────────────────────────────────────────────┘
```

### Future Setup (v0.5+ — Real APIs)

```
Simply change application.properties:
los.bureau.mock.enabled=false       → Real CIBIL/Experian APIs
los.cbs.mock.enabled=false          → Real CBS SOAP
los.esign.mock.enabled=false        → Real eSign
los.sms.mock.enabled=false          → Real Kaleyra/Msg91 SMS
los.ocr.mock.enabled=false          → Real AWS Textract
```

---

## Mock API Catalog

### 1. Bureau Integration (CIBIL, Experian, Equifax, CRIF)

#### Configuration

**File**: `backend-java/src/main/resources/application.properties`

```properties
# Bureau Configuration
los.bureau.mock.enabled=true

# When false, uses real REST API clients (requires API keys)
# los.bureau.mock.enabled=false
# los.bureau.cibil.api-key=YOUR_CIBIL_KEY
# los.bureau.experian.api-key=YOUR_EXPERIAN_KEY
# los.bureau.equifax.api-key=YOUR_EQUIFAX_KEY
# los.bureau.crif.api-key=YOUR_CRIF_KEY
# los.bureau.cibil.endpoint=https://api.cibil.com
```

#### Mock Behavior

**Files**:
- `backend-java/src/main/java/com/los/integration/client/bureau/CibilMockClient.java`
- `backend-java/src/main/java/com/los/integration/client/bureau/ExperianMockClient.java`
- `backend-java/src/main/java/com/los/integration/client/bureau/EquifaxMockClient.java`
- `backend-java/src/main/java/com/los/integration/client/bureau/CrifMockClient.java`

Each mock client returns **random scores** with these ranges:

| Bureau | Score Range | Active Accounts | Missed Payments | Defaults |
|--------|-------------|-----------------|-----------------|----------|
| CIBIL | 650–800 | 0–4 | 0–2 | 0–1 |
| Experian | 600–800 | 0–5 | 0–1 | 0 |
| Equifax | 620–790 | 0–4 | 0 | 0 |
| CRIF | 640–790 | 0–3 | 0–1 | 0 |

**Example Response**:
```json
{
  "bureauName": "CIBIL",
  "score": 725,
  "activeAccounts": 3,
  "missedPayments": 1,
  "defaults": 0,
  "inquiries": 2,
  "lastUpdated": "2026-04-20T14:30:00Z",
  "rawResponse": "{\"status\": \"success\", \"score\": 725}"
}
```

**Aggregation Logic** (`BureauAggregatorService.java`):
- Calls all 4 bureaus in sequence (can be parallelized later)
- Calculates average score: `(CIBIL + Experian + Equifax + CRIF) / 4`
- Stores individual responses in `los_integration.bureau_responses` table
- Persists aggregated data for decision engine

**Circuit Breaker** (Resilience4j):
- **Failure Threshold**: 50% (if 2 out of 4 calls fail → open circuit)
- **Open Duration**: 10 seconds
- **Retries**: 3 attempts per bureau, 2s → 4s → 8s exponential backoff
- **Timeout**: No timeout for mocks (real APIs: 30s per bureau)

#### Testing

**Unit Test**: `backend-java/src/test/java/com/los/integration/client/bureau/CibilMockClientTest.java`

```java
@Test
void testCibilMockReturnsValidScore() {
    BureauResponse response = cibilClient.fetchBureauData("1234567890AB", "aadhar_hash");
    assertThat(response.getScore()).isBetween(650, 800);
    assertThat(response.getBureauName()).isEqualTo("CIBIL");
}

@Test
void testBureauAggregatorAveragesScores() {
    AggregatedBureauData data = aggregator.pullBureauData("APP001", "1234567890AB", "hash");
    int expected = (725 + 710 + 780 + 695) / 4; // hypothetical scores
    assertThat(data.getAverageScore()).isEqualTo(expected);
}
```

**Integration Test**: `backend-java/src/test/java/com/los/integration/service/BureauAggregatorE2ETest.java`

```java
@Test
void testBureauPullAndPersistence() {
    // Call aggregator
    AggregatedBureauData result = aggregator.pullBureauData("APP001", "PAN", "AADHAR");
    
    // Verify DB entries
    List<BureauResponseEntity> responses = bureauResponseRepository.findByApplicationId("APP001");
    assertThat(responses).hasSize(4); // 4 bureaus
    assertThat(responses.stream().map(BureauResponseEntity::getBureauName))
        .containsExactlyInAnyOrder("CIBIL", "EXPERIAN", "EQUIFAX", "CRIF");
}
```

#### How to Swap to Real APIs (v0.5)

1. Set `los.bureau.mock.enabled=false` in production properties
2. Create real bureau client classes: `CibilRealClient.java`, etc.
3. Use `@ConditionalOnProperty(name = "los.bureau.mock.enabled", havingValue = "false")` on real clients
4. Inject API credentials from Vault (Spring Cloud Config or AWS Secrets Manager)
5. Add timeout & retry handling specific to real APIs
6. No code changes needed in `BureauAggregatorService` (uses interface abstraction)

---

### 2. CBS (Finacle) SOAP Integration

#### Configuration

**File**: `backend-java/src/main/resources/application.properties`

```properties
# CBS Configuration
los.cbs.mock.enabled=true
los.cbs.mock.account-prefix=LOSCBS

# Real CBS config (when enabled):
# los.cbs.endpoint=https://cbs.bank.com/soap/AccountOpening
# los.cbs.username=los_user
# los.cbs.password=${CBS_PASSWORD} # from Vault
```

#### Mock Behavior

**File**: `backend-java/src/main/java/com/los/integration/client/cbs/FinacleMockClient.java`

Generates a fake bank account number with pattern: `LOSCBS<APPLICATION_ID><RANDOM_4_DIGITS>`

**Example Response**:
```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <response>
      <status>SUCCESS</status>
      <accountNumber>LOSCBSAPP00123456789</accountNumber>
      <transactionId>TXN123456789</transactionId>
      <createdAt>2026-04-20T14:35:00Z</createdAt>
    </response>
  </soapenv:Body>
</soapenv:Envelope>
```

**Stored in Database**:
```sql
-- los_integration.cbs_transactions
INSERT INTO los_integration.cbs_transactions 
  (application_id, cbs_account_number, request_xml, response_xml, transaction_id, status)
VALUES 
  ('APP001', 'LOSCBSAPP00123456789', '[full request XML]', '[full response XML]', 'TXN123456789', 'SUCCESS');
```

**Idempotency**: Generates same account number if called twice with same applicationId (mock uses in-memory cache)

#### Testing

**Integration Test**: `backend-java/src/test/java/com/los/integration/client/cbs/FinacleMockClientTest.java`

```java
@Test
void testAccountCreationSuccess() {
    CreateAccountRequest request = CreateAccountRequest.builder()
        .applicationId("APP001")
        .sanctionAmount(500000)
        .branch("NYC001")
        .productCode("PERSONAL")
        .build();

    CreateAccountResponse response = cbsMockClient.createAccount(request);
    
    assertThat(response.getStatus()).isEqualTo("SUCCESS");
    assertThat(response.getAccountNumber()).startsWith("LOSCBS");
}

@Test
void testAccountCreationIdempotency() {
    // Call twice with same applicationId
    CreateAccountResponse resp1 = cbsMockClient.createAccount(request);
    CreateAccountResponse resp2 = cbsMockClient.createAccount(request);
    
    // Should return same account number
    assertThat(resp1.getAccountNumber()).isEqualTo(resp2.getAccountNumber());
}
```

#### How to Swap to Real APIs (v0.5)

1. Set `los.cbs.mock.enabled=false`
2. Create `FinacleRealClient.java` using Spring's `WebServiceTemplate`
3. Load WSDL from real CBS endpoint (or use existing Finacle WSDL)
4. Implement actual SOAP marshalling/unmarshalling (JAXB)
5. Add timeout: 30s (accounts created in 5–15s typically)
6. Idempotency: use 24-hour Redis cache (same as v0.1)
7. No changes needed in `IntegrationService` (uses interface)

---

### 3. eSign Integration (NSDL/DigiSign)

#### Configuration

**File**: `backend-java/src/main/resources/application.properties`

```properties
# eSign Configuration
los.esign.mock.enabled=true
los.esign.mock.callback-delay-seconds=2

# Real eSign config:
# los.esign.provider=NSDL # or DigiSign
# los.esign.nsdl.endpoint=https://esign.nsdl.com/api
# los.esign.nsdl.api-key=${NSDL_ESIGN_KEY}
```

#### Mock Behavior

**File**: `backend-java/src/main/java/com/los/integration/client/esign/EsignMockClient.java`

1. Receives PDF document for signing
2. Assigns transaction ID
3. Returns immediately (async)
4. Simulates webhook callback after 2-3 seconds (configurable)
5. Updates document status to SIGNED

**Webhook Payload**:
```json
{
  "event": "signature.completed",
  "transactionId": "ESIGN123456789",
  "applicationId": "APP001",
  "status": "SIGNED",
  "signedDocumentPath": "s3://los-bucket/signed-documents/APP001-sanction-letter.pdf",
  "signedAt": "2026-04-20T14:37:00Z",
  "signature": "hmac-sha256-signature-for-verification"
}
```

**Stored in Database**:
```sql
-- los_integration.esign_events
INSERT INTO los_integration.esign_events 
  (transaction_id, application_id, status, signed_at, signed_document_url)
VALUES 
  ('ESIGN123456789', 'APP001', 'SIGNED', '2026-04-20T14:37:00Z', 's3://...signed.pdf');

-- los_document.documents
UPDATE documents 
SET esign_status = 'SIGNED', signed_at = '2026-04-20T14:37:00Z' 
WHERE id = 'DOC001';
```

**Callback Handler**: `backend-java/src/main/java/com/los/integration/controller/WebhookController.java`

```java
@PostMapping("/webhooks/esign/callback")
public ResponseEntity<Void> handleEsignCallback(@RequestBody EsignWebhookPayload payload) {
    log.info("Received eSign callback: {}", payload.getTransactionId());
    
    // Verify signature
    if (!verifyWebhookSignature(payload)) {
        return ResponseEntity.badRequest().build();
    }
    
    // Update document & publish event
    documentService.markAsSigned(payload.getApplicationId(), payload.getSignedAt());
    kafkaTemplate.send("esign.completed", new EsignCompletedEvent(...));
    
    return ResponseEntity.ok().build();
}
```

#### Testing

**Integration Test**: `backend-java/src/test/java/com/los/integration/client/esign/EsignMockClientTest.java`

```java
@Test
void testSanctionLetterSigning() throws InterruptedException {
    // 1. Generate sanction letter
    byte[] pdf = sanctionLetterService.generatePdf(applicationId);
    
    // 2. Submit for signing
    EsignResponse response = esignClient.signDocument(applicationId, pdf);
    assertThat(response.getTransactionId()).isNotEmpty();
    assertThat(response.getStatus()).isEqualTo("PENDING");
    
    // 3. Wait for webhook callback (mock delays 2-3 seconds)
    Thread.sleep(3000);
    
    // 4. Verify document marked as signed
    Document doc = documentRepository.findByApplicationId(applicationId);
    assertThat(doc.getEsignStatus()).isEqualTo("SIGNED");
    assertThat(doc.getSignedAt()).isNotNull();
}
```

#### How to Swap to Real APIs (v0.5)

1. Set `los.esign.mock.enabled=false`
2. Create `NsdlEsignClient.java` or `DigiSignEsignClient.java` using SOAP/REST
3. Use real eSign provider's API for signature
4. Keep webhook handler the same (contract unchanged)
5. Increase timeout: NSDL typically takes 30s–2min for signature
6. Implement webhook signature verification (HMAC-SHA256)
7. Implement polling as fallback (if webhook never arrives, poll status endpoint)

---

### 4. Notification Services (SMS, Email, WhatsApp, Push)

#### Configuration

**File**: `backend-java/src/main/resources/application.properties`

```properties
# Notification Configuration
los.sms.mock.enabled=true
los.email.mock.enabled=true
los.whatsapp.mock.enabled=true
los.push.mock.enabled=true

# Real SMS config:
# los.sms.provider=kaleyra # or msg91
# los.sms.kaleyra.api-key=${KALEYRA_KEY}
# los.sms.kaleyra.account-id=${KALEYRA_ACCOUNT}

# Real Email config:
# spring.mail.host=smtp.gmail.com
# spring.mail.port=587
# spring.mail.username=${SMTP_USER}
# spring.mail.password=${SMTP_PASSWORD}

# Real WhatsApp config:
# los.whatsapp.provider=gupshup
# los.whatsapp.gupshup.api-key=${GUPSHUP_KEY}

# Real Push config:
# spring.firebase.database-url=${FIREBASE_URL}
```

#### Mock Behavior

**Files**:
- `KaleyramockClient.java` — logs SMS to console & DB
- `EmailService.java` (with @ConditionalOnProperty) — logs email to console & DB
- `GupshupMockClient.java` — logs WhatsApp template to console & DB
- `FcmMockClient.java` — logs push token to console & DB

**Kafka Listener** (`StateChangeEventListener.java`):

Listens to `loan.state.changed` topic and triggers notifications:

```java
@KafkaListener(topics = "loan.state.changed")
public void onStateChanged(StateChangeEvent event) {
    String msg = switch (event.getNewState()) {
        case "KYC" -> "Your KYC has been verified. Proceeding to bureau check.";
        case "DECISION" -> event.getDecision().equals("APPROVED") 
            ? "Congratulations! Your loan is approved."
            : "We regret to inform you that your loan application has been rejected.";
        case "SANCTION" -> "Your loan has been sanctioned. Disbursement in progress.";
        default -> null;
    };
    
    if (msg != null) {
        notificationService.sendSms(applicantPhone, msg);
        notificationService.sendEmail(applicantEmail, msg);
    }
}
```

**Database Logging** (`los_notification.notifications` table):

```sql
INSERT INTO los_notification.notifications 
  (application_id, channel, template_id, status, sent_at)
VALUES 
  ('APP001', 'SMS', 'KYC_COMPLETE', 'SUCCESS', '2026-04-20T14:40:00Z'),
  ('APP001', 'EMAIL', 'KYC_COMPLETE', 'SUCCESS', '2026-04-20T14:40:01Z');
```

**Console Output** (when using mock):
```
[INFO] Sending SMS (MOCK) to +91 98XXXXXXXX: Your KYC has been verified. Proceeding to bureau check.
[INFO] Sending Email (MOCK) to applicant@example.com: Your KYC has been verified. Proceeding to bureau check.
```

#### Testing

**Unit Test**: `backend-java/src/test/java/com/los/notification/client/SmsClientTest.java`

```java
@Test
void testMockSmsClient() {
    KaleyramockClient smsClient = new KaleyramockClient();
    smsClient.sendSms("+919876543210", "Test message");
    // Logs to console: "[INFO] Sending SMS (MOCK) to..."
    // Should persist to DB
}

@Test
void testNotificationOnStateChange() {
    kafkaTemplate.send("loan.state.changed", new StateChangeEvent("APP001", "BUREAU", "KYC", "USER1"));
    
    // Wait for async processing
    Thread.sleep(500);
    
    // Verify notifications in DB
    List<Notification> notifs = notificationRepository.findByApplicationId("APP001");
    assertThat(notifs).hasSize(2); // SMS + Email
    assertThat(notifs.get(0).getChannel()).isEqualTo("SMS");
    assertThat(notifs.get(1).getChannel()).isEqualTo("EMAIL");
}
```

#### How to Swap to Real APIs (v0.5)

1. Set notification mock flags to `false`
2. Create real SMS client: `KaleyraRealClient.java` (calls Kaleyra REST API)
3. Create real Email client: use Spring Mail (no new code, just properties)
4. Create real WhatsApp client: `GupshupRealClient.java` (calls Gupshup API)
5. Create real Push client: `FcmRealClient.java` (calls Firebase Cloud Messaging)
6. No changes in `NotificationService` or Kafka listeners (contract remains same)
7. Add rate limiting per provider (e.g., Kaleyra: 1000 SMS/day limit)

---

### 5. Document OCR (AWS Textract/Sarvam AI)

#### Configuration

**File**: `backend-java/src/main/resources/application.properties`

```properties
# OCR Configuration
los.ocr.mock.enabled=true
los.ocr.mock.confidence=0.95

# Real OCR config:
# los.ocr.provider=textract # or sarvam-ai
# los.ocr.textract.region=ap-south-1
# los.ocr.textract.aws-access-key=${AWS_ACCESS_KEY}
# los.ocr.textract.aws-secret-key=${AWS_SECRET_KEY}

# Sarvam AI config:
# los.ocr.sarvam.endpoint=https://api.sarvam.ai/ocr
# los.ocr.sarvam.api-key=${SARVAM_API_KEY}
```

#### Mock Behavior

**File**: `backend-java/src/main/java/com/los/document/client/TextractMockClient.java`

Returns hardcoded extracted text based on document type:

**Salary Slip**:
```
Extracted Text:
Name: Applicant Name
Employer: Acme Corp
Designation: Software Engineer
CTC: ₹1,200,000
Monthly Salary: ₹100,000
Tenure: 3 years
```

**Bank Statement**:
```
Extracted Text:
Bank: HDFC Bank
Account: XXXXXXXX7890
Average Balance: ₹500,000
Monthly Inflow: ₹125,000
Monthly Outflow: ₹90,000
Period: Jan 2026 - Mar 2026
```

**ITR**:
```
Extracted Text:
PAN: ABCDE1234F
Assessment Year: FY 2025-26
Gross Income: ₹1,500,000
Taxable Income: ₹1,200,000
Tax Paid: ₹180,000
```

**Stored in Database**:
```sql
INSERT INTO los_document.document_extractions 
  (document_id, extracted_data, confidence, extracted_at, manual_review_required)
VALUES 
  ('DOC001', '{"salary": 100000, "employer": "Acme Corp", ...}', 0.95, NOW(), false);
```

**Extractors** (per document type):
- `SalarySlipExtractor.java` — extracts salary, employer, tenure
- `BankStatementExtractor.java` — extracts avg balance, inflows/outflows
- `ItrExtractor.java` — extracts gross income, PAN
- `PanExtractor.java` — extracts PAN number, name, DOB

#### Testing

**Unit Test**: `backend-java/src/test/java/com/los/document/extractor/SalarySlipExtractorTest.java`

```java
@Test
void testSalarySlipExtraction() {
    String ocrText = "...Salary Slip...Monthly Salary: ₹100,000...Tenure: 3 years...";
    
    SalarySlipExtractor extractor = new SalarySlipExtractor();
    Map<String, Object> result = extractor.extract(ocrText);
    
    assertThat(result).containsEntry("monthlyIncome", 100000);
    assertThat(result).containsEntry("tenure", 3);
}

@Test
void testBankStatementExtraction() {
    String ocrText = "...Average Balance: ₹500,000...Monthly Inflow: ₹125,000...";
    
    BankStatementExtractor extractor = new BankStatementExtractor();
    Map<String, Object> result = extractor.extract(ocrText);
    
    assertThat(result).containsEntry("averageBalance", 500000);
    assertThat(result).containsEntry("monthlyInflow", 125000);
}
```

**Integration Test**: `backend-java/src/test/java/com/los/document/service/DocumentExtractionE2ETest.java`

```java
@Test
void testOcrPipelineEndToEnd() throws IOException {
    // 1. Upload salary slip (mock file)
    MockMultipartFile file = new MockMultipartFile(
        "file", "salary-slip.pdf", "application/pdf", "mock pdf content".getBytes());
    
    // 2. Service calls TextractMockClient
    DocumentExtractionResult result = documentService.extractAndStore("APP001", file);
    
    // 3. Verify extracted data in DB
    DocumentExtraction extraction = extractionRepository.findByDocumentId(result.getDocumentId());
    assertThat(extraction.getExtractedData()).containsKey("monthlyIncome");
    assertThat(extraction.getConfidence()).isGreaterThan(0.9);
}
```

#### How to Swap to Real APIs (v0.5)

1. Set `los.ocr.mock.enabled=false`
2. Create `TextractRealClient.java`:
   ```java
   @ConditionalOnProperty(name = "los.ocr.provider", havingValue = "textract")
   public class TextractRealClient implements OcrClient {
       // Call AWS TextractAsync API
       // Handle async job polling
   }
   ```
3. Create `SarvamAiRealClient.java` as fallback
4. Implement polling (OCR is async; typically takes 30s–2min)
5. Store job IDs & poll status via scheduled task
6. No changes in extractors or `DocumentExtractionService` (contract same)
7. Handle quota limits (Textract: 100 free pages/month, then ₹0.015/page)

---

## Complete Integration Flow (Example)

### Scenario: Personal Loan ₹5L End-to-End with Mocks

**Timeline**: ~30 seconds (all mocks, no external API delays)

1. **Applicant submits application** (DRAFT → SUBMITTED)
   - POST `/api/applications/create`
   - State change event: `loan.state.changed` (DRAFT → SUBMITTED)
   - Kafka listener triggered

2. **Applicant completes KYC** (SUBMITTED → KYC)
   - POST `/api/applications/{id}/kyc`
   - State: KYC
   - Kafka event: `kyc.completed`
   - Notification sent: SMS + Email "KYC verified"
   - Consumer (in application) transitions to BUREAU

3. **Bureau pull triggered** (KYC → BUREAU)
   - `BureauAggregatorService.pullBureauData()` called
   - All 4 mock clients called in sequence:
     - CIBIL: returns score 725 ✓
     - Experian: returns score 710 ✓
     - Equifax: returns score 780 ✓
     - CRIF: returns score 695 ✓
   - Average: (725 + 710 + 780 + 695) / 4 = 727.5
   - Stored in `bureau_responses` table
   - State: BUREAU
   - Kafka event: `bureau.data.received`

4. **Decision engine runs** (BUREAU → DECISION)
   - `DecisionService.makeDecision()` called
   - RuleEvaluator checks 47 base rules:
     - R001: Age 25–60? ✓ (applicant age 35)
     - R002: FOIR <50%? ✓ (monthly EMI ₹10K, income ₹50K, existing ₹5K, total ₹15K/50K = 30%)
     - R003: CIBIL ≥650? ✓ (score 725)
     - R004: No defaults? ✓ (defaults 0)
     - ... (all pass for personal loan)
   - Decision: **APPROVED**
   - Sanction Amount: ₹5,00,000 (as requested)
   - State: DECISION
   - Kafka event: `decision.completed`
   - Notification: SMS + Email "Congratulations! Your loan is approved."

5. **Sanction letter generated & signed** (DECISION → SANCTION)
   - `SanctionLetterService.generatePdf()` creates PDF
   - `EsignMockClient.signDocument()` submits for signing
   - Returns transactionId: `ESIGN123456789`
   - Mock waits 2 seconds, then posts webhook callback
   - Webhook handler receives `signature.completed` event
   - Document marked as SIGNED in DB
   - State: SANCTION
   - Kafka event: `sanction.approved`

6. **Post-sanction documents collected** (SANCTION → DOCUMENT_COLLECTION)
   - Applicant uploads salary slip, ITR, PAN
   - `DocumentExtractionService` calls `TextractMockClient`
   - Mock returns extracted data:
     - Salary: ₹50,000/month ✓
     - Employer: Acme Corp ✓
     - ITR Income: ₹6,00,000/year ✓
   - Extracted data stored in DB
   - State: DOCUMENT_COLLECTION

7. **Disbursement initiated** (DOCUMENT_COLLECTION → DISBURSEMENT)
   - `IntegrationService.createLoanAccountInCbs()` called
   - Mock Finacle client generates account: `LOSCBSAPP00<random>`
   - CBS account persisted to DB
   - State: DISBURSEMENT
   - Notification: SMS "Loan account created. Disbursement in progress."

8. **Account active** (DISBURSEMENT → ACTIVE_ACCOUNT)
   - Manual state transition (admin/scheduler)
   - EMI collection starts
   - Notification: SMS "EMI collection has started for your account."

---

## Debugging Mocks

### Enable Debug Logging

**File**: `backend-java/src/main/resources/application.properties`

```properties
logging.level.com.los.integration.client=DEBUG
logging.level.com.los.notification=DEBUG
logging.level.com.los.document=DEBUG
```

**Or use Spring Boot environment variable**:
```bash
export LOGGING_LEVEL_COM_LOS_INTEGRATION_CLIENT=DEBUG
java -jar los-platform.jar
```

### Monitor Mock Calls

**View Kafka messages**:
```bash
# In docker-compose or Kafka CLI
kafka-console-consumer --bootstrap-server localhost:9092 --topic loan.state.changed --from-beginning
```

**Check database directly**:
```sql
-- View bureau responses
SELECT * FROM los_integration.bureau_responses ORDER BY pulled_at DESC LIMIT 10;

-- View sent notifications
SELECT * FROM los_notification.notifications ORDER BY sent_at DESC LIMIT 10;

-- View extracted documents
SELECT * FROM los_document.document_extractions ORDER BY extracted_at DESC LIMIT 10;
```

**Check application logs**:
```bash
tail -f /var/log/los-platform/application.log | grep -i "mock"
# Output: "Sending SMS (MOCK) to +919876543210: ..."
```

---

## Switching to Real APIs (Checklist)

When external provider credentials become available:

### Bureau APIs
- [ ] Obtain CIBIL API key & endpoint
- [ ] Obtain Experian API key & endpoint
- [ ] Obtain Equifax API key & endpoint
- [ ] Obtain CRIF API key & endpoint
- [ ] Create real client classes: `CibilRealClient.java`, etc.
- [ ] Update `application-prod.properties`: set `los.bureau.mock.enabled=false`
- [ ] Load credentials from Vault/Secrets Manager
- [ ] Test each bureau independently (unit tests)
- [ ] Run load tests (bureaus may have rate limits)
- [ ] Deploy to staging, monitor for errors

### CBS/Finacle
- [ ] Obtain CBS endpoint & credentials
- [ ] Obtain Finacle WSDL or API documentation
- [ ] Create `FinacleRealClient.java` with SOAP marshalling
- [ ] Test account creation with real CBS (may require coordination with bank)
- [ ] Verify idempotency (don't create duplicate accounts)
- [ ] Update `application-prod.properties`: `los.cbs.mock.enabled=false`

### eSign
- [ ] Obtain eSign provider (NSDL or DigiSign) credentials
- [ ] Create real eSign client
- [ ] Test signature callback webhook handling
- [ ] Secure webhook with HMAC signature verification
- [ ] Update `application-prod.properties`: `los.esign.mock.enabled=false`

### SMS/Email/WhatsApp/Push
- [ ] Obtain Kaleyra or Msg91 API key for SMS
- [ ] Configure SMTP server for Email
- [ ] Obtain Gupshup API key for WhatsApp
- [ ] Obtain Firebase project ID for Push
- [ ] Create real notification clients
- [ ] Test sending to 5–10 real numbers/emails
- [ ] Monitor delivery rates & bounces
- [ ] Update `application-prod.properties`: disable all mock flags

### OCR
- [ ] Obtain AWS Textract access (or Sarvam AI API key)
- [ ] Create real OCR client
- [ ] Test with sample documents (salary slip, ITR, PAN)
- [ ] Verify extracted accuracy (manual spot-check)
- [ ] Monitor OCR costs (Textract: ~₹1.50 per page)
- [ ] Update `application-prod.properties`: `los.ocr.mock.enabled=false`

### Final Steps
- [ ] Run full integration test suite against real APIs
- [ ] Load test with real API latencies (expect 3–5s total decision time)
- [ ] UAT with real data
- [ ] Monitor first 48 hours for errors, rate limiting, API downtime
- [ ] Have fallback plan (switch back to mocks if API down)

---

## Troubleshooting

### Issue: Mock bureau scores always the same

**Cause**: Random seed set globally, or mock not regenerating

**Solution**:
```java
// Each call should generate new random scores
Random random = new Random(); // Creates new instance per call (not static)
```

### Issue: eSign callback never arrives

**Cause**: Mock may not be posting webhook, or webhook URL not configured

**Solution**:
```properties
# Ensure callback URL points to your instance
los.esign.webhook-url=http://localhost:8080/webhooks/esign/callback
```

**Test manually**:
```bash
curl -X POST http://localhost:8080/webhooks/esign/callback \
  -H "Content-Type: application/json" \
  -d '{
    "event": "signature.completed",
    "transactionId": "ESIGN123",
    "applicationId": "APP001",
    "status": "SIGNED"
  }'
```

### Issue: Notifications not in database

**Cause**: Kafka listener not running, or mock flag disabled

**Solution**:
1. Check Kafka is running: `docker ps | grep kafka`
2. Check logs for listener errors: `grep -i "StateChangeEventListener" logs.txt`
3. Verify mock enabled: `grep "los.sms.mock.enabled" application.properties`

### Issue: OCR extraction returns null

**Cause**: Document type not recognized, or extractor not implemented

**Solution**:
1. Check document type in `DocumentExtractionService`
2. Ensure extractor exists for type (e.g., `SalarySlipExtractor.java`)
3. Add logging: `log.info("Extracting from document type: {}", docType);`

---

## Conclusion

Mock APIs enable rapid development without external dependencies. Once ready for production, swap implementations by:
1. Setting mock flags to `false`
2. Providing real API credentials
3. Zero code changes (thanks to Strategy Pattern + ConditionalOnProperty)

This approach keeps frontend development unblocked and ensures backend is testable throughout.

**Questions?** Refer to test files or open an issue on GitHub.
