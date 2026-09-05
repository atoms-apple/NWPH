import { html, raw } from '../lib/html.mjs';
import { Breadcrumbs, Facts } from '../components/ui.mjs';

const PersonRow = (person) => html`
  <li class="person-entry">
    <div class="person-entry__head">
      <h3 class="person-entry__name">${person.name}</h3>
      <p class="person-entry__role">${person.role}</p>
    </div>
    <div class="person-entry__meta">
      ${person.venture ? html`<span class="person-entry__venture">${person.venture}</span>` : ''}
      ${person.appointed ? html`<span>Appointed ${person.appointed}</span>` : ''}
      ${person.independent ? html`<span class="person-entry__independent">Independent</span>` : ''}
    </div>
    <div class="person-entry__bio">${raw(person.body)}</div>
  </li>`;

/**
 * Leadership.
 *
 * Three listings, because they answer three different questions: who governs
 * the corporation, who runs it day to day, and who is accountable for each
 * operating company.
 */
export default function leadershipPage({ people, subsidiaries, base }) {
  const board = people.filter((p) => p.group === 'board');
  const executive = people.filter((p) => p.group === 'executive');
  const managers = people.filter((p) => p.group === 'subsidiary');
  const independent = board.filter((p) => p.independent).length;

  return {
    path: '/about/leadership/',
    current: '/about/',
    title: 'Leadership & board',
    description:
      'The board of directors, executive team, and the managing directors accountable for each operating company in the North West Passage Holdings portfolio.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/about/`, label: 'About' },
            { label: 'Leadership & board' },
          ])}
          <p class="section__label">Leadership</p>
          <h1>Board, executive and subsidiary management</h1>
          <p class="section__intro">
            Who governs the corporation, who runs it, and who is accountable for each operating
            company.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split split--wide">
            <div>
              <p class="section__label">Board of directors</p>
              <h2>Board of directors</h2>
              <p class="section__intro">
                The board is responsible for governance, capital allocation and the appointment of
                the chief executive. Directors serve fixed, staggered terms.
              </p>
              <ul class="person-list" role="list">${board.map(PersonRow)}</ul>
            </div>
            <div>
              ${Facts([
                ['Directors', String(board.length)],
                ['Independent directors', String(independent)],
                ['Committees', 'Audit · Governance · Investment'],
                ['Executive officers', String(executive.length)],
                ['Operating companies', String(subsidiaries.filter((s) => s.status === 'operating').length)],
              ], { label: 'Board composition' })}
              <p class="field__hint" style="margin-top: var(--space-s)">
                The register of directors' interests is available to funders on request.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">Executive</p>
          <h2>Executive team</h2>
          <p class="section__intro">
            Accountable to the board for the performance of the holding company and the portfolio.
          </p>
          <ul class="person-list" role="list">${executive.map(PersonRow)}</ul>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">Subsidiary management</p>
          <h2>Who runs each company</h2>
          <p class="section__intro">
            Each operating company has its own managing director, accountable to that company's
            board rather than directly to the holding company's executive.
          </p>

          <div class="table-scroll" tabindex="0" role="region" aria-label="Subsidiary management">
            <table>
              <caption>Managing directors by operating company.</caption>
              <thead>
                <tr>
                  <th scope="col">Company</th><th scope="col">Sector</th>
                  <th scope="col">Managing Director</th><th scope="col">Appointed</th>
                </tr>
              </thead>
              <tbody>
                ${subsidiaries.filter((s) => s.managingDirector).map((subsidiary) => {
                  const manager = managers.find((p) => p.venture === subsidiary.name);
                  return html`
                    <tr>
                      <th scope="row"><a href="${base}/subsidiaries/${subsidiary.slug}/">${subsidiary.name}</a></th>
                      <td>${subsidiary.sector}</td>
                      <td>${subsidiary.managingDirector}</td>
                      <td>${manager?.appointed ?? '—'}</td>
                    </tr>`;
                })}
              </tbody>
            </table>
          </div>

          <ul class="person-list" role="list" style="margin-top: var(--space-xl)">${managers.map(PersonRow)}</ul>
        </div>
      </section>`,
  };
}
