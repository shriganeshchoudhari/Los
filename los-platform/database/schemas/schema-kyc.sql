-- ============================================================
-- LOS Platform Migration
-- Service: kyc-service
-- Database: los_kyc
-- Migration: 004_kyc_schema
-- Description: KYC service tables - identity verification (Aadhaar, PAN, face match) and consent records
-- ============================================================

CREATE SCHEMA IF NOT EXISTS los_kyc;

CREATE OR REPLACE FUNCTION los_kyc.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE los_kyc.kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    overall_risk_score SMALLINT CHECK (overall_risk_score BETWEEN 0 AND 100),
    reviewed_by UUID,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT kyc_status_chk CHECK (status IN (
        'NOT_STARTED','AADHAAR_OTP_SENT','AADHAAR_VERIFIED','PAN_VERIFIED',
        'FACE_MATCH_PENDING','FACE_MATCH_PASSED','FACE_MATCH_FAILED',
        'KYC_COMPLETE','KYC_FAILED','MANUAL_REVIEW'
    ))
);

CREATE UNIQUE INDEX idx_kyc_application ON los_kyc.kyc_records (application_id);
CREATE INDEX idx_kyc_user ON los_kyc.kyc_records (user_id, status);

CREATE TRIGGER trg_kyc_records_updated_at
    BEFORE UPDATE ON los_kyc.kyc_records
    FOR EACH ROW EXECUTE FUNCTION los_kyc.update_updated_at_column();

CREATE TABLE los_kyc.aadhaar_kyc_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES los_kyc.kyc_records(id),
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

CREATE UNIQUE INDEX idx_aadhaar_kyc_id ON los_kyc.aadhaar_kyc_results (kyc_id);
CREATE INDEX idx_aadhaar_hash ON los_kyc.aadhaar_kyc_results (aadhaar_number_hash);

CREATE TABLE los_kyc.pan_verification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES los_kyc.kyc_records(id),
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

CREATE TABLE los_kyc.face_match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_id UUID NOT NULL REFERENCES los_kyc.kyc_records(id),
    match_score SMALLINT NOT NULL,
    passed BOOLEAN NOT NULL,
    liveness_score SMALLINT,
    liveness_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
    provider VARCHAR(30) NOT NULL,
    request_id VARCHAR(100),
    failure_reason VARCHAR(50),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE los_kyc.consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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

CREATE INDEX idx_consent_user_app ON los_kyc.consent_records (user_id, application_id, consent_type);
CREATE INDEX idx_consent_active ON los_kyc.consent_records (application_id, consent_type)
    WHERE is_granted = TRUE AND revoked_at IS NULL;

CREATE TABLE los_kyc.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_kyc.schema_migrations (migration_id) VALUES ('004_kyc_schema');
