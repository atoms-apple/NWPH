import { html, raw } from '../lib/html.mjs';
import { Accordion, CTABlock } from '../components/ui.mjs';
import { SupplierForm } from '../components/forms.mjs';

export default function procurementPage({ tiers, faq, base }) {
  return {
    path: '/procurement/',
    current: '/procurement/',
    title: 'Procurement & suppliers',
    description:
      'Supplier registration for North West Passage Holdings Corporation. NWPH is pre-incorporation and is not currently issuing contracts or purchase orders.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Suppliers</p>
          <h1>Procurement</h1>
          <p class="section__intro">
            NWPH is not currently procuring goods or services. Registration records your
            details in advance of that changing.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">No contracts are being issued.</p>
            <p>
              NWPH is <strong>pre-incorporation</strong> with no operating subsidiaries. There are
              no open tenders, no purchase orders, and no procurement budget. Registration records
              your details and nothing more — it is <strong>not</strong> a contract, a
              pre-qualification, or a commitment to buy.
            </p>
          </div>
        </div>
      </section>

      ${tiers.length ? html`
        <section class="section">
          <div class="wrap">
            <p class="section__label">Categories</p>
            <h2>What NWPH expects to buy</h2>
            <div class="table-scroll" tabindex="0" role="region" aria-label="Anticipated procurement categories">
              <table>
                <caption>Anticipated procurement categories. None are open.</caption>
                <thead>
                  <tr><th scope="col">Category</th><th scope="col">Expected timing</th><th scope="col">Includes</th></tr>
                </thead>
                <tbody>
                  ${tiers.map((tier) => html`
                    <tr>
                      <th scope="row">${tier.title}</th>
                      <td>${tier.timing || 'Not set'}</td>
                      <td>${(tier.categories || []).join(', ') || '—'}</td>
                    </tr>`)}
                </tbody>
              </table>
            </div>
          </div>
        </section>` : ''}

      <section class="section ${tiers.length ? 'section--tint' : ''}">
        <div class="wrap">
          <p class="section__label">Register</p>
          <h2>Supplier registration</h2>
          <p class="section__intro">
            Open to any supplier. Inuit firms and Nunavut-based businesses are of particular
            interest; registration is not restricted on that basis.
          </p>
          <div style="margin-top: var(--space-xl)">${SupplierForm()}</div>
        </div>
      </section>

      ${faq.length ? html`
        <section class="section">
          <div class="wrap">
            <p class="section__label">Questions</p>
            <h2>Common questions</h2>
            <div style="margin-top: var(--space-l)">${Accordion(faq)}</div>
          </div>
        </section>` : ''}

      <section class="section section--tint">
        <div class="wrap">
          ${CTABlock({
            title: 'Need corporate documents?',
            body: 'Funders and procurement officers can request what documentation exists. Note that NWPH is pre-incorporation: audited statements and operating history do not exist.',
            actions: [{ href: `${base}/contact/#documents-form`, label: 'Request documents', primary: true }],
          })}
        </div>
      </section>`,
  };
}
