import { all, get } from '../db/database.ts';
import type { Actor } from '../http/context.ts';
import { type Field, type Values, ValidationError } from './fields.ts';
import { RISK_CATEGORIES, RISK_STATUSES, LIKELIHOOD, IMPACT, riskBand, labelOf } from './vocabulary.ts';
import { getOrganization } from './organization.ts';
import { insertRow, logActivity, updateRow, setArchived } from './records.ts';
import { IN_ACTIVE_VENTURE } from './ventures.ts';

export const RISK_FIELDS: Field[] = [
  { name: 'title', label: 'Risk', type: 'text', required: true, max: 200, wide: true },
  { name: 'venture_id', label: 'Related venture', type: 'ref', ref: 'venture', emptyLabel: 'NWPH (parent organization)' },
  { name: 'project_id', label: 'Related project', type: 'ref', ref: 'project', emptyLabel: 'No project' },
  { name: 'category', label: 'Category', type: 'select', options: RISK_CATEGORIES, freeform: true, emptyLabel: 'Uncategorised' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: RISK_STATUSES },
  { name: 'likelihood', label: 'Likelihood', type: 'select', required: true, options: LIKELIHOOD, help: 'A judgement, not a probability.' },
  { name: 'impact', label: 'Impact', type: 'select', required: true, options: IMPACT },
  { name: 'owner_name', label: 'Responsible person', type: 'text', max: 120 },
  { name: 'review_date', label: 'Review date', type: 'date' },
  { name: 'description', label: 'Description', type: 'textarea', wide: true, max: 8000 },
  { name: 'mitigation', label: 'Mitigation strategy', type: 'textarea', wide: true, max: 8000 },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export interface Risk {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  project_id: string | null;
  project_name: string | null;
  title: string;
  description: string | null;
  category: string | null;
  likelihood: number;
  impact: number;
  mitigation: string | null;
  owner_name: string | null;
  status: string;
  review_date: string | null;
  notes: string | null;
  archived_at: string | null;
  is_example: number;
  updated_at: string;
}

const SELECT = `SELECT r.*, v.name AS venture_name, v.slug AS venture_slug, p.name AS project_name
  FROM risks r LEFT JOIN ventures v ON v.id = r.venture_id LEFT JOIN projects p ON p.id = r.project_id`;

/** "High" mirrors riskBand(): score ≥ 12 or impact 5. */
export const HIGH_RISK_SQL = `(r.likelihood * r.impact >= 12 OR r.impact = 5)`;

export function listRisks(f: { ventureId?: string | null; scope?: 'parent' | null; status?: string | null; category?: string | null; q?: string | null; active?: boolean; high?: boolean; archived?: boolean } = {}): Risk[] {
  const where = [f.archived ? 'r.archived_at IS NOT NULL' : 'r.archived_at IS NULL'];
  const params: Record<string, string> = {};
  if (f.ventureId) {
    where.push('r.venture_id = :v');
    params.v = f.ventureId;
  } else if (f.scope === 'parent') where.push('r.venture_id IS NULL');
  else where.push(IN_ACTIVE_VENTURE('r'));
  if (f.status) {
    where.push('r.status = :s');
    params.s = f.status;
  }
  if (f.active) where.push(`r.status IN ('open','monitoring','occurred')`);
  if (f.high) where.push(HIGH_RISK_SQL);
  if (f.category) {
    where.push('r.category = :c');
    params.c = f.category;
  }
  if (f.q) {
    where.push(`(r.title LIKE :q ESCAPE '\\' OR r.description LIKE :q ESCAPE '\\' OR r.mitigation LIKE :q ESCAPE '\\')`);
    params.q = `%${f.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  }
  return all<Risk>(
    `${SELECT} WHERE ${where.join(' AND ')}
     ORDER BY r.status NOT IN ('open','monitoring','occurred'), r.likelihood * r.impact DESC, r.impact DESC, r.title COLLATE NOCASE`,
    params,
  );
}

export const getRisk = (id: string): Risk | undefined => get<Risk>(`${SELECT} WHERE r.id = ?`, [id]);

function reconcile(values: Values): void {
  if (values.project_id) {
    const p = get<{ venture_id: string | null }>('SELECT venture_id FROM projects WHERE id = ?', [values.project_id as string]);
    if (p && (p.venture_id ?? null) !== (values.venture_id ?? null)) throw new ValidationError({ project_id: 'That project belongs to a different venture.' });
  }
}

export function createRisk(values: Values, actor: Actor): string {
  reconcile(values);
  const id = insertRow('risk', { ...values, organization_id: getOrganization().id });
  const band = riskBand(Number(values.likelihood), Number(values.impact));
  logActivity({ actor, type: 'risk.created', entityType: 'risk', entityId: id, ventureId: values.venture_id as string | null, summary: `Risk “${values.title}” logged (${band.label.toLowerCase()} planning band)` });
  return id;
}

export function updateRisk(id: string, values: Values, actor: Actor): void {
  const before = getRisk(id);
  if (!before) throw new ValidationError({ _: 'Risk not found.' });
  reconcile(values);
  const changes = updateRow('risk', id, values);
  if (!Object.keys(changes).length) return;
  logActivity({
    actor,
    type: changes.status ? 'risk.status_changed' : 'risk.updated',
    entityType: 'risk',
    entityId: id,
    ventureId: values.venture_id as string | null,
    summary: changes.status
      ? `Risk “${values.title}”: ${labelOf(RISK_STATUSES, before.status)} → ${labelOf(RISK_STATUSES, String(values.status))}`
      : `Risk “${values.title}” updated`,
    changes,
  });
}

export function archiveRisk(id: string, archived: boolean, actor: Actor): void {
  const r = getRisk(id);
  if (r && setArchived('risk', id, archived)) {
    logActivity({ actor, type: `risk.${archived ? 'archived' : 'restored'}`, entityType: 'risk', entityId: id, ventureId: r.venture_id, summary: `Risk “${r.title}” ${archived ? 'archived' : 'restored'}` });
  }
}
