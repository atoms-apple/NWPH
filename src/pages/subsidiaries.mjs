import { html, raw } from '../lib/html.mjs';
import { SubsidiaryBrowser, CTABlock, MilestoneList } from '../components/ui.mjs';
import { STATUS, STATUS_VALUES } from '../data/status.mjs';

export function subsidiariesIndex({ subsidiaries, stats, base }) {
  return {
    path: '/subsidiaries/',
    current: '/subsidiaries/',
    title: 'Subsidiaries',
    description: `The ${stats.total} ventures in the North West Passage Holdings portfolio and the development stage of each. None are operating; only one is named.`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">The portfolio</p>
          <h1>Subsidiaries</h1>
          <p class="section__intro">
            ${stats.total} ventures, each addressing a sector where Nunavummiut have no
            locally-owned alternative.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">${stats.operating} of ${stats.total} are operating.</p>
            <p>
              Every venture below is at a pre-operational stage. None is incorporated,
              trading, taking bookings, or hiring. <strong>Only one is named</strong> — the rest are
              published by sector, because a company that does not legally exist should not be
              given a name that reads as though it does.
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
                <tr><th scope="col">Stage</th><th scope="col">Meaning</th><th scope="col">Ventures</th></tr>
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
                  <td>Trading, with customers. No venture in this portfolio has reached this stage.</td>
                  <td>${stats.operating}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top: var(--space-xl)">
            ${SubsidiaryBrowser(subsidiaries, { base })}
          </div>

          <div class="callout" style="margin-top: var(--space-xl)">
            <p><strong>Why six of these have no name.</strong></p>
            <p>
              The sectors are committed to. The companies are not yet companies — none is
              incorporated, and several have not been designed beyond the decision to enter the
              sector. A name published now would be repeated, indexed, and quoted back as evidence
              of something operating. Names appear here at incorporation, not before.
            </p>
          </div>
        </div>
      </section>`,
  };
}

export function subsidiaryDetail(subsidiary, { stats, base, milestones = [] }) {
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
          <div class="split split--wide">
            <div class="prose">
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
        </div>
      </section>

      ${milestones.length ? html`
        <section class="section section--tint">
          <div class="wrap">
            <p class="section__label">Path to operating</p>
            <h2>What has to happen before ${subsidiary.name} can trade</h2>
            <p class="section__intro">
              ${milestones.length} steps stand between the current position and a first paying
              season. They are sequential, and the target date depends on the slowest of them —
              which is normally financing.
            </p>
            ${MilestoneList(milestones)}
            <p class="field__hint" style="margin-top: var(--space-m)">
              No step is marked complete. NWPH is not incorporated, so none of them can be.
            </p>
          </div>
        </section>` : ''}

      <section class="section">
        <div class="wrap">
          <div style="margin-top: 0">
            ${CTABlock({
              title: 'Working with this subsidiary',
              body: 'No contracts, bookings or applications are being accepted. Suppliers and partners can register now to be contacted when that changes.',
              actions: [
                { href: `${base}/procurement/`, label: 'Register as a supplier', primary: true },
                { href: `${base}/contact/`, label: 'Contact NWPH' },
              ],
            })}
          </div>

          <p style="margin-top: var(--space-l)"><a href="${base}/subsidiaries/">← All ventures</a></p>
        </div>
      </section>`,
  };
}
