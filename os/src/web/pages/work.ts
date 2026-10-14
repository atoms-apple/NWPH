import { html, attrs, paragraphs, type SafeHtml } from '../../lib/html.ts';
import { formatDate } from '../../lib/time.ts';
import { htmlReply, redirect, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import {
  PROJECT_FIELDS,
  TASK_FIELDS,
  MILESTONE_FIELDS,
  listProjects,
  getProject,
  createProject,
  updateProject,
  listTasks,
  getTask,
  createTask,
  updateTask,
  setTaskStatus,
  listMilestones,
  getMilestone,
  createMilestone,
  updateMilestone,
  setMilestoneStatus,
  archiveWork,
  listDependencies,
  createDependency,
  setDependencyStatus,
  getDependency,
  recordOptions,
  isOverdue,
  type Task,
  type Project,
  type Milestone,
  type Dependency,
  type BlockedKind,
  type PrereqKind,
} from '../../domain/work.ts';
import { PROJECT_STATUSES, TASK_STATUSES, TASK_PRIORITIES, MILESTONE_STATUSES, DEPENDENCY_EXTERNAL, ENTRY_TYPES, labelOf } from '../../domain/vocabulary.ts';
import { ValidationError, type Errors } from '../../domain/fields.ts';
import { listActivity } from '../../domain/records.ts';
import { listEntries, summarize } from '../../domain/finance.ts';
import { listRisks } from '../../domain/risks.ts';
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
  dueDate,
  date,
  scopeLink,
  exampleBadge,
  archivedBadge,
  viewToggle,
  notice,
  pluralise,
} from '../ui.ts';
import { renderForm, toFormValues, type FormValues } from '../forms.ts';
import { submit, refOptions, prefill, returnTo, notFound, ventureScope, ventureFilterOptions, currentPath, archiveReply } from '../common.ts';
import { activityList } from './activity.ts';
import { riskTable } from './risks.ts';
import { formatMoney } from '../../lib/money.ts';

// ── Reusable renderers (also used by venture workspaces) ─────────────────────

function statusSelect(ctx: Context, t: Task, back: string): SafeHtml {
  if (!ctx.can('write')) return statusBadge(TASK_STATUSES, t.status);
  return html`<form method="post" action="/tasks/${t.id}/status" class="status-form">
    <input type="hidden" name="_csrf" value="${ctx.csrf}"><input type="hidden" name="_return" value="${back}">
    <label class="visually-hidden" for="st-${t.id}">Status of ${t.title}</label>
    <select id="st-${t.id}" name="status" data-autosubmit class="${`select--${t.status}`}">
      ${TASK_STATUSES.map((s) => html`<option value="${s.value}"${attrs({ selected: s.value === t.status })}>${s.label}</option>`)}
    </select>
    <button type="submit" class="btn btn--small btn--ghost js-hide">Set</button>
  </form>`;
}

function taskFlags(t: Task): SafeHtml {
  return html`${t.open_dependencies ? badge(`Waiting on ${pluralise(t.open_dependencies, 'dependency', 'dependencies')}`, 'warn') : ''}${exampleBadge(t.is_example)}${archivedBadge(t.archived_at)}`;
}

export function taskTable(ctx: Context, tasks: Task[], opts: { showVenture?: boolean; showProject?: boolean; back?: string } = {}): SafeHtml {
  if (!tasks.length) return emptyState('No tasks', 'Tasks matching this view will appear here.');
  const back = opts.back ?? currentPath(ctx);
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Task</th>${opts.showVenture !== false ? html`<th scope="col">Venture</th>` : ''}${opts.showProject !== false ? html`<th scope="col">Project</th>` : ''}<th scope="col">Priority</th><th scope="col">Due</th><th scope="col">Status</th></tr></thead>
    <tbody>${tasks.map(
      (t) => html`<tr class="${t.status === 'completed' || t.status === 'cancelled' ? 'is-done' : ''}">
        <th scope="row" data-label="Task"><a href="/tasks/${t.id}/edit">${t.title}</a> ${taskFlags(t)}${t.assignee_name ? html`<span class="cell-meta">${t.assignee_name}</span>` : ''}${t.milestone_title ? html`<span class="cell-meta">Milestone: ${t.milestone_title}</span>` : ''}</th>
        ${opts.showVenture !== false ? html`<td data-label="Venture">${scopeLink(t)}</td>` : ''}
        ${opts.showProject !== false ? html`<td data-label="Project">${t.project_id ? html`<a href="/projects/${t.project_id}">${t.project_name}</a>` : html`<span class="muted">—</span>`}</td>` : ''}
        <td data-label="Priority">${statusBadge(TASK_PRIORITIES, t.priority)}</td>
        <td data-label="Due">${dueDate(t.due_date, isOverdue(t))}</td>
        <td data-label="Status">${statusSelect(ctx, t, back)}</td>
      </tr>`,
    )}</tbody></table></div>`;
}

export function taskBoard(ctx: Context, tasks: Task[], opts: { back?: string } = {}): SafeHtml {
  const back = opts.back ?? currentPath(ctx);
  return html`<div class="board">${TASK_STATUSES.map((s) => {
    const col = tasks.filter((t) => t.status === s.value);
    return html`<section class="board__col" aria-labelledby="col-${s.value}">
      <h3 id="col-${s.value}" class="board__title">${s.label} <span class="board__count">${col.length}</span></h3>
      <ul class="board__cards">${col.map(
        (t) => html`<li class="card card--task">
          <a href="/tasks/${t.id}/edit" class="card__title">${t.title}</a>
          <p class="card__meta">${t.venture_name ?? 'NWPH'}${t.project_name ? ` · ${t.project_name}` : ''}</p>
          <div class="card__badges">${statusBadge(TASK_PRIORITIES, t.priority)} ${t.due_date ? html`<span class="${isOverdue(t) ? 'overdue small' : 'small muted'}">Due ${formatDate(t.due_date)}</span>` : ''} ${taskFlags(t)}</div>
          ${statusSelect(ctx, t, back)}
        </li>`,
      )}</ul>
    </section>`;
  })}</div>`;
}

export function projectTable(projects: Project[], opts: { showVenture?: boolean } = {}): SafeHtml {
  if (!projects.length) return emptyState('No projects', 'Projects group related tasks and milestones toward a goal.');
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Project</th>${opts.showVenture !== false ? html`<th scope="col">Venture</th>` : ''}<th scope="col">Status</th><th scope="col">Open tasks</th><th scope="col">Target</th></tr></thead>
    <tbody>${projects.map(
      (p) => html`<tr>
        <th scope="row" data-label="Project"><a href="/projects/${p.id}">${p.name}</a> ${exampleBadge(p.is_example)}${archivedBadge(p.archived_at)}${p.owner_name ? html`<span class="cell-meta">${p.owner_name}</span>` : ''}</th>
        ${opts.showVenture !== false ? html`<td data-label="Venture">${scopeLink(p)}</td>` : ''}
        <td data-label="Status">${statusBadge(PROJECT_STATUSES, p.status)}</td>
        <td data-label="Open tasks">${p.task_open} of ${p.task_total}${p.task_overdue ? html` ${badge(`${p.task_overdue} overdue`, 'bad')}` : ''}</td>
        <td data-label="Target">${date(p.target_date)}</td>
      </tr>`,
    )}</tbody></table></div>`;
}

export function milestoneTable(ctx: Context, milestones: Milestone[], opts: { showVenture?: boolean } = {}): SafeHtml {
  if (!milestones.length) return emptyState('No milestones', 'Milestones mark checkpoints of real progress. Completing one does not change legal or operational status.');
  const back = currentPath(ctx);
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Milestone</th>${opts.showVenture !== false ? html`<th scope="col">Venture</th>` : ''}<th scope="col">Project</th><th scope="col">Tasks</th><th scope="col">Target</th><th scope="col">Status</th></tr></thead>
    <tbody>${milestones.map(
      (m) => html`<tr class="${m.status === 'completed' || m.status === 'cancelled' ? 'is-done' : ''}">
        <th scope="row" data-label="Milestone"><a href="/milestones/${m.id}/edit">${m.title}</a> ${exampleBadge(m.is_example)}</th>
        ${opts.showVenture !== false ? html`<td data-label="Venture">${scopeLink(m)}</td>` : ''}
        <td data-label="Project">${m.project_id ? html`<a href="/projects/${m.project_id}">${m.project_name}</a>` : html`<span class="muted">—</span>`}</td>
        <td data-label="Tasks">${m.task_total ? `${m.task_done}/${m.task_total} done` : html`<span class="muted">None linked</span>`}</td>
        <td data-label="Target">${m.status === 'completed' ? html`Completed ${date(m.completed_on)}` : dueDate(m.due_date, isOverdue(m))}</td>
        <td data-label="Status">${statusBadge(MILESTONE_STATUSES, m.status)}
          ${ctx.can('write') && m.status !== 'completed' && m.status !== 'cancelled' ? postButton(ctx, `/milestones/${m.id}/status`, 'Mark complete', { variant: 'link', fields: { status: 'completed', _return: back } }) : ''}</td>
      </tr>`,
    )}</tbody></table></div>`;
}

const PREREQ_LABELS: Record<PrereqKind, string> = {
  project: 'Project',
  milestone: 'Milestone',
  task: 'Task',
  decision: 'Decision',
  opportunity: 'Funding / opportunity',
  external: 'External',
};
const PREREQ_PATH: Record<string, string> = { project: '/projects/', milestone: '/milestones/', task: '/tasks/', decision: '/decisions/', opportunity: '/opportunities/' };

export function dependencyList(ctx: Context, deps: Dependency[], opts: { showBlocked?: boolean } = {}): SafeHtml {
  if (!deps.length) return html`<p class="muted">No dependencies recorded.</p>`;
  const back = currentPath(ctx);
  return html`<ul class="list">${deps.map((d) => {
    const prereqHref = d.prereq_id ? `${PREREQ_PATH[d.prereq_kind]}${d.prereq_id}${['task', 'milestone'].includes(d.prereq_kind) ? '/edit' : ''}` : null;
    const blockedHref = `${PREREQ_PATH[d.blocked_kind]}${d.blocked_id}${d.blocked_kind === 'project' ? '' : '/edit'}`;
    const state = d.status === 'resolved' ? badge('Resolved', 'good') : d.prerequisite_met ? badge('Prerequisite met — confirm & resolve', 'info') : badge('Open', 'warn');
    return html`<li class="list__item">
      <div class="list__main">
        ${opts.showBlocked ? html`<span><a href="${blockedHref}">${d.blocked_label}</a> depends on</span> ` : html`<span class="muted">Depends on</span> `}
        <span>${d.prereq_kind === 'external' ? html`${labelOf(DEPENDENCY_EXTERNAL, d.external_type)}: ${d.prereq_label}` : html`${PREREQ_LABELS[d.prereq_kind]}: <a href="${prereqHref}">${d.prereq_label}</a>`}</span>
        ${d.prereq_kind !== 'external' && d.description ? html`<span class="list__meta">${d.description}</span>` : ''}
      </div>
      <span class="list__aside">${state}
        ${ctx.can('write') ? postButton(ctx, `/dependencies/${d.id}/status`, d.status === 'open' ? 'Resolve' : 'Reopen', { variant: 'link', fields: { status: d.status === 'open' ? 'resolved' : 'open', _return: back } }) : ''}</span>
    </li>`;
  })}</ul>`;
}

// ── Forms ────────────────────────────────────────────────────────────────────

type Kind = 'project' | 'task' | 'milestone';
const FIELDS: Record<Kind, typeof TASK_FIELDS> = { project: PROJECT_FIELDS, task: TASK_FIELDS, milestone: MILESTONE_FIELDS };
const LABEL: Record<Kind, string> = { project: 'project', task: 'task', milestone: 'milestone' };

function formPage(ctx: Context, kind: Kind, opts: { id?: string; values: FormValues; errors?: Errors; side?: SafeHtml; title?: string }): string {
  const fields = FIELDS[kind];
  const editing = Boolean(opts.id);
  const action = editing ? `/${kind}s/${opts.id}` : `/${kind}s`;
  const back = returnTo(ctx, kind === 'project' && opts.id ? `/projects/${opts.id}` : '/projects');
  const form = renderForm(ctx, {
    action,
    fields,
    values: opts.values,
    errors: opts.errors,
    refs: refOptions(fields, opts.values),
    submitLabel: editing ? 'Save changes' : `Create ${LABEL[kind]}`,
    cancelHref: back,
    hidden: { _return: back },
    before:
      kind !== 'project'
        ? html`<p class="form__hint">If you choose a project, the venture is taken from the project.</p>`
        : null,
  });
  return page(ctx, {
    title: opts.title ?? (editing ? `Edit ${LABEL[kind]}` : `New ${LABEL[kind]}`),
    active: 'projects',
    body: html`${pageHeader({ title: opts.title ?? (editing ? `Edit ${LABEL[kind]}` : `New ${LABEL[kind]}`), eyebrow: 'Projects & Tasks' })}
      <div class="${opts.side ? 'split' : ''}">${section('Details', form)}${opts.side ?? ''}</div>`,
  });
}

function dependencyForm(ctx: Context, blockedKind: BlockedKind, blockedId: string, ventureId: string | null, errors: Errors = {}, values: FormValues = {}): SafeHtml {
  const groups: Array<[Exclude<PrereqKind, 'external'>, string]> = [
    ['task', 'Tasks'],
    ['milestone', 'Milestones'],
    ['project', 'Projects'],
    ['decision', 'Decisions'],
    ['opportunity', 'Funding & opportunities'],
  ];
  return html`<form method="post" action="/dependencies" class="form form--compact">
    <input type="hidden" name="_csrf" value="${ctx.csrf}">
    <input type="hidden" name="blocked" value="${blockedKind}:${blockedId}">
    <input type="hidden" name="_return" value="${currentPath(ctx)}">
    ${Object.keys(errors).length ? notice('error', html`<ul>${Object.values(errors).map((e) => html`<li>${e}</li>`)}</ul>`) : ''}
    <div class="field"><label for="dep-prereq">Depends on</label>
      <select id="dep-prereq" name="prereq" required>
        <option value="">Choose…</option>
        <option value="external"${attrs({ selected: values.prereq === 'external' })}>An external condition (funding decision, supplier, approval…)</option>
        ${groups.map(([kind, label]) => {
          const opts = recordOptions(kind, ventureId).filter((o) => !(kind === blockedKind && o.value === blockedId));
          return opts.length
            ? html`<optgroup label="${label}">${opts.map((o) => html`<option value="${kind}:${o.value}"${attrs({ selected: values.prereq === `${kind}:${o.value}` })}>${o.label}</option>`)}</optgroup>`
            : '';
        })}
      </select></div>
    <div class="field"><label for="dep-ext">If external: type</label>
      <select id="dep-ext" name="external_type"><option value="">—</option>${DEPENDENCY_EXTERNAL.map((o) => html`<option value="${o.value}"${attrs({ selected: values.external_type === o.value })}>${o.label}</option>`)}</select></div>
    <div class="field field--wide"><label for="dep-desc">Description</label><input id="dep-desc" name="description" maxlength="2000" value="${values.description ?? ''}" placeholder="Required for external conditions, e.g. “Transport Canada operating certificate issued”"></div>
    <div class="form__actions"><button class="btn btn--secondary" type="submit">Add dependency</button></div>
  </form>`;
}

function dependencyPanel(ctx: Context, kind: BlockedKind, id: string, ventureId: string | null): SafeHtml {
  const deps = listDependencies({ blockedKind: kind, blockedId: id, ventureId: ventureId ?? undefined });
  return section(
    'Dependencies',
    html`${dependencyList(ctx, deps)}${ctx.can('write') ? html`<details class="disclosure"><summary>Add a dependency</summary>${dependencyForm(ctx, kind, id, ventureId)}</details>` : ''}`,
    { id: 'deps', description: 'What this depends on before it can proceed.' },
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────

export function registerWork(router: Router): void {
  router.get('/projects', 'read', (ctx) => {
    const view = ['projects', 'tasks', 'board', 'milestones'].includes(ctx.query.get('view') ?? '') ? ctx.query.get('view')! : 'projects';
    const scope = ventureScope(ctx);
    const q = ctx.query.get('q') ?? '';
    const status = ctx.query.get('status') ?? '';
    const priority = ctx.query.get('priority') ?? '';
    const overdue = ctx.query.get('overdue') === '1';
    const blocked = ctx.query.get('blocked') === '1';
    const archived = ctx.query.get('archived') === '1';
    const base = { ventureId: scope.ventureId, scope: scope.scope, q, archived };

    let content: SafeHtml;
    let filters: SafeHtml;
    const ventureSelect = { name: 'venture', label: 'Venture', value: scope.slug, options: ventureFilterOptions() };
    const archivedCheck = { name: 'archived', label: 'Archived only', checked: archived };
    if (view === 'projects') {
      filters = filterBar({ action: '/projects', hidden: { view }, q: { value: q, placeholder: 'Search projects' }, selects: [ventureSelect, { name: 'status', label: 'Status', value: status, options: PROJECT_STATUSES }], checks: [archivedCheck] });
      content = projectTable(listProjects({ ...base, status }));
    } else if (view === 'milestones') {
      filters = filterBar({ action: '/projects', hidden: { view }, selects: [ventureSelect, { name: 'status', label: 'Status', value: status, options: MILESTONE_STATUSES }], checks: [archivedCheck] });
      content = milestoneTable(ctx, listMilestones({ ...base, status }));
    } else {
      filters = filterBar({
        action: '/projects',
        hidden: { view },
        q: { value: q, placeholder: 'Search tasks' },
        selects: [ventureSelect, ...(view === 'tasks' ? [{ name: 'status', label: 'Status', value: status, options: TASK_STATUSES }] : []), { name: 'priority', label: 'Priority', value: priority, options: TASK_PRIORITIES }],
        checks: [{ name: 'overdue', label: 'Overdue', checked: overdue }, { name: 'blocked', label: 'Blocked or waiting', checked: blocked }, archivedCheck],
      });
      const tasks = listTasks({ ...base, status: view === 'tasks' ? status : null, priority, overdue, blocked });
      content = view === 'board' ? (tasks.length ? taskBoard(ctx, tasks) : emptyState('No tasks', 'Tasks matching this view will appear here.')) : taskTable(ctx, tasks);
    }

    const body = html`${pageHeader({
      title: 'Projects & Tasks',
      lede: 'Work across NWPH and every venture. Projects contain tasks and milestones; tasks can also sit directly under a venture.',
      actions: ctx.can('write')
        ? html`${linkButton(`/projects/new${scope.slug && scope.slug !== 'parent' ? `?venture=${scope.slug}` : ''}`, 'New project')}${linkButton(`/milestones/new${scope.slug && scope.slug !== 'parent' ? `?venture=${scope.slug}` : ''}`, 'New milestone')}${linkButton(`/tasks/new${scope.slug && scope.slug !== 'parent' ? `?venture=${scope.slug}` : ''}`, 'New task', 'primary')}`
        : null,
    })}
    <div class="toolbar">${viewToggle(new URLSearchParams(scope.slug ? { venture: scope.slug } : {}), '/projects', view, [['projects', 'Projects'], ['milestones', 'Milestones'], ['tasks', 'Task list'], ['board', 'Task board']])}</div>
    ${filters}
    ${section(view === 'projects' ? 'Projects' : view === 'milestones' ? 'Milestones' : 'Tasks', content)}`;
    return htmlReply(page(ctx, { title: 'Projects & Tasks', active: 'projects', body }));
  });

  // Projects
  router.get('/projects/new', 'write', (ctx) => htmlReply(formPage(ctx, 'project', { values: prefill(ctx, { status: 'planned' }) })));
  router.post('/projects', 'write', (ctx) =>
    submit(ctx, PROJECT_FIELDS, (values) => {
      const id = createProject(values, ctx.actor);
      ctx.flash('success', 'Project created. Add tasks and milestones below.');
      return redirect(`/projects/${id}`);
    }, (values, errors) => formPage(ctx, 'project', { values, errors })),
  );
  router.get('/projects/:id', 'read', (ctx) => {
    const p = getProject(ctx.params.id!) ?? notFound('Project');
    const tasks = listTasks({ projectId: p.id, ventureId: p.venture_id ?? undefined });
    const milestones = listMilestones({ projectId: p.id, ventureId: p.venture_id ?? undefined });
    const entries = listEntries({ projectId: p.id, ventureId: p.venture_id ?? undefined, scenarioId: null });
    const sums = summarize(entries);
    const risks = listRisks({ ventureId: p.venture_id ?? undefined, scope: p.venture_id ? null : 'parent' }).filter((r) => r.project_id === p.id);
    const view = ctx.query.get('view') === 'board' ? 'board' : 'list';
    const venture = p.venture_slug ? `venture=${p.venture_slug}&` : '';
    const body = html`${pageHeader({
      eyebrow: html`${p.venture_slug ? html`<a href="/ventures/${p.venture_slug}/projects">${p.venture_name}</a>` : 'NWPH (parent organization)'} · Project`,
      title: p.name,
      meta: html`${statusBadge(PROJECT_STATUSES, p.status)} ${exampleBadge(p.is_example)} ${archivedBadge(p.archived_at)}`,
      actions: html`${ctx.can('write') ? linkButton(`/projects/${p.id}/edit`, 'Edit') : ''}${ctx.can('archive') ? postButton(ctx, `/projects/${p.id}/${p.archived_at ? 'restore' : 'archive'}`, p.archived_at ? 'Restore' : 'Archive', { variant: 'ghost', confirm: p.archived_at ? undefined : 'Archive this project? Its tasks and milestones stay linked and it can be restored.' }) : ''}`,
    })}
    <div class="grid grid--sidebar">
      <div>
        ${section('Tasks', html`<div class="toolbar">${viewToggle(new URLSearchParams(), `/projects/${p.id}`, view, [['list', 'List'], ['board', 'Board']])}</div>${view === 'board' ? taskBoard(ctx, tasks) : taskTable(ctx, tasks, { showVenture: false, showProject: false })}`, {
          id: 'tasks',
          actions: ctx.can('write') ? linkButton(`/tasks/new?${venture}project=${p.id}&return=/projects/${p.id}`, 'Add task', 'primary') : null,
        })}
        ${section('Milestones', milestoneTable(ctx, milestones, { showVenture: false }), {
          id: 'milestones',
          actions: ctx.can('write') ? linkButton(`/milestones/new?${venture}project=${p.id}&return=/projects/${p.id}`, 'Add milestone') : null,
        })}
        ${dependencyPanel(ctx, 'project', p.id, p.venture_id)}
      </div>
      <div>
        ${section('About', definitionList([
          { label: 'Responsible person', value: p.owner_name },
          { label: 'Start', value: date(p.start_date) },
          { label: 'Target', value: date(p.target_date) },
          ...(p.completed_on ? [{ label: 'Completed', value: date(p.completed_on) }] : []),
          { label: 'Description', value: paragraphs(p.description) },
          { label: 'Notes', value: paragraphs(p.notes) },
        ]))}
        ${section('Project budget', sums.length
          ? html`${sums.map((s) => html`<dl class="deflist">${s.rows.filter((r) => r.forecast.count + r.budget.count + r.actual.count + r.verified.count).map((r) => html`<div class="deflist__row"><dt>${labelOf(ENTRY_TYPES, r.type)}</dt>
              <dd>${r.forecast.count ? html`<span>${formatMoney(r.forecast.total, s.currency)} forecast</span><br>` : ''}${r.budget.count ? html`<span>${formatMoney(r.budget.total, s.currency)} budget</span><br>` : ''}${r.actual.count + r.verified.count ? html`<span>${formatMoney(r.actual.total + r.verified.total, s.currency)} actual</span>` : ''}</dd></div>`)}</dl>`)}
             <p><a href="/finance/entries?project=${p.id}">View entries</a></p>`
          : html`<p class="muted">No financial entries linked to this project.</p>`, {
          actions: ctx.can('write') ? linkButton(`/finance/entries/new?${venture}project=${p.id}&return=/projects/${p.id}`, 'Add entry', 'ghost') : null,
        })}
        ${risks.length ? section('Risks', riskTable(risks, { showVenture: false, compact: true })) : ''}
        ${section('History', activityList(listActivity({ entityType: 'project', entityId: p.id, limit: 20 }), { showVenture: false }))}
      </div>
    </div>`;
    return htmlReply(page(ctx, { title: p.name, active: 'projects', body }));
  });
  router.get('/projects/:id/edit', 'write', (ctx) => {
    const p = getProject(ctx.params.id!) ?? notFound('Project');
    return htmlReply(formPage(ctx, 'project', { id: p.id, values: toFormValues(PROJECT_FIELDS, p as unknown as Record<string, unknown>) }));
  });
  router.post('/projects/:id', 'write', (ctx) => {
    const p = getProject(ctx.params.id!) ?? notFound('Project');
    return submit(ctx, PROJECT_FIELDS, (values) => {
      updateProject(p.id, values, ctx.actor);
      ctx.flash('success', 'Project saved.');
      return redirect(`/projects/${p.id}`);
    }, (values, errors) => formPage(ctx, 'project', { id: p.id, values, errors }));
  });

  // Tasks
  router.get('/tasks/new', 'write', (ctx) => htmlReply(formPage(ctx, 'task', { values: prefill(ctx, { status: 'not_started', priority: 'normal' }) })));
  router.post('/tasks', 'write', (ctx) =>
    submit(ctx, TASK_FIELDS, (values) => {
      createTask(values, ctx.actor);
      ctx.flash('success', `Task “${values.title}” created.`);
      return redirect(returnTo(ctx, '/projects?view=tasks'));
    }, (values, errors) => formPage(ctx, 'task', { values, errors })),
  );
  router.get('/tasks/:id', 'read', (ctx) => redirect(`/tasks/${ctx.params.id}/edit`));
  router.get('/tasks/:id/edit', 'read', (ctx) => {
    const t = getTask(ctx.params.id!) ?? notFound('Task');
    const side = html`<div>
      ${section('Status', html`${definitionList([
        { label: 'Status', value: statusBadge(TASK_STATUSES, t.status) },
        { label: 'Venture', value: scopeLink(t) },
        { label: 'Project', value: t.project_id ? html`<a href="/projects/${t.project_id}">${t.project_name}</a>` : null },
        ...(t.completed_on ? [{ label: 'Completed', value: date(t.completed_on) }] : []),
      ])}
      ${ctx.can('archive') ? postButton(ctx, `/tasks/${t.id}/${t.archived_at ? 'restore' : 'archive'}`, t.archived_at ? 'Restore task' : 'Archive task', { variant: 'ghost', confirm: t.archived_at ? undefined : 'Archive this task? It can be restored later.' }) : ''}`)}
      ${dependencyPanel(ctx, 'task', t.id, t.venture_id)}
      ${section('History', activityList(listActivity({ entityType: 'task', entityId: t.id, limit: 20 }), { showVenture: false }))}
    </div>`;
    if (!ctx.can('write')) {
      return htmlReply(page(ctx, { title: t.title, active: 'projects', body: html`${pageHeader({ title: t.title, eyebrow: 'Task' })}<div class="split">${section('Details', definitionList(TASK_FIELDS.map((f) => ({ label: f.label, value: String((t as unknown as Record<string, unknown>)[f.name] ?? '') }))))}${side}</div>` }));
    }
    return htmlReply(formPage(ctx, 'task', { id: t.id, values: toFormValues(TASK_FIELDS, t as unknown as Record<string, unknown>), side, title: 'Edit task' }));
  });
  router.post('/tasks/:id', 'write', (ctx) => {
    const t = getTask(ctx.params.id!) ?? notFound('Task');
    return submit(ctx, TASK_FIELDS, (values) => {
      updateTask(t.id, values, ctx.actor);
      ctx.flash('success', 'Task saved.');
      return redirect(returnTo(ctx, t.project_id ? `/projects/${t.project_id}` : '/projects?view=tasks'));
    }, (values, errors) => formPage(ctx, 'task', { id: t.id, values, errors, title: 'Edit task' }));
  });
  router.post('/tasks/:id/status', 'write', (ctx) => {
    const t = getTask(ctx.params.id!) ?? notFound('Task');
    try {
      setTaskStatus(t.id, ctx.form.get('status'), ctx.actor);
      ctx.flash('success', `“${t.title}” is now ${labelOf(TASK_STATUSES, ctx.form.get('status')).toLowerCase()}.`);
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      ctx.flash('error', Object.values(err.errors)[0] ?? 'Could not update the task.');
    }
    return redirect(returnTo(ctx, '/projects?view=tasks'));
  });

  // Milestones
  router.get('/milestones/new', 'write', (ctx) => htmlReply(formPage(ctx, 'milestone', { values: prefill(ctx, { status: 'planned' }) })));
  router.post('/milestones', 'write', (ctx) =>
    submit(ctx, MILESTONE_FIELDS, (values) => {
      createMilestone(values, ctx.actor);
      ctx.flash('success', `Milestone “${values.title}” added.`);
      return redirect(returnTo(ctx, '/projects?view=milestones'));
    }, (values, errors) => formPage(ctx, 'milestone', { values, errors })),
  );
  router.get('/milestones/:id', 'read', (ctx) => redirect(`/milestones/${ctx.params.id}/edit`));
  router.get('/milestones/:id/edit', 'read', (ctx) => {
    const m = getMilestone(ctx.params.id!) ?? notFound('Milestone');
    const tasks = listTasks({ milestoneId: m.id, ventureId: m.venture_id ?? undefined });
    const side = html`<div>
      ${section('Linked tasks', taskTable(ctx, tasks, { showVenture: false }), { actions: ctx.can('write') ? linkButton(`/tasks/new?milestone=${m.id}${m.project_id ? `&project=${m.project_id}` : ''}${m.venture_slug ? `&venture=${m.venture_slug}` : ''}`, 'Add task', 'ghost') : null })}
      ${dependencyPanel(ctx, 'milestone', m.id, m.venture_id)}
      ${ctx.can('archive') ? section('Archive', postButton(ctx, `/milestones/${m.id}/${m.archived_at ? 'restore' : 'archive'}`, m.archived_at ? 'Restore milestone' : 'Archive milestone', { variant: 'ghost', confirm: m.archived_at ? undefined : 'Archive this milestone?' })) : ''}
      ${section('History', activityList(listActivity({ entityType: 'milestone', entityId: m.id, limit: 20 }), { showVenture: false }))}
    </div>`;
    if (!ctx.can('write')) {
      return htmlReply(page(ctx, { title: m.title, active: 'projects', body: html`${pageHeader({ title: m.title, eyebrow: 'Milestone', meta: statusBadge(MILESTONE_STATUSES, m.status) })}<div class="split">${section('Details', definitionList([{ label: 'Target', value: date(m.due_date) }, { label: 'Description', value: paragraphs(m.description) }]))}${side}</div>` }));
    }
    return htmlReply(formPage(ctx, 'milestone', { id: m.id, values: toFormValues(MILESTONE_FIELDS, m as unknown as Record<string, unknown>), side, title: 'Edit milestone' }));
  });
  router.post('/milestones/:id', 'write', (ctx) => {
    const m = getMilestone(ctx.params.id!) ?? notFound('Milestone');
    return submit(ctx, MILESTONE_FIELDS, (values) => {
      updateMilestone(m.id, values, ctx.actor);
      ctx.flash('success', 'Milestone saved.');
      return redirect(returnTo(ctx, '/projects?view=milestones'));
    }, (values, errors) => formPage(ctx, 'milestone', { id: m.id, values, errors, title: 'Edit milestone' }));
  });
  router.post('/milestones/:id/status', 'write', (ctx) => {
    const m = getMilestone(ctx.params.id!) ?? notFound('Milestone');
    setMilestoneStatus(m.id, ctx.form.get('status'), ctx.actor);
    ctx.flash('success', `Milestone “${m.title}” marked ${labelOf(MILESTONE_STATUSES, ctx.form.get('status')).toLowerCase()}. Legal and operational status are unchanged.`);
    return redirect(returnTo(ctx, '/projects?view=milestones'));
  });

  // Archive / restore
  for (const kind of ['project', 'task', 'milestone'] as const) {
    for (const action of ['archive', 'restore'] as const) {
      router.post(`/${kind}s/:id/${action}`, 'archive', (ctx) => {
        archiveWork(kind, ctx.params.id!, action === 'archive', ctx.actor);
        return archiveReply(ctx, action === 'archive', `${kind[0]!.toUpperCase()}${kind.slice(1)}`, kind === 'project' ? `/projects/${ctx.params.id}` : `/${kind}s/${ctx.params.id}/edit`);
      });
    }
  }

  // Dependencies
  router.post('/dependencies', 'write', (ctx) => {
    const [bKind, bId] = ctx.form.get('blocked').split(':');
    const prereq = ctx.form.get('prereq');
    const [pKind, pId] = prereq === 'external' ? ['external', null] : prereq.split(':');
    const back = returnTo(ctx, '/risks?view=dependencies');
    if (!['project', 'milestone', 'task'].includes(bKind ?? '') || !['project', 'milestone', 'task', 'decision', 'opportunity', 'external'].includes(pKind ?? '')) {
      ctx.flash('error', 'Choose what this depends on.');
      return redirect(back);
    }
    try {
      createDependency(
        {
          blockedKind: bKind as BlockedKind,
          blockedId: bId!,
          prereqKind: pKind as PrereqKind,
          prereqId: pId ?? null,
          externalType: ctx.form.get('external_type') || null,
          description: ctx.form.get('description').slice(0, 2000) || null,
          notes: null,
        },
        ctx.actor,
      );
      ctx.flash('success', 'Dependency recorded.');
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      ctx.flash('error', Object.values(err.errors).join(' '));
    }
    return redirect(back);
  });
  router.post('/dependencies/:id/status', 'write', (ctx) => {
    const d = getDependency(ctx.params.id!) ?? notFound('Dependency');
    setDependencyStatus(d.id, ctx.form.get('status') === 'resolved' ? 'resolved' : 'open', ctx.actor);
    return redirect(returnTo(ctx, '/risks?view=dependencies'));
  });
}
