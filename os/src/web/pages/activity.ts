import { html, type SafeHtml } from '../../lib/html.ts';
import { formatDateTime } from '../../lib/time.ts';
import { htmlReply } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import { listActivity, humanise, ENTITY_LABELS, type ActivityRow, type EntityType } from '../../domain/records.ts';
import { page } from '../layout.ts';
import { pageHeader, emptyState, filterBar, section } from '../ui.ts';
import { ventureScope, ventureFilterOptions } from '../common.ts';

/** Where an activity entry's record lives, if it still has a page. */
export function entityHref(type: EntityType, id: string, ventureSlug: string | null): string | null {
  switch (type) {
    case 'venture':
      return ventureSlug ? `/ventures/${ventureSlug}` : null;
    case 'project':
      return `/projects/${id}`;
    case 'task':
      return `/tasks/${id}/edit`;
    case 'milestone':
      return `/milestones/${id}/edit`;
    case 'decision':
      return `/decisions/${id}`;
    case 'document':
      return `/documents/${id}`;
    case 'opportunity':
      return `/opportunities/${id}`;
    case 'financial_entry':
      return `/finance/entries/${id}`;
    case 'risk':
      return `/risks/${id}/edit`;
    case 'organization':
      return '/organization';
    case 'stage':
    case 'user':
      return '/settings';
    default:
      return null;
  }
}

function formatChange(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(empty)';
  const s = String(v);
  return s.length > 160 ? s.slice(0, 157) + '…' : s;
}

export function changesTable(changesJson: string | null): SafeHtml | '' {
  if (!changesJson) return '';
  let changes: Record<string, [unknown, unknown]>;
  try {
    changes = JSON.parse(changesJson);
  } catch {
    return '';
  }
  const entries = Object.entries(changes).filter(([k]) => k !== 'provisional_fields' && !k.endsWith('verified_by'));
  if (!entries.length) return '';
  return html`<details class="changes"><summary>${entries.length} field${entries.length === 1 ? '' : 's'} changed</summary>
    <table class="table table--compact"><thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
    <tbody>${entries.map(([k, [a, b]]) => html`<tr><th scope="row">${humanise(k)}${k.endsWith('_minor') ? ' (cents)' : ''}</th><td>${formatChange(a)}</td><td>${formatChange(b)}</td></tr>`)}</tbody></table>
  </details>`;
}

export function activityList(rows: ActivityRow[], opts: { compact?: boolean; showVenture?: boolean } = {}): SafeHtml {
  if (!rows.length) return emptyState('No activity yet', 'Changes to ventures, projects, decisions, finances and documents are recorded here as they happen.');
  return html`<ol class="timeline">
    ${rows.map((r) => {
      const href = entityHref(r.entity_type, r.entity_id, r.venture_slug);
      return html`<li class="timeline__item">
        <div class="timeline__head">
          <span class="timeline__summary">${href ? html`<a href="${href}">${r.summary}</a>` : r.summary}</span>
        </div>
        <p class="timeline__meta"><time datetime="${r.occurred_at}">${formatDateTime(r.occurred_at)}</time> · ${r.actor_name ?? 'System'}${opts.showVenture !== false && r.venture_name ? ` · ${r.venture_name}` : ''} · ${ENTITY_LABELS[r.entity_type] ?? r.entity_type}</p>
        ${opts.compact ? '' : changesTable(r.changes)}
      </li>`;
    })}
  </ol>`;
}

const PAGE_SIZE = 50;

export function registerActivity(router: Router): void {
  router.get('/activity', 'read', (ctx) => {
    const scope = ventureScope(ctx);
    const type = ctx.query.get('type') ?? '';
    const pageNo = Math.max(1, Math.min(10_000, Number(ctx.query.get('page')) || 1));
    const rows = listActivity({
      ventureId: scope.ventureId,
      entityType: type && type in ENTITY_LABELS ? type : null,
      limit: PAGE_SIZE + 1,
      offset: (pageNo - 1) * PAGE_SIZE,
    });
    const filtered = scope.scope === 'parent' ? rows.filter((r) => !r.venture_id) : rows;
    const more = filtered.length > PAGE_SIZE;
    const p = (n: number) => {
      const q = new URLSearchParams(ctx.query);
      q.set('page', String(n));
      return `/activity?${q.toString()}`;
    };
    const body = html`${pageHeader({ title: 'Activity History', lede: 'An append-only record of meaningful changes. Edits keep their before and after values. Passwords, session data and credentials are never recorded.' })}
      ${filterBar({
        action: '/activity',
        selects: [
          { name: 'venture', label: 'Venture', value: scope.slug, options: ventureFilterOptions() },
          { name: 'type', label: 'Record type', value: type, options: Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })) },
        ],
      })}
      ${section('Events', html`${activityList(filtered.slice(0, PAGE_SIZE))}
        <nav class="pager" aria-label="Pages">${pageNo > 1 ? html`<a class="btn btn--ghost" href="${p(pageNo - 1)}">Newer</a>` : ''}${more ? html`<a class="btn btn--ghost" href="${p(pageNo + 1)}">Older</a>` : ''}</nav>`)}`;
    return htmlReply(page(ctx, { title: 'Activity History', active: 'activity', body }));
  });
}
