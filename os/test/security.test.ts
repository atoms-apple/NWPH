import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signedIn, Client, PASSWORD, type App } from './helpers.ts';
import { get } from '../src/db/database.ts';
import { resetThrottle } from '../src/auth/throttle.ts';

let app: App;
before(async () => {
  app = await startApp();
});
after(() => app.close());

test('protected pages redirect anonymous users to sign-in', async () => {
  const c = new Client(app.base);
  for (const p of ['/', '/ventures', '/ventures/polar-express', '/finance', '/documents', '/activity', '/settings', '/no-such-page']) {
    const res = await c.get(p);
    assert.equal(res.status, 303, p);
    assert.match(res.location ?? '', /^\/login/, p);
  }
});

test('anonymous POSTs are refused before any change is made', async () => {
  const c = new Client(app.base);
  await c.get('/login');
  const before = get<{ n: number }>('SELECT count(*) AS n FROM ventures')!.n;
  const res = await c.post('/ventures', { name: 'Sneaky' });
  assert.equal(res.status, 303);
  assert.match(res.location!, /^\/login/);
  assert.equal(get<{ n: number }>('SELECT count(*) AS n FROM ventures')!.n, before);
});

test('wrong password is rejected; correct password signs in with an HttpOnly cookie', async () => {
  const c = new Client(app.base);
  await c.get('/login');
  const bad = await c.post('/login', { email: 'owner@example.test', password: 'wrong password!!' });
  assert.equal(bad.status, 401);
  assert.match(bad.text, /incorrect/);
  await c.get('/login');
  const res = await fetch(app.base + '/login', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: [...c.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
    body: new URLSearchParams({ _csrf: c.csrf, email: 'owner@example.test', password: PASSWORD }),
  });
  assert.equal(res.status, 303);
  const cookie = res.headers.getSetCookie().find((x) => x.startsWith('nwph_os_session='))!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  // Only a hash of the token is stored.
  const token = cookie.split(';')[0]!.split('=')[1]!;
  assert.equal(get('SELECT 1 FROM sessions WHERE token_hash = ?', [token]), undefined);
});

test('repeated failures are throttled', async () => {
  const c = new Client(app.base);
  for (let i = 0; i < 5; i++) {
    await c.get('/login');
    await c.post('/login', { email: 'editor@example.test', password: `nope-${i}-xxxxxxxx` });
  }
  await c.get('/login');
  const res = await c.post('/login', { email: 'editor@example.test', password: PASSWORD });
  assert.equal(res.status, 429);
  resetThrottle();
});

test('POST without a valid CSRF token is refused', async () => {
  const c = await signedIn(app);
  const res = await c.post('/ventures', { name: 'No token venture' }, { csrf: 'forged' });
  assert.equal(res.status, 403);
  assert.equal(get("SELECT 1 FROM ventures WHERE name = 'No token venture'"), undefined);
});

test('cross-origin POST is refused even with a token', async () => {
  const c = await signedIn(app);
  const res = await c.post('/ventures', { name: 'Cross site' }, { headers: { origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('viewers can read but cannot write, archive or administer (server-side)', async () => {
  const c = await signedIn(app, 'viewer');
  assert.equal((await c.get('/ventures/polar-express')).status, 200);
  assert.equal((await c.get('/ventures/new')).status, 403);
  assert.equal((await c.post('/ventures', { name: 'Viewer venture', stage_id: '', operational_status: 'proposed', legal_status: 'not_established' })).status, 403);
  assert.equal((await c.post('/ventures/polar-express/archive')).status, 403);
  assert.equal((await c.post('/settings/stages', { name: 'Hack' })).status, 403);
  assert.equal(get("SELECT archived_at FROM ventures WHERE slug = 'polar-express'")!.archived_at, null);
});

test('editors cannot change legal status, verify figures or manage users', async () => {
  const c = await signedIn(app, 'editor');
  assert.equal((await c.get('/organization/legal')).status, 403);
  assert.equal((await c.post('/settings/users', { email: 'x@example.test', display_name: 'X', role: 'owner', password: 'abcdefghijklmn' })).status, 403);
  const res = await c.post('/ventures/polar-express/status', { operational_status: 'proposed', legal_status: 'established', legal_status_detail: '' });
  assert.equal(res.status, 422);
  assert.match(res.text, /Only an owner can change legal status/);
});

test('setup page is closed once users exist', async () => {
  const c = new Client(app.base);
  const res = await c.get('/setup');
  assert.equal(res.status, 303);
  assert.equal(res.location, '/login');
});

test('responses carry security headers and no-store caching', async () => {
  const c = await signedIn(app);
  const res = await c.get('/');
  assert.match(res.headers.get('content-security-policy')!, /script-src 'self'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.text, /noindex/);
});

test('sign-out invalidates the session server-side', async () => {
  const c = await signedIn(app);
  const saved = new Map(c.cookies);
  await c.post('/logout');
  c.cookies = saved; // replay the old cookie
  const res = await c.get('/');
  assert.equal(res.status, 303);
});

test('errors do not leak internals', async () => {
  const c = await signedIn(app);
  const res = await c.get('/projects/not-a-real-id');
  assert.equal(res.status, 404);
  assert.doesNotMatch(res.text, /at .*\.ts:\d+|SQLITE|stack/i);
});

test('user-entered text is escaped (no stored XSS)', async () => {
  const c = await signedIn(app);
  await c.get('/tasks/new');
  await c.post('/tasks', { title: '<script>alert(1)</script>', status: 'not_started', priority: 'normal', venture_id: '', project_id: '', milestone_id: '' });
  const res = await c.get('/projects?view=tasks');
  assert.doesNotMatch(res.text, /<script>alert\(1\)<\/script>/);
  assert.match(res.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
