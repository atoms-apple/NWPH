import { html, raw } from '../lib/html.mjs';

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

export function newsIndex({ news, base }) {
  return {
    path: '/news/',
    current: '/news/',
    title: 'Updates',
    description: 'Progress updates from North West Passage Holdings Corporation.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Updates</p>
          <h1>Updates</h1>
          <p class="section__intro">
            Progress, and the absence of it. Published as things actually happen.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          ${news.length ? html`
            <ul class="grid grid--2" role="list">
              ${news.map((entry) => html`
                <li class="card card--link">
                  <p class="card__sector"><time datetime="${entry.date}">${formatDate(entry.date)}</time></p>
                  <h2 class="card__title"><a href="${base}/news/${entry.slug}/">${entry.title}</a></h2>
                  <p class="card__body">${entry.summary}</p>
                </li>`)}
            </ul>` : html`
            <div class="callout">
              <p><strong>No updates have been published yet.</strong></p>
              <p>When there is something to report, it will appear here.</p>
            </div>`}
        </div>
      </section>`,
  };
}

export function newsDetail(entry, { base }) {
  return {
    path: `/news/${entry.slug}/`,
    current: '/news/',
    title: entry.title,
    description: entry.summary,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label"><time datetime="${entry.date}">${formatDate(entry.date)}</time></p>
          <h1>${entry.title}</h1>
          <p class="section__intro">${entry.summary}</p>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="prose">${raw(entry.body)}</div>
          <p style="margin-top: var(--space-2xl)"><a href="${base}/news/">← All updates</a></p>
        </div>
      </section>`,
  };
}
