import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, Client, type App } from './helpers.ts';
import { get } from '../src/db/database.ts';

let app: App;
before(async () => {
  app = await startApp({ users: false });
});
after(() => app.close());

test('first run: baseline is honest and provisional', () => {
  const org = get<{ name: string; legal_status: string }>('SELECT name, legal_status FROM organizations')!;
  assert.equal(org.name, 'NWPH');
  assert.equal(org.legal_status, 'unverified');
  const pe = get<{ name: string; legal_status: string; operational_status: string; provisional_fields: string }>("SELECT * FROM ventures WHERE slug = 'polar-express'")!;
  assert.equal(pe.name, 'Polar Express');
  assert.equal(pe.legal_status, 'not_established');
  assert.equal(pe.operational_status, 'proposed');
  assert.ok(JSON.parse(pe.provisional_fields).length > 0);
  for (const t of ['projects', 'tasks', 'financial_entries', 'decisions', 'documents', 'opportunities', 'risks']) {
    assert.equal(get<{ n: number }>(`SELECT count(*) AS n FROM ${t}`)!.n, 0, `${t} should start empty`);
  }
});

test('setup requires the token, then creates an owner and signs in', async () => {
  const c = new Client(app.base);
  assert.equal((await c.get('/')).status, 303);
  const page = await c.get('/setup');
  assert.equal(page.status, 200);
  const wrong = await c.post('/setup', { token: 'nope', email: 'first@example.test', display_name: 'First', password: 'a long enough password' });
  assert.equal(wrong.status, 403);
  const short = await c.post('/setup', { token: 'setup-token-for-tests', email: 'first@example.test', display_name: 'First', password: 'short' });
  assert.equal(short.status, 422);
  const ok = await c.post('/setup', { token: 'setup-token-for-tests', email: 'first@example.test', display_name: 'First', password: 'a long enough password' });
  assert.equal(ok.status, 303);
  const dash = await c.get('/');
  assert.equal(dash.status, 200);
  assert.match(dash.text, /Getting started/);
  assert.equal(get<{ role: string }>("SELECT role FROM users WHERE email = 'first@example.test'")!.role, 'owner');
  assert.equal((await new Client(app.base).get('/setup')).status, 303);
});
