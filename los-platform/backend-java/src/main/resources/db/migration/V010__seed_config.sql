-- Flyway Migration: V010__seed_config.sql
-- LOS Platform — Seed Configuration Data
-- Run AFTER all schema migrations (V001–V009) are applied.

-- ============================================================
-- Benchmark Rates Seed (loan.benchmark_rates)
-- ============================================================
INSERT INTO loan.benchmark_rates (type, rate, effective_from, published_by)
VALUES
  ('MCLR_1Y', 8.7500, '2024-07-01', 'RBI'),
  ('MCLR_3M', 8.2500, '2024-07-01', 'RBI'),
  ('REPO_RATE', 6.5000, '2024-07-01', 'RBI'),
  ('T_BILL_91D', 6.9800, '2024-07-01', 'RBI')
ON CONFLICT (type) DO NOTHING;

-- ============================================================
-- Feature Flags Seed (loan.feature_flags)
-- ============================================================
INSERT INTO loan.feature_flags (flag_key, description, is_enabled, rollout_percentage)
VALUES
  ('NEW_LOAN_APPLICATION', 'Enable new loan application flow', true, 100),
  ('AADHAAR_VERIFICATION', 'Enable Aadhaar-based KYC', true, 100),
  ('PAN_VERIFICATION', 'Enable PAN verification via NSDL', true, 100),
  ('BUREAU_PULL_CIBIL', 'Enable CIBIL bureau pull', true, 100),
  ('BUREAU_PULL_EXPERIAN', 'Enable Experian bureau pull', false, 0),
  ('DECISION_ENGINE_V2', 'Use ML-powered decision engine v2', true, 50),
  ('PDD_WORKFLOW', 'Enable Post-Disbursement Documentation workflow', true, 100),
  ('MULTI_TRANCHE_DISBURSEMENT', 'Enable multi-tranche disbursement for HL/LAP', true, 100),
  ('ESIGN_INTEGRATION', 'Enable eSign for sanction letters and loan agreements', true, 100),
  ('DSA_PORTAL', 'Enable DSA partner portal', true, 100),
  ('LOAN_FORECLOSURE', 'Enable loan foreclosure feature', true, 100),
  ('LOAN_PREPAYMENT', 'Enable partial prepayment', true, 100),
  ('EMI_CALCULATOR', 'Enable EMI calculator', true, 100),
  ('MAX_ELIGIBLE_CALC', 'Enable max eligible amount calculation', true, 100),
  ('PROMOTIONAL_RATE', 'Enable promotional interest rates', false, 0),
  ('VIDEO_KYC', 'Enable Video KYC', false, 0),
  ('DIGITAL_LENDING', 'Enable fully digital lending journey', true, 100),
  ('BANK_STATEMENT_OCR', 'Enable bank statement OCR via Karza', true, 100),
  ('LOAN_AGREEMENT_PDF', 'Enable loan agreement PDF generation', true, 100),
  ('SANCTION_LETTER_PDF', 'Enable sanction letter PDF generation', true, 100)
ON CONFLICT (flag_key) DO NOTHING;

-- ============================================================
-- Rule Definitions Seed (decision.rule_definitions)
-- Compatible with V004__decision_schema.sql schema
-- ============================================================
INSERT INTO decision.rule_definitions (
    rule_code, rule_name, rule_description, category, severity, priority,
    is_active, rule_expression, error_code, error_message, is_hard_rule
) VALUES
  -- Credit Score Rules
  ('CR001', 'Minimum CIBIL Score', 'Reject if CIBIL score < 650', 'CREDIT_SCORE', 'HARD_STOP', 10, true,
   '[{"field":"bureau_score.cibil","operator":"lt","value":650}]',
   'LOW_CIBIL_SCORE', 'CIBIL score must be at least 650', true),

  ('CR002', 'CIBIL Score Warning', 'Soft warning if CIBIL score between 650-700', 'CREDIT_SCORE', 'WARNING', 11, true,
   '[{"field":"bureau_score.cibil","operator":"gte","value":650},{"field":"bureau_score.cibil","operator":"lt","value":700}]',
   'MEDIUM_CIBIL', 'CIBIL score in borderline range', false),

  ('CR003', 'No Active CIBIL Enquiries (30 days)', 'Reject if > 3 CIBIL enquiries in last 30 days', 'CREDIT_SCORE', 'HARD_STOP', 12, true,
   '[{"field":"bureau_enquiries.cibil_30d","operator":"gt","value":3}]',
   'EXCESS_BUREAU_ENQUIRIES', 'Too many bureau enquiries in last 30 days', true),

  -- FOIR Rules
  ('FO001', 'Maximum FOIR - Salaried', 'Reject if FOIR > 50% for salaried', 'FOIR', 'HARD_STOP', 20, true,
   '[{"field":"applicant.employment_type","operator":"eq","value":"SALARIED_PRIVATE"},{"field":"calculated_foir","operator":"gt","value":50}]',
   'HIGH_FOIR', 'FOIR exceeds 50% for salaried applicant', true),

  ('FO002', 'Maximum FOIR - Self Employed', 'Reject if FOIR > 40% for self-employed', 'FOIR', 'HARD_STOP', 21, true,
   '[{"field":"applicant.employment_type","operator":"eq","value":"SELF_EMPLOYED_PROFESSIONAL"},{"field":"calculated_foir","operator":"gt","value":40}]',
   'HIGH_FOIR_SE', 'FOIR exceeds 40% for self-employed applicant', true),

  -- Income Rules
  ('IN001', 'Minimum Monthly Income - Salaried', 'Reject if net monthly income < Rs.25,000', 'INCOME', 'HARD_STOP', 30, true,
   '[{"field":"applicant.net_monthly_income","operator":"lt","value":25000}]',
   'LOW_INCOME', 'Minimum monthly income requirement not met', true),

  ('IN002', 'Minimum Monthly Income - Self Employed', 'Reject if monthly income < Rs.30,000', 'INCOME', 'HARD_STOP', 31, true,
   '[{"field":"applicant.net_monthly_income","operator":"lt","value":30000}]',
   'LOW_INCOME_SE', 'Minimum income requirement not met for self-employed', true),

  -- Age Rules
  ('AG001', 'Minimum Age', 'Reject if age < 21 years', 'AGE', 'HARD_STOP', 40, true,
   '[{"field":"applicant.age","operator":"lt","value":21}]',
   'AGE_BELOW_MIN', 'Applicant must be at least 21 years old', true),

  ('AG002', 'Maximum Age at Maturity', 'Reject if age at loan maturity > 65', 'AGE', 'HARD_STOP', 41, true,
   '[{"field":"applicant.age_at_maturity","operator":"gt","value":65}]',
   'AGE_EXCEEDS_MATURITY', 'Loan maturity age limit exceeded', true),

  -- Amount/Tenure Rules
  ('AT001', 'Minimum Loan Amount', 'Reject if requested amount < product minimum', 'AMOUNT_TENURE', 'HARD_STOP', 50, true,
   '[{"field":"loan.requested_amount","operator":"lt","value":"product.min_amount"}]',
   'AMOUNT_BELOW_MIN', 'Requested amount below minimum product limit', true),

  ('AT002', 'Maximum Loan Amount', 'Reject if requested amount > product maximum', 'AMOUNT_TENURE', 'HARD_STOP', 51, true,
   '[{"field":"loan.requested_amount","operator":"gt","value":"product.max_amount"}]',
   'AMOUNT_ABOVE_MAX', 'Requested amount exceeds product maximum', true),

  -- Bureau History Rules
  ('BH001', 'Active Loan Count', 'Reject if > 5 active bureau accounts', 'BUREAU_HISTORY', 'HARD_STOP', 60, true,
   '[{"field":"bureau_active_accounts","operator":"gt","value":5}]',
   'EXCESS_ACTIVE_ACCOUNTS', 'Too many active credit accounts', true),

  -- Fraud Rules
  ('FR001', 'PAN Mismatch', 'Reject if applicant name does not match PAN', 'FRAUD', 'HARD_STOP', 70, true,
   '[{"field":"kyc.pan_name_match","operator":"eq","value":false}]',
   'PAN_MISMATCH', 'Applicant name does not match PAN', true),

  ('FR002', 'Aadhaar Name Mismatch', 'Reject if applicant name does not match Aadhaar', 'FRAUD', 'HARD_STOP', 71, true,
   '[{"field":"kyc.aadhaar_name_match","operator":"eq","value":false}]',
   'AADHAAR_MISMATCH', 'Applicant name does not match Aadhaar', true),

  ('FR003', 'Face Match Failure', 'Reject if face match score < 80%', 'FRAUD', 'HARD_STOP', 72, true,
   '[{"field":"kyc.face_match_score","operator":"lt","value":80}]',
   'FACE_MATCH_FAILED', 'Face verification failed', true),

  -- LTV Rules
  ('LV001', 'LTV for Home Loan', 'Reject if LTV > 80% for HL', 'LTV', 'HARD_STOP', 90, true,
   '[{"field":"loan.loan_type","operator":"eq","value":"HOME_LOAN"},{"field":"ltv_ratio","operator":"gt","value":80}]',
   'LTV_EXCEEDED', 'LTV exceeds maximum allowed', true),

  ('LV002', 'LTV for LAP', 'Reject if LTV > 60% for LAP', 'LTV', 'HARD_STOP', 91, true,
   '[{"field":"loan.loan_type","operator":"eq","value":"LOAN_AGAINST_PROPERTY"},{"field":"ltv_ratio","operator":"gt","value":60}]',
   'LTV_EXCEEDED_LAP', 'LTV exceeds 60% for LAP', true)
ON CONFLICT (rule_code) DO UPDATE SET
  rule_name = EXCLUDED.rule_name,
  rule_description = EXCLUDED.rule_description,
  category = EXCLUDED.category,
  severity = EXCLUDED.severity,
  priority = EXCLUDED.priority,
  is_active = EXCLUDED.is_active,
  rule_expression = EXCLUDED.rule_expression,
  error_code = EXCLUDED.error_code,
  error_message = EXCLUDED.error_message,
  is_hard_rule = EXCLUDED.is_hard_rule;

-- ============================================================
-- Notification Templates Seed (notification.notification_templates)
-- ============================================================
INSERT INTO notification.notification_templates (
    template_name, template_type, title_template, message_template, channel, is_active
) VALUES
  ('OTP_LOGIN', 'OTP', 'Your LOS login OTP is {{otp}}. Valid for 5 minutes.',
   'Dear Customer, your One Time Password (OTP) for LOS login is {{otp}}. It is valid for 5 minutes. Do not share it with anyone. -LOS Bank',
   'SMS', true),

  ('APP_SUBMITTED', 'APPLICATION_STATUS', 'Loan Application Submitted',
   'Dear {{customer_name}}, your {{loan_type}} application {{application_number}} has been submitted successfully. Our team will review it within 2 business days. -LOS Bank',
   'SMS', true),

  ('APP_APPROVED', 'APPLICATION_STATUS', 'Congratulations! Loan Approved',
   'Dear {{customer_name}}, congratulations! Your {{loan_type}} of Rs.{{sanctioned_amount}} has been approved. Sanction letter will be sent to your registered email. -LOS Bank',
   'SMS', true),

  ('APP_REJECTED', 'APPLICATION_STATUS', 'Loan Application Status Update',
   'Dear {{customer_name}}, your {{loan_type}} application {{application_number}} could not be approved at this time. For queries, visit your nearest branch. -LOS Bank',
   'SMS', true),

  ('KYC_INITIATED', 'KYC_UPDATE', 'KYC Verification Initiated',
   'Dear {{customer_name}}, please complete your KYC verification for application {{application_number}}. Click: {{kyc_link}} -LOS Bank',
   'SMS', true),

  ('KYC_COMPLETE', 'KYC_UPDATE', 'KYC Verification Complete',
   'Dear {{customer_name}}, your KYC for application {{application_number}} has been verified successfully. -LOS Bank',
   'SMS', true),

  ('SANCTION_LETTER', 'SANCTION', 'Sanction Letter Issued',
   'Dear {{customer_name}}, your sanction letter for {{application_number}} is now available. Please log in to download. Valid for 30 days. -LOS Bank',
   'SMS', true),

  ('ESIGN_REQUIRED', 'SANCTION', 'eSign Required - Urgent Action',
   'Dear {{customer_name}}, please complete eSign for your loan agreement {{agreement_number}}. Use OTP: {{esign_otp}}. Valid for 15 minutes. -LOS Bank',
   'SQL', true),

  ('DISBURSEMENT_COMPLETE', 'DISBURSEMENT', 'Loan Disbursed Successfully',
   'Dear {{customer_name}}, Rs.{{disbursement_amount}} credited to A/C ending {{account_last4}}. EMI: Rs.{{emi_amount}} from {{first_emi_date}}. Ref: {{utr}}. -LOS Bank',
   'SMS', true),

  ('EMI_REMINDER', 'EMI_REMINDER', 'EMI Due Reminder',
   'Dear Customer, EMI of Rs.{{emi_amount}} for A/C {{account_last4}} is due on {{due_date}}. Please ensure sufficient balance. -LOS Bank',
   'SMS', true)
ON CONFLICT (template_name) DO NOTHING;
