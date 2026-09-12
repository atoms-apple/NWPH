/**
 * Flight status.
 *
 * Searchable by flight number or by route, and defaulting to a departure board
 * for the traveller's home community — which is what people actually open this
 * screen for on a weather day.
 */

import { html, raw, icon, on, $ } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState } from '../lib/store.js';
import { flightsOn, segment, flightStatus, buildFlight } from '../engine/schedule.js';
import { routes } from '../data/network.js';
import { airport, airportsByRegion } from '../data/airports.js';
import { brands } from '../data/brand.js';
import { today, addDays, formatDate, formatDuration, localClock } from '../lib/dates.js';
import { pageHead, note, empty, statusPill, legList } from './ui.js';

export function statusView({ query }) {
  const state = getState();
  const date = query.date ?? today();
  const code = (query.at ?? state.profile.homeAirport ?? 'YFB').toUpperCase();
  const flightQuery = (query.flight ?? '').trim().toUpperCase();

  const board = flightQuery ? byFlightNumber(flightQuery, date) : departureBoard(code, date);

  const body = html`
    ${pageHead('Flight status', 'What is flying, what is held, and why. On this network the reason is usually the weather.')}

    <form class="card" id="status-form" style="margin-bottom:var(--s4)">
      <div class="field-group field-group--2">
        <div class="field" style="margin:0">
          <label class="field__label" for="at">Community</label>
          <select class="select" id="at">
            ${airportsByRegion().map((group) => html`
              <optgroup label="${group.region.name}">
                ${group.airports.map((a) => html`
                  <option value="${a.code}" ${a.code === code ? raw('selected') : ''}>${a.name} — ${a.code}</option>`)}
              </optgroup>`)}
          </select>
        </div>
        <div class="field" style="margin:0">
          <label class="field__label" for="status-date">Date</label>
          <input class="input" type="date" id="status-date" value="${date}" min="${addDays(today(), -7)}" max="${addDays(today(), 120)}">
        </div>
      </div>
      <div class="field" style="margin:var(--s4) 0 0">
        <label class="field__label" for="flight">Or a flight number</label>
        <input class="input" id="flight" placeholder="NW500" value="${flightQuery}" autocomplete="off">
        <span class="field__hint">100s are Altitude jets, 300s Express, 500s the Connect circuits.</span>
      </div>
    </form>

    ${board}`;

  return {
    title: 'Flight status',
    body,
    onMount: (root) => {
      const at = $('#at', root);
      const dateInput = $('#status-date', root);
      const flight = $('#flight', root);
      const submit = () => go(href('/flights', {
        at: at.value, date: dateInput.value, flight: flight.value.trim() || null,
      }).slice(1));
      at.addEventListener('change', submit);
      dateInput.addEventListener('change', submit);
      $('#status-form', root).addEventListener('submit', (event) => { event.preventDefault(); submit(); });
      flight.addEventListener('change', submit);
    },
  };
}

/** Everything arriving at and departing from one community on a date. */
function departureBoard(code, date) {
  const place = airport(code);
  const flights = flightsOn(date);

  const departures = [];
  const arrivals = [];
  for (const flight of flights) {
    const index = flight.stops.indexOf(code);
    if (index === -1) continue;
    if (index < flight.stops.length - 1) {
      const seg = segment(flight, code, flight.stops[flight.stops.length - 1]);
      if (seg) departures.push(seg);
    }
    if (index > 0) {
      const seg = segment(flight, flight.stops[0], code);
      if (seg) arrivals.push(seg);
    }
  }
  departures.sort((a, b) => a.departUtc - b.departUtc);
  arrivals.sort((a, b) => a.arriveUtc - b.arriveUtc);

  if (!departures.length && !arrivals.length) {
    return empty(
      `Nothing scheduled at ${place.name}`,
      `No service calls at ${place.name} on ${formatDate(date, 'long')}. Most communities on this network see two or three services a week.`,
    );
  }

  return html`
    <p class="option__note" style="margin-bottom:var(--s3)">
      ${place.name} · ${formatDate(date, 'long')} · all times local
    </p>

    ${departures.length ? html`
      <section class="section">
        <div class="section__head"><h2>Departures</h2></div>
        <div class="stack stack--tight">${departures.map((seg) => boardRow(seg, 'departs'))}</div>
      </section>` : ''}

    ${arrivals.length ? html`
      <section class="section">
        <div class="section__head"><h2>Arrivals</h2></div>
        <div class="stack stack--tight">${arrivals.map((seg) => boardRow(seg, 'arrives'))}</div>
      </section>` : ''}`;
}

function boardRow(seg, mode) {
  const status = flightStatus(seg);
  const other = mode === 'departs' ? seg.to : seg.from;
  const time = mode === 'departs' ? seg.departLocal : seg.arriveLocal;

  return html`
    <div class="card">
      <div class="row" style="align-items:flex-start">
        <div style="min-width:4rem">
          <div class="tnum" style="font-size:var(--text-lg);font-weight:700">${time}</div>
          <div class="option__note">${seg.flightNumber}</div>
        </div>
        <div class="grow">
          <div class="option__title">
            ${mode === 'departs' ? 'To' : 'From'} ${airport(other).name}
          </div>
          <div class="option__note">
            <span class="brand-dot brand-dot--${seg.brand}"></span>
            ${brands[seg.brand].shortName} · ${seg.aircraftName}
            ${seg.via.length ? ` · via ${seg.via.map((c) => airport(c).name).join(', ')}` : ''}
          </div>
          ${status.reason ? html`<div class="option__note" style="margin-top:var(--s1)">${status.reason}</div>` : ''}
        </div>
        <div style="text-align:right">${statusPill(status)}</div>
      </div>
    </div>`;
}

/** One flight, end to end, with every stop it makes. */
function byFlightNumber(flightQuery, date) {
  const number = Number(flightQuery.replace(/[^0-9]/g, ''));
  const matches = routes.filter((route) => route.number === number);

  if (!matches.length) {
    return empty('No such flight', `${flightQuery} is not a North Winds flight number. Try NW100, NW300 or NW500.`);
  }

  return html`${matches.map((route) => {
    const operating = route.days.includes(new Date(`${date}T00:00:00Z`).getUTCDay() || 7);
    const flight = buildFlight(route, date);
    const whole = segment(flight, route.stops[0], route.stops[route.stops.length - 1]);
    const status = operating ? flightStatus(whole) : null;

    return html`
      <section class="section">
        <div class="card">
          <div class="row row--between" style="margin-bottom:var(--s3)">
            <div>
              <h2>NW${route.number}</h2>
              <p class="option__note">${route.name}</p>
            </div>
            ${status ? statusPill(status) : html`<span class="badge badge--outline">Not scheduled today</span>`}
          </div>
          <p class="option__note">
            <span class="brand-dot brand-dot--${route.brand}"></span>
            ${brands[route.brand].name} · ${flight.aircraftName} ·
            ${route.cadence === 'weekly' ? 'weekly' : route.cadence === 'even' ? 'even weeks' : 'odd weeks'}
          </p>
          ${operating ? html`<hr>${legList({ segments: [whole], connections: [] })}` : html`
            <div class="note" style="margin-top:var(--s3)">
              ${icon('info', { size: 18 })}
              <div>NW${route.number} does not operate on ${formatDate(date, 'long')}. It flies
              ${route.days.map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d - 1]).join(', ')}${route.cadence !== 'weekly' ? `, ${route.cadence} weeks only` : ''}.</div>
            </div>`}
        </div>
      </section>`;
  })}`;
}
