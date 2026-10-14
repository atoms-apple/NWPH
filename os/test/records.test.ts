import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signedIn, idFrom, polarExpressId, Client, type App } from './helpers.ts';
import { get, all } from '../src/db/database.ts';
import { today, addDays } from '../src/lib/time.ts';

let app: App;
let c: Client;
before(async () => {
  app = await startApp();
  c = await signedIn(app);
});
after(() => app.close());

const decisionFields = (over: Record<string, string>) => ({
  title: 'Pursue a freight feasibility study',
  venture_id: polarExpressId(),
  category: 'Strategy',
  status: 'proposed',
  proposed_on: today(),
  owner_name: 'Board',
  review_date: '',
  decided_on: '',
  description: '',
  options_considered: 'A: internal. B: consultant.',
  rationale: '',
  evidence: '',
  evidence_document_id: '',
  implications: '',
  outcome: '',
  superseded_by_id: '',
  notes: '',
  ...over,
});

test('decision: proposed → approved requires a date; history keeps before/after', async () => {
  await c.get('/decisions/new');
  const res = await c.post('/decisions', decisionFields({}));
  assert.equal(res.status, 303);
  const id = idFrom(res.location);
  let page = await c.get(`/decisions/${id}`);
  assert.match(page.text, /This is not a decision yet/);
  assert.match(page.text, /Not decided/);

  const noDate = await c.post(`/decisions/${id}`, decisionFields({ status: 'approved' }));
  assert.equal(noDate.status, 422);
  assert.match(noDate.text, /Record the date/);

  const ok = await c.post(`/decisions/${id}`, decisionFields({ status: 'approved', decided_on: today(), rationale: 'Low cost, high information value', outcome: 'Study commissioned' }));
  assert.equal(ok.status, 303);
  page = await c.get(`/decisions/${id}`);
  assert.match(page.text, /Decided: approved/);
  assert.match(page.text, /Proposed → Approved/);
  const ev = get<{ changes: string }>("SELECT changes FROM activity_events WHERE entity_id = ? AND event_type = 'decision.approved'", [id])!;
  assert.deepEqual(JSON.parse(ev.changes).status, ['proposed', 'approved']);
  assert.match((await c.get('/activity')).text, /Proposed → Approved/);
  assert.match((await c.get('/decisions?view=history')).text, /Study commissioned/);
  assert.match((await c.get('/decisions?open=1')).text, /No decisions recorded/);

  // Supersede rules.
  const other = idFrom((await c.post('/decisions', decisionFields({ title: 'Revised approach' }))).location);
  assert.equal((await c.post(`/decisions/${id}`, decisionFields({ status: 'superseded', decided_on: today() }))).status, 422);
  assert.equal((await c.post(`/decisions/${id}`, decisionFields({ status: 'superseded', decided_on: today(), superseded_by_id: other }))).status, 303);
  assert.match((await c.get(`/decisions/${other}`)).text, /Supersedes/);
});

test('documents: metadata, venture link, tag search, private upload/download, verification', async () => {
  await c.get('/documents/new?venture=polar-express');
  const form = new FormData();
  for (const [k, v] of Object.entries({ title: 'Nunavut sealift schedule review', category: 'Market Research', venture_id: polarExpressId(), project_id: '', document_date: '2026-06-01', source: 'Government of Nunavut', source_url: 'https://www.gov.nu.ca/', version_label: 'v1', tags: 'sealift, logistics', description: 'Notes on annual sealift windows.', notes: '' })) form.set(k, v);
  form.set('file', new File(['quarterly freight figures zanzibarword'], 'sealift notes.txt', { type: 'text/plain' }));
  const res = await c.postMultipart('/documents', form);
  assert.equal(res.status, 303);
  const id = idFrom(res.location);
  const page = await c.get(`/documents/${id}`);
  assert.match(page.text, /sealift notes\.txt/);
  assert.match(page.text, /has not read or analysed its contents/);

  assert.match((await c.get('/documents?q=sealift')).text, /Nunavut sealift schedule review/);
  assert.match((await c.get('/documents?q=logist')).text, /Nunavut sealift schedule review/, 'prefix match on tag');
  assert.match((await c.get('/documents?tag=logistics')).text, /Nunavut sealift schedule review/);
  assert.doesNotMatch((await c.get('/documents?q=zanzibarword')).text, /Nunavut sealift schedule review/, 'contents are not indexed');
  assert.match((await c.get('/ventures/polar-express/research')).text, /Nunavut sealift schedule review/);
  assert.match((await c.get('/documents?q=%22%29%20OR%20*')).text, /<\/html>/, 'odd search input does not error');

  const fileId = get<{ id: string; storage_key: string }>('SELECT id, storage_key FROM document_files WHERE document_id = ?', [id])!;
  const dl = await c.get(`/documents/${id}/files/${fileId.id}`);
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get('content-disposition')!, /attachment/);
  assert.match(dl.headers.get('content-security-policy')!, /sandbox/);
  assert.equal(dl.text, 'quarterly freight figures zanzibarword');
  const anon = await new Client(app.base).get(`/documents/${id}/files/${fileId.id}`);
  assert.equal(anon.status, 303);
  assert.equal((await c.get(`/assets/../data/uploads/${fileId.storage_key}`)).status, 404);

  // New version, rejected type, verification permission.
  const v2 = new FormData();
  v2.set('file', new File(['second'], 'sealift notes v2.txt'));
  await c.get(`/documents/${id}`);
  await c.postMultipart(`/documents/${id}/files`, v2);
  assert.equal(get<{ n: number }>('SELECT count(*) AS n FROM document_files WHERE document_id = ?', [id])!.n, 2);
  const bad = new FormData();
  bad.set('file', new File(['<script>'], 'evil.html'));
  await c.postMultipart(`/documents/${id}/files`, bad);
  assert.equal(get<{ n: number }>('SELECT count(*) AS n FROM document_files WHERE document_id = ?', [id])!.n, 2);
  const editor = await signedIn(app, 'editor');
  assert.equal((await editor.post(`/documents/${id}/verification`, { verification_status: 'verified' })).status, 403);
  await c.post(`/documents/${id}/verification`, { verification_status: 'verified' });
  assert.equal(get<{ verification_status: string }>('SELECT verification_status FROM documents WHERE id = ?', [id])!.verification_status, 'verified');
});

test('opportunities: eligibility must be confirmed by a person', async () => {
  const base = { title: 'Northern business development fund', category: 'Grant', venture_id: polarExpressId(), issuing_organization: 'Example agency', source: 'Website', source_url: '', potential_value_minor: '75000', currency: 'CAD', opens_on: '', deadline: addDays(today(), 10), geographic_scope: 'Nunavut', description: '', eligibility_requirements: 'Inuit-owned businesses', eligibility_basis: '', required_documents: '', next_action: 'Call program officer', notes: '' };
  await c.get('/opportunities/new');
  const eligible = await c.post('/opportunities', { ...base, status: 'eligible' });
  assert.equal(eligible.status, 422);
  assert.match(eligible.text, /confirmed by a person/);
  const res = await c.post('/opportunities', { ...base, status: 'researching' });
  assert.equal(res.status, 303);
  const id = idFrom(res.location);
  assert.match((await c.get('/')).text, /Northern business development fund/, 'deadline appears on dashboard');
  assert.equal((await c.post(`/opportunities/${id}`, { ...base, status: 'eligible', eligibility_basis: 'Confirmed by phone with the program officer' })).status, 303);
  assert.ok(get("SELECT 1 FROM activity_events WHERE entity_id = ? AND event_type = 'opportunity.status_changed'", [id]));
  assert.match((await c.get('/ventures/polar-express/funding')).text, /Northern business development fund/);
});

test('risks: high band surfaces on the dashboard until mitigated', async () => {
  const base = { title: 'Sealift delay', venture_id: polarExpressId(), project_id: '', category: 'Logistics & Supply', owner_name: '', review_date: '', description: '', mitigation: 'Order early', notes: '' };
  await c.get('/risks/new');
  const res = await c.post('/risks', { ...base, status: 'open', likelihood: '4', impact: '4' });
  assert.equal(res.status, 303);
  const id = get<{ id: string }>("SELECT id FROM risks WHERE title = 'Sealift delay'")!.id;
  const inRiskPanel = /<a href="\/risks\/[^"]+\/edit">Sealift delay<\/a><span class="list__meta">/;
  assert.match((await c.get('/')).text, inRiskPanel);
  assert.equal((await c.post('/risks', { ...base, status: 'open', likelihood: '9', impact: '4' })).status, 422);
  await c.post(`/risks/${id}`, { ...base, status: 'mitigated', likelihood: '4', impact: '4' });
  assert.doesNotMatch((await c.get('/')).text, inRiskPanel);
  assert.match((await c.get('/risks?status=mitigated')).text, /Sealift delay/);
});

test('example records are labelled, kept away from Polar Express, and removable', async () => {
  await c.get('/settings');
  await c.post('/settings/examples/add');
  const n = get<{ n: number }>('SELECT count(*) AS n FROM tasks WHERE is_example = 1')!.n;
  assert.ok(n > 0);
  assert.equal(get<{ n: number }>('SELECT count(*) AS n FROM tasks WHERE is_example = 1 AND venture_id = ?', [polarExpressId()])!.n, 0);
  assert.match((await c.get('/projects?view=tasks')).text, /\[Example\]/);
  await c.post('/settings/examples/remove');
  for (const t of ['ventures', 'projects', 'tasks', 'decisions', 'financial_entries', 'risks', 'documents', 'opportunities']) {
    assert.equal(get<{ n: number }>(`SELECT count(*) AS n FROM ${t} WHERE is_example = 1`)!.n, 0, t);
  }
  assert.ok(get("SELECT 1 FROM ventures WHERE slug = 'polar-express'"));
});

test('every main page renders for owner, editor and viewer', async () => {
  const pages = ['/', '/ventures', '/ventures?view=list', '/ventures/new', '/projects', '/projects?view=board', '/projects?view=milestones', '/projects/new', '/tasks/new', '/milestones/new', '/finance', '/finance/entries', '/finance/entries/new', '/finance/scenarios/new', '/decisions', '/decisions/new', '/documents', '/documents/new', '/opportunities', '/opportunities/new', '/risks', '/risks?view=dependencies', '/risks/new', '/activity', '/activity?venture=polar-express', '/organization', '/organization/edit', '/organization/legal', '/settings'];
  const detail = [
    ...all<{ id: string }>('SELECT id FROM projects').map((r) => `/projects/${r.id}`),
    ...all<{ id: string }>('SELECT id FROM tasks').map((r) => `/tasks/${r.id}/edit`),
    ...all<{ id: string }>('SELECT id FROM decisions').map((r) => `/decisions/${r.id}`),
    ...all<{ id: string }>('SELECT id FROM documents').map((r) => `/documents/${r.id}`),
    ...all<{ id: string }>('SELECT id FROM opportunities').map((r) => `/opportunities/${r.id}`),
    ...all<{ id: string }>('SELECT id FROM risks').map((r) => `/risks/${r.id}/edit`),
  ];
  for (const role of ['owner', 'editor', 'viewer'] as const) {
    const client = await signedIn(app, role);
    for (const p of [...pages, ...detail]) {
      const res = await client.get(p);
      // Task, milestone and risk pages double as read-only detail views.
      const writeOnly = /\/new$|\/organization\/(edit|legal)$/.test(p) || (/\/edit$/.test(p) && !/^\/(tasks|milestones|risks)\//.test(p));
      const expected = role === 'viewer' && writeOnly ? 403 : role === 'editor' && p === '/organization/legal' ? 403 : 200;
      assert.equal(res.status, expected, `${role} ${p}`);
    }
  }
});
