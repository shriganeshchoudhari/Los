import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface CliArgs {
  env: string;
  dryRun: boolean;
  services: string[];
}

const SERVICE_DB_MAP: Record<string, string> = {
  auth: 'los_auth',
  loan: 'los_loan',
  kyc: 'los_kyc',
  decision: 'los_decision',
  integration: 'los_integration',
  document: 'los_document',
  notification: 'los_notification',
  dsa: 'los_dsa',
  shared: 'los_shared',
};

const SERVICE_MIGRATION_MAP: Record<string, string> = {
  auth: '002_auth_schema.sql',
  loan: '003_loan_schema.sql',
  kyc: '004_kyc_schema.sql',
  decision: '005_decision_schema.sql',
  integration: '006_integration_schema.sql',
  document: '007_document_schema.sql',
  notification: '008_notification_schema.sql',
  dsa: '009_dsa_schema.sql',
  shared: '010_shared_schema.sql',
};

const ENV_DEFAULTS: Record<string, Record<string, string>> = {
  dev: {
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'los_user',
    DB_PASSWORD: 'los_password',
  },
  uat: {
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'los_user',
    DB_PASSWORD: 'los_password',
  },
  prod: {
    DB_HOST: process.env.DB_HOST ?? 'localhost',
    DB_PORT: process.env.DB_PORT ?? '5432',
    DB_USER: process.env.DB_USER ?? 'los_user',
    DB_PASSWORD: process.env.DB_PASSWORD ?? '',
  },
};

function parseArgs(): CliArgs {
  const args: CliArgs = { env: 'dev', dryRun: false, services: [] };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--env=')) {
      args.env = arg.replace('--env=', '');
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--service=')) {
      args.services = arg.replace('--service=', '').split(',').map((s) => s.trim());
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  return args;
}

function printUsage(): void {
  console.log(`
LOS Platform — Migration Runner (TypeScript)

Usage:
  npm run migrate -- --env=dev              Run all migrations for dev
  npm run migrate -- --env=prod --dry-run  Dry-run prod migrations
  npm run migrate -- --env=dev --service=auth,loan  Run specific services
  npm run migrate -- --help                Show this help

Options:
  --env=dev|uat|prod   Target environment (default: dev)
  --dry-run            Show what would run without executing
  --service=x,y        Run only specified services (comma-separated)
  --help, -h           Show this message
`);
}

function loadEnv(env: string): Record<string, string> {
  const envFile = path.join(__dirname, '..', '.env.' + env);
  const envVars: Record<string, string> = { ...process.env };

  if (fs.existsSync(envFile)) {
    const fileContent = fs.readFileSync(envFile, 'utf8');
    const rl = readline.createInterface({ input: fs.createReadStream(envFile) });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      envVars[key] = val;
    });
  }

  const defaults = ENV_DEFAULTS[env] ?? ENV_DEFAULTS['dev'];
  for (const [key, val] of Object.entries(defaults)) {
    if (!envVars[key]) envVars[key] = val;
  }

  return envVars;
}

async function createClient(envVars: Record<string, string>): Promise<Client> {
  const client = new Client({
    host: envVars['DB_HOST'] ?? 'localhost',
    port: parseInt(envVars['DB_PORT'] ?? '5432', 10),
    user: envVars['DB_USER'] ?? 'los_user',
    password: envVars['DB_PASSWORD'] ?? 'los_password',
    database: 'postgres',
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
}

async function ensureDatabase(client: Client, dbName: string): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName],
  );
  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[CREATED] Database: ${dbName}`);
  }
}

async function runMigration(
  client: Client,
  dbName: string,
  service: string,
  migrationFile: string,
  migrationsDir: string,
  dryRun: boolean,
): Promise<{ success: boolean; error?: string }> {
  const fullPath = path.join(migrationsDir, migrationFile);

  if (!fs.existsSync(fullPath)) {
    console.log(`[SKIP]  ${service} (${dbName}) — ${migrationFile} not found`);
    return { success: true };
  }

  const migrationId = migrationFile.replace('.sql', '');
  const checkResult = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName],
  );
  if (checkResult.rowCount === 0) {
    return { success: false, error: `Database ${dbName} does not exist` };
  }

  const dbClient = new Client({
    host: client.config.host,
    port: client.config.port,
    user: client.config.user,
    password: client.config.password,
    database: dbName,
    connectionTimeoutMillis: 30000,
  });

  try {
    const alreadyResult = await dbClient.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'schema_migrations'
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations')`,
    );

    if (alreadyResult.rowCount && alreadyResult.rowCount[0]) {
      try {
        const prevResult = await dbClient.query(
          `SELECT 1 FROM schema_migrations WHERE migration_id = $1`,
          [migrationId],
        );
        if (prevResult.rowCount && prevResult.rowCount[0]) {
          console.log(`[SKIP]  ${service} (${dbName}) — already applied (${migrationId})`);
          return { success: true };
        }
      } catch {
        // schema_migrations may not exist yet, continue
      }
    }
  } catch {
    // table check failed, try migration anyway
  }

  console.log(`[RUN]   ${service} (${dbName}) ← ${migrationFile}`);

  if (dryRun) {
    console.log(`        (dry-run: would execute ${fs.statSync(fullPath).size} bytes)`);
    return { success: true };
  }

  const sql = fs.readFileSync(fullPath, 'utf8');
  await dbClient.query(sql);

  try {
    await dbClient.query(
      `INSERT INTO schema_migrations (migration_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [migrationId],
    );
  } catch {
    // schema_migrations may be in a different schema; ignore
  }

  await dbClient.end();
  console.log(`[OK]    ${service} (${dbName}) — migrated successfully`);
  return { success: true };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const envVars = loadEnv(args.env);

  const migrationsDir = envVars['MIGRATIONS_DIR']
    ? path.resolve(envVars['MIGRATIONS_DIR'])
    : path.join(__dirname, '..', '..', 'database', 'migrations');

  console.log('==========================================');
  console.log('LOS Platform Migration Runner (TypeScript)');
  console.log('==========================================');
  console.log(`Environment : ${args.env}`);
  console.log(`Dry run     : ${args.dryRun}`);
  console.log(`DB host     : ${envVars['DB_HOST']}:${envVars['DB_PORT']}`);
  console.log(`DB user     : ${envVars['DB_USER']}`);
  console.log(`Migrations  : ${migrationsDir}`);
  console.log('==========================================');
  console.log('');

  const servicesToRun = args.services.length > 0 ? args.services : Object.keys(SERVICE_DB_MAP);
  let failed = 0;

  let adminClient: Client | null = null;
  try {
    adminClient = await createClient(envVars);

    for (const service of servicesToRun) {
      const dbName = SERVICE_DB_MAP[service];
      const migrationFile = SERVICE_MIGRATION_MAP[service];

      if (!dbName) {
        console.log(`[SKIP]  Unknown service: ${service}`);
        continue;
      }

      try {
        await ensureDatabase(adminClient, dbName);
      } catch (err) {
        console.log(`[ERROR] Could not ensure database ${dbName}: ${err}`);
        failed++;
        continue;
      }

      const result = await runMigration(
        adminClient,
        dbName,
        service,
        migrationFile,
        migrationsDir,
        args.dryRun,
      );

      if (!result.success) {
        console.log(`[ERROR] ${service} (${dbName}) — ${result.error}`);
        failed++;
      }
    }
  } finally {
    if (adminClient) await adminClient.end();
  }

  console.log('');
  if (failed > 0) {
    console.log(`[FAILED] ${failed} service(s) failed migration.`);
    process.exit(1);
  } else {
    console.log('[DONE]   All migrations completed successfully');
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
