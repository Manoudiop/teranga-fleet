import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { testDatabaseUrl } from './test-database';

/**
 * Prépare la base e2e : la crée si besoin puis applique les migrations
 * (`migrate deploy`, non destructif). Les tests n'effacent rien : chacun crée
 * ses propres entreprises avec des emails uniques, isolées par le multi-tenant.
 */
export default async function globalSetup(): Promise<void> {
  const url = new URL(testDatabaseUrl());
  const dbName = decodeURIComponent(url.pathname.slice(1));

  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });
}
