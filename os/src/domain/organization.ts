import { get, run } from '../db/database.ts';
import { nowIso } from '../lib/time.ts';
import type { Actor } from '../http/context.ts';
import { type Field, type Values } from './fields.ts';
import { LEGAL_STATUSES } from './vocabulary.ts';
import { logActivity, updateRow } from './records.ts';

export interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  legal_status: string;
  legal_status_detail: string | null;
  jurisdiction: string | null;
  registration_reference: string | null;
  headquarters: string | null;
  description: string | null;
  mission: string | null;
  guiding_philosophy: string | null;
  ownership_notes: string | null;
  notes: string | null;
  profile_reviewed_at: string | null;
  onboarding_dismissed_at: string | null;
  updated_at: string;
}

export function getOrganization(): Organization {
  const org = get<Organization>('SELECT * FROM organizations ORDER BY created_at LIMIT 1');
  if (!org) throw new Error('No organization configured. Run: npm run db:migrate');
  return org;
}

export const ORGANIZATION_FIELDS: Field[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, max: 200 },
  { name: 'headquarters', label: 'Headquarters', type: 'text', max: 200 },
  { name: 'description', label: 'Description', type: 'textarea', max: 4000, wide: true },
  { name: 'mission', label: 'Mission', type: 'textarea', max: 4000, wide: true },
  { name: 'guiding_philosophy', label: 'Guiding philosophy', type: 'textarea', max: 1000, wide: true },
  { name: 'ownership_notes', label: 'Ownership and control', type: 'textarea', max: 4000, wide: true },
  { name: 'notes', label: 'Internal notes', type: 'textarea', wide: true },
];

/** Legal facts are owner-only: they change how the organization is represented. */
export const ORGANIZATION_LEGAL_FIELDS: Field[] = [
  { name: 'legal_name', label: 'Legal name', type: 'text', max: 200, help: 'Leave blank until a legal entity exists.' },
  { name: 'legal_status', label: 'Legal status', type: 'select', required: true, options: LEGAL_STATUSES },
  { name: 'legal_status_detail', label: 'Legal status detail / evidence', type: 'textarea', max: 2000, wide: true },
  { name: 'jurisdiction', label: 'Jurisdiction', type: 'text', max: 120 },
  { name: 'registration_reference', label: 'Registration reference', type: 'text', max: 120, help: 'As shown on registration documents. Only record what exists.' },
];

export function updateOrganization(values: Values, actor: Actor): void {
  const org = getOrganization();
  const changes = updateRow('organization', org.id, values);
  if (Object.keys(changes).length) {
    logActivity({
      actor,
      type: 'organization.updated',
      entityType: 'organization',
      entityId: org.id,
      summary: `Organization profile updated (${Object.keys(changes).length} field${Object.keys(changes).length === 1 ? '' : 's'})`,
      changes,
    });
  }
}

export function markProfileReviewed(actor: Actor): void {
  const org = getOrganization();
  run('UPDATE organizations SET profile_reviewed_at = ? WHERE id = ?', [nowIso(), org.id]);
  logActivity({ actor, type: 'organization.reviewed', entityType: 'organization', entityId: org.id, summary: 'Organization profile reviewed' });
}

export function setOnboardingDismissed(dismissed: boolean): void {
  const org = getOrganization();
  run('UPDATE organizations SET onboarding_dismissed_at = ? WHERE id = ?', [dismissed ? nowIso() : null, org.id]);
}
