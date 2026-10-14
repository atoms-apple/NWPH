import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signedIn, type App } from './helpers.ts';
import { get } from '../src/db/database.ts';

// Behind GitHub Codespaces (or any reverse proxy) the browser's Origin names the
// public host while the Host header names localhost.
const PUBLIC = 'nwph-os-4400.app.github.dev';
let app: App | null = null;
after(() => app?.close());

test('without TRUST_PROXY, X-Forwarded-Host is ignored and a mismatched Origin is refused', async () => {
  app = await startApp();
  const c = await signedIn(app);
  const res = await c.post('/ventures', { name: 'Spoofed' }, { headers: { origin: `https://${PUBLIC}`, 'x-forwarded-host': PUBLIC } });
  assert.equal(res.status, 403);
  await app.close();
  app = null;
});

test('with TRUST_PROXY, a POST whose Origin matches X-Forwarded-Host is accepted', async () => {
  app = await startApp({ env: { TRUST_PROXY: 'true' } });
  const c = await signedIn(app);
  const stage = get<{ id: string }>("SELECT id FROM development_stages WHERE name = 'Idea'")!.id;
  const fields = { name: 'Proxied venture', stage_id: stage, operational_status: 'proposed', legal_status: 'not_established' };
  const ok = await c.post('/ventures', fields, { headers: { origin: `https://${PUBLIC}`, 'x-forwarded-host': PUBLIC } });
  assert.equal(ok.status, 303);
  assert.ok(get("SELECT 1 FROM ventures WHERE name = 'Proxied venture'"));
  // A different site is still refused.
  const bad = await c.post('/ventures', { ...fields, name: 'Evil' }, { headers: { origin: 'https://evil.example', 'x-forwarded-host': PUBLIC } });
  assert.equal(bad.status, 403);
});
