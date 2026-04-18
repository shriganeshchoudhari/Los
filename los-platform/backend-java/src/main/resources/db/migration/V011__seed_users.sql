-- Flyway Migration: V011__seed_users.sql
-- LOS Platform — Seed: Bank Staff Users (auth.users)
-- 5 users: loan officer, analyst, manager, compliance, admin

INSERT INTO auth.users (
    id, employee_id, first_name, last_name, email, mobile, mobile_hash, role,
    status, mfa_enabled, is_deleted, failed_login_attempts, created_at, updated_at, version
) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'LOAN001',
    'Amit',
    'Kulkarni',
    'amit.kulkarni@losbank.in',
    '9999999991',
    'b0ccf3c53bebec6ec94265682f7f03f8d7a9a1e83e2e8707559ab8e546561d88',
    'LOAN_OFFICER',
    'ACTIVE',
    false,
    false,
    0,
    NOW(),
    NOW(),
    0
  ),
  (
    'b1ffcd00-0d1c-5fa9-cc7e-7cc0ce491b22',
    'ANALYST001',
    'Priya',
    'Sharma',
    'priya.sharma@losbank.in',
    '9999999992',
    '4b63a39782675eb9b9ef6e122ef518168c9a0eb49cee163c601f15ffacf6098d',
    'CREDIT_ANALYST',
    'ACTIVE',
    false,
    false,
    0,
    NOW(),
    NOW(),
    0
  ),
  (
    'c2aade11-1e2d-6aa0-dd8f-8dd1df502c33',
    'BM001',
    'Raj',
    'Mehta',
    'raj.mehta@losbank.in',
    '9999999993',
    '193b1c5ceb5370aff72313caf20599f04ce1992a520f16d66acbe6e233ee9e2b',
    'BRANCH_MANAGER',
    'ACTIVE',
    false,
    false,
    0,
    NOW(),
    NOW(),
    0
  ),
  (
    'd3aaef22-2f3e-7aa1-ee0a-9ee2ea613d44',
    'CO001',
    'Sneha',
    'Reddy',
    'sneha.reddy@losbank.in',
    '9999999994',
    '56ed7fd8e2f11a9b719d5f98e6113fd574bd84ec5ecbc9842a19e2fb377fcebc',
    'COMPLIANCE_OFFICER',
    'ACTIVE',
    false,
    false,
    0,
    NOW(),
    NOW(),
    0
  ),
  (
    'e4aafa33-3a4f-8aa2-ff1a-0ff3fa724e55',
    'ADMIN001',
    'System',
    'Administrator',
    'system.admin@losbank.in',
    '9999999995',
    '12cd81eeba50e7db08e79f15ab592efb13fd2eb2ab79e16a09e6f236cfa20e46',
    'SYSTEM_ADMIN',
    'ACTIVE',
    false,
    false,
    0,
    NOW(),
    NOW(),
    0
  )
ON CONFLICT (mobile) DO NOTHING;

-- Role permissions seed
INSERT INTO auth.role_permissions (role, permission) VALUES
  -- Loan Officer
  ('LOAN_OFFICER', 'application:create'),
  ('LOAN_OFFICER', 'application:read:own'),
  ('LOAN_OFFICER', 'application:update:own'),
  ('LOAN_OFFICER', 'kyc:initiate'),
  ('LOAN_OFFICER', 'kyc:read:own'),
  ('LOAN_OFFICER', 'document:upload'),
  ('LOAN_OFFICER', 'document:read'),
  ('LOAN_OFFICER', 'audit:read'),
  -- Credit Analyst
  ('CREDIT_ANALYST', 'application:read:assigned'),
  ('CREDIT_ANALYST', 'application:update:status'),
  ('CREDIT_ANALYST', 'kyc:read'),
  ('CREDIT_ANALYST', 'bureau:pull'),
  ('CREDIT_ANALYST', 'decision:submit'),
  ('CREDIT_ANALYST', 'document:review'),
  ('CREDIT_ANALYST', 'audit:read'),
  -- Branch Manager
  ('BRANCH_MANAGER', 'application:read:branch'),
  ('BRANCH_MANAGER', 'application:assign'),
  ('BRANCH_MANAGER', 'decision:approve'),
  ('BRANCH_MANAGER', 'decision:reject'),
  ('BRANCH_MANAGER', 'decision:revise'),
  ('BRANCH_MANAGER', 'sanction:issue'),
  ('BRANCH_MANAGER', 'audit:read'),
  ('BRANCH_MANAGER', 'audit:read:branch'),
  -- Compliance Officer
  ('COMPLIANCE_OFFICER', 'application:read'),
  ('COMPLIANCE_OFFICER', 'audit:read'),
  ('COMPLIANCE_OFFICER', 'audit:export'),
  ('COMPLIANCE_OFFICER', 'audit:read:all'),
  ('COMPLIANCE_OFFICER', 'report:rbi'),
  -- System Admin
  ('SYSTEM_ADMIN', 'user:create'),
  ('SYSTEM_ADMIN', 'user:read'),
  ('SYSTEM_ADMIN', 'user:update'),
  ('SYSTEM_ADMIN', 'config:update'),
  ('SYSTEM_ADMIN', 'audit:read:all'),
  ('SYSTEM_ADMIN', 'system:configure')
ON CONFLICT (role, permission) DO NOTHING;
