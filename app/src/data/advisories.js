/**
 * Travel advisories.
 *
 * Two kinds. Standing advisories are facts about operating here that do not
 * change — they are true in February whether or not anything is going wrong.
 * Live ones are derived from the same deterministic weather the flight-status
 * board uses, so the advisory and the delay on the board never contradict
 * each other.
 */

import { flightsOn, segment, flightStatus } from '../engine/schedule.js';
import { airport } from './airports.js';
import { today, formatDate, addDays } from '../lib/dates.js';

/**
 * Advisories that stand until someone removes them.
 *
 * `season` limits one to part of the year — breakup and freeze-up genuinely
 * only matter when they are happening, and an advisory shown out of season
 * teaches people to ignore the panel.
 */
export const standing = [
  {
    id: 'weather-priority',
    severity: 'info',
    title: 'Weather decides, and it decides late',
    body:
      'Fog, crosswind and blowing snow close these strips at short notice, and the decision is '
      + 'often made with the aircraft already airborne. Build a day of slack into anything that '
      + 'cannot move — a connection south, a court date, a medical appointment.',
  },
  {
    id: 'daylight',
    severity: 'info',
    months: [11, 12, 1, 2],
    title: 'Limited daylight on the northern strips',
    body:
      'Several communities on the network have no runway lighting, so between November and '
      + 'February they can only be served in daylight. Circuits are flown earlier in the day '
      + 'through the winter, and a delay of a few hours can end the flying day.',
  },
  {
    id: 'breakup',
    severity: 'warn',
    months: [5, 6],
    title: 'Spring breakup — gravel strips soften',
    body:
      'As the ground thaws, gravel runways soften and weight limits drop. Freight may be held for '
      + 'a later service, and on the shortest strips passenger loads are reduced. Cargo booked in '
      + 'May and June should allow an extra week.',
  },
  {
    id: 'sealift',
    severity: 'info',
    months: [7, 8, 9],
    title: 'Sealift season — freight demand is at its highest',
    body:
      'Between July and September the annual resupply moves by ship, and anything that misses it '
      + 'moves by air. Hold space is tight on every service; book freight early.',
  },
  {
    id: 'firearms',
    severity: 'info',
    title: 'Firearms and ammunition',
    body:
      'Firearms travel declared and cased, unloaded, with ammunition packed separately and within '
      + 'the limits in the conditions of carriage. Tell the agent at check-in, not at the aircraft.',
  },
];

/** Whether a standing advisory applies today. */
const inSeason = (advisory, iso) => {
  if (!advisory.months) return true;
  return advisory.months.includes(Number(iso.slice(5, 7)));
};

/**
 * Advisories generated from what the network is actually doing.
 *
 * Grouped by service, not by community. A cancelled North Baffin circuit is one
 * disruption affecting six communities, and publishing it six times would teach
 * people to stop reading the panel — which is how someone misses the one that
 * mattered.
 *
 * Only a cancellation or a substantial hold is raised. A twenty-minute late
 * inbound is on the status board, where it belongs.
 */
export function liveAdvisories(from = today(), days = 3) {
  const out = [];

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(from, offset);
    for (const flight of flightsOn(date)) {
      const whole = segment(flight, flight.stops[0], flight.stops[flight.stops.length - 1]);
      if (!whole) continue;
      const status = flightStatus(whole, from);

      const cancelled = status.state === 'cancelled';
      const heldLong = status.state === 'delayed' && (status.delayMinutes ?? 0) >= 90;
      if (!cancelled && !heldLong) continue;

      const places = flight.stops.map((code) => airport(code).name);
      out.push({
        id: `live-${flight.routeId}-${date}`,
        severity: cancelled ? 'severe' : 'warn',
        date,
        flightNumber: flight.flightNumber,
        stops: flight.stops,
        title: cancelled
          ? `${flight.flightNumber} cancelled — ${formatDate(date, 'short')}`
          : `${flight.flightNumber} held — ${formatDate(date, 'short')}`,
        body:
          `${flight.name}. ${status.reason ?? 'Operational'}. `
          + `${places.length > 2 ? `${places.length} communities affected: ${places.join(', ')}.` : `${places.join(' to ')}.`} `
          + (cancelled
            ? 'Affected passengers are rebooked on the next available service at no charge, and change fees are waived on any ticket held through this period.'
            : `A revised departure will be posted once conditions are reassessed. Currently ${status.delayMinutes} minutes.`),
        issued: from,
      });
    }
  }

  // Severe first, then soonest.
  return out.sort((a, b) =>
    (a.severity === 'severe' ? 0 : 1) - (b.severity === 'severe' ? 0 : 1) || a.date.localeCompare(b.date));
}

/** Everything in force today, live first. */
export function activeAdvisories(from = today()) {
  return [...liveAdvisories(from), ...standing.filter((a) => inSeason(a, from))];
}

/**
 * What the header badge counts.
 *
 * Two days, not three: a badge that is permanently in double digits is one
 * people learn to ignore, and a disruption four days out is not something
 * anyone can act on this morning. The advisories page keeps the longer view.
 */
export const imminentAdvisories = (from = today()) => liveAdvisories(from, 2);
export const disruptionCount = (from = today()) => imminentAdvisories(from).length;
