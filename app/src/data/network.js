/**
 * The published network.
 *
 * A route is a repeating pattern, not a flight. The schedule engine turns a
 * route plus a date into flights, so nothing here is dated and the timetable
 * never runs out.
 *
 * `stops` is the full sequence the aircraft calls at. Two stops is a direct
 * service; more is a circuit, and every pair of stops along it is sellable —
 * a passenger joining at Igloolik and getting off at Pond Inlet is riding the
 * same aircraft as one who boarded in Iqaluit.
 *
 * `cadence`:
 *   weekly  — every week on the listed days
 *   even    — even ISO weeks only
 *   odd     — odd ISO weeks only
 *
 * The two big Baffin circuits alternate, which is what people mean by the milk
 * run coming round every other week: North Baffin on even weeks, East Baffin
 * on odd ones.
 *
 * `depart` is local clock minutes at the first stop. Days are ISO weekdays,
 * Monday 1 through Sunday 7.
 *
 * Flight numbers follow the network's own convention: 100s Altitude, 300s
 * Express, 500s Connect; even numbers outbound from the hub, odd numbers back.
 */

export const routes = [
  /* ── Altitude — the jet fleet ─────────────────────────────────────────── */
  {
    id: 'yfb-yow', number: 100, brand: 'altitude', aircraft: 'b737-800',
    stops: ['YFB', 'YOW'], days: [1, 2, 3, 4, 5, 6, 7], cadence: 'weekly', depart: 7 * 60 + 15,
    name: 'Iqaluit – Ottawa',
  },
  {
    id: 'yow-yfb', number: 101, brand: 'altitude', aircraft: 'b737-800',
    stops: ['YOW', 'YFB'], days: [1, 2, 3, 4, 5, 6, 7], cadence: 'weekly', depart: 12 * 60 + 45,
    name: 'Ottawa – Iqaluit',
  },
  {
    id: 'yfb-yow-pm', number: 102, brand: 'altitude', aircraft: 'b737-800',
    stops: ['YFB', 'YOW'], days: [1, 3, 5, 7], cadence: 'weekly', depart: 16 * 60 + 40,
    name: 'Iqaluit – Ottawa (afternoon)',
  },
  {
    id: 'yow-yfb-am', number: 103, brand: 'altitude', aircraft: 'b737-800',
    stops: ['YOW', 'YFB'], days: [1, 3, 5, 7], cadence: 'weekly', depart: 6 * 60 + 30,
    name: 'Ottawa – Iqaluit (morning)',
  },
  {
    id: 'yfb-yul', number: 110, brand: 'altitude', aircraft: 'b737-700c',
    stops: ['YFB', 'YUL'], days: [1, 3, 5, 7], cadence: 'weekly', depart: 13 * 60 + 30,
    name: 'Iqaluit – Montréal',
  },
  {
    id: 'yul-yfb', number: 111, brand: 'altitude', aircraft: 'b737-700c',
    stops: ['YUL', 'YFB'], days: [1, 3, 5, 7], cadence: 'weekly', depart: 18 * 60 + 15,
    name: 'Montréal – Iqaluit',
  },
  {
    id: 'yrt-ywg', number: 120, brand: 'altitude', aircraft: 'b737-700c',
    stops: ['YRT', 'YWG'], days: [1, 2, 3, 4, 5, 6, 7], cadence: 'weekly', depart: 8 * 60,
    name: 'Rankin Inlet – Winnipeg',
  },
  {
    id: 'ywg-yrt', number: 121, brand: 'altitude', aircraft: 'b737-700c',
    stops: ['YWG', 'YRT'], days: [1, 2, 3, 4, 5, 6, 7], cadence: 'weekly', depart: 12 * 60 + 30,
    name: 'Winnipeg – Rankin Inlet',
  },
  {
    id: 'ycb-yeg', number: 130, brand: 'altitude', aircraft: 'b737-700c',
    stops: ['YCB', 'YZF', 'YEG'], days: [2, 4, 6], cadence: 'weekly', depart: 8 * 60 + 45,
    name: 'Cambridge Bay – Yellowknife – Edmonton',
  },
  {
    id: 'yeg-ycb', number: 131, brand: 'altitude', aircraft: 'b737-700c',
    stops: ['YEG', 'YZF', 'YCB'], days: [2, 4, 6], cadence: 'weekly', depart: 14 * 60 + 30,
    name: 'Edmonton – Yellowknife – Cambridge Bay',
  },
  {
    id: 'yfb-yrt-ycb', number: 140, brand: 'altitude', aircraft: 'b737-700c',
    stops: ['YFB', 'YRT', 'YCB'], days: [2, 5], cadence: 'weekly', depart: 12 * 60 + 15,
    name: 'The cross-territory link — Iqaluit to Cambridge Bay',
    note: 'The only scheduled service that crosses all three regions in a day.',
  },
  {
    id: 'ycb-yrt-yfb', number: 141, brand: 'altitude', aircraft: 'b737-700c',
    stops: ['YCB', 'YRT', 'YFB'], days: [3, 6], cadence: 'weekly', depart: 8 * 60 + 30,
    name: 'The cross-territory link — Cambridge Bay to Iqaluit',
  },

  /* ── Express — direct turboprop ───────────────────────────────────────── */
  {
    id: 'yfb-yxp', number: 300, brand: 'express', aircraft: 'dash8-100',
    stops: ['YFB', 'YXP'], days: [1, 2, 3, 4, 5, 6], cadence: 'weekly', depart: 9 * 60 + 20,
    name: 'Iqaluit – Pangnirtung',
  },
  {
    id: 'yxp-yfb', number: 301, brand: 'express', aircraft: 'dash8-100',
    stops: ['YXP', 'YFB'], days: [1, 2, 3, 4, 5, 6], cadence: 'weekly', depart: 11 * 60 + 30,
    name: 'Pangnirtung – Iqaluit',
  },
  {
    id: 'yfb-yte', number: 310, brand: 'express', aircraft: 'atr42-500',
    stops: ['YFB', 'YTE'], days: [1, 3, 5], cadence: 'weekly', depart: 14 * 60 + 15,
    name: 'Iqaluit – Kinngait',
  },
  {
    id: 'yte-yfb', number: 311, brand: 'express', aircraft: 'atr42-500',
    stops: ['YTE', 'YFB'], days: [1, 3, 5], cadence: 'weekly', depart: 16 * 60 + 30,
    name: 'Kinngait – Iqaluit',
  },
  {
    id: 'yfb-yio', number: 320, brand: 'express', aircraft: 'atr42-500',
    stops: ['YFB', 'YIO'], days: [2, 4, 7], cadence: 'weekly', depart: 8 * 60 + 10,
    name: 'Iqaluit – Pond Inlet',
    note: 'The long one — the direct that saves a day and a half over the circuit.',
  },
  {
    id: 'yio-yfb', number: 321, brand: 'express', aircraft: 'atr42-500',
    stops: ['YIO', 'YFB'], days: [2, 4, 7], cadence: 'weekly', depart: 12 * 60 + 30,
    name: 'Pond Inlet – Iqaluit',
  },
  {
    id: 'yrt-yek', number: 330, brand: 'express', aircraft: 'dash8-300',
    stops: ['YRT', 'YEK'], days: [1, 2, 3, 4, 5, 7], cadence: 'weekly', depart: 7 * 60 + 45,
    name: 'Rankin Inlet – Arviat',
  },
  {
    id: 'yek-yrt', number: 331, brand: 'express', aircraft: 'dash8-300',
    stops: ['YEK', 'YRT'], days: [1, 2, 3, 4, 5, 7], cadence: 'weekly', depart: 9 * 60 + 30,
    name: 'Arviat – Rankin Inlet',
  },
  {
    id: 'yrt-ybk', number: 340, brand: 'express', aircraft: 'dash8-300',
    stops: ['YRT', 'YBK'], days: [1, 2, 3, 4, 5], cadence: 'weekly', depart: 15 * 60 + 10,
    name: 'Rankin Inlet – Baker Lake',
  },
  {
    id: 'ybk-yrt', number: 341, brand: 'express', aircraft: 'dash8-300',
    stops: ['YBK', 'YRT'], days: [1, 2, 3, 4, 5], cadence: 'weekly', depart: 17 * 60,
    name: 'Baker Lake – Rankin Inlet',
  },
  {
    id: 'ycb-yhk', number: 350, brand: 'express', aircraft: 'dash8-300',
    stops: ['YCB', 'YHK'], days: [1, 3, 5], cadence: 'weekly', depart: 13 * 60 + 20,
    name: 'Cambridge Bay – Gjoa Haven',
  },
  {
    id: 'yhk-ycb', number: 351, brand: 'express', aircraft: 'dash8-300',
    stops: ['YHK', 'YCB'], days: [1, 3, 5], cadence: 'weekly', depart: 15 * 60 + 20,
    name: 'Gjoa Haven – Cambridge Bay',
  },
  {
    id: 'ysk-ywg', number: 360, brand: 'express', aircraft: 'atr42-500',
    stops: ['YSK', 'YWG'], days: [4], cadence: 'weekly', depart: 10 * 60,
    name: 'Sanikiluaq – Winnipeg',
    note: 'Sanikiluaq sits in Hudson Bay, closer to Manitoba than to the rest of Nunavut. Its link runs south.',
  },
  {
    id: 'ywg-ysk', number: 361, brand: 'express', aircraft: 'atr42-500',
    stops: ['YWG', 'YSK'], days: [4], cadence: 'weekly', depart: 14 * 60 + 30,
    name: 'Winnipeg – Sanikiluaq',
  },

  /* ── Connect — the circuits ───────────────────────────────────────────── */
  {
    id: 'north-baffin-out', number: 500, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YFB', 'YUX', 'YGT', 'YIO', 'YAB', 'YRB'], days: [2], cadence: 'even',
    depart: 7 * 60 + 30, circuit: 'north-baffin',
    name: 'North Baffin circuit — northbound',
  },
  {
    id: 'north-baffin-back', number: 501, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YRB', 'YAB', 'YIO', 'YGT', 'YUX', 'YFB'], days: [3], cadence: 'even',
    depart: 9 * 60, circuit: 'north-baffin',
    name: 'North Baffin circuit — southbound',
  },
  {
    id: 'east-baffin-out', number: 510, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YFB', 'YXP', 'YVM', 'YCY', 'YIO'], days: [2], cadence: 'odd',
    depart: 7 * 60 + 45, circuit: 'east-baffin',
    name: 'East Baffin circuit — northbound',
  },
  {
    id: 'east-baffin-back', number: 511, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YIO', 'YCY', 'YVM', 'YXP', 'YFB'], days: [3], cadence: 'odd',
    depart: 8 * 60 + 15, circuit: 'east-baffin',
    name: 'East Baffin circuit — southbound',
  },
  {
    id: 'grise-fiord-out', number: 520, brand: 'connect', aircraft: 'dhc6-300',
    stops: ['YRB', 'YGZ'], days: [2], cadence: 'even', depart: 13 * 60 + 30,
    circuit: 'north-baffin',
    name: 'Resolute – Grise Fiord',
    note: 'Grise Fiord is the northernmost community in Canada. Its strip takes nothing larger than the Twin Otter.',
  },
  {
    id: 'grise-fiord-back', number: 521, brand: 'connect', aircraft: 'dhc6-300',
    stops: ['YGZ', 'YRB'], days: [3], cadence: 'even', depart: 6 * 60 + 30,
    circuit: 'north-baffin',
    name: 'Grise Fiord – Resolute',
    note: 'Timed to connect onto the southbound circuit the same morning.',
  },
  {
    id: 'south-baffin-out', number: 530, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YFB', 'YLC', 'YTE'], days: [4], cadence: 'weekly', depart: 9 * 60,
    circuit: 'south-baffin',
    name: 'South Baffin run — outbound',
  },
  {
    id: 'south-baffin-back', number: 531, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YTE', 'YLC', 'YFB'], days: [4], cadence: 'weekly', depart: 13 * 60 + 30,
    circuit: 'south-baffin',
    name: 'South Baffin run — inbound',
  },
  {
    id: 'kivalliq-coast-out', number: 540, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YRT', 'YXN', 'YEK'], days: [1], cadence: 'weekly', depart: 8 * 60 + 30,
    circuit: 'kivalliq-coast',
    name: 'Kivalliq coast run — southbound',
  },
  {
    id: 'kivalliq-coast-back', number: 541, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YEK', 'YXN', 'YRT'], days: [1], cadence: 'weekly', depart: 12 * 60,
    circuit: 'kivalliq-coast',
    name: 'Kivalliq coast run — northbound',
  },
  {
    id: 'kivalliq-north-out', number: 550, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YRT', 'YCS', 'YZS', 'YUT'], days: [3], cadence: 'weekly', depart: 8 * 60 + 45,
    circuit: 'kivalliq-north',
    name: 'Kivalliq north run — outbound',
  },
  {
    id: 'kivalliq-north-back', number: 551, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YUT', 'YZS', 'YCS', 'YRT'], days: [3], cadence: 'weekly', depart: 14 * 60,
    circuit: 'kivalliq-north',
    name: 'Kivalliq north run — inbound',
  },
  {
    id: 'kitikmeot-out', number: 560, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YCB', 'YBB', 'YYH', 'YHK'], days: [4], cadence: 'even', depart: 9 * 60 + 15,
    circuit: 'kitikmeot',
    name: 'Kitikmeot circuit — eastbound',
  },
  {
    id: 'kitikmeot-back', number: 561, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YHK', 'YYH', 'YBB', 'YCB'], days: [5], cadence: 'even', depart: 9 * 60 + 15,
    circuit: 'kitikmeot',
    name: 'Kitikmeot circuit — westbound',
  },
  {
    id: 'kugluktuk-out', number: 570, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YCB', 'YCO'], days: [2, 6], cadence: 'weekly', depart: 10 * 60 + 30,
    circuit: 'kugluktuk',
    name: 'Cambridge Bay – Kugluktuk',
  },
  {
    id: 'kugluktuk-back', number: 571, brand: 'connect', aircraft: 'dash8-100',
    stops: ['YCO', 'YCB'], days: [2, 6], cadence: 'weekly', depart: 13 * 60,
    circuit: 'kugluktuk',
    name: 'Kugluktuk – Cambridge Bay',
  },
];

export const routeById = Object.fromEntries(routes.map((r) => [r.id, r]));

/**
 * The circuits, described for the milk-run timetable.
 *
 * `cadence` here is presentational — the authoritative cadence lives on each
 * route, and `circuitRoutes()` reads it back off them so the two cannot drift.
 */
export const circuits = [
  {
    id: 'north-baffin',
    name: 'North Baffin circuit',
    region: 'qikiqtaaluk',
    blurb:
      'Iqaluit up the east side of Foxe Basin to Sanirajak and Igloolik, across to Pond Inlet '
      + 'and Arctic Bay, and on to Resolute — with the Twin Otter connection to Grise Fiord. '
      + 'Two days out and back, on even weeks.',
  },
  {
    id: 'east-baffin',
    name: 'East Baffin circuit',
    region: 'qikiqtaaluk',
    blurb:
      'Up the east coast: Pangnirtung, Qikiqtarjuaq, Clyde River and Pond Inlet, returning the '
      + 'next day. Odd weeks, alternating with the North Baffin circuit so every community on '
      + 'Baffin sees an aircraft each fortnight.',
  },
  {
    id: 'south-baffin',
    name: 'South Baffin run',
    region: 'qikiqtaaluk',
    blurb: 'Kimmirut and Kinngait, out and back the same day. Weekly, on Thursdays.',
  },
  {
    id: 'kivalliq-coast',
    name: 'Kivalliq coast run',
    region: 'kivalliq',
    blurb: 'Rankin Inlet down the Hudson Bay coast through Whale Cove to Arviat, and back. Weekly.',
  },
  {
    id: 'kivalliq-north',
    name: 'Kivalliq north run',
    region: 'kivalliq',
    blurb: 'Chesterfield Inlet, Salliq and Naujaat. Weekly, on Wednesdays.',
  },
  {
    id: 'kitikmeot',
    name: 'Kitikmeot circuit',
    region: 'kitikmeot',
    blurb: 'Cambridge Bay east to Kugaaruk, Taloyoak and Gjoa Haven, returning the next day. Even weeks.',
  },
  {
    id: 'kugluktuk',
    name: 'Kugluktuk run',
    region: 'kitikmeot',
    blurb: 'Cambridge Bay west to Kugluktuk, twice a week.',
  },
];

export const circuitById = Object.fromEntries(circuits.map((c) => [c.id, c]));

/** Routes belonging to a circuit, in the order they are flown. */
export const circuitRoutes = (circuitId) => routes.filter((r) => r.circuit === circuitId);

/** Every airport pair this route can sell, in order along the circuit. */
export function routePairs(route) {
  const pairs = [];
  for (let i = 0; i < route.stops.length - 1; i++) {
    for (let j = i + 1; j < route.stops.length; j++) {
      pairs.push([route.stops[i], route.stops[j]]);
    }
  }
  return pairs;
}

/** Every airport the network serves at least once. */
export const servedCodes = [...new Set(routes.flatMap((r) => r.stops))].sort();

/** Routes that can carry a passenger from one airport to another without a change. */
export function routesServing(from, to) {
  return routes.filter((route) => {
    const i = route.stops.indexOf(from);
    const j = route.stops.indexOf(to);
    return i !== -1 && j !== -1 && i < j;
  });
}
