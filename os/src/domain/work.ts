/**
 * Projects, milestones, tasks and the dependencies between them.
 *
 * Relationship rule: a record's venture is derived from its project when it
 * has one, so a task can never claim to belong to Polar Express while sitting
 * in another venture's project. venture_id NULL means parent-organization work.
 */
import { all, get, tx } from '../db/database.ts';
import { today } from '../lib/time.ts';
import type { Actor } from '../http/context.ts';
import { type Field, type Values, ValidationError } from './fields.ts';
import {
  PROJECT_STATUSES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  MILESTONE_STATUSES,
  DEPENDENCY_EXTERNAL,
  labelOf,
} from './vocabulary.ts';
import { getOrganization } from './organization.ts';
import { insertRow, logActivity, updateRow, setArchived, findRow, type EntityType } from './records.ts';
import { IN_ACTIVE_VENTURE } from './ventures.ts';

const PARENT_LABEL = 'NWPH (parent organization)';

// ── Fields ───────────────────────────────────────────────────────────────────

export const PROJECT_FIELDS: Field[] = [
  { name: 'name', label: 'Project name', type: 'text', required: true, max: 160 },
  { name: 'venture_id', label: 'Venture', type: 'ref', ref: 'venture', emptyLabel: PARENT_LABEL },
  { name: 'status', label: 'Status', type: 'select', required: true, options: PROJECT_STATUSES },
  { name: 'owner_name', label: 'Responsible person', type: 'text', max: 120 },
  { name: 'start_date', label: 'Start date', type: 'date' },
  { name: 'target_date', label: 'Target date', type: 'date' },
  { name: 'description', label: 'Description', type: 'textarea', wide: true, max: 8000 },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const MILESTONE_FIELDS: Field[] = [
  { name: 'title', label: 'Milestone', type: 'text', required: true, max: 200 },
  { name: 'venture_id', label: 'Venture', type: 'ref', ref: 'venture', emptyLabel: PARENT_LABEL },
  { name: 'project_id', label: 'Project', type: 'ref', ref: 'project', emptyLabel: 'No project' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: MILESTONE_STATUSES },
  { name: 'due_date', label: 'Target date', type: 'date' },
  { name: 'description', label: 'Description', type: 'textarea', wide: true, max: 8000, help: 'Completing a milestone records progress only. It does not change legal or operational status.' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export const TASK_FIELDS: Field[] = [
  { name: 'title', label: 'Task', type: 'text', required: true, max: 200 },
  { name: 'venture_id', label: 'Venture', type: 'ref', ref: 'venture', emptyLabel: PARENT_LABEL },
  { name: 'project_id', label: 'Project', type: 'ref', ref: 'project', emptyLabel: 'No project' },
  { name: 'milestone_id', label: 'Milestone', type: 'ref', ref: 'milestone', emptyLabel: 'No milestone' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: TASK_STATUSES },
  { name: 'priority', label: 'Priority', type: 'select', required: true, options: TASK_PRIORITIES },
  { name: 'assignee_name', label: 'Assigned to', type: 'text', max: 120 },
  { name: 'start_date', label: 'Start date', type: 'date' },
  { name: 'due_date', label: 'Due date', type: 'date' },
  { name: 'description', label: 'Description', type: 'textarea', wide: true, max: 8000 },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  name: string;
  description: string | null;
  status: string;
  owner_name: string | null;
  start_date: string | null;
  target_date: string | null;
  completed_on: string | null;
  notes: string | null;
  archived_at: string | null;
  is_example: number;
  updated_at: string;
  task_total: number;
  task_open: number;
  task_overdue: number;
  milestone_open: number;
}

export interface Milestone {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  project_id: string | null;
  project_name: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  completed_on: string | null;
  notes: string | null;
  archived_at: string | null;
  is_example: number;
  task_total: number;
  task_done: number;
}

export interface Task {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  project_id: string | null;
  project_name: string | null;
  milestone_id: string | null;
  milestone_title: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_name: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_on: string | null;
  notes: string | null;
  archived_at: string | null;
  is_example: number;
  updated_at: string;
  open_dependencies: number;
}

// ── Shared helpers ───────────────────────────────────────────────────────────

const OPEN_TASK = `t.status NOT IN ('completed','cancelled')`;

/** Derive venture from project/milestone and reject contradictory links. */
function reconcileLinks(values: Values): void {
  const errors: Record<string, string> = {};
  const projectId = values.project_id as string | null | undefined;
  const milestoneId = values.milestone_id as string | null | undefined;
  if (projectId) {
    const p = get<{ venture_id: string | null }>('SELECT venture_id FROM projects WHERE id = ?', [projectId]);
    if (p) {
      if (values.venture_id && values.venture_id !== p.venture_id) {
        errors.project_id = 'That project belongs to a different venture.';
      }
      values.venture_id = p.venture_id;
    }
  }
  if (milestoneId) {
    const m = get<{ venture_id: string | null; project_id: string | null }>('SELECT venture_id, project_id FROM milestones WHERE id = ?', [milestoneId]);
    if (m) {
      if ((m.venture_id ?? null) !== (values.venture_id ?? null)) errors.milestone_id = 'That milestone belongs to a different venture.';
      else if (projectId && m.project_id && m.project_id !== projectId) errors.milestone_id = 'That milestone belongs to a different project.';
    }
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

function checkDates(values: Values, start: string, end: string, endLabel: string): void {
  const a = values[start];
  const b = values[end];
  if (typeof a === 'string' && typeof b === 'string' && b < a) {
    throw new ValidationError({ [end]: `${endLabel} cannot be before the start date.` });
  }
}

/** Keep completed_on in step with status (the schema enforces the pairing). */
function completionFor(status: unknown, existing: string | null | undefined): string | null {
  return status === 'completed' ? existing || today() : null;
}

function ventureIdOf(entity: EntityType, id: string): string | null {
  return findRow<{ venture_id: string | null }>(entity, id)?.venture_id ?? null;
}

// ── Projects ─────────────────────────────────────────────────────────────────

export interface WorkFilter {
  ventureId?: string | null;
  /** 'parent' = parent-organization records only. */
  scope?: 'parent' | null;
  projectId?: string | null;
  milestoneId?: string | null;
  status?: string | null;
  priority?: string | null;
  q?: string | null;
  overdue?: boolean;
  blocked?: boolean;
  open?: boolean;
  archived?: boolean;
}

function likeParam(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
}

export function listProjects(filter: WorkFilter = {}): Project[] {
  const where = [filter.archived ? 'p.archived_at IS NOT NULL' : 'p.archived_at IS NULL'];
  const params: Record<string, string> = { today: today() };
  if (filter.ventureId) {
    where.push('p.venture_id = :venture');
    params.venture = filter.ventureId;
  } else if (filter.scope === 'parent') where.push('p.venture_id IS NULL');
  else where.push(IN_ACTIVE_VENTURE('p'));
  if (filter.status) {
    where.push('p.status = :status');
    params.status = filter.status;
  }
  if (filter.open) where.push(`p.status NOT IN ('completed','cancelled')`);
  if (filter.q) {
    where.push(`(p.name LIKE :q ESCAPE '\\' OR p.description LIKE :q ESCAPE '\\')`);
    params.q = likeParam(filter.q);
  }
  return all<Project>(
    `SELECT p.*, v.name AS venture_name, v.slug AS venture_slug,
       (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.archived_at IS NULL) AS task_total,
       (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.archived_at IS NULL AND ${OPEN_TASK}) AS task_open,
       (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.archived_at IS NULL AND ${OPEN_TASK}
          AND t.due_date < :today) AS task_overdue,
       (SELECT count(*) FROM milestones m WHERE m.project_id = p.id AND m.archived_at IS NULL
          AND m.status NOT IN ('completed','cancelled')) AS milestone_open
       FROM projects p LEFT JOIN ventures v ON v.id = p.venture_id
      WHERE ${where.join(' AND ')}
      ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END,
               p.target_date IS NULL, p.target_date, p.name COLLATE NOCASE`,
    params,
  );
}

export const getProject = (id: string): Project | undefined =>
  get<Project>(
    `SELECT p.*, v.name AS venture_name, v.slug AS venture_slug, 0 AS task_total, 0 AS task_open, 0 AS task_overdue, 0 AS milestone_open
       FROM projects p LEFT JOIN ventures v ON v.id = p.venture_id WHERE p.id = ?`,
    [id],
  );

export function createProject(values: Values, actor: Actor): string {
  checkDates(values, 'start_date', 'target_date', 'Target date');
  const id = insertRow('project', {
    ...values,
    organization_id: getOrganization().id,
    completed_on: completionFor(values.status, null),
  });
  logActivity({ actor, type: 'project.created', entityType: 'project', entityId: id, ventureId: values.venture_id as string | null, summary: `Project “${values.name}” created` });
  return id;
}

export function updateProject(id: string, values: Values, actor: Actor): void {
  const before = getProject(id);
  if (!before) throw new ValidationError({ _: 'Project not found.' });
  checkDates(values, 'start_date', 'target_date', 'Target date');
  tx(() => {
    // Moving a project to another venture moves its tasks and milestones with it.
    if (values.venture_id !== before.venture_id) {
      for (const table of ['tasks', 'milestones'] as const) {
        const rows = all<{ id: string }>(`SELECT id FROM ${table} WHERE project_id = ?`, [id]);
        for (const r of rows) updateRow(table === 'tasks' ? 'task' : 'milestone', r.id, { venture_id: values.venture_id });
      }
    }
    const changes = updateRow('project', id, { ...values, completed_on: completionFor(values.status, before.completed_on) });
    if (!Object.keys(changes).length) return;
    const statusChanged = 'status' in changes;
    logActivity({
      actor,
      type: statusChanged ? 'project.status_changed' : 'project.updated',
      entityType: 'project',
      entityId: id,
      ventureId: values.venture_id as string | null,
      summary: statusChanged
        ? `Project “${values.name}” status changed to ${labelOf(PROJECT_STATUSES, String(values.status))}`
        : `Project “${values.name}” updated`,
      changes,
    });
  });
}

// ── Milestones ───────────────────────────────────────────────────────────────

const MILESTONE_SELECT = `
  SELECT m.*, v.name AS venture_name, v.slug AS venture_slug, p.name AS project_name,
    (SELECT count(*) FROM tasks t WHERE t.milestone_id = m.id AND t.archived_at IS NULL AND t.status <> 'cancelled') AS task_total,
    (SELECT count(*) FROM tasks t WHERE t.milestone_id = m.id AND t.archived_at IS NULL AND t.status = 'completed') AS task_done
    FROM milestones m
    LEFT JOIN ventures v ON v.id = m.venture_id
    LEFT JOIN projects p ON p.id = m.project_id`;

export function listMilestones(filter: WorkFilter & { upcomingDays?: number } = {}): Milestone[] {
  const where = [filter.archived ? 'm.archived_at IS NOT NULL' : 'm.archived_at IS NULL'];
  const params: Record<string, string> = {};
  if (filter.ventureId) {
    where.push('m.venture_id = :venture');
    params.venture = filter.ventureId;
  } else if (filter.scope === 'parent') where.push('m.venture_id IS NULL');
  else where.push(IN_ACTIVE_VENTURE('m'));
  if (filter.projectId) {
    where.push('m.project_id = :project');
    params.project = filter.projectId;
  }
  if (filter.status) {
    where.push('m.status = :status');
    params.status = filter.status;
  }
  if (filter.open) where.push(`m.status NOT IN ('completed','cancelled')`);
  return all<Milestone>(
    `${MILESTONE_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY m.status IN ('completed','cancelled'), m.due_date IS NULL, m.due_date, m.title COLLATE NOCASE`,
    params,
  );
}

export const getMilestone = (id: string): Milestone | undefined => get<Milestone>(`${MILESTONE_SELECT} WHERE m.id = ?`, [id]);

export function createMilestone(values: Values, actor: Actor): string {
  reconcileLinks(values);
  const id = insertRow('milestone', {
    ...values,
    organization_id: getOrganization().id,
    completed_on: completionFor(values.status, null),
  });
  logActivity({ actor, type: 'milestone.created', entityType: 'milestone', entityId: id, ventureId: values.venture_id as string | null, summary: `Milestone “${values.title}” added` });
  return id;
}

export function updateMilestone(id: string, values: Values, actor: Actor): void {
  const before = getMilestone(id);
  if (!before) throw new ValidationError({ _: 'Milestone not found.' });
  reconcileLinks(values);
  const changes = updateRow('milestone', id, { ...values, completed_on: completionFor(values.status, before.completed_on) });
  if (!Object.keys(changes).length) return;
  const completed = changes.status && values.status === 'completed';
  logActivity({
    actor,
    type: completed ? 'milestone.completed' : changes.status ? 'milestone.status_changed' : 'milestone.updated',
    entityType: 'milestone',
    entityId: id,
    ventureId: values.venture_id as string | null,
    summary: completed
      ? `Milestone “${values.title}” completed`
      : changes.status
        ? `Milestone “${values.title}” status changed to ${labelOf(MILESTONE_STATUSES, String(values.status))}`
        : `Milestone “${values.title}” updated`,
    changes,
  });
}

export function setMilestoneStatus(id: string, status: string, actor: Actor): void {
  const m = getMilestone(id);
  if (!m) throw new ValidationError({ _: 'Milestone not found.' });
  if (!MILESTONE_STATUSES.some((s) => s.value === status)) throw new ValidationError({ status: 'Invalid status.' });
  updateMilestone(
    id,
    { title: m.title, venture_id: m.venture_id, project_id: m.project_id, status, due_date: m.due_date, description: m.description, notes: m.notes },
    actor,
  );
}

// ── Tasks ────────────────────────────────────────────────────────────────────

/** Open dependency = still open AND its prerequisite record is not yet satisfied. */
const PREREQ_MET = `
  CASE
    WHEN d.on_task_id IS NOT NULL THEN (SELECT status = 'completed' FROM tasks WHERE id = d.on_task_id)
    WHEN d.on_milestone_id IS NOT NULL THEN (SELECT status = 'completed' FROM milestones WHERE id = d.on_milestone_id)
    WHEN d.on_project_id IS NOT NULL THEN (SELECT status = 'completed' FROM projects WHERE id = d.on_project_id)
    WHEN d.on_decision_id IS NOT NULL THEN (SELECT status = 'approved' FROM decisions WHERE id = d.on_decision_id)
    WHEN d.on_opportunity_id IS NOT NULL THEN (SELECT status = 'awarded' FROM opportunities WHERE id = d.on_opportunity_id)
    ELSE 0
  END`;

const TASK_SELECT = `
  SELECT t.*, v.name AS venture_name, v.slug AS venture_slug, p.name AS project_name, m.title AS milestone_title,
    (SELECT count(*) FROM dependencies d WHERE d.blocked_task_id = t.id AND d.status = 'open' AND NOT (${PREREQ_MET})) AS open_dependencies
    FROM tasks t
    LEFT JOIN ventures v ON v.id = t.venture_id
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN milestones m ON m.id = t.milestone_id`;

export function listTasks(filter: WorkFilter = {}): Task[] {
  const where = [filter.archived ? 't.archived_at IS NOT NULL' : 't.archived_at IS NULL'];
  const params: Record<string, string> = { today: today() };
  if (filter.ventureId) {
    where.push('t.venture_id = :venture');
    params.venture = filter.ventureId;
  } else if (filter.scope === 'parent') where.push('t.venture_id IS NULL');
  else where.push(IN_ACTIVE_VENTURE('t'));
  if (filter.projectId) {
    where.push('t.project_id = :project');
    params.project = filter.projectId;
  }
  if (filter.milestoneId) {
    where.push('t.milestone_id = :milestone');
    params.milestone = filter.milestoneId;
  }
  if (filter.status) {
    where.push('t.status = :status');
    params.status = filter.status;
  }
  if (filter.priority) {
    where.push('t.priority = :priority');
    params.priority = filter.priority;
  }
  if (filter.open) where.push(OPEN_TASK);
  if (filter.overdue) where.push(`${OPEN_TASK} AND t.due_date < :today`);
  if (filter.blocked) where.push(`${OPEN_TASK} AND (t.status = 'blocked' OR open_dependencies > 0)`);
  if (filter.q) {
    where.push(`(t.title LIKE :q ESCAPE '\\' OR t.description LIKE :q ESCAPE '\\' OR t.notes LIKE :q ESCAPE '\\' OR t.assignee_name LIKE :q ESCAPE '\\')`);
    params.q = likeParam(filter.q);
  }
  // open_dependencies is a select alias; wrap so WHERE can use it.
  return all<Task>(
    `SELECT * FROM (${TASK_SELECT}) t WHERE ${where.join(' AND ')}
     ORDER BY t.status IN ('completed','cancelled'),
              CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
              t.due_date IS NULL, t.due_date, t.title COLLATE NOCASE`,
    params,
  );
}

export const getTask = (id: string): Task | undefined => get<Task>(`${TASK_SELECT} WHERE t.id = ?`, [id]);

export const isOverdue = (r: { due_date: string | null; status: string }): boolean =>
  Boolean(r.due_date && r.due_date < today() && !['completed', 'cancelled'].includes(r.status));

export function createTask(values: Values, actor: Actor): string {
  reconcileLinks(values);
  checkDates(values, 'start_date', 'due_date', 'Due date');
  const id = insertRow('task', {
    ...values,
    organization_id: getOrganization().id,
    completed_on: completionFor(values.status, null),
  });
  logActivity({ actor, type: 'task.created', entityType: 'task', entityId: id, ventureId: values.venture_id as string | null, summary: `Task “${values.title}” created` });
  return id;
}

export function updateTask(id: string, values: Values, actor: Actor): void {
  const before = getTask(id);
  if (!before) throw new ValidationError({ _: 'Task not found.' });
  reconcileLinks(values);
  checkDates(values, 'start_date', 'due_date', 'Due date');
  const changes = updateRow('task', id, { ...values, completed_on: completionFor(values.status, before.completed_on) });
  if (!Object.keys(changes).length) return;
  logActivity({
    actor,
    type: changes.status ? (values.status === 'completed' ? 'task.completed' : 'task.status_changed') : 'task.updated',
    entityType: 'task',
    entityId: id,
    ventureId: values.venture_id as string | null,
    summary: changes.status
      ? `Task “${values.title}” → ${labelOf(TASK_STATUSES, String(values.status))}`
      : `Task “${values.title}” updated`,
    changes,
  });
}

export function setTaskStatus(id: string, status: string, actor: Actor): void {
  const t = findRow<Record<string, string | null>>('task', id);
  if (!t) throw new ValidationError({ _: 'Task not found.' });
  if (!TASK_STATUSES.some((s) => s.value === status)) throw new ValidationError({ status: 'Invalid status.' });
  const values: Values = {};
  for (const f of TASK_FIELDS) values[f.name] = t[f.name] ?? null;
  values.status = status;
  updateTask(id, values, actor);
}

// ── Archive / restore (projects, milestones, tasks) ─────────────────────────

export function archiveWork(entity: 'project' | 'milestone' | 'task', id: string, archived: boolean, actor: Actor): void {
  const row = findRow<{ name?: string; title?: string; venture_id: string | null }>(entity, id);
  if (!row) return;
  if (setArchived(entity, id, archived)) {
    const label = row.name ?? row.title;
    logActivity({
      actor,
      type: `${entity}.${archived ? 'archived' : 'restored'}`,
      entityType: entity,
      entityId: id,
      ventureId: row.venture_id,
      summary: `${entity[0]!.toUpperCase()}${entity.slice(1)} “${label}” ${archived ? 'archived' : 'restored'}`,
    });
  }
}

// ── Dependencies ─────────────────────────────────────────────────────────────

export type BlockedKind = 'project' | 'milestone' | 'task';
export type PrereqKind = 'project' | 'milestone' | 'task' | 'decision' | 'opportunity' | 'external';

export interface Dependency {
  id: string;
  venture_id: string | null;
  blocked_kind: BlockedKind;
  blocked_id: string;
  blocked_label: string;
  prereq_kind: PrereqKind;
  prereq_id: string | null;
  prereq_label: string;
  external_type: string | null;
  description: string | null;
  status: 'open' | 'resolved';
  resolved_on: string | null;
  notes: string | null;
  prerequisite_met: number;
}

const DEP_SELECT = `
  SELECT d.*,
    CASE WHEN d.blocked_task_id IS NOT NULL THEN 'task' WHEN d.blocked_milestone_id IS NOT NULL THEN 'milestone' ELSE 'project' END AS blocked_kind,
    coalesce(d.blocked_task_id, d.blocked_milestone_id, d.blocked_project_id) AS blocked_id,
    coalesce((SELECT title FROM tasks WHERE id = d.blocked_task_id),
             (SELECT title FROM milestones WHERE id = d.blocked_milestone_id),
             (SELECT name FROM projects WHERE id = d.blocked_project_id)) AS blocked_label,
    CASE WHEN d.on_task_id IS NOT NULL THEN 'task' WHEN d.on_milestone_id IS NOT NULL THEN 'milestone'
         WHEN d.on_project_id IS NOT NULL THEN 'project' WHEN d.on_decision_id IS NOT NULL THEN 'decision'
         WHEN d.on_opportunity_id IS NOT NULL THEN 'opportunity' ELSE 'external' END AS prereq_kind,
    coalesce(d.on_task_id, d.on_milestone_id, d.on_project_id, d.on_decision_id, d.on_opportunity_id) AS prereq_id,
    coalesce((SELECT title FROM tasks WHERE id = d.on_task_id),
             (SELECT title FROM milestones WHERE id = d.on_milestone_id),
             (SELECT name FROM projects WHERE id = d.on_project_id),
             (SELECT title FROM decisions WHERE id = d.on_decision_id),
             (SELECT title FROM opportunities WHERE id = d.on_opportunity_id),
             d.description) AS prereq_label,
    (${PREREQ_MET}) AS prerequisite_met
  FROM dependencies d`;

export function listDependencies(filter: { ventureId?: string | null; blockedKind?: BlockedKind; blockedId?: string; status?: string } = {}): Dependency[] {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (filter.ventureId) {
    where.push('d.venture_id = :venture');
    params.venture = filter.ventureId;
  } else where.push(IN_ACTIVE_VENTURE('d'));
  if (filter.blockedKind && filter.blockedId) {
    where.push(`d.blocked_${filter.blockedKind}_id = :blocked`);
    params.blocked = filter.blockedId;
  }
  if (filter.status) {
    where.push('d.status = :status');
    params.status = filter.status;
  }
  return all<Dependency>(
    `${DEP_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.status, d.created_at DESC`,
    params,
  );
}

export const getDependency = (id: string): Dependency | undefined => get<Dependency>(`${DEP_SELECT} WHERE d.id = ?`, [id]);

export const DEPENDENCY_FIELDS: Field[] = [
  { name: 'description', label: 'Description', type: 'textarea', max: 2000, wide: true, help: 'Required for external conditions: say what must happen.' },
  { name: 'notes', label: 'Notes', type: 'textarea', max: 4000, wide: true },
];

const PREREQ_TABLE: Record<Exclude<PrereqKind, 'external'>, EntityType> = {
  project: 'project',
  milestone: 'milestone',
  task: 'task',
  decision: 'decision',
  opportunity: 'opportunity',
};

export function createDependency(
  input: {
    blockedKind: BlockedKind;
    blockedId: string;
    prereqKind: PrereqKind;
    prereqId: string | null;
    externalType: string | null;
    description: string | null;
    notes: string | null;
  },
  actor: Actor,
): string {
  const errors: Record<string, string> = {};
  const blocked = findRow<{ venture_id: string | null; name?: string; title?: string }>(input.blockedKind, input.blockedId);
  if (!blocked) errors.blocked = 'The item that depends on something was not found.';
  let prereqLabel = input.description ?? '';
  if (input.prereqKind === 'external') {
    if (!DEPENDENCY_EXTERNAL.some((o) => o.value === input.externalType)) errors.external_type = 'Choose the type of external condition.';
    if (!input.description?.trim()) errors.description = 'Describe the external condition.';
  } else {
    const row = input.prereqId ? findRow<{ name?: string; title?: string }>(PREREQ_TABLE[input.prereqKind], input.prereqId) : undefined;
    if (!row) errors.prereq_id = 'Choose the record this depends on.';
    else prereqLabel = row.name ?? row.title ?? '';
    if (input.prereqKind === input.blockedKind && input.prereqId === input.blockedId) errors.prereq_id = 'An item cannot depend on itself.';
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const values: Record<string, unknown> = {
    organization_id: getOrganization().id,
    venture_id: blocked!.venture_id,
    [`blocked_${input.blockedKind}_id`]: input.blockedId,
    external_type: input.prereqKind === 'external' ? input.externalType : null,
    description: input.description?.trim() || null,
    notes: input.notes?.trim() || null,
    status: 'open',
  };
  if (input.prereqKind !== 'external') values[`on_${input.prereqKind}_id`] = input.prereqId;
  const id = insertRow('dependency', values);
  logActivity({
    actor,
    type: 'dependency.created',
    entityType: 'dependency',
    entityId: id,
    ventureId: blocked!.venture_id,
    summary: `“${blocked!.name ?? blocked!.title}” now depends on ${input.prereqKind === 'external' ? labelOf(DEPENDENCY_EXTERNAL, input.externalType).toLowerCase() + ': ' : ''}“${prereqLabel.slice(0, 120)}”`,
  });
  return id;
}

export function setDependencyStatus(id: string, status: 'open' | 'resolved', actor: Actor): void {
  const dep = getDependency(id);
  if (!dep) throw new ValidationError({ _: 'Dependency not found.' });
  const changes = updateRow('dependency', id, { status, resolved_on: status === 'resolved' ? today() : null });
  if (Object.keys(changes).length) {
    logActivity({
      actor,
      type: `dependency.${status === 'resolved' ? 'resolved' : 'reopened'}`,
      entityType: 'dependency',
      entityId: id,
      ventureId: dep.venture_id,
      summary: `Dependency of “${dep.blocked_label}” on “${dep.prereq_label}” ${status === 'resolved' ? 'resolved' : 'reopened'}`,
      changes,
    });
  }
}

/** Options for choosing a prerequisite/blocked record, scoped to a venture where relevant. */
export function recordOptions(kind: Exclude<PrereqKind, 'external'>, ventureId: string | null | undefined): { value: string; label: string }[] {
  const table = { project: 'projects', milestone: 'milestones', task: 'tasks', decision: 'decisions', opportunity: 'opportunities' }[kind];
  const label = kind === 'project' ? 'name' : 'title';
  const scope = ventureId === undefined ? '' : ventureId === null ? 'AND (venture_id IS NULL)' : 'AND (venture_id = :v OR venture_id IS NULL)';
  return all<{ id: string; label: string }>(
    `SELECT id, ${label} AS label FROM ${table} WHERE archived_at IS NULL ${scope} ORDER BY ${label} COLLATE NOCASE LIMIT 500`,
    ventureId ? { v: ventureId } : {},
  ).map((r) => ({ value: r.id, label: r.label }));
}

export const ventureIdFor = ventureIdOf;
