/**
 * The search form.
 *
 * Designed around how people on this network actually travel: a return trip is
 * the default, the fare-type selector is prominent because most travellers here
 * qualify for one, and the airport pickers are grouped by region so a
 * traveller finds their community rather than guessing an airport code.
 */

import { html, raw, icon, on, $, $$, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState, setSearch, setCheckout, rememberSearch } from '../lib/store.js';
import { airportsByRegion, airport, airports } from '../data/airports.js';
import { fareTypes, passengerTypes, brandList } from '../data/brand.js';
import { today, addDays, formatDate, daysBetween } from '../lib/dates.js';
import { pageHead, note } from './ui.js';

const airportOptions = (selected) => airportsByRegion().map((group) => html`
  <optgroup label="${group.region.name}">
    ${group.airports.map((a) => html`
      <option value="${a.code}" ${a.code === selected ? raw('selected') : ''}>
        ${a.name}${a.also ? ` (${a.also})` : ''} — ${a.code}
      </option>`)}
  </optgroup>`);

export default function searchView() {
  const search = getState().search;
  const earliest = today();
  const departDate = search.departDate && search.departDate >= earliest ? search.departDate : addDays(earliest, 7);
  const returnDate = search.returnDate && search.returnDate > departDate ? search.returnDate : addDays(departDate, 7);

  const body = html`
    ${pageHead('Book a flight', 'One search covers all three service lines. Where a trip needs a circuit and a jet, it is quoted and sold as one booking.')}

    <form class="card" id="search-form" novalidate>
      <fieldset style="border:0;padding:0;margin:0 0 var(--s4)">
        <legend class="field__label">Trip</legend>
        <div class="chips" role="radiogroup" aria-label="Trip type">
          ${[['return', 'Return'], ['oneway', 'One way'], ['multi', 'Multi-city']].map(([value, label]) => html`
            <button type="button" class="chip ${search.tripType === value ? 'is-active' : ''}"
              role="radio" aria-checked="${search.tripType === value}" data-trip="${value}">${label}</button>`)}
        </div>
      </fieldset>

      <div class="field-group field-group--2">
        <div class="field">
          <label class="field__label" for="from">Leaving from</label>
          <select class="select" id="from" name="from">${airportOptions(search.from)}</select>
        </div>
        <div class="field">
          <label class="field__label" for="to">Going to</label>
          <select class="select" id="to" name="to">${airportOptions(search.to)}</select>
        </div>
      </div>

      <p style="margin:calc(var(--s4) * -1) 0 var(--s4)">
        <button type="button" class="btn btn--ghost btn--sm" data-action="swap">
          ${icon('swap', { size: 16 })} Swap
        </button>
      </p>

      <div class="field-group field-group--2">
        <div class="field">
          <label class="field__label" for="depart">Departing</label>
          <input class="input" type="date" id="depart" name="depart" value="${departDate}" min="${earliest}" max="${addDays(earliest, 330)}">
        </div>
        <div class="field" id="return-field" ${search.tripType !== 'return' ? raw('hidden') : ''}>
          <label class="field__label" for="return">Returning</label>
          <input class="input" type="date" id="return" name="return" value="${returnDate}" min="${departDate}" max="${addDays(earliest, 340)}">
        </div>
      </div>

      <fieldset style="border:0;padding:0;margin:0 0 var(--s4)">
        <legend class="field__label">Travellers</legend>
        <div class="stack stack--tight">
          ${passengerTypes.map((type) => html`
            <div class="option" style="cursor:default">
              <div class="option__body grow">
                <div class="option__title">${type.name}</div>
                <div class="option__note">${type.detail}</div>
              </div>
              <div class="stepper">
                <button type="button" class="stepper__button" data-step="-1" data-pax="${type.id}"
                  aria-label="One fewer ${type.name.toLowerCase()}">−</button>
                <span class="stepper__value tnum" data-pax-value="${type.id}">${search.passengers[type.id] ?? 0}</span>
                <button type="button" class="stepper__button" data-step="1" data-pax="${type.id}"
                  aria-label="One more ${type.name.toLowerCase()}">+</button>
              </div>
            </div>`)}
        </div>
        <p class="field__hint" id="pax-hint">Infants travel on an adult's lap at 10% of the fare.</p>
      </fieldset>

      <div class="field">
        <label class="field__label" for="fareType">Fare type</label>
        <select class="select" id="fareType" name="fareType">
          ${fareTypes.map((type) => html`
            <option value="${type.id}" ${type.id === search.fareType ? raw('selected') : ''}>
              ${type.name}${type.discount ? ` — ${Math.round(type.discount * 100)}% off the base fare` : ''}
            </option>`)}
        </select>
        <span class="field__hint" id="fare-type-note">${fareTypes.find((t) => t.id === search.fareType)?.note}</span>
      </div>

      <details class="disclosure">
        <summary>Search one service line only</summary>
        <div class="disclosure__body">
          <p class="field__hint" style="margin-bottom:var(--s3)">
            By default every line is searched together. Restrict it if you want to see, say, only what
            the jets do on a route.
          </p>
          <div class="chips" role="radiogroup" aria-label="Service line">
            <button type="button" class="chip ${!search.brand ? 'is-active' : ''}" role="radio"
              aria-checked="${!search.brand}" data-brand="">All lines</button>
            ${brandList.map((brand) => html`
              <button type="button" class="chip ${search.brand === brand.id ? 'is-active' : ''}" role="radio"
                aria-checked="${search.brand === brand.id}" data-brand="${brand.id}">${brand.shortName}</button>`)}
          </div>
        </div>
      </details>

      <p class="field__error" id="search-error" hidden></p>

      <div class="action-bar">
        <div class="action-bar__total">
          <span class="action-bar__label">Searching</span>
          <span class="action-bar__amount" id="search-summary" style="font-size:var(--text-base)"></span>
        </div>
        <button class="btn btn--primary" type="submit">${icon('search', { size: 18 })} Search</button>
      </div>
    </form>

    ${recentSearches()}`;

  return { title: 'Book a flight', body, onMount: wire };
}

function recentSearches() {
  const recent = getState().recentSearches;
  if (!recent.length) return '';
  return html`
    <section class="section" style="margin-top:var(--s6)">
      <div class="section__head"><h2>Recent searches</h2></div>
      <div class="chips">
        ${recent.map((entry) => html`
          <button type="button" class="chip" data-recent="${entry.from}:${entry.to}">
            ${airport(entry.from).name} → ${airport(entry.to).name}
          </button>`)}
      </div>
    </section>`;
}

function wire(root) {
  const form = $('#search-form', root);
  const search = { ...getState().search };

  const summarise = () => {
    const total = passengerTypes.reduce((n, t) => n + (search.passengers[t.id] ?? 0), 0);
    const parts = [
      `${airport(form.from.value).name} → ${airport(form.to.value).name}`,
      `${total} traveller${total > 1 ? 's' : ''}`,
    ];
    $('#search-summary', root).textContent = parts.join(' · ');
  };

  const setError = (message) => {
    const element = $('#search-error', root);
    element.hidden = !message;
    element.innerHTML = message ? `<span>${message}</span>` : '';
    if (message) announce(message);
  };

  // Trip type
  on(root, 'click', '[data-trip]', (event, button) => {
    search.tripType = button.dataset.trip;
    $$('[data-trip]', root).forEach((b) => {
      const on_ = b.dataset.trip === search.tripType;
      b.classList.toggle('is-active', on_);
      b.setAttribute('aria-checked', String(on_));
    });
    $('#return-field', root).hidden = search.tripType !== 'return';
    if (search.tripType === 'multi') {
      setError('Multi-city is not built in this prototype. Book each leg as a one-way for now.');
    } else {
      setError('');
    }
  });

  // Service line filter
  on(root, 'click', '[data-brand]', (event, button) => {
    search.brand = button.dataset.brand || null;
    $$('[data-brand]', root).forEach((b) => {
      const on_ = (b.dataset.brand || null) === search.brand;
      b.classList.toggle('is-active', on_);
      b.setAttribute('aria-checked', String(on_));
    });
  });

  // Passenger steppers
  on(root, 'click', '[data-step]', (event, button) => {
    const type = passengerTypes.find((t) => t.id === button.dataset.pax);
    const delta = Number(button.dataset.step);
    const current = search.passengers[type.id] ?? 0;
    const next = Math.max(type.min, Math.min(type.max, current + delta));
    search.passengers = { ...search.passengers, [type.id]: next };
    $(`[data-pax-value="${type.id}"]`, root).textContent = String(next);

    // Infants ride on a lap, so there cannot be more of them than adults.
    if (search.passengers.infant > search.passengers.adult) {
      search.passengers.infant = search.passengers.adult;
      $('[data-pax-value="infant"]', root).textContent = String(search.passengers.infant);
      setError('An infant travels on an adult’s lap, so there cannot be more infants than adults.');
    } else if (search.passengers.adult === 0) {
      setError('At least one adult must travel.');
    } else {
      setError('');
    }
    summarise();
  });

  on(root, 'click', '[data-action="swap"]', () => {
    const from = form.from.value;
    form.from.value = form.to.value;
    form.to.value = from;
    summarise();
    announce(`Now searching ${airport(form.from.value).name} to ${airport(form.to.value).name}`);
  });

  on(root, 'click', '[data-recent]', (event, button) => {
    const [from, to] = button.dataset.recent.split(':');
    form.from.value = from;
    form.to.value = to;
    summarise();
  });

  form.addEventListener('change', (event) => {
    if (event.target.id === 'fareType') {
      const type = fareTypes.find((t) => t.id === event.target.value);
      $('#fare-type-note', root).textContent = type?.note ?? '';
    }
    if (event.target.id === 'depart') {
      const returnInput = $('#return', root);
      returnInput.min = event.target.value;
      if (returnInput.value < event.target.value) returnInput.value = event.target.value;
    }
    summarise();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const from = form.from.value;
    const to = form.to.value;

    if (from === to) { setError('Choose two different communities.'); return; }
    if ((search.passengers.adult ?? 0) < 1) { setError('At least one adult must travel.'); return; }
    if (search.tripType === 'multi') { setError('Multi-city is not built in this prototype. Book each leg as a one-way.'); return; }

    const departDate = form.depart.value;
    const returnDate = search.tripType === 'return' ? form.return.value : null;
    if (departDate < today()) { setError('Choose a departure date that has not passed.'); return; }
    if (returnDate && returnDate < departDate) { setError('The return cannot be before the departure.'); return; }

    const next = {
      ...search,
      from,
      to,
      departDate,
      returnDate,
      fareType: form.fareType.value,
    };
    setSearch(next);
    rememberSearch(next);
    // A new search starts a new checkout: leaving a half-finished one behind
    // is how someone ends up paying for the wrong flight.
    setCheckout(null);
    go('/book/results');
  });

  summarise();
}
