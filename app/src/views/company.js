/**
 * The company: our story, the community, and careers.
 *
 * The story page is the one place on an airline site where the writing has to
 * carry the whole thing, so it is written as prose rather than as cards — and
 * it says what is true about this venture, which is that it does not exist yet.
 */

import { html, raw, icon, on, $ } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { airline, brandList } from '../data/brand.js';
import { airports } from '../data/airports.js';
import { routes, circuits } from '../data/network.js';
import { roles, roleById, teams } from '../data/services.js';
import { aircraftList } from '../data/aircraft.js';
import { pageHead, note, empty, skyGradient } from './ui.js';

/* ── Our story ───────────────────────────────────────────────────────────── */

export function storyView() {
  const communities = airports.filter((a) => a.region !== 'south').length;

  const body = html`
    <section class="hero bleed" style="margin-bottom:var(--s8)">
      <div class="hero__sky"></div>
      <div class="hero__stars"></div>
      <div class="hero__inner">
        <p class="hero__eyebrow">${icon('anchor', { size: 16 })} Our story</p>
        <h1 style="max-width:20ch">Fares set here. Schedules set here.</h1>
        <p class="hero__lede">
          No road connects one Nunavut community to another. Air service is not a convenience in
          this territory — it is the only year-round link between communities, and the only way
          most people reach a hospital, a court, a funeral or a job interview.
        </p>
      </div>
    </section>

    <div class="with-contents">
      <nav class="with-contents__nav" aria-label="On this page">
        <ul class="contents-list">
          <li><a href="#gap">The gap</a></li>
          <li><a href="#answer">What an answer looks like</a></li>
          <li><a href="#three">Why three service lines</a></li>
          <li><a href="#hard">What makes this hard</a></li>
          <li><a href="#status">Where this actually stands</a></li>
        </ul>
      </nav>

      <div class="prose">
        <h2 id="gap">The gap</h2>
        <p>
          Air service across Nunavut is provided almost entirely by carriers owned outside the
          territory, or by regional corporations headquartered elsewhere in the North. Fares are set
          elsewhere. Schedules are set elsewhere. When a route stops paying, the decision to thin it
          is taken elsewhere.
        </p>
        <p>
          The consequences are not abstract. A return fare between two communities can exceed a
          fare to Europe. A community that loses a weekly service loses its access to fresh food,
          to specialist care and to the rest of the territory at the same time. And a family
          shipping country food to relatives in another community pays freight rates set by someone
          who has never eaten any.
        </p>

        <h2 id="answer">What an answer looks like</h2>
        <p>
          North Winds is what an Inuit-owned carrier for this territory would be: ${communities}
          communities served, ${routes.length} scheduled services, ${circuits.length} circuits, and
          four gateways south. Owned in Nunavut, run from Iqaluit, and answerable to the people who
          depend on it.
        </p>
        <p>
          That ownership is supposed to change specific things, not be a slogan. Country food is
          rated below general freight, because it is not a commercial shipment. Medical travel is
          carried ahead of everything else when a flight has to be offloaded for weight. Compassionate
          fares exist and are confirmed by a person rather than a form. And the fortnightly circuits
          are built so that no community on Baffin goes longer than two weeks without an aircraft,
          which is a scheduling decision that costs money and is made anyway.
        </p>

        <h2 id="three">Why three service lines</h2>
        <p>
          Because one aircraft cannot do this. A 737 reaches Ottawa in three hours and cannot land
          on eight hundred metres of gravel. A Twin Otter lands almost anywhere and would take two
          days to reach Ottawa. So the network is three lines, each matched to what it has to do:
        </p>
        <ul>
          ${brandList.map((brand) => html`
            <li><strong>${brand.name}</strong> — ${brand.tagline.toLowerCase()}. ${brand.description.split('.')[0]}.</li>`)}
        </ul>
        <p>
          They are sections of this site, not walls between them. A journey that needs a circuit and
          a jet is quoted, sold and checked through as one booking, because to the person making it
          that is one trip.
        </p>

        <h2 id="hard">What makes this hard</h2>
        <p>
          Aviation carries the heaviest entry requirements of any venture. An Air Operator
          Certificate from Transport Canada, and the operational control, maintenance and safety
          management systems that certification requires. Aircraft suited to gravel strips, short
          runways and cold-weather operations — ${aircraftList.length} types, in this network's
          case — acquired or leased, either of which is a capital commitment orders of magnitude
          beyond a first venture. Certified flight crew and licensed engineers, in a labour market
          where both are scarce and mobile. Ground handling, fuel and terminal access at every
          community served.
        </p>
        <p>
          An airline cannot be started small and grown. It begins at scale or it does not begin, and
          the certification alone takes years before a single fare is sold.
        </p>

        <h2 id="status">Where this actually stands</h2>
        <p>
          No company has been formed. No certification has been sought, no aircraft identified and no
          route assessed. On the corporation's own site, aviation is listed as a sector the portfolio
          intends to address, not work that is underway — most plausibly through partnership or
          acquisition rather than a start-up, funded by ventures that are already trading.
        </p>
        <p>
          What you are reading is a prototype: the airline's site and app, built out far enough to
          argue with. It is here to make the shape of the thing concrete — the network, the fares,
          the constraints, the decisions an owner would have to take — rather than to sell a seat.
        </p>
      </div>
    </div>

    ${note(html`
      <strong>North Winds Airlines does not exist.</strong>
      Everything on this site about the airline is invented. What is real is the geography, the
      distances, the runways, the time zones and the constraint the whole thing is built around.
      <a href="${href('/about')}">The full accounting</a>.`, { kind: 'warn' })}`;

  return { title: 'Our story', body, bleed: true };
}

/* ── In the community ────────────────────────────────────────────────────── */

export function communityView() {
  const body = html`
    ${pageHead('In the community',
      'What an Inuit-owned carrier is supposed to do differently, set out as commitments rather than sentiment. Each of these costs something; that is what makes it a commitment.')}

    <div class="grid-2" style="margin-bottom:var(--s8)">
      ${[
        ['heart', 'Compassionate travel', 'A 40% fare for travel following a death or serious illness in the family, confirmed by a person on the reservations line rather than by a form. No documentation is demanded up front.'],
        ['cargo', 'Country food, rated below freight', 'Harvested meat and fish moving between communities is not a commercial shipment and is not priced like one — $2.40 a kilogram against $3.15 for general freight.'],
        ['shield', 'Medical travel carried first', 'Where a flight must be offloaded for weight, medical travel, compassionate travel and unaccompanied minors are carried before all other classes.'],
        ['people', 'Hiring where we fly', 'Agent positions are filled from the community served. Preference for every role goes to Nunavut Agreement beneficiaries, and the apprenticeship is open to beneficiaries only.'],
        ['star', 'A fortnight, never longer', 'The two Baffin circuits alternate so no community on the island goes more than two weeks without an aircraft. That is a scheduling decision that costs money.'],
        ['globe', 'Inuktitut on every shift', 'Inuktitut-speaking agents at every community counter and on the reservations line during opening hours — not as an option to request, as the default.'],
      ].map(([iconName, title, text]) => html`
        <div class="card">
          <span class="feature__icon">${icon(iconName, { size: 20 })}</span>
          <h2 class="card__title" style="margin:var(--s3) 0 var(--s2)">${title}</h2>
          <p class="option__note">${text}</p>
        </div>`)}
    </div>

    <section class="band band--aurora">
      <h2 style="margin-bottom:var(--s3)">Training, because recruiting south indefinitely is not a plan</h2>
      <p style="color:var(--ink-2);max-width:52rem">
        Flight crew and licensed maintenance engineers are scarce and mobile everywhere, and an
        operator in Iqaluit competes for them against every airline in the country. The answer is
        not to bid harder. It is to train Nunavummiut into both streams — a four-year paid AME
        apprenticeship with fees, books and block training covered, and a first-officer pathway with
        type training provided.
      </p>
      <p style="margin-top:var(--s4)">
        <a class="btn btn--accent" href="${href('/careers')}">See open roles</a>
      </p>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>Sponsorship and community requests</h2></div></div>
      <div class="card">
        <p style="color:var(--ink-2)">
          We hold seats each year for community travel that could not otherwise happen — youth
          teams, elders' gatherings, language and cultural programmes, and search and rescue
          support. Requests are considered quarterly by a committee that includes people from
          outside the company.
        </p>
        <p style="color:var(--ink-2);margin-bottom:0">
          Priority goes to travel that benefits a whole community rather than an individual, and to
          communities that have received nothing recently.
        </p>
        <p style="margin-top:var(--s4)">
          <a class="btn btn--secondary" href="${href('/contact')}">Make a request</a>
        </p>
      </div>
    </section>`;

  return { title: 'In the community', body };
}

/* ── Careers ─────────────────────────────────────────────────────────────── */

export function careersView({ query }) {
  const team = query.team ?? null;
  const shown = team ? roles.filter((r) => r.team === team) : roles;

  const body = html`
    <section class="hero bleed" style="margin-bottom:var(--s8)">
      <div class="hero__sky"></div>
      <div class="hero__stars"></div>
      <div class="hero__inner" style="padding-block:var(--s12)">
        <p class="hero__eyebrow">${icon('briefcase', { size: 16 })} Careers</p>
        <h1 style="max-width:18ch">The best line flying in the country, if you can take the weather</h1>
        <p class="hero__lede">
          Gravel strips, short fields and real decisions. ${roles.length} roles open across flight
          operations, maintenance, airports, cargo and operational control.
        </p>
      </div>
    </section>

    <div class="grid-3" style="margin-bottom:var(--s8)">
      ${[
        ['Northern living allowance', 'Paid on every role based in the territory, on top of salary, with subsidised housing in Iqaluit and Rankin Inlet.'],
        ['Rotations that work', 'Four on, two off for flight crew; two and two available for southern-based engineers. Travel home is included.'],
        ['Preference for beneficiaries', 'Every role gives preference to Nunavut Agreement beneficiaries. The apprenticeship is open to beneficiaries only.'],
      ].map(([title, text]) => html`
        <div class="card"><h2 class="card__title" style="margin-bottom:var(--s2)">${title}</h2><p class="option__note">${text}</p></div>`)}
    </div>

    <div class="chips" style="margin-bottom:var(--s5)">
      <button type="button" class="chip ${!team ? 'is-active' : ''}" data-team="">All teams</button>
      ${teams.map((name) => html`
        <button type="button" class="chip ${team === name ? 'is-active' : ''}" data-team="${name}">${name}</button>`)}
    </div>

    <div class="stack">
      ${shown.map((role) => html`
        <a class="card-button" href="${href(`/careers/${role.id}`)}">
          <div class="row row--top row--between" style="margin-bottom:var(--s2)">
            <div class="grow">
              <div class="option__title" style="font-size:var(--text-md)">${role.title}</div>
              <div class="option__note">${role.team} · ${role.base} · ${role.type}</div>
            </div>
            ${icon('forward', { size: 18 })}
          </div>
          <p class="option__note">${role.summary}</p>
          <p style="margin-top:var(--s3)">
            <span class="badge badge--aurora">${role.salary}</span>
            <span class="badge badge--outline">${role.closes}</span>
          </p>
        </a>`)}
    </div>

    ${note(html`
      <strong>There is no one to apply to.</strong>
      North Winds does not exist, so these roles are not open. They describe what an airline on this
      network would actually need to hire, and what it would have to offer to get anyone to take
      it.`, { kind: 'warn' })}`;

  return {
    title: 'Careers',
    body,
    bleed: true,
    onMount: (root) => {
      on(root, 'click', '[data-team]', (event, button) => {
        go(href('/careers', { team: button.dataset.team || null }).slice(1));
      });
    },
  };
}

export function roleView({ params }) {
  const role = roleById(params.id);
  if (!role) return { title: 'Not found', body: empty('No such role', 'Choose one from the careers page.') };

  const body = html`
    ${pageHead(role.title, role.summary, `${role.team} · ${role.base}`)}

    <dl class="kv-strip" style="margin-bottom:var(--s6)">
      <div><dt>Team</dt><dd style="font-size:var(--text-base)">${role.team}</dd></div>
      <div><dt>Based at</dt><dd style="font-size:var(--text-base)">${role.base}</dd></div>
      <div><dt>Type</dt><dd style="font-size:var(--text-base)">${role.type}</dd></div>
      <div><dt>Salary</dt><dd style="font-size:var(--text-base)">${role.salary}</dd></div>
      <div><dt>Closes</dt><dd style="font-size:var(--text-base)">${role.closes}</dd></div>
    </dl>

    <div class="grid-2">
      <div class="card">
        <h2 class="card__title" style="margin-bottom:var(--s3)">What you need</h2>
        <ul style="margin:0;color:var(--ink-2)">${role.requirements.map((r) => html`<li>${r}</li>`)}</ul>
      </div>
      <div class="card">
        <h2 class="card__title" style="margin-bottom:var(--s3)">What we offer</h2>
        <ul style="margin:0;color:var(--ink-2)">${role.offered.map((r) => html`<li>${r}</li>`)}</ul>
      </div>
    </div>

    ${note(role.priority, { kind: 'ok', title: 'Hiring preference' })}

    ${note(html`
      <strong>This role is not open.</strong> North Winds Airlines does not exist. This page
      describes what the job would be. <a href="${href('/about')}">What is real here</a>.`,
      { kind: 'warn' })}

    <p style="margin-top:var(--s6)">
      <a class="btn btn--secondary" href="${href('/careers')}">${icon('back', { size: 16 })} All roles</a>
    </p>`;

  return { title: role.title, body };
}
