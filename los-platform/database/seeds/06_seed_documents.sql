-- ============================================================
-- LOS Platform — Seed: Documents (los_document.documents)
-- Mock MinIO paths for document storage
-- ============================================================

INSERT INTO los_document.documents (
  id, application_id, document_type, document_subtype,
  file_name, mime_type, file_size_bytes, checksum_sha256,
  minio_bucket, minio_object_key, upload_status,
  uploaded_by, ocr_text, ocr_confidence_score,
  verified_by, verified_at, rejection_reason,
  created_at, updated_at
) VALUES
  -- Karthik Raja: All docs for sanction
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'IDENTITY', 'AADHAAR_FRONT',
    'aadhaar_front_karthik.pdf', 'application/pdf', 245678,
    'sha256_aadhaar_front',
    'los-documents', 'LOS-2024-DL-00010/aadhaar_front_karthik.pdf',
    'UPLOADED', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    '{"name":"Karthik Raja","aadhaar_number_masked":"XXXX-XXXX-7842"}', 92,
    NULL, NULL, NULL,
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'
  ),
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'IDENTITY', 'PAN',
    'pan_karthik.pdf', 'application/pdf', 156432,
    'sha256_pan_karthik',
    'los-documents', 'LOS-2024-DL-00010/pan_karthik.pdf',
    'UPLOADED', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    '{"pan":"PANKR10X10","name":"Karthik Raja"}', 95,
    NULL, NULL, NULL,
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'
  ),
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'INCOME', 'SALARY_SLIP_3MONTHS',
    'salary_slip_karthik_jul.pdf', 'application/pdf', 321098,
    'sha256_salary_jul',
    'los-documents', 'LOS-2024-DL-00010/salary_slip_jul_karthik.pdf',
    'APPROVED', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    '{"employer":"CloudNine Tech","monthly_salary":90000,"month":"Jul 2024"}', 88,
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', NOW() - INTERVAL '18 days', NULL,
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days'
  ),
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'INCOME', 'BANK_STATEMENT_6MONTHS',
    'bank_stmt_karthik.pdf', 'application/pdf', 1048576,
    'sha256_bank_stmt',
    'los-documents', 'LOS-2024-DL-00010/bank_statement_6month_karthik.pdf',
    'UPLOADED', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    NULL, NULL,
    NULL, NULL, NULL,
    NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days'
  ),
  (
    gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'ADDRESS', 'RENT_AGREEMENT',
    'rent_agreement_karthik.pdf', 'application/pdf', 543210,
    'sha256_rent_agreement',
    'los-documents', 'LOS-2024-DL-00010/rent_agreement_karthik.pdf',
    'APPROVED', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    NULL, NULL,
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', NOW() - INTERVAL '17 days', NULL,
    NOW() - INTERVAL '19 days', NOW() - INTERVAL '17 days'
  ),

  -- Meera Nair: Docs for LAP
  (
    gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
    'PROPERTY', 'PROPERTY_DOCUMENT',
    'property_title_deed.pdf', 'application/pdf', 876543,
    'sha256_property_deed',
    'los-documents', 'LOS-2024-DL-00004/property_title_deed.pdf',
    'UPLOADED', '22222222-2222-2222-2222-222222222222',
    NULL, NULL,
    NULL, NULL, NULL,
    NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'
  ),
  (
    gen_random_uuid(), '44444444-4444-4444-4444-444444444444',
    'INCOME', 'ITR_3YEARS',
    'itr_meera_2023.pdf', 'application/pdf', 654321,
    'sha256_itr_2023',
    'los-documents', 'LOS-2024-DL-00004/itr_2023_meera.pdf',
    'PENDING_REVIEW', '22222222-2222-2222-2222-222222222222',
    NULL, NULL,
    NULL, NULL, NULL,
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'
  ),

  -- Sunita Rao: Disbursed loan docs
  (
    gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'IDENTITY', 'AADHAAR_FRONT',
    'aadhaar_front_sunita.pdf', 'application/pdf', 234567,
    'sha256_aadhaar_sunita',
    'los-documents', 'LOS-2024-DL-00013/aadhaar_front_sunita.pdf',
    'APPROVED', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    '{"name":"Sunita Rao"}', 91,
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', NOW() - INTERVAL '57 days', NULL,
    NOW() - INTERVAL '58 days', NOW() - INTERVAL '57 days'
  ),
  (
    gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'INCOME', 'SALARY_SLIP_3MONTHS',
    'salary_slip_sunita.pdf', 'application/pdf', 312345,
    'sha256_salary_sunita',
    'los-documents', 'LOS-2024-DL-00013/salary_slip_sunita.pdf',
    'APPROVED', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    '{"employer":"PharmaCare Ltd","monthly_salary":65000}', 89,
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', NOW() - INTERVAL '56 days', NULL,
    NOW() - INTERVAL '58 days', NOW() - INTERVAL '56 days'
  ),
  (
    gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'DISBURSEMENT', 'NACH_MANDATE',
    'nach_mandate_sunita.pdf', 'application/pdf', 98765,
    'sha256_nach_sunita',
    'los-documents', 'LOS-2024-DL-00013/nach_mandate_sunita.pdf',
    'APPROVED', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    NULL, NULL,
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', NOW() - INTERVAL '26 days', NULL,
    NOW() - INTERVAL '27 days', NOW() - INTERVAL '26 days'
  )
ON CONFLICT DO NOTHING;

-- Document checklists
INSERT INTO los_document.document_checklists (
  id, application_id, document_type, is_required, is_optional,
  status, submitted_at, approved_at,
  created_at, updated_at
) VALUES
  -- Karthik (Personal loan)
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'IDENTITY', true, false, 'APPROVED',
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '17 days', NOW() - INTERVAL '22 days', NOW()),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'INCOME', true, false, 'APPROVED',
   NOW() - INTERVAL '19 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '22 days', NOW()),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ADDRESS', true, false, 'APPROVED',
   NOW() - INTERVAL '19 days', NOW() - INTERVAL '17 days', NOW() - INTERVAL '22 days', NOW()),

  -- Meera (LAP)
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'PROPERTY', true, false, 'PENDING_REVIEW',
   NOW() - INTERVAL '8 days', NULL, NOW() - INTERVAL '10 days', NOW()),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'INCOME', true, false, 'PENDING_REVIEW',
   NOW() - INTERVAL '7 days', NULL, NOW() - INTERVAL '10 days', NOW()),

  -- Sunita (disbursed)
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'IDENTITY', true, false, 'APPROVED',
   NOW() - INTERVAL '58 days', NOW() - INTERVAL '57 days', NOW() - INTERVAL '60 days', NOW()),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'INCOME', true, false, 'APPROVED',
   NOW() - INTERVAL '58 days', NOW() - INTERVAL '56 days', NOW() - INTERVAL '60 days', NOW()),
  (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'DISBURSEMENT', true, false, 'APPROVED',
   NOW() - INTERVAL '27 days', NOW() - INTERVAL '26 days', NOW() - INTERVAL '60 days', NOW())
ON CONFLICT DO NOTHING;
