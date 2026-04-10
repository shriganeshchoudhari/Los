-- ============================================================
-- LOS Platform Migration
-- Service: auth-service
-- Database: los_auth
-- Migration: 002_auth_schema
-- Description: Auth service tables - users, OTP, JWT refresh tokens
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS los_auth;

CREATE OR REPLACE FUNCTION los_auth.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE los_auth.users (
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
    CONSTRAINT auth_users_role_chk CHECK (role IN (
        'APPLICANT','LOAN_OFFICER','CREDIT_ANALYST','BRANCH_MANAGER',
        'ZONAL_CREDIT_HEAD','COMPLIANCE_OFFICER','SYSTEM','ADMIN'
    )),
    CONSTRAINT auth_users_status_chk CHECK (status IN (
        'ACTIVE','INACTIVE','SUSPENDED','PENDING_VERIFICATION'
    ))
);

CREATE INDEX idx_auth_users_mobile_hash ON los_auth.users (mobile_hash);
CREATE INDEX idx_auth_users_role_status ON los_auth.users (role, status);
CREATE INDEX idx_auth_users_employee_id ON los_auth.users (employee_id) WHERE employee_id IS NOT NULL;

CREATE TRIGGER trg_auth_users_updated_at
    BEFORE UPDATE ON los_auth.users
    FOR EACH ROW EXECUTE FUNCTION los_auth.update_updated_at_column();

CREATE TABLE los_auth.otp_sessions (
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
    ON los_auth.otp_sessions (mobile_hash, expires_at) WHERE is_used = FALSE;

CREATE TABLE los_auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES los_auth.users(id) ON DELETE CASCADE,
    token_hash CHAR(60) NOT NULL,
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON los_auth.refresh_tokens (user_id, revoked_at);

CREATE TRIGGER trg_refresh_tokens_updated_at
    BEFORE UPDATE ON los_auth.refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION los_auth.update_updated_at_column();

CREATE TABLE los_auth.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(30) NOT NULL,
    permission VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE(role, permission)
);

CREATE INDEX idx_role_permissions_role ON los_auth.role_permissions(role);

INSERT INTO los_auth.role_permissions (role, permission) VALUES
('APPLICANT', 'application:create'), ('APPLICANT', 'application:read'),
('APPLICANT', 'application:update'), ('APPLICANT', 'application:submit'),
('APPLICANT', 'kyc:initiate'), ('APPLICANT', 'kyc:verify'), ('APPLICANT', 'kyc:read'),
('APPLICANT', 'document:upload'), ('APPLICANT', 'document:read'),
('APPLICANT', 'sanction_letter:view'), ('APPLICANT', 'loan_agreement:view'),
('APPLICANT', 'dashboard:view'),
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
('COMPLIANCE_OFFICER', 'application:read_all'), ('COMPLIANCE_OFFICER', 'kyc:read'),
('COMPLIANCE_OFFICER', 'document:read'), ('COMPLIANCE_OFFICER', 'decision:read'),
('COMPLIANCE_OFFICER', 'bureau:read'), ('COMPLIANCE_OFFICER', 'audit:read'),
('COMPLIANCE_OFFICER', 'compliance:view'), ('COMPLIANCE_OFFICER', 'stats:read');

CREATE TABLE los_auth.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_auth.schema_migrations (migration_id) VALUES ('002_auth_schema');
