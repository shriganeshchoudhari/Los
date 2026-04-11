-- ============================================================
-- LOS Platform — Seed: Loan Applications (los_loan.loan_applications)
-- 15 applications across all lifecycle stages
-- ID format: uuid v4-like for seed data
-- ============================================================

-- Applicants table seed (simplified — applicant data stored in loan_applications JSONB)
INSERT INTO los_loan.loan_applications (
  id, application_number, status, loan_type, customer_segment, channel_code,
  branch_code, applicant_full_name, applicant_dob, applicant_mobile,
  applicant_mobile_hash, applicant_pan_hash, applicant_pan_encrypted,
  applicant_profile, employment_details, loan_requirement,
  user_id, requested_amount,
  dsa_code, dsa_name,
  created_at, updated_at
) VALUES
  -- DRAFT: Personal loan, just started
  (
    '11111111-1111-1111-1111-111111111111', 'LOS-2024-DL-00001', 'DRAFT',
    'PERSONAL_LOAN', 'RETAIL', 'ONLINE',
    'BLR001', 'Vikram Singh', '1990-05-15', '9000010001',
    'hash_mobile_001', 'PANPS1111W',
    '{"encrypted":true,"last4":"1111"}',
    '{"fullName":"Vikram Singh","dob":"1990-05-15","gender":"MALE","email":"vikram@example.com","pincode":"560001","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"TechCorp India Pvt Ltd","netMonthlyIncome":75000,"existingEmi":0}',
    '{"requestedAmount":300000,"tenureMonths":36,"purpose":"Home renovation","pincode":"560001"}',
    '11111111-1111-1111-1111-111111111111', 300000,
    NULL, NULL,
    NOW() - INTERVAL '5 days', NOW()
  ),

  -- SUBMITTED: KYC pending
  (
    '22222222-2222-2222-2222-222222222222', 'LOS-2024-DL-00002', 'SUBMITTED',
    'PERSONAL_LOAN', 'RETAIL', 'BRANCH',
    'BLR001', 'Anita Desai', '1988-03-22', '9000010002',
    'hash_mobile_002', 'PANAD2222F',
    '{"encrypted":true,"last4":"2222"}',
    '{"fullName":"Anita Desai","dob":"1988-03-22","gender":"FEMALE","email":"anita@example.com","pincode":"560002","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"FinServ Solutions","netMonthlyIncome":85000,"existingEmi":12000}',
    '{"requestedAmount":500000,"tenureMonths":48,"purpose":"Child education","pincode":"560002"}',
    '11111111-1111-1111-1111-111111111111', 500000,
    NULL, NULL,
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'
  ),

  -- KYC_COMPLETE: KYC done, docs pending
  (
    '33333333-3333-3333-3333-333333333333', 'LOS-2024-DL-00003', 'KYC_COMPLETE',
    'HOME_LOAN', 'RETAIL', 'DSA',
    'BLR002', 'Rajesh Kumar', '1985-08-10', '9000010003',
    'hash_mobile_003', 'PANRK3333P',
    '{"encrypted":true,"last4":"3333"}',
    '{"fullName":"Rajesh Kumar","dob":"1985-08-10","gender":"MALE","email":"rajesh@example.com","pincode":"560003","state":"KA"}',
    '{"employmentType":"SALARIED_GOVERNMENT","employerName":"Karnataka State Govt","netMonthlyIncome":120000,"existingEmi":0}',
    '{"requestedAmount":2500000,"tenureMonths":180,"purpose":"Purchase of flat","pincode":"560003","propertyValue":3500000}',
    '11111111-1111-1111-1111-111111111111', 2500000,
    'DSA001', 'Premier Home Loans',
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days'
  ),

  -- DOCUMENT_COLLECTION: docs partially uploaded
  (
    '44444444-4444-4444-4444-444444444444', 'LOS-2024-DL-00004', 'DOCUMENT_COLLECTION',
    'LOAN_AGAINST_PROPERTY', 'RETAIL', 'ONLINE',
    'BLR001', 'Meera Nair', '1992-01-18', '9000010004',
    'hash_mobile_004', 'PANMN4444A',
    '{"encrypted":true,"last4":"4444"}',
    '{"fullName":"Meera Nair","dob":"1992-01-18","gender":"FEMALE","email":"meera@example.com","pincode":"560004","state":"KA"}',
    '{"employmentType":"SELF_EMPLOYED_PROFESSIONAL","profession":"Doctor","annualIncome":1200000,"existingEmi":5000}',
    '{"requestedAmount":1500000,"tenureMonths":60,"purpose":"Business expansion","pincode":"560004","propertyValue":2500000}',
    '22222222-2222-2222-2222-222222222222', 1500000,
    NULL, NULL,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'
  ),

  -- CREDIT_ASSESSMENT: bureau pulled, under review
  (
    '55555555-5555-5555-5555-555555555555', 'LOS-2024-DL-00005', 'CREDIT_ASSESSMENT',
    'PERSONAL_LOAN', 'MSME', 'BRANCH',
    'BLR003', 'Suresh Patel', '1980-11-30', '9000010005',
    'hash_mobile_005', 'PANSP5555R',
    '{"encrypted":true,"last4":"5555"}',
    '{"fullName":"Suresh Patel","dob":"1980-11-30","gender":"MALE","email":"suresh@example.com","pincode":"560005","state":"KA"}',
    '{"employmentType":"SELF_EMPLOYED_BUSINESS","businessType":"Retail Trading","annualIncome":800000,"existingEmi":0}',
    '{"requestedAmount":800000,"tenureMonths":36,"purpose":"Working capital","pincode":"560005"}',
    '22222222-2222-2222-2222-222222222222', 800000,
    NULL, NULL,
    NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 hours'
  ),

  -- PENDING_FIELD_INVESTIGATION: field visit required
  (
    '66666666-6666-6666-6666-666666666666', 'LOS-2024-DL-00006', 'PENDING_FIELD_INVESTIGATION',
    'HOME_LOAN', 'RETAIL', 'BRANCH',
    'BLR002', 'Lakshmi Devi', '1987-06-25', '9000010006',
    'hash_mobile_006', 'PANLD6666G',
    '{"encrypted":true,"last4":"6666"}',
    '{"fullName":"Lakshmi Devi","dob":"1987-06-25","gender":"FEMALE","email":"lakshmi@example.com","pincode":"560006","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"IT Solutions Ltd","netMonthlyIncome":95000,"existingEmi":0}',
    '{"requestedAmount":3200000,"tenureMonths":240,"purpose":"Home purchase","pincode":"560006","propertyValue":4500000}',
    '22222222-2222-2222-2222-222222222222', 3200000,
    NULL, NULL,
    NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days'
  ),

  -- CREDIT_COMMITTEE: awaiting committee approval
  (
    '77777777-7777-7777-7777-777777777777', 'LOS-2024-DL-00007', 'CREDIT_COMMITTEE',
    'MSME_TERM_LOAN', 'MSME', 'BRANCH',
    'BLR001', 'Ganesh Enterprises', '2015-04-01', '9000010007',
    'hash_mobile_007', 'PANGE7777B',
    '{"encrypted":true,"last4":"7777"}',
    '{"fullName":"Ganesh Enterprises","dob":"2015-04-01","gender":"MALE","email":"ganesh@example.com","pincode":"560007","state":"KA","entityType":"PARTNERSHIP"}',
    '{"employmentType":"SELF_EMPLOYED_BUSINESS","businessType":"Manufacturing","annualIncome":2400000,"existingEmi":150000}',
    '{"requestedAmount":5000000,"tenureMonths":60,"purpose":"Machinery purchase","pincode":"560007"}',
    '22222222-2222-2222-2222-222222222222', 5000000,
    NULL, NULL,
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '1 day'
  ),

  -- APPROVED: waiting for manager sanction
  (
    '88888888-8888-8888-8888-888888888888', 'LOS-2024-DL-00008', 'APPROVED',
    'PERSONAL_LOAN', 'RETAIL', 'ONLINE',
    'BLR001', 'Harish Iyer', '1993-09-14', '9000010008',
    'hash_mobile_008', 'PANHI8888M',
    '{"encrypted":true,"last4":"8888"}',
    '{"fullName":"Harish Iyer","dob":"1993-09-14","gender":"MALE","email":"harish@example.com","pincode":"560008","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"DataFlow Systems","netMonthlyIncome":110000,"existingEmi":0}',
    '{"requestedAmount":400000,"tenureMonths":36,"purpose":"Vacation","pincode":"560008"}',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 400000,
    NULL, NULL,
    NOW() - INTERVAL '18 days', NOW() - INTERVAL '3 days'
  ),

  -- CONDITIONALLY_APPROVED: pending additional docs
  (
    '99999999-9999-9999-9999-999999999999', 'LOS-2024-DL-00009', 'CONDITIONALLY_APPROVED',
    'EDUCATION_LOAN', 'RETAIL', 'BRANCH',
    'BLR002', 'Divya Krishnan', '2001-02-28', '9000010009',
    'hash_mobile_009', 'PANDK9999V',
    '{"encrypted":true,"last4":"9999"}',
    '{"fullName":"Divya Krishnan","dob":"2001-02-28","gender":"FEMALE","email":"divya@example.com","pincode":"560009","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"Student (Course: MBA)","netMonthlyIncome":0,"coApplicantIncome":80000}',
    '{"requestedAmount":800000,"tenureMonths":60,"purpose":"MBA abroad","pincode":"560009","courseFees":1200000}',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 800000,
    NULL, NULL,
    NOW() - INTERVAL '22 days', NOW() - INTERVAL '1 day'
  ),

  -- SANCTIONED: awaiting disbursement
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'LOS-2024-DL-00010', 'SANCTIONED',
    'PERSONAL_LOAN', 'RETAIL', 'DSA',
    'BLR001', 'Karthik Raja', '1989-12-05', '9000010010',
    'hash_mobile_010', 'PANKR10X10',
    '{"encrypted":true,"last4":"1010"}',
    '{"fullName":"Karthik Raja","dob":"1989-12-05","gender":"MALE","email":"karthik@example.com","pincode":"560010","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"CloudNine Tech","netMonthlyIncome":90000,"existingEmi":0}',
    '{"requestedAmount":250000,"tenureMonths":24,"purpose":"Debt consolidation","pincode":"560010"}',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 250000,
    'DSA002', 'Easy Loans Pvt Ltd',
    NOW() - INTERVAL '25 days', NOW() - INTERVAL '1 day'
  ),

  -- SANCTIONED + UNDER CANCELLATION WINDOW (cooling-off)
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'LOS-2024-DL-00011', 'CANCELLATION_WINDOW',
    'PERSONAL_LOAN', 'RETAIL', 'ONLINE',
    'BLR001', 'Nisha Menon', '1995-07-20', '9000010011',
    'hash_mobile_011', 'PANNM11Y11',
    '{"encrypted":true,"last4":"1111"}',
    '{"fullName":"Nisha Menon","dob":"1995-07-20","gender":"FEMALE","email":"nisha@example.com","pincode":"560011","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"RetailCo India","netMonthlyIncome":45000,"existingEmi":0}',
    '{"requestedAmount":40000,"tenureMonths":12,"purpose":"Appliance purchase","pincode":"560011"}',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 40000,
    NULL, NULL,
    NOW() - INTERVAL '30 days', NOW() - INTERVAL '3 hours'
  ),

  -- DISBURSEMENT_IN_PROGRESS
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOS-2024-DL-00012', 'DISBURSEMENT_IN_PROGRESS',
    'HOME_LOAN', 'RETAIL', 'BRANCH',
    'BLR002', 'Prakash Reddy', '1982-04-12', '9000010012',
    'hash_mobile_012', 'PANPR12R12',
    '{"encrypted":true,"last4":"1212"}',
    '{"fullName":"Prakash Reddy","dob":"1982-04-12","gender":"MALE","email":"prakash@example.com","pincode":"560012","state":"KA"}',
    '{"employmentType":"SALARIED_GOVERNMENT","employerName":"Central Government","netMonthlyIncome":150000,"existingEmi":20000}',
    '{"requestedAmount":4500000,"tenureMonths":180,"purpose":"Home construction","pincode":"560012","propertyValue":6000000}',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 4500000,
    NULL, NULL,
    NOW() - INTERVAL '35 days', NOW() - INTERVAL '6 hours'
  ),

  -- DISBURSED: active loan
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd', 'LOS-2024-DL-00013', 'DISBURSED',
    'VEHICLE_LOAN_FOUR_WHEELER', 'RETAIL', 'ONLINE',
    'BLR001', 'Sunita Rao', '1991-10-08', '9000010013',
    'hash_mobile_013', 'PANSR13S13',
    '{"encrypted":true,"last4":"1313"}',
    '{"fullName":"Sunita Rao","dob":"1991-10-08","gender":"FEMALE","email":"sunita@example.com","pincode":"560013","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"PharmaCare Ltd","netMonthlyIncome":65000,"existingEmi":0}',
    '{"requestedAmount":850000,"tenureMonths":60,"purpose":"Car purchase","pincode":"560013"}',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 850000,
    NULL, NULL,
    NOW() - INTERVAL '60 days', NOW() - INTERVAL '25 days'
  ),

  -- REJECTED
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'LOS-2024-DL-00014', 'REJECTED',
    'PERSONAL_LOAN', 'RETAIL', 'DSA',
    'BLR001', 'Arun Kumar', '1988-01-15', '9000010014',
    'hash_mobile_014', 'PANAK14K14',
    '{"encrypted":true,"last4":"1414"}',
    '{"fullName":"Arun Kumar","dob":"1988-01-15","gender":"MALE","email":"arun@example.com","pincode":"560014","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"Unknown Corp","netMonthlyIncome":25000,"existingEmi":0}',
    '{"requestedAmount":200000,"tenureMonths":24,"purpose":"Medical emergency","pincode":"560014"}',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 200000,
    'DSA003', 'Quick Finance',
    NOW() - INTERVAL '45 days', NOW() - INTERVAL '30 days'
  ),

  -- CLOSED: completed loan
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff', 'LOS-2024-DL-00015', 'CLOSED',
    'PERSONAL_LOAN', 'RETAIL', 'BRANCH',
    'BLR003', 'Madhav Bhat', '1986-03-30', '9000010015',
    'hash_mobile_015', 'PANMB15B15',
    '{"encrypted":true,"last4":"1515"}',
    '{"fullName":"Madhav Bhat","dob":"1986-03-30","gender":"MALE","email":"madhav@example.com","pincode":"560015","state":"KA"}',
    '{"employmentType":"SALARIED_PRIVATE","employerName":"TechServe Inc","netMonthlyIncome":55000,"existingEmi":0}',
    '{"requestedAmount":150000,"tenureMonths":24,"purpose":"Home appliance","pincode":"560015"}',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 150000,
    NULL, NULL,
    NOW() - INTERVAL '90 days', NOW() - INTERVAL '30 days'
  )
ON CONFLICT (application_number) DO NOTHING;

-- Sanction details for sanctioned/approved apps
UPDATE los_loan.loan_applications
SET
  sanctioned_amount = CASE application_number
    WHEN 'LOS-2024-DL-00010' THEN 250000
    WHEN 'LOS-2024-DL-00011' THEN 38000
    WHEN 'LOS-2024-DL-00012' THEN 4200000
    WHEN 'LOS-2024-DL-00013' THEN 820000
    ELSE NULL
  END,
  sanctioned_roi_bps = CASE application_number
    WHEN 'LOS-2024-DL-00010' THEN 1050
    WHEN 'LOS-2024-DL-00011' THEN 1490
    WHEN 'LOS-2024-DL-00012' THEN 825
    WHEN 'LOS-2024-DL-00013' THEN 980
    ELSE NULL
  END,
  sanctioned_tenure_months = CASE application_number
    WHEN 'LOS-2024-DL-00010' THEN 24
    WHEN 'LOS-2024-DL-00011' THEN 12
    WHEN 'LOS-2024-DL-00012' THEN 180
    WHEN 'LOS-2024-DL-00013' THEN 60
    ELSE NULL
  END,
  sanctioned_at = CASE application_number
    WHEN 'LOS-2024-DL-00010' THEN NOW() - INTERVAL '2 days'
    WHEN 'LOS-2024-DL-00011' THEN NOW() - INTERVAL '1 day'
    WHEN 'LOS-2024-DL-00012' THEN NOW() - INTERVAL '2 days'
    WHEN 'LOS-2024-DL-00013' THEN NOW() - INTERVAL '30 days'
    ELSE NULL
  END
WHERE application_number IN (
  'LOS-2024-DL-00010', 'LOS-2024-DL-00011', 'LOS-2024-DL-00012', 'LOS-2024-DL-00013'
);

-- Cancellation window data for LOS-2024-DL-00011
UPDATE los_loan.loan_applications
SET
  cancellation_window_initiated_at = NOW() - INTERVAL '3 hours',
  cancellation_window_deadline = NOW() + INTERVAL '71 hours',
  cancellation_reason = 'Changed my mind about the loan terms',
  cancellation_by_user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  cancellation_by_role = 'APPLICANT'
WHERE application_number = 'LOS-2024-DL-00011';

-- Disbursement data for disbursed loan
UPDATE los_loan.loan_applications
SET
  disbursed_at = NOW() - INTERVAL '25 days'
WHERE application_number = 'LOS-2024-DL-00013';

-- Rejection details
UPDATE los_loan.loan_applications
SET
  rejection_reason_code = 'LOW_CIBIL_SCORE',
  rejection_remarks = 'CIBIL score 580 is below minimum threshold of 650. Multiple DPD violations found in credit history.'
WHERE application_number = 'LOS-2024-DL-00014';

-- Stage history for key applications
INSERT INTO los_loan.application_stage_history (
  id, application_id, application_number, from_status, to_status,
  actor_id, actor_role, remarks, changed_at
) VALUES
  (
    gen_random_uuid(), '88888888-8888-8888-8888-888888888888',
    'LOS-2024-DL-00008', 'CREDIT_COMMITTEE', 'APPROVED',
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'CREDIT_ANALYST',
    'Credit score 720, FOIR 42%, clean bureau. Approved with standard terms.',
    NOW() - INTERVAL '3 days'
  ),
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'LOS-2024-DL-00010', 'APPROVED', 'SANCTIONED',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 'BRANCH_MANAGER',
    'Sanction letter issued. Standard ROI 10.50% p.a. Tenure 24 months.',
    NOW() - INTERVAL '2 days'
  ),
  (
    gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'LOS-2024-DL-00012', 'SANCTIONED', 'DISBURSEMENT_IN_PROGRESS',
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 'BRANCH_MANAGER',
    'NACH mandate registered. Disbursement initiated.',
    NOW() - INTERVAL '6 hours'
  )
ON CONFLICT DO NOTHING;
