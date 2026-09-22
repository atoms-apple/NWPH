/**
 * Bags, freight and extras.
 *
 * The list is grouped the way a passenger on this network thinks about it:
 * baggage, freight, comfort. Country food, hunting gear and dogs are in it
 * because they are what goes into these holds — a baggage screen offering only
 * "additional suitcase" would be a screen designed for a different country.
 *
 * What the fare already includes is stated first, so nobody buys a bag they
 * already have.
 */

import { html, raw, icon, on, $, $$ } from '../lib/dom.js';
import { go } from '../lib/router.js';
import { getCheckout, setCheckout, checkoutComplete } from '../lib/store.js';
import { ancillaries, fareFamilyById } from '../data/brand.js';
import { money } from '../engine/pricing.js';
import { steps, pageHead, note } from './ui.js';

export default function extrasView() {
  const checkout = getCheckout();
  if (!checkoutComplete(checkout) || !checkout.family || !checkout.passengers) return { redirect: '/book' };

  const family = fareFamilyById[checkout.family];
  const chosen = checkout.extras ?? {};
  const travellers = checkout.passengers.filter((p) => p.type !== 'infant').length;
  const includedBags = family.checkedBags * travellers;

  const groups = [...new Set(ancillaries.map((a) => a.group))];

  const body = html`
    ${steps('extras')}
    ${pageHead('Bags and extras', 'Add now and it is cheaper than at the counter, and the load is planned before the aircraft is loaded.')}

    ${note(html`
      <strong>Your ${family.name} fare already includes ${family.checkedBags} checked bag${family.checkedBags > 1 ? 's' : ''} per traveller
      — ${includedBags} bag${includedBags > 1 ? 's' : ''} in total.</strong>
      A carry-on and a personal item are included on every fare.`, { kind: 'ok' })}

    <form id="extras-form" style="margin-top:var(--s4)">
      ${groups.map((group) => html`
        <section class="section">
          <div class="section__head"><h2>${group}</h2></div>
          <div class="stack stack--tight">
            ${ancillaries.filter((item) => item.group === group).map((item) => {
              const included = (item.id === 'priority' && family.priorityBoarding)
                || (item.id === 'lounge' && family.lounge);
              const quantity = included ? 0 : (chosen[item.id] ?? 0);
              return html`
                <div class="option" style="cursor:default" data-item="${item.id}">
                  <div class="option__body grow">
                    <div class="option__title">${item.name}</div>
                    <div class="option__note">${item.detail}</div>
                    ${included ? html`<p class="badge badge--ok" style="margin-top:var(--s2)">Included with ${family.name}</p>` : ''}
                  </div>
                  <div style="text-align:right">
                    <div class="option__price">${included ? 'Included' : money(item.price * 100)}</div>
                    ${included ? '' : html`
                      <div class="stepper" style="margin-top:var(--s2)">
                        <button type="button" class="stepper__button" data-extra="${item.id}" data-delta="-1"
                          aria-label="One fewer ${item.name.toLowerCase()}" ${quantity ? '' : raw('disabled')}>−</button>
                        <span class="stepper__value tnum" data-extra-value="${item.id}">${quantity}</span>
                        <button type="button" class="stepper__button" data-extra="${item.id}" data-delta="1"
                          aria-label="One more ${item.name.toLowerCase()}" ${quantity >= item.max ? raw('disabled') : ''}>+</button>
                      </div>`}
                  </div>
                </div>`;
            })}
          </div>
        </section>`)}
    </form>

    ${note(html`
      Anything carried in the hold is subject to the aircraft's load. On the Twin Otter and the
      Dash 8 that limit is reached quickly, and freight may travel on the next service. You are
      told at the counter, not after you have left.`, { kind: 'warn', title: 'Space on the smaller aircraft' })}

    <div class="action-bar">
      <div class="action-bar__total">
        <span class="action-bar__label">Extras</span>
        <span class="action-bar__amount" id="extras-total">${money(extrasTotal(chosen))}</span>
      </div>
      <button class="btn btn--primary" type="button" data-action="continue">
        Review and pay ${icon('forward', { size: 18 })}
      </button>
    </div>`;

  return { title: 'Bags and extras', body, onMount: wire };
}

function extrasTotal(chosen) {
  return ancillaries.reduce((sum, item) => sum + (chosen[item.id] ?? 0) * item.price * 100, 0);
}

function wire(root) {
  on(root, 'click', '[data-extra]', (event, button) => {
    const checkout = getCheckout();
    const item = ancillaries.find((a) => a.id === button.dataset.extra);
    const delta = Number(button.dataset.delta);
    const extras = { ...(checkout.extras ?? {}) };
    const next = Math.max(0, Math.min(item.max, (extras[item.id] ?? 0) + delta));
    if (next) extras[item.id] = next; else delete extras[item.id];
    setCheckout({ extras });

    $(`[data-extra-value="${item.id}"]`, root).textContent = String(next);
    const row = button.closest('[data-item]');
    row.querySelector('[data-delta="-1"]').disabled = next === 0;
    row.querySelector('[data-delta="1"]').disabled = next >= item.max;
    $('#extras-total', root).textContent = money(extrasTotal(extras));
  });

  on(root, 'click', '[data-action="continue"]', () => go('/book/payment'));
}
