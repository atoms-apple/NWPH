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

## 3. "Ltd." on ArcTrek, which is not incorporated

Six of the seven ventures are now published by sector only, which removed this
problem for all of them — including NunaBank, where "bank" is a restricted term
in Canadian financial legislation and would have needed checking before
publication.

**One case remains.** ArcTrek is published as `ArcTrek Expeditions Ltd.`, and
the site states plainly on that page that it is not incorporated. Presenting an
unincorporated venture under a limited-company name is still worth legal advice.
Options: drop the suffix until incorporation, or label it "proposed name".

## 4. A footer disclaimer now appears site-wide — check the wording

Every page now carries: *"North West Passage Holdings Corporation is not yet
incorporated. Nothing on this site constitutes an offer of securities, a
solicitation of investment, an offer to sell goods or services, or an offer of
employment."*

I wrote that as a sensible default for a pre-incorporation company with a
funder-facing site. **It is legal wording and I am not your lawyer** — have it
reviewed, particularly the securities language, which is the part most likely to
matter if you approach investors.

## 5. The privacy notice is now published — check it

There is now a privacy notice at `/privacy/`. It is accurate about what the site
does: no cookies, no analytics, no third-party embeds, and only what you type
into a form. It explains why the career form asks about beneficiary status and
that the question is optional.

Two parts still need you:

- **Retention** currently says submissions "reach a mailbox and stay there",
  because that is true and vague is better than false. Make it specific once the
  forms are connected.
- It has **not been reviewed by a lawyer**, and neither has the site-wide footer
  disclaimer. Both are mine.

The underlying concern stands: the career expression of interest form collects
Nunavut Inuit beneficiary status, which is personal information about a
protected characteristic.

The career expression-of-interest form asks whether someone is a **Nunavut Inuit
beneficiary**. That is personal information collected for a stated purpose
(Inuit employment preference), and there is currently:

- no privacy policy page
- no statement of how long submissions are kept, or who sees them
- no lawful-basis statement

Given the audience — government funders and Inuit organisations — this is likely
to be asked about. A `/privacy/` page is needed before the forms go live. I did
not write one because it is a legal document, not copy.

## 6. Status assignments need per-venture sign-off

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

## 7. Adam Aliqatuqtuq is the only named individual

**Eva Natsiapik and Miali Aliqatuqtuq were removed** at your request — from the
site, and from the archived mockup, which carried their biographies and sat in a
public repository. Both files are recoverable from git history if that was not
the intent. Note that you asked for "Mary Aliqatuqtuq"; the entry was for
**Miali** Aliqatuqtuq, and that is who was removed.

**John Jay Evic** is named in the original brief as one of two reviewed
individuals, but no biography was ever supplied. He is held at
`src/content/people/john-jay-evic.md` with `draft: true`, so he does not
publish. Add the reviewed copy and set `draft: false`.

That leaves Adam Aliqatuqtuq as the only published individual, and the page now
presents him as sole founder rather than as one card in a grid. His biography is
unchanged from the reviewed copy. The section states plainly that there is no
board and that directors will be named at incorporation — **worth confirming**,
since a one-person leadership page is a question funders will ask about.

## 8. Empty collections

These render honestly when empty, so nothing is broken — but each is a hole:

| Collection | State | Effect on the site |
|---|---|---|
| `roles/` | empty | Careers page says "0 open positions" — accurate |
| `procurement/` | empty | The procurement categories table is hidden entirely |
| `faq/` | empty | The FAQ accordion is hidden entirely |
| `news/` | empty | Updates page says "No updates have been published yet" |

The procurement and FAQ sections are the two worth filling first: they are what
a procurement officer actually came for, and the page is thin without them.

## 9. Environmental monitoring is no longer mentioned

Your brief listed eight sectors. The portfolio has seven ventures, and since
sectors are now derived from the ventures themselves, **environmental
monitoring has dropped off the site entirely**.

If it belongs in the mandate, add a venture file for it — most likely at
`concept`, which would also give the Concept filter something to show, since it
currently renders disabled at zero.

## 10. Configuration

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

## 11. The sector assessments are mine and need checking

Six sector pages now carry substantive assessments — the gap, what a venture
there would require, why it is not first, and status. They contain **no
statistics and no invented metrics**, but they do make factual claims about
regulatory and operating requirements that someone should verify:

| Page | Claims worth checking |
|---|---|
| Aviation | Air Operator Certificate from Transport Canada; operational control, maintenance and SMS requirements; gravel-strip aircraft suitability |
| Marine freight | Lightering and barge landing at communities without deep-water port; marine crew certification; seasonal risk concentration |
| Financial services | That **"bank" is a restricted term under federal legislation** and unavailable to a non-chartered entity; territorial lending registration; AML and consumer protection obligations |
| Real estate | Land tenure categories — municipal lots, Inuit Owned Land, Commissioner's land — and that each has a distinct process |
| Retail | That inventory must be bought and shipped ahead of sealift and carried until sold |
| Technology | That the binding constraint is a resident trained workforce rather than capital |

These are written as NWPH's assessment of each sector. They read as considered
corporate positions, so an error in one is an error attributed to the
corporation, not to a website.

**Also mine:** the governance framework at `/about/governance/` — intended board
composition, the conflict-of-interest disclose-and-recuse approach, and the
holding company reserving only capital, senior appointments and whether a
venture continues. Every part of it is labelled as intended rather than
established, but it is a proposal you are publishing under your own name.

**Corrected before publication:** an earlier draft of the reporting page listed a
business plan as available on request. No one told me a business plan exists, so
that row now reads "Not published". If one does exist, change it.

## 12. Copy I authored that needs your sign-off

Expanding the mission and the ArcTrek page meant writing prose that did not
exist anywhere. None of it asserts a metric, a partnership or a credential, but
several passages put reasoning in NWPH's mouth. Read these specifically:

**"Why this one first" (ArcTrek page).** Five reasons tourism was chosen ahead of
the others — existing capability, lowest barrier to entry, capital requirement is
equipment rather than fleet, seasonality, and cheap failure. This is a
reconstruction of a plausible rationale, not something you told me. If the real
reason is different, this is the passage to rewrite.

**The nine milestones.** My reconstruction of what stands between ArcTrek and a
first paying season: incorporation, financing, licensing, insurance, guide
certification, equipment, community consultation, route development, trial
season. Deliberately non-specific about which statute or authority governs each
one, because I did not want to name a licensing regime I could not verify.
**Someone who knows Nunavut outfitting requirements should check the sequence is
complete and correctly ordered.** Note also that no step carries a `state`, so
the page claims no progress at all — accurate given pre-incorporation, but you
may want to mark the ones genuinely underway.

**"The premise" (About page).** That money largely flows to companies
headquartered outside the territory, and that Nunavummiut participate as
customers and employees rather than owners. Written as NWPH's premise rather
than as fact, and carries no figures, precisely because I have no data to cite.
If you want it stated as fact, it needs a source.

**"What NWPH will not do" (About page).** Five commitments — no company named
before incorporation, nothing sold that does not exist, Inuit ownership is not a
substitute for a working business, no sector entered because funding exists for
it, no number published that cannot be stood behind. These are binding
statements about conduct. The site now argues against itself if any is broken.

**"One at a time" (About page).** That ventures will be sequenced rather than
launched together, funded by earlier trading companies. A strategic commitment,
stated as settled.

## 13. Smaller items

- **No Open Graph image.** Link previews will be text-only. A 1200×630 image
  would help, but only if it does not imply operations that do not exist — a
  wordmark on navy would be safest.
- **The mark is mine, not a brand asset.** A north chevron above the line of the
  passage, drawn as inline SVG in `src/components/logo.mjs` and reused for the
  header, footer and favicon. Replace it with real brand artwork when you have
  it — one file, three places update.
- **Subsidiary detail pages are thin.** Each has only the card summary plus a
  facts table. That is honest for pre-operational companies, but ArcTrek at
  least could carry more, since it is furthest along.
- **The 2027 target** comes from the brief alone and now appears in several
  places, including alongside the statement that financing is the step most
  likely to move it. Confirm it before publishing a date funders will hold you to.
- **Vocabulary.** The site says "ventures" rather than "subsidiaries" in every
  count, because nothing is incorporated and so nothing is yet a subsidiary of
  anything. The nav label and the `/subsidiaries/` URL were left unchanged.
- **No Inuktitut anywhere.** The previous site used syllabics decoratively. If
  Inuktitut content is wanted, it needs `lang="iu"` markup and a real
  translation, not decorative text.
