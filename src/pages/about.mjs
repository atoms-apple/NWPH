import { html, raw } from '../lib/html.mjs';
import { PersonCard, Tabs, StatStrip } from '../components/ui.mjs';

export default function aboutPage({ people, stats, base }) {
  return {
    path: '/about/',
    current: '/about/',
    title: 'About',
    description:
      'North West Passage Holdings Corporation is a pre-incorporation Inuit-owned holding company based in Iqaluit, Nunavut. What it is, how it is structured, and where it stands today.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">About</p>
          <h1>An Inuit-owned holding company, before it holds anything</h1>
          <p class="section__intro">
            NWPH was founded on a simple belief: that Nunavummiut should own, lead, and benefit
            from the economic development happening in their homeland.
          </p>
          <div class="status-notice">
            <p class="status-notice__head">Where this actually stands</p>
            <p>
              The corporation is <strong>pre-incorporation</strong>. It has no operating
              subsidiaries, no revenue, and no employees. Everything below describes what is
              being built, not what exists.
            </p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <h2>In more detail</h2>
          <div style="margin-top: var(--space-l)">
          ${Tabs([
            {
              id: 'mandate',
              label: 'Mandate',
              body: `<div class="prose">
                <p>NWPH builds and operates companies in sectors where Nunavummiut currently have no
                locally-owned alternative: tourism, retail, aviation, marine freight, real estate,
                technology, environmental monitoring, and financial services.</p>
                <p>The test for each subsidiary is whether it would survive on its merits.
                A subsidiary that survives only because customers feel obliged to support it has
                failed.</p>
              </div>`,
            },
            {
              id: 'structure',
              label: 'Structure',
              body: `<div class="prose">
                <p>NWPH is a holding company. Each business is intended to be a separate incorporated
                subsidiary with its own management, rather than a division.</p>
                <p>Incorporation of the holding company and of each subsidiary has not yet taken place.
                Governance arrangements, share structure and board composition are not yet settled.</p>
              </div>`,
            },
            {
              id: 'status',
              label: 'Current status',
              body: `<div class="prose">
                <p>No subsidiary is operating. The first, ArcTrek Expeditions Ltd., targets summer 2027
                and is the only one at the in-development stage.</p>
                <p>Until then NWPH is registering suppliers, speaking to funders and partners, and
                recording expressions of interest from prospective staff.</p>
              </div>`,
            },
          ], { label: 'About NWPH', idPrefix: 'about' })}
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">People</p>
          <h2>Who is behind this</h2>
          <p class="section__intro">
            NWPH has no employees. The people below are the founding group.
          </p>
          <ul class="grid grid--3" role="list" style="margin-top: var(--space-xl)">
            ${people.map(PersonCard)}
          </ul>
        </div>
      </section>`,
  };
}
