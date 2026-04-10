import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

function hashPan(pan: string): string {
  return crypto.createHash('sha256').update(pan.toUpperCase()).digest('hex');
}

function hashMobile(mobile: string): string {
  return crypto.createHash('sha256').update(mobile).digest('hex');
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(1, daysAgo));
  d.setHours(randomInt(9, 18), randomInt(0, 59), randomInt(0, 59));
  return d;
}

function encryptField(value: string): Record<string, unknown> {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: 'aes-256-gcm',
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    keyRef: 'master-key',
  };
}

const BRANCHES = [
  { code: 'BR001', name: 'Mumbai Main Branch', state: 'MH' },
  { code: 'BR002', name: 'Delhi NCR Branch', state: 'DL' },
  { code: 'BR003', name: 'Bangalore South', state: 'KA' },
  { code: 'BR004', name: 'Hyderabad Central', state: 'TS' },
  { code: 'BR005', name: 'Chennai Anna Nagar', state: 'TN' },
  { code: 'BR006', name: 'Pune Camp Branch', state: 'MH' },
  { code: 'BR007', name: 'Ahmedabad SG Highway', state: 'GJ' },
  { code: 'BR008', name: 'Kolkata Park Street', state: 'WB' },
];

const INDIAN_NAMES = [
  'Rajesh Kumar Sharma', 'Priya Venkatesh Iyer', 'Ankit Prakash Gupta',
  'Sneha Raghunath Patil', 'Vikram Singh Rathore', 'Ananya Krishnamurthy Nair',
  'Ravi Teja Madduri', 'Meera Subramaniam Chandrasekhar', 'Arjun Malhotra',
  'Divya Seshadri Iyer', 'Suresh Narayan Pillai', 'Kavitha Rajagopalan',
  'Deepak Vishwanathan', 'Lakshmi Narayanan Iyer', 'Harish Chandrasekaran',
  'Pooja Ramesh Kulkarni', 'Sanjay Krishnamurthy', 'Nisha Venugopal Rao',
  'Manoj Raghavan Nair', 'Anita Balasubramaniam', 'Gaurav Ananthakrishnan',
  'Shweta Krishnaswamy', 'Rohit Narayanaswamy', 'Richa Subramaniam',
  'Vivek Ramachandran Nair', 'Aisha Abdul Rahim Khan',
];

const PANS = [
  'ABCPK1234A', 'XYZAB5678B', 'DEFGR9012C', 'HIJLM4567D', 'NOPQR8901E',
  'STUVW3456F', 'XYZAB7890G', 'CDEFG1234H', 'IJKLM6789I', 'PQRST4567J',
  'UVWXY9012K', 'ABCDE3456L', 'FGHIJ8901M', 'MNOPQ2345N', 'RSTUV7890O',
  'WXYZAB1234P', 'CDEFG5678Q', 'HIJKL0123R', 'MNOPQ4567S', 'PQRST8901T',
];

const MOBILES = [
  '9876543210', '9876543211', '9876543212', '9876543213', '9876543214',
  '9876543215', '9876543216', '9876543217', '9876543218', '9876543219',
  '9988776655', '9988776656', '9988776657', '9988776658', '9988776659',
  '9765432100', '9765432101', '9765432102', '9765432103', '9765432104',
];

const LOAN_TYPES = [
  'HOME_LOAN', 'LAP', 'PERSONAL_LOAN', 'VEHICLE_LOAN_FOUR_WHEELER',
  'VEHICLE_LOAN_TWO_WHEELER', 'EDUCATION_LOAN', 'MSME_TERM_LOAN', 'GOLD_LOAN',
];

const APPLICATION_STATUSES = [
  'SUBMITTED', 'KYC_IN_PROGRESS', 'KYC_COMPLETE', 'DOCUMENT_COLLECTION',
  'UNDER_PROCESSING', 'BUREAU_PULL_IN_PROGRESS', 'BUREAU_PULL_COMPLETE',
  'CREDIT_ASSESSMENT', 'BRANCH_MANAGER_REVIEW', 'APPROVED', 'REJECTED',
];

const USER_ROLES = ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_ANALYST', 'LOAN_OFFICER', 'VIEWER'];

async function run() {
  console.log('Starting LOS seed script...\n');

  const authDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    database: process.env.DB_NAME || 'los_platform',
    entities: ['auth-service/src/entities/*.ts'],
    synchronize: false,
    logging: false,
  });

  const loanDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    database: process.env.DB_NAME || 'los_platform',
    entities: ['loan-service/src/entities/*.ts', 'common/src/audit/*.ts'],
    synchronize: false,
    logging: false,
  });

  const kycDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    database: process.env.DB_NAME || 'los_platform',
    entities: ['kyc-service/src/entities/*.ts'],
    synchronize: false,
    logging: false,
  });

  const decisionDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    database: process.env.DB_NAME || 'los_platform',
    entities: ['decision-engine/src/entities/*.ts', 'decision-engine/src/rates/*.ts'],
    synchronize: false,
    logging: false,
  });

  const documentDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    database: process.env.DB_NAME || 'los_platform',
    entities: ['document-service/src/entities/*.ts'],
    synchronize: false,
    logging: false,
  });

  const integrationDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    database: process.env.DB_NAME || 'los_platform',
    entities: ['integration-service/src/entities/*.ts'],
    synchronize: false,
    logging: false,
  });

  const dsaDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    database: process.env.DB_NAME || 'los_platform',
    entities: ['dsa-service/src/entities/*.ts'],
    synchronize: false,
    logging: false,
  });

  const notificationDs = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    database: process.env.DB_NAME || 'los_platform',
    entities: ['notification-service/src/entities/*.ts'],
    synchronize: false,
    logging: false,
  });

  const datasources = [
    { name: 'auth', ds: authDs },
    { name: 'loan', ds: loanDs },
    { name: 'kyc', ds: kycDs },
    { name: 'decision', ds: decisionDs },
    { name: 'document', ds: documentDs },
    { name: 'integration', ds: integrationDs },
    { name: 'dsa', ds: dsaDs },
    { name: 'notification', ds: notificationDs },
  ];

  for (const { name, ds } of datasources) {
    try {
      await ds.initialize();
      console.log(`✓ Connected to ${name} database`);
    } catch (err) {
      console.error(`✗ Failed to connect to ${name}:`, err);
      process.exit(1);
    }
  }

  console.log('\n--- Seeding Users ---');
  const users: { id: string; role: string; branchCode: string; mobile: string; fullName: string }[] = [];
  const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS);

  for (let i = 0; i < 30; i++) {
    const role = USER_ROLES[i % USER_ROLES.length];
    const branch = BRANCHES[i % BRANCHES.length];
    const fullName = INDIAN_NAMES[i % INDIAN_NAMES.length];
    const mobile = MOBILES[i % MOBILES.length];
    const id = uuidv4();

    await authDs.query(
      `INSERT INTO users (id, employee_id, full_name, email, mobile, mobile_hash, role, status, branch_code, password_hash, failed_login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9, 0, NOW(), NOW())
       ON CONFLICT (mobile) DO NOTHING`,
      [
        id,
        `EMP${String(i + 1).padStart(4, '0')}`,
        fullName,
        `${fullName.split(' ')[0].toLowerCase()}${i}@losbank.in`,
        mobile,
        hashMobile(mobile),
        role,
        branch.code,
        passwordHash,
      ],
    );
    users.push({ id, role, branchCode: branch.code, mobile, fullName });
  }
  console.log(`  ✓ Created 30 users across ${BRANCHES.length} branches`);

  const loanOfficers = users.filter(u => u.role === 'LOAN_OFFICER');
  const analysts = users.filter(u => u.role === 'CREDIT_ANALYST');
  const managers = users.filter(u => u.role === 'BRANCH_MANAGER');

  console.log('\n--- Seeding Loan Applications ---');
  const applications: { id: string; appNumber: string; status: string; panHash: string; userId: string; pan: string }[] = [];

  for (let i = 0; i < 60; i++) {
    const id = uuidv4();
    const appNumber = `LOS${new Date().getFullYear()}${String(i + 1).padStart(6, '0')}`;
    const status = APPLICATION_STATUSES[randomInt(0, APPLICATION_STATUSES.length - 1)];
    const branch = BRANCHES[randomInt(0, BRANCHES.length - 1)];
    const loanType = LOAN_TYPES[randomInt(0, LOAN_TYPES.length - 1)];
    const pan = PANS[i % PANS.length];
    const panHash = hashPan(pan);
    const name = INDIAN_NAMES[i % INDIAN_NAMES.length];
    const mobile = MOBILES[i % MOBILES.length];
    const userId = users[randomInt(0, users.length - 1)].id;
    const dob = new Date(1975 + randomInt(0, 30), randomInt(0, 11), randomInt(1, 28));
    const requestedAmount = randomInt(1, 50) * 100000;
    const officer = loanOfficers.length > 0 ? randomElement(loanOfficers) : null;
    const analyst = analysts.length > 0 ? randomElement(analysts) : null;
    const manager = managers.length > 0 ? randomElement(managers) : null;

    await loanDs.query(
      `INSERT INTO loan_applications (
        id, application_number, status, loan_type, customer_segment, channel_code,
        branch_code, applicant_full_name, applicant_dob, applicant_mobile,
        applicant_mobile_hash, applicant_pan_hash, applicant_pan_encrypted,
        applicant_gender, applicant_pincode, applicant_state,
        applicant_profile, employment_details, loan_requirement,
        user_id, assigned_officer_id, assigned_analyst_id, requested_amount,
        dsa_code, dsa_name, submitted_at, created_at, updated_at, version
      ) VALUES (
        $1,$2,$3,$4,'RETAIL','BRANCH',$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,
        '{"annual_income": 800000, "occupation": "Salaried"}',
        '{"designation": "Software Engineer", "company_name": "Tech Corp", "employment_type": "SALARIED_PRIVATE"}',
        '{"purpose": "Home Purchase", "tenure_preference_months": 240}',
        $15,$16,$17,$18,'DSA001','DSA Channel Partner',
        $19, $20, $21, 1
      ) ON CONFLICT (application_number) DO NOTHING`,
      [
        id, appNumber, status, loanType,
        branch.code, name, dob, mobile,
        hashMobile(mobile), panHash, JSON.stringify(encryptField(pan)),
        randomElement(['M', 'F']),
        String(randomInt(400000, 600000)),
        branch.state,
        userId,
        officer?.id || null,
        analyst?.id || null,
        requestedAmount,
        status === 'SUBMITTED' || status === 'KYC_IN_PROGRESS' ? randomDate(60) : null,
        randomDate(90), randomDate(90),
      ],
    );

    applications.push({ id, appNumber, status, panHash, userId, pan });
  }
  console.log(`  ✓ Created 60 loan applications`);

  const creditAssessmentApps = applications.filter(a => a.status === 'CREDIT_ASSESSMENT');
  const managerReviewApps = applications.filter(a => a.status === 'BRANCH_MANAGER_REVIEW');
  const approvedApps = applications.filter(a => a.status === 'APPROVED');
  const rejectedApps = applications.filter(a => a.status === 'REJECTED');

  console.log('\n--- Seeding KYC Records ---');
  let kycCount = 0;
  for (const app of applications.slice(0, 40)) {
    const kycId = uuidv4();
    const statuses = ['KYC_COMPLETE', 'KYC_COMPLETE', 'KYC_COMPLETE', 'AADHAAR_OTP_SENT', 'AADHAAR_VERIFIED', 'PAN_VERIFIED', 'KYC_FAILED'];
    const status = statuses[randomInt(0, statuses.length - 1)];

    await kycDs.query(
      `INSERT INTO kyc_records (id, application_id, user_id, status, overall_risk_score, reviewed_by, review_notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       ON CONFLICT (application_id) DO NOTHING`,
      [
        kycId, app.id, app.userId, status,
        status === 'KYC_COMPLETE' ? randomInt(10, 85) : null,
        status === 'KYC_COMPLETE' ? randomElement(analysts)?.id || null : null,
        status === 'KYC_COMPLETE' ? 'Verified and approved.' : null,
      ],
    );
    kycCount++;

    if (status === 'KYC_COMPLETE') {
      await kycDs.query(
        `INSERT INTO aadhaar_kyc_results (id, kyc_id, txn_id, uidai_ref_id, aadhaar_number_hash, name, dob, gender, address_json, photo_storage_key, signature_valid, uidai_response_code, auth_code, verified_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,'100','XML-SIG-SUCCESS',NOW())
         ON CONFLICT (kyc_id) DO NOTHING`,
        [
          uuidv4(), kycId, `TXN${Date.now()}${randomInt(1000, 9999)}`,
          `UIDAI${randomInt(100000000000, 999999999999)}`,
          hashPan(`AADHAAR${randomInt(100000000000, 999999999999)}`),
          INDIAN_NAMES[randomInt(0, INDIAN_NAMES.length - 1)],
          new Date(1975 + randomInt(0, 30), randomInt(0, 11), randomInt(1, 28)),
          randomElement(['M', 'F']),
          JSON.stringify({ address: '123 Sample Street, Sample City, Sample State - 400001' }),
          `photo/${kycId}.jpg`,
        ],
      );

      await kycDs.query(
        `INSERT INTO pan_verification_results (id, kyc_id, pan_number_masked, pan_number_encrypted, name_match_score, name_on_pan, dob_match, pan_status, linked_aadhaar, verified_at)
         VALUES ($1,$2,$3,$4,${randomInt(75, 100)},$5,true,'ACTIVE',true,NOW())
         ON CONFLICT DO NOTHING`,
        [
          uuidv4(), kycId,
          `${app.pan.substring(0, 5)}XXXX`,
          JSON.stringify(encryptField(app.pan)),
          INDIAN_NAMES[randomInt(0, INDIAN_NAMES.length - 1)],
        ],
      );

      await kycDs.query(
        `INSERT INTO consent_records (id, user_id, application_id, consent_type, consent_text, consent_version, is_granted, granted_at, ip_address)
         VALUES ($1,$2,$3,'BUREAU_CONSENT','I consent to my credit information being fetched.', '1.0', true, NOW(), '127.0.0.1')
         ON CONFLICT DO NOTHING`,
        [uuidv4(), app.userId, app.id],
      );
    }
  }
  console.log(`  ✓ Created ${kycCount} KYC records with consent`);

  console.log('\n--- Seeding Bureau Data ---');
  let bureauCount = 0;
  for (const app of applications.slice(0, 35)) {
    const bureauId = uuidv4();
    const reportId = uuidv4();
    const score = randomInt(300, 900);
    const providers = ['CIBIL', 'EXPERIAN', 'EQUIFAX', 'CRIF'];
    const provider = providers[randomInt(0, providers.length - 1)];
    const totalExposure = randomInt(1, 30) * 50000;
    const activeAccounts = randomInt(1, 8);
    const totalAccounts = activeAccounts + randomInt(0, 5);

    await integrationDs.query(
      `INSERT INTO bureau_pull_jobs (
        id, application_id, applicant_id, pan_hash, provider, status,
        consent_timestamp, request_timestamp, response_timestamp,
        request_payload, response_payload, error_code, retry_count, report_id, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,'SUCCESS',NOW()-INTERVAL '${randomInt(1, 30)} DAYS',NOW()-INTERVAL '${randomInt(1, 20)} DAYS',NOW()-INTERVAL '${randomInt(1, 10)} DAYS',
        '{}','{}',NULL,0,$6,NOW(),NOW())
       ON CONFLICT DO NOTHING`,
      [bureauId, app.id, app.userId, app.panHash, provider, reportId],
    );

    await integrationDs.query(
      `INSERT INTO bureau_reports (
        id, application_id, pull_job_id, provider, pan_hash, status,
        raw_xml, raw_json, parsed_score, parsed_grade,
        parsed_dpd_0_30, parsed_dpd_31_60, parsed_dpd_61_90, parsed_dpd_over_90,
        parsed_total_accounts, parsed_active_accounts, parsed_closed_accounts,
        parsed_total_exposure, parsed_secured_exposure, parsed_unsecured_exposure,
        parsed_total_emi, parsed_enquiries_30d, parsed_enquiries_90d,
        parsed_writeoffs, parsed_suit_filed, parsed_disputed,
        parsed_account_summary, parsed_enquiry_summary,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,'PARSED',
        '<CIBILReport></CIBILReport>',
        '{}',$6,$7,
        ${randomInt(0, 2)},${randomInt(0, 2)},${randomInt(0, 1)},${randomInt(0, 1)},
        ${totalAccounts},${activeAccounts},${totalAccounts - activeAccounts},
        ${totalExposure},${Math.round(totalExposure * 0.7)},${Math.round(totalExposure * 0.3)},
        ${randomInt(1, 5) * 5000},${randomInt(0, 5)},${randomInt(0, 10)},
        ${randomInt(0, 1)},false,false,
        '${JSON.stringify([{ accountNumber: 'ACC123456', accountType: 'Home Loan', bureauAccountType: 'Secured', status: 'Active', ownershipType: 'Individual', currentBalance: totalExposure, sanctionAmount: totalExposure * 1.2, overdueAmount: 0, dpd: 0, dpdMonths: 0, openedDate: '2020-01-15', closedDate: null, lastPaymentDate: '2024-03-01', lender: 'HDFC Bank', product: 'Home Loan' }]).replace(/'/g, "''")}',
        '${JSON.stringify([{ enquiryDate: '2024-01-10', enquiryAmount: 5000000, enquiryPurpose: 'Home Loan', lender: 'ICICI Bank', bureauAccountType: 'Secured' }]).replace(/'/g, "''")}',
        NOW(),NOW())
       ON CONFLICT (application_id, provider) DO NOTHING`,
      [
        reportId, app.id, bureauId, provider, app.panHash,
        score,
        score >= 800 ? 'A+' : score >= 750 ? 'A' : score >= 700 ? 'B+' : score >= 650 ? 'B' : score >= 550 ? 'C' : 'D',
      ],
    );
    bureauCount++;
  }

  for (const app of applications.slice(0, 30)) {
    const score = randomInt(300, 900);
    await integrationDs.query(
      `INSERT INTO bureau_aggregated_scores (
        id, application_id, primary_provider, primary_score, cibil_score, experian_score, equifax_score, crif_score,
        max_dpd, total_exposure, total_emi, active_accounts, enquiries_30d, writeoffs, suit_filed, disputed, bureau_report_ids, created_at
      ) VALUES ($1,$2,'CIBIL',$3,$3,${randomInt(300, 900)},${randomInt(300, 900)},${randomInt(300, 900)},
        ${randomInt(0, 90)},${randomInt(1, 30) * 50000},${randomInt(1, 5) * 5000},${randomInt(1, 8)},${randomInt(0, 5)},
        ${randomInt(0, 1)},false,false,'[]',NOW())
       ON CONFLICT (application_id) DO NOTHING`,
      [uuidv4(), app.id, score],
    );
  }
  console.log(`  ✓ Created ${bureauCount} bureau records and aggregated scores`);

  console.log('\n--- Seeding Decisions ---');
  let decisionCount = 0;

  for (const app of creditAssessmentApps) {
    const id = uuidv4();
    const decidedAt = randomDate(15);
    const score = randomInt(650, 850);
    const grade = score >= 800 ? 'A+' : score >= 750 ? 'A' : score >= 700 ? 'B+' : score >= 650 ? 'B' : 'C';
    const amount = app.id ? randomInt(5, 30) * 100000 : 0;

    await decisionDs.query(
      `INSERT INTO decision_results (
        id, application_id, status, final_decision, approved_amount, approved_tenure_months,
        interest_rate_type, rate_of_interest_bps, spread_bps, benchmark_rate, processing_fee_paisa,
        insurance_mandatory, ltv_ratio, foir_actual, scorecard_result, conditions,
        decided_by, decided_at, policy_version, created_at, version
      ) VALUES ($1,$2,'PENDING_OVERRIDE','APPROVED',$3,${randomInt(12, 240)},
        'FLOATING',${800 + randomInt(0, 200)},${100 + randomInt(0, 100)},'MCLR_1Y',${amount * 0.01},
        false,${randomInt(50, 85)}.${randomInt(0, 99)},${randomInt(30, 55)}.${randomInt(0, 99)},
        '{"score":${score},"grade":"${grade}","factors":[]}','[]',
        'RULE_ENGINE',$4,'1.0.0',NOW(),1)
       ON CONFLICT (application_id) DO NOTHING`,
      [id, app.id, amount, decidedAt],
    );
    decisionCount++;
  }

  for (const app of managerReviewApps) {
    const id = uuidv4();
    const decidedAt = randomDate(10);
    const score = randomInt(650, 850);
    const amount = randomInt(5, 30) * 100000;

    await decisionDs.query(
      `INSERT INTO decision_results (
        id, application_id, status, final_decision, approved_amount, approved_tenure_months,
        interest_rate_type, rate_of_interest_bps, spread_bps, benchmark_rate, processing_fee_paisa,
        insurance_mandatory, ltv_ratio, foir_actual, scorecard_result, conditions,
        decided_by, decided_at, policy_version, created_at, version
      ) VALUES ($1,$2,'PENDING','APPROVED',$3,${randomInt(12, 240)},
        'FLOATING',${800 + randomInt(0, 200)},${100 + randomInt(0, 100)},'MCLR_1Y',${amount * 0.01},
        false,${randomInt(50, 85)}.${randomInt(0, 99)},${randomInt(30, 55)}.${randomInt(0, 99)},
        '{"score":${score},"grade":"${score >= 750 ? 'A' : score >= 700 ? 'B+' : 'B'}","factors":[]}',
        $4,'RULE_ENGINE',$5,'1.0.0',NOW(),1)
       ON CONFLICT (application_id) DO NOTHING`,
      [id, app.id, amount, JSON.stringify([{ type: 'pre_disbursement', condition: 'Property valuation above INR 1.2x LTV' }]), decidedAt],
    );
    decisionCount++;
  }

  for (const app of approvedApps) {
    const id = uuidv4();
    const decidedAt = randomDate(20);
    const score = randomInt(700, 900);
    const amount = randomInt(5, 50) * 100000;

    await decisionDs.query(
      `INSERT INTO decision_results (
        id, application_id, status, final_decision, approved_amount, approved_tenure_months,
        interest_rate_type, rate_of_interest_bps, spread_bps, benchmark_rate, processing_fee_paisa,
        insurance_mandatory, ltv_ratio, foir_actual, scorecard_result,
        decided_by, decided_at, policy_version, created_at, version
      ) VALUES ($1,$2,'APPROVED','APPROVED',$3,${randomInt(12, 240)},
        'FLOATING',${850 + randomInt(0, 150)},${75 + randomInt(0, 75)},'MCLR_1Y',${amount * 0.01},
        false,${randomInt(50, 80)}.${randomInt(0, 99)},${randomInt(30, 50)}.${randomInt(0, 99)},
        '{"score":${score},"grade":"${score >= 800 ? 'A+' : 'A'}","factors":[]}',
        'RULE_ENGINE',$4,'1.0.0',NOW(),1)
       ON CONFLICT (application_id) DO NOTHING`,
      [id, app.id, amount, decidedAt],
    );

    await decisionDs.query(
      `INSERT INTO decision_rule_results (id, decision_id, rule_id, rule_name, category, outcome, threshold, actual_value, message, is_hard_stop)
       VALUES ($1,$2,'R001','Min CIBIL Score','BUREAU_SCORE','PASS','650','${score}','Score ${score} exceeds minimum','false'),
              ($3,$4,'R002','Max FOIR','DEBT_ANALYSIS','PASS','55%','${randomInt(35, 50)}%','FOIR within limits','false'),
              ($5,$6,'R003','No Suit Filed','LEGAL_CHECK','PASS','N/A','false','No legal issues found','false')`,
      [uuidv4(), id, uuidv4(), id, uuidv4(), id],
    );
    decisionCount++;
  }

  for (const app of rejectedApps) {
    const id = uuidv4();
    const decidedAt = randomDate(15);
    const reasons = ['LOW_CIBIL_SCORE', 'HIGH_DPD', 'EXCESSIVE_ENQUIRIES', 'INCOME_NOT_MET', 'DOCUMENTS_INVALID'];

    await decisionDs.query(
      `INSERT INTO decision_results (
        id, application_id, status, final_decision, decided_by, decided_at,
        rejection_reason_code, rejection_remarks, policy_version, created_at, version
      ) VALUES ($1,$2,'REJECTED','REJECTED','RULE_ENGINE',$3,$4,'Application rejected as per policy.',
        '1.0.0',NOW(),1)
       ON CONFLICT (application_id) DO NOTHING`,
      [id, app.id, decidedAt, randomElement(reasons)],
    );
    decisionCount++;
  }
  console.log(`  ✓ Created ${decisionCount} decision records`);

  console.log('\n--- Seeding Documents ---');
  const docTypes = [
    'PAN', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'BANK_STATEMENT',
    'SALARY_SLIP_1', 'SALARY_SLIP_2', 'SALARY_SLIP_3', 'PHOTO', 'SIGNATURE',
    'PROPERTY_DOCUMENT', 'FORM_16', 'ITR',
  ];
  let docCount = 0;

  for (const app of applications.slice(0, 45)) {
    const numDocs = randomInt(4, docTypes.length);
    const selectedTypes = docTypes.slice(0, numDocs);

    for (const docType of selectedTypes) {
      const docId = uuidv4();
      const bucket = 'los-documents';
      const objectKey = `applications/${app.id}/${docType.toLowerCase()}/${docId}.pdf`;
      const statuses = ['APPROVED', 'APPROVED', 'UPLOADED', 'UNDER_REVIEW', 'PENDING', 'REJECTED'];
      const status = statuses[randomInt(0, statuses.length - 1)];
      const reviewer = analysts.length > 0 ? randomElement(analysts) : null;

      await documentDs.query(
        `INSERT INTO documents (
          id, application_id, document_type, status, file_name, original_name, mime_type, file_size, checksum,
          bucket_name, object_key, ocr_provider, ocr_confidence, ocr_attempts, reviewer_id, reviewed_at, review_remarks, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'application/pdf',${randomInt(50000, 2000000)},'${crypto.randomBytes(32).toString('hex')}',
          $7,$8,'KARZA',${status === 'APPROVED' ? randomInt(75, 99) : null},${randomInt(0, 2)},
          $9,$10,$11,NOW(),NOW())`,
        [
          docId, app.id, docType, status,
          `${docType.toLowerCase()}_${app.appNumber}.pdf`,
          `${docType} Document - ${app.appNumber}`,
          bucket, objectKey,
          status !== 'UPLOADED' && status !== 'PENDING' ? reviewer?.id : null,
          status !== 'UPLOADED' && status !== 'PENDING' ? randomDate(20) : null,
          status !== 'UPLOADED' && status !== 'PENDING' ? `Reviewed by ${reviewer?.fullName || 'Analyst'}` : null,
        ],
      );
      docCount++;

      if (status !== 'UPLOADED' && status !== 'PENDING') {
        await documentDs.query(
          `INSERT INTO document_reviews (id, document_id, application_id, reviewer_id, reviewer_role, action, previous_status, new_status, remarks, created_at)
           VALUES ($1,$2,$3,$4,'CREDIT_ANALYST',$5,'PENDING',$6,$7,NOW())`,
          [
            uuidv4(), docId, app.id,
            reviewer?.id || null,
            status === 'APPROVED' ? 'APPROVE' : 'REJECT',
            status,
            `Document ${status.toLowerCase()} by reviewer.`,
          ],
        );
      }
    }
  }
  console.log(`  ✓ Created ${docCount} documents`);

  console.log('\n--- Seeding DSA Partners & Officers ---');
  const dsaPartnerId = uuidv4();
  const dsaPasswordHash = await bcrypt.hash('dsapassword123', SALT_ROUNDS);

  await dsaDs.query(
    `INSERT INTO dsa_partners (
      id, partner_code, partner_name, partner_type, status, pan_hash, pan_enc,
      registered_address, city, state, pincode, contact_name, contact_mobile,
      contact_email, primary_bank_account, primary_ifsc, bank_account_holder,
      commission_type, upfront_commission_bps, trail_commission_bps,
      min_loan_amount, max_loan_amount, territory_codes, allowed_products,
      total_disbursed_amount, total_applications, total_disbursements,
      onboarding_officer_id, password_hash, created_at, updated_at
    ) VALUES (
      $1,'DSA001','Credit Solutions India Pvt Ltd','PRIVATE_LIMITED','APPROVED',
      $2,$3,'401 Corporate Park, Andheri East','Mumbai','MH','400069',
      'Ramesh Kumar','9876543210','ramesh@creditsolutions.in',
      'HDFC0000123','HDFC0CBL012','Ramesh Kumar','HYBRID',150,75,
      500000,50000000,'["MH","DL","KA","TN"]','["HOME_LOAN","LAP","PERSONAL_LOAN"]',
      125000000,47,23, $4, $5, NOW(), NOW()
    ) ON CONFLICT (partner_code) DO NOTHING`,
    [dsaPartnerId, hashPan('AAACS1234A'), Buffer.from(JSON.stringify(encryptField('AAACS1234A'))), users[0]?.id || null, dsaPasswordHash],
  );

  const officerIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const oid = uuidv4();
    officerIds.push(oid);
    const name = INDIAN_NAMES[20 + i];
    const mobile = MOBILES[10 + i];

    await dsaDs.query(
      `INSERT INTO dsa_officers (
        id, partner_id, employee_code, full_name, mobile_hash, mobile_enc, email_hash,
        email_enc, password_hash, designation, department, status, territory_codes,
        allowed_products, max_sanction_authority, total_applications, total_disbursements,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Senior DSA Officer','Sales','ACTIVE',
        '["MH","DL"]','["HOME_LOAN","PERSONAL_LOAN"]',5000000,0,0,NOW(),NOW())
       ON CONFLICT (employee_code) DO NOTHING`,
      [
        oid, dsaPartnerId, `DSAEMP${String(i + 1).padStart(4, '0')}`,
        name, hashMobile(mobile),
        Buffer.from(JSON.stringify(encryptField(mobile))),
        hashPan(`${name.split(' ')[0]}@email.com`),
        Buffer.from(JSON.stringify(encryptField(`${name.split(' ')[0]}@email.com`))),
        dsaPasswordHash,
      ],
    );
  }
  console.log(`  ✓ Created 1 DSA partner with 5 officers`);

  for (let i = 0; i < 10; i++) {
    const appNum = `DSA${new Date().getFullYear()}${String(i + 100).padStart(6, '0')}`;
    const officerId = randomElement(officerIds);

    await dsaDs.query(
      `INSERT INTO dsa_applications (
        id, application_number, partner_id, officer_id, customer_name, customer_mobile_hash,
        customer_pan_hash, loan_type, requested_amount, requested_tenure_months, status,
        branch_code, utm_source, utm_medium, remarks, source_lead_id, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${randomInt(12, 240)},
        $10,$11,'Organic','Google Ads','Lead from digital campaign','LEAD${i + 1}',NOW(),NOW())
       ON CONFLICT (application_number) DO NOTHING`,
      [
        uuidv4(), appNum, dsaPartnerId, officerId,
        INDIAN_NAMES[randomInt(0, INDIAN_NAMES.length - 1)],
        hashMobile(MOBILES[randomInt(0, MOBILES.length - 1)]),
        hashPan(PANS[randomInt(0, PANS.length - 1)]),
        randomElement(LOAN_TYPES),
        randomInt(5, 30) * 100000,
        randomElement(['SUBMITTED', 'CONVERTED', 'DISCARDED']),
        BRANCHES[randomInt(0, BRANCHES.length - 1)].code,
      ],
    );
  }
  console.log(`  ✓ Created 10 DSA applications`);

  console.log('\n--- Seeding Decision Engine Products & Rates ---');
  const products = [
    { code: 'HL-001', type: 'HOME_LOAN', minAmt: 500000, maxAmt: 100000000, minTenure: 12, maxTenure: 360, baseRate: 825, procFee: 0.5 },
    { code: 'LAP-001', type: 'LAP', minAmt: 100000, maxAmt: 50000000, minTenure: 12, maxTenure: 180, baseRate: 1050, procFee: 1.0 },
    { code: 'PL-001', type: 'PERSONAL_LOAN', minAmt: 50000, maxAmt: 5000000, minTenure: 12, maxTenure: 60, baseRate: 1200, procFee: 2.0 },
    { code: 'VL4W-001', type: 'VEHICLE_LOAN_FOUR_WHEELER', minAmt: 200000, maxAmt: 20000000, minTenure: 12, maxTenure: 84, baseRate: 950, procFee: 0.5 },
    { code: 'VL2W-001', type: 'VEHICLE_LOAN_TWO_WHEELER', minAmt: 20000, maxAmt: 500000, minTenure: 6, maxTenure: 48, baseRate: 1400, procFee: 1.0 },
    { code: 'EDU-001', type: 'EDUCATION_LOAN', minAmt: 100000, maxAmt: 20000000, minTenure: 12, maxTenure: 180, baseRate: 900, procFee: 0.0 },
    { code: 'MSME-001', type: 'MSME_TERM_LOAN', minAmt: 100000, maxAmt: 100000000, minTenure: 12, maxTenure: 120, baseRate: 1100, procFee: 1.5 },
    { code: 'GL-001', type: 'GOLD_LOAN', minAmt: 10000, maxAmt: 50000000, minTenure: 3, maxTenure: 36, baseRate: 700, procFee: 0.25 },
  ];

  for (const p of products) {
    await decisionDs.query(
      `INSERT INTO loan_product_configs (
        id, product_code, loan_type, min_amount, max_amount, min_tenure_months, max_tenure_months,
        min_age, max_age, min_credit_score, max_foir, base_rate_bps, spread_bps,
        processing_fee_percent, is_active, effective_from, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,18,65,650,50.00,$8,50,$9,true,NOW(),NOW())
       ON CONFLICT (product_code) DO NOTHING`,
      [
        uuidv4(), p.code, p.type, p.minAmt, p.maxAmt, p.minTenure, p.maxTenure,
        p.baseRate, p.procFee,
      ],
    );
  }
  console.log(`  ✓ Created ${products.length} loan product configs`);

  const benchmarks = [
    { type: 'MCLR_1Y', rate: 8.90 },
    { type: 'MCLR_3M', rate: 8.75 },
    { type: 'REPO_RATE', rate: 6.50 },
    { type: 'T_BILL_91D', rate: 7.10 },
    { type: 'BASE_RATE', rate: 8.85 },
  ];

  for (const b of benchmarks) {
    await decisionDs.query(
      `INSERT INTO benchmark_rates (id, type, rate, effective_from, published_by, updated_at)
       VALUES ($1,$2,$3,NOW(),'RBI / Internal',NOW())
       ON CONFLICT (type) DO UPDATE SET rate = $3, updated_at = NOW()`,
      [uuidv4(), b.type, b.rate],
    );
  }
  console.log(`  ✓ Created ${benchmarks.length} benchmark rates`);

  const rateConfigs = [
    { product: 'HL-001', minRate: 825, maxRate: 1150, defaultSpread: 50, benchmark: 'MCLR_1Y' },
    { product: 'LAP-001', minRate: 1050, maxRate: 1650, defaultSpread: 100, benchmark: 'MCLR_1Y' },
    { product: 'PL-001', minRate: 1200, maxRate: 2400, defaultSpread: 200, benchmark: 'MCLR_1Y' },
    { product: 'VL4W-001', minRate: 950, maxRate: 1450, defaultSpread: 75, benchmark: 'MCLR_1Y' },
    { product: 'GL-001', minRate: 700, maxRate: 1100, defaultSpread: 25, benchmark: 'MCLR_1Y' },
  ];

  for (const rc of rateConfigs) {
    await decisionDs.query(
      `INSERT INTO interest_rate_configs (
        id, product_code, benchmark_type, interest_rate_type, min_rate_bps, max_rate_bps,
        default_spread_bps, tenure_spread_bands, credit_grade_spreads, employment_adjustments_bps,
        is_active, effective_from, created_at
      ) VALUES ($1,$2,$3,'FLOATING',$4,$5,$6,
        '[{"minTenureMonths":12,"maxTenureMonths":60,"benchmarkType":"MCLR_1Y","additionalSpreadBps":25,"description":"Short tenure"},{"minTenureMonths":61,"maxTenureMonths":360,"benchmarkType":"MCLR_1Y","additionalSpreadBps":0,"description":"Standard tenure"}]',
        '[{"grade":"A+","minSpreadBps":0,"maxSpreadBps":25,"description":"Grade A+"},{"grade":"A","minSpreadBps":25,"maxSpreadBps":50,"description":"Grade A"},{"grade":"B+","minSpreadBps":50,"maxSpreadBps":100,"description":"Grade B+"},{"grade":"B","minSpreadBps":100,"maxSpreadBps":150,"description":"Grade B"},{"grade":"C","minSpreadBps":150,"maxSpreadBps":200,"description":"Grade C"},{"grade":"D","minSpreadBps":200,"maxSpreadBps":300,"description":"Grade D"}]',
        '{"SALARIED":0,"SELF_EMPLOYED":50,"AGRICULTURALIST":-25,"PENSIONER":25}',
        true, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), rc.product, rc.benchmark, rc.minRate, rc.maxRate, rc.defaultSpread],
    );
  }
  console.log(`  ✓ Created ${rateConfigs.length} interest rate configs`);

  console.log('\n--- Seeding Notification Templates & Notifications ---');
  const templates = [
    { name: 'APP_SUBMITTED', category: 'APPLICATION_STATUS', channel: 'SMS', subject: 'Application Submitted', body: 'Dear Customer, Your loan application {{application_number}} has been submitted successfully. Reference: {{application_number}}' },
    { name: 'KYC_INITIATED', category: 'KYC_UPDATE', channel: 'SMS', subject: 'KYC Verification Started', body: 'Dear Customer, Your KYC verification has been initiated for application {{application_number}}.' },
    { name: 'KYC_COMPLETE', category: 'KYC_UPDATE', channel: 'SMS', subject: 'KYC Verified', body: 'Dear Customer, Your KYC has been verified successfully. Application {{application_number}} proceeding to next stage.' },
    { name: 'DECISION_APPROVED', category: 'DECISION', channel: 'SMS', subject: 'Loan Approved!', body: 'Congratulations! Your loan application {{application_number}} has been APPROVED for INR {{approved_amount}}. Log in to accept sanction letter.' },
    { name: 'DECISION_REJECTED', category: 'DECISION', channel: 'SMS', subject: 'Application Update', body: 'Dear Customer, Your loan application {{application_number}} status has been updated. Please log in to view details.' },
    { name: 'DOC_REMINDER', category: 'DOCUMENT_REMINDER', channel: 'SMS', subject: 'Documents Required', body: 'Dear Customer, Please upload pending documents for application {{application_number}} to proceed faster.' },
    { name: 'SANCTION_LETTER', category: 'SANCTION', channel: 'EMAIL', subject: 'Sanction Letter Available', body: 'Dear Customer, Your sanction letter for application {{application_number}} is now available. Please review and accept within 30 days.' },
    { name: 'DISBURSEMENT_SUCCESS', category: 'DISBURSEMENT', channel: 'SMS', subject: 'Disbursement Successful', body: 'Dear Customer, INR {{disbursed_amount}} has been disbursed to your account for loan {{application_number}}. EMI: INR {{emi_amount}}' },
    { name: 'EMI_REMINDER', category: 'EMI_REMINDER', channel: 'SMS', subject: 'EMI Due Reminder', body: 'Dear Customer, EMI of INR {{emi_amount}} is due on {{due_date}} for your loan account. Auto-debit has been set up.' },
    { name: 'OTP_NOTIFICATION', category: 'OTP', channel: 'SMS', subject: 'One Time Password', body: 'Your OTP is {{otp}}. Valid for 5 minutes. Do not share with anyone.' },
  ];

  for (const t of templates) {
    await notificationDs.query(
      `INSERT INTO notification_templates (
        id, template_name, display_name, category, channel, subject, body,
        body_hi, body_bilingual, is_active, is_transactional, priority,
        min_delay_seconds, version, created_at, updated_at
      ) VALUES ($1,$2,$3,'${t.category}','${t.channel}','${t.subject}','${t.body}',
        NULL,NULL,true,true,'NORMAL',5,1,NOW(),NOW())
       ON CONFLICT (template_name, channel) DO NOTHING`,
      [uuidv4(), t.name, `${t.name} - ${t.channel}`],
    );
  }
  console.log(`  ✓ Created ${templates.length} notification templates`);

  let notifCount = 0;
  for (const app of applications.slice(0, 20)) {
    const channels = ['SMS', 'EMAIL', 'IN_APP'];
    const channel = channels[randomInt(0, channels.length - 1)] as 'SMS' | 'EMAIL' | 'IN_APP';
    const statuses = ['SENT', 'DELIVERED', 'QUEUED', 'FAILED'];

    await notificationDs.query(
      `INSERT INTO notifications (
        id, application_id, user_id, recipient_id, channel, category, status, priority,
        subject, rendered_content, raw_payload, sent_at, delivered_at, error_code, error_message, retry_count, max_retries, locale, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,'${channel}','APPLICATION_STATUS','${statuses[randomInt(0, statuses.length - 1)]}','NORMAL',
        'Application ${app.appNumber} Update', 'Your application ${app.appNumber} status: ${app.status}',
        '{}',NOW()-INTERVAL '${randomInt(1, 15)} DAYS',NOW()-INTERVAL '${randomInt(0, 10)} DAYS',
        NULL,NULL,0,3,'en',NOW(),NOW())`,
      [uuidv4(), app.id, app.userId, app.userId],
    );
    notifCount++;
  }
  console.log(`  ✓ Created ${notifCount} notifications`);

  console.log('\n--- Seeding Stage History ---');
  let stageCount = 0;
  for (const app of applications.slice(0, 30)) {
    const stages = [
      'APPLICATION_SUBMITTED', 'KYC_INITIATED', 'DOCUMENT_COLLECTION',
      'BUREAU_PULL', 'CREDIT_ASSESSMENT', 'DECISION_GENERATED',
    ];
    const currentIdx = stages.indexOf(app.status.replace(' ', '_').toUpperCase());

    for (let s = 0; s <= Math.max(0, currentIdx); s++) {
      await loanDs.query(
        `INSERT INTO stage_history (
          id, application_id, from_stage, to_stage, action, performed_by, performed_at, remarks
        ) VALUES ($1,$2,$3,$4,'SYSTEM_MOVED',$5,$6,'Automated stage transition')
         ON CONFLICT DO NOTHING`,
        [
          uuidv4(), app.id,
          s === 0 ? null : stages[s - 1],
          stages[s],
          randomElement([...loanOfficers, ...analysts, ...managers].filter(Boolean).map(u => u?.id) as string[]),
          randomDate(60),
        ],
      );
      stageCount++;
    }
  }
  console.log(`  ✓ Created ${stageCount} stage history records`);

  console.log('\n--- Seeding Audit Logs ---');
  let auditCount = 0;
  const auditActions = ['APPLICATION_CREATED', 'APPLICATION_SUBMITTED', 'STATUS_CHANGED', 'DOCUMENT_UPLOADED', 'KYC_VERIFIED', 'BUREAU_PULLED', 'DECISION_GENERATED', 'OVERRIDE_REQUESTED'];
  for (const app of applications.slice(0, 40)) {
    const actor = randomElement([...loanOfficers, ...analysts, ...managers].filter(Boolean));
    const action = auditActions[randomInt(0, auditActions.length - 1)];

    await loanDs.query(
      `INSERT INTO audit_logs (
        id, user_id, action, category, resource_type, resource_id, application_id,
        ip_address, user_agent, metadata, created_at
      ) VALUES ($1,$2,$3,'LOAN_APPLICATION','APPLICATION',$4,$5,'127.0.0.1',
        'LOS-Seed-Script/1.0','{"seed":true}',$6)`,
      [uuidv4(), actor?.id || null, action, app.id, app.id, randomDate(90)],
    );
    auditCount++;
  }
  console.log(`  ✓ Created ${auditCount} audit log entries`);

  for (const { ds, name } of datasources) {
    await ds.destroy();
  }

  console.log('\n========================================');
  console.log('SEED COMPLETE');
  console.log('========================================');
  console.log('\nTest credentials:');
  console.log('  Password for all seeded users: password123');
  console.log('  Password for DSA: dsapassword123');
  console.log('  Example employee IDs: EMP0001, EMP0002, ...');
  console.log('  Example loan application numbers: LOS' + new Date().getFullYear() + '000001, ...');
}

run().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
