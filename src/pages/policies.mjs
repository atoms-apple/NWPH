import { html } from '../lib/html.mjs';
import { Breadcrumbs, Facts, CTABlock } from '../components/ui.mjs';
import { site } from '../data/site.mjs';

/** Reporting and documents — including a plain list of what does not exist. */
export function reportsPage({ stats, base }) {
  return {
    path: '/reports/',
    current: null,
    title: 'Reporting & documents',
    description:
      'Corporate documents and reporting for North West Passage Holdings Corporation. Pre-incorporation: no audited statements, annual report or operating history exists.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([{ href: `${base}/`, label: 'Home' }, { label: 'Reporting & documents' }])}
          <p class="section__label">Reporting</p>
          <h1>Reporting and documents</h1>
          <p class="section__intro">
            What NWPH can provide to funders, procurement officers and partners today, and what it
            cannot.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">There are no financial statements.</p>
            <p>
              NWPH is pre-incorporation. There is no trading entity, so there is
              <strong>no audited statement, no annual report, no operating history and no credit
              file</strong>. Any due diligence process that requires them cannot be satisfied yet,
              and it is better to say so here than after a request.
            </p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split split--wide">
            <div>
              <h2>Document availability</h2>
              <div class="table-scroll" tabindex="0" role="region" aria-label="Document availability">
                <table>
                  <caption>What exists today, and when each document is expected.</caption>
                  <thead>
                    <tr><th scope="col">Document</th><th scope="col">Available</th><th scope="col">Expected</th></tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">Certificate of incorporation</th><td>No</td><td>At incorporation</td></tr>
                    <tr><th scope="row">Articles and by-laws</th><td>No</td><td>At incorporation</td></tr>
                    <tr><th scope="row">Board and director list</th><td>No</td><td>At incorporation</td></tr>
                    <tr><th scope="row">Audited financial statements</th><td>No</td><td>First full year of trading</td></tr>
                    <tr><th scope="row">Annual report</th><td>No</td><td>First full year of trading</td></tr>
                    <tr><th scope="row">Procurement policy</th><td>No</td><td>Before the first requirement is issued</td></tr>
                    <tr><th scope="row">Conflict of interest register</th><td>No</td><td>At incorporation</td></tr>
                    <tr><th scope="row">Inuit firm registration</th><td>No</td><td>Not yet assessed</td></tr>
                    <tr><th scope="row">Business plan</th><td>Not published</td><td>Not scheduled</td></tr>
                    <tr><th scope="row">Venture milestones</th><td>Yes</td><td>Published on each venture page</td></tr>
                  </tbody>
                </table>
              </div>
              <p class="field__hint" style="margin-top: var(--space-s)">
                Where a document is marked unavailable, it does not exist — not that it is withheld.
                Anything that can be shared under discussion will be shared on request.
              </p>
            </div>
            <div>
              ${Facts([
                ['Financial year', 'Not yet set'],
                ['Auditor', 'Not appointed'],
                ['Legal counsel', 'Not appointed'],
                ['Banking', 'Not established'],
                ['Ventures operating', String(stats.operating)],
              ], { label: 'Corporate record' })}
            </div>
          </div>

          <div style="margin-top: var(--space-2xl)">
            ${CTABlock({
              title: 'Request a document',
              body: 'For funders, procurement officers and prospective partners. Requests are answered by the founding group, so allow time.',
              actions: [{ href: `${base}/contact/#documents-form`, label: 'Document request', primary: true }],
            })}
          </div>
        </div>
      </section>`,
  };
}

/** Privacy notice. Describes what this site actually does, which is very little. */
export function privacyPage({ base }) {
  return {
    path: '/privacy/',
    current: null,
    title: 'Privacy notice',
    description:
      'How North West Passage Holdings Corporation handles personal information collected through this website.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([{ href: `${base}/`, label: 'Home' }, { label: 'Privacy notice' }])}
          <p class="section__label">Policies</p>
          <h1>Privacy notice</h1>
          <p class="section__intro">
            What this website collects, why, and what happens to it.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="prose" style="max-width: 68ch">
            <h2 id="the-site-itself">The website itself</h2>
            <p>
              This site sets <strong>no cookies</strong>, runs <strong>no analytics</strong>, and
              embeds <strong>no third-party trackers, fonts, scripts or media</strong>. Nothing on
              a page you load reports your visit to anyone.
            </p>
            <p>
              The site is hosted on GitHub Pages, which records standard server request logs
              including IP addresses. Those logs are held by GitHub under its own privacy practices
              and are not accessible to NWPH.
            </p>

            <h2 id="what-forms-collect">What the forms collect</h2>
            <p>
              The supplier registration, partnership enquiry, expression of interest and document
              request forms collect only what you type into them. Each form states its fields on
              the page, and nothing is collected that is not visible to you as you complete it.
            </p>
            <p>
              The career expression of interest form asks whether you are a Nunavut Inuit
              beneficiary. That question is optional, includes a "prefer not to say" option, and is
              asked for one reason: hiring will apply Inuit employment preference, and that cannot
              be applied without the information. It is not used for any other purpose.
            </p>

            <h2 id="how-it-is-used">How submissions are used</h2>
            <p>
              To reply to you, and to contact you when a relevant requirement, position or
              opportunity arises. Submissions are <strong>not</strong> sold, rented, shared with
              third parties, or used to send marketing you did not ask for.
            </p>

            <h2 id="retention">Retention</h2>
            <p>
              Submissions are kept until they are no longer useful for the purpose you sent them
              for, or until you ask for them to be deleted. NWPH is pre-incorporation and has no
              records management system; submissions currently reach a mailbox and stay there.
              This section will be made more specific when there is a system to describe.
            </p>

            <h2 id="your-rights">Access and deletion</h2>
            <p>
              Write to <a href="mailto:${site.email}">${site.email}</a> to ask what has been kept
              about you, to correct it, or to have it deleted. There is no charge and no form.
            </p>

            <h2 id="changes">Changes</h2>
            <p>
              This notice describes the site as it currently operates. It will be updated when the
              forms are connected to a submission endpoint, and again at incorporation.
            </p>
          </div>
        </div>
      </section>`,
  };
}

/** Accessibility statement — specific, with the known gaps named. */
export function accessibilityPage({ base }) {
  return {
    path: '/accessibility/',
    current: null,
    title: 'Accessibility',
    description:
      'Accessibility statement for the North West Passage Holdings Corporation website, including what has been tested and what has not.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([{ href: `${base}/`, label: 'Home' }, { label: 'Accessibility' }])}
          <p class="section__label">Policies</p>
          <h1>Accessibility</h1>
          <p class="section__intro">
            This site targets WCAG 2.2 Level AA. Here is what has been tested, and what has not.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="prose" style="max-width: 68ch">
            <h2 id="what-is-in-place">What is in place</h2>
            <ul>
              <li>All text meets or exceeds AA contrast; colour combinations are verified on every build.</li>
              <li>The whole site is operable by keyboard, including the tab groups and the portfolio filter.</li>
              <li>A visible focus indicator on every interactive element, meeting the 2.2 focus-appearance requirement.</li>
              <li>A skip link as the first focusable element on every page.</li>
              <li>Semantic landmarks, one <code>h1</code> per page, and no skipped heading levels.</li>
              <li>Status is never conveyed by colour alone — every stage carries its own word.</li>
              <li>Wide tables scroll inside their own focusable region rather than forcing the page sideways.</li>
              <li><code>prefers-reduced-motion</code> is honoured; there is no animation, video or autoplay.</li>
              <li>The site works with JavaScript disabled, including navigation, the filter and the forms.</li>
              <li>Usable from a 320&nbsp;pixel viewport with no horizontal scrolling.</li>
              <li>A print stylesheet, because funders and procurement officers print things.</li>
            </ul>

            <h2 id="what-has-not-been-tested">What has not been tested</h2>
            <p>Stated plainly rather than left as an implied claim of full conformance:</p>
            <ul>
              <li><strong>No screen reader testing.</strong> NVDA, JAWS and VoiceOver passes have not been carried out.</li>
              <li><strong>No testing with assistive technology users.</strong> Automated and manual keyboard checks are not a substitute.</li>
              <li><strong>Zoom to 400%</strong> has not been explicitly verified, though the layout is fluid and passes at 320&nbsp;pixels.</li>
              <li><strong>No independent audit.</strong> Testing has been carried out by whoever built the site, which is the weakest form of assurance.</li>
            </ul>

            <h2 id="known-limitations">Known limitations</h2>
            <ul>
              <li>The site is available in English only. Inuktitut and French translations are not available.</li>
              <li>Web fonts are not yet installed, so text currently renders in system fallback faces.</li>
            </ul>

            <h2 id="feedback">Feedback</h2>
            <p>
              If any part of this site is difficult to use, write to
              <a href="mailto:${site.email}">${site.email}</a> and describe the problem and the
              page. Accessibility problems are treated as defects, not as requests.
            </p>
          </div>
        </div>
      </section>`,
  };
}
