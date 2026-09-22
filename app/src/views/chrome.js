/**
 * The frame every screen sits in: header, menus, footer, tab bar.
 *
 * All three navigations — the desktop menu bar, the phone's full-screen menu
 * and the footer — render from src/data/sitemap.js, so a screen cannot be
 * reachable from one and missing from another.
 */

import { html, raw, icon, cx } from '../lib/dom.js';
import { href } from '../lib/router.js';
import { sections, tabs, utilityLinks, footerColumns, footerLegal } from '../data/sitemap.js';
import { allBookings, getState } from '../lib/store.js';
import { airline } from '../data/brand.js';
import { imminentAdvisories } from '../data/advisories.js';

/* ── Header ──────────────────────────────────────────────────────────────── */

export function header(current, { offline = false } = {}) {
  const inner = current.route?.back;
  const heading = current.route?.title;
  const activeSection = current.route?.section;
  // Only live disruption goes in the chrome. The standing advisories are facts
  // about operating here, not news, and counting them would put a permanent
  // double-digit badge on every screen — which teaches people to ignore it.
  const advisories = imminentAdvisories();

  return html`
    <div class="on-chrome">
      ${offline ? html`
        <div class="offline-bar">${icon('offline', { size: 16 })} Offline — showing what is stored on this device</div>` : ''}

      <div class="utility-bar">
        <div class="utility-bar__inner">
          ${advisories.length ? html`
            <a class="utility-bar__alert" href="${href('/advisories')}">
              ${icon('warning', { size: 14 })}
              <span>${advisories.length} service${advisories.length > 1 ? 's' : ''} disrupted</span>
            </a>` : html`
            <span style="color:var(--on-chrome-muted)">${airline.base} · Inuit-owned</span>`}
          <span class="header-spacer"></span>
          ${utilityLinks.map((link) => html`<a href="${href(link.path)}">${link.label}</a>`)}
        </div>
      </div>

      <div class="header-bar">
        ${inner
          ? html`
            <button type="button" class="header-back" data-action="back" style="display:none" data-mobile-only>
              ${icon('back', { size: 20 })} Back
            </button>
            <a class="wordmark" href="${href('/')}">
              ${icon('wind', { size: 22, className: 'wordmark__mark' })}
              <span>North Winds<span class="visually-hidden"> Airlines</span></span>
            </a>`
          : html`
            <a class="wordmark" href="${href('/')}">
              ${icon('wind', { size: 22, className: 'wordmark__mark' })}
              <span>North Winds<span class="visually-hidden"> Airlines</span></span>
            </a>`}

        <nav class="mainnav" aria-label="Main">
          ${sections.map((section) => html`
            <div class="${cx('mainnav__item', { 'is-active': section.id === activeSection })}">
              <button type="button" class="mainnav__button" data-menu="${section.id}"
                aria-expanded="false" aria-controls="menu-${section.id}" aria-haspopup="true">
                ${section.label}
                ${icon('chevron-down', { size: 15, className: 'mainnav__chevron' })}
              </button>
              <div class="${cx('menu-panel', { 'menu-panel--wide': section.groups.length > 1 })}"
                id="menu-${section.id}" hidden>
                ${section.groups.map((group) => html`
                  <div class="menu-panel__group">
                    <p class="menu-panel__heading">${group.heading}</p>
                    ${group.links.map((link) => html`
                      <a href="${href(link.path)}">
                        <span class="menu-panel__title">${link.label}</span>
                        ${link.note ? html`<span class="menu-panel__note">${link.note}</span>` : ''}
                      </a>`)}
                  </div>`)}
              </div>
            </div>`)}
        </nav>

        <span class="header-spacer"></span>

        ${inner ? html`
          <h2 class="header-title" data-mobile-title>${heading}</h2>
          <span class="header-spacer"></span>` : ''}

        <a class="proto-chip" href="${href('/about')}">Prototype</a>

        <button type="button" class="menu-button" data-action="open-menu" aria-expanded="false" aria-controls="menu-sheet">
          ${icon('menu', { size: 22 })}<span class="visually-hidden">Menu</span>
        </button>
      </div>
    </div>`;
}

/* ── Full-screen menu (phones) ───────────────────────────────────────────── */

export function menuSheet() {
  return html`
    <div class="sheet__bar">
      <a class="wordmark" href="${href('/')}" data-action="close-menu">
        ${icon('wind', { size: 22, className: 'wordmark__mark' })}
        <span>North Winds</span>
      </a>
      <button type="button" class="menu-button" data-action="close-menu">
        ${icon('close', { size: 22 })}<span class="visually-hidden">Close menu</span>
      </button>
    </div>
    <div class="sheet__body">
      ${sections.map((section) => html`
        <div class="sheet__group">
          <p class="sheet__heading">${section.label}</p>
          ${section.groups.map((group) => html`
            <div class="sheet__links" style="margin-bottom:var(--s2)">
              ${group.links.map((link) => html`
                <a href="${href(link.path)}" data-action="close-menu">
                  <span>
                    <span>${link.label}</span>
                    ${link.note ? html`<span class="menu-panel__note">${link.note}</span>` : ''}
                  </span>
                  ${icon('forward', { size: 16 })}
                </a>`)}
            </div>`)}
        </div>`)}
    </div>`;
}

/* ── Tab bar (phones) ────────────────────────────────────────────────────── */

export function tabbar(current) {
  const tab = current.route?.tab ?? 'home';
  const upcoming = allBookings().filter((b) => b.status === 'confirmed').length;
  return html`
    ${tabs.map((item) => {
      const isMenu = item.id === 'more';
      const attrs = isMenu ? raw('data-action="open-menu"') : '';
      return html`
        <a href="${isMenu ? '#' : href(item.path)}" ${attrs}
           ${tab === item.id ? raw('aria-current="page"') : ''}>
          ${icon(item.icon, { size: 22 })}
          ${item.id === 'trips' && upcoming ? html`<span class="tabbar__dot" aria-hidden="true"></span>` : ''}
          <span>${item.label}</span>
          ${item.id === 'trips' && upcoming ? html`<span class="visually-hidden">, ${upcoming} booking${upcoming > 1 ? 's' : ''}</span>` : ''}
        </a>`;
    })}`;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

export function footer() {
  return html`
    <div class="footer-inner">
      <div class="footer-grid">
        ${footerColumns.map((column) => html`
          <div>
            <h2>${column.heading}</h2>
            <ul>${column.links.map((link) => html`<li><a href="${href(link.path)}">${link.label}</a></li>`)}</ul>
          </div>`)}
      </div>

      <div class="footer-bottom">
        <div>
          <p style="color:var(--on-chrome);font-weight:700;margin-bottom:var(--s2)">
            ${icon('wind', { size: 18 })} ${airline.name}
          </p>
          <p class="footer-note">
            A venture of ${airline.parent}, ${airline.base}.
            <strong style="color:var(--sun)">North Winds does not exist yet</strong> — this is a
            working prototype. <a href="${href('/about')}">What is real here</a>.
          </p>
        </div>
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:var(--s4)">
          ${footerLegal.map((link) => html`<li><a href="${href(link.path)}">${link.label}</a></li>`)}
        </ul>
      </div>
    </div>`;
}
