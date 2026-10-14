/**
 * Opportunity tracking. Every opportunity is entered by a person. Nothing here
 * infers eligibility: statuses that assert eligibility require the user to
 * record the basis for that judgement, and "Awarded" is the only status that
 * represents secured funding (and even then, money is only counted in
 * Financial Planning once a funding entry is recorded).
 */
import { all, get } from '../db/database.ts';
import { today, addDays } from '../lib/time.ts';
import type { Actor } from '../http/context.ts';
import { type Field, type Values, ValidationError, currencyField } from './fields.ts';
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_STATUSES, ELIGIBILITY_ASSERTING, labelOf } from './vocabulary.ts';
import { getOrganization } from './organization.ts';
import { insertRow, logActivity, updateRow, setArchived } from './records.ts';
import { IN_ACTIVE_VENTURE } from './ventures.ts';

export const OPPORTUNITY_FIELDS: Field[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, max: 200, wide: true },
  { name: 'category', label: 'Category', type: 'select', required: true, options: OPPORTUNITY_CATEGORIES, freeform: true },
  { name: 'status', label: 'Status', type: 'select', required: true, options: OPPORTUNITY_STATUSES },
  { name: 'venture_id', label: 'Relevant venture', type: 'ref', ref: 'venture', emptyLabel: 'NWPH (parent organization)' },
  { name: 'issuing_organization', label: 'Issuing organization', type: 'text', max: 200 },
  { name: 'source', label: 'Source', type: 'text', max: 200, help: 'Where you found it.' },
  { name: 'source_url', label: 'Source URL', type: 'url' },
  { name: 'potential_value_minor', label: 'Potential value', type: 'money', help: 'The maximum or typical amount available. Not an expectation of award.' },
  currencyField(),
  { name: 'opens_on', label: 'Opening date', type: 'date' },
  { name: 'deadline', label: 'Deadline', type: 'date' },
  { name: 'geographic_scope', label: 'Geographic scope', type: 'text', max: 200 },
  { name: 'description', label: 'Description', type: 'textarea', wide: true, max: 8000 },
  { name: 'eligibility_requirements', label: 'Eligibility requirements', type: 'textarea', wide: true, max: 8000, help: 'As published by the issuer.' },
  { name: 'eligibility_basis', label: 'Basis for eligibility judgement', type: 'textarea', wide: true, max: 4000, help: 'Required for Eligible and later statuses: who confirmed eligibility and how.' },
  { name: 'required_documents', label: 'Required documents', type: 'textarea', wide: true, max: 4000 },
  { name: 'next_action', label: 'Next action', type: 'text', max: 300, wide: true },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

export interface Opportunity {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  title: string;
  description: string | null;
  category: string;
  source: string | null;
  source_url: string | null;
  issuing_organization: string | null;
  eligibility_requirements: string | null;
  eligibility_basis: string | null;
  geographic_scope: string | null;
  potential_value_minor: number | null;
  currency: string;
  opens_on: string | null;
  deadline: string | null;
  status: string;
  required_documents: string | null;
  next_action: string | null;
  notes: string | null;
  archived_at: string | null;
  is_example: number;
  updated_at: string;
}

const SELECT = `SELECT o.*, v.name AS venture_name, v.slug AS venture_slug FROM opportunities o LEFT JOIN ventures v ON v.id = o.venture_id`;

export function listOpportunities(f: { ventureId?: string | null; scope?: 'parent' | null; status?: string | null; category?: string | null; q?: string | null; active?: boolean; dueWithinDays?: number; archived?: boolean } = {}): Opportunity[] {
  const where = [f.archived ? 'o.archived_at IS NOT NULL' : 'o.archived_at IS NULL'];
  const params: Record<string, string> = {};
  if (f.ventureId) {
    where.push('o.venture_id = :v');
    params.v = f.ventureId;
  } else if (f.scope === 'parent') where.push('o.venture_id IS NULL');
  else where.push(IN_ACTIVE_VENTURE('o'));
  if (f.status) {
    where.push('o.status = :s');
    params.s = f.status;
  }
  if (f.category) {
    where.push('o.category = :c');
    params.c = f.category;
  }
  if (f.active) where.push(`o.status NOT IN ('awarded','unsuccessful','expired','not_pursuing')`);
  if (f.dueWithinDays !== undefined) {
    where.push('o.deadline BETWEEN :today AND :until');
    params.today = today();
    params.until = addDays(today(), f.dueWithinDays);
  }
  if (f.q) {
    where.push(`(o.title LIKE :q ESCAPE '\\' OR o.description LIKE :q ESCAPE '\\' OR o.issuing_organization LIKE :q ESCAPE '\\' OR o.source LIKE :q ESCAPE '\\')`);
    params.q = `%${f.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  }
  return all<Opportunity>(
    `${SELECT} WHERE ${where.join(' AND ')}
     ORDER BY o.status IN ('awarded','unsuccessful','expired','not_pursuing'), o.deadline IS NULL, o.deadline, o.title COLLATE NOCASE`,
    params,
  );
}

export const getOpportunity = (id: string): Opportunity | undefined => get<Opportunity>(`${SELECT} WHERE o.id = ?`, [id]);

function check(values: Values): void {
  const errors: Record<string, string> = {};
  if (ELIGIBILITY_ASSERTING.has(String(values.status)) && !values.eligibility_basis) {
    errors.eligibility_basis = 'Eligibility must be confirmed by a person. Record who confirmed it and on what basis before using this status.';
  }
  if (values.opens_on && values.deadline && String(values.deadline) < String(values.opens_on)) errors.deadline = 'Deadline cannot be before the opening date.';
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

export function createOpportunity(values: Values, actor: Actor): string {
  check(values);
  const id = insertRow('opportunity', { ...values, organization_id: getOrganization().id });
  logActivity({ actor, type: 'opportunity.created', entityType: 'opportunity', entityId: id, ventureId: values.venture_id as string | null, summary: `Opportunity “${values.title}” added (${labelOf(OPPORTUNITY_STATUSES, String(values.status))})` });
  return id;
}

export function updateOpportunity(id: string, values: Values, actor: Actor): void {
  const before = getOpportunity(id);
  if (!before) throw new ValidationError({ _: 'Opportunity not found.' });
  check(values);
  const changes = updateRow('opportunity', id, values);
  if (!Object.keys(changes).length) return;
  logActivity({
    actor,
    type: changes.status ? 'opportunity.status_changed' : 'opportunity.updated',
    entityType: 'opportunity',
    entityId: id,
    ventureId: values.venture_id as string | null,
    summary: changes.status
      ? `Opportunity “${values.title}”: ${labelOf(OPPORTUNITY_STATUSES, before.status)} → ${labelOf(OPPORTUNITY_STATUSES, String(values.status))}`
      : `Opportunity “${values.title}” updated`,
    changes,
  });
}

export function archiveOpportunity(id: string, archived: boolean, actor: Actor): void {
  const o = getOpportunity(id);
  if (o && setArchived('opportunity', id, archived)) {
    logActivity({ actor, type: `opportunity.${archived ? 'archived' : 'restored'}`, entityType: 'opportunity', entityId: id, ventureId: o.venture_id, summary: `Opportunity “${o.title}” ${archived ? 'archived' : 'restored'}` });
  }
}
