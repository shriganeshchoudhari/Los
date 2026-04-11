-- ============================================================
-- LOS Platform — Seed: KYC Records (los_kyc.kyc_records)
-- KYC + consent for all loan applicants
-- ============================================================

INSERT INTO los_kyc.kyc_records (
  id, application_id, applicant_aadhaar_hash, applicant_name,
  date_of_birth, gender, mobile, address,
  kyc_status, verification_method, verified_at,
  consent_obtained, consent_timestamp, consent_ip_address,
  created_at, updated_at
) VALUES
  -- Rajesh Kumar: HOME_LOAN, KYC complete
  (
    'kyc-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'sha256_aadhaar_rajesh',
    'Rajesh Kumar',
    '1985-08-10', 'MALE', '9000010003',
    '{"line1":"12 MG Road","city":"Bangalore","state":"KA","pincode":"560001"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '6 days',
    true, NOW() - INTERVAL '6 days', '127.0.0.1',
    NOW() - INTERVAL '6 days', NOW()
  ),

  -- Meera Nair: LAP, KYC complete
  (
    'kyc-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444444',
    'sha256_aadhaar_meera',
    'Meera Nair',
    '1992-01-18', 'FEMALE', '9000010004',
    '{"line1":"45 Indiranagar","city":"Bangalore","state":"KA","pincode":"560008"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '9 days',
    true, NOW() - INTERVAL '9 days', '127.0.0.1',
    NOW() - INTERVAL '9 days', NOW()
  ),

  -- Suresh Patel: MSME, KYC complete
  (
    'kyc-3333-3333-3333-333333333333',
    '55555555-5555-5555-5555-555555555555',
    'sha256_aadhaar_suresh',
    'Suresh Patel',
    '1980-11-30', 'MALE', '9000010005',
    '{"line1":"78 Commercial St","city":"Bangalore","state":"KA","pincode":"560001"}',
    'VERIFIED', 'DIGILOCKER', NOW() - INTERVAL '11 days',
    true, NOW() - INTERVAL '11 days', '127.0.0.1',
    NOW() - INTERVAL '11 days', NOW()
  ),

  -- Lakshmi Devi: HOME_LOAN, KYC complete
  (
    'kyc-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    'sha256_aadhaar_lakshmi',
    'Lakshmi Devi',
    '1987-06-25', 'FEMALE', '9000010006',
    '{"line1":"23 Whitefield","city":"Bangalore","state":"KA","pincode":"560037"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '14 days',
    true, NOW() - INTERVAL '14 days', '127.0.0.1',
    NOW() - INTERVAL '14 days', NOW()
  ),

  -- Harish Iyer: APPROVED, KYC complete
  (
    'kyc-5555-5555-5555-555555555555',
    '88888888-8888-8888-8888-888888888888',
    'sha256_aadhaar_harish',
    'Harish Iyer',
    '1993-09-14', 'MALE', '9000010008',
    '{"line1":"56 Koramangala","city":"Bangalore","state":"KA","pincode":"560034"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '16 days',
    true, NOW() - INTERVAL '16 days', '127.0.0.1',
    NOW() - INTERVAL '16 days', NOW()
  ),

  -- Karthik Raja: SANCTIONED, KYC complete
  (
    'kyc-6666-6666-6666-666666666666',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'sha256_aadhaar_karthik',
    'Karthik Raja',
    '1989-12-05', 'MALE', '9000010010',
    '{"line1":"89 HSR Layout","city":"Bangalore","state":"KA","pincode":"560102"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '23 days',
    true, NOW() - INTERVAL '23 days', '127.0.0.1',
    NOW() - INTERVAL '23 days', NOW()
  ),

  -- Nisha Menon: CANCELLATION_WINDOW, KYC complete
  (
    'kyc-7777-7777-7777-777777777777',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'sha256_aadhaar_nisha',
    'Nisha Menon',
    '1995-07-20', 'FEMALE', '9000010011',
    '{"line1":"34 Jayanagar","city":"Bangalore","state":"KA","pincode":"560011"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '28 days',
    true, NOW() - INTERVAL '28 days', '127.0.0.1',
    NOW() - INTERVAL '28 days', NOW()
  ),

  -- Prakash Reddy: DISBURSEMENT_IN_PROGRESS, KYC complete
  (
    'kyc-8888-8888-8888-888888888888',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'sha256_aadhaar_prakash',
    'Prakash Reddy',
    '1982-04-12', 'MALE', '9000010012',
    '{"line1":"67 JP Nagar","city":"Bangalore","state":"KA","pincode":"560078"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '32 days',
    true, NOW() - INTERVAL '32 days', '127.0.0.1',
    NOW() - INTERVAL '32 days', NOW()
  ),

  -- Sunita Rao: DISBURSED, KYC complete
  (
    'kyc-9999-9999-9999-999999999999',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'sha256_aadhaar_sunita',
    'Sunita Rao',
    '1991-10-08', 'FEMALE', '9000010013',
    '{"line1":"11 MG Road","city":"Bangalore","state":"KA","pincode":"560001"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '58 days',
    true, NOW() - INTERVAL '58 days', '127.0.0.1',
    NOW() - INTERVAL '58 days', NOW()
  ),

  -- Arun Kumar: REJECTED, KYC complete but bureau failed
  (
    'kyc-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'sha256_aadhaar_arun',
    'Arun Kumar',
    '1988-01-15', 'MALE', '9000010014',
    '{"line1":"90 Shivajinagar","city":"Bangalore","state":"KA","pincode":"560001"}',
    'VERIFIED', 'AADHAAR_EKYC', NOW() - INTERVAL '43 days',
    true, NOW() - INTERVAL '43 days', '127.0.0.1',
    NOW() - INTERVAL '43 days', NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- PAN verification results
INSERT INTO los_kyc.pan_verification_results (
  id, application_id, kyc_record_id, pan_number,
  name_on_pan, name_match_score, verification_status,
  father_name, date_of_birth, verification_response,
  verified_at, created_at
) VALUES
  (
    gen_random_uuid(), '33333333-3333-3333-3333-333333333333',
    'kyc-1111-1111-1111-111111111111',
    'PANRK3333P', 'Rajesh Kumar', 95,
    'VERIFIED', 'Suresh Kumar', '1985-08-10',
    '{"xml":"<PanVerification><Status>VALID</Status><NameMatch>95</NameMatch></PanVerification>"}',
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'
  ),
  (
    gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
    'kyc-2222-2222-2222-222222222222',
    'PANMN4444A', 'Meera Nair', 92,
    'VERIFIED', 'Venkataraman Nair', '1992-01-18',
    '{"xml":"<PanVerification><Status>VALID</Status><NameMatch>92</NameMatch></PanVerification>"}',
    NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'
  ),
  (
    gen_random_uuid(), '88888888-8888-8888-8888-888888888888',
    'kyc-5555-5555-5555-555555555555',
    'PANHI8888M', 'Harish Iyer', 98,
    'VERIFIED', 'Ganesh Iyer', '1993-09-14',
    '{"xml":"<PanVerification><Status>VALID</Status><NameMatch>98</NameMatch></PanVerification>"}',
    NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'
  ),
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'kyc-6666-6666-6666-666666666666',
    'PANKR10X10', 'Karthik Raja', 94,
    'VERIFIED', 'Ravi Raja', '1989-12-05',
    '{"xml":"<PanVerification><Status>VALID</Status><NameMatch>94</NameMatch></PanVerification>"}',
    NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days'
  ),
  (
    gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'kyc-8888-8888-8888-888888888888',
    'PANPR12R12', 'Prakash Reddy', 97,
    'VERIFIED', 'Anil Kumar Reddy', '1982-04-12',
    '{"xml":"<PanVerification><Status>VALID</Status><NameMatch>97</NameMatch></PanVerification>"}',
    NOW() - INTERVAL '32 days', NOW() - INTERVAL '32 days'
  )
ON CONFLICT DO NOTHING;
