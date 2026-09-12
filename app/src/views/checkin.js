/**
 * Check-in and boarding passes.
 *
 * The boarding pass is the one screen that has to work with no signal at all,
 * standing on gravel beside a Dash 8. It renders from data already on the
 * device, the service worker holds the shell, and nothing on it is fetched.
 *
 * The barcode is drawn from a real IATA BCBP (M1) string, printed beneath it
 * the way airlines print it. The bars are a representation, not a scannable
 * symbology — a prototype should not produce something a gate reader might act
 * on.
 */

import { html, raw, icon, on, $ } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { allBookings, findBooking, saveBooking } from '../lib/store.js';
import { hydrate, checkinWindow, checkIn, boardingDetail, bcbpString, CHECKIN_WINDOW_HOURS } from '../engine/booking.js';
import { flightStatus } from '../engine/schedule.js';
import { airport } from '../data/airports.js';
import { airline, fareFamilyById } from '../data/brand.js';
import { hash } from '../lib/random.js';
import { formatDate, formatDuration, localClock } from '../lib/dates.js';
import { journeyLine, pageHead, note, empty, statusPill } from './ui.js';

/* ── Start ───────────────────────────────────────────────────────────────── */

export function checkinStartView() {
  const bookings = allBookings().map(hydrate).filter((b) => b.status === 'confirmed' && !b.past);

  const rows = bookings.flatMap((booking) => booking.journeys.map((journey, index) => {
    const window = checkinWindow(journey);
    const checkedIn = Boolean(booking.checkedIn?.[index]);
    return { booking, journey, index, window, checkedIn };
  })).sort((a, b) => a.journey.departUtc - b.journey.departUtc);

  const body = html`
    ${pageHead('Check in', `Check-in opens ${CHECKIN_WINDOW_HOURS} hours before departure and closes 45 minutes before. Your boarding pass then works offline.`)}

    ${rows.length ? html`
      <div class="stack">
        ${rows.map(({ booking, journey, index, window, checkedIn }) => html`
          <div class="card">
            <div class="row row--between" style="margin-bottom:var(--s3)">
              <span class="option__note">${booking.reference} · ${journey.label}</span>
              ${statusPill(flightStatus(journey.segments[0]))}
            </div>
            ${journeyLine(journey)}
            <div class="btn-row" style="margin-top:var(--s4)">
              ${checkedIn
                ? html`<a class="btn btn--primary btn--sm" href="${href(`/pass/${booking.reference}/${index}/0`)}">
                    ${icon('ticket', { size: 16 })} Boarding pass</a>`
                : window.state === 'open'
                  ? html`<a class="btn btn--primary btn--sm" href="${href(`/checkin/${booking.reference}`)}">Check in now</a>`
                  : window.state === 'closed'
                    ? html`<span class="badge badge--danger">Check-in has closed — see an agent</span>`
                    : html`<span class="badge badge--outline">Opens ${formatDate(journey.departDate, 'compact')} at ${localClock(airport(journey.from), window.opens)}</span>`}
              <a class="btn btn--secondary btn--sm" href="${href(`/trips/${booking.reference}`)}">Booking</a>
            </div>
          </div>`)}
      </div>` : empty(
        'Nothing to check in for',
        'Bookings made in this app appear here once they are within 24 hours of departure.',
        html`<a class="btn btn--primary" href="${href('/book')}">Search flights</a>`)}

    <section class="section" style="margin-top:var(--s8)">
      <div class="card card--quiet">
        <h2 class="card__title">Before you get to the airport</h2>
        <ul style="margin:var(--s3) 0 0;color:var(--ink-2)">
          <li>Bag drop closes 45 minutes before departure at Iqaluit, Rankin Inlet and Cambridge Bay; 30 minutes at every other community.</li>
          <li>Photo identification is required on every flight, including within the territory.</li>
          <li>Firearms must be declared and cased. Ammunition travels separately.</li>
          <li>Country food in a sealed cooler is accepted as checked baggage, subject to the load.</li>
        </ul>
      </div>
    </section>`;

  return { title: 'Check in', body };
}

/* ── Checking in ─────────────────────────────────────────────────────────── */

export function checkinView({ params, query }) {
  const stored = findBooking(params.reference);
  if (!stored) {
    return { title: 'Not found', body: empty('Booking not found', 'That reference is not stored on this device.',
      html`<a class="btn btn--primary" href="${href('/checkin')}">Back to check-in</a>`) };
  }

  const booking = hydrate(stored);
  const index = Number(query.journey ?? booking.journeys.findIndex((j) => !booking.checkedIn?.[booking.journeys.indexOf(j)]));
  const journeyIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  const journey = booking.journeys[journeyIndex];
  const window = checkinWindow(journey);
  const status = flightStatus(journey.segments[0]);

  const body = html`
    ${pageHead('Check in', `${booking.reference} · ${journey.label} · ${formatDate(journey.departDate, 'long')}`)}

    <div class="card" style="margin-bottom:var(--s4)">
      ${journeyLine(journey)}
      <p style="margin-top:var(--s3)">${statusPill(status)}</p>
    </div>

    ${status.state === 'cancelled' ? note(html`
      <strong>This flight is cancelled — ${status.reason.toLowerCase()}.</strong>
      ${status.detail} Check-in is not available; you will be rebooked automatically.`, { kind: 'danger' })
      : window.state === 'not-yet' ? note(html`
        <strong>Check-in opens ${CHECKIN_WINDOW_HOURS} hours before departure.</strong>
        For this flight that is ${formatDate(journey.departDate, 'long')} at
        ${localClock(airport(journey.from), window.opens)} local time in ${airport(journey.from).name}.`, { kind: 'warn' })
      : window.state === 'closed' ? note(html`
        <strong>Check-in has closed for this flight.</strong>
        It closes 45 minutes before departure. See an agent at the counter.`, { kind: 'danger' })
      : ''}

    <section class="section">
      <div class="section__head"><h2>Travellers</h2></div>
      <div class="stack stack--tight">
        ${booking.passengers.map((passenger, i) => html`
          <div class="option" style="cursor:default">
            ${icon('user', { size: 18 })}
            <div class="option__body grow">
              <div class="option__title">${passenger.firstName} ${passenger.lastName}</div>
              <div class="option__note">
                ${passenger.type === 'infant' ? 'Infant on a lap — no seat, no boarding pass'
                  : seatFor(booking, journey, i) ? `Seat ${seatFor(booking, journey, i)}` : 'Seat assigned at check-in'}
              </div>
            </div>
          </div>`)}
      </div>
    </section>

    <section class="section">
      <div class="card card--quiet">
        <h2 class="card__title">Confirm before you check in</h2>
        <div class="option-list" style="margin-top:var(--s3)">
          <label class="option">
            <input type="checkbox" id="ack-id">
            <span class="option__body">
              <span class="option__title">Every traveller has photo identification</span>
              <span class="option__note">Required on all flights, including between communities.</span>
            </span>
          </label>
          <label class="option">
            <input type="checkbox" id="ack-dangerous">
            <span class="option__body">
              <span class="option__title">No undeclared dangerous goods</span>
              <span class="option__note">Fuel, aerosols, loose batteries and undeclared firearms may not be carried.</span>
            </span>
          </label>
        </div>
        <p class="field__error" id="checkin-error" hidden></p>
      </div>
    </section>

    ${booking.checkedIn?.[journeyIndex] ? html`
      ${note('You are already checked in for this flight.', { kind: 'ok' })}
      <div class="btn-row" style="margin-top:var(--s4)">
        <a class="btn btn--primary" href="${href(`/pass/${booking.reference}/${journeyIndex}/0`)}">View boarding pass</a>
      </div>`
      : html`
      <div class="action-bar">
        <div class="action-bar__total">
          <span class="action-bar__label">${journey.segments.length} flight${journey.segments.length > 1 ? 's' : ''}</span>
          <span class="action-bar__amount" style="font-size:var(--text-base)">${booking.passengers.filter((p) => p.type !== 'infant').length} boarding pass${booking.passengers.filter((p) => p.type !== 'infant').length > 1 ? 'es' : ''}</span>
        </div>
        <button class="btn btn--primary" type="button" data-action="checkin"
          ${window.state === 'open' && status.state !== 'cancelled' ? '' : raw('disabled')}>
          ${icon('check', { size: 18 })} Check in
        </button>
      </div>`}

    ${window.state === 'not-yet' ? html`
      <div class="card card--quiet" style="margin-top:var(--s4)">
        <p class="option__note">
          <strong>Prototype control.</strong> A real airline opens check-in 24 hours out. So that this
          flow can be walked through on any booking, you can open it early here.
        </p>
        <button class="btn btn--secondary btn--sm" type="button" data-action="force-checkin" style="margin-top:var(--s3)">
          Open check-in now
        </button>
      </div>` : ''}`;

  return {
    title: 'Check in',
    body,
    onMount: (root) => {
      const run = () => {
        const errorBox = $('#checkin-error', root);
        if (!$('#ack-id', root).checked || !$('#ack-dangerous', root).checked) {
          errorBox.hidden = false;
          errorBox.innerHTML = '<span>Confirm both statements above before checking in.</span>';
          return;
        }
        saveBooking(checkIn(stored, journeyIndex));
        window.nwToast?.('Checked in. Boarding passes are ready.', 'ok');
        go(`/pass/${booking.reference}/${journeyIndex}/0`);
      };
      on(root, 'click', '[data-action="checkin"]', run);
      on(root, 'click', '[data-action="force-checkin"]', run);
    },
  };
}

function seatFor(booking, journey, passengerIndex) {
  const seg = journey.segments[0];
  return booking.seats?.[seg.id]?.[passengerIndex] ?? null;
}

/* ── Boarding pass ───────────────────────────────────────────────────────── */

export function passView({ params }) {
  const stored = findBooking(params.reference);
  if (!stored) return { title: 'Not found', body: empty('Booking not found', 'That reference is not on this device.') };

  const booking = hydrate(stored);
  const journeyIndex = Number(params.journey) || 0;
  const passengerIndex = Number(params.passenger) || 0;
  const journey = booking.journeys[journeyIndex];
  if (!journey) return { title: 'Not found', body: empty('Flight not found', 'That leg is not on this booking.') };

  const seated = booking.passengers
    .map((p, i) => ({ ...p, index: i }))
    .filter((p) => p.type !== 'infant');
  const passenger = booking.passengers[passengerIndex];
  const family = fareFamilyById[booking.family.id];

  const body = html`
    ${seated.length > 1 ? html`
      <div class="chips" style="margin-bottom:var(--s4)">
        ${seated.map((p) => html`
          <a class="chip ${p.index === passengerIndex ? 'is-active' : ''}"
             href="${href(`/pass/${booking.reference}/${journeyIndex}/${p.index}`)}">${p.firstName}</a>`)}
      </div>` : ''}
    ${booking.journeys.length > 1 ? html`
      <div class="chips" style="margin-bottom:var(--s4)">
        ${booking.journeys.map((j, i) => html`
          <a class="chip ${i === journeyIndex ? 'is-active' : ''}"
             href="${href(`/pass/${booking.reference}/${i}/${passengerIndex}`)}">${j.label}</a>`)}
      </div>` : ''}

    <div class="stack stack--loose">
      ${journey.segments.map((seg) => boardingPass(booking, seg, passengerIndex, passenger, family))}
    </div>

    ${note(html`
      This pass is drawn from data stored on this device and needs no signal. The bar pattern is a
      representation — this is a prototype, and it is not a scannable boarding pass.`, { kind: 'warn' })}

    <div class="btn-row" style="margin-top:var(--s5)">
      <a class="btn btn--secondary" href="${href(`/trips/${booking.reference}`)}">Booking details</a>
      <button type="button" class="btn btn--secondary" data-action="print">Print</button>
    </div>`;

  return {
    title: 'Boarding pass',
    body,
    onMount: (root) => on(root, 'click', '[data-action="print"]', () => window.print()),
  };
}

function boardingPass(booking, seg, passengerIndex, passenger, family) {
  const detail = boardingDetail(seg, passengerIndex, booking);
  const seat = booking.seats?.[seg.id]?.[passengerIndex] ?? 'At gate';
  const bcbp = bcbpString(booking, seg, passengerIndex, detail);
  const status = flightStatus(seg);

  return html`
    <div class="pass">
      <div class="pass__head">
        <span class="pass__airline">${icon('wind', { size: 18 })} ${airline.shortName}</span>
        <span class="pass__flight">${seg.flightNumber}</span>
      </div>

      <div class="pass__route">
        <div>
          <div class="pass__code">${seg.from}</div>
          <div class="pass__city">${airport(seg.from).name}</div>
        </div>
        <div class="pass__arrow">${icon('plane', { size: 22 })}</div>
        <div style="text-align:right">
          <div class="pass__code">${seg.to}</div>
          <div class="pass__city">${airport(seg.to).name}</div>
        </div>
      </div>

      <dl class="pass__grid">
        <div class="pass__cell"><dt>Passenger</dt><dd style="font-size:var(--text-sm)">${passenger.lastName.toUpperCase()}/${passenger.firstName.toUpperCase()}</dd></div>
        <div class="pass__cell"><dt>Seat</dt><dd>${seat}</dd></div>
        <div class="pass__cell"><dt>Gate</dt><dd>${detail.gate}</dd></div>
        <div class="pass__cell"><dt>Zone</dt><dd>${detail.zone}</dd></div>
        <div class="pass__cell"><dt>Date</dt><dd style="font-size:var(--text-sm)">${formatDate(seg.departDate, 'compact')}</dd></div>
        <div class="pass__cell"><dt>Boards</dt><dd>${detail.boardingLocal}</dd></div>
        <div class="pass__cell"><dt>Departs</dt><dd>${seg.departLocal}</dd></div>
        <div class="pass__cell"><dt>Seq</dt><dd>${detail.sequence}</dd></div>
      </dl>

      ${seg.via.length ? html`
        <p class="pass__note">Calls at ${seg.via.map((code) => airport(code).name).join(', ')} en route. Stay aboard.</p>` : ''}
      ${status.state === 'delayed' ? html`
        <p class="pass__note" style="background:var(--warn-bg);color:var(--warn-text)">
          ${status.label}${status.reason ? ` — ${status.reason.toLowerCase()}` : ''}. Watch the board.</p>` : ''}

      <div class="pass__tear"></div>
      <div class="pass__barcode">
        <div class="pass__bars" aria-hidden="true">${bars(bcbp)}</div>
        <p class="pass__bcbp">${bcbp}</p>
      </div>
      <p class="pass__note">
        ${family.name} · ${booking.reference} · ${seg.aircraftName}${family.priorityBoarding ? ' · Priority boarding' : ''}
      </p>
    </div>`;
}

/** A bar pattern derived from the pass data — deterministic, decorative. */
function bars(seed) {
  const out = [];
  for (let i = 0; i < 68; i++) {
    const value = hash(`${seed}:${i}`);
    const width = 1 + (value % 3);
    const dark = (value >> 4) % 3 !== 0;
    out.push(html`<span style="width:${width}px;${dark ? '' : 'background:transparent'}"></span>`);
  }
  return out;
}
