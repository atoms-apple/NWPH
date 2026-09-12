/**
 * Profile, loyalty, and the settings that are actually settings.
 *
 * Nothing here is an account in the usual sense: there is no sign-in because
 * there is nothing to sign in to. What it holds is what makes the next booking
 * quicker, kept on the device, and clearable in one press.
 */

import { html, raw, icon, on, $ } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState, setProfile, totalMiles, reset, storageIsPersistent, allBookings } from '../lib/store.js';
import { loyalty, airline } from '../data/brand.js';
import { airportsByRegion, airport } from '../data/airports.js';
import { pageHead, note } from './ui.js';

export default function profileView() {
  const state = getState();
  const miles = totalMiles();
  const tier = [...loyalty.tiers].reverse().find((t) => miles >= t.threshold) ?? loyalty.tiers[0];
  const index = loyalty.tiers.findIndex((t) => t.id === tier.id);
  const next = loyalty.tiers[index + 1];
  const bookings = allBookings();

  const body = html`
    ${pageHead(airline.name, `${airline.base} · a subsidiary of ${airline.parent}`)}

    <div class="tier-card" style="margin-bottom:var(--s6)">
      <p class="tier-card__name">${loyalty.name} — ${tier.name}</p>
      <p class="tier-card__miles tnum">${miles.toLocaleString('en-CA')}<span style="font-size:var(--text-md);font-weight:500"> miles</span></p>
      ${next ? html`
        <div class="tier-card__bar">
          <div class="tier-card__fill" style="width:${Math.min(100, Math.round(((miles - tier.threshold) / (next.threshold - tier.threshold)) * 100))}%"></div>
        </div>
        <p class="tier-card__next">${(next.threshold - miles).toLocaleString('en-CA')} miles to ${next.name}</p>`
        : html`<p class="tier-card__next">Top tier for this year.</p>`}
    </div>

    <section class="section">
      <div class="section__head"><h2>Your tier includes</h2></div>
      <div class="card">
        <ul style="margin:0">${tier.benefits.map((benefit) => html`<li>${benefit}</li>`)}</ul>
      </div>
      ${next ? html`
        <details class="disclosure" style="margin-top:var(--s3)">
          <summary>What ${next.name} adds</summary>
          <div class="disclosure__body">
            <ul style="margin:0">${next.benefits.map((benefit) => html`<li>${benefit}</li>`)}</ul>
          </div>
        </details>` : ''}
    </section>

    <section class="section">
      <div class="section__head"><h2>Your details</h2></div>
      <form class="card" id="profile-form">
        <div class="field-group field-group--2">
          <div class="field">
            <label class="field__label" for="p-first">First name</label>
            <input class="input" id="p-first" value="${state.profile.firstName}" autocomplete="given-name">
          </div>
          <div class="field">
            <label class="field__label" for="p-last">Last name</label>
            <input class="input" id="p-last" value="${state.profile.lastName}" autocomplete="family-name">
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="p-email">Email</label>
          <input class="input" type="email" id="p-email" value="${state.profile.email}" autocomplete="email">
        </div>
        <div class="field">
          <label class="field__label" for="p-phone">Mobile number</label>
          <input class="input" type="tel" id="p-phone" value="${state.profile.phone}" autocomplete="tel">
        </div>
        <div class="field">
          <label class="field__label" for="p-home">Home community</label>
          <select class="select" id="p-home">
            ${airportsByRegion().map((group) => html`
              <optgroup label="${group.region.name}">
                ${group.airports.map((a) => html`
                  <option value="${a.code}" ${a.code === state.profile.homeAirport ? raw('selected') : ''}>${a.name} — ${a.code}</option>`)}
              </optgroup>`)}
          </select>
          <span class="field__hint">Used as the default in search and on the flight-status board.</span>
        </div>
        <button class="btn btn--primary" type="submit">Save</button>
      </form>
    </section>

    <section class="section">
      <div class="section__head"><h2>This device</h2></div>
      <div class="card">
        <div class="stack stack--tight">
          <div class="row row--between"><span>Bookings stored</span><span class="tnum">${bookings.length}</span></div>
          <div class="row row--between"><span>Travel credit</span><span class="tnum">${state.credits.filter((c) => !c.spent).length}</span></div>
          <div class="row row--between">
            <span>Storage</span>
            <span>${storageIsPersistent ? 'Saved on this device' : 'This session only'}</span>
          </div>
        </div>
        ${storageIsPersistent ? '' : note(
          'Your browser is blocking local storage, so bookings will be lost when this tab closes. A private window usually does this.',
          { kind: 'warn' })}
        <div class="card__foot">
          <button type="button" class="btn btn--danger btn--sm" data-action="reset">Erase everything on this device</button>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="stack stack--tight">
        <a class="card-button" href="${href('/network')}">
          <div class="row">${icon('map', { size: 18 })}<span class="grow">The route network</span>${icon('forward', { size: 16 })}</div>
        </a>
        <a class="card-button" href="${href('/milk-runs')}">
          <div class="row">${icon('plane', { size: 18 })}<span class="grow">Milk-run circuits</span>${icon('forward', { size: 16 })}</div>
        </a>
        <a class="card-button" href="${href('/about')}">
          <div class="row">${icon('info', { size: 18 })}<span class="grow">About this app</span>${icon('forward', { size: 16 })}</div>
        </a>
      </div>
    </section>`;

  return {
    title: 'Profile',
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

      on(root, 'click', '[data-action="reset"]', () => {
        if (!window.confirm('Erase every booking, boarding pass and saved detail on this device? This cannot be undone.')) return;
        reset();
        window.nwToast?.('Everything erased.', 'ok');
        go('/');
      });
    },
  };
}
