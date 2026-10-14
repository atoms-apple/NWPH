import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, Client, type App } from './helpers.ts';
import { get } from '../src/db/database.ts';
import { loadConfig } from '../src/config.ts';

let app: App | null = null;
after(() => app?.close());

test('token-free setup is only enabled inside a GitHub Codespace', () => {
  assert.equal(loadConfig({}).setupWithoutToken, false);
  assert.equal(loadConfig({ CODESPACES: 'false' }).setupWithoutToken, false);
  assert.equal(loadConfig({ CODESPACES: 'true' }).setupWithoutToken, true);
  assert.equal(loadConfig({ CODESPACES: 'true', SETUP_REQUIRE_TOKEN: 'true' }).setupWithoutToken, false);
});

test('in a Codespace the first visit goes straight to account creation, with no token', async () => {
  app = await startApp({ users: false, env: { CODESPACES: 'true' } });
  const c = new Client(app.base);
  const home = await c.get('/');
  assert.equal(home.status, 303);
  const login = await c.get(home.location!);
  assert.equal(login.location, '/setup');
  const page = await c.get('/setup');
  assert.doesNotMatch(page.text, /name="token"/);
  const res = await c.post('/setup', { email: 'me@example.test', display_name: 'Me', password: 'a long enough password' });
  assert.equal(res.status, 303);
  assert.equal(get<{ role: string }>("SELECT role FROM users WHERE email = 'me@example.test'")!.role, 'owner');
  assert.equal((await c.get('/')).status, 200);
  // Once an account exists, setup is closed for everyone.
  const other = new Client(app.base);
  await other.get('/login');
  assert.equal((await other.post('/setup', { email: 'x@example.test', display_name: 'X', password: 'a long enough password' })).status, 303);
  assert.equal(get("SELECT 1 FROM users WHERE email = 'x@example.test'"), undefined);
});
