/**
 * Test harness: a real NWPH OS server on an ephemeral port with a temporary
 * database, plus a cookie-keeping HTTP client. Tests drive the same routes,
 * sessions, CSRF checks and permission gates a browser does.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadConfig, type Config } from '../src/config.ts';
import { openDatabase, closeDatabase, get } from '../src/db/database.ts';
import { migrate } from '../src/db/migrate.ts';
import { seedBaseline } from '../src/db/seed.ts';
import { createHandler } from '../src/app.ts';
import { createUser } from '../src/auth/users.ts';
import { resetThrottle } from '../src/auth/throttle.ts';
import { setSetupToken } from '../src/web/pages/auth.ts';

export const PASSWORD = 'correct horse battery staple';

export interface App {
  base: string;
  config: Config;
  dir: string;
  server: http.Server;
  close(opts?: { keepFiles?: boolean }): Promise<void>;
}

export async function startApp(opts: { dir?: string; users?: boolean; env?: Record<string, string> } = {}): Promise<App> {
  const dir = opts.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'nwph-os-test-'));
  const config = loadConfig({ DATABASE_PATH: path.join(dir, 'test.db'), UPLOAD_DIR: path.join(dir, 'uploads'), MAX_UPLOAD_MB: '1', ...opts.env });
  openDatabase(config.databasePath);
  migrate();
  seedBaseline();
  resetThrottle();
  if (opts.users !== false && !get('SELECT 1 FROM users')) {
    await createUser({ email: 'owner@example.test', displayName: 'Olivia Owner', password: PASSWORD, role: 'owner' });
    await createUser({ email: 'editor@example.test', displayName: 'Eddie Editor', password: PASSWORD, role: 'editor' });
    await createUser({ email: 'viewer@example.test', displayName: 'Vera Viewer', password: PASSWORD, role: 'viewer' });
  }
  setSetupToken(opts.users === false ? 'setup-token-for-tests' : null);
  const server = http.createServer(createHandler(config));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    config,
    dir,
    server,
    async close(o = {}) {
      await new Promise<void>((r) => server.close(() => r()));
      closeDatabase();
      if (!o.keepFiles) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface Res {
  status: number;
  text: string;
  location: string | null;
  headers: Headers;
}

export class Client {
  readonly base: string;
  cookies = new Map<string, string>();
  csrf = '';
  constructor(base: string) {
    this.base = base;
  }

  private cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private absorb(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair!.indexOf('=');
      const k = pair!.slice(0, i);
      const v = pair!.slice(i + 1);
      if (/Max-Age=0/.test(c)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
  }

  async request(method: string, p: string, body?: BodyInit, headers: Record<string, string> = {}): Promise<Res> {
    const res = await fetch(this.base + p, { method, body, redirect: 'manual', headers: { cookie: this.cookieHeader(), ...headers } });
    this.absorb(res);
    const text = await res.text();
    const m = /name="_csrf" value="([^"]+)"/.exec(text);
    if (m) this.csrf = m[1]!;
    return { status: res.status, text, location: res.headers.get('location'), headers: res.headers };
  }

  get(p: string): Promise<Res> {
    return this.request('GET', p);
  }

  /** POST a urlencoded form, adding the CSRF token unless one is given. */
  post(p: string, fields: Record<string, string | string[]> = {}, opts: { csrf?: string | null; headers?: Record<string, string> } = {}): Promise<Res> {
    const body = new URLSearchParams();
    const token = opts.csrf === undefined ? this.csrf : opts.csrf;
    if (token !== null) body.append('_csrf', token);
    for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) body.append(k, x);
    return this.request('POST', p, body, { 'content-type': 'application/x-www-form-urlencoded', ...(opts.headers ?? {}) });
  }

  postMultipart(p: string, form: FormData): Promise<Res> {
    form.set('_csrf', this.csrf);
    return this.request('POST', p, form);
  }

  async login(email: string, password = PASSWORD): Promise<Res> {
    await this.get('/login');
    const res = await this.post('/login', { email, password });
    if (res.status === 303) await this.get('/'); // pick up the session CSRF token
    return res;
  }
}

export async function signedIn(app: App, role: 'owner' | 'editor' | 'viewer' = 'owner'): Promise<Client> {
  const c = new Client(app.base);
  const res = await c.login(`${role}@example.test`);
  if (res.status !== 303) throw new Error(`login failed for ${role}: ${res.status}`);
  return c;
}

/** Extract the id from a redirect like /projects/<uuid>. */
export const idFrom = (location: string | null): string => {
  const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(location ?? '');
  if (!m) throw new Error(`No id in ${location}`);
  return m[1]!;
};

export const polarExpressId = (): string => get<{ id: string }>("SELECT id FROM ventures WHERE slug = 'polar-express'")!.id;
