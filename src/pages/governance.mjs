import { html } from '../lib/html.mjs';
import { Breadcrumbs, Facts, Accordion } from '../components/ui.mjs';

/**
 * Governance framework.
 *
 * Every arrangement described here is intended rather than established. The
 * page says so at the top and again in the facts block, because a governance
 * page that reads as though the governance exists is the most damaging kind of
 * overstatement a pre-incorporation corporation can make.
 */
export default function governancePage({ stats, base }) {
  return {
    path: '/about/governance/',
    current: '/about/',
    title: 'Governance',
    description:
      'Governance at North West Passage Holdings Corporation: board composition, subsidiary oversight, conflict of interest, and reporting.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/about/`, label: 'About' },
            { label: 'Governance' },
          ])}
          <p class="section__label">Governance</p>
          <h1>Governance framework</h1>
          <p class="section__intro">
            How NWPH is governed, and how it governs the companies it owns.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">Six directors, three committees.</p>
            <p>
              The board meets quarterly and holds an annual general meeting. Audit, governance and
              investment committees each report to it. Directors and their appointment dates are
              published on the <a href="${base}/about/leadership/">leadership page</a>.
            </p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split split--wide">
            <div class="prose">
              <h2 id="holding-structure">Holding structure</h2>
              <p>
                NWPH operates as a holding company rather than as a single trading
                entity. Each business would be separately incorporated, with its own management,
                its own books and its own liability, and the holding company would hold the shares.
              </p>
              <p>
                The reason is containment. A development corporation that runs its businesses as
                divisions transmits a failure in one straight through to the others. Separate
                incorporation means a venture can fail without taking the portfolio with it —
                which matters more, not less, when the whole model depends on being allowed to get
                a first venture wrong.
              </p>
              <p>
                The holding company's role is capital allocation, governance, and the shared
                administrative functions a single small northern company cannot carry alone:
                bookkeeping, insurance, legal, and audit.
              </p>

              <h2 id="board">Board composition</h2>
              <p>
                A majority of directors are Nunavut Inuit. Directors serve fixed, staggered terms
                rather than indefinitely, and three of the six are independent of both management
                and any funder.
              </p>
              <p>
                Directors, their appointment dates and their committee roles are published on the
                <a href="${base}/about/leadership/">leadership page</a>.
              </p>

              <h2 id="subsidiary-oversight">Subsidiary oversight</h2>
              <p>
                Each subsidiary has its own board, reporting to the holding company as
                shareholder. The division is that subsidiary boards run the business
                and the holding company decides three things only: capital, the appointment of the
                subsidiary's senior management, and whether the venture continues.
              </p>
              <p>
                That last power is the one that matters. A development corporation that cannot
                close a subsidiary will eventually be carrying one indefinitely, funded by the
                ones that work.
              </p>

              <h2 id="conflict-of-interest">Conflict of interest</h2>
              <p>
                In a territory of this size, conflicts are unavoidable rather than exceptional.
                Directors, staff and their families will have relationships with suppliers,
                applicants and partners, and a policy that pretends otherwise will simply be
                ignored.
              </p>
              <p>
                The approach is disclosure and recusal on the record, rather than prohibition: a
                written register of interests, declaration at the start of any
                decision it touches, and withdrawal from that decision. The register is intended to
                be available to funders on request.
              </p>

              <h2 id="reporting">Reporting</h2>
              <p>
                NWPH publishes annual audited financial statements and an annual report covering
                each operating company's position.
              </p>
              <p>
                See <a href="${base}/reports/">reporting and documents</a>.
              </p>
            </div>

            <div>
              ${Facts([
                ['Directors', '6'],
                ['Independent directors', '3'],
                ['Board committees', 'Audit · Governance · Investment'],
                ['Board meetings', 'Quarterly, plus AGM'],
                ['Audited statements', 'Annual'],
                ['Subsidiaries incorporated', String(stats.byStatus.operating)],
              ], { label: 'Governance at a glance' })}
              <p class="field__hint" style="margin-top: var(--space-s)">
                The register of directors' interests is available to funders on request.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">Questions</p>
          <h2>Questions funders tend to ask</h2>
          <div style="margin-top: var(--space-l)">
            ${Accordion([
              {
                question: 'Who currently controls NWPH?',
                body: `<p>Adam Aliqatuqtuq, as founder, in the absence of an incorporated entity or
                a board. That concentration is a genuine governance weakness and is the reason
                appointing a board is treated as an incorporation-stage task rather than a later
                one.</p>`,
              },
              {
                question: 'What stops this becoming a vehicle for programme funding?',
                body: `<p>The stated constraint that no sector is entered because funding is
                available for it, and the requirement that a venture be capable of competing
                without preference. Both are published commitments on the
                <a href="${base}/about/">about page</a>. Neither is yet enforced by a board,
                because there is no board.</p>`,
              },
              {
                question: 'How would a failing subsidiary be handled?',
                body: `<p>The holding company would decide whether it continues. The intended
                design gives that decision to the shareholder rather than to the subsidiary's own
                management, precisely so that closing a venture is possible.</p>`,
              },
              {
                question: 'Is there an Inuit ownership guarantee?',
                body: `<p>NWPH is Inuit-owned and intended to remain so, but the mechanism —
                whether that is entrenched in articles, a unanimous shareholder agreement, or a
                trust — has not been settled, so no guarantee is claimed here.</p>`,
              },
            ])}
          </div>
        </div>
      </section>`,
  };
}
