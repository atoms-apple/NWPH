import { html, raw } from '../lib/html.mjs';
import { Breadcrumbs, StatStrip, Facts, Accordion, OnThisPage } from '../components/ui.mjs';
import { InterestForm } from '../components/forms.mjs';
import { demo } from '../data/site.mjs';

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

/** Job board. */
export function careersIndex({ roles, subsidiaries, base }) {
  const companies = [...new Set(roles.map((r) => r.subsidiary).filter(Boolean))];
  const f = demo.figures;

  return {
    path: '/careers/',
    current: '/careers/',
    title: 'Careers',
    description: `${roles.length} open positions across the seven operating companies in the North West Passage Holdings portfolio. Inuit employment preference applies to every role.`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Careers</p>
          <h1>${roles.length} open positions</h1>
          <p class="section__intro">
            Work across seven operating companies, in the communities they serve.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">Inuit employment preference applies to every role.</p>
            <p>
              If you have the experience but not the certification, apply anyway. Funding the
              ticket is part of the offer, not a barrier to it — that is what the training
              pathway is for.
            </p>
          </div>
          ${StatStrip([
            { label: 'Employees', value: String(f.employees) },
            { label: 'Inuit employment', value: f.inuitEmployment, flag: true },
            { label: 'Apprentices placed', value: String(f.apprentices) },
            { label: 'Communities', value: String(f.communities) },
          ], { label: 'Employment at a glance' })}
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <h2 class="visually-hidden">Open positions</h2>
          <div class="table-scroll" tabindex="0" role="region" aria-label="Open positions">
            <table>
              <caption>${roles.length} positions open across ${companies.length} companies.</caption>
              <thead>
                <tr>
                  <th scope="col">Position</th><th scope="col">Company</th>
                  <th scope="col">Location</th><th scope="col">Type</th><th scope="col">Closes</th>
                </tr>
              </thead>
              <tbody>
                ${roles.map((role) => html`
                  <tr>
                    <th scope="row"><a href="${base}/careers/${role.slug}/">${role.title}</a></th>
                    <td>${role.subsidiary ?? 'NWPH'}</td>
                    <td>${role.location}</td>
                    <td>${role.type}</td>
                    <td>${role.closes ? formatDate(role.closes) : 'Ongoing'}</td>
                  </tr>`)}
              </tbody>
            </table>
          </div>

          <ul class="grid grid--2" role="list" style="margin-top: var(--space-2xl)">
            ${roles.map((role) => html`
              <li class="card card--link">
                <p class="card__sector">${role.subsidiary ?? 'NWPH'}</p>
                <h3 class="card__title"><a href="${base}/careers/${role.slug}/">${role.title}</a></h3>
                <p class="card__legal">${role.location} · ${role.type}</p>
                <p class="card__body">${role.excerpt}</p>
                <p class="card__foot">
                  ${role.salary ? html`<span class="card__target">${role.salary}</span>` : ''}
                </p>
              </li>`)}
          </ul>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">How hiring works</p>
          <h2>What to expect</h2>
          <div style="margin-top: var(--space-l)">
            ${Accordion([
              {
                question: 'Inuit employment preference',
                body: `<p>Nunavut Inuit beneficiaries are given preference in every competition
                across the portfolio, at every level. This is stated in the Inuit Employment Plan
                adopted in 2021 and applies to the holding company and all operating
                subsidiaries.</p>`,
              },
              {
                question: 'If you do not hold the certification',
                body: `<p>Apply anyway, and say so. Certification costs, schooling, travel and
                accommodation are funded by the company for successful candidates who need
                them. ${f.apprentices} apprentices were placed across the portfolio this year on
                exactly that basis.</p>`,
              },
              {
                question: 'What happens after you apply',
                body: `<p>Applications are acknowledged within five working days. Shortlisting
                happens after the closing date, and every applicant who is interviewed hears the
                outcome, whether or not they are successful.</p>`,
              },
              {
                question: 'Housing and relocation',
                body: `<p>Positions marked with housing include staff accommodation. Relocation
                support is available for permanent roles requiring a move to the community.</p>`,
              },
              {
                question: 'Language',
                body: `<p>Inuktitut is an asset in every role and a requirement in some, which is
                noted in the posting where it applies. Applications may be submitted in Inuktitut
                or English.</p>`,
              },
            ])}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">Expression of interest</p>
          <h2>Nothing here fits?</h2>
          <p class="section__intro">
            Register your interest and you will be contacted when something opens in your
            community or your line of work.
          </p>
          <div style="margin-top: var(--space-xl)">${InterestForm()}</div>
        </div>
      </section>`,
  };
}

/** One posting. */
export function roleDetail(role, { base }) {
  return {
    path: `/careers/${role.slug}/`,
    current: '/careers/',
    title: role.title,
    description: `${role.title} at ${role.subsidiary ?? 'NWPH'}, ${role.location}. ${role.excerpt}`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/careers/`, label: 'Careers' },
            { label: role.title },
          ])}
          <p class="section__label">${role.subsidiary ?? 'North West Passage Holdings'}</p>
          <h1>${role.title}</h1>
          <p class="section__intro">${role.location} · ${role.type}</p>
          ${role.priority ? html`
            <div class="status-notice">
              <p class="status-notice__head">Inuit employment preference applies.</p>
              <p>
                Nunavut Inuit beneficiaries are given preference in this competition. If you have
                the experience but not the certification, apply and say so — funding it is part of
                the offer.
              </p>
            </div>` : ''}
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split split--wide">
            <div class="prose">${raw(role.body)}</div>
            <div class="stack-l">
              ${OnThisPage(role.headings)}
              ${Facts([
                ['Reference', role.reference ?? '—'],
                ['Company', role.subsidiary ?? 'NWPH'],
                ['Location', role.location],
                ['Type', role.type],
                ['Category', role.category ?? '—'],
                ['Salary', role.salary ?? 'Per company scale'],
                ['Posted', role.posted ? formatDate(role.posted) : '—'],
                ['Closes', role.closes ? formatDate(role.closes) : 'Ongoing'],
              ], { label: `${role.title} details` })}
            </div>
          </div>

          <div class="cta" style="margin-top: var(--space-2xl)">
            <h2 class="cta__title">How to apply</h2>
            <p>
              Send a résumé and a short note about why this role, quoting reference
              <strong>${role.reference ?? role.slug}</strong>. Applications are acknowledged within
              five working days.
            </p>
            <p class="cta__actions">
              <a class="btn btn--primary" href="${base}/careers/#interest-form">Apply</a>
              <a class="btn btn--ghost" href="${base}/careers/">All positions</a>
            </p>
          </div>
        </div>
      </section>`,
  };
}
