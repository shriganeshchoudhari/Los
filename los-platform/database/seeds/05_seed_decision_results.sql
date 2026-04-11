-- ============================================================
-- LOS Platform — Seed: Decision Results (los_decision.decision_results)
-- Decision outcomes for applications that have been assessed
-- ============================================================

INSERT INTO los_decision.decision_results (
  id, application_id, application_number, decision_status,
  primary_reason_code, primary_reason_message,
  approved_amount, interest_rate_bps, tenure_months,
  rule_engine_version, ml_model_version,
  bureau_score_used, foir_percent,
  total_score, risk_grade,
  processed_by, processed_at,
  created_at, updated_at
) VALUES
  -- Harish Iyer: APPROVED
  (
    gen_random_uuid(),
    '88888888-8888-8888-8888-888888888888',
    'LOS-2024-DL-00008',
    'APPROVED',
    'SCORE_ABOVE_THRESHOLD',
    'Applicant meets all eligibility criteria',
    400000, 1050, 36,
    'v2.1.0', 'ml-v3.2',
    720, 36,
    725, 'LOW_RISK',
    'SYSTEM',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'
  ),

  -- Meera Nair: CONDITIONALLY_APPROVED
  (
    gen_random_uuid(),
    '44444444-4444-4444-4444-444444444444',
    'LOS-2024-DL-00004',
    'CONDITIONALLY_APPROVED',
    'HIGH_FOIR',
    'FOIR is 58% which exceeds limit. Reduce loan amount or increase income proof.',
    1200000, 1350, 48,
    'v2.1.0', 'ml-v3.2',
    650, 58,
    635, 'MEDIUM_RISK',
    'SYSTEM',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
  ),

  -- Suresh Patel: CONDITIONALLY_APPROVED
  (
    gen_random_uuid(),
    '55555555-5555-5555-5555-555555555555',
    'LOS-2024-DL-00005',
    'CONDITIONALLY_APPROVED',
    'BUREAU_DPD_FOUND',
    'Recent DPD violations found. Approved with 2-year seasoning period.',
    600000, 1450, 36,
    'v2.1.0', 'ml-v3.2',
    580, 35,
    598, 'MEDIUM_RISK',
    'SYSTEM',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'
  ),

  -- Rajesh Kumar: APPROVED (HL, government employee)
  (
    gen_random_uuid(),
    '33333333-3333-3333-3333-333333333333',
    'LOS-2024-DL-00003',
    'APPROVED',
    'SCORE_EXCELLENT',
    'Excellent credit profile. Government employee with stable income.',
    2200000, 825, 180,
    'v2.1.0', 'ml-v3.2',
    820, 28,
    810, 'LOW_RISK',
    'SYSTEM',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
  ),

  -- Divya Krishnan: CONDITIONALLY_APPROVED (education loan)
  (
    gen_random_uuid(),
    '99999999-9999-9999-9999-999999999999',
    'LOS-2024-DL-00009',
    'CONDITIONALLY_APPROVED',
    'NO_CREDIT_HISTORY',
    'No credit history. Approved with co-applicant mandatory and margin money 20%.',
    640000, 1075, 60,
    'v2.1.0', 'ml-v3.2',
    672, 15,
    680, 'LOW_RISK',
    'SYSTEM',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
  ),

  -- Arun Kumar: REJECTED
  (
    gen_random_uuid(),
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'LOS-2024-DL-00014',
    'REJECTED',
    'LOW_CIBIL_SCORE',
    'CIBIL score 580 is below minimum threshold of 650. Suit filed and write-off found.',
    0, 0, 0,
    'v2.1.0', 'ml-v3.2',
    580, 45,
    520, 'HIGH_RISK',
    'SYSTEM',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'
  ),

  -- Lakshmi Devi: APPROVED (underwriting done)
  (
    gen_random_uuid(),
    '66666666-6666-6666-6666-666666666666',
    'LOS-2024-DL-00006',
    'APPROVED',
    'SCORE_GOOD',
    'Good credit profile. Field investigation completed successfully.',
    2800000, 875, 180,
    'v2.1.0', 'ml-v3.2',
    715, 32,
    720, 'LOW_RISK',
    'SYSTEM',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'
  ),

  -- Karthik Raja: APPROVED (sanctioned)
  (
    gen_random_uuid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'LOS-2024-DL-00010',
    'APPROVED',
    'SCORE_GOOD',
    'Good credit profile. Clean bureau. Salary account with the bank.',
    250000, 1050, 24,
    'v2.1.0', 'ml-v3.2',
    755, 28,
    748, 'LOW_RISK',
    'SYSTEM',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
  ),

  -- Nisha Menon: APPROVED (cooling-off candidate, small loan)
  (
    gen_random_uuid(),
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'LOS-2024-DL-00011',
    'APPROVED',
    'SCORE_ABOVE_THRESHOLD',
    'Eligible for small personal loan. Within cooling-off window eligible amount.',
    40000, 1490, 12,
    'v2.1.0', 'ml-v3.2',
    688, 22,
    692, 'LOW_RISK',
    'SYSTEM',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
  ),

  -- Prakash Reddy: APPROVED (sanctioned)
  (
    gen_random_uuid(),
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'LOS-2024-DL-00012',
    'APPROVED',
    'SCORE_EXCELLENT_GOVT',
    'Excellent credit. Government employee. Loan within LTV limits.',
    4200000, 825, 180,
    'v2.1.0', 'ml-v3.2',
    795, 28,
    800, 'LOW_RISK',
    'SYSTEM',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
  )
ON CONFLICT DO NOTHING;

-- Decision rule evaluation results (for Harish — APPROVED path)
INSERT INTO los_decision.decision_rule_results (
  id, decision_result_id, application_id, rule_id, rule_name,
  rule_severity, evaluation_result, matched_conditions,
  created_at
) VALUES
  (gen_random_uuid(), (
      SELECT id FROM los_decision.decision_results WHERE application_number = 'LOS-2024-DL-00008' LIMIT 1
    ), '88888888-8888-8888-8888-888888888888',
    'CR001', 'Minimum CIBIL Score', 'HARD_STOP', 'PASSED',
    '[{"field":"bureau_score.cibil","operator":"gte","value":650,"actual":720}]',
    NOW() - INTERVAL '4 days'),
  (gen_random_uuid(), (
      SELECT id FROM los_decision.decision_results WHERE application_number = 'LOS-2024-DL-00008' LIMIT 1
    ), '88888888-8888-8888-8888-888888888888',
    'FO001', 'Maximum FOIR - Salaried', 'HARD_STOP', 'PASSED',
    '[{"field":"calculated_foir","operator":"lte","value":50,"actual":36}]',
    NOW() - INTERVAL '4 days'),
  (gen_random_uuid(), (
      SELECT id FROM los_decision.decision_results WHERE application_number = 'LOS-2024-DL-00008' LIMIT 1
    ), '88888888-8888-8888-8888-888888888888',
    'IN001', 'Minimum Monthly Income', 'HARD_STOP', 'PASSED',
    '[{"field":"applicant.net_monthly_income","operator":"gte","value":25000,"actual":110000}]',
    NOW() - INTERVAL '4 days'),
  (gen_random_uuid(), (
      SELECT id FROM los_decision.decision_results WHERE application_number = 'LOS-2024-DL-00008' LIMIT 1
    ), '88888888-8888-8888-8888-888888888888',
    'AT001', 'Minimum Loan Amount', 'HARD_STOP', 'PASSED',
    '[{"field":"loan.requested_amount","operator":"gte","value":50000,"actual":400000}]',
    NOW() - INTERVAL '4 days')
ON CONFLICT DO NOTHING;
