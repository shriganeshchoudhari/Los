-- Flyway Migration: V014__seed_decision_results.sql
-- LOS Platform — Seed: Decision Engine Results (decision.decisions)
-- Decision outcomes for applications

INSERT INTO decision.decisions (
    id, application_id, status, decision_result, credit_score, credit_grade,
    recommended_amount, recommended_tenure_months, recommended_roi_bps,
    final_grade, probability_of_default, combined_pd,
    rule_hits_count, rule_fail_count, risk_score,
    approved_amount, sanctioned_tenure_months, sanctioned_roi_bps,
    decision_engine_version, decided_by, decided_at, created_at
) VALUES
  -- LOS-2024-DL-00008: APPROVED
  (
    '45674567-8888-8888-8888-888888888888',
    '88888888-8888-8888-8888-888888888888',
    'APPROVED', 'APPROVED', 720, 'A',
    400000, 36, 1050,
    'A', 0.0215, 0.0450,
    12, 1, 28.50,
    400000, 36, 1050,
    'v2.0', 'CREDIT_ANALYST', NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '15 days'
  ),

  -- LOS-2024-DL-00009: CONDITIONALLY_APPROVED
  (
    '45674567-9999-9999-9999-999999999999',
    '99999999-9999-9999-9999-999999999999',
    'APPROVED', 'CONDITIONALLY_APPROVED', 680, 'B',
    800000, 60, 1150,
    'B', 0.0450, 0.0850,
    10, 2, 42.00,
    800000, 60, 1150,
    'v2.0', 'CREDIT_ANALYST', NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '20 days'
  ),

  -- LOS-2024-DL-00010: SANCTIONED
  (
    '45674567-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'APPROVED', 'APPROVED', 750, 'A',
    250000, 24, 1050,
    'A', 0.0180, 0.0380,
    14, 0, 22.00,
    250000, 24, 1050,
    'v2.0', 'BRANCH_MANAGER', NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '25 days'
  ),

  -- LOS-2024-DL-00011: SANCTIONED (cooling off)
  (
    '45674567-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'APPROVED', 'APPROVED', 620, 'C',
    40000, 12, 1490,
    'C', 0.0850, 0.1500,
    8, 3, 65.00,
    40000, 12, 1490,
    'v2.0', 'BRANCH_MANAGER', NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '30 days'
  ),

  -- LOS-2024-DL-00012: DISBURSEMENT_IN_PROGRESS
  (
    '45674567-cccc-cccc-cccc-cccccccccccc',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'APPROVED', 'APPROVED', 780, 'A',
    4500000, 180, 825,
    'A', 0.0120, 0.0280,
    15, 0, 18.00,
    4500000, 180, 825,
    'v2.0', 'BRANCH_MANAGER', NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '35 days'
  ),

  -- LOS-2024-DL-00013: DISBURSED
  (
    '45674567-dddd-dddd-dddd-dddddddddddd',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'APPROVED', 'APPROVED', 710, 'A',
    850000, 60, 980,
    'A', 0.0220, 0.0460,
    13, 1, 26.50,
    850000, 60, 980,
    'v2.0', 'BRANCH_MANAGER', NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '60 days'
  ),

  -- LOS-2024-DL-00014: REJECTED
  (
    '4567eeeeeeee-eeee-eeee-eeeeeeeeeeee',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'REJECTED', 'REJECTED', 580, 'D',
    NULL, NULL, NULL,
    'D', 0.1500, 0.2500,
    5, 8, 78.00,
    NULL, NULL, NULL,
    'v2.0', 'CREDIT_ANALYST', NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '45 days'
  )
ON CONFLICT (application_id) DO NOTHING;


