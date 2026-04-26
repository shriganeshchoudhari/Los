-- V027: Update seed users with branch information for dashboard display
SET search_path TO auth, public;

-- Update Loan Officer with Mumbai Fort Branch
UPDATE auth.users SET branch_code = 'MUM001', branch_name = 'Mumbai Fort Branch'
  WHERE employee_id = 'LOAN001';

-- Update Credit Analyst with Mumbai Fort Branch  
UPDATE auth.users SET branch_code = 'MUM001', branch_name = 'Mumbai Fort Branch'
  WHERE employee_id = 'ANALYST001';

-- Update Branch Manager with Mumbai Fort Branch
UPDATE auth.users SET branch_code = 'MUM001', branch_name = 'Mumbai Fort Branch'
  WHERE employee_id = 'BM001';

-- Update Compliance Officer with Head Office
UPDATE auth.users SET branch_code = 'HO001', branch_name = 'Head Office Mumbai'
  WHERE employee_id = 'CO001';
