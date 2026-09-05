import { html } from '../lib/html.mjs';
import { PartnershipForm, DocumentRequestForm } from '../components/forms.mjs';
import { site } from '../data/site.mjs';

export default function contactPage({ base }) {
  return {
    path: '/contact/',
    current: '/contact/',
    title: 'Contact',
    description: `Contact North West Passage Holdings Corporation in ${site.headquarters}. Partnership enquiries and document requests.`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Contact</p>
          <h1>Get in touch</h1>
          <p class="section__intro">
            Enquiries reach the holding company in Iqaluit and are directed to the relevant
            operating company.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split">
            <div>
              <h2>Direct</h2>
              <div class="table-scroll" tabindex="0" role="region" aria-label="Contact details">
                <table>
                  <caption>Contact details</caption>
                  <tbody>
                    <tr><th scope="row">Email</th><td><a href="mailto:${site.email}">${site.email}</a></td></tr>
                    <tr><th scope="row">Location</th><td>${site.headquarters}</td></tr>
                    <tr><th scope="row">Incorporated</th><td>2001, Nunavut</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2>Where else to go</h2>
              <ul class="prose">
                <li>Suppliers: <a href="${base}/procurement/">supplier registration</a></li>
                <li>Job seekers: <a href="${base}/careers/">expression of interest</a></li>
                <li>Portfolio detail: <a href="${base}/subsidiaries/">all ventures</a></li>
                <li>Funders and due diligence: <a href="${base}/reports/">reporting &amp; documents</a></li>
                <li>Governance: <a href="${base}/about/governance/">governance framework</a></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">Partnerships</p>
          <h2>Partnership enquiry</h2>
          <p class="section__intro">
            For joint ventures, financing, and government or Inuit organisation programmes.
          </p>
          <div style="margin-top: var(--space-xl)">${PartnershipForm()}</div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">Documents</p>
          <h2>Document request</h2>
          <div style="margin-top: var(--space-xl)">${DocumentRequestForm()}</div>
        </div>
      </section>`,
  };
}
