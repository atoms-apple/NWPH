/**
 * Application entry point.
 *
 * Registers every route, then hands each navigation to the matching view.
 * Views return markup plus an optional `onMount`; the frame — header, menus,
 * footer, tab bar, focus and scrolling — is handled here so no screen has to
 * think about it.
 */

import { html, render, mount, icon, on, announce, $, $$ } from './lib/dom.js';
import { route, start, resolve, go, href, back } from './lib/router.js';
import { getState, subscribe } from './lib/store.js';
import { airline } from './data/brand.js';
import { header, menuSheet, tabbar, footer } from './views/chrome.js';

import homeView from './views/home.js';
import searchView from './views/search.js';
import multiCityView from './views/multicity.js';
import resultsView from './views/results.js';
import faresView from './views/fares.js';
import travellersView from './views/travellers.js';
import seatsView from './views/seats.js';
import extrasView from './views/extras.js';
import paymentView from './views/payment.js';
import confirmationView from './views/confirmation.js';
import { dealsView, calendarView, redeemView } from './views/deals.js';
import { tripsView, tripView, changeView, cancelView } from './views/trips.js';
import { rebookView, standbyView, upgradeView } from './views/travelday.js';
import { checkinView, checkinStartView, passView } from './views/checkin.js';
import { statusView } from './views/status.js';
import { networkView, brandView, milkRunsView, circuitView } from './views/network.js';
import { destinationsView, destinationView, fleetView, timetableView } from './views/explore.js';
import {
  cargoView, cargoQuoteView, charterView, charterQuoteView, groupsView,
  assistanceView, medicalView, corporateView,
} from './views/services.js';
import {
  baggageView, documentsView, advisoriesView, helpView, contactView,
  legalView, privacyView, accessibilityView,
} from './views/info.js';
import { storyView, communityView, careersView, roleView } from './views/company.js';
import {
  accountView, profileView, circleView, tiersView, milesView,
  travellersView as savedTravellersView, paymentMethodsView, notificationsView, creditsView,
} from './views/account.js';
import aboutView from './views/about.js';

/* ── Routes ──────────────────────────────────────────────────────────────── */

const BOOK = { tab: 'book', section: 'book' };
const TRIPS = { tab: 'trips', section: 'trips' };
const EXPLORE = { tab: 'explore', section: 'explore' };
const INFO = { tab: 'more', section: 'info' };
const CIRCLE = { tab: 'more', section: 'circle' };
const COMPANY = { tab: 'more', section: 'company' };

route('/', homeView, { tab: 'home' });

/* Booking */
route('/book', searchView, { ...BOOK, title: 'Book a flight' });
route('/book/multi-city', multiCityView, { ...BOOK, title: 'Multi-city', back: '/book' });
route('/book/calendar', calendarView, { ...BOOK, title: 'Low-fare calendar', back: '/book' });
route('/book/redeem', redeemView, { ...CIRCLE, title: 'Book with miles', back: '/circle' });
route('/deals', dealsView, { ...BOOK, title: 'Seat sales' });
route('/book/results', resultsView, { ...BOOK, title: 'Choose your flight', back: '/book' });
route('/book/fares', faresView, { ...BOOK, title: 'Choose a fare', back: '/book/results' });
route('/book/travellers', travellersView, { ...BOOK, title: 'Travellers', back: '/book/fares' });
route('/book/seats', seatsView, { ...BOOK, title: 'Choose seats', back: '/book/travellers' });
route('/book/extras', extrasView, { ...BOOK, title: 'Bags and extras', back: '/book/seats' });
route('/book/payment', paymentView, { ...BOOK, title: 'Review and pay', back: '/book/extras' });
route('/book/confirmed/:reference', confirmationView, { ...TRIPS, title: 'Booking confirmed' });

/* Trips and the day of travel */
route('/trips', tripsView, { ...TRIPS, title: 'My trips' });
route('/trips/:reference', tripView, { ...TRIPS, title: 'Booking', back: '/trips' });
route('/trips/:reference/change/:journey', changeView, { ...TRIPS, title: 'Change flight' });
route('/trips/:reference/rebook/:journey', rebookView, { ...TRIPS, title: 'Rebook' });
route('/trips/:reference/standby/:journey', standbyView, { ...TRIPS, title: 'Same-day standby' });
route('/trips/:reference/upgrade/:journey', upgradeView, { ...TRIPS, title: 'Upgrade' });
route('/trips/:reference/cancel', cancelView, { ...TRIPS, title: 'Cancel booking' });
route('/credits', creditsView, { ...TRIPS, title: 'Travel credits' });

route('/checkin', checkinStartView, { tab: 'trips', section: 'trips', title: 'Check in' });
route('/checkin/:reference', checkinView, { tab: 'trips', section: 'trips', title: 'Check in', back: '/checkin' });
route('/pass/:reference/:journey/:passenger', passView, { tab: 'trips', section: 'trips', title: 'Boarding pass' });
route('/flights', statusView, { tab: 'trips', section: 'trips', title: 'Flight status' });

/* Where we fly */
route('/destinations', destinationsView, { ...EXPLORE, title: 'Destinations' });
route('/destinations/:code', destinationView, { ...EXPLORE, title: 'Community', back: '/destinations' });
route('/network', networkView, { ...EXPLORE, title: 'Route network' });
route('/milk-runs', milkRunsView, { ...EXPLORE, title: 'Milk runs' });
route('/milk-runs/:id', circuitView, { ...EXPLORE, title: 'Circuit', back: '/milk-runs' });
route('/brand/:id', brandView, { ...EXPLORE, title: 'Service line', back: '/network' });
route('/fleet', fleetView, { ...EXPLORE, title: 'Our fleet' });
route('/timetable', timetableView, { ...EXPLORE, title: 'Timetable' });

/* Services */
route('/cargo', cargoView, { ...BOOK, title: 'Cargo and freight' });
route('/cargo/quote', cargoQuoteView, { ...BOOK, title: 'Freight quote', back: '/cargo' });
route('/charter', charterView, { ...BOOK, title: 'Charter' });
route('/charter/quote', charterQuoteView, { ...BOOK, title: 'Charter quote', back: '/charter' });
route('/groups', groupsView, { ...BOOK, title: 'Group travel' });
route('/medical-travel', medicalView, { ...BOOK, title: 'Medical travel' });
route('/corporate', corporateView, { ...BOOK, title: 'Duty and corporate travel' });

/* Travel information */
route('/baggage', baggageView, { ...INFO, title: 'Baggage' });
route('/documents', documentsView, { ...INFO, title: 'Identification' });
route('/assistance', assistanceView, { ...INFO, title: 'Special assistance' });
route('/advisories', advisoriesView, { ...INFO, title: 'Travel advisories' });
route('/help', helpView, { ...INFO, title: 'Help centre' });
route('/contact', contactView, { ...INFO, title: 'Contact us' });
route('/legal', legalView, { ...INFO, title: 'Conditions of carriage' });
route('/privacy', privacyView, { ...INFO, title: 'Privacy notice' });
route('/accessibility', accessibilityView, { ...INFO, title: 'Accessibility' });

/* Circle and the account */
route('/circle', circleView, { ...CIRCLE, title: 'North Winds Circle' });
route('/circle/tiers', tiersView, { ...CIRCLE, title: 'Tiers and benefits', back: '/circle' });
route('/account', accountView, { ...CIRCLE, title: 'Your account' });
route('/account/profile', profileView, { ...CIRCLE, title: 'Your details', back: '/account' });
route('/account/miles', milesView, { ...CIRCLE, title: 'My miles', back: '/account' });
route('/account/travellers', savedTravellersView, { ...CIRCLE, title: 'Saved travellers', back: '/account' });
route('/account/payment', paymentMethodsView, { ...CIRCLE, title: 'Payment methods', back: '/account' });
route('/account/notifications', notificationsView, { ...CIRCLE, title: 'Notifications', back: '/account' });

/* Company */
route('/story', storyView, { ...COMPANY, title: 'Our story' });
route('/community', communityView, { ...COMPANY, title: 'In the community' });
route('/careers', careersView, { ...COMPANY, title: 'Careers' });
route('/careers/:id', roleView, { ...COMPANY, title: 'Role', back: '/careers' });
route('/about', aboutView, { ...COMPANY, title: 'About this app' });

/* ── Toasts ──────────────────────────────────────────────────────────────── */

export function toast(message, kind = 'default') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const element = document.createElement('div');
  element.className = `toast${kind !== 'default' ? ` toast--${kind}` : ''}`;
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

function closeMenu() {
  const sheet = document.getElementById('menu-sheet');
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  document.body.style.overflow = '';
  $$('[data-action="open-menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function openMenu() {
  const sheet = document.getElementById('menu-sheet');
  if (!sheet) return;
  mount(sheet, menuSheet());
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  $$('[data-action="open-menu"]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  sheet.querySelector('a, button')?.focus({ preventScroll: true });
}

/** Close any open desktop dropdown. */
function closeMenus() {
  $$('.menu-panel').forEach((panel) => { panel.hidden = true; });
  $$('[data-menu]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function navigate(current) {
  currentRoute = current;
  const main = document.getElementById('main');
  closeMenu();
  closeMenus();

  if (!current.route) {
    renderInto(main, html`
      <div class="empty">
        <h1>Screen not found</h1>
        <p>That link does not lead anywhere on this site.</p>
        <a class="btn btn--primary" href="${href('/')}">Go to the home page</a>
      </div>`);
    document.title = `Not found — ${airline.name}`;
    drawChrome(current);
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

  main.classList.toggle('is-bleed', Boolean(output.bleed));
  const container = renderInto(main, output.body);
  document.title = output.title ? `${output.title} — ${airline.name}` : `${airline.name} — flights across Nunavut`;

  drawChrome(current);
  if (output.onMount) output.onMount(container);

  if (!output.keepScroll) window.scrollTo(0, 0);
  if (!output.keepFocus) main.focus({ preventScroll: true });
}

function drawChrome(current) {
  mount(document.getElementById('app-header'), header(current, { offline }));
  mount(document.getElementById('tabbar'), tabbar(current));
  mount(document.getElementById('site-footer'), footer());
}

export function refresh() {
  if (currentRoute) navigate(resolve());
}
window.nwRefresh = refresh;

/* ── Boot ────────────────────────────────────────────────────────────────── */

function boot() {
  const root = document.body;

  on(root, 'click', '[data-action="back"]', (event) => { event.preventDefault(); back(); });
  on(root, 'click', '[data-action="open-menu"]', (event) => { event.preventDefault(); openMenu(); });
  on(root, 'click', '[data-action="close-menu"]', () => closeMenu());

  // Desktop dropdowns: click to open, click away or Escape to close.
  on(root, 'click', '[data-menu]', (event, button) => {
    event.preventDefault();
    const panel = document.getElementById(`menu-${button.dataset.menu}`);
    const wasOpen = !panel.hidden;
    closeMenus();
    if (!wasOpen) {
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.mainnav__item')) closeMenus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeMenus();
    closeMenu();
  });

  subscribe(() => {
    if (currentRoute) mount(document.getElementById('tabbar'), tabbar(currentRoute));
  });

  const setOnline = (value) => {
    if (offline === !value) return;
    offline = !value;
    if (currentRoute) mount(document.getElementById('app-header'), header(currentRoute, { offline }));
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
