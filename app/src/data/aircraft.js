/**
 * The fleet, and the cabin layout of each type.
 *
 * Seat maps are generated from a compact description rather than listed seat by
 * seat: a row block says which letters exist, what the row is for, and what it
 * costs. `buildSeatMap()` expands that into the grid the seat picker renders,
 * so a cabin change is a three-line edit and the picker needs no changes at all.
 *
 * The combi is the interesting one. On this network freight and passengers ride
 * the same airframe, and the forward half of the 737-700C is a cargo bay with a
 * main-deck door. The seat map shows it, because a traveller choosing a seat
 * should see why the cabin starts at row 11.
 */

export const aircraft = {
  'b737-800': {
    id: 'b737-800',
    name: 'Boeing 737-800',
    short: '738',
    brand: 'altitude',
    cruiseKph: 780,
    turnaroundMin: 45,
    minRunway: 1800,
    gravelCapable: false,
    cargoTonnes: 4,
    note: 'Paved runways only — Iqaluit and the southern gateways.',
    cabin: [
      { kind: 'cabin-label', label: 'Summit cabin' },
      { kind: 'rows', from: 1, to: 4, letters: ['A', 'B', 'C', 'D', 'E', 'F'], cabin: 'summit', blocked: ['B', 'E'], price: 0, legroom: true },
      { kind: 'galley', label: 'Galley and forward lavatory' },
      { kind: 'cabin-label', label: 'Main cabin' },
      { kind: 'rows', from: 10, to: 14, letters: ['A', 'B', 'C', 'D', 'E', 'F'], cabin: 'preferred', price: 44 },
      { kind: 'rows', from: 15, to: 16, letters: ['A', 'B', 'C', 'D', 'E', 'F'], cabin: 'exit', price: 58, legroom: true, exit: true },
      { kind: 'rows', from: 17, to: 33, letters: ['A', 'B', 'C', 'D', 'E', 'F'], cabin: 'main', price: 26 },
      { kind: 'galley', label: 'Rear galley and lavatories' },
    ],
  },

  'b737-700c': {
    id: 'b737-700c',
    name: 'Boeing 737-700C combi',
    short: '73C',
    brand: 'altitude',
    cruiseKph: 770,
    turnaroundMin: 60,
    minRunway: 1500,
    gravelCapable: true,
    cargoTonnes: 12,
    note: 'Gravel-kitted. Forward main deck is freight; the cabin is aft of the bulkhead.',
    cabin: [
      { kind: 'cargo', label: 'Main-deck freight — forward half of the aircraft' },
      { kind: 'cabin-label', label: 'Cabin' },
      { kind: 'rows', from: 11, to: 12, letters: ['A', 'B', 'C', 'D', 'E', 'F'], cabin: 'preferred', price: 40, legroom: true },
      { kind: 'rows', from: 13, to: 14, letters: ['A', 'B', 'C', 'D', 'E', 'F'], cabin: 'exit', price: 52, legroom: true, exit: true },
      { kind: 'rows', from: 15, to: 23, letters: ['A', 'B', 'C', 'D', 'E', 'F'], cabin: 'main', price: 22 },
      { kind: 'galley', label: 'Rear galley and lavatory' },
    ],
  },

  'atr42-500': {
    id: 'atr42-500',
    name: 'ATR 42-500',
    short: 'AT4',
    brand: 'express',
    cruiseKph: 510,
    turnaroundMin: 30,
    minRunway: 1100,
    gravelCapable: true,
    cargoTonnes: 2.4,
    note: 'Two-by-two cabin, boarding by the rear airstair. Needs a longer strip than the Dash 8.',
    cabin: [
      { kind: 'cargo', label: 'Forward freight compartment' },
      { kind: 'rows', from: 1, to: 3, letters: ['A', 'C', 'D', 'F'], cabin: 'preferred', price: 28, legroom: true },
      { kind: 'rows', from: 4, to: 7, letters: ['A', 'C', 'D', 'F'], cabin: 'main', price: 18 },
      { kind: 'rows', from: 8, to: 9, letters: ['A', 'C', 'D', 'F'], cabin: 'exit', price: 34, legroom: true, exit: true },
      { kind: 'rows', from: 10, to: 12, letters: ['A', 'C', 'D', 'F'], cabin: 'main', price: 18 },
      { kind: 'galley', label: 'Rear airstair, galley and lavatory' },
    ],
  },

  'dash8-300': {
    id: 'dash8-300',
    name: 'De Havilland Dash 8-300',
    short: 'DH3',
    brand: 'express',
    cruiseKph: 500,
    turnaroundMin: 25,
    minRunway: 1000,
    gravelCapable: true,
    cargoTonnes: 1.8,
    note: 'Short-field turboprop, two-by-two.',
    cabin: [
      { kind: 'rows', from: 1, to: 4, letters: ['A', 'C', 'D', 'F'], cabin: 'preferred', price: 26, legroom: true },
      { kind: 'rows', from: 5, to: 8, letters: ['A', 'C', 'D', 'F'], cabin: 'main', price: 16 },
      { kind: 'rows', from: 9, to: 10, letters: ['A', 'C', 'D', 'F'], cabin: 'exit', price: 30, legroom: true, exit: true },
      { kind: 'rows', from: 11, to: 12, letters: ['A', 'C', 'D', 'F'], cabin: 'main', price: 16 },
      { kind: 'rows', from: 13, to: 13, letters: ['A', 'C'], cabin: 'main', price: 16, note: 'Last row — two seats' },
      { kind: 'cargo', label: 'Rear freight compartment' },
    ],
  },

  'dash8-100': {
    id: 'dash8-100',
    name: 'De Havilland Dash 8-100',
    short: 'DH1',
    brand: 'connect',
    cruiseKph: 460,
    turnaroundMin: 20,
    minRunway: 800,
    gravelCapable: true,
    cargoTonnes: 1.4,
    note: 'The circuit aircraft. Gravel strips, short fields, freight in the back.',
    cabin: [
      { kind: 'rows', from: 1, to: 3, letters: ['A', 'C', 'D', 'F'], cabin: 'preferred', price: 22, legroom: true },
      { kind: 'rows', from: 4, to: 6, letters: ['A', 'C', 'D', 'F'], cabin: 'main', price: 14 },
      { kind: 'rows', from: 7, to: 8, letters: ['A', 'C', 'D', 'F'], cabin: 'exit', price: 24, legroom: true, exit: true },
      { kind: 'rows', from: 9, to: 9, letters: ['A', 'C', 'D', 'F'], cabin: 'main', price: 14 },
      { kind: 'rows', from: 10, to: 10, letters: ['A'], cabin: 'main', price: 14, note: 'Last row — a single seat' },
      { kind: 'cargo', label: 'Rear freight and mail' },
    ],
  },

  'dhc6-300': {
    id: 'dhc6-300',
    name: 'De Havilland Twin Otter 300',
    short: 'DHT',
    brand: 'connect',
    cruiseKph: 300,
    turnaroundMin: 15,
    minRunway: 400,
    gravelCapable: true,
    cargoTonnes: 0.6,
    note: 'The shortest strips on the network — Grise Fiord, and anywhere the gravel runs out early.',
    cabin: [
      { kind: 'rows', from: 1, to: 9, letters: ['A', 'C'], cabin: 'main', price: 0 },
      { kind: 'rows', from: 10, to: 10, letters: ['A'], cabin: 'main', price: 0, note: 'Single seat at the rear' },
      { kind: 'cargo', label: 'Nose baggage and rear freight' },
    ],
  },

  kingair350: {
    id: 'kingair350',
    name: 'Beechcraft King Air 350',
    short: 'BE2',
    brand: 'connect',
    cruiseKph: 520,
    turnaroundMin: 15,
    minRunway: 900,
    gravelCapable: true,
    cargoTonnes: 0.4,
    note: 'Charter, medical transfers and camp support. Nine seats, flown on demand.',
    cabin: [
      { kind: 'rows', from: 1, to: 4, letters: ['A', 'D'], cabin: 'main', price: 0 },
      { kind: 'rows', from: 5, to: 5, letters: ['A'], cabin: 'main', price: 0, note: 'Single seat opposite the airstair' },
      { kind: 'cargo', label: 'Nose and aft baggage' },
    ],
  },
};

export const aircraftList = Object.values(aircraft);

/**
 * Seats on a type, counted from its cabin rather than declared alongside it.
 *
 * A declared total and a cabin that disagree is a bug nobody notices until a
 * flight sells one seat too many, so the number has exactly one source.
 */
const seatCounts = new Map();
export function seatCount(typeId) {
  if (!seatCounts.has(typeId)) {
    seatCounts.set(typeId, buildSeatMap(typeId).seats.filter((s) => !s.blocked).length);
  }
  return seatCounts.get(typeId);
}

export function aircraftType(id) {
  const found = aircraft[id];
  if (!found) throw new Error(`Unknown aircraft type: ${id}`);
  return found;
}

/**
 * Expand a cabin description into rows of seats.
 *
 * Returns a flat list of blocks so the renderer can lay out galleys, cargo bays
 * and cabin labels in the right places without knowing the cabin's shape.
 */
export function buildSeatMap(typeId) {
  const type = aircraftType(typeId);
  const blocks = [];
  for (const block of type.cabin) {
    if (block.kind !== 'rows') {
      blocks.push({ ...block });
      continue;
    }
    for (let row = block.from; row <= block.to; row++) {
      const seats = block.letters.map((letter) => ({
        id: `${row}${letter}`,
        row,
        letter,
        cabin: block.cabin,
        price: block.price ?? 0,
        legroom: Boolean(block.legroom),
        exit: Boolean(block.exit),
        blocked: (block.blocked ?? []).includes(letter),
        position: seatPosition(letter, block.letters),
      }));
      blocks.push({ kind: 'row', row, seats, aisleAfter: aisleAfter(block.letters), note: block.note });
    }
  }
  return { type, blocks, seats: blocks.filter((b) => b.kind === 'row').flatMap((b) => b.seats) };
}

/** Window, aisle or middle, worked out from the letters present in the row. */
function seatPosition(letter, letters) {
  const index = letters.indexOf(letter);
  if (index === 0 || index === letters.length - 1) return 'window';
  const split = aisleAfter(letters);
  if (letters[index] === letters[split - 1] || letters[index] === letters[split]) return 'aisle';
  return 'middle';
}

/** Index the aisle falls after: 3 in a six-across cabin, 2 in a four-across. */
function aisleAfter(letters) {
  return Math.ceil(letters.length / 2);
}
