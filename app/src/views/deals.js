/**
 * Seat sales, the low-fare calendar and booking with miles.
 *
 * A deal here is a fare that is genuinely below the norm for its own route,
 * measured against the median of comparable journeys on the same pairing over
 * six weeks — not simply the cheapest thing on the screen.
 */

import { html, raw, icon, on, $ } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState, setSearch, startCheckout, totalMiles } from '../lib/store.js';
import { allDeals } from '../engine/deals.js';
import { airport, airportsByRegion } from '../data/airports.js';
import { brandList, loyalty, fareFamilies } from '../data/brand.js';
import { searchItineraries, priceResults } from '../engine/search.js';
import { cheapestFamily, money, moneyRounded } from '../engine/pricing.js';
import { redemptionOptions, MILES_PER_DOLLAR } from '../engine/services.js';
import { today, addDays, daysBetween, formatDate, MONTHS, parseDate, isoDate } from '../lib/dates.js';
import { pageHead, note, empty, journeyLine, flightCard, legList } from './ui.js';

const airportOptions = (selected) => airportsByRegion().map((group) => html`
  <optgroup label="${group.region.name}">
    ${group.airports.map((a) => html`
      <option value="${a.code}" ${a.code === selected ? raw('selected') : ''}>${a.name} — ${a.code}</option>`)}
  </optgroup>`);

/* ── Seat sales ──────────────────────────────────────────────────────────── */

export function dealsView({ query }) {
  const brandFilter = query.brand || null;
  const deals = allDeals().filter((deal) => !brandFilter || deal.brand === brandFilter);

  const body = html`
    ${pageHead('Seat sales',
      'Fares meaningfully below the norm for their own route over the next six weeks. Measured against the median of comparable journeys on the same pairing, so a low price on a route that is always expensive does not count as a sale.')}

    <div class="chips" style="margin-bottom:var(--s6)">
      <button type="button" class="chip ${!brandFilter ? 'is-active' : ''}" data-deal-brand="">All lines</button>
      ${brandList.map((brand) => html`
        <button type="button" class="chip ${brandFilter === brand.id ? 'is-active' : ''}" data-deal-brand="${brand.id}">
          <span class="brand-dot brand-dot--${brand.id}"></span>${brand.shortName}
        </button>`)}
    </div>

    ${deals.length ? html`
      <div class="cards cards--wide">
        ${deals.map((deal) => html`
          <a class="deal" href="${href('/book/results', { from: deal.from, to: deal.to, date: deal.date })}">
            <span class="deal__tag">${deal.saving}% below typical</span>
            <span class="deal__route">${airport(deal.from).name} → ${airport(deal.to).name}</span>
            <span class="deal__note">
              ${formatDate(deal.date, 'long')} · ${deal.brandName}
              ${deal.stops ? ` · ${deal.stops} change` : ' · nonstop'}
            </span>
            <span class="deal__price">
              <span class="deal__from">from</span>
              <span class="deal__amount">${moneyRounded(deal.total)}</span>
              <span class="deal__was">${moneyRounded(deal.typical)}</span>
            </span>
            <span class="option__note" style="display:block;margin-top:var(--s2)">
              One adult, all charges in. ${fareFamilies.find((f) => f.id === deal.family)?.name} fare.
            </span>
          </a>`)}
      </div>` : empty('No sales on that line right now', 'Fares move with how full the aircraft are. Try another service line, or the low-fare calendar for a specific route.',
        html`<a class="btn btn--primary" href="${href('/book/calendar')}">Low-fare calendar</a>`)}

    ${note(html`
      <strong>Why a fare is low here is not a marketing decision.</strong>
      These are lightly-booked flights — the back half of a fortnight, the day after a circuit, a
      Tuesday in February. The fare falls because the aircraft is empty, and it rises again as it
      fills.`, { kind: 'info' })}`;

  return {
    title: 'Seat sales',
    body,
    onMount: (root) => {
      on(root, 'click', '[data-deal-brand]', (event, button) => {
        go(href('/deals', { brand: button.dataset.dealBrand || null }).slice(1));
      });
    },
  };
}

/* ── Low-fare calendar ───────────────────────────────────────────────────── */

/**
 * A month of fares on one route.
 *
 * On a network where most pairings fly two or three days a week, the useful
 * thing a calendar does is not comparing prices — it is showing which days
 * have a service at all.
 */
export function calendarView({ query }) {
  const state = getState();
  const from = (query.from ?? state.search.from).toUpperCase();
  const to = (query.to ?? state.search.to).toUpperCase();
  const anchor = query.month ?? today().slice(0, 7);

  const [year, month] = anchor.split('-').map(Number);
  const first = `${anchor}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (parseDate(first).getUTCDay() + 6) % 7;

  const cells = [];
  let cheapest = null;
  if (from !== to) {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${anchor}-${String(day).padStart(2, '0')}`;
      if (date < today()) { cells.push({ date, day, past: true }); continue; }
      const itineraries = searchItineraries(from, to, date, { maxStops: 1, maxResults: 4 });
      let best = null;
      for (const itinerary of itineraries) {
        const quote = cheapestFamily(itinerary, {
          passengers: { adult: 1 },
          fareType: state.search.fareType,
          daysAhead: Math.max(0, daysBetween(today(), date)),
        });
        if (quote && (!best || quote.total < best)) best = quote.total;
      }
      if (best !== null && (cheapest === null || best < cheapest)) cheapest = best;
      cells.push({ date, day, total: best, count: itineraries.length });
    }
  }

  const served = cells.filter((c) => c.total !== null && c.total !== undefined).length;

  const body = html`
    ${pageHead('Low-fare calendar',
      'A month of fares on one route. On this network the first thing it tells you is which days have a service at all.')}

    <form class="card" id="cal-form" style="margin-bottom:var(--s5)">
      <div class="field-group field-group--2">
        <div class="field" style="margin-bottom:0">
          <label class="field__label" for="cal-from">From</label>
          <select class="select" id="cal-from" name="from">${airportOptions(from)}</select>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="field__label" for="cal-to">To</label>
          <select class="select" id="cal-to" name="to">${airportOptions(to)}</select>
        </div>
      </div>
    </form>

    <div class="row row--between row--wrap" style="margin-bottom:var(--s4)">
      <a class="btn btn--secondary btn--sm" href="${href('/book/calendar', { from, to, month: shiftMonth(anchor, -1) })}"
        ${shiftMonth(anchor, -1) < today().slice(0, 7) ? raw('aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none"') : ''}>
        ${icon('back', { size: 16 })} ${MONTHS[(month - 2 + 12) % 12]}
      </a>
      <h2>${MONTHS[month - 1]} ${year}</h2>
      <a class="btn btn--secondary btn--sm" href="${href('/book/calendar', { from, to, month: shiftMonth(anchor, 1) })}">
        ${MONTHS[month % 12]} ${icon('forward', { size: 16 })}
      </a>
    </div>

    ${from === to ? note('Choose two different communities.', { kind: 'danger' }) : html`
      <p class="option__note" role="status" style="margin-bottom:var(--s3)">
        ${served} day${served === 1 ? '' : 's'} with a service this month${cheapest !== null ? ` · lowest ${moneyRounded(cheapest)}` : ''}
      </p>

      <div class="table-wrap">
        <table class="table table--fixed" style="min-width:34rem">
          <caption>
            ${airport(from).name} to ${airport(to).name}, ${MONTHS[month - 1]} ${year}. Lowest one-adult
            fare, all charges included.
          </caption>
          <thead>
            <tr>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => html`<th class="num">${d}</th>`)}</tr>
          </thead>
          <tbody>
            ${weeks(cells, leading).map((week) => html`
              <tr>
                ${week.map((cell) => {
                  if (!cell) return html`<td></td>`;
                  if (cell.past) return html`<td style="opacity:.35"><span class="tnum">${cell.day}</span></td>`;
                  const isCheapest = cell.total !== null && cell.total === cheapest;
                  return html`
                    <td style="padding:0">
                      ${cell.total ? html`
                        <a href="${href('/book/results', { from, to, date: cell.date })}"
                           style="display:block;padding:var(--s2);text-decoration:none;border-radius:var(--radius-sm);${isCheapest ? 'background:var(--aurora-soft)' : ''}">
                          <span class="tnum option__note" style="display:block">${cell.day}</span>
                          <span class="tnum" style="font-weight:700;font-size:var(--text-sm);color:${isCheapest ? 'var(--aurora-deep)' : 'var(--ink)'}">
                            ${moneyRounded(cell.total)}
                          </span>
                        </a>` : html`
                        <span style="display:block;padding:var(--s2)">
                          <span class="tnum option__note" style="display:block">${cell.day}</span>
                          <span class="option__note" style="font-size:var(--text-xs)">—</span>
                        </span>`}
                    </td>`;
                })}
              </tr>`)}
          </tbody>
        </table>
      </div>`}

    ${note(html`
      A dash means no service that day, not an expensive one. Most communities on this network see
      two or three flights a week and the Baffin circuits come round every other week.
      <a href="${href('/timetable', { at: from })}">See which days ${airport(from).name} flies</a>.`,
      { kind: 'info' })}`;

  return {
    title: 'Low-fare calendar',
    body,
    onMount: (root) => {
      const form = $('#cal-form', root);
      form.addEventListener('change', () => {
        go(href('/book/calendar', { from: form.from.value, to: form.to.value, month: anchor }).slice(1));
      });
    },
  };
}

const shiftMonth = (anchor, delta) => {
  const [year, month] = anchor.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return isoDate(date).slice(0, 7);
};

function weeks(cells, leading) {
  const flat = [...Array(leading).fill(null), ...cells];
  const out = [];
  for (let i = 0; i < flat.length; i += 7) {
    const week = flat.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    out.push(week);
  }
  return out;
}

/* ── Book with miles ─────────────────────────────────────────────────────── */

export function redeemView({ query }) {
  const state = getState();
  const miles = totalMiles();
  const from = (query.from ?? state.search.from).toUpperCase();
  const to = (query.to ?? state.search.to).toUpperCase();
  const date = query.date ?? addDays(today(), 21);

  const options = from === to ? [] : redemptionOptions(from, to, date, { fareType: state.search.fareType });

  const body = html`
    ${pageHead('Book with miles',
      `Any seat we would sell you, we will redeem. No blackout dates and no separate reward inventory — redemption is priced from the cash fare at ${MILES_PER_DOLLAR} miles to the dollar.`)}

    <div class="tier-card" style="margin-bottom:var(--s6)">
      <p class="tier-card__name">${loyalty.name}</p>
      <p class="tier-card__miles tnum">${miles.toLocaleString('en-CA')}<span style="font-size:var(--text-md);font-weight:500"> miles available</span></p>
      <p class="tier-card__next">Miles cover the base fare and fuel surcharge. Charges are paid in cash.</p>
    </div>

    <form class="card" id="redeem-form" style="margin-bottom:var(--s5)">
      <div class="field-group field-group--2">
        <div class="field">
          <label class="field__label" for="r-from">From</label>
          <select class="select" id="r-from" name="from">${airportOptions(from)}</select>
        </div>
        <div class="field">
          <label class="field__label" for="r-to">To</label>
          <select class="select" id="r-to" name="to">${airportOptions(to)}</select>
        </div>
      </div>
      <div class="field" style="margin-bottom:0">
        <label class="field__label" for="r-date">Date</label>
        <input class="input" type="date" id="r-date" name="date" value="${date}" min="${today()}" max="${addDays(today(), 330)}">
      </div>
    </form>

    ${from === to ? note('Choose two different communities.', { kind: 'danger' })
      : options.length ? html`
      <div class="stack">
        ${options.map(({ itinerary, quote }) => {
          const affordable = miles >= quote.miles;
          return html`
            <div class="card card--flush flight-card">
              <div class="flight-card__brand flight-card__brand--${itinerary.leadBrand}">
                ${itinerary.segments.map((s) => s.flightNumber).join(' · ')}
                <span class="grow"></span>
                ${affordable ? html`<span class="badge badge--aurora">You can book this</span>`
                  : html`<span class="badge badge--outline">${(quote.miles - miles).toLocaleString('en-CA')} miles short</span>`}
              </div>
              <div class="flight-card__body">${journeyLine(itinerary)}</div>
              <div class="flight-card__foot">
                <div>
                  <div style="font-size:var(--text-lg);font-weight:740" class="tnum">
                    ${quote.miles.toLocaleString('en-CA')} miles
                  </div>
                  <div class="option__note">plus ${money(quote.cash)} in charges</div>
                </div>
                <a class="btn ${affordable ? 'btn--accent' : 'btn--secondary'} btn--sm"
                   href="${href('/book/results', { from, to, date: itinerary.departDate })}">
                  ${affordable ? 'Book with miles' : 'Book with cash'}
                </a>
              </div>
            </div>`;
        })}
      </div>` : empty(
        'No service on that date',
        `${airport(from).name} to ${airport(to).name} is not flown every day. Pick another date above.`)}

    ${note(html`
      <strong>Redemption is not a separate booking flow in this prototype.</strong>
      The quotes above are real — priced from the cash fare at ${MILES_PER_DOLLAR} miles per dollar
      of base fare — but the booking itself completes as a cash purchase. Choosing a seat and paying
      in miles is the part that is not built.`, { kind: 'warn' })}`;

  return {
    title: 'Book with miles',
    body,
    onMount: (root) => {
      const form = $('#redeem-form', root);
      form.addEventListener('change', () => {
        go(href('/book/redeem', { from: form.from.value, to: form.to.value, date: form.date.value }).slice(1));
      });
    },
  };
}
