-- ============================================================
-- LOS Platform — Seed: Audit Logs (los_shared.audit_logs)
-- 25+ entries across all services for compliance testing
-- ============================================================

INSERT INTO los_shared.audit_logs (
  id, event_id, event_category, event_type, entity_type, entity_id,
  actor_id, actor_role, actor_ip_address,
  before_state, after_state,
  metadata, success, error_message,
  created_at
) VALUES
  -- Auth events
  (
    gen_random_uuid(), gen_random_uuid(),
    'AUTH', 'LOGIN_SUCCESS', 'User', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'LOAN_OFFICER', '127.0.0.1',
    NULL, '{"loginAt":"' || (NOW() - INTERVAL '2 hours')::text || '"}',
    '{"userAgent":"Mozilla/5.0","deviceFingerprint":"fp-001"}', true, NULL,
    NOW() - INTERVAL '2 hours'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'AUTH', 'OTP_REQUEST', 'OTP', 'otp-session-001',
    NULL, NULL, '127.0.0.1',
    NULL, '{"mobile":"9999999991","channel":"SMS"}',
    '{"purpose":"LOGIN"}', true, NULL,
    NOW() - INTERVAL '2 hours'
  ),

  -- Application events
  (
    gen_random_uuid(), gen_random_uuid(),
    'APPLICATION', 'APPLICATION_CREATED', 'LoanApplication', '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111', 'LOAN_OFFICER', '127.0.0.1',
    NULL, '{"status":"DRAFT","loanType":"HOME_LOAN","amount":2500000}',
    '{"channel":"DSA","dsaCode":"DSA001"}', true, NULL,
    NOW() - INTERVAL '7 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'APPLICATION', 'APPLICATION_SUBMITTED', 'LoanApplication', '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111', 'LOAN_OFFICER', '127.0.0.1',
    '{"status":"DRAFT"}', '{"status":"SUBMITTED"}',
    '{"applicationNumber":"LOS-2024-DL-00003"}', true, NULL,
    NOW() - INTERVAL '6 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'APPLICATION', 'STATUS_CHANGE', 'LoanApplication', '88888888-8888-8888-8888-888888888888',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'CREDIT_ANALYST', '127.0.0.1',
    '{"status":"CREDIT_COMMITTEE"}', '{"status":"APPROVED"}',
    '{"remarks":"Score 720, FOIR 36%, clean bureau"}', true, NULL,
    NOW() - INTERVAL '3 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'APPLICATION', 'STATUS_CHANGE', 'LoanApplication', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 'BRANCH_MANAGER', '127.0.0.1',
    '{"status":"APPROVED"}', '{"status":"SANCTIONED"}',
    '{"sanctionedAmount":250000,"roi":10.5,"tenure":24}', true, NULL,
    NOW() - INTERVAL '2 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'APPLICATION', 'STATUS_CHANGE', 'LoanApplication', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 'BRANCH_MANAGER', '127.0.0.1',
    '{"status":"SANCTIONED"}', '{"status":"DISBURSEMENT_IN_PROGRESS"}',
    '{"nachMandateId":"NACH-REF-PRAKASH-001"}', true, NULL,
    NOW() - INTERVAL '6 hours'
  ),

  -- Rejection event
  (
    gen_random_uuid(), gen_random_uuid(),
    'APPLICATION', 'APPLICATION_REJECTED', 'LoanApplication', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'CREDIT_ANALYST', '127.0.0.1',
    '{"status":"CREDIT_ASSESSMENT"}', '{"status":"REJECTED"}',
    '{"reasonCode":"LOW_CIBIL_SCORE","remarks":"Score 580 below threshold"}', true, NULL,
    NOW() - INTERVAL '30 days'
  ),

  -- Cooling-off cancellation events
  (
    gen_random_uuid(), gen_random_uuid(),
    'APPLICATION', 'CANCELLATION_WINDOW_INITIATED', 'LoanApplication', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'APPLICANT', '127.0.0.1',
    '{"status":"SANCTIONED"}', '{"status":"CANCELLATION_WINDOW","deadline":"' || (NOW() + INTERVAL '71 hours')::text || '"}',
    '{"reason":"Changed my mind about the loan terms","coolingOffDays":3}', true, NULL,
    NOW() - INTERVAL '3 hours'
  ),

  -- KYC events
  (
    gen_random_uuid(), gen_random_uuid(),
    'KYC', 'AADHAAR_OTP_INITIATED', 'KYC', 'kyc-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111', 'LOAN_OFFICER', '127.0.0.1',
    NULL, '{"aadhaarMasked":"XXXX-XXXX-7842"}',
    '{"method":"eKYC"}', true, NULL,
    NOW() - INTERVAL '14 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'KYC', 'AADHAAR_VERIFIED', 'KYC', 'kyc-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111', 'LOAN_OFFICER', '127.0.0.1',
    '{"status":"PENDING"}', '{"status":"VERIFIED"}',
    '{"consentObtained":true}', true, NULL,
    NOW() - INTERVAL '14 days'
  ),

  -- Bureau pull events
  (
    gen_random_uuid(), gen_random_uuid(),
    'BUREAU', 'BUREAU_PULL_SUCCESS', 'BureauReport', 'bureau-report-001',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'CREDIT_ANALYST', '127.0.0.1',
    NULL, '{"cibilScore":820,"totalAccounts":2}',
    '{"bureauType":"CIBIL","pan":"PANRK3333P"}', true, NULL,
    NOW() - INTERVAL '10 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'BUREAU', 'BUREAU_PULL_SUCCESS', 'BureauReport', 'bureau-report-002',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'CREDIT_ANALYST', '127.0.0.1',
    NULL, '{"cibilScore":580,"totalAccounts":2}',
    '{"bureauType":"CIBIL","pan":"PANAK14K14"}', true, NULL,
    NOW() - INTERVAL '44 days'
  ),

  -- Document events
  (
    gen_random_uuid(), gen_random_uuid(),
    'DOCUMENT', 'DOCUMENT_UPLOADED', 'Document', 'doc-001',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 'BRANCH_MANAGER', '127.0.0.1',
    NULL, '{"type":"INCOME","subtype":"SALARY_SLIP_3MONTHS","status":"UPLOADED"}',
    '{"fileName":"salary_slip.pdf","sizeBytes":321098}', true, NULL,
    NOW() - INTERVAL '18 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'DOCUMENT', 'DOCUMENT_APPROVED', 'Document', 'doc-001',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'CREDIT_ANALYST', '127.0.0.1',
    '{"status":"UPLOADED"}', '{"status":"APPROVED"}',
    '{"verifiedBy":"b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22"}', true, NULL,
    NOW() - INTERVAL '18 days'
  ),

  -- Decision events
  (
    gen_random_uuid(), gen_random_uuid(),
    'DECISION', 'DECISION_PROCESSED', 'DecisionResult', 'dec-001',
    'SYSTEM', 'SYSTEM', '127.0.0.1',
    NULL, '{"status":"APPROVED","score":725}',
    '{"applicationNumber":"LOS-2024-DL-00008","rulesEvaluated":47}', true, NULL,
    NOW() - INTERVAL '4 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'DECISION', 'DECISION_PROCESSED', 'DecisionResult', 'dec-002',
    'SYSTEM', 'SYSTEM', '127.0.0.1',
    NULL, '{"status":"REJECTED","reasonCode":"LOW_CIBIL_SCORE"}',
    '{"applicationNumber":"LOS-2024-DL-00014","rulesEvaluated":47}', true, NULL,
    NOW() - INTERVAL '30 days'
  ),

  -- Disbursement events
  (
    gen_random_uuid(), gen_random_uuid(),
    'DISBURSEMENT', 'DISBURSEMENT_INITIATED', 'Disbursement', 'disb-001',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 'BRANCH_MANAGER', '127.0.0.1',
    NULL, '{"status":"PROCESSING","type":"IMPS","amount":820000}',
    '{"accountNumber":"50200012345678","ifsc":"SBIN0001234"}', true, NULL,
    NOW() - INTERVAL '25 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'DISBURSEMENT', 'DISBURSEMENT_COMPLETE', 'Disbursement', 'disb-001',
    'SYSTEM', 'SYSTEM', '127.0.0.1',
    '{"status":"PROCESSING"}', '{"status":"DISBURSED"}',
    '{"utr":"UTR5IMPS240915000001","npciRef":"NPCI-REF-2024-09-15-001"}', true, NULL,
    NOW() - INTERVAL '25 days'
  ),

  -- Compliance access events
  (
    gen_random_uuid(), gen_random_uuid(),
    'COMPLIANCE', 'AUDIT_EXPORT', 'AuditLog', NULL,
    'd3hhef22-2f3e-7hi1-ee0g-9ee2eg613d44', 'COMPLIANCE_OFFICER', '127.0.0.1',
    NULL, NULL,
    '{"exportFormat":"CSV","recordCount":150,"dateRange":"2024-01-01 to 2024-09-15"}', true, NULL,
    NOW() - INTERVAL '5 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'COMPLIANCE', 'AUDIT_READ', 'AuditLog', NULL,
    'd3hhef22-2f3e-7hi1-ee0g-9ee2eg613d44', 'COMPLIANCE_OFFICER', '127.0.0.1',
    NULL, NULL,
    '{"filters":{"category":"APPLICATION","dateFrom":"2024-08-01"}}', true, NULL,
    NOW() - INTERVAL '1 day'
  ),

  -- Data access log (RBI PD)
  (
    gen_random_uuid(), gen_random_uuid(),
    'DATA_ACCESS', 'AADHAAR_ACCESSED', 'AadhaarKycResult', 'kyc-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111', 'LOAN_OFFICER', '127.0.0.1',
    NULL, NULL,
    '{"purpose":"LOAN_PROCESSING","consentId":"consent-001","accessType":"READ"}', true, NULL,
    NOW() - INTERVAL '6 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'DATA_ACCESS', 'AADHAAR_STORED_HASH', 'AadhaarKycResult', 'kyc-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111', 'LOAN_OFFICER', '127.0.0.1',
    NULL, NULL,
    '{"storage":"SHA256_HASH_ONLY","plaintextStored":false}', true, NULL,
    NOW() - INTERVAL '6 days'
  ),

  -- DSA events
  (
    gen_random_uuid(), gen_random_uuid(),
    'DSA', 'APPLICATION_REFERRED', 'DsaApplication', 'dsa-app-001',
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA001-OF01'),
    'LOAN_OFFICER', '127.0.0.1',
    NULL, '{"status":"SUBMITTED","applicationNumber":"LOS-2024-DL-00003"}',
    '{"loanType":"HOME_LOAN","amount":2500000}', true, NULL,
    NOW() - INTERVAL '7 days'
  ),
  (
    gen_random_uuid(), gen_random_uuid(),
    'DSA', 'COMMISSION_CALCULATED', 'DsaCommission', 'comm-001',
    'SYSTEM', 'SYSTEM', '127.0.0.1',
    NULL, '{"grossCommission":4510,"netCommission":3608,"rate":0.55}',
    '{"applicationNumber":"LOS-2024-DL-00013","sanctionedAmount":820000}', true, NULL,
    NOW() - INTERVAL '20 days'
  )
ON CONFLICT DO NOTHING;
