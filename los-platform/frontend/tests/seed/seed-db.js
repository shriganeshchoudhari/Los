#!/usr/bin/env node
/**
 * LOS Platform — Database Seed Script
 * Seeds PostgreSQL database with test data using direct DB connection.
 * Usage: node seed-db.js [--env dev|uat|prod] [--clean]
 */

const { Client } = require('pg');

const ENV_CONFIG = {
  dev: { host: 'localhost', port: 5432, database: 'los_dev', user: 'los_dev', password: 'los_dev_pass' },
  uat: { host: 'localhost', port: 5432, database: 'los_uat', user: 'los_uat', password: process.env.DB_UAT_PASSWORD || 'los_uat_pass' },
  prod: { host: process.env.DB_HOST, port: 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD },
};

const ARGV = process.argv;
const ENV = ARGV.includes('--env') ? ARGV[ARGV.indexOf('--env') + 1] : 'dev';
const CLEAN = ARGV.includes('--clean');

async function main() {
  const config = ENV_CONFIG[ENV];
  if (!config.host) {
    console.error(`PostgreSQL not configured for ${ENV} environment`);
    process.exit(1);
  }

  const client = new Client(config);
  await client.connect();

  console.log(`Connected to ${ENV} database`);

  if (CLEAN) {
    console.log('Cleaning test data...');
    await client.query(`DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 day'`);
    await client.query(`DELETE FROM loan_applications WHERE created_at < NOW() - INTERVAL '1 day'`);
    await client.query(`DELETE FROM users WHERE mobile LIKE '9999%'`);
    console.log('Clean complete');
    await client.end();
    return;
  }

  // Seed loan products
  console.log('Seeding loan products...');
  await client.query(`
    INSERT INTO loan_products (code, name, min_amount, max_amount, min_tenure_months, max_tenure_months, min_income, base_rate, processing_fee_rate, active, created_at)
    VALUES 
      ('PL', 'Personal Loan', 50000, 2500000, 12, 60, 15000, 10.50, 2.00, true, NOW())
    ON CONFLICT (code) DO UPDATE SET active = true, updated_at = NOW();
    INSERT INTO loan_products (code, name, min_amount, max_amount, min_tenure_months, max_tenure_months, min_income, base_rate, processing_fee_rate, active, created_at)
    VALUES 
      ('HL', 'Home Loan', 500000, 50000000, 60, 360, 25000, 8.50, 0.50, true, NOW())
    ON CONFLICT (code) DO UPDATE SET active = true, updated_at = NOW();
    INSERT INTO loan_products (code, name, min_amount, max_amount, min_tenure_months, max_tenure_months, min_income, base_rate, processing_fee_rate, active, created_at)
    VALUES 
      ('LAP', 'Loan Against Property', 100000, 10000000, 12, 180, 25000, 9.50, 1.00, true, NOW())
    ON CONFLICT (code) DO UPDATE SET active = true, updated_at = NOW();
    INSERT INTO loan_products (code, name, min_amount, max_amount, min_tenure_months, max_tenure_months, min_income, base_rate, processing_fee_rate, active, created_at)
    VALUES 
      ('BL', 'Business Loan', 100000, 10000000, 12, 60, 20000, 14.00, 2.00, true, NOW())
    ON CONFLICT (code) DO UPDATE SET active = true, updated_at = NOW();
    INSERT INTO loan_products (code, name, min_amount, max_amount, min_tenure_months, max_tenure_months, min_income, base_rate, processing_fee_rate, active, created_at)
    VALUES 
      ('EL', 'Education Loan', 50000, 2000000, 12, 84, 10000, 9.00, 0.50, true, NOW())
    ON CONFLICT (code) DO UPDATE SET active = true, updated_at = NOW();
  `);

  // Seed branches
  console.log('Seeding branches...');
  await client.query(`
    INSERT INTO branches (code, name, city, state, pincode, manager_id, active, created_at)
    VALUES 
      ('BR001', 'Mumbai Main Branch', 'Mumbai', 'Maharashtra', '400001', null, true, NOW()),
      ('BR002', 'Delhi NCR Branch', 'New Delhi', 'Delhi', '110001', null, true, NOW()),
      ('BR003', 'Bangalore MG Road', 'Bangalore', 'Karnataka', '560001', null, true, NOW()),
      ('BR004', 'Chennai T Nagar', 'Chennai', 'Tamil Nadu', '600017', null, true, NOW()),
      ('BR005', 'Hyderabad Hitec City', 'Hyderabad', 'Telangana', '500081', null, true, NOW())
    ON CONFLICT (code) DO NOTHING;
  `);

  // Seed test users
  console.log('Seeding test users...');
  await client.query(`
    INSERT INTO users (id, mobile, email, full_name, role, pan_number, dob, kyc_status, created_at)
    VALUES 
      (gen_random_uuid(), '9999000001', 'ravi.sharma@test.com', 'Ravi Sharma', 'APPLICANT', 'AAUSC9991Z', '1985-03-15', 'VERIFIED', NOW()),
      (gen_random_uuid(), '9999000002', 'priya.patel@test.com', 'Priya Patel', 'APPLICANT', 'AAUSC9992Z', '1988-07-22', 'PENDING', NOW()),
      (gen_random_uuid(), '9999000003', 'amit.kumar@test.com', 'Amit Kumar', 'APPLICANT', 'AAUSC9993Z', '1990-01-10', 'VERIFIED', NOW()),
      (gen_random_uuid(), '9999000004', 'sneha.reddy@test.com', 'Sneha Reddy', 'APPLICANT', 'AAUSC9994Z', '1992-11-05', 'VERIFIED', NOW()),
      (gen_random_uuid(), '9999000005', 'vikram.singh@test.com', 'Vikram Singh', 'APPLICANT', 'AAUSC9995Z', '1987-06-30', 'VERIFIED', NOW())
    ON CONFLICT (mobile) DO UPDATE SET kyc_status = EXCLUDED.kyc_status;
  `);

  console.log('\nDatabase seed complete for environment: ' + ENV);
  await client.end();
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
