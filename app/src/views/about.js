/**
 * What this is, and what it is not.
 *
 * The corporation this airline belongs to publishes a site whose central claim
 * is that none of its ventures is operating yet. An app that books flights on
 * one of them has to say so plainly, in its own words, on a screen linked from
 * every other screen — not in a line of small print at the bottom.
 */

import { html, icon } from '../lib/dom.js';
import { href } from '../lib/router.js';
import { airline, brandList } from '../data/brand.js';
import { airports } from '../data/airports.js';
import { routes, circuits } from '../data/network.js';
import { aircraftList, seatCount } from '../data/aircraft.js';
import { pageHead, note } from './ui.js';

export default function aboutView() {
  const body = html`
    ${pageHead('About this app', `A working prototype of the ${airline.name} passenger app.`)}

    ${note(html`
      <strong>North Winds Airlines does not exist yet.</strong>
      No aircraft, no Air Operator Certificate, no seats for sale. This app is a design and
      engineering prototype of what the airline's booking app would be — it books nothing, charges
      nothing, and holds nothing on any aircraft.`, { kind: 'warn' })}

    <section class="section">
      <div class="section__head"><h2>What is real</h2></div>
      <div class="card">
        <ul style="margin:0">
          <li>The ${airports.length} communities and gateways, their coordinates, runway lengths and surfaces.</li>
          <li>Distances, block times and time zones — including Salliq staying on Eastern Standard Time all year.</li>
          <li>The aircraft types, their seating and what length of strip each one needs.</li>
          <li>The shape of the fares: base, fuel surcharge, NAV CANADA, airport improvement fee, security charge, GST.</li>
          <li>The constraint the whole network is built around — no road connects one Nunavut community to another.</li>
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>What is invented</h2></div>
      <div class="card">
        <ul style="margin:0">
          <li>The airline, its three service lines, its fleet and its ${routes.length} scheduled services.</li>
          <li>Every timetable, fare and seat map in the app.</li>
          <li>Load factors, delays and weather holds — generated, though from real causes.</li>
          <li>The ${circuits.length} circuits, including which weeks the two Baffin runs alternate on.</li>
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>How it works</h2></div>
      <div class="card">
        <p>
          Everything runs on the device. There is no server: the timetable is computed from route
          patterns and dates, fares from distance and demand, and bookings are stored in this
          browser. Nothing is sent anywhere, and nothing you type leaves the device.
        </p>
        <p>
          That is not only a property of a prototype. An app for this network has to work on a
          metered satellite link and on no link at all, so it is built to hold the timetable and
          your boarding passes locally and keep working when the signal does not.
        </p>
        <p style="margin-bottom:0">
          It has no dependencies. No framework, no build step for the application code, no fonts to
          download — which is why it is a few tens of kilobytes rather than a few hundred.
        </p>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>The three service lines</h2></div>
      <div class="stack stack--tight">
        ${brandList.map((brand) => html`
          <a class="card-button" href="${href(`/brand/${brand.id}`)}">
            <div class="row">
              <span class="brand-dot brand-dot--${brand.id}"></span>
              <span class="grow">
                <span class="option__title">${brand.name}</span>
                <span class="option__note">${brand.tagline}</span>
              </span>
              ${icon('forward', { size: 16 })}
            </div>
          </a>`)}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>The fleet</h2></div>
      <div class="table-wrap">
        <table class="table">
          <caption>Every type in the app, with the figures the schedule is built from.</caption>
          <thead>
            <tr><th>Type</th><th class="num">Seats</th><th class="num">Cruise</th><th class="num">Min runway</th><th>Surface</th></tr>
          </thead>
          <tbody>
            ${aircraftList.map((type) => html`
              <tr>
                <td>${type.name}</td>
                <td class="num tnum">${seatCount(type.id)}</td>
                <td class="num tnum">${type.cruiseKph} km/h</td>
                <td class="num tnum">${type.minRunway} m</td>
                <td>${type.gravelCapable ? 'Gravel or paved' : 'Paved only'}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><h2>Accessibility</h2></div>
      <div class="card">
        <p style="margin-bottom:0">
          Every control is reachable by keyboard, the seat map included — arrow keys move between
          seats and each one announces its row, position and price. Colour is never the only signal.
          Contrast is verified against the token system on every build, in light and dark theme, and
          a regression fails the build rather than shipping.
        </p>
      </div>
    </section>

    <section class="section">
      <div class="card card--quiet">
        <h2 class="card__title">${airline.parent}</h2>
        <p class="option__note" style="margin:var(--s2) 0 0">
          North Winds is the aviation venture in the NWPH portfolio. On the corporation's own site
          that venture is listed as planned — no company formed, no certification sought, no aircraft
          identified. This app describes what it would be, not what it is.
        </p>
      </div>
    </section>`;

  return { title: 'About this app', body };
}
