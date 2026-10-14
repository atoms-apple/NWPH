import { get, run, tx } from './database.ts';
import { newId } from '../lib/ids.ts';
import { nowIso } from '../lib/time.ts';

/**
 * Baseline records every installation needs: the parent organization, the
 * default development stages, and Polar Express as the first venture.
 *
 * Everything here is deliberately provisional. Nothing claims incorporation,
 * funding, staff, customers or revenue. Idempotent: does nothing if an
 * organization already exists.
 */

export const DEFAULT_STAGES: ReadonlyArray<[string, string]> = [
  ['Idea', 'A concept worth examining. No commitment beyond that.'],
  ['Research', 'Gathering evidence on need, market, regulation and feasibility.'],
  ['Planning', 'Drafting the business model, budget and operating plan.'],
  ['Validation', 'Testing assumptions with communities, customers and partners.'],
  ['Preparation', 'Securing funding, approvals, people and suppliers needed to start.'],
  ['Pilot', 'A limited, time-bound trial of the venture in practice.'],
  ['Operational', 'Trading or delivering services on an ongoing basis.'],
];

export const POLAR_EXPRESS_PROVISIONAL = [
  'short_description',
  'description',
  'category',
  'parent_relationship',
  'locations',
  'mission',
] as const;

export function seedBaseline(): { organizationId: string; created: boolean } {
  const existing = get<{ id: string }>('SELECT id FROM organizations ORDER BY created_at LIMIT 1');
  if (existing) return { organizationId: existing.id, created: false };

  return tx(() => {
    const now = nowIso();
    const orgId = newId();
    run(
      `INSERT INTO organizations (id, name, legal_status, legal_status_detail, headquarters, description,
         mission, guiding_philosophy, ownership_notes, created_at, updated_at)
       VALUES (:id, :name, 'unverified', :detail, :hq, :description, :mission, :philosophy, :ownership, :now, :now)`,
      {
        id: orgId,
        name: 'NWPH',
        detail: 'Legal status has not been verified in NWPH OS. Record incorporation details here only once confirmed.',
        hq: 'Iqaluit, Nunavut, Canada (intended)',
        description:
          'An Inuit-led holding company concept intended to support Inuit economic participation, ownership, technological development and long-term economic independence.',
        mission: null,
        philosophy: 'Arctic doesn’t need more extraction; it needs more ownership.',
        ownership: 'Ownership structure not yet recorded.',
        now,
      },
    );

    let ideaStageId = '';
    DEFAULT_STAGES.forEach(([name, description], i) => {
      const id = newId();
      if (i === 0) ideaStageId = id;
      run(
        `INSERT INTO development_stages (id, organization_id, name, description, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, orgId, name, description, i + 1, now, now],
      );
    });

    const ventureId = newId();
    run(
      `INSERT INTO ventures (id, organization_id, name, slug, short_description, description, category, stage_id,
         legal_status, legal_status_detail, operational_status, parent_relationship, locations, mission,
         provisional_fields, created_at, updated_at)
       VALUES (:id, :org, 'Polar Express', 'polar-express', :short, :description, :category, :stage,
         'not_established', :legalDetail, 'proposed', :relationship, :locations, :mission, :provisional, :now, :now)`,
      {
        id: ventureId,
        org: orgId,
        stage: ideaStageId,
        short: 'First venture configured in NWPH OS. Business model and scope not yet defined.',
        description:
          'Polar Express is the first venture under development by NWPH. Its business model, operating structure, legal status and commercial scope remain to be defined. Use the Business Plan section to develop the concept.',
        category: 'To be determined',
        legalDetail: 'No legal entity has been formed. Record registration details only once they exist.',
        relationship: 'Proposed venture of NWPH. Ownership and control arrangements have not been determined.',
        locations: 'To be determined — Nunavut communities under consideration.',
        mission: 'To be defined.',
        provisional: JSON.stringify(POLAR_EXPRESS_PROVISIONAL),
        now,
      },
    );
    run(
      `INSERT INTO venture_stage_changes (id, venture_id, from_stage_id, to_stage_id, note, changed_at)
       VALUES (?, ?, NULL, ?, 'Initial stage at setup', ?)`,
      [newId(), ventureId, ideaStageId, now],
    );
    run(
      `INSERT INTO activity_events (id, occurred_at, actor_name, event_type, entity_type, entity_id, venture_id, summary)
       VALUES (?, ?, 'System', 'venture.created', 'venture', ?, ?, 'Polar Express configured as the first venture (provisional profile)')`,
      [newId(), now, ventureId, ventureId],
    );
    return { organizationId: orgId, created: true };
  });
}
