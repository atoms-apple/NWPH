/**
 * Fare selection.
 *
 * One family applies to the whole booking, outbound and return alike, which is
 * how these tickets are actually sold and what makes the change and cancel
 * rules explainable in one sentence later.
 *
 * Anything a family does not include is listed as plainly as what it does. A
 * fare screen that shows only the ticks is how someone finds out at the counter
 * that their ticket cannot be changed.
 */

import { html, raw, icon, on } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getCheckout, setCheckout, getState, checkoutComplete } from '../lib/store.js';
import { itineraryFromRefs } from '../engine/search.js';
import { priceItinerary, familyAvailable, familySeatsLeft, money, moneyRounded } from '../engine/pricing.js';
import { fareFamilies, fareTypeById } from '../data/brand.js';
import { today, daysBetween, formatDate } from '../lib/dates.js';
import { steps, note, journeyLine, legList, pageHead } from './ui.js';

export default function faresView() {
  const checkout = getCheckout();
  if (!checkoutComplete(checkout)) return { redirect: '/book' };

  const search = checkout.search ?? getState().search;
  const journeys = checkout.journeys.map(itineraryFromRefs).filter(Boolean);
  if (journeys.length !== checkout.journeys.length) return { redirect: '/book' };
  const outbound = journeys[0];
  const daysAhead = Math.max(0, daysBetween(today(), outbound.departDate));
  const fareType = fareTypeById[search.fareType] ?? fareTypeById.standard;

  /** Total across every journey, for one family. */
  const quote = (familyId) => journeys.reduce((sum, journey) => sum + priceItinerary(journey, {
    family: familyId,
    fareType: search.fareType,
    passengers: search.passengers,
    daysAhead: Math.max(0, daysBetween(today(), journey.departDate)),
  }).total, 0);

  const available = (familyId) => journeys.every((journey) => familyAvailable(journey, familyId));
  const cheapest = Math.min(...fareFamilies.filter((f) => available(f.id)).map((f) => quote(f.id)));

  const body = html`
    ${steps('fare')}
    ${pageHead('Choose a fare', 'The fare family applies to the whole booking. What each one allows is set out in full — including what it does not.')}

    <div class="card card--sunken" style="margin-bottom:var(--s5)">
      ${journeys.map((journey, index) => html`
        ${index ? html`<hr>` : ''}
        <p class="option__note">${checkout.legs[index]?.label ?? `Flight ${index + 1}`} · ${formatDate(journey.departDate, 'long')}</p>
        ${journeyLine(journey)}`)}
    </div>

    ${fareType.discount ? note(html`
      <strong>${fareType.name} applied — ${Math.round(fareType.discount * 100)}% off the base fare.</strong>
      ${fareType.note}${fareType.requiresId ? html` The ${fareType.requiresId.toLowerCase()} is collected on the next screen.` : ''}`,
      { kind: 'ok' }) : ''}

    <div class="fares" style="margin-top:var(--s4)">
      ${fareFamilies.map((family) => {
        const sellable = available(family.id);
        const total = sellable ? quote(family.id) : null;
        const left = sellable ? Math.min(...journeys.map((j) => familySeatsLeft(j, family.id))) : 0;
        const isSelected = checkout.family === family.id;
        return html`
          <button type="button" class="fare ${isSelected ? 'is-selected' : ''}"
            data-family="${family.id}" ${sellable ? '' : raw('disabled')}
            aria-pressed="${isSelected ? 'true' : 'false'}">
            ${sellable && total === cheapest ? html`<span class="fare__flag">Lowest fare</span>` : ''}
            ${family.id === 'flex' ? html`<span class="fare__flag" style="background:var(--express);color:#fff">Most flexible for the price</span>` : ''}
            <div class="fare__head">
              <div class="fare__name">${family.name}</div>
              <div class="fare__subtitle">${family.subtitle}</div>
            </div>
            ${sellable ? html`
              <div class="fare__price">
                <div class="fare__amount">${moneyRounded(total)}</div>
                <div class="fare__unit">total for ${journeys.length > 1 ? `all ${journeys.length} flights` : 'the trip'}, all charges in</div>
                ${left <= 4 ? html`<div class="seats-left" style="margin-top:var(--s1)">${left} seat${left > 1 ? 's' : ''} left at this fare</div>` : ''}
              </div>` : html`<div class="fare__sold-out">Sold out on at least one flight</div>`}
            <ul class="fare__list">
              ${family.includes.map((item) => html`<li>${icon('check', { size: 14 })}<span>${item}</span></li>`)}
              ${family.excludes.map((item) => html`<li class="is-excluded">${icon('close', { size: 14 })}<span>${item}</span></li>`)}
            </ul>
          </button>`;
      })}
    </div>

    <details class="disclosure" style="margin-top:var(--s5)">
      <summary>Full itinerary</summary>
      <div class="disclosure__body">
        ${journeys.map((journey, index) => html`
          ${index ? html`<hr>` : ''}
          <p class="option__note">${checkout.legs[index]?.label ?? `Flight ${index + 1}`}</p>
          ${legList(journey)}`)}
      </div>
    </details>

    <div class="action-bar">
      <div class="action-bar__total">
        <span class="action-bar__label" id="fare-chosen-label">Selected</span>
        <span class="action-bar__amount" id="fare-chosen">None yet</span>
      </div>
      <button class="btn btn--primary" type="button" data-action="continue" ${checkout.family ? '' : raw('disabled')}>
        Continue ${icon('forward', { size: 18 })}
      </button>
    </div>`;

  return {
    title: 'Choose a fare',
    body,
    onMount: (root) => wire(root, { quote, available }),
  };
}

function wire(root, { quote, available }) {
  const update = () => {
    const checkout = getCheckout();
    const family = fareFamilies.find((f) => f.id === checkout.family);
    const label = root.querySelector('#fare-chosen');
    const button = root.querySelector('[data-action="continue"]');
    if (family) {
      label.textContent = `${family.name} — ${money(quote(family.id))}`;
      button.disabled = false;
    } else {
      label.textContent = 'None yet';
      button.disabled = true;
    }
    root.querySelectorAll('[data-family]').forEach((element) => {
      const on_ = element.dataset.family === checkout.family;
      element.classList.toggle('is-selected', on_);
      element.setAttribute('aria-pressed', String(on_));
    });
  };

  on(root, 'click', '[data-family]', (event, button) => {
    if (button.disabled) return;
    setCheckout({ family: button.dataset.family, seats: {} });
    update();
  });

  on(root, 'click', '[data-action="continue"]', () => {
    if (!getCheckout()?.family) return;
    go('/book/travellers');
  });

  update();
}
