-- ============================================================
-- LOS Platform Migration
-- Service: decision-service
-- Database: los_decision
-- Migration: 005_decision_schema
-- Description: Credit decision engine tables - decision records, rule results, ML models, rule definitions
-- ============================================================

CREATE SCHEMA IF NOT EXISTS los_decision;

CREATE OR REPLACE FUNCTION los_decision.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE rule_category AS ENUM (
    'CREDIT_SCORE','FOIR','INCOME','AGE','AMOUNT_TENURE',
    'BUREAU_HISTORY','FRAUD','EMPLOYMENT','LTV','PRODUCT_POLICY',
    'LEGAL','DEDUPLICATION','CHANNEL'
);

CREATE TYPE rule_severity AS ENUM ('HARD_STOP','SOFT_STOP','WARNING','INFO');

CREATE TYPE ml_model_status AS ENUM ('TRAINING','VALIDATED','ACTIVE','ARCHIVED','FAILED');
CREATE TYPE ml_model_type AS ENUM ('LOGISTIC_REGRESSION','RANDOM_FOREST','GRADIENT_BOOSTING','NEURAL_NETWORK','ENSEMBLE');

CREATE TABLE los_decision.rule_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category rule_category NOT NULL,
    severity rule_severity NOT NULL DEFAULT 'WARNING',
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    priority INT NOT NULL DEFAULT 50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    loan_types JSONB,
    channels JSONB,
    conditions JSONB NOT NULL DEFAULT '[]',
    then_clause JSONB NOT NULL,
    product_overrides JSONB,
    skip_conditions JSONB,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rules_category_active ON los_decision.rule_definitions (category, is_active);
CREATE INDEX idx_rules_priority ON los_decision.rule_definitions (priority);
CREATE INDEX idx_rules_effective ON los_decision.rule_definitions (effective_from, effective_to) WHERE effective_to IS NOT NULL;

CREATE TRIGGER trg_rule_definitions_updated_at
    BEFORE UPDATE ON los_decision.rule_definitions
    FOR EACH ROW EXECUTE FUNCTION los_decision.update_updated_at_column();

CREATE TABLE los_decision.ml_model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    model_type ml_model_type NOT NULL,
    status ml_model_status NOT NULL DEFAULT 'TRAINING',
    loan_segment VARCHAR(30) NOT NULL DEFAULT 'ALL',
    loan_products JSONB,
    weights_path VARCHAR(500),
    weights_data BYTEA,
    feature_names JSONB NOT NULL DEFAULT '[]',
    scaler_mean JSONB,
    scaler_std JSONB,
    class_thresholds JSONB,
    coefficients JSONB,
    intercepts JSONB,
    feature_importances JSONB,
    performance_metrics JSONB,
    training_dataset_size INT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    trained_by VARCHAR(100),
    trained_at TIMESTAMPTZ,
    validation_date TIMESTAMPTZ,
    training_history JSONB,
    production_since TIMESTAMPTZ,
    replaced_by VARCHAR(50),
    replaced_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (model_id, version)
);

CREATE INDEX idx_ml_model_active_segment ON los_decision.ml_model_registry (is_active, loan_segment);
CREATE INDEX idx_ml_model_status ON los_decision.ml_model_registry (status, loan_segment);

CREATE TRIGGER trg_ml_model_registry_updated_at
    BEFORE UPDATE ON los_decision.ml_model_registry
    FOR EACH ROW EXECUTE FUNCTION los_decision.update_updated_at_column();

CREATE TABLE los_decision.ml_prediction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    model_id VARCHAR(50) NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    probability_of_default NUMERIC(6,5) NOT NULL,
    score INT NOT NULL,
    grade VARCHAR(5) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    recommended_action VARCHAR(30) NOT NULL,
    input_features JSONB NOT NULL DEFAULT '{}',
    inference_time_ms INT NOT NULL,
    actual_outcome VARCHAR(20),
    days_to_default INT,
    predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome_date TIMESTAMPTZ
);

CREATE INDEX idx_ml_pred_app ON los_decision.ml_prediction_log (application_id, predicted_at DESC);
CREATE INDEX idx_ml_pred_model ON los_decision.ml_prediction_log (model_id, predicted_at DESC);
CREATE INDEX idx_ml_pred_outcome ON los_decision.ml_prediction_log (actual_outcome, outcome_date) WHERE actual_outcome IS NOT NULL;

CREATE TABLE los_decision.decision_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    final_decision VARCHAR(10),
    approved_amount BIGINT,
    approved_tenure_months SMALLINT,
    interest_rate_type VARCHAR(10),
    rate_of_interest_bps INTEGER,
    spread_bps INTEGER,
    benchmark_rate VARCHAR(15),
    processing_fee_paisa BIGINT,
    insurance_mandatory BOOLEAN DEFAULT FALSE,
    ltv_ratio NUMERIC(5,2),
    foir_actual NUMERIC(5,2),
    scorecard_result JSONB,
    conditions JSONB,
    rejection_reason_code VARCHAR(30),
    rejection_remarks TEXT,
    decided_by VARCHAR(15) NOT NULL DEFAULT 'RULE_ENGINE',
    decided_at TIMESTAMPTZ,
    policy_version VARCHAR(10) NOT NULL,
    override_by UUID,
    override_remarks TEXT,
    override_request_by UUID,
    override_request_at TIMESTAMPTZ,
    override_request_remarks TEXT,
    override_requested_decision VARCHAR(20),
    override_requested_amount BIGINT,
    override_requested_tenure SMALLINT,
    override_requested_rate INTEGER,
    override_request_conditions JSONB,
    override_requested_rejection_code VARCHAR(30),
    override_authority_level VARCHAR(30),
    override_attachments JSONB,
    override_approved_by UUID,
    override_approved_at TIMESTAMPTZ,
    override_approver_remarks TEXT,
    override_approval_action VARCHAR(10),
    override_rejected_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT decision_status_chk CHECK (status IN (
        'PENDING','IN_PROGRESS','APPROVED','CONDITIONALLY_APPROVED',
        'REJECTED','REFER_TO_CREDIT_COMMITTEE','OVERRIDE_PENDING','MANUAL_OVERRIDE'
    )),
    CONSTRAINT decided_by_chk CHECK (decided_by IN ('RULE_ENGINE','ML_MODEL','MANUAL'))
);

CREATE UNIQUE INDEX idx_decision_application ON los_decision.decision_results (application_id)
    WHERE status NOT IN ('PENDING');
CREATE INDEX idx_decision_status ON los_decision.decision_results (status, decided_at DESC);
CREATE INDEX idx_decision_override_pending ON los_decision.decision_results (status, override_request_at)
    WHERE status = 'OVERRIDE_PENDING';

CREATE TRIGGER trg_decision_results_updated_at
    BEFORE UPDATE ON los_decision.decision_results
    FOR EACH ROW EXECUTE FUNCTION los_decision.update_updated_at_column();

CREATE TABLE los_decision.decision_rule_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES los_decision.decision_results(id),
    rule_id VARCHAR(20) NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    outcome VARCHAR(5) NOT NULL,
    threshold VARCHAR(50),
    actual_value VARCHAR(50),
    message TEXT,
    is_hard_stop BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT outcome_chk CHECK (outcome IN ('PASS','FAIL','WARN','SKIP'))
);

CREATE INDEX idx_rule_results_decision ON los_decision.decision_rule_results (decision_id, outcome);
CREATE INDEX idx_rule_hard_stop ON los_decision.decision_rule_results (decision_id)
    WHERE is_hard_stop = TRUE AND outcome = 'FAIL';

CREATE TABLE los_decision.schema_migrations (
    migration_id VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO los_decision.schema_migrations (migration_id) VALUES ('005_decision_schema');
