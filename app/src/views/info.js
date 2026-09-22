/**
 * Travel information: baggage, identification, advisories, help, contact and
 * the legal pages.
 *
 * These are the screens people reach with a specific question, usually in a
 * hurry, sometimes at a counter. So they lead with the answer and put the
 * reasoning underneath, rather than the other way round.
 */

import { html, raw, icon, on, $, $$, cx, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState } from '../lib/store.js';
import { baggage, identification, carriage, privacy } from '../data/policies.js';
import { categories, questions, byCategory, searchHelp } from '../data/help.js';
import { standing, liveAdvisories, activeAdvisories } from '../data/advisories.js';
import { fareFamilies, airline } from '../data/brand.js';
import { airport } from '../data/airports.js';
import { money } from '../engine/pricing.js';
import { formatDate, today } from '../lib/dates.js';
import { pageHead, note, empty } from './ui.js';

/* ── Baggage ─────────────────────────────────────────────────────────────── */

export function baggageView({ query }) {
  const family = query.family ?? 'standard';
  const travellers = Math.max(1, Number(query.pax ?? 1));
  const bags = Math.max(0, Number(query.bags ?? 2));
  const heavy = Math.max(0, Number(query.heavy ?? 0));
  const oversize = Math.max(0, Number(query.oversize ?? 0));
  const coolers = Math.max(0, Number(query.coolers ?? 0));

  const fare = fareFamilies.find((f) => f.id === family) ?? fareFamilies[1];
  const included = fare.checkedBags * travellers;
  const extraBags = Math.max(0, bags - included);
  const cost = extraBags * 65 + heavy * 90 + oversize * 110 + coolers * 45;

  const body = html`
    ${pageHead('Baggage',
      'What is included, what costs extra, and what will not be carried. The calculator prices a load before you get to the counter.')}

    <section class="section">
      <div class="section__head"><div><h2>What is included</h2><p>Per traveller, by fare family.</p></div></div>
      <div class="table-wrap">
        <table class="table table--zebra">
          <caption>Checked baggage included in each fare.</caption>
          <thead><tr><th>Fare</th><th class="num">Bags</th><th class="num">Each up to</th></tr></thead>
          <tbody>
            ${baggage.checked.rows.map((row) => html`
              <tr><td>${row.family}</td><td class="num tnum">${row.included}</td><td class="num tnum">${row.weight} kg</td></tr>`)}
          </tbody>
        </table>
      </div>
      <p class="option__note" style="margin-top:var(--s3)">
        Nothing over ${baggage.checked.maxWeight} kg is accepted as checked baggage at any fare,
        and nothing over ${baggage.checked.maxDimensions}.
      </p>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>Carry-on</h2><p>Included on every fare.</p></div></div>
      <div class="grid-2">
        ${baggage.carryOn.items.map((item) => html`
          <div class="card">
            <div class="option__title">${item.name}</div>
            <div class="option__note">${item.limit}</div>
            <p class="option__note" style="margin-top:var(--s2)">${item.note}</p>
          </div>`)}
      </div>
      ${note(baggage.carryOn.note, { kind: 'info', title: 'On the smallest aircraft' })}
    </section>

    <section class="section">
      <div class="section__head"><div><h2>What a load will cost</h2><p>Everything beyond what your fare includes.</p></div></div>
      <div class="with-rail">
        <form class="card" id="bag-form" novalidate>
          <div class="field-group field-group--2">
            <div class="field">
              <label class="field__label" for="b-family">Your fare</label>
              <select class="select" id="b-family" name="family">
                ${fareFamilies.map((f) => html`
                  <option value="${f.id}" ${f.id === family ? raw('selected') : ''}>${f.name} — ${f.checkedBags} bag${f.checkedBags > 1 ? 's' : ''} each</option>`)}
              </select>
            </div>
            <div class="field">
              <label class="field__label" for="b-pax">Travellers</label>
              <input class="input tnum" type="number" id="b-pax" name="pax" value="${travellers}" min="1" max="9" inputmode="numeric">
            </div>
          </div>
          <div class="field-group field-group--2">
            <div class="field">
              <label class="field__label" for="b-bags">Checked bags, total</label>
              <input class="input tnum" type="number" id="b-bags" name="bags" value="${bags}" min="0" max="20" inputmode="numeric">
              <span class="field__hint">${included} included with this fare for ${travellers} traveller${travellers > 1 ? 's' : ''}.</span>
            </div>
            <div class="field">
              <label class="field__label" for="b-heavy">Of those, over 23 kg</label>
              <input class="input tnum" type="number" id="b-heavy" name="heavy" value="${heavy}" min="0" max="20" inputmode="numeric">
            </div>
          </div>
          <div class="field-group field-group--2">
            <div class="field">
              <label class="field__label" for="b-oversize">Oversize items</label>
              <input class="input tnum" type="number" id="b-oversize" name="oversize" value="${oversize}" min="0" max="10" inputmode="numeric">
              <span class="field__hint">Skis, komatik parts, outboards, building materials.</span>
            </div>
            <div class="field">
              <label class="field__label" for="b-coolers">Country food coolers</label>
              <input class="input tnum" type="number" id="b-coolers" name="coolers" value="${coolers}" min="0" max="10" inputmode="numeric">
            </div>
          </div>
          <button class="btn btn--accent btn--block" type="submit">${icon('refresh', { size: 18 })} Work it out</button>
        </form>

        <aside class="with-rail__rail">
          <div class="quote">
            <p class="quote__label">Baggage charges</p>
            <p class="quote__amount">${money(cost * 100)}</p>
            <p class="quote__note">
              ${extraBags ? `${extraBags} bag${extraBags > 1 ? 's' : ''} beyond your allowance` : 'Within your allowance'}
              ${heavy ? ` · ${heavy} overweight` : ''}${oversize ? ` · ${oversize} oversize` : ''}${coolers ? ` · ${coolers} cooler${coolers > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          ${extraBags || heavy || oversize || coolers ? html`
            <div class="card" style="margin-top:var(--s4)">
              <dl class="deflist">
                ${extraBags ? html`<div class="deflist__row"><dt>Additional bags × ${extraBags}</dt><dd>${money(extraBags * 6500)}</dd></div>` : ''}
                ${heavy ? html`<div class="deflist__row"><dt>Overweight × ${heavy}</dt><dd>${money(heavy * 9000)}</dd></div>` : ''}
                ${oversize ? html`<div class="deflist__row"><dt>Oversize × ${oversize}</dt><dd>${money(oversize * 11000)}</dd></div>` : ''}
                ${coolers ? html`<div class="deflist__row"><dt>Country food × ${coolers}</dt><dd>${money(coolers * 4500)}</dd></div>` : ''}
              </dl>
            </div>` : ''}
          <p class="option__note" style="margin-top:var(--s3)">
            Adding these at booking is cheaper than at the counter, and lets the load be planned
            before the aircraft is loaded.
          </p>
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>Every charge</h2></div></div>
      <div class="table-wrap">
        <table class="table table--zebra">
          <caption>Baggage and freight charges beyond the fare allowance.</caption>
          <thead><tr><th>Item</th><th class="num">Charge</th><th>Notes</th></tr></thead>
          <tbody>
            ${baggage.fees.map((fee) => html`
              <tr><td>${fee.name}</td><td class="num tnum">$${fee.price} <span class="option__note">${fee.unit}</span></td><td class="option__note">${fee.note}</td></tr>`)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>Restricted and prohibited</h2><p>What the rules actually are up here.</p></div></div>
      <div class="faq">
        ${baggage.restricted.map((item) => html`
          <details class="faq__item">
            <summary>${item.title}</summary>
            <div class="faq__body"><p>${item.body}</p></div>
          </details>`)}
      </div>
    </section>

    ${note(baggage.delayed, { kind: 'warn', title: 'If your bag does not travel with you' })}`;

  return {
    title: 'Baggage',
    body,
    onMount: (root) => {
      const form = $('#bag-form', root);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        go(href('/baggage', {
          family: form.family.value, pax: form.pax.value, bags: form.bags.value,
          heavy: form.heavy.value, oversize: form.oversize.value, coolers: form.coolers.value,
        }).slice(1));
      });
    },
  };
}

/* ── Identification ──────────────────────────────────────────────────────── */

export function documentsView() {
  const body = html`
    ${pageHead('Identification', identification.intro)}

    <div class="grid-2" style="margin-bottom:var(--s8)">
      <div class="card">
        <h2 class="card__title" style="margin-bottom:var(--s3)">What we accept</h2>
        <ul style="margin:0;color:var(--ink-2)">${identification.accepted.map((item) => html`<li>${item}</li>`)}</ul>
      </div>
      <div class="stack">
        <div class="card card--sunken">
          <h3 style="margin-bottom:var(--s2)">Children</h3>
          <p class="option__note">${identification.children}</p>
        </div>
        <div class="card card--sunken">
          <h3 style="margin-bottom:var(--s2)">Unaccompanied minors</h3>
          <p class="option__note">${identification.unaccompanied}</p>
        </div>
      </div>
    </div>

    ${note(identification.noId, { kind: 'warn', title: 'If you cannot produce identification' })}

    <section class="section" style="margin-top:var(--s8)">
      <div class="card card--quiet">
        <h2 class="card__title">Travelling internationally</h2>
        <p class="option__note" style="margin-top:var(--s2)">
          North Winds flies only within Canada. Where your journey continues abroad from one of
          our southern gateways, that carrier's document requirements apply and you should check
          them directly — a ticket with us is no part of that contract.
        </p>
      </div>
    </section>`;

  return { title: 'Identification', body };
}

/* ── Advisories ──────────────────────────────────────────────────────────── */

export function advisoriesView() {
  const live = liveAdvisories();
  const now = today();

  const body = html`
    ${pageHead('Travel advisories',
      'What the network is doing, and the standing facts about operating here. Live advisories are drawn from the same schedule the status board reads, so the two cannot disagree.')}

    <p class="option__note" style="margin-bottom:var(--s5)">Updated ${formatDate(now, 'long')}</p>

    <section class="section">
      <div class="section__head">
        <div><h2>In force now</h2><p>Disruption over the next three days.</p></div>
        <a class="section__more" href="${href('/flights')}">Flight status</a>
      </div>
      ${live.length ? html`
        <div class="stack">
          ${live.map((advisory) => html`
            <div class="advisory ${advisory.severity === 'severe' ? 'advisory--severe' : ''}">
              ${icon(advisory.severity === 'severe' ? 'close' : 'warning', { size: 20 })}
              <div class="grow">
                <p class="advisory__title">${advisory.title}</p>
                <p style="margin:0">${advisory.body}</p>
                <p class="advisory__meta">
                  ${advisory.stops.map((code) => airport(code).name).join(' · ')}
                  · <a href="${href('/flights', { flight: advisory.flightNumber, date: advisory.date })}">See this flight</a>
                </p>
              </div>
            </div>`)}
        </div>` : html`
        <div class="advisory advisory--info">
          ${icon('check', { size: 20 })}
          <div>
            <p class="advisory__title">Nothing disrupted</p>
            <p style="margin:0">Every scheduled service over the next three days is planned to operate.</p>
          </div>
        </div>`}
    </section>

    <section class="section">
      <div class="section__head"><div><h2>Standing advisories</h2><p>True whether or not anything is going wrong today.</p></div></div>
      <div class="stack">
        ${standing.map((advisory) => html`
          <div class="advisory ${advisory.severity === 'warn' ? '' : 'advisory--info'}">
            ${icon(advisory.severity === 'warn' ? 'warning' : 'info', { size: 20 })}
            <div>
              <p class="advisory__title">${advisory.title}</p>
              <p style="margin:0">${advisory.body}</p>
              ${advisory.months ? html`
                <p class="advisory__meta">
                  In force ${advisory.months.map((m) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]).join(', ')}
                </p>` : ''}
            </div>
          </div>`)}
      </div>
    </section>

    ${note(html`
      Where a flight is cancelled or substantially delayed we carry you on the next available
      service at no charge, or refund the unused portion in full. Change fees are waived on any
      ticket held through a published disruption, whatever the fare.
      <a href="${href('/legal')}">Conditions of carriage</a>.`, { kind: 'info' })}`;

  return { title: 'Travel advisories', body };
}

/* ── Help centre ─────────────────────────────────────────────────────────── */

export function helpView({ query }) {
  const search = (query.q ?? '').trim();
  const category = query.c ?? null;
  const results = search ? searchHelp(search) : null;
  const shown = results ?? (category ? byCategory(category) : questions);

  const body = html`
    ${pageHead('Help centre', 'Answers to what people actually ask. If the answer is not here, the contact page has a human on it.')}

    <div class="field" style="max-width:34rem;margin-bottom:var(--s6)">
      <label class="visually-hidden" for="help-search">Search help</label>
      <div class="searchfield">
        ${icon('search', { size: 18 })}
        <input class="input" id="help-search" placeholder="Search — try “country food” or “refund”"
          value="${search}" autocomplete="off">
      </div>
    </div>

    ${search ? html`
      <p class="option__note" role="status" style="margin-bottom:var(--s4)">
        ${shown.length} result${shown.length === 1 ? '' : 's'} for “${search}”
      </p>` : html`
      <div class="chips" style="margin-bottom:var(--s6)">
        <button type="button" class="chip ${!category ? 'is-active' : ''}" data-help-cat="">Everything</button>
        ${categories.map((c) => html`
          <button type="button" class="chip ${category === c.id ? 'is-active' : ''}" data-help-cat="${c.id}">
            ${icon(c.icon, { size: 14 })} ${c.name}
          </button>`)}
      </div>`}

    ${shown.length ? html`
      <div class="faq">
        ${shown.map((question) => html`
          <details class="faq__item" id="q-${question.id}">
            <summary>${question.q}</summary>
            <div class="faq__body">
              ${question.a.map((paragraph) => html`<p>${paragraph}</p>`)}
              <p class="option__note">
                ${categories.find((c) => c.id === question.category)?.name}
              </p>
            </div>
          </details>`)}
      </div>` : empty(
        'Nothing matches that',
        'Try a different word, or browse by category. The contact page has our reservations line.',
        html`<a class="btn btn--primary" href="${href('/contact')}">Contact us</a>`)}

    <section class="section" style="margin-top:var(--s10)">
      <div class="grid-3">
        ${[
          ['/contact', 'phone', 'Still stuck?', 'Reservations, baggage, cargo and complaints — with the hours each desk keeps.'],
          ['/legal', 'doc', 'Conditions of carriage', 'The contract a ticket makes, in the order the questions come up.'],
          ['/accessibility', 'accessible', 'Accessibility', 'How this site is built, and what is still outstanding.'],
        ].map(([path, iconName, title, text]) => html`
          <a class="feature" href="${href(path)}">
            <span class="feature__icon feature__icon--ice">${icon(iconName, { size: 20 })}</span>
            <span class="feature__title">${title}</span>
            <span class="feature__note">${text}</span>
          </a>`)}
      </div>
    </section>`;

  return {
    title: 'Help centre',
    body,
    onMount: (root) => {
      const input = $('#help-search', root);
      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          go(href('/help', { q: input.value.trim() || null }).slice(1), { replace: true });
        }, 250);
      });
      on(root, 'click', '[data-help-cat]', (event, button) => {
        go(href('/help', { c: button.dataset.helpCat || null }).slice(1));
      });
    },
  };
}

/* ── Contact ─────────────────────────────────────────────────────────────── */

const desks = [
  { name: 'Reservations', phone: '1-800-555-0142', hours: 'Every day, 06:00 – 22:00 ET', note: 'Booking, changes, fares and refunds. Inuktitut-speaking agents on every shift.' },
  { name: 'Baggage', phone: '1-800-555-0148', hours: 'Every day, 07:00 – 21:00 ET', note: 'Delayed, damaged or missing baggage. Have your reference and bag tag to hand.' },
  { name: 'Cargo', phone: '1-800-555-0151', hours: 'Monday to Saturday, 08:00 – 18:00 ET', note: 'Freight bookings, rates, dangerous goods and contract mail.' },
  { name: 'Charter and medical', phone: '1-800-555-0155', hours: 'Twenty-four hours', note: 'Charter quotes, medical transfers and anything that cannot wait.' },
  { name: 'Group travel', phone: '1-800-555-0159', hours: 'Monday to Friday, 08:00 – 17:00 ET', note: 'Ten or more travelling together.' },
  { name: 'Accessibility', phone: '1-800-555-0162', hours: 'Every day, 07:00 – 21:00 ET', note: 'Special assistance, mobility aids and medical equipment.' },
];

export function contactView() {
  const body = html`
    ${pageHead('Contact us', 'Six desks, each with the hours it actually keeps. Every community counter has an agent, and most of them speak Inuktitut.')}

    <div class="cards" style="margin-bottom:var(--s8)">
      ${desks.map((desk) => html`
        <div class="card">
          <h2 class="card__title">${desk.name}</h2>
          <p style="margin:var(--s2) 0">
            <a href="tel:${desk.phone.replace(/-/g, '')}" style="font-size:var(--text-lg);font-weight:700">
              ${icon('phone', { size: 16 })} ${desk.phone}
            </a>
          </p>
          <p class="option__note">${desk.hours}</p>
          <p class="option__note" style="margin-top:var(--s2)">${desk.note}</p>
        </div>`)}
    </div>

    <div class="grid-2">
      <div class="card">
        <h2 class="card__title" style="margin-bottom:var(--s3)">By email</h2>
        <dl class="deflist">
          <div class="deflist__row"><dt>Reservations</dt><dd style="font-weight:500">${airline.supportEmail}</dd></div>
          <div class="deflist__row"><dt>Cargo</dt><dd style="font-weight:500">cargo@northwinds.example</dd></div>
          <div class="deflist__row"><dt>Baggage claims</dt><dd style="font-weight:500">baggage@northwinds.example</dd></div>
          <div class="deflist__row"><dt>Accessibility</dt><dd style="font-weight:500">access@northwinds.example</dd></div>
          <div class="deflist__row"><dt>Media</dt><dd style="font-weight:500">media@northwinds.example</dd></div>
        </dl>
      </div>
      <div class="card card--sunken">
        <h2 class="card__title" style="margin-bottom:var(--s3)">Head office</h2>
        <p style="color:var(--ink-2)">
          ${airline.name}<br>
          ${airline.base}<br>
          X0A 0H0<br>
          Canada
        </p>
        <p class="option__note" style="margin-top:var(--s3)">
          A venture of ${airline.parent}. Written claims — baggage, refunds, complaints — go to
          this address or to the relevant desk by email.
        </p>
      </div>
    </div>

    ${note(html`
      <strong>None of these reach anyone.</strong>
      North Winds does not exist, so the numbers and addresses on this page are illustrative. They
      are formatted as real ones would be because a contact page with placeholders in it tells you
      nothing about what the real one would look like.`, { kind: 'warn' })}`;

  return { title: 'Contact us', body };
}

/* ── Legal pages ─────────────────────────────────────────────────────────── */

/** Conditions of carriage and the privacy notice share a shape. */
function policyPage(title, lede, sections) {
  const body = html`
    ${pageHead(title, lede)}
    <div class="with-contents">
      <nav class="with-contents__nav" aria-label="On this page">
        <ul class="contents-list">
          ${sections.map((section) => html`
            <li><a href="#${section.id}">${section.heading}</a></li>`)}
        </ul>
      </nav>
      <div class="prose">
        ${sections.map((section) => html`
          <h2 id="${section.id}">${section.heading}</h2>
          ${section.body.map((paragraph) => html`<p>${paragraph}</p>`)}`)}
      </div>
    </div>`;
  return { title, body };
}

export const legalView = () => policyPage(
  'Conditions of carriage',
  'The contract a ticket makes, in the order the questions come up. Where these and a fare rule disagree, the fare rule governs the fare and these govern everything else.',
  carriage);

export const privacyView = () => policyPage(
  'Privacy notice',
  'What this app stores, where it stores it, and what a real airline would have to do differently.',
  privacy);

/* ── Accessibility ───────────────────────────────────────────────────────── */

export function accessibilityView() {
  const body = html`
    ${pageHead('Accessibility',
      'How this site is built, what is verified on every build, and what is still outstanding. Written plainly because an accessibility statement that only claims compliance is not one.')}

    <section class="section">
      <div class="section__head"><div><h2>What is built in</h2></div></div>
      <div class="grid-2">
        ${[
          ['Keyboard throughout', 'Every control is reachable and operable by keyboard, the seat map included — arrow keys move between seats, and each announces its row, position, whether it is an exit row, its price and whether it is taken.'],
          ['Never colour alone', 'Seat states differ in fill and weight as well as hue; flight status carries an icon and a word; the three service lines are named as well as coloured.'],
          ['Contrast, verified', 'Every text-and-surface pair in both themes is checked against the stylesheet on every build. A regression fails the build rather than shipping.'],
          ['Focus and announcements', 'Focus moves into the content on every navigation and is always visible. A live region announces route changes, seat selections and validation errors.'],
          ['Targets and reach', 'Every interactive target is at least 44 by 44 pixels, and the bottom bar clears the home indicator on a phone.'],
          ['Motion and theme', 'Reduced motion is respected. The site renders in the reader’s own light or dark theme, both designed rather than inverted.'],
        ].map(([title, text]) => html`
          <div class="card">
            <div class="row row--top">
              ${icon('check', { size: 18 })}
              <div><div class="option__title">${title}</div><div class="option__note">${text}</div></div>
            </div>
          </div>`)}
      </div>
    </section>

    <section class="section">
      <div class="section__head"><div><h2>What is outstanding</h2></div></div>
      <div class="stack stack--tight">
        ${[
          'The seat map is a grid of buttons with descriptive labels. It has not been tested with a screen reader by someone who uses one daily, which is the only test that counts.',
          'The route map is an image with a text alternative naming what it shows, but the communities on it are not individually reachable. The destinations list is the accessible equivalent and carries the same information.',
          'Date fields use the browser’s native date picker, whose accessibility varies between browsers and is not ours to fix.',
          'No part of this has been audited by an external assessor.',
        ].map((item) => html`
          <div class="card card--quiet">
            <div class="row row--top">${icon('info', { size: 18 })}<div class="option__note">${item}</div></div>
          </div>`)}
      </div>
    </section>

    <section class="section">
      <div class="card">
        <h2 class="card__title" style="margin-bottom:var(--s3)">Travelling with a disability</h2>
        <p style="color:var(--ink-2)">
          Assistance at the airport and on board is arranged through
          <a href="${href('/assistance')}">special assistance</a>, free of charge. The accessibility
          desk is on the <a href="${href('/contact')}">contact page</a>.
        </p>
        <p class="option__note" style="margin-bottom:0">
          If something on this site stopped you doing what you came to do, that is a defect and we
          want to know about it.
        </p>
      </div>
    </section>`;

  return { title: 'Accessibility', body };
}
