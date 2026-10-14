import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signedIn, idFrom, polarExpressId, type App, type Client } from './helpers.ts';
import { get } from '../src/db/database.ts';
import { addDays, today } from '../src/lib/time.ts';
import { buildDashboard } from '../src/domain/dashboard.ts';

let app: App;
let c: Client;
let pe: string;
before(async () => {
  app = await startApp();
  c = await signedIn(app);
  pe = polarExpressId();
});
after(() => app.close());

const statFor = (html: string, label: string): number => Number(new RegExp(`(\\d+)</span><span class="stat__label">${label}`).exec(html)![1]);

test('project → milestone → tasks for Polar Express, with dashboard metrics following', async () => {
  const before = buildDashboard();
  await c.get('/projects/new');
  const p = await c.post('/projects', { name: 'Feasibility study', venture_id: pe, status: 'active', start_date: today(), target_date: addDays(today(), 60) });
  assert.equal(p.status, 303);
  const projectId = idFrom(p.location);

  const m = await c.post('/milestones', { title: 'Feasibility report drafted', venture_id: '', project_id: projectId, status: 'planned', due_date: addDays(today(), 20) });
  assert.equal(m.status, 303);
  const milestone = get<{ id: string; venture_id: string }>("SELECT id, venture_id FROM milestones WHERE title = 'Feasibility report drafted'")!;
  assert.equal(milestone.venture_id, pe, 'venture derived from project');

  await c.post('/tasks', { title: 'Collect freight rates', venture_id: '', project_id: projectId, milestone_id: milestone.id, status: 'not_started', priority: 'high', due_date: addDays(today(), -2) });
  await c.post('/tasks', { title: 'Interview shippers', venture_id: pe, project_id: projectId, milestone_id: '', status: 'not_started', priority: 'normal' });
  const t1 = get<{ id: string; venture_id: string }>("SELECT id, venture_id FROM tasks WHERE title = 'Collect freight rates'")!;
  const t2 = get<{ id: string }>("SELECT id FROM tasks WHERE title = 'Interview shippers'")!;
  assert.equal(t1.venture_id, pe);

  let dash = await c.get('/');
  assert.equal(statFor(dash.text, 'Overdue tasks'), before.overdueTasks.length + 1);
  assert.equal(statFor(dash.text, 'Active projects'), before.activeProjects + 1);
  assert.match(dash.text, /Collect freight rates/);

  // Status change via the quick form.
  await c.post(`/tasks/${t2.id}/status`, { status: 'blocked', _return: '/projects?view=board' });
  assert.equal(get<{ status: string }>('SELECT status FROM tasks WHERE id = ?', [t2.id])!.status, 'blocked');
  dash = await c.get('/');
  assert.equal(statFor(dash.text, 'Blocked tasks'), 1);

  await c.post(`/tasks/${t1.id}/status`, { status: 'completed' });
  const done = get<{ completed_on: string }>('SELECT completed_on FROM tasks WHERE id = ?', [t1.id])!;
  assert.equal(done.completed_on, today());
  dash = await c.get('/');
  assert.equal(statFor(dash.text, 'Overdue tasks'), before.overdueTasks.length);

  // Reopen clears completion date.
  await c.post(`/tasks/${t1.id}/status`, { status: 'in_progress' });
  assert.equal(get<{ completed_on: string | null }>('SELECT completed_on FROM tasks WHERE id = ?', [t1.id])!.completed_on, null);

  // Milestone completion does not touch venture status.
  await c.post(`/milestones/${milestone.id}/status`, { status: 'completed' });
  assert.equal(get<{ status: string }>('SELECT status FROM milestones WHERE id = ?', [milestone.id])!.status, 'completed');
  const v = get<{ legal_status: string; operational_status: string }>('SELECT * FROM ventures WHERE id = ?', [pe])!;
  assert.equal(v.legal_status, 'not_established');
  assert.equal(v.operational_status, 'proposed');
  assert.ok(get("SELECT 1 FROM activity_events WHERE event_type = 'milestone.completed' AND entity_id = ?", [milestone.id]));

  for (const view of ['projects', 'tasks', 'board', 'milestones']) assert.equal((await c.get(`/projects?view=${view}&venture=polar-express`)).status, 200);
  assert.match((await c.get('/projects?view=tasks&q=freight')).text, /Collect freight rates/);
  assert.doesNotMatch((await c.get('/projects?view=tasks&q=freight')).text, /Interview shippers/);
  assert.match((await c.get(`/projects/${projectId}`)).text, /Interview shippers/);
  assert.match((await c.get('/ventures/polar-express/projects?view=board')).text, /Collect freight rates/);
});

test('a task cannot claim a project from another venture', async () => {
  const p = await c.post('/projects', { name: 'Parent-level project', venture_id: '', status: 'planned' });
  const projectId = idFrom(p.location);
  const res = await c.post('/tasks', { title: 'Mismatched', venture_id: pe, project_id: projectId, milestone_id: '', status: 'not_started', priority: 'normal' });
  assert.equal(res.status, 422);
  assert.match(res.text, /different venture/);
});

test('date and enum validation happen on the server', async () => {
  const res = await c.post('/tasks', { title: 'Bad', venture_id: '', project_id: '', milestone_id: '', status: 'invented', priority: 'normal', due_date: '2026-02-31' });
  assert.equal(res.status, 422);
  assert.match(res.text, /valid status/);
  assert.match(res.text, /valid date/);
  const inverted = await c.post('/projects', { name: 'Inverted', venture_id: '', status: 'planned', start_date: '2027-05-01', target_date: '2027-01-01' });
  assert.equal(inverted.status, 422);
});

test('dependencies block work until the prerequisite is met or resolved', async () => {
  const a = get<{ id: string }>("SELECT id FROM tasks WHERE title = 'Collect freight rates'")!.id;
  const b = get<{ id: string }>("SELECT id FROM tasks WHERE title = 'Interview shippers'")!.id;
  await c.post(`/tasks/${b}/status`, { status: 'not_started' });
  await c.get(`/tasks/${b}/edit`);
  const res = await c.post('/dependencies', { blocked: `task:${b}`, prereq: `task:${a}`, _return: `/tasks/${b}/edit` });
  assert.equal(res.status, 303);
  assert.equal(buildDashboard().blockedTasks.filter((t) => t.id === b).length, 1, 'waiting on an open prerequisite');
  const ext = await c.post('/dependencies', { blocked: `task:${a}`, prereq: 'external', external_type: 'approval', description: '' });
  assert.equal(ext.status, 303);
  assert.equal(get<{ n: number }>("SELECT count(*) AS n FROM dependencies WHERE external_type = 'approval'")!.n, 0, 'external needs a description');
  await c.post(`/tasks/${a}/status`, { status: 'completed' });
  assert.equal(buildDashboard().blockedTasks.filter((t) => t.id === b).length, 0, 'prerequisite met');
  assert.match((await c.get('/risks?view=dependencies')).text, /Prerequisite met/);
});

test('archive and restore a task', async () => {
  const t = get<{ id: string }>("SELECT id FROM tasks WHERE title = 'Interview shippers'")!.id;
  await c.post(`/tasks/${t}/archive`);
  assert.doesNotMatch((await c.get('/projects?view=tasks')).text, /Interview shippers/);
  assert.match((await c.get('/projects?view=tasks&archived=1')).text, /Interview shippers/);
  await c.post(`/tasks/${t}/restore`);
  assert.match((await c.get('/projects?view=tasks')).text, /Interview shippers/);
});
