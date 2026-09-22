/**
 * The booking screen.
 *
 * The form itself is the same component the home page carries, so the two
 * cannot drift apart. What this screen adds around it is everything a
 * traveller on this network needs before committing to a date: which fare
 * types they might qualify for, what a circuit actually means, and where to go
 * when the search comes back empty.
 */

import { html, icon } from '../lib/dom.js';
import { href } from '../lib/router.js';
import { getState } from '../lib/store.js';
import { fareTypes, fareFamilies } from '../data/brand.js';
import { airport } from '../data/airports.js';
import { pageHead, note, searchWidget, wireSearchWidget } from './ui.js';

export default function searchView() {
  const state = getState();
  const recent = state.recentSearches;

  const body = html`
    ${pageHead('Book a flight',
      'One search covers all three service lines. Where a trip needs a circuit and a jet, it is quoted and sold as one booking with the bags checked through.')}

    <div class="book-widget" style="margin-bottom:var(--s8)">${searchWidget(state.search, { compact: false })}</div>

    ${recent.length ? html`
      <section class="section">
        <div class="section__head"><h2>Recent searches</h2></div>
        <div class="chips">
          ${recent.map((entry) => html`
            <a class="chip" href="${href('/book/results', { from: entry.from, to: entry.to })}">
              ${airport(entry.from).name} → ${airport(entry.to).name}
            </a>`)}
        </div>
      </section>` : ''}

    <section class="section">
      <div class="section__head">
        <div><h2>Fares you may qualify for</h2><p>Chosen on the search form. Eligibility is confirmed at check-in, not by this app.</p></div>
      </div>
      <div class="cards">
        ${fareTypes.filter((type) => type.discount > 0).map((type) => html`
          <div class="card">
            <div class="row row--between" style="margin-bottom:var(--s2)">
              <span class="option__title">${type.name}</span>
              <span class="badge badge--aurora">${Math.round(type.discount * 100)}% off</span>
            </div>
            <p class="option__note">${type.note}</p>
            ${type.requiresId ? html`
              <p class="option__note" style="margin-top:var(--s2)"><strong>${type.requiresId}</strong> required at booking.</p>` : ''}
          </div>`)}
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <div><h2>Four fares, one decision</h2><p>The family applies to the whole booking. What it does not allow matters as much as what it does.</p></div>
        <a class="section__more" href="${href('/help', { c: 'booking' })}">More on fares</a>
      </div>
      <div class="grid-4">
        ${fareFamilies.map((family) => html`
          <div class="card">
            <div class="option__title">${family.name}</div>
            <div class="option__note">${family.subtitle}</div>
            <ul style="margin:var(--s3) 0 0;padding-left:var(--s4);font-size:var(--text-sm);color:var(--ink-2)">
              <li>${family.checkedBags} checked bag${family.checkedBags > 1 ? 's' : ''}</li>
              <li>${family.changeable ? (family.changeFee ? `Changes $${family.changeFee}` : 'Free changes') : 'No changes'}</li>
              <li>${family.refundable ? 'Fully refundable' : family.creditOnCancel ? 'Credit on cancel' : 'No refund or credit'}</li>
            </ul>
          </div>`)}
      </div>
    </section>

    ${note(html`
      <strong>Most communities see two or three services a week.</strong>
      The Baffin circuits come round every other week. If a search finds nothing on your date, it
      will tell you the next one that works — that is normal here, not a fault.
      <a href="${href('/timetable')}">See the full timetable</a>.`, { kind: 'info' })}

    <section class="section" style="margin-top:var(--s8)">
      <div class="grid-3">
        ${[
          ['/book/multi-city', 'map', 'Multi-city', 'Up to four flights on one booking — the normal way to visit three communities.'],
          ['/book/calendar', 'calendar', 'Low-fare calendar', 'A month of fares on one route, to find the cheap day.'],
          ['/deals', 'tag', 'Seat sales', 'Where fares are genuinely below the norm for their route.'],
        ].map(([path, iconName, title, text]) => html`
          <a class="feature" href="${href(path)}">
            <span class="feature__icon">${icon(iconName, { size: 20 })}</span>
            <span class="feature__title">${title}</span>
            <span class="feature__note">${text}</span>
          </a>`)}
      </div>
    </section>`;

  return { title: 'Book a flight', body, onMount: wireSearchWidget };
}
