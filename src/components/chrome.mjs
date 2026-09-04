import { html, raw } from '../lib/html.mjs';
import { site, nav, footerNav } from '../data/site.mjs';
import { Mark } from './logo.mjs';

const navItems = (current, base) => nav.map((item) => html`
  <li><a class="nav__link" href="${base}${item.href}"${current === item.href ? raw(' aria-current="page"') : raw('')}>${item.label}</a></li>`);

export const SiteHeader = ({ current, base = '' }) => html`
  <header class="site-header">
    <div class="wrap site-header__bar">
      <a class="brand" href="${base}/">
        ${Mark({ size: 30, className: 'brand__mark' })}
        <span class="brand__text">
          <span class="brand__wordmark">North West Passage Holdings</span>
          <span class="brand__descriptor">Corporation · Iqaluit, Nunavut</span>
        </span>
      </a>

      <nav class="site-header__nav" aria-label="Primary">
        <ul class="nav__list">${navItems(current, base)}</ul>
      </nav>

      <details class="nav-toggle" data-nav-toggle>
        <summary aria-label="Menu">
          <span class="nav-toggle__icon" aria-hidden="true"></span>
          <span>Menu</span>
        </summary>
        <div class="nav-toggle__panel">
          <nav aria-label="Primary, mobile">
            <ul class="nav__list">${navItems(current, base)}</ul>
          </nav>
        </div>
      </details>
    </div>
  </header>`;

export const SiteFooter = ({ base = '', operating = 0, total = 0 }) => html`
  <footer class="site-footer">
    <div class="wrap">
      <div class="site-footer__grid">
        <div>
          <p class="site-footer__brand">
            ${Mark({ size: 26, className: 'site-footer__mark' })}
            <span>North West Passage Holdings Corporation</span>
          </p>
          <p class="site-footer__status">
            <strong>${operating} of ${total} ventures are currently operating.</strong>
            NWPH is pre-incorporation. Nothing described on this site is trading,
            taking bookings, or accepting customers. Only one venture is named.
          </p>
        </div>
        <div>
          <h2>Site</h2>
          <ul>${footerNav.map((item) => html`<li><a href="${base}${item.href}">${item.label}</a></li>`)}</ul>
        </div>
        <div>
          <h2>Contact</h2>
          <ul>
            <li>${site.headquarters}</li>
            <li><a href="mailto:${site.email}">${site.email}</a></li>
          </ul>
        </div>
      </div>
      <div class="site-footer__base">
        <p>© ${new Date().getFullYear()} North West Passage Holdings Corporation · Inuit-owned · Nunavut</p>
      </div>
      <p class="site-footer__legal">
        North West Passage Holdings Corporation is not yet incorporated. Nothing on this site
        constitutes an offer of securities, a solicitation of investment, an offer to sell goods
        or services, or an offer of employment.
      </p>
    </div>
  </footer>`;
