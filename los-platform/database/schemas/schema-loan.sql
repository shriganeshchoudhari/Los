-- ============================================================
-- LOS Platform Migration
-- Service: loan-service
-- Database: los_loan
-- Migration: 003_loan_schema
-- Description: Loan service core tables - applications, loans, PDD, sanction, agreements, disbursement plans
-- Note: Cross-service FK references (to los_auth.users, los_kyc.kyc_records, etc.)
--       are stored as UUID columns WITHOUT FK constraints to allow DB-per-service isolation.
--       Application-level validation and Kafka events maintain referential integrity.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS los_loan;

CREATE OR REPLACE FUNCTION los_loan.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE los_loan.los_application_seq START WITH 1;

CREATE OR REPLACE FUNCTION los_loan.generate_application_number(
    p_state VARCHAR(4),
    p_loan_type VARCHAR(30)
)
RETURNS VARCHAR(30) AS $$
DECLARE
    v_year VARCHAR(4);
    v_seq VARCHAR(6);
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := LPAD(NEXTVAL('los_loan.los_application_seq')::TEXT, 6, '0');
    RETURN 'LOS-' || v_year || '-' || p_state || '-' || v_seq;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE los_loan.loan_applications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    application_number VARCHAR(30) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    loan_type VARCHAR(30) NOT NULL,
    customer_segment VARCHAR(10) NOT NULL DEFAULT 'RETAIL',
    channel_code VARCHAR(20) NOT NULL,
    branch_code VARCHAR(10) NOT NULL,
    applicant_full_name VARCHAR(200) NOT NULL,
    applicant_dob DATE NOT NULL,
    applicant_mobile VARCHAR(10) NOT NULL,
    applicant_mobile_hash CHAR(64) NOT NULL,
    applicant_pan_hash CHAR(64) NOT NULL,
    applicant_pan_encrypted JSONB NOT NULL,
    applicant_gender VARCHAR(15),
    applicant_pincode VARCHAR(6),
    applicant_state VARCHAR(4),
    applicant_profile JSONB NOT NULL DEFAULT '{}',
    employment_details JSONB NOT NULL DEFAULT '{}',
    loan_requirement JSONB NOT NULL DEFAULT '{}',
    user_id UUID NOT NULL,
    kyc_id UUID,
    bureau_report_id UUID,
    decision_id UUID,
    assigned_officer_id UUID,
    assigned_analyst_id UUID,
    requested_amount BIGINT NOT NULL,
    sanctioned_amount BIGINT,
    sanctioned_tenure_months SMALLINT,
    sanctioned_roi_bps INTEGER,
    dsa_code VARCHAR(20),
    dsa_name VARCHAR(100),
    rejection_reason_code VARCHAR(30),
    rejection_remarks TEXT,
    conditions_pre_disbursal TEXT[],
    submitted_at TIMESTAMPTZ,
    sanctioned_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE los_loan.loan_applications_2024_07 PARTITION OF los_loan.loan_applications
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE los_loan.loan_applications_2024_08 PARTITION OF los_loan.loan_applications
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE los_loan.loan_applications_2024_09 PARTITION OF los_loan.loan_applications
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE los_loan.loan_applications_2024_10 PARTITION OF los_loan.loan_applications
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE los_loan.loan_applications_2024_11 PARTITION OF los_loan.loan_applications
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE los_loan.loan_applications_2024_12 PARTITION OF los_loan.loan_applications
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE los_loan.loan_applications_2025 PARTITION OF los_loan.loan_applications
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE los_loan.loan_applications_2026 PARTITION OF los_loan.loan_applications
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE UNIQUE INDEX idx_app_number ON los_loan.loan_applications (application_number);
CREATE INDEX idx_app_status_created ON los_loan.loan_applications (status, created_at DESC);
CREATE INDEX idx_app_pan_hash ON los_loan.loan_applications (applicant_pan_hash, loan_type, created_at);
CREATE INDEX idx_app_user_id ON los_loan.loan_applications (user_id, created_at DESC);
CREATE INDEX idx_app_officer ON los_loan.loan_applications (assigned_officer_id, status)
    WHERE assigned_officer_id IS NOT NULL;
CREATE INDEX idx_app_branch_status ON los_loan.loan_applications (branch_code, status, created_at DESC);
CREATE INDEX idx_app_applicant_profile ON los_loan.loan_applications USING GIN (applicant_profile jsonb_path_ops);

CREATE TRIGGER trg_loan_applications_updated_at
    BEFORE UPDATE ON los_loan.loan_applications
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.application_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    from_status VARCHAR(40),
    to_status VARCHAR(40) NOT NULL,
    action_by UUID,
    action_by_role VARCHAR(30),
    remarks TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stage_app_id ON los_loan.application_stage_history (application_id, timestamp DESC);

CREATE TABLE los_loan.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_account_number VARCHAR(20) NOT NULL UNIQUE,
    application_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL,
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

CREATE INDEX idx_loans_user ON los_loan.loans (user_id, status);
CREATE INDEX idx_loans_status ON los_loan.loans (status, next_emi_date);
CREATE INDEX idx_loans_account ON los_loan.loans (loan_account_number);

CREATE TRIGGER trg_loans_updated_at
    BEFORE UPDATE ON los_loan.loans
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.pdd_checklists (
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

CREATE INDEX idx_pdd_checklists_application_status ON los_loan.pdd_checklists (application_id, status);
CREATE INDEX idx_pdd_checklists_due_date ON los_loan.pdd_checklists (due_date);
CREATE INDEX idx_pdd_checklists_status ON los_loan.pdd_checklists (status) WHERE status = 'PENDING';

CREATE TRIGGER trg_pdd_checklists_updated_at
    BEFORE UPDATE ON los_loan.pdd_checklists
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.pdd_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES los_loan.pdd_checklists(id) ON DELETE CASCADE,
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

CREATE INDEX idx_pdd_items_checklist_status ON los_loan.pdd_checklist_items (checklist_id, status);
CREATE INDEX idx_pdd_items_due_date ON los_loan.pdd_checklist_items (due_date);

CREATE TRIGGER trg_pdd_checklist_items_updated_at
    BEFORE UPDATE ON los_loan.pdd_checklist_items
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.loan_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES los_loan.loan_applications(id),
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
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT loan_agreements_status_chk CHECK (status IN (
        'DRAFT','PENDING_SIGNATURE','AWAITING_ESIGN','PARTIALLY_SIGNED','FULLY_SIGNED','EXECUTED','CANCELLED'
    ))
);

CREATE INDEX idx_loan_agreements_application ON los_loan.loan_agreements (application_id);
CREATE INDEX idx_loan_agreements_agreement_number ON los_loan.loan_agreements (agreement_number);
CREATE INDEX idx_loan_agreements_status ON los_loan.loan_agreements (status);

CREATE TRIGGER trg_loan_agreements_updated_at
    BEFORE UPDATE ON los_loan.loan_agreements
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.loan_agreement_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES los_loan.loan_agreements(id),
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

CREATE INDEX idx_agreement_signatures_agreement ON los_loan.loan_agreement_signatures (agreement_id);
CREATE INDEX idx_agreement_signatures_transaction ON los_loan.loan_agreement_signatures (esign_transaction_id);

CREATE TRIGGER trg_loan_agreement_signatures_updated_at
    BEFORE UPDATE ON los_loan.loan_agreement_signatures
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.sanction_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES los_loan.loan_applications(id),
    letter_number VARCHAR(50) NOT NULL UNIQUE,
    sanction_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    pdf_doc_key VARCHAR(500),
    pdf_generated_at TIMESTAMPTZ,
    signed_doc_key VARCHAR(500),
    signed_at TIMESTAMPTZ,
    esign_provider VARCHAR(30),
    esign_transaction_id VARCHAR(100),
    borrower_signed_at TIMESTAMPTZ,
    bank_signed_at TIMESTAMPTZ,
    bank_signatory_id UUID,
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
    generated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_sanction_application ON los_loan.sanction_letters (application_id);
CREATE INDEX idx_sanction_status ON los_loan.sanction_letters (status, created_at);

CREATE TRIGGER trg_sanction_letters_updated_at
    BEFORE UPDATE ON los_loan.sanction_letters
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TYPE tranche_status AS ENUM ('PLANNED','SUBMITTED','APPROVED','PARTIALLY_DISBURSED','FULLY_DISBURSED','CANCELLED','EXPIRED');

CREATE TABLE los_loan.disbursement_plans (
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

CREATE UNIQUE INDEX idx_disbursement_plan_application ON los_loan.disbursement_plans(application_id) WHERE is_active = true;

CREATE TRIGGER trg_disbursement_plans_updated_at
    BEFORE UPDATE ON los_loan.disbursement_plans
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.disbursement_tranches (
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

CREATE INDEX idx_tranche_application ON los_loan.disbursement_tranches (application_id);
CREATE INDEX idx_tranche_status ON los_loan.disbursement_tranches (status);
CREATE INDEX idx_tranche_app_status ON los_loan.disbursement_tranches (application_id, status);

CREATE TRIGGER trg_disbursement_tranches_updated_at
    BEFORE UPDATE ON los_loan.disbursement_tranches
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.disbursement_inspections (
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

CREATE INDEX idx_inspection_tranche ON los_loan.disbursement_inspections (tranche_id);
CREATE INDEX idx_inspection_application ON los_loan.disbursement_inspections (application_id);

CREATE TRIGGER trg_disbursement_inspections_updated_at
    BEFORE UPDATE ON los_loan.disbursement_inspections
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.loan_product_configs (
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
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_type_active ON los_loan.loan_product_configs (loan_type, is_active, effective_from);

CREATE TRIGGER trg_loan_product_configs_updated_at
    BEFORE UPDATE ON los_loan.loan_product_configs
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

INSERT INTO los_loan.loan_product_configs (product_code, loan_type, min_amount, max_amount, min_tenure_months, max_tenure_months, min_age, max_age, min_credit_score, max_foir, base_rate_bps, spread_bps, processing_fee_percent, mandatory_documents, is_active, effective_from) VALUES
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

CREATE TABLE los_loan.interest_rate_configs (
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
    CONSTRAINT loan_rate_benchmark_chk CHECK (benchmark_type IN ('MCLR_1Y','MCLR_3M','REPO_RATE','T_BILL_91D','BASE_RATE'))
);

CREATE INDEX idx_rate_config_product_active ON los_loan.interest_rate_configs(product_code, is_active);
CREATE INDEX idx_rate_config_effective ON los_loan.interest_rate_configs(effective_from);

CREATE TRIGGER trg_interest_rate_configs_updated_at
    BEFORE UPDATE ON los_loan.interest_rate_configs
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

INSERT INTO los_loan.interest_rate_configs
(product_code, benchmark_type, interest_rate_type, min_rate_bps, max_rate_bps, default_spread_bps, tenure_spread_bands, credit_grade_spreads, employment_adjustments_bps, amount_risk_thresholds, is_active, effective_from)
VALUES
('PL', 'MCLR_1Y', 'FLOATING', 850, 2200, 400,
  '[{"minTenureMonths":1,"maxTenureMonths":12,"additionalSpreadBps":25},{"minTenureMonths":13,"maxTenureMonths":36,"additionalSpreadBps":0},{"minTenureMonths":37,"maxTenureMonths":60,"additionalSpreadBps":-10},{"minTenureMonths":61,"maxTenureMonths":84,"additionalSpreadBps":-20}]',
  '[{"grade":"A+","minSpreadBps":225,"maxSpreadBps":275},{"grade":"A","minSpreadBps":300,"maxSpreadBps":350},{"grade":"B+","minSpreadBps":400,"maxSpreadBps":450},{"grade":"B","minSpreadBps":475,"maxSpreadBps":525},{"grade":"C","minSpreadBps":575,"maxSpreadBps":650},{"grade":"D","minSpreadBps":700,"maxSpreadBps":800},{"grade":"F","minSpreadBps":900,"maxSpreadBps":1350}]',
  '{"SALARIED":-25,"SELF_EMPLOYED":25,"AGRICULTURALIST":0,"PENSIONER":10}',
  '[{"minAmount":0,"maxAmount":5000000,"additionalBps":0},{"minAmount":5000001,"maxAmount":10000000,"additionalBps":5},{"minAmount":10000001,"maxAmount":20000000,"additionalBps":15},{"minAmount":20000001,"maxAmount":50000000,"additionalBps":25}]',
  true, '2024-07-01'),
('BL', 'MCLR_1Y', 'FLOATING', 1050, 2400, 575,
  '[{"minTenureMonths":1,"maxTenureMonths":24,"additionalSpreadBps":30},{"minTenureMonths":25,"maxTenureMonths":60,"additionalSpreadBps":0},{"minTenureMonths":61,"maxTenureMonths":120,"additionalSpreadBps":-15}]',
  '[{"grade":"A+","minSpreadBps":450,"maxSpreadBps":525},{"grade":"A","minSpreadBps":550,"maxSpreadBps":625},{"grade":"B+","minSpreadBps":650,"maxSpreadBps":725},{"grade":"B","minSpreadBps":750,"maxSpreadBps":825},{"grade":"C","minSpreadBps":875,"maxSpreadBps":1000},{"grade":"D","minSpreadBps":1050,"maxSpreadBps":1250},{"grade":"F","minSpreadBps":1350,"maxSpreadBps":1650}]',
  '{"SALARIED":-35,"SELF_EMPLOYED":30,"AGRICULTURALIST":10,"PENSIONER":20}',
  '[{"minAmount":0,"maxAmount":10000000,"additionalBps":0},{"minAmount":10000001,"maxAmount":25000000,"additionalBps":10},{"minAmount":25000001,"maxAmount":50000000,"additionalBps":20}]',
  true, '2024-07-01'),
('HL', 'MCLR_1Y', 'FLOATING', 775, 1200, 125,
  '[{"minTenureMonths":1,"maxTenureMonths":60,"additionalSpreadBps":0},{"minTenureMonths":61,"maxTenureMonths":180,"additionalSpreadBps":-5},{"minTenureMonths":181,"maxTenureMonths":360,"additionalSpreadBps":-10}]',
  '[{"grade":"A+","minSpreadBps":100,"maxSpreadBps":125},{"grade":"A","minSpreadBps":150,"maxSpreadBps":175},{"grade":"B+","minSpreadBps":200,"maxSpreadBps":225},{"grade":"B","minSpreadBps":250,"maxSpreadBps":275},{"grade":"C","minSpreadBps":300,"maxSpreadBps":350},{"grade":"D","minSpreadBps":375,"maxSpreadBps":450},{"grade":"F","minSpreadBps":500,"maxSpreadBps":650}]',
  '{"SALARIED":-15,"SELF_EMPLOYED":15,"AGRICULTURALIST":5,"PENSIONER":10}',
  '[{"minAmount":0,"maxAmount":30000000,"additionalBps":0},{"minAmount":30000001,"maxAmount":100000000,"additionalBps":5}]',
  true, '2024-07-01'),
('EL', 'MCLR_1Y', 'FLOATING', 975, 2000, 350,
  '[{"minTenureMonths":1,"maxTenureMonths":36,"additionalSpreadBps":15},{"minTenureMonths":37,"maxTenureMonths":72,"additionalSpreadBps":0}]',
  '[{"grade":"A+","minSpreadBps":300,"maxSpreadBps":350},{"grade":"A","minSpreadBps":375,"maxSpreadBps":425},{"grade":"B+","minSpreadBps":450,"maxSpreadBps":500},{"grade":"B","minSpreadBps":525,"maxSpreadBps":575},{"grade":"C","minSpreadBps":625,"maxSpreadBps":700},{"grade":"D","minSpreadBps":750,"maxSpreadBps":875},{"grade":"F","minSpreadBps":950,"maxSpreadBps":1150}]',
  '{"SALARIED":-20,"SELF_EMPLOYED":20,"AGRICULTURALIST":5,"PENSIONER":15}',
  '[{"minAmount":0,"maxAmount":5000000,"additionalBps":0},{"minAmount":5000001,"maxAmount":15000000,"additionalBps":8}]',
  true, '2024-07-01');

CREATE TABLE los_loan.rate_history (
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

CREATE INDEX idx_rate_history_application ON los_loan.rate_history (application_id);
CREATE INDEX idx_rate_history_product_date ON los_loan.rate_history (product_code, created_at);

CREATE TRIGGER trg_rate_history_updated_at
    BEFORE UPDATE ON los_loan.rate_history
    FOR EACH ROW EXECUTE FUNCTION los_loan.update_updated_at_column();

CREATE TABLE los_loan.benchmark_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(15) NOT NULL UNIQUE,
    rate NUMERIC(10,4) NOT NULL,
    effective_from DATE NOT NULL,
    published_by VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT benchmark_type_chk CHECK (type IN ('MCLR_1Y','MCLR_3M','REPO_RATE','T_BILL_91D'))
);

CREATE TABLE los_loan.feature_flags (
    flag_key VARCHAR(50) PRIMARY KEY,
    description VARCHAR(200),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_for_roles TEXT[],
    enabled_for_branches TEXT[],
    rollout_percentage SMALLINT CHECK (rollout_percentage BETWEEN 0 AND 100),
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE los_loan.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_loan.schema_migrations (migration_id) VALUES ('003_loan_schema');
