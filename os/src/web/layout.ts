import { html, raw, render, attrs, cx, type SafeHtml } from '../lib/html.ts';
import type { Context } from '../http/context.ts';
import { notice } from './ui.ts';

export const ASSET_VERSION = '1';

type NavKey =
  | 'dashboard'
  | 'ventures'
  | 'projects'
  | 'finance'
  | 'decisions'
  | 'documents'
  | 'opportunities'
  | 'risks'
  | 'activity'
  | 'organization'
  | 'settings';

const ICONS: Record<NavKey, string> = {
  dashboard: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  ventures: '<path d="M3 7h18v13H3zM8 7V4h8v3"/>',
  projects: '<path d="M4 5h16M4 12h16M4 19h10"/><path d="M18 17l2 2 3-4"/>',
  finance: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  decisions: '<path d="M12 3v18M5 7h14l-2 5H7zM5 21h14"/>',
  documents: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>',
  opportunities: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  risks: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  organization: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};

const icon = (k: NavKey): SafeHtml =>
  html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${raw(ICONS[k])}</svg>`;

const PRIMARY: ReadonlyArray<[NavKey, string, string]> = [
  ['dashboard', 'Executive Dashboard', '/'],
  ['ventures', 'Venture Portfolio', '/ventures'],
  ['projects', 'Projects & Tasks', '/projects'],
  ['finance', 'Financial Planning', '/finance'],
  ['decisions', 'Governance & Decisions', '/decisions'],
  ['documents', 'Documents & Research', '/documents'],
  ['opportunities', 'Opportunities', '/opportunities'],
  ['risks', 'Risks & Dependencies', '/risks'],
  ['activity', 'Activity History', '/activity'],
];

const SECONDARY: ReadonlyArray<[NavKey, string, string]> = [
  ['organization', 'Organization Profile', '/organization'],
  ['settings', 'Settings', '/settings'],
];

function nav(ctx: Context, active: NavKey | null): SafeHtml {
  const item = ([key, label, href]: [NavKey, string, string]) =>
    html`<li><a href="${href}" class="${cx('nav__link', active === key && 'is-active')}"${attrs({ 'aria-current': active === key ? 'page' : null })}>${icon(key)}<span>${label}</span></a></li>`;
  return html`<nav class="nav" aria-label="Main">
    <ul class="nav__list">${PRIMARY.map(item)}</ul>
    <ul class="nav__list nav__list--secondary">${SECONDARY.map(item)}</ul>
    <div class="nav__user">
      <p class="nav__user-name">${ctx.user?.display_name}</p>
      <p class="nav__user-role">${ctx.user?.role === 'owner' ? 'Owner' : ctx.user?.role === 'editor' ? 'Editor' : 'Viewer (read-only)'}</p>
      <form method="post" action="/logout"><input type="hidden" name="_csrf" value="${ctx.csrf}"><button type="submit" class="btn btn--ghost btn--small">Sign out</button></form>
    </div>
  </nav>`;
}

const brand = html`<a class="brand" href="/">
  <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="4"/><path d="M8 22V10l8 8 8-8v12" fill="none" stroke-width="2.2"/></svg>
  <span class="brand__text"><span class="brand__name">NWPH OS</span><span class="brand__sub">Enterprise headquarters</span></span>
</a>`;

function documentShell(title: string, body: SafeHtml, bodyClass: string): string {
  return '<!doctype html>' + render(html`<html lang="en-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="same-origin">
  <meta name="color-scheme" content="light">
  <title>${title} · NWPH OS</title>
  <link rel="stylesheet" href="/assets/app.css?v=${ASSET_VERSION}">
  <link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
  <script src="/assets/app.js?v=${ASSET_VERSION}" defer></script>
</head>
<body class="${bodyClass}">${body}</body>
</html>`);
}

export function page(ctx: Context, opts: { title: string; active: NavKey | null; body: SafeHtml }): string {
  const flash = ctx.session?.flash;
  const body = html`<a class="skip-link" href="#main">Skip to content</a>
  <div class="shell">
    <header class="topbar">
      ${brand}
      <details class="menu" data-menu>
        <summary class="menu__toggle"><span class="visually-hidden">Open </span>Menu</summary>
        <div class="menu__panel">${nav(ctx, opts.active)}</div>
      </details>
    </header>
    <aside class="sidebar">${brand}${nav(ctx, opts.active)}</aside>
    <main id="main" class="main" tabindex="-1">
      ${flash ? html`<div class="flash">${notice(flash.kind === 'error' ? 'error' : flash.kind === 'success' ? 'success' : 'info', flash.message)}</div>` : ''}
      ${!ctx.can('write') ? html`<div class="flash">${notice('info', 'You have read-only access. Ask an owner if you need to make changes.')}</div>` : ''}
      ${opts.body}
    </main>
  </div>`;
  return documentShell(opts.title, body, 'app');
}

/** Minimal shell for login, setup and error pages. */
export function barePage(title: string, body: SafeHtml): string {
  return documentShell(title, html`<main id="main" class="bare"><div class="bare__card">${brand}${body}</div></main>`, 'bare-body');
}
