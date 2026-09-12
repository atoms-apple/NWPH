/**
 * Traveller details.
 *
 * Fields are the ones a carrier actually needs, and no more. There is no date
 * of birth on an adult, no gender field, and no address: none of it is required
 * to fly a domestic sector, and asking for it would be collecting personal
 * information for the sake of a form that looks thorough.
 *
 * Where a discounted fare has been chosen, the eligibility is stated and the
 * traveller confirms it. That mirrors the real arrangement — the discount is
 * verified at the counter, not by the app.
 */

import { html, raw, icon, on, $, $$, announce } from '../lib/dom.js';
import { go } from '../lib/router.js';
import { getCheckout, setCheckout, getState, setProfile } from '../lib/store.js';
import { passengerTypes, fareTypeById } from '../data/brand.js';
import { itineraryFromRefs } from '../engine/search.js';
import { steps, pageHead, note } from './ui.js';

/** One row per seat sold: adults, then children, then infants. */
function passengerSlots(passengers) {
  const slots = [];
  for (const type of passengerTypes) {
    for (let i = 0; i < (passengers[type.id] ?? 0); i++) {
      slots.push({ type: type.id, label: `${type.name} ${(passengers[type.id] ?? 0) > 1 ? i + 1 : ''}`.trim(), detail: type.detail });
    }
  }
  return slots;
}

export default function travellersView() {
  const checkout = getCheckout();
  if (!checkout?.outbound || !checkout.family) return { redirect: '/book' };

  const search = checkout.search ?? getState().search;
  const profile = getState().profile;
  const slots = passengerSlots(search.passengers);
  const fareType = fareTypeById[search.fareType] ?? fareTypeById.standard;
  const saved = checkout.passengers ?? [];

  const body = html`
    ${steps('travellers')}
    ${pageHead('Who is travelling?', 'Names must match the identification each traveller will present at check-in.')}

    <form id="travellers-form" novalidate>
      ${slots.map((slot, index) => html`
        <fieldset class="card" style="margin-bottom:var(--s3)">
          <legend class="card__title" style="padding:0 var(--s2)">${slot.label}</legend>
          <p class="option__note" style="margin-bottom:var(--s3)">${slot.detail}</p>
          <div class="field-group field-group--2">
            <div class="field">
              <label class="field__label" for="first-${index}">First name</label>
              <input class="input" id="first-${index}" name="first-${index}" autocomplete="${index === 0 ? 'given-name' : 'off'}"
                value="${saved[index]?.firstName ?? (index === 0 ? profile.firstName : '')}" required>
            </div>
            <div class="field">
              <label class="field__label" for="last-${index}">Last name</label>
              <input class="input" id="last-${index}" name="last-${index}" autocomplete="${index === 0 ? 'family-name' : 'off'}"
                value="${saved[index]?.lastName ?? (index === 0 ? profile.lastName : '')}" required>
            </div>
          </div>
          ${slot.type === 'child' || slot.type === 'infant' ? html`
            <div class="field">
              <label class="field__label" for="dob-${index}">Date of birth</label>
              <input class="input" type="date" id="dob-${index}" name="dob-${index}" value="${saved[index]?.dob ?? ''}">
              <span class="field__hint">Required for a ${slot.type} fare, and checked at the counter.</span>
            </div>` : ''}
          ${index === 0 && fareType.requiresId ? html`
            <div class="field">
              <label class="field__label" for="fareid-${index}">${fareType.requiresId}</label>
              <input class="input" id="fareid-${index}" name="fareid-${index}" value="${saved[index]?.fareId ?? ''}">
              <span class="field__hint">${fareType.note}</span>
            </div>` : ''}
        </fieldset>`)}

      ${fareType.discount ? html`
        <div class="card" style="margin-bottom:var(--s3)">
          <label class="option" style="border:0;padding:0">
            <input type="checkbox" id="eligibility" name="eligibility" ${checkout.eligibilityConfirmed ? raw('checked') : ''}>
            <span class="option__body">
              <span class="option__title">I confirm this booking qualifies for the ${fareType.name.toLowerCase()}</span>
              <span class="option__note">
                ${fareType.note} A traveller who cannot show it at check-in pays the difference to the
                standard fare before boarding.
              </span>
            </span>
          </label>
        </div>` : ''}

      <fieldset class="card" style="margin-bottom:var(--s3)">
        <legend class="card__title" style="padding:0 var(--s2)">Contact</legend>
        <p class="option__note" style="margin-bottom:var(--s3)">
          Where we send the confirmation, and how we reach you if the weather moves your flight.
        </p>
        <div class="field">
          <label class="field__label" for="email">Email</label>
          <input class="input" type="email" id="email" name="email" autocomplete="email"
            value="${checkout.contact?.email ?? profile.email}" required>
        </div>
        <div class="field">
          <label class="field__label" for="phone">Mobile number</label>
          <input class="input" type="tel" id="phone" name="phone" autocomplete="tel"
            value="${checkout.contact?.phone ?? profile.phone}">
          <span class="field__hint">Used for delay and cancellation messages only.</span>
        </div>
        <label class="option" style="border:0;padding:0">
          <input type="checkbox" id="save-profile" name="save-profile" checked>
          <span class="option__body">
            <span class="option__title">Save these details on this device</span>
            <span class="option__note">Stored locally so the next booking is quicker. Nothing is sent anywhere.</span>
          </span>
        </label>
      </fieldset>

      <p class="field__error" id="travellers-error" hidden></p>

      <div class="action-bar">
        <div class="action-bar__total">
          <span class="action-bar__label">Travellers</span>
          <span class="action-bar__amount" style="font-size:var(--text-base)">${slots.length}</span>
        </div>
        <button class="btn btn--primary" type="submit">Continue ${icon('forward', { size: 18 })}</button>
      </div>
    </form>`;

  return { title: 'Travellers', body, onMount: (root) => wire(root, { slots, fareType }) };
}

function wire(root, { slots, fareType }) {
  const form = $('#travellers-form', root);
  const errorBox = $('#travellers-error', root);

  const fail = (message, fieldId) => {
    errorBox.hidden = false;
    errorBox.innerHTML = `<span>${message}</span>`;
    announce(message);
    const field = fieldId ? $(`#${fieldId}`, root) : null;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    return false;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    $$('[aria-invalid]', root).forEach((element) => element.removeAttribute('aria-invalid'));
    errorBox.hidden = true;

    const passengers = [];
    for (let index = 0; index < slots.length; index++) {
      const firstName = form[`first-${index}`].value.trim();
      const lastName = form[`last-${index}`].value.trim();
      if (!firstName) return fail(`Enter a first name for ${slots[index].label.toLowerCase()}.`, `first-${index}`);
      if (!lastName) return fail(`Enter a last name for ${slots[index].label.toLowerCase()}.`, `last-${index}`);
      const dobField = form[`dob-${index}`];
      if (dobField && !dobField.value) {
        return fail(`Enter a date of birth for ${slots[index].label.toLowerCase()}.`, `dob-${index}`);
      }
      passengers.push({
        firstName, lastName,
        type: slots[index].type,
        dob: dobField?.value ?? null,
        fareId: form[`fareid-${index}`]?.value.trim() ?? null,
      });
    }

    const email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Enter an email address we can send the confirmation to.', 'email');

    const eligibility = form.eligibility;
    if (eligibility && !eligibility.checked) {
      return fail(`Confirm the booking qualifies for the ${fareType.name.toLowerCase()}, or go back and choose the standard fare.`, 'eligibility');
    }

    const contact = { email, phone: form.phone.value.trim() };
    if (form['save-profile'].checked) {
      setProfile({ firstName: passengers[0].firstName, lastName: passengers[0].lastName, email, phone: contact.phone });
    }

    setCheckout({ passengers, contact, eligibilityConfirmed: Boolean(eligibility?.checked) });
    go('/book/seats');
  });
}
