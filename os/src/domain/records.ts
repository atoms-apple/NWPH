/**
 * Shared persistence for business records: insert, update-with-history,
 * archive and restore. Every write goes through here so that every material
 * change lands in the activity history with a before/after record.
 */
import { all, get, run, assignments } from '../db/database.ts';
import { newId } from '../lib/ids.ts';
import { nowIso } from '../lib/time.ts';
import type { Actor } from '../http/context.ts';

export type EntityType =
  | 'organization'
  | 'venture'
  | 'project'
  | 'milestone'
  | 'task'
  | 'decision'
  | 'document'
  | 'opportunity'
  | 'financial_entry'
  | 'scenario'
  | 'risk'
  | 'dependency'
  | 'stage'
  | 'user';

export const ENTITY_TABLES: Record<EntityType, string> = {
  organization: 'organizations',
  venture: 'ventures',
  project: 'projects',
  milestone: 'milestones',
  task: 'tasks',
  decision: 'decisions',
  document: 'documents',
  opportunity: 'opportunities',
  financial_entry: 'financial_entries',
  scenario: 'financial_scenarios',
  risk: 'risks',
  dependency: 'dependencies',
  stage: 'development_stages',
  user: 'users',
};

export const ENTITY_LABELS: Record<EntityType, string> = {
  organization: 'Organization',
  venture: 'Venture',
  project: 'Project',
  milestone: 'Milestone',
  task: 'Task',
  decision: 'Decision',
  document: 'Document',
  opportunity: 'Opportunity',
  financial_entry: 'Financial entry',
  scenario: 'Scenario',
  risk: 'Risk',
  dependency: 'Dependency',
  stage: 'Development stage',
  user: 'User',
};

/** Columns never written to the activity history. */
const NEVER_LOGGED = new Set(['password_hash', 'csrf_token', 'token_hash', 'updated_at', 'created_at']);

export type Changes = Record<string, [unknown, unknown]>;

export interface ActivityInput {
  actor: Actor;
  type: string;
  entityType: EntityType;
  entityId: string;
  ventureId?: string | null;
  summary: string;
  changes?: Changes | null;
}

export function logActivity(e: ActivityInput): void {
  let changes: Changes | null = null;
  if (e.changes) {
    changes = {};
    for (const [k, v] of Object.entries(e.changes)) if (!NEVER_LOGGED.has(k)) changes[k] = v;
    if (!Object.keys(changes).length) changes = null;
  }
  run(
    `INSERT INTO activity_events (id, occurred_at, actor_id, actor_name, event_type, entity_type, entity_id, venture_id, summary, changes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      nowIso(),
      e.actor.id,
      e.actor.name,
      e.type,
      e.entityType,
      e.entityId,
      e.ventureId ?? null,
      e.summary.slice(0, 500),
      changes ? JSON.stringify(changes) : null,
    ],
  );
}

function normalise(v: unknown): unknown {
  if (Array.isArray(v)) return JSON.stringify(v);
  return v === undefined || v === '' ? null : v;
}

export function diff(before: Record<string, unknown>, after: Record<string, unknown>): Changes {
  const changes: Changes = {};
  for (const [k, v] of Object.entries(after)) {
    if (!(k in before)) continue;
    const a = normalise(before[k]);
    const b = normalise(v);
    if (a !== b) changes[k] = [a, b];
  }
  return changes;
}

export function findRow<T = Record<string, unknown>>(entity: EntityType, id: string): T | undefined {
  return get<T>(`SELECT * FROM ${ENTITY_TABLES[entity]} WHERE id = ?`, [id]);
}

export function insertRow(entity: EntityType, values: Record<string, unknown>): string {
  const id = (values.id as string) || newId();
  const now = nowIso();
  const row: Record<string, unknown> = { ...values, id, created_at: now, updated_at: now };
  const cols = Object.keys(row);
  run(
    `INSERT INTO ${ENTITY_TABLES[entity]} (${cols.join(', ')}) VALUES (${cols.map((c) => `:${c}`).join(', ')})`,
    row as Record<string, string | number | null>,
  );
  return id;
}

/** Update only changed columns. Returns the changes (empty if nothing changed). */
export function updateRow(entity: EntityType, id: string, values: Record<string, unknown>): Changes {
  const before = findRow(entity, id);
  if (!before) throw new Error(`${entity} ${id} not found`);
  const changes = diff(before, values);
  if (!Object.keys(changes).length) return changes;
  const set: Record<string, unknown> = {};
  for (const k of Object.keys(changes)) set[k] = values[k];
  set.updated_at = nowIso();
  run(`UPDATE ${ENTITY_TABLES[entity]} SET ${assignments(set)} WHERE id = :id`, {
    ...(set as Record<string, string | number | null>),
    id,
  });
  return changes;
}

export function setArchived(entity: EntityType, id: string, archived: boolean): boolean {
  const result = run(
    `UPDATE ${ENTITY_TABLES[entity]} SET archived_at = ?, updated_at = ? WHERE id = ? AND (archived_at IS ${archived ? '' : 'NOT'} NULL)`,
    [archived ? nowIso() : null, nowIso(), id],
  );
  return Number(result.changes) > 0;
}

/** Human-readable field names for activity history display. */
export function humanise(column: string): string {
  return column
    .replace(/_minor$/, '')
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

export interface ActivityRow {
  id: string;
  occurred_at: string;
  actor_name: string | null;
  event_type: string;
  entity_type: EntityType;
  entity_id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  summary: string;
  changes: string | null;
}

export function listActivity(filter: {
  ventureId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  limit?: number;
  offset?: number;
}): ActivityRow[] {
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (filter.ventureId) {
    where.push('a.venture_id = :venture');
    params.venture = filter.ventureId;
  }
  if (filter.entityType) {
    where.push('a.entity_type = :etype');
    params.etype = filter.entityType;
  }
  if (filter.entityId) {
    where.push('a.entity_id = :eid');
    params.eid = filter.entityId;
  }
  params.limit = filter.limit ?? 50;
  params.offset = filter.offset ?? 0;
  return all<ActivityRow>(
    `SELECT a.*, v.name AS venture_name, v.slug AS venture_slug
       FROM activity_events a LEFT JOIN ventures v ON v.id = a.venture_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY a.occurred_at DESC, a.rowid DESC
      LIMIT :limit OFFSET :offset`,
    params,
  );
}
