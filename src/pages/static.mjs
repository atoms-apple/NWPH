import { html } from '../lib/html.mjs';
import { site } from '../data/site.mjs';

export function thankYouPage({ base }) {
  return {
    path: '/thank-you/',
    current: null,
    title: 'Thank you',
    noindex: true,
    description: 'Your message has been received by North West Passage Holdings Corporation.',
    body: html`
      <section class="section">
        <div class="wrap">
          <div class="alert alert--success" role="status">
            <p class="alert__title">Received</p>
            <p>Your message has reached North West Passage Holdings Corporation.</p>
          </div>
          <h1 style="margin-top: var(--space-l)">Thank you</h1>
          <p class="section__intro">
            Your message has been directed to the relevant team. If your enquiry is urgent,
            email
            <a href="mailto:${site.email}">${site.email}</a> directly.
          </p>
          <p class="hero__actions">
            <a class="btn btn--primary" href="${base}/">Back to the home page</a>
            <a class="btn btn--ghost" href="${base}/subsidiaries/">See the portfolio</a>
          </p>
        </div>
      </section>`,
  };
}

export function notFoundPage({ base }) {
  return {
    path: '/404.html',
    current: null,
    title: 'Page not found',
    noindex: true,
    description: 'That page does not exist on the North West Passage Holdings Corporation website.',
    body: html`
      <section class="section">
        <div class="wrap">
          <p class="section__label">Error 404</p>
          <h1>That page does not exist</h1>
          <p class="section__intro">
            The address may be mistyped, or the page may have been removed. Everything on this
            site is reachable from the links below.
          </p>
          <ul class="prose" style="margin-top: var(--space-l)">
            <li><a href="${base}/">Home</a></li>
            <li><a href="${base}/about/">About NWPH</a></li>
            <li><a href="${base}/subsidiaries/">Subsidiaries</a></li>
            <li><a href="${base}/procurement/">Procurement and suppliers</a></li>
            <li><a href="${base}/careers/">Careers</a></li>
            <li><a href="${base}/news/">Updates</a></li>
            <li><a href="${base}/contact/">Contact</a></li>
          </ul>
        </div>
      </section>`,
  };
}
