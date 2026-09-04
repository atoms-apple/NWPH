import { html, raw } from '../lib/html.mjs';
import { StatStrip, CTABlock, SubsidiaryCard, StatusPill } from '../components/ui.mjs';
import { STATUS, STATUS_VALUES } from '../data/status.mjs';

export default function homePage({ subsidiaries, stats, base }) {
  const named = subsidiaries.filter((s) => s.name);
  const unnamed = subsidiaries.filter((s) => !s.name);

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
            <p class="status-notice__head">${stats.operating} of ${stats.total} ventures are currently operating.</p>
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
            { label: 'Ventures operating', value: String(stats.operating), flag: true },
            { label: 'Ventures in the portfolio', value: String(stats.total) },
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
            Money moves through this territory in freight, fuel, retail and tourism. Much of it is
            earned by companies headquartered elsewhere. Nunavummiut take part as customers and
            employees; ownership sits outside.
          </p>
          <div class="split" style="margin-top: var(--space-xl)">
            <div class="prose">
              <p>
                NWPH treats that as a structural problem rather than a cultural one. The capability
                is already here — what is missing is the capital and the corporate structure, and
                both of those can be built.
              </p>
              <p>
                A sector enters the portfolio on two conditions: Nunavummiut have no locally-owned
                option in it today, and an Inuit-owned company could run it <em>competitively</em> —
                not merely exist in it.
              </p>
              <p><a href="${base}/about/">Read the full mission and its limits →</a></p>
            </div>
            <div class="prose">
              <h3>How stage is labelled</h3>
              <p>Every venture carries one of three labels. None of them means trading.</p>
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
          <p class="section__label">First</p>
          <h2>One venture is named. Six are not.</h2>
          <p class="section__intro">
            The order is deliberate. Seven simultaneous launches would be seven simultaneous
            failures.
          </p>
          <ul class="grid grid--3" role="list" style="margin-top: var(--space-xl)">
            ${named.map((subsidiary) => SubsidiaryCard(subsidiary, { base }))}
          </ul>

          <div class="callout" style="margin-top: var(--space-xl)">
            <p><strong>The remaining ${unnamed.length} are published by sector only.</strong></p>
            <p>
              ${unnamed.map((s) => s.sector).join(' · ')}
            </p>
            <p>
              None is incorporated. A company name published before incorporation gets repeated and
              indexed as though the company exists, and is then hard to take back. Names appear at
              incorporation, not before.
            </p>
          </div>

          <p style="margin-top: var(--space-l)">
            <a class="btn btn--ghost" href="${base}/subsidiaries/">All ${stats.total} ventures</a>
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
