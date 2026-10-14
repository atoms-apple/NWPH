import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signedIn, idFrom, polarExpressId, type App, type Client } from './helpers.ts';
import { get, all } from '../src/db/database.ts';

let app: App;
let c: Client;
before(async () => {
  app = await startApp();
  c = await signedIn(app);
});
after(() => app.close());

const stageId = (name: string) => get<{ id: string }>('SELECT id FROM development_stages WHERE name = ?', [name])!.id;

test('Polar Express is the first venture and opens its workspace', async () => {
  const list = await c.get('/ventures');
  assert.equal(list.status, 200);
  assert.match(list.text, /Polar Express/);
  for (const s of ['', '/plan', '/projects', '/milestones', '/finance', '/funding', '/research', '/risks', '/documents', '/decisions', '/activity', '/settings']) {
    const res = await c.get(`/ventures/polar-express${s}`);
    assert.equal(res.status, 200, `section ${s || 'overview'}`);
  }
  const overview = await c.get('/ventures/polar-express');
  assert.match(overview.text, /provisional/i);
  assert.match(overview.text, /Not established/);
});

test('create, edit, search, filter a venture', async () => {
  await c.get('/ventures/new');
  const missing = await c.post('/ventures', { name: '', stage_id: stageId('Idea'), operational_status: 'proposed', legal_status: 'not_established' });
  assert.equal(missing.status, 422);
  assert.match(missing.text, /Venture name is required/);

  const res = await c.post('/ventures', { name: 'Arctic Test Logistics', category: 'Logistics & Freight', stage_id: stageId('Research'), operational_status: 'proposed', legal_status: 'not_established', short_description: 'Testing venture' });
  assert.equal(res.status, 303);
  assert.equal(res.location, '/ventures/arctic-test-logistics');

  const dup = await c.post('/ventures', { name: 'arctic test logistics', stage_id: stageId('Idea'), operational_status: 'proposed', legal_status: 'not_established' });
  assert.equal(dup.status, 422);

  await c.get('/ventures/arctic-test-logistics/settings');
  const edit = await c.post('/ventures/arctic-test-logistics/details', { name: 'Arctic Test Logistics', category: 'Logistics & Freight', short_description: 'Edited description', description: 'Long', locations: 'Iqaluit', parent_relationship: 'Proposed', ownership_notes: '', provisional: ['locations'] });
  assert.equal(edit.status, 303);
  const v = get<{ short_description: string; provisional_fields: string }>("SELECT * FROM ventures WHERE slug = 'arctic-test-logistics'")!;
  assert.equal(v.short_description, 'Edited description');
  assert.deepEqual(JSON.parse(v.provisional_fields), ['locations']);

  assert.match((await c.get('/ventures?q=Arctic+Test')).text, /Arctic Test Logistics/);
  assert.doesNotMatch((await c.get('/ventures?q=Arctic+Test')).text, /Polar Express<\/a>/);
  assert.doesNotMatch((await c.get(`/ventures?stage=${stageId('Idea')}`)).text, /Arctic Test Logistics/);
  assert.match((await c.get('/ventures?category=Logistics+%26+Freight&view=list')).text, /Arctic Test Logistics/);
  assert.equal((await c.get('/ventures?sort=created')).status, 200);
});

test('changing development stage leaves legal and operational status alone and is recorded', async () => {
  const id = polarExpressId();
  await c.get('/ventures/polar-express/settings');
  const res = await c.post('/ventures/polar-express/stage', { stage_id: stageId('Operational'), note: 'Test move' });
  assert.equal(res.status, 303);
  const v = get<{ legal_status: string; operational_status: string; stage_id: string }>('SELECT * FROM ventures WHERE id = ?', [id])!;
  assert.equal(v.stage_id, stageId('Operational'));
  assert.equal(v.legal_status, 'not_established');
  assert.equal(v.operational_status, 'proposed');
  assert.ok(get("SELECT 1 FROM venture_stage_changes WHERE venture_id = ? AND note = 'Test move'", [id]));
  assert.ok(get("SELECT 1 FROM activity_events WHERE entity_id = ? AND event_type = 'venture.stage_changed'", [id]));
  await c.post('/ventures/polar-express/stage', { stage_id: stageId('Idea'), note: 'Back' });
});

test('archiving a venture keeps its records and removes it from portfolio metrics; restore brings it back', async () => {
  const create = await c.post('/ventures', { name: 'Archive Me', stage_id: stageId('Idea'), operational_status: 'proposed', legal_status: 'not_established' });
  const vid = get<{ id: string }>("SELECT id FROM ventures WHERE name = 'Archive Me'")!.id;
  assert.equal(create.status, 303);
  await c.get('/projects/new');
  const p = await c.post('/projects', { name: 'Archive project', venture_id: vid, status: 'active' });
  const projectId = idFrom(p.location);

  const countBefore = Number(/(\d+)<\/span><span class="stat__label">Ventures in portfolio/.exec((await c.get('/')).text)![1]);
  await c.post('/ventures/archive-me/archive');
  assert.ok(get('SELECT archived_at FROM ventures WHERE id = ?', [vid])!.archived_at);
  assert.doesNotMatch((await c.get('/ventures')).text, /href="\/ventures\/archive-me"/);
  assert.match((await c.get('/ventures?archived=1')).text, /href="\/ventures\/archive-me"/);
  const countAfter = Number(/(\d+)<\/span><span class="stat__label">Ventures in portfolio/.exec((await c.get('/')).text)![1]);
  assert.equal(countAfter, countBefore - 1);
  // Records remain linked and reachable.
  assert.equal(get<{ venture_id: string }>('SELECT venture_id FROM projects WHERE id = ?', [projectId])!.venture_id, vid);
  assert.equal((await c.get(`/projects/${projectId}`)).status, 200);
  assert.match((await c.get('/ventures/archive-me/projects')).text, /Archive project/);
  assert.doesNotMatch((await c.get('/projects')).text, /Archive project/);

  await c.post('/ventures/archive-me/restore');
  assert.equal(get('SELECT archived_at FROM ventures WHERE id = ?', [vid])!.archived_at, null);
  assert.match((await c.get('/projects')).text, /Archive project/);
});

test('organization profile edits are recorded with before/after values', async () => {
  await c.get('/organization/edit');
  const res = await c.post('/organization', { name: 'NWPH', headquarters: 'Iqaluit, Nunavut', description: 'Updated', mission: 'Ownership', guiding_philosophy: 'Arctic doesn’t need more extraction; it needs more ownership.', ownership_notes: '', notes: '' });
  assert.equal(res.status, 303);
  const ev = all<{ changes: string }>("SELECT changes FROM activity_events WHERE event_type = 'organization.updated'");
  assert.ok(ev.length);
  assert.deepEqual(JSON.parse(ev[0]!.changes).headquarters, ['Iqaluit, Nunavut, Canada (intended)', 'Iqaluit, Nunavut']);
  await c.post('/organization/reviewed');
  assert.ok(get('SELECT profile_reviewed_at FROM organizations')!.profile_reviewed_at);
});

test('business plan sections save and keep provisional markers', async () => {
  await c.get('/ventures/polar-express/plan/concept/edit');
  const res = await c.post('/ventures/polar-express/plan/concept', { mission: 'Confirmed mission text', objectives: 'Obj', products_services: '', value_proposition: '', provisional: [] });
  assert.equal(res.status, 303);
  const v = get<{ mission: string; provisional_fields: string }>("SELECT * FROM ventures WHERE slug = 'polar-express'")!;
  assert.equal(v.mission, 'Confirmed mission text');
  assert.ok(!JSON.parse(v.provisional_fields).includes('mission'));
  assert.ok(JSON.parse(v.provisional_fields).includes('description'), 'fields outside the form keep their markers');
});

test('stages are configurable by owners', async () => {
  await c.get('/settings');
  assert.equal((await c.post('/settings/stages', { name: 'Scale-up', description: 'Growth' })).status, 303);
  const s = get<{ id: string }>("SELECT id FROM development_stages WHERE name = 'Scale-up'")!;
  await c.post(`/settings/stages/${s.id}/move`, { direction: 'up' });
  await c.post(`/settings/stages/${s.id}`, { name: 'Scale up', description: '' });
  assert.ok(get("SELECT 1 FROM development_stages WHERE name = 'Scale up'"));
  // A stage in use cannot be archived.
  await c.post(`/settings/stages/${stageId('Idea')}/archive`);
  assert.equal(get<{ archived_at: string | null }>('SELECT archived_at FROM development_stages WHERE id = ?', [stageId('Idea')])!.archived_at, null);
  await c.post(`/settings/stages/${s.id}/archive`);
  assert.ok(get<{ archived_at: string | null }>('SELECT archived_at FROM development_stages WHERE id = ?', [s.id])!.archived_at);
});
