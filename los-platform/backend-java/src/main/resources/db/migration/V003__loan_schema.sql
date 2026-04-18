-- Loan Module Schema (loan schema)
CREATE SCHEMA IF NOT EXISTS loan;

-- Loan Applications
CREATE TABLE loan.loan_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(50) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    loan_type VARCHAR(30) NOT NULL,
    customer_segment VARCHAR(20),
    channel_code VARCHAR(20),
    branch_code VARCHAR(20),
    applicant_full_name VARCHAR(200) NOT NULL,
    applicant_dob DATE,
    applicant_mobile VARCHAR(15),
    applicant_mobile_hash VARCHAR(64),
    applicant_pan_hash VARCHAR(64),
    applicant_pan_encrypted JSONB,
    applicant_gender VARCHAR(1),
    applicant_pincode VARCHAR(10),
    applicant_state VARCHAR(100),
    applicant_profile JSONB,
    employment_details JSONB,
    loan_requirement JSONB,
    user_id UUID NOT NULL,
    kyc_id UUID,
    bureau_report_id UUID,
    decision_id UUID,
    assigned_officer_id UUID,
    assigned_analyst_id UUID,
    requested_amount DECIMAL(15,2),
    sanctioned_amount DECIMAL(15,2),
    sanctioned_tenure_months INT,
    sanctioned_roi_bps INT,
    dsa_code VARCHAR(20),
    dsa_name VARCHAR(100),
    rejection_reason_code VARCHAR(20),
    rejection_remarks TEXT,
    conditions_pre_disbursal TEXT,
    submitted_at TIMESTAMPTZ,
    sanctioned_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    cancellation_window_initiated_at TIMESTAMPTZ,
    cancellation_window_deadline TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancellation_by_role VARCHAR(30),
    cancellation_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_application_number UNIQUE (application_number)
);
CREATE INDEX idx_loan_app_user ON loan.loan_applications (user_id);
CREATE INDEX idx_loan_app_status ON loan.loan_applications (status);
CREATE INDEX idx_loan_app_branch ON loan.loan_applications (branch_code);
CREATE INDEX idx_loan_app_officer ON loan.loan_applications (assigned_officer_id);

-- Loan Agreements
CREATE TABLE loan.loan_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES loan.loan_applications(id) ON DELETE CASCADE,
    agreement_number VARCHAR(50) NOT NULL,
    document_key VARCHAR(500),
    document_hash VARCHAR(128),
    agreement_date DATE,
    loan_account_number VARCHAR(30),
    sanctioned_amount DECIMAL(15,2),
    sanctioned_amount_words VARCHAR(500),
    rate_of_interest DECIMAL(6,3),
    rate_of_interest_bps INT,
    tenure_months INT,
    emi_amount DECIMAL(15,2),
    moratorium_period_months INT,
    moratorium_emi DECIMAL(15,2),
    processing_fee DECIMAL(15,2),
    first_emi_date DATE,
    last_emi_date DATE,
    disbursement_account VARCHAR(30),
    disbursement_ifsc VARCHAR(15),
    disbursement_bank VARCHAR(100),
    branch_name VARCHAR(200),
    branch_address TEXT,
    security_description TEXT,
    insurance_policy_number VARCHAR(50),
    insurance_premium DECIMAL(10,2),
    prepayment_penalty_clause TEXT,
    default_interest_rate DECIMAL(6,3),
    bounce_charge DECIMAL(10,2),
    part_payment_allowed BOOLEAN DEFAULT TRUE,
    part_payment_min_amount DECIMAL(15,2),
    part_payment_tenure_reduction BOOLEAN DEFAULT TRUE,
    foreclosure_allowed BOOLEAN DEFAULT TRUE,
    foreclosure_notice_period_days INT,
    foreclosure_penalty_percent DECIMAL(5,2),
    special_conditions TEXT,
    jurisdiction TEXT,
    witnessing_officer_name VARCHAR(200),
    witnessing_officer_designation VARCHAR(100),
    co_borrower_name VARCHAR(200),
    co_borrower_address TEXT,
    co_borrower_pan VARCHAR(15),
    guarantor_name VARCHAR(200),
    guarantor_address TEXT,
    guarantor_pan VARCHAR(15),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_agreement_application UNIQUE (application_id)
);

-- Loan Agreement Signatures
CREATE TABLE loan.loan_agreement_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES loan.loan_agreements(id) ON DELETE CASCADE,
    signer_type VARCHAR(20),
    signer_name VARCHAR(200),
    signer_mobile VARCHAR(15),
    signer_email VARCHAR(200),
    signer_role VARCHAR(30),
    esign_transaction_id VARCHAR(100),
    esign_provider VARCHAR(30),
    document_hash_before_sign VARCHAR(128),
    document_hash_after_sign VARCHAR(128),
    certificate_serial_number VARCHAR(100),
    certificate_valid_from TIMESTAMPTZ,
    certificate_valid_to TIMESTAMPTZ,
    signer_aadhaar_hash VARCHAR(64),
    consent_taken BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    consent_ip INET,
    signed_at TIMESTAMPTZ,
    signature_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    signed_document_key VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agreement_sig_agreement ON loan.loan_agreement_signatures (agreement_id);

-- PDD Checklists
CREATE TABLE loan.pdd_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES loan.loan_applications(id) ON DELETE CASCADE,
    loan_account_number VARCHAR(30),
    disbursement_date DATE,
    initiation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date DATE NOT NULL,
    extended_due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_items INT NOT NULL DEFAULT 0,
    completed_items INT NOT NULL DEFAULT 0,
    verified_items INT NOT NULL DEFAULT 0,
    overdue_days INT,
    initiated_by UUID,
    completion_date TIMESTAMPTZ,
    waived_by UUID,
    waiver_reason TEXT,
    waived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pdd_application UNIQUE (application_id)
);
CREATE INDEX idx_pdd_status ON loan.pdd_checklists (status);
CREATE INDEX idx_pdd_due_date ON loan.pdd_checklists (due_date);

-- PDD Checklist Items
CREATE TABLE loan.pdd_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES loan.pdd_checklists(id) ON DELETE CASCADE,
    category VARCHAR(20) NOT NULL,
    item_code VARCHAR(20) NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    due_date DATE,
    submitted_date TIMESTAMPTZ,
    verified_date TIMESTAMPTZ,
    verified_by UUID,
    rejection_reason TEXT,
    document_ref_id UUID,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pdd_item_checklist ON loan.pdd_checklist_items (checklist_id);
CREATE INDEX idx_pdd_item_status ON loan.pdd_checklist_items (status);

-- Application Stage History
CREATE TABLE loan.application_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES loan.loan_applications(id) ON DELETE CASCADE,
    from_status VARCHAR(40),
    to_status VARCHAR(40) NOT NULL,
    action_by UUID,
    action_by_role VARCHAR(30),
    remarks TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stage_history_application ON loan.application_stage_history (application_id);

-- Benchmark Rates
CREATE TABLE loan.benchmark_rates (
    type VARCHAR(50) PRIMARY KEY,
    rate DECIMAL(10,4) NOT NULL,
    effective_from DATE NOT NULL,
    published_by VARCHAR(50)
);

-- Feature Flags
CREATE TABLE loan.feature_flags (
    flag_key VARCHAR(100) PRIMARY KEY,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percentage INT NOT NULL DEFAULT 0
);

