-- ============================================================
-- LOS Platform Migration
-- Service: integration-service
-- Database: los_integration
-- Migration: 006_integration_schema
-- Description: External integrations - bureau pulls (CIBIL/Experian/Equifax/CRIF), disbursements, EMI schedule, NACH mandates
-- ============================================================

CREATE SCHEMA IF NOT EXISTS los_integration;

CREATE OR REPLACE FUNCTION los_integration.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE bureau_provider AS ENUM ('CIBIL', 'EXPERIAN', 'EQUIFAX', 'CRIF');
CREATE TYPE bureau_pull_status AS ENUM ('PENDING', 'CONSENT_PENDING', 'IN_PROGRESS', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'TIMEOUT', 'DUPLICATE_LOCKED');
CREATE TYPE bureau_report_status AS ENUM ('RAW', 'PARSED', 'FAILED', 'ARCHIVED');
CREATE TYPE disbursement_status AS ENUM (
    'PENDING','CBS_CUSTOMER_CREATED','CBS_ACCOUNT_CREATED',
    'MANDATE_PENDING','MANDATE_REGISTERED','MANDATE_CONFIRMED',
    'PAYMENT_INITIATED','PAYMENT_SUCCESS','PAYMENT_FAILED',
    'PAYMENT_RETURNED','CANCELLED','REVERSED'
);
CREATE TYPE payment_mode AS ENUM ('IMPS','NEFT','RTGS','UPI','NACH','CHEQUE','CASH');

CREATE TABLE los_integration.bureau_pull_jobs (
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

CREATE INDEX idx_bureau_jobs_app_provider ON los_integration.bureau_pull_jobs (application_id, provider);
CREATE INDEX idx_bureau_jobs_pan ON los_integration.bureau_pull_jobs (pan_hash, created_at);
CREATE INDEX idx_bureau_jobs_status ON los_integration.bureau_pull_jobs (status, created_at);

CREATE TRIGGER trg_bureau_pull_jobs_updated_at
    BEFORE UPDATE ON los_integration.bureau_pull_jobs
    FOR EACH ROW EXECUTE FUNCTION los_integration.update_updated_at_column();

CREATE TABLE los_integration.bureau_reports (
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

CREATE INDEX idx_bureau_reports_app ON los_integration.bureau_reports (application_id, provider);
CREATE INDEX idx_bureau_reports_pan ON los_integration.bureau_reports (pan_hash, created_at);

CREATE TRIGGER trg_bureau_reports_updated_at
    BEFORE UPDATE ON los_integration.bureau_reports
    FOR EACH ROW EXECUTE FUNCTION los_integration.update_updated_at_column();

CREATE TABLE los_integration.bureau_aggregated_scores (
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

CREATE TRIGGER trg_bureau_aggregated_scores_updated_at
    BEFORE UPDATE ON los_integration.bureau_aggregated_scores
    FOR EACH ROW EXECUTE FUNCTION los_integration.update_updated_at_column();

CREATE TABLE los_integration.disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    loan_id UUID,
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

CREATE INDEX idx_disbursements_app ON los_integration.disbursements (application_id, status);
CREATE INDEX idx_disbursements_loan_account ON los_integration.disbursements (loan_account_id);
CREATE UNIQUE INDEX idx_disbursements_utr ON los_integration.disbursements (utr_number) WHERE utr_number IS NOT NULL;
CREATE UNIQUE INDEX idx_disbursements_idempotency ON los_integration.disbursements (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_disbursements_status ON los_integration.disbursements (status, created_at);

CREATE TRIGGER trg_disbursements_updated_at
    BEFORE UPDATE ON los_integration.disbursements
    FOR EACH ROW EXECUTE FUNCTION los_integration.update_updated_at_column();

CREATE TABLE los_integration.emi_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL,
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

CREATE INDEX idx_emi_loan_due ON los_integration.emi_schedule (loan_id, due_date);
CREATE INDEX idx_emi_status_due ON los_integration.emi_schedule (status, due_date)
    WHERE status IN ('DUE','OVERDUE');

CREATE TRIGGER trg_emi_schedule_updated_at
    BEFORE UPDATE ON los_integration.emi_schedule
    FOR EACH ROW EXECUTE FUNCTION los_integration.update_updated_at_column();

CREATE TABLE los_integration.payment_transactions (
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

CREATE INDEX idx_payment_disbursement ON los_integration.payment_transactions (disbursement_id);
CREATE UNIQUE INDEX idx_payment_utr ON los_integration.payment_transactions (utr_number) WHERE utr_number IS NOT NULL;
CREATE INDEX idx_payment_status ON los_integration.payment_transactions (status_code, created_at);

CREATE TRIGGER trg_payment_transactions_updated_at
    BEFORE UPDATE ON los_integration.payment_transactions
    FOR EACH ROW EXECUTE FUNCTION los_integration.update_updated_at_column();

CREATE TABLE los_integration.nach_mandates (
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

CREATE INDEX idx_nach_app ON los_integration.nach_mandates (application_id);
CREATE INDEX idx_nach_loan_account ON los_integration.nach_mandates (loan_account_id);
CREATE UNIQUE INDEX idx_nach_umrn ON los_integration.nach_mandates (umrn) WHERE umrn IS NOT NULL;

CREATE TRIGGER trg_nach_mandates_updated_at
    BEFORE UPDATE ON los_integration.nach_mandates
    FOR EACH ROW EXECUTE FUNCTION los_integration.update_updated_at_column();

CREATE TABLE los_integration.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_integration.schema_migrations (migration_id) VALUES ('006_integration_schema');
