-- ============================================================
-- LOS Platform Migration
-- Service: shared
-- Database: los_shared
-- Migration: 010_shared_schema
-- Description: Cross-service shared tables - audit logs, data access logs, idempotency keys
-- ============================================================

CREATE SCHEMA IF NOT EXISTS los_shared;

CREATE OR REPLACE FUNCTION los_shared.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE los_shared.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_category VARCHAR(20) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    actor_id UUID,
    actor_role VARCHAR(30),
    actor_ip INET,
    user_agent TEXT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    before_state TEXT,
    after_state TEXT,
    metadata JSONB,
    request_id UUID NOT NULL,
    correlation_id UUID,
    service_origin VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    chain_hash CHAR(64) NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE TABLE los_shared.audit_logs_2024_07 PARTITION OF los_shared.audit_logs
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE los_shared.audit_logs_2024_08 PARTITION OF los_shared.audit_logs
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE los_shared.audit_logs_2024_09 PARTITION OF los_shared.audit_logs
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE los_shared.audit_logs_2024_10 PARTITION OF los_shared.audit_logs
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE los_shared.audit_logs_2024_11 PARTITION OF los_shared.audit_logs
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE los_shared.audit_logs_2024_12 PARTITION OF los_shared.audit_logs
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE los_shared.audit_logs_2025 PARTITION OF los_shared.audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE los_shared.audit_logs_2026 PARTITION OF los_shared.audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_audit_entity ON los_shared.audit_logs (entity_id, timestamp DESC);
CREATE INDEX idx_audit_actor ON los_shared.audit_logs (actor_id, timestamp DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_category ON los_shared.audit_logs (event_category, timestamp DESC);

CREATE TABLE los_shared.data_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    accessor_id UUID NOT NULL,
    accessor_role VARCHAR(30) NOT NULL,
    resource_type VARCHAR(30) NOT NULL,
    resource_id UUID NOT NULL,
    purpose VARCHAR(200) NOT NULL,
    consent_id UUID,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET NOT NULL,
    CONSTRAINT resource_type_chk CHECK (resource_type IN (
        'AADHAAR_DATA','PAN_DATA','CREDIT_REPORT','BANK_STATEMENT','LOAN_DATA'
    ))
);

CREATE INDEX idx_data_access_resource ON los_shared.data_access_logs (resource_type, resource_id);
CREATE INDEX idx_data_access_accessor ON los_shared.data_access_logs (accessor_id, accessed_at DESC);

CREATE TABLE los_shared.idempotency_keys (
    idempotency_key VARCHAR(36) PRIMARY KEY,
    endpoint VARCHAR(100) NOT NULL,
    response_status SMALLINT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_idem_expires ON los_shared.idempotency_keys (expires_at);

CREATE TABLE los_shared.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_shared.schema_migrations (migration_id) VALUES ('010_shared_schema');
