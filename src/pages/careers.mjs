import { html } from '../lib/html.mjs';
import { InterestForm } from '../components/forms.mjs';

export default function careersPage({ roles, base }) {
  return {
    path: '/careers/',
    current: '/careers/',
    title: 'Careers',
    description:
      'Careers across seven operating companies in the North West Passage Holdings portfolio, with training pathways and Inuit employment preference.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Careers</p>
          <h1>Careers</h1>
          <p class="section__intro">
            Work across seven operating companies, in the communities they serve.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">Inuit employment preference applies to every role.</p>
            <p>
              Each operating company runs a training pathway with certification funded by the
              company. Where a role requires a ticket you do not yet hold, say so — that is what
              the pathway is for.
            </p>
          </div>
        </div>
      </section>

      ${roles.length ? html`
        <section class="section">
          <div class="wrap">
            <h2>Open positions</h2>
            <div class="table-scroll" tabindex="0" role="region" aria-label="Open positions">
              <table>
                <caption>Currently open positions</caption>
                <thead>
                  <tr>
                    <th scope="col">Position</th><th scope="col">Subsidiary</th>
                    <th scope="col">Location</th><th scope="col">Type</th><th scope="col">Closes</th>
                  </tr>
                </thead>
                <tbody>
                  ${roles.map((role) => html`
                    <tr>
                      <th scope="row">${role.title}</th>
                      <td>${role.subsidiary || 'NWPH'}</td>
                      <td>${role.location}</td>
                      <td>${role.type}</td>
                      <td>${role.closes || 'Open'}</td>
                    </tr>`)}
                </tbody>
              </table>
            </div>
          </div>
        </section>` : ''}

      <section class="section">
        <div class="wrap">
          <p class="section__label">Expression of interest</p>
          <h2>Register for when hiring starts</h2>
          <p class="section__intro">
            If nothing currently posted fits, this records your interest so that you can be
            contacted directly when something does.
          </p>
          <div style="margin-top: var(--space-xl)">${InterestForm()}</div>
        </div>
      </section>`,
  };
}
