import { all, get, run, tx } from '../db/database.ts';
import { newId, slugify } from '../lib/ids.ts';
import { nowIso, today } from '../lib/time.ts';
import type { Actor } from '../http/context.ts';
import { type Field, type Values, ValidationError } from './fields.ts';
import { LEGAL_STATUSES, OPERATIONAL_STATUSES, VENTURE_CATEGORIES, labelOf } from './vocabulary.ts';
import { getOrganization } from './organization.ts';
import { listStages, getStage } from './stages.ts';
import { insertRow, logActivity, updateRow, setArchived, findRow } from './records.ts';

export interface Venture {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  category: string | null;
  stage_id: string;
  stage_name: string;
  stage_position: number;
  legal_status: string;
  legal_status_detail: string | null;
  operational_status: string;
  parent_relationship: string | null;
  ownership_notes: string | null;
  locations: string | null;
  mission: string | null;
  objectives: string | null;
  target_customers: string | null;
  products_services: string | null;
  value_proposition: string | null;
  market_research: string | null;
  business_model: string | null;
  startup_requirements: string | null;
  capital_requirements_notes: string | null;
  funding_sources_notes: string | null;
  operating_cost_assumptions: string | null;
  revenue_assumptions: string | null;
  dependencies_notes: string | null;
  next_actions: string | null;
  internal_notes: string | null;
  provisional_fields: string;
  is_example: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VentureListItem extends Venture {
  project_count: number;
  open_task_count: number;
  next_milestone_title: string | null;
  next_milestone_due: string | null;
}

// ── Field definitions ────────────────────────────────────────────────────────

export const VENTURE_BASIC_FIELDS: Field[] = [
  { name: 'name', label: 'Venture name', type: 'text', required: true, max: 120 },
  { name: 'category', label: 'Business category', type: 'select', options: VENTURE_CATEGORIES, freeform: true, emptyLabel: 'Not set' },
  { name: 'short_description', label: 'Short description', type: 'text', max: 280, wide: true, help: 'One or two sentences. Shown on portfolio cards.' },
  { name: 'description', label: 'Venture description', type: 'textarea', max: 8000, wide: true },
  { name: 'locations', label: 'Proposed operating locations', type: 'textarea', max: 2000, rows: 2, wide: true },
  { name: 'parent_relationship', label: 'Relationship to NWPH', type: 'textarea', max: 2000, rows: 2, wide: true, help: 'For example: proposed wholly-owned subsidiary, joint venture, minority investment. Describe what is true today.' },
  { name: 'ownership_notes', label: 'Ownership notes', type: 'textarea', max: 4000, rows: 3, wide: true },
];

/** Status fields are separate from stage on purpose; see migrations/001_initial.sql. */
export const VENTURE_STATUS_FIELDS: Field[] = [
  { name: 'operational_status', label: 'Operational status', type: 'select', required: true, options: OPERATIONAL_STATUSES, help: 'Whether the venture is actually trading. Independent of development stage.' },
  { name: 'legal_status', label: 'Legal and organizational status', type: 'select', required: true, options: LEGAL_STATUSES, help: 'Never changed automatically. Record only what is true.' },
  { name: 'legal_status_detail', label: 'Legal status detail / evidence', type: 'textarea', max: 2000, rows: 2, wide: true },
];

export interface PlanGroup {
  key: string;
  title: string;
  purpose: string;
  fields: Field[];
}

const ta = (name: string, label: string, help?: string): Field => ({ name, label, type: 'textarea', max: 20_000, wide: true, help });

export const PLAN_GROUPS: PlanGroup[] = [
  {
    key: 'concept',
    title: 'Concept',
    purpose: 'What the venture is for and what it offers.',
    fields: [
      ta('mission', 'Mission'),
      ta('objectives', 'Objectives', 'What the venture must achieve, ideally measurable.'),
      ta('products_services', 'Products and services'),
      ta('value_proposition', 'Value proposition', 'Why customers or communities would choose this over the alternatives.'),
    ],
  },
  {
    key: 'market',
    title: 'Market',
    purpose: 'Who the venture serves and what is known about them.',
    fields: [
      ta('target_customers', 'Target customers or communities'),
      ta('market_research', 'Market research summary', 'Summarise findings and cite sources. Attach source material under Research or Documents.'),
    ],
  },
  {
    key: 'model',
    title: 'Business model and requirements',
    purpose: 'How the venture would work and what it would take to start.',
    fields: [
      ta('business_model', 'Business model', 'How the venture creates value and earns revenue.'),
      ta('startup_requirements', 'Startup requirements', 'Licences, equipment, people, facilities and partners needed before starting.'),
      ta('capital_requirements_notes', 'Initial capital requirements (narrative)', 'Explain the figures. Amounts themselves belong in Financial Planning so they can be summed and traced.'),
    ],
  },
  {
    key: 'assumptions',
    title: 'Financial assumptions',
    purpose: 'The reasoning behind the numbers in Financial Planning.',
    fields: [
      ta('operating_cost_assumptions', 'Operating cost assumptions'),
      ta('revenue_assumptions', 'Revenue assumptions'),
      ta('funding_sources_notes', 'Potential funding sources (narrative)', 'Potential sources only. Track specific opportunities under Funding and Opportunities.'),
    ],
  },
  {
    key: 'execution',
    title: 'Execution',
    purpose: 'What stands in the way and what happens next.',
    fields: [
      ta('dependencies_notes', 'Dependencies (narrative)', 'Specific dependencies between projects, approvals and suppliers are tracked under Risks and Dependencies.'),
      ta('next_actions', 'Next actions', 'Concrete tasks belong in Projects and Tasks; this is the headline summary.'),
      ta('internal_notes', 'Internal notes'),
    ],
  },
];

/** Fields that may carry a "provisional" marker. */
export const PROVISIONABLE = new Set<string>([
  'short_description',
  'description',
  'category',
  'locations',
  'parent_relationship',
  'ownership_notes',
  ...PLAN_GROUPS.flatMap((g) => g.fields.map((f) => f.name)),
]);

export const ALL_PROFILE_FIELDS: Field[] = [...VENTURE_BASIC_FIELDS, ...VENTURE_STATUS_FIELDS, ...PLAN_GROUPS.flatMap((g) => g.fields)];

export function fieldLabel(name: string): string {
  return ALL_PROFILE_FIELDS.find((f) => f.name === name)?.label ?? name;
}

export const provisionalOf = (v: Pick<Venture, 'provisional_fields'>): Set<string> => {
  try {
    const arr = JSON.parse(v.provisional_fields) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
};

// ── Queries ──────────────────────────────────────────────────────────────────

const BASE_SELECT = `
  SELECT v.*, s.name AS stage_name, s.position AS stage_position
    FROM ventures v JOIN development_stages s ON s.id = v.stage_id`;

export const getVentureBySlug = (slug: string): Venture | undefined =>
  get<Venture>(`${BASE_SELECT} WHERE v.slug = ?`, [slug]);

export const getVenture = (id: string): Venture | undefined => get<Venture>(`${BASE_SELECT} WHERE v.id = ?`, [id]);

export interface VentureFilter {
  q?: string;
  stageId?: string;
  category?: string;
  status?: string;
  archived?: boolean;
  sort?: 'name' | 'created' | 'updated' | 'stage';
}

export function listVentures(filter: VentureFilter = {}): VentureListItem[] {
  const where: string[] = [filter.archived ? 'v.archived_at IS NOT NULL' : 'v.archived_at IS NULL'];
  const params: Record<string, string> = { today: today() };
  if (filter.q) {
    where.push(`(v.name LIKE :q ESCAPE '\\' OR v.short_description LIKE :q ESCAPE '\\' OR v.description LIKE :q ESCAPE '\\' OR v.category LIKE :q ESCAPE '\\')`);
    params.q = `%${filter.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  }
  if (filter.stageId) {
    where.push('v.stage_id = :stage');
    params.stage = filter.stageId;
  }
  if (filter.category) {
    where.push('v.category = :category');
    params.category = filter.category;
  }
  if (filter.status) {
    where.push('v.operational_status = :status');
    params.status = filter.status;
  }
  const order = {
    name: 'v.name COLLATE NOCASE ASC',
    created: 'v.created_at DESC',
    updated: 'v.updated_at DESC',
    stage: 's.position ASC, v.name COLLATE NOCASE',
  }[filter.sort ?? 'name'];
  return all<VentureListItem>(
    `SELECT v.*, s.name AS stage_name, s.position AS stage_position,
       (SELECT count(*) FROM projects p WHERE p.venture_id = v.id AND p.archived_at IS NULL
          AND p.status NOT IN ('completed','cancelled')) AS project_count,
       (SELECT count(*) FROM tasks t WHERE t.venture_id = v.id AND t.archived_at IS NULL
          AND t.status NOT IN ('completed','cancelled')) AS open_task_count,
       (SELECT m.title FROM milestones m WHERE m.venture_id = v.id AND m.archived_at IS NULL
          AND m.status NOT IN ('completed','cancelled')
          ORDER BY m.due_date IS NULL, m.due_date LIMIT 1) AS next_milestone_title,
       (SELECT m.due_date FROM milestones m WHERE m.venture_id = v.id AND m.archived_at IS NULL
          AND m.status NOT IN ('completed','cancelled')
          ORDER BY m.due_date IS NULL, m.due_date LIMIT 1) AS next_milestone_due
       FROM ventures v JOIN development_stages s ON s.id = v.stage_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}`,
    params,
  );
}

export const listCategoriesInUse = (): string[] =>
  all<{ category: string }>(
    `SELECT DISTINCT category FROM ventures WHERE category IS NOT NULL AND archived_at IS NULL ORDER BY category`,
  ).map((r) => r.category);

/** Options for "venture" selects. Archived ventures are excluded unless currently selected. */
export function ventureOptions(includeId?: string | null): { value: string; label: string }[] {
  return all<{ id: string; name: string; archived_at: string | null }>(
    `SELECT id, name, archived_at FROM ventures WHERE archived_at IS NULL OR id = ? ORDER BY name COLLATE NOCASE`,
    [includeId ?? ''],
  ).map((v) => ({ value: v.id, label: v.archived_at ? `${v.name} (archived)` : v.name }));
}

// ── Commands ─────────────────────────────────────────────────────────────────

function uniqueSlug(name: string): string {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; get('SELECT 1 FROM ventures WHERE slug = ?', [slug]); i++) slug = `${base}-${i}`;
  return slug;
}

function checkNameUnique(name: string, exceptId = ''): void {
  if (get('SELECT 1 FROM ventures WHERE name = ? COLLATE NOCASE AND id <> ?', [name, exceptId])) {
    throw new ValidationError({ name: 'A venture with this name already exists (possibly archived).' });
  }
}

export function createVenture(values: Values, stageId: string | null, actor: Actor, createdBy: string | null): Venture {
  const org = getOrganization();
  const name = String(values.name);
  checkNameUnique(name);
  const stage = stageId ? getStage(stageId) : listStages()[0];
  if (!stage || stage.archived_at) throw new ValidationError({ stage_id: 'Choose an active development stage.' });
  return tx(() => {
    const id = insertRow('venture', {
      ...values,
      organization_id: org.id,
      slug: uniqueSlug(name),
      stage_id: stage.id,
      legal_status: values.legal_status ?? 'not_established',
      operational_status: values.operational_status ?? 'proposed',
      created_by: createdBy,
    });
    run(
      `INSERT INTO venture_stage_changes (id, venture_id, from_stage_id, to_stage_id, note, changed_by, changed_at)
       VALUES (?, ?, NULL, ?, 'Initial stage', ?, ?)`,
      [newId(), id, stage.id, createdBy, nowIso()],
    );
    logActivity({ actor, type: 'venture.created', entityType: 'venture', entityId: id, ventureId: id, summary: `Venture “${name}” created at stage ${stage.name}` });
    return getVenture(id)!;
  });
}

/**
 * Update profile fields. `provisional`, when given, replaces the provisional
 * markers for exactly the fields in `values` (fields not in this form keep
 * their markers).
 */
export function updateVenture(id: string, values: Values, provisional: Set<string> | null, actor: Actor): void {
  const venture = getVenture(id);
  if (!venture) throw new ValidationError({ _: 'Venture not found.' });
  if (typeof values.name === 'string') checkNameUnique(values.name, id);
  const update: Record<string, unknown> = { ...values };
  if (provisional) {
    const markers = provisionalOf(venture);
    for (const name of Object.keys(values)) {
      if (!PROVISIONABLE.has(name)) continue;
      if (provisional.has(name)) markers.add(name);
      else markers.delete(name);
    }
    update.provisional_fields = JSON.stringify([...markers].sort());
  }
  tx(() => {
    const changes = updateRow('venture', id, update);
    if (!Object.keys(changes).length) return;
    const statusChanges = ['legal_status', 'operational_status'].filter((k) => k in changes);
    const fieldNames = Object.keys(changes)
      .filter((k) => k !== 'provisional_fields')
      .map(fieldLabel);
    let summary = `${venture.name}: ${fieldNames.length ? 'updated ' + fieldNames.slice(0, 4).join(', ') + (fieldNames.length > 4 ? ` and ${fieldNames.length - 4} more` : '') : 'provisional markers updated'}`;
    if (statusChanges.includes('legal_status')) {
      summary = `${venture.name}: legal status changed from ${labelOf(LEGAL_STATUSES, venture.legal_status)} to ${labelOf(LEGAL_STATUSES, String(values.legal_status))}`;
    } else if (statusChanges.includes('operational_status')) {
      summary = `${venture.name}: operational status changed from ${labelOf(OPERATIONAL_STATUSES, venture.operational_status)} to ${labelOf(OPERATIONAL_STATUSES, String(values.operational_status))}`;
    }
    logActivity({
      actor,
      type: statusChanges.length ? 'venture.status_changed' : 'venture.updated',
      entityType: 'venture',
      entityId: id,
      ventureId: id,
      summary,
      changes,
    });
  });
}

/** Move to another development stage. Deliberately touches nothing else. */
export function changeStage(id: string, stageId: string, note: string, actor: Actor): void {
  const venture = getVenture(id);
  const stage = getStage(stageId);
  if (!venture) throw new ValidationError({ _: 'Venture not found.' });
  if (!stage || stage.archived_at) throw new ValidationError({ stage_id: 'Choose an active development stage.' });
  if (stage.id === venture.stage_id) return;
  if (note.length > 1000) throw new ValidationError({ note: 'Note must be 1,000 characters or fewer.' });
  tx(() => {
    run('UPDATE ventures SET stage_id = ?, updated_at = ? WHERE id = ?', [stage.id, nowIso(), id]);
    run(
      `INSERT INTO venture_stage_changes (id, venture_id, from_stage_id, to_stage_id, note, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), id, venture.stage_id, stage.id, note.trim() || null, actor.id, nowIso()],
    );
    logActivity({
      actor,
      type: 'venture.stage_changed',
      entityType: 'venture',
      entityId: id,
      ventureId: id,
      summary: `${venture.name} moved from ${venture.stage_name} to ${stage.name}${note.trim() ? ` — ${note.trim().slice(0, 200)}` : ''}`,
      changes: { stage: [venture.stage_name, stage.name] },
    });
  });
}

export interface StageChange {
  from_name: string | null;
  to_name: string;
  note: string | null;
  changed_at: string;
  changed_by_name: string | null;
}

export const stageHistory = (ventureId: string): StageChange[] =>
  all<StageChange>(
    `SELECT f.name AS from_name, t.name AS to_name, c.note, c.changed_at, u.display_name AS changed_by_name
       FROM venture_stage_changes c
       LEFT JOIN development_stages f ON f.id = c.from_stage_id
       JOIN development_stages t ON t.id = c.to_stage_id
       LEFT JOIN users u ON u.id = c.changed_by
      WHERE c.venture_id = ? ORDER BY c.changed_at DESC`,
    [ventureId],
  );

/**
 * Archive hides the venture from the portfolio and from dashboard metrics. Its
 * records are untouched and remain reachable from its workspace, so restoring
 * it brings everything back exactly as it was.
 */
export function archiveVenture(id: string, actor: Actor): void {
  const v = findRow<{ name: string }>('venture', id);
  if (v && setArchived('venture', id, true)) {
    logActivity({ actor, type: 'venture.archived', entityType: 'venture', entityId: id, ventureId: id, summary: `Venture “${v.name}” archived` });
  }
}

export function restoreVenture(id: string, actor: Actor): void {
  const v = findRow<{ name: string }>('venture', id);
  if (v && setArchived('venture', id, false)) {
    logActivity({ actor, type: 'venture.restored', entityType: 'venture', entityId: id, ventureId: id, summary: `Venture “${v.name}” restored` });
  }
}

/** SQL predicate: record is parent-level or belongs to a non-archived venture. */
export const IN_ACTIVE_VENTURE = (alias: string): string =>
  `(${alias}.venture_id IS NULL OR ${alias}.venture_id IN (SELECT id FROM ventures WHERE archived_at IS NULL))`;
