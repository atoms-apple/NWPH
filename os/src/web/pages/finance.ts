import { html, paragraphs, type SafeHtml } from '../../lib/html.ts';
import { formatMoney } from '../../lib/money.ts';
import { formatDateTime } from '../../lib/time.ts';
import { htmlReply, redirect, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import {
  ENTRY_FIELDS,
  SCENARIO_FIELDS,
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  setVerification,
  archiveEntry,
  listScenarios,
  createScenario,
  updateScenario,
  archiveScenario,
  summarize,
  portfolioFinance,
  figureKind,
  type FinancialEntry,
  type CurrencySummary,
  type Cell,
} from '../../domain/finance.ts';
import { ENTRY_TYPES, BASES, FUNDING_STATUSES, labelOf } from '../../domain/vocabulary.ts';
import { findRow, listActivity } from '../../domain/records.ts';
import { ValidationError, type Errors } from '../../domain/fields.ts';
import { page } from '../layout.ts';
import { pageHeader, section, badge, statusBadge, emptyState, linkButton, postButton, filterBar, date, scopeLink, exampleBadge, archivedBadge, definitionList, notice, type Tone } from '../ui.ts';
import { renderForm, toFormValues, type FormValues } from '../forms.ts';
import { submit, refOptions, prefill, returnTo, notFound, ventureScope, ventureFilterOptions, archiveReply, UUID_RE } from '../common.ts';
import { activityList } from './activity.ts';

const KIND_TONE: Record<string, Tone> = { forecast: 'neutral', budget: 'info', actual: 'warn', verified: 'good' };

export function figureBadge(e: Pick<FinancialEntry, 'basis' | 'verification_status'>): SafeHtml {
  const k = figureKind(e);
  return badge(k.label, KIND_TONE[k.key] ?? 'neutral');
}

const cell = (c: Cell, currency: string): SafeHtml =>
  c.count ? html`${formatMoney(c.total, currency)}<span class="cell-meta">${c.count} ${c.count === 1 ? 'entry' : 'entries'}</span>` : html`<span class="muted">—</span>`;

/** Full planning summary: per currency, per type, per basis. Never sums across basis. */
export function financeSummary(sums: CurrencySummary[], entriesHref: string): SafeHtml {
  if (!sums.length) {
    return emptyState('No financial entries in this view', 'Add startup costs, operating costs, revenue assumptions, funding requirements and potential funding sources. Each figure is labelled as forecast, budget or actual.');
  }
  return html`${sums.map((s) => {
    const f = s.funding;
    return html`<div class="fin-block">
      ${sums.length > 1 ? html`<h3>${s.currency}</h3>` : ''}
      <div class="table-wrap"><table class="table table--numbers table--stack">
        <caption class="visually-hidden">Planning totals by type and basis, ${s.currency}</caption>
        <thead><tr><th scope="col">Type</th><th scope="col">Forecast</th><th scope="col">Budget</th><th scope="col">Actual · entered</th><th scope="col">Actual · verified</th></tr></thead>
        <tbody>${s.rows.map((r) => html`<tr>
          <th scope="row"><a href="${entriesHref}${entriesHref.includes('?') ? '&' : '?'}type=${r.type}">${labelOf(ENTRY_TYPES, r.type)}</a></th>
          <td data-label="Forecast">${cell(r.forecast, s.currency)}</td><td data-label="Budget">${cell(r.budget, s.currency)}</td>
          <td data-label="Actual · entered">${r.type === 'funding_requirement' ? html`<span class="muted">n/a</span>` : cell(r.actual, s.currency)}</td>
          <td data-label="Actual · verified">${r.type === 'funding_requirement' ? html`<span class="muted">n/a</span>` : cell(r.verified, s.currency)}</td>
        </tr>`)}</tbody>
      </table></div>
      <p class="footnote">Columns are never added together: a budget and the actual that fulfils it are separate views of the same cost.</p>

      <div class="grid grid--2">
        <div>
          <h3 class="h4">Funding position</h3>
          <dl class="deflist">
            <div class="deflist__row"><dt>Funding requirement${f.requirementBasis ? ` (${f.requirementBasis})` : ''}</dt><dd>${f.requirement !== null ? formatMoney(f.requirement, s.currency) : html`<span class="muted">Not entered</span>`}</dd></div>
            <div class="deflist__row"><dt>Received ${badge('secured', 'good')}</dt><dd>${formatMoney(f.received, s.currency)}</dd></div>
            <div class="deflist__row"><dt>Committed ${badge('secured', 'good')}</dt><dd>${formatMoney(f.committed, s.currency)}</dd></div>
            <div class="deflist__row"><dt>Applied ${badge('not secured')}</dt><dd>${formatMoney(f.applied, s.currency)}</dd></div>
            <div class="deflist__row"><dt>Potential ${badge('not secured')}</dt><dd>${formatMoney(f.potential, s.currency)}</dd></div>
            <div class="deflist__row deflist__row--total"><dt>Projected funding gap</dt><dd>${f.gap !== null
              ? html`<strong>${formatMoney(Math.max(0, f.gap), s.currency)}</strong>${f.gap < 0 ? html`<span class="cell-meta">Secured exceeds requirement by ${formatMoney(-f.gap, s.currency)}</span>` : ''}<span class="cell-meta">Requirement − (received + committed)</span>`
              : html`<span class="muted">Not calculated. ${f.gapUnavailable}</span>`}</dd></div>
          </dl>
          ${f.gap !== null && f.gap > 0 && f.potential + f.applied > 0 ? html`<p class="footnote">Potential and applied funding of ${formatMoney(f.potential + f.applied, s.currency)} could narrow the gap only if secured. It is not counted.</p>` : ''}
        </div>
        <div>
          <h3 class="h4">Budget versus entered actuals</h3>
          ${s.budgetVsActual.length
            ? html`<div class="table-wrap"><table class="table table--numbers table--compact"><thead><tr><th scope="col">Type</th><th scope="col">Budget</th><th scope="col">Actual</th><th scope="col">Variance</th></tr></thead>
              <tbody>${s.budgetVsActual.map((b) => html`<tr><th scope="row">${labelOf(ENTRY_TYPES, b.type)}</th><td>${formatMoney(b.budget, s.currency)}</td><td>${formatMoney(b.actual, s.currency)}</td>
                <td>${b.variance === 0 ? 'On budget' : html`${formatMoney(Math.abs(b.variance), s.currency)} ${b.type === 'revenue' ? (b.variance > 0 ? 'above' : 'below') : b.variance > 0 ? 'over' : 'under'}`}</td></tr>`)}</tbody></table></div>
              <p class="footnote">Actuals include unverified entries.</p>`
            : html`<p class="muted">Shown once a type has both budgeted and actual amounts.</p>`}
        </div>
      </div>
    </div>`;
  })}`;
}

export function entriesTable(entries: FinancialEntry[], opts: { showVenture?: boolean } = {}): SafeHtml {
  if (!entries.length) return emptyState('No entries', 'Entries matching this view will appear here.');
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Description</th><th scope="col">Type</th>${opts.showVenture !== false ? html`<th scope="col">Venture</th>` : ''}<th scope="col">Figure</th><th scope="col" class="num">Amount</th><th scope="col">Period</th></tr></thead>
    <tbody>${entries.map(
      (e) => html`<tr>
        <th scope="row" data-label="Description"><a href="/finance/entries/${e.id}">${e.description}</a> ${exampleBadge(e.is_example)}${archivedBadge(e.archived_at)}
          <span class="cell-meta">${[e.category, e.project_name, e.scenario_name ? `Scenario: ${e.scenario_name}` : null].filter(Boolean).join(' · ')}</span></th>
        <td data-label="Type">${labelOf(ENTRY_TYPES, e.entry_type)}</td>
        ${opts.showVenture !== false ? html`<td data-label="Venture">${scopeLink(e)}</td>` : ''}
        <td data-label="Figure">${e.entry_type === 'funding' ? statusBadge(FUNDING_STATUSES, e.funding_status) : figureBadge(e)}</td>
        <td data-label="Amount" class="num">${formatMoney(e.amount_minor, e.currency)}</td>
        <td data-label="Period">${e.period ?? html`<span class="muted">—</span>`}</td>
      </tr>`,
    )}</tbody></table></div>`;
}

function scenarioSelect(ctx: Context, action: string, ventureId: string | null | undefined, current: string, hidden: Record<string, string>): SafeHtml {
  const scenarios = listScenarios(ventureId === undefined ? undefined : ventureId);
  if (!scenarios.length) return html``;
  return filterBar({
    action,
    hidden,
    selects: [{ name: 'scenario', label: 'Scenario', value: current, options: scenarios.map((s) => ({ value: s.id, label: `Baseline + ${s.name}` })) }],
    note: 'Scenario views add that scenario’s entries to the baseline. Use separate scenarios for alternatives that should not combine.',
  });
}

function formPage(ctx: Context, opts: { id?: string; values: FormValues; errors?: Errors }): string {
  const editing = Boolean(opts.id);
  const back = returnTo(ctx, editing ? `/finance/entries/${opts.id}` : '/finance');
  return page(ctx, {
    title: editing ? 'Edit financial entry' : 'New financial entry',
    active: 'finance',
    body: html`${pageHeader({ title: editing ? 'Edit financial entry' : 'New financial entry', eyebrow: 'Financial Planning' })}
    ${section('Entry', renderForm(ctx, {
      action: editing ? `/finance/entries/${opts.id}` : '/finance/entries',
      fields: ENTRY_FIELDS,
      values: opts.values,
      errors: opts.errors,
      refs: refOptions(ENTRY_FIELDS, opts.values),
      submitLabel: editing ? 'Save changes' : 'Add entry',
      cancelHref: back,
      hidden: { _return: back },
      before: notice('info', html`<p><strong>Forecast</strong>: an estimate. <strong>Budget</strong>: a planned allocation. <strong>Actual</strong>: money that has really been spent or received.</p><p>For a <strong>funding source</strong>, choose its status instead. Only <em>Committed</em> and <em>Received</em> funding counts as secured. A potential source is never treated as secured.</p>${editing ? html`<p>Changing the amount, currency, date or basis of a verified actual clears its verification.</p>` : ''}`),
    }))}`,
  });
}

function scenarioPage(ctx: Context, opts: { id?: string; values: FormValues; errors?: Errors; archived?: boolean }): string {
  const editing = Boolean(opts.id);
  return page(ctx, {
    title: editing ? 'Edit scenario' : 'New scenario',
    active: 'finance',
    body: html`${pageHeader({ title: editing ? 'Edit funding scenario' : 'New funding scenario', eyebrow: 'Financial Planning', lede: 'A named set of alternative assumptions, such as “Grant-funded” or “Conservative revenue”. Assign entries to it to view them alongside the baseline.' })}
    ${section('Scenario', renderForm(ctx, {
      action: editing ? `/finance/scenarios/${opts.id}` : '/finance/scenarios',
      fields: SCENARIO_FIELDS,
      values: opts.values,
      errors: opts.errors,
      refs: refOptions(SCENARIO_FIELDS, opts.values),
      submitLabel: editing ? 'Save' : 'Create scenario',
      cancelHref: '/finance',
    }))}
    ${opts.id && ctx.can('archive')
      ? postButton(ctx, `/finance/scenarios/${opts.id}/${opts.archived ? 'restore' : 'archive'}`, opts.archived ? 'Restore scenario' : 'Archive scenario', {
          variant: 'ghost',
          confirm: opts.archived ? undefined : 'Archive this scenario? Its entries remain but are excluded from scenario views.',
        })
      : ''}`,
  });
}

export function registerFinance(router: Router): void {
  router.get('/finance', 'read', (ctx) => {
    const scope = ventureScope(ctx);
    const scenarioParam = ctx.query.get('scenario') ?? '';
    const scenarioId = scenarioParam && UUID_RE.test(scenarioParam) ? scenarioParam : null;
    const filter = { ventureId: scope.ventureId, scope: scope.scope, scenarioId };
    const sums = summarize(listEntries(filter));
    const scoped = Boolean(scope.slug);
    const portfolio = scoped ? [] : portfolioFinance();
    const entriesHref = `/finance/entries?${new URLSearchParams({ ...(scope.slug ? { venture: scope.slug } : {}), ...(scenarioId ? { scenario: scenarioId } : {}) }).toString()}`;
    const scenarios = listScenarios(scope.scope === 'parent' ? null : scope.venture ? scope.venture.id : undefined, false);

    const body = html`${pageHeader({
      title: 'Financial Planning',
      lede: 'Budgets, forecasts and funding assumptions for NWPH and each venture. A planning tool, not bookkeeping or accounting software.',
      actions: ctx.can('write') ? html`${linkButton('/finance/scenarios/new', 'New scenario')}${linkButton(`/finance/entries/new${scope.venture ? `?venture=${scope.venture.slug}` : ''}`, 'New entry', 'primary')}` : null,
    })}
    ${filterBar({ action: '/finance', hidden: { scenario: scenarioId ?? '' }, selects: [{ name: 'venture', label: 'Scope', value: scope.slug, options: ventureFilterOptions() }], note: scoped ? undefined : 'Portfolio view: parent-organization and venture entries together, each counted once.' })}
    ${scenarioSelect(ctx, '/finance', scope.scope === 'parent' ? null : scope.venture?.id, scenarioId ?? '', { venture: scope.slug })}
    ${section(`${scope.venture ? scope.venture.name : scope.scope === 'parent' ? 'NWPH (parent organization)' : 'Portfolio'} · ${scenarioId ? 'Baseline + scenario' : 'Baseline plan'}`, financeSummary(sums, entriesHref), {
      id: 'summary',
      actions: linkButton(entriesHref, 'All entries', 'ghost'),
    })}
    ${!scoped
      ? section('Planning by venture (CAD, baseline)', html`<div class="table-wrap"><table class="table table--stack table--numbers">
          <thead><tr><th scope="col">Scope</th><th scope="col">Startup + capital (forecast)</th><th scope="col">Funding requirement</th><th scope="col">Secured funding</th><th scope="col">Funding gap</th><th scope="col">Assumptions</th></tr></thead>
          <tbody>${portfolio.map((r) => {
            const s = r.summary;
            const startup = s ? s.rows.filter((x) => x.type === 'startup_cost' || x.type === 'capital_expenditure').reduce((n, x) => n + x.forecast.total, 0) : 0;
            const startupCount = s ? s.rows.filter((x) => x.type === 'startup_cost' || x.type === 'capital_expenditure').reduce((n, x) => n + x.forecast.count, 0) : 0;
            return html`<tr>
              <th scope="row" data-label="Scope"><a href="/finance?venture=${r.venture_slug ?? 'parent'}">${r.venture_name}</a>${r.otherCurrencies.length ? html`<span class="cell-meta">Also has ${r.otherCurrencies.join(', ')} entries</span>` : ''}</th>
              <td data-label="Startup + capital">${startupCount ? formatMoney(startup, 'CAD') : html`<span class="muted">Not entered</span>`}</td>
              <td data-label="Requirement">${s?.funding.requirement != null ? formatMoney(s.funding.requirement, 'CAD') : html`<span class="muted">Not entered</span>`}</td>
              <td data-label="Secured">${s?.funding.fundingEntryCount ? formatMoney(s.funding.received + s.funding.committed, 'CAD') : html`<span class="muted">Not entered</span>`}</td>
              <td data-label="Gap">${s && s.funding.gap !== null ? formatMoney(Math.max(0, s.funding.gap), 'CAD') : html`<span class="muted">Not calculable</span>`}</td>
              <td data-label="Assumptions">${r.venture_slug ? html`<a href="/ventures/${r.venture_slug}/finance#assumptions">View</a>` : html`<span class="muted">—</span>`}</td>
            </tr>`;
          })}</tbody></table></div>`, { description: 'Archived ventures are excluded. Each record belongs to exactly one row, so rows can be compared but nothing is counted twice.' })
      : ''}
    ${section('Funding scenarios', scenarios.length
      ? html`<ul class="list">${scenarios.map((s) => html`<li class="list__item"><div class="list__main"><a href="/finance?${new URLSearchParams({ ...(scope.slug ? { venture: scope.slug } : {}), scenario: s.id }).toString()}">${s.name}</a><span class="list__meta">${s.venture_name ?? 'NWPH'} · ${s.entry_count} entries${s.description ? ` · ${s.description}` : ''}</span></div>
          <span class="list__aside">${ctx.can('write') ? linkButton(`/finance/scenarios/${s.id}/edit`, 'Edit', 'ghost') : ''}</span></li>`)}</ul>`
      : html`<p class="muted">No scenarios. All entries belong to the baseline plan.</p>`)}`;
    return htmlReply(page(ctx, { title: 'Financial Planning', active: 'finance', body }));
  });

  router.get('/finance/entries', 'read', (ctx) => {
    const scope = ventureScope(ctx);
    const q = ctx.query.get('q') ?? '';
    const type = ctx.query.get('type') ?? '';
    const basis = ctx.query.get('basis') ?? '';
    const project = ctx.query.get('project') ?? '';
    const scenario = ctx.query.get('scenario') ?? '';
    const archived = ctx.query.get('archived') === '1';
    const entries = listEntries({
      ventureId: scope.ventureId,
      scope: scope.scope,
      q,
      entryType: type,
      basis,
      projectId: UUID_RE.test(project) ? project : null,
      scenarioId: scenario === 'baseline' ? null : UUID_RE.test(scenario) ? scenario : undefined,
      archived,
    });
    const body = html`${pageHeader({
      eyebrow: html`<a href="/finance">Financial Planning</a>`,
      title: 'Financial entries',
      actions: ctx.can('write') ? linkButton(`/finance/entries/new${scope.venture ? `?venture=${scope.venture.slug}` : ''}`, 'New entry', 'primary') : null,
    })}
    ${filterBar({
      action: '/finance/entries',
      hidden: { project },
      q: { value: q, placeholder: 'Search descriptions, sources, notes' },
      selects: [
        { name: 'venture', label: 'Scope', value: scope.slug, options: ventureFilterOptions() },
        { name: 'type', label: 'Type', value: type, options: ENTRY_TYPES },
        { name: 'basis', label: 'Figure', value: basis, options: [...BASES, { value: 'verified', label: 'Actual · verified' }] },
        { name: 'scenario', label: 'Scenario', value: scenario, options: [{ value: 'baseline', label: 'Baseline only' }, ...listScenarios().map((s) => ({ value: s.id, label: `Baseline + ${s.name}` }))] },
      ],
      checks: [{ name: 'archived', label: 'Archived only', checked: archived }],
    })}
    ${section(`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`, entriesTable(entries))}`;
    return htmlReply(page(ctx, { title: 'Financial entries', active: 'finance', body }));
  });

  router.get('/finance/entries/new', 'write', (ctx) => {
    const type = ctx.query.get('type');
    const defaults: FormValues = { basis: 'forecast', currency: 'CAD' };
    if (type && ENTRY_TYPES.some((t) => t.value === type)) defaults.entry_type = type;
    if (type === 'funding') defaults.funding_status = 'potential';
    return htmlReply(formPage(ctx, { values: prefill(ctx, defaults) }));
  });
  router.post('/finance/entries', 'write', (ctx) =>
    submit(ctx, ENTRY_FIELDS, (values) => {
      const id = createEntry(values, ctx.actor);
      ctx.flash('success', 'Financial entry added.');
      return redirect(returnTo(ctx, `/finance/entries/${id}`));
    }, (values, errors) => formPage(ctx, { values, errors })),
  );

  router.get('/finance/entries/:id', 'read', (ctx) => {
    const e = getEntry(ctx.params.id!) ?? notFound('Financial entry');
    const k = figureKind(e);
    const body = html`${pageHeader({
      eyebrow: html`<a href="/finance">Financial Planning</a> · ${scopeLink(e, '/finance')}`,
      title: e.description,
      meta: html`${badge(labelOf(ENTRY_TYPES, e.entry_type))} ${e.entry_type === 'funding' ? statusBadge(FUNDING_STATUSES, e.funding_status) : ''} ${figureBadge(e)} ${exampleBadge(e.is_example)} ${archivedBadge(e.archived_at)}`,
      actions: html`${ctx.can('write') ? linkButton(`/finance/entries/${e.id}/edit`, 'Edit', 'primary') : ''}
        ${ctx.can('verify') && e.basis === 'actual' ? postButton(ctx, `/finance/entries/${e.id}/${e.verification_status === 'verified' ? 'unverify' : 'verify'}`, e.verification_status === 'verified' ? 'Remove verification' : 'Mark verified', { confirm: e.verification_status === 'verified' ? undefined : 'Confirm you have checked this actual amount against a source document.' }) : ''}
        ${ctx.can('archive') ? postButton(ctx, `/finance/entries/${e.id}/${e.archived_at ? 'restore' : 'archive'}`, e.archived_at ? 'Restore' : 'Archive', { variant: 'ghost', confirm: e.archived_at ? undefined : 'Archive this entry? It will be excluded from summaries.' }) : ''}`,
    })}
    ${e.basis !== 'actual' ? notice('info', e.entry_type === 'funding' ? `This funding source is ${labelOf(FUNDING_STATUSES, e.funding_status).toLowerCase()}. ${e.funding_status === 'committed' ? 'Committed funding counts as secured but has not been received.' : 'It is not secured and does not reduce the funding gap.'}` : `This is a ${k.label.toLowerCase()} figure, not an actual result.`) : ''}
    <div class="grid grid--sidebar">
      <div>
        ${section('Entry', definitionList([
          { label: 'Amount', value: html`<strong>${formatMoney(e.amount_minor, e.currency)}</strong>` },
          { label: 'Type', value: labelOf(ENTRY_TYPES, e.entry_type) },
          { label: 'Figure', value: html`${figureBadge(e)}${e.verified_at ? html` <span class="muted small">by ${e.verified_by_name ?? 'unknown'}, ${formatDateTime(e.verified_at)}</span>` : ''}` },
          { label: 'Category', value: e.category },
          { label: 'Financial period', value: e.period },
          { label: 'Date', value: e.entry_date ? date(e.entry_date) : null },
          { label: 'Project', value: e.project_id ? html`<a href="/projects/${e.project_id}">${e.project_name}</a>` : null },
          { label: 'Scenario', value: e.scenario_name ?? 'Baseline' },
          { label: 'Related opportunity', value: e.opportunity_id ? html`<a href="/opportunities/${e.opportunity_id}">${e.opportunity_title}</a>` : null },
          { label: 'Source or reference', value: e.source_reference },
          { label: 'Supporting document', value: e.document_id ? html`<a href="/documents/${e.document_id}">${e.document_title}</a>` : null },
          { label: 'Notes', value: paragraphs(e.notes) },
        ]))}
      </div>
      ${section('Change history', activityList(listActivity({ entityType: 'financial_entry', entityId: e.id, limit: 50 }), { showVenture: false }), { description: 'Every change to this figure, with before and after values.' })}
    </div>`;
    return htmlReply(page(ctx, { title: e.description, active: 'finance', body }));
  });
  router.get('/finance/entries/:id/edit', 'write', (ctx) => {
    const e = getEntry(ctx.params.id!) ?? notFound('Financial entry');
    return htmlReply(formPage(ctx, { id: e.id, values: toFormValues(ENTRY_FIELDS, e as unknown as Record<string, unknown>) }));
  });
  router.post('/finance/entries/:id', 'write', (ctx) => {
    const e = getEntry(ctx.params.id!) ?? notFound('Financial entry');
    return submit(ctx, ENTRY_FIELDS, (values) => {
      updateEntry(e.id, values, ctx.actor);
      ctx.flash('success', 'Financial entry saved. The previous values are kept in its history.');
      return redirect(returnTo(ctx, `/finance/entries/${e.id}`));
    }, (values, errors) => formPage(ctx, { id: e.id, values, errors }));
  });
  for (const [path, verified] of [['verify', true], ['unverify', false]] as const) {
    router.post(`/finance/entries/:id/${path}`, 'verify', (ctx) => {
      const e = getEntry(ctx.params.id!) ?? notFound('Financial entry');
      try {
        setVerification(e.id, verified, ctx.actor);
        ctx.flash('success', verified ? 'Marked as a verified actual.' : 'Verification removed.');
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        ctx.flash('error', Object.values(err.errors)[0]!);
      }
      return redirect(`/finance/entries/${e.id}`);
    });
  }
  for (const action of ['archive', 'restore'] as const) {
    router.post(`/finance/entries/:id/${action}`, 'archive', (ctx) => {
      archiveEntry(ctx.params.id!, action === 'archive', ctx.actor);
      return archiveReply(ctx, action === 'archive', 'Financial entry', `/finance/entries/${ctx.params.id}`);
    });
  }

  router.get('/finance/scenarios/new', 'write', (ctx) => htmlReply(scenarioPage(ctx, { values: prefill(ctx) })));
  router.post('/finance/scenarios', 'write', (ctx) =>
    submit(ctx, SCENARIO_FIELDS, (values) => {
      createScenario(values, ctx.actor);
      ctx.flash('success', 'Scenario created. Assign entries to it from the entry form.');
      return redirect('/finance');
    }, (values, errors) => scenarioPage(ctx, { values, errors })),
  );
  router.get('/finance/scenarios/:id/edit', 'write', (ctx) => {
    const s = findRow<Record<string, unknown>>('scenario', ctx.params.id!) ?? notFound('Scenario');
    return htmlReply(scenarioPage(ctx, { id: String(s.id), values: toFormValues(SCENARIO_FIELDS, s), archived: Boolean(s.archived_at) }));
  });
  router.post('/finance/scenarios/:id', 'write', (ctx) => {
    const s = findRow<{ id: string }>('scenario', ctx.params.id!) ?? notFound('Scenario');
    return submit(ctx, SCENARIO_FIELDS, (values) => {
      updateScenario(s.id, values, ctx.actor);
      ctx.flash('success', 'Scenario saved.');
      return redirect('/finance');
    }, (values, errors) => scenarioPage(ctx, { id: s.id, values, errors }));
  });
  for (const action of ['archive', 'restore'] as const) {
    router.post(`/finance/scenarios/:id/${action}`, 'archive', (ctx) => {
      archiveScenario(ctx.params.id!, action === 'archive', ctx.actor);
      return archiveReply(ctx, action === 'archive', 'Scenario', '/finance');
    });
  }
}

