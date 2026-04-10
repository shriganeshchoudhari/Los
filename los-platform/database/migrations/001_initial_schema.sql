-- ============================================================================
-- ⚠️  DEPRECATED — DO NOT USE FOR NEW DEPLOYMENTS
-- ============================================================================
-- This file has been replaced by per-service migrations.
-- Use the individual migration files listed below instead.
--
-- Per-service migrations:
--   002_auth_schema.sql        → los_auth database      (auth-service)
--   003_loan_schema.sql        → los_loan database      (loan-service)
--   004_kyc_schema.sql        → los_kyc database       (kyc-service)
--   005_decision_schema.sql   → los_decision database  (decision-service)
--   006_integration_schema.sql→ los_integration DB     (integration-service)
--   007_document_schema.sql    → los_document database  (document-service)
--   008_notification_schema.sql→ los_notification DB   (notification-service)
--   009_dsa_schema.sql        → los_dsa database       (dsa-service)
--   010_shared_schema.sql     → los_shared database    (shared cross-service)
--
-- Key changes in per-service migrations:
--   - Each service owns its own schema and database
--   - Cross-service FK references (e.g., to los_core.users) removed;
--     application-level validation and Kafka events maintain integrity
--   - Duplicate sanction_letters table resolved (single canonical definition)
--   - Inconsistent los_core prefix on documents table fixed
--   - All tables prefixed with service schema (los_auth, los_loan, etc.)
--   - Each migration includes its own schema_migrations tracking table
--
-- Legacy reference only — LOS Platform Database Migrations
-- PostgreSQL 15 | Schema: los_core
-- Migration: 001_initial_schema
-- ============================================================================

-- LOS Platform Database Migrations
-- PostgreSQL 15 | Schema: los_core
-- Migration: 001_initial_schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema
CREATE SCHEMA IF NOT EXISTS los_core;

-- ================================================================
-- TABLE: users
-- ================================================================
CREATE TABLE los_core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(254),
    mobile VARCHAR(10) NOT NULL UNIQUE,
    mobile_hash CHAR(64) NOT NULL,
    role VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    branch_code VARCHAR(10),
    pan_number_encrypted JSONB,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

-- ================================================================
-- TABLE: otp_sessions
-- ================================================================
CREATE TABLE los_core.otp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile_hash CHAR(64) NOT NULL,
    otp_hash CHAR(60) NOT NULL,
    purpose VARCHAR(30) NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT otp_purpose_chk CHECK (purpose IN (
        'LOGIN','AADHAAR_CONSENT','LOAN_APPLICATION_SUBMIT',
        'DISBURSEMENT_CONFIRM','PASSWORD_RESET'
    ))
);

CREATE INDEX idx_otp_sessions_mobile_hash_expires 
    ON los_core.otp_sessions (mobile_hash, expires_at) WHERE is_used = FALSE;

-- ================================================================
-- TABLE: refresh_tokens
-- ================================================================
CREATE TABLE los_core.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES los_core.users(id) ON DELETE CASCADE,
    token_hash CHAR(60) NOT NULL,
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON los_core.refresh_tokens (user_id, revoked_at);

-- ================================================================
-- TABLE: loan_applications (Partitioned)
-- ================================================================
CREATE TABLE los_core.loan_applications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    application_number VARCHAR(30) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    loan_type VARCHAR(30) NOT NULL,
    customer_segment VARCHAR(10) NOT NULL DEFAULT 'RETAIL',
    channel_code VARCHAR(20) NOT NULL,
    branch_code VARCHAR(10) NOT NULL,
    
    -- Applicant snapshot (denormalized)
    applicant_full_name VARCHAR(200) NOT NULL,
    applicant_dob DATE NOT NULL,
    applicant_mobile VARCHAR(10) NOT NULL,
    applicant_mobile_hash CHAR(64) NOT NULL,
    applicant_pan_hash CHAR(64) NOT NULL,
    applicant_pan_encrypted JSONB NOT NULL,
    applicant_gender VARCHAR(15),
    applicant_pincode VARCHAR(6),
    applicant_state VARCHAR(4),
    
    -- Full profile as JSONB
    applicant_profile JSONB NOT NULL DEFAULT '{}',
    employment_details JSONB NOT NULL DEFAULT '{}',
    loan_requirement JSONB NOT NULL DEFAULT '{}',
    
    -- Relationships
    user_id UUID NOT NULL REFERENCES los_core.users(id),
    kyc_id UUID,
    bureau_report_id UUID,
    decision_id UUID,
    assigned_officer_id UUID REFERENCES los_core.users(id),
    assigned_analyst_id UUID REFERENCES los_core.users(id),
    
    -- Financials
    requested_amount BIGINT NOT NULL,
    sanctioned_amount BIGINT,
    sanctioned_tenure_months SMALLINT,
    sanctioned_roi_bps INTEGER,
    
    -- DSA
    dsa_code VARCHAR(20),
    dsa_name VARCHAR(100),
    
    -- Decision output
    rejection_reason_code VARCHAR(30),
    rejection_remarks TEXT,
    conditions_pre_disbursal TEXT[],
    
    -- Timestamps
    submitted_at TIMESTAMPTZ,
    sanctioned_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for 2024-2026
CREATE TABLE los_core.loan_applications_2024_07 PARTITION OF los_core.loan_applications
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE los_core.loan_applications_2024_08 PARTITION OF los_core.loan_applications
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE los_core.loan_applications_2024_09 PARTITION OF los_core.loan_applications
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE los_core.loan_applications_2024_10 PARTITION OF los_core.loan_applications
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE los_core.loan_applications_2024_11 PARTITION OF los_core.loan_applications
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE los_core.loan_applications_2024_12 PARTITION OF los_core.loan_applications
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE los_core.loan_applications_2025 PARTITION OF los_core.loan_applications
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE los_core.loan_applications_2026 PARTITION OF los_core.loan_applications
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Indexes on partitioned table
CREATE UNIQUE INDEX idx_app_number ON los_core.loan_applications (application_number);
CREATE INDEX idx_app_status_created ON los_core.loan_applications (status, created_at DESC);
CREATE INDEX idx_app_pan_hash ON los_core.loan_applications (applicant_pan_hash, loan_type, created_at);
CREATE INDEX idx_app_user_id ON los_core.loan_applications (user_id, created_at DESC);
CREATE INDEX idx_app_officer ON los_core.loan_applications (assigned_officer_id, status)
    WHERE assigned_officer_id IS NOT NULL;
CREATE INDEX idx_app_branch_status ON los_core.loan_applications (branch_code, status, created_at DESC);
CREATE INDEX idx_app_applicant_profile ON los_core.loan_applications USING GIN (applicant_profile jsonb_path_ops);

-- ================================================================
-- TABLE: application_stage_history
-- ================================================================
CREATE TABLE los_core.application_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    from_status VARCHAR(40),
    to_status VARCHAR(40) NOT NULL,
    action_by UUID REFERENCES los_core.users(id),
    action_by_role VARCHAR(30),
    remarks TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stage_app_id ON los_core.application_stage_history (application_id, timestamp DESC);

-- ================================================================
-- TABLE: kyc_records
-- ================================================================
CREATE TABLE los_core.kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES los_core.users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    overall_risk_score SMALLINT CHECK (overall_risk_score BETWEEN 0 AND 100),
    reviewed_by UUID REFERENCES los_core.users(id),
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT kyc_status_chk CHECK (status IN (
        'NOT_STARTED','AADHAAR_OTP_SENT','AADHAAR_VERIFIED','PAN_VERIFIED',
        'FACE_MATCH_PENDING','FACE_MATCH_PASSED','FACE_MATCH_FAILED',
        'KYC_COMPLETE','KYC_FAILED','MANUAL_REVIEW'
    ))
);

CREATE UNIQUE INDEX idx_kyc_application ON los_core.kyc_records (application_id);
CREATE INDEX idx_kyc_user ON los_core.kyc_records (user_id, status);

-- ================================================================
-- TABLE: aadhaar_kyc_results
-- ================================================================
CREATE TABLE los_core.aadhaar_kyc_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES los_core.kyc_records(id),
    txn_id VARCHAR(100) NOT NULL,
    uidai_ref_id VARCHAR(100) NOT NULL,
    aadhaar_number_hash CHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    dob DATE NOT NULL,
    gender CHAR(1) NOT NULL,
    address_json JSONB,
    photo_storage_key VARCHAR(500),
    photo_encryption_key_ref VARCHAR(100),
    xml_storage_key VARCHAR(500),
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
    uidai_response_code VARCHAR(10),
    auth_code VARCHAR(100),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_metadata JSONB
);

CREATE UNIQUE INDEX idx_aadhaar_kyc_id ON los_core.aadhaar_kyc_results (kyc_id);
CREATE INDEX idx_aadhaar_hash ON los_core.aadhaar_kyc_results (aadhaar_number_hash);

-- ================================================================
-- TABLE: pan_verification_results
-- ================================================================
CREATE TABLE los_core.pan_verification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES los_core.kyc_records(id),
    pan_number_masked VARCHAR(10) NOT NULL,
    pan_number_encrypted JSONB NOT NULL,
    name_match_score SMALLINT NOT NULL,
    name_on_pan VARCHAR(200),
    dob_match BOOLEAN NOT NULL,
    pan_status VARCHAR(10) NOT NULL,
    linked_aadhaar BOOLEAN NOT NULL DEFAULT FALSE,
    aadhaar_seeding_status VARCHAR(15),
    nsdl_transaction_id VARCHAR(100),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pan_status_chk CHECK (pan_status IN ('VALID','INVALID','INACTIVE','FAKE','DUPLICATE'))
);

-- ================================================================
-- TABLE: face_match_results
-- ================================================================
CREATE TABLE los_core.face_match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES los_core.kyc_records(id),
    match_score SMALLINT NOT NULL,
    passed BOOLEAN NOT NULL,
    liveness_score SMALLINT,
    liveness_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
    provider VARCHAR(30) NOT NULL,
    request_id VARCHAR(100),
    failure_reason VARCHAR(50),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- TABLE: consent_records
-- ================================================================
CREATE TABLE los_core.consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES los_core.users(id),
    application_id UUID NOT NULL,
    consent_type VARCHAR(30) NOT NULL,
    consent_text TEXT NOT NULL,
    consent_version VARCHAR(10) NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET NOT NULL,
    user_agent TEXT,
    signed_otp_session_id UUID,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    CONSTRAINT consent_type_chk CHECK (consent_type IN (
        'KYC_AADHAAR_EKYC','CREDIT_BUREAU_PULL','DATA_PROCESSING',
        'MARKETING_COMMUNICATIONS','THIRD_PARTY_SHARE','NACH_MANDATE','LOAN_AGREEMENT'
    ))
);

CREATE INDEX idx_consent_user_app ON los_core.consent_records (user_id, application_id, consent_type);
CREATE INDEX idx_consent_active ON los_core.consent_records (application_id, consent_type)
    WHERE is_granted = TRUE AND revoked_at IS NULL;

-- ================================================================
-- TABLE: documents
-- ================================================================
CREATE TABLE los_core.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES los_core.users(id),
    document_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_UPLOAD',
    original_file_name VARCHAR(255),
    mime_type VARCHAR(100),
    file_size_bytes INTEGER,
    storage_key VARCHAR(500),
    checksum_sha256 CHAR(64),
    is_encrypted BOOLEAN NOT NULL DEFAULT TRUE,
    encryption_key_ref VARCHAR(100),
    watermark VARCHAR(100),
    ocr_result JSONB,
    ocr_confidence SMALLINT CHECK (ocr_confidence BETWEEN 0 AND 100),
    reviewed_by UUID REFERENCES los_core.users(id),
    rejection_reason TEXT,
    expiry_date DATE,
    uploaded_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT doc_status_chk CHECK (status IN (
        'PENDING_UPLOAD','UPLOADED','OCR_PROCESSING','OCR_COMPLETE',
        'UNDER_REVIEW','APPROVED','REJECTED','EXPIRED'
    ))
);

CREATE INDEX idx_docs_application ON los_core.documents (application_id, status);
CREATE INDEX idx_docs_type_status ON los_core.documents (document_type, status);
CREATE INDEX idx_docs_ocr ON los_core.documents USING GIN (ocr_result jsonb_path_ops)
    WHERE ocr_result IS NOT NULL;

-- ================================================================
-- TABLE: bureau_pull_jobs
-- ================================================================
CREATE TYPE bureau_provider AS ENUM ('CIBIL', 'EXPERIAN', 'EQUIFAX', 'CRIF');
CREATE TYPE bureau_pull_status AS ENUM ('PENDING', 'CONSENT_PENDING', 'IN_PROGRESS', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'TIMEOUT', 'DUPLICATE_LOCKED');

CREATE TABLE los_core.bureau_pull_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    applicant_id UUID NOT NULL,
    pan_hash VARCHAR(64) NOT NULL,
    provider bureau_provider NOT NULL,
    status bureau_pull_status NOT NULL DEFAULT 'PENDING',
    consent_timestamp TIMESTAMPTZ,
    consent_otp_hash VARCHAR(64),
    request_timestamp TIMESTAMPTZ,
    response_timestamp TIMESTAMPTZ,
    request_payload JSONB,
    response_payload JSONB,
    error_code VARCHAR(20),
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    timeout_ms INT,
    lock_expires_at TIMESTAMPTZ,
    report_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bureau_jobs_app_provider ON los_core.bureau_pull_jobs (application_id, provider);
CREATE INDEX idx_bureau_jobs_pan ON los_core.bureau_pull_jobs (pan_hash, created_at);
CREATE INDEX idx_bureau_jobs_status ON los_core.bureau_pull_jobs (status, created_at);

-- ================================================================
-- TABLE: bureau_reports
-- ================================================================
CREATE TYPE bureau_report_status AS ENUM ('RAW', 'PARSED', 'FAILED', 'ARCHIVED');

CREATE TABLE los_core.bureau_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    pull_job_id UUID NOT NULL,
    provider bureau_provider NOT NULL,
    pan_hash VARCHAR(64) NOT NULL,
    status bureau_report_status NOT NULL DEFAULT 'RAW',
    raw_xml TEXT,
    raw_json JSONB,
    parsed_score INT,
    parsed_grade VARCHAR(5),
    parsed_dpd_0_30 INT,
    parsed_dpd_31_60 INT,
    parsed_dpd_61_90 INT,
    parsed_dpd_over_90 INT,
    parsed_total_accounts INT,
    parsed_active_accounts INT,
    parsed_closed_accounts INT,
    parsed_total_exposure NUMERIC(18,2),
    parsed_secured_exposure NUMERIC(18,2),
    parsed_unsecured_exposure NUMERIC(18,2),
    parsed_total_emi NUMERIC(18,2),
    parsed_enquiries_30d INT,
    parsed_enquiries_90d INT,
    parsed_writeoffs INT,
    parsed_suit_filed BOOLEAN NOT NULL DEFAULT FALSE,
    parsed_disputed BOOLEAN NOT NULL DEFAULT FALSE,
    parsed_account_summary JSONB,
    parsed_enquiry_summary JSONB,
    parsed_error_code VARCHAR(20),
    parsed_error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (application_id, provider)
);

CREATE INDEX idx_bureau_reports_app ON los_core.bureau_reports (application_id, provider);
CREATE INDEX idx_bureau_reports_pan ON los_core.bureau_reports (pan_hash, created_at);

-- ================================================================
-- TABLE: bureau_aggregated_scores
-- ================================================================
CREATE TABLE los_core.bureau_aggregated_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL UNIQUE,
    primary_provider bureau_provider NOT NULL,
    primary_score INT NOT NULL,
    cibil_score INT,
    experian_score INT,
    equifax_score INT,
    crif_score INT,
    max_dpd INT NOT NULL DEFAULT 0,
    total_exposure NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_emi NUMERIC(18,2) NOT NULL DEFAULT 0,
    active_accounts INT NOT NULL DEFAULT 0,
    enquiries_30d INT NOT NULL DEFAULT 0,
    writeoffs INT NOT NULL DEFAULT 0,
    suit_filed BOOLEAN NOT NULL DEFAULT FALSE,
    disputed BOOLEAN NOT NULL DEFAULT FALSE,
    bureau_report_ids JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- TABLE: decision_results
-- ================================================================
CREATE TABLE los_core.decision_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    final_decision VARCHAR(10),
    approved_amount BIGINT,
    approved_tenure_months SMALLINT,
    interest_rate_type VARCHAR(10),
    rate_of_interest_bps INTEGER,
    spread_bps INTEGER,
    benchmark_rate VARCHAR(15),
    processing_fee_paisa BIGINT,
    insurance_mandatory BOOLEAN DEFAULT FALSE,
    ltv_ratio NUMERIC(5,2),
    foir_actual NUMERIC(5,2),
    scorecard_result JSONB,
    conditions JSONB,
    rejection_reason_code VARCHAR(30),
    rejection_remarks TEXT,
    decided_by VARCHAR(15) NOT NULL DEFAULT 'RULE_ENGINE',
    decided_at TIMESTAMPTZ,
    policy_version VARCHAR(10) NOT NULL,
    override_by UUID REFERENCES los_core.users(id),
    override_remarks TEXT,
    override_request_by UUID REFERENCES los_core.users(id),
    override_request_at TIMESTAMPTZ,
    override_request_remarks TEXT,
    override_requested_decision VARCHAR(20),
    override_requested_amount BIGINT,
    override_requested_tenure SMALLINT,
    override_requested_rate INTEGER,
    override_request_conditions JSONB,
    override_requested_rejection_code VARCHAR(30),
    override_authority_level VARCHAR(30),
    override_attachments JSONB,
    override_approved_by UUID REFERENCES los_core.users(id),
    override_approved_at TIMESTAMPTZ,
    override_approver_remarks TEXT,
    override_approval_action VARCHAR(10),
    override_rejected_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT decision_status_chk CHECK (status IN (
        'PENDING','IN_PROGRESS','APPROVED','CONDITIONALLY_APPROVED',
        'REJECTED','REFER_TO_CREDIT_COMMITTEE','OVERRIDE_PENDING','MANUAL_OVERRIDE'
    )),
    CONSTRAINT decided_by_chk CHECK (decided_by IN ('RULE_ENGINE','ML_MODEL','MANUAL'))
);

CREATE UNIQUE INDEX idx_decision_application ON los_core.decision_results (application_id)
    WHERE status NOT IN ('PENDING');
CREATE INDEX idx_decision_status ON los_core.decision_results (status, decided_at DESC);
CREATE INDEX idx_decision_override_pending ON los_core.decision_results (status, override_request_at)
    WHERE status = 'OVERRIDE_PENDING';

-- ================================================================
-- TABLE: decision_rule_results
-- ================================================================
CREATE TABLE los_core.decision_rule_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES los_core.decision_results(id),
    rule_id VARCHAR(20) NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    outcome VARCHAR(5) NOT NULL,
    threshold VARCHAR(50),
    actual_value VARCHAR(50),
    message TEXT,
    is_hard_stop BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT outcome_chk CHECK (outcome IN ('PASS','FAIL','WARN','SKIP'))
);

CREATE INDEX idx_rule_results_decision ON los_core.decision_rule_results (decision_id, outcome);
CREATE INDEX idx_rule_hard_stop ON los_core.decision_rule_results (decision_id)
    WHERE is_hard_stop = TRUE AND outcome = 'FAIL';

-- Kafka Topics for Decision Engine
-- los.decision.completed
-- los.decision.override_requested
-- los.decision.override_approved
-- los.decision.override_rejected

-- ================================================================
-- TABLE: loans
-- ================================================================
CREATE TABLE los_core.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_account_number VARCHAR(20) NOT NULL UNIQUE,
    application_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES los_core.users(id),
    loan_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SANCTIONED',
    principal_amount BIGINT NOT NULL,
    outstanding_principal BIGINT NOT NULL,
    outstanding_interest BIGINT NOT NULL DEFAULT 0,
    tenure_months SMALLINT NOT NULL,
    rate_of_interest_bps INTEGER NOT NULL,
    interest_rate_type VARCHAR(10) NOT NULL,
    emi_amount BIGINT NOT NULL,
    first_emi_date DATE NOT NULL,
    next_emi_date DATE,
    last_emi_date DATE NOT NULL,
    emis_due SMALLINT NOT NULL,
    emis_paid SMALLINT NOT NULL DEFAULT 0,
    repayment_account JSONB NOT NULL,
    nach_mandate JSONB,
    insurance JSONB,
    cbs_customer_id VARCHAR(30),
    cbs_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT loan_status_chk CHECK (status IN (
        'SANCTIONED','ACTIVE','OVERDUE','NPA','WRITTEN_OFF','SETTLED','FORECLOSED','CLOSED'
    ))
);

CREATE INDEX idx_loans_user ON los_core.loans (user_id, status);
CREATE INDEX idx_loans_status ON los_core.loans (status, next_emi_date);
CREATE INDEX idx_loans_account ON los_core.loans (loan_account_number);

-- ================================================================
-- TABLE: disbursements
-- ================================================================
CREATE TYPE disbursement_status AS ENUM (
    'PENDING','CBS_CUSTOMER_CREATED','CBS_ACCOUNT_CREATED',
    'MANDATE_PENDING','MANDATE_REGISTERED','MANDATE_CONFIRMED',
    'PAYMENT_INITIATED','PAYMENT_SUCCESS','PAYMENT_FAILED',
    'PAYMENT_RETURNED','CANCELLED','REVERSED'
);
CREATE TYPE payment_mode AS ENUM ('IMPS','NEFT','RTGS','UPI','NACH','CHEQUE','CASH');

CREATE TABLE los_core.disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    loan_id UUID REFERENCES los_core.loans(id),
    loan_account_id VARCHAR(30),
    cbs_customer_id VARCHAR(30),
    disbursement_number VARCHAR(30) NOT NULL,
    tranche_number INT NOT NULL DEFAULT 1,
    amount NUMERIC(18,2) NOT NULL,
    payment_mode payment_mode NOT NULL,
    beneficiary_account_number VARCHAR(30) NOT NULL,
    beneficiary_ifsc VARCHAR(11) NOT NULL,
    beneficiary_name VARCHAR(100) NOT NULL,
    beneficiary_bank_name VARCHAR(100),
    beneficiary_mobile VARCHAR(10),
    status disbursement_status NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(64),
    utr_number VARCHAR(30),
    npci_reference_id VARCHAR(30),
    cbs_transaction_ref VARCHAR(30),
    nach_mandate_id VARCHAR(30),
    initiated_at TIMESTAMPTZ,
    settlement_at TIMESTAMPTZ,
    failure_reason VARCHAR(50),
    failure_details JSONB,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    initiated_by UUID,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disbursements_app ON los_core.disbursements (application_id, status);
CREATE INDEX idx_disbursements_loan_account ON los_core.disbursements (loan_account_id);
CREATE UNIQUE INDEX idx_disbursements_utr ON los_core.disbursements (utr_number) WHERE utr_number IS NOT NULL;
CREATE UNIQUE INDEX idx_disbursements_idempotency ON los_core.disbursements (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_disbursements_status ON los_core.disbursements (status, created_at);

-- ================================================================
-- TABLE: emi_schedule
-- ================================================================
CREATE TABLE los_core.emi_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES los_core.loans(id),
    installment_number SMALLINT NOT NULL,
    due_date DATE NOT NULL,
    opening_balance BIGINT NOT NULL,
    emi_amount BIGINT NOT NULL,
    principal_component BIGINT NOT NULL,
    interest_component BIGINT NOT NULL,
    closing_balance BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',
    paid_amount BIGINT,
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(50),
    penal_interest BIGINT DEFAULT 0,
    UNIQUE (loan_id, installment_number),
    CONSTRAINT emi_status_chk CHECK (status IN (
        'UPCOMING','DUE','PAID','OVERDUE','PARTIALLY_PAID','WAIVED'
    ))
);

CREATE INDEX idx_emi_loan_due ON los_core.emi_schedule (loan_id, due_date);
CREATE INDEX idx_emi_status_due ON los_core.emi_schedule (status, due_date)
    WHERE status IN ('DUE','OVERDUE');

-- ================================================================
-- TABLE: payment_transactions
-- ================================================================
CREATE TABLE los_core.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disbursement_id UUID NOT NULL,
    payment_mode payment_mode NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    sender_account VARCHAR(30) NOT NULL,
    sender_ifsc VARCHAR(11) NOT NULL,
    beneficiary_account VARCHAR(30) NOT NULL,
    beneficiary_ifsc VARCHAR(11) NOT NULL,
    beneficiary_name VARCHAR(100) NOT NULL,
    utr_number VARCHAR(30),
    npci_reference VARCHAR(30),
    request_payload JSONB,
    response_payload JSONB,
    status_code VARCHAR(10),
    status_message TEXT,
    request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_timestamp TIMESTAMPTZ,
    latency_ms INT,
    retry_count INT NOT NULL DEFAULT 0,
    callback_received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_disbursement ON los_core.payment_transactions (disbursement_id);
CREATE UNIQUE INDEX idx_payment_utr ON los_core.payment_transactions (utr_number) WHERE utr_number IS NOT NULL;
CREATE INDEX idx_payment_status ON los_core.payment_transactions (status_code, created_at);

-- ================================================================
-- TABLE: nach_mandates
-- ================================================================
CREATE TABLE los_core.nach_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    loan_id UUID NOT NULL,
    loan_account_id VARCHAR(30) NOT NULL,
    emandate_id VARCHAR(30),
    umrn VARCHAR(30),
    sponsor_code VARCHAR(20) NOT NULL,
    utility_code VARCHAR(20) NOT NULL,
    debtor_account_number VARCHAR(30) NOT NULL,
    debtor_ifsc VARCHAR(11) NOT NULL,
    debtor_name VARCHAR(100) NOT NULL,
    debtor_bank_name VARCHAR(100),
    max_amount NUMERIC(18,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    registration_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    confirmation_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    callback_payload JSONB,
    penny_drop_verified BOOLEAN NOT NULL DEFAULT FALSE,
    penny_drop_verified_at TIMESTAMPTZ,
    penny_drop_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nach_app ON los_core.nach_mandates (application_id);
CREATE INDEX idx_nach_loan_account ON los_core.nach_mandates (loan_account_id);
CREATE UNIQUE INDEX idx_nach_umrn ON los_core.nach_mandates (umrn) WHERE umrn IS NOT NULL;

-- ================================================================
-- TABLE: notifications
-- ================================================================
CREATE TYPE notif_channel AS ENUM ('SMS','EMAIL','WHATSAPP','PUSH','IN_APP');
CREATE TYPE notif_status AS ENUM ('QUEUED','SENT','DELIVERED','READ','FAILED','BOUNCED','UNDELIVERED','OPTED_OUT');
CREATE TYPE notif_category AS ENUM (
    'OTP','APPLICATION_STATUS','KYC_UPDATE','DOCUMENT_REMINDER',
    'DECISION','SANCTION','DISBURSEMENT','EMI_REMINDER',
    'PAYMENT_CONFIRMATION','GENERAL','MARKETING'
);
CREATE TYPE notif_priority AS ENUM ('LOW','NORMAL','HIGH','URGENT');

CREATE TABLE los_core.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID,
    user_id UUID REFERENCES los_core.users(id),
    recipient_id VARCHAR(100) NOT NULL,
    channel notif_channel NOT NULL,
    category notif_category NOT NULL,
    status notif_status NOT NULL DEFAULT 'QUEUED',
    priority notif_priority NOT NULL DEFAULT 'NORMAL',
    template_id UUID,
    template_name VARCHAR(50),
    subject VARCHAR(255),
    rendered_content TEXT,
    raw_payload JSONB,
    dlt_template_id VARCHAR(30),
    entity_id VARCHAR(30),
    provider_message_id VARCHAR(100),
    provider_response JSONB,
    error_code VARCHAR(30),
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    sender_id VARCHAR(30),
    initiated_by UUID,
    initiated_via VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON los_core.notifications (recipient_id, created_at DESC);
CREATE INDEX idx_notif_application ON los_core.notifications (application_id, created_at DESC) WHERE application_id IS NOT NULL;
CREATE INDEX idx_notif_status ON los_core.notifications (status, created_at);
CREATE INDEX idx_notif_channel_status ON los_core.notifications (channel, status);
CREATE INDEX idx_notif_category ON los_core.notifications (category, created_at);
CREATE INDEX idx_notif_template ON los_core.notifications (template_id) WHERE template_id IS NOT NULL;

-- ================================================================
-- TABLE: notification_templates
-- ================================================================
CREATE TABLE los_core.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    category notif_category NOT NULL,
    channel notif_channel NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    body_hi TEXT,
    body_bilingual TEXT,
    dlt_template_id VARCHAR(30),
    dlt_entity_id VARCHAR(30),
    variables JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_transactional BOOLEAN NOT NULL DEFAULT TRUE,
    priority notif_priority NOT NULL DEFAULT 'NORMAL',
    min_delay_seconds INT NOT NULL DEFAULT 0,
    max_daily_count INT,
    rate_limit_per_hour INT,
    created_by UUID,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_name, channel)
);

CREATE INDEX idx_tmpl_category_active ON los_core.notification_templates (category, is_active);

-- ================================================================
-- TABLE: notification_preferences
-- ================================================================
CREATE TABLE los_core.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES los_core.users(id),
    channel notif_channel NOT NULL,
    is_opted_in BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    contact_value VARCHAR(255) NOT NULL,
    dnd_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    dnd_start_time TIME,
    dnd_end_time TIME,
    categories JSONB,
    last_verified_at TIMESTAMPTZ,
    last_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, channel)
);

-- ================================================================
-- TABLE: notification_opt_outs
-- ================================================================
CREATE TABLE los_core.notification_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id VARCHAR(100) NOT NULL,
    channel notif_channel NOT NULL,
    category notif_category,
    opted_out_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'USER_REQUEST',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (recipient_id, channel)
);

CREATE INDEX idx_optout_recipient_category ON los_core.notification_opt_outs (recipient_id, category) WHERE category IS NOT NULL;

-- ================================================================
-- TABLE: notification_delivery_logs
-- ================================================================
CREATE TABLE los_core.notification_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    status notif_status NOT NULL,
    provider_status_code VARCHAR(20),
    provider_message TEXT,
    metadata JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_notif ON los_core.notification_delivery_logs (notification_id, timestamp DESC);
CREATE INDEX idx_delivery_provider_msg ON los_core.notification_delivery_logs (provider_status_code) WHERE provider_status_code IS NOT NULL;

-- ================================================================
-- TABLE: audit_logs (Partitioned)
-- ================================================================
CREATE TABLE los_core.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_category VARCHAR(20) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    actor_id UUID,
    actor_role VARCHAR(30),
    actor_ip INET,
    user_agent TEXT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    before_state TEXT,
    after_state TEXT,
    metadata JSONB,
    request_id UUID NOT NULL,
    correlation_id UUID,
    service_origin VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chain_hash CHAR(64) NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Audit log partitions
CREATE TABLE los_core.audit_logs_2024_07 PARTITION OF los_core.audit_logs
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE los_core.audit_logs_2024_08 PARTITION OF los_core.audit_logs
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE los_core.audit_logs_2024_09 PARTITION OF los_core.audit_logs
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE los_core.audit_logs_2024_10 PARTITION OF los_core.audit_logs
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE los_core.audit_logs_2024_11 PARTITION OF los_core.audit_logs
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE los_core.audit_logs_2024_12 PARTITION OF los_core.audit_logs
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE los_core.audit_logs_2025 PARTITION OF los_core.audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE los_core.audit_logs_2026 PARTITION OF los_core.audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_audit_entity ON los_core.audit_logs (entity_id, timestamp DESC);
CREATE INDEX idx_audit_actor ON los_core.audit_logs (actor_id, timestamp DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_category ON los_core.audit_logs (event_category, timestamp DESC);

-- ================================================================
-- TABLE: data_access_logs
-- ================================================================
CREATE TABLE los_core.data_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accessor_id UUID NOT NULL REFERENCES los_core.users(id),
    accessor_role VARCHAR(30) NOT NULL,
    resource_type VARCHAR(30) NOT NULL,
    resource_id UUID NOT NULL,
    purpose VARCHAR(200) NOT NULL,
    consent_id UUID,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET NOT NULL,
    CONSTRAINT resource_type_chk CHECK (resource_type IN (
        'AADHAAR_DATA','PAN_DATA','CREDIT_REPORT','BANK_STATEMENT','LOAN_DATA'
    ))
);

CREATE INDEX idx_data_access_resource ON los_core.data_access_logs (resource_type, resource_id);
CREATE INDEX idx_data_access_accessor ON los_core.data_access_logs (accessor_id, accessed_at DESC);

-- ================================================================
-- TABLE: idempotency_keys
-- ================================================================
CREATE TABLE los_core.idempotency_keys (
    idempotency_key VARCHAR(36) PRIMARY KEY,
    endpoint VARCHAR(100) NOT NULL,
    response_status SMALLINT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idem_expires ON los_core.idempotency_keys (expires_at);

-- ================================================================
-- TABLE: loan_product_configs
-- ================================================================
CREATE TABLE los_core.loan_product_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(20) NOT NULL UNIQUE,
    loan_type VARCHAR(30) NOT NULL,
    min_amount BIGINT NOT NULL,
    max_amount BIGINT NOT NULL,
    min_tenure_months SMALLINT NOT NULL,
    max_tenure_months SMALLINT NOT NULL,
    min_age SMALLINT NOT NULL,
    max_age SMALLINT NOT NULL,
    min_credit_score SMALLINT NOT NULL,
    max_foir NUMERIC(5,2) NOT NULL,
    max_ltv NUMERIC(5,2),
    base_rate_bps INTEGER NOT NULL,
    spread_bps INTEGER NOT NULL DEFAULT 0,
    processing_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    prepayment_penalty_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    prepayment_lock_months SMALLINT NOT NULL DEFAULT 12,
    prepayment_max_percent_per_year NUMERIC(5,2) NOT NULL DEFAULT 25.00,
    foreclosure_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    foreclosure_lock_months SMALLINT NOT NULL DEFAULT 6,
    foreclosure_min_balance BIGINT DEFAULT 50000,
    foreclosure_penalty_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    allowed_employment_types TEXT[],
    mandatory_documents TEXT[],
    conditional_rules JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_by UUID REFERENCES los_core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_type_active ON los_core.loan_product_configs (loan_type, is_active, effective_from);

-- ================================================================
-- TABLE: feature_flags
-- ================================================================
CREATE TABLE los_core.feature_flags (
    flag_key VARCHAR(50) PRIMARY KEY,
    description VARCHAR(200),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_for_roles TEXT[],
    enabled_for_branches TEXT[],
    rollout_percentage SMALLINT CHECK (rollout_percentage BETWEEN 0 AND 100),
    updated_by UUID REFERENCES los_core.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- TABLE: benchmark_rates
-- ================================================================
CREATE TABLE los_core.benchmark_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(15) NOT NULL UNIQUE,
    rate NUMERIC(10,4) NOT NULL,
    effective_from DATE NOT NULL,
    published_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT benchmark_type_chk CHECK (type IN ('MCLR_1Y','MCLR_3M','REPO_RATE','T_BILL_91D'))
);

-- ================================================================
-- TABLE: ml_model_registry
-- ================================================================
CREATE TYPE ml_model_status AS ENUM ('TRAINING','VALIDATED','ACTIVE','ARCHIVED','FAILED');
CREATE TYPE ml_model_type AS ENUM ('LOGISTIC_REGRESSION','RANDOM_FOREST','GRADIENT_BOOSTING','NEURAL_NETWORK','ENSEMBLE');

CREATE TABLE los_core.ml_model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    model_type ml_model_type NOT NULL,
    status ml_model_status NOT NULL DEFAULT 'TRAINING',
    loan_segment VARCHAR(30) NOT NULL DEFAULT 'ALL',
    loan_products JSONB,
    weights_path VARCHAR(500),
    weights_data BYTEA,
    feature_names JSONB NOT NULL DEFAULT '[]',
    scaler_mean JSONB,
    scaler_std JSONB,
    class_thresholds JSONB,
    coefficients JSONB,
    intercepts JSONB,
    feature_importances JSONB,
    performance_metrics JSONB,
    training_dataset_size INT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    trained_by VARCHAR(100),
    trained_at TIMESTAMPTZ,
    validation_date TIMESTAMPTZ,
    training_history JSONB,
    production_since TIMESTAMPTZ,
    replaced_by VARCHAR(50),
    replaced_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (model_id, version)
);

CREATE INDEX idx_ml_model_active_segment ON los_core.ml_model_registry (is_active, loan_segment);
CREATE INDEX idx_ml_model_status ON los_core.ml_model_registry (status, loan_segment);

CREATE TRIGGER update_ml_model_updated_at BEFORE UPDATE ON los_core.ml_model_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- TABLE: ml_prediction_log
-- ================================================================
CREATE TABLE los_core.ml_prediction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    model_id VARCHAR(50) NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    probability_of_default NUMERIC(6,5) NOT NULL,
    score INT NOT NULL,
    grade VARCHAR(5) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    recommended_action VARCHAR(30) NOT NULL,
    input_features JSONB NOT NULL DEFAULT '{}',
    inference_time_ms INT NOT NULL,
    actual_outcome VARCHAR(20),
    days_to_default INT,
    predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome_date TIMESTAMPTZ
);

CREATE INDEX idx_ml_pred_app ON los_core.ml_prediction_log (application_id, predicted_at DESC);
CREATE INDEX idx_ml_pred_model ON los_core.ml_prediction_log (model_id, predicted_at DESC);
CREATE INDEX idx_ml_pred_outcome ON los_core.ml_prediction_log (actual_outcome, outcome_date) WHERE actual_outcome IS NOT NULL;

-- ================================================================
-- TABLE: rule_definitions (47 configurable rules)
-- ================================================================
CREATE TYPE rule_category AS ENUM (
    'CREDIT_SCORE','FOIR','INCOME','AGE','AMOUNT_TENURE',
    'BUREAU_HISTORY','FRAUD','EMPLOYMENT','LTV','PRODUCT_POLICY',
    'LEGAL','DEDUPLICATION','CHANNEL'
);
CREATE TYPE rule_severity AS ENUM ('HARD_STOP','SOFT_STOP','WARNING','INFO');

CREATE TABLE los_core.rule_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category rule_category NOT NULL,
    severity rule_severity NOT NULL DEFAULT 'WARNING',
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    priority INT NOT NULL DEFAULT 50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    loan_types JSONB,
    channels JSONB,
    conditions JSONB NOT NULL DEFAULT '[]',
    then_clause JSONB NOT NULL,
    product_overrides JSONB,
    skip_conditions JSONB,
    created_by UUID REFERENCES los_core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rules_category_active ON los_core.rule_definitions (category, is_active);
CREATE INDEX idx_rules_priority ON los_core.rule_definitions (priority);
CREATE INDEX idx_rules_effective ON los_core.rule_definitions (effective_from, effective_to) WHERE effective_to IS NOT NULL;

CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON los_core.rule_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON los_core.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_updated_at BEFORE UPDATE ON los_core.kyc_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_docs_updated_at BEFORE UPDATE ON los_core.documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON los_core.loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_updated_at BEFORE UPDATE ON los_core.loan_product_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bureau_jobs_updated_at BEFORE UPDATE ON los_core.bureau_pull_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bureau_reports_updated_at BEFORE UPDATE ON los_core.bureau_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disbursements_updated_at BEFORE UPDATE ON los_core.disbursements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nach_updated_at BEFORE UPDATE ON los_core.nach_mandates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON los_core.notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Application number sequence generator
CREATE SEQUENCE los_application_seq START WITH 1;

-- Function to generate application number
CREATE OR REPLACE FUNCTION generate_application_number(
    p_state VARCHAR(4),
    p_loan_type VARCHAR(30)
)
RETURNS VARCHAR(30) AS $$
DECLARE
    v_year VARCHAR(4);
    v_seq VARCHAR(6);
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := LPAD(NEXTVAL('los_application_seq')::TEXT, 6, '0');
    RETURN 'LOS-' || v_year || '-' || p_state || '-' || v_seq;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ROW LEVEL SECURITY (Enable in production)
-- ================================================================
-- ALTER TABLE los_core.loan_applications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE los_core.audit_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE los_core.loans ENABLE ROW LEVEL SECURITY;

-- RLS Policies (example for applications)
-- CREATE POLICY loan_officer_branch_policy ON los_core.loan_applications
--     FOR ALL TO loan_officer_role
--     USING (branch_code = current_setting('app.current_branch_code', true));

-- ================================================================
-- SEED DATA: Loan Product Configs
-- ================================================================
INSERT INTO los_core.loan_product_configs (product_code, loan_type, min_amount, max_amount, min_tenure_months, max_tenure_months, min_age, max_age, min_credit_score, max_foir, base_rate_bps, spread_bps, processing_fee_percent, mandatory_documents, is_active, effective_from) VALUES
('PL_SAL', 'PERSONAL_LOAN', 5000000, 2500000000, 12, 60, 21, 60, 700, 50.00, 850, 200, 1.00, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","SALARY_SLIP_1","SALARY_SLIP_2","SALARY_SLIP_3","BANK_STATEMENT_3M","SELFIE"}', true, '2024-01-01'),
('PL_SEP', 'PERSONAL_LOAN', 10000000, 1500000000, 12, 48, 21, 65, 650, 40.00, 950, 250, 2.00, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","ITR_1","BANK_STATEMENT_6M","GST_CERTIFICATE","SELFIE"}', true, '2024-01-01'),
('HL', 'HOME_LOAN', 100000000, 50000000000, 60, 360, 18, 70, 650, 50.00, 800, 150, 0.50, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","PROPERTY_PAPERS","SELFIE"}', true, '2024-01-01'),
('LAP', 'LAP', 50000000, 2000000000, 12, 180, 25, 65, 650, 55.00, 1000, 200, 1.00, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","PROPERTY_PAPERS","PROPERTY_VALUATION","SELFIE"}', true, '2024-01-01'),
('VL_2W', 'VEHICLE_LOAN_TWO_WHEELER', 3000000, 30000000, 12, 48, 18, 65, 650, 50.00, 850, 150, 2.00, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","SELFIE"}', true, '2024-01-01'),
('VL_4W', 'VEHICLE_LOAN_FOUR_WHEELER', 20000000, 3000000000, 12, 84, 21, 65, 650, 50.00, 850, 150, 1.50, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","SELFIE"}', true, '2024-01-01'),
('GL', 'GOLD_LOAN', 1000000, 2000000000, 6, 12, 18, 70, 0, 60.00, 700, 100, 1.00, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","SELFIE"}', true, '2024-01-01'),
('EL', 'EDUCATION_LOAN', 10000000, 7500000000, 60, 180, 16, 35, 0, 40.00, 750, 100, 0.50, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","SELFIE"}', true, '2024-01-01'),
('MSME_TL', 'MSME_TERM_LOAN', 50000000, 2000000000, 12, 84, 21, 65, 600, 50.00, 1000, 250, 1.50, '{"AADHAAR_FRONT","AADHAAR_BACK","BUSINESS_PAN","GST_CERTIFICATE","ITR_3","BANK_STATEMENT_12M","CA_BALANCE_SHEET","SELFIE"}', true, '2024-01-01'),
('MUDRA_K', 'MUDRA_KISHORE', 5000000, 100000000, 12, 60, 18, 65, 0, 50.00, 1200, 0, 0.00, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","BUSINESS_PAN","SELFIE"}', true, '2024-01-01'),
('MUDRA_T', 'MUDRA_TARUN', 10000000, 100000000, 12, 60, 21, 65, 0, 50.00, 1100, 0, 0.00, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","BUSINESS_PAN","ITR_1","SELFIE"}', true, '2024-01-01'),
('KCC', 'KISAN_CREDIT_CARD', 2500000, 30000000, 12, 12, 18, 75, 0, 50.00, 400, 0, 0.00, '{"AADHAAR_FRONT","AADHAAR_BACK","PAN_CARD","SELFIE"}', true, '2024-01-01');

-- Seed benchmark rates
INSERT INTO los_core.benchmark_rates (type, rate, effective_from, published_by) VALUES
('MCLR_1Y', 8.90, '2024-07-01', 'RBI'),
('MCLR_3M', 8.65, '2024-07-01', 'RBI'),
('REPO_RATE', 6.50, '2024-07-01', 'RBI'),
('T_BILL_91D', 6.75, '2024-07-01', 'RBI');

-- Seed rule definitions (47 rules)
INSERT INTO los_core.rule_definitions (rule_id, name, description, category, severity, version, priority, is_active, effective_from, then_clause) VALUES
-- CREDIT_SCORE
('CS_001', 'Minimum Credit Score', 'Applicant must meet minimum bureau credit score for the product', 'CREDIT_SCORE', 'HARD_STOP', '1.0', 1, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Credit score below minimum","rejectionCode":"CS_001"}'),
('CS_002', 'Top-Tier Credit Score', 'Score 800+ qualifies for best rates', 'CREDIT_SCORE', 'WARNING', '1.0', 2, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Consider best rate for score 800+"}'),
('CS_003', 'Credit Score Available', 'Bureau score must be pulled before decisioning', 'CREDIT_SCORE', 'HARD_STOP', '1.0', 1, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Credit score not found","rejectionCode":"CS_003"}'),
('CS_004', 'Sub-Prime Score Range', 'Score 550-649 in sub-prime range — manual review recommended', 'CREDIT_SCORE', 'WARNING', '1.0', 3, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Sub-prime score range — manual review"}'),
('CS_005', 'Score Drop Detection', 'Significant score drop from last pull indicates new credit issues', 'CREDIT_SCORE', 'WARNING', '1.0', 4, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Score drop detected"}'),
-- FOIR
('FOIR_001', 'Maximum FOIR Limit', 'Fixed obligations to income ratio must not exceed product maximum', 'FOIR', 'HARD_STOP', '1.0', 5, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"FOIR exceeds maximum","rejectionCode":"FOIR_001"}'),
('FOIR_002', 'FOIR Near Maximum', 'FOIR >75% of max — flag for amount/tenure adjustment', 'FOIR', 'WARNING', '1.0', 6, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"FOIR near maximum — consider reducing amount"}'),
('FOIR_003', 'Proposed EMI within FOIR', 'Total EMI including proposed loan must be within FOIR limit', 'FOIR', 'HARD_STOP', '1.0', 5, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Proposed EMI exceeds FOIR","rejectionCode":"FOIR_003"}'),
('FOIR_004', 'Net Income After Obligations', 'Minimum ₹5,000 must remain after all EMIs', 'FOIR', 'HARD_STOP', '1.0', 5, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Net income after EMI too low","rejectionCode":"FOIR_004"}'),
-- INCOME
('INC_001', 'Minimum Income', 'Net monthly income must meet minimum threshold', 'INCOME', 'HARD_STOP', '1.0', 5, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Income below minimum","rejectionCode":"INC_001"}'),
('INC_002', 'Income Disclosed', 'Income details must be provided before decisioning', 'INCOME', 'HARD_STOP', '1.0', 4, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Income not disclosed","rejectionCode":"INC_002"}'),
('INC_003', 'EMI to Gross Ratio', 'Existing EMI must not exceed 50% of gross monthly income', 'INCOME', 'HARD_STOP', '1.0', 6, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"EMI-to-gross ratio exceeds 50%","rejectionCode":"INC_003"}'),
('INC_004', 'Salary Account with Bank', 'Informational check for salary account relationship', 'INCOME', 'INFO', '1.0', 99, true, '2024-01-01', '{"outcome":"PASS","outcomeMessage":"Salary account check informational"}'),
-- AGE
('AGE_001', 'Age at Maturity', 'Applicant age at loan maturity must not exceed maximum', 'AGE', 'HARD_STOP', '1.0', 3, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Age at maturity exceeds maximum","rejectionCode":"AGE_001"}'),
('AGE_002', 'Minimum Age', 'Applicant must meet minimum age requirement', 'AGE', 'HARD_STOP', '1.0', 3, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Below minimum age","rejectionCode":"AGE_002"}'),
('AGE_003', 'Age at Disbursement', 'Flag applications where applicant is near retirement at disbursement', 'AGE', 'WARNING', '1.0', 50, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Near retirement at disbursement"}'),
('AGE_004', 'Senior Citizen', 'Applicants 60+ may require co-borrower or insurance', 'AGE', 'WARNING', '1.0', 50, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Senior citizen — co-borrower or insurance may be required"}'),
-- AMOUNT_TENURE
('AMT_001', 'Amount Within Product Limits', 'Requested amount must be within min/max for the product', 'AMOUNT_TENURE', 'HARD_STOP', '1.0', 2, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Amount outside product limits","rejectionCode":"AMT_001"}'),
('AMT_002', 'Amount Within Eligibility', 'Requested amount should not exceed calculated eligibility', 'AMOUNT_TENURE', 'WARNING', '1.0', 10, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Amount exceeds eligibility"}'),
('AMT_003', 'Minimum Amount Threshold', 'Loan amount must meet minimum threshold for operational feasibility', 'AMOUNT_TENURE', 'WARNING', '1.0', 20, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Below minimum loan amount"}'),
('TEN_001', 'Tenure Within Product Limits', 'Requested tenure must be within min/max for the product', 'AMOUNT_TENURE', 'WARNING', '1.0', 10, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Tenure outside product limits"}'),
('TEN_002', 'Tenure for Age 58+', 'Reduced tenure recommended for older applicants', 'AMOUNT_TENURE', 'WARNING', '1.0', 30, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Tenure may be restricted for older applicants"}'),
-- BUREAU_HISTORY
('DPD_001', 'No 90+ DPD', 'No 90+ days past due in last 24 months', 'BUREAU_HISTORY', 'HARD_STOP', '1.0', 2, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"90+ DPD found — hard stop","rejectionCode":"DPD_001"}'),
('DPD_002', 'No 60+ DPD', 'No 60+ days past due — warning for borderline profiles', 'BUREAU_HISTORY', 'WARNING', '1.0', 15, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"60+ DPD found"}'),
('DPD_003', 'DPD Trend Worsening', 'Worsening delinquency trend — 30 to 60 day bucket', 'BUREAU_HISTORY', 'WARNING', '1.0', 16, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"DPD trend worsening"}'),
('BUR_001', 'Active Bureau Account', 'At least one active account for credit behaviour assessment', 'BUREAU_HISTORY', 'WARNING', '1.0', 20, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"No active accounts — cannot assess credit behaviour"}'),
('BUR_002', 'Account Count Limit', 'Too many total accounts indicates over-indebtedness', 'BUREAU_HISTORY', 'WARNING', '1.0', 25, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"High account count — over-indebtedness risk"}'),
('BUR_003', 'Recent Account Opening', 'Many recently opened accounts may indicate credit chasing', 'BUREAU_HISTORY', 'WARNING', '1.0', 25, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Too many recently opened accounts"}'),
('ENQ_001', 'Enquiry Velocity', 'Enquiries in last 90 days must not exceed threshold', 'BUREAU_HISTORY', 'WARNING', '1.0', 15, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"High enquiry velocity"}'),
-- FRAUD
('FRD_001', 'No Fraud Flags', 'No fraud, suit filed, or wilful defaulter flags in bureau', 'FRAUD', 'HARD_STOP', '1.0', 1, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Fraud/suit/defaulter flag detected","rejectionCode":"FRD_001"}'),
('FRD_002', 'No Suit Filed', 'Suit filed accounts are an absolute disqualifier', 'FRAUD', 'HARD_STOP', '1.0', 1, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Suit filed — hard stop","rejectionCode":"FRD_002"}'),
('FRD_003', 'Not Wilful Defaulter', 'Wilful defaulter listing is an absolute disqualifier', 'FRAUD', 'HARD_STOP', '1.0', 1, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Wilful defaulter — hard stop","rejectionCode":"FRD_003"}'),
('FRD_004', 'No Disputed Accounts', 'Disputed accounts require manual review', 'FRAUD', 'WARNING', '1.0', 30, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Disputed account found"}'),
-- EMPLOYMENT
('EMP_001', 'Employment Type Allowed', 'Employment type must be allowed for the product', 'EMPLOYMENT', 'WARNING', '1.0', 10, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Employment type may not be eligible"}'),
('EMP_002', 'Minimum Employment Tenure', 'Minimum 3 months employment with current employer', 'EMPLOYMENT', 'WARNING', '1.0', 20, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Short employment tenure"}'),
('EMP_003', 'Company Category', 'Employer company must not be in restricted list', 'EMPLOYMENT', 'WARNING', '1.0', 20, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Elevated risk company category"}'),
-- LTV
('LTV_001', 'LTV Within Limits', 'Loan to value ratio must not exceed product maximum (secured loans only)', 'LTV', 'HARD_STOP', '1.0', 4, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"LTV exceeds maximum","rejectionCode":"LTV_001"}'),
('LTV_002', 'LTV Near Maximum', 'LTV >85% of max — flag for additional collateral', 'LTV', 'WARNING', '1.0', 15, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"LTV near maximum — consider additional collateral"}'),
('LTV_003', 'Collateral Value Sufficient', 'Collateral must be at least 50% of loan amount', 'LTV', 'HARD_STOP', '1.0', 4, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Collateral value insufficient","rejectionCode":"LTV_003"}'),
-- PRODUCT_POLICY
('POL_001', 'GST Compliance for Business Loans', 'Business loans require GST registration check', 'PRODUCT_POLICY', 'INFO', '1.0', 60, true, '2024-01-01', '{"outcome":"PASS","outcomeMessage":"GST check informational"}'),
('POL_002', 'NOC Required for Top-Up', 'Top-up loans require NOC from existing lender', 'PRODUCT_POLICY', 'INFO', '1.0', 60, true, '2024-01-01', '{"outcome":"PASS","outcomeMessage":"Top-up NOC check informational"}'),
('POL_003', 'Processing Fee Cap', 'Processing fee must be within RBI guidelines (<=5%)', 'PRODUCT_POLICY', 'WARNING', '1.0', 60, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Processing fee exceeds RBI guideline"}'),
-- LEGAL
('LEG_001', 'No CIBIL Rejection History', 'Multiple previous rejections warrant manual review', 'LEGAL', 'WARNING', '1.0', 20, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Previous CIBIL rejections found"}'),
('LEG_002', 'Not in RBI Defaulter Database', 'Applicant must not be in RBI defaulter/SARFAESI list', 'LEGAL', 'HARD_STOP', '1.0', 1, true, '2024-01-01', '{"outcome":"FAIL","outcomeMessage":"Found in RBI defaulter database","rejectionCode":"LEG_002"}'),
('LEG_003', 'RTGS/NEFT Compliance', 'Loan amount must comply with RTGS/NEFT threshold limits', 'LEGAL', 'INFO', '1.0', 60, true, '2024-01-01', '{"outcome":"PASS","outcomeMessage":"RTGS/NEFT compliance check"}'),
-- DEDUPLICATION
('DEDUP_001', 'No Active Duplicate Application', 'No active application from same applicant in last 30 days', 'DEDUPLICATION', 'WARNING', '1.0', 30, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"Duplicate active application found"}'),
-- CHANNEL
('CH_001', 'DSA Channel Product Restrictions', 'Certain products restricted for DSA channel', 'CHANNEL', 'WARNING', '1.0', 30, true, '2024-01-01', '{"outcome":"WARN","outcomeMessage":"DSA channel restricted for this product"}');

-- Seed notification templates
INSERT INTO los_core.notification_templates (template_name, display_name, category, channel, subject, body, variables, is_active, priority) VALUES
('OTP_LOGIN', 'OTP Login Verification', 'OTP', 'SMS', NULL, 'Your LOS Bank OTP is {{otpCode}}. Valid for 5 minutes. Do not share.', '[{"name":"otpCode","type":"string","required":true,"example":"123456","maxLength":6}]', true, 'HIGH'),
('OTP_WHATSAPP', 'OTP Login Verification (WhatsApp)', 'OTP', 'WHATSAPP', NULL, 'Your LOS Bank OTP is {{otpCode}}. Valid for 5 minutes. Do not share.', '[{"name":"otpCode","type":"string","required":true}]', true, 'HIGH'),
('APP_SUBMITTED', 'Application Submitted', 'APPLICATION_STATUS', 'SMS', NULL, 'Dear {{customerName}}, your loan application {{applicationNumber}} has been submitted successfully. Track at {{trackingUrl}}', '[{"name":"customerName","type":"string","required":true},{"name":"applicationNumber","type":"string","required":true},{"name":"trackingUrl","type":"link","required":true}]', true, 'NORMAL'),
('APP_SUBMITTED_EMAIL', 'Application Submitted', 'APPLICATION_STATUS', 'EMAIL', 'Loan Application Submitted - LOS Bank', 'Dear {{customerName}},<p>Your loan application <strong>{{applicationNumber}}</strong> has been submitted successfully.</p><p>Loan Type: {{loanType}}<br>Amount: {{currency requestedAmount}}</p><p>Track at: <a href="{{trackingUrl}}">{{trackingUrl}}</a></p>', '[{"name":"customerName","type":"string","required":true},{"name":"applicationNumber","type":"string","required":true},{"name":"loanType","type":"string","required":true},{"name":"requestedAmount","type":"currency","required":true},{"name":"trackingUrl","type":"link","required":true}]', true, 'NORMAL'),
('KYC_PENDING', 'KYC Pending Reminder', 'KYC_UPDATE', 'SMS', NULL, 'Dear {{customerName}}, please complete your KYC verification for application {{applicationNumber}}. Incomplete KYC may delay processing.', '[{"name":"customerName","type":"string","required":true},{"name":"applicationNumber","type":"string","required":true}]', true, 'NORMAL'),
('DOCUMENT_PENDING', 'Document Upload Reminder', 'DOCUMENT_REMINDER', 'SMS', NULL, 'Dear {{customerName}}, {{missingDocuments}} documents are pending for application {{applicationNumber}}. Upload now at {{uploadUrl}}', '[{"name":"customerName","type":"string","required":true},{"name":"missingDocuments","type":"string","required":true},{"name":"applicationNumber","type":"string","required":true},{"name":"uploadUrl","type":"link","required":true}]', true, 'NORMAL'),
('DECISION_APPROVED', 'Loan Approved', 'DECISION', 'SMS', NULL, 'Congratulations {{customerName}}! Your loan {{applicationNumber}} has been approved for {{currency sanctionedAmount}} at {{rateOfInterest}}% p.a. Valid for 30 days.', '[{"name":"customerName","type":"string","required":true},{"name":"applicationNumber","type":"string","required":true},{"name":"sanctionedAmount","type":"currency","required":true},{"name":"rateOfInterest","type":"number","required":true}]', true, 'URGENT'),
('DECISION_REJECTED', 'Loan Rejected', 'DECISION', 'SMS', NULL, 'Dear {{customerName}}, your loan application {{applicationNumber}} has been declined. For queries, call our helpline.', '[{"name":"customerName","type":"string","required":true},{"name":"applicationNumber","type":"string","required":true}]', true, 'NORMAL'),
('SANCTION_LETTER', 'Sanction Letter', 'SANCTION', 'EMAIL', 'Sanction Letter - LOS Bank', 'Dear {{customerName}},<p>Please find attached the sanction letter for your loan application <strong>{{applicationNumber}}</strong>.</p><p>Sanctioned Amount: <strong>{{currency sanctionedAmount}}</strong><br>Rate of Interest: <strong>{{rateOfInterest}}% p.a.</strong><br>Tenure: <strong>{{tenureMonths}} months</strong></p>', '[{"name":"customerName","type":"string","required":true},{"name":"applicationNumber","type":"string","required":true},{"name":"sanctionedAmount","type":"currency","required":true},{"name":"rateOfInterest","type":"number","required":true},{"name":"tenureMonths","type":"number","required":true}]', true, 'HIGH'),
('DISBURSEMENT_SUCCESS', 'Disbursement Confirmation', 'DISBURSEMENT', 'SMS', NULL, 'Dear {{customerName}}, Rs.{{currency disbursedAmount}} has been credited to your account {{accountNumber}} via UTR {{utrNumber}} on {{disbursedDate}}.', '[{"name":"customerName","type":"string","required":true},{"name":"disbursedAmount","type":"currency","required":true},{"name":"accountNumber","type":"string","required":true,"maxLength":4},{"name":"utrNumber","type":"string","required":true},{"name":"disbursedDate","type":"date","required":true}]', true, 'URGENT'),
('EMI_REMINDER_3D', 'EMI Reminder 3 Days', 'EMI_REMINDER', 'SMS', NULL, 'Dear {{customerName}}, EMI of Rs.{{currency emiAmount}} for loan {{loanAccountNumber}} is due on {{dueDate}}. Auto-debit enabled.', '[{"name":"customerName","type":"string","required":true},{"name":"emiAmount","type":"currency","required":true},{"name":"loanAccountNumber","type":"string","required":true},{"name":"dueDate","type":"date","required":true}]', true, 'NORMAL'),
('EMI_REMINDER_DUE', 'EMI Due Today', 'EMI_REMINDER', 'SMS', NULL, 'Dear {{customerName}}, EMI of Rs.{{currency emiAmount}} for loan {{loanAccountNumber}} is due today. Please ensure sufficient balance.', '[{"name":"customerName","type":"string","required":true},{"name":"emiAmount","type":"currency","required":true},{"name":"loanAccountNumber","type":"string","required":true}]', true, 'HIGH'),
('PAYMENT_CONFIRMATION', 'Payment Received', 'PAYMENT_CONFIRMATION', 'SMS', NULL, 'Dear {{customerName}}, we have received Rs.{{currency amount}} towards loan {{loanAccountNumber}}. Remaining balance: Rs.{{currency remainingAmount}}.', '[{"name":"customerName","type":"string","required":true},{"name":"amount","type":"currency","required":true},{"name":"loanAccountNumber","type":"string","required":true},{"name":"remainingAmount","type":"currency","required":true}]', true, 'NORMAL');

-- ================================================================
-- DSA Portal Tables
-- ================================================================
CREATE TABLE los_core.dsa_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_code VARCHAR(20) NOT NULL UNIQUE,
    partner_name VARCHAR(200) NOT NULL,
    partner_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL',
    pan_hash CHAR(64) NOT NULL,
    pan_enc BYTEA NOT NULL,
    gstin VARCHAR(15),
    gstin_hash CHAR(64),
    registered_address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(4) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    contact_name VARCHAR(200) NOT NULL,
    contact_mobile VARCHAR(10) NOT NULL,
    contact_email VARCHAR(254) NOT NULL,
    primary_bank_account VARCHAR(30) NOT NULL,
    primary_ifsc VARCHAR(11) NOT NULL,
    bank_account_holder VARCHAR(200) NOT NULL,
    password_hash CHAR(64),
    commission_type VARCHAR(20) NOT NULL DEFAULT 'HYBRID',
    upfront_commission_bps INT DEFAULT 0,
    trail_commission_bps INT DEFAULT 0,
    payout_frequency VARCHAR(20) DEFAULT 'MONTHLY',
    min_loan_amount BIGINT DEFAULT 0,
    max_loan_amount BIGINT DEFAULT 0,
    territory_codes JSONB,
    allowed_products JSONB,
    agreement_doc_key VARCHAR(500),
    agreement_signed_at TIMESTAMPTZ,
    agreement_valid_from DATE,
    agreement_valid_to DATE,
    total_disbursed_amount BIGINT DEFAULT 0,
    total_applications INT DEFAULT 0,
    total_disbursements INT DEFAULT 0,
    total_commission_paid BIGINT DEFAULT 0,
    rejected_by UUID,
    rejection_reason TEXT,
    suspension_reason TEXT,
    remarks TEXT,
    onboarding_officer_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_dsa_partners_partner_code ON los_core.dsa_partners(partner_code);
CREATE UNIQUE INDEX idx_dsa_partners_pan_hash ON los_core.dsa_partners(pan_hash);
CREATE INDEX idx_dsa_partners_status_created ON los_core.dsa_partners(status, created_at);
COMMENT ON TABLE los_core.dsa_partners IS 'DSA Partner entities - banks channel partners who source loan applications';

CREATE TABLE los_core.dsa_officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES los_core.dsa_partners(id),
    employee_code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    mobile_hash CHAR(64) NOT NULL,
    mobile_enc BYTEA NOT NULL,
    email_hash CHAR(64) NOT NULL,
    email_enc BYTEA,
    password_hash CHAR(64),
    designation VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    reporting_manager_id UUID,
    territory_codes JSONB,
    allowed_products JSONB,
    max_sanction_authority BIGINT DEFAULT 0,
    total_applications INT DEFAULT 0,
    total_disbursements INT DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_dsa_officers_employee_code ON los_core.dsa_officers(employee_code);
CREATE INDEX idx_dsa_officers_partner_status ON los_core.dsa_officers(partner_id, status);
CREATE INDEX idx_dsa_officers_mobile_hash ON los_core.dsa_officers(mobile_hash);
COMMENT ON TABLE los_core.dsa_officers IS 'DSA Sales Officers - employees of DSA partners who create applications';

CREATE TABLE los_core.dsa_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(30) NOT NULL UNIQUE,
    loan_application_id UUID,
    partner_id UUID NOT NULL REFERENCES los_core.dsa_partners(id),
    officer_id UUID NOT NULL REFERENCES los_core.dsa_officers(id),
    customer_name VARCHAR(200) NOT NULL,
    customer_mobile_hash CHAR(64) NOT NULL,
    customer_pan_hash CHAR(64),
    loan_type VARCHAR(30) NOT NULL,
    requested_amount BIGINT NOT NULL,
    requested_tenure_months SMALLINT NOT NULL,
    status VARCHAR(30) DEFAULT 'SUBMITTED',
    branch_code VARCHAR(10),
    assigned_officer_id UUID,
    source_lead_id VARCHAR(50),
    utm_source VARCHAR(50),
    utm_medium VARCHAR(50),
    utm_campaign VARCHAR(50),
    remarks TEXT,
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_dsa_applications_number ON los_core.dsa_applications(application_number);
CREATE INDEX idx_dsa_applications_partner_status ON los_core.dsa_applications(partner_id, status);
CREATE INDEX idx_dsa_applications_officer ON los_core.dsa_applications(officer_id);
CREATE INDEX idx_dsa_applications_created ON los_core.dsa_applications(created_at);
CREATE INDEX idx_dsa_applications_customer_mobile ON los_core.dsa_applications(customer_mobile_hash);
COMMENT ON TABLE los_core.dsa_applications IS 'Applications sourced by DSA partners on behalf of customers';

CREATE TABLE los_core.dsa_commission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES los_core.dsa_partners(id),
    officer_id UUID,
    application_id UUID NOT NULL REFERENCES los_core.dsa_applications(id),
    loan_application_id UUID,
    loan_type VARCHAR(30) NOT NULL,
    disbursed_amount BIGINT NOT NULL,
    commission_type VARCHAR(20) NOT NULL,
    commission_rate_bps INT NOT NULL,
    commission_amount BIGINT NOT NULL,
    gst_amount BIGINT DEFAULT 0,
    tds_amount BIGINT DEFAULT 0,
    net_payable BIGINT NOT NULL,
    disbursement_date DATE NOT NULL,
    payout_month VARCHAR(7) NOT NULL,
    status VARCHAR(20) DEFAULT 'EARNED',
    processed_at TIMESTAMPTZ,
    processed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dsa_commission_partner_payout ON los_core.dsa_commission(partner_id, payout_month);
CREATE INDEX idx_dsa_commission_application ON los_core.dsa_commission(application_id);
CREATE INDEX idx_dsa_commission_status_created ON los_core.dsa_commission(status, created_at);
COMMENT ON TABLE los_core.dsa_commission IS 'Commission earned by DSA partners on disbursed loans';

-- DSA Trigger for updated_at
CREATE OR REPLACE FUNCTION los_core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dsa_partners_updated_at
    BEFORE UPDATE ON los_core.dsa_partners
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

CREATE TRIGGER trg_dsa_officers_updated_at
    BEFORE UPDATE ON los_core.dsa_officers
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

CREATE TRIGGER trg_dsa_applications_updated_at
    BEFORE UPDATE ON los_core.dsa_applications
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

-- ================================================================
-- Interest Rate Configuration Tables
-- ================================================================
CREATE TABLE los_core.interest_rate_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code VARCHAR(20) NOT NULL,
    benchmark_type VARCHAR(15) NOT NULL DEFAULT 'MCLR_1Y',
    interest_rate_type VARCHAR(10) NOT NULL DEFAULT 'FLOATING',
    min_rate_bps SMALLINT NOT NULL,
    max_rate_bps SMALLINT NOT NULL,
    default_spread_bps SMALLINT NOT NULL,
    tenure_spread_bands JSONB,
    credit_grade_spreads JSONB,
    employment_adjustments_bps JSONB,
    employer_risk_premium_bps JSONB,
    amount_risk_thresholds JSONB,
    roi_preview_table JSONB,
    is_active BOOLEAN DEFAULT true,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT benchmark_type_chk CHECK (benchmark_type IN ('MCLR_1Y','MCLR_3M','REPO_RATE','T_BILL_91D','BASE_RATE'))
);
CREATE INDEX idx_rate_config_product_active ON los_core.interest_rate_configs(product_code, is_active);
CREATE INDEX idx_rate_config_effective ON los_core.interest_rate_configs(effective_from);
COMMENT ON TABLE los_core.interest_rate_configs IS 'Interest rate configuration per product: benchmark type, min/max rates, tenure bands, credit grade spreads, employment adjustments';

CREATE TABLE los_core.rate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    product_code VARCHAR(20) NOT NULL,
    credit_grade VARCHAR(5) NOT NULL,
    approved_amount BIGINT NOT NULL,
    tenure_months SMALLINT NOT NULL,
    benchmark_type VARCHAR(15) NOT NULL,
    benchmark_rate NUMERIC(10,4) NOT NULL,
    total_spread_bps SMALLINT NOT NULL,
    final_rate_bps SMALLINT NOT NULL,
    final_rate_percent NUMERIC(6,4) NOT NULL,
    is_rate_capped BOOLEAN DEFAULT false,
    calculation_breakdown JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rate_history_application ON los_core.rate_history(application_id);
CREATE INDEX idx_rate_history_product_date ON los_core.rate_history(product_code, created_at);
COMMENT ON TABLE los_core.rate_history IS 'Audit trail of all interest rate calculations per application';

-- ================================================================
-- Sanction Letter Table
-- ================================================================
CREATE TABLE los_core.sanction_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    application_number VARCHAR(30) NOT NULL,
    loan_account_number VARCHAR(30),
    sanctioned_amount BIGINT NOT NULL,
    rate_of_interest_bps SMALLINT NOT NULL,
    tenure_months SMALLINT NOT NULL,
    emi_amount BIGINT NOT NULL,
    processing_fee BIGINT NOT NULL,
    insurance_premium BIGINT,
    sanction_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    first_emi_date DATE NOT NULL,
    last_emi_date DATE NOT NULL,
    pdf_doc_key VARCHAR(500),
    pdf_generated_at TIMESTAMPTZ,
    signed_doc_key VARCHAR(500),
    signed_at TIMESTAMPTZ,
    esign_provider VARCHAR(30),
    esign_transaction_id VARCHAR(100),
    borrower_signed_at TIMESTAMPTZ,
    bank_signed_at TIMESTAMPTZ,
    bank_signatory_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'GENERATED',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_sanction_application ON los_core.sanction_letters(application_id);
CREATE INDEX idx_sanction_status ON los_core.sanction_letters(status, created_at);
COMMENT ON TABLE los_core.sanction_letters IS 'Sanction letter records with PDF storage and eSign tracking';

CREATE TRIGGER trg_sanction_letters_updated_at
    BEFORE UPDATE ON los_core.sanction_letters
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

-- ================================================================
-- Seed Interest Rate Configurations
-- ================================================================
INSERT INTO los_core.interest_rate_configs
(product_code, benchmark_type, interest_rate_type, min_rate_bps, max_rate_bps, default_spread_bps, tenure_spread_bands, credit_grade_spreads, employment_adjustments_bps, amount_risk_thresholds, is_active, effective_from)
VALUES
(
  'PL',
  'MCLR_1Y',
  'FLOATING',
  850,
  2200,
  400,
  '[{"minTenureMonths":1,"maxTenureMonths":12,"benchmarkType":"MCLR_1Y","additionalSpreadBps":25,"description":"Short tenure: +0.25% premium"},{"minTenureMonths":13,"maxTenureMonths":36,"benchmarkType":"MCLR_1Y","additionalSpreadBps":0,"description":"Mid tenure: base spread"},{"minTenureMonths":37,"maxTenureMonths":60,"benchmarkType":"MCLR_1Y","additionalSpreadBps":-10,"description":"Long tenure: -0.10% discount"},{"minTenureMonths":61,"maxTenureMonths":84,"benchmarkType":"MCLR_1Y","additionalSpreadBps":-20,"description":"Extended: -0.20% discount"}]',
  '[{"grade":"A+","minSpreadBps":225,"maxSpreadBps":275,"description":"A+ grade: best rates"},{"grade":"A","minSpreadBps":300,"maxSpreadBps":350,"description":"A grade"},{"grade":"B+","minSpreadBps":400,"maxSpreadBps":450,"description":"B+ grade"},{"grade":"B","minSpreadBps":475,"maxSpreadBps":525,"description":"B grade"},{"grade":"C","minSpreadBps":575,"maxSpreadBps":650,"description":"C grade: sub-prime"},{"grade":"D","minSpreadBps":700,"maxSpreadBps":800,"description":"D grade: high risk"},{"grade":"F","minSpreadBps":900,"maxSpreadBps":1350,"description":"F grade: near-reject"}]',
  '{"SALARIED":-25,"SELF_EMPLOYED":25,"AGRICULTURALIST":0,"PENSIONER":10}',
  '[{"minAmount":0,"maxAmount":5000000,"additionalBps":0},{"minAmount":5000001,"maxAmount":10000000,"additionalBps":5},{"minAmount":10000001,"maxAmount":20000000,"additionalBps":15},{"minAmount":20000001,"maxAmount":50000000,"additionalBps":25}]',
  true,
  '2024-07-01'
),
(
  'BL',
  'MCLR_1Y',
  'FLOATING',
  1050,
  2400,
  575,
  '[{"minTenureMonths":1,"maxTenureMonths":24,"benchmarkType":"MCLR_1Y","additionalSpreadBps":30,"description":"1-24 months: +0.30%"},{"minTenureMonths":25,"maxTenureMonths":60,"benchmarkType":"MCLR_1Y","additionalSpreadBps":0,"description":"25-60 months: base"},{"minTenureMonths":61,"maxTenureMonths":120,"benchmarkType":"MCLR_1Y","additionalSpreadBps":-15,"description":"61-120 months: -0.15%"}]',
  '[{"grade":"A+","minSpreadBps":450,"maxSpreadBps":525,"description":"A+"},{"grade":"A","minSpreadBps":550,"maxSpreadBps":625,"description":"A"},{"grade":"B+","minSpreadBps":650,"maxSpreadBps":725,"description":"B+"},{"grade":"B","minSpreadBps":750,"maxSpreadBps":825,"description":"B"},{"grade":"C","minSpreadBps":875,"maxSpreadBps":1000,"description":"C"},{"grade":"D","minSpreadBps":1050,"maxSpreadBps":1250,"description":"D"},{"grade":"F","minSpreadBps":1350,"maxSpreadBps":1650,"description":"F"}]',
  '{"SALARIED":-35,"SELF_EMPLOYED":30,"AGRICULTURALIST":10,"PENSIONER":20}',
  '[{"minAmount":0,"maxAmount":10000000,"additionalBps":0},{"minAmount":10000001,"maxAmount":25000000,"additionalBps":10},{"minAmount":25000001,"maxAmount":50000000,"additionalBps":20}]',
  true,
  '2024-07-01'
),
(
  'HL',
  'MCLR_1Y',
  'FLOATING',
  775,
  1200,
  125,
  '[{"minTenureMonths":1,"maxTenureMonths":60,"benchmarkType":"MCLR_1Y","additionalSpreadBps":0,"description":"<=5 years: base"},{"minTenureMonths":61,"maxTenureMonths":180,"benchmarkType":"MCLR_1Y","additionalSpreadBps":-5,"description":"5-15 years: -0.05%"},{"minTenureMonths":181,"maxTenureMonths":360,"benchmarkType":"MCLR_1Y","additionalSpreadBps":-10,"description":"15-30 years: -0.10%"}]',
  '[{"grade":"A+","minSpreadBps":100,"maxSpreadBps":125,"description":"A+"},{"grade":"A","minSpreadBps":150,"maxSpreadBps":175,"description":"A"},{"grade":"B+","minSpreadBps":200,"maxSpreadBps":225,"description":"B+"},{"grade":"B","minSpreadBps":250,"maxSpreadBps":275,"description":"B"},{"grade":"C","minSpreadBps":300,"maxSpreadBps":350,"description":"C"},{"grade":"D","minSpreadBps":375,"maxSpreadBps":450,"description":"D"},{"grade":"F","minSpreadBps":500,"maxSpreadBps":650,"description":"F"}]',
  '{"SALARIED":-15,"SELF_EMPLOYED":15,"AGRICULTURALIST":5,"PENSIONER":10}',
  '[{"minAmount":0,"maxAmount":30000000,"additionalBps":0},{"minAmount":30000001,"maxAmount":100000000,"additionalBps":5}]',
  true,
  '2024-07-01'
),
(
  'EL',
  'MCLR_1Y',
  'FLOATING',
  975,
  2000,
  350,
  '[{"minTenureMonths":1,"maxTenureMonths":36,"benchmarkType":"MCLR_1Y","additionalSpreadBps":15,"description":"1-36 months: +0.15%"},{"minTenureMonths":37,"maxTenureMonths":72,"benchmarkType":"MCLR_1Y","additionalSpreadBps":0,"description":"37-72 months: base"}]',
  '[{"grade":"A+","minSpreadBps":300,"maxSpreadBps":350,"description":"A+"},{"grade":"A","minSpreadBps":375,"maxSpreadBps":425,"description":"A"},{"grade":"B+","minSpreadBps":450,"maxSpreadBps":500,"description":"B+"},{"grade":"B","minSpreadBps":525,"maxSpreadBps":575,"description":"B"},{"grade":"C","minSpreadBps":625,"maxSpreadBps":700,"description":"C"},{"grade":"D","minSpreadBps":750,"maxSpreadBps":875,"description":"D"},{"grade":"F","minSpreadBps":950,"maxSpreadBps":1150,"description":"F"}]',
  '{"SALARIED":-20,"SELF_EMPLOYED":20,"AGRICULTURALIST":5,"PENSIONER":15}',
  '[{"minAmount":0,"maxAmount":5000000,"additionalBps":0},{"minAmount":5000001,"maxAmount":15000000,"additionalBps":8}]',
  true,
  '2024-07-01'
);

-- Kafka Topics for DSA
-- los.dsa.partner.registered
-- los.dsa.partner.status_changed
-- los.dsa.officer.created
-- los.dsa.application.created
-- los.dsa.commission.earned
-- los.dsa.commission.paid

-- Rate calculation Kafka events
-- los.rate.calculated
-- los.sanction_letter.generated
-- los.sanction_letter.signed

-- ================================================================
-- Multi-Tranche Disbursement Tables
-- ================================================================
CREATE TYPE tranche_status AS ENUM ('PLANNED','SUBMITTED','APPROVED','PARTIALLY_DISBURSED','FULLY_DISBURSED','CANCELLED','EXPIRED');

CREATE TABLE los_core.disbursement_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    loan_account_id VARCHAR(30),
    total_sanctioned_amount DECIMAL(18,2) NOT NULL,
    total_planned_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_disbursed_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_tranches SMALLINT NOT NULL,
    max_tranches SMALLINT NOT NULL DEFAULT 10,
    first_tranche_min_percent DECIMAL(5,2) NOT NULL DEFAULT 10,
    subsequent_tranche_min_percent DECIMAL(5,2) NOT NULL DEFAULT 5,
    first_disbursement_min_amount DECIMAL(18,2) NOT NULL DEFAULT 100000,
    stage_release_percent DECIMAL(5,2),
    stage_name VARCHAR(100),
    project_type VARCHAR(50) NOT NULL DEFAULT 'CONSTRUCTION',
    expected_completion_months SMALLINT,
    plan_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    is_active BOOLEAN NOT NULL DEFAULT true,
    lock_version INT NOT NULL DEFAULT 1,
    remarks TEXT,
    prepared_by UUID,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_disbursement_plan_application ON los_core.disbursement_plans(application_id) WHERE is_active = true;
COMMENT ON TABLE los_core.disbursement_plans IS 'Disbursement plan for home loans/LAP with multi-tranche support (max 10 tranches)';

CREATE TABLE los_core.disbursement_tranches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    loan_account_id VARCHAR(30),
    tranche_number SMALLINT NOT NULL,
    tranche_code VARCHAR(30) NOT NULL,
    tranche_name VARCHAR(100) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    cumulative_disbursed DECIMAL(18,2) NOT NULL DEFAULT 0,
    cumulative_amount DECIMAL(18,2) NOT NULL,
    percentage_of_sanction DECIMAL(5,2) NOT NULL,
    milestone VARCHAR(50) NOT NULL,
    milestone_description TEXT,
    status tranche_status NOT NULL DEFAULT 'PLANNED',
    planned_date DATE NOT NULL,
    scheduled_date DATE,
    actual_disbursement_date DATE,
    latest_allowed_date DATE NOT NULL,
    benefit_description TEXT,
    required_documents JSONB,
    submitted_documents JSONB,
    documents_approved BOOLEAN NOT NULL DEFAULT false,
    inspection_required BOOLEAN NOT NULL DEFAULT false,
    inspection_report_key VARCHAR(500),
    inspection_conducted_at TIMESTAMPTZ,
    inspection_approved_by UUID,
    remarks TEXT,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejected_by UUID,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tranche_application ON los_core.disbursement_tranches(application_id);
CREATE INDEX idx_tranche_status ON los_core.disbursement_tranches(status);
CREATE INDEX idx_tranche_app_status ON los_core.disbursement_tranches(application_id, status);
COMMENT ON TABLE los_core.disbursement_tranches IS 'Individual tranches in a disbursement plan with milestone tracking and inspection support';

CREATE TABLE los_core.disbursement_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    tranche_id UUID NOT NULL,
    inspection_type VARCHAR(30) NOT NULL,
    inspection_date DATE NOT NULL,
    inspector_name VARCHAR(200) NOT NULL,
    inspector_agency VARCHAR(200),
    site_address TEXT NOT NULL,
    stage_of_construction VARCHAR(100) NOT NULL,
    completion_percent DECIMAL(5,2) NOT NULL,
    previous_completion_percent DECIMAL(5,2),
    stage_wise_progress JSONB,
    quality_observations TEXT,
    risk_flags JSONB,
    recommended_disbursement_percent DECIMAL(5,2) NOT NULL,
    recommended_amount DECIMAL(18,2) NOT NULL,
    inspection_report_key VARCHAR(500) NOT NULL,
    photos JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    approval_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inspection_tranche ON los_core.disbursement_inspections(tranche_id);
CREATE INDEX idx_inspection_application ON los_core.disbursement_inspections(application_id);
COMMENT ON TABLE los_core.disbursement_inspections IS 'Field inspection reports for construction-linked disbursements';

CREATE TRIGGER trg_disbursement_plans_updated_at
    BEFORE UPDATE ON los_core.disbursement_plans
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

CREATE TRIGGER trg_disbursement_tranches_updated_at
    BEFORE UPDATE ON los_core.disbursement_tranches
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

CREATE TRIGGER trg_disbursement_inspections_updated_at
    BEFORE UPDATE ON los_core.disbursement_inspections
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

-- Kafka Topics for Tranche Management
-- los.tranche.created
-- los.tranche.submitted
-- los.tranche.approved
-- los.tranche.rejected
-- los.tranche.disbursement_scheduled
-- los.tranche.disbursement_success
-- los.inspection.created
-- los.inspection.approved

-- ================================================================
-- TABLE: loan_agreements
-- ================================================================
CREATE TABLE los_core.loan_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES los_core.loan_applications(id),
    agreement_number VARCHAR(50) NOT NULL UNIQUE,
    document_key VARCHAR(500),
    document_hash CHAR(64),
    agreement_date DATE NOT NULL,
    loan_account_number VARCHAR(30),
    sanctioned_amount DECIMAL(18,2) NOT NULL,
    sanctioned_amount_words VARCHAR(500),
    rate_of_interest DECIMAL(6,3) NOT NULL,
    rate_of_interest_bps INT NOT NULL,
    tenure_months INT NOT NULL,
    emi_amount DECIMAL(18,2) NOT NULL,
    moratorium_period_months INT,
    moratorium_emi DECIMAL(18,2),
    processing_fee DECIMAL(18,2),
    first_emi_date DATE,
    last_emi_date DATE,
    disbursement_account VARCHAR(30),
    disbursement_ifsc VARCHAR(15),
    disbursement_bank VARCHAR(100),
    branch_name VARCHAR(200),
    branch_address TEXT,
    security_description TEXT,
    insurance_policy_number VARCHAR(50),
    insurance_premium DECIMAL(18,2),
    prepayment_penalty_clause TEXT,
    default_interest_rate DECIMAL(6,3),
    bounce_charge DECIMAL(18,2),
    part_payment_allowed BOOLEAN DEFAULT FALSE,
    part_payment_min_amount DECIMAL(18,2),
    part_payment_tenure_reduction BOOLEAN DEFAULT FALSE,
    foreclosure_allowed BOOLEAN DEFAULT FALSE,
    foreclosure_notice_period_days INT,
    foreclosure_penalty_percent DECIMAL(5,2),
    special_conditions JSONB,
    jurisdiction VARCHAR(200),
    witnessing_officer_name VARCHAR(200),
    witnessing_officer_designation VARCHAR(100),
    co_borrower_name VARCHAR(200),
    co_borrower_address TEXT,
    co_borrower_pan VARCHAR(20),
    guarantor_name VARCHAR(200),
    guarantor_address TEXT,
    guarantor_pan VARCHAR(20),
    version VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES los_core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT loan_agreements_status_chk CHECK (status IN (
        'DRAFT','PENDING_SIGNATURE','AWAITING_ESIGN','PARTIALLY_SIGNED','FULLY_SIGNED','EXECUTED','CANCELLED'
    ))
);
CREATE INDEX idx_loan_agreements_application ON los_core.loan_agreements(application_id);
CREATE INDEX idx_loan_agreements_agreement_number ON los_core.loan_agreements(agreement_number);
CREATE INDEX idx_loan_agreements_status ON los_core.loan_agreements(status);
COMMENT ON TABLE los_core.loan_agreements IS 'Loan agreements generated from sanctioned applications';

-- ================================================================
-- TABLE: loan_agreement_signatures
-- ================================================================
CREATE TABLE los_core.loan_agreement_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES los_core.loan_agreements(id),
    signer_type VARCHAR(30) NOT NULL,
    signer_name VARCHAR(200) NOT NULL,
    signer_mobile VARCHAR(15),
    signer_email VARCHAR(254),
    signer_role VARCHAR(30),
    esign_transaction_id VARCHAR(100),
    esign_provider VARCHAR(30),
    document_hash_before_sign CHAR(64),
    document_hash_after_sign CHAR(64),
    certificate_serial_number VARCHAR(100),
    certificate_valid_from TIMESTAMPTZ,
    certificate_valid_to TIMESTAMPTZ,
    signer_aadhaar_hash CHAR(64),
    consent_taken BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    consent_ip VARCHAR(45),
    signed_at TIMESTAMPTZ,
    signature_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    signed_document_key VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT signature_status_chk CHECK (signature_status IN (
        'PENDING','INITIATED','OTP_SENT','SIGNED','FAILED','EXPIRED','CANCELLED'
    ))
);
CREATE INDEX idx_agreement_signatures_agreement ON los_core.loan_agreement_signatures(agreement_id);
CREATE INDEX idx_agreement_signatures_transaction ON los_core.loan_agreement_signatures(esign_transaction_id);
COMMENT ON TABLE los_core.loan_agreement_signatures IS 'eSign audit trail for loan agreement signatures';

-- ================================================================
-- TABLE: sanction_letters
-- ================================================================
CREATE TABLE los_core.sanction_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES los_core.loan_applications(id),
    letter_number VARCHAR(50) NOT NULL UNIQUE,
    sanction_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    document_key VARCHAR(500),
    sanctioned_amount DECIMAL(18,2) NOT NULL,
    rate_of_interest DECIMAL(6,3),
    rate_of_interest_bps INT,
    tenure_months INT,
    emi_amount DECIMAL(18,2),
    processing_fee DECIMAL(18,2),
    insurance_premium DECIMAL(18,2),
    total_payable DECIMAL(18,2),
    disbursement_conditions JSONB,
    sanctioning_authority VARCHAR(200),
    authority_designation VARCHAR(100),
    loan_account_number VARCHAR(30),
    ifsc_code VARCHAR(15),
    branch_name VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    generated_by UUID REFERENCES los_core.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sanction_letters_application ON los_core.sanction_letters(application_id);
CREATE INDEX idx_sanction_letters_number ON los_core.sanction_letters(letter_number);
COMMENT ON TABLE los_core.sanction_letters IS 'Sanction letters generated for approved applications';

CREATE TRIGGER trg_loan_agreements_updated_at
    BEFORE UPDATE ON los_core.loan_agreements
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

CREATE TRIGGER trg_loan_agreement_signatures_updated_at
    BEFORE UPDATE ON los_core.loan_agreement_signatures
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

CREATE TRIGGER trg_sanction_letters_updated_at
    BEFORE UPDATE ON los_core.sanction_letters
    FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

-- Kafka Topics for Agreement & eSign
-- los.agreement.generated
-- los.agreement.esign_initiated
-- los.agreement.esign_completed
-- los.agreement.esign_failed
-- los.agreement.executed

COMMENT ON SCHEMA los_core IS 'LOS Platform Core Schema - Loan Origination System for Indian Banking';

-- ============================================================
-- Document Service Tables
-- ============================================================

CREATE TYPE document_type AS ENUM (
  'PAN', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE',
  'BANK_STATEMENT', 'SALARY_SLIP_1', 'SALARY_SLIP_2', 'SALARY_SLIP_3', 'ITR', 'FORM_16',
  'VEHICLE_RC', 'PROPERTY_DOCUMENT', 'NOC', 'AGREEMENT_TO_SALE', 'APPROVAL_LETTER',
  'VALUATION_REPORT', 'PHOTO', 'SIGNATURE', 'ADDRESS_PROOF', 'INCOME_PROOF',
  'IDENTITY_PROOF', 'OTHER'
);

CREATE TYPE document_status AS ENUM (
  'PENDING', 'UPLOADED', 'OCR_IN_PROGRESS', 'OCR_COMPLETED', 'OCR_FAILED',
  'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'
);

CREATE TYPE checklist_status AS ENUM ('REQUIRED', 'OPTIONAL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAIVED');

CREATE TYPE ocr_provider AS ENUM ('KARZA', 'SIGNZY', 'INTERNAL');

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL,
  document_type document_type NOT NULL,
  status document_status NOT NULL DEFAULT 'PENDING',
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  checksum VARCHAR(64) NOT NULL DEFAULT '',
  bucket_name VARCHAR(100) NOT NULL,
  object_key VARCHAR(500) NOT NULL,
  presigned_url TEXT,
  presigned_url_expires_at TIMESTAMPTZ,
  ocr_provider ocr_provider,
  ocr_result JSONB,
  ocr_confidence DECIMAL(5,2),
  ocr_error TEXT,
  ocr_attempts INT NOT NULL DEFAULT 0,
  watermarked_object_key VARCHAR(500),
  reviewer_id UUID,
  reviewed_at TIMESTAMPTZ,
  review_remarks TEXT,
  expiry_date VARCHAR(50),
  is_expired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_application_type ON documents(application_id, document_type);
CREATE INDEX idx_doc_status ON documents(status);
CREATE INDEX idx_doc_created ON documents(created_at);

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

CREATE TABLE document_checklists (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL,
  document_type document_type NOT NULL,
  status checklist_status NOT NULL DEFAULT 'REQUIRED',
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_application ON document_checklists(application_id);

CREATE TRIGGER document_checklists_updated_at
  BEFORE UPDATE ON document_checklists
  FOR EACH ROW EXECUTE FUNCTION los_core.update_updated_at_column();

CREATE TABLE document_reviews (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  application_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  reviewer_role VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  previous_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  remarks TEXT,
  rejection_reason_code VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_document ON document_reviews(document_id);

-- Kafka Topics for Document Service
-- los.document.uploaded
-- los.document.ocr.completed
-- los.document.reviewed
-- los.document.rejected
-- los.document.checklist.created
-- los.document.checklist.updated

-- ============================================================
-- RBAC Tables
-- ============================================================

CREATE TYPE user_role_enum AS ENUM (
  'APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER',
  'ZONAL_CREDIT_HEAD', 'COMPLIANCE_OFFICER', 'SYSTEM', 'ADMIN'
);

CREATE TYPE permission_scope AS ENUM (
  'application:create', 'application:read', 'application:update', 'application:delete',
  'application:submit', 'application:assign_officer', 'application:read_all',
  'kyc:initiate', 'kyc:verify', 'kyc:read',
  'document:upload', 'document:read', 'document:delete', 'document:review', 'document:watermark',
  'decision:trigger', 'decision:read', 'decision:override_request', 'decision:override_approve',
  'bureau:pull', 'bureau:read',
  'disbursement:initiate', 'disbursement:read', 'disbursement:approve',
  'sanction_letter:view', 'sanction_letter:generate',
  'loan_agreement:view', 'loan_agreement:generate', 'loan_agreement:sign',
  'policy:view', 'policy:manage', 'policy:compare',
  'user:manage', 'user:read', 'user:create',
  'partner:approve', 'partner:read', 'partner:manage',
  'commission:view', 'commission:process',
  'audit:read', 'compliance:view',
  'dashboard:view', 'stats:read'
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role_enum NOT NULL,
  permission permission_scope NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  UNIQUE(role, permission)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role);

-- Seed: all roles and their permissions
INSERT INTO role_permissions (role, permission) VALUES
-- APPLICANT
('APPLICANT', 'application:create'), ('APPLICANT', 'application:read'),
('APPLICANT', 'application:update'), ('APPLICANT', 'application:submit'),
('APPLICANT', 'kyc:initiate'), ('APPLICANT', 'kyc:verify'), ('APPLICANT', 'kyc:read'),
('APPLICANT', 'document:upload'), ('APPLICANT', 'document:read'),
('APPLICANT', 'sanction_letter:view'), ('APPLICANT', 'loan_agreement:view'),
('APPLICANT', 'dashboard:view'),
-- LOAN_OFFICER
('LOAN_OFFICER', 'application:create'), ('LOAN_OFFICER', 'application:read'),
('LOAN_OFFICER', 'application:update'), ('LOAN_OFFICER', 'application:delete'),
('LOAN_OFFICER', 'application:submit'), ('LOAN_OFFICER', 'application:assign_officer'),
('LOAN_OFFICER', 'application:read_all'), ('LOAN_OFFICER', 'kyc:initiate'),
('LOAN_OFFICER', 'kyc:verify'), ('LOAN_OFFICER', 'kyc:read'),
('LOAN_OFFICER', 'document:upload'), ('LOAN_OFFICER', 'document:read'),
('LOAN_OFFICER', 'document:delete'), ('LOAN_OFFICER', 'document:review'),
('LOAN_OFFICER', 'document:watermark'), ('LOAN_OFFICER', 'decision:trigger'),
('LOAN_OFFICER', 'decision:read'), ('LOAN_OFFICER', 'bureau:read'),
('LOAN_OFFICER', 'bureau:pull'), ('LOAN_OFFICER', 'sanction_letter:view'),
('LOAN_OFFICER', 'sanction_letter:generate'), ('LOAN_OFFICER', 'loan_agreement:view'),
('LOAN_OFFICER', 'loan_agreement:generate'), ('LOAN_OFFICER', 'loan_agreement:sign'),
('LOAN_OFFICER', 'dashboard:view'), ('LOAN_OFFICER', 'stats:read'),
-- CREDIT_ANALYST
('CREDIT_ANALYST', 'application:read_all'), ('CREDIT_ANALYST', 'application:assign_officer'),
('CREDIT_ANALYST', 'kyc:read'), ('CREDIT_ANALYST', 'document:read'),
('CREDIT_ANALYST', 'document:review'), ('CREDIT_ANALYST', 'document:watermark'),
('CREDIT_ANALYST', 'decision:trigger'), ('CREDIT_ANALYST', 'decision:read'),
('CREDIT_ANALYST', 'decision:override_request'), ('CREDIT_ANALYST', 'bureau:read'),
('CREDIT_ANALYST', 'bureau:pull'), ('CREDIT_ANALYST', 'sanction_letter:view'),
('CREDIT_ANALYST', 'sanction_letter:generate'), ('CREDIT_ANALYST', 'loan_agreement:view'),
('CREDIT_ANALYST', 'loan_agreement:generate'), ('CREDIT_ANALYST', 'loan_agreement:sign'),
('CREDIT_ANALYST', 'policy:view'), ('CREDIT_ANALYST', 'dashboard:view'),
('CREDIT_ANALYST', 'stats:read'),
-- BRANCH_MANAGER
('BRANCH_MANAGER', 'application:read_all'), ('BRANCH_MANAGER', 'application:assign_officer'),
('BRANCH_MANAGER', 'kyc:read'), ('BRANCH_MANAGER', 'document:read'),
('BRANCH_MANAGER', 'document:review'), ('BRANCH_MANAGER', 'document:watermark'),
('BRANCH_MANAGER', 'decision:trigger'), ('BRANCH_MANAGER', 'decision:read'),
('BRANCH_MANAGER', 'decision:override_request'), ('BRANCH_MANAGER', 'decision:override_approve'),
('BRANCH_MANAGER', 'bureau:read'), ('BRANCH_MANAGER', 'bureau:pull'),
('BRANCH_MANAGER', 'disbursement:approve'), ('BRANCH_MANAGER', 'sanction_letter:view'),
('BRANCH_MANAGER', 'sanction_letter:generate'), ('BRANCH_MANAGER', 'loan_agreement:view'),
('BRANCH_MANAGER', 'loan_agreement:generate'), ('BRANCH_MANAGER', 'loan_agreement:sign'),
('BRANCH_MANAGER', 'policy:view'), ('BRANCH_MANAGER', 'policy:compare'),
('BRANCH_MANAGER', 'user:read'), ('BRANCH_MANAGER', 'dashboard:view'),
('BRANCH_MANAGER', 'stats:read'), ('BRANCH_MANAGER', 'audit:read'),
-- ZONAL_CREDIT_HEAD
('ZONAL_CREDIT_HEAD', 'application:read_all'), ('ZONAL_CREDIT_HEAD', 'application:assign_officer'),
('ZONAL_CREDIT_HEAD', 'kyc:read'), ('ZONAL_CREDIT_HEAD', 'document:read'),
('ZONAL_CREDIT_HEAD', 'document:review'), ('ZONAL_CREDIT_HEAD', 'decision:trigger'),
('ZONAL_CREDIT_HEAD', 'decision:read'), ('ZONAL_CREDIT_HEAD', 'decision:override_request'),
('ZONAL_CREDIT_HEAD', 'decision:override_approve'), ('ZONAL_CREDIT_HEAD', 'bureau:read'),
('ZONAL_CREDIT_HEAD', 'bureau:pull'), ('ZONAL_CREDIT_HEAD', 'disbursement:approve'),
('ZONAL_CREDIT_HEAD', 'sanction_letter:view'), ('ZONAL_CREDIT_HEAD', 'loan_agreement:view'),
('ZONAL_CREDIT_HEAD', 'policy:view'), ('ZONAL_CREDIT_HEAD', 'policy:compare'),
('ZONAL_CREDIT_HEAD', 'user:read'), ('ZONAL_CREDIT_HEAD', 'dashboard:view'),
('ZONAL_CREDIT_HEAD', 'stats:read'), ('ZONAL_CREDIT_HEAD', 'audit:read'),
('ZONAL_CREDIT_HEAD', 'compliance:view'),
-- COMPLIANCE_OFFICER
('COMPLIANCE_OFFICER', 'application:read_all'), ('COMPLIANCE_OFFICER', 'kyc:read'),
('COMPLIANCE_OFFICER', 'document:read'), ('COMPLIANCE_OFFICER', 'decision:read'),
('COMPLIANCE_OFFICER', 'bureau:read'), ('COMPLIANCE_OFFICER', 'audit:read'),
('COMPLIANCE_OFFICER', 'compliance:view'), ('COMPLIANCE_OFFICER', 'stats:read');

-- ================================================================
-- TABLE: pdd_checklists
-- ================================================================
CREATE TABLE los_core.pdd_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    loan_account_number VARCHAR(30),
    disbursement_date DATE NOT NULL,
    initiation_date DATE NOT NULL,
    due_date DATE NOT NULL,
    extended_due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_items SMALLINT NOT NULL DEFAULT 0,
    completed_items SMALLINT NOT NULL DEFAULT 0,
    verified_items SMALLINT NOT NULL DEFAULT 0,
    overdue_days SMALLINT NOT NULL DEFAULT 0,
    initiated_by UUID,
    completion_date DATE,
    waived_by UUID,
    waiver_reason TEXT,
    waived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pdd_checklists_status_chk CHECK (status IN (
        'PENDING','SUBMITTED','VERIFIED','REJECTED','WAIVED','BREACHED'
    ))
);

CREATE INDEX idx_pdd_checklists_application_status ON los_core.pdd_checklists (application_id, status);
CREATE INDEX idx_pdd_checklists_due_date ON los_core.pdd_checklists (due_date);
CREATE INDEX idx_pdd_checklists_status ON los_core.pdd_checklists (status) WHERE status = 'PENDING';

-- ================================================================
-- TABLE: pdd_checklist_items
-- ================================================================
CREATE TABLE los_core.pdd_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES los_core.pdd_checklists(id) ON DELETE CASCADE,
    category VARCHAR(20) NOT NULL,
    item_code VARCHAR(30) NOT NULL,
    item_description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    due_date DATE NOT NULL,
    submitted_date DATE,
    verified_date DATE,
    verified_by UUID,
    rejection_reason TEXT,
    document_ref_id UUID,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pdd_items_status_chk CHECK (status IN (
        'PENDING','SUBMITTED','VERIFIED','REJECTED','WAIVED','BREACHED'
    )),
    CONSTRAINT pdd_items_category_chk CHECK (category IN (
        'DOCUMENT','CONDITION','INSURANCE','VALUATION','LEGAL','TECHNICAL'
    ))
);

CREATE INDEX idx_pdd_items_checklist_status ON los_core.pdd_checklist_items (checklist_id, status);
CREATE INDEX idx_pdd_items_due_date ON los_core.pdd_checklist_items (due_date);

