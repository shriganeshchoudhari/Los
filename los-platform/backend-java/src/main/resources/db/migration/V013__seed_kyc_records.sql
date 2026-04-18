-- Flyway Migration: V013__seed_kyc_records.sql
-- LOS Platform — Seed: KYC Records (kyc.kyc_records)
-- KYC records corresponding to loan applications

-- Insert KYC records for applications in various stages
INSERT INTO kyc.kyc_records (
    id, application_id, user_id, status, overall_risk_score,
    created_at, updated_at
) VALUES
  -- LOS-2024-DL-00002: KYC not started (SUBMITTED)
  (
    '12341234-2222-2222-2222-222222222222',
    'LOS-2024-DL-00002',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'NOT_STARTED',
    NULL,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  ),

  -- LOS-2024-DL-00003: KYC complete (Aadhaar + PAN verified)
  (
    '12341234-3333-3333-3333-333333333333',
    'LOS-2024-DL-00003',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'KYC_COMPLETE',
    35,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '2 days'
  ),

  -- LOS-2024-DL-00004: KYC complete but docs pending
  (
    '12341234-4444-4444-4444-444444444444',
    'LOS-2024-DL-00004',
    'b1ffcd00-0d1c-5fa9-cc7e-7cc0ce491b22',
    'KYC_COMPLETE',
    45,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '1 day'
  ),

  -- LOS-2024-DL-00005: Face match pending
  (
    '12341234-5555-5555-5555-555555555555',
    'LOS-2024-DL-00005',
    'b1ffcd00-0d1c-5fa9-cc7e-7cc0ce491b22',
    'FACE_MATCH_PENDING',
    50,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '12 hours'
  ),

  -- LOS-2024-DL-00006: Aadhaar verification in progress
  (
    '12341234-6666-6666-6666-666666666666',
    'LOS-2024-DL-00006',
    'b1ffcd00-0d1c-5fa9-cc7e-7cc0ce491b22',
    'AADHAAR_OTP_SENT',
    NULL,
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '2 days'
  ),

  -- LOS-2024-DL-00008: KYC complete, approved
  (
    '12341234-8888-8888-8888-888888888888',
    'LOS-2024-DL-00008',
    'b1ffcd00-0d1c-5fa9-cc7e-7cc0ce491b22',
    'KYC_COMPLETE',
    30,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '3 days'
  ),

  -- LOS-2024-DL-00009: KYC partially complete
  (
    '12341234-9999-9999-9999-999999999999',
    'LOS-2024-DL-00009',
    'b1ffcd00-0d1c-5fa9-cc7e-7cc0ce491b22',
    'PAN_VERIFIED',
    55,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '1 day'
  ),

  -- LOS-2024-DL-00010: KYC approved
  (
    '12341234-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'LOS-2024-DL-00010',
    'c2aade11-1e2d-6aa0-dd8f-8dd1df502c33',
    'KYC_COMPLETE',
    25,
    NOW() - INTERVAL '23 days',
    NOW() - INTERVAL '1 day'
  ),

  -- LOS-2024-DL-00012: KYC approved, disbursement in progress
  (
    '12341234-cccc-cccc-cccc-cccccccccccc',
    'LOS-2024-DL-00012',
    'c2aade11-1e2d-6aa0-dd8f-8dd1df502c33',
    'KYC_COMPLETE',
    20,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '6 hours'
  ),

  -- LOS-2024-DL-00013: disbursed loan
  (
    '12341234-dddd-dddd-dddd-dddddddddddd',
    'LOS-2024-DL-00013',
    'c2aade11-1e2d-6aa0-dd8f-8dd1df502c33',
    'KYC_COMPLETE',
    28,
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '25 days'
  )
ON CONFLICT (application_id) DO NOTHING;

-- Insert Aadhaar KYC results for completed KYCs
INSERT INTO kyc.aadhaar_kyc_results (
    id, kyc_id, txn_id, uidai_ref_id, aadhaar_number_hash,
    name, dob, gender, signature_valid, verified_at
) VALUES
  (
    'abcdef12-3333-3333-3333-333333333333',
    '12341234-3333-3333-3333-333333333333',
    'TXN3333' || gen_random_uuid()::VARCHAR(8),
    'UIDAI3333' || gen_random_uuid()::VARCHAR(8),
    'hash_aadhaar_3333',
    'Rajesh Kumar',
    '1985-08-10',
    'M',
    true,
    NOW() - INTERVAL '3 days'
  ),
  (
    'abcdef12-8888-8888-8888-888888888888',
    '12341234-8888-8888-8888-888888888888',
    'TXN8888' || gen_random_uuid()::VARCHAR(8),
    'UIDAI8888' || gen_random_uuid()::VARCHAR(8),
    'hash_aadhaar_8888',
    'Harish Iyer',
    '1993-09-14',
    'M',
    true,
    NOW() - INTERVAL '4 days'
  ),
  (
    'abcdef12-cccc-cccc-cccc-cccccccccccc',
    '12341234-cccc-cccc-cccc-cccccccccccc',
    'TXNCCCC' || gen_random_uuid()::VARCHAR(8),
    'UIDAICCCC' || gen_random_uuid()::VARCHAR(8),
    'hash_aadhaar_cccc',
    'Prakash Reddy',
    '1982-04-12',
    'M',
    true,
    NOW() - INTERVAL '5 days'
  ),
  (
    'abcdef12-dddd-dddd-dddd-dddddddddddd',
    '12341234-dddd-dddd-dddd-dddddddddddd',
    'TXNDDDD' || gen_random_uuid()::VARCHAR(8),
    'UIDAIDDDD' || gen_random_uuid()::VARCHAR(8),
    'hash_aadhaar_dddd',
    'Sunita Rao',
    '1991-10-08',
    'F',
    true,
    NOW() - INTERVAL '30 days'
  );


-- Insert PAN verification results
INSERT INTO kyc.pan_verification_results (
    id, kyc_id, pan_number_masked, pan_number_encrypted,
    name_match_score, name_on_pan, dob_match, pan_status,
    linked_aadhaar, verified_at
) VALUES
  (
    'abcdef34-3333-3333-3333-333333333333',
    '12341234-3333-3333-3333-333333333333',
    'XXXXP3333',
    '{"encrypted":true,"last4":"3333"}',
    95,
    'RAJESH KUMAR',
    true,
    'VALID',
    true,
    NOW() - INTERVAL '2 days'
  ),
  (
    'abcdef34-8888-8888-8888-888888888888',
    '12341234-8888-8888-8888-888888888888',
    'XXXXH8888',
    '{"encrypted":true,"last4":"8888"}',
    92,
    'HARISH IYER',
    true,
    'VALID',
    true,
    NOW() - INTERVAL '3 days'
  ),
  (
    'abcdef34-cccc-cccc-cccc-cccccccccccc',
    '12341234-cccc-cccc-cccc-cccccccccccc',
    'XXXXP12R12',
    '{"encrypted":true,"last4":"1212"}',
    98,
    'PRAKASH REDDY',
    true,
    'VALID',
    true,
    NOW() - INTERVAL '5 days'
  ),
  (
    'abcdef34-dddd-dddd-dddd-dddddddddddd',
    '12341234-dddd-dddd-dddd-dddddddddddd',
    'XXXXS13S13',
    '{"encrypted":true,"last4":"1313"}',
    90,
    'SUNITA RAO',
    true,
    'VALID',
    true,
    NOW() - INTERVAL '30 days'
  );


-- Insert consent records for KYC
INSERT INTO kyc.consent_records (
    id, application_id, user_id, consent_type, consent_text,
    consent_version, is_granted, granted_at, ip_address, user_agent
) VALUES
  (
    gen_random_uuid(), 'LOS-2024-DL-00003',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'KYC_VERIFICATION',
    'I consent to verify my identity using Aadhaar and PAN',
    'v1.0', true, NOW() - INTERVAL '5 days',
    '192.168.1.100', 'LOS-Web/1.0'
  ),
  (
    gen_random_uuid(), 'LOS-2024-DL-00008',
    'b1ffcd00-0d1c-5fa9-cc7e-7cc0ce491b22',
    'KYC_VERIFICATION',
    'I consent to verify my identity using Aadhaar and PAN',
    'v1.0', true, NOW() - INTERVAL '15 days',
    '192.168.1.101', 'LOS-Web/1.0'
  ),
  (
    gen_random_uuid(), 'LOS-2024-DL-00013',
    'c2aade11-1e2d-6aa0-dd8f-8dd1df502c33',
    'KYC_VERIFICATION',
    'I consent to verify my identity using Aadhaar and PAN',
    'v1.0', true, NOW() - INTERVAL '55 days',
    '192.168.1.102', 'LOS-Web/1.0'
  );





