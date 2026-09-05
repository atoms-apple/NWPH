import { html, raw } from '../lib/html.mjs';
import { Breadcrumbs, StatStrip } from '../components/ui.mjs';
import { demo } from '../data/site.mjs';

/** Corporate history, rendered as a dated sequence. */
export default function historyPage({ history, stats, base }) {
  return {
    path: '/about/history/',
    current: '/about/history/',
    title: 'History',
    description: `Twenty-five years of North West Passage Holdings Corporation, from incorporation in ${demo.founded} to a portfolio of ${stats.byStatus.operating} operating companies.`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/about/`, label: 'About' },
            { label: 'History' },
          ])}
          <p class="section__label">${demo.founded}–${demo.founded + demo.anniversary}</p>
          <h1>Twenty-five years</h1>
          <p class="section__intro">
            From one subsidiary handling cargo onto a beach, to a portfolio operating across seven
            sectors.
          </p>
          ${StatStrip([
            { label: 'Years', value: String(demo.anniversary) },
            { label: 'Operating companies', value: String(stats.byStatus.operating) },
            { label: 'Sectors', value: String(stats.total) },
            { label: 'Communities served', value: 'XX' },
          ], { label: 'Twenty-five years at a glance' })}
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
