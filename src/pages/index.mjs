import { html } from '../lib/html.mjs';
import { StatStrip, CTABlock, SubsidiaryCard } from '../components/ui.mjs';
import { demo } from '../data/site.mjs';

export default function homePage({ subsidiaries, people, history, news, roles, stats, base }) {
  const f = demo.figures;
  const operating = subsidiaries.filter((s) => s.status === 'operating');
  const featured = operating.slice(0, 3);
  const board = people.filter((p) => p.group === 'board');
  
  return {
    path: '/',
    current: '/',
    title: 'Home',
    description:
      `North West Passage Holdings Corporation is an Inuit-owned holding company in Iqaluit, Nunavut, operating ${stats.byStatus.operating} companies across tourism, marine freight, retail, aviation, technology, housing and financial services.`,
    body: html`
      <section class="hero">
        <div class="wrap">
          <p class="anniversary">
            <span class="anniversary__number">${demo.anniversary}</span>
            <span class="anniversary__label">Years · ${demo.founded}–${demo.founded + demo.anniversary}</span>
          </p>
          <p class="section__label">Inuit-owned · Iqaluit, Nunavut</p>
          <h1>Twenty-five years of Nunavut ownership</h1>
          <p class="hero__lede">
            North West Passage Holdings Corporation builds and operates companies in sectors where
            Nunavummiut would otherwise have no locally-owned alternative. Seven of them are
            trading today.
          </p>

          <p class="hero__actions">
            <a class="btn btn--primary" href="${base}/subsidiaries/">Our companies</a>
            <a class="btn btn--ghost" href="${base}/about/history/">Twenty-five years</a>
          </p>

          ${StatStrip([
            { label: 'Years operating', value: String(demo.anniversary), flag: true },
            { label: 'Operating companies', value: String(stats.byStatus.operating) },
            { label: 'Employees', value: String(f.employees) },
            { label: 'Inuit employment', value: f.inuitEmployment },
          ], { label: 'The corporation at a glance' })}
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">The mandate</p>
          <h2>Ownership, not participation</h2>
          <p class="section__intro">
            Money moves through this territory in freight, fuel, retail and tourism. NWPH was
            founded on the premise that Nunavummiut should own the companies that carry it, not
            merely work for them.
          </p>
          <div class="split" style="margin-top: var(--space-xl)">
            <div class="prose">
              <p>
                A sector enters the portfolio on two conditions: Nunavummiut have no locally-owned
                option in it, and an Inuit-owned company could run it <em>competitively</em> — not
                merely exist in it.
              </p>
              <p>
                That second condition is the one that does the work. A subsidiary that survives
                only because customers feel obliged to support it has failed.
              </p>
              <p><a href="${base}/about/">Read the full mission and its limits →</a></p>
            </div>
            <div>
              ${StatStrip([
                { label: 'Consolidated revenue', value: f.revenue },
                { label: 'Communities', value: String(f.communities) },
                { label: 'Spend with Nunavut suppliers', value: f.procurementLocal },
                { label: 'Apprentices this year', value: String(f.apprentices) },
              ], { light: true, label: 'Most recent reported year' })}
              <p class="field__hint" style="margin-top: var(--space-s)">
                Year ended ${f.yearEnd}. Full figures in the
                <a href="${base}/reports/">annual report</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">The portfolio</p>
          <h2>${stats.byStatus.operating} operating companies</h2>
          <p class="section__intro">
            Each addresses a sector where Nunavummiut would otherwise have no locally-owned option.
          </p>
          <ul class="grid grid--3" role="list" style="margin-top: var(--space-xl)">
            ${featured.map((subsidiary) => SubsidiaryCard(subsidiary, { base }))}
          </ul>
          <p style="margin-top: var(--space-l)">
            <a class="btn btn--ghost" href="${base}/subsidiaries/">All ${stats.total} companies</a>
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
            not the excuse. One subsidiary was wound up in 2024 for failing that test.
          </p>
        </div>
      </section>

      ${news.length ? html`
        <section class="section">
          <div class="wrap">
            <p class="section__label">News</p>
            <h2>Latest</h2>
            <ul class="grid grid--3" role="list" style="margin-top: var(--space-xl)">
              ${news.slice(0, 3).map((entry) => html`
                <li class="card card--link">
                  <p class="card__sector"><time datetime="${entry.date}">${entry.date}</time></p>
                  <h3 class="card__title"><a href="${base}/news/${entry.slug}/">${entry.title}</a></h3>
                  <p class="card__body">${entry.summary}</p>
                </li>`)}
            </ul>
            <p style="margin-top: var(--space-l)">
              <a class="btn btn--ghost" href="${base}/news/">All news</a>
            </p>
          </div>
        </section>` : ''}

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">Accountability</p>
          <h2>Who runs these companies</h2>
          <p class="section__intro">
            ${board.length} directors govern the corporation, and each operating company has its own
            managing director accountable for it.
          </p>
          <p style="margin-top: var(--space-l)">
            <a class="btn btn--ghost" href="${base}/about/leadership/">Board &amp; leadership</a>
          </p>

          <div class="grid grid--3" style="margin-top: var(--space-2xl)">
            ${CTABlock({
              title: 'Suppliers',
              body: 'Register to be contacted when requirements are issued across the portfolio.',
              actions: [{ href: `${base}/procurement/`, label: 'Supplier registration', primary: true }],
            })}
            ${CTABlock({
              title: 'Partners',
              body: 'Joint ventures, financing, and government or Inuit organisation programmes.',
              actions: [{ href: `${base}/contact/#partnership-form`, label: 'Partnership enquiry' }],
            })}
            ${CTABlock({
              title: 'Careers',
              body: `${roles.length} positions open across the portfolio. Inuit employment preference applies to every role, and certification is funded.`,
              actions: [{ href: `${base}/careers/`, label: `${roles.length} open positions` }],
            })}
          </div>
        </div>
      </section>`,
  };
}
