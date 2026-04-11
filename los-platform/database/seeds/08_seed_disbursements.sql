-- ============================================================
-- LOS Platform — Seed: Disbursements (los_integration.disbursements)
-- 5 disbursement records (4 completed + 1 in-progress)
-- ============================================================

INSERT INTO los_integration.disbursements (
  id, application_id, application_number,
  disbursement_type, amount, account_number, ifsc_code,
  account_holder_name, status,
  utr_number, bank_reference,
  npci_reference, nach_mandate_id,
  initiation_timestamp, processing_timestamp, completion_timestamp,
  failure_reason, retry_count,
  created_at, updated_at
) VALUES
  -- Sunita Rao: DISBURSED (vehicle loan)
  (
    gen_random_uuid(),
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'LOS-2024-DL-00013',
    'IMPS', 820000,
    '50200012345678', 'SBIN0001234',
    'Sunita Rao', 'DISBURSED',
    'UTR5IMPS240915000001', 'REF-SUNITA-001',
    'NPCI-REF-2024-09-15-001', 'NACH-REF-SUNITA-001',
    NOW() - INTERVAL '25 days' - INTERVAL '2 hours',
    NOW() - INTERVAL '25 days' - INTERVAL '1 hour',
    NOW() - INTERVAL '25 days',
    NULL, 0,
    NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'
  ),

  -- Prakash Reddy: DISBURSEMENT_IN_PROGRESS (home loan)
  (
    gen_random_uuid(),
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'LOS-2024-DL-00012',
    'RTGS', 4200000,
    '50200087654321', 'SBIN0005678',
    'Prakash Reddy', 'PROCESSING',
    NULL, NULL,
    NULL, 'NACH-REF-PRAKASH-001',
    NOW() - INTERVAL '8 hours',
    NOW() - INTERVAL '6 hours',
    NULL,
    NULL, 0,
    NOW() - INTERVAL '8 hours', NOW() - INTERVAL '6 hours'
  ),

  -- Karthik Raja: DISBURSED (personal loan)
  (
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'LOS-2024-DL-00010',
    'IMPS', 250000,
    '50200011223344', 'SBIN0009012',
    'Karthik Raja', 'DISBURSED',
    'UTR5IMPS240913000002', 'REF-KARTHIK-001',
    'NPCI-REF-2024-09-13-002', NULL,
    NOW() - INTERVAL '2 days' - INTERVAL '1 hour',
    NOW() - INTERVAL '2 days' - INTERVAL '30 min',
    NOW() - INTERVAL '2 days',
    NULL, 0,
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
  ),

  -- Madhav Bhat: CLOSED (old personal loan)
  (
    gen_random_uuid(),
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'LOS-2024-DL-00015',
    'NEFT', 150000,
    '50200099887766', 'SBIN0003456',
    'Madhav Bhat', 'DISBURSED',
    'UTR4NEFT240715000003', 'REF-MADHAV-001',
    NULL, NULL,
    NOW() - INTERVAL '90 days' - INTERVAL '2 hours',
    NOW() - INTERVAL '90 days' - INTERVAL '1 hour',
    NOW() - INTERVAL '90 days',
    NULL, 0,
    NOW() - INTERVAL '90 days', NOW() - INTERVAL '30 days'
  ),

  -- Failed disbursement example (retry)
  (
    gen_random_uuid(),
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'LOS-2024-DL-00012',
    'RTGS', 4200000,
    '50200087654321', 'SBIN0005678',
    'Prakash Reddy', 'FAILED',
    NULL, NULL,
    NULL, 'NACH-REF-PRAKASH-001',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    NULL,
    'NPCI_TIMEOUT: Bank server did not respond within 30 seconds', 1,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
  )
ON CONFLICT DO NOTHING;

-- EMI schedule for disbursed loan (Sunita Rao, 60 months)
INSERT INTO los_integration.emi_schedule (
  id, disbursement_id, application_id,
  emi_number, principal_amount, interest_amount, emi_amount,
  principal_outstanding, interest_rate_bps,
  payment_due_date, payment_status,
  payment_date, payment_reference,
  penalty_amount, penalty_waived,
  created_at, updated_at
) VALUES
  (
    gen_random_uuid(),
    (SELECT id FROM los_integration.disbursements WHERE application_number = 'LOS-2024-DL-00013' LIMIT 1),
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    1, 10567, 13398, 23965,
    809433, 980, NOW() + INTERVAL '15 days', 'DUE', NULL, NULL, 0, false,
    NOW() - INTERVAL '25 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_integration.disbursements WHERE application_number = 'LOS-2024-DL-00013' LIMIT 1),
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    2, 10724, 13241, 23965,
    798709, 980, NOW() + INTERVAL '45 days', 'DUE', NULL, NULL, 0, false,
    NOW() - INTERVAL '25 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_integration.disbursements WHERE application_number = 'LOS-2024-DL-00013' LIMIT 1),
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    3, 10883, 13082, 23965,
    787826, 980, NOW() + INTERVAL '75 days', 'DUE', NULL, NULL, 0, false,
    NOW() - INTERVAL '25 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_integration.disbursements WHERE application_number = 'LOS-2024-DL-00013' LIMIT 1),
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    4, 11045, 12920, 23965,
    776781, 980, NOW() + INTERVAL '105 days', 'DUE', NULL, NULL, 0, false,
    NOW() - INTERVAL '25 days', NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM los_integration.disbursements WHERE application_number = 'LOS-2024-DL-00013' LIMIT 1),
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    5, 11209, 12756, 23965,
    765572, 980, NOW() + INTERVAL '135 days', 'DUE', NULL, NULL, 0, false,
    NOW() - INTERVAL '25 days', NOW()
  )
ON CONFLICT DO NOTHING;

-- NACH mandates
INSERT INTO los_integration.nach_mandates (
  id, application_id, disbursement_id,
  mandate_type, amount, max_amount,
  account_number, ifsc_code, account_holder_name,
  umrn, status, registration_date, valid_from,
  created_at, updated_at
) VALUES
  (
    gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    (SELECT id FROM los_integration.disbursements WHERE application_number = 'LOS-2024-DL-00013' LIMIT 1),
    'NACH_DEBIT', 23965, 50000,
    '50200012345678', 'SBIN0001234', 'Sunita Rao',
    'UMRN-SUNITA-001', 'ACTIVE', NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days',
    NOW() - INTERVAL '27 days', NOW()
  ),
  (
    gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    (SELECT id FROM los_integration.disbursements WHERE application_number = 'LOS-2024-DL-00012' LIMIT 1),
    'NACH_DEBIT', 40000, 80000,
    '50200087654321', 'SBIN0005678', 'Prakash Reddy',
    'UMRN-PRAKASH-001', 'ACTIVE', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '4 days', NOW()
  ),
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    (SELECT id FROM los_integration.disbursements WHERE application_number = 'LOS-2024-DL-00010' LIMIT 1),
    'NACH_DEBIT', 12000, 25000,
    '50200011223344', 'SBIN0009012', 'Karthik Raja',
    'UMRN-KARTHIK-001', 'ACTIVE', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '4 days', NOW()
  )
ON CONFLICT DO NOTHING;
