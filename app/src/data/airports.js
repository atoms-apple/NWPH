/**
 * The network's airports.
 *
 * Coordinates are real, and everything distance-derived — block time, fare,
 * the network map, the order of stops on a circuit — is computed from them
 * rather than typed in. Getting a coordinate wrong shows up as a wrong flight
 * time, which is the intended feedback.
 *
 * `tz` is the standard-time offset from UTC. Every community on the network
 * moves to daylight time with the rest of Canada except Salliq, which sits on
 * Southampton Island and stays on Eastern Standard Time all year — hence
 * `noDst`, which the clock code reads rather than special-casing a code.
 *
 * `runway` is metres of the longest runway and `surface` its type, because on
 * this network they decide which aircraft can come: a 737 needs gravel-kit
 * certification and roughly 1,200 m, a Dash 8-100 will take 900 m of gravel,
 * and a King Air will get into anything shorter.
 */

export const REGIONS = {
  qikiqtaaluk: { id: 'qikiqtaaluk', name: 'Qikiqtaaluk (Baffin)', short: 'Baffin' },
  kivalliq: { id: 'kivalliq', name: 'Kivalliq', short: 'Kivalliq' },
  kitikmeot: { id: 'kitikmeot', name: 'Kitikmeot', short: 'Kitikmeot' },
  south: { id: 'south', name: 'Southern gateways', short: 'South' },
};

/**
 * @typedef {object} Airport
 * @property {string} code      IATA code
 * @property {string} name      Community name, as the community uses it
 * @property {string} [also]    Former or alternate name, shown once in search
 * @property {string} airport   Airport name
 * @property {string} region
 * @property {number} lat
 * @property {number} lon
 * @property {number} runway    metres
 * @property {'gravel'|'paved'} surface
 * @property {number} aif       airport improvement fee, CAD
 * @property {boolean} [hub]
 * @property {number} population
 */

/** @type {Airport[]} */
export const airports = [
  // ── Qikiqtaaluk / Baffin ────────────────────────────────────────────────
  { code: 'YFB', name: 'Iqaluit', airport: 'Iqaluit International', region: 'qikiqtaaluk', lat: 63.7564, lon: -68.5558, runway: 2621, surface: 'paved', aif: 30, hub: true, population: 7429, tz: -5 },
  { code: 'YXP', name: 'Pangnirtung', airport: 'Pangnirtung', region: 'qikiqtaaluk', lat: 66.1450, lon: -65.7136, runway: 869, surface: 'gravel', aif: 15, population: 1481, tz: -5 },
  { code: 'YTE', name: 'Kinngait', also: 'Cape Dorset', airport: 'Kinngait', region: 'qikiqtaaluk', lat: 64.2300, lon: -76.5267, runway: 1158, surface: 'gravel', aif: 15, population: 1441, tz: -5 },
  { code: 'YLC', name: 'Kimmirut', airport: 'Kimmirut', region: 'qikiqtaaluk', lat: 62.8500, lon: -69.8833, runway: 899, surface: 'gravel', aif: 12, population: 389, tz: -5 },
  { code: 'YVM', name: 'Qikiqtarjuaq', airport: 'Qikiqtarjuaq', region: 'qikiqtaaluk', lat: 67.5458, lon: -64.0314, runway: 1158, surface: 'gravel', aif: 12, population: 593, tz: -5 },
  { code: 'YCY', name: 'Clyde River', airport: 'Clyde River', region: 'qikiqtaaluk', lat: 70.4861, lon: -68.5167, runway: 1158, surface: 'gravel', aif: 12, population: 1181, tz: -5 },
  { code: 'YIO', name: 'Pond Inlet', airport: 'Pond Inlet', region: 'qikiqtaaluk', lat: 72.6833, lon: -77.9667, runway: 1158, surface: 'gravel', aif: 15, population: 1555, tz: -5 },
  { code: 'YAB', name: 'Arctic Bay', airport: 'Arctic Bay', region: 'qikiqtaaluk', lat: 73.0069, lon: -85.0425, runway: 1158, surface: 'gravel', aif: 12, population: 994, tz: -5 },
  { code: 'YGT', name: 'Igloolik', airport: 'Igloolik', region: 'qikiqtaaluk', lat: 69.3647, lon: -81.8161, runway: 1158, surface: 'gravel', aif: 15, population: 2049, tz: -5 },
  { code: 'YUX', name: 'Sanirajak', also: 'Hall Beach', airport: 'Sanirajak', region: 'qikiqtaaluk', lat: 68.7761, lon: -81.2436, runway: 1646, surface: 'gravel', aif: 12, population: 891, tz: -5 },
  { code: 'YRB', name: 'Resolute Bay', airport: 'Resolute Bay', region: 'qikiqtaaluk', lat: 74.7169, lon: -94.9694, runway: 1981, surface: 'gravel', aif: 15, population: 183, tz: -6 },
  { code: 'YGZ', name: 'Grise Fiord', airport: 'Grise Fiord', region: 'qikiqtaaluk', lat: 76.4261, lon: -82.9092, runway: 494, surface: 'gravel', aif: 12, population: 144, tz: -5 },
  { code: 'YSK', name: 'Sanikiluaq', airport: 'Sanikiluaq', region: 'qikiqtaaluk', lat: 56.5378, lon: -79.2467, runway: 1158, surface: 'gravel', aif: 12, population: 1013, tz: -5 },

  // ── Kivalliq ────────────────────────────────────────────────────────────
  { code: 'YRT', name: 'Rankin Inlet', airport: 'Rankin Inlet', region: 'kivalliq', lat: 62.8114, lon: -92.1157, runway: 1859, surface: 'gravel', aif: 25, hub: true, population: 2975, tz: -6 },
  { code: 'YEK', name: 'Arviat', airport: 'Arviat', region: 'kivalliq', lat: 61.0942, lon: -94.0708, runway: 1158, surface: 'gravel', aif: 12, population: 2864, tz: -6 },
  { code: 'YXN', name: 'Whale Cove', airport: 'Whale Cove', region: 'kivalliq', lat: 62.2400, lon: -92.5981, runway: 914, surface: 'gravel', aif: 12, population: 470, tz: -6 },
  { code: 'YBK', name: 'Baker Lake', airport: 'Baker Lake', region: 'kivalliq', lat: 64.2989, lon: -96.0778, runway: 1524, surface: 'gravel', aif: 15, population: 2069, tz: -6 },
  { code: 'YCS', name: 'Chesterfield Inlet', airport: 'Chesterfield Inlet', region: 'kivalliq', lat: 63.3467, lon: -90.7311, runway: 1067, surface: 'gravel', aif: 12, population: 501, tz: -6 },
  { code: 'YZS', name: 'Salliq', also: 'Coral Harbour', airport: 'Salliq', region: 'kivalliq', lat: 64.1933, lon: -83.3594, runway: 1524, surface: 'gravel', aif: 12, population: 1035, tz: -5, noDst: true },
  { code: 'YUT', name: 'Naujaat', also: 'Repulse Bay', airport: 'Naujaat', region: 'kivalliq', lat: 66.5214, lon: -86.2247, runway: 1158, surface: 'gravel', aif: 12, population: 1225, tz: -6 },

  // ── Kitikmeot ───────────────────────────────────────────────────────────
  { code: 'YCB', name: 'Cambridge Bay', airport: 'Cambridge Bay', region: 'kitikmeot', lat: 69.1081, lon: -105.1381, runway: 1524, surface: 'gravel', aif: 25, hub: true, population: 1766, tz: -7 },
  { code: 'YHK', name: 'Gjoa Haven', airport: 'Gjoa Haven', region: 'kitikmeot', lat: 68.6356, lon: -95.8497, runway: 1158, surface: 'gravel', aif: 12, population: 1349, tz: -7 },
  { code: 'YCO', name: 'Kugluktuk', airport: 'Kugluktuk', region: 'kitikmeot', lat: 67.8167, lon: -115.1439, runway: 1524, surface: 'gravel', aif: 15, population: 1382, tz: -7 },
  { code: 'YYH', name: 'Taloyoak', airport: 'Taloyoak', region: 'kitikmeot', lat: 69.5467, lon: -93.5767, runway: 1158, surface: 'gravel', aif: 12, population: 1017, tz: -7 },
  { code: 'YBB', name: 'Kugaaruk', airport: 'Kugaaruk', region: 'kitikmeot', lat: 68.5342, lon: -89.8081, runway: 1158, surface: 'gravel', aif: 12, population: 1002, tz: -7 },

  // ── Southern gateways ───────────────────────────────────────────────────
  { code: 'YOW', name: 'Ottawa', airport: 'Ottawa Macdonald–Cartier International', region: 'south', lat: 45.3225, lon: -75.6692, runway: 3202, surface: 'paved', aif: 30, population: 1017449, tz: -5 },
  { code: 'YUL', name: 'Montréal', airport: 'Montréal–Trudeau International', region: 'south', lat: 45.4706, lon: -73.7408, runway: 3353, surface: 'paved', aif: 35, population: 1762949, tz: -5 },
  { code: 'YWG', name: 'Winnipeg', airport: 'Winnipeg Richardson International', region: 'south', lat: 49.9100, lon: -97.2399, runway: 3353, surface: 'paved', aif: 38, population: 749607, tz: -6 },
  { code: 'YEG', name: 'Edmonton', airport: 'Edmonton International', region: 'south', lat: 53.3097, lon: -113.5800, runway: 3353, surface: 'paved', aif: 35, population: 1010899, tz: -7 },
  { code: 'YZF', name: 'Yellowknife', airport: 'Yellowknife', region: 'south', lat: 62.4628, lon: -114.4403, runway: 2286, surface: 'paved', aif: 20, population: 20340, tz: -7 },
];

export const airportByCode = Object.fromEntries(airports.map((a) => [a.code, a]));

/** Lookup that throws rather than returning undefined — a bad code is a bug. */
export function airport(code) {
  const found = airportByCode[code];
  if (!found) throw new Error(`Unknown airport code: ${code}`);
  return found;
}

export const hubs = airports.filter((a) => a.hub).map((a) => a.code);

/** Great-circle distance in kilometres. */
export function distanceKm(fromCode, toCode) {
  const a = airport(fromCode);
  const b = airport(toCode);
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Search over code, community name, former name and airport name. */
export function searchAirports(query, { limit = 8 } = {}) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const a of airports) {
    const code = a.code.toLowerCase();
    const name = a.name.toLowerCase();
    const also = (a.also ?? '').toLowerCase();
    let score = -1;
    if (code === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (also && also.startsWith(q)) score = 2;
    else if (code.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 4;
    else if (also.includes(q)) score = 5;
    else if (a.airport.toLowerCase().includes(q)) score = 6;
    if (score >= 0) scored.push({ airport: a, score });
  }
  return scored
    .sort((x, y) => x.score - y.score || y.airport.population - x.airport.population)
    .slice(0, limit)
    .map((s) => s.airport);
}

/** Airports grouped by region, in the order the regions are declared. */
export function airportsByRegion() {
  return Object.values(REGIONS).map((region) => ({
    region,
    airports: airports
      .filter((a) => a.region === region.id)
      .sort((a, b) => (b.hub ? 1 : 0) - (a.hub ? 1 : 0) || a.name.localeCompare(b.name)),
  }));
}
