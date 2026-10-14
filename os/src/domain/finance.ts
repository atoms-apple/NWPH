/**
 * Financial planning. Not bookkeeping.
 *
 * Integrity rules (also enforced by CHECK constraints):
 *  - Every figure has a basis: forecast, budget or actual. Totals are computed
 *    per basis and per currency and are never added across either, so a
 *    budget line and the actual that fulfils it are not double-counted.
 *  - Funding rows carry funding_status. Only committed and received funding
 *    counts as secured; potential and applied funding is shown separately and
 *    never reduces the funding gap.
 *  - Only actuals can be verified, only by a user with the verify permission,
 *    and editing the amount, currency or date of a verified actual returns it
 *    to unverified.
 *  - A metric is only calculated when its inputs exist. Otherwise the summary
 *    says what is missing.
 */
import { all, get, tx } from '../db/database.ts';
import { nowIso } from '../lib/time.ts';
import { DEFAULT_CURRENCY } from '../lib/money.ts';
import type { Actor } from '../http/context.ts';
import { type Field, type Values, ValidationError, currencyField } from './fields.ts';
import { ENTRY_TYPES, BASES, FUNDING_STATUSES, FUNDING_SECURED, FINANCE_CATEGORIES, labelOf } from './vocabulary.ts';
import { getOrganization } from './organization.ts';
import { insertRow, logActivity, updateRow, setArchived, findRow } from './records.ts';
import { IN_ACTIVE_VENTURE } from './ventures.ts';

export type EntryType = 'startup_cost' | 'capital_expenditure' | 'operating_expense' | 'revenue' | 'funding_requirement' | 'funding';
export const COST_TYPES: EntryType[] = ['startup_cost', 'capital_expenditure', 'operating_expense'];

export const ENTRY_FIELDS: Field[] = [
  { name: 'entry_type', label: 'Type', type: 'select', required: true, options: ENTRY_TYPES },
  { name: 'basis', label: 'Basis', type: 'select', required: true, options: BASES, help: 'Forecast = estimate. Budget = planned allocation. Actual = real amount that has occurred. Funding sources derive this from their status.' },
  { name: 'funding_status', label: 'Funding status', type: 'select', options: FUNDING_STATUSES, emptyLabel: 'Not a funding source', help: 'Funding sources only. Only Committed and Received count as secured.' },
  { name: 'description', label: 'Description', type: 'text', required: true, max: 300, wide: true },
  { name: 'amount_minor', label: 'Amount', type: 'money', required: true },
  currencyField(),
  { name: 'category', label: 'Category', type: 'select', options: FINANCE_CATEGORIES, freeform: true, emptyLabel: 'Uncategorised' },
  { name: 'period', label: 'Financial period', type: 'text', max: 40, placeholder: 'e.g. FY2027, 2027-Q2, Year 1', help: 'For operating costs and revenue, the period the amount covers.' },
  { name: 'entry_date', label: 'Date', type: 'date' },
  { name: 'venture_id', label: 'Venture', type: 'ref', ref: 'venture', emptyLabel: 'NWPH (parent organization)' },
  { name: 'project_id', label: 'Project', type: 'ref', ref: 'project', emptyLabel: 'No project' },
  { name: 'scenario_id', label: 'Scenario', type: 'ref', ref: 'scenario', emptyLabel: 'Baseline' },
  { name: 'opportunity_id', label: 'Related opportunity', type: 'ref', ref: 'opportunity', emptyLabel: 'None' },
  { name: 'document_id', label: 'Supporting document', type: 'ref', ref: 'document', emptyLabel: 'None' },
  { name: 'source_reference', label: 'Source or supporting reference', type: 'text', max: 500, wide: true, help: 'Where the number came from: a quote, a published rate, a calculation.' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true, max: 4000 },
];

export const SCENARIO_FIELDS: Field[] = [
  { name: 'name', label: 'Scenario name', type: 'text', required: true, max: 80 },
  { name: 'venture_id', label: 'Venture', type: 'ref', ref: 'venture', emptyLabel: 'NWPH (parent organization)' },
  { name: 'description', label: 'Description', type: 'textarea', max: 2000, wide: true },
];

export interface FinancialEntry {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  project_id: string | null;
  project_name: string | null;
  scenario_id: string | null;
  scenario_name: string | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  document_id: string | null;
  document_title: string | null;
  entry_type: EntryType;
  basis: 'forecast' | 'budget' | 'actual';
  funding_status: string | null;
  category: string | null;
  description: string;
  amount_minor: number;
  currency: string;
  period: string | null;
  entry_date: string | null;
  source_reference: string | null;
  verification_status: 'unverified' | 'verified';
  verified_by_name: string | null;
  verified_at: string | null;
  notes: string | null;
  archived_at: string | null;
  is_example: number;
  updated_at: string;
}

/** The four kinds of figure the interface distinguishes. */
export function figureKind(e: Pick<FinancialEntry, 'basis' | 'verification_status'>): { key: string; label: string } {
  if (e.basis === 'actual') {
    return e.verification_status === 'verified'
      ? { key: 'verified', label: 'Actual · verified' }
      : { key: 'actual', label: 'Actual · entered' };
  }
  return { key: e.basis, label: labelOf(BASES, e.basis) };
}

const ENTRY_SELECT = `
  SELECT e.*, v.name AS venture_name, v.slug AS venture_slug, p.name AS project_name, s.name AS scenario_name,
         o.title AS opportunity_title, d.title AS document_title, u.display_name AS verified_by_name
    FROM financial_entries e
    LEFT JOIN ventures v ON v.id = e.venture_id
    LEFT JOIN projects p ON p.id = e.project_id
    LEFT JOIN financial_scenarios s ON s.id = e.scenario_id
    LEFT JOIN opportunities o ON o.id = e.opportunity_id
    LEFT JOIN documents d ON d.id = e.document_id
    LEFT JOIN users u ON u.id = e.verified_by`;

export interface FinanceFilter {
  ventureId?: string | null;
  scope?: 'parent' | null;
  projectId?: string | null;
  /** undefined = all entries; null = baseline only; id = baseline + that scenario. */
  scenarioId?: string | null;
  entryType?: string | null;
  basis?: string | null;
  q?: string | null;
  archived?: boolean;
}

function filterSql(f: FinanceFilter): { where: string; params: Record<string, string> } {
  const where = [f.archived ? 'e.archived_at IS NOT NULL' : 'e.archived_at IS NULL'];
  const params: Record<string, string> = {};
  if (f.ventureId) {
    where.push('e.venture_id = :venture');
    params.venture = f.ventureId;
  } else if (f.scope === 'parent') where.push('e.venture_id IS NULL');
  else where.push(IN_ACTIVE_VENTURE('e'));
  if (f.projectId) {
    where.push('e.project_id = :project');
    params.project = f.projectId;
  }
  if (f.scenarioId === null) where.push('e.scenario_id IS NULL');
  else if (f.scenarioId) {
    where.push('(e.scenario_id IS NULL OR e.scenario_id = :scenario)');
    params.scenario = f.scenarioId;
  }
  if (f.entryType) {
    where.push('e.entry_type = :etype');
    params.etype = f.entryType;
  }
  if (f.basis === 'verified') where.push(`e.basis = 'actual' AND e.verification_status = 'verified'`);
  else if (f.basis) {
    where.push('e.basis = :basis');
    params.basis = f.basis;
  }
  if (f.q) {
    where.push(`(e.description LIKE :q ESCAPE '\\' OR e.category LIKE :q ESCAPE '\\' OR e.source_reference LIKE :q ESCAPE '\\' OR e.notes LIKE :q ESCAPE '\\')`);
    params.q = `%${f.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  }
  return { where: where.join(' AND '), params };
}

export function listEntries(f: FinanceFilter = {}): FinancialEntry[] {
  const { where, params } = filterSql(f);
  return all<FinancialEntry>(
    `${ENTRY_SELECT} WHERE ${where}
     ORDER BY CASE e.entry_type WHEN 'startup_cost' THEN 0 WHEN 'capital_expenditure' THEN 1 WHEN 'operating_expense' THEN 2
              WHEN 'revenue' THEN 3 WHEN 'funding_requirement' THEN 4 ELSE 5 END,
              e.entry_date IS NULL, e.entry_date DESC, e.created_at DESC`,
    params,
  );
}

export const getEntry = (id: string): FinancialEntry | undefined => get<FinancialEntry>(`${ENTRY_SELECT} WHERE e.id = ?`, [id]);

// ── Validation ───────────────────────────────────────────────────────────────

function normaliseEntry(values: Values): Values {
  const errors: Record<string, string> = {};
  const v = { ...values };
  if (v.entry_type === 'funding') {
    if (!v.funding_status) errors.funding_status = 'Choose a funding status: is this source potential, applied for, committed or received?';
    // Basis follows status: only received money is an actual.
    v.basis = v.funding_status === 'received' ? 'actual' : 'forecast';
  } else {
    v.funding_status = null;
    if (v.entry_type === 'funding_requirement' && v.basis === 'actual') {
      errors.basis = 'A funding requirement is a plan, so it cannot be an actual. Use forecast or budget.';
    }
  }
  if (v.project_id) {
    const p = get<{ venture_id: string | null }>('SELECT venture_id FROM projects WHERE id = ?', [v.project_id as string]);
    if (p && (p.venture_id ?? null) !== (v.venture_id ?? null)) errors.project_id = 'That project belongs to a different venture.';
  }
  if (v.scenario_id) {
    const s = get<{ venture_id: string | null }>('SELECT venture_id FROM financial_scenarios WHERE id = ?', [v.scenario_id as string]);
    if (s && (s.venture_id ?? null) !== (v.venture_id ?? null)) errors.scenario_id = 'That scenario belongs to a different venture.';
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return v;
}

export function createEntry(values: Values, actor: Actor): string {
  const v = normaliseEntry(values);
  const id = insertRow('financial_entry', { ...v, organization_id: getOrganization().id, verification_status: 'unverified' });
  logActivity({
    actor,
    type: 'finance.entry_created',
    entityType: 'financial_entry',
    entityId: id,
    ventureId: v.venture_id as string | null,
    summary: `${labelOf(ENTRY_TYPES, String(v.entry_type))} (${v.entry_type === 'funding' ? labelOf(FUNDING_STATUSES, String(v.funding_status)).toLowerCase() : labelOf(BASES, String(v.basis)).toLowerCase()}) added: ${v.description}`,
  });
  return id;
}

export function updateEntry(id: string, values: Values, actor: Actor): void {
  const before = getEntry(id);
  if (!before) throw new ValidationError({ _: 'Entry not found.' });
  const v: Record<string, unknown> = normaliseEntry(values);
  const materially =
    before.verification_status === 'verified' &&
    (v.amount_minor !== before.amount_minor || v.currency !== before.currency || v.entry_date !== before.entry_date || v.basis !== before.basis);
  if (materially || v.basis !== 'actual') {
    v.verification_status = 'unverified';
    v.verified_by = null;
    v.verified_at = null;
  }
  const changes = updateRow('financial_entry', id, v);
  if (!Object.keys(changes).length) return;
  logActivity({
    actor,
    type: 'finance.assumption_changed',
    entityType: 'financial_entry',
    entityId: id,
    ventureId: v.venture_id as string | null,
    summary: `Financial entry “${v.description}” changed${materially ? ' (verification cleared)' : ''}`,
    changes,
  });
}

export function setVerification(id: string, verified: boolean, actor: Actor): void {
  const e = getEntry(id);
  if (!e) throw new ValidationError({ _: 'Entry not found.' });
  if (verified && e.basis !== 'actual') throw new ValidationError({ _: 'Only actual amounts can be verified. Forecasts and budgets are plans.' });
  const changes = updateRow('financial_entry', id, {
    verification_status: verified ? 'verified' : 'unverified',
    verified_by: verified ? actor.id : null,
    verified_at: verified ? nowIso() : null,
  });
  if (Object.keys(changes).length) {
    logActivity({
      actor,
      type: verified ? 'finance.verified' : 'finance.unverified',
      entityType: 'financial_entry',
      entityId: id,
      ventureId: e.venture_id,
      summary: `Actual “${e.description}” ${verified ? 'marked verified' : 'returned to unverified'}`,
      changes,
    });
  }
}

export function archiveEntry(id: string, archived: boolean, actor: Actor): void {
  const e = getEntry(id);
  if (e && setArchived('financial_entry', id, archived)) {
    logActivity({
      actor,
      type: archived ? 'finance.entry_archived' : 'finance.entry_restored',
      entityType: 'financial_entry',
      entityId: id,
      ventureId: e.venture_id,
      summary: `Financial entry “${e.description}” ${archived ? 'archived (excluded from summaries)' : 'restored'}`,
    });
  }
}

// ── Scenarios ────────────────────────────────────────────────────────────────

export interface Scenario {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  name: string;
  description: string | null;
  archived_at: string | null;
  entry_count: number;
}

export function listScenarios(ventureId?: string | null, includeArchived = false): Scenario[] {
  const where = [includeArchived ? '1' : 's.archived_at IS NULL'];
  const params: Record<string, string> = {};
  if (ventureId !== undefined) {
    if (ventureId === null) where.push('s.venture_id IS NULL');
    else {
      where.push('s.venture_id = :v');
      params.v = ventureId;
    }
  }
  return all<Scenario>(
    `SELECT s.*, v.name AS venture_name,
       (SELECT count(*) FROM financial_entries e WHERE e.scenario_id = s.id AND e.archived_at IS NULL) AS entry_count
       FROM financial_scenarios s LEFT JOIN ventures v ON v.id = s.venture_id
      WHERE ${where.join(' AND ')} ORDER BY s.name COLLATE NOCASE`,
    params,
  );
}

export function createScenario(values: Values, actor: Actor): string {
  const id = insertRow('scenario', { ...values, organization_id: getOrganization().id });
  logActivity({ actor, type: 'finance.scenario_created', entityType: 'scenario', entityId: id, ventureId: values.venture_id as string | null, summary: `Funding scenario “${values.name}” created` });
  return id;
}

export function updateScenario(id: string, values: Values, actor: Actor): void {
  const before = findRow<{ venture_id: string | null }>('scenario', id);
  if (!before) throw new ValidationError({ _: 'Scenario not found.' });
  const used = get<{ n: number }>('SELECT count(*) AS n FROM financial_entries WHERE scenario_id = ?', [id])!.n;
  if (used && (values.venture_id ?? null) !== (before.venture_id ?? null)) {
    throw new ValidationError({ venture_id: 'This scenario already has entries, so its venture cannot change.' });
  }
  const changes = updateRow('scenario', id, values);
  if (Object.keys(changes).length) {
    logActivity({ actor, type: 'finance.scenario_updated', entityType: 'scenario', entityId: id, ventureId: values.venture_id as string | null, summary: `Funding scenario “${values.name}” updated`, changes });
  }
}

export function archiveScenario(id: string, archived: boolean, actor: Actor): void {
  const s = findRow<{ name: string; venture_id: string | null }>('scenario', id);
  if (s && setArchived('scenario', id, archived)) {
    logActivity({ actor, type: `finance.scenario_${archived ? 'archived' : 'restored'}`, entityType: 'scenario', entityId: id, ventureId: s.venture_id, summary: `Funding scenario “${s.name}” ${archived ? 'archived' : 'restored'}` });
  }
}

// ── Summaries ────────────────────────────────────────────────────────────────

export interface Cell {
  total: number;
  count: number;
}

export interface TypeRow {
  type: EntryType;
  forecast: Cell;
  budget: Cell;
  actual: Cell; // entered, unverified
  verified: Cell; // verified actuals
}

export interface FundingSummary {
  requirement: number | null;
  requirementBasis: 'budget' | 'forecast' | null;
  received: number;
  committed: number;
  applied: number;
  potential: number;
  declined: number;
  fundingEntryCount: number;
  gap: number | null;
  /** Why the gap is not shown, when it is not. */
  gapUnavailable: string | null;
}

export interface BudgetComparison {
  type: EntryType;
  budget: number;
  actual: number;
  variance: number; // actual − budget
}

export interface CurrencySummary {
  currency: string;
  rows: TypeRow[];
  funding: FundingSummary;
  budgetVsActual: BudgetComparison[];
  entryCount: number;
}

const zero = (): Cell => ({ total: 0, count: 0 });

export function summarize(entries: ReadonlyArray<Pick<FinancialEntry, 'entry_type' | 'basis' | 'verification_status' | 'funding_status' | 'amount_minor' | 'currency'>>): CurrencySummary[] {
  const byCurrency = new Map<string, typeof entries[number][]>();
  for (const e of entries) {
    const list = byCurrency.get(e.currency) ?? [];
    list.push(e);
    byCurrency.set(e.currency, list);
  }
  const currencies = [...byCurrency.keys()].sort((a, b) => (a === DEFAULT_CURRENCY ? -1 : b === DEFAULT_CURRENCY ? 1 : a.localeCompare(b)));

  return currencies.map((currency) => {
    const list = byCurrency.get(currency)!;
    const rows: TypeRow[] = (['startup_cost', 'capital_expenditure', 'operating_expense', 'revenue', 'funding_requirement'] as EntryType[]).map(
      (type) => {
        const row: TypeRow = { type, forecast: zero(), budget: zero(), actual: zero(), verified: zero() };
        for (const e of list) {
          if (e.entry_type !== type) continue;
          const cell = e.basis === 'actual' ? (e.verification_status === 'verified' ? row.verified : row.actual) : row[e.basis];
          cell.total += e.amount_minor;
          cell.count++;
        }
        return row;
      },
    );

    // Funding requirement: use budgeted figures when any exist, otherwise
    // forecasts. Never both, which would count the same need twice.
    const req = rows.find((r) => r.type === 'funding_requirement')!;
    const requirementBasis = req.budget.count ? 'budget' : req.forecast.count ? 'forecast' : null;
    const requirement = requirementBasis ? req[requirementBasis].total : null;

    const funding = list.filter((e) => e.entry_type === 'funding');
    const sumStatus = (s: string) => funding.filter((e) => e.funding_status === s).reduce((n, e) => n + e.amount_minor, 0);
    const received = sumStatus('received');
    const committed = sumStatus('committed');
    let gap: number | null = null;
    let gapUnavailable: string | null = null;
    if (requirement === null) gapUnavailable = 'No funding requirement has been entered.';
    else if (!funding.length) gapUnavailable = 'No funding sources have been entered.';
    else gap = requirement - (received + committed);

    const budgetVsActual: BudgetComparison[] = rows
      .filter((r) => r.type !== 'funding_requirement' && r.budget.count > 0 && r.actual.count + r.verified.count > 0)
      .map((r) => {
        const actual = r.actual.total + r.verified.total;
        return { type: r.type, budget: r.budget.total, actual, variance: actual - r.budget.total };
      });

    return {
      currency,
      rows,
      funding: {
        requirement,
        requirementBasis,
        received,
        committed,
        applied: sumStatus('applied'),
        potential: sumStatus('potential'),
        declined: sumStatus('declined'),
        fundingEntryCount: funding.length,
        gap,
        gapUnavailable,
      },
      budgetVsActual,
      entryCount: list.length,
    };
  });
}

export const isSecured = (status: string | null): boolean => Boolean(status && FUNDING_SECURED.has(status));

/** Per-venture planning totals in the default currency, for the portfolio table. */
export interface VentureFinanceRow {
  venture_id: string | null;
  venture_name: string;
  venture_slug: string | null;
  summary: CurrencySummary | null;
  otherCurrencies: string[];
}

export function portfolioFinance(): VentureFinanceRow[] {
  const entries = listEntries({ scenarioId: null });
  const groups = new Map<string, FinancialEntry[]>();
  for (const e of entries) {
    const key = e.venture_id ?? '';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const ventures = all<{ id: string; name: string; slug: string }>(
    'SELECT id, name, slug FROM ventures WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE',
  );
  const rows: VentureFinanceRow[] = [];
  const build = (id: string | null, name: string, slug: string | null) => {
    const list = groups.get(id ?? '') ?? [];
    const sums = summarize(list);
    rows.push({
      venture_id: id,
      venture_name: name,
      venture_slug: slug,
      summary: sums.find((s) => s.currency === DEFAULT_CURRENCY) ?? null,
      otherCurrencies: sums.filter((s) => s.currency !== DEFAULT_CURRENCY).map((s) => s.currency),
    });
  };
  build(null, `${getOrganization().name} (parent organization)`, null);
  for (const v of ventures) build(v.id, v.name, v.slug);
  return rows;
}
