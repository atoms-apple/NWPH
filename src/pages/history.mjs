import { html, raw } from '../lib/html.mjs';
import { Breadcrumbs, StatStrip } from '../components/ui.mjs';
import { demo } from '../data/site.mjs';

/** Corporate history, rendered as a dated sequence. */
export default function historyPage({ history, stats, base }) {
  return {
    path: '/about/history/',
    current: '/about/history/',
    title: 'History',
    description: `How North West Passage Holdings Corporation got from a sector assessment to ${stats.byStatus.operating} operating companies.`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/about/`, label: 'About' },
            { label: 'History' },
          ])}
          <p class="section__label">${demo.founded - 1}–${demo.year}</p>
          <h1>How we got here</h1>
          <p class="section__intro">
            A short history, because there is not much of it yet. Eighteen months of assessment,
            incorporation, and two companies since.
          </p>
          ${StatStrip([
            { label: 'Incorporated', value: String(demo.founded) },
            { label: 'Operating companies', value: String(stats.byStatus.operating) },
            { label: 'Employees', value: String(demo.figures.employees) },
            { label: 'Communities', value: String(demo.figures.communities) },
          ], { label: 'The corporation at a glance' })}
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <ol class="timeline">
            ${history.map((entry) => html`
              <li class="timeline__item">
                <p class="timeline__year">${entry.year}</p>
                <div class="timeline__body">
                  <h2 class="timeline__title">${entry.title}</h2>
                  ${raw(entry.body)}
                </div>
              </li>`)}
          </ol>
        </div>
      </section>`,
  };
}
