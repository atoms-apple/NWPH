/**
 * The account area: overview, Circle, miles, saved travellers, payment methods,
 * notification preferences and travel credits.
 *
 * There is no sign-in because there is nothing to sign in to. What this holds
 * is what makes the next booking quicker, kept on the device, and clearable in
 * one press — and every screen says so rather than implying an account exists
 * somewhere.
 */

import { html, raw, icon, on, $, $$, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import {
  getState, setProfile, update, reset, storageIsPersistent, allBookings, totalMiles,
} from '../lib/store.js';
import { loyalty, airline, fareFamilyById } from '../data/brand.js';
import { airportsByRegion, airport } from '../data/airports.js';
import { hydrate } from '../engine/booking.js';
import { money } from '../engine/pricing.js';
import { formatDate, today } from '../lib/dates.js';
import { pageHead, note, empty } from './ui.js';

const tierFor = (miles) => [...loyalty.tiers].reverse().find((t) => miles >= t.threshold) ?? loyalty.tiers[0];

/* ── Overview ────────────────────────────────────────────────────────────── */

export function accountView() {
  const state = getState();
  const miles = totalMiles();
  const tier = tierFor(miles);
  const bookings = allBookings();
  const credits = state.credits.filter((c) => !c.spent);
  const initials = `${state.profile.firstName?.[0] ?? ''}${state.profile.lastName?.[0] ?? ''}`.toUpperCase() || 'NW';

  const body = html`
    ${pageHead('Your account', `Everything ${airline.shortName} keeps for you, which is everything on this device and nothing anywhere else.`)}

    <div class="card card--raised" style="margin-bottom:var(--s6)">
      <div class="row row--wrap">
        <span class="avatar">${initials}</span>
        <div class="grow">
          <div class="option__title" style="font-size:var(--text-md)">
            ${state.profile.firstName || state.profile.lastName
              ? `${state.profile.firstName} ${state.profile.lastName}`.trim()
              : 'No name saved yet'}
          </div>
          <div class="option__note">
            ${tier.name} · ${miles.toLocaleString('en-CA')} miles · home airport ${airport(state.profile.homeAirport ?? 'YFB').name}
          </div>
        </div>
        <a class="btn btn--secondary btn--sm" href="${href('/account/profile')}">Edit details</a>
      </div>
    </div>

    <div class="grid-4" style="margin-bottom:var(--s8)">
      <div class="stat-tile">
        <div class="stat-tile__label">Bookings</div>
        <div class="stat-tile__value">${bookings.length}</div>
        <div class="stat-tile__note">${bookings.filter((b) => b.status === 'confirmed').length} confirmed</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile__label">Miles</div>
        <div class="stat-tile__value">${miles.toLocaleString('en-CA')}</div>
        <div class="stat-tile__note">${tier.name}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile__label">Travel credit</div>
        <div class="stat-tile__value">${money(credits.reduce((sum, c) => sum + c.amount, 0))}</div>
        <div class="stat-tile__note">${credits.length} credit${credits.length === 1 ? '' : 's'}</div>
      </div>
      <div class="stat-tile">
        <div class="stat-tile__label">Saved travellers</div>
        <div class="stat-tile__value">${state.profile.savedTravellers.length}</div>
        <div class="stat-tile__note">For faster booking</div>
      </div>
    </div>

    <div class="cards" style="margin-bottom:var(--s8)">
      ${[
        ['/account/miles', 'star', 'My miles', 'Balance, activity and what the next tier needs.'],
        ['/account/travellers', 'people', 'Saved travellers', 'Family and colleagues you book for often.'],
        ['/account/payment', 'card', 'Payment methods', 'Cards kept on this device for faster checkout.'],
        ['/account/notifications', 'bell', 'Notifications', 'What we would message you about, and how.'],
        ['/credits', 'tag', 'Travel credits', 'What a cancellation left you, and when it expires.'],
        ['/trips', 'ticket', 'My trips', 'Every booking made on this device.'],
      ].map(([path, iconName, title, text]) => html`
        <a class="feature" href="${href(path)}">
          <span class="feature__icon feature__icon--ice">${icon(iconName, { size: 20 })}</span>
          <span class="feature__title">${title}</span>
          <span class="feature__note">${text}</span>
        </a>`)}
    </div>

    <section class="section">
      <div class="section__head"><div><h2>This device</h2></div></div>
      <div class="card">
        <dl class="deflist">
          <div class="deflist__row"><dt>Storage</dt><dd>${storageIsPersistent ? 'Saved on this device' : 'This session only'}</dd></div>
          <div class="deflist__row"><dt>Bookings stored</dt><dd>${bookings.length}</dd></div>
          <div class="deflist__row"><dt>Sent anywhere</dt><dd>Nothing</dd></div>
        </dl>
        ${storageIsPersistent ? '' : note(
          'Your browser is blocking local storage, so bookings will be lost when this tab closes. A private window usually does this.',
          { kind: 'warn' })}
        <div class="card__foot">
          <button type="button" class="btn btn--danger btn--sm" data-action="reset">
            ${icon('trash', { size: 15 })} Erase everything on this device
          </button>
        </div>
      </div>
    </section>`;

  return { title: 'Your account', body, onMount: wireReset };
}

function wireReset(root) {
  on(root, 'click', '[data-action="reset"]', () => {
    if (!window.confirm('Erase every booking, boarding pass and saved detail on this device? This cannot be undone.')) return;
    reset();
    window.nwToast?.('Everything erased.', 'ok');
    go('/');
  });
}

/* ── Profile ─────────────────────────────────────────────────────────────── */

export function profileView() {
  const profile = getState().profile;

  const body = html`
    ${pageHead('Your details', 'Saved on this device and offered on the next booking. Nothing is sent anywhere.')}

    <form class="card" id="profile-form" style="max-width:42rem">
      <div class="field-group field-group--2">
        <div class="field">
          <label class="field__label" for="p-first">First name</label>
          <input class="input" id="p-first" value="${profile.firstName}" autocomplete="given-name">
        </div>
        <div class="field">
          <label class="field__label" for="p-last">Last name</label>
          <input class="input" id="p-last" value="${profile.lastName}" autocomplete="family-name">
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="p-email">Email</label>
        <input class="input" type="email" id="p-email" value="${profile.email}" autocomplete="email">
      </div>
      <div class="field">
        <label class="field__label" for="p-phone">Mobile number</label>
        <input class="input" type="tel" id="p-phone" value="${profile.phone}" autocomplete="tel">
        <span class="field__hint">Used for delay and cancellation messages only.</span>
      </div>
      <div class="field">
        <label class="field__label" for="p-home">Home community</label>
        <select class="select" id="p-home">
          ${airportsByRegion().map((group) => html`
            <optgroup label="${group.region.name}">
              ${group.airports.map((a) => html`
                <option value="${a.code}" ${a.code === profile.homeAirport ? raw('selected') : ''}>${a.name} — ${a.code}</option>`)}
            </optgroup>`)}
        </select>
        <span class="field__hint">The default in search, on the status board and on the cargo quote.</span>
      </div>
      <button class="btn btn--accent" type="submit">Save</button>
    </form>`;

  return {
    title: 'Your details',
    body,
    onMount: (root) => {
      $('#profile-form', root).addEventListener('submit', (event) => {
        event.preventDefault();
        setProfile({
          firstName: $('#p-first', root).value.trim(),
          lastName: $('#p-last', root).value.trim(),
          email: $('#p-email', root).value.trim(),
          phone: $('#p-phone', root).value.trim(),
          homeAirport: $('#p-home', root).value,
        });
        window.nwToast?.('Saved on this device.', 'ok');
      });
    },
  };
}

/* ── Circle: the programme ───────────────────────────────────────────────── */

export function circleView() {
  const miles = totalMiles();
  const tier = tierFor(miles);

  const body = html`
    <section class="hero bleed" style="margin-bottom:var(--s8)">
      <div class="hero__sky"></div>
      <div class="hero__stars"></div>
      <div class="hero__inner" style="padding-block:var(--s12)">
        <p class="hero__eyebrow">${icon('star', { size: 16 })} ${loyalty.name}</p>
        <h1 style="max-width:18ch">Any seat, any day, no blackout dates</h1>
        <p class="hero__lede">
          Miles are earned on every fare and buy any seat we would otherwise sell. There is no
          separate reward inventory, because withholding seats from the people who fly most is not
          a loyalty programme.
        </p>
      </div>
    </section>

    <div class="grid-3" style="margin-bottom:var(--s8)">
      ${[
        ['Earn by distance and fare', 'A quarter of a mile per kilometre on Tundra, a half on Standard, one on Flex, one and a half on Summit. Credited after travel.'],
        ['Spend at 100 miles a dollar', 'Redemption is priced from the cash fare. Miles cover the base fare and fuel surcharge; government and airport charges are paid in cash because we remit them in cash.'],
        ['Never expire with activity', 'Miles stay while the account has any activity in a twenty-four month period.'],
      ].map(([title, text]) => html`
        <div class="card"><h2 class="card__title" style="margin-bottom:var(--s2)">${title}</h2><p class="option__note">${text}</p></div>`)}
    </div>

    <section class="section">
      <div class="section__head">
        <div><h2>Tiers</h2><p>Earned on miles flown in a calendar year, held for the following one.</p></div>
        <a class="section__more" href="${href('/circle/tiers')}">Full benefits</a>
      </div>
      <div class="grid-4">
        ${loyalty.tiers.map((t) => html`
          <div class="card ${t.id === tier.id ? 'card--raised' : ''}"
            style="${t.id === tier.id ? 'border-color:var(--aurora-600);box-shadow:0 0 0 1px var(--aurora-600)' : ''}">
            <div class="stat-tile__label">${t.threshold ? `${t.threshold.toLocaleString('en-CA')} miles` : 'From your first flight'}</div>
            <h3 style="margin:var(--s2) 0">${t.name}</h3>
            ${t.id === tier.id ? html`<p class="badge badge--aurora">You are here</p>` : ''}
            <ul style="margin:var(--s3) 0 0;padding-left:var(--s4);color:var(--ink-2);font-size:var(--text-sm)">
              ${t.benefits.slice(0, 3).map((b) => html`<li>${b}</li>`)}
            </ul>
          </div>`)}
      </div>
    </section>

    <div class="btn-row" style="margin-top:var(--s6)">
      <a class="btn btn--accent" href="${href('/account/miles')}">My miles</a>
      <a class="btn btn--secondary" href="${href('/book/redeem')}">Book with miles</a>
    </div>`;

  return { title: loyalty.name, body, bleed: true };
}

export function tiersView() {
  const miles = totalMiles();
  const tier = tierFor(miles);
  const allBenefits = [...new Set(loyalty.tiers.flatMap((t) => t.benefits))];

  const body = html`
    ${pageHead('Tiers and benefits', 'Earned on miles flown in a calendar year and held for the following one. You are currently ' + tier.name + '.')}

    <div class="table-wrap">
      <table class="table table--zebra">
        <caption>What each tier includes.</caption>
        <thead>
          <tr>
            <th>Benefit</th>
            ${loyalty.tiers.map((t) => html`
              <th class="num" style="${t.id === tier.id ? 'color:var(--aurora-deep)' : ''}">${t.name.replace('Circle ', '')}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${allBenefits.map((benefit) => html`
            <tr>
              <td>${benefit}</td>
              ${loyalty.tiers.map((t) => html`
                <td class="num">
                  ${t.benefits.includes(benefit) || (t.benefits.includes('All Gold benefits') && loyalty.tiers.find((x) => x.id === 'gold').benefits.includes(benefit))
                    ? html`<span style="color:var(--aurora-deep)">${icon('check', { size: 16 })}<span class="visually-hidden">Included</span></span>`
                    : html`<span class="option__note">—<span class="visually-hidden">Not included</span></span>`}
                </td>`)}
            </tr>`)}
          <tr>
            <td><strong>Miles flown to qualify</strong></td>
            ${loyalty.tiers.map((t) => html`<td class="num tnum"><strong>${t.threshold.toLocaleString('en-CA')}</strong></td>`)}
          </tr>
        </tbody>
      </table>
    </div>

    <p style="margin-top:var(--s6)">
      <a class="btn btn--accent" href="${href('/account/miles')}">My miles</a>
    </p>`;

  return { title: 'Tiers and benefits', body };
}

/* ── Miles activity ──────────────────────────────────────────────────────── */

export function milesView() {
  const state = getState();
  const miles = totalMiles();
  const tier = tierFor(miles);
  const index = loyalty.tiers.findIndex((t) => t.id === tier.id);
  const next = loyalty.tiers[index + 1];

  const activity = allBookings()
    .filter((b) => b.status === 'confirmed')
    .map(hydrate)
    .sort((a, b) => b.departUtc - a.departUtc);

  const body = html`
    ${pageHead('My miles', `${miles.toLocaleString('en-CA')} miles. You are ${tier.name}.`)}

    <div class="tier-card" style="margin-bottom:var(--s8)">
      <p class="tier-card__name">${loyalty.name} — ${tier.name}</p>
      <p class="tier-card__miles tnum">${miles.toLocaleString('en-CA')}<span style="font-size:var(--text-md);font-weight:500"> miles</span></p>
      ${next ? html`
        <div class="tier-card__bar">
          <div class="tier-card__fill" style="width:${Math.min(100, Math.round(((miles - tier.threshold) / (next.threshold - tier.threshold)) * 100))}%"></div>
        </div>
        <p class="tier-card__next">${(next.threshold - miles).toLocaleString('en-CA')} miles to ${next.name}</p>`
        : html`<p class="tier-card__next">Top tier reached for this year.</p>`}
    </div>

    <section class="section">
      <div class="section__head">
        <div><h2>Activity</h2><p>Miles are credited after travel.</p></div>
        <a class="section__more" href="${href('/circle/tiers')}">Tier benefits</a>
      </div>
      ${activity.length ? html`
        <div class="table-wrap">
          <table class="table">
            <caption>Miles earned on bookings made on this device.</caption>
            <thead><tr><th>Date</th><th>Journey</th><th>Fare</th><th class="num">Miles</th></tr></thead>
            <tbody>
              ${activity.map((booking) => html`
                <tr>
                  <td class="tnum" style="white-space:nowrap">${formatDate(booking.journeys[0].departDate, 'short')}</td>
                  <td>
                    <a href="${href(`/trips/${booking.reference}`)}">
                      ${airport(booking.journeys[0].from).name} → ${airport(booking.journeys[0].to).name}
                    </a>
                    ${booking.journeys.length > 1 ? html`<span class="option__note"> · return</span>` : ''}
                  </td>
                  <td>${booking.family.name}</td>
                  <td class="num tnum">+${(booking.miles ?? 0).toLocaleString('en-CA')}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>` : empty(
          'No activity yet',
          'Miles appear here once you have booked. Every fare earns, by distance flown and fare family.',
          html`<a class="btn btn--primary" href="${href('/book')}">Search flights</a>`)}
    </section>

    <div class="btn-row">
      <a class="btn btn--accent" href="${href('/book/redeem')}">Book with miles</a>
      <a class="btn btn--secondary" href="${href('/circle')}">About Circle</a>
    </div>`;

  return { title: 'My miles', body };
}

/* ── Saved travellers ────────────────────────────────────────────────────── */

export function travellersView() {
  const saved = getState().profile.savedTravellers;

  const body = html`
    ${pageHead('Saved travellers', 'People you book for often. Offered on the traveller details screen so you do not retype a name and a date of birth every time.')}

    ${saved.length ? html`
      <div class="stack stack--tight" style="margin-bottom:var(--s6)">
        ${saved.map((person, index) => html`
          <div class="card">
            <div class="row row--wrap">
              <span class="avatar">${(person.firstName[0] ?? '') + (person.lastName[0] ?? '')}</span>
              <div class="grow">
                <div class="option__title">${person.firstName} ${person.lastName}</div>
                <div class="option__note">
                  ${person.type === 'adult' ? 'Adult' : person.type === 'child' ? 'Child' : 'Infant'}
                  ${person.dob ? ` · born ${formatDate(person.dob, 'compact')}` : ''}
                  ${person.relationship ? ` · ${person.relationship}` : ''}
                </div>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" data-remove="${index}">
                ${icon('trash', { size: 15 })} Remove
              </button>
            </div>
          </div>`)}
      </div>` : note('No travellers saved yet. Add one below, or save them as you book.', { kind: 'info' })}

    <section class="section">
      <div class="section__head"><div><h2>Add a traveller</h2></div></div>
      <form class="card" id="trav-form" style="max-width:42rem" novalidate>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="t-first">First name</label>
            <input class="input" id="t-first">
          </div>
          <div class="field">
            <label class="field__label" for="t-last">Last name</label>
            <input class="input" id="t-last">
          </div>
        </div>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="t-type">Traveller type</label>
            <select class="select" id="t-type">
              <option value="adult">Adult — 12 and over</option>
              <option value="child">Child — 2 to 11</option>
              <option value="infant">Infant — under 2</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="t-dob">Date of birth (optional for adults)</label>
            <input class="input" type="date" id="t-dob" max="${today()}">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="t-rel">Relationship (optional)</label>
          <input class="input" id="t-rel" placeholder="Daughter, colleague, parent…">
        </div>
        <p class="field__error" id="t-error" hidden></p>
        <button class="btn btn--accent" type="submit">Save traveller</button>
      </form>
    </section>`;

  return {
    title: 'Saved travellers',
    body,
    onMount: (root) => {
      on(root, 'click', '[data-remove]', (event, button) => {
        const index = Number(button.dataset.remove);
        const profile = getState().profile;
        setProfile({ savedTravellers: profile.savedTravellers.filter((_, i) => i !== index) });
        window.nwToast?.('Traveller removed.', 'ok');
        go('/account/travellers');
      });

      $('#trav-form', root).addEventListener('submit', (event) => {
        event.preventDefault();
        const first = $('#t-first', root).value.trim();
        const last = $('#t-last', root).value.trim();
        const error = $('#t-error', root);
        if (!first || !last) {
          error.hidden = false;
          error.innerHTML = '<span>Enter both a first and a last name, as they appear on identification.</span>';
          announce('Enter both a first and a last name.');
          return;
        }
        const profile = getState().profile;
        setProfile({
          savedTravellers: [...profile.savedTravellers, {
            firstName: first,
            lastName: last,
            type: $('#t-type', root).value,
            dob: $('#t-dob', root).value || null,
            relationship: $('#t-rel', root).value.trim() || null,
          }],
        });
        window.nwToast?.('Traveller saved on this device.', 'ok');
        go('/account/travellers');
      });
    },
  };
}

/* ── Payment methods ─────────────────────────────────────────────────────── */

export function paymentMethodsView() {
  const cards = getState().profile.cards ?? [];

  const body = html`
    ${pageHead('Payment methods', 'Cards kept on this device to save typing at checkout.')}

    ${note(html`
      <strong>Do not enter a real card.</strong>
      This is a prototype. Nothing here is transmitted, validated or charged — but it is stored in
      this browser in plain text, which is exactly what a real payment form must never do. A live
      version would hold a token from a payment processor and never see the number at all.`,
      { kind: 'warn' })}

    ${cards.length ? html`
      <div class="stack stack--tight" style="margin:var(--s6) 0">
        ${cards.map((card, index) => html`
          <div class="card">
            <div class="row row--wrap">
              ${icon('card', { size: 22 })}
              <div class="grow">
                <div class="option__title tnum">•••• •••• •••• ${card.last4}</div>
                <div class="option__note">${card.label} · expires ${card.expiry}</div>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" data-remove-card="${index}">
                ${icon('trash', { size: 15 })} Remove
              </button>
            </div>
          </div>`)}
      </div>` : note('No cards saved on this device.', { kind: 'info' })}

    <section class="section">
      <div class="section__head"><div><h2>Add a card</h2></div></div>
      <form class="card" id="card-form" style="max-width:42rem" novalidate>
        <div class="field">
          <label class="field__label" for="cm-label">Label</label>
          <input class="input" id="cm-label" placeholder="Personal, work, department account">
        </div>
        <div class="field">
          <label class="field__label" for="cm-number">Card number</label>
          <input class="input tnum" id="cm-number" inputmode="numeric" value="4111 1111 1111 1111" autocomplete="off">
          <span class="field__hint">Pre-filled with a test number.</span>
        </div>
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="cm-expiry">Expiry</label>
            <input class="input tnum" id="cm-expiry" value="12/29" inputmode="numeric">
          </div>
          <div class="field">
            <label class="field__label" for="cm-name">Name on card</label>
            <input class="input" id="cm-name" autocomplete="off">
          </div>
        </div>
        <button class="btn btn--accent" type="submit">Save card</button>
      </form>
    </section>`;

  return {
    title: 'Payment methods',
    body,
    onMount: (root) => {
      on(root, 'click', '[data-remove-card]', (event, button) => {
        const index = Number(button.dataset.removeCard);
        const profile = getState().profile;
        setProfile({ cards: (profile.cards ?? []).filter((_, i) => i !== index) });
        go('/account/payment');
      });
      $('#card-form', root).addEventListener('submit', (event) => {
        event.preventDefault();
        const number = $('#cm-number', root).value.replace(/\s/g, '');
        const profile = getState().profile;
        setProfile({
          cards: [...(profile.cards ?? []), {
            label: $('#cm-label', root).value.trim() || 'Card',
            last4: number.slice(-4),
            expiry: $('#cm-expiry', root).value.trim(),
          }],
        });
        window.nwToast?.('Card saved on this device.', 'ok');
        go('/account/payment');
      });
    },
  };
}

/* ── Notifications ───────────────────────────────────────────────────────── */

const notificationKinds = [
  { id: 'disruption', name: 'Delays and cancellations', note: 'When a flight you are booked on moves. Strongly recommended on this network.', defaultOn: true },
  { id: 'checkin', name: 'Check-in opening', note: 'A reminder 24 hours before departure.', defaultOn: true },
  { id: 'boarding', name: 'Gate and boarding', note: 'On the day, when the gate is assigned and when boarding starts.', defaultOn: true },
  { id: 'baggage', name: 'Baggage offloaded', note: 'If your bag travels on a later service, and when it arrives.', defaultOn: true },
  { id: 'deals', name: 'Seat sales', note: 'Low fares on routes you have searched.', defaultOn: false },
  { id: 'circle', name: 'Circle statements', note: 'Miles credited, and tier progress each quarter.', defaultOn: false },
  { id: 'advisories', name: 'Travel advisories', note: 'Weather and disruption affecting your home community.', defaultOn: false },
];

export function notificationsView() {
  const prefs = getState().profile.notifications ?? {};

  const body = html`
    ${pageHead('Notifications', 'What we would message you about, and how. Disruption messages are the ones worth keeping on.')}

    ${note(html`
      Nothing is actually sent — there is no server to send it. These preferences are stored on
      this device so the choice is at least real.`, { kind: 'warn' })}

    <form class="card" id="notif-form" style="max-width:46rem;margin-top:var(--s6)">
      <div class="option-list">
        ${notificationKinds.map((kind) => {
          const on_ = prefs[kind.id] ?? kind.defaultOn;
          return html`
            <label class="option">
              <input type="checkbox" name="${kind.id}" ${on_ ? raw('checked') : ''}>
              <span class="option__body">
                <span class="option__title">${kind.name}</span>
                <span class="option__note">${kind.note}</span>
              </span>
            </label>`;
        })}
      </div>

      <hr>

      <fieldset style="border:0;padding:0;margin:0">
        <legend class="field__label">How to reach you</legend>
        <div class="option-list">
          <label class="option">
            <input type="checkbox" name="channel-sms" ${prefs['channel-sms'] ?? true ? raw('checked') : ''}>
            <span class="option__body">
              <span class="option__title">Text message</span>
              <span class="option__note">Works on a satellite connection when data does not.</span>
            </span>
          </label>
          <label class="option">
            <input type="checkbox" name="channel-email" ${prefs['channel-email'] ?? true ? raw('checked') : ''}>
            <span class="option__body">
              <span class="option__title">Email</span>
              <span class="option__note">Confirmations, receipts and statements.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <button class="btn btn--accent" type="submit" style="margin-top:var(--s5)">Save preferences</button>
    </form>`;

  return {
    title: 'Notifications',
    body,
    onMount: (root) => {
      $('#notif-form', root).addEventListener('submit', (event) => {
        event.preventDefault();
        const next = {};
        $$('#notif-form input[type="checkbox"]', root).forEach((input) => { next[input.name] = input.checked; });
        setProfile({ notifications: next });
        window.nwToast?.('Preferences saved.', 'ok');
      });
    },
  };
}

/* ── Travel credits ──────────────────────────────────────────────────────── */

export function creditsView() {
  const credits = getState().credits;
  const live = credits.filter((c) => !c.spent);
  const total = live.reduce((sum, c) => sum + c.amount, 0);

  const body = html`
    ${pageHead('Travel credits', 'What a cancellation left you. Offered at payment on your next booking.')}

    ${live.length ? html`
      <div class="quote" style="margin-bottom:var(--s6)">
        <p class="quote__label">Available</p>
        <p class="quote__amount">${money(total)}</p>
        <p class="quote__note">${live.length} credit${live.length === 1 ? '' : 's'}</p>
      </div>

      <div class="stack stack--tight">
        ${credits.map((credit) => {
          const issued = credit.issued.slice(0, 10);
          const expires = `${Number(issued.slice(0, 4)) + 1}${issued.slice(4)}`;
          return html`
            <div class="card ${credit.spent ? 'card--sunken' : ''}">
              <div class="row row--wrap">
                ${icon('tag', { size: 20 })}
                <div class="grow">
                  <div class="option__title">${money(credit.amount)}</div>
                  <div class="option__note">
                    From booking <a href="${href(`/trips/${credit.from}`)}">${credit.from}</a>,
                    issued ${formatDate(issued, 'long')}
                  </div>
                </div>
                <span class="badge ${credit.spent ? '' : 'badge--ok'}">
                  ${credit.spent ? 'Used' : `Valid to ${formatDate(expires, 'compact')}`}
                </span>
              </div>
            </div>`;
        })}
      </div>

      <p style="margin-top:var(--s6)">
        <a class="btn btn--accent" href="${href('/book')}">Use a credit — search flights</a>
      </p>` : empty(
        'No travel credits',
        'A credit appears here when you cancel a booking on a fare that carries one — Standard, Flex or Summit. Tundra fares carry none.',
        html`<a class="btn btn--primary" href="${href('/trips')}">My trips</a>`)}`;

  return { title: 'Travel credits', body };
}
