/**
 * Application state.
 *
 * Everything is local. There is no server behind this app, which is not only a
 * property of a prototype — an app for this network has to work with no signal
 * at all, so bookings, boarding passes and the timetable are all readable from
 * the device. What a live version would sync, this one simply keeps.
 *
 * State is one object, written through `update()`, persisted to localStorage,
 * and broadcast to subscribers. Views never mutate it in place.
 */

const KEY = 'northwinds:v1';

/** Storage that degrades to memory — private windows and locked-down browsers. */
const backing = (() => {
  try {
    const probe = '__nw__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
      persistent: false,
    };
  }
})();

export const storageIsPersistent = backing.persistent !== false;

const initial = () => ({
  bookings: [],
  credits: [],
  profile: {
    firstName: '', lastName: '', email: '', phone: '',
    memberNumber: null, miles: 0, homeAirport: 'YFB',
    savedTravellers: [],
  },
  // The booking in progress. Cleared on confirmation, kept across reloads so a
  // dropped connection halfway through checkout does not lose the trip.
  checkout: null,
  search: {
    tripType: 'return',
    from: 'YFB',
    to: 'YOW',
    departDate: null,
    returnDate: null,
    passengers: { adult: 1, child: 0, infant: 0 },
    fareType: 'standard',
    brand: null,
  },
  recentSearches: [],
  seenIntro: false,
});

function load() {
  try {
    const stored = backing.getItem(KEY);
    if (!stored) return initial();
    const parsed = JSON.parse(stored);
    // Merge over defaults so a stored state from an older version gains new
    // keys rather than crashing a view that expects them.
    return { ...initial(), ...parsed, profile: { ...initial().profile, ...parsed.profile }, search: { ...initial().search, ...parsed.search } };
  } catch {
    return initial();
  }
}

let state = load();
const listeners = new Set();

export const getState = () => state;

/** Merge a patch into state, persist, and notify. */
export function update(patch) {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
  try {
    backing.setItem(KEY, JSON.stringify(state));
  } catch {
    // A full quota should not take the app down: the session keeps working,
    // it just will not survive a reload.
  }
  for (const listener of listeners) listener(state);
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reset() {
  backing.removeItem(KEY);
  state = initial();
  for (const listener of listeners) listener(state);
}

/* ── Bookings ────────────────────────────────────────────────────────────── */

export const allBookings = () => state.bookings;

export const findBooking = (reference) =>
  state.bookings.find((b) => b.reference.toUpperCase() === String(reference).toUpperCase().trim()) ?? null;

export function saveBooking(booking) {
  const existing = state.bookings.findIndex((b) => b.reference === booking.reference);
  const bookings = existing === -1
    ? [...state.bookings, booking]
    : state.bookings.map((b, i) => (i === existing ? booking : b));
  update({ bookings });
  return booking;
}

export function removeBooking(reference) {
  update({ bookings: state.bookings.filter((b) => b.reference !== reference) });
}

/** Travel credit from a cancellation, usable against a later fare. */
export function addCredit(credit) {
  update({ credits: [...state.credits, credit] });
}

/* ── Checkout ────────────────────────────────────────────────────────────── */

export const getCheckout = () => state.checkout;

export function setCheckout(patch) {
  const next = patch === null ? null : { ...(state.checkout ?? {}), ...patch };
  update({ checkout: next });
  return next;
}

export const clearCheckout = () => update({ checkout: null });

/* ── Search ──────────────────────────────────────────────────────────────── */

export function setSearch(patch) {
  update({ search: { ...state.search, ...patch } });
  return state.search;
}

export function rememberSearch(search) {
  const entry = { from: search.from, to: search.to, at: Date.now() };
  const rest = state.recentSearches.filter((s) => !(s.from === entry.from && s.to === entry.to));
  update({ recentSearches: [entry, ...rest].slice(0, 6) });
}

/* ── Profile ─────────────────────────────────────────────────────────────── */

export function setProfile(patch) {
  update({ profile: { ...state.profile, ...patch } });
  return state.profile;
}

/** Total miles: the profile balance plus everything booked in this app. */
export function totalMiles() {
  return state.profile.miles + state.bookings
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.miles ?? 0), 0);
}
