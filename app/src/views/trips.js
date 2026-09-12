/**
 * My trips: the list, one booking, changing a flight, cancelling.
 *
 * Change and cancel are the screens an airline app is judged on, so both state
 * the money before anything is committed: what the new flight costs, what the
 * fee is, what comes back and in what form. Nothing here can be triggered
 * without the traveller having seen the figure first.
 */

import { html, raw, icon, on, $, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { allBookings, findBooking, saveBooking, addCredit, getState } from '../lib/store.js';
import { hydrate, changeQuote, applyChange, cancelQuote, cancelBooking, fareRules, checkinWindow } from '../engine/booking.js';
import { searchItineraries, priceResults } from '../engine/search.js';
import { money, moneyRounded } from '../engine/pricing.js';
import { flightStatus } from '../engine/schedule.js';
import { fareFamilyById, fareTypeById, ancillaryById, airline } from '../data/brand.js';
import { airport } from '../data/airports.js';
import { today, formatDate, addDays, daysBetween } from '../lib/dates.js';
import { journeyLine, legList, priceBreakdown, pageHead, note, empty, statusPill, flightCard } from './ui.js';

/* ── The list ────────────────────────────────────────────────────────────── */

export function tripsView() {
  const bookings = allBookings().map(hydrate);
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && !b.past).sort((a, b) => a.departUtc - b.departUtc);
  const past = bookings.filter((b) => b.status !== 'confirmed' || b.past).sort((a, b) => b.departUtc - a.departUtc);
  const credits = getState().credits.filter((c) => !c.spent);

  const body = html`
    ${pageHead('My trips', 'Everything booked in this app, stored on this device and readable with no signal.')}

    ${credits.length ? note(html`
      <strong>${money(credits.reduce((sum, c) => sum + c.amount, 0))} in travel credit</strong>
      From a cancelled booking. It is offered at payment on your next booking.`, { kind: 'ok' }) : ''}

    ${upcoming.length ? html`
      <section class="section">
        <div class="section__head"><h2>Upcoming</h2></div>
        <div class="stack">${upcoming.map(tripRow)}</div>
      </section>` : empty(
        'No upcoming trips',
        'Bookings made in this app appear here with their boarding passes.',
        html`<a class="btn btn--primary" href="${href('/book')}">Search flights</a>`)}

    ${past.length ? html`
      <section class="section">
        <div class="section__head"><h2>Past and cancelled</h2></div>
        <div class="stack">${past.map(tripRow)}</div>
      </section>` : ''}

    <section class="section">
      <div class="card card--quiet">
        <h2 class="card__title">Booked somewhere else?</h2>
        <p class="option__note" style="margin:var(--s2) 0 var(--s3)">
          A booking made on another device or by telephone is not on this one. In a live system it
          would be retrieved by reference and surname; in this prototype there is no server to ask.
        </p>
        <a class="btn btn--secondary btn--sm" href="${href('/about')}">Why</a>
      </div>
    </section>`;

  return { title: 'My trips', body };
}

function tripRow(booking) {
  const journey = booking.journeys[0];
  const cancelled = booking.status === 'cancelled';
  return html`
    <a class="card card--flush flight-card card-button" href="${href(`/trips/${booking.reference}`)}" style="padding:0">
      <div class="flight-card__brand flight-card__brand--${journey.segments[0]?.brand ?? 'altitude'}">
        <span>${formatDate(journey.departDate, 'long')}</span>
        <span class="grow"></span>
        <span class="tnum">${booking.reference}</span>
      </div>
      <div class="flight-card__body">
        ${journeyLine(journey)}
        <p class="row row--wrap" style="margin-top:var(--s3)">
          ${cancelled ? html`<span class="badge badge--danger">Cancelled</span>`
            : booking.past ? html`<span class="badge">Flown</span>`
              : statusPill(flightStatus(journey.segments[0]))}
          ${booking.journeys.length > 1 ? html`<span class="badge badge--outline">Return</span>` : ''}
          <span class="badge badge--outline">${booking.family.name}</span>
        </p>
      </div>
    </a>`;
}

/* ── One booking ─────────────────────────────────────────────────────────── */

export function tripView({ params }) {
  const stored = findBooking(params.reference);
  if (!stored) return { title: 'Not found', body: notFound() };
  const booking = hydrate(stored);
  const cancelled = booking.status === 'cancelled';
  const fareType = fareTypeById[booking.fareType] ?? fareTypeById.standard;

  const body = html`
    <div class="page-head">
      <p class="page-head__eyebrow">Booking reference</p>
      <h1 class="tnum" style="letter-spacing:.1em">${booking.reference}</h1>
      <p class="page-head__lede">
        ${booking.passengers.length} traveller${booking.passengers.length > 1 ? 's' : ''} ·
        ${booking.family.name} · ${fareType.name}
      </p>
    </div>

    ${cancelled ? note(html`
      <strong>This booking was cancelled on ${formatDate(booking.cancelledAt.slice(0, 10), 'long')}.</strong>
      ${booking.cancelQuote?.kind === 'credit' ? `${money(booking.cancelQuote.amount)} was issued as travel credit.`
        : booking.cancelQuote?.kind === 'refund' ? `${money(booking.cancelQuote.amount)} was refunded.`
          : 'No refund or credit was due under the fare rules.'}`, { kind: 'danger' }) : ''}

    ${booking.journeys.map((journey, index) => {
      const status = flightStatus(journey.segments[0]);
      const window = checkinWindow(journey);
      const checkedIn = Boolean(booking.checkedIn?.[index]);
      return html`
        <section class="section">
          <div class="section__head">
            <h2>${journey.label}</h2>
            <span>${statusPill(status)}</span>
          </div>
          <div class="card">
            <p class="option__note">${formatDate(journey.departDate, 'long')}</p>
            ${journeyLine(journey)}
            ${status.state === 'cancelled' ? note(html`
              <strong>${status.reason}.</strong> ${status.detail}`, { kind: 'danger' }) : ''}
            ${status.state === 'delayed' ? note(html`
              <strong>${status.reason}.</strong> ${status.detail ?? 'A revised time will be posted here.'}`, { kind: 'warn' }) : ''}
            <hr>
            ${legList(journey)}
            ${seatSummary(booking, journey)}
          </div>
          ${cancelled ? '' : html`
            <div class="btn-row" style="margin-top:var(--s3)">
              ${checkedIn
                ? html`<a class="btn btn--primary btn--sm" href="${href(`/pass/${booking.reference}/${index}/0`)}">Boarding pass</a>`
                : window.state === 'open'
                  ? html`<a class="btn btn--primary btn--sm" href="${href(`/checkin/${booking.reference}`)}">Check in</a>`
                  : html`<span class="badge badge--outline">Check-in opens 24 h before departure</span>`}
              <a class="btn btn--secondary btn--sm" href="${href(`/trips/${booking.reference}/change/${index}`)}">Change flight</a>
              <a class="btn btn--secondary btn--sm" href="${href(`/book/seats`)}" data-action="change-seats" data-journey="${index}">Change seats</a>
            </div>`}
        </section>`;
    })}

    <section class="section">
      <div class="section__head"><h2>Travellers</h2></div>
      <div class="card">
        <div class="stack stack--tight">
          ${booking.passengers.map((passenger) => html`
            <div class="row">
              ${icon('user', { size: 18 })}
              <span class="grow">
                <span class="option__title">${passenger.firstName} ${passenger.lastName}</span>
                <span class="option__note">${passenger.type === 'adult' ? 'Adult' : passenger.type === 'child' ? 'Child' : 'Infant, on a lap'}</span>
              </span>
            </div>`)}
        </div>
        <div class="card__foot">${booking.contact.email}${booking.contact.phone ? ` · ${booking.contact.phone}` : ''}</div>
      </div>
    </section>

    ${Object.keys(booking.extras ?? {}).length ? html`
      <section class="section">
        <div class="section__head"><h2>Extras</h2></div>
        <div class="card">
          <div class="stack stack--tight">
            ${Object.entries(booking.extras).map(([id, quantity]) => html`
              <div class="row row--between">
                <span>${ancillaryById[id]?.name ?? id}${quantity > 1 ? ` × ${quantity}` : ''}</span>
                <span class="tnum">${money((ancillaryById[id]?.price ?? 0) * 100 * quantity)}</span>
              </div>`)}
          </div>
        </div>
      </section>` : ''}

    <section class="section">
      <div class="section__head"><h2>Fare rules</h2></div>
      <div class="card">
        <dl class="stack stack--tight" style="margin:0">
          ${fareRules(booking.family.id).map((rule) => html`
            <div>
              <dt class="option__title">${rule.title}</dt>
              <dd class="option__note" style="margin:0">${rule.body}</dd>
            </div>`)}
        </dl>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>Payment</h2></div>
      ${priceBreakdown(booking.price, { title: `Paid ${money(booking.price.total)}` })}
      ${booking.price.changes?.length ? html`
        <div class="card" style="margin-top:var(--s3)">
          <h3 class="card__title">Changes since booking</h3>
          <div class="stack stack--tight" style="margin-top:var(--s2)">
            ${booking.price.changes.map((change) => html`
              <div class="row row--between">
                <span class="option__note">${formatDate(change.at.slice(0, 10), 'short')} — fare difference and fee</span>
                <span class="tnum">${money(change.paid)}</span>
              </div>`)}
          </div>
        </div>` : ''}
    </section>

    <section class="section">
      <div class="section__head"><h2>History</h2></div>
      <div class="card">
        <ol class="stack stack--tight" style="list-style:none;padding:0;margin:0">
          ${booking.history.map((entry) => html`
            <li class="row row--between">
              <span>${entry.detail}</span>
              <span class="option__note">${formatDate(entry.at.slice(0, 10), 'short')}</span>
            </li>`)}
        </ol>
      </div>
    </section>

    ${cancelled ? '' : html`
      <div class="btn-row" style="margin-top:var(--s6)">
        <a class="btn btn--danger" href="${href(`/trips/${booking.reference}/cancel`)}">Cancel this booking</a>
      </div>`}`;

  return {
    title: `Booking ${booking.reference}`,
    body,
    onMount: (root) => {
      on(root, 'click', '[data-action="change-seats"]', (event) => {
        event.preventDefault();
        announce('Seat changes after booking are made at check-in in this prototype.');
        window.nwToast?.('Seats can be changed at check-in.', 'default');
      });
    },
  };
}

function seatSummary(booking, journey) {
  const rows = [];
  for (const seg of journey.segments) {
    const seats = booking.seats?.[seg.id];
    if (!seats || !Object.keys(seats).length) continue;
    rows.push(html`
      <div class="row row--between">
        <span class="option__note">${seg.flightNumber} ${seg.from}–${seg.to}</span>
        <span class="tnum">${Object.entries(seats).map(([index, seat]) => `${booking.passengers[index]?.firstName ?? ''} ${seat}`).join(' · ')}</span>
      </div>`);
  }
  if (!rows.length) return html`<p class="option__note" style="margin-top:var(--s3)">Seats are assigned at check-in.</p>`;
  return html`<div class="stack stack--tight" style="margin-top:var(--s3)">${rows}</div>`;
}

const notFound = () => empty(
  'Booking not found',
  'That reference is not stored on this device.',
  html`<a class="btn btn--primary" href="${href('/trips')}">My trips</a>`);

/* ── Change a flight ─────────────────────────────────────────────────────── */

export function changeView({ params, query }) {
  const stored = findBooking(params.reference);
  if (!stored) return { title: 'Not found', body: notFound() };

  const booking = hydrate(stored);
  const index = Number(params.journey);
  const journey = booking.journeys[index];
  if (!journey) return { title: 'Not found', body: notFound() };

  const family = fareFamilyById[booking.family.id];
  if (!family.changeable) {
    return {
      title: 'Change flight',
      body: html`
        ${pageHead('This fare cannot be changed', `${family.name} is the lowest fare and is sold fixed.`)}
        ${note(html`
          A ${family.name} ticket carries no change right. To travel on another day you would book a
          new ticket; the original has no residual value.`, { kind: 'warn' })}
        <div class="btn-row" style="margin-top:var(--s5)">
          <a class="btn btn--primary" href="${href('/book')}">Book a new flight</a>
          <a class="btn btn--secondary" href="${href(`/trips/${booking.reference}`)}">Back to the booking</a>
        </div>`,
    };
  }

  const date = query.date ?? journey.departDate;
  const daysAhead = Math.max(0, daysBetween(today(), date));
  const passengers = booking.passengers.reduce((counts, p) => {
    counts[p.type] = (counts[p.type] ?? 0) + 1;
    return counts;
  }, {});

  const options = priceResults(
    searchItineraries(journey.from, journey.to, date),
    { fareType: booking.fareType, passengers, daysAhead },
  );

  const body = html`
    ${pageHead('Change flight', `${airport(journey.from).name} to ${airport(journey.to).name}. You keep your ${family.name} fare; you pay any difference${family.changeFee ? ` plus the $${family.changeFee} change fee per traveller` : ''}.`)}

    <div class="card card--sunken" style="margin-bottom:var(--s4)">
      <p class="option__note">Currently booked</p>
      ${journeyLine(journey)}
      <p class="option__note" style="margin-top:var(--s2)">${formatDate(journey.departDate, 'long')}</p>
    </div>

    <div class="field">
      <label class="field__label" for="change-date">New date</label>
      <input class="input" type="date" id="change-date" value="${date}" min="${today()}" max="${addDays(today(), 330)}">
    </div>

    ${options.length ? html`
      <div class="stack">
        ${options.map((result) => {
          const quote = changeQuote(stored, index, result.itinerary, { daysAhead });
          return html`
            ${flightCard(result, {
              action: `data-change="${result.itinerary.id}"`,
              footer: html`
                <span class="badge badge--outline">${quote.payable ? 'You pay' : 'No further charge'}</span>
                <span class="fare-from">
                  <span class="fare-from__amount">${quote.payable ? money(quote.payable) : money(0)}</span>
                  <span class="fare-from__each">
                    ${quote.difference > 0 ? `${money(quote.difference)} fare difference` : quote.forfeited ? `${money(quote.forfeited)} not refunded` : 'no fare difference'}${quote.fee ? ` + ${money(quote.fee)} fee` : ''}
                  </span>
                </span>`,
            })}`;
        })}
      </div>` : html`
      <div class="empty">
        <h2>Nothing flies this pairing on ${formatDate(date, 'long')}</h2>
        <p>Pick another date above.</p>
      </div>`}

    <p style="margin-top:var(--s5)">
      <a class="btn btn--secondary" href="${href(`/trips/${booking.reference}`)}">Keep the flight I have</a>
    </p>`;

  return {
    title: 'Change flight',
    body,
    onMount: (root) => {
      const input = $('#change-date', root);
      input.addEventListener('change', () => {
        go(href(`/trips/${booking.reference}/change/${index}`, { date: input.value }).slice(1));
      });

      on(root, 'click', '[data-change]', (event, button) => {
        const chosen = options.find((r) => r.itinerary.id === button.dataset.change);
        if (!chosen) return;
        const quote = changeQuote(stored, index, chosen.itinerary, { daysAhead });
        const confirmed = window.confirm(
          `Move ${journey.label.toLowerCase()} to ${formatDate(chosen.itinerary.departDate, 'long')}, `
          + `${chosen.itinerary.departLocal}?\n\n`
          + (quote.payable ? `You pay ${money(quote.payable)} now.` : 'There is nothing further to pay.')
          + (quote.forfeited ? `\nThe ${money(quote.forfeited)} difference on a cheaper flight is not refunded on this fare.` : '')
          + '\n\nSeats already chosen are released — the aircraft is a different one.',
        );
        if (!confirmed) return;
        saveBooking(applyChange(stored, index, chosen.itinerary, quote));
        window.nwToast?.('Flight changed.', 'ok');
        go(`/trips/${booking.reference}`);
      });
    },
  };
}

/* ── Cancel ──────────────────────────────────────────────────────────────── */

export function cancelView({ params }) {
  const stored = findBooking(params.reference);
  if (!stored) return { title: 'Not found', body: notFound() };
  const booking = hydrate(stored);
  const quote = cancelQuote(stored);

  const body = html`
    ${pageHead('Cancel this booking', `Booking ${booking.reference}, under ${booking.family.name} fare rules.`)}

    <div class="card card--sunken" style="margin-bottom:var(--s4)">
      ${booking.journeys.map((journey) => html`
        <p class="option__note">${journey.label} · ${formatDate(journey.departDate, 'long')}</p>
        ${journeyLine(journey)}`)}
    </div>

    <div class="card">
      <h2 class="card__title">What you get back</h2>
      <dl class="price-lines" style="margin-top:var(--s3)">
        <div class="price-line"><dt>Paid</dt><dd>${money(booking.price.total)}</dd></div>
        ${quote.fee ? html`<div class="price-line price-line--muted"><dt>Cancellation charge</dt><dd>−${money(quote.fee)}</dd></div>` : ''}
        <div class="price-line price-line--total">
          <dt>${quote.kind === 'refund' ? 'Refund' : quote.kind === 'credit' ? 'Travel credit' : 'Returned'}</dt>
          <dd>${money(quote.amount)}</dd>
        </div>
      </dl>
      <p class="option__note" style="margin-top:var(--s3)">${quote.detail}</p>
    </div>

    ${quote.kind === 'none' ? note(html`
      <strong>Nothing is returned on this fare.</strong>
      That is what the ${booking.family.name} fare is — the lowest price, sold fixed. If you may need
      to change your plans, Flex or Summit is the fare to hold.`, { kind: 'warn' }) : ''}

    <div class="btn-row" style="margin-top:var(--s6)">
      <button type="button" class="btn btn--danger" data-action="confirm-cancel">Cancel the booking</button>
      <a class="btn btn--primary" href="${href(`/trips/${booking.reference}`)}">Keep it</a>
    </div>`;

  return {
    title: 'Cancel booking',
    body,
    onMount: (root) => {
      on(root, 'click', '[data-action="confirm-cancel"]', () => {
        if (!window.confirm(`Cancel booking ${booking.reference}? This cannot be undone.`)) return;
        saveBooking(cancelBooking(stored, quote));
        if (quote.kind === 'credit' && quote.amount > 0) {
          addCredit({ amount: quote.amount, from: booking.reference, issued: new Date().toISOString(), spent: false });
        }
        window.nwToast?.(quote.kind === 'credit' ? `Cancelled — ${money(quote.amount)} travel credit issued.` : 'Booking cancelled.', 'ok');
        go(`/trips/${booking.reference}`);
      });
    },
  };
}
