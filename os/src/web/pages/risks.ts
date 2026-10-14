import { html, paragraphs, type SafeHtml } from '../../lib/html.ts';
import { htmlReply, redirect, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import { RISK_FIELDS, listRisks, getRisk, createRisk, updateRisk, archiveRisk, type Risk } from '../../domain/risks.ts';
import { RISK_STATUSES, RISK_CATEGORIES, riskBand, LIKELIHOOD, IMPACT, labelOf } from '../../domain/vocabulary.ts';
import { listDependencies } from '../../domain/work.ts';
import { listActivity } from '../../domain/records.ts';
import type { Errors } from '../../domain/fields.ts';
import { page } from '../layout.ts';
import { pageHeader, section, badge, statusBadge, emptyState, linkButton, postButton, filterBar, date, scopeLink, exampleBadge, archivedBadge, viewToggle, definitionList } from '../ui.ts';
import { renderForm, toFormValues, type FormValues } from '../forms.ts';
import { submit, refOptions, prefill, returnTo, notFound, ventureScope, ventureFilterOptions, archiveReply } from '../common.ts';
import { activityList } from './activity.ts';
import { dependencyList } from './work.ts';

const bandTone = { low: 'muted', medium: 'warn', high: 'bad' } as const;

export function riskBadge(r: Pick<Risk, 'likelihood' | 'impact'>): SafeHtml {
  const b = riskBand(r.likelihood, r.impact);
  return badge(`${b.label} · L${r.likelihood}×I${r.impact}`, bandTone[b.band], `Likelihood ${labelOf(LIKELIHOOD, String(r.likelihood))}, impact ${labelOf(IMPACT, String(r.impact))}. A planning band, not a prediction.`);
}

export function riskTable(risks: Risk[], opts: { showVenture?: boolean; compact?: boolean } = {}): SafeHtml {
  if (!risks.length) return emptyState('No risks recorded', 'Record what could prevent progress, how likely and serious it seems, and what you will do about it.');
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Risk</th>${opts.showVenture !== false ? html`<th scope="col">Venture</th>` : ''}<th scope="col">Planning band</th><th scope="col">Status</th>${opts.compact ? '' : html`<th scope="col">Owner</th><th scope="col">Review</th>`}</tr></thead>
    <tbody>${risks.map(
      (r) => html`<tr>
        <th scope="row" data-label="Risk"><a href="/risks/${r.id}/edit">${r.title}</a> ${exampleBadge(r.is_example)}${archivedBadge(r.archived_at)}${r.category ? html`<span class="cell-meta">${r.category}${r.project_name ? ` · ${r.project_name}` : ''}</span>` : ''}</th>
        ${opts.showVenture !== false ? html`<td data-label="Venture">${scopeLink(r)}</td>` : ''}
        <td data-label="Band">${riskBadge(r)}</td>
        <td data-label="Status">${statusBadge(RISK_STATUSES, r.status)}</td>
        ${opts.compact ? '' : html`<td data-label="Owner">${r.owner_name ?? html`<span class="muted">Unassigned</span>`}</td><td data-label="Review">${date(r.review_date)}</td>`}
      </tr>`,
    )}</tbody></table></div>`;
}

/** 5×5 count matrix. Counts only; cells are not colour-coded probabilities. */
export function riskMatrix(risks: Risk[]): SafeHtml {
  const active = risks.filter((r) => ['open', 'monitoring', 'occurred'].includes(r.status));
  if (!active.length) return html``;
  const rows = [5, 4, 3, 2, 1];
  return html`<figure class="matrix">
    <table class="matrix__table">
      <caption class="visually-hidden">Active risks by likelihood (rows) and impact (columns)</caption>
      <thead><tr><td></td>${[1, 2, 3, 4, 5].map((i) => html`<th scope="col">I${i}</th>`)}</tr></thead>
      <tbody>${rows.map((l) => html`<tr><th scope="row">L${l}</th>${[1, 2, 3, 4, 5].map((i) => {
        const n = active.filter((r) => r.likelihood === l && r.impact === i).length;
        return html`<td class="matrix__cell matrix__cell--${riskBand(l, i).band}">${n || ''}</td>`;
      })}</tr>`)}</tbody>
    </table>
    <figcaption>Active risks by likelihood (L) and impact (I). Shading marks the low / medium / high planning bands. Ratings are judgements; this is a planning aid, not a forecast.</figcaption>
  </figure>`;
}

function formPage(ctx: Context, opts: { id?: string; values: FormValues; errors?: Errors; side?: SafeHtml }): string {
  const editing = Boolean(opts.id);
  const back = returnTo(ctx, '/risks');
  return page(ctx, {
    title: editing ? 'Edit risk' : 'New risk',
    active: 'risks',
    body: html`${pageHeader({ title: editing ? 'Edit risk' : 'New risk', eyebrow: 'Risks & Dependencies' })}
    <div class="${opts.side ? 'split' : ''}">${section('Details', renderForm(ctx, {
      action: editing ? `/risks/${opts.id}` : '/risks',
      fields: RISK_FIELDS,
      values: opts.values,
      errors: opts.errors,
      refs: refOptions(RISK_FIELDS, opts.values),
      submitLabel: editing ? 'Save changes' : 'Record risk',
      cancelHref: back,
      hidden: { _return: back },
      before: html`<p class="form__hint">Likelihood and impact are ordinal judgements from 1 to 5. Their product only places the risk in a rough planning band.</p>`,
    }))}${opts.side ?? ''}</div>`,
  });
}

export function registerRisks(router: Router): void {
  router.get('/risks', 'read', (ctx) => {
    const view = ctx.query.get('view') === 'dependencies' ? 'dependencies' : 'risks';
    const scope = ventureScope(ctx);
    const body =
      view === 'risks'
        ? (() => {
            const q = ctx.query.get('q') ?? '';
            const status = ctx.query.get('status') ?? '';
            const category = ctx.query.get('category') ?? '';
            const active = ctx.query.get('active') === '1';
            const high = ctx.query.get('high') === '1';
            const archived = ctx.query.get('archived') === '1';
            const risks = listRisks({ ventureId: scope.ventureId, scope: scope.scope, q, status, category, active, high, archived });
            return html`${filterBar({
              action: '/risks',
              q: { value: q, placeholder: 'Search risks' },
              selects: [
                { name: 'venture', label: 'Venture', value: scope.slug, options: ventureFilterOptions() },
                { name: 'status', label: 'Status', value: status, options: RISK_STATUSES },
                { name: 'category', label: 'Category', value: category, options: RISK_CATEGORIES.map((c) => ({ value: c, label: c })) },
              ],
              checks: [{ name: 'active', label: 'Unresolved', checked: active }, { name: 'high', label: 'High band', checked: high }, { name: 'archived', label: 'Archived only', checked: archived }],
            })}
            <div class="grid grid--sidebar">${section('Risk register', riskTable(risks))}${section('Matrix', riskMatrix(risks) || html`<p class="muted">No active risks in this view.</p>`)}</div>`;
          })()
        : (() => {
            const status = ctx.query.get('status') ?? '';
            const deps = listDependencies({ ventureId: scope.scope === 'parent' ? undefined : scope.ventureId, status: status || undefined }).filter((d) => (scope.scope === 'parent' ? !d.venture_id : true));
            return html`${filterBar({
              action: '/risks',
              hidden: { view },
              selects: [
                { name: 'venture', label: 'Venture', value: scope.slug, options: ventureFilterOptions() },
                { name: 'status', label: 'Status', value: status, options: [{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }] },
              ],
            })}
            ${section('Dependencies', html`${dependencyList(ctx, deps, { showBlocked: true })}<p class="footnote">Add dependencies from a project, milestone or task page. A dependency on a record shows “Prerequisite met” once that record is completed, approved or awarded; resolve it to confirm.</p>`)}`;
          })();
    return htmlReply(
      page(ctx, {
        title: 'Risks & Dependencies',
        active: 'risks',
        body: html`${pageHeader({
          title: 'Risks & Dependencies',
          lede: 'What could prevent progress, and what each piece of work is waiting on.',
          actions: ctx.can('write') ? linkButton(`/risks/new${scope.venture ? `?venture=${scope.venture.slug}` : ''}`, 'New risk', 'primary') : null,
        })}
        <div class="toolbar">${viewToggle(new URLSearchParams(scope.slug ? { venture: scope.slug } : {}), '/risks', view, [['risks', 'Risk register'], ['dependencies', 'Dependencies']])}</div>
        ${body}`,
      }),
    );
  });
  router.get('/risks/new', 'write', (ctx) => htmlReply(formPage(ctx, { values: prefill(ctx, { status: 'open', likelihood: '3', impact: '3' }) })));
  router.post('/risks', 'write', (ctx) =>
    submit(ctx, RISK_FIELDS, (values) => {
      createRisk(values, ctx.actor);
      ctx.flash('success', 'Risk recorded.');
      return redirect(returnTo(ctx, '/risks'));
    }, (values, errors) => formPage(ctx, { values, errors })),
  );
  router.get('/risks/:id', 'read', (ctx) => redirect(`/risks/${ctx.params.id}/edit`));
  router.get('/risks/:id/edit', 'read', (ctx) => {
    const r = getRisk(ctx.params.id!) ?? notFound('Risk');
    const side = html`<div>
      ${section('Assessment', html`${riskBadge(r)} ${statusBadge(RISK_STATUSES, r.status)}
        ${ctx.can('archive') ? html`<p>${postButton(ctx, `/risks/${r.id}/${r.archived_at ? 'restore' : 'archive'}`, r.archived_at ? 'Restore risk' : 'Archive risk', { variant: 'ghost', confirm: r.archived_at ? undefined : 'Archive this risk?' })}</p>` : ''}`)}
      ${section('History', activityList(listActivity({ entityType: 'risk', entityId: r.id, limit: 20 }), { showVenture: false }))}
    </div>`;
    if (!ctx.can('write')) {
      return htmlReply(page(ctx, { title: r.title, active: 'risks', body: html`${pageHeader({ title: r.title, eyebrow: 'Risk' })}<div class="split">${section('Details', definitionList([{ label: 'Venture', value: scopeLink(r) }, { label: 'Description', value: paragraphs(r.description) }, { label: 'Mitigation', value: paragraphs(r.mitigation) }, { label: 'Owner', value: r.owner_name }, { label: 'Review date', value: date(r.review_date) }]))}${side}</div>` }));
    }
    return htmlReply(formPage(ctx, { id: r.id, values: toFormValues(RISK_FIELDS, r as unknown as Record<string, unknown>), side }));
  });
  router.post('/risks/:id', 'write', (ctx) => {
    const r = getRisk(ctx.params.id!) ?? notFound('Risk');
    return submit(ctx, RISK_FIELDS, (values) => {
      updateRisk(r.id, values, ctx.actor);
      ctx.flash('success', 'Risk saved.');
      return redirect(returnTo(ctx, '/risks'));
    }, (values, errors) => formPage(ctx, { id: r.id, values, errors }));
  });
  for (const action of ['archive', 'restore'] as const) {
    router.post(`/risks/:id/${action}`, 'archive', (ctx) => {
      archiveRisk(ctx.params.id!, action === 'archive', ctx.actor);
      return archiveReply(ctx, action === 'archive', 'Risk', '/risks');
    });
  }
}
