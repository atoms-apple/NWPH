/**
 * Multi-city.
 *
 * Not an afterthought on this network. The circuits mean a trip to three
 * communities is often one aircraft on one day, and building it as three
 * separate one-way tickets would cost more and — more importantly — would break
 * the protection that comes from having one itinerary when the weather moves.
 *
 * Up to four legs, one fare family, one ticket.
 */

import { html, raw, icon, on, $, $$, announce } from '../lib/dom.js';
import { href, go } from '../lib/router.js';
import { getState, setSearch, startCheckout } from '../lib/store.js';
import { airportsByRegion, airport } from '../data/airports.js';
import { fareTypes, passengerTypes } from '../data/brand.js';
import { searchItineraries, nextAvailableDate } from '../engine/search.js';
import { today, addDays, formatDate, daysBetween } from '../lib/dates.js';
import { pageHead, note } from './ui.js';

const MAX_LEGS = 4;

const airportOptions = (selected) => airportsByRegion().map((group) => html`
  <optgroup label="${group.region.name}">
    ${group.airports.map((a) => html`
      <option value="${a.code}" ${a.code === selected ? raw('selected') : ''}>${a.name} — ${a.code}</option>`)}
  </optgroup>`);

/** Legs from the query string, or a sensible starting pair. */
function legsFromQuery(query, search) {
  const legs = [];
  for (let i = 0; i < MAX_LEGS; i++) {
    const from = query[`f${i}`];
    const to = query[`t${i}`];
    const date = query[`d${i}`];
    if (!from || !to || !date) break;
    legs.push({ from: from.toUpperCase(), to: to.toUpperCase(), date });
  }
  if (legs.length) return legs;
  return [
    { from: search.from, to: search.to, date: addDays(today(), 14) },
    { from: search.to, to: search.from, date: addDays(today(), 21) },
  ];
}

export default function multiCityView({ query }) {
  const state = getState();
  const legs = legsFromQuery(query, state.search);
  const fareType = query.fareType ?? state.search.fareType;
  const pax = Math.max(1, Number(query.pax ?? state.search.passengers.adult ?? 1));

  // Check each leg for service before anyone commits to the whole thing.
  const checked = legs.map((leg) => {
    if (leg.from === leg.to) return { ...leg, error: 'Same community at both ends.' };
    const found = searchItineraries(leg.from, leg.to, leg.date, { maxResults: 1 });
    if (found.length) return { ...leg, ok: true, count: searchItineraries(leg.from, leg.to, leg.date).length };
    return { ...leg, ok: false, next: nextAvailableDate(leg.from, leg.to, leg.date) };
  });

  const sequenceWarnings = [];
  for (let i = 1; i < checked.length; i++) {
    if (checked[i].date < checked[i - 1].date) {
      sequenceWarnings.push(`Flight ${i + 1} is before flight ${i}. Put the legs in the order you will fly them.`);
    }
    if (checked[i].from !== checked[i - 1].to) {
      sequenceWarnings.push(
        `Flight ${i + 1} starts at ${airport(checked[i].from).name} but flight ${i} ends at `
        + `${airport(checked[i - 1].to).name}. That is allowed — you just have to get between them yourself.`);
    }
  }

  const allOk = checked.every((leg) => leg.ok) && !checked.some((leg) => leg.error);

  const body = html`
    ${pageHead('Multi-city',
      'Up to four flights on one booking, under one fare family. On this network that is often one aircraft on one day — the circuits call at each community in sequence.')}

    <form class="card" id="mc-form" novalidate>
      <div class="stack">
        ${checked.map((leg, index) => html`
          <fieldset style="border:1px solid var(--line);border-radius:var(--radius);padding:var(--s4);margin:0">
            <legend class="field__label" style="padding:0 var(--s2)">Flight ${index + 1}</legend>
            <div class="field-group field-group--2">
              <div class="field" style="margin-bottom:var(--s3)">
                <label class="field__label" for="mc-from-${index}">From</label>
                <select class="select" id="mc-from-${index}" name="f${index}">${airportOptions(leg.from)}</select>
              </div>
              <div class="field" style="margin-bottom:var(--s3)">
                <label class="field__label" for="mc-to-${index}">To</label>
                <select class="select" id="mc-to-${index}" name="t${index}">${airportOptions(leg.to)}</select>
              </div>
            </div>
            <div class="field" style="margin-bottom:0">
              <label class="field__label" for="mc-date-${index}">Date</label>
              <input class="input" type="date" id="mc-date-${index}" name="d${index}" value="${leg.date}"
                min="${today()}" max="${addDays(today(), 330)}">
            </div>

            ${leg.error ? html`<p class="field__error" style="margin-top:var(--s3)">${leg.error}</p>`
              : leg.ok ? html`
                <p class="option__note" style="margin-top:var(--s3);color:var(--aurora-deep)">
                  ${icon('check', { size: 14 })} ${leg.count} option${leg.count === 1 ? '' : 's'} on this date
                </p>`
              : html`
                <p class="field__error" style="margin-top:var(--s3)">
                  Nothing flies ${airport(leg.from).name} to ${airport(leg.to).name} on
                  ${formatDate(leg.date, 'long')}.
                  ${leg.next ? html`The next departure is <button type="button" class="btn btn--ghost btn--sm"
                    data-usedate="${index}:${leg.next}">${formatDate(leg.next, 'long')}</button>.`
                    : 'Nothing in the next three weeks — try routing through a hub.'}
                </p>`}

            ${checked.length > 1 ? html`
              <p style="margin-top:var(--s3);margin-bottom:0">
                <button type="button" class="btn btn--ghost btn--sm" data-remove-leg="${index}">
                  ${icon('trash', { size: 15 })} Remove this flight
                </button>
              </p>` : ''}
          </fieldset>`)}
      </div>

      ${checked.length < MAX_LEGS ? html`
        <p style="margin-top:var(--s4)">
          <button type="button" class="btn btn--secondary btn--sm" data-action="add-leg">
            ${icon('plus', { size: 16 })} Add another flight
          </button>
        </p>` : html`
        <p class="option__note" style="margin-top:var(--s4)">Four flights is the maximum on one booking.</p>`}

      <hr>

      <div class="field-group field-group--2">
        <div class="field">
          <label class="field__label" for="mc-pax">Travellers</label>
          <select class="select" id="mc-pax" name="pax">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`
              <option value="${n}" ${n === pax ? raw('selected') : ''}>${n} traveller${n > 1 ? 's' : ''}</option>`)}
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="mc-faretype">Fare type</label>
          <select class="select" id="mc-faretype" name="fareType">
            ${fareTypes.map((type) => html`
              <option value="${type.id}" ${type.id === fareType ? raw('selected') : ''}>
                ${type.name}${type.discount ? ` — ${Math.round(type.discount * 100)}% off` : ''}
              </option>`)}
          </select>
        </div>
      </div>

      ${sequenceWarnings.length ? html`
        <div class="stack stack--tight" style="margin-bottom:var(--s4)">
          ${sequenceWarnings.map((warning) => note(warning, { kind: 'warn' }))}
        </div>` : ''}

      <div class="btn-row">
        <button class="btn btn--secondary" type="submit">${icon('refresh', { size: 16 })} Check these dates</button>
        <button class="btn btn--accent" type="button" data-action="start" ${allOk ? '' : raw('disabled')}>
          ${icon('search', { size: 18 })} Choose flights
        </button>
      </div>
    </form>

    ${note(html`
      <strong>One booking, one fare family, one set of rules.</strong>
      A multi-city ticket is a single contract: if the first leg is cancelled and you miss the
      second, we rebook you. Three separate one-way tickets would not do that.`, { kind: 'ok' })}`;

  return {
    title: 'Multi-city',
    body,
    onMount: (root) => {
      const form = $('#mc-form', root);

      const navigate = (nextLegs, extra = {}) => {
        const params = {};
        nextLegs.forEach((leg, i) => {
          params[`f${i}`] = leg.from;
          params[`t${i}`] = leg.to;
          params[`d${i}`] = leg.date;
        });
        go(href('/book/multi-city', { ...params, pax, fareType, ...extra }).slice(1));
      };

      const readForm = () => checked.map((leg, index) => ({
        from: form[`f${index}`].value,
        to: form[`t${index}`].value,
        date: form[`d${index}`].value,
      }));

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        navigate(readForm(), { pax: form.pax.value, fareType: form.fareType.value });
      });

      on(root, 'click', '[data-action="add-leg"]', () => {
        const current = readForm();
        const last = current[current.length - 1];
        navigate([...current, { from: last.to, to: last.from, date: addDays(last.date, 5) }]);
      });

      on(root, 'click', '[data-remove-leg]', (event, button) => {
        const index = Number(button.dataset.removeLeg);
        navigate(readForm().filter((_, i) => i !== index));
      });

      on(root, 'click', '[data-usedate]', (event, button) => {
        const [index, date] = button.dataset.usedate.split(':');
        const current = readForm();
        current[Number(index)].date = date;
        navigate(current);
      });

      on(root, 'click', '[data-action="start"]', () => {
        const current = readForm();
        const search = {
          ...getState().search,
          from: current[0].from,
          to: current[current.length - 1].to,
          departDate: current[0].date,
          returnDate: null,
          tripType: 'multi',
          fareType: form.fareType.value,
          passengers: { adult: Number(form.pax.value), child: 0, infant: 0 },
        };
        setSearch(search);
        startCheckout(search, current.map((leg, index) => ({
          ...leg,
          label: `Flight ${index + 1}`,
        })));
        announce('Now choosing the first flight.');
        go('/book/results');
      });
    },
  };
}
