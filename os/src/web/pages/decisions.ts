import { html, paragraphs, type SafeHtml } from '../../lib/html.ts';
import { formatDate, today } from '../../lib/time.ts';
import { htmlReply, redirect, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import { DECISION_FIELDS, listDecisions, getDecision, createDecision, updateDecision, archiveDecision, DECIDED, OPEN_DECISION, type Decision } from '../../domain/decisions.ts';
import { DECISION_STATUSES, DECISION_CATEGORIES } from '../../domain/vocabulary.ts';
import { listActivity } from '../../domain/records.ts';
import type { Errors } from '../../domain/fields.ts';
import { page } from '../layout.ts';
import { pageHeader, section, badge, statusBadge, emptyState, linkButton, postButton, filterBar, date, scopeLink, exampleBadge, archivedBadge, definitionList, notice, viewToggle } from '../ui.ts';
import { renderForm, toFormValues, type FormValues } from '../forms.ts';
import { submit, refOptions, prefill, returnTo, notFound, ventureScope, ventureFilterOptions, archiveReply } from '../common.ts';
import { activityList } from './activity.ts';

/** A plain-language statement of whether this is a decision or still an idea. */
export function decisionStanding(d: Pick<Decision, 'status'>): SafeHtml {
  if (DECIDED.has(d.status)) return badge(d.status === 'approved' ? 'Decided: approved' : 'Decided: rejected', d.status === 'approved' ? 'good' : 'bad');
  if (d.status === 'superseded') return badge('Superseded', 'muted');
  return badge('Not decided', 'neutral', 'A proposal or matter under consideration. Nothing has been approved.');
}

export function decisionTable(list: Decision[], opts: { showVenture?: boolean } = {}): SafeHtml {
  if (!list.length) return emptyState('No decisions recorded', 'Record proposals as they arise, then their outcome once decided. Proposals are clearly distinguished from approved decisions.');
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Decision</th>${opts.showVenture !== false ? html`<th scope="col">Venture</th>` : ''}<th scope="col">Proposed</th><th scope="col">Decided</th><th scope="col">Status</th></tr></thead>
    <tbody>${list.map(
      (d) => html`<tr>
        <th scope="row" data-label="Decision"><a href="/decisions/${d.id}">${d.title}</a> ${exampleBadge(d.is_example)}${archivedBadge(d.archived_at)}<span class="cell-meta">${d.category ?? 'Uncategorised'}${d.owner_name ? ` · ${d.owner_name}` : ''}</span></th>
        ${opts.showVenture !== false ? html`<td data-label="Venture">${scopeLink(d)}</td>` : ''}
        <td data-label="Proposed">${date(d.proposed_on)}</td>
        <td data-label="Decided">${d.decided_on ? date(d.decided_on) : html`<span class="muted">Not decided</span>`}</td>
        <td data-label="Status">${statusBadge(DECISION_STATUSES, d.status)}</td>
      </tr>`,
    )}</tbody></table></div>`;
}

function chronology(list: Decision[]): SafeHtml {
  if (!list.length) return emptyState('No decisions recorded', 'The chronological history fills as decisions are proposed and decided.');
  const years = new Map<string, Decision[]>();
  for (const d of list) {
    const y = (d.decided_on ?? d.proposed_on).slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), d]);
  }
  return html`${[...years.entries()].map(([year, items]) => html`<h3 class="chrono__year">${year}</h3>
    <ol class="timeline">${items.map((d) => html`<li class="timeline__item">
      <div class="timeline__head"><a href="/decisions/${d.id}" class="timeline__summary">${d.title}</a> ${statusBadge(DECISION_STATUSES, d.status)}</div>
      <p class="timeline__meta">${d.decided_on ? `Decided ${formatDate(d.decided_on)} · ` : ''}Proposed ${formatDate(d.proposed_on)} · ${d.venture_name ?? 'NWPH'}${d.superseded_by_title ? ` · superseded by “${d.superseded_by_title}”` : ''}</p>
      ${d.outcome ? html`<div class="timeline__body">${paragraphs(d.outcome)}</div>` : ''}
    </li>`)}</ol>`)}`;
}

function formPage(ctx: Context, opts: { id?: string; values: FormValues; errors?: Errors }): string {
  const editing = Boolean(opts.id);
  const back = returnTo(ctx, editing ? `/decisions/${opts.id}` : '/decisions');
  return page(ctx, {
    title: editing ? 'Edit decision' : 'New decision',
    active: 'decisions',
    body: html`${pageHeader({ title: editing ? 'Edit decision record' : 'New decision record', eyebrow: 'Governance & Decisions' })}
    ${section('Details', renderForm(ctx, {
      action: editing ? `/decisions/${opts.id}` : '/decisions',
      fields: DECISION_FIELDS,
      values: opts.values,
      errors: opts.errors,
      refs: refOptions(DECISION_FIELDS, opts.values),
      submitLabel: editing ? 'Save changes' : 'Record decision',
      cancelHref: back,
      hidden: { _return: back },
      before: notice('info', html`Use <strong>Proposed</strong> or <strong>Under review</strong> for ideas still being considered. Only use <strong>Approved</strong> for decisions actually made by whoever holds that authority, with the date. Every change to this record is kept in its history. This register does not replace formal minutes or board resolutions.`),
    }))}`,
  });
}

export function registerDecisions(router: Router): void {
  router.get('/decisions', 'read', (ctx) => {
    const scope = ventureScope(ctx);
    const view = ctx.query.get('view') === 'history' ? 'history' : 'register';
    const q = ctx.query.get('q') ?? '';
    const status = ctx.query.get('status') ?? '';
    const category = ctx.query.get('category') ?? '';
    const open = ctx.query.get('open') === '1';
    const archived = ctx.query.get('archived') === '1';
    const list = listDecisions({ ventureId: scope.ventureId, scope: scope.scope, q, status, category, open, archived });
    const body = html`${pageHeader({
      title: 'Governance & Decisions',
      lede: 'An internal register of proposals and decisions: options considered, rationale, outcome. Not a substitute for legally required corporate records.',
      actions: ctx.can('write') ? linkButton(`/decisions/new${scope.venture ? `?venture=${scope.venture.slug}` : ''}`, 'New decision record', 'primary') : null,
    })}
    <div class="toolbar">${viewToggle(new URLSearchParams(scope.slug ? { venture: scope.slug } : {}), '/decisions', view, [['register', 'Register'], ['history', 'Chronological history']])}</div>
    ${filterBar({
      action: '/decisions',
      hidden: { view: view === 'history' ? 'history' : '' },
      q: { value: q, placeholder: 'Search decisions' },
      selects: [
        { name: 'venture', label: 'Venture', value: scope.slug, options: ventureFilterOptions() },
        { name: 'status', label: 'Status', value: status, options: DECISION_STATUSES },
        { name: 'category', label: 'Category', value: category, options: DECISION_CATEGORIES.map((c) => ({ value: c, label: c })) },
      ],
      checks: [{ name: 'open', label: 'Not yet decided', checked: open }, { name: 'archived', label: 'Archived only', checked: archived }],
    })}
    ${section(view === 'history' ? 'Chronological history' : 'Decision register', view === 'history' ? chronology(list) : decisionTable(list))}`;
    return htmlReply(page(ctx, { title: 'Governance & Decisions', active: 'decisions', body }));
  });

  router.get('/decisions/new', 'write', (ctx) => htmlReply(formPage(ctx, { values: prefill(ctx, { status: 'proposed', proposed_on: today() }) })));
  router.post('/decisions', 'write', (ctx) =>
    submit(ctx, DECISION_FIELDS, (values) => {
      const id = createDecision(values, ctx.actor);
      ctx.flash('success', 'Decision record created.');
      return redirect(`/decisions/${id}`);
    }, (values, errors) => formPage(ctx, { values, errors })),
  );

  router.get('/decisions/:id', 'read', (ctx) => {
    const d = getDecision(ctx.params.id!) ?? notFound('Decision');
    const supersedes = listDecisions({}).filter((x) => x.superseded_by_id === d.id);
    const body = html`${pageHeader({
      eyebrow: html`Decision · ${scopeLink(d)}`,
      title: d.title,
      meta: html`${statusBadge(DECISION_STATUSES, d.status)} ${decisionStanding(d)} ${d.category ? badge(d.category) : ''} ${exampleBadge(d.is_example)} ${archivedBadge(d.archived_at)}`,
      actions: html`${ctx.can('write') ? linkButton(`/decisions/${d.id}/edit`, 'Edit / change status', 'primary') : ''}${ctx.can('archive') ? postButton(ctx, `/decisions/${d.id}/${d.archived_at ? 'restore' : 'archive'}`, d.archived_at ? 'Restore' : 'Archive', { variant: 'ghost', confirm: d.archived_at ? undefined : 'Archive this decision record? Its history is preserved.' }) : ''}`,
    })}
    ${OPEN_DECISION.has(d.status) ? notice('info', 'This is not a decision yet. It records a proposal or a matter under consideration.') : ''}
    ${d.status === 'superseded' && d.superseded_by_id ? notice('warn', html`Superseded by <a href="/decisions/${d.superseded_by_id}">${d.superseded_by_title}</a>.`) : ''}
    <div class="grid grid--sidebar">
      <div>
        ${section('Record', definitionList([
          { label: 'Description', value: paragraphs(d.description) },
          { label: 'Options considered', value: paragraphs(d.options_considered) },
          { label: 'Rationale', value: paragraphs(d.rationale) },
          { label: 'Supporting evidence', value: html`${paragraphs(d.evidence)}${d.evidence_document_id ? html`<p><a href="/documents/${d.evidence_document_id}">${d.evidence_document_title}</a></p>` : ''}` },
          { label: 'Expected implications', value: paragraphs(d.implications) },
          { label: 'Final outcome', value: paragraphs(d.outcome) },
          { label: 'Notes', value: paragraphs(d.notes) },
        ]))}
        ${section('Change history', activityList(listActivity({ entityType: 'decision', entityId: d.id, limit: 100 }), { showVenture: false }), { description: 'Every edit with its previous and new values.' })}
      </div>
      <div>
        ${section('Key facts', definitionList([
          { label: 'Status', value: statusBadge(DECISION_STATUSES, d.status) },
          { label: 'Decision owner', value: d.owner_name },
          { label: 'Date proposed', value: date(d.proposed_on) },
          { label: 'Date decided', value: d.decided_on ? date(d.decided_on) : null },
          { label: 'Review date', value: d.review_date ? date(d.review_date) : null },
          ...(supersedes.length ? [{ label: 'Supersedes', value: html`${supersedes.map((s) => html`<a href="/decisions/${s.id}">${s.title}</a><br>`)}` }] : []),
        ]))}
      </div>
    </div>`;
    return htmlReply(page(ctx, { title: d.title, active: 'decisions', body }));
  });

  router.get('/decisions/:id/edit', 'write', (ctx) => {
    const d = getDecision(ctx.params.id!) ?? notFound('Decision');
    return htmlReply(formPage(ctx, { id: d.id, values: toFormValues(DECISION_FIELDS, d as unknown as Record<string, unknown>) }));
  });
  router.post('/decisions/:id', 'write', (ctx) => {
    const d = getDecision(ctx.params.id!) ?? notFound('Decision');
    return submit(ctx, DECISION_FIELDS, (values) => {
      updateDecision(d.id, values, ctx.actor);
      ctx.flash('success', 'Decision record saved. The previous values are kept in its history.');
      return redirect(`/decisions/${d.id}`);
    }, (values, errors) => formPage(ctx, { id: d.id, values, errors }));
  });
  for (const action of ['archive', 'restore'] as const) {
    router.post(`/decisions/:id/${action}`, 'archive', (ctx) => {
      archiveDecision(ctx.params.id!, action === 'archive', ctx.actor);
      return archiveReply(ctx, action === 'archive', 'Decision record', `/decisions/${ctx.params.id}`);
    });
  }
}
