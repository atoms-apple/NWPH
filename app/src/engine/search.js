/**
 * Itinerary search.
 *
 * The three service lines are sections of the app, not walls between them. This
 * module knows nothing about which brand a segment belongs to while it is
 * building a journey: it connects a Connect milk run to an Altitude jet exactly
 * as readily as to another Connect run, because that is the trip — Clyde River
 * to Ottawa is a circuit down to Iqaluit and a jet south, sold as one booking
 * with the bags checked through.
 *
 * Connections are built by breadth rather than by graph search. The network has
 * three hubs and thirty airports; enumerating one- and two-stop journeys
 * through the hubs is both faster and easier to reason about than a general
 * shortest-path over a graph that changes every day of the week.
 */

import { hubs, airport } from '../data/airports.js';
import { brands } from '../data/brand.js';
import { segmentsBetween, segment, buildFlight, MIN_CONNECTION_MIN, MAX_CONNECTION_MIN } from './schedule.js';
import { addDays } from '../lib/dates.js';
import { cheapestFamily } from './pricing.js';

/** Connection points: the hubs, plus anywhere a circuit turns around. */
const CONNECTION_POINTS = [...new Set([...hubs, 'YRB', 'YIO', 'YZF'])];

/**
 * Longest a passenger will be left at a connecting point.
 *
 * An overnight in Iqaluit or Rankin Inlet waiting for a circuit is an ordinary
 * northern itinerary and belongs in the results. Twenty-eight hours is not a
 * connection, it is a stay, and selling it as one flight is how someone ends up
 * sleeping in an airport.
 */
const MAX_LAYOVER_MIN = 24 * 60;

/**
 * Reject a journey that visits the same airport twice.
 *
 * Without this the search happily routes Clyde River to Ottawa by flying north
 * to Pond Inlet and back down over Clyde River on the return circuit — every
 * connection legal, the whole thing absurd. Counting the stops an aircraft
 * makes with the passenger aboard matters here: the circuit passes back through
 * the community they boarded at, which is exactly the case to catch.
 */
function visitsTwice(segments) {
  const seen = new Set([segments[0].from]);
  for (const seg of segments) {
    for (const code of [...seg.via, seg.to]) {
      if (seen.has(code)) return true;
      seen.add(code);
    }
  }
  return false;
}

/** Wrap a list of segments into an itinerary with its derived totals. */
function makeItinerary(segments) {
  const first = segments[0];
  const last = segments[segments.length - 1];
  const connections = [];
  for (let i = 1; i < segments.length; i++) {
    connections.push({
      at: segments[i].from,
      minutes: Math.round((segments[i].departUtc - segments[i - 1].arriveUtc) / 60000),
      overnight: segments[i].departDate !== segments[i - 1].arriveDate,
    });
  }
  const brandsUsed = [...new Set(segments.map((s) => s.brand))];
  return {
    id: segments.map((s) => s.id).join('+'),
    segments,
    from: first.from,
    to: last.to,
    departUtc: first.departUtc,
    arriveUtc: last.arriveUtc,
    departLocal: first.departLocal,
    arriveLocal: last.arriveLocal,
    departDate: first.departDate,
    arriveDate: last.arriveDate,
    elapsedMinutes: Math.round((last.arriveUtc - first.departUtc) / 60000),
    distanceKm: segments.reduce((sum, s) => sum + s.distanceKm, 0),
    stops: segments.length - 1,
    // Stops the aircraft makes with the passenger aboard, across all segments.
    intermediateStops: segments.reduce((n, s) => n + s.via.length, 0),
    connections,
    brands: brandsUsed,
    // The line that carries the longest leg of the trip is the one the booking
    // is shown under, which is nearly always the sector people think of as
    // "the flight".
    leadBrand: brandsUsed.length === 1
      ? brandsUsed[0]
      : segments.reduce((a, b) => (a.distanceKm >= b.distanceKm ? a : b)).brand,
    multiBrand: brandsUsed.length > 1,
    overnight: connections.some((c) => c.overnight),
  };
}

/**
 * Journeys from A to B departing on a date.
 *
 * `maxStops` counts changes of aircraft, not the stops a circuit makes on the
 * way — riding through Igloolik on the same airframe is not a connection and is
 * not counted as one.
 *
 * A journey may finish on a later day: north of the treeline, an overnight in
 * Iqaluit waiting for the morning circuit is a normal itinerary, not a broken
 * one. `allowOvernight` keeps them out of the list when the traveller has said
 * they must arrive the same day.
 */
export function searchItineraries(from, to, date, {
  maxStops = 2,
  allowOvernight = true,
  maxResults = 40,
  brand = null,
} = {}) {
  if (from === to) return [];
  const found = new Map();

  const add = (segments) => {
    if (visitsTwice(segments)) return;
    const itinerary = makeItinerary(segments);
    if (itinerary.connections.some((c) => c.minutes > MAX_LAYOVER_MIN)) return;
    if (!allowOvernight && itinerary.overnight) return;
    if (brand && !itinerary.brands.includes(brand)) return;
    if (!found.has(itinerary.id)) found.set(itinerary.id, itinerary);
  };

  // Nonstop, and through-services on a circuit.
  for (const seg of segmentsBetween(from, to, date)) add([seg]);

  if (maxStops >= 1) {
    for (const via of CONNECTION_POINTS) {
      if (via === from || via === to) continue;
      for (const first of segmentsBetween(from, via, date)) {
        // A connection may be onto the next day's flight — search both.
        for (const dayOffset of [0, 1]) {
          const onward = segmentsBetween(via, to, addDays(date, dayOffset));
          for (const second of onward) {
            const wait = Math.round((second.departUtc - first.arriveUtc) / 60000);
            if (wait < MIN_CONNECTION_MIN || wait > MAX_LAYOVER_MIN) continue;
            if (wait > MAX_CONNECTION_MIN && !allowOvernight) continue;
            add([first, second]);
          }
        }
      }
    }
  }

  if (maxStops >= 2) {
    for (const via1 of CONNECTION_POINTS) {
      if (via1 === from || via1 === to) continue;
      for (const first of segmentsBetween(from, via1, date)) {
        for (const via2 of CONNECTION_POINTS) {
          if (via2 === from || via2 === to || via2 === via1) continue;
          for (const dayOffset of [0, 1]) {
            for (const second of segmentsBetween(via1, via2, addDays(date, dayOffset))) {
              const wait1 = Math.round((second.departUtc - first.arriveUtc) / 60000);
              if (wait1 < MIN_CONNECTION_MIN || wait1 > MAX_LAYOVER_MIN) continue;
              for (const offset2 of [0, 1]) {
                for (const third of segmentsBetween(via2, to, addDays(second.date, offset2))) {
                  const wait2 = Math.round((third.departUtc - second.arriveUtc) / 60000);
                  if (wait2 < MIN_CONNECTION_MIN || wait2 > MAX_LAYOVER_MIN) continue;
                  add([first, second, third]);
                }
              }
            }
          }
        }
      }
    }
  }

  const results = [...found.values()];
  // Drop a two-stop journey that is beaten outright by a shorter one: same
  // arrival day, more changes, no sooner. Nobody wants to read it.
  const best = Math.min(...results.map((r) => r.elapsedMinutes), Infinity);
  return results
    .filter((r) => r.stops === 0 || r.elapsedMinutes <= best * 3.2 + 240)
    .sort((a, b) => a.departUtc - b.departUtc || a.elapsedMinutes - b.elapsedMinutes)
    .slice(0, maxResults);
}

/**
 * Reduce an itinerary to the identifiers it can be rebuilt from.
 *
 * Checkout state and bookings both store this rather than the itinerary itself:
 * a handful of strings that survive a reload, rather than a graph of computed
 * times that would go stale the moment the timetable moved.
 */
export const serializeItinerary = (itinerary) =>
  itinerary.segments.map((s) => ({ routeId: s.routeId, date: s.date, from: s.from, to: s.to }));

/** Rebuild an itinerary from stored references. Null if a flight has gone. */
export function itineraryFromRefs(refs) {
  if (!refs?.length) return null;
  const segments = refs
    .map((ref) => segment(buildFlight(ref.routeId, ref.date), ref.from, ref.to))
    .filter(Boolean);
  return segments.length === refs.length ? makeItinerary(segments) : null;
}

/** Attach a "from" price to each itinerary, for the results list. */
export function priceResults(itineraries, { fareType = 'standard', passengers = { adult: 1 }, daysAhead = 30 } = {}) {
  return itineraries
    .map((itinerary) => ({
      itinerary,
      cheapest: cheapestFamily(itinerary, { fareType, passengers, daysAhead }),
    }))
    .filter((r) => r.cheapest !== null);
}

/** Sorters offered in the results list. */
export const SORTS = {
  departure: { id: 'departure', label: 'Departure time', compare: (a, b) => a.itinerary.departUtc - b.itinerary.departUtc },
  price: { id: 'price', label: 'Lowest fare', compare: (a, b) => a.cheapest.total - b.cheapest.total },
  duration: { id: 'duration', label: 'Shortest trip', compare: (a, b) => a.itinerary.elapsedMinutes - b.itinerary.elapsedMinutes },
  arrival: { id: 'arrival', label: 'Arrival time', compare: (a, b) => a.itinerary.arriveUtc - b.itinerary.arriveUtc },
  stops: {
    id: 'stops',
    label: 'Fewest changes',
    compare: (a, b) => a.itinerary.stops - b.itinerary.stops || a.itinerary.elapsedMinutes - b.itinerary.elapsedMinutes,
  },
};

/**
 * Cheapest fare on each of the days around a date.
 *
 * Feeds the flexible-date strip. Capped at a week either side: computing a
 * month of fares for a route with three circuits a fortnight is a lot of work
 * to show mostly blanks.
 */
export function fareCalendar(from, to, date, { span = 3, ...options } = {}) {
  const days = [];
  for (let offset = -span; offset <= span; offset++) {
    const day = addDays(date, offset);
    if (day < options.earliest) { days.push({ date: day, offset, past: true }); continue; }
    const results = priceResults(searchItineraries(from, to, day, { maxStops: 2 }), options);
    const best = results.length ? Math.min(...results.map((r) => r.cheapest.total)) : null;
    days.push({ date: day, offset, total: best, count: results.length });
  }
  return days;
}

/**
 * The next day on or after `date` on which anything at all flies A to B.
 *
 * Every community on this network has days with no service. Answering "nothing
 * on Thursday" without saying "but there is a seat on Saturday" would send
 * someone to a phone for information the app already has.
 */
export function nextAvailableDate(from, to, date, { horizon = 21, ...options } = {}) {
  for (let i = 1; i <= horizon; i++) {
    const day = addDays(date, i);
    const results = searchItineraries(from, to, day, { maxStops: 2, maxResults: 1, ...options });
    if (results.length) return day;
  }
  return null;
}

export const brandName = (id) => brands[id]?.shortName ?? id;
export const airportName = (code) => airport(code).name;
