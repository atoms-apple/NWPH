/**
 * Home.
 *
 * An airline's home page has one job above all others — start a booking — and
 * then a second, which is to tell someone what this airline is and whether it
 * goes where they are going. The order here follows that: a hero, the search
 * widget over it, the trip you are already on, then the network, the deals, the
 * circuits and the services.
 *
 * The aurora behind the hero is CSS gradients and the route lines are the real
 * network drawn from real coordinates. Nothing is a photograph, because there
 * is no photograph to ship and a stock image of "the Arctic" would be a lie
 * about somewhere specific.
 */

import { html, icon, raw } from '../lib/dom.js';
import { href } from '../lib/router.js';
import { getState, allBookings, totalMiles } from '../lib/store.js';
import { brandList, airline, loyalty } from '../data/brand.js';
import { airport, airports } from '../data/airports.js';
import { routes, circuits, circuitRoutes } from '../data/network.js';
import { destination } from '../data/destinations.js';
import { imminentAdvisories } from '../data/advisories.js';
import { hydrate, checkinWindow } from '../engine/booking.js';
import { flightStatus, nextOperatingDates } from '../engine/schedule.js';
import { topDeals } from '../engine/deals.js';
import { today, formatDate } from '../lib/dates.js';
import { journeyLine, statusPill, note, skyGradient, searchWidget, wireSearchWidget } from './ui.js';
import { networkMap } from './network.js';
import { moneyRounded } from '../engine/pricing.js';

/** The trip to put at the top: the next one that has not departed. */
function nextTrip() {
  return allBookings()
    .filter((b) => b.status === 'confirmed')
    .map(hydrate)
    .filter((b) => !b.past)
    .sort((a, b) => a.departUtc - b.departUtc)[0] ?? null;
}

export default function homeView() {
  const state = getState();
  const trip = nextTrip();
  const miles = totalMiles();
  const tier = [...loyalty.tiers].reverse().find((t) => miles >= t.threshold) ?? loyalty.tiers[0];
  const advisories = imminentAdvisories();
  const deals = topDeals(4);
  const home = airport(state.profile.homeAirport ?? 'YFB');

  const body = html`
    <section class="hero bleed">
      <div class="hero__sky"></div>
      <div class="hero__stars"></div>
      <div class="hero__map">${networkMap(airports.map((a) => a.code), routes, { title: '', bare: true })}</div>
      <div class="hero__inner">
        <p class="hero__eyebrow">${icon('wind', { size: 16 })} Inuit-owned · ${airline.base}</p>
        <h1>No road goes there. We do.</h1>
        <p class="hero__lede">
          Thirty communities across Nunavut and four gateways south — jets, direct turboprop
          services and the circuits that call at every strip in between, searched together and
          sold as one booking.
        </p>
        <dl class="hero__stats">
          <div class="hero__stat"><dt>Communities</dt><dd>${airports.filter((a) => a.region !== 'south').length}</dd></div>
          <div class="hero__stat"><dt>Scheduled services</dt><dd>${routes.length}</dd></div>
          <div class="hero__stat"><dt>Circuits</dt><dd>${circuits.length}</dd></div>
          <div class="hero__stat"><dt>Gateways south</dt><dd>${airports.filter((a) => a.region === 'south').length}</dd></div>
        </dl>
      </div>
    </section>

    <div class="book-widget-wrap">
      <div class="book-widget">${searchWidget(state.search)}</div>
    </div>

    ${advisories.length ? html`
      <section class="section" style="margin-top:var(--s8)">
        <a class="advisory ${advisories[0].severity === 'severe' ? 'advisory--severe' : ''}" href="${href('/advisories')}"
           style="text-decoration:none">
          ${icon('warning', { size: 20 })}
          <div class="grow">
            <p class="advisory__title">${advisories[0].title}</p>
            <p style="margin:0">${advisories[0].body.slice(0, 160)}…</p>
            <p class="advisory__meta">
              ${advisories.length > 1 ? `${advisories.length - 1} other advisor${advisories.length > 2 ? 'ies' : 'y'} in force · ` : ''}
              See all travel advisories
            </p>
          </div>
          ${icon('forward', { size: 18 })}
        </a>
      </section>` : ''}

    ${trip ? tripCard(trip) : ''}

    <section class="section" style="margin-top:var(--s10)">
      <div class="section__head">
        <div>
          <h2>Three ways we fly</h2>
          <p>Sections of this site, not walls between them — one booking can use all three.</p>
        </div>
        <a class="section__more" href="${href('/network')}">Route map</a>
      </div>
      <div class="grid-3">
        ${brandList.map((brand) => html`
          <a class="feature" href="${href(`/brand/${brand.id}`)}">
            <span class="feature__icon" style="background:${brandTint(brand.id)};color:var(--${brand.id}-text)">
              ${icon(brand.id === 'altitude' ? 'plane' : brand.id === 'express' ? 'forward' : 'map', { size: 20 })}
            </span>
            <span class="feature__title">${brand.name}</span>
            <span class="feature__note">${brand.tagline} · ${routes.filter((r) => r.brand === brand.id).length} services</span>
            <span class="feature__note">${brand.description.split('.')[0]}.</span>
            <span class="feature__link">Explore ${brand.shortName} →</span>
          </a>`)}
      </div>
    </section>

    ${deals.length ? html`
      <section class="section">
        <div class="section__head">
          <div><h2>Fares worth moving a date for</h2><p>Lowest fares found on the network over the next six weeks.</p></div>
          <a class="section__more" href="${href('/deals')}">All seat sales</a>
        </div>
        <div class="cards">
          ${deals.map((deal) => html`
            <a class="deal" href="${href('/book/results', { from: deal.from, to: deal.to, date: deal.date })}">
              <span class="deal__tag">${deal.saving}% off</span>
              <span class="deal__route">${airport(deal.from).name} → ${airport(deal.to).name}</span>
              <span class="deal__note">${formatDate(deal.date, 'long')} · ${deal.brandName}</span>
              <span class="deal__price">
                <span class="deal__from">from</span>
                <span class="deal__amount">${moneyRounded(deal.total)}</span>
                <span class="deal__was">${moneyRounded(deal.typical)}</span>
              </span>
            </a>`)}
        </div>
      </section>` : ''}

    <section class="section">
      <div class="section__head">
        <div><h2>Where we fly</h2><p>Every community on the network has a page: who serves it, how often, and what to expect.</p></div>
        <a class="section__more" href="${href('/destinations')}">All destinations</a>
      </div>
      <div class="cards">
        ${featured().map((code) => {
          const place = airport(code);
          const guide = destination(code);
          return html`
            <a class="dest-card" href="${href(`/destinations/${code}`)}">
              <span class="dest-card__sky" style="background:${skyGradient(place)}">
                <span class="dest-card__label">
                  <span class="dest-card__code">${code} · ${place.runway} m ${place.surface}</span>
                  <span class="dest-card__name">${place.name}</span>
                </span>
              </span>
              <span class="dest-card__body">
                <span class="dest-card__meta">
                  ${guide?.intro ? `${guide.intro.split('.')[0]}.` : `${routes.filter((r) => r.stops.includes(code)).length} services call here.`}
                </span>
              </span>
            </a>`;
        })}
      </div>
    </section>

    <section class="band band--night">
      <div class="section__head">
        <div>
          <h2>The milk runs</h2>
          <p>
            Circuits calling at each community in sequence, carrying passengers, mail, freight and
            country food. Two Baffin circuits alternate week by week, so everywhere on the island
            sees an aircraft each fortnight.
          </p>
        </div>
        <a class="section__more" href="${href('/milk-runs')}">All circuits</a>
      </div>
      <div class="grid-3" style="margin-top:var(--s5)">
        ${circuits.slice(0, 3).map((circuit) => {
          const first = circuitRoutes(circuit.id)[0];
          const dates = nextOperatingDates(first, today(), 2);
          const stops = [...new Set(circuitRoutes(circuit.id).flatMap((r) => r.stops))];
          return html`
            <a class="feature" href="${href(`/milk-runs/${circuit.id}`)}"
               style="background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);color:#fff">
              <span class="feature__title">${circuit.name}</span>
              <span class="feature__note" style="color:var(--on-chrome-muted)">
                ${stops.length} communities · ${first.cadence === 'weekly' ? 'weekly' : 'every other week'}
              </span>
              <span class="feature__link" style="color:var(--aurora)">
                Next ${dates.map((d) => formatDate(d, 'short')).join(' · ') || 'not scheduled'} →
              </span>
            </a>`;
        })}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>More than seats</h2><p>Most of what moves on this network is not a passenger.</p></div></div>
      <div class="grid-4">
        ${[
          ['/cargo', 'cargo', 'Cargo and freight', 'Quote and ship by the kilo — general freight, perishables, mail and country food.'],
          ['/charter', 'plane', 'Charter', 'Camp support, medical transfer, community travel. Five types, on demand.'],
          ['/groups', 'people', 'Group travel', 'Ten or more on one booking, with a held fare and late names.'],
          ['/assistance', 'accessible', 'Special assistance', 'Mobility, medical and travelling with children. Tell us before you fly.'],
        ].map(([path, iconName, title, body]) => html`
          <a class="feature" href="${href(path)}">
            <span class="feature__icon feature__icon--ice">${icon(iconName, { size: 20 })}</span>
            <span class="feature__title">${title}</span>
            <span class="feature__note">${body}</span>
          </a>`)}
      </div>
    </section>

    <section class="section">
      <div class="grid-2">
        <div class="band band--aurora" style="margin:0">
          <p class="page-head__eyebrow">${icon('star', { size: 15 })} ${loyalty.name}</p>
          <h2 style="margin-bottom:var(--s3)">${miles.toLocaleString('en-CA')} miles</h2>
          <p style="color:var(--ink-2)">
            You are ${tier.name}. Miles are earned on every fare and buy any seat on any day —
            no blackout dates, and no separate reward inventory.
          </p>
          <p style="margin-top:var(--s4)">
            <a class="btn btn--accent btn--sm" href="${href('/circle')}">About Circle</a>
            <a class="btn btn--secondary btn--sm" href="${href('/account/miles')}">My miles</a>
          </p>
        </div>
        <div class="band band--tint" style="margin:0">
          <p class="page-head__eyebrow">${icon('anchor', { size: 15 })} Owned here</p>
          <h2 style="margin-bottom:var(--s3)">An airline that answers to the North</h2>
          <p style="color:var(--ink-2)">
            Fares set here, schedules set here, and the decision to keep a thin route taken here.
            North Winds is a venture of ${airline.parent}, ${airline.base}.
          </p>
          <p style="margin-top:var(--s4)">
            <a class="btn btn--secondary btn--sm" href="${href('/story')}">Our story</a>
            <a class="btn btn--secondary btn--sm" href="${href('/careers')}">Careers</a>
          </p>
        </div>
      </div>
    </section>

    ${note(html`
      <strong>North Winds Airlines does not exist.</strong>
      This is a working prototype of the airline's site and app — it books nothing, charges nothing
      and holds no seat on any aircraft. <a href="${href('/about')}">What is real here and what is invented</a>.`,
      { kind: 'warn' })}`;

  return { title: null, body, bleed: true, onMount: wireSearchWidget };
}

const brandTint = (id) => ({
  altitude: 'rgba(44,130,174,.12)',
  express: 'rgba(23,132,95,.12)',
  connect: 'rgba(192,124,34,.14)',
}[id]);

/** Four communities to show on the home page — one per region, plus the hub. */
const featured = () => ['YFB', 'YXP', 'YIO', 'YCB'];

function tripCard(booking) {
  const journeyIndex = Math.max(0, booking.journeys.findIndex((j) => j.departUtc > Date.now()));
  const journey = booking.journeys[journeyIndex];
  const window = checkinWindow(journey);
  const checkedIn = Boolean(booking.checkedIn?.[journeyIndex]);
  const status = flightStatus(journey.segments[0]);

  return html`
    <section class="section" style="margin-top:var(--s8)">
      <div class="section__head">
        <h2>Your next trip</h2>
        <a class="section__more" href="${href('/trips')}">All trips</a>
      </div>
      <div class="card card--flush flight-card">
        <div class="flight-card__brand flight-card__brand--${journey.segments[0].brand}">
          <span>${formatDate(journey.departDate, 'long')}</span>
          <span class="grow"></span>
          <span class="tnum">${booking.reference}</span>
        </div>
        <div class="flight-card__body">
          ${journeyLine(journey)}
          <p class="row row--wrap" style="margin-top:var(--s4)">
            ${statusPill(status)}
            ${checkedIn ? html`<span class="badge badge--ok">${icon('check', { size: 14 })} Checked in</span>` : ''}
          </p>
        </div>
        <div class="flight-card__foot">
          <a class="btn btn--secondary btn--sm" href="${href(`/trips/${booking.reference}`)}">Manage</a>
          ${checkedIn
            ? html`<a class="btn btn--primary btn--sm" href="${href(`/pass/${booking.reference}/${journeyIndex}/0`)}">Boarding pass</a>`
            : window.state === 'open'
              ? html`<a class="btn btn--accent btn--sm" href="${href(`/checkin/${booking.reference}`)}">Check in</a>`
              : html`<span class="badge badge--outline">Check-in opens 24 h before departure</span>`}
        </div>
      </div>
    </section>`;
}
