/**
 * Decision register. An internal record, not a substitute for corporate
 * minutes or board resolutions.
 *
 * Proposed / under review / deferred decisions are visibly ideas; approved
 * and rejected decisions must carry a decision date. Every edit is kept in the
 * activity history with before/after values, so the record of what was
 * decided, and when, cannot be silently rewritten.
 */
import { all, get, tx } from '../db/database.ts';
import { today } from '../lib/time.ts';
import type { Actor } from '../http/context.ts';
import { type Field, type Values, ValidationError } from './fields.ts';
import { DECISION_STATUSES, DECISION_CATEGORIES, labelOf } from './vocabulary.ts';
import { getOrganization } from './organization.ts';
import { insertRow, logActivity, updateRow, setArchived } from './records.ts';
import { IN_ACTIVE_VENTURE } from './ventures.ts';

export const DECIDED = new Set(['approved', 'rejected']);
export const OPEN_DECISION = new Set(['proposed', 'under_review', 'deferred']);

export const DECISION_FIELDS: Field[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, max: 200, wide: true },
  { name: 'venture_id', label: 'Relevant venture', type: 'ref', ref: 'venture', emptyLabel: 'NWPH (parent organization)' },
  { name: 'category', label: 'Category', type: 'select', options: DECISION_CATEGORIES, freeform: true, emptyLabel: 'Uncategorised' },
  { name: 'status', label: 'Status', type: 'select', required: true, options: DECISION_STATUSES },
  { name: 'proposed_on', label: 'Date proposed', type: 'date', required: true },
  { name: 'owner_name', label: 'Decision owner', type: 'text', max: 120 },
  { name: 'review_date', label: 'Review date', type: 'date' },
  { name: 'decided_on', label: 'Date decided', type: 'date', help: 'Required when approved or rejected.' },
  { name: 'description', label: 'Description', type: 'textarea', wide: true, max: 8000 },
  { name: 'options_considered', label: 'Options considered', type: 'textarea', wide: true, max: 8000 },
  { name: 'rationale', label: 'Rationale', type: 'textarea', wide: true, max: 8000 },
  { name: 'evidence', label: 'Supporting evidence', type: 'textarea', wide: true, max: 8000 },
  { name: 'evidence_document_id', label: 'Evidence document', type: 'ref', ref: 'document', emptyLabel: 'None' },
  { name: 'implications', label: 'Expected implications', type: 'textarea', wide: true, max: 8000 },
  { name: 'outcome', label: 'Final outcome', type: 'textarea', wide: true, max: 8000 },
  { name: 'superseded_by_id', label: 'Superseded by', type: 'ref', ref: 'decision', emptyLabel: 'Not superseded', help: 'Required when status is Superseded.' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export interface Decision {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  proposed_on: string;
  owner_name: string | null;
  status: string;
  options_considered: string | null;
  rationale: string | null;
  evidence: string | null;
  evidence_document_id: string | null;
  evidence_document_title: string | null;
  implications: string | null;
  review_date: string | null;
  decided_on: string | null;
  outcome: string | null;
  superseded_by_id: string | null;
  superseded_by_title: string | null;
  notes: string | null;
  archived_at: string | null;
  is_example: number;
  updated_at: string;
}

const SELECT = `
  SELECT d.*, v.name AS venture_name, v.slug AS venture_slug, doc.title AS evidence_document_title, s.title AS superseded_by_title
    FROM decisions d
    LEFT JOIN ventures v ON v.id = d.venture_id
    LEFT JOIN documents doc ON doc.id = d.evidence_document_id
    LEFT JOIN decisions s ON s.id = d.superseded_by_id`;

export function listDecisions(f: { ventureId?: string | null; scope?: 'parent' | null; status?: string | null; category?: string | null; q?: string | null; open?: boolean; archived?: boolean } = {}): Decision[] {
  const where = [f.archived ? 'd.archived_at IS NOT NULL' : 'd.archived_at IS NULL'];
  const params: Record<string, string> = {};
  if (f.ventureId) {
    where.push('d.venture_id = :v');
    params.v = f.ventureId;
  } else if (f.scope === 'parent') where.push('d.venture_id IS NULL');
  else where.push(IN_ACTIVE_VENTURE('d'));
  if (f.status) {
    where.push('d.status = :s');
    params.s = f.status;
  }
  if (f.open) where.push(`d.status IN ('proposed','under_review','deferred')`);
  if (f.category) {
    where.push('d.category = :c');
    params.c = f.category;
  }
  if (f.q) {
    where.push(`(d.title LIKE :q ESCAPE '\\' OR d.description LIKE :q ESCAPE '\\' OR d.rationale LIKE :q ESCAPE '\\' OR d.outcome LIKE :q ESCAPE '\\')`);
    params.q = `%${f.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  }
  return all<Decision>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY coalesce(d.decided_on, d.proposed_on) DESC, d.created_at DESC`, params);
}

export const getDecision = (id: string): Decision | undefined => get<Decision>(`${SELECT} WHERE d.id = ?`, [id]);

function check(values: Values, id?: string): void {
  const errors: Record<string, string> = {};
  if (DECIDED.has(String(values.status)) && !values.decided_on) errors.decided_on = 'Record the date this decision was made.';
  if (values.status === 'superseded' && !values.superseded_by_id) errors.superseded_by_id = 'Choose the decision that supersedes this one.';
  if (values.status !== 'superseded' && values.superseded_by_id) errors.superseded_by_id = 'Only a superseded decision can name a replacement. Set status to Superseded or clear this.';
  if (id && values.superseded_by_id === id) errors.superseded_by_id = 'A decision cannot supersede itself.';
  if (values.decided_on && values.proposed_on && String(values.decided_on) < String(values.proposed_on)) errors.decided_on = 'Date decided cannot be before date proposed.';
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

export function createDecision(values: Values, actor: Actor): string {
  check(values);
  const id = insertRow('decision', { ...values, organization_id: getOrganization().id });
  logActivity({
    actor,
    type: 'decision.created',
    entityType: 'decision',
    entityId: id,
    ventureId: values.venture_id as string | null,
    summary: `Decision “${values.title}” recorded as ${labelOf(DECISION_STATUSES, String(values.status))}`,
  });
  return id;
}

export function updateDecision(id: string, values: Values, actor: Actor): void {
  const before = getDecision(id);
  if (!before) throw new ValidationError({ _: 'Decision not found.' });
  check(values, id);
  tx(() => {
    const changes = updateRow('decision', id, values);
    if (!Object.keys(changes).length) return;
    const statusChanged = 'status' in changes;
    logActivity({
      actor,
      type: statusChanged ? `decision.${values.status}` : 'decision.updated',
      entityType: 'decision',
      entityId: id,
      ventureId: values.venture_id as string | null,
      summary: statusChanged
        ? `Decision “${values.title}”: ${labelOf(DECISION_STATUSES, before.status)} → ${labelOf(DECISION_STATUSES, String(values.status))}`
        : `Decision “${values.title}” edited`,
      changes,
    });
  });
}

export function archiveDecision(id: string, archived: boolean, actor: Actor): void {
  const d = getDecision(id);
  if (d && setArchived('decision', id, archived)) {
    logActivity({ actor, type: `decision.${archived ? 'archived' : 'restored'}`, entityType: 'decision', entityId: id, ventureId: d.venture_id, summary: `Decision “${d.title}” ${archived ? 'archived' : 'restored'}` });
  }
}

export const defaultProposedOn = (): string => today();
