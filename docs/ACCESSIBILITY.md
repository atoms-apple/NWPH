# Accessibility audit

Target: **WCAG 2.2 AA**.

Verified against the built output in `dist/`, and driven in Chromium 141 via
Playwright for the keyboard, viewport and no-JavaScript behaviour. Reproduce
the static half with `npm run check`.

---

## Contrast

Every ratio below was computed from the actual token values, not estimated.

| Pair | Ratio | Required | Result |
|---|---|---|---|
| Body text on paper | 14.14:1 | 4.5 | pass |
| Muted text on paper | 5.62:1 | 4.5 | pass |
| Muted text on tint | 5.22:1 | 4.5 | pass |
| Headings (navy) on paper | 10.84:1 | 4.5 | pass |
| Links (ice) on paper | 5.24:1 | 4.5 | pass |
| Gold **text token** on paper | 4.52:1 | 4.5 | pass |
| Gold **text token** on white | 4.85:1 | 4.5 | pass |
| White on navy | 11.63:1 | 4.5 | pass |
| Muted on navy | 6.69:1 | 4.5 | pass |
| Gold-light on navy | 7.50:1 | 4.5 | pass |
| "In development" status on white | 6.42:1 | 4.5 | pass |
| "In development" status on navy | 6.39:1 | 4.5 | pass |
| Error text on white | 8.73:1 | 4.5 | pass |
| Focus ring (navy) on paper | 10.84:1 | 3 | pass |
| Focus ring (white) on navy | 11.63:1 | 3 | pass |
| Selected-tab indicator on paper | 4.52:1 | 3 | pass |

### The gold problem, and how it was solved

Brand gold `#B08D57` fails as text:

- on white — **3.09:1** (needs 4.5:1)
- on paper `#F7F7F5` — **2.88:1** (needs 4.5:1, and below even the 3:1
  non-text minimum)

The palette was **not** changed. Instead gold was split by role:

| Token | Value | Role |
|---|---|---|
| `--gold` | `#B08D57` | Decorative only: hairline rules, dots, card top-borders, the dash before a section label |
| `--gold-text` | `#8A6D3B` | Any gold **text** on a light background, and any gold that indicates state |
| `--gold-light` | `#E3CDA6` | Gold text on navy |

`tools/check.mjs` asserts the passing roles and prints the excluded ones, so a
regression that puts `--gold` back onto text is caught in CI.

---

## Fixed in this rebuild

Defects carried over from the original mockup, all now resolved:

1. **`.reveal { opacity: 0 }` hid the entire page without JavaScript.** Removed
   entirely. No content depends on script.
2. **Hamburger was a `<div role="button">` with a click listener only** —
   focusable but not operable by keyboard, with no `aria-expanded`. Replaced
   with a native `<details>` disclosure that works with no script at all;
   Escape and outside-click are enhancements.
3. **Every form label was unassociated** (no `for`, not wrapping). Every control
   now has a real `<label for>`, plus `aria-describedby` covering its hint and
   error node.
4. **Forms did not submit.** Real `<form method="post">` with server-side
   validation; success and failure land on real pages.
5. **`outline: none` on all focused fields.** Never removed now: a 3px
   two-tone ring, verified ≥3px computed and ≥3:1 against every surface
   (SC 2.4.11, 2.4.13).
6. **Heading order skipped h2→h4.** Now sequential on every page, asserted by
   `check.mjs` across all 16 pages.
7. **No landmarks, no skip link.** `<header>`/`<main id="main">`/`<footer>` on
   every page, plus a skip link verified to be the first tab stop.
8. **Aurora `requestAnimationFrame` ignored `prefers-reduced-motion`** and ran
   forever — continuous CPU and battery drain, hostile on the metered,
   low-power end of the audience. Removed; no canvas, no animation loop.
9. **Render-blocking Google Fonts from two third-party origins** — roughly two
   seconds of blank page on a 600–800ms satellite link. Now self-hosted, subset
   to latin, `font-display: swap`, with metric-matched fallbacks.
10. **No 404, sitemap, robots.txt, Open Graph or structured data.** All present.
11. **Status conveyed by colour alone.** Each status now carries its own word;
    the coloured dot is supplementary.
12. **Wide tables forced the whole page to scroll sideways at 320px.** Tables
    now scroll inside a focusable `role="region"` container (SC 2.1.1), and grid
    children are `min-width: 0` so they shrink properly.

---

## Verified in the browser

Chromium 141, all passing:

**Keyboard**
- First Tab reaches the skip link
- Tablist: roving tabindex `[0,-1,-1]`, ArrowLeft/ArrowRight/Home/End all move
  selection, exactly one panel exposed, panels carry `role="tabpanel"` and are
  focusable
- Focus ring computes to ≥3px

**320px viewport**
- Menu button visible, desktop nav hidden, all 6 links reachable
- Escape closes the menu
- Zero horizontal overflow on all six main pages

**JavaScript disabled**
- All 7 subsidiary cards visible by default
- CSS-only filter narrows to 1 card and resets to 7
- All 3 tab panels readable
- Mobile navigation opens
- "0 of 7 subsidiaries are currently operating" present

**Reduced motion** — honoured; transitions collapse to ~0.

---

## Outstanding

Things a full audit would still want, listed honestly rather than claimed as done:

1. **No screen reader testing.** Not possible in the build environment. NVDA +
   Firefox and VoiceOver + Safari passes are still needed, particularly on the
   tab group and the filter's live region.
2. **No Lighthouse run.** Lighthouse could not be installed. The inputs are
   favourable — 12.5 KB heaviest page, 26 KB CSS, 7.9 KB JS, no blocking
   requests, no layout-shifting images — but the score is unmeasured. Run it
   against the deployed site.
3. **Fonts not yet downloaded.** Until `npm run fetch-fonts` is run and the
   files committed, the site renders on fallbacks. The `size-adjust` and
   `ascent-override` values in `base.css` are reasonable estimates, not measured
   against the real metrics — worth re-checking for CLS once the fonts land.
4. **Zoom to 400%** (SC 1.4.10) not explicitly tested, though the layout is
   fluid and passes at 320px, which is the usual proxy.
5. **No automated axe-core pass.** `check.mjs` covers labels, landmarks, heading
   order, duplicate ids, ARIA reference integrity, alt text and link/button
   naming — but it is hand-written, not a substitute for axe.
6. **Inuktitut text.** The original mockup had syllabics inside `lang="en"`,
   which screen readers mispronounce. No syllabics appear in the current content;
   if any is added, it needs `lang="iu"` on the element. There is no `lang`
   switching helper yet.
7. **The forms are untested end to end**, because no endpoint is configured yet.
   Validation, honeypot and error rendering should be re-verified once
   `formEndpoint` is set.
