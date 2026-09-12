/**
 * Shared pieces of interface.
 *
 * A flight is drawn the same way in search results, in a booking, on the
 * status board and in a change quote. Keeping that one function means the
 * "+1 day" marker and the intermediate-stop line cannot be right in one place
 * and missing in another.
 */

import { html, raw, cx, icon, esc } from '../lib/dom.js';
import { airport } from '../data/airports.js';
import { brands, fareFamilyById } from '../data/brand.js';
import { money, moneyRounded } from '../engine/pricing.js';
import { formatDuration, formatDate } from '../lib/dates.js';
import { href } from '../lib/router.js';

/* ── Small parts ─────────────────────────────────────────────────────────── */

export const brandBadge = (id) => html`
  <span class="badge badge--${id}"><span class="brand-dot brand-dot--${id}"></span>${brands[id].shortName}</span>`;

export const brandDot = (id) => html`<span class="brand-dot brand-dot--${id}"></span>`;

/** '+1' after an arrival time that lands on a later day. */
const dayMarker = (offset) => (offset > 0
  ? html`<span class="journey__day" title="Arrives ${offset} day${offset > 1 ? 's' : ''} later">+${offset}</span>`
  : '');

export const placeName = (code) => {
  const a = airport(code);
  return a.also ? `${a.name} (${a.also})` : a.name;
};

/**
 * The headline line of a journey: depart, elapsed, arrive.
 *
 * `stops` counts changes of aircraft; `via` counts the stops made with the
 * passenger aboard. They are labelled differently because on this network they
 * mean completely different things to the traveller.
 */
export function journeyLine(itinerary) {
  const from = airport(itinerary.from);
  const to = airport(itinerary.to);
  const changes = itinerary.stops;
  const through = itinerary.intermediateStops ?? 0;

  const marks = [];
  const totalPoints = changes + through;
  for (let i = 1; i <= totalPoints; i++) {
    marks.push(html`<span class="journey__stop" style="left:${Math.round((i / (totalPoints + 1)) * 100)}%"></span>`);
  }

  const stopLabel = changes === 0 && through === 0
    ? html`<span class="journey__stops journey__stops--nonstop">Nonstop</span>`
    : html`<span class="journey__stops">${[
        changes ? `${changes} change${changes > 1 ? 's' : ''}` : null,
        through ? `${through} stop${through > 1 ? 's' : ''} en route` : null,
      ].filter(Boolean).join(' · ')}</span>`;

  return html`
    <div class="journey">
      <div class="journey__point">
        <div class="journey__time tnum">${itinerary.departLocal}</div>
        <div class="journey__code">${itinerary.from}</div>
        <div class="journey__place">${from.name}</div>
      </div>
      <div class="journey__rail">
        <div class="journey__duration">${formatDuration(itinerary.elapsedMinutes)}</div>
        <div class="journey__line">${marks}</div>
        ${stopLabel}
      </div>
      <div class="journey__point journey__point--end">
        <div class="journey__time tnum">${itinerary.arriveLocal}${dayMarker(
          itinerary.arriveDate && itinerary.departDate
            ? Math.round((new Date(`${itinerary.arriveDate}T00:00:00Z`) - new Date(`${itinerary.departDate}T00:00:00Z`)) / 86400000)
            : 0,
        )}</div>
        <div class="journey__code">${itinerary.to}</div>
        <div class="journey__place">${to.name}</div>
      </div>
    </div>`;
}

/**
 * Segment-by-segment detail — the itinerary as an agent would read it out.
 *
 * Intermediate stops are shown as their own dots because on a milk run they are
 * the point: someone reading this wants to know the aircraft sets down at
 * Igloolik whether or not they are getting off there.
 */
export function legList(itinerary, { showAircraft = true } = {}) {
  const rows = [];
  itinerary.segments.forEach((seg, index) => {
    const origin = airport(seg.from);
    const destination = airport(seg.to);

    rows.push(html`
      <div class="leg">
        <div class="leg__time tnum">${seg.departLocal}</div>
        <div class="leg__rail"><span class="leg__dot leg__dot--end"></span><span class="leg__track"></span></div>
        <div>
          <div class="leg__place">${origin.name} <span class="journey__code">${seg.from}</span></div>
          <div class="leg__meta">
            ${seg.flightNumber} · ${brands[seg.brand].shortName}${showAircraft ? html` · ${seg.aircraftName}` : ''}
          </div>
        </div>
      </div>`);

    for (const viaCode of seg.via) {
      rows.push(html`
        <div class="leg">
          <div class="leg__time"></div>
          <div class="leg__rail"><span class="leg__dot leg__dot--via"></span><span class="leg__track leg__track--dashed"></span></div>
          <div class="leg__meta">Stops at ${airport(viaCode).name} <span class="journey__code">${viaCode}</span> — stay aboard</div>
        </div>`);
    }

    const last = index === itinerary.segments.length - 1;
    rows.push(html`
      <div class="leg">
        <div class="leg__time tnum">${seg.arriveLocal}</div>
        <div class="leg__rail"><span class="leg__dot leg__dot--end"></span>${last ? '' : html`<span class="leg__track"></span>`}</div>
        <div>
          <div class="leg__place">${destination.name} <span class="journey__code">${seg.to}</span></div>
          ${seg.dayOffset > 0 ? html`<div class="leg__meta">Arrives ${formatDate(seg.arriveDate, 'short')}</div>` : ''}
        </div>
      </div>`);

    const connection = itinerary.connections?.[index];
    if (connection) {
      rows.push(html`
        <div class="${cx('leg__connection', { 'leg__connection--overnight': connection.overnight })}">
          ${icon(connection.overnight ? 'clock' : 'swap', { size: 16 })}
          <span>${connection.overnight ? 'Overnight in' : 'Change at'} ${airport(connection.at).name} —
          ${formatDuration(connection.minutes)}${connection.overnight ? '. Accommodation is not included.' : ''}</span>
        </div>`);
    }
  });

  return html`<div class="legs">${rows}</div>`;
}

/** A whole itinerary as a card, optionally as a button that selects it. */
export function flightCard(result, { action = null, selected = false, footer = null } = {}) {
  const { itinerary, cheapest } = result;
  const lead = itinerary.leadBrand;
  const tag = action ? 'button' : 'div';

  const brandLine = html`
    <div class="flight-card__brand flight-card__brand--${lead}">
      ${itinerary.brands.map((b) => brandBadge(b))}
      ${itinerary.multiBrand ? html`<span class="badge badge--outline">One booking</span>` : ''}
      <span class="grow"></span>
      <span>${itinerary.segments.map((s) => s.flightNumber).join(' · ')}</span>
    </div>`;

  const body = html`
    <div class="flight-card__body">${journeyLine(itinerary)}</div>
    ${cheapest || footer ? html`
      <div class="flight-card__foot">
        ${footer ?? html`
          <span class="badge badge--outline">${fareFamilyById[cheapest.family].name} and up</span>
          <span class="fare-from">
            <span class="fare-from__label">from</span>
            <span class="fare-from__amount">${moneyRounded(cheapest.total)}</span>
            <span class="fare-from__each">total, all charges in</span>
          </span>`}
      </div>` : ''}`;

  if (tag === 'button') {
    return html`
      <button type="button" class="${cx('card', 'card--flush', 'flight-card', 'card-button', { 'is-selected': selected })}"
        ${raw(action)} aria-pressed="${selected ? 'true' : 'false'}">
        ${brandLine}${body}
      </button>`;
  }
  return html`<div class="card card--flush flight-card">${brandLine}${body}</div>`;
}

/* ── Money ───────────────────────────────────────────────────────────────── */

/** The price breakdown, line for line, the way a receipt reads. */
export function priceBreakdown(price, { title = 'Price breakdown', open = false } = {}) {
  const line = (label, amount, options = {}) => html`
    <div class="${cx('price-line', { 'price-line--muted': options.muted })}">
      <dt>${label}</dt><dd>${money(amount)}</dd>
    </div>`;

  return html`
    <details class="disclosure" ${open ? raw('open') : ''}>
      <summary>${title}<span class="tnum">${money(price.total)}</span></summary>
      <div class="disclosure__body">
        <dl class="price-lines">
          ${price.lines.map((l) => line(
            `${l.label}${l.count > 1 ? ` × ${l.count}` : ''} — base fare`, l.fare))}
          ${price.fuel ? line('Fuel surcharge', price.fuel, { muted: true }) : ''}
          ${price.navCanada ? line('NAV CANADA service charge', price.navCanada, { muted: true }) : ''}
          ${price.aif ? line('Airport improvement fee', price.aif, { muted: true }) : ''}
          ${price.atsc ? line('Air travellers security charge', price.atsc, { muted: true }) : ''}
          ${price.seats ? line('Advance seat selection', price.seats) : ''}
          ${price.extraLines?.map((e) => line(`${e.name}${e.quantity > 1 ? ` × ${e.quantity}` : ''}`, e.amount))}
          ${price.gst ? line('GST (5%)', price.gst, { muted: true }) : ''}
          <div class="price-line price-line--total"><dt>Total</dt><dd>${money(price.total)}</dd></div>
        </dl>
      </div>
    </details>`;
}

/* ── Page furniture ──────────────────────────────────────────────────────── */

export const pageHead = (title, lede, eyebrow = null) => html`
  <div class="page-head">
    ${eyebrow ? html`<p class="page-head__eyebrow">${eyebrow}</p>` : ''}
    <h1>${title}</h1>
    ${lede ? html`<p class="page-head__lede">${lede}</p>` : ''}
  </div>`;

export const note = (body, { kind = 'info', title = null, iconName = null } = {}) => html`
  <div class="note note--${kind}">
    ${icon(iconName ?? (kind === 'warn' ? 'warning' : kind === 'danger' ? 'warning' : kind === 'ok' ? 'check' : 'info'), { size: 18 })}
    <div>${title ? html`<strong>${title}</strong>` : ''}${body}</div>
  </div>`;

export const empty = (title, body, action = null) => html`
  <div class="empty">
    <h2>${title}</h2>
    <p>${body}</p>
    ${action ?? ''}
  </div>`;

/** Progress through the booking flow. */
export function steps(current) {
  const all = [
    { id: 'search', label: 'Search' },
    { id: 'flights', label: 'Flights' },
    { id: 'fare', label: 'Fare' },
    { id: 'travellers', label: 'Who' },
    { id: 'seats', label: 'Seats' },
    { id: 'extras', label: 'Extras' },
    { id: 'pay', label: 'Pay' },
  ];
  const index = all.findIndex((s) => s.id === current);
  return html`
    <ol class="steps" aria-label="Booking progress">
      ${all.map((step, i) => html`
        <li data-state="${i < index ? 'done' : i === index ? 'current' : 'todo'}"
            ${i === index ? raw('aria-current="step"') : ''}>
          <span class="steps__bar"></span>
          <span class="steps__label">${step.label}</span>
        </li>`)}
    </ol>`;
}

export const backLink = (to, label) => html`
  <p><a class="btn btn--ghost btn--sm" href="${href(to)}">${icon('back', { size: 16 })}${label}</a></p>`;

/** A status pill for a flight. */
export const statusPill = (status) => html`
  <span class="status-strip status-strip--${status.state}">
    ${status.state === 'cancelled' ? icon('close', { size: 14 }) : status.state === 'on-time' ? icon('check', { size: 14 }) : icon('clock', { size: 14 })}
    ${status.label}${status.delayMinutes ? ` — ${formatDuration(status.delayMinutes)}` : ''}
  </span>`;

export { money, moneyRounded, formatDuration, formatDate, esc, icon, html, raw, cx, href };
