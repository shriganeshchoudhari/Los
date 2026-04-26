-- Flyway Migration: V028__make_legacy_columns_nullable.sql
-- Making legacy columns nullable to align with simplified LoanApplication entity

ALTER TABLE loan.loan_applications ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE loan.loan_applications ALTER COLUMN applicant_full_name DROP NOT NULL;
