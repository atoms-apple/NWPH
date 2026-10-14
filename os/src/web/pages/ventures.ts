import { html, paragraphs, attrs, cx, type SafeHtml } from '../../lib/html.ts';
import { formatDate } from '../../lib/time.ts';
import { htmlReply, redirect, HttpError, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import {
  VENTURE_BASIC_FIELDS,
  VENTURE_STATUS_FIELDS,
  PLAN_GROUPS,
  PROVISIONABLE,
  listVentures,
  listCategoriesInUse,
  getVentureBySlug,
  createVenture,
  updateVenture,
  changeStage,
  archiveVenture,
  restoreVenture,
  stageHistory,
  provisionalOf,
  type Venture,
  type VentureListItem,
} from '../../domain/ventures.ts';
import { listStages } from '../../domain/stages.ts';
import { LEGAL_STATUSES, OPERATIONAL_STATUSES, VENTURE_CATEGORIES, RESEARCH_CATEGORIES, labelOf } from '../../domain/vocabulary.ts';
import { parseFields, ValidationError, type Errors, type Field } from '../../domain/fields.ts';
import { listProjects, listTasks, listMilestones, listDependencies, isOverdue } from '../../domain/work.ts';
import { listEntries, summarize, listScenarios } from '../../domain/finance.ts';
import { listOpportunities } from '../../domain/opportunities.ts';
import { listRisks } from '../../domain/risks.ts';
import { listDocuments } from '../../domain/documents.ts';
import { listDecisions } from '../../domain/decisions.ts';
import { listActivity } from '../../domain/records.ts';
import { page } from '../layout.ts';
import {
  pageHeader,
  section,
  badge,
  statusBadge,
  emptyState,
  linkButton,
  postButton,
  filterBar,
  definitionList,
  date,
  dueDate,
  stat,
  tabs,
  viewToggle,
  notice,
  exampleBadge,
  archivedBadge,
  pluralise,
} from '../ui.ts';
import { renderForm, toFormValues, errorSummary, type FormValues } from '../forms.ts';
import { notFound } from '../common.ts';
import { taskTable, taskBoard, projectTable, milestoneTable, dependencyList } from './work.ts';
import { financeSummary, entriesTable } from './finance.ts';
import { opportunityTable } from './opportunities.ts';
import { riskTable, riskMatrix } from './risks.ts';
import { documentTable, SEARCH_LIMITATION } from './documents.ts';
import { decisionTable } from './decisions.ts';
import { activityList } from './activity.ts';
import { financeHeadline } from './dashboard.ts';

// ── Portfolio ────────────────────────────────────────────────────────────────

const OP_TONE: Record<string, 'neutral' | 'info' | 'good' | 'warn' | 'muted'> = {
  proposed: 'neutral',
  in_development: 'info',
  operational: 'good',
  paused: 'warn',
  discontinued: 'muted',
};

function ventureCard(v: VentureListItem): SafeHtml {
  return html`<article class="card card--venture">
    <div class="card__top">
      <h3 class="card__title"><a href="/ventures/${v.slug}">${v.name}</a></h3>
      ${badge(labelOf(OPERATIONAL_STATUSES, v.operational_status), OP_TONE[v.operational_status] ?? 'neutral', 'Operational status')}
    </div>
    <p class="card__desc">${v.short_description ?? html`<span class="muted">No description yet.</span>`}</p>
    <dl class="card__facts">
      <div><dt>Stage</dt><dd>${v.stage_name}</dd></div>
      <div><dt>Projects</dt><dd>${v.project_count}</dd></div>
      <div><dt>Next milestone</dt><dd>${v.next_milestone_title ? html`${v.next_milestone_title}${v.next_milestone_due ? html` <span class="muted">· ${formatDate(v.next_milestone_due)}</span>` : ''}` : html`<span class="muted">None set</span>`}</dd></div>
    </dl>
    <p class="card__foot">${v.category ? html`${v.category} · ` : ''}Updated ${formatDate(v.updated_at)} ${exampleBadge(v.is_example)}${archivedBadge(v.archived_at)}</p>
  </article>`;
}

function ventureRows(list: VentureListItem[]): SafeHtml {
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Venture</th><th scope="col">Stage</th><th scope="col">Operational status</th><th scope="col">Legal status</th><th scope="col">Projects</th><th scope="col">Next milestone</th><th scope="col">Updated</th></tr></thead>
    <tbody>${list.map((v) => html`<tr>
      <th scope="row" data-label="Venture"><a href="/ventures/${v.slug}">${v.name}</a> ${exampleBadge(v.is_example)}${archivedBadge(v.archived_at)}<span class="cell-meta">${v.category ?? ''}</span></th>
      <td data-label="Stage">${v.stage_name}</td>
      <td data-label="Operational">${statusBadge(OPERATIONAL_STATUSES, v.operational_status)}</td>
      <td data-label="Legal">${statusBadge(LEGAL_STATUSES, v.legal_status)}</td>
      <td data-label="Projects">${v.project_count}</td>
      <td data-label="Next milestone">${v.next_milestone_title ? html`${v.next_milestone_title}<span class="cell-meta">${v.next_milestone_due ? formatDate(v.next_milestone_due) : 'No date'}</span>` : html`<span class="muted">—</span>`}</td>
      <td data-label="Updated">${date(v.updated_at.slice(0, 10))}</td>
    </tr>`)}</tbody></table></div>`;
}

const STAGE_FIELD: Field = { name: 'stage_id', label: 'Development stage', type: 'ref', ref: 'stage', required: true };
const NEW_FIELDS: Field[] = [VENTURE_BASIC_FIELDS[0]!, VENTURE_BASIC_FIELDS[1]!, STAGE_FIELD, ...VENTURE_STATUS_FIELDS.slice(0, 2), ...VENTURE_BASIC_FIELDS.slice(2)];

function stageOptions() {
  return listStages().map((s) => ({ value: s.id, label: s.name }));
}

function newVenturePage(ctx: Context, values: FormValues, errors: Errors = {}): string {
  return page(ctx, {
    title: 'New venture',
    active: 'ventures',
    body: html`${pageHeader({ title: 'New venture', eyebrow: 'Venture Portfolio', lede: 'A venture can be anything from an idea to an operating business. Record only what is true; everything can be refined later.' })}
    ${section('Venture', renderForm(ctx, {
      action: '/ventures',
      fields: NEW_FIELDS,
      values,
      errors,
      refs: { stage_id: stageOptions() },
      submitLabel: 'Create venture',
      cancelHref: '/ventures',
    }))}`,
  });
}

// ── Workspace shell ──────────────────────────────────────────────────────────

const SECTIONS: ReadonlyArray<[string, string]> = [
  ['', 'Overview'],
  ['plan', 'Business Plan'],
  ['projects', 'Projects & Tasks'],
  ['milestones', 'Milestones'],
  ['finance', 'Financial Planning'],
  ['funding', 'Funding & Opportunities'],
  ['research', 'Research & Market'],
  ['risks', 'Risks & Dependencies'],
  ['documents', 'Documents'],
  ['decisions', 'Decisions'],
  ['activity', 'Activity'],
  ['settings', 'Settings'],
];

function stageStepper(v: Venture): SafeHtml {
  const stages = listStages();
  const current = stages.findIndex((s) => s.id === v.stage_id);
  return html`<ol class="stepper" aria-label="Development stage">
    ${stages.map((s, i) => html`<li class="${cx('stepper__step', i < current && 'is-past', i === current && 'is-current')}"${attrs({ 'aria-current': i === current ? 'step' : null })}><span>${s.name}</span></li>`)}
  </ol>`;
}

function workspace(ctx: Context, v: Venture, key: string, title: string, body: SafeHtml): string {
  const header = html`<header class="ws-header">
    <p class="eyebrow"><a href="/ventures">Venture Portfolio</a> · ${v.category ?? 'Uncategorised'}</p>
    <div class="ws-header__row">
      <h1>${v.name}</h1>
      <div class="ws-header__badges">
        ${badge(`Stage: ${v.stage_name}`, 'info', 'Development stage')}
        ${badge(labelOf(OPERATIONAL_STATUSES, v.operational_status), OP_TONE[v.operational_status] ?? 'neutral', 'Operational status')}
        ${badge(`Legal: ${labelOf(LEGAL_STATUSES, v.legal_status)}`, v.legal_status === 'established' ? 'good' : 'neutral', 'Legal and organizational status')}
        ${exampleBadge(v.is_example)}${archivedBadge(v.archived_at)}
      </div>
    </div>
    ${stageStepper(v)}
    ${v.archived_at ? notice('warn', html`This venture is archived. Its records are preserved but excluded from the portfolio and dashboard. ${ctx.can('archive') ? postButton(ctx, `/ventures/${v.slug}/restore`, 'Restore venture', { variant: 'link' }) : ''}`) : ''}
    ${tabs(SECTIONS.map(([k, label]) => ({ href: `/ventures/${v.slug}${k ? '/' + k : ''}`, label, active: k === key })), `${v.name} sections`)}
  </header>`;
  return page(ctx, { title: `${title} · ${v.name}`, active: 'ventures', body: html`${header}<div class="ws-body">${body}</div>` });
}

const withVenture = (v: Venture, path: string, extra = ''): string => `${path}?venture=${v.slug}${extra}`;

function provisionalExtras(v: Venture, fields: Field[], submitted?: Set<string>): Record<string, SafeHtml> {
  const markers = submitted ?? provisionalOf(v);
  const out: Record<string, SafeHtml> = {};
  for (const f of fields) {
    if (!PROVISIONABLE.has(f.name)) continue;
    out[f.name] = html`<label class="provisional-toggle"><input type="checkbox" name="provisional" value="${f.name}"${attrs({ checked: markers.has(f.name) })}> Still provisional (not yet confirmed)</label>`;
  }
  return out;
}

// ── Sections ─────────────────────────────────────────────────────────────────

function overview(ctx: Context, v: Venture): SafeHtml {
  const prov = provisionalOf(v);
  const tasks = listTasks({ ventureId: v.id, open: true });
  const overdue = tasks.filter(isOverdue);
  const blocked = tasks.filter((t) => t.status === 'blocked' || t.open_dependencies > 0);
  const milestones = listMilestones({ ventureId: v.id, open: true });
  const projects = listProjects({ ventureId: v.id, open: true });
  const risks = listRisks({ ventureId: v.id, active: true });
  const decisions = listDecisions({ ventureId: v.id, open: true });
  const docs = listDocuments({ ventureId: v.id });
  const sums = summarize(listEntries({ ventureId: v.id, scenarioId: null }));
  const base = `/ventures/${v.slug}`;
  return html`
    ${prov.size ? notice('warn', html`${pluralise(prov.size, 'profile field')} ${prov.size === 1 ? 'holds a provisional default' : 'hold provisional defaults'}, not confirmed facts. Review them in the <a href="${base}/plan">Business Plan</a> and <a href="${base}/settings">Settings</a>.`) : ''}
    <div class="stats" role="list">
      ${[
        stat('Open projects', projects.length, { href: `${base}/projects` }),
        stat('Open tasks', tasks.length, { href: `${base}/projects?view=tasks` }),
        stat('Overdue tasks', overdue.length, { href: `${base}/projects?view=tasks&overdue=1`, tone: overdue.length ? 'bad' : undefined }),
        stat('Blocked or waiting', blocked.length, { href: `${base}/projects?view=tasks&blocked=1`, tone: blocked.length ? 'warn' : undefined }),
        stat('Open milestones', milestones.length, { href: `${base}/milestones` }),
        stat('Unresolved risks', risks.length, { href: `${base}/risks` }),
        stat('Outstanding decisions', decisions.length, { href: `${base}/decisions` }),
        stat('Documents', docs.length, { href: `${base}/documents` }),
      ].map((s) => html`<div role="listitem">${s}</div>`)}
    </div>
    <div class="grid grid--2">
      ${section('Profile', definitionList([
        { label: 'Description', value: paragraphs(v.description ?? v.short_description), provisional: prov.has('description') },
        { label: 'Parent organization', value: 'NWPH' },
        { label: 'Relationship to NWPH', value: paragraphs(v.parent_relationship), provisional: prov.has('parent_relationship') },
        { label: 'Proposed operating locations', value: paragraphs(v.locations), provisional: prov.has('locations') },
        { label: 'Legal and organizational status', value: html`${statusBadge(LEGAL_STATUSES, v.legal_status)}${v.legal_status_detail ? paragraphs(v.legal_status_detail) : ''}` },
        { label: 'Operational status', value: statusBadge(OPERATIONAL_STATUSES, v.operational_status) },
      ]), { actions: ctx.can('write') ? linkButton(`${base}/settings`, 'Edit', 'ghost') : null })}
      <div>
        ${section('What happens next', html`
          ${v.next_actions ? html`<div class="prose">${paragraphs(v.next_actions)}</div>` : ''}
          ${tasks.length
            ? html`<ul class="list">${tasks.slice(0, 6).map((t) => html`<li class="list__item"><div class="list__main"><a href="/tasks/${t.id}/edit">${t.title}</a><span class="list__meta">${t.project_name ?? 'No project'}</span></div><span class="list__aside">${dueDate(t.due_date, isOverdue(t))}</span></li>`)}</ul>`
            : emptyState('No open tasks', 'Add the first concrete step for this venture.', ctx.can('write') ? linkButton(withVenture(v, '/tasks/new', `&return=${base}`), 'Add task') : null)}`,
          { actions: ctx.can('write') ? linkButton(withVenture(v, '/tasks/new', `&return=${base}`), 'Add task', 'ghost') : null })}
        ${section('Next milestone', milestones[0]
          ? html`<p><a href="/milestones/${milestones[0].id}/edit"><strong>${milestones[0].title}</strong></a></p><p>${dueDate(milestones[0].due_date, isOverdue(milestones[0]))}${milestones[0].task_total ? html` · ${milestones[0].task_done}/${milestones[0].task_total} tasks done` : ''}</p>`
          : emptyState('No milestones defined', 'Define a checkpoint that marks real progress.', ctx.can('write') ? linkButton(withVenture(v, '/milestones/new', `&return=${base}/milestones`), 'Define milestone') : null))}
      </div>
    </div>
    ${section('Financial planning', financeHeadline(sums), { actions: linkButton(`${base}/finance`, 'Details', 'ghost') })}
    ${section('Recent activity', activityList(listActivity({ ventureId: v.id, limit: 8 }), { compact: true, showVenture: false }), { actions: linkButton(`${base}/activity`, 'All activity', 'ghost') })}`;
}

function planSection(ctx: Context, v: Venture): SafeHtml {
  const prov = provisionalOf(v);
  const filled = PLAN_GROUPS.flatMap((g) => g.fields).filter((f) => (v as unknown as Record<string, unknown>)[f.name]).length;
  const total = PLAN_GROUPS.flatMap((g) => g.fields).length;
  return html`
    <p class="lede">The business plan is developed here in sections. ${filled} of ${total} sections have content. Nothing has been filled in on your behalf; fields marked provisional hold defaults that still need confirming.</p>
    ${PLAN_GROUPS.map((g) =>
      section(g.title, definitionList(g.fields.map((f) => ({ label: f.label, value: paragraphs((v as unknown as Record<string, string | null>)[f.name]), provisional: prov.has(f.name) }))), {
        id: `plan-${g.key}`,
        description: g.purpose,
        actions: ctx.can('write') ? linkButton(`/ventures/${v.slug}/plan/${g.key}/edit`, 'Edit', 'ghost') : null,
      }),
    )}`;
}

function projectsSection(ctx: Context, v: Venture): SafeHtml {
  const view = ['tasks', 'board'].includes(ctx.query.get('view') ?? '') ? ctx.query.get('view')! : 'projects';
  const overdue = ctx.query.get('overdue') === '1';
  const blocked = ctx.query.get('blocked') === '1';
  const base = `/ventures/${v.slug}/projects`;
  const toolbar = html`<div class="toolbar">${viewToggle(new URLSearchParams(), base, view, [['projects', 'Projects'], ['tasks', 'Task list'], ['board', 'Task board']])}
    ${ctx.can('write') ? html`<span class="toolbar__actions">${linkButton(withVenture(v, '/projects/new'), 'New project')}${linkButton(withVenture(v, '/tasks/new', `&return=${base}?view=tasks`), 'New task', 'primary')}</span>` : ''}</div>`;
  if (view === 'projects') {
    const projects = listProjects({ ventureId: v.id });
    const direct = listTasks({ ventureId: v.id }).filter((t) => !t.project_id);
    return html`${toolbar}${section('Projects', projectTable(projects, { showVenture: false }))}
      ${section('Tasks not in a project', taskTable(ctx, direct, { showVenture: false, showProject: false }), { description: 'Tasks attached directly to the venture.' })}`;
  }
  const tasks = listTasks({ ventureId: v.id, overdue, blocked });
  return html`${toolbar}
    ${filterBar({ action: base, hidden: { view }, checks: [{ name: 'overdue', label: 'Overdue', checked: overdue }, { name: 'blocked', label: 'Blocked or waiting', checked: blocked }] })}
    ${section('Tasks', view === 'board' ? taskBoard(ctx, tasks) : taskTable(ctx, tasks, { showVenture: false }))}`;
}

function financeSection(ctx: Context, v: Venture): SafeHtml {
  const scenario = ctx.query.get('scenario');
  const scenarios = listScenarios(v.id);
  const scenarioId = scenarios.some((s) => s.id === scenario) ? scenario! : null;
  const entries = listEntries({ ventureId: v.id });
  const sums = summarize(listEntries({ ventureId: v.id, scenarioId }));
  const prov = provisionalOf(v);
  return html`
    ${ctx.can('write') ? html`<div class="toolbar"><span class="toolbar__actions">
      ${linkButton(withVenture(v, '/finance/entries/new', `&type=startup_cost&return=/ventures/${v.slug}/finance`), 'Add startup cost')}
      ${linkButton(withVenture(v, '/finance/entries/new', `&type=funding_requirement&return=/ventures/${v.slug}/finance`), 'Add funding requirement')}
      ${linkButton(withVenture(v, '/finance/entries/new', `&type=funding&return=/ventures/${v.slug}/finance`), 'Add funding source')}
      ${linkButton(withVenture(v, '/finance/entries/new', `&return=/ventures/${v.slug}/finance`), 'Other entry', 'primary')}</span></div>` : ''}
    ${scenarios.length ? filterBar({ action: `/ventures/${v.slug}/finance`, selects: [{ name: 'scenario', label: 'Scenario', value: scenarioId ?? '', options: scenarios.map((s) => ({ value: s.id, label: `Baseline + ${s.name}` })) }] }) : ''}
    ${section(scenarioId ? 'Summary · baseline + scenario' : 'Summary · baseline plan', financeSummary(sums, `/finance/entries?venture=${v.slug}`))}
    ${section('All entries', entriesTable(entries, { showVenture: false }), { description: 'Every figure with its basis. Includes scenario entries.' })}
    ${section('Financial assumptions', definitionList(PLAN_GROUPS.find((g) => g.key === 'assumptions')!.fields.concat(PLAN_GROUPS.find((g) => g.key === 'model')!.fields.slice(2)).map((f) => ({ label: f.label, value: paragraphs((v as unknown as Record<string, string | null>)[f.name]), provisional: prov.has(f.name) }))), {
      id: 'assumptions',
      description: 'The reasoning behind the numbers.',
      actions: ctx.can('write') ? linkButton(`/ventures/${v.slug}/plan/assumptions/edit`, 'Edit', 'ghost') : null,
    })}`;
}

function fundingSection(ctx: Context, v: Venture): SafeHtml {
  const entries = listEntries({ ventureId: v.id }).filter((e) => e.entry_type === 'funding' || e.entry_type === 'funding_requirement');
  const opps = listOpportunities({ ventureId: v.id });
  const sums = summarize(listEntries({ ventureId: v.id, scenarioId: null }));
  return html`
    ${section('Funding position', sums.length ? financeHeadline(sums) : emptyState('No funding figures yet', 'Record the funding requirement and any potential sources. A potential source is never treated as secured.'), {
      actions: ctx.can('write') ? html`${linkButton(withVenture(v, '/finance/entries/new', `&type=funding_requirement&return=/ventures/${v.slug}/funding`), 'Add requirement', 'ghost')}${linkButton(withVenture(v, '/finance/entries/new', `&type=funding&return=/ventures/${v.slug}/funding`), 'Add funding source', 'ghost')}` : null,
    })}
    ${section('Funding entries', entriesTable(entries, { showVenture: false }))}
    ${section('Opportunities', opportunityTable(opps, { showVenture: false }), { actions: ctx.can('write') ? linkButton(withVenture(v, '/opportunities/new'), 'Add opportunity', 'primary') : null })}
    ${section('Potential funding sources (narrative)', html`<div class="prose">${paragraphs(v.funding_sources_notes) || html`<p class="muted">Not yet recorded.</p>`}</div>`, { actions: ctx.can('write') ? linkButton(`/ventures/${v.slug}/plan/assumptions/edit`, 'Edit', 'ghost') : null })}`;
}

function researchSection(ctx: Context, v: Venture): SafeHtml {
  const prov = provisionalOf(v);
  const q = ctx.query.get('q') ?? '';
  const docs = listDocuments({ ventureId: v.id, categories: RESEARCH_CATEGORIES, q });
  return html`
    ${section('Market analysis', definitionList(PLAN_GROUPS.find((g) => g.key === 'market')!.fields.map((f) => ({ label: f.label, value: paragraphs((v as unknown as Record<string, string | null>)[f.name]), provisional: prov.has(f.name) }))), {
      actions: ctx.can('write') ? linkButton(`/ventures/${v.slug}/plan/market/edit`, 'Edit', 'ghost') : null,
    })}
    ${filterBar({ action: `/ventures/${v.slug}/research`, q: { value: q, placeholder: 'Search research' }, note: SEARCH_LIMITATION })}
    ${section('Research library', documentTable(docs, { showVenture: false }), {
      description: `Documents in ${RESEARCH_CATEGORIES.join(', ')}.`,
      actions: ctx.can('write') ? linkButton(withVenture(v, '/documents/new', `&category=${encodeURIComponent('Market Research')}&return=/ventures/${v.slug}/research`), 'Add research', 'primary') : null,
    })}`;
}

function sectionBody(ctx: Context, v: Venture, key: string): SafeHtml {
  const base = `/ventures/${v.slug}`;
  switch (key) {
    case '':
      return overview(ctx, v);
    case 'plan':
      return planSection(ctx, v);
    case 'projects':
      return projectsSection(ctx, v);
    case 'milestones':
      return section('Milestones', milestoneTable(ctx, listMilestones({ ventureId: v.id }), { showVenture: false }), {
        description: 'Completing a milestone records progress. It never changes legal or operational status.',
        actions: ctx.can('write') ? linkButton(withVenture(v, '/milestones/new', `&return=${base}/milestones`), 'Define milestone', 'primary') : null,
      });
    case 'finance':
      return financeSection(ctx, v);
    case 'funding':
      return fundingSection(ctx, v);
    case 'research':
      return researchSection(ctx, v);
    case 'risks': {
      const risks = listRisks({ ventureId: v.id });
      return html`<div class="grid grid--sidebar">${section('Risk register', riskTable(risks, { showVenture: false }), { actions: ctx.can('write') ? linkButton(withVenture(v, '/risks/new', `&return=${base}/risks`), 'Add risk', 'primary') : null })}${section('Matrix', riskMatrix(risks) || html`<p class="muted">No active risks.</p>`)}</div>
        ${section('Dependencies', html`${dependencyList(ctx, listDependencies({ ventureId: v.id }), { showBlocked: true })}<p class="footnote">Add dependencies from a project, milestone or task page.</p>`)}
        ${section('Dependencies (narrative)', html`<div class="prose">${paragraphs(v.dependencies_notes) || html`<p class="muted">Not yet recorded.</p>`}</div>`, { actions: ctx.can('write') ? linkButton(`${base}/plan/execution/edit`, 'Edit', 'ghost') : null })}`;
    }
    case 'documents': {
      const q = ctx.query.get('q') ?? '';
      return html`${filterBar({ action: `${base}/documents`, q: { value: q, placeholder: 'Search this venture’s documents' }, note: SEARCH_LIMITATION })}
        ${section('Documents', documentTable(listDocuments({ ventureId: v.id, q }), { showVenture: false }), { actions: ctx.can('write') ? linkButton(withVenture(v, '/documents/new', `&return=${base}/documents`), 'Add document', 'primary') : null })}`;
    }
    case 'decisions':
      return section('Decisions', decisionTable(listDecisions({ ventureId: v.id }), { showVenture: false }), {
        actions: ctx.can('write') ? linkButton(withVenture(v, '/decisions/new'), 'New decision record', 'primary') : null,
      });
    case 'activity':
      return section('Activity history', activityList(listActivity({ ventureId: v.id, limit: 100 }), { showVenture: false }), { actions: linkButton(`/activity?venture=${v.slug}`, 'Full history', 'ghost') });
    case 'settings':
      return settingsSection(ctx, v);
    default:
      return notFound('Section');
  }
}

function settingsSection(ctx: Context, v: Venture, opts: { basicValues?: FormValues; basicErrors?: Errors; statusValues?: FormValues; statusErrors?: Errors; provisional?: Set<string> } = {}): SafeHtml {
  const history = stageHistory(v.id);
  const canWrite = ctx.can('write');
  return html`<div class="grid grid--sidebar"><div>
    ${section('Venture details', canWrite
      ? renderForm(ctx, {
          action: `/ventures/${v.slug}/details`,
          fields: VENTURE_BASIC_FIELDS,
          values: opts.basicValues ?? toFormValues(VENTURE_BASIC_FIELDS, v as unknown as Record<string, unknown>),
          errors: opts.basicErrors,
          submitLabel: 'Save details',
          fieldExtras: provisionalExtras(v, VENTURE_BASIC_FIELDS, opts.provisional),
        })
      : html`<p class="muted">Read-only.</p>`, { id: 'details' })}
    ${section('Legal and operational status', canWrite
      ? renderForm(ctx, {
          action: `/ventures/${v.slug}/status`,
          fields: VENTURE_STATUS_FIELDS,
          values: opts.statusValues ?? toFormValues(VENTURE_STATUS_FIELDS, v as unknown as Record<string, unknown>),
          errors: opts.statusErrors,
          submitLabel: 'Save status',
          before: notice('warn', html`These are independent of the development stage and are never changed automatically. Only owners can change legal status. Choose <strong>Operational</strong> only if the venture is actually trading.`),
        })
      : html`<p class="muted">Read-only.</p>`, { id: 'status' })}
  </div><div>
    ${section('Development stage', html`${canWrite
      ? html`<form method="post" action="/ventures/${v.slug}/stage" class="form form--compact">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <div class="field"><label for="stage">Move to stage</label><select id="stage" name="stage_id">${listStages().map((s) => html`<option value="${s.id}"${attrs({ selected: s.id === v.stage_id })}>${s.name}</option>`)}</select></div>
          <div class="field"><label for="note">Reason (recorded in history)</label><input id="note" name="note" maxlength="1000"></div>
          <div class="form__actions"><button type="submit" class="btn btn--secondary">Change stage</button></div>
          <p class="field__help">Stages are configured in <a href="/settings#stages">Settings</a>. Changing stage does not change legal or operational status.</p>
        </form>`
      : ''}
      <h3 class="h4">Stage history</h3>
      <ol class="timeline">${history.map((h) => html`<li class="timeline__item"><div class="timeline__head">${h.from_name ? `${h.from_name} → ` : ''}<strong>${h.to_name}</strong></div><p class="timeline__meta">${formatDate(h.changed_at)} · ${h.changed_by_name ?? 'System'}${h.note ? ` · ${h.note}` : ''}</p></li>`)}</ol>`, { id: 'stage' })}
    ${ctx.can('archive')
      ? section('Archive', html`<p class="muted">Archiving hides the venture from the portfolio and dashboard. All of its projects, finances, documents and history are kept and return unchanged if restored.</p>
          ${postButton(ctx, `/ventures/${v.slug}/${v.archived_at ? 'restore' : 'archive'}`, v.archived_at ? 'Restore venture' : 'Archive venture', { variant: v.archived_at ? 'secondary' : 'danger', confirm: v.archived_at ? undefined : `Archive ${v.name}? It can be restored at any time.` })}`)
      : ''}
  </div></div>`;
}

function planEditPage(ctx: Context, v: Venture, groupKey: string, values?: FormValues, errors: Errors = {}, provisional?: Set<string>): string {
  const g = PLAN_GROUPS.find((x) => x.key === groupKey) ?? notFound('Plan section');
  return workspace(
    ctx,
    v,
    'plan',
    `Edit ${g.title}`,
    section(`Edit: ${g.title}`, renderForm(ctx, {
      action: `/ventures/${v.slug}/plan/${g.key}`,
      fields: g.fields,
      values: values ?? toFormValues(g.fields, v as unknown as Record<string, unknown>),
      errors,
      submitLabel: 'Save section',
      cancelHref: `/ventures/${v.slug}/plan#plan-${g.key}`,
      fieldExtras: provisionalExtras(v, g.fields, provisional),
    }), { description: g.purpose }),
  );
}

const ventureOr404 = (ctx: Context): Venture => getVentureBySlug(ctx.params.slug!) ?? notFound('Venture');

// ── Routes ───────────────────────────────────────────────────────────────────

export function registerVentures(router: Router): void {
  router.get('/ventures', 'read', (ctx) => {
    const view = ctx.query.get('view') === 'list' ? 'list' : 'grid';
    const q = ctx.query.get('q') ?? '';
    const stage = ctx.query.get('stage') ?? '';
    const category = ctx.query.get('category') ?? '';
    const status = ctx.query.get('status') ?? '';
    const sort = (['name', 'created', 'updated', 'stage'] as const).find((s) => s === ctx.query.get('sort')) ?? 'name';
    const archived = ctx.query.get('archived') === '1';
    const list = listVentures({ q, stageId: stage, category, status, sort, archived });
    const params = new URLSearchParams(ctx.query);
    params.delete('view');
    const categories = [...new Set([...VENTURE_CATEGORIES, ...listCategoriesInUse()])];
    const body = html`${pageHeader({
      title: 'Venture Portfolio',
      lede: 'Every venture NWPH is developing or operating. Development stage, operational status and legal status are tracked separately.',
      actions: ctx.can('write') ? linkButton('/ventures/new', 'New venture', 'primary') : null,
    })}
    <div class="toolbar">${viewToggle(params, '/ventures', view, [['grid', 'Grid'], ['list', 'List']])}</div>
    ${filterBar({
      action: '/ventures',
      hidden: { view: view === 'list' ? 'list' : '' },
      q: { value: q, placeholder: 'Search ventures' },
      selects: [
        { name: 'stage', label: 'Stage', value: stage, options: stageOptions() },
        { name: 'category', label: 'Category', value: category, options: categories.map((c) => ({ value: c, label: c })) },
        { name: 'status', label: 'Operational status', value: status, options: OPERATIONAL_STATUSES },
        { name: 'sort', label: 'Sort by', emptyLabel: 'Name', value: sort === 'name' ? '' : sort, options: [{ value: 'created', label: 'Newest first' }, { value: 'updated', label: 'Recently updated' }, { value: 'stage', label: 'Development stage' }] },
      ],
      checks: [{ name: 'archived', label: 'Archived ventures', checked: archived }],
    })}
    ${list.length
      ? view === 'grid'
        ? html`<div class="cards">${list.map(ventureCard)}</div>`
        : section(`${list.length} ${list.length === 1 ? 'venture' : 'ventures'}`, ventureRows(list))
      : emptyState(archived ? 'No archived ventures' : 'No ventures match', archived ? 'Archived ventures appear here.' : 'Try clearing the filters, or create a venture.', ctx.can('write') && !archived ? linkButton('/ventures/new', 'New venture') : null)}`;
    return htmlReply(page(ctx, { title: 'Venture Portfolio', active: 'ventures', body }));
  });

  router.get('/ventures/new', 'write', (ctx) => htmlReply(newVenturePage(ctx, { stage_id: listStages()[0]?.id ?? '', operational_status: 'proposed', legal_status: 'not_established' })));
  router.post('/ventures', 'write', (ctx) => {
    const { values, errors } = parseFields(NEW_FIELDS, ctx.form);
    if (values.legal_status === 'established' && !ctx.can('admin')) errors.legal_status = 'Only an owner can record a venture as legally established.';
    if (Object.keys(errors).length) return htmlReply(newVenturePage(ctx, ctx.form.values(), errors), 422);
    try {
      const { stage_id, ...rest } = values;
      const v = createVenture(rest, stage_id as string, ctx.actor, ctx.user!.id);
      ctx.flash('success', `${v.name} created. Develop its plan and add the first project from here.`);
      return redirect(`/ventures/${v.slug}`);
    } catch (err) {
      if (err instanceof ValidationError) return htmlReply(newVenturePage(ctx, ctx.form.values(), err.errors), 422);
      throw err;
    }
  });

  router.get('/ventures/:slug/plan/:group/edit', 'write', (ctx) => htmlReply(planEditPage(ctx, ventureOr404(ctx), ctx.params.group!)));
  router.post('/ventures/:slug/plan/:group', 'write', (ctx) => {
    const v = ventureOr404(ctx);
    const g = PLAN_GROUPS.find((x) => x.key === ctx.params.group) ?? notFound('Plan section');
    const provisional = new Set(ctx.form.getAll('provisional'));
    const { values, errors } = parseFields(g.fields, ctx.form);
    if (Object.keys(errors).length) return htmlReply(planEditPage(ctx, v, g.key, ctx.form.values(), errors, provisional), 422);
    updateVenture(v.id, values, provisional, ctx.actor);
    ctx.flash('success', `${g.title} saved.`);
    return redirect(`/ventures/${v.slug}/plan#plan-${g.key}`);
  });

  router.post('/ventures/:slug/details', 'write', (ctx) => {
    const v = ventureOr404(ctx);
    const provisional = new Set(ctx.form.getAll('provisional'));
    const { values, errors } = parseFields(VENTURE_BASIC_FIELDS, ctx.form);
    const rerender = (e: Errors) => htmlReply(workspace(ctx, v, 'settings', 'Settings', html`${errorSummary(e, VENTURE_BASIC_FIELDS)}${settingsSection(ctx, v, { basicValues: ctx.form.values(), basicErrors: e, provisional })}`), 422);
    if (Object.keys(errors).length) return rerender(errors);
    try {
      updateVenture(v.id, values, provisional, ctx.actor);
    } catch (err) {
      if (err instanceof ValidationError) return rerender(err.errors);
      throw err;
    }
    ctx.flash('success', 'Venture details saved.');
    return redirect(`/ventures/${v.slug}/settings`);
  });

  router.post('/ventures/:slug/status', 'write', (ctx) => {
    const v = ventureOr404(ctx);
    const { values, errors } = parseFields(VENTURE_STATUS_FIELDS, ctx.form);
    if (values.legal_status !== v.legal_status && !ctx.can('admin')) errors.legal_status = 'Only an owner can change legal status.';
    if (Object.keys(errors).length) {
      return htmlReply(workspace(ctx, v, 'settings', 'Settings', settingsSection(ctx, v, { statusValues: ctx.form.values(), statusErrors: errors })), 422);
    }
    updateVenture(v.id, values, null, ctx.actor);
    ctx.flash('success', 'Status saved. The change is recorded in the activity history.');
    return redirect(`/ventures/${v.slug}/settings`);
  });

  router.post('/ventures/:slug/stage', 'write', (ctx) => {
    const v = ventureOr404(ctx);
    try {
      changeStage(v.id, ctx.form.get('stage_id'), ctx.form.get('note'), ctx.actor);
      const after = getVentureBySlug(v.slug)!;
      ctx.flash('success', after.stage_id === v.stage_id ? 'Stage unchanged.' : `Moved to ${after.stage_name}. Legal and operational status are unchanged.`);
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      ctx.flash('error', Object.values(err.errors)[0]!);
    }
    return redirect(`/ventures/${v.slug}/settings`);
  });

  router.post('/ventures/:slug/archive', 'archive', (ctx) => {
    const v = ventureOr404(ctx);
    archiveVenture(v.id, ctx.actor);
    ctx.flash('success', `${v.name} archived. Its records are preserved and it can be restored from the portfolio’s archived view.`);
    return redirect('/ventures');
  });
  router.post('/ventures/:slug/restore', 'archive', (ctx) => {
    const v = ventureOr404(ctx);
    restoreVenture(v.id, ctx.actor);
    ctx.flash('success', `${v.name} restored.`);
    return redirect(`/ventures/${v.slug}`);
  });

  router.get('/ventures/:slug', 'read', (ctx) => {
    const v = ventureOr404(ctx);
    return htmlReply(workspace(ctx, v, '', 'Overview', sectionBody(ctx, v, '')));
  });
  router.get('/ventures/:slug/:section', 'read', (ctx) => {
    const v = ventureOr404(ctx);
    const entry = SECTIONS.find(([k]) => k === ctx.params.section && k !== '');
    if (!entry) throw new HttpError(404, 'Section not found.');
    return htmlReply(workspace(ctx, v, entry[0], entry[1], sectionBody(ctx, v, entry[0])));
  });
}
