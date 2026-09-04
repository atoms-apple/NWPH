import { html } from '../lib/html.mjs';
import { InterestForm } from '../components/forms.mjs';

export default function careersPage({ roles, base }) {
  return {
    path: '/careers/',
    current: '/careers/',
    title: 'Careers',
    description:
      'North West Passage Holdings Corporation is pre-incorporation and has no employees or open positions. Expressions of interest are recorded for when hiring begins.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Careers</p>
          <h1>No positions are open</h1>
          <p class="section__intro">
            NWPH is not hiring, and will not be for some time. The detail below sets out when
            that is expected to change.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">${roles.length} open positions.</p>
            <p>
              NWPH has <strong>no employees</strong> and no operating subsidiaries. Hiring cannot
              begin before the first venture is incorporated and financed — currently targeted at
              summer 2027 for ArcTrek Expeditions Ltd.
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
            This is not an application, and there is no position to apply for. It records your
            interest so that you can be contacted directly when recruitment begins.
          </p>
          <div style="margin-top: var(--space-xl)">${InterestForm()}</div>
        </div>
      </section>`,
  };
}
