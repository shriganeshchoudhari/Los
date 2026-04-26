-- Flyway Migration: V020__consolidated_schema_alignment.sql
-- Consolidated fix for version columns and decision schema alignment

-- 1. Create Decision History if not exists
CREATE TABLE IF NOT EXISTS decision.decision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL,
    application_id UUID NOT NULL,
    status_before VARCHAR(50),
    status_after VARCHAR(50),
    changed_by VARCHAR(100),
    change_reason VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Rename and align decision rules
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'decision' AND tablename = 'rule_definitions') THEN
        ALTER TABLE decision.rule_definitions RENAME TO decision_rules;
    END IF;
END $$;

ALTER TABLE decision.decision_rules RENAME COLUMN rule_expression TO rule_definition;
ALTER TABLE decision.decision_rules ADD COLUMN IF NOT EXISTS product_type VARCHAR(50);
ALTER TABLE decision.decision_rules ADD COLUMN IF NOT EXISTS rule_version INT DEFAULT 1;
ALTER TABLE decision.decision_rules ADD COLUMN IF NOT EXISTS description VARCHAR(500);
ALTER TABLE decision.decision_rules ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
ALTER TABLE decision.decision_rules ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

-- 3. Align decisions table
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS decision_type VARCHAR(30);
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS final_decision VARCHAR(20);
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS interest_rate_bps INT;
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS spread_bps INT;
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS benchmark_rate VARCHAR(50);
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS processing_fee_paisa BIGINT DEFAULT 0;
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS insurance_mandatory BOOLEAN DEFAULT FALSE;
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS ltv_ratio DECIMAL(5,2);
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS foir_actual DECIMAL(5,2);
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS scorecard_result JSONB;
-- conditions is already there as TEXT in V004, change to JSONB
ALTER TABLE decision.decisions ALTER COLUMN conditions TYPE JSONB USING (CASE WHEN conditions IS NULL THEN NULL ELSE conditions::JSONB END);
-- Rename column rejection_reasons (V004) to rejection_reason (entity)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'decision' AND table_name = 'decisions' AND column_name = 'rejection_reasons') THEN
        ALTER TABLE decision.decisions RENAME COLUMN rejection_reasons TO rejection_reason;
    END IF;
END $$;
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS remarks VARCHAR(1000);

-- 4. Align bureau scores table (rename from bureau_reports in V005)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'integration' AND tablename = 'bureau_reports') THEN
        ALTER TABLE integration.bureau_reports RENAME TO bureau_scores;
    END IF;
END $$;

-- Align bureau_scores columns
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS applicant_id UUID;
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS provider VARCHAR(50);
-- status already exists in bureau_reports as pull_status? No, V005 says pull_status
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'integration' AND table_name = 'bureau_scores' AND column_name = 'pull_status') THEN
        ALTER TABLE integration.bureau_scores RENAME COLUMN pull_status TO status;
    END IF;
END $$;
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS credit_score INT;
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS pan_hash VARCHAR(64);
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS report_id VARCHAR(100);
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS pull_timestamp TIMESTAMPTZ;
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS parsed_response JSONB;
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 5. Add version column to all BaseEntity tables that don't have it
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE auth.otp_sessions ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE kyc.kyc_records ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE decision.decisions ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE decision.decision_rules ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE decision.rule_results ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE decision.decision_history ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE integration.bureau_scores ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE integration.disbursements ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE integration.nach_mandates ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE notification.notifications ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE dsa.dsa_partners ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE dsa.dsa_users ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE shared.audit_logs ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE shared.idempotency_keys ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
