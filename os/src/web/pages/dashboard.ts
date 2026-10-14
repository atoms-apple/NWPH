import { html, type SafeHtml } from '../../lib/html.ts';
import { formatMoney } from '../../lib/money.ts';
import { formatDate } from '../../lib/time.ts';
import { htmlReply, redirect } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import { buildDashboard, onboardingSteps } from '../../domain/dashboard.ts';
import { getOrganization, setOnboardingDismissed } from '../../domain/organization.ts';
import { TASK_PRIORITIES, DECISION_STATUSES, riskBand } from '../../domain/vocabulary.ts';
import type { CurrencySummary } from '../../domain/finance.ts';
import { page } from '../layout.ts';
import { pageHeader, section, stat, badge, statusBadge, emptyState, linkButton, barList, postButton, dueDate, pluralise } from '../ui.ts';
import { isOverdue } from '../../domain/work.ts';
import { activityList } from './activity.ts';

/** Compact planning summary for the dashboard. Every figure states its basis. */
export function financeHeadline(sums: CurrencySummary[]): SafeHtml {
  if (!sums.length) {
    return emptyState(
      'No financial planning records yet',
      'Startup costs, funding requirements and funding sources will be summarised here once entered. Nothing is estimated on your behalf.',
      linkButton('/finance/entries/new', 'Add a financial entry'),
    );
  }
  return html`${sums.map((s) => {
    const row = (type: string) => s.rows.find((r) => r.type === type)!;
    const startup = row('startup_cost');
    const capex = row('capital_expenditure');
    const opex = row('operating_expense');
    const revenue = row('revenue');
    const f = s.funding;
    return html`<div class="fin-headline">
      ${sums.length > 1 ? html`<h3 class="fin-headline__currency">${s.currency}</h3>` : ''}
      <dl class="fin-grid">
        <div><dt>Proposed startup costs <span class="basis">forecast</span></dt><dd>${startup.forecast.count ? formatMoney(startup.forecast.total, s.currency) : html`<span class="muted">Not entered</span>`}</dd></div>
        <div><dt>Capital expenditure <span class="basis">forecast</span></dt><dd>${capex.forecast.count ? formatMoney(capex.forecast.total, s.currency) : html`<span class="muted">Not entered</span>`}</dd></div>
        <div><dt>Operating expenses <span class="basis">budget</span></dt><dd>${opex.budget.count ? formatMoney(opex.budget.total, s.currency) : opex.forecast.count ? html`<span class="muted">No budget · ${formatMoney(opex.forecast.total, s.currency)} forecast</span>` : html`<span class="muted">Not entered</span>`}</dd></div>
        <div><dt>Revenue <span class="basis">forecast</span></dt><dd>${revenue.forecast.count ? formatMoney(revenue.forecast.total, s.currency) : html`<span class="muted">Not entered</span>`}</dd></div>
        <div><dt>Funding requirement ${f.requirementBasis ? html`<span class="basis">${f.requirementBasis}</span>` : ''}</dt><dd>${f.requirement !== null ? formatMoney(f.requirement, s.currency) : html`<span class="muted">Not entered</span>`}</dd></div>
        <div><dt>Secured funding <span class="basis">committed + received</span></dt><dd>${f.fundingEntryCount ? formatMoney(f.committed + f.received, s.currency) : html`<span class="muted">Not entered</span>`}</dd></div>
        <div><dt>Unconfirmed pipeline <span class="basis">potential + applied</span></dt><dd>${f.fundingEntryCount ? formatMoney(f.potential + f.applied, s.currency) : html`<span class="muted">Not entered</span>`}</dd></div>
        <div class="fin-grid__gap"><dt>Projected funding gap</dt><dd>${f.gap !== null ? html`${formatMoney(Math.max(f.gap, 0), s.currency)}${f.gap < 0 ? html` <span class="muted">(secured exceeds requirement by ${formatMoney(-f.gap, s.currency)})</span>` : ''}` : html`<span class="muted">Not calculated: ${f.gapUnavailable}</span>`}</dd></div>
      </dl>
    </div>`;
  })}
  <p class="footnote">Planning figures from the baseline plan only, excluding scenarios and archived ventures. Forecasts are estimates, not results. Potential and applied funding is not secured and does not reduce the gap.</p>`;
}

export function registerDashboard(router: Router): void {
  router.get('/', 'read', (ctx) => {
    const d = buildDashboard();
    const org = getOrganization();
    const steps = onboardingSteps();
    const done = steps.filter((s) => s.done).length;
    const showOnboarding = done < steps.length && !org.onboarding_dismissed_at;

    const onboarding = showOnboarding
      ? html`<section class="panel onboarding" aria-labelledby="onb-h">
          <div class="panel__head">
            <div><h2 id="onb-h">Getting started</h2><p class="panel__desc">${done} of ${steps.length} done. These steps set up NWPH OS with real information; nothing is filled in for you.</p></div>
            ${ctx.can('write') ? html`<div class="panel__actions">${postButton(ctx, '/onboarding/dismiss', 'Hide', { variant: 'ghost' })}</div>` : ''}
          </div>
          <ol class="steps">
            ${steps.map(
              (s, i) => html`<li class="${s.done ? 'steps__item is-done' : 'steps__item'}">
                <span class="steps__num" aria-hidden="true">${s.done ? '✓' : String(i + 1)}</span>
                <div><a href="${s.href}">${s.title}</a>${s.done ? html` <span class="visually-hidden">(done)</span>` : ''}<p>${s.description}</p></div>
              </li>`,
            )}
          </ol>
        </section>`
      : '';

    const stageRows = d.byStage.map((s) => ({ label: s.name, value: s.count, href: `/ventures?stage=${s.id}` }));
    const proposed = (d.byOperational.proposed ?? 0) + (d.byOperational.in_development ?? 0);
    const operational = d.byOperational.operational ?? 0;

    const body = html`
      ${pageHeader({
        eyebrow: org.name,
        title: 'Executive Dashboard',
        lede: org.guiding_philosophy ? html`“${org.guiding_philosophy}”` : null,
        actions: ctx.can('write') ? html`${linkButton('/ventures/new', 'New venture')}${linkButton('/tasks/new', 'New task', 'primary')}` : null,
      })}
      ${onboarding}
      <div class="stats" role="list">
        ${[
          stat('Ventures in portfolio', d.ventureTotal, { href: '/ventures', hint: `${operational} operational · ${proposed} proposed or in development` }),
          stat('Active projects', d.activeProjects, { href: '/projects?status=active', hint: `${d.openProjects} open in total` }),
          stat('Open tasks', d.openTaskCount, { href: '/projects?view=tasks' }),
          stat('Overdue tasks', d.overdueTasks.length, { href: '/projects?view=tasks&overdue=1', tone: d.overdueTasks.length ? 'bad' : undefined }),
          stat('Blocked tasks', d.blockedTasks.length, { href: '/projects?view=tasks&blocked=1', tone: d.blockedTasks.length ? 'warn' : undefined }),
          stat('Outstanding decisions', d.outstandingDecisions.length, { href: '/decisions?open=1' }),
          stat('Open risks', d.openRisks, { href: '/risks?active=1', hint: `${d.highRisks.length} in the high planning band` }),
          stat('Milestones due in 90 days', d.upcomingMilestones.length, { href: '/projects?view=milestones' }),
        ].map((s) => html`<div role="listitem">${s}</div>`)}
      </div>

      <div class="grid grid--2">
        ${section(
          'Ventures by development stage',
          d.ventureTotal
            ? html`${barList(stageRows, { unit: 'ventures' })}<p class="footnote">Development stage only. Legal and operational status are tracked separately on each venture.</p>`
            : emptyState('No ventures', 'Create a venture to see it here.', ctx.can('write') ? linkButton('/ventures/new', 'New venture') : null),
          { id: 'stages', actions: linkButton('/ventures', 'Portfolio', 'ghost') },
        )}
        ${section('Financial planning summary', financeHeadline(d.finance), { id: 'finance', actions: linkButton('/finance', 'Financial planning', 'ghost') })}
      </div>

      <div class="grid grid--2">
        ${section(
          'Upcoming deadlines',
          d.deadlines.length
            ? html`<ul class="list">${d.deadlines.map(
                (x) => html`<li class="list__item"><div class="list__main"><a href="${x.href}">${x.title}</a><span class="list__meta">${x.kind} · ${x.context}</span></div><time datetime="${x.date}" class="list__aside">${formatDate(x.date)}</time></li>`,
              )}</ul>`
            : emptyState('Nothing due in the next 30 days', 'Tasks, milestones, opportunity deadlines and review dates appear here when they fall due.'),
          { id: 'deadlines' },
        )}
        ${section(
          'Upcoming milestones',
          d.upcomingMilestones.length
            ? html`<ul class="list">${d.upcomingMilestones.slice(0, 8).map(
                (m) => html`<li class="list__item"><div class="list__main"><a href="/milestones/${m.id}/edit">${m.title}</a><span class="list__meta">${m.venture_name ?? 'NWPH'}${m.project_name ? ` · ${m.project_name}` : ''}${m.task_total ? ` · ${m.task_done}/${m.task_total} tasks done` : ''}</span></div><span class="list__aside">${dueDate(m.due_date, isOverdue(m))}</span></li>`,
              )}</ul>`
            : emptyState('No milestones in the next 90 days', 'Milestones with target dates appear here.'),
          { id: 'milestones' },
        )}
      </div>

      <div class="grid grid--2">
        ${section(
          'Overdue and blocked work',
          d.overdueTasks.length || d.blockedTasks.length
            ? html`<ul class="list">${[...new Map([...d.overdueTasks, ...d.blockedTasks].map((t) => [t.id, t])).values()].slice(0, 10).map(
                (t) => html`<li class="list__item"><div class="list__main"><a href="/tasks/${t.id}/edit">${t.title}</a>
                  <span class="list__meta">${t.venture_name ?? 'NWPH'}${t.project_name ? ` · ${t.project_name}` : ''}</span></div>
                  <span class="list__aside">${t.status === 'blocked' ? badge('Blocked', 'bad') : ''}${t.open_dependencies ? badge(`Waiting on ${pluralise(t.open_dependencies, 'dependency', 'dependencies')}`, 'warn') : ''}${isOverdue(t) ? badge(`Due ${formatDate(t.due_date)}`, 'bad') : ''}${statusBadge(TASK_PRIORITIES, t.priority)}</span></li>`,
              )}</ul>`
            : emptyState('No overdue or blocked tasks', 'Tasks past their due date, marked Blocked, or waiting on an unmet dependency appear here.'),
          { id: 'blocked' },
        )}
        ${section(
          'Unresolved high-band risks',
          d.highRisks.length
            ? html`<ul class="list">${d.highRisks.slice(0, 8).map(
                (r) => html`<li class="list__item"><div class="list__main"><a href="/risks/${r.id}/edit">${r.title}</a><span class="list__meta">${r.venture_name ?? 'NWPH'}${r.owner_name ? ` · ${r.owner_name}` : ' · no owner assigned'}</span></div>
                <span class="list__aside">${badge(`${riskBand(r.likelihood, r.impact).label} · L${r.likelihood}×I${r.impact}`, 'bad')}</span></li>`,
              )}</ul>`
            : emptyState('No high-band risks open', 'Open risks with a likelihood × impact of 12 or more, or severe impact, appear here.'),
          { id: 'risks' },
        )}
      </div>

      <div class="grid grid--2">
        ${section(
          'Outstanding decisions',
          d.outstandingDecisions.length
            ? html`<ul class="list">${d.outstandingDecisions.slice(0, 8).map(
                (x) => html`<li class="list__item"><div class="list__main"><a href="/decisions/${x.id}">${x.title}</a><span class="list__meta">${x.venture_name ?? 'NWPH'} · proposed ${formatDate(x.proposed_on)}${x.review_date ? ` · review ${formatDate(x.review_date)}` : ''}</span></div><span class="list__aside">${statusBadge(DECISION_STATUSES, x.status)}</span></li>`,
              )}</ul>`
            : emptyState('No outstanding decisions', 'Proposed, under-review and deferred decisions appear here until they are decided.'),
          { id: 'decisions' },
        )}
        ${section('Recent activity', activityList(d.activity, { compact: true }), { id: 'activity', actions: linkButton('/activity', 'All activity', 'ghost') })}
      </div>
      ${!showOnboarding && done < steps.length && ctx.can('write') ? html`<p class="footnote">${postButton(ctx, '/onboarding/show', 'Show the getting-started checklist', { variant: 'link' })}</p>` : ''}
    `;
    return htmlReply(page(ctx, { title: 'Executive Dashboard', active: 'dashboard', body }));
  });

  router.post('/onboarding/dismiss', 'write', () => {
    setOnboardingDismissed(true);
    return redirect('/');
  });
  router.post('/onboarding/show', 'write', () => {
    setOnboardingDismissed(false);
    return redirect('/');
  });
}
