-- Decision Engine Schema (decision schema)
CREATE SCHEMA IF NOT EXISTS decision;

-- Decisions
CREATE TABLE decision.decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    decision_result VARCHAR(30) NOT NULL,
    credit_score INT,
    credit_grade VARCHAR(2),
    recommended_amount DECIMAL(15,2),
    recommended_tenure_months INT,
    recommended_roi_bps INT,
    final_grade VARCHAR(2),
    probability_of_default DECIMAL(5,4),
    combined_pd DECIMAL(5,4),
    rule_hits_count INT DEFAULT 0,
    rule_fail_count INT DEFAULT 0,
    risk_score DECIMAL(5,2),
    approved_amount DECIMAL(15,2),
    sanctioned_tenure_months INT,
    sanctioned_roi_bps INT,
    conditions TEXT,
    rejection_reasons TEXT,
    decision_engine_version VARCHAR(20),
    decided_by VARCHAR(50),
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_decision_application UNIQUE (application_id)
);

-- Rule Definitions
CREATE TABLE decision.rule_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code VARCHAR(50) NOT NULL UNIQUE,
    rule_name VARCHAR(200) NOT NULL,
    rule_description TEXT,
    category VARCHAR(30),
    loan_types VARCHAR(100),
    rule_expression TEXT NOT NULL,
    priority INT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_hard_rule BOOLEAN DEFAULT FALSE,
    error_code VARCHAR(50),
    error_message VARCHAR(200),
    severity VARCHAR(20) DEFAULT 'ERROR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rule_code ON decision.rule_definitions (rule_code);
CREATE INDEX idx_rule_active ON decision.rule_definitions (is_active);

-- Rule Results
CREATE TABLE decision.rule_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES decision.decisions(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES decision.rule_definitions(id) ON DELETE CASCADE,
    rule_code VARCHAR(50),
    rule_name VARCHAR(200),
    passed BOOLEAN NOT NULL,
    evaluated_value TEXT,
    error_message TEXT,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rule_result_decision ON decision.rule_results (decision_id);

-- Interest Rate Configs
CREATE TABLE decision.interest_rate_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_type VARCHAR(30) NOT NULL,
    min_rate_bps INT NOT NULL,
    max_rate_bps INT NOT NULL,
    base_rate_bps INT NOT NULL,
    spread_bps INT DEFAULT 0,
    valid_from DATE NOT NULL,
    valid_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rate_loan_type ON decision.interest_rate_configs (loan_type, is_active);

-- ML Model Configs
CREATE TABLE decision.ml_model_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    model_type VARCHAR(30),
    is_active BOOLEAN DEFAULT FALSE,
    weight_in_ensemble DECIMAL(3,2),
    accuracy DECIMAL(5,4),
    precision_score DECIMAL(5,4),
    recall_score DECIMAL(5,4),
    features_used JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

