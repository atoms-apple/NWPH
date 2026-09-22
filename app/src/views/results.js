/**
 * Search results — one leg at a time.
 *
 * A return trip is chosen outbound, then inbound; a multi-city booking is
 * chosen flight by flight. On a network where the way back may be four days
 * later on a different service line, pairing directions into combined round
 * trips produces a list nobody can read.
 *
 * When nothing flies on the chosen day the screen does not stop at "no
 * flights". Half this network flies two or three days a week, so the useful
 * answer is always the next date that works, and the app already knows it.
 */

import { html, raw, icon, on, $, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState, getCheckout, startCheckout, chooseLeg, checkoutComplete } from '../lib/store.js';
import {
  searchItineraries, priceResults, SORTS, fareCalendar, nextAvailableDate, serializeItinerary, itineraryFromRefs,
} from '../engine/search.js';
import { moneyRounded } from '../engine/pricing.js';
import { airport } from '../data/airports.js';
import { brandList } from '../data/brand.js';
import { today, daysBetween, formatDate } from '../lib/dates.js';
import { flightCard, pageHead, note, empty, steps, legList, journeyLine } from './ui.js';

export default function resultsView({ query }) {
  const state = getState();
  let checkout = getCheckout();

  // Arriving here from a deal or a recent search starts a fresh checkout.
  if (query.from && query.to) {
    const search = {
      ...state.search,
      from: query.from.toUpperCase(),
      to: query.to.toUpperCase(),
      departDate: query.date ?? state.search.departDate,
      tripType: 'oneway',
      returnDate: null,
    };
    checkout = startCheckout(search);
    go('/book/results', { replace: true });
    return { redirect: '/book/results' };
  }

  if (!checkout?.legs?.length) {
    if (!state.search.departDate) return { redirect: '/book' };
    checkout = startCheckout(state.search);
  }

  const index = Number(query.leg ?? checkout.active ?? 0);
  const leg = checkout.legs[index];
  if (!leg) return { redirect: '/book' };

  const date = query.date ?? leg.date;
  const sortId = query.sort ?? 'departure';
  const brandFilter = query.brand || checkout.search.brand || null;
  const daysAhead = Math.max(0, daysBetween(today(), date));
  const passengers = checkout.search.passengers;

  const options = { fareType: checkout.search.fareType, passengers, daysAhead };
  const itineraries = searchItineraries(leg.from, leg.to, date, { brand: brandFilter });
  const results = priceResults(itineraries, options).sort((SORTS[sortId] ?? SORTS.departure).compare);
  const calendar = fareCalendar(leg.from, leg.to, date, { span: 3, earliest: today(), ...options });
  const cheapest = results.length ? Math.min(...results.map((r) => r.cheapest.total)) : null;

  const body = html`
    ${steps('flights')}

    ${checkout.legs.length > 1 ? legPicker(checkout, index) : ''}

    <div class="page-head">
      <p class="page-head__eyebrow">
        ${checkout.legs.length > 1 ? `${leg.label} — ${index + 1} of ${checkout.legs.length}` : 'One way'}
      </p>
      <h1>${airport(leg.from).name} to ${airport(leg.to).name}</h1>
      <p class="page-head__lede">${formatDate(date, 'long')} · ${paxSummary(passengers)}</p>
    </div>

    ${dateStrip(calendar, date, sortId, brandFilter, index)}

    ${results.length ? html`
      <div class="row row--between row--wrap" style="margin-bottom:var(--s3)">
        <p class="option__note" role="status">
          ${results.length} option${results.length > 1 ? 's' : ''}${brandFilter ? ` on ${brandList.find((b) => b.id === brandFilter).shortName}` : ''}
        </p>
        <div class="field" style="margin:0">
          <label class="visually-hidden" for="sort">Sort by</label>
          <select class="select" id="sort" style="min-height:40px;font-size:var(--text-sm)">
            ${Object.values(SORTS).map((sort) => html`
              <option value="${sort.id}" ${sort.id === sortId ? raw('selected') : ''}>${sort.label}</option>`)}
          </select>
        </div>
      </div>

      <div class="chips" style="margin-bottom:var(--s4)">
        <button type="button" class="chip ${!brandFilter ? 'is-active' : ''}" data-filter="">All lines</button>
        ${brandList.map((brand) => html`
          <button type="button" class="chip ${brandFilter === brand.id ? 'is-active' : ''}" data-filter="${brand.id}">
            <span class="brand-dot brand-dot--${brand.id}"></span>${brand.shortName}
          </button>`)}
      </div>

      <div class="stack">
        ${results.map((result) => html`
          <div>
            ${flightCard(result, {
              action: `data-choose="${result.itinerary.id}"`,
              footer: html`
                ${result.cheapest.total === cheapest ? html`<span class="badge badge--aurora">Lowest fare</span>` : html`<span></span>`}
                <span class="fare-from">
                  <span class="fare-from__label">from</span>
                  <span class="fare-from__amount">${moneyRounded(result.cheapest.total)}</span>
                  <span class="fare-from__each">${paxSummary(passengers)}, all in</span>
                </span>`,
            })}
            <details class="disclosure" style="margin-top:var(--s1)">
              <summary>Flight details</summary>
              <div class="disclosure__body">${legList(result.itinerary)}</div>
            </details>
          </div>`)}
      </div>` : noService(leg, date, brandFilter, index)}`;

  return {
    title: `${leg.from} to ${leg.to}`,
    body,
    onMount: (root) => wire(root, { results, date, sortId, brandFilter, index, checkout }),
  };
}

const paxSummary = (passengers) => {
  const parts = [];
  if (passengers.adult) parts.push(`${passengers.adult} adult${passengers.adult > 1 ? 's' : ''}`);
  if (passengers.child) parts.push(`${passengers.child} child${passengers.child > 1 ? 'ren' : ''}`);
  if (passengers.infant) parts.push(`${passengers.infant} infant${passengers.infant > 1 ? 's' : ''}`);
  return parts.join(', ');
};

/** Where you are in a multi-leg booking, and what has been chosen so far. */
function legPicker(checkout, active) {
  return html`
    <div class="card card--sunken" style="margin-bottom:var(--s5)">
      <div class="timeline">
        ${checkout.legs.map((leg, index) => {
          const chosen = checkout.journeys[index] ? itineraryFromRefs(checkout.journeys[index]) : null;
          return html`
            <div class="timeline__item ${chosen ? 'is-done' : ''}" style="padding-bottom:${index === checkout.legs.length - 1 ? '0' : 'var(--s5)'}">
              <span class="timeline__marker"><span class="timeline__line"></span><span class="timeline__dot"></span></span>
              <div class="row row--between row--wrap">
                <div class="grow">
                  <div class="timeline__title">
                    ${leg.label}: ${airport(leg.from).name} → ${airport(leg.to).name}
                  </div>
                  <div class="timeline__note">
                    ${chosen
                      ? `${chosen.segments.map((s) => s.flightNumber).join(' · ')} · ${formatDate(chosen.departDate, 'short')} · ${chosen.departLocal}`
                      : index === active ? 'Choosing now' : formatDate(leg.date, 'long')}
                  </div>
                </div>
                ${chosen && index !== active
                  ? html`<a class="btn btn--ghost btn--sm" href="${href('/book/results', { leg: index })}">Change</a>`
                  : ''}
              </div>
            </div>`;
        })}
      </div>
      ${checkoutComplete(checkout) ? html`
        <p style="margin:var(--s4) 0 0">
          <a class="btn btn--accent btn--block" href="${href('/book/fares')}">
            All flights chosen — continue to fares ${icon('forward', { size: 16 })}
          </a>
        </p>` : ''}
    </div>`;
}

/** Seven days of cheapest fares — the reason to move a trip by a day. */
function dateStrip(calendar, current, sortId, brandFilter, legIndex) {
  return html`
    <div class="date-strip" role="group" aria-label="Nearby dates">
      ${calendar.map((day) => html`
        <a class="date-strip__day ${day.date === current ? 'is-active' : ''} ${day.past || !day.total ? 'is-empty' : ''}"
           href="${href('/book/results', { leg: legIndex, date: day.date, sort: sortId, brand: brandFilter })}"
           ${day.date === current ? raw('aria-current="date"') : ''}
           ${day.past ? raw('aria-disabled="true" tabindex="-1"') : ''}>
          <span class="date-strip__dow">${formatDate(day.date, 'short').split(' ')[0]}</span>
          <span class="date-strip__date tnum">${formatDate(day.date, 'compact')}</span>
          <span class="date-strip__fare tnum">${day.past ? '—' : day.total ? moneyRounded(day.total) : 'none'}</span>
        </a>`)}
    </div>`;
}

/** The screen shown when nothing flies that day — with the day that does. */
function noService(leg, date, brandFilter, legIndex) {
  const next = nextAvailableDate(leg.from, leg.to, date, { brand: brandFilter });
  const anyLine = brandFilter ? searchItineraries(leg.from, leg.to, date).length : 0;

  return html`
    <div class="empty">
      <h2>No service on ${formatDate(date, 'long')}</h2>
      <p>
        ${airport(leg.from).name} to ${airport(leg.to).name} is not flown every day. That is normal
        on this network — most communities see two or three services a week, and the Baffin
        circuits come round every other week.
      </p>
      ${anyLine ? html`
        <p><strong>${anyLine} option${anyLine > 1 ? 's are' : ' is'} available if you search all service lines.</strong></p>
        <a class="btn btn--secondary" href="${href('/book/results', { leg: legIndex, date })}">Search every line</a>` : ''}
      ${next ? html`
        <p style="margin-top:var(--s4)">The next departure is <strong>${formatDate(next, 'long')}</strong>.</p>
        <a class="btn btn--accent" href="${href('/book/results', { leg: legIndex, date: next })}">
          Show ${formatDate(next, 'short')}
        </a>` : html`
        <p style="margin-top:var(--s4)">
          Nothing is scheduled on this pairing in the next three weeks. Try routing through Iqaluit,
          Rankin Inlet or Cambridge Bay, or <a href="${href('/contact')}">call reservations</a>.
        </p>`}
      <p style="margin-top:var(--s4)"><a href="${href('/book')}">Change the search</a></p>
    </div>`;
}

function wire(root, { results, date, sortId, brandFilter, index, checkout }) {
  const sort = $('#sort', root);
  sort?.addEventListener('change', () => {
    go(href('/book/results', { leg: index, date, sort: sort.value, brand: brandFilter }).slice(1));
  });

  on(root, 'click', '[data-filter]', (event, button) => {
    go(href('/book/results', { leg: index, date, sort: sortId, brand: button.dataset.filter || null }).slice(1));
  });

  on(root, 'click', '[data-choose]', (event, button) => {
    const chosen = results.find((r) => r.itinerary.id === button.dataset.choose);
    if (!chosen) return;
    const next = chooseLeg(index, serializeItinerary(chosen.itinerary));

    if (checkoutComplete(next)) {
      go('/book/fares');
    } else {
      announce(`${checkout.legs[index].label} chosen. Now choosing ${checkout.legs[next.active].label.toLowerCase()}.`);
      go(href('/book/results', { leg: next.active }).slice(1));
    }
  });
}
