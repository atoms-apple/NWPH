/**
 * The day of travel, when something has gone wrong or you want to change it:
 * rebooking after a disruption, same-day standby, and upgrades.
 *
 * These three screens are what an airline is judged on, so each of them states
 * the money and the odds before anything is committed — including standby,
 * where the honest answer is often "probably not".
 */

import { html, raw, icon, on, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { findBooking, saveBooking } from '../lib/store.js';
import { hydrate, changeQuote, applyChange, fareRules } from '../engine/booking.js';
import { journeyDisruption, rebookOptions, standbyOptions, upgradeOffers } from '../engine/disruption.js';
import { flightStatus, inventory } from '../engine/schedule.js';
import { fareFamilyById } from '../data/brand.js';
import { airport } from '../data/airports.js';
import { money, moneyRounded } from '../engine/pricing.js';
import { formatDate, formatDuration } from '../lib/dates.js';
import { pageHead, note, empty, journeyLine, legList, statusPill, flightCard } from './ui.js';

const notFound = () => empty(
  'Booking not found',
  'That reference is not stored on this device.',
  html`<a class="btn btn--primary" href="${href('/trips')}">My trips</a>`);

/* ── Rebooking after a disruption ────────────────────────────────────────── */

export function rebookView({ params }) {
  const stored = findBooking(params.reference);
  if (!stored) return { title: 'Not found', body: notFound() };

  const booking = hydrate(stored);
  const index = Number(params.journey) || 0;
  const journey = booking.journeys[index];
  if (!journey) return { title: 'Not found', body: notFound() };

  const disruption = journeyDisruption(journey);
  const options = rebookOptions(stored, index);

  const body = html`
    ${pageHead(
      disruption ? 'Rebook this flight' : 'This flight is operating',
      disruption
        ? 'Rebooking after a disruption is free and keeps your fare. Choose whichever gets you there — we are not charging the difference.'
        : 'Nothing is wrong with this flight. You can still change it, but the normal fare rules apply.',
      `Booking ${booking.reference}`)}

    <div class="card card--sunken" style="margin-bottom:var(--s5)">
      <p class="option__note">${journey.label} · ${formatDate(journey.departDate, 'long')}</p>
      ${journeyLine(journey)}
      <p style="margin-top:var(--s3)">${statusPill(flightStatus(journey.segments[0]))}</p>
    </div>

    ${disruption ? html`
      <div class="advisory ${disruption.severity === 'cancelled' ? 'advisory--severe' : ''}" style="margin-bottom:var(--s5)">
        ${icon('warning', { size: 20 })}
        <div>
          <p class="advisory__title">
            ${disruption.severity === 'cancelled' ? 'This flight is cancelled'
              : disruption.severity === 'broken' ? 'Your connection will not hold'
                : 'This flight is delayed'}
          </p>
          ${disruption.problems.map((problem) => html`
            <p style="margin:0 0 var(--s2)">
              ${problem.seg.flightNumber} ${airport(problem.seg.from).name} → ${airport(problem.seg.to).name}:
              ${problem.status.label}${problem.status.reason ? ` — ${problem.status.reason.toLowerCase()}` : ''}${problem.status.delayMinutes ? `, ${formatDuration(problem.status.delayMinutes)}` : ''}.
              ${problem.kind === 'missed-connection'
                ? `The connection at ${airport(problem.connection.at).name} is ${formatDuration(problem.connection.minutes)}, which this delay uses up.`
                : ''}
            </p>`)}
          <p class="advisory__meta">
            Rebooking is free, change fees are waived, and you keep your ${booking.family.name} fare.
            You may also take a full refund of the unused portion instead.
          </p>
        </div>
      </div>` : ''}

    ${options.length ? html`
      <section class="section">
        <div class="section__head">
          <div><h2>Next available services</h2><p>Same two communities, in your existing fare family.</p></div>
        </div>
        <div class="stack">
          ${options.map((option) => html`
            <div class="card card--flush flight-card">
              <div class="flight-card__brand flight-card__brand--${option.itinerary.leadBrand}">
                ${option.itinerary.segments.map((s) => s.flightNumber).join(' · ')}
                <span class="grow"></span>
                <span>${formatDate(option.itinerary.departDate, 'long')}</span>
              </div>
              <div class="flight-card__body">${journeyLine(option.itinerary)}</div>
              <div class="flight-card__foot">
                <span class="badge ${option.offsetDays === 0 ? 'badge--ok' : 'badge--outline'}">
                  ${option.offsetDays === 0 ? 'Same day'
                    : option.offsetDays === 1 ? 'Next day'
                      : `${option.offsetDays} days later`}
                </span>
                <button type="button" class="btn btn--accent btn--sm" data-rebook="${option.itinerary.id}">
                  ${disruption ? 'Take this flight — free' : 'Move to this flight'}
                </button>
              </div>
            </div>`)}
        </div>
      </section>` : empty(
        'Nothing else on this pairing',
        'There is no alternative service within a week. Call reservations — a routing through a hub is usually possible, and we will build it for you.',
        html`<a class="btn btn--primary" href="${href('/contact')}">Contact reservations</a>`)}

    <div class="btn-row" style="margin-top:var(--s6)">
      <a class="btn btn--secondary" href="${href(`/trips/${booking.reference}`)}">Back to the booking</a>
      ${disruption ? html`
        <a class="btn btn--danger" href="${href(`/trips/${booking.reference}/cancel`)}">Refund the unused portion instead</a>` : ''}
    </div>`;

  return {
    title: 'Rebook',
    body,
    onMount: (root) => {
      on(root, 'click', '[data-rebook]', (event, button) => {
        const option = options.find((o) => o.itinerary.id === button.dataset.rebook);
        if (!option) return;

        // A disruption is not the passenger's doing, so it costs nothing.
        const quote = disruption
          ? { allowed: true, difference: 0, fee: 0, payable: 0, forfeited: 0, refund: 0 }
          : changeQuote(stored, index, option.itinerary);

        if (!quote.allowed) {
          window.alert(quote.reason);
          return;
        }
        const confirmed = window.confirm(
          `Move to ${option.itinerary.segments.map((s) => s.flightNumber).join(' · ')} on `
          + `${formatDate(option.itinerary.departDate, 'long')}?\n\n`
          + (quote.payable ? `You pay ${money(quote.payable)}.` : 'There is nothing to pay.')
          + '\n\nSeats already chosen are released — the aircraft is a different one.');
        if (!confirmed) return;

        saveBooking(applyChange(stored, index, option.itinerary, quote));
        window.nwToast?.(disruption ? 'Rebooked at no charge.' : 'Flight changed.', 'ok');
        go(`/trips/${booking.reference}`);
      });
    },
  };
}

/* ── Same-day standby ────────────────────────────────────────────────────── */

export function standbyView({ params }) {
  const stored = findBooking(params.reference);
  if (!stored) return { title: 'Not found', body: notFound() };

  const booking = hydrate(stored);
  const index = Number(params.journey) || 0;
  const journey = booking.journeys[index];
  if (!journey) return { title: 'Not found', body: notFound() };

  const standby = standbyOptions(stored, index);

  const body = html`
    ${pageHead('Same-day standby',
      'An earlier service between the same two communities on the same day, space permitting.',
      `Booking ${booking.reference}`)}

    ${note(standby.reason, { kind: standby.allowed ? 'ok' : 'warn' })}

    <div class="card card--sunken" style="margin:var(--s5) 0">
      <p class="option__note">Currently booked · ${formatDate(journey.departDate, 'long')}</p>
      ${journeyLine(journey)}
    </div>

    ${standby.options.length ? html`
      <section class="section">
        <div class="section__head">
          <div><h2>Earlier today</h2><p>Loads shown are the current booked position.</p></div>
        </div>
        <div class="stack stack--tight">
          ${standby.options.map((option) => html`
            <div class="card">
              <div class="row row--between row--wrap">
                <div class="grow">
                  <div class="option__title">
                    ${option.seg.flightNumber} · ${option.seg.departLocal} → ${option.seg.arriveLocal}
                  </div>
                  <div class="option__note">
                    ${option.seg.aircraftName}
                    ${option.seg.via.length ? ` · via ${option.seg.via.map((c) => airport(c).name).join(', ')}` : ' · nonstop'}
                  </div>
                </div>
                <div style="text-align:right">
                  ${statusPill(option.status)}
                  <div style="margin-top:var(--s2)">
                    <span class="badge ${option.likelihood === 'good' ? 'badge--ok' : option.likelihood === 'tight' ? 'badge--warn' : 'badge--danger'}">
                      ${option.likelihood === 'good' ? `${option.available} seats — good chance`
                        : option.likelihood === 'tight' ? `${option.available} seats — tight`
                          : 'Full — unlikely'}
                    </span>
                  </div>
                </div>
              </div>
              <p class="option__note" style="margin-top:var(--s3)">
                You need ${option.needed} seat${option.needed > 1 ? 's' : ''}.
                ${option.likelihood === 'full'
                  ? 'Put your name down anyway — people do not turn up.'
                  : 'Ask at the counter when you arrive.'}
              </p>
            </div>`)}
        </div>
      </section>` : empty(
        'Nothing earlier today',
        `Yours is the first service from ${airport(journey.from).name} to ${airport(journey.to).name} today. To move to another day, change the flight instead.`,
        html`<a class="btn btn--primary" href="${href(`/trips/${booking.reference}/change/${index}`)}">Change flight</a>`)}

    ${note(html`
      <strong>Keep your original booking until you are actually aboard.</strong>
      Standby is space-available, and on the smaller aircraft space runs out for weight reasons as
      often as for seat reasons. Nothing is cancelled until you have boarded the earlier flight.`,
      { kind: 'warn' })}

    <p style="margin-top:var(--s5)">
      <a class="btn btn--secondary" href="${href(`/trips/${booking.reference}`)}">Back to the booking</a>
    </p>`;

  return { title: 'Same-day standby', body };
}

/* ── Upgrades ────────────────────────────────────────────────────────────── */

export function upgradeView({ params }) {
  const stored = findBooking(params.reference);
  if (!stored) return { title: 'Not found', body: notFound() };

  const booking = hydrate(stored);
  const index = Number(params.journey) || 0;
  const journey = booking.journeys[index];
  if (!journey) return { title: 'Not found', body: notFound() };

  const offers = upgradeOffers(stored, index);
  const current = fareFamilyById[booking.family.id];

  const body = html`
    ${pageHead('Upgrade this booking',
      `You hold ${current.name}. An upgrade changes the fare family for this flight, and with it the rules that apply afterwards.`,
      `Booking ${booking.reference}`)}

    <div class="card card--sunken" style="margin-bottom:var(--s5)">
      <p class="option__note">${journey.label} · ${formatDate(journey.departDate, 'long')}</p>
      ${journeyLine(journey)}
    </div>

    ${offers.length ? html`
      <div class="fares">
        ${offers.map((offer) => html`
          <div class="fare">
            <div class="fare__head">
              <div class="fare__name">${offer.family.name}</div>
              <div class="fare__subtitle">${offer.family.subtitle}</div>
            </div>
            <div class="fare__price">
              <div class="fare__amount">+${moneyRounded(offer.difference)}</div>
              <div class="fare__unit">for ${booking.passengers.length} traveller${booking.passengers.length > 1 ? 's' : ''}, all in</div>
              ${offer.seatsLeft <= 4 ? html`
                <div class="seats-left" style="margin-top:var(--s1)">${offer.seatsLeft} left at this fare</div>` : ''}
            </div>
            <ul class="fare__list">
              ${offer.gains.map((gain) => html`<li>${icon('check', { size: 14 })}<span>${gain}</span></li>`)}
            </ul>
            <div style="padding:0 var(--s4) var(--s4)">
              <button type="button" class="btn btn--accent btn--block" data-upgrade="${offer.family.id}">
                Upgrade to ${offer.family.name}
              </button>
            </div>
          </div>`)}
      </div>` : empty(
        'No upgrade available',
        offers.length === 0 && booking.family.id === 'summit'
          ? 'You already hold the highest fare family.'
          : 'Nothing above your fare has space on every flight in this journey.')}

    ${note(html`
      An upgrade is priced as the difference in fare, with no change fee. It also changes your
      change and cancellation rights — an upgrade to Flex makes the booking changeable free, and to
      Summit makes it refundable. <a href="${href('/help', { c: 'changes' })}">How fare rules work</a>.`,
      { kind: 'info' })}

    <p style="margin-top:var(--s5)">
      <a class="btn btn--secondary" href="${href(`/trips/${booking.reference}`)}">Back to the booking</a>
    </p>`;

  return {
    title: 'Upgrade',
    body,
    onMount: (root) => {
      on(root, 'click', '[data-upgrade]', (event, button) => {
        const offer = offers.find((o) => o.family.id === button.dataset.upgrade);
        if (!offer) return;
        if (!window.confirm(
          `Upgrade to ${offer.family.name} for ${money(offer.difference)}?\n\n`
          + `This also changes your fare rules: ${fareRules(offer.family.id)[0].body}`)) return;

        saveBooking({
          ...stored,
          family: offer.family.id,
          price: {
            ...stored.price,
            total: stored.price.total + offer.difference,
            changes: [...(stored.price.changes ?? []), {
              at: new Date().toISOString(), difference: offer.difference, fee: 0,
              paid: offer.difference, refunded: 0,
            }],
          },
          history: [...stored.history, {
            at: new Date().toISOString(),
            event: 'upgraded',
            detail: `Upgraded to ${offer.family.name}`,
          }],
        });
        window.nwToast?.(`Upgraded to ${offer.family.name}.`, 'ok');
        go(`/trips/${booking.reference}`);
      });
    },
  };
}
