/**
 * Home.
 *
 * Three jobs, in the order someone actually opens an airline app: show me the
 * trip I am already on, let me search a new one, and tell me what the network
 * is doing. The service lines are introduced below that, because they are how
 * this airline is organised, not the first thing anyone needs.
 */

import { html, icon, raw } from '../lib/dom.js';
import { href } from '../lib/router.js';
import { getState, allBookings, totalMiles } from '../lib/store.js';
import { brandList, airline, loyalty } from '../data/brand.js';
import { airport } from '../data/airports.js';
import { hydrate, checkinWindow } from '../engine/booking.js';
import { flightStatus } from '../engine/schedule.js';
import { circuits, circuitRoutes } from '../data/network.js';
import { nextOperatingDates } from '../engine/schedule.js';
import { today, formatDate, formatDuration } from '../lib/dates.js';
import { journeyLine, statusPill, note } from './ui.js';

/** The trip to put at the top: the next one that has not departed. */
function nextTrip() {
  const upcoming = allBookings()
    .filter((b) => b.status === 'confirmed')
    .map(hydrate)
    .filter((b) => !b.past)
    .sort((a, b) => a.departUtc - b.departUtc);
  return upcoming[0] ?? null;
}

function tripCard(booking) {
  const journeyIndex = booking.journeys.findIndex((j) => j.departUtc > Date.now());
  const journey = booking.journeys[Math.max(0, journeyIndex)];
  const window = checkinWindow(journey);
  const checkedIn = Boolean(booking.checkedIn?.[Math.max(0, journeyIndex)]);
  const status = flightStatus(journey.segments[0]);

  return html`
    <section class="section">
      <div class="section__head">
        <h2>Your next trip</h2>
        <a class="section__more" href="${href('/trips')}">All trips</a>
      </div>
      <div class="card card--flush flight-card">
        <div class="flight-card__brand flight-card__brand--${journey.segments[0].brand}">
          <span>${formatDate(journey.departDate, 'long')}</span>
          <span class="grow"></span>
          <span>${booking.reference}</span>
        </div>
        <div class="flight-card__body">
          ${journeyLine(journey)}
          <p class="row row--wrap" style="margin-top:var(--s3)">${statusPill(status)}
            ${checkedIn ? html`<span class="badge badge--ok">${icon('check', { size: 14 })} Checked in</span>` : ''}
          </p>
        </div>
        <div class="flight-card__foot">
          <a class="btn btn--secondary btn--sm" href="${href(`/trips/${booking.reference}`)}">Manage</a>
          ${checkedIn
            ? html`<a class="btn btn--primary btn--sm" href="${href(`/pass/${booking.reference}/${Math.max(0, journeyIndex)}/0`)}">Boarding pass</a>`
            : window.state === 'open'
              ? html`<a class="btn btn--primary btn--sm" href="${href(`/checkin/${booking.reference}`)}">Check in</a>`
              : html`<span class="badge badge--outline">Check-in opens ${formatDate(journey.departDate, 'compact')}, 24 h before</span>`}
        </div>
      </div>
    </section>`;
}

/** The next few departures of each Baffin circuit — the fortnight at a glance. */
function circuitStrip() {
  const start = today();
  const rows = circuits.slice(0, 3).map((circuit) => {
    const first = circuitRoutes(circuit.id)[0];
    const dates = nextOperatingDates(first, start, 2);
    return html`
      <a class="card-button" href="${href(`/milk-runs/${circuit.id}`)}">
        <div class="row row--between">
          <div class="grow">
            <div class="option__title">${circuit.name}</div>
            <div class="option__note">${first.stops.length} stops · ${first.cadence === 'weekly' ? 'weekly' : 'every other week'}</div>
          </div>
          ${icon('forward', { size: 18 })}
        </div>
        <p class="option__note" style="margin-top:var(--s2)">
          Next: ${dates.length ? dates.map((d) => formatDate(d, 'short')).join(' · ') : 'no departure scheduled'}
        </p>
      </a>`;
  });

  return html`
    <section class="section">
      <div class="section__head">
        <h2>Milk runs</h2>
        <a class="section__more" href="${href('/milk-runs')}">All circuits</a>
      </div>
      <div class="stack stack--tight">${rows}</div>
    </section>`;
}

export default function homeView() {
  const state = getState();
  const trip = nextTrip();
  const miles = totalMiles();
  const home = airport(state.profile.homeAirport ?? 'YFB');
  const tier = [...loyalty.tiers].reverse().find((t) => miles >= t.threshold) ?? loyalty.tiers[0];

  const body = html`
    <div class="page-head">
      <p class="page-head__eyebrow">${airline.base}</p>
      <h1>Where are you going?</h1>
      <p class="page-head__lede">
        Jets south, direct services between the hubs, and the circuits that call at every
        community in between — searched together, sold as one booking.
      </p>
    </div>

    <div class="stack" style="margin-bottom:var(--s8)">
      <a class="btn btn--primary btn--lg btn--block" href="${href('/book')}">
        ${icon('search', { size: 20 })} Search flights
      </a>
      <div class="grid-2">
        <a class="btn btn--secondary" href="${href('/checkin')}">${icon('check', { size: 18 })} Check in</a>
        <a class="btn btn--secondary" href="${href('/flights')}">${icon('clock', { size: 18 })} Flight status</a>
      </div>
    </div>

    ${trip ? tripCard(trip) : html`
      <section class="section">
        ${note(html`Nothing booked yet. Search a route and it will appear here, with your
          boarding passes, and stay readable with no signal.`, { title: 'No trips on this device' })}
      </section>`}

    <section class="section">
      <div class="section__head"><h2>Three ways we fly</h2></div>
      <div class="stack stack--tight">
        ${brandList.map((brand) => html`
          <a class="card-button" href="${href(`/brand/${brand.id}`)}">
            <div class="row">
              <span class="brand-dot brand-dot--${brand.id}"></span>
              <div class="grow">
                <div class="option__title">${brand.name}</div>
                <div class="option__note">${brand.tagline}</div>
              </div>
              ${icon('forward', { size: 18 })}
            </div>
          </a>`)}
      </div>
    </section>

    ${circuitStrip()}

    <section class="section">
      <div class="section__head"><h2>${loyalty.name}</h2></div>
      <div class="tier-card">
        <p class="tier-card__name">${tier.name}</p>
        <p class="tier-card__miles tnum">${miles.toLocaleString('en-CA')}<span style="font-size:var(--text-md);font-weight:500"> miles</span></p>
        ${nextTierBar(miles, tier)}
      </div>
    </section>

    <section class="section">
      <a class="card-button" href="${href('/network')}">
        <div class="row">
          ${icon('map', { size: 20 })}
          <div class="grow">
            <div class="option__title">The network</div>
            <div class="option__note">30 communities. Your home airport is ${home.name}.</div>
          </div>
          ${icon('forward', { size: 18 })}
        </div>
      </a>
    </section>`;

  return { title: null, body };
}

function nextTierBar(miles, tier) {
  const index = loyalty.tiers.findIndex((t) => t.id === tier.id);
  const next = loyalty.tiers[index + 1];
  if (!next) return html`<p class="tier-card__next">Top tier reached for this year.</p>`;
  const previous = tier.threshold;
  const progress = Math.min(100, Math.round(((miles - previous) / (next.threshold - previous)) * 100));
  return html`
    <div class="tier-card__bar"><div class="tier-card__fill" style="width:${progress}%"></div></div>
    <p class="tier-card__next">${(next.threshold - miles).toLocaleString('en-CA')} miles to ${next.name}</p>`;
}
