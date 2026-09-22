#!/usr/bin/env node
/**
 * Verification for the North Winds app.
 *
 * Three kinds of check, all of which fail the build:
 *
 *   1. The engine — schedules, fares, itineraries and bookings, asserted
 *      against the rules they are meant to implement. These are the ones worth
 *      having: a fare breakdown that does not add up, or an itinerary that
 *      routes a passenger back over their own departure point, is not something
 *      a human notices in a screenshot.
 *   2. The network — every route flown by an aircraft that can physically use
 *      every strip it calls at.
 *   3. The build output — contrast pairs, the module import graph, and the
 *      markers that keep a prototype from being mistaken for an airline.
 *
 * No dependencies. Run with `npm run check` after a build.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist/app');
const source = path.join(root, 'app');

let failures = 0;
let checks = 0;
const fail = (message) => { failures++; console.log(`  FAIL  ${message}`); };
const pass = (message) => { checks++; if (process.env.VERBOSE) console.log(`  ok    ${message}`); };

const ok = (condition, message) => (condition ? pass(message) : fail(message));
const eq = (actual, expected, message) =>
  ok(actual === expected, `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const near = (actual, expected, tolerance, message) =>
  ok(Math.abs(actual - expected) <= tolerance, `${message} — expected ~${expected}, got ${actual}`);

function group(name) { console.log(`\n${name}`); }

/* ── Imports ─────────────────────────────────────────────────────────────── */

const { airports, airport, distanceKm, searchAirports, airportsByRegion } = await import('../app/src/data/airports.js');
const { aircraft, aircraftList, aircraftType, buildSeatMap, seatCount } = await import('../app/src/data/aircraft.js');
const { routes, circuits, circuitRoutes, routePairs, servedCodes } = await import('../app/src/data/network.js');
const { fareFamilies, fareFamilyById, fareTypes, ancillaries, passengerTypes, brands, charges } = await import('../app/src/data/brand.js');
const dates = await import('../app/src/lib/dates.js');
const schedule = await import('../app/src/engine/schedule.js');
const pricing = await import('../app/src/engine/pricing.js');
const search = await import('../app/src/engine/search.js');
const booking = await import('../app/src/engine/booking.js');

/* ── 1. Dates and clocks ─────────────────────────────────────────────────── */

group('Dates, weeks and time zones');
{
  eq(dates.isoWeek('2026-01-01'), 1, 'ISO week of 1 January 2026');
  eq(dates.isoWeek('2026-01-05'), 2, 'ISO week of 5 January 2026');
  eq(dates.weekday('2026-09-15'), 2, '15 September 2026 is a Tuesday');
  eq(dates.isEvenWeek('2026-09-15'), true, 'week 38 is even');
  eq(dates.isEvenWeek('2026-09-22'), false, 'week 39 is odd');
  eq(dates.addDays('2026-12-31', 1), '2027-01-01', 'adding a day crosses the year');
  eq(dates.daysBetween('2026-03-01', '2026-03-15'), 14, 'days between two dates');

  eq(dates.isDaylightTime('2026-07-01'), true, 'July is daylight time');
  eq(dates.isDaylightTime('2026-01-15'), false, 'January is standard time');
  eq(dates.utcOffset(airport('YFB'), '2026-07-01'), -4, 'Iqaluit is UTC-4 in summer');
  eq(dates.utcOffset(airport('YFB'), '2026-01-01'), -5, 'Iqaluit is UTC-5 in winter');
  eq(dates.utcOffset(airport('YZS'), '2026-07-01'), -5, 'Salliq stays on Eastern Standard Time in summer');
  eq(dates.utcOffset(airport('YCB'), '2026-01-01'), -7, 'Cambridge Bay is UTC-7 in winter');

  const instant = dates.localToUtc(airport('YFB'), '2026-07-14', 7 * 60 + 30);
  eq(dates.localClock(airport('YFB'), instant), '07:30', 'round trip through UTC keeps the local clock');
  eq(dates.localClock(airport('YCB'), instant), '05:30', 'the same instant is two hours earlier in Cambridge Bay');

  eq(dates.formatDate('2026-07-14', 'short'), 'Tue 14 Jul', 'short date format');
  eq(dates.formatDate('2026-07-14', 'compact'), '14 Jul', 'compact date format');
  eq(dates.formatDuration(185), '3h 05m', 'duration over an hour');
  eq(dates.formatDuration(45), '45m', 'duration under an hour');
}

/* ── 2. Airports and aircraft ────────────────────────────────────────────── */

group('Airports and aircraft');
{
  const codes = airports.map((a) => a.code);
  eq(new Set(codes).size, codes.length, 'no duplicate airport codes');
  ok(airports.every((a) => a.lat > 40 && a.lat < 84), 'every airport is in a plausible latitude band');
  ok(airports.every((a) => a.lon < -60 && a.lon > -120), 'every airport is in a plausible longitude band');
  ok(airports.every((a) => a.runway >= 400 && a.runway <= 4000), 'every runway length is plausible');
  ok(airports.every((a) => a.aif > 0), 'every airport has an improvement fee');

  // Distances against figures that can be checked against a map.
  near(distanceKm('YFB', 'YOW'), 2095, 40, 'Iqaluit to Ottawa is about 2,095 km');
  near(distanceKm('YFB', 'YXP'), 297, 20, 'Iqaluit to Pangnirtung is about 300 km');
  near(distanceKm('YRT', 'YWG'), 1470, 40, 'Rankin Inlet to Winnipeg is about 1,470 km');
  eq(distanceKm('YFB', 'YFB'), 0, 'an airport is no distance from itself');
  eq(distanceKm('YFB', 'YOW'), distanceKm('YOW', 'YFB'), 'distance is symmetric');

  eq(searchAirports('pang')[0].code, 'YXP', 'searching a community name');
  eq(searchAirports('cape dorset')[0].code, 'YTE', 'searching a former name finds the community');
  eq(searchAirports('YFB')[0].code, 'YFB', 'searching by code');
  eq(searchAirports('').length, 0, 'an empty search returns nothing');
  eq(airportsByRegion().reduce((n, g) => n + g.airports.length, 0), airports.length, 'every airport is in exactly one region');

  for (const type of aircraftList) {
    const map = buildSeatMap(type.id);
    const ids = map.seats.map((s) => s.id);
    eq(new Set(ids).size, ids.length, `${type.name}: no duplicate seat ids`);
    ok(seatCount(type.id) > 0, `${type.name}: has seats`);
    ok(map.seats.every((s) => ['window', 'aisle', 'middle'].includes(s.position)), `${type.name}: every seat has a position`);
    ok(type.cruiseKph > 200 && type.cruiseKph < 1000, `${type.name}: plausible cruise speed`);
  }
  // The four-across cabins have no middle seats; the six-across ones do.
  ok(!buildSeatMap('dash8-100').seats.some((s) => s.position === 'middle'), 'a two-by-two cabin has no middle seats');
  ok(buildSeatMap('b737-800').seats.some((s) => s.position === 'middle'), 'a three-by-three cabin has middle seats');
}

/* ── 3. The network is flyable ───────────────────────────────────────────── */

group('Network');
{
  eq(new Set(routes.map((r) => r.id)).size, routes.length, 'no duplicate route ids');
  ok(routes.every((r) => r.stops.length >= 2), 'every route has at least two stops');
  ok(routes.every((r) => new Set(r.stops).size === r.stops.length), 'no route calls at the same place twice');
  ok(routes.every((r) => r.days.length && r.days.every((d) => d >= 1 && d <= 7)), 'every route has valid operating days');
  ok(routes.every((r) => ['weekly', 'even', 'odd'].includes(r.cadence)), 'every route has a known cadence');
  ok(routes.every((r) => r.depart >= 0 && r.depart < 1440), 'every departure time is a valid clock time');
  ok(routes.every((r) => brands[r.brand]), 'every route belongs to a known service line');

  // The check that matters: an aircraft assigned to a strip it cannot use.
  for (const route of routes) {
    const type = aircraftType(route.aircraft);
    for (const code of route.stops) {
      const place = airport(code);
      ok(place.runway >= type.minRunway,
        `NW${route.number}: ${type.name} needs ${type.minRunway} m, ${place.name} has ${place.runway} m`);
      ok(type.gravelCapable || place.surface === 'paved',
        `NW${route.number}: ${type.name} cannot use the ${place.surface} runway at ${place.name}`);
    }
  }

  eq(servedCodes.length, airports.length, 'every airport in the data is served by at least one route');

  // Flight numbering: the convention the app tells the user about.
  const ranges = { altitude: [100, 199], express: [300, 399], connect: [500, 599] };
  for (const route of routes) {
    const [low, high] = ranges[route.brand];
    ok(route.number >= low && route.number <= high,
      `NW${route.number} is ${route.brand} and should be numbered ${low}–${high}`);
  }

  // Every circuit's legs agree on their cadence, and the two Baffin circuits
  // alternate rather than both flying in the same week.
  for (const circuit of circuits) {
    const legs = circuitRoutes(circuit.id);
    ok(legs.length > 0, `${circuit.name}: has routes`);
  }
  const north = circuitRoutes('north-baffin');
  const east = circuitRoutes('east-baffin');
  ok(north.every((r) => r.cadence === 'even'), 'the North Baffin circuit flies even weeks');
  ok(east.every((r) => r.cadence === 'odd'), 'the East Baffin circuit flies odd weeks');

  // Over a fortnight, every Baffin community on a circuit sees an aircraft.
  const baffinOnCircuits = new Set([...north, ...east].flatMap((r) => r.stops));
  let seen = new Set();
  for (let i = 0; i < 14; i++) {
    const day = dates.addDays('2026-09-14', i);
    for (const flight of schedule.flightsOn(day)) for (const stop of flight.stops) seen.add(stop);
  }
  for (const code of baffinOnCircuits) {
    ok(seen.has(code), `${airport(code).name} is served at least once in a fortnight`);
  }

  // Every sellable pair on a circuit really is sellable.
  for (const route of routes) {
    const pairs = routePairs(route);
    const expected = (route.stops.length * (route.stops.length - 1)) / 2;
    eq(pairs.length, expected, `NW${route.number}: sells every forward pair of stops`);
  }
}

/* ── 4. Schedule ─────────────────────────────────────────────────────────── */

group('Schedule');
{
  const day = '2026-09-15'; // Tuesday, ISO week 38 — even
  eq(schedule.operatesOn(routes.find((r) => r.id === 'north-baffin-out'), day), true, 'North Baffin flies on an even Tuesday');
  eq(schedule.operatesOn(routes.find((r) => r.id === 'east-baffin-out'), day), false, 'East Baffin does not fly on an even Tuesday');
  eq(schedule.operatesOn(routes.find((r) => r.id === 'east-baffin-out'), '2026-09-22'), true, 'East Baffin flies on an odd Tuesday');

  const flight = schedule.buildFlight('north-baffin-out', day);
  eq(flight.legs.length, flight.stops.length - 1, 'a circuit has one leg between each pair of stops');
  ok(flight.legs.every((leg) => leg.blockMinutes >= 20), 'no leg is shorter than the minimum block time');
  ok(flight.legs.every((leg) => leg.arriveUtc > leg.departUtc), 'every leg arrives after it departs');
  for (let i = 1; i < flight.legs.length; i++) {
    ok(flight.legs[i].departUtc >= flight.legs[i - 1].arriveUtc,
      'an aircraft does not leave a stop before it has landed there');
  }

  // Block time should track distance and the aircraft's speed.
  const jet = schedule.blockMinutes('YFB', 'YOW', 'b737-800');
  const prop = schedule.blockMinutes('YFB', 'YOW', 'dash8-100');
  ok(prop > jet, 'a turboprop takes longer than a jet over the same distance');
  near(jet, 180, 20, 'Iqaluit to Ottawa by jet is about three hours');

  const seg = schedule.segment(flight, 'YGT', 'YAB');
  eq(seg.via.join(','), 'YIO', 'a segment across a circuit lists the stop it passes through');
  eq(seg.from, 'YGT', 'a segment boards where asked');
  eq(schedule.segment(flight, 'YAB', 'YGT'), null, 'a segment cannot be sold backwards along a circuit');
  eq(schedule.segment(flight, 'YFB', 'YFB'), null, 'a segment cannot start and end in the same place');

  // Inventory and the seat map are two views of one fact.
  for (const [from, to, date] of [['YFB', 'YOW', day], ['YGT', 'YAB', day], ['YFB', 'YXP', '2026-09-16']]) {
    const s = schedule.segmentsBetween(from, to, date)[0];
    if (!s) { fail(`no service ${from}–${to} on ${date} to check inventory`); continue; }
    const inventory = schedule.inventory(s);
    eq(schedule.occupiedSeats(s).size, inventory.sold, `${from}–${to}: seats sold matches the seat map`);
    eq(inventory.total, seatCount(s.aircraft), `${from}–${to}: capacity matches the aircraft`);
    ok(inventory.available >= 0, `${from}–${to}: availability is not negative`);
    ok(Object.values(inventory.byFamily).reduce((n, v) => n + v, 0) <= inventory.total,
      `${from}–${to}: fare buckets do not exceed the aircraft`);
  }

  // Determinism: the same flight must cost and look the same every time.
  const a = schedule.inventory(schedule.segmentsBetween('YFB', 'YOW', day)[0]);
  const b = schedule.inventory(schedule.segmentsBetween('YFB', 'YOW', day)[0]);
  eq(a.sold, b.sold, 'inventory is deterministic');
  eq(schedule.flightStatus(schedule.segmentsBetween('YFB', 'YOW', day)[0]).state,
    schedule.flightStatus(schedule.segmentsBetween('YFB', 'YOW', day)[0]).state, 'flight status is deterministic');

  // Grise Fiord must connect onto the southbound circuit rather than stranding.
  const gz = search.searchItineraries('YGZ', 'YFB', '2026-09-16');
  ok(gz.length > 0, 'Grise Fiord connects to Iqaluit on the circuit day');
  ok(gz.every((it) => it.elapsedMinutes < 24 * 60), 'the Grise Fiord connection is under a day');
}

/* ── 5. Itineraries ──────────────────────────────────────────────────────── */

group('Itinerary search');
{
  const sample = [
    ['YFB', 'YOW', '2026-10-13'], ['YCY', 'YOW', '2026-09-23'], ['YGZ', 'YFB', '2026-09-16'],
    ['YEK', 'YCB', '2026-09-15'], ['YXP', 'YUL', '2026-10-14'], ['YIO', 'YRT', '2026-10-13'],
  ];
  for (const [from, to, date] of sample) {
    for (const itinerary of search.searchItineraries(from, to, date)) {
      const visited = [itinerary.from, ...itinerary.segments.flatMap((s) => [...s.via, s.to])];
      eq(new Set(visited).size, visited.length, `${from}–${to}: an itinerary never visits the same airport twice`);
      eq(itinerary.from, from, `${from}–${to}: starts where asked`);
      eq(itinerary.to, to, `${from}–${to}: ends where asked`);
      ok(itinerary.arriveUtc > itinerary.departUtc, `${from}–${to}: arrives after it departs`);
      ok(itinerary.connections.every((c) => c.minutes >= schedule.MIN_CONNECTION_MIN),
        `${from}–${to}: every connection allows the minimum time`);
      ok(itinerary.connections.every((c) => c.minutes <= 24 * 60),
        `${from}–${to}: no connection is longer than a day`);
      for (let i = 1; i < itinerary.segments.length; i++) {
        eq(itinerary.segments[i].from, itinerary.segments[i - 1].to,
          `${from}–${to}: segments join end to end`);
      }
    }
  }

  eq(search.searchItineraries('YFB', 'YFB', '2026-10-13').length, 0, 'searching a place to itself returns nothing');

  // A journey survives being stored and rebuilt.
  const original = search.searchItineraries('YCY', 'YOW', '2026-09-23')[0];
  const rebuilt = search.itineraryFromRefs(search.serializeItinerary(original));
  eq(rebuilt.id, original.id, 'an itinerary rebuilds from its stored references');
  eq(rebuilt.departLocal, original.departLocal, 'a rebuilt itinerary keeps its departure time');

  // The brand filter restricts without breaking the journey.
  const jets = search.searchItineraries('YFB', 'YOW', '2026-10-13', { brand: 'altitude' });
  ok(jets.every((it) => it.brands.includes('altitude')), 'the service-line filter is honoured');

  // Multi-brand journeys exist — the point of the whole design.
  const mixed = search.searchItineraries('YCY', 'YOW', '2026-09-23').filter((it) => it.multiBrand);
  ok(mixed.length > 0, 'a circuit and a jet sell as one itinerary');

  const next = search.nextAvailableDate('YCY', 'YOW', '2026-09-22');
  ok(next && next > '2026-09-22', 'a day with no service reports the next one that has some');
}

/* ── 6. Pricing ──────────────────────────────────────────────────────────── */

group('Pricing');
{
  const itinerary = search.searchItineraries('YFB', 'YOW', '2026-10-13')[0];
  const base = { passengers: { adult: 1 }, daysAhead: 31 };

  // The breakdown must add up. A receipt that does not is the one bug a
  // passenger will always find.
  for (const family of fareFamilies.map((f) => f.id)) {
    const price = pricing.priceItinerary(itinerary, { ...base, family });
    const sum = price.fare + price.fuel + price.navCanada + price.aif + price.atsc + price.seats + price.extras + price.gst;
    eq(sum, price.total, `${family}: the breakdown sums to the total`);
    eq(price.gst, Math.round(price.preTax * charges.gstRate), `${family}: GST is 5% of everything before it`);
    ok(price.total > 0, `${family}: costs something`);
  }

  // Fare families are strictly ordered.
  const totals = fareFamilies.map((f) => pricing.priceItinerary(itinerary, { ...base, family: f.id }).total);
  for (let i = 1; i < totals.length; i++) {
    ok(totals[i] > totals[i - 1], `${fareFamilies[i].name} costs more than ${fareFamilies[i - 1].name}`);
  }

  // Passenger types.
  const adult = pricing.priceItinerary(itinerary, { family: 'standard', passengers: { adult: 1 }, daysAhead: 31 });
  const withChild = pricing.priceItinerary(itinerary, { family: 'standard', passengers: { adult: 1, child: 1 }, daysAhead: 31 });
  const withInfant = pricing.priceItinerary(itinerary, { family: 'standard', passengers: { adult: 1, infant: 1 }, daysAhead: 31 });
  ok(withChild.total > adult.total, 'a child adds to the total');
  ok(withInfant.total > adult.total, 'an infant adds something to the total');
  ok(withInfant.total - adult.total < withChild.total - adult.total, 'an infant costs less than a child');
  eq(withInfant.atsc, adult.atsc, 'an infant on a lap pays no security charge');
  eq(withInfant.aif, adult.aif, 'an infant on a lap pays no airport improvement fee');

  // Discounted fare types reduce the fare and only the fare.
  for (const type of fareTypes.filter((t) => t.discount > 0)) {
    const discounted = pricing.priceItinerary(itinerary, { ...base, family: 'standard', fareType: type.id });
    const standard = pricing.priceItinerary(itinerary, { ...base, family: 'standard', fareType: 'standard' });
    ok(discounted.fare < standard.fare, `${type.name} reduces the base fare`);
    eq(discounted.aif, standard.aif, `${type.name} does not change airport charges`);
    near(discounted.fare, Math.round(standard.fare * (1 - type.discount)), 2, `${type.name} applies its stated discount`);
  }

  // Booking sooner costs more; per-kilometre, the circuits cost most.
  const soon = pricing.priceItinerary(itinerary, { ...base, family: 'tundra', daysAhead: 1 });
  const later = pricing.priceItinerary(itinerary, { ...base, family: 'tundra', daysAhead: 60 });
  ok(soon.total > later.total, 'booking at the last minute costs more');

  const perKm = (from, to, date) => {
    const s = schedule.segmentsBetween(from, to, date)[0];
    return pricing.baseFareCents(s, { daysAhead: 30 }) / s.distanceKm;
  };
  ok(perKm('YGT', 'YIO', '2026-09-15') > perKm('YFB', 'YOW', '2026-09-15'),
    'a circuit sector costs more per kilometre than a jet sector');

  eq(pricing.money(123456), '$1,234.56', 'money formats as Canadian dollars');
  ok(pricing.milesEarned(itinerary, 'summit') > pricing.milesEarned(itinerary, 'tundra'),
    'a higher fare family earns more miles');
}

/* ── 7. Bookings ─────────────────────────────────────────────────────────── */

group('Bookings');
{
  const itinerary = search.searchItineraries('YFB', 'YOW', '2026-10-13')[0];
  const passengers = [
    { firstName: 'Adam', lastName: 'Aliqatuqtuq', type: 'adult' },
    { firstName: 'Sila', lastName: 'Aliqatuqtuq', type: 'child' },
  ];
  const make = (family) => booking.createBooking({
    journeys: [{ label: 'Outbound', segments: itinerary.segments }],
    passengers,
    contact: { email: 'traveller@example.com' },
    family,
    price: pricing.priceItinerary(itinerary, { family, passengers: { adult: 1, child: 1 }, daysAhead: 31 }),
  });

  const reference = booking.makeReference();
  eq(reference.length, 6, 'a record locator is six characters');
  ok(/^[A-HJ-NP-Z2-9]{6}$/.test(reference), 'a record locator avoids characters that are misheard');
  const many = new Set(Array.from({ length: 2000 }, () => booking.makeReference()));
  ok(many.size > 1990, 'record locators do not collide in practice');

  const confirmed = make('standard');
  const live = booking.hydrate(confirmed);
  eq(live.journeys[0].segments.length, itinerary.segments.length, 'a booking rebuilds its flights');
  eq(live.status, 'confirmed', 'a new booking is confirmed');
  ok(live.miles > 0, 'a booking earns miles');

  // Fare rules are enforced where they are written, not in a view.
  eq(booking.changeQuote(make('tundra'), 0, itinerary).allowed, false, 'a Tundra fare cannot be changed');
  eq(booking.changeQuote(make('flex'), 0, itinerary).allowed, true, 'a Flex fare can be changed');
  eq(booking.changeQuote(make('flex'), 0, itinerary).fee, 0, 'a Flex change carries no fee');
  eq(booking.changeQuote(make('standard'), 0, itinerary).fee, 75 * 100 * 2, 'a Standard change is $75 per traveller');

  const later = search.searchItineraries('YFB', 'YOW', '2026-10-20')[0];
  const quote = booking.changeQuote(confirmed, 0, later);
  ok(quote.payable >= 0, 'a change never pays money out on a non-refundable fare');
  const changed = booking.applyChange(confirmed, 0, later, quote);
  eq(booking.hydrate(changed).journeys[0].segments[0].date, '2026-10-20', 'a change moves the flight');
  eq(Object.keys(changed.seats).length, 0, 'a change releases seats on the old aircraft');
  ok(changed.history.length > confirmed.history.length, 'a change is recorded in the history');

  eq(booking.cancelQuote(make('tundra')).kind, 'none', 'a Tundra fare returns nothing on cancellation');
  eq(booking.cancelQuote(make('flex')).kind, 'credit', 'a Flex fare returns travel credit');
  eq(booking.cancelQuote(make('summit')).kind, 'refund', 'a Summit fare is refundable');
  eq(booking.cancelQuote(make('flex')).fee, 0, 'a Flex cancellation carries no fee');
  eq(booking.cancelQuote(make('standard')).fee, 125 * 100, 'a Standard cancellation costs $125');
  const cancelled = booking.cancelBooking(confirmed, booking.cancelQuote(confirmed));
  eq(cancelled.status, 'cancelled', 'cancelling sets the status');

  // Check-in assigns seats, and only ones the fare may sit in.
  for (const family of ['tundra', 'summit']) {
    const checked = booking.checkIn(make(family), 0);
    const seg = booking.hydrate(checked).journeys[0].segments[0];
    const assigned = Object.values(checked.seats[seg.id] ?? {});
    eq(assigned.length, 2, `${family}: the adult and the child each get a seat at check-in`);
    const map = buildSeatMap(seg.aircraft);
    for (const seatId of assigned) {
      const seat = map.seats.find((s) => s.id === seatId);
      ok(seat && booking.seatEligible(seat, family), `${family}: assigned seat ${seatId} is one this fare may use`);
    }
    eq(new Set(assigned).size, assigned.length, `${family}: no two travellers get the same seat`);
  }

  // The boarding pass carries a well-formed BCBP.
  const boarded = booking.checkIn(confirmed, 0);
  const seg = booking.hydrate(boarded).journeys[0].segments[0];
  const detail = booking.boardingDetail(seg, 0, boarded);
  const bcbp = booking.bcbpString(boarded, seg, 0, detail);
  ok(bcbp.startsWith('M1'), 'the BCBP names the format');
  ok(bcbp.includes(boarded.reference), 'the BCBP carries the record locator');
  ok(bcbp.includes(`${seg.from}${seg.to}`), 'the BCBP carries the sector');
  eq(bcbp.length, 60, 'the BCBP is the right length for a single-leg M1 pass');

  eq(booking.fareRules('tundra').length, 6, 'fare rules cover every heading');
  ok(booking.fareRules('tundra')[0].body.includes('Not permitted'), 'the Tundra rules say changes are not permitted');
}

/* ── 8. Navigation ───────────────────────────────────────────────────────── */

group('Navigation');
{
  const { sections, tabs, utilityLinks, footerColumns, footerLegal, allLinks } =
    await import('../app/src/data/sitemap.js');

  // Every path the menus, the tab bar and the footer offer must be a route
  // that exists. With six menus, a footer sitemap and fifty-odd screens, a
  // dead link is otherwise found by a person, on the live site.
  const mainSource = await readFile(path.join(source, 'src/main.js'), 'utf8');
  const registered = new Set(
    [...mainSource.matchAll(/route\('([^']+)'/g)].map((m) => m[1]),
  );
  ok(registered.size > 40, `${registered.size} routes registered`);

  /** A concrete path matches a pattern with :params of the same shape. */
  const resolves = (target) => {
    const wanted = target.split('/').filter(Boolean);
    for (const pattern of registered) {
      const parts = pattern.split('/').filter(Boolean);
      if (parts.length !== wanted.length) continue;
      if (parts.every((part, i) => part.startsWith(':') || part === wanted[i])) return true;
    }
    return false;
  };

  const navPaths = [
    ...allLinks().map((link) => ({ path: link.path, where: `${link.section} → ${link.group}` })),
    ...tabs.map((tab) => ({ path: tab.path, where: 'tab bar' })),
    ...utilityLinks.map((link) => ({ path: link.path, where: 'utility bar' })),
    ...footerColumns.flatMap((column) => column.links.map((link) => ({ path: link.path, where: `footer — ${column.heading}` }))),
    ...footerLegal.map((link) => ({ path: link.path, where: 'footer — legal' })),
  ];

  let dead = 0;
  for (const entry of navPaths) {
    // The phone's menu tab opens the sheet rather than navigating.
    if (entry.path === '/menu') continue;
    if (resolves(entry.path)) continue;
    fail(`${entry.where}: "${entry.path}" is not a registered route`);
    dead++;
  }
  ok(dead === 0, `${navPaths.length} navigation links all resolve`);

  // And every link carries an explanation, because half these words mean
  // nothing to someone who has not flown this network before.
  const unexplained = allLinks().filter((link) => !link.note);
  ok(unexplained.length === 0,
    `every menu link explains itself${unexplained.length ? ` — missing on ${unexplained.map((l) => l.path).join(', ')}` : ''}`);

  ok(sections.length >= 5, `${sections.length} menu sections`);
  ok(tabs.length === 5, 'the phone tab bar has five destinations');
}

/* ── 9. Contrast ─────────────────────────────────────────────────────────── */

group('Contrast (WCAG 2.2)');
{
  const luminance = (hex) => {
    const n = hex.replace('#', '');
    const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
    const [r, g, b] = [0, 2, 4]
      .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };

  /**
   * The palette is read out of tokens.css rather than restated here.
   *
   * A checker with its own copy of the colours passes happily while the app
   * ships a different one. Parsing the stylesheet means the only way to change
   * a colour is to change the thing that is actually served.
   */
  const tokensCss = await readFile(path.join(source, 'styles/tokens.css'), 'utf8');
  const readBlock = (css) => Object.fromEntries(
    [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})\s*;/g)].map((m) => [m[1], m[2]]),
  );
  const darkStart = tokensCss.indexOf('@media (prefers-color-scheme: dark)');
  const lightTokens = readBlock(tokensCss.slice(0, darkStart));
  const darkTokens = { ...lightTokens, ...readBlock(tokensCss.slice(darkStart)) };
  ok(Object.keys(lightTokens).length > 20, 'the token file parsed');

  const L = (name) => {
    const value = lightTokens[name];
    if (!value) fail(`token --${name} is not defined in tokens.css`);
    return value ?? '#000000';
  };
  const D = (name) => {
    const value = darkTokens[name];
    if (!value) fail(`token --${name} is not defined for the dark theme`);
    return value ?? '#000000';
  };

  const light = {
    bg: L('bg'), surface: L('surface'), surface2: L('surface-2'), sunken: L('surface-sunken'),
    chrome: L('night-800'), chrome2: L('night-900'),
    ink: L('ink'), ink2: L('ink-2'), inkMuted: L('ink-muted'),
    onChrome: L('on-chrome'), onChromeMuted: L('on-chrome-muted'),
    altitude: L('altitude-text'), express: L('express-text'), connect: L('connect-text'),
    aurora: L('aurora'), auroraDeep: L('aurora-deep'), auroraSoft: L('aurora-soft'),
    sunDeep: L('sun-deep'), sunSoft: L('sun-soft'), iceDeep: L('ice-deep'),
    ok: L('ok'), warn: L('warn-text'), danger: L('danger'),
    flag: L('flag'), flagInk: L('flag-ink'),
    okBg: L('ok-bg'), warnBg: L('warn-bg'), dangerBg: L('danger-bg'), infoBg: L('info-bg'),
  };
  const dark = {
    bg: D('bg'), surface: D('surface'), surface2: D('surface-2'), chrome: D('chrome'),
    ink: D('ink'), ink2: D('ink-2'), inkMuted: D('ink-muted'),
    onChrome: D('on-chrome'), onChromeMuted: D('on-chrome-muted'),
    altitude: D('altitude-text'), express: D('express-text'), connect: D('connect-text'),
    auroraDeep: D('aurora-deep'), auroraSoft: D('aurora-soft'),
    sunDeep: D('sun-deep'), sunSoft: D('sun-soft'), iceDeep: D('ice-deep'),
    ok: D('ok'), warn: D('warn-text'), danger: D('danger'),
    okBg: D('ok-bg'), warnBg: D('warn-bg'), dangerBg: D('danger-bg'), infoBg: D('info-bg'),
    flag: D('flag'), flagInk: D('flag-ink'),
  };

  // [label, foreground, background, minimum]
  const pairs = [
    ['body text on the page', light.ink, light.bg, 4.5],
    ['body text on a card', light.ink, light.surface, 4.5],
    ['secondary text on a card', light.ink2, light.surface, 4.5],
    ['muted text on a card', light.inkMuted, light.surface, 4.5],
    ['muted text on a sunken panel', light.inkMuted, light.sunken, 4.5],
    ['muted text on the page', light.inkMuted, light.bg, 4.5],
    ['Altitude text on a card', light.altitude, light.surface, 4.5],
    ['Express text on a card', light.express, light.surface, 4.5],
    ['Connect text on a card', light.connect, light.surface, 4.5],
    ['aurora text on a card', light.auroraDeep, light.surface, 4.5],
    ['aurora text on its soft panel', light.auroraDeep, light.auroraSoft, 4.5],
    ['sun text on a card', light.sunDeep, light.surface, 4.5],
    ['sun text on its soft panel', light.sunDeep, light.sunSoft, 4.5],
    ['link text on a card', light.iceDeep, light.surface, 4.5],
    ['link text on the page', light.iceDeep, light.bg, 4.5],
    ['white on the header', light.onChrome, light.chrome, 4.5],
    ['muted on the header', light.onChromeMuted, light.chrome, 4.5],
    ['prototype chip text on aurora', light.chrome2, light.aurora, 4.5],
    ['aurora chip against the header', light.aurora, light.chrome, 3],
    ['success text on its background', light.ok, light.okBg, 4.5],
    ['warning text on its background', light.warn, light.warnBg, 4.5],
    ['danger text on its background', light.danger, light.dangerBg, 4.5],
    ['secondary text on an info panel', light.ink2, light.infoBg, 4.5],
    ['focus ring on the page', light.chrome, light.bg, 3],
    ['fare flag text on its band', light.flagInk, light.flag, 4.5],
    ['fare flag band against a card', light.flag, light.surface, 3],

    ['dark: body text on a card', dark.ink, dark.surface, 4.5],
    ['dark: secondary text on a card', dark.ink2, dark.surface, 4.5],
    ['dark: muted text on a card', dark.inkMuted, dark.surface, 4.5],
    ['dark: muted text on the page', dark.inkMuted, dark.bg, 4.5],
    ['dark: Altitude text on a card', dark.altitude, dark.surface, 4.5],
    ['dark: Express text on a card', dark.express, dark.surface, 4.5],
    ['dark: Connect text on a card', dark.connect, dark.surface, 4.5],
    ['dark: aurora text on a card', dark.auroraDeep, dark.surface, 4.5],
    ['dark: aurora text on its soft panel', dark.auroraDeep, dark.auroraSoft, 4.5],
    ['dark: sun text on its soft panel', dark.sunDeep, dark.sunSoft, 4.5],
    ['dark: link text on a card', dark.iceDeep, dark.surface, 4.5],
    ['dark: white on the header', dark.onChrome, dark.chrome, 4.5],
    ['dark: muted on the header', dark.onChromeMuted, dark.chrome, 4.5],
    ['dark: success on its background', dark.ok, dark.okBg, 4.5],
    ['dark: warning on its background', dark.warn, dark.warnBg, 4.5],
    ['dark: danger on its background', dark.danger, dark.dangerBg, 4.5],
    ['dark: secondary text on an info panel', dark.ink2, dark.infoBg, 4.5],
    ['dark: fare flag text on its band', dark.flagInk, dark.flag, 4.5],
    ['dark: fare flag band against a card', dark.flag, dark.surface, 3],
  ];

  for (const [label, fg, bg, min] of pairs) {
    const ratio = contrast(fg, bg);
    ok(ratio >= min, `${label} — ${ratio.toFixed(2)}:1, needs ${min}:1`);
  }
}

/* ── 10. Build output ─────────────────────────────────────────────────────── */

group('Build output');
{
  const exists = async (file) => stat(path.join(dist, file)).then(() => true).catch(() => false);

  for (const file of ['index.html', 'sw.js', 'manifest.webmanifest', 'assets/app.css',
    'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png', 'src/main.js']) {
    ok(await exists(file), `dist/app/${file} was written`);
  }

  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  ok(/<title>.+<\/title>/.test(html), 'the shell has a title');
  ok(/<meta name="description" content="[^"]{50,}"/.test(html), 'the shell has a meta description');
  ok(/name="robots"[^>]*noindex/.test(html), 'the app is excluded from search');
  ok(/class="skip-link"/.test(html), 'the shell has a skip link');
  ok(/<main class="app-main" id="main"/.test(html), 'the shell has a main landmark');
  ok(/<noscript>/.test(html), 'the shell says what to do without JavaScript');
  ok(!/\son(click|load|error|submit)=/.test(html), 'the shell has no inline event handlers');

  const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8'));
  eq(manifest.start_url, './', 'the manifest starts at a relative URL');
  ok(manifest.icons.length >= 3, 'the manifest declares its icons');
  ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'the manifest has a maskable icon');
  for (const declared of manifest.icons) {
    ok(await exists(declared.src.replace('./', '')), `manifest icon ${declared.src} exists`);
  }

  const sw = await readFile(path.join(dist, 'sw.js'), 'utf8');
  ok(!sw.includes('__BUILD_VERSION__'), 'the service worker was stamped with a version');
  ok(!sw.includes('__PRECACHE__'), 'the service worker was given its precache list');
  const precache = JSON.parse(sw.slice(sw.indexOf('const PRECACHE = ') + 17, sw.indexOf('];', sw.indexOf('const PRECACHE = ')) + 1));
  for (const entry of precache) {
    if (entry === './') continue;
    ok(await exists(entry.replace('./', '')), `precached ${entry} exists`);
  }

  // Every module the app imports must resolve. Without a bundler nothing else
  // catches a mistyped path until the screen that needs it is opened.
  const walk = async (dir, base = dir) => {
    const found = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) found.push(...(await walk(full, base)));
      else if (entry.name.endsWith('.js')) found.push(full);
    }
    return found;
  };
  const modules = await walk(path.join(source, 'src'));
  let broken = 0;
  for (const file of modules) {
    const code = await readFile(file, 'utf8');
    for (const match of code.matchAll(/(?:^|\n)\s*(?:import|export)[^'"]*from\s+['"](\.[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      if (!(await stat(target).then(() => true).catch(() => false))) {
        fail(`${path.relative(root, file)} imports ${match[1]}, which does not exist`);
        broken++;
      }
    }
    if (/\son(click|submit|load)=/.test(code)) {
      fail(`${path.relative(root, file)} emits an inline event handler`);
    }
  }
  ok(broken === 0, `${modules.length} modules: every import resolves`);

  const css = await readFile(path.join(dist, 'assets/app.css'), 'utf8');
  ok(css.includes('prefers-color-scheme: dark'), 'the stylesheet has a dark theme');
  ok(css.includes('prefers-reduced-motion'), 'the stylesheet respects reduced motion');
  ok(css.includes('@media print'), 'the stylesheet has print rules for the boarding pass');
  // One stylesheet for the whole site — thirty-odd screens, two themes, a hero
  // and a seat map. The budget exists to catch it doubling, not to hold it at a
  // number set when the app was six screens.
  ok(css.length < 90 * 1024, `the stylesheet is under 90 KB (${(css.length / 1024).toFixed(1)} KB)`);

  // The standing marker. This app describes an airline that does not exist and
  // must not be able to ship without saying so.
  const about = await readFile(path.join(source, 'src/views/about.js'), 'utf8');
  ok(/does not exist/.test(about), 'the about screen states the airline does not exist');
  const chrome = await readFile(path.join(source, 'src/views/chrome.js'), 'utf8');
  ok(/proto-chip/.test(chrome), 'every screen carries the prototype marker in its header');
  ok(/does not exist yet/.test(chrome), 'the footer states the airline does not exist');
  const payment = await readFile(path.join(source, 'src/views/payment.js'), 'utf8');
  ok(/No payment is taken/.test(payment), 'the payment screen states that no payment is taken');
}

/* ── Report ──────────────────────────────────────────────────────────────── */

console.log(`\n${checks + failures} checks — ${failures} failure(s)\n`);
process.exit(failures ? 1 : 0);
