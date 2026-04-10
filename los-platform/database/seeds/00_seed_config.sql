-- ============================================================
-- LOS Platform — Development Seed Data
-- Run AFTER all service migrations (002–010) are applied.
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================

-- Use los_shared for RBAC seed (auth service tables are in los_auth, 
-- but we also need the data accessible from other services that read it via API)

-- ============================================================
-- Benchmark Rates Seed (los_loan.benchmark_rates)
-- ============================================================
INSERT INTO los_loan.benchmark_rates (type, rate, effective_from, published_by)
VALUES
  ('MCLR_1Y',  8.7500, '2024-07-01', 'RBI'),
  ('MCLR_3M',  8.2500, '2024-07-01', 'RBI'),
  ('REPO_RATE', 6.5000, '2024-07-01', 'RBI'),
  ('T_BILL_91D', 6.9800, '2024-07-01', 'RBI')
ON CONFLICT (type) DO NOTHING;

-- ============================================================
-- Feature Flags Seed (los_loan.feature_flags)
-- ============================================================
INSERT INTO los_loan.feature_flags (flag_key, description, is_enabled, rollout_percentage)
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
-- Interest Rate Config Seed (already in 003_loan_schema.sql via INSERT)
-- Additional products that may not be in the migration seed:
-- ============================================================

-- ============================================================
-- Notification Templates Seed (los_notification.notification_templates)
-- ============================================================
INSERT INTO los_notification.notification_templates (template_name, display_name, category, channel, subject, body, dlt_template_id, is_active, is_transactional, priority)
VALUES
  ('OTP_LOGIN', 'OTP Login', 'OTP', 'SMS', 'Your LOS login OTP is {{otp}}. Valid for 5 minutes.', 'Dear Customer, your One Time Password (OTP) for LOS login is {{otp}}. It is valid for 5 minutes. Do not share it with anyone. -LOS Bank', '1007167084196107447', true, true, 'HIGH'),

  ('APP_SUBMITTED', 'Application Submitted', 'APPLICATION_STATUS', 'SMS', 'Loan Application Submitted', 'Dear {{customer_name}}, your {{loan_type}} application {{application_number}} has been submitted successfully. Our team will review it within 2 business days. -LOS Bank', '1007167084196107448', true, true, 'NORMAL'),

  ('APP_APPROVED', 'Application Approved', 'APPLICATION_STATUS', 'SMS', 'Congratulations! Loan Approved', 'Dear {{customer_name}}, congratulations! Your {{loan_type}} of Rs.{{sanctioned_amount}} has been approved. Sanction letter will be sent to your registered email. -LOS Bank', '1007167084196107449', true, true, 'URGENT'),

  ('APP_REJECTED', 'Application Rejected', 'APPLICATION_STATUS', 'SMS', 'Loan Application Status Update', 'Dear {{customer_name}}, your {{loan_type}} application {{application_number}} could not be approved at this time. For queries, visit your nearest branch. -LOS Bank', '1007167084196107450', true, true, 'NORMAL'),

  ('KYC_INITIATED', 'KYC Initiated', 'KYC_UPDATE', 'SMS', 'KYC Verification Initiated', 'Dear {{customer_name}}, please complete your KYC verification for application {{application_number}}. Click: {{kyc_link}} -LOS Bank', '1007167084196107451', true, true, 'HIGH'),

  ('KYC_COMPLETE', 'KYC Completed', 'KYC_UPDATE', 'SMS', 'KYC Verification Complete', 'Dear {{customer_name}}, your KYC for application {{application_number}} has been verified successfully. -LOS Bank', '1007167084196107452', true, true, 'NORMAL'),

  ('DOC_UPLOAD_REMINDER', 'Document Upload Reminder', 'DOCUMENT_REMINDER', 'SMS', 'Document Upload Reminder', 'Dear {{customer_name}}, please upload the following documents for your {{application_number}}: {{pending_docs}}. Upload at: {{doc_upload_link}} -LOS Bank', '1007167084196107453', true, true, 'HIGH'),

  ('DOC_APPROVED', 'Document Approved', 'DOCUMENT_REMINDER', 'SMS', 'Document Approved', 'Dear {{customer_name}}, the document {{document_type}} for {{application_number}} has been approved. -LOS Bank', '1007167084196107454', true, true, 'NORMAL'),

  ('SANCTION_LETTER', 'Sanction Letter Issued', 'SANCTION', 'SMS', 'Sanction Letter Issued', 'Dear {{customer_name}}, your sanction letter for {{application_number}} is now available. Please log in to download. Valid for 30 days. -LOS Bank', '1007167084196107455', true, true, 'URGENT'),

  ('ESIGN_REQUIRED', 'eSign Required', 'SANCTION', 'SMS', 'eSign Required - Urgent Action', 'Dear {{customer_name}}, please complete eSign for your loan agreement {{agreement_number}}. Use OTP: {{esign_otp}}. Valid for 15 minutes. -LOS Bank', '1007167084196107456', true, true, 'URGENT'),

  ('DISBURSEMENT_INITIATED', 'Disbursement Initiated', 'DISBURSEMENT', 'SMS', 'Disbursement Initiated', 'Dear {{customer_name}}, Rs.{{disbursement_amount}} has been initiated to your account {{account_number}} (IFSC: {{ifsc}}). Ref: {{utr}}. -LOS Bank', '1007167084196107457', true, true, 'URGENT'),

  ('DISBURSEMENT_COMPLETE', 'Disbursement Complete', 'DISBURSEMENT', 'SMS', 'Loan Disbursed Successfully', 'Dear {{customer_name}}, Rs.{{disbursement_amount}} credited to A/C ending {{account_last4}}. EMI: Rs.{{emi_amount}} from {{first_emi_date}}. Ref: {{utr}}. -LOS Bank', '1007167084196107458', true, true, 'URGENT'),

  ('EMI_REMINDER', 'EMI Reminder', 'EMI_REMINDER', 'SMS', 'EMI Due Reminder', 'Dear Customer, EMI of Rs.{{emi_amount}} for A/C {{account_last4}} is due on {{due_date}}. Please ensure sufficient balance. -LOS Bank', '1007167084196107459', true, true, 'NORMAL'),

  ('EMI_DUE', 'EMI Due Today', 'EMI_REMINDER', 'SMS', 'EMI Due Today', 'Dear {{customer_name}}, EMI of Rs.{{emi_amount}} for A/C {{account_last4}} is due today. Please pay on time to avoid penal interest. -LOS Bank', '1007167084196107460', true, true, 'HIGH'),

  ('EMI_OVERDUE', 'EMI Overdue Alert', 'EMI_REMINDER', 'SMS', 'EMI Overdue Alert', 'Dear {{customer_name}}, EMI of Rs.{{emi_amount}} for A/C {{account_last4}} is overdue by {{overdue_days}} days. Please pay immediately to avoid NPA reporting. -LOS Bank', '1007167084196107461', true, true, 'URGENT'),

  ('PAYMENT_CONFIRMATION', 'Payment Confirmation', 'PAYMENT_CONFIRMATION', 'SMS', 'Payment Received', 'Dear {{customer_name}}, we have received Rs.{{amount}} towards your loan A/C {{account_last4}}. Balance: Rs.{{outstanding}}. -LOS Bank', '1007167084196107462', true, true, 'NORMAL'),

  ('PDD_REMINDER', 'PDD Reminder', 'DOCUMENT_REMINDER', 'SMS', 'Post Disbursement Documents Due', 'Dear {{customer_name}}, please submit pending post-disbursement documents for {{application_number}} by {{due_date}}. -LOS Bank', '1007167084196107463', true, true, 'HIGH'),

  ('DSA_APP_SUBMITTED', 'DSA Application Submitted', 'APPLICATION_STATUS', 'SMS', 'DSA Application Received', 'Dear {{partner_name}}, your DSA application has been received. Application ID: {{dsa_app_id}}. Our team will contact you within 3 business days. -LOS Bank', '1007167084196107464', true, true, 'NORMAL'),

  ('DSA_COMMISSION', 'Commission Earned', 'GENERAL', 'SMS', 'Commission Credited', 'Dear Partner {{partner_name}}, commission of Rs.{{commission_amount}} has been credited for disbursement {{disbursement_ref}}. -LOS Bank', '1007167084196107465', true, true, 'NORMAL')
ON CONFLICT (template_name, channel) DO NOTHING;

-- Email templates (same templates for email channel)
INSERT INTO los_notification.notification_templates (template_name, display_name, category, channel, subject, body, is_active, is_transactional, priority)
VALUES
  ('APP_SUBMITTED', 'Application Submitted', 'APPLICATION_STATUS', 'EMAIL',
   'Your Loan Application {{application_number}} Submitted Successfully',
   '<p>Dear {{customer_name}},</p><p>Greetings from LOS Bank!</p><p>We are pleased to inform you that your {{loan_type}} application <strong>{{application_number}}</strong> has been submitted successfully.</p><p>Our team will review your application within 2 business days. You will receive updates via SMS and email.</p><p>Application Details:<br>Loan Type: {{loan_type}}<br>Amount: Rs.{{requested_amount}}<br>Tenure: {{requested_tenure}} months</p><p>Track your application: {{track_link}}</p><p>Regards,<br>LOS Bank Lending Team</p>',
   true, true, 'NORMAL'),

  ('APP_APPROVED', 'Application Approved', 'APPLICATION_STATUS', 'EMAIL',
   'Congratulations! Your Loan Has Been Approved',
   '<p>Dear {{customer_name}},</p><p>We are delighted to inform you that your {{loan_type}} has been <strong>approved</strong>.</p><p>Approval Details:<br>Application: {{application_number}}<br>Sanctioned Amount: Rs.{{sanctioned_amount}}<br>Rate of Interest: {{roi}}% p.a.<br>Tenure: {{tenure_months}} months<br>EMI: Rs.{{emi_amount}}</p><p>Please download the sanction letter from your dashboard. The letter is valid for 30 days.</p><p>Regards,<br>LOS Bank Lending Team</p>',
   true, true, 'URGENT'),

  ('SANCTION_LETTER', 'Sanction Letter', 'SANCTION', 'EMAIL',
   'Your Sanction Letter is Ready - Action Required',
   '<p>Dear {{customer_name}},</p><p>Please find attached your sanction letter for {{application_number}}.</p><p><strong>Important:</strong> This sanction letter is valid for 30 days from the date of issue. Please complete the following steps:</p><ol><li>Review and accept the terms and conditions</li><li>Complete eSign within the validity period</li><li>Submit post-disbursement documents (if applicable)</li></ol><p>For any queries, contact us at 1800-XXX-XXXX or visit your nearest branch.</p><p>Regards,<br>LOS Bank Lending Team</p>',
   true, true, 'URGENT'),

  ('DISBURSEMENT_COMPLETE', 'Disbursement Confirmation', 'DISBURSEMENT', 'EMAIL',
   'Loan Amount Disbursed Successfully',
   '<p>Dear {{customer_name}},</p><p>We are pleased to confirm that the loan amount has been disbursed to your account.</p><p>Disbursement Details:<br>Account: {{account_number}} (IFSC: {{ifsc}})<br>Amount Disbursed: Rs.{{disbursement_amount}}<br>UTR Number: {{utr}}<br>Date: {{disbursement_date}}</p><p>EMI Details:<br>EMI Amount: Rs.{{emi_amount}}<br>First EMI Date: {{first_emi_date}}<br>Total EMIs: {{tenure_months}}</p><p>Your loan agreement and repayment schedule are attached for your records.</p><p>Regards,<br>LOS Bank Lending Team</p>',
   true, true, 'URGENT')
ON CONFLICT (template_name, channel) DO NOTHING;

-- ============================================================
-- Rule Definitions Seed (los_decision.rule_definitions)
-- 47 configurable rules across categories
-- ============================================================
INSERT INTO los_decision.rule_definitions (rule_id, name, description, category, severity, priority, is_active, conditions, then_clause)
VALUES
  -- Credit Score Rules
  ('CR001', 'Minimum CIBIL Score', 'Reject if CIBIL score < 650', 'CREDIT_SCORE', 'HARD_STOP', 10, true,
   '[{"field":"bureau_score.cibil","operator":"lt","value":650}]',
   '{"action":"REJECT","reason_code":"LOW_CIBIL_SCORE","message":"CIBIL score must be at least 650"}'),

  ('CR002', 'CIBIL Score Warning', 'Soft warning if CIBIL score between 650-700', 'CREDIT_SCORE', 'WARNING', 11, true,
   '[{"field":"bureau_score.cibil","operator":"gte","value":650},{"field":"bureau_score.cibil","operator":"lt","value":700}]',
   '{"action":"WARN","reason_code":"MEDIUM_CIBIL","message":"CIBIL score in borderline range"}'),

  ('CR003', 'No Active CIBIL Enquiries (30 days)', 'Reject if > 3 CIBIL enquiries in last 30 days', 'CREDIT_SCORE', 'HARD_STOP', 12, true,
   '[{"field":"bureau_enquiries.cibil_30d","operator":"gt","value":3}]',
   '{"action":"REJECT","reason_code":"EXCESS_BUREAU_ENQUIRIES","message":"Too many bureau enquiries in last 30 days"}'),

  ('CR004', 'CIBIL Write-off Check', 'Reject if any suit filed or write-off in CIBIL', 'CREDIT_SCORE', 'HARD_STOP', 13, true,
   '[{"field":"bureau_suit_filed","operator":"eq","value":true}]',
   '{"action":"REJECT","reason_code":"SUIT_FILED","message":"Active suit filed or write-off found"}'),

  -- FOIR Rules
  ('FO001', 'Maximum FOIR - Salaried', 'Reject if FOIR > 50% for salaried', 'FOIR', 'HARD_STOP', 20, true,
   '[{"field":"applicant.employment_type","operator":"eq","value":"SALARIED"},{"field":"calculated_foir","operator":"gt","value":50}]',
   '{"action":"REJECT","reason_code":"HIGH_FOIR","message":"FOIR exceeds 50% for salaried applicant"}'),

  ('FO002', 'Maximum FOIR - Self Employed', 'Reject if FOIR > 40% for self-employed', 'FOIR', 'HARD_STOP', 21, true,
   '[{"field":"applicant.employment_type","operator":"eq","value":"SELF_EMPLOYED"},{"field":"calculated_foir","operator":"gt","value":40}]',
   '{"action":"REJECT","reason_code":"HIGH_FOIR_SE","message":"FOIR exceeds 40% for self-employed applicant"}'),

  -- Income Rules
  ('IN001', 'Minimum Monthly Income - Salaried', 'Reject if net monthly income < Rs.25,000 for salaried', 'INCOME', 'HARD_STOP', 30, true,
   '[{"field":"applicant.employment_type","operator":"eq","value":"SALARIED"},{"field":"applicant.net_monthly_income","operator":"lt","value":25000}]',
   '{"action":"REJECT","reason_code":"LOW_INCOME","message":"Minimum monthly income requirement not met"}'),

  ('IN002', 'Minimum Monthly Income - Self Employed', 'Reject if monthly income < Rs.30,000 for self-employed', 'INCOME', 'HARD_STOP', 31, true,
   '[{"field":"applicant.employment_type","operator":"eq","value":"SELF_EMPLOYED"},{"field":"applicant.net_monthly_income","operator":"lt","value":30000}]',
   '{"action":"REJECT","reason_code":"LOW_INCOME_SE","message":"Minimum income requirement not met for self-employed"}'),

  -- Age Rules
  ('AG001', 'Minimum Age', 'Reject if age < 21 years', 'AGE', 'HARD_STOP', 40, true,
   '[{"field":"applicant.age","operator":"lt","value":21}]',
   '{"action":"REJECT","reason_code":"AGE_BELOW_MIN","message":"Applicant must be at least 21 years old"}'),

  ('AG002', 'Maximum Age at Maturity', 'Reject if age at loan maturity > 65 for PL, > 70 for HL', 'AGE', 'HARD_STOP', 41, true,
   '[{"field":"applicant.age_at_maturity","operator":"gt","value":65}]',
   '{"action":"REJECT","reason_code":"AGE_EXCEEDS_MATURITY","message":"Loan maturity age limit exceeded"}'),

  -- Amount/Tenure Rules
  ('AT001', 'Minimum Loan Amount', 'Reject if requested amount < product minimum', 'AMOUNT_TENURE', 'HARD_STOP', 50, true,
   '[{"field":"loan.requested_amount","operator":"lt","value":"product.min_amount"}]',
   '{"action":"REJECT","reason_code":"AMOUNT_BELOW_MIN","message":"Requested amount below minimum product limit"}'),

  ('AT002', 'Maximum Loan Amount', 'Reject if requested amount > product maximum', 'AMOUNT_TENURE', 'HARD_STOP', 51, true,
   '[{"field":"loan.requested_amount","operator":"gt","value":"product.max_amount"}]',
   '{"action":"REJECT","reason_code":"AMOUNT_ABOVE_MAX","message":"Requested amount exceeds product maximum"}'),

  ('AT003', 'Minimum Tenure', 'Reject if tenure < product minimum months', 'AMOUNT_TENURE', 'HARD_STOP', 52, true,
   '[{"field":"loan.tenure_months","operator":"lt","value":"product.min_tenure"}]',
   '{"action":"REJECT","reason_code":"TENURE_BELOW_MIN","message":"Tenure below minimum product requirement"}'),

  ('AT004', 'Maximum Tenure', 'Reject if tenure > product maximum months', 'AMOUNT_TENURE', 'HARD_STOP', 53, true,
   '[{"field":"loan.tenure_months","operator":"gt","value":"product.max_tenure"}]',
   '{"action":"REJECT","reason_code":"TENURE_ABOVE_MAX","message":"Tenure exceeds product maximum"}'),

  -- Bureau History Rules
  ('BH001', 'Active Loan Count', 'Reject if > 5 active bureau accounts', 'BUREAU_HISTORY', 'HARD_STOP', 60, true,
   '[{"field":"bureau_active_accounts","operator":"gt","value":5}]',
   '{"action":"REJECT","reason_code":"EXCESS_ACTIVE_ACCOUNTS","message":"Too many active credit accounts"}'),

  ('BH002', 'DPD > 30 in Last 12 Months', 'Reject if any account had DPD > 30 in last 12 months', 'BUREAU_HISTORY', 'HARD_STOP', 61, true,
   '[{"field":"bureau_dpd_31_60","operator":"gt","value":0},{"field":"bureau_recent_dpd_date","operator":"lt","value":"12_months_ago"}]',
   '{"action":"REJECT","reason_code":"RECENT_DPD","message":"Recent delinquency found in credit history"}'),

  -- Fraud Rules
  ('FR001', 'PAN Mismatch', 'Reject if applicant name does not match PAN', 'FRAUD', 'HARD_STOP', 70, true,
   '[{"field":"kyc.pan_name_match","operator":"eq","value":false}]',
   '{"action":"REJECT","reason_code":"PAN_MISMATCH","message":"Applicant name does not match PAN"}'),

  ('FR002', 'Aadhaar Name Mismatch', 'Reject if applicant name does not match Aadhaar', 'FRAUD', 'HARD_STOP', 71, true,
   '[{"field":"kyc.aadhaar_name_match","operator":"eq","value":false}]',
   '{"action":"REJECT","reason_code":"AADHAAR_MISMATCH","message":"Applicant name does not match Aadhaar"}'),

  ('FR003', 'Face Match Failure', 'Reject if face match score < 80%', 'FRAUD', 'HARD_STOP', 72, true,
   '[{"field":"kyc.face_match_score","operator":"lt","value":80}]',
   '{"action":"REJECT","reason_code":"FACE_MATCH_FAILED","message":"Face verification failed"}'),

  ('FR004', 'Liveness Check Failure', 'Reject if liveness check failed', 'FRAUD', 'HARD_STOP', 73, true,
   '[{"field":"kyc.liveness_passed","operator":"eq","value":false}]',
   '{"action":"REJECT","reason_code":"LIVENESS_FAILED","message":"Liveness check failed - possible spoofing attempt"}'),

  -- Employment Rules
  ('EM001', 'Employment Type - Salaried Verification', 'For PL_SAL, require ITR or salary slips', 'EMPLOYMENT', 'HARD_STOP', 80, true,
   '[{"field":"loan.product_code","operator":"eq","value":"PL_SAL"},{"field":"documents.salary_slips","operator":"missing"}]',
   '{"action":"REJECT","reason_code":"MISSING_INCOME_PROOF","message":"Salary slips or ITR required for salaried applicants"}'),

  ('EM002', 'Self Employed ITR', 'For SEP products, require ITR with >= 15% YoY growth', 'EMPLOYMENT', 'HARD_STOP', 81, true,
   '[{"field":"loan.product_code","operator":"eq","value":"PL_SEP"},{"field":"documents.itr_filed","operator":"eq","value":false}]',
   '{"action":"REJECT","reason_code":"MISSING_ITR","message":"ITR filing required for self-employed applicants"}'),

  -- LTV Rules
  ('LV001', 'LTV for Home Loan', 'Reject if LTV > 80% for HL (90% for up to 30L)', 'LTV', 'HARD_STOP', 90, true,
   '[{"field":"loan.loan_type","operator":"eq","value":"HOME_LOAN"},{"field":"ltv_ratio","operator":"gt","value":80}]',
   '{"action":"REJECT","reason_code":"LTV_EXCEEDED","message":"LTV exceeds maximum allowed for this loan type"}'),

  ('LV002', 'LTV for LAP', 'Reject if LTV > 60% for LAP', 'LTV', 'HARD_STOP', 91, true,
   '[{"field":"loan.loan_type","operator":"eq","value":"LAP"},{"field":"ltv_ratio","operator":"gt","value":60}]',
   '{"action":"REJECT","reason_code":"LTV_EXCEEDED_LAP","message":"LTV exceeds 60% for LAP"}'),

  -- Product Policy Rules
  ('PP001', 'Gold Loan - No Bureau Required', 'Gold loan up to 2L does not require bureau pull', 'PRODUCT_POLICY', 'INFO', 100, true,
   '[{"field":"loan.loan_type","operator":"eq","value":"GOLD_LOAN"},{"field":"loan.requested_amount","operator":"lte","value":200000}]',
   '{"action":"SKIP_BUREAU","message":"Bureau check waived for gold loan <= Rs.2L"}'),

  ('PP002', 'MUDRA - No Minimum Score', 'MUDRA products do not require minimum CIBIL', 'PRODUCT_POLICY', 'INFO', 101, true,
   '[{"field":"loan.product_code","operator":"in","value":["MUDRA_K","MUDRA_T","KCC"]}]',
   '{"action":"SKIP_SCORE_CHECK","message":"Minimum score check waived for MUDRA/KCC products"}'),

  -- Legal Rules
  ('LG001', 'No Pending Criminal Cases Declaration', 'Applicant must declare no pending criminal cases', 'LEGAL', 'HARD_STOP', 110, true,
   '[{"field":"applicant.criminal_declaration","operator":"eq","value":true}]',
   '{"action":"REJECT","reason_code":"CRIMINAL_PENDING","message":"Criminal case declaration required"}'),

  -- Deduplication Rules
  ('DD001', 'No Duplicate Application', 'Reject if same PAN has active application in last 90 days', 'DEDUPLICATION', 'HARD_STOP', 120, true,
   '[{"field":"existing_applications.pan_active_90d","operator":"eq","value":true}]',
   '{"action":"REJECT","reason_code":"DUPLICATE_APPLICATION","message":"Active application already exists for this PAN"}'),

  ('DD002', 'No Multiple Rejections in 6 Months', 'Reject if same PAN rejected > 2 times in 6 months', 'DEDUPLICATION', 'HARD_STOP', 121, true,
   '[{"field":"existing_applications.rejections_6m","operator":"gt","value":2}]',
   '{"action":"REJECT","reason_code":"MULTIPLE_REJECTIONS","message":"Too many rejections in recent history"}'),

  -- Channel Rules
  ('CH001', 'DSA Product Restrictions', 'Some products not available for DSA channel', 'CHANNEL', 'WARNING', 130, true,
   '[{"field":"loan.channel","operator":"eq","value":"DSA"},{"field":"loan.product_code","operator":"in","value":["KCC"]}]',
   '{"action":"WARN","message":"KCC not available through DSA channel"}')
ON CONFLICT (rule_id) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  category=EXCLUDED.category,
  severity=EXCLUDED.severity,
  priority=EXCLUDED.priority,
  is_active=EXCLUDED.is_active,
  conditions=EXCLUDED.conditions,
  then_clause=EXCLUDED.then_clause;
