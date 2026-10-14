/**
 * Optional demonstration records, every one flagged is_example = 1 and titled
 * "[Example]". They exist to show how the modules fit together and can be
 * removed in one step from Settings. They are attached to an example venture,
 * never to Polar Express, so no fictional fact is attributed to a real venture.
 */
import { all, get, run, tx } from '../db/database.ts';
import { today, addDays } from '../lib/time.ts';
import { newId } from '../lib/ids.ts';
import type { Actor } from '../http/context.ts';
import { getOrganization } from './organization.ts';
import { listStages } from './stages.ts';
import { insertRow, logActivity } from './records.ts';

export const exampleCount = (): number =>
  ['ventures', 'projects', 'milestones', 'tasks', 'decisions', 'documents', 'opportunities', 'financial_entries', 'financial_scenarios', 'risks', 'dependencies']
    .map((t) => get<{ n: number }>(`SELECT count(*) AS n FROM ${t} WHERE is_example = 1`)!.n)
    .reduce((a, b) => a + b, 0);

export function addExamples(actor: Actor): void {
  if (exampleCount() > 0) return;
  const org = getOrganization().id;
  const stages = listStages();
  const t = today();
  tx(() => {
    const ventureId = insertRow('venture', {
      organization_id: org,
      name: '[Example] Demonstration Venture',
      slug: `example-venture-${newId().slice(0, 6)}`,
      short_description: 'Demonstration data only. Not a real or proposed venture. Remove from Settings.',
      description: 'This venture and every record attached to it are fictional examples that show how NWPH OS modules connect.',
      category: 'Other',
      stage_id: stages[Math.min(2, stages.length - 1)]!.id,
      legal_status: 'not_established',
      operational_status: 'proposed',
      is_example: 1,
    });
    run(`INSERT INTO venture_stage_changes (id, venture_id, to_stage_id, note, changed_at) VALUES (?, ?, ?, 'Example data', ?)`, [newId(), ventureId, stages[Math.min(2, stages.length - 1)]!.id, new Date().toISOString()]);
    const base = { organization_id: org, venture_id: ventureId, is_example: 1 };
    const projectId = insertRow('project', { ...base, name: '[Example] Feasibility study', status: 'active', start_date: t, target_date: addDays(t, 75), description: 'Example project.' });
    const milestoneId = insertRow('milestone', { ...base, project_id: projectId, title: '[Example] Feasibility report drafted', status: 'planned', due_date: addDays(t, 45) });
    const taskA = insertRow('task', { ...base, project_id: projectId, milestone_id: milestoneId, title: '[Example] Compile freight rate data', status: 'in_progress', priority: 'high', due_date: addDays(t, 10) });
    const taskB = insertRow('task', { ...base, project_id: projectId, milestone_id: milestoneId, title: '[Example] Draft cost model', status: 'not_started', priority: 'normal', due_date: addDays(t, 30) });
    insertRow('task', { ...base, project_id: projectId, title: '[Example] Overdue follow-up call', status: 'not_started', priority: 'normal', due_date: addDays(t, -3) });
    insertRow('dependency', { organization_id: org, venture_id: ventureId, blocked_task_id: taskB, on_task_id: taskA, status: 'open', is_example: 1 });
    const decisionId = insertRow('decision', { ...base, title: '[Example] Commission a feasibility study', status: 'proposed', proposed_on: t, category: 'Strategy', options_considered: 'Example: internal study vs. external consultant.' });
    insertRow('dependency', { organization_id: org, venture_id: ventureId, blocked_project_id: projectId, on_decision_id: decisionId, status: 'open', is_example: 1 });
    const oppId = insertRow('opportunity', { ...base, title: '[Example] Regional business development grant', category: 'Grant', status: 'researching', currency: 'CAD', potential_value_minor: 5_000_000, deadline: addDays(t, 40), next_action: 'Example: confirm eligibility criteria with the program officer.' });
    insertRow('financial_entry', { ...base, entry_type: 'startup_cost', basis: 'forecast', description: '[Example] Equipment estimate', amount_minor: 12_000_000, currency: 'CAD', category: 'Equipment', period: 'Year 1', source_reference: 'Example figure, not a quote' });
    insertRow('financial_entry', { ...base, entry_type: 'funding_requirement', basis: 'forecast', description: '[Example] Total startup funding needed', amount_minor: 15_000_000, currency: 'CAD' });
    insertRow('financial_entry', { ...base, entry_type: 'funding', basis: 'forecast', funding_status: 'potential', opportunity_id: oppId, description: '[Example] Grant (potential, not applied)', amount_minor: 5_000_000, currency: 'CAD', category: 'Grant' });
    insertRow('risk', { ...base, title: '[Example] Sealift schedule disruption', category: 'Logistics & Supply', likelihood: 3, impact: 4, status: 'open', mitigation: 'Example mitigation.' });
    insertRow('document', { ...base, title: '[Example] Market scan notes', category: 'Market Research', source: 'Example', description: 'Example document record with no file.', verification_status: 'unverified' });
    const docs = all<{ id: string; title: string }>('SELECT id, title FROM documents WHERE is_example = 1');
    for (const d of docs) run('INSERT INTO documents_fts (document_id, title, description, source, tags, filenames) VALUES (?, ?, ?, ?, ?, ?)', [d.id, d.title, 'Example document', 'Example', '', '']);
    logActivity({ actor, type: 'examples.added', entityType: 'venture', entityId: ventureId, ventureId, summary: 'Example records added (all marked [Example])' });
  });
}

/** Permanently delete every is_example row, in dependency order. */
export function removeExamples(actor: Actor): number {
  const n = exampleCount();
  if (!n) return 0;
  tx(() => {
    const ventures = all<{ id: string }>('SELECT id FROM ventures WHERE is_example = 1').map((r) => r.id);
    // Real records can never hang off example ventures silently: detach them first.
    for (const table of ['projects', 'milestones', 'tasks', 'decisions', 'documents', 'opportunities', 'financial_entries', 'financial_scenarios', 'risks', 'dependencies']) {
      for (const v of ventures) run(`UPDATE ${table} SET venture_id = NULL WHERE venture_id = ? AND is_example = 0`, [v]);
    }
    run('DELETE FROM dependencies WHERE is_example = 1');
    run('DELETE FROM financial_entries WHERE is_example = 1');
    run('DELETE FROM financial_scenarios WHERE is_example = 1');
    run('DELETE FROM risks WHERE is_example = 1');
    run('DELETE FROM tasks WHERE is_example = 1');
    run('DELETE FROM milestones WHERE is_example = 1');
    run('DELETE FROM decisions WHERE is_example = 1');
    run('DELETE FROM opportunities WHERE is_example = 1');
    run(`DELETE FROM documents_fts WHERE document_id IN (SELECT id FROM documents WHERE is_example = 1)`);
    run('DELETE FROM documents WHERE is_example = 1');
    run('DELETE FROM projects WHERE is_example = 1');
    for (const v of ventures) {
      run('DELETE FROM venture_stage_changes WHERE venture_id = ?', [v]);
      run('UPDATE activity_events SET venture_id = NULL WHERE venture_id = ?', [v]);
    }
    run('DELETE FROM ventures WHERE is_example = 1');
    logActivity({ actor, type: 'examples.removed', entityType: 'organization', entityId: getOrganization().id, summary: `${n} example records permanently removed` });
  });
  return n;
}
