import { html, raw } from '../lib/html.mjs';
import { SubsidiaryBrowser, CTABlock } from '../components/ui.mjs';
import { STATUS, STATUS_VALUES } from '../data/status.mjs';

export function subsidiariesIndex({ subsidiaries, stats, base }) {
  return {
    path: '/subsidiaries/',
    current: '/subsidiaries/',
    title: 'Subsidiaries',
    description: `The ${stats.total} companies in the North West Passage Holdings portfolio, and the development stage of each. None are currently operating.`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">The portfolio</p>
          <h1>Subsidiaries</h1>
          <p class="section__intro">
            ${stats.total} companies, each addressing a sector where Nunavummiut have no
            locally-owned alternative.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">${stats.operating} of ${stats.total} are operating.</p>
            <p>
              Every company below is at a pre-operational stage. None is incorporated,
              trading, taking bookings, or hiring.
            </p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <h2 class="visually-hidden">Browse subsidiaries</h2>
          <div class="table-scroll" tabindex="0" role="region" aria-label="What each stage means">
            <table>
              <caption>What each stage label means. None of them means operating.</caption>
              <thead>
                <tr><th scope="col">Stage</th><th scope="col">Meaning</th><th scope="col">Companies</th></tr>
              </thead>
              <tbody>
                ${STATUS_VALUES.map((value) => html`
                  <tr>
                    <th scope="row">${STATUS[value].label}</th>
                    <td>${STATUS[value].description}</td>
                    <td>${stats.byStatus[value]}</td>
                  </tr>`)}
                <tr>
                  <th scope="row">Operating</th>
                  <td>Trading, with customers. No company in this portfolio has reached this stage.</td>
                  <td>${stats.operating}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top: var(--space-xl)">
            ${SubsidiaryBrowser(subsidiaries, { base })}
          </div>
        </div>
      </section>`,
  };
}

export function subsidiaryDetail(subsidiary, { stats, base }) {
  const meta = STATUS[subsidiary.status];
  return {
    path: `/subsidiaries/${subsidiary.slug}/`,
    current: '/subsidiaries/',
    title: subsidiary.name,
    description: `${subsidiary.legalName} — ${meta.label.toLowerCase()}. ${subsidiary.summary}`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">${subsidiary.sector}</p>
          <h1>${subsidiary.name}</h1>
          <p class="section__intro">${subsidiary.legalName}</p>
          <div class="status-notice">
            <p class="status-notice__head">${meta.label}${subsidiary.target ? ` · ${subsidiary.target}` : ''}</p>
            <p>${meta.description} <strong>This company is not operating.</strong></p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split">
            <div class="prose">
              <h2>What it is</h2>
              ${raw(subsidiary.body)}
            </div>
            <div>
              <div class="table-scroll" tabindex="0" role="region" aria-label="${subsidiary.name} at a glance">
                <table>
                  <caption>${subsidiary.name} at a glance</caption>
                  <tbody>
                    <tr><th scope="row">Legal name</th><td>${subsidiary.legalName}</td></tr>
                    <tr><th scope="row">Sector</th><td>${subsidiary.sector}</td></tr>
                    <tr><th scope="row">Stage</th><td>${meta.label}</td></tr>
                    <tr><th scope="row">Target</th><td>${subsidiary.target || 'Not set'}</td></tr>
                    <tr><th scope="row">Operating</th><td>No</td></tr>
                    <tr><th scope="row">Incorporated</th><td>No</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style="margin-top: var(--space-2xl)">
            ${CTABlock({
              title: 'Working with this subsidiary',
              body: 'No contracts, bookings or applications are being accepted. Suppliers and partners can register now to be contacted when that changes.',
              actions: [
                { href: `${base}/procurement/`, label: 'Register as a supplier', primary: true },
                { href: `${base}/contact/`, label: 'Contact NWPH' },
              ],
            })}
          </div>

          <p style="margin-top: var(--space-l)"><a href="${base}/subsidiaries/">← All subsidiaries</a></p>
        </div>
      </section>`,
  };
}
