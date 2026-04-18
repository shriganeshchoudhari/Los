-- Flyway Migration: V017__align_loan_applications_schema.sql
-- Aligning database schema with LoanApplication.java entity

-- 1. Add missing columns
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS sanction_amount DECIMAL(15,2);
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS net_disbursed_amount DECIMAL(15,2);
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS tenure_months INT;
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS application_date DATE;
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50);
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS annual_income DECIMAL(15,2);
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS credit_score INT;
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS assigned_to_user_id VARCHAR(50);
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE loan.loan_applications ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Populate columns from existing data
UPDATE loan.loan_applications
SET
    -- customer_id from user_id if present
    customer_id = COALESCE(customer_id, user_id::TEXT),
    
    -- sanction_amount from sanctioned_amount
    sanction_amount = COALESCE(sanction_amount, sanctioned_amount),
    
    -- tenure_months from sanctioned_tenure_months or loan_requirement JSON
    tenure_months = COALESCE(
        tenure_months, 
        sanctioned_tenure_months, 
        (loan_requirement->>'tenureMonths')::INT
    ),
    
    -- application_date from created_at
    application_date = COALESCE(application_date, created_at::DATE),
    
    -- approved_at from sanctioned_at
    approved_at = COALESCE(approved_at, sanctioned_at),
    
    -- rejection_reason from rejection_remarks
    rejection_reason = COALESCE(rejection_reason, rejection_remarks),
    
    -- employment_type extracted from employment_details JSON
    employment_type = COALESCE(employment_type, employment_details->>'employmentType'),
    
    -- annual_income extracted from employment_details JSON (handles both monthly and annual keys)
    annual_income = COALESCE(
        annual_income,
        (employment_details->>'annualIncome')::DECIMAL,
        (employment_details->>'netMonthlyIncome')::DECIMAL * 12
    ),
    
    -- assigned_to_user_id from assigned_officer_id
    assigned_to_user_id = COALESCE(assigned_to_user_id, assigned_officer_id::TEXT),
    
    -- is_deleted default false
    is_deleted = COALESCE(is_deleted, FALSE);

-- 3. Update application_date for all existing records to ensure non-null if entity requires it
UPDATE loan.loan_applications SET application_date = created_at::DATE WHERE application_date IS NULL;
UPDATE loan.loan_applications SET is_deleted = FALSE WHERE is_deleted IS NULL;
