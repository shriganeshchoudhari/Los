-- Integration Module Schema (integration schema)
CREATE SCHEMA IF NOT EXISTS integration;

-- Bureau Reports
CREATE TABLE integration.bureau_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    bureau_type VARCHAR(20) NOT NULL,
    consent_taken BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    consent_ip INET,
    pull_status VARCHAR(30) DEFAULT 'PENDING',
    raw_response JSONB,
    score INT,
    grade VARCHAR(5),
    account_summary JSONB,
    credit_summary JSONB,
    address_info JSONB,
    error_message TEXT,
    pull_attempts INT DEFAULT 0,
    last_pulled_at TIMESTAMPTZ,
    report_valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bureau_application ON integration.bureau_reports (application_id);
CREATE INDEX idx_bureau_type ON integration.bureau_reports (bureau_type);

-- Disbursements
CREATE TABLE integration.disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    tranche_id UUID,
    disbursement_number VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    disbursement_mode VARCHAR(20) NOT NULL,
    beneficiary_account VARCHAR(30),
    beneficiary_ifsc VARCHAR(15),
    beneficiary_name VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    utr_number VARCHAR(30),
    idempotency_key VARCHAR(100) UNIQUE,
    initiation_timestamp TIMESTAMPTZ,
    completion_timestamp TIMESTAMPTZ,
    failure_reason TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_disbursement_application ON integration.disbursements (application_id);
CREATE INDEX idx_disbursement_status ON integration.disbursements (status);
CREATE INDEX idx_disbursement_idem ON integration.disbursements (idempotency_key);

-- NACH Mandates
CREATE TABLE integration.nach_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    mandate_number VARCHAR(50) UNIQUE,
    emi_amount DECIMAL(12,2) NOT NULL,
    frequency VARCHAR(20) DEFAULT 'MONTHLY',
    debit_day INT,
    account_number VARCHAR(30),
    account_ifsc VARCHAR(15),
    account_holder_name VARCHAR(200),
    bank_name VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    registration_date DATE,
    start_date DATE,
    end_date DATE,
    rejection_reason TEXT,
    cancellation_date DATE,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_nach_application ON integration.nach_mandates (application_id);
CREATE INDEX idx_nach_status ON integration.nach_mandates (status);

