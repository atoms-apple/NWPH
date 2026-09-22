/**
 * Disruption and day-of-travel changes: rebooking, standby and upgrades.
 *
 * On this network these are not edge cases. Weather moves flights constantly,
 * and what an airline does in the hour after a cancellation is most of what
 * people judge it on. So the rules are modelled rather than left to a phone
 * call: who gets rebooked first, what standby costs, and when an upgrade is
 * actually available.
 */

import { segmentsBetween, inventory, flightStatus, occupiedSeats } from './schedule.js';
import { searchItineraries } from './search.js';
import { priceItinerary, familyAvailable } from './pricing.js';
import { fareFamilyById, fareFamilies } from '../data/brand.js';
import { seatCount } from '../data/aircraft.js';
import { hydrate } from './booking.js';
import { today, addDays, daysBetween } from '../lib/dates.js';

/**
 * Whether a journey is disrupted, and how badly.
 *
 * A cancellation anywhere on the journey disrupts the whole thing; a delay only
 * matters where it breaks a connection, which is the case people actually get
 * caught by.
 */
export function journeyDisruption(journey) {
  const problems = [];

  journey.segments.forEach((seg, index) => {
    const status = flightStatus(seg);
    if (status.state === 'cancelled') {
      problems.push({ kind: 'cancelled', seg, status, index });
      return;
    }
    if (status.state !== 'delayed') return;

    const delay = status.delayMinutes ?? 0;
    const connection = journey.connections?.[index];
    if (connection && delay > connection.minutes - 40) {
      problems.push({ kind: 'missed-connection', seg, status, index, connection });
    } else if (delay >= 60) {
      problems.push({ kind: 'delayed', seg, status, index });
    }
  });

  if (!problems.length) return null;
  const severity = problems.some((p) => p.kind === 'cancelled') ? 'cancelled'
    : problems.some((p) => p.kind === 'missed-connection') ? 'broken' : 'delayed';
  return { severity, problems };
}

/**
 * Rebooking options after a disruption.
 *
 * Free of charge and in the same fare family, because the disruption was not
 * the passenger's doing. Ordered by how soon they get there, not by price —
 * price is irrelevant when the airline is paying.
 */
export function rebookOptions(booking, journeyIndex, { horizon = 7 } = {}) {
  const live = hydrate(booking);
  const journey = live.journeys[journeyIndex];
  const options = [];

  for (let offset = 0; offset <= horizon; offset++) {
    const date = addDays(journey.departDate, offset);
    for (const itinerary of searchItineraries(journey.from, journey.to, date, { maxResults: 6 })) {
      // Never offer the flight they are already on.
      if (itinerary.id === journey.segments.map((s) => s.id).join('+')) continue;
      if (journeyDisruption(itinerary)) continue;
      if (!familyAvailable(itinerary, booking.family)) continue;
      options.push({
        itinerary,
        offsetDays: offset,
        delayHours: Math.round((itinerary.arriveUtc - journey.arriveUtc) / 3600000),
      });
    }
  }

  return options.sort((a, b) => a.itinerary.arriveUtc - b.itinerary.arriveUtc).slice(0, 8);
}

/**
 * Same-day standby.
 *
 * Included with Flex and Summit, on an earlier service between the same two
 * communities on the same day. Space-available — and on this network space runs
 * out for weight reasons as often as for seat reasons, which is why the list
 * shows the load rather than a simple yes.
 */
export const STANDBY_FEE = 75;

export function standbyOptions(booking, journeyIndex) {
  const live = hydrate(booking);
  const journey = live.journeys[journeyIndex];
  const family = fareFamilyById[booking.family];

  const sameDay = segmentsBetween(journey.from, journey.to, journey.departDate)
    .filter((seg) => seg.departUtc < journey.departUtc);

  return {
    allowed: Boolean(family.sameDayStandby),
    fee: family.sameDayStandby ? 0 : STANDBY_FEE,
    reason: family.sameDayStandby
      ? `Included with your ${family.name} fare.`
      : `${family.name} fares do not include standby. It can be bought at the counter for $${STANDBY_FEE} per traveller, space permitting.`,
    options: sameDay.map((seg) => {
      const load = inventory(seg);
      const needed = booking.passengers.filter((p) => p.type !== 'infant').length;
      return {
        seg,
        available: load.available,
        needed,
        likelihood: load.available >= needed + 4 ? 'good' : load.available >= needed ? 'tight' : 'full',
        status: flightStatus(seg),
      };
    }),
  };
}

/**
 * Upgrade offers.
 *
 * Only to a family above the one held, only where every segment has space in
 * it, and priced at the difference plus a service charge — the same arithmetic
 * as a change, without the change fee.
 */
export const UPGRADE_SERVICE_FEE = 0;

export function upgradeOffers(booking, journeyIndex) {
  const live = hydrate(booking);
  const journey = live.journeys[journeyIndex];
  const current = fareFamilyById[booking.family];
  const currentIndex = fareFamilies.findIndex((f) => f.id === booking.family);

  const passengers = booking.passengers.reduce((counts, p) => {
    counts[p.type] = (counts[p.type] ?? 0) + 1;
    return counts;
  }, {});
  const daysAhead = Math.max(0, daysBetween(today(), journey.departDate));

  const base = priceItinerary({ segments: journey.segments }, {
    family: booking.family, fareType: booking.fareType, passengers, daysAhead,
  });

  return fareFamilies.slice(currentIndex + 1).map((family) => {
    const available = familyAvailable({ segments: journey.segments }, family.id);
    const quote = priceItinerary({ segments: journey.segments }, {
      family: family.id, fareType: booking.fareType, passengers, daysAhead,
    });
    const seatsLeft = Math.min(...journey.segments.map((seg) => inventory(seg).byFamily[family.id] ?? 0));
    return {
      family,
      available,
      seatsLeft,
      difference: quote.total - base.total,
      total: quote.total,
      gains: family.includes.filter((item) => !current.includes.includes(item)),
    };
  }).filter((offer) => offer.available);
}
