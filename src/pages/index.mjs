import { html, raw } from '../lib/html.mjs';
import { StatStrip, CTABlock, SubsidiaryCard, StatusPill } from '../components/ui.mjs';
import { STATUS, STATUS_VALUES } from '../data/status.mjs';

export default function homePage({ subsidiaries, stats, base }) {
  const inDevelopment = subsidiaries.filter((s) => s.status === 'development');
  const featured = [...inDevelopment, ...subsidiaries.filter((s) => s.status !== 'development')].slice(0, 3);

  return {
    path: '/',
    current: '/',
    title: 'Home',
    description:
      'North West Passage Holdings Corporation is an Inuit-owned holding company in Iqaluit, Nunavut. Pre-incorporation: none of its subsidiaries are operating yet.',
    body: html`
      <section class="hero">
        <div class="wrap">
          <p class="section__label">Inuit-owned · Iqaluit, Nunavut</p>
          <h1>Building companies Nunavut does not yet own</h1>
          <p class="hero__lede">
            North West Passage Holdings Corporation exists to build and operate companies in
            sectors where Nunavummiut currently have no locally-owned alternative.
          </p>

          <div class="status-notice">
            <p class="status-notice__head">${stats.operating} of ${stats.total} subsidiaries are currently operating.</p>
            <p>
              NWPH is <strong>pre-incorporation</strong>. Nothing on this site is trading, taking
              bookings, hiring, or accepting customers. The first subsidiary,
              ArcTrek Expeditions Ltd., targets summer 2027.
            </p>
          </div>

          <p class="hero__actions">
            <a class="btn btn--primary" href="${base}/subsidiaries/">See the portfolio</a>
            <a class="btn btn--ghost" href="${base}/about/">What we are building</a>
          </p>

          ${StatStrip([
            { label: 'Subsidiaries operating', value: String(stats.operating), flag: true },
            { label: 'Companies in the portfolio', value: String(stats.total) },
            { label: 'In development', value: String(stats.byStatus.development) },
            { label: 'First operations targeted', value: '2027' },
          ], { label: 'Portfolio status at a glance' })}
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">The mandate</p>
          <h2>Ownership, not participation</h2>
          <p class="section__intro">
            Nunavummiut should own, lead, and benefit from the economic development happening in
            their homeland. NWPH builds companies in the sectors where that ownership is missing.
          </p>

          <div class="split" style="margin-top: var(--space-xl)">
            <div class="prose">
              <h3>Sectors in scope</h3>
              <ul>
                <li>Tourism</li>
                <li>Retail</li>
                <li>Aviation</li>
                <li>Marine freight</li>
                <li>Real estate</li>
                <li>Technology</li>
                <li>Environmental monitoring</li>
                <li>Financial services</li>
              </ul>
            </div>
            <div class="prose">
              <h3>How stage is labelled</h3>
              <p>Every company in the portfolio carries one of three labels. None of them means trading.</p>
              <dl class="stack">
                ${STATUS_VALUES.map((value) => html`
                  <div>
                    <dt>${StatusPill(value)}</dt>
                    <dd class="card__body" style="margin-top: var(--space-3xs)">${STATUS[value].description}</dd>
                  </div>`)}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">The portfolio</p>
          <h2>${stats.total} companies, none of them trading</h2>
          <p class="section__intro">
            Each addresses a sector where Nunavummiut have no locally-owned option today.
          </p>
          <ul class="grid grid--3" role="list" style="margin-top: var(--space-xl)">
            ${featured.map((subsidiary) => SubsidiaryCard(subsidiary, { base }))}
          </ul>
          <p style="margin-top: var(--space-l)">
            <a class="btn btn--ghost" href="${base}/subsidiaries/">All ${stats.total} subsidiaries</a>
          </p>
        </div>
      </section>

      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">The standard</p>
          <blockquote class="pullquote">
            <p>A subsidiary that survives only because customers feel obliged to support it has failed.</p>
          </blockquote>
          <p class="section__intro" style="margin-top: var(--space-l)">
            Each company has to work as a business on its own terms. Inuit ownership is the point,
            not the excuse.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="grid grid--3">
            ${CTABlock({
              title: 'Suppliers',
              body: 'Register now to be contacted when requirements are issued. Registration is not a contract.',
              actions: [{ href: `${base}/procurement/`, label: 'Supplier registration', primary: true }],
            })}
            ${CTABlock({
              title: 'Partners and funders',
              body: 'Joint ventures, financing, and government or Inuit organisation programmes.',
              actions: [{ href: `${base}/contact/#partnership-form`, label: 'Partnership enquiry' }],
            })}
            ${CTABlock({
              title: 'Job seekers',
              body: 'No positions are open. Register interest and you will be contacted when hiring begins.',
              actions: [{ href: `${base}/careers/`, label: 'Careers' }],
            })}
          </div>
        </div>
      </section>`,
  };
}
