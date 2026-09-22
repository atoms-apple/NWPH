/**
 * Shared pieces of interface.
 *
 * A flight is drawn the same way in search results, in a booking, on the
 * status board and in a change quote. Keeping that one function means the
 * "+1 day" marker and the intermediate-stop line cannot be right in one place
 * and missing in another.
 */

import { html, raw, cx, icon, esc, on as onDelegate, announce } from '../lib/dom.js';
import { airport, airportsByRegion } from '../data/airports.js';
import { brands, fareFamilyById, fareTypes, passengerTypes } from '../data/brand.js';
import { money, moneyRounded } from '../engine/pricing.js';
import { formatDuration, formatDate, today as todayIso, addDays } from '../lib/dates.js';
import { href, go as goTo } from '../lib/router.js';
import { getState as getStoreState, setSearch as setStoreSearch, setCheckout as setStoreCheckout } from '../lib/store.js';

const escapeText = esc;

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

/* ── Generated skies ─────────────────────────────────────────────────────── */

/**
 * A gradient standing in for a photograph of a place.
 *
 * There is no photography to ship, and a stock image of "the Arctic" pinned to
 * a named community would be a lie about somewhere specific. What can be true
 * is the light: the gradient darkens with latitude and the aurora strengthens
 * with it, so Grise Fiord at 76°N reads darker than Iqaluit at 63°N, and the
 * southern gateways read as daylight.
 */
export function skyGradient(place) {
  const north = Math.max(0, Math.min(1, (place.lat - 45) / 32));
  const hue = 205 - north * 12;
  const top = `hsl(${hue} ${38 + north * 22}% ${Math.round(46 - north * 30)}%)`;
  const bottom = `hsl(${hue + 6} ${30 + north * 18}% ${Math.round(20 - north * 12)}%)`;
  const aurora = `hsla(${162 - north * 6} 62% 52% / ${(0.06 + north * 0.30).toFixed(2)})`;
  return `radial-gradient(120% 90% at 22% 0%, ${aurora}, transparent 60%), linear-gradient(165deg, ${top}, ${bottom})`;
}

/* ── The booking widget ──────────────────────────────────────────────────── */

const widgetAirportOptions = (selected) => airportsByRegion().map((group) => html`
  <optgroup label="${group.region.name}">
    ${group.airports.map((a) => html`
      <option value="${a.code}" ${a.code === selected ? raw('selected') : ''}>
        ${a.name}${a.also ? ` (${a.also})` : ''} — ${a.code}
      </option>`)}
  </optgroup>`);

/**
 * The search form that appears on the home page and at the top of /book.
 *
 * One component rather than two, so the home page's widget cannot quietly
 * diverge from the real search form and send someone into a different query
 * from the one they filled in.
 */
export function searchWidget(search, { compact = false } = {}) {
  const earliest = todayIso();
  const departDate = search.departDate && search.departDate >= earliest ? search.departDate : addDays(earliest, 7);
  const returnDate = search.returnDate && search.returnDate > departDate ? search.returnDate : addDays(departDate, 7);
  const paxTotal = passengerTypes.reduce((n, t) => n + (search.passengers[t.id] ?? 0), 0);

  return html`
    <div class="book-widget__tabs" role="tablist" aria-label="What to book">
      ${[['flights', 'Flights'], ['cargo', 'Cargo'], ['charter', 'Charter']].map(([id, label], index) => html`
        <button type="button" class="book-widget__tab" role="tab" data-widget-tab="${id}"
          aria-selected="${index === 0}" aria-controls="widget-${id}">${label}</button>`)}
    </div>

    <form id="widget-flights" data-widget-panel="flights" role="tabpanel" novalidate>
      <div class="chips" style="margin-bottom:var(--s4)" role="radiogroup" aria-label="Trip type">
        ${[['return', 'Return'], ['oneway', 'One way'], ['multi', 'Multi-city']].map(([value, label]) => html`
          <button type="button" class="chip ${search.tripType === value ? 'is-active' : ''}"
            role="radio" aria-checked="${search.tripType === value}" data-trip="${value}">${label}</button>`)}
      </div>

      <div class="field-group field-group--2">
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-from">Leaving from</label>
          <select class="select" id="w-from" name="from">${widgetAirportOptions(search.from)}</select>
        </div>
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-to">Going to</label>
          <select class="select" id="w-to" name="to">${widgetAirportOptions(search.to)}</select>
        </div>
      </div>

      <p style="margin:0 0 var(--s3)">
        <button type="button" class="btn btn--ghost btn--sm" data-action="w-swap">
          ${icon('swap', { size: 16 })} Swap
        </button>
      </p>

      <div class="field-group field-group--2">
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-depart">Departing</label>
          <input class="input" type="date" id="w-depart" name="depart" value="${departDate}"
            min="${earliest}" max="${addDays(earliest, 330)}">
        </div>
        <div class="field" id="w-return-field" style="margin-bottom:var(--s3)" ${search.tripType !== 'return' ? raw('hidden') : ''}>
          <label class="field__label" for="w-return">Returning</label>
          <input class="input" type="date" id="w-return" name="return" value="${returnDate}"
            min="${departDate}" max="${addDays(earliest, 340)}">
        </div>
      </div>

      <div class="field-group field-group--2">
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-pax">Travellers</label>
          <select class="select" id="w-pax" name="pax">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`
              <option value="${n}" ${n === Math.max(1, paxTotal) ? raw('selected') : ''}>
                ${n} traveller${n > 1 ? 's' : ''}
              </option>`)}
          </select>
        </div>
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-faretype">Fare type</label>
          <select class="select" id="w-faretype" name="fareType">
            ${fareTypes.map((type) => html`
              <option value="${type.id}" ${type.id === search.fareType ? raw('selected') : ''}>
                ${type.name}${type.discount ? ` — ${Math.round(type.discount * 100)}% off` : ''}
              </option>`)}
          </select>
        </div>
      </div>

      <p class="field__error" id="w-error" hidden></p>

      <div class="row row--wrap" style="gap:var(--s3);margin-top:var(--s2)">
        <button class="btn btn--accent btn--lg grow" type="submit">
          ${icon('search', { size: 18 })} Search flights
        </button>
        ${compact ? '' : html`
          <a class="btn btn--secondary" href="${href('/book/calendar')}">${icon('calendar', { size: 16 })} Low-fare calendar</a>`}
      </div>
    </form>

    <form id="widget-cargo" data-widget-panel="cargo" role="tabpanel" hidden novalidate>
      <div class="field-group field-group--2">
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-cargo-from">Shipping from</label>
          <select class="select" id="w-cargo-from" name="from">${widgetAirportOptions(search.from)}</select>
        </div>
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-cargo-to">Shipping to</label>
          <select class="select" id="w-cargo-to" name="to">${widgetAirportOptions(search.to)}</select>
        </div>
      </div>
      <div class="field" style="margin-bottom:var(--s3)">
        <label class="field__label" for="w-cargo-weight">Weight (kg)</label>
        <input class="input tnum" type="number" id="w-cargo-weight" name="weight" value="50" min="1" max="12000" inputmode="numeric">
      </div>
      <button class="btn btn--accent btn--lg btn--block" type="submit">
        ${icon('cargo', { size: 18 })} Get a freight quote
      </button>
    </form>

    <form id="widget-charter" data-widget-panel="charter" role="tabpanel" hidden novalidate>
      <div class="field-group field-group--2">
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-charter-from">From</label>
          <select class="select" id="w-charter-from" name="from">${widgetAirportOptions(search.from)}</select>
        </div>
        <div class="field" style="margin-bottom:var(--s3)">
          <label class="field__label" for="w-charter-to">To</label>
          <select class="select" id="w-charter-to" name="to">${widgetAirportOptions(search.to)}</select>
        </div>
      </div>
      <p class="field__hint" style="margin-bottom:var(--s3)">
        Five types, from a nine-seat King Air to the 737 combi. We quote the aircraft that can
        actually use both strips.
      </p>
      <button class="btn btn--accent btn--lg btn--block" type="submit">
        ${icon('plane', { size: 18 })} See charter options
      </button>
    </form>`;
}

/** Wire the widget up. Safe to call on a screen that has no widget. */
export function wireSearchWidget(root) {
  const flights = root.querySelector('[data-widget-panel="flights"]');
  if (!flights) return;

  const show = (id) => {
    root.querySelectorAll('[data-widget-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.widgetPanel !== id;
    });
    root.querySelectorAll('[data-widget-tab]').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.widgetTab === id));
    });
  };
  onDelegate(root, 'click', '[data-widget-tab]', (event, tab) => show(tab.dataset.widgetTab));

  const search = { ...getStoreState().search };

  onDelegate(root, 'click', '[data-trip]', (event, button) => {
    search.tripType = button.dataset.trip;
    root.querySelectorAll('[data-trip]').forEach((b) => {
      const on = b.dataset.trip === search.tripType;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    const returnField = root.querySelector('#w-return-field');
    if (returnField) returnField.hidden = search.tripType !== 'return';
  });

  onDelegate(root, 'click', '[data-action="w-swap"]', () => {
    const from = flights.from.value;
    flights.from.value = flights.to.value;
    flights.to.value = from;
    announce(`Now searching ${airport(flights.from.value).name} to ${airport(flights.to.value).name}`);
  });

  flights.addEventListener('change', (event) => {
    if (event.target.id !== 'w-depart') return;
    const back = root.querySelector('#w-return');
    if (!back) return;
    back.min = event.target.value;
    if (back.value < event.target.value) back.value = event.target.value;
  });

  flights.addEventListener('submit', (event) => {
    event.preventDefault();
    const error = root.querySelector('#w-error');
    const fail = (message) => {
      error.hidden = false;
      error.innerHTML = `<span>${escapeText(message)}</span>`;
      announce(message);
    };

    if (flights.from.value === flights.to.value) return fail('Choose two different communities.');
    if (search.tripType === 'multi') {
      setStoreSearch({ from: flights.from.value, to: flights.to.value, departDate: flights.depart.value });
      goTo('/book/multi-city');
      return;
    }
    error.hidden = true;

    setStoreSearch({
      tripType: search.tripType,
      from: flights.from.value,
      to: flights.to.value,
      departDate: flights.depart.value,
      returnDate: search.tripType === 'return' ? flights.return.value : null,
      fareType: flights.fareType.value,
      passengers: { adult: Number(flights.pax.value), child: 0, infant: 0 },
    });
    setStoreCheckout(null);
    goTo('/book/results');
  });

  const cargo = root.querySelector('[data-widget-panel="cargo"]');
  cargo?.addEventListener('submit', (event) => {
    event.preventDefault();
    goTo(`/cargo/quote?from=${cargo.from.value}&to=${cargo.to.value}&weight=${cargo.weight.value}`);
  });

  const charter = root.querySelector('[data-widget-panel="charter"]');
  charter?.addEventListener('submit', (event) => {
    event.preventDefault();
    goTo(`/charter/quote?from=${charter.from.value}&to=${charter.to.value}`);
  });
}
