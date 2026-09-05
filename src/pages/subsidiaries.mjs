import { html, raw } from '../lib/html.mjs';
import { SubsidiaryBrowser, CTABlock, MilestoneList, Breadcrumbs, OnThisPage, Facts } from '../components/ui.mjs';
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
          <h2 class="visually-hidden">Browse the portfolio</h2>
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

/**
 * Venture page.
 *
 * A named venture reads as a company page. An unnamed one reads as a sector
 * assessment: the same template, but titled by sector and stating throughout
 * that no company has been formed.
 */
export function subsidiaryDetail(subsidiary, { stats, base, milestones = [], manager = null, roles = [], news = [] }) {
  const meta = STATUS[subsidiary.status];
  const named = Boolean(subsidiary.name);
  const title = named ? subsidiary.name : subsidiary.sector;

  return {
    path: `/subsidiaries/${subsidiary.slug}/`,
    current: '/subsidiaries/',
    title,
    description: named
      ? `${subsidiary.legalName} — ${meta.label.toLowerCase()}. ${subsidiary.summary}`
      : `${subsidiary.sector} in Nunavut: the gap, what a venture would require, and why NWPH has not yet formed a company in this sector.`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/subsidiaries/`, label: 'Portfolio' },
            { label: title },
          ])}
          <p class="section__label">${named ? subsidiary.sector : 'Sector assessment'}</p>
          <h1>${title}</h1>
          <p class="section__intro">${named ? subsidiary.legalName : subsidiary.summary}</p>
          <div class="status-notice">
            <p class="status-notice__head">${meta.label}${subsidiary.target ? ` · ${subsidiary.target}` : ''}</p>
            <p>
              ${meta.description}
              ${named
                ? html`<strong>Managing Director: ${subsidiary.managingDirector ?? '—'}.</strong>`
                : html`<strong>No company has been formed in this sector.</strong>`}
            </p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split split--wide">
            <div class="prose">
              ${raw(subsidiary.body)}
            </div>
            <div class="stack-l">
              ${OnThisPage(subsidiary.headings)}
              ${Facts(named ? [
                ['Legal name', subsidiary.legalName],
                ['Sector', subsidiary.sector],
                ['Status', meta.label],
                ...(subsidiary.founded ? [['Formed', String(subsidiary.founded)]] : []),
                ...(subsidiary.managingDirector ? [['Managing Director', subsidiary.managingDirector]] : []),
                ...(subsidiary.staff ? [['Staff', subsidiary.staff]] : []),
                ...(subsidiary.communities ? [['Operating in', subsidiary.communities]] : []),
              ] : [
                ['Sector', subsidiary.sector],
                ['Stage', meta.label],
                ['Company formed', 'No'],
                ['Name published', 'No'],
                ['Operating', 'No'],
                ['Target', subsidiary.target || 'Not scheduled'],
              ], { label: `${title} at a glance` })}
            </div>
          </div>
        </div>
      </section>

      ${milestones.length ? html`
        <section class="section section--tint">
          <div class="wrap">
            <p class="section__label">Path to operating</p>
            <h2>What has to happen before ${title} can trade</h2>
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

      ${manager ? html`
        <section class="section section--tint">
          <div class="wrap">
            <p class="section__label">Accountability</p>
            <h2>Who runs ${title}</h2>
            <div class="split split--wide" style="margin-top: var(--space-l)">
              <div class="founder">
                <div class="founder__identity">
                  <h3 class="founder__name">${manager.name}</h3>
                  <p class="founder__role">${manager.role}</p>
                </div>
                <div class="founder__bio">
                  ${raw(manager.body)}
                  ${manager.appointed ? html`<p>Appointed ${manager.appointed}.</p>` : ''}
                </div>
              </div>
              <div class="callout">
                <p><strong>Each company has its own board.</strong></p>
                <p>
                  The managing director is accountable to that board, not directly to the holding
                  company's executive. The holding company decides capital, senior appointments,
                  and whether the company continues.
                </p>
                <p><a href="${base}/about/governance/">How the portfolio is governed →</a></p>
              </div>
            </div>
          </div>
        </section>` : ''}

      ${roles.length ? html`
        <section class="section">
          <div class="wrap">
            <p class="section__label">Careers</p>
            <h2>${roles.length} open position${roles.length === 1 ? '' : 's'} at ${title}</h2>
            <ul class="grid grid--2" role="list" style="margin-top: var(--space-l)">
              ${roles.map((role) => html`
                <li class="card card--link">
                  <p class="card__sector">${role.category ?? 'Open position'}</p>
                  <h3 class="card__title"><a href="${base}/careers/${role.slug}/">${role.title}</a></h3>
                  <p class="card__legal">${role.location} · ${role.type}</p>
                  <p class="card__body">${role.excerpt}</p>
                </li>`)}
            </ul>
          </div>
        </section>` : ''}

      ${news.length ? html`
        <section class="section section--tint">
          <div class="wrap">
            <p class="section__label">News</p>
            <h2>Recent from ${title}</h2>
            <ul class="grid grid--3" role="list" style="margin-top: var(--space-l)">
              ${news.map((entry) => html`
                <li class="card card--link">
                  <p class="card__sector"><time datetime="${entry.date}">${entry.date}</time></p>
                  <h3 class="card__title"><a href="${base}/news/${entry.slug}/">${entry.title}</a></h3>
                  <p class="card__body">${entry.summary}</p>
                </li>`)}
            </ul>
          </div>
        </section>` : ''}

      <section class="section">
        <div class="wrap">
          ${CTABlock({
            title: named ? 'Working with this company' : 'Interested in this sector?',
            body: named
              ? 'Suppliers can register to be contacted when this company issues a requirement. Partnership enquiries go through the holding company.'
              : 'NWPH expects to enter this sector through partnership as readily as through a start-up. Suppliers and prospective partners can register their interest now.',
            actions: [
              { href: `${base}/procurement/`, label: 'Register as a supplier', primary: true },
              { href: `${base}/contact/#partnership-form`, label: 'Partnership enquiry' },
            ],
          })}
          <p style="margin-top: var(--space-l)"><a href="${base}/subsidiaries/">← All ventures</a></p>
        </div>
      </section>`,
  };
}
