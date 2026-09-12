/**
 * Fares, charges and totals.
 *
 * Money is handled in integer cents everywhere in this module and formatted
 * only at the edge. Floating-point dollars are how a total ends up a cent off
 * the sum of its own lines.
 *
 * The shape of the breakdown follows a real Canadian domestic ticket: a base
 * fare the airline sets, a fuel surcharge, NAV CANADA and airport charges, the
 * federal security charge, then GST on the lot.
 */

import { airport, distanceKm } from '../data/airports.js';
import { charges, fareFamilyById, fareTypeById, passengerTypes, ancillaryById, brands } from '../data/brand.js';
import { inventory } from './schedule.js';
import { buildSeatMap } from '../data/aircraft.js';

const cents = (dollars) => Math.round(dollars * 100);
export const toDollars = (c) => c / 100;

/**
 * Per-kilometre rates by service line.
 *
 * The jets are cheapest per kilometre and the circuits dearest, which is not a
 * markup — it is what it costs to fly nineteen seats into a gravel strip for
 * twenty minutes and turn around. Anyone who has bought a ticket in the North
 * will recognise the shape of the numbers, if not the numbers.
 */
const RATES = {
  altitude: { fixed: 138, perKm: 0.152 },
  express: { fixed: 118, perKm: 0.315 },
  connect: { fixed: 152, perKm: 0.475 },
};

/**
 * The base fare for one adult on one segment, before family or discount.
 *
 * Two things move it: how full the aircraft is, and how soon you are flying.
 * Both curves are gentle — this is a network where a fare that trebles a week
 * out would simply stop people travelling.
 */
export function baseFareCents(seg, { daysAhead = 30 } = {}) {
  const rate = RATES[seg.brand];
  const km = seg.distanceKm || distanceKm(seg.from, seg.to);
  const raw = rate.fixed + km * rate.perKm;

  const { loadFactor } = inventory(seg);
  const demand = 1 + 0.68 * loadFactor ** 2.3;

  // Inside three weeks the fare climbs; beyond six it is flat.
  const advance = daysAhead >= 42 ? 0.92
    : daysAhead >= 21 ? 1
      : daysAhead >= 7 ? 1.12
        : daysAhead >= 2 ? 1.28
          : 1.4;

  return cents(raw * demand * advance);
}

/**
 * Price one segment for one passenger, in one fare family.
 *
 * Returns cents. Child and infant shares and the fare-type discount are both
 * applied to the base only — taxes and charges are per person regardless, which
 * is how they actually work.
 */
export function segmentFareCents(seg, { family, fareType = 'standard', passengerType = 'adult', daysAhead = 30 }) {
  const fam = fareFamilyById[family];
  if (!fam) throw new Error(`Unknown fare family: ${family}`);
  const type = fareTypeById[fareType] ?? fareTypeById.standard;
  const pax = passengerTypes.find((p) => p.id === passengerType) ?? passengerTypes[0];

  const base = baseFareCents(seg, { daysAhead });
  return Math.round(base * fam.multiplier * pax.fareShare * (1 - type.discount));
}

/**
 * Government and airport charges for one passenger on one segment.
 *
 * Infants on a lap are not enplaned passengers for the security charge and pay
 * no airport improvement fee, which is why they are exempted here rather than
 * discounted.
 */
export function segmentChargesCents(seg, { passengerType = 'adult' } = {}) {
  const exempt = passengerType === 'infant';
  return {
    navCanada: exempt ? 0 : cents(charges.navCanada),
    aif: exempt ? 0 : cents(airport(seg.from).aif),
    atsc: exempt ? 0 : cents(charges.atsc),
  };
}

/**
 * Price a whole itinerary: every segment, every passenger, every charge.
 *
 * `passengers` is a count by type — { adult: 2, child: 1, infant: 0 }. The
 * returned breakdown is the one the payment screen shows line for line, and its
 * `total` is the number that gets charged. Nothing is rounded twice.
 */
export function priceItinerary(itinerary, {
  family,
  fareType = 'standard',
  passengers = { adult: 1 },
  daysAhead = 30,
  seatFees = 0,
  extras = {},
} = {}) {
  const lines = [];
  let fareTotal = 0;
  let navTotal = 0;
  let aifTotal = 0;
  let atscTotal = 0;

  for (const paxType of passengerTypes) {
    const count = passengers[paxType.id] ?? 0;
    if (!count) continue;

    let perPersonFare = 0;
    let perPersonCharges = 0;
    for (const seg of itinerary.segments) {
      perPersonFare += segmentFareCents(seg, { family, fareType, passengerType: paxType.id, daysAhead });
      const c = segmentChargesCents(seg, { passengerType: paxType.id });
      perPersonCharges += c.navCanada + c.aif;
      navTotal += c.navCanada * count;
      aifTotal += c.aif * count;
    }
    // The security charge is levied per direction, not per segment — a
    // connection through Iqaluit is one journey, not two.
    const atsc = paxType.id === 'infant' ? 0 : cents(charges.atsc);
    atscTotal += atsc * count;
    perPersonCharges += atsc;

    fareTotal += perPersonFare * count;
    lines.push({
      passengerType: paxType.id,
      label: paxType.name,
      count,
      fareEach: perPersonFare,
      chargesEach: perPersonCharges,
      fare: perPersonFare * count,
    });
  }

  const fuel = Math.round(fareTotal * charges.fuelSurchargeRate);

  const extraLines = [];
  let extrasTotal = 0;
  for (const [id, quantity] of Object.entries(extras)) {
    if (!quantity) continue;
    const item = ancillaryById[id];
    if (!item) continue;
    const amount = cents(item.price) * quantity;
    extrasTotal += amount;
    extraLines.push({ id, name: item.name, quantity, each: cents(item.price), amount });
  }

  const preTax = fareTotal + fuel + navTotal + aifTotal + atscTotal + seatFees + extrasTotal;
  const gst = Math.round(preTax * charges.gstRate);

  return {
    lines,
    extraLines,
    fare: fareTotal,
    fuel,
    navCanada: navTotal,
    aif: aifTotal,
    atsc: atscTotal,
    seats: seatFees,
    extras: extrasTotal,
    preTax,
    gst,
    total: preTax + gst,
    passengerCount: Object.entries(passengers).reduce((n, [, v]) => n + v, 0),
  };
}

/** The cheapest bookable family on an itinerary, used for the "from" price. */
export function cheapestFamily(itinerary, options = {}) {
  const order = ['tundra', 'standard', 'flex', 'summit'];
  for (const family of order) {
    if (familyAvailable(itinerary, family)) {
      return { family, total: priceItinerary(itinerary, { ...options, family }).total };
    }
  }
  return null;
}

/** A family is sellable only if every segment has a seat left in it. */
export function familyAvailable(itinerary, family) {
  return itinerary.segments.every((seg) => (inventory(seg).byFamily[family] ?? 0) > 0);
}

/** Seats left in a family across the itinerary — the scarcity line in results. */
export function familySeatsLeft(itinerary, family) {
  return Math.min(...itinerary.segments.map((seg) => inventory(seg).byFamily[family] ?? 0));
}

/** What one chosen seat costs, given the fare family's seat-selection rule. */
export function seatFeeCents(seg, seatId, family) {
  const fam = fareFamilyById[family];
  if (!fam || fam.seatSelection === 'free') return 0;
  const seat = buildSeatMap(seg.aircraft).seats.find((s) => s.id === seatId);
  return seat ? cents(seat.price) : 0;
}

/* ── Formatting ──────────────────────────────────────────────────────────── */

const formatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

/** Cents as $1,234.56. */
export const money = (c) => formatter.format(c / 100);

/** Cents as $1,235 — for headline prices where the cents are noise. */
export const moneyRounded = (c) => formatter.format(Math.round(c / 100)).replace(/\.00$/, '');

/** Miles earned, by fare family and distance flown. */
export function milesEarned(itinerary, family) {
  const fam = fareFamilyById[family];
  const km = itinerary.segments.reduce((sum, seg) => sum + seg.distanceKm, 0);
  return Math.round(km * (fam?.milesRate ?? 0.25));
}

export const brandOf = (id) => brands[id];
