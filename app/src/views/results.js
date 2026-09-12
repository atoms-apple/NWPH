/**
 * Search results.
 *
 * A return trip is chosen one direction at a time — outbound, then inbound —
 * because on a network where the way back may be four days later on a different
 * service line, pairing them into combined round trips produces a list nobody
 * can read.
 *
 * When there is nothing on the chosen day the screen does not stop at "no
 * flights". Half this network flies two or three days a week, so the useful
 * answer is always the next date that works, and the app already knows it.
 */

import { html, raw, icon, on, $, $$, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState, setCheckout, getCheckout } from '../lib/store.js';
import { searchItineraries, priceResults, SORTS, fareCalendar, nextAvailableDate, serializeItinerary } from '../engine/search.js';
import { moneyRounded } from '../engine/pricing.js';
import { airport } from '../data/airports.js';
import { brandList } from '../data/brand.js';
import { today, daysBetween, formatDate, addDays } from '../lib/dates.js';
import { flightCard, pageHead, note, empty, steps, legList } from './ui.js';

/** Which direction we are choosing, and what has been chosen so far. */
function legContext() {
  const search = getState().search;
  const checkout = getCheckout();
  const wantsReturn = search.tripType === 'return' && search.returnDate;
  const leg = wantsReturn && checkout?.outbound ? 'inbound' : 'outbound';
  return {
    search,
    checkout,
    wantsReturn,
    leg,
    from: leg === 'outbound' ? search.from : search.to,
    to: leg === 'outbound' ? search.to : search.from,
    date: leg === 'outbound' ? search.departDate : search.returnDate,
  };
}

export default function resultsView({ query }) {
  const context = legContext();
  const { search, leg, from, to } = context;
  if (!search.departDate) return { redirect: '/book' };

  const date = query.date ?? context.date;
  const sortId = query.sort ?? 'departure';
  const brandFilter = query.brand || search.brand || null;
  const daysAhead = Math.max(0, daysBetween(today(), date));

  const options = { fareType: search.fareType, passengers: search.passengers, daysAhead };
  const itineraries = searchItineraries(from, to, date, { brand: brandFilter });
  const results = priceResults(itineraries, options).sort((SORTS[sortId] ?? SORTS.departure).compare);

  const calendar = fareCalendar(from, to, date, { span: 3, earliest: today(), ...options });
  const cheapest = results.length ? Math.min(...results.map((r) => r.cheapest.total)) : null;

  const body = html`
    ${steps('flights')}

    <div class="page-head">
      <p class="page-head__eyebrow">${context.wantsReturn ? (leg === 'outbound' ? 'Outbound — 1 of 2' : 'Return — 2 of 2') : 'One way'}</p>
      <h1>${airport(from).name} to ${airport(to).name}</h1>
      <p class="page-head__lede">${formatDate(date, 'long')} · ${paxSummary(search.passengers)}</p>
    </div>

    ${context.wantsReturn && leg === 'inbound' ? chosenOutbound(context) : ''}

    ${dateStrip(calendar, date, sortId, brandFilter)}

    ${results.length ? html`
      <div class="row row--between row--wrap" style="margin-bottom:var(--s3)">
        <p class="option__note" role="status">${results.length} option${results.length > 1 ? 's' : ''}${brandFilter ? ` on ${brandList.find((b) => b.id === brandFilter).shortName}` : ''}</p>
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
                ${result.cheapest.total === cheapest ? html`<span class="badge badge--ok">Lowest fare</span>` : html`<span></span>`}
                <span class="fare-from">
                  <span class="fare-from__label">from</span>
                  <span class="fare-from__amount">${moneyRounded(result.cheapest.total)}</span>
                  <span class="fare-from__each">${paxSummary(search.passengers)}, all in</span>
                </span>`,
            })}
            <details class="disclosure" style="margin-top:var(--s1)">
              <summary>Flight details</summary>
              <div class="disclosure__body">${legList(result.itinerary)}</div>
            </details>
          </div>`)}
      </div>` : noService(context, date, brandFilter)}`;

  return {
    title: `${airport(from).code} to ${airport(to).code}`,
    body,
    onMount: (root) => wire(root, { results, date, sortId, brandFilter, context }),
  };
}

const paxSummary = (passengers) => {
  const parts = [];
  if (passengers.adult) parts.push(`${passengers.adult} adult${passengers.adult > 1 ? 's' : ''}`);
  if (passengers.child) parts.push(`${passengers.child} child${passengers.child > 1 ? 'ren' : ''}`);
  if (passengers.infant) parts.push(`${passengers.infant} infant${passengers.infant > 1 ? 's' : ''}`);
  return parts.join(', ');
};

/** The outbound already chosen, shown small so the return has context. */
function chosenOutbound(context) {
  const outbound = context.checkout?.outboundSummary;
  if (!outbound) return '';
  return html`
    <div class="card card--sunken" style="margin-bottom:var(--s4)">
      <div class="row row--between">
        <div class="grow">
          <p class="option__note">Outbound chosen</p>
          <p class="option__title">${outbound.from} → ${outbound.to} · ${formatDate(outbound.date, 'short')} · ${outbound.departLocal}</p>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" data-action="reset-outbound">Change</button>
      </div>
    </div>`;
}

/** Seven days of cheapest fares — the reason to move a trip by a day. */
function dateStrip(calendar, current, sortId, brandFilter) {
  return html`
    <div class="date-strip" role="group" aria-label="Nearby dates">
      ${calendar.map((day) => html`
        <a class="date-strip__day ${day.date === current ? 'is-active' : ''} ${day.past || (!day.total && !day.past) ? 'is-empty' : ''}"
           href="${href('/book/results', { date: day.date, sort: sortId, brand: brandFilter })}"
           ${day.date === current ? raw('aria-current="date"') : ''}
           ${day.past ? raw('aria-disabled="true" tabindex="-1"') : ''}>
          <span class="date-strip__dow">${formatDate(day.date, 'short').split(' ')[0]}</span>
          <span class="date-strip__date tnum">${formatDate(day.date, 'compact')}</span>
          <span class="date-strip__fare tnum">${day.past ? '—' : day.total ? moneyRounded(day.total) : 'none'}</span>
        </a>`)}
    </div>`;
}

/** The screen shown when nothing flies that day — with the day that does. */
function noService(context, date, brandFilter) {
  const { from, to } = context;
  const next = nextAvailableDate(from, to, date, { brand: brandFilter });
  const anyLine = brandFilter ? searchItineraries(from, to, date).length : 0;

  return html`
    <div class="empty">
      <h2>No service on ${formatDate(date, 'long')}</h2>
      <p>
        ${airport(from).name} to ${airport(to).name} is not flown every day. That is normal on this
        network — most communities see two or three services a week, and the Baffin circuits come
        round every other week.
      </p>
      ${anyLine ? html`
        <p><strong>${anyLine} option${anyLine > 1 ? 's are' : ' is'} available on this date if you search all service lines.</strong></p>
        <a class="btn btn--secondary" href="${href('/book/results', { date })}">Search every line</a>` : ''}
      ${next ? html`
        <p style="margin-top:var(--s4)">The next departure is <strong>${formatDate(next, 'long')}</strong>.</p>
        <a class="btn btn--primary" href="${href('/book/results', { date: next })}">Show ${formatDate(next, 'short')}</a>` : html`
        <p style="margin-top:var(--s4)">Nothing is scheduled on this pairing in the next three weeks.
        Try routing through Iqaluit, Rankin Inlet or Cambridge Bay, or call reservations.</p>`}
      <p style="margin-top:var(--s4)"><a href="${href('/book')}">Change the search</a></p>
    </div>`;
}

function wire(root, { results, date, sortId, brandFilter, context }) {
  const sort = $('#sort', root);
  if (sort) {
    sort.addEventListener('change', () => {
      go(href('/book/results', { date, sort: sort.value, brand: brandFilter }).slice(1));
    });
  }

  on(root, 'click', '[data-filter]', (event, button) => {
    go(href('/book/results', { date, sort: sortId, brand: button.dataset.filter || null }).slice(1));
  });

  on(root, 'click', '[data-action="reset-outbound"]', () => {
    setCheckout({ outbound: null, outboundSummary: null });
    go('/book/results');
  });

  on(root, 'click', '[data-choose]', (event, button) => {
    const chosen = results.find((r) => r.itinerary.id === button.dataset.choose);
    if (!chosen) return;
    const refs = serializeItinerary(chosen.itinerary);
    const summary = {
      from: chosen.itinerary.from,
      to: chosen.itinerary.to,
      date: chosen.itinerary.departDate,
      departLocal: chosen.itinerary.departLocal,
    };

    if (context.leg === 'outbound') {
      setCheckout({
        search: context.search,
        outbound: refs,
        outboundSummary: summary,
        inbound: null,
        family: null,
        seats: {},
        extras: {},
      });
      if (context.wantsReturn) {
        announce('Outbound chosen. Now choose the return.');
        go('/book/results');
      } else {
        go('/book/fares');
      }
    } else {
      setCheckout({ inbound: refs, inboundSummary: summary });
      go('/book/fares');
    }
  });
}
