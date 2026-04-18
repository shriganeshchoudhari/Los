-- KYC Module Schema (kyc schema)
CREATE SCHEMA IF NOT EXISTS kyc;

-- KYC Records
CREATE TABLE kyc.kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    overall_risk_score SMALLINT,
    reviewed_by UUID,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_kyc_application UNIQUE (application_id)
);
CREATE INDEX idx_kyc_user_status ON kyc.kyc_records (user_id, status);

-- Aadhaar KYC Results
CREATE TABLE kyc.aadhaar_kyc_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES kyc.kyc_records(id) ON DELETE CASCADE,
    txn_id VARCHAR(100) NOT NULL,
    uidai_ref_id VARCHAR(100) NOT NULL,
    aadhaar_number_hash VARCHAR(64) NOT NULL,
    name VARCHAR(200),
    dob DATE,
    gender VARCHAR(1),
    address_json JSONB,
    photo_storage_key VARCHAR(500),
    photo_encryption_key_ref VARCHAR(100),
    xml_storage_key VARCHAR(500),
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
    uidai_response_code VARCHAR(10),
    auth_code VARCHAR(100),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_metadata JSONB,
    CONSTRAINT uq_aadhaar_kyc_id UNIQUE (kyc_id)
);
CREATE INDEX idx_aadhaar_hash ON kyc.aadhaar_kyc_results (aadhaar_number_hash);

-- PAN Verification Results
CREATE TABLE kyc.pan_verification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES kyc.kyc_records(id) ON DELETE CASCADE,
    pan_number_masked VARCHAR(10) NOT NULL,
    pan_number_encrypted JSONB NOT NULL,
    name_match_score SMALLINT NOT NULL DEFAULT 0,
    name_on_pan VARCHAR(200) NOT NULL,
    dob_match BOOLEAN NOT NULL DEFAULT FALSE,
    pan_status VARCHAR(10) NOT NULL,
    linked_aadhaar BOOLEAN NOT NULL DEFAULT FALSE,
    aadhaar_seeding_status VARCHAR(15),
    nsdl_transaction_id VARCHAR(100),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Face Match Results
CREATE TABLE kyc.face_match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES kyc.kyc_records(id) ON DELETE CASCADE,
    match_score SMALLINT NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    liveness_score SMALLINT,
    liveness_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
    provider VARCHAR(30) NOT NULL,
    request_id VARCHAR(100),
    failure_reason VARCHAR(50),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consent Records
CREATE TABLE kyc.consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    application_id VARCHAR(50) NOT NULL,
    consent_type VARCHAR(30) NOT NULL,
    consent_text TEXT NOT NULL,
    consent_version VARCHAR(10) NOT NULL DEFAULT 'v1.0',
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET NOT NULL,
    user_agent TEXT,
    signed_otp_session_id UUID,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);
CREATE INDEX idx_consent_user_app ON kyc.consent_records (user_id, application_id, consent_type);
CREATE INDEX idx_consent_active ON kyc.consent_records (application_id, consent_type);

