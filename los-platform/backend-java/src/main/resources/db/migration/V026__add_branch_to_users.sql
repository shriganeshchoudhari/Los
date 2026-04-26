-- V026: Add branch fields to users for bank-staff profile display
SET search_path TO auth, public;

ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100);

COMMENT ON COLUMN users.branch_code IS 'Branch code for bank staff (e.g. MUM001)';
COMMENT ON COLUMN users.branch_name IS 'Branch display name for bank staff (e.g. Mumbai Fort Branch)';
