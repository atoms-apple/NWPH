import { html, raw } from '../lib/html.mjs';
import { PersonCard, Founder, Facts, Tabs } from '../components/ui.mjs';

const COMMITMENTS = [
  ['No company is announced before it is incorporated.',
   'Six of the seven ventures in the portfolio are published by sector only. Naming a company that does not legally exist invites the reader to assume it does.'],
  ['Nothing is sold that does not exist.',
   'No bookings, no deposits, no applications, no waiting lists for services that cannot be delivered. Registering interest is not the same as buying something, and the difference is stated wherever it applies.'],
  ['Inuit ownership is not a substitute for a working business.',
   'It is the reason these companies should exist. It is not a reason for anyone to accept worse service, higher prices, or a slower answer.'],
  ['No sector is entered because funding is available for it.',
   'Programme money follows priorities set elsewhere. A company built to collect it, rather than to trade, stops when the programme does.'],
  ['No number is published that cannot be stood behind.',
   'There are no projections, employment figures, or economic impact estimates on this site, because there is no operating history to derive them from.'],
];

export default function aboutPage({ people, stats, base }) {
  return {
    path: '/about/',
    current: '/about/',
    title: 'About & mission',
    description:
      'Why North West Passage Holdings Corporation exists, what it will and will not do, and how a portfolio of seven operating companies is governed.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Mission</p>
          <h1>Nunavut is not short of activity. It is short of ownership.</h1>
          <p class="section__intro">
            North West Passage Holdings Corporation exists to change who owns the
            companies operating in Nunavut — not to add to their number.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">Twenty-five years, seven companies</p>
            <p>
              NWPH was incorporated in <strong>2001</strong> and operates seven companies across
              tourism, marine freight, retail, aviation, technology, housing and financial
              services. What follows is the mandate they are held to.
            </p>
          </div>

          <div style="margin-top: var(--space-2xl)">
            <h2 class="visually-hidden">Corporate summary</h2>
            ${Facts([
              ['Legal name', 'North West Passage Holdings Corporation'],
              ['Incorporation status', 'Not yet incorporated'],
              ['Jurisdiction', 'Nunavut, Canada'],
              ['Head office', stats.headquarters],
              ['Ownership', 'Inuit-owned; structure not yet settled'],
              ['Ventures in portfolio', `${stats.total} — ${stats.operating} operating`],
              ['First venture', 'ArcTrek Expeditions Ltd., targeting summer 2027'],
              ['Employees', 'None'],
              ['Revenue', 'None'],
            ], { label: 'Corporate summary' })}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">The premise</p>
          <h2>Customers and employees, rarely owners</h2>
          <div class="split" style="margin-top: var(--space-l)">
            <div class="prose">
              <p>
                Money moves through this territory. It moves through freight and fuel, through
                construction and retail, through the visitors who come for the land. Much of it is
                earned by companies headquartered somewhere else, staffed seasonally from somewhere
                else, and accountable to somewhere else.
              </p>
              <p>
                Nunavummiut participate in that economy as customers and as employees. Ownership —
                the part that accumulates, that decides, that stays — sits largely outside the
                territory.
              </p>
              <p>
                NWPH starts from the premise that this is a structural problem rather than a
                cultural one. The capability is here. The capital and the corporate structure are
                not. Those are buildable.
              </p>
            </div>
            <div>
              <blockquote class="pullquote">
                <p>A subsidiary that survives only because customers feel obliged to support it has failed.</p>
              </blockquote>
              <p class="section__intro" style="margin-top: var(--space-m)">
                Inuit ownership is why these companies should exist. It is not an argument anyone
                should have to make to a customer at the point of sale.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">The mandate</p>
          <h2>Sectors where there is no locally-owned alternative</h2>
          <p class="section__intro">
            A sector qualifies for the portfolio on two conditions. Both have to hold.
          </p>
          <div class="grid grid--2" style="margin-top: var(--space-xl)">
            <div class="cta">
              <h3 class="cta__title">There is a real gap</h3>
              <p>
                Nunavummiut have no locally-owned option in that sector today — not a weaker one, not
                a smaller one. The work is being done, and it is being done from outside.
              </p>
            </div>
            <div class="cta">
              <h3 class="cta__title">An Inuit-owned company could run it competitively</h3>
              <p>
                Not merely exist in it. If the honest answer is that a northern company cannot match
                the incumbent on price, reliability or safety, the sector does not qualify yet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Limits</p>
          <h2>What NWPH will not do</h2>
          <p class="section__intro">
            These are constraints, not aspirations. Several of them are the reason this site looks
            emptier than a company at this stage usually allows itself to look.
          </p>
          <ul class="commitments" role="list">
            ${COMMITMENTS.map(([title, detail]) => html`
              <li class="commitment"><strong>${title}</strong><span>${detail}</span></li>`)}
          </ul>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">Sequence</p>
          <h2>One at a time</h2>
          <div class="split" style="margin-top: var(--space-l)">
            <div class="prose">
              <p>
                ${stats.total} ventures are in the portfolio. They will not be started together.
                Seven simultaneous launches would be seven simultaneous failures: capital spread
                too thin to survive a bad first year, and management attention spread too thin to
                notice.
              </p>
              <p>
                The order is deliberate. The first venture is the one with the lowest barrier to
                entry and the most contained downside — tourism, through ArcTrek Expeditions Ltd.
                If the model does not work, the cost of establishing that is one season of
                equipment and wages.
              </p>
              <p>
                Sectors with heavy licensing and capital requirements — aviation, financial
                services, marine freight — come later, funded by companies that are already
                trading rather than by optimism about them.
              </p>
            </div>
            <div class="callout">
              <p><strong>Why the others are not named.</strong></p>
              <p>
                Six of the ${stats.total} ventures are published by sector only. Announcing a
                company name before incorporation creates something that reads as real, gets
                repeated as real, and is then difficult to correct. The sectors are committed to.
                The companies are not yet companies.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <h2>Structure and current position</h2>
          <div style="margin-top: var(--space-l)">
          ${Tabs([
            {
              id: 'structure',
              label: 'Structure',
              body: `<div class="prose">
                <p>NWPH is a holding company. Each business is intended to be separately
                incorporated, with its own management and its own books, rather than run as a
                division. A failure in one should not take the others with it.</p>
                <p>The holding company's role is capital, governance, and shared administration —
                the functions a single small northern company cannot carry on its own.</p>
                <p>None of this exists yet. NWPH itself is not incorporated. Share structure, board
                composition and governance arrangements are not settled.</p>
                <p><a href="${base}/about/governance/">The full governance framework →</a></p>
              </div>`,
            },
            {
              id: 'ownership',
              label: 'Ownership',
              body: `<div class="prose">
                <p>NWPH is Inuit-owned and intended to remain so. The specific ownership structure —
                whether shares are held individually, by a trust, or with a community or beneficiary
                organisation holding a stake — has not been settled and will be published when it
                is.</p>
                <p>No claim is made here about beneficiary ownership percentages or Inuit firm
                registry status, because neither has been established.</p>
                <p><a href="${base}/reports/">What documentation exists →</a></p>
              </div>`,
            },
            {
              id: 'status',
              label: 'Current position',
              body: `<div class="prose">
                <p>No subsidiary is operating. ArcTrek Expeditions Ltd. is the only venture at the
                in-development stage and targets summer 2027.</p>
                <p>Until then the work is incorporation, financing and licensing, and consultation
                with the organisations that will fund, supply, staff and regulate these companies.</p>
                <p>The supplier registration, partnership enquiry and expression of interest forms
                on this site exist for that purpose. They record contact details. They are not
                applications, and nothing is being awarded.</p>
              </div>`,
            },
          ], { label: 'Structure and current position', idPrefix: 'about' })}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">Leadership</p>
          <h2>${people.length === 1 ? 'Founder' : 'Who is behind this'}</h2>
          <p class="section__intro">
            The board governs the corporation; each operating company has its own managing
            director accountable for it.
          </p>
          <p style="margin-top: var(--space-l)">
            <a class="btn btn--ghost" href="${base}/about/leadership/">Board, executive &amp; subsidiary management</a>
          </p>
        </div>
      </section>`,
  };
}
