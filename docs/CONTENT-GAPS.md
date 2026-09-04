# Content gaps and decisions needed

Ordered roughly by how much damage getting them wrong would do. Nothing in this
list was invented to fill a hole — where copy did not exist, the section is
absent, empty, or held as a draft, and it is listed here instead.

---

## 1. The mockup this was supposed to be built from was never found

`nwph-website-mockup.html` is not in `atoms-apple/NWPH` (any branch, any of the
14 commits, any of the 37 git objects including unreachable ones), not in
`atoms-apple/NWPHv2` (an empty placeholder: one commit, an 8-byte README), and
not among any published artifacts.

This site was therefore built from the design specification in the brief
(palette hexes, typefaces, section rhythm, status enum, section inventory) plus
the real copy in the repository's own history. **Every visual decision not
specified in the brief is my judgement, not the mockup's.** If the mockup turns
up, expect layout differences.

Four older versions of `index.html` exist in history. The 1147-line one
(`c3e9efa`) is the closest ancestor to what the brief describes — Iqaluit,
procurement, supplier, ArcTrek, and a navy/gold/ice palette. Worth a look if
you want to recover copy.

## 2. Iqaluit or Qikiqtarjuaq?

**The brief says Iqaluit. The currently-published site says Qikiqtarjuaq**, eight
times, including the headquarters line. Two earlier versions in history said
Iqaluit; the newest reverted to Qikiqtarjuaq.

This site says **Iqaluit** (`src/data/site.mjs` → `headquarters`), following the
brief. It also appears in the `Organization` structured data, so search engines
will index whichever you choose.

Adam Aliqatuqtuq's biography says he is *from* Qikiqtarjuaq, which is consistent
with either answer. Decide the corporate address deliberately.

## 3. "Ltd." on companies that are not incorporated

Every subsidiary carries a legal name ending in `Ltd.` — `ArcTrek Expeditions
Ltd.`, `NunaBank Financial Services Ltd.`, and so on — but none is incorporated.
This is inherited from the existing site's copy, not something I introduced.

For a site whose whole credibility rests on not overstating its position, and
whose audience includes procurement officers, presenting an unincorporated
venture under a limited-company name is the one place the copy works against the
honesty everywhere else. **Worth legal advice**, and possibly the most important
item on this list. Options: drop the suffix until incorporation, or add
"proposed name" alongside.

Related: NunaBank. "Bank" is a restricted term in Canadian financial
legislation. Check before publishing.

## 4. No privacy notice, and the forms collect sensitive data

The career expression-of-interest form asks whether someone is a **Nunavut Inuit
beneficiary**. That is personal information collected for a stated purpose
(Inuit employment preference), and there is currently:

- no privacy policy page
- no statement of how long submissions are kept, or who sees them
- no lawful-basis statement

Given the audience — government funders and Inuit organisations — this is likely
to be asked about. A `/privacy/` page is needed before the forms go live. I did
not write one because it is a legal document, not copy.

## 5. Status assignments need per-company sign-off

The existing site had two states, "Active Development" and "Formation Stage". I
mapped them conservatively onto your three-value enum:

| Company | Status assigned | Basis |
|---|---|---|
| ArcTrek Expeditions | `development` | Brief: first subsidiary, targets summer 2027 |
| The other six | `planned` | Mapped from "Formation Stage" |

**Nothing is at `concept`** — so the filter's Concept option renders disabled
with a count of zero. That is honest given the data, but the brief implies a
mix. If some of the six are really only concepts, downgrade them: it is the
safer direction, and it makes the portfolio read as more credible rather than
less.

## 6. John Jay Evic has no copy

Named in the brief as one of two reviewed individuals, but no biography was
supplied. Held at `src/content/people/john-jay-evic.md` with `draft: true`, so
he does not publish. Add the reviewed copy and set `draft: false`.

Conversely, **Eva Natsiapik and Miali Aliqatuqtuq** appear on the current live
site but not in your brief. They are published here. Confirm that is right — the
brief's "two named individuals" suggests it may not be.

## 7. Empty collections

These render honestly when empty, so nothing is broken — but each is a hole:

| Collection | State | Effect on the site |
|---|---|---|
| `roles/` | empty | Careers page says "0 open positions" — accurate |
| `procurement/` | empty | The procurement categories table is hidden entirely |
| `faq/` | empty | The FAQ accordion is hidden entirely |
| `news/` | empty | Updates page says "No updates have been published yet" |

The procurement and FAQ sections are the two worth filling first: they are what
a procurement officer actually came for, and the page is thin without them.

## 8. Environmental monitoring has no company

The brief lists eight sectors; there are seven subsidiaries. **Environmental
monitoring** is listed on the home page as in-scope but has no company behind it.
Either add one (at `concept`, presumably) or remove the sector from the list.

## 9. Configuration

`origin` and `base` are set for the current Pages URL
(https://atoms-apple.github.io/NWPH/). The rest still needs attention.

In `src/data/site.mjs`:

| Setting | Current | Action |
|---|---|---|
| `origin` | `https://atoms-apple.github.io` | Set for the Pages project URL. Change with `base` if moving to nwph.ca |
| `base` | `'/NWPH'` | Set for the Pages project subpath. Becomes `''` on a custom domain |
| `email` | `info@nwph.ca` | Confirm this mailbox exists and is monitored |
| `formEndpoint` | `null` | Forms show an email fallback until this is set |
| `founded` | `'2025'` | Currently unused by any template — confirm or delete |

Also: `npm run fetch-fonts` has not been run, so no webfonts are committed and
the site renders on fallbacks.

## 10. Smaller items

- **No Open Graph image.** Link previews will be text-only. A 1200×630 image
  would help, but only if it does not imply operations that do not exist — a
  wordmark on navy would be safest.
- **Favicon is a placeholder** — a generated "N" wordmark on navy
  (`build.mjs` → `favicon()`). Replace with real brand artwork.
- **Subsidiary detail pages are thin.** Each has only the card summary plus a
  facts table. That is honest for pre-operational companies, but ArcTrek at
  least could carry more, since it is furthest along.
- **The 2027 target** comes from the brief alone and appears in three places.
  Confirm it is still right before publishing a date funders will hold you to.
- **North Winds' summary references the Qikiqtani Region** while other copy is
  territory-wide. Inherited from existing copy; harmonise if that is wrong.
- **No Inuktitut anywhere.** The previous site used syllabics decoratively. If
  Inuktitut content is wanted, it needs `lang="iu"` markup and a real
  translation, not decorative text.
