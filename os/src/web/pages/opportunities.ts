import { html, paragraphs, type SafeHtml } from '../../lib/html.ts';
import { formatMoney } from '../../lib/money.ts';
import { daysBetween, today } from '../../lib/time.ts';
import { htmlReply, redirect, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import { OPPORTUNITY_FIELDS, listOpportunities, getOpportunity, createOpportunity, updateOpportunity, archiveOpportunity, type Opportunity } from '../../domain/opportunities.ts';
import { OPPORTUNITY_STATUSES, OPPORTUNITY_CATEGORIES, OPPORTUNITY_CLOSED, FUNDING_STATUSES } from '../../domain/vocabulary.ts';
import { listEntries } from '../../domain/finance.ts';
import { listActivity } from '../../domain/records.ts';
import type { Errors } from '../../domain/fields.ts';
import { page } from '../layout.ts';
import { pageHeader, section, badge, statusBadge, emptyState, linkButton, postButton, filterBar, date, scopeLink, exampleBadge, archivedBadge, definitionList, notice } from '../ui.ts';
import { renderForm, toFormValues, type FormValues } from '../forms.ts';
import { submit, refOptions, prefill, returnTo, notFound, ventureScope, ventureFilterOptions, archiveReply } from '../common.ts';
import { activityList } from './activity.ts';

function deadlineCell(o: Opportunity): SafeHtml {
  if (!o.deadline) return html`<span class="muted">No deadline</span>`;
  const days = daysBetween(today(), o.deadline);
  const open = !OPPORTUNITY_CLOSED.has(o.status) && o.status !== 'submitted';
  return html`${date(o.deadline)}${open && days >= 0 && days <= 14 ? html` ${badge(days === 0 ? 'Today' : `${days} days`, 'warn')}` : ''}${open && days < 0 ? html` ${badge('Passed', 'bad')}` : ''}`;
}

export function opportunityTable(list: Opportunity[], opts: { showVenture?: boolean } = {}): SafeHtml {
  if (!list.length) return emptyState('No opportunities', 'Record grants, procurement, partnerships and other opportunities as you find them. Entries are manual; nothing is imported or matched automatically.');
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Opportunity</th>${opts.showVenture !== false ? html`<th scope="col">Venture</th>` : ''}<th scope="col">Potential value</th><th scope="col">Deadline</th><th scope="col">Status</th></tr></thead>
    <tbody>${list.map(
      (o) => html`<tr>
        <th scope="row" data-label="Opportunity"><a href="/opportunities/${o.id}">${o.title}</a> ${exampleBadge(o.is_example)}${archivedBadge(o.archived_at)}<span class="cell-meta">${o.category}${o.issuing_organization ? ` · ${o.issuing_organization}` : ''}</span>${o.next_action ? html`<span class="cell-meta">Next: ${o.next_action}</span>` : ''}</th>
        ${opts.showVenture !== false ? html`<td data-label="Venture">${scopeLink(o)}</td>` : ''}
        <td data-label="Potential value">${o.potential_value_minor !== null ? html`${formatMoney(o.potential_value_minor, o.currency)}<span class="cell-meta">available, not expected</span>` : html`<span class="muted">—</span>`}</td>
        <td data-label="Deadline">${deadlineCell(o)}</td>
        <td data-label="Status">${statusBadge(OPPORTUNITY_STATUSES, o.status)}</td>
      </tr>`,
    )}</tbody></table></div>`;
}

function formPage(ctx: Context, opts: { id?: string; values: FormValues; errors?: Errors }): string {
  const editing = Boolean(opts.id);
  const back = returnTo(ctx, editing ? `/opportunities/${opts.id}` : '/opportunities');
  return page(ctx, {
    title: editing ? 'Edit opportunity' : 'New opportunity',
    active: 'opportunities',
    body: html`${pageHeader({ title: editing ? 'Edit opportunity' : 'New opportunity', eyebrow: 'Opportunities' })}
    ${section('Details', renderForm(ctx, {
      action: editing ? `/opportunities/${opts.id}` : '/opportunities',
      fields: OPPORTUNITY_FIELDS,
      values: opts.values,
      errors: opts.errors,
      refs: refOptions(OPPORTUNITY_FIELDS, opts.values),
      submitLabel: editing ? 'Save changes' : 'Add opportunity',
      cancelHref: back,
      hidden: { _return: back },
      before: notice('info', 'Eligibility is a human judgement. “Eligible” and later statuses require you to record who confirmed eligibility and how. Potential value is what the program offers, not an expected award.'),
    }))}`,
  });
}

export function registerOpportunities(router: Router): void {
  router.get('/opportunities', 'read', (ctx) => {
    const scope = ventureScope(ctx);
    const q = ctx.query.get('q') ?? '';
    const status = ctx.query.get('status') ?? '';
    const category = ctx.query.get('category') ?? '';
    const active = ctx.query.get('active') === '1';
    const archived = ctx.query.get('archived') === '1';
    const list = listOpportunities({ ventureId: scope.ventureId, scope: scope.scope, q, status, category, active, archived });
    const body = html`${pageHeader({
      title: 'Opportunities',
      lede: 'Grants, procurement, partnerships, contracts and research funding being tracked. Listing an opportunity says nothing about eligibility or likelihood of success.',
      actions: ctx.can('write') ? linkButton(`/opportunities/new${scope.venture ? `?venture=${scope.venture.slug}` : ''}`, 'New opportunity', 'primary') : null,
    })}
    ${filterBar({
      action: '/opportunities',
      q: { value: q, placeholder: 'Search opportunities' },
      selects: [
        { name: 'venture', label: 'Venture', value: scope.slug, options: ventureFilterOptions() },
        { name: 'status', label: 'Status', value: status, options: OPPORTUNITY_STATUSES },
        { name: 'category', label: 'Category', value: category, options: OPPORTUNITY_CATEGORIES.map((c) => ({ value: c, label: c })) },
      ],
      checks: [{ name: 'active', label: 'Still being pursued', checked: active }, { name: 'archived', label: 'Archived only', checked: archived }],
    })}
    ${section('Opportunities', opportunityTable(list))}`;
    return htmlReply(page(ctx, { title: 'Opportunities', active: 'opportunities', body }));
  });
  router.get('/opportunities/new', 'write', (ctx) => htmlReply(formPage(ctx, { values: prefill(ctx, { status: 'identified', currency: 'CAD' }) })));
  router.post('/opportunities', 'write', (ctx) =>
    submit(ctx, OPPORTUNITY_FIELDS, (values) => {
      const id = createOpportunity(values, ctx.actor);
      ctx.flash('success', 'Opportunity added.');
      return redirect(`/opportunities/${id}`);
    }, (values, errors) => formPage(ctx, { values, errors })),
  );
  router.get('/opportunities/:id', 'read', (ctx) => {
    const o = getOpportunity(ctx.params.id!) ?? notFound('Opportunity');
    const funding = listEntries({ ventureId: o.venture_id ?? undefined }).filter((e) => e.opportunity_id === o.id);
    const body = html`${pageHeader({
      eyebrow: html`Opportunity · ${scopeLink(o)}`,
      title: o.title,
      meta: html`${statusBadge(OPPORTUNITY_STATUSES, o.status)} ${badge(o.category)} ${exampleBadge(o.is_example)} ${archivedBadge(o.archived_at)}`,
      actions: html`${ctx.can('write') ? linkButton(`/opportunities/${o.id}/edit`, 'Edit', 'primary') : ''}${ctx.can('archive') ? postButton(ctx, `/opportunities/${o.id}/${o.archived_at ? 'restore' : 'archive'}`, o.archived_at ? 'Restore' : 'Archive', { variant: 'ghost', confirm: o.archived_at ? undefined : 'Archive this opportunity?' }) : ''}`,
    })}
    <div class="grid grid--sidebar">
      <div>
        ${section('Details', definitionList([
          { label: 'Description', value: paragraphs(o.description) },
          { label: 'Eligibility requirements (published)', value: paragraphs(o.eligibility_requirements) },
          { label: 'Basis for eligibility judgement', value: o.eligibility_basis ? paragraphs(o.eligibility_basis) : html`<span class="muted">Eligibility not confirmed</span>` },
          { label: 'Required documents', value: paragraphs(o.required_documents) },
          { label: 'Next action', value: o.next_action },
          { label: 'Notes', value: paragraphs(o.notes) },
        ]))}
        ${section('Linked funding entries', funding.length
          ? html`<ul class="list">${funding.map((e) => html`<li class="list__item"><div class="list__main"><a href="/finance/entries/${e.id}">${e.description}</a></div><span class="list__aside">${formatMoney(e.amount_minor, e.currency)} ${e.funding_status ? statusBadge(FUNDING_STATUSES, e.funding_status) : ''}</span></li>`)}</ul>`
          : html`<p class="muted">No funding entry is linked. Funding only counts in Financial Planning once recorded there, with a status that says whether it is secured.</p>`,
          { actions: ctx.can('write') ? linkButton(`/finance/entries/new?opportunity=${o.id}${o.venture_slug ? `&venture=${o.venture_slug}` : ''}&type=funding`, 'Record funding entry', 'ghost') : null })}
      </div>
      <div>
        ${section('Key facts', definitionList([
          { label: 'Issuing organization', value: o.issuing_organization },
          { label: 'Source', value: o.source },
          { label: 'Source URL', value: o.source_url ? html`<a href="${o.source_url}" rel="noopener noreferrer" target="_blank">${o.source_url}</a>` : null },
          { label: 'Potential value', value: o.potential_value_minor !== null ? formatMoney(o.potential_value_minor, o.currency) : null },
          { label: 'Geographic scope', value: o.geographic_scope },
          { label: 'Opens', value: date(o.opens_on) },
          { label: 'Deadline', value: deadlineCell(o) },
        ]))}
        ${section('History', activityList(listActivity({ entityType: 'opportunity', entityId: o.id, limit: 20 }), { showVenture: false }))}
      </div>
    </div>`;
    return htmlReply(page(ctx, { title: o.title, active: 'opportunities', body }));
  });
  router.get('/opportunities/:id/edit', 'write', (ctx) => {
    const o = getOpportunity(ctx.params.id!) ?? notFound('Opportunity');
    return htmlReply(formPage(ctx, { id: o.id, values: toFormValues(OPPORTUNITY_FIELDS, o as unknown as Record<string, unknown>) }));
  });
  router.post('/opportunities/:id', 'write', (ctx) => {
    const o = getOpportunity(ctx.params.id!) ?? notFound('Opportunity');
    return submit(ctx, OPPORTUNITY_FIELDS, (values) => {
      updateOpportunity(o.id, values, ctx.actor);
      ctx.flash('success', 'Opportunity saved.');
      return redirect(returnTo(ctx, `/opportunities/${o.id}`));
    }, (values, errors) => formPage(ctx, { id: o.id, values, errors }));
  });
  for (const action of ['archive', 'restore'] as const) {
    router.post(`/opportunities/:id/${action}`, 'archive', (ctx) => {
      archiveOpportunity(ctx.params.id!, action === 'archive', ctx.actor);
      return archiveReply(ctx, action === 'archive', 'Opportunity', `/opportunities/${ctx.params.id}`);
    });
  }
}
