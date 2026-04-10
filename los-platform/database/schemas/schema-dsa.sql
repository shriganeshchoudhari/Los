-- ============================================================
-- LOS Platform Migration
-- Service: dsa-service
-- Database: los_dsa
-- Migration: 009_dsa_schema
-- Description: DSA Channel Partner management - partners, officers, applications, commissions
-- ============================================================

CREATE SCHEMA IF NOT EXISTS los_dsa;

CREATE OR REPLACE FUNCTION los_dsa.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE los_dsa.dsa_partners (
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

CREATE UNIQUE INDEX idx_dsa_partners_partner_code ON los_dsa.dsa_partners (partner_code);
CREATE UNIQUE INDEX idx_dsa_partners_pan_hash ON los_dsa.dsa_partners (pan_hash);
CREATE INDEX idx_dsa_partners_status_created ON los_dsa.dsa_partners (status, created_at);

CREATE TRIGGER trg_dsa_partners_updated_at
    BEFORE UPDATE ON los_dsa.dsa_partners
    FOR EACH ROW EXECUTE FUNCTION los_dsa.update_updated_at_column();

CREATE TABLE los_dsa.dsa_officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES los_dsa.dsa_partners(id),
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

CREATE UNIQUE INDEX idx_dsa_officers_employee_code ON los_dsa.dsa_officers (employee_code);
CREATE INDEX idx_dsa_officers_partner_status ON los_dsa.dsa_officers (partner_id, status);
CREATE INDEX idx_dsa_officers_mobile_hash ON los_dsa.dsa_officers (mobile_hash);

CREATE TRIGGER trg_dsa_officers_updated_at
    BEFORE UPDATE ON los_dsa.dsa_officers
    FOR EACH ROW EXECUTE FUNCTION los_dsa.update_updated_at_column();

CREATE TABLE los_dsa.dsa_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(30) NOT NULL UNIQUE,
    loan_application_id UUID,
    partner_id UUID NOT NULL REFERENCES los_dsa.dsa_partners(id),
    officer_id UUID NOT NULL REFERENCES los_dsa.dsa_officers(id),
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

CREATE INDEX idx_dsa_applications_number ON los_dsa.dsa_applications (application_number);
CREATE INDEX idx_dsa_applications_partner_status ON los_dsa.dsa_applications (partner_id, status);
CREATE INDEX idx_dsa_applications_officer ON los_dsa.dsa_applications (officer_id);
CREATE INDEX idx_dsa_applications_created ON los_dsa.dsa_applications (created_at);
CREATE INDEX idx_dsa_applications_customer_mobile ON los_dsa.dsa_applications (customer_mobile_hash);

CREATE TRIGGER trg_dsa_applications_updated_at
    BEFORE UPDATE ON los_dsa.dsa_applications
    FOR EACH ROW EXECUTE FUNCTION los_dsa.update_updated_at_column();

CREATE TABLE los_dsa.dsa_commission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES los_dsa.dsa_partners(id),
    officer_id UUID,
    application_id UUID NOT NULL REFERENCES los_dsa.dsa_applications(id),
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

CREATE INDEX idx_dsa_commission_partner_payout ON los_dsa.dsa_commission (partner_id, payout_month);
CREATE INDEX idx_dsa_commission_application ON los_dsa.dsa_commission (application_id);
CREATE INDEX idx_dsa_commission_status_created ON los_dsa.dsa_commission (status, created_at);

CREATE TABLE los_dsa.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_dsa.schema_migrations (migration_id) VALUES ('009_dsa_schema');
