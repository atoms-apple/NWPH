/**
 * Quoting for the things that are not a seat: freight, charter and miles.
 *
 * All three are priced in integer cents like every other total in this app, and
 * all three return a breakdown rather than a number — someone shipping four
 * hundred kilos of building material to Kugaaruk is entitled to see why it costs
 * what it costs.
 */

import { airport, distanceKm } from '../data/airports.js';
import { aircraftType, seatCount } from '../data/aircraft.js';
import { routes, routesServing } from '../data/network.js';
import { cargoClassById, cargoSurcharges, DIM_DIVISOR, charterAircraft } from '../data/services.js';
import { charges } from '../data/brand.js';
import { searchItineraries } from './search.js';
import { priceItinerary } from './pricing.js';

const cents = (dollars) => Math.round(dollars * 100);

/* ── Cargo ───────────────────────────────────────────────────────────────── */

/**
 * Chargeable weight: the greater of actual mass and the volume it occupies.
 *
 * This is why a box of insulation costs more than a box of bolts. Dimensions
 * are centimetres, weight kilograms.
 */
export function chargeableWeight({ weightKg, lengthCm = 0, widthCm = 0, heightCm = 0, pieces = 1 }) {
  const volumetric = (lengthCm * widthCm * heightCm * pieces) / DIM_DIVISOR;
  return {
    actual: weightKg,
    volumetric: Math.round(volumetric * 10) / 10,
    chargeable: Math.max(weightKg, Math.round(volumetric * 10) / 10),
    basis: volumetric > weightKg ? 'volume' : 'weight',
  };
}

/** Which aircraft types can carry freight between two communities. */
export function freightTypesFor(from, to) {
  const direct = routesServing(from, to);
  const viaHub = direct.length ? direct : routes.filter((r) => r.stops.includes(from) || r.stops.includes(to));
  return [...new Set(viaHub.map((r) => r.aircraft))].map(aircraftType);
}

/**
 * Quote a freight shipment.
 *
 * Returns the full breakdown: base, surcharges, tax and total, plus the
 * constraint that actually decides whether it can be carried — the smallest
 * hold on the routing.
 */
export function quoteCargo({ from, to, classId = 'general', weightKg, lengthCm, widthCm, heightCm, pieces = 1, insuredValue = 0 }) {
  const cargoClass = cargoClassById[classId];
  if (!cargoClass) throw new Error(`Unknown cargo class: ${classId}`);

  const weight = chargeableWeight({ weightKg, lengthCm, widthCm, heightCm, pieces });
  const km = distanceKm(from, to);

  // The rate is per kilo; distance moves it, because a kilo to Grise Fiord is
  // not a kilo to Pangnirtung.
  const distanceFactor = 0.55 + Math.min(1.45, km / 1400);
  const base = Math.max(cents(cargoClass.minimum), cents(weight.chargeable * cargoClass.rate * distanceFactor));

  const types = freightTypesFor(from, to);
  const smallestHold = types.length ? Math.min(...types.map((t) => t.cargoTonnes)) : 1.4;
  const onlySmallAircraft = types.length > 0 && types.every((t) => seatCount(t.id) <= 19);
  const needsCircuit = !routesServing(from, to).some((r) => r.stops.length === 2);
  const longestPiece = Math.max(lengthCm ?? 0, widthCm ?? 0, heightCm ?? 0);

  const applied = [];
  let surcharge = 0;
  for (const rule of cargoSurcharges) {
    const applies =
      (rule.id === 'remote' && onlySmallAircraft)
      || (rule.id === 'circuit' && needsCircuit)
      || (rule.id === 'oversize' && longestPiece > 150);
    if (!applies) continue;
    const amount = rule.flat ? cents(rule.flat) : Math.round(base * rule.rate);
    surcharge += amount;
    applied.push({ ...rule, amount });
  }

  const fuel = Math.round(base * charges.fuelSurchargeRate);
  const insurance = insuredValue > 0 ? Math.max(cents(15), Math.round(cents(insuredValue) * 0.012)) : 0;
  const preTax = base + surcharge + fuel + insurance;
  const gst = Math.round(preTax * charges.gstRate);

  return {
    from, to, km, weight, cargoClass, pieces,
    base, surcharges: applied, surchargeTotal: surcharge, fuel, insurance,
    preTax, gst, total: preTax + gst,
    carriedBy: types,
    smallestHoldTonnes: smallestHold,
    exceedsHold: weight.actual > smallestHold * 1000,
    needsCircuit,
    warnings: [
      weight.actual > smallestHold * 1000
        ? `A single shipment of ${weightKg} kg exceeds the ${smallestHold} t hold on the smallest aircraft serving this pairing. It will be split across services.`
        : null,
      longestPiece > 150 ? 'Any piece over 150 cm needs oversize handling and may not fit the door on the smaller types.' : null,
      cargoClass.restricted ? 'Dangerous goods require a shipper’s declaration and 72 hours’ notice before tender.' : null,
      needsCircuit ? 'This pairing has no direct service, so the shipment rides a circuit and calls at intermediate communities.' : null,
    ].filter(Boolean),
  };
}

/* ── Charter ─────────────────────────────────────────────────────────────── */

/** Block hours for a charter leg, rounded up to the quarter hour charters bill in. */
export function charterHours(from, to, typeId) {
  const type = aircraftType(typeId);
  const airborne = (distanceKm(from, to) / type.cruiseKph) + 0.25;
  return Math.max(0.5, Math.ceil(airborne * 4) / 4);
}

/**
 * Quote a charter.
 *
 * `returnTrip` bills the leg home. `positioningFrom` bills the aircraft getting
 * to you in the first place, which is the line people are surprised by and the
 * reason a charter out of your own hub is so much cheaper.
 */
export function quoteCharter({ typeId, from, to, returnTrip = true, positioningFrom = null, waitHours = 0 }) {
  const spec = charterAircraft.find((a) => a.id === typeId);
  if (!spec) throw new Error(`Unknown charter type: ${typeId}`);
  const type = aircraftType(typeId);
  // Where the aircraft actually sits, unless the caller knows better.
  const origin = positioningFrom ?? spec.base;

  const legHours = charterHours(from, to, typeId);
  const flying = returnTrip ? legHours * 2 : legHours;

  const positioning = origin && origin !== from
    ? charterHours(origin, from, typeId) * 2
    : 0;

  const billable = Math.max(spec.minHours, flying + positioning);
  const flightCost = cents(billable * spec.hourly);
  const waiting = waitHours > 0 ? cents(waitHours * spec.hourly * 0.35) : 0;

  // Landing and handling, per touchdown. Everything on this network needs
  // someone to meet the aircraft.
  const stops = returnTrip ? 2 : 1;
  const handling = cents(stops * 185);

  const preTax = flightCost + waiting + handling;
  const gst = Math.round(preTax * charges.gstRate);

  return {
    spec, type, from, to, returnTrip, positioningFrom: origin,
    legHours, flying, positioning, billable, waitHours,
    flightCost, waiting, handling, preTax, gst, total: preTax + gst,
    seats: seatCount(typeId),
    perSeat: Math.round((preTax + gst) / Math.max(1, seatCount(typeId))),
    canLand: airport(to).runway >= type.minRunway && (type.gravelCapable || airport(to).surface === 'paved'),
  };
}

/** Charter types that can physically use both ends of a routing. */
export function charterOptionsFor(from, to) {
  return charterAircraft.filter((spec) => {
    const type = aircraftType(spec.id);
    return [from, to].every((code) => {
      const place = airport(code);
      return place.runway >= type.minRunway && (type.gravelCapable || place.surface === 'paved');
    });
  });
}

/* ── Miles ───────────────────────────────────────────────────────────────── */

/**
 * Redemption pricing.
 *
 * A hundred miles to the dollar of base fare, with the government and airport
 * charges paid in cash — because those have to be remitted in cash whatever the
 * passenger paid with. No blackout dates and no separate reward inventory: if
 * the seat is for sale, it can be redeemed.
 */
export const MILES_PER_DOLLAR = 100;

export function quoteRedemption(itinerary, options) {
  const price = priceItinerary(itinerary, options);
  const miles = Math.round((price.fare / 100) * MILES_PER_DOLLAR);
  const cashPortion = price.total - price.fare - price.fuel;
  return {
    price,
    miles,
    cash: cashPortion,
    // Partial redemption: miles cover the fare, cash covers the rest.
    description: 'Miles cover the base fare and fuel surcharge. Government and airport charges are paid in cash.',
  };
}

/** Cheapest redemption on a route over the next weeks — the reward calendar. */
export function redemptionOptions(from, to, date, options = {}) {
  return searchItineraries(from, to, date, { maxResults: 12 })
    .map((itinerary) => ({ itinerary, quote: quoteRedemption(itinerary, { family: 'standard', ...options }) }))
    .sort((a, b) => a.quote.miles - b.quote.miles);
}
