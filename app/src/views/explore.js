/**
 * Where we fly: destinations, one community, the fleet, the timetable.
 *
 * The destination pages are the part of an airline site people actually read
 * before they have bought anything, so they carry more than a route list —
 * what the place is, what the strip is like, what the light does, and which
 * services call there.
 */

import { html, raw, icon, on, $, cx } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState, setSearch } from '../lib/store.js';
import { airports, airport, airportsByRegion, REGIONS, distanceKm } from '../data/airports.js';
import { aircraftList, aircraftType, seatCount, buildSeatMap } from '../data/aircraft.js';
import { routes, circuits, circuitById } from '../data/network.js';
import { destination } from '../data/destinations.js';
import { brands, brandList } from '../data/brand.js';
import { nextOperatingDates, buildFlight, operatesOn } from '../engine/schedule.js';
import { liveAdvisories } from '../data/advisories.js';
import { today, formatDate, formatClock, formatDuration, WEEKDAYS_SHORT, localClock } from '../lib/dates.js';
import { pageHead, note, empty, skyGradient, searchWidget, wireSearchWidget } from './ui.js';

/* ── Destinations index ──────────────────────────────────────────────────── */

export function destinationsView({ query }) {
  const filter = (query.region ?? 'all');
  const search = (query.q ?? '').trim().toLowerCase();

  const groups = airportsByRegion()
    .filter((group) => filter === 'all' || group.region.id === filter)
    .map((group) => ({
      ...group,
      airports: group.airports.filter((a) => !search
        || a.name.toLowerCase().includes(search)
        || (a.also ?? '').toLowerCase().includes(search)
        || a.code.toLowerCase().includes(search)),
    }))
    .filter((group) => group.airports.length);

  const shown = groups.reduce((n, g) => n + g.airports.length, 0);

  const body = html`
    ${pageHead('Destinations',
      `Thirty communities and gateways across Nunavut and the provinces south. Every one has a page: who serves it, how often, and what to expect when you land.`)}

    <div class="grid-2" style="margin-bottom:var(--s5)">
      <div class="field" style="margin:0">
        <label class="visually-hidden" for="dest-search">Find a community</label>
        <div class="searchfield">
          ${icon('search', { size: 18 })}
          <input class="input" id="dest-search" placeholder="Find a community or code" value="${query.q ?? ''}" autocomplete="off">
        </div>
      </div>
      <div class="chips" style="align-items:center">
        <button type="button" class="chip ${filter === 'all' ? 'is-active' : ''}" data-region="all">All regions</button>
        ${Object.values(REGIONS).map((region) => html`
          <button type="button" class="chip ${filter === region.id ? 'is-active' : ''}" data-region="${region.id}">${region.short}</button>`)}
      </div>
    </div>

    <p class="option__note" role="status" style="margin-bottom:var(--s4)">${shown} communit${shown === 1 ? 'y' : 'ies'}</p>

    ${groups.length ? groups.map((group) => html`
      <section class="section">
        <div class="section__head">
          <div><h2>${group.region.name}</h2><p>${group.airports.length} served</p></div>
        </div>
        <div class="cards">
          ${group.airports.map((place) => {
            const guide = destination(place.code);
            const serving = routes.filter((r) => r.stops.includes(place.code));
            return html`
              <a class="dest-card" href="${href(`/destinations/${place.code}`)}">
                <span class="dest-card__sky" style="background:${skyGradient(place)}">
                  <span class="dest-card__label">
                    <span class="dest-card__code">${place.code}${place.hub ? ' · hub' : ''}</span>
                    <span class="dest-card__name">${place.name}</span>
                  </span>
                </span>
                <span class="dest-card__body">
                  ${guide?.inuktitut ? html`<span class="dest-card__meta" lang="iu" style="font-size:var(--text-md)">${guide.inuktitut}</span>` : ''}
                  <span class="dest-card__meta" style="display:block;margin-top:var(--s1)">
                    ${serving.length} service${serving.length === 1 ? '' : 's'} ·
                    ${place.runway} m ${place.surface}
                  </span>
                </span>
              </a>`;
          })}
        </div>
      </section>`) : empty('Nothing matches that', 'Try a community name, a former name, or a three-letter code.')}`;

  return {
    title: 'Destinations',
    body,
    onMount: (root) => {
      const input = $('#dest-search', root);
      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          go(href('/destinations', { region: filter === 'all' ? null : filter, q: input.value.trim() || null }).slice(1), { replace: true });
        }, 220);
      });
      on(root, 'click', '[data-region]', (event, button) => {
        go(href('/destinations', { region: button.dataset.region === 'all' ? null : button.dataset.region, q: query.q }).slice(1));
      });
    },
  };
}

/* ── One community ───────────────────────────────────────────────────────── */

export function destinationView({ params }) {
  const code = params.code.toUpperCase();
  let place;
  try { place = airport(code); } catch {
    return { title: 'Not found', body: empty('No such community', 'Choose one from the destinations list.') };
  }

  const guide = destination(code);
  const serving = routes.filter((r) => r.stops.includes(code));
  const direct = [...new Set(serving.flatMap((route) => {
    const index = route.stops.indexOf(code);
    return [...route.stops.slice(0, index), ...route.stops.slice(index + 1)];
  }))].sort((a, b) => distanceKm(code, a) - distanceKm(code, b));

  const types = [...new Set(serving.map((r) => r.aircraft))].map(aircraftType);
  const advisories = liveAdvisories().filter((a) => a.stops.includes(code));
  const sunHours = daylightNote(place);

  const body = html`
    <div class="hero bleed" style="margin-bottom:var(--s6)">
      <div class="hero__sky" style="background:${skyGradient(place)}"></div>
      <div class="hero__stars"></div>
      <div class="hero__inner" style="padding-block:var(--s10)">
        <p class="hero__eyebrow">${REGIONS[place.region].name} · ${code}</p>
        <h1 style="font-size:var(--text-3xl)">${place.name}</h1>
        ${guide?.inuktitut ? html`
          <p lang="iu" style="font-size:var(--text-xl);color:var(--aurora);margin-bottom:var(--s3)">
            ${guide.inuktitut}${guide.meaning ? html` <span style="color:#C7DCEA;font-size:var(--text-base)">— ${guide.meaning}</span>` : ''}
          </p>` : ''}
        ${guide?.intro ? html`<p class="hero__lede">${guide.intro}</p>` : ''}
      </div>
    </div>

    ${advisories.length ? html`
      <div class="advisory ${advisories[0].severity === 'severe' ? 'advisory--severe' : ''}" style="margin-bottom:var(--s5)">
        ${icon('warning', { size: 20 })}
        <div>
          <p class="advisory__title">${advisories[0].title}</p>
          <p style="margin:0">${advisories[0].body}</p>
          <p class="advisory__meta"><a href="${href('/advisories')}">All travel advisories</a></p>
        </div>
      </div>` : ''}

    <dl class="kv-strip" style="margin-bottom:var(--s6)">
      <div><dt>Airport</dt><dd style="font-size:var(--text-base)">${place.airport}</dd></div>
      <div><dt>Runway</dt><dd>${place.runway} m</dd></div>
      <div><dt>Surface</dt><dd style="font-size:var(--text-base)">${place.surface}</dd></div>
      <div><dt>Population</dt><dd>${place.population.toLocaleString('en-CA')}</dd></div>
      <div><dt>Latitude</dt><dd>${place.lat.toFixed(1)}°N</dd></div>
      <div><dt>Time zone</dt><dd style="font-size:var(--text-base)">UTC${place.tz}${place.noDst ? ' all year' : ''}</dd></div>
    </dl>

    ${guide?.note ? note(guide.note, { kind: 'info', title: 'Flying here' }) : ''}
    ${place.noDst ? note(html`
      Southampton Island stays on Eastern Standard Time all year, so for half the year ${place.name}
      is an hour ahead of the rest of the Kivalliq region. Every time in this app is the local clock
      at the airport it happens at, which is the one you will be reading.`, { kind: 'warn', title: 'Check the clock' }) : ''}
    ${sunHours ? note(sunHours, { kind: 'info', title: 'Light' }) : ''}

    <section class="section" style="margin-top:var(--s8)">
      <div class="section__head">
        <div><h2>Services calling here</h2><p>${serving.length} scheduled service${serving.length === 1 ? '' : 's'}.</p></div>
        <a class="section__more" href="${href('/timetable', { at: code })}">Full timetable</a>
      </div>
      <div class="stack stack--tight">
        ${serving.map((route) => {
          const dates = nextOperatingDates(route, today(), 2);
          return html`
            <div class="card">
              <div class="row row--top">
                <span class="brand-dot brand-dot--${route.brand}" style="margin-top:.45rem"></span>
                <div class="grow">
                  <div class="option__title">NW${route.number} — ${route.name}</div>
                  <div class="option__note">
                    ${brands[route.brand].shortName} · ${aircraftType(route.aircraft).name} ·
                    ${route.days.map((d) => WEEKDAYS_SHORT[d - 1]).join(' ')}${route.cadence !== 'weekly' ? ` · ${route.cadence} weeks` : ''}
                  </div>
                  ${route.circuit ? html`
                    <div class="option__note">
                      Part of the <a href="${href(`/milk-runs/${route.circuit}`)}">${circuitById[route.circuit].name}</a>
                    </div>` : ''}
                </div>
                <div class="option__note" style="text-align:right;white-space:nowrap">
                  ${dates.length ? raw(dates.map((d) => formatDate(d, 'short')).join('<br>')) : 'not scheduled'}
                </div>
              </div>
            </div>`;
        })}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>Aircraft that come here</h2><p>Limited by the runway: ${place.runway} m of ${place.surface}.</p></div></div>
      <div class="grid-3">
        ${types.map((type) => html`
          <div class="card">
            <div class="option__title">${type.name}</div>
            <div class="option__note">${seatCount(type.id)} seats · needs ${type.minRunway} m · ${type.cargoTonnes} t freight</div>
          </div>`)}
      </div>
      ${aircraftList.filter((t) => t.minRunway > place.runway).length ? html`
        <p class="option__note" style="margin-top:var(--s3)">
          Cannot come here:
          ${aircraftList.filter((t) => t.minRunway > place.runway).map((t) => t.name).join(', ')} —
          the strip is too short.
        </p>` : ''}
    </section>

    <section class="section">
      <div class="section__head"><div><h2>Reachable without a change</h2><p>Nearest first.</p></div></div>
      <div class="chips">
        ${direct.map((other) => html`
          <a class="chip" href="${href(`/destinations/${other}`)}">
            ${airport(other).name}
            <span class="option__note" style="display:inline">${distanceKm(code, other)} km</span>
          </a>`)}
      </div>
    </section>

    <div class="btn-row" style="margin-top:var(--s6)">
      <button type="button" class="btn btn--accent" data-action="search-from">Fly from ${place.name}</button>
      <button type="button" class="btn btn--secondary" data-action="search-to">Fly to ${place.name}</button>
      <a class="btn btn--secondary" href="${href('/cargo/quote', { to: code })}">Ship freight here</a>
    </div>`;

  return {
    title: place.name,
    body,
    bleed: true,
    onMount: (root) => {
      on(root, 'click', '[data-action="search-from"]', () => {
        const current = getState().search;
        setSearch({ from: code, to: current.to === code ? 'YFB' : current.to });
        go('/book');
      });
      on(root, 'click', '[data-action="search-to"]', () => {
        const current = getState().search;
        setSearch({ to: code, from: current.from === code ? 'YFB' : current.from });
        go('/book');
      });
    },
  };
}

/**
 * What the light does here.
 *
 * Above the Arctic Circle the sun genuinely does not rise or set for part of
 * the year, and it is the single thing that most surprises a first-time
 * traveller. Computed from latitude rather than written per community.
 */
function daylightNote(place) {
  if (place.lat < 66.56) return null;
  const days = Math.round((place.lat - 66.56) * 11.5);
  if (days < 3) {
    return `${place.name} sits just on the Arctic Circle. There are a handful of days around the `
      + 'solstices when the sun does not properly rise, or does not set.';
  }
  return `At ${place.lat.toFixed(1)}°N the sun stays below the horizon for roughly ${days} days `
    + `around the winter solstice, and stays above it for roughly ${days} days around the summer one. `
    + 'Several strips on the network have no runway lighting, so winter services are flown in the '
    + 'middle of the day and a delay of a few hours can end the flying day.';
}

/* ── Fleet ───────────────────────────────────────────────────────────────── */

export function fleetView() {
  const body = html`
    ${pageHead('Our fleet',
      'Seven types, chosen for the strips they have to use rather than the routes they would fly best. On this network the runway picks the aircraft.')}

    ${note(html`
      Every scheduled service in this app is checked against the runway it calls at — length and
      surface — and the build fails if an aircraft is assigned to a strip it could not use. That is
      why the Twin Otter goes to Grise Fiord and the 737-800 does not leave the pavement.`,
      { kind: 'ok', title: 'The constraint, enforced' })}

    ${brandList.map((brand) => html`
      <section class="section" style="margin-top:var(--s8)">
        <div class="section__head">
          <div>
            <h2><span class="brand-dot brand-dot--${brand.id}"></span> ${brand.name}</h2>
            <p>${brand.tagline}</p>
          </div>
          <a class="section__more" href="${href(`/brand/${brand.id}`)}">Routes</a>
        </div>
        <div class="stack">
          ${brand.fleet.map((id) => {
            const type = aircraftType(id);
            const map = buildSeatMap(id);
            const canReach = airports.filter((a) => a.runway >= type.minRunway && (type.gravelCapable || a.surface === 'paved'));
            return html`
              <div class="card">
                <div class="row row--between row--wrap" style="margin-bottom:var(--s3)">
                  <div>
                    <h3>${type.name}</h3>
                    <p class="option__note">${type.note}</p>
                  </div>
                  <span class="badge badge--lg badge--${brand.id}">${type.short}</span>
                </div>
                <dl class="kv-strip">
                  <div><dt>Seats</dt><dd>${seatCount(id)}</dd></div>
                  <div><dt>Cruise</dt><dd>${type.cruiseKph} km/h</dd></div>
                  <div><dt>Min runway</dt><dd>${type.minRunway} m</dd></div>
                  <div><dt>Surface</dt><dd style="font-size:var(--text-base)">${type.gravelCapable ? 'Gravel or paved' : 'Paved only'}</dd></div>
                  <div><dt>Freight</dt><dd>${type.cargoTonnes} t</dd></div>
                  <div><dt>Turnaround</dt><dd>${type.turnaroundMin} min</dd></div>
                  <div><dt>Cabin</dt><dd style="font-size:var(--text-base)">${map.blocks.filter((b) => b.kind === 'row')[0]?.seats.length ?? 0} across</dd></div>
                  <div><dt>Can reach</dt><dd>${canReach.length} of ${airports.length}</dd></div>
                </dl>
              </div>`;
          })}
        </div>
      </section>`)}

    <section class="section">
      <div class="section__head"><div><h2>Every type, side by side</h2></div></div>
      <div class="table-wrap">
        <table class="table table--zebra">
          <caption>The figures the whole schedule is computed from.</caption>
          <thead>
            <tr>
              <th>Type</th><th>Line</th><th class="num">Seats</th><th class="num">Cruise</th>
              <th class="num">Min runway</th><th>Surface</th><th class="num">Freight</th><th class="num">Reaches</th>
            </tr>
          </thead>
          <tbody>
            ${aircraftList.map((type) => {
              const canReach = airports.filter((a) => a.runway >= type.minRunway && (type.gravelCapable || a.surface === 'paved'));
              return html`
                <tr>
                  <td>${type.name}</td>
                  <td><span class="brand-dot brand-dot--${type.brand}"></span> ${brands[type.brand].shortName}</td>
                  <td class="num tnum">${seatCount(type.id)}</td>
                  <td class="num tnum">${type.cruiseKph}</td>
                  <td class="num tnum">${type.minRunway} m</td>
                  <td>${type.gravelCapable ? 'Gravel' : 'Paved'}</td>
                  <td class="num tnum">${type.cargoTonnes} t</td>
                  <td class="num tnum">${canReach.length}</td>
                </tr>`;
            })}
          </tbody>
        </table>
      </div>
    </section>`;

  return { title: 'Our fleet', body };
}

/* ── Timetable ───────────────────────────────────────────────────────────── */

export function timetableView({ query }) {
  const at = (query.at ?? '').toUpperCase();
  const brandFilter = query.brand || null;
  const dayFilter = query.day ? Number(query.day) : null;

  const shown = routes.filter((route) =>
    (!at || route.stops.includes(at))
    && (!brandFilter || route.brand === brandFilter)
    && (!dayFilter || route.days.includes(dayFilter)));

  const body = html`
    ${pageHead('Timetable',
      'Every scheduled service on the network. Times are local at the first stop; the circuits show each community they call at, in order.')}

    <div class="stack" style="margin-bottom:var(--s5)">
      <div class="chips">
        <button type="button" class="chip ${!brandFilter ? 'is-active' : ''}" data-tt-brand="">All lines</button>
        ${brandList.map((brand) => html`
          <button type="button" class="chip ${brandFilter === brand.id ? 'is-active' : ''}" data-tt-brand="${brand.id}">
            <span class="brand-dot brand-dot--${brand.id}"></span>${brand.shortName}
          </button>`)}
      </div>
      <div class="chips">
        <button type="button" class="chip ${!dayFilter ? 'is-active' : ''}" data-tt-day="">Any day</button>
        ${WEEKDAYS_SHORT.map((label, index) => html`
          <button type="button" class="chip ${dayFilter === index + 1 ? 'is-active' : ''}" data-tt-day="${index + 1}">${label}</button>`)}
      </div>
      <div class="field" style="margin:0;max-width:22rem">
        <label class="field__label" for="tt-at">Calling at</label>
        <select class="select" id="tt-at">
          <option value="">Anywhere on the network</option>
          ${airportsByRegion().map((group) => html`
            <optgroup label="${group.region.name}">
              ${group.airports.map((a) => html`
                <option value="${a.code}" ${a.code === at ? raw('selected') : ''}>${a.name} — ${a.code}</option>`)}
            </optgroup>`)}
        </select>
      </div>
    </div>

    <p class="option__note" role="status" style="margin-bottom:var(--s4)">
      ${shown.length} service${shown.length === 1 ? '' : 's'}
    </p>

    ${shown.length ? html`
      <div class="table-wrap">
        <table class="table table--zebra">
          <caption>North Winds scheduled services. Departure times are local at the first stop.</caption>
          <thead>
            <tr><th>Flight</th><th>Routing</th><th>Days</th><th class="num">Departs</th><th>Aircraft</th></tr>
          </thead>
          <tbody>
            ${shown.map((route) => html`
              <tr>
                <td class="tnum" style="white-space:nowrap">
                  <span class="brand-dot brand-dot--${route.brand}"></span> NW${route.number}
                </td>
                <td>
                  ${route.stops.map((c) => airport(c).name).join(' – ')}
                  ${route.circuit ? html`<br><span class="option__note">${circuitById[route.circuit].name}</span>` : ''}
                </td>
                <td style="white-space:nowrap">
                  ${route.days.map((d) => WEEKDAYS_SHORT[d - 1]).join(' ')}
                  ${route.cadence !== 'weekly' ? html`<br><span class="option__note">${route.cadence} weeks</span>` : ''}
                </td>
                <td class="num tnum">${formatClock(route.depart)}</td>
                <td class="option__note">${aircraftType(route.aircraft).short}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>` : empty('Nothing matches those filters', 'Try another day, or another service line.')}

    <p style="margin-top:var(--s5)">
      <button type="button" class="btn btn--secondary" data-action="print">${icon('download', { size: 16 })} Print this timetable</button>
    </p>`;

  return {
    title: 'Timetable',
    body,
    onMount: (root) => {
      const navigate = (patch) => go(href('/timetable', {
        at: at || null, brand: brandFilter, day: dayFilter, ...patch,
      }).slice(1));
      on(root, 'click', '[data-tt-brand]', (event, button) => navigate({ brand: button.dataset.ttBrand || null }));
      on(root, 'click', '[data-tt-day]', (event, button) => navigate({ day: button.dataset.ttDay || null }));
      $('#tt-at', root).addEventListener('change', (event) => navigate({ at: event.target.value || null }));
      on(root, 'click', '[data-action="print"]', () => window.print());
    },
  };
}
