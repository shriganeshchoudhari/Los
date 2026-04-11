-- ============================================================
-- LOS Platform — Seed: DSA Partners + Officers (los_dsa)
-- ============================================================

INSERT INTO los_dsa.dsa_partners (
  id, partner_code, partner_name, partner_type,
  contact_person, contact_mobile, contact_email,
  registered_address, pan_number, gstin,
  status, agreement_signed_at, agreement_expiry,
  commission_rate_home_loan, commission_rate_pl,
  created_at, updated_at
) VALUES
  (
    gen_random_uuid(), 'DSA001', 'Premier Home Loans LLP',
    'PARTNERSHIP', 'Ramesh Gowda', '9880010001',
    'ramesh@premierhomeloans.in',
    '{"line1":"101 Main Road","city":"Bangalore","state":"KA","pincode":"560001"}',
    'AABFP1234B', '29AABFP1234B1ZA',
    'ACTIVE', NOW() - INTERVAL '180 days', NOW() + INTERVAL '185 days',
    0.75, 0.50,
    NOW() - INTERVAL '365 days', NOW()
  ),
  (
    gen_random_uuid(), 'DSA002', 'Easy Loans Pvt Ltd',
    'PRIVATE_LIMITED', 'Lakshmi Prasad', '9880010002',
    'lakshmi@easyloans.in',
    '{"line1":"202 Tech Park","city":"Bangalore","state":"KA","pincode":"560100"}',
    'AABCE1234C', '29AABCE1234B1ZB',
    'ACTIVE', NOW() - INTERVAL '90 days', NOW() + INTERVAL '275 days',
    0.80, 0.55,
    NOW() - INTERVAL '180 days', NOW()
  ),
  (
    gen_random_uuid(), 'DSA003', 'Quick Finance Associates',
    'PROPRIETORSHIP', 'Sunita Devi', '9880010003',
    'sunita@quickfinance.in',
    '{"line1":"35 Market Street","city":"Bangalore","state":"KA","pincode":"560002"}',
    'ABCFD1234D', '29ABCFD1234B1ZC',
    'ACTIVE', NOW() - INTERVAL '60 days', NOW() + INTERVAL '305 days',
    0.70, 0.45,
    NOW() - INTERVAL '120 days', NOW()
  )
ON CONFLICT (partner_code) DO NOTHING;

-- DSA Officers (employees of DSA partners)
INSERT INTO los_dsa.dsa_officers (
  id, partner_id, officer_code, full_name, mobile,
  email, designation, status, verification_status,
  aadhaar_hash, pan_number,
  created_at, updated_at
) VALUES
  -- Premier Home Loans officers
  (
    gen_random_uuid(), (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA001'),
    'DSA001-OF01', 'Venkatesh Murthy', '9880020001',
    'venkatesh@premierhomeloans.in', 'Senior Loan Advisor', 'ACTIVE',
    'VERIFIED', 'sha256_aadhaar_venkatesh', 'PANVM9999V',
    NOW() - INTERVAL '300 days', NOW()
  ),
  (
    gen_random_uuid(), (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA001'),
    'DSA001-OF02', 'Geetha Lakshmi', '9880020002',
    'geetha@premierhomeloans.in', 'Loan Advisor', 'ACTIVE',
    'VERIFIED', 'sha256_aadhaar_geetha', 'PANGL9999G',
    NOW() - INTERVAL '250 days', NOW()
  ),
  -- Easy Loans officers
  (
    gen_random_uuid(), (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA002'),
    'DSA002-OF01', 'Kiran Kumar', '9880030001',
    'kiran@easyloans.in', 'Senior Loan Consultant', 'ACTIVE',
    'VERIFIED', 'sha256_aadhaar_kiran', 'PANKK9999K',
    NOW() - INTERVAL '150 days', NOW()
  ),
  (
    gen_random_uuid(), (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA002'),
    'DSA002-OF02', 'Padma Venkat', '9880030002',
    'padma@easyloans.in', 'Loan Consultant', 'ACTIVE',
    'PENDING_VERIFICATION', 'sha256_aadhaar_padma', 'PANPV9999P',
    NOW() - INTERVAL '30 days', NOW()
  ),
  -- Quick Finance officer
  (
    gen_random_uuid(), (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA003'),
    'DSA003-OF01', 'Mohammed Ismail', '9880040001',
    'ismail@quickfinance.in', 'Finance Advisor', 'ACTIVE',
    'VERIFIED', 'sha256_aadhaar_ismail', 'PANMI9999M',
    NOW() - INTERVAL '100 days', NOW()
  )
ON CONFLICT (officer_code) DO NOTHING;

-- DSA Applications (submitted by DSA officers)
INSERT INTO los_dsa.dsa_applications (
  id, dsa_partner_id, dsa_officer_id, application_id,
  application_number, loan_type, requested_amount,
  applicant_name, applicant_mobile, applicant_pan_hash,
  status, submission_timestamp,
  created_at, updated_at
) VALUES
  (
    gen_random_uuid(),
    (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA001'),
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA001-OF01'),
    '33333333-3333-3333-3333-333333333333',
    'LOS-2024-DL-00003', 'HOME_LOAN', 2500000,
    'Rajesh Kumar', '9000010003', 'hash_mobile_003',
    'CONVERTED', NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA002'),
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA002-OF01'),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'LOS-2024-DL-00010', 'PERSONAL_LOAN', 250000,
    'Karthik Raja', '9000010010', 'hash_mobile_010',
    'CONVERTED', NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA003'),
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA003-OF01'),
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'LOS-2024-DL-00014', 'PERSONAL_LOAN', 200000,
    'Arun Kumar', '9000010014', 'hash_mobile_014',
    'REJECTED', NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '45 days', NOW()
  )
ON CONFLICT DO NOTHING;

-- Commission records
INSERT INTO los_dsa.dsa_commission (
  id, dsa_partner_id, dsa_officer_id, application_id,
  application_number, loan_type, sanctioned_amount,
  commission_rate, gross_commission, tds_deducted, net_commission,
  payment_status, disbursement_reference, disbursement_date,
  created_at, updated_at
) VALUES
  -- Sunita Rao: disbursed — commission paid
  (
    gen_random_uuid(),
    (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA002'),
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA002-OF01'),
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'LOS-2024-DL-00013', 'VEHICLE_LOAN_FOUR_WHEELER', 820000,
    0.55, 4510.00, 902.00, 3608.00,
    'PAID', 'DISB-LOS13-UTR123456', NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days', NOW()
  ),
  -- Another paid commission
  (
    gen_random_uuid(),
    (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA001'),
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA001-OF01'),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'LOS-2024-DL-00010', 'PERSONAL_LOAN', 250000,
    0.55, 1375.00, 275.00, 1100.00,
    'PENDING', NULL, NULL,
    NOW() - INTERVAL '2 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA001'),
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA001-OF01'),
    '33333333-3333-3333-3333-333333333333',
    'LOS-2024-DL-00003', 'HOME_LOAN', 2500000,
    0.75, 18750.00, 3750.00, 15000.00,
    'PENDING', NULL, NULL,
    NOW() - INTERVAL '3 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA002'),
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA002-OF01'),
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'LOS-2024-DL-00013', 'VEHICLE_LOAN_FOUR_WHEELER', 820000,
    0.55, 4510.00, 902.00, 3608.00,
    'PAID', 'DISB-LOS13-UTR789012', NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_dsa.dsa_partners WHERE partner_code='DSA003'),
    (SELECT id FROM los_dsa.dsa_officers WHERE officer_code='DSA003-OF01'),
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'LOS-2024-DL-00014', 'PERSONAL_LOAN', 200000,
    0.45, 900.00, 180.00, 720.00,
    'REJECTED_NO_COMMISSION', NULL, NULL,
    NOW() - INTERVAL '30 days', NOW()
  )
ON CONFLICT DO NOTHING;
