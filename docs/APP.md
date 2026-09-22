# North Winds Airlines — the site and app

A working prototype of the full web presence for **North Winds Airlines**, the
aviation venture in the NWPH portfolio: a marketing and travel-information site
on a wide screen, an app on a phone, from one codebase. It builds to
`dist/app/` and is published at `/NWPH/app/`.

**The airline does not exist.** No company, no Air Operator Certificate, no
aircraft, no seats for sale. On the corporation's own site, aviation is listed
as `planned`. This app is a design and engineering prototype of what the
airline's app would be, and the build refuses to publish it without saying so —
see [Keeping it honest](#keeping-it-honest).

---

## What it does

Fifty-odd screens across six sections.

### Book
| | |
|---|---|
| **Search and book** | One search across all three service lines, with connections built between them. Fare families, traveller details, seat maps, bags and freight, review and confirmation. |
| **Multi-city** | Up to four flights on one booking under one fare family. Each leg is checked for service before you commit, and a leg with no service on its date offers the next one that works. |
| **Low-fare calendar** | A month of fares on one route. On this network its first job is showing which days have a service at all. |
| **Seat sales** | Fares genuinely below the norm for their own route, measured against the median of comparable journeys on the same pairing. |
| **Cargo** | Freight quoted by chargeable weight across seven classes, with the aircraft that will carry it and what could hold it up. |
| **Charter** | Five types, quoted by block hour including positioning — and only the types that can use both runways are offered. |
| **Groups, medical and duty travel** | Group holds and terms, medical authorisations, billed corporate accounts. |

### Travel
| | |
|---|---|
| **Manage a booking** | Change the flight or date with the difference and fee quoted before anything is committed. Cancel with the refund or credit stated up front. Full change history. |
| **Rebook after disruption** | Free, keeps the fare, ordered by arrival rather than price — because price is irrelevant when the airline is paying. |
| **Same-day standby** | Included on Flex and Summit. Shows the actual load and says plainly when the odds are poor. |
| **Upgrades** | Priced as the fare difference with no change fee, and only where every flight in the journey has space. |
| **Check in and boarding passes** | 24-hour window, seats assigned to anyone without one, a pass per traveller per flight with a real IATA BCBP (M1) string. Works offline and prints. |
| **Flight status** | A departure board for any community on any date, or one flight end to end. |
| **Travel credits** | What a cancellation left, and when it expires. |

### Where we fly
Destinations index and a page per community — Inuktitut name, what the place is, what the strip is like, what the light does at that latitude, which services call and where you can reach without a change. Plus the route map, the milk-run circuits, the fleet and a printable timetable.

### Travel info
Baggage with a calculator, identification, special assistance, live travel advisories, a searchable help centre, contact, conditions of carriage, privacy and accessibility.

### Circle
The loyalty programme, a tier comparison, miles activity, and redemption pricing.

### About
Our story, community commitments, careers with six roles, and the accounting of what in this prototype is real.

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
├── index.html              the shell — header, main, footer, tab bar, menu sheet
├── manifest.webmanifest    installable, with shortcuts
├── sw.js                   precaches the whole site; stamped at build time
├── styles/                 tokens → base → layout → components → hero → flight → print
└── src/
    ├── main.js             the route table, navigation, toasts
    ├── lib/
    │   ├── dom.js          escape-by-default templating, delegated events, icons
    │   ├── router.js       hash routing
    │   ├── store.js        state and checkout, persisted to localStorage
    │   ├── dates.js        dates, ISO weeks, DST, three time zones
    │   └── random.js       deterministic pseudo-randomness
    ├── data/
    │   ├── sitemap.js      the site's architecture — menus, tabs and footer read it
    │   ├── airports.js     30 communities and gateways, real coordinates
    │   ├── aircraft.js     seven types and their cabins
    │   ├── network.js      42 routes and 7 circuits
    │   ├── brand.js        service lines, fare families, fare types, ancillaries
    │   ├── destinations.js what there is to say about each place
    │   ├── policies.js     baggage, identification, assistance, carriage, privacy
    │   ├── services.js     cargo classes, charter fleet, group terms, careers
    │   ├── help.js         28 questions, searchable
    │   └── advisories.js   standing facts, plus disruption derived from the schedule
    ├── engine/
    │   ├── schedule.js     routes + a date → flights, segments, inventory, status
    │   ├── pricing.js      fares, charges, totals — integer cents throughout
    │   ├── search.js       itineraries across service lines
    │   ├── booking.js      create, change, cancel, check in, boarding passes
    │   ├── disruption.js   rebooking, standby and upgrade rules
    │   ├── services.js     cargo, charter and redemption quoting
    │   └── deals.js        fares below the norm for their own route
    └── views/              chrome, plus one module per section
```

### One source for the navigation

The desktop menus, the phone's full-screen menu and the footer sitemap are three
presentations of `src/data/sitemap.js`. Adding a screen means adding it there and
registering its route; it then appears in all three, in the right section, with
the same wording — and a check asserts that all 87 navigation links resolve to a
registered route.

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
| **Navigation** | **Every link in every menu, the tab bar and the footer resolves to a registered route**, and every one carries an explanation |
| Contrast | Every text-on-surface pair in light **and** dark, read out of `tokens.css` rather than restated |
| Build output | Every module import resolves; the manifest's icons exist; the service worker was stamped; the prototype markers are present |

Three of these deserve their names in full. The **runway check** is why no route
in the app puts a 737 on a 869-metre gravel strip at Pangnirtung. The **import
graph check** is what a bundler would otherwise catch: with no build step for the
application code, a mistyped import path would only fail when someone opened the
screen that needed it. And the **navigation check** is what stops a site with six
menus and fifty screens shipping a dead link for a person to find.

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

## Design

The palette is taken from what the sky over Baffin does: a deep night blue as
the ground of the brand, an aurora green used sparingly and never as a wash, the
low sun's amber for warnings and deals, and a paper that is cool rather than
cream because northern daylight is blue. Both themes are designed rather than
one inverted from the other.

Type is a system stack on purpose — there is no webfont to download and nothing
to fall back from, which matters on a metered satellite link. The freshness
comes from the scale, the weights and the spacing.

Nothing is a photograph. The hero is CSS gradients with the real network traced
behind it; each destination card carries a generated sky whose darkness and
aurora strength follow the community's latitude, so Grise Fiord at 76°N reads
darker than Iqaluit at 63°N. A stock image of "the Arctic" pinned to a named
community would be a lie about somewhere specific; the light, at least, is true.

## Known limits

- **Retrieving a booking made elsewhere** cannot work: bookings live on the
  device that made them, and there is no server to ask.
- **Redemption** quotes are real but the booking completes as a cash purchase;
  paying in miles is not built.
- **Seat changes after booking** are made at check-in rather than from the
  booking screen.
- **Every enquiry form** — groups, charter, assistance, corporate — says plainly
  that nothing was sent, because nothing was.
- The **boarding-pass bar pattern is decorative**. The BCBP string beneath it is
  correctly formed, but a prototype should not emit something a gate reader
  might act on.
- The **network map** uses a corrected equirectangular projection. Above 60°N a
  conic would be the right answer; longitude is scaled by the cosine of the mean
  latitude so the territory is at least the shape people recognise.
