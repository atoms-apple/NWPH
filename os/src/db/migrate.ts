import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from '../config.ts';
import { db, all } from './database.ts';

const MIGRATIONS_DIR = path.join(APP_ROOT, 'migrations');

/**
 * Apply pending SQL migrations in filename order. Each file runs in its own
 * transaction and is recorded in schema_migrations. Applied files must never be
 * edited; add a new numbered file instead.
 */
export function migrate(log: (msg: string) => void = () => {}): string[] {
  const conn = db();
  conn.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(all<{ name: string }>('SELECT name FROM schema_migrations').map((r) => r.name));
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    conn.exec('BEGIN IMMEDIATE');
    try {
      conn.exec(sql);
      conn.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
      conn.exec('COMMIT');
    } catch (err) {
      conn.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
    log(`Applied migration ${file}`);
    ran.push(file);
  }
  return ran;
}
