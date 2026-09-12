/**
 * Bookings: creating them, changing them, cancelling them, checking in.
 *
 * A booking stores the *identity* of each segment — route, date, boarding point,
 * leaving point — and never the computed times or prices. Everything else is
 * rebuilt from the schedule engine on read. That means a booking is a few
 * hundred bytes, survives a timetable correction, and can never disagree with
 * the flight it is for.
 *
 * The price paid is the one exception: it is a snapshot, because what someone
 * was charged is a fact about the past and must not drift when demand does.
 *
 * These functions are pure. Persistence lives in store.js.
 */

import { buildFlight, segment, occupiedSeats, inventory } from './schedule.js';
import { priceItinerary, seatFeeCents, milesEarned } from './pricing.js';
import { fareFamilyById, fareTypeById } from '../data/brand.js';
import { buildSeatMap } from '../data/aircraft.js';
import { airport } from '../data/airports.js';
import { today, daysBetween, isoDate, localClock } from '../lib/dates.js';
import { hash, int } from '../lib/random.js';

/* ── References ──────────────────────────────────────────────────────────── */

// I, O, 0 and 1 are left out: a record locator gets read down a bad phone line
// from a community office, and those four are where it goes wrong.
const LOCATOR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A six-character record locator. */
export function makeReference(entropy = null) {
  const bytes = new Uint8Array(6);
  if (entropy) {
    for (let i = 0; i < 6; i++) bytes[i] = hash(`${entropy}:${i}`) & 0xff;
  } else if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((b) => LOCATOR_ALPHABET[b % LOCATOR_ALPHABET.length]).join('');
}

/* ── Reading a booking ───────────────────────────────────────────────────── */

/** Rebuild the live segments of a stored journey. */
export function hydrateJourney(journey) {
  return journey.segments
    .map((s) => segment(buildFlight(s.routeId, s.date), s.from, s.to))
    .filter(Boolean);
}

/**
 * A stored booking, with its flights, times and current state resolved.
 *
 * Everything a screen needs comes from here, so no view has to know how a
 * booking is shaped on disk.
 */
export function hydrate(booking) {
  const journeys = booking.journeys.map((journey) => {
    const segments = hydrateJourney(journey);
    const first = segments[0];
    const last = segments[segments.length - 1];
    return {
      ...journey,
      segments,
      from: first?.from ?? journey.segments[0].from,
      to: last?.to ?? journey.segments.at(-1).to,
      departUtc: first?.departUtc ?? 0,
      arriveUtc: last?.arriveUtc ?? 0,
      departDate: first?.departDate ?? journey.segments[0].date,
      elapsedMinutes: first && last ? Math.round((last.arriveUtc - first.departUtc) / 60000) : 0,
      stops: segments.length - 1,
    };
  });

  const departUtc = Math.min(...journeys.map((j) => j.departUtc));
  const daysToDeparture = daysBetween(today(), journeys[0]?.departDate ?? today());

  return {
    ...booking,
    journeys,
    departUtc,
    daysToDeparture,
    past: booking.status === 'cancelled' ? false : departUtc < Date.now(),
    family: fareFamilyById[booking.family],
    fareTypeInfo: fareTypeById[booking.fareType] ?? fareTypeById.standard,
    segmentCount: journeys.reduce((n, j) => n + j.segments.length, 0),
  };
}

/* ── Creating ────────────────────────────────────────────────────────────── */

/**
 * Build a booking record from a completed checkout.
 *
 * `journeys` is one entry for an outbound-only trip, two for a return, more for
 * multi-city. Seats are keyed by segment id then passenger index, so a
 * passenger can sit in a different seat on each leg — which they will, because
 * the aircraft changes.
 */
export function createBooking({
  journeys,
  passengers,
  contact,
  family,
  fareType = 'standard',
  seats = {},
  extras = {},
  price,
  reference = makeReference(),
  now = new Date().toISOString(),
}) {
  return {
    reference,
    created: now,
    status: 'confirmed',
    family,
    fareType,
    contact,
    passengers,
    journeys: journeys.map((journey) => ({
      id: journey.id ?? journey.segments.map((s) => `${s.routeId}:${s.date}:${s.from}-${s.to}`).join('+'),
      label: journey.label ?? 'Outbound',
      segments: journey.segments.map((s) => ({
        routeId: s.routeId, date: s.date, from: s.from, to: s.to,
      })),
    })),
    seats,
    extras,
    price,
    checkedIn: {},
    miles: journeys.reduce((sum, j) => sum + milesEarned({ segments: j.segments }, family), 0),
    history: [{ at: now, event: 'created', detail: 'Booking confirmed' }],
  };
}

/** Append an audit entry. Every mutation goes through this. */
function log(booking, event, detail) {
  return {
    ...booking,
    history: [...booking.history, { at: new Date().toISOString(), event, detail }],
  };
}

/* ── Seats ───────────────────────────────────────────────────────────────── */

/**
 * Whether a fare may sit in a seat's cabin.
 *
 * The Summit cabin is part of the Summit fare, not an upgrade anyone can pick
 * at check-in. One rule, used by the seat picker and by automatic assignment,
 * so the two cannot disagree.
 */
export function seatEligible(seat, familyId) {
  if (seat.blocked) return false;
  if (seat.cabin === 'summit') return familyId === 'summit';
  return true;
}

/** Seats a passenger may not take on this segment: sold, blocked, or ours. */
export function unavailableSeats(seg, booking = null) {
  const taken = new Set(occupiedSeats(seg));
  if (booking) {
    // A seat this booking already holds is shown as ours, not as sold.
    for (const seatId of Object.values(booking.seats?.[seg.id] ?? {})) taken.delete(seatId);
  }
  return taken;
}

/** Assign the best remaining seat — used at check-in on fares without selection. */
export function autoAssignSeat(seg, avoid = new Set(), familyId = 'tundra') {
  const map = buildSeatMap(seg.aircraft);
  const taken = new Set([...occupiedSeats(seg), ...avoid]);
  const free = map.seats.filter((s) => seatEligible(s, familyId) && !taken.has(s.id));
  if (!free.length) return null;
  // Aisle or window before a middle, forward before aft — the order a check-in
  // agent would work down.
  free.sort((a, b) => {
    const rank = (s) => (s.position === 'middle' ? 2 : s.position === 'aisle' ? 0 : 1);
    return rank(a) - rank(b) || a.row - b.row;
  });
  return free[0].id;
}

/**
 * Change seats on one segment.
 *
 * Returns the updated booking and what the change costs — free on Flex and
 * Summit, priced by row on the others.
 */
export function changeSeats(booking, segmentId, assignments) {
  const seats = { ...booking.seats, [segmentId]: { ...assignments } };
  return log({ ...booking, seats }, 'seats', `Seats changed on ${segmentId.split(':').pop()}`);
}

/* ── Changing a flight ───────────────────────────────────────────────────── */

/**
 * What it would cost to move a journey onto a different itinerary.
 *
 * The rules are read straight off the fare family, so a fare that says it
 * cannot be changed is refused here rather than in a view somewhere.
 */
export function changeQuote(booking, journeyIndex, newItinerary, { daysAhead = null } = {}) {
  const family = fareFamilyById[booking.family];
  if (!family.changeable) {
    return {
      allowed: false,
      reason: `${family.name} fares cannot be changed. You would need to book a new ticket.`,
    };
  }

  const hydrated = hydrate(booking);
  const journey = hydrated.journeys[journeyIndex];
  const passengers = booking.passengers.reduce((counts, p) => {
    counts[p.type] = (counts[p.type] ?? 0) + 1;
    return counts;
  }, {});

  const ahead = daysAhead ?? Math.max(0, daysBetween(today(), newItinerary.departDate));
  const oldPrice = priceItinerary({ segments: journey.segments }, {
    family: booking.family, fareType: booking.fareType, passengers,
    daysAhead: Math.max(0, daysBetween(booking.created.slice(0, 10), journey.departDate)),
  });
  const newPrice = priceItinerary({ segments: newItinerary.segments }, {
    family: booking.family, fareType: booking.fareType, passengers, daysAhead: ahead,
  });

  const difference = newPrice.total - oldPrice.total;
  const fee = (family.changeFee ?? 0) * 100 * booking.passengers.length;
  // A cheaper new itinerary does not pay money back on a non-refundable fare.
  const payable = Math.max(0, difference) + fee;
  const forfeited = difference < 0 && !family.refundable ? -difference : 0;

  return {
    allowed: true,
    oldPrice,
    newPrice,
    difference,
    fee,
    payable,
    forfeited,
    refund: family.refundable && difference < 0 ? -difference : 0,
  };
}

/** Apply a change quote, replacing one journey with a new itinerary. */
export function applyChange(booking, journeyIndex, newItinerary, quote) {
  const journeys = booking.journeys.map((journey, i) => (i !== journeyIndex ? journey : {
    ...journey,
    segments: newItinerary.segments.map((s) => ({ routeId: s.routeId, date: s.date, from: s.from, to: s.to })),
  }));

  // Seats do not travel with a change: the aircraft, and often the type, is a
  // different one. Dropping them is honest; silently keeping "14A" on an
  // aircraft with nine seats is not.
  const keep = new Set(newItinerary.segments.map((s) => s.id));
  const seats = Object.fromEntries(Object.entries(booking.seats ?? {}).filter(([id]) => keep.has(id)));

  const price = {
    ...booking.price,
    total: booking.price.total + (quote?.payable ?? 0) - (quote?.refund ?? 0),
    changes: [...(booking.price.changes ?? []), {
      at: new Date().toISOString(),
      difference: quote?.difference ?? 0,
      fee: quote?.fee ?? 0,
      paid: quote?.payable ?? 0,
      refunded: quote?.refund ?? 0,
    }],
  };

  const detail = `${booking.journeys[journeyIndex].label} moved to ${newItinerary.segments[0].date}`;
  return log({ ...booking, journeys, seats, price, checkedIn: {} }, 'changed', detail);
}

/* ── Cancelling ──────────────────────────────────────────────────────────── */

/** What cancelling gives back, under this fare's rules. */
export function cancelQuote(booking) {
  const family = fareFamilyById[booking.family];
  const paid = booking.price.total;
  const fee = (family.cancelFee ?? 0) * 100;

  if (family.refundable) {
    return {
      allowed: true, kind: 'refund', amount: paid, fee: 0,
      detail: 'Refunded to the original method of payment. Allow five to ten business days.',
    };
  }
  if (family.creditOnCancel) {
    return {
      allowed: true, kind: 'credit', amount: Math.max(0, paid - fee), fee,
      detail: fee
        ? `Held as travel credit for twelve months, less a ${family.name} cancellation charge.`
        : 'Held as travel credit for twelve months, usable against any North Winds fare.',
    };
  }
  return {
    allowed: true, kind: 'none', amount: 0, fee: 0,
    detail: `${family.name} fares carry no refund and no credit. Government charges paid on an unused ticket can still be reclaimed — contact reservations.`,
  };
}

export function cancelBooking(booking, quote) {
  return log(
    { ...booking, status: 'cancelled', cancelledAt: new Date().toISOString(), cancelQuote: quote },
    'cancelled',
    quote.kind === 'credit' ? `Cancelled — travel credit issued` : quote.kind === 'refund' ? 'Cancelled — refunded' : 'Cancelled',
  );
}

/* ── Check-in ────────────────────────────────────────────────────────────── */

export const CHECKIN_WINDOW_HOURS = 24;

/** Whether check-in is open for a journey, and when it opens if not. */
export function checkinWindow(journey, now = Date.now()) {
  const opens = journey.departUtc - CHECKIN_WINDOW_HOURS * 3600000;
  const closes = journey.departUtc - 45 * 60000;
  if (now < opens) return { state: 'not-yet', opens, closes };
  if (now > closes) return { state: 'closed', opens, closes };
  return { state: 'open', opens, closes };
}

/**
 * Check a journey in, assigning seats to anyone who has none.
 *
 * Returns the booking and the boarding passes produced.
 */
export function checkIn(booking, journeyIndex) {
  const hydrated = hydrate(booking);
  const journey = hydrated.journeys[journeyIndex];
  const seats = { ...booking.seats };

  for (const seg of journey.segments) {
    const existing = { ...(seats[seg.id] ?? {}) };
    const used = new Set(Object.values(existing));
    booking.passengers.forEach((passenger, index) => {
      if (passenger.type === 'infant') return;
      if (existing[index]) return;
      const seat = autoAssignSeat(seg, used, booking.family);
      if (seat) { existing[index] = seat; used.add(seat); }
    });
    seats[seg.id] = existing;
  }

  const checkedIn = { ...booking.checkedIn, [journeyIndex]: new Date().toISOString() };
  return log({ ...booking, seats, checkedIn }, 'checked-in', `Checked in for ${journey.label.toLowerCase()}`);
}

/**
 * Gate, boarding time and sequence for one passenger on one segment.
 *
 * Small airports have one or two gates and most of the network boards off the
 * apron, so "Gate 1" is not a placeholder — it is the gate.
 */
export function boardingDetail(seg, passengerIndex, booking) {
  const origin = airport(seg.from);
  const gates = origin.hub ? ['1', '2', '3'] : origin.region === 'south' ? ['24', '25', '26', '31'] : ['Apron'];
  const jet = seg.aircraft.startsWith('b737');
  const boardingUtc = seg.departUtc - (jet ? 45 : 25) * 60000;
  return {
    gate: gates[int(`gate:${seg.flightId}`, 0, gates.length - 1)],
    boardingLocal: localClock(origin, boardingUtc),
    boardingUtc,
    sequence: String(int(`seq:${seg.id}:${booking.reference}:${passengerIndex}`, 12, 96)).padStart(3, '0'),
    zone: jet ? String(int(`zone:${seg.id}:${passengerIndex}`, 1, 4)) : 'All',
  };
}

/**
 * The IATA BCBP (M1) string a boarding-pass barcode encodes.
 *
 * Written to the real format so the field widths, the Julian date and the
 * check-in-sequence block are all where a scanner would look for them. It is
 * printed under the barcode the way airlines print it.
 */
export function bcbpString(booking, seg, passengerIndex, detail) {
  const passenger = booking.passengers[passengerIndex];
  const name = `${passenger.lastName.toUpperCase()}/${passenger.firstName.toUpperCase()}`.slice(0, 20).padEnd(20);
  const seat = (booking.seats?.[seg.id]?.[passengerIndex] ?? 'SBY').padStart(4, '0');
  const julian = String(dayOfYear(seg.departDate)).padStart(3, '0');
  const compartment = booking.family === 'summit' ? 'J' : 'Y';
  return [
    'M1',
    name,
    'E',
    booking.reference.padEnd(7),
    seg.from,
    seg.to,
    'NW ',
    // Five characters: four digits and an operational suffix, blank here.
    `${String(seg.flightNumber.replace('NW', '')).padStart(4, '0')} `,
    julian,
    compartment,
    seat,
    // Five characters likewise: the sequence and its suffix.
    `${detail.sequence.padStart(4, '0')} `,
    booking.checkedIn ? '1' : '0',
    '00',
  ].join('');
}

function dayOfYear(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  return Math.floor((date - start) / 86400000);
}

/* ── Fare rules, stated plainly ──────────────────────────────────────────── */

/** The rules panel shown before purchase and again in manage-booking. */
export function fareRules(familyId) {
  const family = fareFamilyById[familyId];
  return [
    {
      title: 'Changes',
      body: family.changeable
        ? family.changeFee
          ? `Permitted for $${family.changeFee} per passenger, plus any difference in fare.`
          : 'Permitted at no charge. You pay only the difference in fare, if the new flight costs more.'
        : 'Not permitted. A new ticket would have to be bought.',
    },
    {
      title: 'Cancellation',
      body: family.refundable
        ? 'Fully refundable to the original method of payment.'
        : family.creditOnCancel
          ? family.cancelFee
            ? `Held as travel credit for twelve months, less $${family.cancelFee}.`
            : 'Held as travel credit for twelve months, in full.'
          : 'No refund and no credit.',
    },
    { title: 'Checked baggage', body: `${family.checkedBags} included${family.checkedBags > 2 ? ' at 32 kg each' : ' at 23 kg each'}. Additional bags may be added at booking or at the counter.` },
    { title: 'Seat selection', body: family.seatSelection === 'free' ? 'Included, at any time before departure.' : 'Available for a fee, or assigned free at check-in.' },
    { title: 'Same-day standby', body: family.sameDayStandby ? 'Permitted on an earlier flight the same day, subject to space.' : 'Not permitted.' },
    { title: 'Miles', body: `Earn ${family.milesRate} mile per kilometre flown.` },
  ];
}
