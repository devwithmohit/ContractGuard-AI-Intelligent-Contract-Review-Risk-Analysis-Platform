/**
 * Database Migration Runner
 *
 * Executes all SQL migration files in order against the PostgreSQL database.
 * Usage: bun run src/db/migrate.ts
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const MIGRATIONS_DIR = resolve(import.meta.dirname, 'migrations');

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration files sorted by name
    const migrationFiles = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found');
      return;
    }

    console.log(`\n📂 Found ${migrationFiles.length} migration files:\n`);

    for (const file of migrationFiles) {
      const filePath = join(MIGRATIONS_DIR, file);
      const sql = readFileSync(filePath, 'utf-8');

      console.log(`  ⏳ Running: ${file}...`);
      try {
        await client.query(sql);
        console.log(`  ✅ ${file} — applied successfully`);
      } catch (err) {
        const pgErr = err as { message: string; code?: string; detail?: string };
        // Skip "already exists" errors gracefully
        if (pgErr.code === '42P07' || pgErr.code === '42710') {
          console.log(`  ⏭️  ${file} — already applied (skipped)`);
        } else {
          console.error(`  ❌ ${file} — FAILED:`, pgErr.message);
          if (pgErr.detail) console.error(`     Detail: ${pgErr.detail}`);
          throw err;
        }
      }
    }

    console.log('\n🎉 All migrations completed successfully!\n');
  } catch (err) {
    console.error('\n💥 Migration failed:', (err as Error).message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

runMigrations();
