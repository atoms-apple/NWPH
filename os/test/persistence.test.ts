import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signedIn, idFrom, polarExpressId } from './helpers.ts';

test('records and relationships survive a full restart', async () => {
  let app = await startApp();
  let c = await signedIn(app);
  const pe = polarExpressId();
  await c.get('/projects/new');
  const projectId = idFrom((await c.post('/projects', { name: 'Persistent project', venture_id: pe, status: 'active' })).location);
  await c.post('/tasks', { title: 'Persistent task', venture_id: '', project_id: projectId, milestone_id: '', status: 'in_progress', priority: 'high' });
  const dir = app.dir;
  await app.close({ keepFiles: true });

  app = await startApp({ dir });
  c = await signedIn(app);
  const project = await c.get(`/projects/${projectId}`);
  assert.equal(project.status, 200);
  assert.match(project.text, /Persistent task/);
  assert.match(project.text, /Polar Express/);
  assert.match((await c.get('/ventures/polar-express/projects')).text, /Persistent project/);
  assert.match((await c.get('/activity')).text, /Persistent task/);
  await app.close();
});
