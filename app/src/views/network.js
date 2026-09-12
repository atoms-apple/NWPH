/**
 * The network: the map, the service lines, the circuits, and one community.
 *
 * The map is drawn from the same coordinates the distance and block-time
 * calculations use, projected to the page. Nothing about it is hand-placed, so
 * adding a community to the data puts it on the map in the right spot.
 */

import { html, raw, icon, on } from '../lib/dom.js';
import { href } from '../lib/router.js';
import { getState, setSearch } from '../lib/store.js';
import { airports, airport, airportsByRegion, REGIONS, distanceKm } from '../data/airports.js';
import { routes, circuits, circuitById, circuitRoutes, routesServing } from '../data/network.js';
import { brands, brandList } from '../data/brand.js';
import { aircraftType, seatCount } from '../data/aircraft.js';
import { buildFlight, nextOperatingDates, blockMinutes, operatesOn } from '../engine/schedule.js';
import { today, formatDate, formatDuration, formatClock, WEEKDAYS_SHORT, localClock } from '../lib/dates.js';
import { pageHead, note, empty } from './ui.js';

/* ── Projection ──────────────────────────────────────────────────────────── */

/**
 * Equirectangular with a cosine correction on longitude.
 *
 * Not a proper Arctic projection — above 60°N a conic would be the right
 * answer — but scaling longitude by the cosine of the mean latitude keeps the
 * territory the shape people recognise instead of the sideways smear an
 * uncorrected plate carrée gives at these latitudes.
 *
 * The viewBox is normalised to a fixed width so type and marker sizes can be
 * expressed as fractions of it. Otherwise a map spanning Grise Fiord to
 * Montréal ends up narrow and tall, and its labels render three times the size
 * of the ones on a regional map.
 */
function projector(codes) {
  const set = codes.map(airport);
  const lats = set.map((a) => a.lat);
  const lons = set.map((a) => a.lon);
  const pad = 0.06;
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const squeeze = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const spanX = Math.max(0.5, (maxLon - minLon) * squeeze);
  const spanY = Math.max(0.5, maxLat - minLat);

  const W = 1000;
  // Cap how tall the map may get. Beyond this the page is scrolling past a
  // mostly empty ocean, so the far ends compress rather than the middle
  // becoming unreadable.
  const H = Math.min(W * 1.15, Math.max(W * 0.5, (W * spanY) / spanX));

  const inner = { x: W * pad, y: H * pad, w: W * (1 - pad * 2), h: H * (1 - pad * 2) };

  return {
    width: W,
    height: H,
    viewBox: `0 0 ${Math.round(W)} ${Math.round(H)}`,
    label: W * 0.0145,
    labelHub: W * 0.019,
    radius: W * 0.0055,
    radiusHub: W * 0.0085,
    stroke: W * 0.0022,
    /** True for a point in the right-hand third — its label goes on the left. */
    flip(code) {
      const a = airport(code);
      return (a.lon - minLon) / (maxLon - minLon || 1) > 0.66;
    },
    point(code) {
      const a = airport(code);
      return {
        x: inner.x + ((a.lon - minLon) * squeeze * inner.w) / spanX,
        y: inner.y + ((maxLat - a.lat) * inner.h) / spanY,
      };
    },
  };
}

/** The network as an SVG. Routes first, then nodes, so labels sit on top. */
function networkMap(codes, routeList, { title }) {
  const project = projector(codes);
  const shown = new Set(codes);

  const lines = [];
  const drawn = new Set();
  for (const route of routeList) {
    for (let i = 0; i < route.stops.length - 1; i++) {
      const from = route.stops[i];
      const to = route.stops[i + 1];
      if (!shown.has(from) || !shown.has(to)) continue;
      // One line per pair per service line: the same sector flown by four
      // Altitude rotations is one line on a map, not four.
      const key = `${route.brand}:${[from, to].sort().join('-')}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      const a = project.point(from);
      const b = project.point(to);
      // A slight arc reads as a flight path and separates overlapping pairs.
      const midX = (a.x + b.x) / 2 + (b.y - a.y) * 0.07;
      const midY = (a.y + b.y) / 2 - (b.x - a.x) * 0.07;
      lines.push(html`<path class="map-route map-route--${route.brand}" stroke-width="${project.stroke.toFixed(2)}"
        d="M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${midX.toFixed(1)} ${midY.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}"/>`);
    }
  }

  /**
   * Place the labels, nudging them apart where communities cluster.
   *
   * Thirty points on one map put Kimmirut on top of Iqaluit and Ottawa on top
   * of Montréal. A greedy pass tries the natural position first and steps the
   * label up or down until it clears what is already placed — hubs first, so
   * the important names keep the position they want.
   */
  const placed = [];
  const order = [...codes].sort((a, b) => (airport(b).hub ? 1 : 0) - (airport(a).hub ? 1 : 0));
  const positions = new Map();

  for (const code of order) {
    const a = airport(code);
    const point = project.point(code);
    const size = a.hub ? project.labelHub : project.label;
    const width = a.name.length * size * 0.55;
    const flip = project.flip(code);
    const x = point.x + (flip ? -(a.hub ? project.radiusHub : project.radius) - size * 0.4
      : (a.hub ? project.radiusHub : project.radius) + size * 0.4);

    let y = point.y + size * 0.36;
    for (const step of [0, -1, 1, -2, 2, -3, 3]) {
      const candidate = point.y + size * 0.36 + step * size * 1.15;
      const left = flip ? x - width : x;
      const clash = placed.some((box) => Math.abs(box.y - candidate) < size * 0.95
        && left < box.right && left + width > box.left);
      if (!clash) { y = candidate; break; }
    }
    placed.push({ y, left: flip ? x - width : x, right: flip ? x : x + width });
    positions.set(code, { x, y, size, flip, point });
  }

  const nodes = codes.map((code) => {
    const a = airport(code);
    const { x, y, size, flip, point } = positions.get(code);
    const radius = a.hub ? project.radiusHub : project.radius;
    // Where a label had to move, a hairline ties it back to its dot.
    const moved = Math.abs(y - (point.y + size * 0.36)) > size * 0.5;
    return html`
      <g>
        ${moved ? html`<line class="map-leader" x1="${point.x.toFixed(1)}" y1="${point.y.toFixed(1)}"
          x2="${x.toFixed(1)}" y2="${(y - size * 0.3).toFixed(1)}" stroke-width="${(project.stroke * 0.7).toFixed(2)}"/>` : ''}
        <circle class="map-node ${a.hub ? 'map-node--hub' : ''}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}"
          r="${radius.toFixed(1)}" stroke-width="${project.stroke.toFixed(2)}"/>
        <text class="map-label ${a.hub ? 'map-label--hub' : ''}"
          x="${x.toFixed(1)}" y="${y.toFixed(1)}"
          font-size="${size.toFixed(1)}"
          stroke-width="${(size * 0.28).toFixed(2)}"
          text-anchor="${flip ? 'end' : 'start'}">${a.name}</text>
      </g>`;
  });

  return html`
    <div class="map-frame">
      <svg class="map-svg" viewBox="${project.viewBox}" preserveAspectRatio="xMidYMid meet"
        role="img" aria-label="${title}">
        <g>${lines}</g>
        <g>${nodes}</g>
      </svg>
    </div>`;
}

/* ── Network overview ────────────────────────────────────────────────────── */

export function networkView() {
  const codes = airports.map((a) => a.code);
  const counts = Object.fromEntries(brandList.map((brand) => [
    brand.id, routes.filter((r) => r.brand === brand.id).length,
  ]));

  const body = html`
    ${pageHead('The route network',
      `${airports.length} communities and gateways, ${routes.length} scheduled services, three service lines that sell as one booking.`)}

    ${networkMap(codes, routes, { title: 'Map of the North Winds network across Nunavut and the southern gateways' })}

    <div class="row row--wrap" style="margin:var(--s3) 0 var(--s6)">
      ${brandList.map((brand) => html`
        <span class="badge badge--${brand.id}">
          <span class="brand-dot brand-dot--${brand.id}"></span>${brand.shortName} — ${counts[brand.id]} services
        </span>`)}
    </div>

    ${airportsByRegion().map((group) => html`
      <section class="section">
        <div class="section__head"><h2>${group.region.name}</h2></div>
        <div class="stack stack--tight">
          ${group.airports.map((a) => html`
            <a class="card-button" href="${href(`/network/community/${a.code}`)}">
              <div class="row">
                <div class="grow">
                  <div class="option__title">${a.name}${a.also ? html` <span class="option__note">(${a.also})</span>` : ''}</div>
                  <div class="option__note">
                    ${a.code} · ${a.runway} m ${a.surface}${a.hub ? ' · hub' : ''} ·
                    ${routes.filter((r) => r.stops.includes(a.code)).length} services
                  </div>
                </div>
                ${icon('forward', { size: 18 })}
              </div>
            </a>`)}
        </div>
      </section>`)}`;

  return { title: 'Route network', body };
}

/* ── One service line ────────────────────────────────────────────────────── */

export function brandView({ params }) {
  const brand = brands[params.id];
  if (!brand) return { title: 'Not found', body: empty('No such service line', 'Try Altitude, Express or Connect.') };

  const lineRoutes = routes.filter((r) => r.brand === brand.id);
  const codes = [...new Set(lineRoutes.flatMap((r) => r.stops))];

  const body = html`
    <div class="page-head">
      <p class="page-head__eyebrow"><span class="brand-dot brand-dot--${brand.id}"></span> ${brand.tagline}</p>
      <h1>${brand.name}</h1>
      <p class="page-head__lede">${brand.description}</p>
    </div>

    ${networkMap(codes, lineRoutes, { title: `${brand.name} route map` })}

    <section class="section" style="margin-top:var(--s5)">
      <div class="section__head"><h2>Aircraft</h2></div>
      <div class="stack stack--tight">
        ${brand.fleet.map((id) => {
          const type = aircraftType(id);
          return html`
            <div class="card">
              <div class="option__title">${type.name}</div>
              <div class="option__note">
                ${seatCount(id)} seats · ${type.cruiseKph} km/h cruise ·
                ${type.minRunway} m minimum · ${type.gravelCapable ? 'gravel capable' : 'paved runways only'} ·
                ${type.cargoTonnes} t freight
              </div>
              ${type.note ? html`<p class="option__note" style="margin-top:var(--s2)">${type.note}</p>` : ''}
            </div>`;
        })}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>Scheduled services</h2></div>
      <div class="table-wrap">
        <table class="table">
          <caption>${brand.name} timetable. Times are local at the first stop.</caption>
          <thead>
            <tr><th>Flight</th><th>Route</th><th>Days</th><th class="num">Departs</th></tr>
          </thead>
          <tbody>
            ${lineRoutes.map((route) => html`
              <tr>
                <td class="tnum">NW${route.number}</td>
                <td>${route.stops.map((c) => airport(c).name).join(' – ')}</td>
                <td>
                  ${route.days.map((d) => WEEKDAYS_SHORT[d - 1]).join(' ')}
                  ${route.cadence !== 'weekly' ? html`<br><span class="option__note">${route.cadence} weeks</span>` : ''}
                </td>
                <td class="num tnum">${formatClock(route.depart)}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
    </section>

    <p><a class="btn btn--primary" href="${href('/book')}">Search ${brand.shortName} flights</a></p>`;

  return { title: brand.name, body };
}

/* ── Milk runs ───────────────────────────────────────────────────────────── */

export function milkRunsView() {
  const start = today();

  const body = html`
    ${pageHead('Milk runs',
      'The circuits that call at each community in sequence, carrying passengers, mail, freight and country food. Two Baffin circuits alternate week by week, so every community on the island sees an aircraft each fortnight.')}

    ${note(html`
      <strong>Every stop on a circuit is sellable.</strong>
      You can board at Igloolik and get off at Pond Inlet without going back to Iqaluit, and the
      fare is quoted for the pair you are flying, not the whole run.`, { kind: 'ok' })}

    <div class="stack" style="margin-top:var(--s5)">
      ${circuits.map((circuit) => {
        const legs = circuitRoutes(circuit.id);
        const first = legs[0];
        const dates = nextOperatingDates(first, start, 3);
        const stops = [...new Set(legs.flatMap((r) => r.stops))];
        return html`
          <a class="card-button" href="${href(`/milk-runs/${circuit.id}`)}">
            <div class="row row--between" style="margin-bottom:var(--s2)">
              <div class="grow">
                <div class="option__title">${circuit.name}</div>
                <div class="option__note">${REGIONS[circuit.region].name} · ${stops.length} communities · ${legs.length} scheduled services</div>
              </div>
              ${icon('forward', { size: 18 })}
            </div>
            <p class="option__note">${circuit.blurb}</p>
            <p style="margin-top:var(--s3)">
              <span class="badge ${first.cadence === 'weekly' ? 'badge--outline' : 'badge--connect'}">
                ${first.cadence === 'weekly' ? 'Weekly' : 'Every other week'}
              </span>
              <span class="option__note"> Next: ${dates.map((d) => formatDate(d, 'short')).join(' · ') || 'not scheduled'}</span>
            </p>
          </a>`;
      })}
    </div>`;

  return { title: 'Milk runs', body };
}

export function circuitView({ params }) {
  const circuit = circuitById[params.id];
  if (!circuit) return { title: 'Not found', body: empty('No such circuit', 'Choose one from the milk-run list.') };

  const legs = circuitRoutes(circuit.id);
  const codes = [...new Set(legs.flatMap((r) => r.stops))];
  const start = today();

  const body = html`
    <div class="page-head">
      <p class="page-head__eyebrow">${REGIONS[circuit.region].name} circuit</p>
      <h1>${circuit.name}</h1>
      <p class="page-head__lede">${circuit.blurb}</p>
    </div>

    ${networkMap(codes, legs, { title: `${circuit.name} map` })}

    ${legs.map((route) => {
      const dates = nextOperatingDates(route, start, 3);
      const flight = dates.length ? buildFlight(route, dates[0]) : null;
      return html`
        <section class="section" style="margin-top:var(--s5)">
          <div class="section__head">
            <h2>NW${route.number} — ${route.name}</h2>
          </div>
          <div class="card">
            <p class="option__note" style="margin-bottom:var(--s3)">
              ${aircraftType(route.aircraft).name} ·
              ${route.days.map((d) => WEEKDAYS_SHORT[d - 1]).join(', ')}${route.cadence !== 'weekly' ? `, ${route.cadence} weeks` : ', weekly'} ·
              next ${dates.map((d) => formatDate(d, 'short')).join(', ') || 'not scheduled'}
            </p>
            ${route.note ? html`<p class="option__note" style="margin-bottom:var(--s3)">${route.note}</p>` : ''}

            ${flight ? html`
              <div class="circuit">
                ${route.stops.map((code, index) => {
                  const place = airport(code);
                  const arriveLeg = index > 0 ? flight.legs[index - 1] : null;
                  const departLeg = index < flight.legs.length ? flight.legs[index] : null;
                  const arrive = arriveLeg ? localClock(place, arriveLeg.arriveUtc) : null;
                  const depart = departLeg ? localClock(place, departLeg.departUtc) : null;
                  return html`
                    <div class="circuit__stop">
                      <span class="circuit__marker"><span class="circuit__line"></span><span class="circuit__dot"></span></span>
                      <span>
                        <span class="circuit__name">${place.name}</span>
                        <span class="circuit__meta">
                          ${code} · ${place.runway} m ${place.surface}
                          ${arriveLeg ? ` · ${arriveLeg.distanceKm} km from ${airport(route.stops[index - 1]).name}` : ''}
                        </span>
                      </span>
                      <span class="circuit__time">
                        ${arrive && depart ? `${arrive} – ${depart}` : depart ? `dep ${depart}` : `arr ${arrive}`}
                      </span>
                    </div>`;
                })}
              </div>
              <p class="option__note" style="margin-top:var(--s3)">
                Total ${formatDuration(Math.round((flight.arriveUtc - flight.departUtc) / 60000))} from
                ${airport(route.stops[0]).name} to ${airport(route.stops.at(-1)).name},
                ${flight.legs.reduce((sum, leg) => sum + leg.distanceKm, 0)} km, all times local at each stop.
              </p>` : ''}
          </div>
        </section>`;
    })}

    <p style="margin-top:var(--s5)"><a class="btn btn--primary" href="${href('/book')}">Book a seat on a circuit</a></p>`;

  return { title: circuit.name, body };
}

/* ── One community ───────────────────────────────────────────────────────── */

export function communityView({ params }) {
  const code = params.code.toUpperCase();
  let place;
  try { place = airport(code); } catch { return { title: 'Not found', body: empty('No such community', 'Choose one from the network list.') }; }

  const serving = routes.filter((r) => r.stops.includes(code));
  const destinations = [...new Set(serving.flatMap((route) => {
    const index = route.stops.indexOf(code);
    return route.stops.slice(index + 1);
  }))];
  const start = today();

  const body = html`
    <div class="page-head">
      <p class="page-head__eyebrow">${REGIONS[place.region].name}</p>
      <h1>${place.name}</h1>
      <p class="page-head__lede">
        ${place.airport} · ${code} · ${place.runway} m ${place.surface} runway ·
        population ${place.population.toLocaleString('en-CA')}${place.also ? ` · formerly ${place.also}` : ''}
        ${place.noDst ? ' · stays on Eastern Standard Time all year' : ''}
      </p>
    </div>

    <section class="section">
      <div class="section__head"><h2>Services calling here</h2></div>
      <div class="stack stack--tight">
        ${serving.map((route) => {
          const dates = nextOperatingDates(route, start, 2);
          return html`
            <div class="card">
              <div class="row row--between">
                <div class="grow">
                  <div class="option__title">
                    <span class="brand-dot brand-dot--${route.brand}"></span>
                    NW${route.number} — ${route.name}
                  </div>
                  <div class="option__note">
                    ${aircraftType(route.aircraft).name} ·
                    ${route.days.map((d) => WEEKDAYS_SHORT[d - 1]).join(' ')}${route.cadence !== 'weekly' ? ` · ${route.cadence} weeks` : ''}
                  </div>
                </div>
                <div class="option__note" style="text-align:right">
                  ${dates.map((d) => formatDate(d, 'short')).join('<br>') ? raw(dates.map((d) => formatDate(d, 'short')).join('<br>')) : 'not scheduled'}
                </div>
              </div>
            </div>`;
        })}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>Reachable without a change</h2></div>
      <div class="chips">
        ${destinations.map((destination) => html`
          <a class="chip" href="${href(`/network/community/${destination}`)}">
            ${airport(destination).name}
            <span class="option__note">${distanceKm(code, destination)} km</span>
          </a>`)}
      </div>
    </section>

    <p style="margin-top:var(--s5)">
      <a class="btn btn--primary" href="${href('/book')}" data-action="search-from" data-code="${code}">
        Search flights from ${place.name}
      </a>
    </p>`;

  return {
    title: place.name,
    body,
    onMount: (root) => {
      on(root, 'click', '[data-action="search-from"]', (event, link) => {
        setSearch({ from: link.dataset.code });
      });
    },
  };
}
