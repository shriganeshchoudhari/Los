-- Flyway Migration: V011__seed_users.sql
-- LOS Platform — Seed: Bank Staff Users (auth.users)
-- 5 users: loan officer, analyst, manager, compliance, admin
-- OTP for all users: 123456 (stored in Redis, not in DB)

INSERT INTO auth.users (
    id, employee_id, full_name, email, mobile, mobile_hash, role,
    status, branch_code, created_at, updated_at
) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'LOAN001',
    'Amit Kulkarni',
    'amit.kulkarni@losbank.in',
    '9999999991',
    '5d41402abc4b2a76b9719d911017c592',
    'LOAN_OFFICER',
    'ACTIVE',
    'BLR001',
    NOW(),
    NOW()
  ),
  (
    'b1ffcd00-0d1c-5fa9-cc7e-7cc0ce491b22',
    'ANALYST001',
    'Priya Sharma',
    'priya.sharma@losbank.in',
    '9999999992',
    '5d41402abc4b2a76b9719d911017c593',
    'CREDIT_ANALYST',
    'ACTIVE',
    'BLR001',
    NOW(),
    NOW()
  ),
  (
    'c2aade11-1e2d-6aa0-dd8f-8dd1df502c33',
    'BM001',
    'Raj Mehta',
    'raj.mehta@losbank.in',
    '9999999993',
    '5d41402abc4b2a76b9719d911017c594',
    'BRANCH_MANAGER',
    'ACTIVE',
    'BLR001',
    NOW(),
    NOW()
  ),
  (
    'd3aaef22-2f3e-7aa1-ee0a-9ee2ea613d44',
    'CO001',
    'Sneha Reddy',
    'sneha.reddy@losbank.in',
    '9999999994',
    '5d41402abc4b2a76b9719d911017c595',
    'COMPLIANCE_OFFICER',
    'ACTIVE',
    'BLR001',
    NOW(),
    NOW()
  ),
  (
    'e4aafa33-3a4f-8aa2-ff1a-0ff3fa724e55',
    'ADMIN001',
    'System Administrator',
    'system.admin@losbank.in',
    '9999999995',
    '5d41402abc4b2a76b9719d911017c596',
    'SYSTEM_ADMIN',
    'ACTIVE',
    'HO',
    NOW(),
    NOW()
  )
ON CONFLICT (mobile) DO NOTHING;

-- Role permissions seed
INSERT INTO auth.role_permissions (role, permission, created_at) VALUES
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

