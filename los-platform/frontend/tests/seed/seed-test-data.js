#!/usr/bin/env node
/**
 * LOS Platform — Test Data Seed Script
 * Populates the database with realistic test data for E2E and performance tests.
 * Usage: node seed-test-data.js [--clean] [--env dev|uat]
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const AUTH_BASE = process.env.TEST_AUTH_URL || 'http://localhost:3002';

const ENV = process.argv.includes('--clean') ? 'clean' : (process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'dev');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function httpPost(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function httpGet(url, headers = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...headers } });
  return { status: res.status, json: await res.json() };
}

async function getToken(mobile) {
  const send = await httpPost(`${AUTH_BASE}/auth/otp/send`, { mobile, purpose: 'LOGIN', channel: 'SMS' });
  const verify = await httpPost(`${AUTH_BASE}/auth/otp/verify`, { mobile, otp: '123456', sessionId: send.json.sessionId });
  return verify.json.accessToken;
}

const TEST_CUSTOMERS = [
  { mobile: '9999000001', name: 'Ravi Sharma', pan: 'AAUSC9991Z', dob: '1985-03-15', income: 120000, netIncome: 96000 },
  { mobile: '9999000002', name: 'Priya Patel', pan: 'AAUSC9992Z', dob: '1988-07-22', income: 150000, netIncome: 120000 },
  { mobile: '9999000003', name: 'Amit Kumar', pan: 'AAUSC9993Z', dob: '1990-01-10', income: 80000, netIncome: 64000 },
  { mobile: '9999000004', name: 'Sneha Reddy', pan: 'AAUSC9994Z', dob: '1992-11-05', income: 95000, netIncome: 76000 },
  { mobile: '9999000005', name: 'Vikram Singh', pan: 'AAUSC9995Z', dob: '1987-06-30', income: 200000, netIncome: 160000 },
  { mobile: '9999000006', name: 'Anita Desai', pan: 'AAUSC9996Z', dob: '1991-09-18', income: 60000, netIncome: 48000 },
  { mobile: '9999000007', name: 'Rajesh Gupta', pan: 'AAUSC9997Z', dob: '1983-12-25', income: 180000, netIncome: 144000 },
  { mobile: '9999000008', name: 'Meera Iyer', pan: 'AAUSC9998Z', dob: '1995-04-12', income: 55000, netIncome: 44000 },
  { mobile: '9999000009', name: 'Suresh Nair', pan: 'AAUSC9999Z', dob: '1989-08-03', income: 110000, netIncome: 88000 },
  { mobile: '9999000010', name: 'Kavitha Rao', pan: 'AAUSC9900Z', dob: '1993-02-28', income: 75000, netIncome: 60000 },
];

const DECISION_PROFILES = [
  { name: 'excellent', score: 850, grade: 'A+', income: 200000, amount: 2000000, tenure: 48, expected: 'APPROVED' },
  { name: 'good', score: 750, grade: 'A', income: 150000, amount: 1000000, tenure: 36, expected: 'APPROVED' },
  { name: 'fair', score: 650, grade: 'B+', income: 100000, amount: 750000, tenure: 36, expected: 'MANUAL_REVIEW' },
  { name: 'poor', score: 550, grade: 'C', income: 60000, amount: 500000, tenure: 24, expected: 'REJECTED' },
  { name: 'very_poor', score: 400, grade: 'D', income: 30000, amount: 400000, tenure: 12, expected: 'REJECTED' },
];

async function seedGoodCustomers() {
  console.log('\n=== Seeding Good Customers ===');
  const results = [];
  for (const customer of TEST_CUSTOMERS.slice(0, 5)) {
    try {
      const token = await getToken(customer.mobile);
      const headers = { Authorization: `Bearer ${token}` };

      const appRes = await httpPost(`${API_BASE}/applications`, {
        loanType: 'PERSONAL_LOAN',
        branchCode: 'BR001',
        applicant: {
          fullName: customer.name,
          dob: customer.dob,
          mobile: customer.mobile,
          panNumber: customer.pan,
        },
        employmentDetails: {
          employmentType: 'SALARIED_PRIVATE',
          employerName: 'Infosys Limited',
          netMonthlyIncome: customer.netIncome,
        },
        loanRequirement: {
          requestedAmount: Math.min(customer.income * 5, 2500000),
          tenureMonths: 36,
        },
      }, headers);

      results.push({ mobile: customer.mobile, appId: appRes.json.applicationId, status: 'DRAFT' });
      console.log(`  ✓ ${customer.name} (${customer.mobile}) → ${appRes.json.applicationId}`);
      await sleep(500);
    } catch (err) {
      console.log(`  ✗ ${customer.mobile}: ${err.message}`);
    }
  }
  return results;
}

async function seedDecisionProfiles() {
  console.log('\n=== Seeding Decision Profiles ===');
  const results = [];
  for (let i = 0; i < DECISION_PROFILES.length; i++) {
    const profile = DECISION_PROFILES[i];
    const customer = TEST_CUSTOMERS[5 + i] || TEST_CUSTOMERS[0];
    try {
      const token = await getToken(customer.mobile);
      const headers = { Authorization: `Bearer ${token}` };

      const appRes = await httpPost(`${API_BASE}/applications`, {
        loanType: 'PERSONAL_LOAN',
        branchCode: 'BR001',
        applicant: {
          fullName: `${profile.name}_user`,
          dob: customer.dob,
          mobile: customer.mobile,
          panNumber: customer.pan,
        },
        employmentDetails: {
          employmentType: 'SALARIED_PRIVATE',
          employerName: 'Test Org',
          netMonthlyIncome: profile.income,
        },
        loanRequirement: {
          requestedAmount: profile.amount,
          tenureMonths: profile.tenure,
        },
      }, headers);

      const appId = appRes.json.applicationId;
      await httpPost(`${API_BASE}/applications/${appId}/submit`, {}, headers);

      results.push({ profile: profile.name, appId, expected: profile.expected });
      console.log(`  ✓ ${profile.name} → ${profile.expected} (${appId})`);
      await sleep(500);
    } catch (err) {
      console.log(`  ✗ ${profile.name}: ${err.message}`);
    }
  }
  return results;
}

async function seedProducts() {
  console.log('\n=== Seeding Loan Products ===');
  console.log('  Note: Products seeded via database migration (001_initial_schema.sql)');
  console.log('  Products: PERSONAL_LOAN, HOME_LOAN, LAP, BUSINESS_LOAN, EDUCATION_LOAN');
}

async function cleanTestData() {
  console.log('\n=== Cleaning Test Data ===');
  console.log('  Note: Cleanup handled by test fixtures via cleanUpCustomer()');
  console.log('  All seeded data should be isolated by unique mobile/PAN per test run');
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   LOS Platform — Test Data Seed Script       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Environment: ${ENV}`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`Auth Base: ${AUTH_BASE}`);

  try {
    const healthRes = await httpGet(`${API_BASE}/health`);
    if (healthRes.status !== 200) {
      console.error('\n✗ Loan service is not reachable');
      process.exit(1);
    }
    console.log('\n✓ Services reachable');
  } catch (err) {
    console.error(`\n✗ Cannot reach services: ${err.message}`);
    process.exit(1);
  }

  if (ENV === 'clean') {
    await cleanTestData();
    console.log('\n✓ Clean complete');
    return;
  }

  await seedProducts();
  const customers = await seedGoodCustomers();
  const decisions = await seedDecisionProfiles();

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Seed Summary                               ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Customers seeded: ${customers.length}`);
  console.log(`Decision profiles seeded: ${decisions.length}`);
  console.log('\nSeed data ready for E2E tests.\n');
}

main().catch(err => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
