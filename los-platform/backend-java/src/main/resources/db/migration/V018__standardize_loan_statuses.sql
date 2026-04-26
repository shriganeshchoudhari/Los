-- Flyway Migration: V018__standardize_loan_statuses.sql
-- Standardizing loan application statuses to match LoanStatus.java enum

UPDATE loan.loan_applications
SET status = CASE
    WHEN status IN ('CREDIT_ASSESSMENT', 'PENDING_FIELD_INVESTIGATION', 'PULLED_BUREAU', 'VERIFIED_DOCS') THEN 'UNDER_REVIEW'
    WHEN status IN ('KYC_PENDING', 'INITIATED_KYC') THEN 'KYC_IN_PROGRESS'
    WHEN status IN ('APPROVED', 'SANCTION_LETTER_GENERATED') THEN 'SANCTIONED'
    WHEN status IN ('DISBURSEMENT_COMPLETE') THEN 'DISBURSED'
    WHEN status IN ('WITHDRAWAL', 'CUSTOMER_CANCELLED') THEN 'WITHDRAWN'
    ELSE status
END;
