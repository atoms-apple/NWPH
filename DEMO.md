# Demonstration build — NWPH at 25 years

**This branch is not true.** It renders North West Passage Holdings Corporation
as a 25-year-old operating corporation with seven trading subsidiaries, a board,
an executive team and a corporate history.

In reality NWPH is pre-incorporation: no subsidiaries trade, there is no board,
there are no executives, and there is no operating history. The factual site
lives on `main` and is what is deployed.

## Do not deploy this branch

There is no workflow guard preventing it, so this is a convention, not a lock.
If it is deployed:

- Every page carries a red **Demonstration build** banner naming it as
  illustrative.
- Every page is `noindex, nofollow`, so search engines will not index it.

Both are one commit away from removal. Neither should be removed.

## Why the names look like that

People are the standard legal fictitious-person names — **Doe, Roe, Major,
Stiles**. This is deliberate.

Nunavut has roughly 40,000 residents. A plausibly-generated Inuit name has a
real chance of matching an actual person, who would then appear on a public
website as a director or managing director of a company they have never heard
of. Doe and Roe cannot be mistaken for anyone.

Every fabricated biography begins with the word `PLACEHOLDER`. Adam
Aliqatuqtuq's biography is his real reviewed copy; his role and appointment date
on this branch are not.

## Why the figures look like that

Anything that would be a financial or operational fact renders as a visible
placeholder — `$XX.X M`, `XXX` employees, `XX communities` — rather than an
invented number. A fabricated revenue figure in a screenshot outlives the
context that made it a mockup.

## What differs from `main`

| | `main` | this branch |
|---|---|---|
| Status enum | `development \| planned \| concept` | adds `operating` |
| Subsidiaries | 1 named, 6 sector assessments | 7 named, all operating |
| People | 1 founder | 6 directors, 5 executives, 7 managing directors |
| History | none | `/about/history/`, 2001–2026 |
| Leadership | on the about page | `/about/leadership/` |
| Front page | "0 of 7 operating" | 25th anniversary |
| Robots | indexable | `noindex, nofollow` |

## Returning to the factual site

Set `demo.enabled` to `false` in `src/data/site.mjs` to drop the banner and the
noindex, or simply use `main`, which is the real site.
