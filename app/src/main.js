/**
 * Application entry point.
 *
 * Sets up the shell — header, tab bar, offline indicator, toasts — registers
 * the routes, and hands each navigation to the matching view. Views return
 * markup plus an optional `onMount`; everything else about the frame is handled
 * here so no screen has to think about it.
 */

import { html, raw, render, mount, cx, icon, on, announce, $ } from './lib/dom.js';
import { route, start, resolve, go, href, back } from './lib/router.js';
import { getState, subscribe, allBookings } from './lib/store.js';
import { airline } from './data/brand.js';

import homeView from './views/home.js';
import searchView from './views/search.js';
import resultsView from './views/results.js';
import faresView from './views/fares.js';
import travellersView from './views/travellers.js';
import seatsView from './views/seats.js';
import extrasView from './views/extras.js';
import paymentView from './views/payment.js';
import confirmationView from './views/confirmation.js';
import { tripsView, tripView, changeView, cancelView } from './views/trips.js';
import { checkinView, checkinStartView, passView } from './views/checkin.js';
import { statusView } from './views/status.js';
import { networkView, brandView, milkRunsView, circuitView, communityView } from './views/network.js';
import profileView from './views/profile.js';
import aboutView from './views/about.js';

/* ── Routes ──────────────────────────────────────────────────────────────── */

route('/', homeView, { tab: 'home' });
route('/book', searchView, { tab: 'book', title: 'Book a flight' });
route('/book/results', resultsView, { tab: 'book', title: 'Choose your flight', back: '/book' });
route('/book/fares', faresView, { tab: 'book', title: 'Choose a fare', back: '/book/results' });
route('/book/travellers', travellersView, { tab: 'book', title: 'Travellers', back: '/book/fares' });
route('/book/seats', seatsView, { tab: 'book', title: 'Choose seats', back: '/book/travellers' });
route('/book/extras', extrasView, { tab: 'book', title: 'Bags and extras', back: '/book/seats' });
route('/book/payment', paymentView, { tab: 'book', title: 'Review and pay', back: '/book/extras' });
route('/book/confirmed/:reference', confirmationView, { tab: 'trips', title: 'Booking confirmed' });

route('/trips', tripsView, { tab: 'trips', title: 'My trips' });
route('/trips/:reference', tripView, { tab: 'trips', title: 'Booking', back: '/trips' });
route('/trips/:reference/change/:journey', changeView, { tab: 'trips', title: 'Change flight' });
route('/trips/:reference/cancel', cancelView, { tab: 'trips', title: 'Cancel booking' });

route('/checkin', checkinStartView, { tab: 'checkin', title: 'Check in' });
route('/checkin/:reference', checkinView, { tab: 'checkin', title: 'Check in', back: '/checkin' });
route('/pass/:reference/:journey/:passenger', passView, { tab: 'checkin', title: 'Boarding pass' });

route('/flights', statusView, { tab: 'flights', title: 'Flight status' });
route('/network', networkView, { tab: 'more', title: 'Route network' });
route('/network/community/:code', communityView, { tab: 'more', title: 'Community', back: '/network' });
route('/milk-runs', milkRunsView, { tab: 'more', title: 'Milk runs' });
route('/milk-runs/:id', circuitView, { tab: 'more', title: 'Circuit', back: '/milk-runs' });
route('/brand/:id', brandView, { tab: 'more', title: 'Service line', back: '/' });
route('/profile', profileView, { tab: 'more', title: airline.name });
route('/about', aboutView, { tab: 'more', title: 'About this app' });

/* ── Chrome ──────────────────────────────────────────────────────────────── */

const TABS = [
  { id: 'home', path: '/', label: 'Home', icon: 'wind' },
  { id: 'book', path: '/book', label: 'Book', icon: 'search' },
  { id: 'trips', path: '/trips', label: 'Trips', icon: 'ticket' },
  { id: 'checkin', path: '/checkin', label: 'Check in', icon: 'check' },
  { id: 'flights', path: '/flights', label: 'Flights', icon: 'plane' },
];

const NAV = [
  { path: '/book', label: 'Book' },
  { path: '/trips', label: 'My trips' },
  { path: '/checkin', label: 'Check in' },
  { path: '/flights', label: 'Flight status' },
  { path: '/milk-runs', label: 'Milk runs' },
  { path: '/network', label: 'Network' },
];

function renderHeader(current) {
  const showBack = Boolean(current.route?.back);
  const heading = current.route?.title;

  return html`
    <div class="on-chrome">
      ${offline ? html`<div class="offline-bar">${icon('offline', { size: 16 })} Offline — showing what is stored on this device</div>` : ''}
      <div class="header-bar">
        ${showBack
          ? html`<button type="button" class="header-back" data-action="back">${icon('back', { size: 20 })} Back</button>
                 <h2 class="header-title">${heading}</h2>`
          : html`<a class="wordmark" href="${href('/')}">
                   ${icon('wind', { size: 22, className: 'wordmark__mark' })}
                   <span>North Winds<span class="visually-hidden"> Airlines</span></span>
                 </a>`}
        <span class="header-spacer"></span>
        <nav class="header-nav" aria-label="Sections">
          ${NAV.map((item) => html`
            <a href="${href(item.path)}" ${current.path === item.path ? raw('aria-current="page"') : ''}>${item.label}</a>`)}
        </nav>
        <a class="proto-chip" href="${href('/about')}">Prototype</a>
      </div>
    </div>`;
}

function renderTabbar(current) {
  const tab = current.route?.tab ?? 'home';
  const upcoming = allBookings().filter((b) => b.status === 'confirmed').length;
  return html`
    ${TABS.map((item) => html`
      <a href="${href(item.path)}" ${tab === item.id ? raw('aria-current="page"') : ''}>
        ${icon(item.icon, { size: 22 })}
        ${item.id === 'trips' && upcoming ? html`<span class="tabbar__dot" aria-hidden="true"></span>` : ''}
        <span>${item.label}</span>
        ${item.id === 'trips' && upcoming ? html`<span class="visually-hidden">, ${upcoming} booking${upcoming > 1 ? 's' : ''}</span>` : ''}
      </a>`)}`;
}

/* ── Toasts ──────────────────────────────────────────────────────────────── */

export function toast(message, kind = 'default') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const element = document.createElement('div');
  element.className = cx('toast', kind !== 'default' && `toast--${kind}`);
  element.textContent = message;
  host.append(element);
  announce(message);
  setTimeout(() => {
    element.style.opacity = '0';
    element.style.transition = 'opacity .2s';
    setTimeout(() => element.remove(), 220);
  }, 3600);
}
window.nwToast = toast;

/* ── Navigation ──────────────────────────────────────────────────────────── */

let offline = !navigator.onLine;
let currentRoute = null;

/**
 * Render a view into a container of its own inside <main>.
 *
 * This matters more than it looks. Views wire themselves up with delegated
 * listeners on the element they are handed, and #main persists for the life of
 * the app — so binding to it would leave every screen's handlers attached for
 * every screen after it, and a "Continue" button would fire the continue
 * handler of three previous steps at once. A fresh container per navigation
 * means the listeners are discarded with the markup they belonged to.
 */
function renderInto(main, content) {
  main.textContent = '';
  const container = document.createElement('div');
  container.className = 'view';
  container.innerHTML = render(content);
  main.append(container);
  return container;
}

function navigate(current) {
  currentRoute = current;
  const main = document.getElementById('main');

  if (!current.route) {
    renderInto(main, html`
      <div class="empty">
        <h1>Screen not found</h1>
        <p>That link does not lead anywhere in this app.</p>
        <a class="btn btn--primary" href="${href('/')}">Go to the home screen</a>
      </div>`);
    document.title = `Not found — ${airline.name}`;
    return;
  }

  let output;
  try {
    output = current.route.render({ params: current.params, query: current.query, state: getState() });
  } catch (error) {
    console.error(error);
    output = {
      title: 'Something went wrong',
      body: html`
        <div class="empty">
          <h1>Something went wrong</h1>
          <p>This screen could not be drawn. Going back and trying again usually clears it.</p>
          <p><code>${String(error.message ?? error)}</code></p>
          <a class="btn btn--primary" href="${href('/')}">Home</a>
        </div>`,
    };
  }

  // A view may redirect instead of rendering — a checkout step with no
  // checkout in progress, for instance.
  if (output?.redirect) { go(output.redirect, { replace: true }); return; }

  const container = renderInto(main, output.body);
  document.title = output.title ? `${output.title} — ${airline.name}` : airline.name;

  mount(document.getElementById('app-header'), renderHeader(current));
  mount(document.getElementById('tabbar'), renderTabbar(current));

  if (output.onMount) output.onMount(container);

  // Focus and scroll: a new screen starts at the top, with focus in the
  // content rather than left on a link in the tab bar.
  if (!output.keepScroll) window.scrollTo(0, 0);
  if (!output.keepFocus) main.focus({ preventScroll: true });
}

/** Re-render the current screen in place — used after a state change. */
export function refresh() {
  if (currentRoute) navigate(resolve());
}
window.nwRefresh = refresh;

/* ── Boot ────────────────────────────────────────────────────────────────── */

function boot() {
  const root = document.getElementById('app');

  // One delegated listener for the whole app. Views mark controls with
  // data-action and never bind handlers of their own.
  on(root, 'click', '[data-action="back"]', (event) => { event.preventDefault(); back(); });

  // Anything that changes stored state redraws the screen it happened on.
  subscribe(() => {
    mount(document.getElementById('tabbar'), renderTabbar(currentRoute ?? resolve()));
  });

  const setOnline = (value) => {
    if (offline === !value) return;
    offline = !value;
    mount(document.getElementById('app-header'), renderHeader(currentRoute ?? resolve()));
    if (offline) announce('You are offline. Bookings stored on this device are still available.');
  };
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));

  start(navigate);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
        // No offline cache is a degraded experience, not a broken one.
      });
    });
  }
}

boot();
