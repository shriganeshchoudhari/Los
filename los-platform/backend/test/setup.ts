import { DataSource } from 'typeorm';
import { TestConfig } from './helpers/test-config';

const PER_SERVICE_DBS: Record<string, { schema: string; tables: string[] }> = {
  los_auth: {
    schema: 'los_auth',
    tables: [
      'users',
      'otp_sessions',
      'refresh_tokens',
      'role_permissions',
    ],
  },
  los_loan: {
    schema: 'los_loan',
    tables: [
      'loan_applications',
      'application_stage_history',
      'loans',
      'pdd_checklists',
      'pdd_checklist_items',
      'loan_agreements',
      'loan_agreement_signatures',
      'sanction_letters',
      'disbursement_plans',
      'disbursement_tranches',
      'disbursement_inspections',
      'loan_product_configs',
      'interest_rate_configs',
      'rate_history',
      'benchmark_rates',
      'feature_flags',
    ],
  },
  los_kyc: {
    schema: 'los_kyc',
    tables: [
      'kyc_records',
      'aadhaar_kyc_results',
      'pan_verification_results',
      'face_match_results',
      'consent_records',
    ],
  },
  los_decision: {
    schema: 'los_decision',
    tables: [
      'decision_results',
      'decision_rule_results',
      'rule_definitions',
      'ml_model_registry',
      'ml_prediction_log',
    ],
  },
  los_integration: {
    schema: 'los_integration',
    tables: [
      'bureau_pull_jobs',
      'bureau_reports',
      'bureau_aggregated_scores',
      'disbursements',
      'emi_schedule',
      'payment_transactions',
      'nach_mandates',
    ],
  },
  los_document: {
    schema: 'los_document',
    tables: ['documents', 'document_checklists', 'document_reviews'],
  },
  los_notification: {
    schema: 'los_notification',
    tables: [
      'notifications',
      'notification_templates',
      'notification_preferences',
      'notification_opt_outs',
      'notification_delivery_logs',
    ],
  },
  los_dsa: {
    schema: 'los_dsa',
    tables: ['dsa_partners', 'dsa_officers', 'dsa_applications', 'dsa_commission'],
  },
  los_shared: {
    schema: 'los_shared',
    tables: ['audit_logs', 'data_access_logs', 'idempotency_keys'],
  },
};

async function createDataSource(database: string): Promise<DataSource> {
  const config = TestConfig.get();
  const ds = new DataSource({
    type: 'postgres',
    host: config.DB_HOST,
    port: config.DB_PORT,
    username: config.DB_USERNAME,
    password: config.DB_PASSWORD,
    database,
    connectTimeoutMS: 10000,
  });
  await ds.initialize();
  return ds;
}

export default async () => {
  console.log('[E2E Setup] Cleaning all per-service databases...');

  const results: { db: string; deleted: number; skipped: number }[] = [];

  for (const [database, { schema, tables }] of Object.entries(PER_SERVICE_DBS)) {
    let ds: DataSource | null = null;
    try {
      ds = await createDataSource(database);
    } catch (e) {
      console.warn(`[E2E Setup] Cannot connect to database "${database}" — skipping`);
      continue;
    }

    let deleted = 0;
    let skipped = 0;

    for (const table of tables) {
      try {
        await ds.query(`DELETE FROM "${schema}"."${table}"`);
        deleted++;
      } catch {
        skipped++;
      }
    }

    await ds.destroy();
    results.push({ db: database, deleted, skipped });
    console.log(
      `[E2E Setup] ${database}: deleted=${deleted} skipped=${skipped}`
    );
  }

  if (results.length === 0) {
    console.warn(
      '[E2E Setup] WARNING: Could not connect to any database. ' +
        'Ensure PostgreSQL is running and DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD are set correctly.'
    );
  } else {
    const total = results.reduce((acc, r) => acc + r.deleted, 0);
    console.log(`[E2E Setup] Done. Cleared ${total} table(s) across ${results.length} database(s).`);
  }
};
