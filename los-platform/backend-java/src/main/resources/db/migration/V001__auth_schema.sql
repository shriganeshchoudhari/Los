-- Flyway Migration: V001__auth_schema.sql
-- Auth module schema: users, OTP sessions, refresh tokens

CREATE SCHEMA IF NOT EXISTS auth;
SET search_path TO auth, public;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile VARCHAR(20) NOT NULL UNIQUE,
    mobile_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    employee_id VARCHAR(50) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    password_hash VARCHAR(255),
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    last_login_at TIMESTAMPTZ,
    last_password_change_at TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    metadata JSONB,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_mobile_hash ON users(mobile_hash);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

-- OTP Sessions table
CREATE TABLE IF NOT EXISTS otp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile VARCHAR(20) NOT NULL,
    mobile_hash VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    purpose VARCHAR(50) NOT NULL,
    otp_hash VARCHAR(255),
    channel VARCHAR(50),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    verified_at TIMESTAMPTZ,
    device_fingerprint VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_otp_sessions_mobile_expires
    ON otp_sessions(mobile_hash, expires_at)
    WHERE status = 'PENDING';

-- Refresh Tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(60) NOT NULL,
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens(user_id, revoked_at);

-- Role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(30) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Seed default role permissions
INSERT INTO role_permissions (role, permission) VALUES
-- APPLICANT
('APPLICANT', 'application:create'), ('APPLICANT', 'application:read:own'),
('APPLICANT', 'kyc:submit'), ('APPLICANT', 'document:upload'),
-- LOAN_OFFICER
('LOAN_OFFICER', 'application:read'), ('LOAN_OFFICER', 'application:update'),
('LOAN_OFFICER', 'application:submit'), ('LOAN_OFFICER', 'kyc:read'),
('LOAN_OFFICER', 'document:read'), ('LOAN_OFFICER', 'document:review'),
('LOAN_OFFICER', 'pdd:read'), ('LOAN_OFFICER', 'pdd:submit'),
-- BRANCH_MANAGER
('BRANCH_MANAGER', 'application:read'), ('BRANCH_MANAGER', 'application:approve'),
('BRANCH_MANAGER', 'application:reject'), ('BRANCH_MANAGER', 'application:assign'),
('BRANCH_MANAGER', 'pdd:read'), ('BRANCH_MANAGER', 'pdd:verify'), ('BRANCH_MANAGER', 'pdd:waive'),
-- CREDIT_ANALYST
('CREDIT_ANALYST', 'application:read'), ('CREDIT_ANALYST', 'decision:trigger'),
('CREDIT_ANALYST', 'bureau:pull'), ('CREDIT_ANALYST', 'document:read'),
-- ZONAL_CREDIT_HEAD
('ZONAL_CREDIT_HEAD', 'application:read'), ('ZONAL_CREDIT_HEAD', 'application:approve'),
('ZONAL_CREDIT_HEAD', 'application:reject'),
-- CREDIT_HEAD
('CREDIT_HEAD', 'application:read'), ('CREDIT_HEAD', 'application:approve'),
('CREDIT_HEAD', 'application:reject'),
-- COMPLIANCE_OFFICER
('COMPLIANCE_OFFICER', 'audit:read'), ('COMPLIANCE_OFFICER', 'application:read')
ON CONFLICT (role, permission) DO NOTHING;

-- Trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE users IS 'Bank staff and applicant users';
COMMENT ON TABLE otp_sessions IS 'OTP generation sessions for login and verification';
COMMENT ON TABLE refresh_tokens IS 'Long-lived refresh tokens for session management';
COMMENT ON COLUMN users.mobile_hash IS 'SHA-256 hash of mobile number for lookups';
COMMENT ON COLUMN users.locked_until IS 'Account lockout expiry time';

