/**
 * Seat selection.
 *
 * A seat is picked per passenger, per segment, because the aircraft changes: a
 * trip from Clyde River to Ottawa is a Dash 8 with thirty-seven seats and then
 * a 737 with a hundred and sixty, and 12A means something different on each.
 *
 * The cabin drawing shows more than seats. On the combi it shows the freight
 * bay that is the reason the cabin starts at row 11, and on every type it shows
 * where the galley and the exits are, because that is what someone is actually
 * choosing between.
 *
 * Keyboard: the map is a grid of buttons in reading order, so arrow keys move
 * between seats and the seat's label carries its row, position and price.
 */

import { html, raw, icon, on, $, $$, announce } from '../lib/dom.js';
import { go } from '../lib/router.js';
import { getCheckout, setCheckout, getState } from '../lib/store.js';
import { itineraryFromRefs } from '../engine/search.js';
import { buildSeatMap, aircraftType } from '../data/aircraft.js';
import { occupiedSeats } from '../engine/schedule.js';
import { seatEligible } from '../engine/booking.js';
import { fareFamilyById } from '../data/brand.js';
import { money, seatFeeCents } from '../engine/pricing.js';
import { airport } from '../data/airports.js';
import { formatDate } from '../lib/dates.js';
import { steps, pageHead, note } from './ui.js';

/** Every segment across both directions, flattened, in travel order. */
function allSegments(checkout) {
  const outbound = itineraryFromRefs(checkout.outbound);
  const inbound = checkout.inbound ? itineraryFromRefs(checkout.inbound) : null;
  return [
    ...(outbound?.segments ?? []).map((s) => ({ seg: s, direction: 'Outbound' })),
    ...(inbound?.segments ?? []).map((s) => ({ seg: s, direction: 'Return' })),
  ];
}

export default function seatsView({ query }) {
  const checkout = getCheckout();
  if (!checkout?.outbound || !checkout.family || !checkout.passengers) return { redirect: '/book' };

  const segments = allSegments(checkout);
  if (!segments.length) return { redirect: '/book' };

  const index = Math.min(Number(query.seg ?? 0) || 0, segments.length - 1);
  const { seg, direction } = segments[index];
  const family = fareFamilyById[checkout.family];
  const free = family.seatSelection === 'free';

  // Only passengers with their own seat: an infant on a lap has none.
  const seated = checkout.passengers
    .map((passenger, i) => ({ ...passenger, index: i }))
    .filter((passenger) => passenger.type !== 'infant');

  const chosen = checkout.seats?.[seg.id] ?? {};
  const activePassenger = Number(query.pax ?? seated.find((p) => !chosen[p.index])?.index ?? seated[0].index);

  const body = html`
    ${steps('seats')}
    ${pageHead('Choose seats', free
      ? `Seat selection is included with your ${family.name} fare.`
      : 'Pick a seat now, or leave it and one will be assigned free at check-in.')}

    ${segments.length > 1 ? html`
      <div class="chips" style="margin-bottom:var(--s4)" role="tablist" aria-label="Flights on this booking">
        ${segments.map((entry, i) => html`
          <a class="chip ${i === index ? 'is-active' : ''}" role="tab" aria-selected="${i === index}"
             href="#/book/seats?seg=${i}">
            ${entry.seg.from} → ${entry.seg.to}
            ${seatsDone(checkout, entry.seg, seated) ? icon('check', { size: 14 }) : ''}
          </a>`)}
      </div>` : ''}

    <div class="card card--sunken" style="margin-bottom:var(--s4)">
      <p class="option__note">${direction} · ${formatDate(seg.departDate, 'long')}</p>
      <p class="option__title">
        ${seg.flightNumber} · ${airport(seg.from).name} → ${airport(seg.to).name}
      </p>
      <p class="option__note">${seg.aircraftName} · ${seg.departLocal} – ${seg.arriveLocal}</p>
    </div>

    <div class="seatmap-wrap">
      <div>
        <div class="card">
          <h2 class="card__title" style="margin-bottom:var(--s3)">Assign seats</h2>
          <div class="seat-assign">
            ${seated.map((passenger) => html`
              <a class="seat-assign__row ${passenger.index === activePassenger ? 'is-active' : ''}"
                 href="#/book/seats?seg=${index}&pax=${passenger.index}"
                 aria-current="${passenger.index === activePassenger ? 'true' : 'false'}">
                ${icon('user', { size: 18 })}
                <span class="grow">
                  <span class="option__title">${passenger.firstName} ${passenger.lastName}</span>
                  ${passenger.index === activePassenger ? html`<span class="option__note">Choosing now</span>` : ''}
                </span>
                <span class="seat-assign__seat tnum">${chosen[passenger.index] ?? '—'}</span>
              </a>`)}
          </div>
          ${Object.keys(chosen).length ? html`
            <p style="margin-top:var(--s3)">
              <button type="button" class="btn btn--ghost btn--sm" data-action="clear-seats">Clear seats on this flight</button>
            </p>` : ''}
        </div>
      </div>

      <div>
        ${cabinMap(seg, { chosen, family: checkout.family, activePassenger, free })}

        <div class="card" style="margin-top:var(--s3)">
          <h2 class="card__title" style="margin-bottom:var(--s3)">Legend</h2>
          <div class="seat-legend">
            ${[['--free', 'Available'], ['--preferred', 'Extra legroom'], ['--exit', 'Exit row'], ['--summit', 'Summit cabin'], ['--taken', 'Taken'], ['--blocked', 'Blocked']]
              .map(([modifier, label]) => html`
                <span class="seat-legend__item">
                  <span class="seat-legend__swatch seat${modifier}"></span>${label}
                </span>`)}
          </div>
          ${aircraftType(seg.aircraft).note ? html`
            <p class="option__note" style="margin-top:var(--s3)">${aircraftType(seg.aircraft).note}</p>` : ''}
        </div>

        <div style="margin-top:var(--s3)">${exitRowNote(seg)}</div>
      </div>
    </div>

    <div class="action-bar">
      <div class="action-bar__total">
        <span class="action-bar__label">Seat charges so far</span>
        <span class="action-bar__amount" id="seat-total">${money(seatTotal(checkout, segments, checkout.family))}</span>
      </div>
      <button class="btn btn--secondary" type="button" data-action="skip">Skip</button>
      <button class="btn btn--primary" type="button" data-action="continue">
        ${index < segments.length - 1 ? 'Next flight' : 'Continue'} ${icon('forward', { size: 18 })}
      </button>
    </div>`;

  return {
    title: 'Choose seats',
    body,
    keepScroll: Boolean(query.pax),
    onMount: (root) => wire(root, { seg, index, segments, activePassenger, seated }),
  };
}

const seatsDone = (checkout, seg, seated) => {
  const chosen = checkout.seats?.[seg.id] ?? {};
  return seated.every((passenger) => chosen[passenger.index]);
};

/** Every seat charge across the whole booking, at the current fare. */
function seatTotal(checkout, segments, familyId) {
  let total = 0;
  for (const { seg } of segments) {
    for (const seatId of Object.values(checkout.seats?.[seg.id] ?? {})) {
      total += seatFeeCents(seg, seatId, familyId);
    }
  }
  return total;
}

/** The cabin, drawn from the aircraft's own layout. */
function cabinMap(seg, { chosen, family, activePassenger, free }) {
  const map = buildSeatMap(seg.aircraft);
  const taken = occupiedSeats(seg);
  const mine = new Map(Object.entries(chosen).map(([index, seatId]) => [seatId, Number(index)]));

  const rows = map.blocks.map((block) => {
    if (block.kind === 'cabin-label') return html`<p class="cabin__label">${block.label}</p>`;
    if (block.kind === 'galley') return html`<p class="cabin__service">${icon('info', { size: 14 })} ${block.label}</p>`;
    if (block.kind === 'cargo') return html`<p class="cabin__cargo">${icon('cargo', { size: 16 })} ${block.label}</p>`;

    const cells = [];
    block.seats.forEach((seat, position) => {
      if (position === block.aisleAfter) cells.push(html`<span class="seat-row__aisle" aria-hidden="true"></span>`);

      const isTaken = taken.has(seat.id) && !mine.has(seat.id);
      const eligible = seatEligible(seat, family);
      const isMine = mine.has(seat.id);
      const fee = free ? 0 : seat.price * 100;

      const state = seat.blocked ? 'blocked' : isTaken ? 'taken' : !eligible ? 'locked' : seat.cabin;
      const label = seat.blocked ? `Seat ${seat.id}, blocked for extra space`
        : isTaken ? `Seat ${seat.id}, taken`
          : !eligible ? `Seat ${seat.id}, Summit cabin — not available on this fare`
            : `Seat ${seat.id}, ${seat.position}${seat.exit ? ', exit row' : seat.legroom ? ', extra legroom' : ''}${fee ? `, ${money(fee)}` : ', no charge'}${isMine ? ', selected' : ''}`;

      cells.push(html`
        <button type="button"
          class="seat seat--${state} ${isMine ? 'is-mine' : ''}"
          data-seat="${seat.id}"
          ${seat.blocked || isTaken || !eligible ? raw('disabled') : ''}
          aria-pressed="${isMine ? 'true' : 'false'}"
          aria-label="${label}">
          <span aria-hidden="true">${seat.letter}</span>
          ${fee && !isMine && !isTaken && eligible && !seat.blocked
            ? html`<span class="seat__price" aria-hidden="true">${Math.round(fee / 100)}</span>` : ''}
        </button>`);
    });

    return html`
      <div class="seat-row">
        <span class="seat-row__number" aria-hidden="true">${block.row}</span>
        ${cells}
        <span class="seat-row__number" aria-hidden="true">${block.row}</span>
      </div>
      ${block.note ? html`<p class="seat-row__note">${block.note}</p>` : ''}`;
  });

  return html`
    <div class="cabin" role="group" aria-label="Seat map for ${seg.aircraftName} on ${seg.flightNumber}">
      <div class="cabin__nose" aria-hidden="true"></div>
      ${rows}
      <div class="cabin__tail" aria-hidden="true"></div>
    </div>`;
}

const exitRowNote = (seg) => note(html`
  Anyone seated in an exit row must be able to help the crew in an evacuation, and be at least
  16 years old. Crew confirm this at the door.`, { kind: 'info' });

function wire(root, { seg, index, segments, activePassenger, seated }) {
  on(root, 'click', '[data-seat]', (event, button) => {
    if (button.disabled) return;
    const checkout = getCheckout();
    const seatId = button.dataset.seat;
    const current = { ...(checkout.seats?.[seg.id] ?? {}) };

    // Tapping your own seat gives it up; tapping a new one moves you.
    if (current[activePassenger] === seatId) delete current[activePassenger];
    else {
      for (const [passengerIndex, existing] of Object.entries(current)) {
        if (existing === seatId) delete current[passengerIndex];
      }
      current[activePassenger] = seatId;
    }

    setCheckout({ seats: { ...checkout.seats, [seg.id]: current } });

    const next = seated.find((p) => !current[p.index] && p.index !== activePassenger);
    announce(current[activePassenger]
      ? `Seat ${seatId} selected${next ? `. Now choosing for ${next.firstName}` : ''}`
      : `Seat ${seatId} released`);
    go(`/book/seats?seg=${index}${next ? `&pax=${next.index}` : `&pax=${activePassenger}`}`, { replace: true });
  });

  on(root, 'click', '[data-action="clear-seats"]', () => {
    const checkout = getCheckout();
    const seats = { ...checkout.seats };
    delete seats[seg.id];
    setCheckout({ seats });
    go(`/book/seats?seg=${index}`, { replace: true });
  });

  const advance = () => {
    if (index < segments.length - 1) go(`/book/seats?seg=${index + 1}`);
    else go('/book/extras');
  };
  on(root, 'click', '[data-action="continue"]', advance);
  on(root, 'click', '[data-action="skip"]', () => {
    if (index < segments.length - 1) go(`/book/seats?seg=${index + 1}`);
    else go('/book/extras');
  });

  // Arrow keys walk the cabin the way the eye does.
  on(root, 'keydown', '.seat', (event, button) => {
    const keys = { ArrowLeft: -1, ArrowRight: 1 };
    const seats = $$('.seat', root);
    const at = seats.indexOf(button);
    let target = null;
    if (event.key in keys) target = seats[at + keys[event.key]];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const row = button.closest('.seat-row');
      const rows = $$('.seat-row', root);
      const rowAt = rows.indexOf(row);
      const column = [...row.querySelectorAll('.seat')].indexOf(button);
      const nextRow = rows[rowAt + (event.key === 'ArrowDown' ? 1 : -1)];
      target = nextRow?.querySelectorAll('.seat')[column] ?? null;
    }
    if (target) { event.preventDefault(); target.focus(); }
  });
}
