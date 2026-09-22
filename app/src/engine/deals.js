/**
 * Seat sales.
 *
 * A deal here is not a marketing decision — it is a fare that has come out
 * unusually low because the flight is lightly booked, which on this network
 * happens for real reasons: the back half of a fortnight, the day after a
 * circuit, a Tuesday in February. The engine looks for those and reports them
 * against what the pairing typically costs.
 *
 * Deterministic, like everything else: the same fortnight produces the same
 * deals whenever you look.
 */

import { routes } from '../data/network.js';
import { brands } from '../data/brand.js';
import { searchItineraries } from './search.js';
import { cheapestFamily } from './pricing.js';
import { today, addDays } from '../lib/dates.js';

/**
 * Pairings worth sampling.
 *
 * Every route's endpoints, plus the near ends of a circuit. Sampling all
 * four-hundred-odd possible pairs would be slow and would mostly price
 * journeys nobody makes.
 */
function candidatePairs() {
  const pairs = new Set();
  for (const route of routes) {
    const last = route.stops.length - 1;
    pairs.add(`${route.stops[0]}:${route.stops[last]}`);
    if (route.stops.length > 2) {
      pairs.add(`${route.stops[0]}:${route.stops[1]}`);
      pairs.add(`${route.stops[0]}:${route.stops[last - 1]}`);
    }
  }
  return [...pairs].map((pair) => pair.split(':'));
}

/**
 * Scan one pairing across the horizon, then keep only comparable journeys.
 *
 * This is the part that matters. Comparing a cheap nonstop against a baseline
 * that included two-stop connections — which is what you get on the days a
 * pairing has no direct service — reported "73% off" on routes where nothing
 * was discounted at all. The flights simply were not the same product.
 *
 * So the baseline and the deal are both drawn from journeys at the fewest
 * stops the pairing is ever flown in, and only from dates that actually have
 * one.
 */
function scanPairing(from, to, fromDate, horizon) {
  const samples = [];
  let fewestStops = Infinity;

  for (let offset = 2; offset <= horizon; offset += 2) {
    const date = addDays(fromDate, offset);
    const itineraries = searchItineraries(from, to, date, { maxStops: 1, maxResults: 4 });

    // One quote per date: the cheapest journey available that day.
    let bestOfDay = null;
    for (const itinerary of itineraries) {
      const quote = cheapestFamily(itinerary, { passengers: { adult: 1 }, daysAhead: offset });
      if (!quote) continue;
      if (!bestOfDay || quote.total < bestOfDay.total) {
        bestOfDay = { date, offset, total: quote.total, family: quote.family, stops: itinerary.stops, itinerary };
      }
    }
    if (!bestOfDay) continue;
    fewestStops = Math.min(fewestStops, bestOfDay.stops);
    samples.push(bestOfDay);
  }

  return samples.filter((sample) => sample.stops === fewestStops);
}

/**
 * Fares meaningfully below the norm for their own route.
 *
 * `minSaving` is a percentage. Ten is about the point at which it is worth
 * telling someone to move a date.
 */
export function findDeals({ from = today(), horizon = 42, minSaving = 10, limit = 12 } = {}) {
  const found = [];

  for (const [origin, destination] of candidatePairs()) {
    const comparable = scanPairing(origin, destination, from, horizon);
    // Fewer than five comparable dates is not enough to say what is typical.
    if (comparable.length < 5) continue;

    const totals = comparable.map((sample) => sample.total).sort((a, b) => a - b);
    // The median, not the mean: one last-seat fare should not make everything
    // else look like a bargain.
    const typical = totals[Math.floor(totals.length / 2)];

    const best = comparable.reduce((a, b) => (a.total <= b.total ? a : b));
    const saving = Math.round(((typical - best.total) / typical) * 100);
    if (saving < minSaving) continue;

    found.push({
      from: origin,
      to: destination,
      date: best.date,
      total: best.total,
      typical,
      saving,
      family: best.family,
      stops: best.itinerary.stops,
      brand: best.itinerary.leadBrand,
      brandName: brands[best.itinerary.leadBrand].shortName,
      itinerary: best.itinerary,
    });
  }

  return found.sort((a, b) => b.saving - a.saving).slice(0, limit);
}

/**
 * Cached for the life of the page.
 *
 * Finding deals prices a few hundred itineraries. That is fast but not free,
 * and the answer cannot change within a day.
 */
let cache = null;
const ensure = () => {
  if (!cache || cache.date !== today()) cache = { date: today(), deals: findDeals({ limit: 12 }) };
  return cache.deals;
};

export const allDeals = () => ensure();
export const topDeals = (count = 4) => ensure().slice(0, count);
