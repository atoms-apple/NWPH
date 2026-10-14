/** Presentation components. Pure functions from data to SafeHtml. */
import { html, raw, attrs, cx, isRaw, type SafeHtml } from '../lib/html.ts';
import { formatDate } from '../lib/time.ts';
import type { Context } from '../http/context.ts';
import { type Option, labelOf } from '../domain/vocabulary.ts';

export type Tone = 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'muted' | 'accent';

export const badge = (text: string, tone: Tone = 'neutral', title?: string): SafeHtml =>
  html`<span class="${cx('badge', `badge--${tone}`)}"${attrs({ title })}>${text}</span>`;

const TONES: Record<string, Tone> = {
  // generic
  completed: 'good',
  approved: 'good',
  awarded: 'good',
  verified: 'good',
  received: 'good',
  operational: 'good',
  resolved: 'good',
  mitigated: 'good',
  established: 'good',
  active: 'info',
  in_progress: 'info',
  under_review: 'info',
  submitted: 'info',
  in_preparation: 'info',
  in_development: 'info',
  in_formation: 'info',
  committed: 'info',
  monitoring: 'info',
  eligible: 'info',
  blocked: 'bad',
  rejected: 'bad',
  occurred: 'bad',
  unsuccessful: 'muted',
  declined: 'muted',
  critical: 'bad',
  high: 'warn',
  open: 'warn',
  on_hold: 'warn',
  deferred: 'warn',
  paused: 'warn',
  outdated: 'warn',
  unverified: 'neutral',
  cancelled: 'muted',
  superseded: 'muted',
  expired: 'muted',
  not_pursuing: 'muted',
  discontinued: 'muted',
  closed: 'muted',
  dissolved: 'muted',
  low: 'muted',
};

export const statusBadge = (options: ReadonlyArray<Option>, value: string | null | undefined): SafeHtml => {
  const opt = options.find((o) => o.value === value);
  return badge(labelOf(options, value), TONES[value ?? ''] ?? 'neutral', opt?.description);
};

export function pageHeader(opts: {
  title: string;
  eyebrow?: SafeHtml | string | null;
  lede?: SafeHtml | string | null;
  actions?: SafeHtml | null;
  meta?: SafeHtml | null;
}): SafeHtml {
  return html`<header class="page-header">
    <div class="page-header__text">
      ${opts.eyebrow ? html`<p class="eyebrow">${opts.eyebrow}</p>` : ''}
      <h1>${opts.title}</h1>
      ${opts.meta ? html`<div class="page-header__meta">${opts.meta}</div>` : ''}
      ${opts.lede ? html`<p class="lede">${opts.lede}</p>` : ''}
    </div>
    ${opts.actions ? html`<div class="page-header__actions">${opts.actions}</div>` : ''}
  </header>`;
}

export const linkButton = (href: string, label: string, variant: 'primary' | 'secondary' | 'ghost' = 'secondary', extra: Record<string, unknown> = {}): SafeHtml =>
  html`<a class="${cx('btn', `btn--${variant}`)}"${attrs({ href, ...extra })}>${label}</a>`;

/** A POST action rendered as a small form. `confirm` adds a JS confirmation dialog. */
export function postButton(
  ctx: Context,
  action: string,
  label: string,
  opts: { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'; confirm?: string; fields?: Record<string, string>; className?: string } = {},
): SafeHtml {
  return html`<form method="post" action="${action}" class="${cx('inline-form', opts.className)}"${attrs({ 'data-confirm': opts.confirm })}>
    <input type="hidden" name="_csrf" value="${ctx.csrf}">
    ${Object.entries(opts.fields ?? {}).map(([k, v]) => html`<input type="hidden" name="${k}" value="${v}">`)}
    <button type="submit" class="${cx('btn', `btn--${opts.variant ?? 'secondary'}`)}">${label}</button>
  </form>`;
}

export function emptyState(title: string, body: string | SafeHtml, action?: SafeHtml | null): SafeHtml {
  return html`<div class="empty">
    <p class="empty__title">${title}</p>
    <p class="empty__body">${body}</p>
    ${action ? html`<div class="empty__action">${action}</div>` : ''}
  </div>`;
}

export function notice(kind: 'info' | 'warn' | 'success' | 'error', body: SafeHtml | string, title?: string): SafeHtml {
  return html`<div class="${cx('notice', `notice--${kind}`)}" role="${kind === 'error' ? 'alert' : 'note'}">
    ${title ? html`<p class="notice__title">${title}</p>` : ''}
    <div class="notice__body">${body}</div>
  </div>`;
}

export function stat(label: string, value: string | number, opts: { href?: string; hint?: string | null; tone?: Tone } = {}): SafeHtml {
  const inner = html`<span class="stat__value">${value}</span><span class="stat__label">${label}</span>${opts.hint ? html`<span class="stat__hint">${opts.hint}</span>` : ''}`;
  return opts.href
    ? html`<a class="${cx('stat', opts.tone && `stat--${opts.tone}`)}" href="${opts.href}">${inner}</a>`
    : html`<div class="${cx('stat', opts.tone && `stat--${opts.tone}`)}">${inner}</div>`;
}

export const section = (title: string, body: SafeHtml, opts: { actions?: SafeHtml | null; id?: string; description?: string } = {}): SafeHtml =>
  html`<section class="panel"${attrs({ id: opts.id, 'aria-labelledby': opts.id ? `${opts.id}-h` : undefined })}>
    <div class="panel__head">
      <div>
        <h2${attrs({ id: opts.id ? `${opts.id}-h` : undefined })}>${title}</h2>
        ${opts.description ? html`<p class="panel__desc">${opts.description}</p>` : ''}
      </div>
      ${opts.actions ? html`<div class="panel__actions">${opts.actions}</div>` : ''}
    </div>
    ${body}
  </section>`;

export const date = (d: string | null | undefined): SafeHtml =>
  d ? html`<time datetime="${d}">${formatDate(d)}</time>` : html`<span class="muted">—</span>`;

export const dueDate = (d: string | null | undefined, overdue: boolean): SafeHtml =>
  d
    ? html`<time datetime="${d}" class="${cx(overdue && 'overdue')}">${formatDate(d)}${overdue ? html` <span class="badge badge--bad">Overdue</span>` : ''}</time>`
    : html`<span class="muted">No date</span>`;

const isBlank = (v: unknown): boolean => v === null || v === undefined || v === '' || (isRaw(v) && v.value.trim() === '');

export function definitionList(items: ReadonlyArray<{ label: string; value: SafeHtml | string | null | undefined; provisional?: boolean }>): SafeHtml {
  return html`<dl class="deflist">
    ${items.map(
      (i) => html`<div class="deflist__row">
        <dt>${i.label}${i.provisional ? html` ${badge('Provisional', 'warn', 'A provisional default, not a confirmed fact.')}` : ''}</dt>
        <dd>${isBlank(i.value) ? html`<span class="muted">Not yet recorded</span>` : i.value}</dd>
      </div>`,
    )}
  </dl>`;
}

/** GET filter bar. Everything is a real query parameter, so filters are linkable and work without JS. */
export function filterBar(opts: {
  action: string;
  q?: { value: string; placeholder: string; label?: string };
  selects?: ReadonlyArray<{ name: string; label: string; value: string; options: ReadonlyArray<Option>; emptyLabel?: string }>;
  checks?: ReadonlyArray<{ name: string; label: string; checked: boolean }>;
  hidden?: Record<string, string>;
  note?: string;
}): SafeHtml {
  const active = Boolean(opts.q?.value || opts.selects?.some((s) => s.value) || opts.checks?.some((c) => c.checked));
  return html`<form class="filters" method="get" action="${opts.action}" role="search">
    ${Object.entries(opts.hidden ?? {}).map(([k, v]) => (v ? html`<input type="hidden" name="${k}" value="${v}">` : ''))}
    ${opts.q
      ? html`<label class="filters__search"><span class="visually-hidden">${opts.q.label ?? 'Search'}</span>
          <input type="search" name="q" value="${opts.q.value}" placeholder="${opts.q.placeholder}"></label>`
      : ''}
    ${(opts.selects ?? []).map(
      (s) => html`<label class="filters__select"><span class="filters__label">${s.label}</span>
        <select name="${s.name}" data-autosubmit>
          <option value="">${s.emptyLabel ?? 'All'}</option>
          ${s.options.map((o) => html`<option value="${o.value}"${attrs({ selected: o.value === s.value })}>${o.label}</option>`)}
        </select></label>`,
    )}
    ${(opts.checks ?? []).map(
      (c) => html`<label class="filters__check"><input type="checkbox" name="${c.name}" value="1" data-autosubmit${attrs({ checked: c.checked })}> ${c.label}</label>`,
    )}
    <div class="filters__buttons">
      <button type="submit" class="btn btn--secondary">Apply</button>
      ${active ? html`<a class="btn btn--ghost" href="${opts.action}${opts.hidden && Object.values(opts.hidden).some(Boolean) ? '?' + new URLSearchParams(Object.entries(opts.hidden).filter(([, v]) => v)).toString() : ''}">Clear</a>` : ''}
    </div>
    ${opts.note ? html`<p class="filters__note">${opts.note}</p>` : ''}
  </form>`;
}

/** Horizontal bar list: single-series magnitude. Labels and values are text; bars are decoration. */
export function barList(rows: ReadonlyArray<{ label: string; value: number; display?: string; href?: string }>, opts: { unit?: string } = {}): SafeHtml {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return html`<ul class="bars">
    ${rows.map((r) => {
      const pct = (r.value / max) * 100;
      const label = r.href ? html`<a href="${r.href}">${r.label}</a>` : r.label;
      return html`<li class="bars__row" title="${r.label}: ${r.display ?? r.value}${opts.unit ? ' ' + opts.unit : ''}">
        <span class="bars__label">${label}</span>
        <svg class="bars__track" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          ${r.value > 0 ? raw(`<rect x="0" y="0" height="10" width="${Math.max(pct, 1.5).toFixed(2)}" rx="1.2"></rect>`) : ''}
        </svg>
        <span class="bars__value">${r.display ?? String(r.value)}</span>
      </li>`;
    })}
  </ul>`;
}

export const muted = (text: string): SafeHtml => html`<span class="muted">${text}</span>`;

export const exampleBadge = (isExample: number | boolean | undefined): SafeHtml | '' =>
  isExample ? badge('Example', 'accent', 'Demonstration record. Remove from Settings.') : '';

export const archivedBadge = (archivedAt: string | null | undefined): SafeHtml | '' => (archivedAt ? badge('Archived', 'muted') : '');

export function pluralise(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Link to a venture or "NWPH" for parent-level records. */
export const scopeLink = (r: { venture_name: string | null; venture_slug: string | null }, path = ''): SafeHtml =>
  r.venture_slug ? html`<a href="/ventures/${r.venture_slug}${path}">${r.venture_name}</a>` : html`<span class="muted">NWPH (parent)</span>`;

export function tabs(items: ReadonlyArray<{ href: string; label: string; active: boolean; count?: number | null }>, label: string): SafeHtml {
  return html`<nav class="tabs" aria-label="${label}"><ul>
    ${items.map(
      (t) => html`<li><a href="${t.href}"${attrs({ 'aria-current': t.active ? 'page' : null })}>${t.label}${t.count ? html` <span class="tabs__count">${t.count}</span>` : ''}</a></li>`,
    )}
  </ul></nav>`;
}

export function viewToggle(base: URLSearchParams, path: string, current: string, views: ReadonlyArray<[string, string]>): SafeHtml {
  return html`<div class="segmented" role="group" aria-label="View">
    ${views.map(([value, label]) => {
      const p = new URLSearchParams(base);
      p.set('view', value);
      return html`<a href="${path}?${p.toString()}"${attrs({ 'aria-current': current === value ? 'true' : null })}>${label}</a>`;
    })}
  </div>`;
}
