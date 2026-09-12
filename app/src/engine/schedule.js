/**
 * The schedule engine.
 *
 * Turns a route pattern plus a date into flights with real times, real block
 * times and real seat inventory. Nothing is stored: a flight is recomputed from
 * its identifiers whenever it is needed, so a booking made today still resolves
 * to the same flight next week, and the timetable extends as far into the
 * future as anyone cares to look.
 */

import { airport, distanceKm } from '../data/airports.js';
import { aircraftType, seatCount, buildSeatMap } from '../data/aircraft.js';
import { routes, routeById } from '../data/network.js';
import { brands } from '../data/brand.js';
import { weekday, isEvenWeek, localToUtc, localClock, localDate, dayOffset, isoDate } from '../lib/dates.js';
import { unit, centred, int, chance, pick } from '../lib/random.js';

/** Minutes on the ground before the wheels leave: taxi, de-ice, climb allowance. */
const GROUND_ALLOWANCE = { jet: 18, turboprop: 11 };

/** How long a passenger needs between two flights at the same airport. */
export const MIN_CONNECTION_MIN = 40;
export const MAX_CONNECTION_MIN = 8 * 60;

/** Block time for one leg, rounded to the five minutes a timetable is written in. */
export function blockMinutes(from, to, typeId) {
  const type = aircraftType(typeId);
  const allowance = type.cruiseKph > 600 ? GROUND_ALLOWANCE.jet : GROUND_ALLOWANCE.turboprop;
  const airborne = (distanceKm(from, to) / type.cruiseKph) * 60;
  return Math.max(20, Math.round((airborne + allowance) / 5) * 5);
}

/** Does this route operate on this date? */
export function operatesOn(route, iso) {
  if (!route.days.includes(weekday(iso))) return false;
  if (route.cadence === 'even') return isEvenWeek(iso);
  if (route.cadence === 'odd') return !isEvenWeek(iso);
  return true;
}

/**
 * Build the full sequence of legs a route flies on a date.
 *
 * Each leg carries the UTC instants, so anything downstream can present them in
 * whichever local clock it needs.
 */
export function buildFlight(routeOrId, iso) {
  const route = typeof routeOrId === 'string' ? routeById[routeOrId] : routeOrId;
  if (!route) throw new Error(`Unknown route: ${routeOrId}`);
  const type = aircraftType(route.aircraft);
  const origin = airport(route.stops[0]);

  let cursor = localToUtc(origin, iso, route.depart);
  const legs = [];
  for (let i = 0; i < route.stops.length - 1; i++) {
    const from = route.stops[i];
    const to = route.stops[i + 1];
    const block = blockMinutes(from, to, route.aircraft);
    const departUtc = cursor;
    const arriveUtc = departUtc + block * 60000;
    legs.push({
      from,
      to,
      departUtc,
      arriveUtc,
      blockMinutes: block,
      distanceKm: distanceKm(from, to),
      groundMinutes: i < route.stops.length - 2 ? type.turnaroundMin : 0,
    });
    cursor = arriveUtc + type.turnaroundMin * 60000;
  }

  return {
    id: `${route.id}:${iso}`,
    routeId: route.id,
    number: route.number,
    flightNumber: `NW${route.number}`,
    brand: route.brand,
    brandName: brands[route.brand].name,
    aircraft: route.aircraft,
    aircraftName: type.name,
    date: iso,
    stops: route.stops,
    name: route.name,
    note: route.note,
    circuit: route.circuit ?? null,
    legs,
    departUtc: legs[0].departUtc,
    arriveUtc: legs[legs.length - 1].arriveUtc,
    seats: seatCount(route.aircraft),
  };
}

/** Every flight operating on a date, in departure order. */
export function flightsOn(iso) {
  return routes
    .filter((route) => operatesOn(route, iso))
    .map((route) => buildFlight(route, iso))
    .sort((a, b) => a.departUtc - b.departUtc);
}

/**
 * A sellable segment: one flight, boarding at one stop and leaving at another.
 *
 * On a circuit this is how a passenger actually experiences the aircraft —
 * Igloolik to Pond Inlet is a segment of the North Baffin circuit, not a
 * flight of its own, and it shows the stops it passes through in between.
 */
export function segment(flight, fromCode, toCode) {
  const i = flight.stops.indexOf(fromCode);
  const j = flight.stops.indexOf(toCode);
  if (i === -1 || j === -1 || i >= j) return null;

  const legs = flight.legs.slice(i, j);
  const departUtc = legs[0].departUtc;
  const arriveUtc = legs[legs.length - 1].arriveUtc;
  const from = airport(fromCode);
  const to = airport(toCode);

  return {
    id: `${flight.routeId}:${flight.date}:${fromCode}-${toCode}`,
    flightId: flight.id,
    routeId: flight.routeId,
    flightNumber: flight.flightNumber,
    brand: flight.brand,
    aircraft: flight.aircraft,
    aircraftName: flight.aircraftName,
    date: flight.date,
    from: fromCode,
    to: toCode,
    departUtc,
    arriveUtc,
    departLocal: localClock(from, departUtc),
    arriveLocal: localClock(to, arriveUtc),
    departDate: localDate(from, departUtc),
    arriveDate: localDate(to, arriveUtc),
    dayOffset: dayOffset(from, departUtc, to, arriveUtc),
    elapsedMinutes: Math.round((arriveUtc - departUtc) / 60000),
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    // Intermediate stops the aircraft makes while the passenger stays aboard.
    via: flight.stops.slice(i + 1, j),
    circuit: flight.circuit,
    routeName: flight.name,
  };
}

/** Every sellable segment between two airports on a date. */
export function segmentsBetween(from, to, iso) {
  const found = [];
  for (const route of routes) {
    const i = route.stops.indexOf(from);
    const j = route.stops.indexOf(to);
    if (i === -1 || j === -1 || i >= j) continue;
    if (!operatesOn(route, iso)) continue;
    const seg = segment(buildFlight(route, iso), from, to);
    if (seg) found.push(seg);
  }
  return found.sort((a, b) => a.departUtc - b.departUtc);
}

/**
 * Inventory for a segment.
 *
 * Derived, not stored: the same flight always shows the same load. Local
 * bookings are layered on top by the booking store, so a seat you took is
 * taken.
 */
export function inventory(seg) {
  const loadFactor = centred(`load:${seg.flightId}:${seg.from}`, 0.32, 0.97);
  const total = seatCount(seg.aircraft);
  const sold = Math.round(total * loadFactor);
  const available = Math.max(0, total - sold);

  // Cheaper fare families sell out first. Each gets a slice of what is left.
  const shares = { tundra: 0.22, standard: 0.34, flex: 0.3, summit: 0.14 };
  const byFamily = {};
  for (const [family, share] of Object.entries(shares)) {
    const seats = Math.floor(available * share * (0.6 + unit(`fam:${seg.id}:${family}`) * 0.9));
    byFamily[family] = Math.max(0, Math.min(available, seats));
  }
  // Something is always sellable while the aircraft has a seat: the last seats
  // on a full aircraft are the expensive ones, never nothing at all.
  if (available > 0 && Object.values(byFamily).every((n) => n === 0)) {
    byFamily.summit = Math.min(available, 2);
  }

  return { total, sold, available, loadFactor, byFamily };
}

/**
 * Seats already taken on a flight, as a set of seat ids.
 *
 * Exactly as many seats as the inventory says are sold — the two are the same
 * fact, so the seat map cannot show a full cabin next to "22 seats available".
 * Which seats go first is weighted: windows before middles, forward before aft.
 */
export function occupiedSeats(seg) {
  const map = buildSeatMap(seg.aircraft);
  const { sold } = inventory(seg);
  const sellable = map.seats.filter((seat) => !seat.blocked);
  const ranked = sellable
    .map((seat) => {
      const desirability = (seat.position === 'middle' ? 0.55 : seat.position === 'window' ? 1 : 0.85)
        * (seat.legroom ? 1.2 : 1)
        * (1 - Math.min(0.35, seat.row / 120));
      return { id: seat.id, score: unit(`seat:${seg.flightId}:${seat.id}`) / desirability };
    })
    .sort((a, b) => a.score - b.score);
  return new Set(ranked.slice(0, sold).map((s) => s.id));
}

/**
 * Operational status for a flight, on the day.
 *
 * Weather is the reason things move up here, so the states name the actual
 * cause. Anything more than a few days out is simply scheduled — an airline
 * that forecasts a delay a fortnight ahead is guessing.
 */
const WEATHER = [
  'Ice fog at the destination',
  'Crosswind above limits',
  'Blowing snow — visibility below minima',
  'Freezing drizzle — de-icing in progress',
  'Low ceiling at the alternate',
];

export function flightStatus(seg, nowIso = isoDate(new Date())) {
  const daysOut = Math.round((new Date(`${seg.date}T00:00:00Z`) - new Date(`${nowIso}T00:00:00Z`)) / 86400000);
  if (daysOut > 3) return { state: 'scheduled', label: 'Scheduled' };
  if (daysOut < 0) return { state: 'departed', label: 'Departed' };

  const seed = `status:${seg.flightId}`;
  if (chance(`${seed}:cancel`, 0.05)) {
    return {
      state: 'cancelled',
      label: 'Cancelled',
      reason: pick(`${seed}:why`, WEATHER),
      detail: 'Affected passengers are rebooked on the next available service at no charge.',
    };
  }
  if (chance(`${seed}:hold`, 0.13)) {
    return {
      state: 'delayed',
      label: 'Weather hold',
      reason: pick(`${seed}:why`, WEATHER),
      delayMinutes: int(`${seed}:mins`, 30, 240),
      detail: 'Crew are standing by. A new departure time will be posted once conditions are reassessed.',
    };
  }
  if (chance(`${seed}:late`, 0.15)) {
    return { state: 'delayed', label: 'Delayed', reason: 'Late inbound aircraft', delayMinutes: int(`${seed}:mins2`, 15, 75) };
  }
  if (daysOut === 0) return { state: 'on-time', label: 'On time' };
  return { state: 'scheduled', label: 'Scheduled' };
}

/**
 * The next dates a route operates, from a starting date.
 *
 * Used by the milk-run timetable, and by the "next departure" line on a
 * community's page. Searching a bounded window rather than solving the cadence
 * arithmetic keeps the fortnightly and weekly cases on one code path.
 */
export function nextOperatingDates(route, fromIso, count = 4, horizonDays = 120) {
  const dates = [];
  let cursor = fromIso;
  for (let i = 0; i < horizonDays && dates.length < count; i++) {
    if (operatesOn(route, cursor)) dates.push(cursor);
    cursor = isoDate(new Date(new Date(`${cursor}T00:00:00Z`).getTime() + 86400000));
  }
  return dates;
}
