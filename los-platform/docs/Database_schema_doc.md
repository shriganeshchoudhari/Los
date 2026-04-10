# Database Schema Documentation
## Loan Origination System (LOS)
**RDBMS:** PostgreSQL 15 | **Encoding:** UTF-8 | **Collation:** en_IN.UTF-8

---

## 1. Schema Overview

```
Schema: los_core
├── users
├── otp_sessions
├── refresh_tokens
├── loan_applications          (partitioned by created_at monthly)
├── application_stage_history
├── kyc_records
├── aadhaar_kyc_results
├── pan_verification_results
├── face_match_results
├── consent_records
├── documents
├── bureau_pull_jobs
├── bureau_provider_results
├── decision_results
├── decision_rule_results
├── loans
├── disbursements
├── emi_schedule
├── payment_transactions
├── notifications
├── audit_logs                 (partitioned by timestamp monthly)
├── data_access_logs
├── loan_product_configs
├── feature_flags
├── benchmark_rates
└── idempotency_keys
```

---

## 2. Table Definitions

### 2.1 users

```sql
CREATE TABLE los_core.users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       VARCHAR(20) UNIQUE,                        -- Staff only: "EMP-2024-00123"
  full_name         VARCHAR(200) NOT NULL,
  email             VARCHAR(254),
  mobile            VARCHAR(10) NOT NULL UNIQUE,               -- Plain for contact; separate hash for lookup
  mobile_hash       CHAR(64) NOT NULL,                        -- SHA-256 for dedup lookup
  role              VARCHAR(30) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  branch_code       VARCHAR(10),
  pan_number_enc    BYTEA,                                    -- pgcrypto encrypted
  last_login_at     TIMESTAMPTZ,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_chk CHECK (role IN (
    'APPLICANT','LOAN_OFFICER','CREDIT_ANALYST','BRANCH_MANAGER',
    'ZONAL_CREDIT_HEAD','COMPLIANCE_OFFICER','SYSTEM','ADMIN'
  )),
  CONSTRAINT users_status_chk CHECK (status IN (
    'ACTIVE','INACTIVE','SUSPENDED','PENDING_VERIFICATION'
  ))
);

CREATE INDEX idx_users_mobile_hash ON los_core.users (mobile_hash);
CREATE INDEX idx_users_role_status ON los_core.users (role, status);
CREATE INDEX idx_users_employee_id ON los_core.users (employee_id) WHERE employee_id IS NOT NULL;
```

---

### 2.2 otp_sessions

```sql
CREATE TABLE los_core.otp_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_hash   CHAR(64)    NOT NULL,
  otp_hash      CHAR(60)    NOT NULL,                        -- bcrypt hash of 6-digit OTP
  purpose       VARCHAR(30) NOT NULL,
  attempts      SMALLINT    NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  is_used       BOOLEAN     NOT NULL DEFAULT FALSE,
  ip_address    INET        NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT otp_purpose_chk CHECK (purpose IN (
    'LOGIN','AADHAAR_CONSENT','LOAN_APPLICATION_SUBMIT',
    'DISBURSEMENT_CONFIRM','PASSWORD_RESET'
  ))
);

CREATE INDEX idx_otp_sessions_mobile_hash_expires ON los_core.otp_sessions (mobile_hash, expires_at)
  WHERE is_used = FALSE;

-- TTL: Cron job deletes expired sessions daily; Redis also used for <300s fast lookup
```

---

### 2.3 loan_applications (Partitioned)

```sql
CREATE TABLE los_core.loan_applications (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  application_number    VARCHAR(30) NOT NULL,
  status                VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  loan_type             VARCHAR(30) NOT NULL,
  customer_segment      VARCHAR(10) NOT NULL DEFAULT 'RETAIL',
  channel_code          VARCHAR(20) NOT NULL,
  branch_code           VARCHAR(10) NOT NULL,

  -- Applicant snapshot (denormalized for performance)
  applicant_full_name   VARCHAR(200) NOT NULL,
  applicant_dob         DATE        NOT NULL,
  applicant_mobile      VARCHAR(10) NOT NULL,
  applicant_mobile_hash CHAR(64)    NOT NULL,
  applicant_pan_hash    CHAR(64)    NOT NULL,                -- SHA-256 of PAN — for dedup
  applicant_pan_enc     BYTEA       NOT NULL,                -- pgcrypto encrypted PAN
  applicant_gender      VARCHAR(15),
  applicant_pincode     VARCHAR(6),
  applicant_state       VARCHAR(4),

  -- Full applicant profile as JSONB (flexible, indexed)
  applicant_profile     JSONB       NOT NULL,
  employment_details    JSONB       NOT NULL,
  loan_requirement      JSONB       NOT NULL,

  -- Relationships
  user_id               UUID        NOT NULL REFERENCES los_core.users(id),
  kyc_id                UUID,
  bureau_report_id      UUID,
  decision_id           UUID,
  assigned_officer_id   UUID        REFERENCES los_core.users(id),
  assigned_analyst_id   UUID        REFERENCES los_core.users(id),

  -- Financials
  requested_amount      BIGINT      NOT NULL,                -- Paisa
  sanctioned_amount     BIGINT,
  sanctioned_tenure_months SMALLINT,
  sanctioned_roi_bps    INTEGER,

  -- DSA
  dsa_code              VARCHAR(20),
  dsa_name              VARCHAR(100),

  -- Decision output
  rejection_reason_code VARCHAR(30),
  rejection_remarks     TEXT,
  conditions_pre_disbursal TEXT[],

  -- Timestamps
  submitted_at          TIMESTAMPTZ,
  sanctioned_at         TIMESTAMPTZ,
  disbursed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version               INTEGER     NOT NULL DEFAULT 1,      -- Optimistic lock

  PRIMARY KEY (id, created_at)                               -- Partition key included
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE los_core.loan_applications_2024_07
  PARTITION OF los_core.loan_applications
  FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE los_core.loan_applications_2024_08
  PARTITION OF los_core.loan_applications
  FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

-- Global indexes on partitioned table
CREATE UNIQUE INDEX idx_app_number ON los_core.loan_applications (application_number);
CREATE INDEX idx_app_status_created ON los_core.loan_applications (status, created_at DESC);
CREATE INDEX idx_app_pan_hash ON los_core.loan_applications (applicant_pan_hash, loan_type, created_at);
CREATE INDEX idx_app_user_id ON los_core.loan_applications (user_id, created_at DESC);
CREATE INDEX idx_app_officer ON los_core.loan_applications (assigned_officer_id, status)
  WHERE assigned_officer_id IS NOT NULL;
CREATE INDEX idx_app_branch_status ON los_core.loan_applications (branch_code, status, created_at DESC);
CREATE INDEX idx_app_applicant_profile ON los_core.loan_applications USING GIN (applicant_profile jsonb_path_ops);
```

---

### 2.4 application_stage_history

```sql
CREATE TABLE los_core.application_stage_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL,
  from_status     VARCHAR(40),
  to_status       VARCHAR(40) NOT NULL,
  action_by       UUID        REFERENCES los_core.users(id),
  action_by_role  VARCHAR(30),
  remarks         TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stage_app_id ON los_core.application_stage_history (application_id, timestamp DESC);
```

---

### 2.5 kyc_records

```sql
CREATE TABLE los_core.kyc_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID        NOT NULL,
  user_id           UUID        NOT NULL REFERENCES los_core.users(id),
  status            VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
  overall_risk_score SMALLINT   CHECK (overall_risk_score BETWEEN 0 AND 100),
  reviewed_by       UUID        REFERENCES los_core.users(id),
  review_notes      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kyc_status_chk CHECK (status IN (
    'NOT_STARTED','AADHAAR_OTP_SENT','AADHAAR_VERIFIED','PAN_VERIFIED',
    'FACE_MATCH_PENDING','FACE_MATCH_PASSED','FACE_MATCH_FAILED',
    'KYC_COMPLETE','KYC_FAILED','MANUAL_REVIEW'
  ))
);

CREATE UNIQUE INDEX idx_kyc_application ON los_core.kyc_records (application_id);
CREATE INDEX idx_kyc_user ON los_core.kyc_records (user_id, status);
```

---

### 2.6 aadhaar_kyc_results

```sql
CREATE TABLE los_core.aadhaar_kyc_results (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id                UUID        NOT NULL REFERENCES los_core.kyc_records(id),
  txn_id                VARCHAR(100) NOT NULL,
  uidai_ref_id          VARCHAR(100) NOT NULL,
  aadhaar_number_hash   CHAR(64)    NOT NULL,                -- SHA-256; never store plain Aadhaar
  -- Demographic data (stored plain — needed for loan file)
  name                  VARCHAR(200) NOT NULL,
  dob                   DATE        NOT NULL,
  gender                CHAR(1)     NOT NULL,
  address_json          JSONB,
  -- Photo: stored encrypted in object storage; only key reference here
  photo_storage_key     VARCHAR(500),
  photo_encryption_key_ref VARCHAR(100),
  -- Signed XML for audit stored in object storage
  xml_storage_key       VARCHAR(500),
  signature_valid       BOOLEAN     NOT NULL DEFAULT FALSE,
  uidai_response_code   VARCHAR(10),
  auth_code             VARCHAR(100),
  verified_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_metadata           JSONB
);

CREATE UNIQUE INDEX idx_aadhaar_kyc_id ON los_core.aadhaar_kyc_results (kyc_id);
-- Note: aadhaar_number_hash indexed for de-dup detection
CREATE INDEX idx_aadhaar_hash ON los_core.aadhaar_kyc_results (aadhaar_number_hash);
```

---

### 2.7 pan_verification_results

```sql
CREATE TABLE los_core.pan_verification_results (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id                  UUID        NOT NULL REFERENCES los_core.kyc_records(id),
  pan_number_masked       VARCHAR(10) NOT NULL,              -- "ABCDE####F"
  pan_number_enc          BYTEA       NOT NULL,              -- pgcrypto encrypted
  name_match_score        SMALLINT    NOT NULL,
  name_on_pan             VARCHAR(200),
  dob_match               BOOLEAN     NOT NULL,
  pan_status              VARCHAR(10) NOT NULL,
  linked_aadhaar          BOOLEAN     NOT NULL DEFAULT FALSE,
  aadhaar_seeding_status  VARCHAR(15),
  nsdl_transaction_id     VARCHAR(100),
  verified_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pan_status_chk CHECK (pan_status IN ('VALID','INVALID','INACTIVE','FAKE','DUPLICATE'))
);
```

---

### 2.8 documents

```sql
CREATE TABLE los_core.documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL,
  user_id             UUID        NOT NULL REFERENCES los_core.users(id),
  document_type       VARCHAR(40) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING_UPLOAD',
  original_file_name  VARCHAR(255),
  mime_type           VARCHAR(100),
  file_size_bytes     INTEGER,
  storage_key         VARCHAR(500),                         -- MinIO/S3 object key
  checksum_sha256     CHAR(64),
  is_encrypted        BOOLEAN     NOT NULL DEFAULT TRUE,
  encryption_key_ref  VARCHAR(100),
  watermark           VARCHAR(100),
  ocr_result          JSONB,
  ocr_confidence      SMALLINT    CHECK (ocr_confidence BETWEEN 0 AND 100),
  reviewed_by         UUID        REFERENCES los_core.users(id),
  rejection_reason    TEXT,
  expiry_date         DATE,
  uploaded_at         TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doc_status_chk CHECK (status IN (
    'PENDING_UPLOAD','UPLOADED','OCR_PROCESSING','OCR_COMPLETE',
    'UNDER_REVIEW','APPROVED','REJECTED','EXPIRED'
  ))
);

CREATE INDEX idx_docs_application ON los_core.documents (application_id, status);
CREATE INDEX idx_docs_type_status ON los_core.documents (document_type, status);
CREATE INDEX idx_docs_ocr ON los_core.documents USING GIN (ocr_result jsonb_path_ops)
  WHERE ocr_result IS NOT NULL;
```

---

### 2.9 bureau_pull_jobs

```sql
CREATE TABLE los_core.bureau_pull_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  final_credit_score  SMALLINT,
  aggregated_report   JSONB,                               -- Full parsed bureau report
  consent_timestamp   TIMESTAMPTZ NOT NULL,
  consent_ip          INET        NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  retry_count         SMALLINT    NOT NULL DEFAULT 0,
  next_retry_at       TIMESTAMPTZ,
  CONSTRAINT bureau_status_chk CHECK (status IN (
    'PENDING','IN_PROGRESS','PARTIAL_SUCCESS','SUCCESS','FAILED','TIMEOUT'
  ))
);

CREATE UNIQUE INDEX idx_bureau_application ON los_core.bureau_pull_jobs (application_id)
  WHERE status NOT IN ('FAILED','TIMEOUT');
CREATE INDEX idx_bureau_status ON los_core.bureau_pull_jobs (status, started_at);
```

---

### 2.10 bureau_provider_results

```sql
CREATE TABLE los_core.bureau_provider_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID        NOT NULL REFERENCES los_core.bureau_pull_jobs(id),
  provider          VARCHAR(20) NOT NULL,
  status            VARCHAR(10) NOT NULL,
  credit_score      SMALLINT,
  error_code        VARCHAR(20),
  raw_report_key    VARCHAR(500),                         -- S3 key to encrypted raw report
  reference_id      VARCHAR(100),
  pulled_at         TIMESTAMPTZ,
  CONSTRAINT provider_chk CHECK (provider IN ('CIBIL','EXPERIAN','EQUIFAX','CRIF_HIGH_MARK')),
  CONSTRAINT provider_status_chk CHECK (status IN ('SUCCESS','FAILED','TIMEOUT','NO_HIT'))
);

CREATE INDEX idx_bureau_provider_job ON los_core.bureau_provider_results (job_id);
```

---

### 2.11 decision_results

```sql
CREATE TABLE los_core.decision_results (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID        NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  final_decision        VARCHAR(10),
  approved_amount       BIGINT,
  approved_tenure_months SMALLINT,
  interest_rate_type    VARCHAR(10),
  rate_of_interest_bps  INTEGER,
  spread_bps            INTEGER,
  benchmark_rate        VARCHAR(15),
  processing_fee_paisa  BIGINT,
  insurance_mandatory   BOOLEAN     DEFAULT FALSE,
  ltv_ratio             NUMERIC(5,2),
  foir_actual           NUMERIC(5,2),
  scorecard_result      JSONB,                           -- ML model output
  conditions            JSONB,                           -- Array of ApprovalCondition
  rejection_reason_code VARCHAR(30),
  rejection_remarks     TEXT,
  decided_by            VARCHAR(15) NOT NULL DEFAULT 'RULE_ENGINE',
  decided_at            TIMESTAMPTZ,
  policy_version        VARCHAR(10) NOT NULL,
  override_by           UUID        REFERENCES los_core.users(id),
  override_remarks      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version               INTEGER     NOT NULL DEFAULT 1,
  CONSTRAINT decision_status_chk CHECK (status IN (
    'PENDING','IN_PROGRESS','APPROVED','CONDITIONALLY_APPROVED',
    'REJECTED','REFER_TO_CREDIT_COMMITTEE','MANUAL_OVERRIDE'
  )),
  CONSTRAINT decided_by_chk CHECK (decided_by IN ('RULE_ENGINE','ML_MODEL','MANUAL'))
);

CREATE UNIQUE INDEX idx_decision_application ON los_core.decision_results (application_id)
  WHERE status NOT IN ('PENDING');
CREATE INDEX idx_decision_status ON los_core.decision_results (status, decided_at DESC);
```

---

### 2.12 decision_rule_results

```sql
CREATE TABLE los_core.decision_rule_results (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   UUID        NOT NULL REFERENCES los_core.decision_results(id),
  rule_id       VARCHAR(20) NOT NULL,
  rule_name     VARCHAR(100) NOT NULL,
  category      VARCHAR(20) NOT NULL,
  outcome       VARCHAR(5)  NOT NULL,
  threshold     VARCHAR(50),
  actual_value  VARCHAR(50),
  message       TEXT,
  is_hard_stop  BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT outcome_chk CHECK (outcome IN ('PASS','FAIL','WARN','SKIP'))
);

CREATE INDEX idx_rule_results_decision ON los_core.decision_rule_results (decision_id, outcome);
CREATE INDEX idx_rule_hard_stop ON los_core.decision_rule_results (decision_id)
  WHERE is_hard_stop = TRUE AND outcome = 'FAIL';
```

---

### 2.13 loans

```sql
CREATE TABLE los_core.loans (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_account_number         VARCHAR(20) NOT NULL UNIQUE,  -- From CBS
  application_id              UUID        NOT NULL UNIQUE,
  user_id                     UUID        NOT NULL REFERENCES los_core.users(id),
  loan_type                   VARCHAR(30) NOT NULL,
  status                      VARCHAR(20) NOT NULL DEFAULT 'SANCTIONED',
  principal_amount            BIGINT      NOT NULL,
  outstanding_principal       BIGINT      NOT NULL,
  outstanding_interest        BIGINT      NOT NULL DEFAULT 0,
  tenure_months               SMALLINT    NOT NULL,
  rate_of_interest_bps        INTEGER     NOT NULL,
  interest_rate_type          VARCHAR(10) NOT NULL,
  emi_amount                  BIGINT      NOT NULL,
  first_emi_date              DATE        NOT NULL,
  next_emi_date               DATE,
  last_emi_date               DATE        NOT NULL,
  emis_due                    SMALLINT    NOT NULL,
  emis_paid                   SMALLINT    NOT NULL DEFAULT 0,
  repayment_account           JSONB       NOT NULL,
  nach_mandate                JSONB,
  insurance                   JSONB,
  cbs_customer_id             VARCHAR(30),                  -- CBS CIF number
  cbs_synced_at               TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loan_status_chk CHECK (status IN (
    'SANCTIONED','ACTIVE','OVERDUE','NPA','WRITTEN_OFF','SETTLED','FORECLOSED','CLOSED'
  ))
);

CREATE INDEX idx_loans_user ON los_core.loans (user_id, status);
CREATE INDEX idx_loans_status ON los_core.loans (status, next_emi_date);
CREATE INDEX idx_loans_account ON los_core.loans (loan_account_number);
```

---

### 2.14 disbursements

```sql
CREATE TABLE los_core.disbursements (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id               UUID        NOT NULL REFERENCES los_core.loans(id),
  disbursement_number   SMALLINT    NOT NULL,
  amount                BIGINT      NOT NULL,
  mode                  VARCHAR(10) NOT NULL,
  payee_account_enc     BYTEA,                             -- Encrypted account number
  payee_ifsc            VARCHAR(11),
  payee_name            VARCHAR(200),
  utr_number            VARCHAR(25),
  narration             VARCHAR(200),
  status                VARCHAR(15) NOT NULL DEFAULT 'PENDING',
  initiated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at            TIMESTAMPTZ,
  failure_reason        TEXT,
  idempotency_key       UUID        NOT NULL UNIQUE,
  CONSTRAINT disb_mode_chk CHECK (mode IN ('NEFT','RTGS','IMPS','UPI','DD','CHEQUE','CASH')),
  CONSTRAINT disb_status_chk CHECK (status IN (
    'PENDING','PROCESSING','SUCCESS','FAILED','REVERSED'
  ))
);

CREATE INDEX idx_disbursements_loan ON los_core.disbursements (loan_id, initiated_at DESC);
CREATE INDEX idx_disbursements_status ON los_core.disbursements (status, initiated_at);
UNIQUE INDEX idx_disbursements_idempotency ON los_core.disbursements (idempotency_key);
```

---

### 2.15 emi_schedule

```sql
CREATE TABLE los_core.emi_schedule (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id               UUID        NOT NULL REFERENCES los_core.loans(id),
  installment_number    SMALLINT    NOT NULL,
  due_date              DATE        NOT NULL,
  opening_balance       BIGINT      NOT NULL,
  emi_amount            BIGINT      NOT NULL,
  principal_component   BIGINT      NOT NULL,
  interest_component    BIGINT      NOT NULL,
  closing_balance       BIGINT      NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',
  paid_amount           BIGINT,
  paid_at               TIMESTAMPTZ,
  payment_reference     VARCHAR(50),
  penal_interest        BIGINT      DEFAULT 0,
  UNIQUE (loan_id, installment_number),
  CONSTRAINT emi_status_chk CHECK (status IN (
    'UPCOMING','DUE','PAID','OVERDUE','PARTIALLY_PAID','WAIVED'
  ))
);

CREATE INDEX idx_emi_loan_due ON los_core.emi_schedule (loan_id, due_date);
CREATE INDEX idx_emi_status_due ON los_core.emi_schedule (status, due_date)
  WHERE status IN ('DUE','OVERDUE');
```

---

### 2.16 audit_logs (Partitioned)

```sql
CREATE TABLE los_core.audit_logs (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  event_category  VARCHAR(20) NOT NULL,
  event_type      VARCHAR(60) NOT NULL,
  actor_id        UUID,
  actor_role      VARCHAR(30),
  actor_ip        INET,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       UUID        NOT NULL,
  before_state    TEXT,                                    -- Compressed JSON; sensitive fields masked
  after_state     TEXT,
  metadata        JSONB,
  request_id      UUID        NOT NULL,
  correlation_id  UUID,
  service_origin  VARCHAR(50) NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chain_hash      CHAR(64)    NOT NULL,                   -- SHA-256 chained tamper-evidence
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Indexes on partitions
CREATE INDEX idx_audit_entity ON los_core.audit_logs (entity_id, timestamp DESC);
CREATE INDEX idx_audit_actor ON los_core.audit_logs (actor_id, timestamp DESC)
  WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_category ON los_core.audit_logs (event_category, timestamp DESC);
```

---

### 2.17 consent_records

```sql
CREATE TABLE los_core.consent_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES los_core.users(id),
  application_id    UUID        NOT NULL,
  consent_type      VARCHAR(30) NOT NULL,
  consent_text      TEXT        NOT NULL,
  consent_version   VARCHAR(10) NOT NULL,
  is_granted        BOOLEAN     NOT NULL DEFAULT TRUE,
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        INET        NOT NULL,
  user_agent        TEXT,
  signed_otp_session_id UUID,
  revoked_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  CONSTRAINT consent_type_chk CHECK (consent_type IN (
    'KYC_AADHAAR_EKYC','CREDIT_BUREAU_PULL','DATA_PROCESSING',
    'MARKETING_COMMUNICATIONS','THIRD_PARTY_SHARE','NACH_MANDATE','LOAN_AGREEMENT'
  ))
);

CREATE INDEX idx_consent_user_app ON los_core.consent_records (user_id, application_id, consent_type);
CREATE INDEX idx_consent_active ON los_core.consent_records (application_id, consent_type)
  WHERE is_granted = TRUE AND revoked_at IS NULL;
```

---

### 2.18 idempotency_keys

```sql
CREATE TABLE los_core.idempotency_keys (
  idempotency_key   VARCHAR(36) PRIMARY KEY,
  endpoint          VARCHAR(100) NOT NULL,
  response_status   SMALLINT    NOT NULL,
  response_body     TEXT        NOT NULL,               -- Compressed
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idem_expires ON los_core.idempotency_keys (expires_at);
-- Cron: DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

---

### 2.19 loan_product_configs

```sql
CREATE TABLE los_core.loan_product_configs (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code            VARCHAR(20) NOT NULL UNIQUE,
  loan_type               VARCHAR(30) NOT NULL,
  min_amount              BIGINT      NOT NULL,
  max_amount              BIGINT      NOT NULL,
  min_tenure_months       SMALLINT    NOT NULL,
  max_tenure_months       SMALLINT    NOT NULL,
  min_age                 SMALLINT    NOT NULL,
  max_age                 SMALLINT    NOT NULL,
  min_credit_score        SMALLINT    NOT NULL,
  max_foir                NUMERIC(5,2) NOT NULL,
  max_ltv                 NUMERIC(5,2),
  base_rate_bps           INTEGER     NOT NULL,
  spread_bps              INTEGER     NOT NULL DEFAULT 0,
  processing_fee_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  prepayment_penalty_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  allowed_employment_types TEXT[],
  mandatory_documents     TEXT[],
  conditional_rules       JSONB,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  effective_from          DATE        NOT NULL,
  effective_to            DATE,
  created_by              UUID        REFERENCES los_core.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_type_active ON los_core.loan_product_configs (loan_type, is_active, effective_from);
```

---

## 3. Row-Level Security Policies

```sql
-- Enable RLS on sensitive tables
ALTER TABLE los_core.loan_applications ENABLE ROW LEVEL SECURITY;

-- Loan officers see only their branch applications
CREATE POLICY loan_officer_branch_policy ON los_core.loan_applications
  FOR ALL TO loan_officer_role
  USING (branch_code = current_setting('app.current_branch_code'));

-- Applicants see only their own applications
CREATE POLICY applicant_own_policy ON los_core.loan_applications
  FOR SELECT TO applicant_role
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Compliance sees all (read-only via separate role)
CREATE POLICY compliance_read_policy ON los_core.loan_applications
  FOR SELECT TO compliance_role
  USING (TRUE);
```

---

## 4. Encryption Strategy

```sql
-- PAN encryption using pgcrypto
INSERT INTO los_core.loan_applications (applicant_pan_enc, ...)
VALUES (
  pgp_sym_encrypt('ABCRS1234F', current_setting('app.encryption_key')),
  ...
);

-- PAN decryption (only authorized roles via stored proc)
CREATE OR REPLACE FUNCTION get_pan(enc_pan BYTEA)
RETURNS TEXT AS $$
BEGIN
  -- RLS ensures only authorized roles can call this
  RETURN pgp_sym_decrypt(enc_pan, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Indexing Strategy Summary

| Table | Index Type | Columns | Purpose |
|---|---|---|---|
| loan_applications | B-Tree | (status, created_at DESC) | Officer worklist |
| loan_applications | B-Tree | (applicant_pan_hash, loan_type, created_at) | Duplicate detection |
| loan_applications | GIN | applicant_profile JSONB | Flexible search |
| documents | B-Tree | (application_id, status) | Document checklist |
| bureau_pull_jobs | B-Tree | (status, started_at) | Retry queue |
| emi_schedule | B-Tree | (status, due_date) WHERE overdue | Collection queue |
| audit_logs | B-Tree | (entity_id, timestamp DESC) | Audit trail lookup |
| audit_logs | B-Tree | (event_category, timestamp DESC) | Compliance reports |

---

## 6. Data Retention & Archival

| Table | Hot Retention | Archive | Purge |
|---|---|---|---|
| loan_applications | 2 years (PostgreSQL) | 8 years (cold S3) | 10 years post-closure |
| audit_logs | 1 year (PostgreSQL) | 9 years (cold S3, Glacier) | Never |
| aadhaar_kyc_results | Active loan period | Not archived | Purge Aadhaar hash on customer request (with legal review) |
| otp_sessions | 7 days | N/A | Auto-delete via cron |
| idempotency_keys | 24 hours | N/A | Auto-delete via cron |

---
*End of Database Schema Documentation*
