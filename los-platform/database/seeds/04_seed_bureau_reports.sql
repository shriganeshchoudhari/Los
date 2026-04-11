-- ============================================================
-- LOS Platform — Seed: Bureau Reports (los_integration.bureau_reports)
-- 4 persona types: Excellent (820), Good (720), Fair (650), Poor (580)
-- ============================================================

INSERT INTO los_integration.bureau_reports (
  id, application_id, bureau_type, pan_number,
  raw_response, parsed_score, parsed_grade,
  total_accounts, active_accounts, closed_accounts,
  total_outstanding, total_monthly_emi,
  dpd_0_count, dpd_30_count, dpd_60_count, dpd_90_count,
  enquiries_30d, enquiries_90d, enquiries_12m,
  suit_filed, write_off, credit_utilization,
  report_fetched_at, created_at
) VALUES
  -- Rajesh Kumar: Excellent borrower, score 820
  (
    gen_random_uuid(), '33333333-3333-3333-3333-333333333333',
    'CIBIL', 'PANRK3333P',
    '{"reportId":"CIB00001","score":820,"grade":"A","accounts":[{"type":"HL","status":"Active","outstanding":1500000,"dpd":0},{"type":"PL","status":"Closed","outstanding":0,"dpd":0}]}',
    820, 'A', 2, 1, 1, 1500000, 15000,
    1, 0, 0, 0, 0, 0, 1, 1,
    false, false, 35,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
  ),

  -- Harish Iyer: Good borrower, score 720
  (
    gen_random_uuid(), '88888888-8888-8888-8888-888888888888',
    'CIBIL', 'PANHI8888M',
    '{"reportId":"CIB00002","score":720,"grade":"B","accounts":[{"type":"CC","status":"Active","outstanding":50000,"dpd":0},{"type":"PL","status":"Closed","outstanding":0,"dpd":0}]}',
    720, 'B', 2, 1, 1, 50000, 5000,
    1, 0, 0, 0, 0, 1, 2, 1,
    false, false, 28,
    NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'
  ),

  -- Meera Nair: Fair borrower, score 650
  (
    gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
    'CIBIL', 'PANMN4444A',
    '{"reportId":"CIB00003","score":650,"grade":"C","accounts":[{"type":"PL","status":"Active","outstanding":200000,"dpd":30},{"type":"CC","status":"Active","outstanding":30000,"dpd":0}]}',
    650, 'C', 3, 2, 1, 230000, 12000,
    1, 1, 1, 0, 1, 2, 3, 2,
    false, false, 65,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'
  ),

  -- Suresh Patel: Poor borrower, score 580
  (
    gen_random_uuid(), '55555555-5555-5555-5555-555555555555',
    'CIBIL', 'PANSP5555R',
    '{"reportId":"CIB00004","score":580,"grade":"D","accounts":[{"type":"BL","status":"Active","outstanding":500000,"dpd":60},{"type":"CC","status":"Active","outstanding":100000,"dpd":90}]}',
    580, 'D', 4, 3, 1, 600000, 25000,
    1, 1, 1, 1, 3, 5, 6, 4,
    false, false, 82,
    NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'
  ),

  -- Arun Kumar: Very poor, rejected
  (
    gen_random_uuid(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'CIBIL', 'PANAK14K14',
    '{"reportId":"CIB00005","score":580,"grade":"D","accounts":[{"type":"PL","status":"Written Off","outstanding":200000,"dpd":120}]}',
    580, 'D', 2, 1, 1, 200000, 0,
    0, 0, 0, 1, 2, 3, 5, 3,
    true, true, 95,
    NOW() - INTERVAL '44 days', NOW() - INTERVAL '44 days'
  ),

  -- Karthik Raja: Good
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'CIBIL', 'PANKR10X10',
    '{"reportId":"CIB00006","score":755,"grade":"B","accounts":[{"type":"PL","status":"Active","outstanding":100000,"dpd":0}]}',
    755, 'B', 1, 1, 0, 100000, 5000,
    1, 0, 0, 0, 0, 0, 1, 1,
    false, false, 22,
    NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'
  ),

  -- Nisha Menon: Fair
  (
    gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'CIBIL', 'PANNM11Y11',
    '{"reportId":"CIB00007","score":688,"grade":"C","accounts":[{"type":"CC","status":"Active","outstanding":20000,"dpd":0}]}',
    688, 'C', 1, 1, 0, 20000, 2000,
    1, 0, 0, 0, 0, 1, 1, 1,
    false, false, 45,
    NOW() - INTERVAL '29 days', NOW() - INTERVAL '29 days'
  ),

  -- Prakash Reddy: Excellent
  (
    gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'CIBIL', 'PANPR12R12',
    '{"reportId":"CIB00008","score":795,"grade":"B","accounts":[{"type":"HL","status":"Active","outstanding":800000,"dpd":0},{"type":"PL","status":"Closed","outstanding":0,"dpd":0}]}',
    795, 'B', 2, 1, 1, 800000, 25000,
    1, 0, 0, 0, 1, 1, 2, 1,
    false, false, 38,
    NOW() - INTERVAL '33 days', NOW() - INTERVAL '33 days'
  ),

  -- Sunita Rao: Good
  (
    gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'CIBIL', 'PANSR13S13',
    '{"reportId":"CIB00009","score":742,"grade":"B","accounts":[{"type":"VL","status":"Active","outstanding":650000,"dpd":0}]}',
    742, 'B', 1, 1, 0, 650000, 18000,
    1, 0, 0, 0, 0, 1, 1, 1,
    false, false, 42,
    NOW() - INTERVAL '59 days', NOW() - INTERVAL '59 days'
  ),

  -- Divya Krishnan: Fair (conditionally approved)
  (
    gen_random_uuid(), '99999999-9999-9999-9999-999999999999',
    'CIBIL', 'PANDK9999V',
    '{"reportId":"CIB00010","score":672,"grade":"C","accounts":[]}',
    672, 'C', 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    false, false, 0,
    NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'
  )
ON CONFLICT DO NOTHING;

-- Bureau pull job history
INSERT INTO los_integration.bureau_pull_jobs (
  id, application_id, bureau_type, pan_number,
  status, error_message, retry_count,
  created_at, completed_at
) VALUES
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', 'CIBIL', 'PANRK3333P', 'SUCCESS', NULL, 0,
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'CIBIL', 'PANMN4444A', 'SUCCESS', NULL, 0,
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), '55555555-5555-5555-5555-555555555555', 'CIBIL', 'PANSP5555R', 'SUCCESS', NULL, 0,
   NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', 'CIBIL', 'PANHI8888M', 'SUCCESS', NULL, 0,
   NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
  (gen_random_uuid(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'CIBIL', 'PANAK14K14', 'SUCCESS', NULL, 0,
   NOW() - INTERVAL '44 days', NOW() - INTERVAL '44 days'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CIBIL', 'PANKR10X10', 'SUCCESS', NULL, 0,
   NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'CIBIL', 'PANPR12R12', 'SUCCESS', NULL, 0,
   NOW() - INTERVAL '33 days', NOW() - INTERVAL '33 days'),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'CIBIL', 'PANSR13S13', 'SUCCESS', NULL, 0,
   NOW() - INTERVAL '59 days', NOW() - INTERVAL '59 days')
ON CONFLICT DO NOTHING;
