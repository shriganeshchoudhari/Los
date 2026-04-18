-- Shared Schema (shared schema) - audit_logs and idempotency
CREATE SCHEMA IF NOT EXISTS shared;

-- Audit Logs
CREATE TABLE shared.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON shared.audit_logs (user_id);
CREATE INDEX idx_audit_entity ON shared.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON shared.audit_logs (timestamp DESC);

-- Idempotency Keys
CREATE TABLE shared.idempotency_keys (
    key_value VARCHAR(100) PRIMARY KEY,
    response_body JSONB,
    http_status INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_idempotency_expires ON shared.idempotency_keys (expires_at);

