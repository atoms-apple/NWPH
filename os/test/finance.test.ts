import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signedIn, idFrom, polarExpressId, type App, type Client } from './helpers.ts';
import { get, run } from '../src/db/database.ts';
import { summarize } from '../src/domain/finance.ts';

type E = Parameters<typeof summarize>[0][number];
const e = (entry_type: E['entry_type'], basis: E['basis'], amount: number, extra: Partial<E> = {}): E => ({
  entry_type,
  basis,
  amount_minor: amount,
  currency: 'CAD',
  verification_status: 'unverified',
  funding_status: null,
  ...extra,
});

test('summary: no gap is calculated without both a requirement and funding entries', () => {
  assert.deepEqual(summarize([]), []);
  const onlyCost = summarize([e('startup_cost', 'forecast', 100_00)])[0]!;
  assert.equal(onlyCost.funding.gap, null);
  assert.match(onlyCost.funding.gapUnavailable!, /requirement/);
  const onlyReq = summarize([e('funding_requirement', 'forecast', 500_00)])[0]!;
  assert.equal(onlyReq.funding.gap, null);
  assert.match(onlyReq.funding.gapUnavailable!, /funding sources/);
});

test('summary: potential and applied funding never reduce the gap', () => {
  const s = summarize([
    e('funding_requirement', 'forecast', 1000_00),
    e('funding', 'forecast', 400_00, { funding_status: 'potential' }),
    e('funding', 'forecast', 100_00, { funding_status: 'applied' }),
    e('funding', 'forecast', 200_00, { funding_status: 'committed' }),
    e('funding', 'actual', 50_00, { funding_status: 'received' }),
    e('funding', 'forecast', 999_00, { funding_status: 'declined' }),
  ])[0]!;
  assert.equal(s.funding.gap, 1000_00 - 250_00);
  assert.equal(s.funding.potential, 400_00);
  assert.equal(s.funding.applied, 100_00);
});

test('summary: budget requirement takes precedence over forecast (no double count)', () => {
  const s = summarize([e('funding_requirement', 'forecast', 900_00), e('funding_requirement', 'budget', 700_00), e('funding', 'forecast', 0, { funding_status: 'potential' })])[0]!;
  assert.equal(s.funding.requirement, 700_00);
  assert.equal(s.funding.requirementBasis, 'budget');
});

test('summary: bases and currencies are never added together', () => {
  const sums = summarize([
    e('startup_cost', 'forecast', 100_00),
    e('startup_cost', 'budget', 90_00),
    e('startup_cost', 'actual', 80_00),
    e('startup_cost', 'actual', 5_00, { verification_status: 'verified' }),
    e('startup_cost', 'forecast', 1_00, { currency: 'USD' }),
  ]);
  assert.deepEqual(sums.map((s) => s.currency), ['CAD', 'USD']);
  const row = sums[0]!.rows.find((r) => r.type === 'startup_cost')!;
  assert.equal(row.forecast.total, 100_00);
  assert.equal(row.budget.total, 90_00);
  assert.equal(row.actual.total, 80_00);
  assert.equal(row.verified.total, 5_00);
  assert.deepEqual(sums[0]!.budgetVsActual, [{ type: 'startup_cost', budget: 90_00, actual: 85_00, variance: -5_00 }]);
});

let app: App;
let c: Client;
before(async () => {
  app = await startApp();
  c = await signedIn(app);
});
after(() => app.close());

test('workflow: startup cost, funding requirement, potential source → honest summaries', async () => {
  const pe = polarExpressId();
  await c.get('/finance/entries/new?venture=polar-express&type=startup_cost');
  const add = (fields: Record<string, string>) =>
    c.post('/finance/entries', { venture_id: pe, project_id: '', scenario_id: '', opportunity_id: '', document_id: '', currency: 'CAD', category: '', period: '', entry_date: '', source_reference: '', notes: '', funding_status: '', basis: 'forecast', ...fields });

  assert.equal((await add({ entry_type: 'startup_cost', description: 'Vehicle purchase estimate', amount_minor: '85,000.00', source_reference: 'Dealer quote (verbal)' })).status, 303);
  let page = await c.get('/ventures/polar-express/finance');
  assert.match(page.text, /85,000\.00 CAD/);
  assert.match(page.text, /Not calculated\. No funding requirement has been entered/);

  assert.equal((await add({ entry_type: 'funding_requirement', description: 'Startup funding needed', amount_minor: '120000' })).status, 303);
  page = await c.get('/ventures/polar-express/finance');
  assert.match(page.text, /No funding sources have been entered/);

  // A funding source without a status is rejected.
  const noStatus = await add({ entry_type: 'funding', description: 'Mystery grant', amount_minor: '50000' });
  assert.equal(noStatus.status, 422);
  // Even if "actual" is submitted, a potential source is stored as a forecast.
  const potential = await add({ entry_type: 'funding', funding_status: 'potential', basis: 'actual', description: 'Possible regional grant', amount_minor: '50000' });
  assert.equal(potential.status, 303);
  const row = get<{ basis: string }>("SELECT basis FROM financial_entries WHERE description = 'Possible regional grant'")!;
  assert.equal(row.basis, 'forecast');

  page = await c.get('/ventures/polar-express/finance');
  assert.match(page.text, /Projected funding gap/);
  assert.match(page.text, /120,000\.00 CAD<\/strong>/, 'gap equals full requirement: potential funding is not secured');
  assert.match(page.text, /could narrow the gap only if secured/);

  const dash = await c.get('/');
  assert.match(dash.text, /Proposed startup costs/);
  assert.match(dash.text, /85,000\.00 CAD/);

  // A requirement cannot be an actual.
  assert.equal((await add({ entry_type: 'funding_requirement', basis: 'actual', description: 'Bad', amount_minor: '1' })).status, 422);
  // Negative and malformed amounts are rejected.
  assert.equal((await add({ entry_type: 'startup_cost', description: 'Neg', amount_minor: '-5' })).status, 422);
  assert.equal((await add({ entry_type: 'startup_cost', description: 'Bad currency', amount_minor: '5', currency: 'CA' })).status, 422);
});

test('database rejects a potential funding source recorded as actual', () => {
  assert.throws(() =>
    run(`INSERT INTO financial_entries (id, organization_id, entry_type, basis, funding_status, description, amount_minor, currency, created_at, updated_at)
         VALUES ('x', (SELECT id FROM organizations), 'funding', 'actual', 'potential', 'x', 1, 'CAD', 'now', 'now')`),
  /CHECK constraint/);
});

test('verification: only actuals, only by owners, and cleared by material edits', async () => {
  const pe = polarExpressId();
  const res = await c.post('/finance/entries', { venture_id: pe, project_id: '', scenario_id: '', opportunity_id: '', document_id: '', entry_type: 'startup_cost', basis: 'actual', funding_status: '', description: 'Incorporation filing fee', amount_minor: '350', currency: 'CAD', category: '', period: '', entry_date: '2026-09-01', source_reference: 'Receipt', notes: '' });
  const id = idFrom(res.location);
  const forecastId = get<{ id: string }>("SELECT id FROM financial_entries WHERE description = 'Vehicle purchase estimate'")!.id;
  await c.post(`/finance/entries/${forecastId}/verify`);
  assert.equal(get<{ verification_status: string }>('SELECT verification_status FROM financial_entries WHERE id = ?', [forecastId])!.verification_status, 'unverified');

  const editor = await signedIn(app, 'editor');
  assert.equal((await editor.post(`/finance/entries/${id}/verify`)).status, 403);

  await c.get(`/finance/entries/${id}`);
  await c.post(`/finance/entries/${id}/verify`);
  assert.equal(get<{ verification_status: string }>('SELECT verification_status FROM financial_entries WHERE id = ?', [id])!.verification_status, 'verified');
  assert.match((await c.get(`/finance/entries/${id}`)).text, /Actual · verified/);

  await c.get(`/finance/entries/${id}/edit`);
  await c.post(`/finance/entries/${id}`, { venture_id: pe, project_id: '', scenario_id: '', opportunity_id: '', document_id: '', entry_type: 'startup_cost', basis: 'actual', funding_status: '', description: 'Incorporation filing fee', amount_minor: '400', currency: 'CAD', category: '', period: '', entry_date: '2026-09-01', source_reference: 'Receipt', notes: '' });
  assert.equal(get<{ verification_status: string }>('SELECT verification_status FROM financial_entries WHERE id = ?', [id])!.verification_status, 'unverified');
  const history = await c.get(`/finance/entries/${id}`);
  assert.match(history.text, /verification cleared/);
  assert.match(history.text, /35000/); // before value in cents
});

test('scenarios layer on the baseline and archived entries drop out of summaries', async () => {
  const pe = polarExpressId();
  await c.get('/finance/scenarios/new');
  await c.post('/finance/scenarios', { name: 'Grant-funded', venture_id: pe, description: '' });
  const sid = get<{ id: string }>("SELECT id FROM financial_scenarios WHERE name = 'Grant-funded'")!.id;
  await c.post('/finance/entries', { venture_id: pe, project_id: '', scenario_id: sid, opportunity_id: '', document_id: '', entry_type: 'funding', basis: 'forecast', funding_status: 'committed', description: 'Scenario grant', amount_minor: '100000', currency: 'CAD', category: '', period: '', entry_date: '', source_reference: '', notes: '' });
  const baseline = await c.get('/ventures/polar-express/finance');
  assert.match(baseline.text, /120,000\.00 CAD<\/strong>/);
  const withScenario = await c.get(`/ventures/polar-express/finance?scenario=${sid}`);
  assert.match(withScenario.text, /20,000\.00 CAD<\/strong>/);

  const vid = get<{ id: string }>("SELECT id FROM financial_entries WHERE description = 'Vehicle purchase estimate'")!.id;
  await c.post(`/finance/entries/${vid}/archive`);
  assert.doesNotMatch((await c.get('/ventures/polar-express/finance')).text, /85,000\.00 CAD/);
  assert.equal((await c.get('/finance')).status, 200);
  assert.equal((await c.get('/finance?venture=parent')).status, 200);
  assert.equal((await c.get('/finance/entries?type=funding&basis=forecast')).status, 200);
});
