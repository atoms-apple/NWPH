/**
 * Review and pay.
 *
 * The whole booking is restated before anything is charged: every flight, every
 * traveller, every seat, every charge, and the fare rules that will apply
 * afterwards. This is the last screen on which someone can find the mistake.
 *
 * No payment is taken and no card details leave the device — nothing is sent
 * anywhere, because there is nowhere to send it. The card fields exist so the
 * flow is complete and are marked as what they are.
 */

import { html, raw, icon, on, $, $$, announce } from '../lib/dom.js';
import { go } from '../lib/router.js';
import { getCheckout, setCheckout, getState, saveBooking, clearCheckout, checkoutComplete, update } from '../lib/store.js';
import { itineraryFromRefs } from '../engine/search.js';
import { priceItinerary, seatFeeCents, money, milesEarned } from '../engine/pricing.js';
import { createBooking, fareRules, makeReference } from '../engine/booking.js';
import { fareFamilyById, fareTypeById, ancillaryById, airline } from '../data/brand.js';
import { airport } from '../data/airports.js';
import { today, daysBetween, formatDate } from '../lib/dates.js';
import { steps, pageHead, note, legList, priceBreakdown, journeyLine } from './ui.js';

/** Price the whole booking: both directions, seats, extras, in one total. */
export function quoteCheckout(checkout) {
  const search = checkout.search;
  const journeys = checkout.journeys.map((refs) => (refs ? itineraryFromRefs(refs) : null)).filter(Boolean);

  let seatFees = 0;
  for (const journey of journeys) {
    for (const seg of journey.segments) {
      for (const seatId of Object.values(checkout.seats?.[seg.id] ?? {})) {
        seatFees += seatFeeCents(seg, seatId, checkout.family);
      }
    }
  }

  // Extras are bought once for the booking, not once per direction, so they
  // are attached to the outbound quote and left off the inbound.
  const parts = journeys.map((journey, index) => priceItinerary(journey, {
    family: checkout.family,
    fareType: search.fareType,
    passengers: search.passengers,
    daysAhead: Math.max(0, daysBetween(today(), journey.departDate)),
    seatFees: index === 0 ? seatFees : 0,
    extras: index === 0 ? (checkout.extras ?? {}) : {},
  }));

  // Combine into one breakdown so the receipt reads as a single purchase.
  const combined = parts.reduce((total, part) => ({
    lines: total.lines.length
      ? total.lines.map((line, i) => ({ ...line, fare: line.fare + (part.lines[i]?.fare ?? 0), fareEach: line.fareEach + (part.lines[i]?.fareEach ?? 0) }))
      : part.lines,
    extraLines: [...total.extraLines, ...part.extraLines],
    fare: total.fare + part.fare,
    fuel: total.fuel + part.fuel,
    navCanada: total.navCanada + part.navCanada,
    aif: total.aif + part.aif,
    atsc: total.atsc + part.atsc,
    seats: total.seats + part.seats,
    extras: total.extras + part.extras,
    preTax: total.preTax + part.preTax,
    gst: total.gst + part.gst,
    total: total.total + part.total,
    passengerCount: part.passengerCount,
  }), { lines: [], extraLines: [], fare: 0, fuel: 0, navCanada: 0, aif: 0, atsc: 0, seats: 0, extras: 0, preTax: 0, gst: 0, total: 0, passengerCount: 0 });

  return { journeys, price: combined, miles: journeys.reduce((sum, j) => sum + milesEarned(j, checkout.family), 0) };
}

export default function paymentView() {
  const checkout = getCheckout();
  if (!checkoutComplete(checkout) || !checkout.family || !checkout.passengers?.length) return { redirect: '/book' };

  const { journeys, price, miles } = quoteCheckout(checkout);
  if (!journeys.length) return { redirect: '/book' };

  const family = fareFamilyById[checkout.family];
  const fareType = fareTypeById[checkout.search.fareType] ?? fareTypeById.standard;
  const credits = getState().credits.filter((c) => !c.spent);
  const creditTotal = credits.reduce((sum, c) => sum + c.amount, 0);

  const body = html`
    ${steps('pay')}
    ${pageHead('Review and pay', 'Check everything below. This is the last screen before the booking is made.')}

    <div class="with-rail">
      <div>
        <section class="section">
          <div class="section__head"><h2>Your flights</h2></div>
          <div class="stack">
            ${journeys.map((journey, index) => html`
              <div class="card">
                <p class="option__note">${checkout.legs[index]?.label ?? `Flight ${index + 1}`} · ${formatDate(journey.departDate, 'long')}</p>
                ${journeyLine(journey)}
                <details class="disclosure" style="margin-top:var(--s3)">
                  <summary>Every leg</summary>
                  <div class="disclosure__body">${legList(journey)}</div>
                </details>
              </div>`)}
          </div>
        </section>

        <section class="section">
          <div class="section__head">
            <h2>Travellers</h2>
            <a class="section__more" href="#/book/travellers">Edit</a>
          </div>
          <div class="card">
            <div class="stack stack--tight">
              ${checkout.passengers.map((passenger, index) => html`
                <div class="row">
                  ${icon('user', { size: 18 })}
                  <span class="grow">
                    <span class="option__title">${passenger.firstName} ${passenger.lastName}</span>
                    <span class="option__note">${passenger.type === 'adult' ? 'Adult' : passenger.type === 'child' ? 'Child' : 'Infant, on a lap'}${passenger.fareId ? ` · ${fareType.requiresId}: ${passenger.fareId}` : ''}</span>
                  </span>
                  <span class="tnum">${seatsFor(checkout, journeys, index)}</span>
                </div>`)}
            </div>
            <div class="card__foot">
              ${fareType.name}${fareType.discount ? ` — ${Math.round(fareType.discount * 100)}% off the base fare` : ''} ·
              Confirmation to ${checkout.contact.email}
            </div>
          </div>
        </section>

        ${Object.keys(checkout.extras ?? {}).length ? html`
          <section class="section">
            <div class="section__head"><h2>Extras</h2><a class="section__more" href="#/book/extras">Edit</a></div>
            <div class="card">
              <div class="stack stack--tight">
                ${Object.entries(checkout.extras).map(([id, quantity]) => html`
                  <div class="row row--between">
                    <span>${ancillaryById[id].name}${quantity > 1 ? ` × ${quantity}` : ''}</span>
                    <span class="tnum">${money(ancillaryById[id].price * 100 * quantity)}</span>
                  </div>`)}
              </div>
            </div>
          </section>` : ''}

        <section class="section">
          <div class="section__head"><h2>${family.name} fare rules</h2></div>
          <div class="card">
            <dl class="stack stack--tight" style="margin:0">
              ${fareRules(checkout.family).map((rule) => html`
                <div>
                  <dt class="option__title">${rule.title}</dt>
                  <dd class="option__note" style="margin:0">${rule.body}</dd>
                </div>`)}
            </dl>
          </div>
        </section>

        <section class="section">
          <div class="section__head"><h2>Payment</h2></div>
          ${note(html`
            <strong>No payment is taken and no card details leave this device.</strong>
            This app is a working prototype of an airline that does not exist. The fields below
            complete the flow; nothing is transmitted, stored off the device, or charged.`,
            { kind: 'warn', title: null })}

          <form class="card" id="payment-form" style="margin-top:var(--s3)" novalidate>
            ${creditTotal ? html`
              <label class="option" style="margin-bottom:var(--s4)">
                <input type="checkbox" id="use-credit" name="use-credit">
                <span class="option__body">
                  <span class="option__title">Use travel credit — ${money(creditTotal)} available</span>
                  <span class="option__note">From a cancelled booking. Applied against this fare.</span>
                </span>
              </label>` : ''}

            <div class="field">
              <label class="field__label" for="card-name">Name on card</label>
              <input class="input" id="card-name" name="card-name" autocomplete="off"
                value="${checkout.passengers[0].firstName} ${checkout.passengers[0].lastName}">
            </div>
            <div class="field">
              <label class="field__label" for="card-number">Card number</label>
              <input class="input tnum" id="card-number" name="card-number" inputmode="numeric"
                autocomplete="off" placeholder="4111 1111 1111 1111" value="4111 1111 1111 1111">
              <span class="field__hint">Pre-filled with a test number. Do not enter a real card.</span>
            </div>
            <div class="field-group field-group--2">
              <div class="field">
                <label class="field__label" for="card-expiry">Expiry</label>
                <input class="input tnum" id="card-expiry" name="card-expiry" inputmode="numeric" placeholder="MM/YY" value="12/29">
              </div>
              <div class="field">
                <label class="field__label" for="card-cvc">Security code</label>
                <input class="input tnum" id="card-cvc" name="card-cvc" inputmode="numeric" placeholder="123" value="123">
              </div>
            </div>

            <label class="option">
              <input type="checkbox" id="accept" name="accept">
              <span class="option__body">
                <span class="option__title">I accept the fare rules and conditions of carriage</span>
                <span class="option__note">
                  Including the ${family.name} change and cancellation terms set out above.
                </span>
              </span>
            </label>

            <p class="field__error" id="payment-error" hidden></p>
          </form>
        </section>
      </div>

      <aside class="with-rail__rail">
        <div class="card card--raised">
          <h2 class="card__title">Total</h2>
          <p style="font-size:var(--text-3xl);font-weight:700;letter-spacing:-.03em;margin:var(--s2) 0">${money(price.total)}</p>
          <p class="option__note">
          ${price.passengerCount} traveller${price.passengerCount > 1 ? 's' : ''} ·
          ${journeys.length > 1 ? `${journeys.length} flights` : 'one way'} · ${airline.currency}
        </p>
          <hr>
          ${priceBreakdown(price, { title: 'Every charge', open: true })}
          <p class="option__note" style="margin-top:var(--s3)">Earns ${miles.toLocaleString('en-CA')} miles.</p>
        </div>
      </aside>
    </div>

    <div class="action-bar">
      <div class="action-bar__total">
        <span class="action-bar__label">Total to pay</span>
        <span class="action-bar__amount">${money(price.total)}</span>
      </div>
      <button class="btn btn--primary btn--lg" type="button" data-action="pay">
        ${icon('check', { size: 18 })} Confirm booking
      </button>
    </div>`;

  return { title: 'Review and pay', body, onMount: (root) => wire(root, { checkout, journeys, price, miles }) };
}

function seatsFor(checkout, journeys, passengerIndex) {
  const seats = [];
  for (const journey of journeys) {
    for (const seg of journey.segments) {
      const seat = checkout.seats?.[seg.id]?.[passengerIndex];
      if (seat) seats.push(seat);
    }
  }
  return seats.length ? seats.join(', ') : '';
}

function wire(root, { checkout, journeys, price, miles }) {
  on(root, 'click', '[data-action="pay"]', () => {
    const accept = $('#accept', root);
    const errorBox = $('#payment-error', root);
    if (!accept.checked) {
      errorBox.hidden = false;
      errorBox.innerHTML = '<span>Accept the fare rules and conditions of carriage to continue.</span>';
      announce('Accept the fare rules and conditions of carriage to continue.');
      accept.focus();
      return;
    }

    const booking = createBooking({
      journeys: journeys.map((journey, index) => ({
        label: checkout.legs[index]?.label ?? `Flight ${index + 1}`,
        segments: journey.segments,
      })),
      passengers: checkout.passengers,
      contact: checkout.contact,
      family: checkout.family,
      fareType: checkout.search.fareType,
      seats: checkout.seats ?? {},
      extras: checkout.extras ?? {},
      price,
      reference: makeReference(),
    });
    booking.miles = miles;

    saveBooking(booking);
    clearCheckout();
    go(`/book/confirmed/${booking.reference}`, { replace: true });
  });
}
