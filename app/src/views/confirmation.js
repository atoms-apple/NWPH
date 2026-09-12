/**
 * Booking confirmed.
 *
 * The record locator is the largest thing on the screen, because it is the one
 * piece of the booking someone will need to read out over a phone from a
 * community office. Everything else is arranged under it in the order it
 * becomes useful: what was booked, what happens next, then the receipt.
 */

import { html, icon } from '../lib/dom.js';
import { href } from '../lib/router.js';
import { findBooking } from '../lib/store.js';
import { hydrate } from '../engine/booking.js';
import { money } from '../engine/pricing.js';
import { airline, fareFamilyById } from '../data/brand.js';
import { formatDate } from '../lib/dates.js';
import { journeyLine, legList, priceBreakdown, note, empty } from './ui.js';

export default function confirmationView({ params }) {
  const stored = findBooking(params.reference);
  if (!stored) {
    return {
      title: 'Booking not found',
      body: empty('That booking is not on this device',
        'Bookings made in this app are stored on the device that made them.',
        html`<a class="btn btn--primary" href="${href('/trips')}">My trips</a>`),
    };
  }

  const booking = hydrate(stored);
  const family = fareFamilyById[booking.family.id];

  const body = html`
    <div style="text-align:center;padding:var(--s6) 0 var(--s4)">
      <p style="display:inline-flex;align-items:center;gap:var(--s2);color:var(--ok);font-weight:650">
        ${icon('check', { size: 20 })} Booking confirmed
      </p>
      <h1 style="margin:var(--s3) 0 var(--s2)">You are flying</h1>
      <p class="option__note">A confirmation has been sent to ${booking.contact.email}.</p>
      <div class="card card--raised" style="display:inline-block;margin-top:var(--s4);padding:var(--s4) var(--s8)">
        <p class="option__note" style="letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-xs)">Booking reference</p>
        <p class="tnum" style="font-size:var(--text-3xl);font-weight:700;letter-spacing:.14em;margin:var(--s1) 0 0">${booking.reference}</p>
      </div>
    </div>

    <div class="stack" style="margin:var(--s5) 0">
      ${booking.journeys.map((journey) => html`
        <div class="card">
          <p class="option__note">${journey.label} · ${formatDate(journey.departDate, 'long')}</p>
          ${journeyLine(journey)}
          <details class="disclosure" style="margin-top:var(--s3)">
            <summary>Every leg</summary>
            <div class="disclosure__body">${legList(journey)}</div>
          </details>
        </div>`)}
    </div>

    <section class="section">
      <div class="section__head"><h2>What happens next</h2></div>
      <div class="stack stack--tight">
        ${[
          ['clock', 'Check in opens 24 hours before departure', 'You will be able to check in from this app and carry the boarding pass offline.'],
          ['bag', `${family.checkedBags} checked bag${family.checkedBags > 1 ? 's' : ''} per traveller are included`, 'Bag drop closes 45 minutes before departure at the hubs, 30 minutes elsewhere.'],
          ['warning', 'Weather moves flights here', 'If yours moves we message the number on the booking, and rebook you at no charge.'],
        ].map(([iconName, title, body]) => html`
          <div class="card">
            <div class="row" style="align-items:flex-start">
              ${icon(iconName, { size: 20 })}
              <div class="grow">
                <div class="option__title">${title}</div>
                <div class="option__note">${body}</div>
              </div>
            </div>
          </div>`)}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>Receipt</h2></div>
      ${priceBreakdown(booking.price, { title: `Paid ${money(booking.price.total)}` })}
      <p class="option__note" style="margin-top:var(--s3)">
        ${booking.miles.toLocaleString('en-CA')} miles will be credited after travel.
      </p>
    </section>

    ${note(html`
      This is a prototype. No payment was taken, no seat was really held, and this booking exists
      only in this browser. <a href="${href('/about')}">What is and is not real</a>.`, { kind: 'warn' })}

    <div class="btn-row" style="margin-top:var(--s5)">
      <a class="btn btn--primary" href="${href(`/trips/${booking.reference}`)}">Manage this booking</a>
      <a class="btn btn--secondary" href="${href('/book')}">Book another flight</a>
    </div>`;

  return { title: 'Booking confirmed', body };
}
