-- ============================================================
-- LOS Platform — Seed: Bank Staff Users (los_auth.users)
-- 5 users: officer, analyst, manager, compliance, admin
-- OTP for all users: 123456 (Redis-set, not hashed here)
-- ============================================================

-- Auth service users
INSERT INTO los_auth.users (
  id, mobile, mobile_hash, email, full_name, role,
  is_active, is_verified, kyc_reference_id,
  created_at, updated_at
) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '9999999991',
    '5d41402abc4b2a76b9719d911017c592',
    'amit.kulkarni@losbank.in',
    'Amit Kulkarni',
    'LOAN_OFFICER',
    true, true, 'LOAN_OFFICER_REF_001',
    NOW(), NOW()
  ),
  (
    'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
    '9999999992',
    '5d41402abc4b2a76b9719d911017c593',
    'priya.sharma@losbank.in',
    'Priya Sharma',
    'CREDIT_ANALYST',
    true, true, 'ANALYST_REF_001',
    NOW(), NOW()
  ),
  (
    'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
    '9999999993',
    '5d41402abc4b2a76b9719d911017c594',
    'raj.mehta@losbank.in',
    'Raj Mehta',
    'BRANCH_MANAGER',
    true, true, 'BM_REF_001',
    NOW(), NOW()
  ),
  (
    'd3hhef22-2f3e-7hi1-ee0g-9ee2eg613d44',
    '9999999994',
    '5d41402abc4b2a76b9719d911017c595',
    'sneha.reddy@losbank.in',
    'Sneha Reddy',
    'COMPLIANCE_OFFICER',
    true, true, 'CO_REF_001',
    NOW(), NOW()
  ),
  (
    'e4iifg33-3g4f-8ij2-ff1h-0ff3fh724e55',
    '9999999995',
    '5d41402abc4b2a76b9719d911017c596',
    'system.admin@losbank.in',
    'System Administrator',
    'SYSTEM_ADMIN',
    true, true, 'ADMIN_REF_001',
    NOW(), NOW()
  )
ON CONFLICT (mobile) DO NOTHING;

-- Role permissions
INSERT INTO los_auth.role_permissions (role, permission, created_at) VALUES
  -- Loan Officer
  ('LOAN_OFFICER', 'application:create', NOW()),
  ('LOAN_OFFICER', 'application:read:own', NOW()),
  ('LOAN_OFFICER', 'application:update:own', NOW()),
  ('LOAN_OFFICER', 'kyc:initiate', NOW()),
  ('LOAN_OFFICER', 'kyc:read:own', NOW()),
  ('LOAN_OFFICER', 'document:upload', NOW()),
  ('LOAN_OFFICER', 'document:read', NOW()),
  ('LOAN_OFFICER', 'audit:read', NOW()),
  -- Credit Analyst
  ('CREDIT_ANALYST', 'application:read:assigned', NOW()),
  ('CREDIT_ANALYST', 'application:update:status', NOW()),
  ('CREDIT_ANALYST', 'kyc:read', NOW()),
  ('CREDIT_ANALYST', 'bureau:pull', NOW()),
  ('CREDIT_ANALYST', 'decision:submit', NOW()),
  ('CREDIT_ANALYST', 'document:review', NOW()),
  ('CREDIT_ANALYST', 'audit:read', NOW()),
  -- Branch Manager
  ('BRANCH_MANAGER', 'application:read:branch', NOW()),
  ('BRANCH_MANAGER', 'application:assign', NOW()),
  ('BRANCH_MANAGER', 'decision:approve', NOW()),
  ('BRANCH_MANAGER', 'decision:reject', NOW()),
  ('BRANCH_MANAGER', 'decision:revise', NOW()),
  ('BRANCH_MANAGER', 'sanction:issue', NOW()),
  ('BRANCH_MANAGER', 'audit:read', NOW()),
  ('BRANCH_MANAGER', 'audit:read:branch', NOW()),
  -- Compliance Officer
  ('COMPLIANCE_OFFICER', 'application:read', NOW()),
  ('COMPLIANCE_OFFICER', 'audit:read', NOW()),
  ('COMPLIANCE_OFFICER', 'audit:export', NOW()),
  ('COMPLIANCE_OFFICER', 'audit:read:all', NOW()),
  ('COMPLIANCE_OFFICER', 'report:rbi', NOW()),
  -- System Admin
  ('SYSTEM_ADMIN', 'user:create', NOW()),
  ('SYSTEM_ADMIN', 'user:read', NOW()),
  ('SYSTEM_ADMIN', 'user:update', NOW()),
  ('SYSTEM_ADMIN', 'config:update', NOW()),
  ('SYSTEM_ADMIN', 'audit:read:all', NOW()),
  ('SYSTEM_ADMIN', 'system:configure', NOW())
ON CONFLICT (role, permission) DO NOTHING;
