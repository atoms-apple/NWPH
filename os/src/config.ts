import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface Config {
  host: string;
  port: number;
  production: boolean;
  databasePath: string;
  uploadDir: string;
  maxUploadBytes: number;
  sessionIdleMs: number;
  sessionMaxMs: number;
  cookieSecure: boolean;
  trustProxy: boolean;
  setupToken: string | null;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function num(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Configuration error: ${name} must be a positive number`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const resolveFromRoot = (p: string) => (path.isAbsolute(p) ? p : path.resolve(APP_ROOT, p));
  return {
    host: env.HOST || '127.0.0.1',
    port: num('PORT', env.PORT, 4400),
    production,
    databasePath: env.DATABASE_PATH === ':memory:' ? ':memory:' : resolveFromRoot(env.DATABASE_PATH || './data/nwph-os.db'),
    uploadDir: resolveFromRoot(env.UPLOAD_DIR || './data/uploads'),
    maxUploadBytes: num('MAX_UPLOAD_MB', env.MAX_UPLOAD_MB, 20) * 1024 * 1024,
    sessionIdleMs: num('SESSION_IDLE_HOURS', env.SESSION_IDLE_HOURS, 12) * 3_600_000,
    sessionMaxMs: num('SESSION_MAX_DAYS', env.SESSION_MAX_DAYS, 7) * 86_400_000,
    cookieSecure: bool(env.COOKIE_SECURE, production),
    trustProxy: bool(env.TRUST_PROXY, false),
    setupToken: env.SETUP_TOKEN || null,
  };
}
