# North Winds Airlines — the passenger app

A working prototype of the booking app for **North Winds Airlines**, the
aviation venture in the NWPH portfolio. It builds to `dist/app/` and is
published at `/NWPH/app/`.

**The airline does not exist.** No company, no Air Operator Certificate, no
aircraft, no seats for sale. On the corporation's own site, aviation is listed
as `planned`. This app is a design and engineering prototype of what the
airline's app would be, and the build refuses to publish it without saying so —
see [Keeping it honest](#keeping-it-honest).

---

## What it does

| | |
|---|---|
| **Search and book** | One search across all three service lines, with connections built between them. Fare families, traveller details, seat maps, bags and freight, review and confirmation. |
| **Manage a booking** | Change the flight or the date with the fare difference and fee quoted before anything is committed. Cancel with the refund or credit stated up front. Full change history. |
| **Check in** | Opens 24 hours out. Assigns seats to anyone who has none, and issues a boarding pass per traveller per flight. |
| **Boarding passes** | Rendered from data on the device, with a real IATA BCBP (M1) string. Works with no signal and prints. |
| **Flight status** | A departure board for any community on any date, or one flight end to end. Delays name the actual cause, which up here is usually the weather. |
| **Milk runs** | Each circuit's sequence of stops, its cadence and its next departures. |
| **Network** | Every community, drawn from real coordinates, with its runway, its services and where it connects to. |

---

## The three service lines

They are sections of the app, not walls between them. A single booking may span
all three — Clyde River to Ottawa is a Connect circuit down to Iqaluit and an
Altitude jet south, quoted as one fare with the bags checked through.

| Line | What it is | Fleet |
|---|---|---|
| **Altitude** | The jet fleet: southern gateways, and the sectors long enough to justify a jet | 737-800, 737-700C combi |
| **Express** | Direct turboprop between the larger communities — no intermediate stops | ATR 42-500, Dash 8-300, Dash 8-100 |
| **Connect** | The circuits. Multi-stop runs calling at the small strips in sequence | Dash 8-100, Twin Otter 300, King Air 350 |

The two Baffin circuits alternate: **North Baffin on even ISO weeks, East Baffin
on odd ones**, so every community on the island sees an aircraft each fortnight.
That cadence is enforced in the data (`cadence: 'even' | 'odd' | 'weekly'`) and
asserted in the checks, including a test that every community on a circuit is
served at least once in any fourteen-day window.

---

## Architecture

No framework, no bundler, no dependencies. Native ES modules, served as written.

```
app/
├── index.html              the shell — header, main, tab bar, live region
├── manifest.webmanifest    installable, with shortcuts
├── sw.js                   precaches the whole app; stamped at build time
├── styles/                 tokens → base → layout → components → flight → print
└── src/
    ├── main.js             routes, chrome, navigation, toasts
    ├── lib/
    │   ├── dom.js          escape-by-default templating, delegated events, icons
    │   ├── router.js       hash routing
    │   ├── store.js        state, persisted to localStorage
    │   ├── dates.js        dates, ISO weeks, DST, three time zones
    │   └── random.js       deterministic pseudo-randomness
    ├── data/               airports, aircraft and cabins, routes, brand and fares
    ├── engine/
    │   ├── schedule.js     routes + a date → flights, segments, inventory, status
    │   ├── pricing.js      fares, charges, totals — integer cents throughout
    │   ├── search.js       itineraries across service lines
    │   └── booking.js      create, change, cancel, check in, boarding passes
    └── views/              one module per screen
```

### Everything is derived

The pattern the corporate site uses for its operating count runs through the
app as well: a fact has one source, and everything else is computed from it.

- **Seat counts** come from counting the cabin, not from a number typed beside
  it. A declared total that disagrees with the seat map is a bug nobody notices
  until a flight sells one seat too many.
- **Flights** do not exist until asked for. A route is a repeating pattern; a
  date turns it into a flight with real times. Nothing is stored, so the
  timetable never runs out and a booking made today still resolves next year.
- **Block times, fares and the network map** all come from the airports' real
  coordinates. A wrong coordinate shows up as a wrong flight time.
- **Inventory and the seat map** are two views of one number. The count of
  occupied seats *is* the number sold.
- **A booking stores identifiers**, never computed times or prices — route,
  date, boarding point, leaving point, and the price actually paid. Everything
  else is rebuilt on read, so a booking is a few hundred bytes and can never
  disagree with the flight it is for.

### Deterministic, not random

Load factors, seat occupancy, delays and the demand component of a fare are
pure functions of a seed string (`lib/random.js`). Nothing calls `Math.random`.
The same flight on the same date costs the same thing tomorrow, in another
browser, offline.

### Offline first

There is no server. The timetable is computed on the device, bookings live in
`localStorage`, and the service worker precaches every file. That is not only a
property of a prototype: an app for this network has to work on a metered
satellite link and on no link at all, standing on gravel beside a Dash 8 with a
boarding pass to show.

`localStorage` is wrapped so that a browser refusing it degrades to memory
rather than throwing, and the profile screen says which of the two you have.

### Relative paths

Every URL the app emits is relative and routing is on the hash, so the whole
directory works from any prefix — a Pages subpath now, a domain later — with no
rebuild and no base to configure.

---

## The build

```bash
npm run build:app     # → dist/app/
npm run check:app     # the gate
npm run dev           # build both, serve at http://localhost:4321/NWPH/app/
```

`build-app.mjs` does the work a bundler would not:

- concatenates and minifies the six stylesheets;
- generates the PNG icons — `tools/png.mjs` is a small PNG encoder over Node's
  own zlib, because four icons are not a reason to take on an image library;
- stamps `sw.js` with a content hash and the precache list, so a deploy
  invalidates the old cache and an unchanged deploy does not;
- copies the modules across unminified, because a readable stack trace is worth
  more here than a few kilobytes.

Application modules are **not** bundled. The browsers this targets load ES
modules natively.

---

## The checks

`tools/check-app.mjs` — 660-odd assertions, no dependencies, run in CI.

| Group | What it asserts |
|---|---|
| Dates | ISO weeks, DST boundaries, three time zones, Salliq staying on EST all year |
| Airports and aircraft | Distances against known figures, no duplicate seats, cabin geometry |
| **Network** | **Every route's aircraft can physically use every strip it calls at** — length and surface |
| Network | Flight-number ranges match the published convention; the Baffin circuits alternate; every community is served in a fortnight |
| Schedule | Legs are ordered and non-overlapping; segments cannot be sold backwards; inventory matches the seat map; output is deterministic |
| Itineraries | No journey visits the same airport twice; segments join end to end; connections are within bounds; a stored itinerary rebuilds identically |
| Pricing | **Every breakdown sums to its total**; fare families are strictly ordered; infants pay no security charge or airport fee; discounts apply to the fare and nothing else |
| Bookings | Fare rules are enforced where they are written; a change releases seats; check-in never assigns a cabin the fare may not use; the BCBP is well formed |
| Contrast | Every text-on-surface pair in light **and** dark, read out of `tokens.css` rather than restated |
| Build output | Every module import resolves; the manifest's icons exist; the service worker was stamped; the prototype markers are present |

Two of these deserve their names in full. The **runway check** is why no route
in the app puts a 737 on a 869-metre gravel strip at Pangnirtung. The **import
graph check** is what a bundler would otherwise catch: with no build step for
the application code, a mistyped import path would only fail when someone opened
the screen that needed it.

The contrast checker parses `app/styles/tokens.css`. A checker holding its own
copy of the palette passes happily while the app ships a different one.

---

## Keeping it honest

The corporation's site exists to avoid claiming things that are not so. A
booking app for an airline with no aircraft is exactly the kind of thing that
gets screenshotted without its context, so the marking is structural rather than
a line of small print:

1. A **Prototype** chip in the header of every screen, linking to the About
   screen. It is in the app chrome, not on a splash someone dismisses.
2. The **About screen** states plainly that the airline does not exist, and sets
   out what in the app is real (communities, coordinates, runways, distances,
   time zones, the shape of a Canadian fare) against what is invented (the
   airline, the fleet, every timetable and every fare).
3. The **payment screen** says no payment is taken and no card details leave the
   device, above the card fields.
4. `noindex` on the shell and `Disallow: /NWPH/app/` in `robots.txt`.
5. **CI fails the deploy** if any of 1–4 is missing.

The app is deliberately **not linked from the factual site**. On that site,
aviation is a sector assessment with no company formed; a link to a working
booking app would say otherwise.

---

## Accessibility

- Every control is reachable by keyboard, the seat map included: arrow keys move
  between seats, and each seat announces its row, position, whether it is an
  exit row, its price and whether it is taken.
- Colour is never the only signal. Seat states differ in fill and weight; flight
  status carries an icon and a word; the service lines are named as well as
  coloured.
- Focus is moved into the content on every navigation and is always visible.
- A live region announces route changes, seat selections and validation errors.
- Contrast is verified in both themes on every build.
- Touch targets are at least 44px; the tab bar clears the home indicator.
- Reduced motion is respected. The app renders in the reader's theme.
- With JavaScript off, the shell says so and gives a telephone number.

---

## Known limits

- **Multi-city** is not built. The search form offers it and says plainly that
  it is not available rather than pretending.
- **Retrieving a booking made elsewhere** cannot work: bookings live on the
  device that made them, and there is no server to ask.
- **Seat changes after booking** are made at check-in rather than from the
  booking screen.
- The **boarding-pass bar pattern is decorative**. The BCBP string beneath it is
  correctly formed, but a prototype should not emit something a gate reader
  might act on.
- The **network map** uses a corrected equirectangular projection. Above 60°N a
  conic would be the right answer; longitude is scaled by the cosine of the mean
  latitude so the territory is at least the shape people recognise.
