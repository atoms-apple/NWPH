/**
 * Cargo, charter, groups, assistance, medical and duty travel.
 *
 * On this network these are not a sideline. More tonnage moves as freight than
 * as baggage, half the passenger travel is against a medical or duty
 * authorisation, and a charter is often the only way a community gets somewhere
 * at all. Each of these gets a real screen with a real quote, not a form that
 * says "contact us".
 */

import { html, raw, icon, on, $, $$, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState, setProfile } from '../lib/store.js';
import { airport, airportsByRegion, distanceKm } from '../data/airports.js';
import { aircraftType, seatCount } from '../data/aircraft.js';
import { cargoClasses, cargoClassById, charterAircraft, charterPurposes, groupTravel } from '../data/services.js';
import { assistanceTypes } from '../data/policies.js';
import { fareTypeById } from '../data/brand.js';
import { quoteCargo, quoteCharter, charterOptionsFor, chargeableWeight } from '../engine/services.js';
import { money, moneyRounded } from '../engine/pricing.js';
import { today, addDays, formatDate } from '../lib/dates.js';
import { pageHead, note, empty } from './ui.js';

const airportOptions = (selected) => airportsByRegion().map((group) => html`
  <optgroup label="${group.region.name}">
    ${group.airports.map((a) => html`
      <option value="${a.code}" ${a.code === selected ? raw('selected') : ''}>${a.name} — ${a.code}</option>`)}
  </optgroup>`);

/* ── Cargo ───────────────────────────────────────────────────────────────── */

export function cargoView() {
  const body = html`
    ${pageHead('Cargo and freight',
      'More weight moves on this network as freight than as baggage. General goods, perishables, mail, dangerous goods — and the country food that moves between communities, which is rated below everything else on purpose.')}

    <div class="grid-2" style="margin-bottom:var(--s8)">
      <a class="feature" href="${href('/cargo/quote')}">
        <span class="feature__icon">${icon('cargo', { size: 20 })}</span>
        <span class="feature__title">Get a quote</span>
        <span class="feature__note">Weight, dimensions and a routing gives you a price, the aircraft that will carry it, and what could hold it up.</span>
        <span class="feature__link">Quote a shipment →</span>
      </a>
      <a class="feature" href="${href('/contact')}">
        <span class="feature__icon feature__icon--ice">${icon('phone', { size: 20 })}</span>
        <span class="feature__title">Talk to the cargo desk</span>
        <span class="feature__note">Contract mail, project freight, dangerous goods and anything that will not fit a form.</span>
        <span class="feature__link">Contact us →</span>
      </a>
    </div>

    <section class="section">
      <div class="section__head"><div><h2>What we carry, and what it costs</h2><p>Rates are per chargeable kilogram, before distance and surcharges.</p></div></div>
      <div class="table-wrap">
        <table class="table table--zebra">
          <caption>Freight classes and base rates.</caption>
          <thead><tr><th>Class</th><th class="num">Rate / kg</th><th class="num">Minimum</th><th>Notes</th></tr></thead>
          <tbody>
            ${cargoClasses.map((c) => html`
              <tr>
                <td><strong>${c.name}</strong><br><span class="option__note">${c.detail}</span></td>
                <td class="num tnum">$${c.rate.toFixed(2)}</td>
                <td class="num tnum">$${c.minimum}</td>
                <td class="option__note">${c.lead}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>How freight is rated</h2></div></div>
      <div class="grid-3">
        ${[
          ['Chargeable weight', 'You pay on whichever is greater — what it weighs, or the space it takes. Volume is divided by 6,000 cm³ per kilo, which is why a box of insulation costs more than a box of bolts.'],
          ['Distance', 'A kilogram to Grise Fiord is not a kilogram to Pangnirtung. The rate scales with the sector flown.'],
          ['The aircraft available', 'Where a pairing is served only by the Twin Otter or the King Air, a small-community surcharge applies — those holds are measured in hundreds of kilos, not tonnes.'],
        ].map(([title, text]) => html`
          <div class="card"><h3 style="margin-bottom:var(--s2)">${title}</h3><p class="option__note">${text}</p></div>`)}
      </div>
    </section>

    ${note(html`
      <strong>Country food is rated below general freight, deliberately.</strong>
      Harvested meat and fish moving between communities is not a commercial shipment and is not
      priced like one. It travels in sealed coolers, kept frozen where the routing allows, at
      $2.40 a kilogram with a $38 minimum.`, { kind: 'ok' })}

    ${note(html`
      Hold space runs out before seats do on the smaller aircraft, and during sealift season
      (July to September) it runs out earlier still. Book freight early, and expect a circuit
      shipment to travel on the next service if the aircraft is at its limit.`,
      { kind: 'warn', title: 'Space is the constraint, not price' })}`;

  return { title: 'Cargo and freight', body };
}

export function cargoQuoteView({ query }) {
  const state = getState();
  const from = (query.from ?? state.profile.homeAirport ?? 'YFB').toUpperCase();
  const to = (query.to ?? (from === 'YFB' ? 'YIO' : 'YFB')).toUpperCase();
  const classId = query.class ?? 'general';
  const weight = Number(query.weight ?? 50);
  const length = Number(query.l ?? 60);
  const width = Number(query.w ?? 40);
  const height = Number(query.h ?? 40);
  const pieces = Number(query.pieces ?? 1);
  const insured = Number(query.insured ?? 0);

  let quote = null;
  let error = null;
  if (from !== to && weight > 0) {
    try {
      quote = quoteCargo({ from, to, classId, weightKg: weight, lengthCm: length, widthCm: width, heightCm: height, pieces, insuredValue: insured });
    } catch (e) { error = e.message; }
  } else if (from === to) {
    error = 'Choose two different communities.';
  }

  const body = html`
    ${pageHead('Freight quote', 'Weight, size and a routing. The quote shows the aircraft that will actually carry it and anything that could hold it up.')}

    <div class="with-rail">
      <form class="card" id="cargo-form" novalidate>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="c-from">Shipping from</label>
            <select class="select" id="c-from" name="from">${airportOptions(from)}</select>
          </div>
          <div class="field">
            <label class="field__label" for="c-to">Shipping to</label>
            <select class="select" id="c-to" name="to">${airportOptions(to)}</select>
          </div>
        </div>

        <div class="field">
          <label class="field__label" for="c-class">What are you shipping?</label>
          <select class="select" id="c-class" name="class">
            ${cargoClasses.map((c) => html`
              <option value="${c.id}" ${c.id === classId ? raw('selected') : ''}>${c.name} — $${c.rate.toFixed(2)}/kg</option>`)}
          </select>
          <span class="field__hint">${cargoClassById[classId]?.detail} ${cargoClassById[classId]?.lead}</span>
        </div>

        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="c-weight">Total weight (kg)</label>
            <input class="input tnum" type="number" id="c-weight" name="weight" value="${weight}" min="1" max="12000" inputmode="numeric">
          </div>
          <div class="field">
            <label class="field__label" for="c-pieces">Number of pieces</label>
            <input class="input tnum" type="number" id="c-pieces" name="pieces" value="${pieces}" min="1" max="200" inputmode="numeric">
          </div>
        </div>

        <fieldset style="border:0;padding:0;margin:0 0 var(--s4)">
          <legend class="field__label">Size of each piece (cm)</legend>
          <div class="field-group" style="grid-template-columns:repeat(3,1fr)">
            <div class="field" style="margin:0">
              <label class="field__label" for="c-l" style="font-size:var(--text-xs)">Length</label>
              <input class="input tnum" type="number" id="c-l" name="l" value="${length}" min="1" max="600" inputmode="numeric">
            </div>
            <div class="field" style="margin:0">
              <label class="field__label" for="c-w" style="font-size:var(--text-xs)">Width</label>
              <input class="input tnum" type="number" id="c-w" name="w" value="${width}" min="1" max="600" inputmode="numeric">
            </div>
            <div class="field" style="margin:0">
              <label class="field__label" for="c-h" style="font-size:var(--text-xs)">Height</label>
              <input class="input tnum" type="number" id="c-h" name="h" value="${height}" min="1" max="600" inputmode="numeric">
            </div>
          </div>
          <span class="field__hint">Air freight charges on weight or volume, whichever is greater.</span>
        </fieldset>

        <div class="field">
          <label class="field__label" for="c-insured">Declared value for insurance (optional)</label>
          <input class="input tnum" type="number" id="c-insured" name="insured" value="${insured}" min="0" max="500000" inputmode="numeric">
          <span class="field__hint">1.2% of declared value, minimum $15. Without it, liability is limited.</span>
        </div>

        <button class="btn btn--accent btn--block" type="submit">${icon('refresh', { size: 18 })} Update quote</button>
      </form>

      <aside class="with-rail__rail">
        ${error ? note(error, { kind: 'danger' }) : quote ? html`
          <div class="quote">
            <p class="quote__label">Estimated total</p>
            <p class="quote__amount">${money(quote.total)}</p>
            <p class="quote__note">
              ${quote.weight.chargeable} kg chargeable
              (${quote.weight.basis === 'volume' ? `volume — ${quote.weight.volumetric} kg dimensional beats ${quote.weight.actual} kg actual` : `actual weight, above ${quote.weight.volumetric} kg dimensional`})
              · ${quote.km} km
            </p>
          </div>

          <div class="card" style="margin-top:var(--s4)">
            <h2 class="card__title" style="margin-bottom:var(--s3)">Breakdown</h2>
            <dl class="price-lines">
              <div class="price-line"><dt>${quote.cargoClass.name} base</dt><dd>${money(quote.base)}</dd></div>
              ${quote.surcharges.map((s) => html`
                <div class="price-line price-line--muted"><dt>${s.name}</dt><dd>${money(s.amount)}</dd></div>`)}
              ${quote.fuel ? html`<div class="price-line price-line--muted"><dt>Fuel surcharge</dt><dd>${money(quote.fuel)}</dd></div>` : ''}
              ${quote.insurance ? html`<div class="price-line price-line--muted"><dt>Insurance</dt><dd>${money(quote.insurance)}</dd></div>` : ''}
              <div class="price-line price-line--muted"><dt>GST (5%)</dt><dd>${money(quote.gst)}</dd></div>
              <div class="price-line price-line--total"><dt>Total</dt><dd>${money(quote.total)}</dd></div>
            </dl>
          </div>

          <div class="card" style="margin-top:var(--s4)">
            <h2 class="card__title" style="margin-bottom:var(--s3)">Carried by</h2>
            <div class="stack stack--tight">
              ${quote.carriedBy.map((type) => html`
                <div class="row row--between">
                  <span>${type.name}</span>
                  <span class="option__note tnum">${type.cargoTonnes} t hold</span>
                </div>`)}
            </div>
            <p class="option__note" style="margin-top:var(--s3)">
              Smallest hold on this routing: ${quote.smallestHoldTonnes} t.
            </p>
          </div>

          ${quote.warnings.length ? html`
            <div class="stack stack--tight" style="margin-top:var(--s4)">
              ${quote.warnings.map((w) => note(w, { kind: 'warn' }))}
            </div>` : ''}

          <p style="margin-top:var(--s4)">
            <a class="btn btn--primary btn--block" href="${href('/contact')}">Book this shipment</a>
          </p>
          <p class="option__note" style="margin-top:var(--s2)">
            Freight is tendered at the counter in this prototype — there is no shipper account to
            book against.
          </p>` : ''}
      </aside>
    </div>`;

  return {
    title: 'Freight quote',
    body,
    onMount: (root) => {
      const form = $('#cargo-form', root);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        go(href('/cargo/quote', {
          from: form.from.value, to: form.to.value, class: form.class.value,
          weight: form.weight.value, pieces: form.pieces.value,
          l: form.l.value, w: form.w.value, h: form.h.value,
          insured: form.insured.value || null,
        }).slice(1));
      });
    },
  };
}

/* ── Charter ─────────────────────────────────────────────────────────────── */

export function charterView() {
  const body = html`
    ${pageHead('Charter an aircraft',
      'Medical transfers, camp support, community travel, project rotations. Five types across the fleet, quoted on the aircraft that can actually use both strips.')}

    <p style="margin-bottom:var(--s6)">
      <a class="btn btn--accent btn--lg" href="${href('/charter/quote')}">${icon('plane', { size: 18 })} Quote a charter</a>
    </p>

    <section class="section">
      <div class="section__head"><div><h2>The fleet, on demand</h2><p>Hourly rates are block hours — wheels off to wheels on, plus positioning.</p></div></div>
      <div class="stack">
        ${charterAircraft.map((spec) => {
          const type = aircraftType(spec.id);
          return html`
            <div class="card">
              <div class="row row--between row--wrap" style="margin-bottom:var(--s3)">
                <div>
                  <h3>${type.name}</h3>
                  <p class="option__note">${spec.note}</p>
                </div>
                <div style="text-align:right">
                  <div style="font-size:var(--text-xl);font-weight:740" class="tnum">$${spec.hourly.toLocaleString('en-CA')}</div>
                  <div class="option__note">per block hour</div>
                </div>
              </div>
              <dl class="kv-strip">
                <div><dt>Seats</dt><dd>${seatCount(spec.id)}</dd></div>
                <div><dt>Freight</dt><dd>${type.cargoTonnes} t</dd></div>
                <div><dt>Min runway</dt><dd>${type.minRunway} m</dd></div>
                <div><dt>Minimum</dt><dd>${spec.minHours} h</dd></div>
                <div><dt>Based at</dt><dd style="font-size:var(--text-base)">${airport(spec.base).name}</dd></div>
              </dl>
              <p class="option__note" style="margin-top:var(--s3)">
                <strong>Typically used for:</strong> ${spec.uses.join(' · ')}
              </p>
            </div>`;
        })}
      </div>
    </section>

    ${note(html`
      <strong>Positioning is the line people are surprised by.</strong>
      Unless the aircraft is already where you are, you pay for it to reach you and to get home
      again. Chartering out of the type's own base is much cheaper — the Twin Otter sits at
      Resolute, the ATR at Rankin Inlet, everything else at Iqaluit.`, { kind: 'warn' })}

    <section class="section">
      <div class="section__head"><div><h2>Medical transfers</h2></div></div>
      <div class="card">
        <p>
          Medical charters are arranged through our operations desk and are flown ahead of all
          other charter work. The King Air is the usual aircraft — pressurised, fast, and able to
          take a stretcher and an escort.
        </p>
        <p style="margin-bottom:0">
          Call the number on the <a href="${href('/contact')}">contact page</a> at any hour. A
          medical transfer is never held for a quote.
        </p>
      </div>
    </section>`;

  return { title: 'Charter', body };
}

export function charterQuoteView({ query }) {
  const state = getState();
  const from = (query.from ?? state.profile.homeAirport ?? 'YFB').toUpperCase();
  const to = (query.to ?? (from === 'YFB' ? 'YXP' : 'YFB')).toUpperCase();
  const returnTrip = query.return !== '0';
  const waitHours = Number(query.wait ?? 0);
  const purpose = query.purpose ?? 'community';

  const options = from !== to ? charterOptionsFor(from, to) : [];
  const quotes = options.map((spec) => quoteCharter({ typeId: spec.id, from, to, returnTrip, waitHours }))
    .sort((a, b) => a.total - b.total);

  const body = html`
    ${pageHead('Charter quote', 'Only the aircraft that can use both runways are shown. The rest is arithmetic: block hours, positioning, waiting time and handling.')}

    <div class="with-rail">
      <div>
        <form class="card" id="charter-form" novalidate style="margin-bottom:var(--s5)">
          <div class="field-group field-group--2">
            <div class="field">
              <label class="field__label" for="ch-from">From</label>
              <select class="select" id="ch-from" name="from">${airportOptions(from)}</select>
            </div>
            <div class="field">
              <label class="field__label" for="ch-to">To</label>
              <select class="select" id="ch-to" name="to">${airportOptions(to)}</select>
            </div>
          </div>
          <div class="field">
            <label class="field__label" for="ch-purpose">What is it for?</label>
            <select class="select" id="ch-purpose" name="purpose">
              ${charterPurposes.map((p) => html`
                <option value="${p.id}" ${p.id === purpose ? raw('selected') : ''}>${p.name}</option>`)}
            </select>
          </div>
          <div class="field-group field-group--2">
            <div class="field">
              <label class="field__label" for="ch-return">Trip</label>
              <select class="select" id="ch-return" name="return">
                <option value="1" ${returnTrip ? raw('selected') : ''}>Return — aircraft brings you back</option>
                <option value="0" ${!returnTrip ? raw('selected') : ''}>One way — drop off only</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="ch-wait">Waiting time (hours)</label>
              <input class="input tnum" type="number" id="ch-wait" name="wait" value="${waitHours}" min="0" max="12" inputmode="numeric">
              <span class="field__hint">Aircraft and crew held on the ground, billed at 35%.</span>
            </div>
          </div>
          <button class="btn btn--accent btn--block" type="submit">${icon('refresh', { size: 18 })} Update quote</button>
        </form>

        ${from === to ? note('Choose two different communities.', { kind: 'danger' })
          : quotes.length ? html`
          <div class="stack">
            ${quotes.map((q, index) => html`
              <div class="card ${index === 0 ? 'card--raised' : ''}">
                <div class="row row--between row--wrap" style="margin-bottom:var(--s3)">
                  <div>
                    <h3>${q.type.name}</h3>
                    <p class="option__note">
                      ${q.seats} seats · ${q.type.cargoTonnes} t · based at ${airport(q.positioningFrom).name}
                    </p>
                  </div>
                  ${index === 0 ? html`<span class="badge badge--aurora">Lowest quote</span>` : ''}
                </div>
                <dl class="deflist">
                  <div class="deflist__row"><dt>Flying — ${q.legHours} h each way${q.returnTrip ? ', return' : ''}</dt><dd>${q.flying} h</dd></div>
                  ${q.positioning ? html`<div class="deflist__row"><dt>Positioning from ${airport(q.positioningFrom).name}</dt><dd>${q.positioning} h</dd></div>` : ''}
                  ${q.waitHours ? html`<div class="deflist__row"><dt>Waiting — ${q.waitHours} h at 35%</dt><dd>${money(q.waiting)}</dd></div>` : ''}
                  <div class="deflist__row"><dt>Billable block hours (minimum ${q.spec.minHours} h)</dt><dd>${q.billable} h</dd></div>
                  <div class="deflist__row"><dt>Flight charge</dt><dd>${money(q.flightCost)}</dd></div>
                  <div class="deflist__row"><dt>Landing and handling</dt><dd>${money(q.handling)}</dd></div>
                  <div class="deflist__row"><dt>GST</dt><dd>${money(q.gst)}</dd></div>
                </dl>
                <div class="row row--between" style="margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid var(--line)">
                  <div>
                    <div style="font-size:var(--text-2xl);font-weight:740" class="tnum">${money(q.total)}</div>
                    <div class="option__note">${money(q.perSeat)} a seat if you fill it</div>
                  </div>
                  <a class="btn btn--primary" href="${href('/contact')}">Enquire</a>
                </div>
              </div>`)}
          </div>` : empty(
            'No aircraft can use both strips',
            `One of ${airport(from).name} (${airport(from).runway} m) and ${airport(to).name} (${airport(to).runway} m) is beyond every type in the fleet for this pairing. Call the charter desk — a two-leg routing is usually possible.`)}
      </div>

      <aside class="with-rail__rail">
        <div class="card card--sunken">
          <h2 class="card__title" style="margin-bottom:var(--s3)">How a charter is priced</h2>
          <ul style="margin:0;color:var(--ink-2)">
            <li>Block hours, wheels off to wheels on, rounded up to the quarter hour.</li>
            <li>Positioning both ways, unless the aircraft is already where you are.</li>
            <li>A minimum charge per type, whatever the sector.</li>
            <li>Waiting time at 35% of the hourly rate.</li>
            <li>Landing and handling at each end.</li>
          </ul>
          <p class="option__note" style="margin-top:var(--s3)">
            Fuel at remote strips, overnight crew costs and de-icing are quoted separately where
            they apply.
          </p>
        </div>
      </aside>
    </div>`;

  return {
    title: 'Charter quote',
    body,
    onMount: (root) => {
      const form = $('#charter-form', root);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        go(href('/charter/quote', {
          from: form.from.value, to: form.to.value,
          return: form.return.value, wait: form.wait.value || null, purpose: form.purpose.value,
        }).slice(1));
      });
    },
  };
}

/* ── Groups ──────────────────────────────────────────────────────────────── */

export function groupsView() {
  const body = html`
    ${pageHead('Group travel',
      `Ten or more travelling together on one booking — a team, a school group, a work rotation, a family gathering. The fare is held for the whole party, and names can come later.`)}

    <div class="grid-2" style="margin-bottom:var(--s8)">
      <div class="card">
        <h2 class="card__title" style="margin-bottom:var(--s3)">What a group booking gives you</h2>
        <ul style="margin:0;color:var(--ink-2)">
          ${groupTravel.benefits.map((benefit) => html`<li>${benefit}</li>`)}
        </ul>
      </div>
      <div class="card card--sunken">
        <h2 class="card__title" style="margin-bottom:var(--s3)">The terms</h2>
        <dl class="deflist">
          <div class="deflist__row"><dt>Minimum party</dt><dd>${groupTravel.minimum} travellers</dd></div>
          <div class="deflist__row"><dt>Deposit</dt><dd>${Math.round(groupTravel.deposit * 100)}%</dd></div>
          <div class="deflist__row"><dt>Fare held for</dt><dd>${groupTravel.holdDays} days</dd></div>
          <div class="deflist__row"><dt>Names due</dt><dd>${groupTravel.nameDeadlineDays} days before</dd></div>
        </dl>
        <p class="option__note" style="margin-top:var(--s3)">
          On the smaller aircraft a party of ten is most of the cabin. Book early — a group of
          twenty on a Dash 8 is two flights, and on a Twin Otter it is three.
        </p>
      </div>
    </div>

    <section class="section">
      <div class="section__head"><div><h2>Tell us about the group</h2><p>We reply within one business day with a held fare.</p></div></div>
      <form class="card" id="group-form" novalidate>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="g-kind">What kind of group?</label>
            <select class="select" id="g-kind">
              ${groupTravel.kinds.map((k) => html`<option value="${k.id}">${k.name}</option>`)}
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="g-size">How many travelling?</label>
            <input class="input tnum" type="number" id="g-size" value="12" min="${groupTravel.minimum}" max="200" inputmode="numeric">
          </div>
        </div>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="g-from">Leaving from</label>
            <select class="select" id="g-from">${airportOptions('YFB')}</select>
          </div>
          <div class="field">
            <label class="field__label" for="g-to">Going to</label>
            <select class="select" id="g-to">${airportOptions('YOW')}</select>
          </div>
        </div>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="g-out">Travelling out</label>
            <input class="input" type="date" id="g-out" value="${addDays(today(), 45)}" min="${today()}">
          </div>
          <div class="field">
            <label class="field__label" for="g-back">Coming back</label>
            <input class="input" type="date" id="g-back" value="${addDays(today(), 52)}" min="${today()}">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="g-name">Your name</label>
          <input class="input" id="g-name" autocomplete="name">
        </div>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="g-email">Email</label>
            <input class="input" type="email" id="g-email" autocomplete="email">
          </div>
          <div class="field">
            <label class="field__label" for="g-phone">Telephone</label>
            <input class="input" type="tel" id="g-phone" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="g-notes">Anything we should know</label>
          <textarea class="textarea" id="g-notes" placeholder="Equipment, freight, accessibility needs, flexible dates…"></textarea>
        </div>
        <p class="field__error" id="g-error" hidden></p>
        <button class="btn btn--accent" type="submit">Send the enquiry</button>
      </form>
    </section>`;

  return { title: 'Group travel', body, onMount: (root) => wireEnquiry(root, '#group-form', '#g-error', 'group enquiry') };
}

/* ── Special assistance ──────────────────────────────────────────────────── */

export function assistanceView() {
  const body = html`
    ${pageHead('Special assistance',
      'Tell us before you travel and it is arranged. Most of this network boards by airstair from the apron, so what you need on one flight may be different on the next.')}

    ${note(html`
      Everything on this page is provided free of charge except the unaccompanied minor service.
      Telling us early is not a formality — on a nine-seat aircraft, arrangements that need space
      have to be made before the load is planned.`, { kind: 'ok' })}

    <section class="section" style="margin-top:var(--s6)">
      <div class="section__head"><div><h2>What we can arrange</h2><p>Notice periods are the minimum; earlier is better.</p></div></div>
      <div class="stack stack--tight">
        ${assistanceTypes.map((type) => html`
          <div class="card">
            <div class="row row--top">
              <span class="feature__icon feature__icon--ice" style="width:2rem;height:2rem;margin:0">
                ${icon('accessible', { size: 16 })}
              </span>
              <div class="grow">
                <div class="option__title">${type.name}</div>
                <div class="option__note">${type.note}</div>
              </div>
              <span class="badge badge--outline">
                ${type.lead ? `${type.lead} h notice` : 'No notice needed'}
              </span>
            </div>
          </div>`)}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>Request assistance</h2><p>For a booking already made, or one you are about to make.</p></div></div>
      <form class="card" id="assist-form" novalidate>
        <div class="field">
          <label class="field__label" for="a-ref">Booking reference (if you have one)</label>
          <input class="input tnum" id="a-ref" placeholder="ABC123" style="text-transform:uppercase" maxlength="6">
        </div>
        <fieldset style="border:0;padding:0;margin:0 0 var(--s4)">
          <legend class="field__label">What do you need?</legend>
          <div class="option-list">
            ${assistanceTypes.map((type) => html`
              <label class="option">
                <input type="checkbox" name="assist" value="${type.id}">
                <span class="option__body">
                  <span class="option__title">${type.name}</span>
                  <span class="option__note">${type.note}</span>
                </span>
              </label>`)}
          </div>
        </fieldset>
        <div class="field">
          <label class="field__label" for="a-detail">Anything else we should know</label>
          <textarea class="textarea" id="a-detail" placeholder="The dimensions of a mobility aid, a battery type, a medical device…"></textarea>
        </div>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="a-name">Your name</label>
            <input class="input" id="a-name" autocomplete="name">
          </div>
          <div class="field">
            <label class="field__label" for="a-contact">Email or telephone</label>
            <input class="input" id="a-contact" autocomplete="email">
          </div>
        </div>
        <p class="field__error" id="a-error" hidden></p>
        <button class="btn btn--accent" type="submit">Send the request</button>
      </form>
    </section>

    ${note(html`
      If you are already at the airport and something has gone wrong, find an agent rather than
      filling in a form. Every community counter has someone who can help, and most of them speak
      Inuktitut.`, { kind: 'info' })}`;

  return { title: 'Special assistance', body, onMount: (root) => wireEnquiry(root, '#assist-form', '#a-error', 'assistance request') };
}

/* ── Medical travel ──────────────────────────────────────────────────────── */

export function medicalView() {
  const fare = fareTypeById.medical;
  const body = html`
    ${pageHead('Medical travel',
      'Booking against an approved medical travel authorisation. Half the passengers on some of these services are travelling for care, and the airline is built around that.')}

    <div class="grid-2" style="margin-bottom:var(--s8)">
      <div class="card">
        <h2 class="card__title" style="margin-bottom:var(--s3)">How it works</h2>
        <ol style="margin:0;color:var(--ink-2)">
          <li>Your health centre issues a travel authorisation with a number on it.</li>
          <li>Choose <strong>Medical travel</strong> as the fare type when you search, and enter the authorisation number for the first traveller.</li>
          <li>The fare is discounted ${Math.round(fare.discount * 100)}% and billed to the issuing authority rather than to you.</li>
          <li>An escort travelling on the same authorisation is booked on the same reference.</li>
        </ol>
      </div>
      <div class="card card--sunken">
        <h2 class="card__title" style="margin-bottom:var(--s3)">What we do differently</h2>
        <ul style="margin:0;color:var(--ink-2)">
          <li>Medical travel is carried ahead of all other classes where a flight must be offloaded for weight.</li>
          <li>Changes are free on a medical authorisation, whatever the fare family — appointments move.</li>
          <li>Where a flight is cancelled, medical passengers are rebooked first.</li>
          <li>Escorts, oxygen concentrators and mobility aids are arranged through <a href="${href('/assistance')}">special assistance</a>.</li>
        </ul>
      </div>
    </div>

    ${note(html`
      <strong>A stretcher case is a charter, not a scheduled seat.</strong>
      Those are flown on the King Air and arranged through the operations desk, at any hour.
      See <a href="${href('/charter')}">charter services</a>.`, { kind: 'warn' })}

    <p style="margin-top:var(--s6)">
      <a class="btn btn--accent btn--lg" href="${href('/book')}">Book a medical travel fare</a>
    </p>`;

  return { title: 'Medical travel', body };
}

/* ── Duty and corporate travel ───────────────────────────────────────────── */

export function corporateView() {
  const body = html`
    ${pageHead('Duty and corporate travel',
      'For organisations whose people travel this network regularly — government departments, health authorities, mining and construction, and the many organisations that operate across several communities.')}

    <div class="grid-3" style="margin-bottom:var(--s8)">
      ${[
        ['card', 'Billed accounts', 'Travel booked against an account code and invoiced monthly, with a statement by cost centre.'],
        ['swap', 'Flexible by default', 'Duty fares change without a fee. Plans on this network move for reasons nobody controls.'],
        ['people', 'Rotation management', 'Crew changes on a fixed cycle, held as a block, with names supplied close to departure.'],
      ].map(([iconName, title, body]) => html`
        <div class="card">
          <span class="feature__icon feature__icon--ice">${icon(iconName, { size: 20 })}</span>
          <h3 style="margin:var(--s2) 0">${title}</h3>
          <p class="option__note">${body}</p>
        </div>`)}
    </div>

    <section class="section">
      <div class="section__head"><div><h2>Open an account</h2><p>We reply within two business days.</p></div></div>
      <form class="card" id="corp-form" novalidate>
        <div class="field">
          <label class="field__label" for="co-org">Organisation</label>
          <input class="input" id="co-org" autocomplete="organization">
        </div>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="co-trips">Approximate trips a year</label>
            <select class="select" id="co-trips">
              <option>Fewer than 25</option><option>25 – 100</option><option>100 – 500</option><option>More than 500</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="co-base">Mainly based at</label>
            <select class="select" id="co-base">${airportOptions('YFB')}</select>
          </div>
        </div>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="co-name">Contact name</label>
            <input class="input" id="co-name" autocomplete="name">
          </div>
          <div class="field">
            <label class="field__label" for="co-email">Email</label>
            <input class="input" type="email" id="co-email" autocomplete="email">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="co-notes">What does the travel look like?</label>
          <textarea class="textarea" id="co-notes" placeholder="Routes, rotations, freight, anything unusual…"></textarea>
        </div>
        <p class="field__error" id="co-error" hidden></p>
        <button class="btn btn--accent" type="submit">Send the enquiry</button>
      </form>
    </section>`;

  return { title: 'Duty and corporate travel', body, onMount: (root) => wireEnquiry(root, '#corp-form', '#co-error', 'account enquiry') };
}

/* ── Shared enquiry handling ─────────────────────────────────────────────── */

/**
 * Every enquiry form on the site behaves the same way, and every one of them
 * says plainly that nothing is sent. A form that silently discards what someone
 * typed is worse than no form.
 */
function wireEnquiry(root, formSelector, errorSelector, label) {
  const form = $(formSelector, root);
  if (!form) return;
  const error = $(errorSelector, root);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = form.querySelector('input[type="email"], #a-contact');
    if (email && !email.value.trim()) {
      error.hidden = false;
      error.innerHTML = '<span>Enter an email address or telephone number so we can reply.</span>';
      announce('Enter an email address or telephone number so we can reply.');
      email.focus();
      return;
    }
    error.hidden = true;
    form.innerHTML = '';
    form.insertAdjacentHTML('beforeend', `
      <div class="note note--warn">
        <div>
          <strong>Nothing was sent.</strong>
          This is a prototype with no server behind it, so your ${label} has not gone anywhere and
          no one will reply. In a live version this form would reach the desk that handles it, and
          you would get a reference by email.
        </div>
      </div>`);
    announce('Nothing was sent — this is a prototype with no server behind it.');
  });
}
