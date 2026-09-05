# Future-state model — NWPH at 25 years

This branch renders North West Passage Holdings Corporation as it could look
once operating: twenty-five years in, seven trading subsidiaries, a board and
executive, 214 staff, a job board, a news record and a reporting archive.

**It is a vision model, not a record.** NWPH is currently pre-incorporation.
None of this has happened. Every page says so in a banner.

Published at `/NWPH/demo/`. The factual site is on `main`, at `/NWPH/`.

## Why the figures are concrete

An earlier version rendered every number as `XX`. That defeats the purpose — a
stat strip full of Xs shows nothing, and the point of this branch is to be
looked at.

Figures are therefore illustrative but concrete, and defined once in
`demo.figures` in `src/data/site.mjs` so they stay consistent across the site.
Change them there and every page follows.

## Why the names look like that

People use the standard legal fictitious-person names — **Doe, Roe, Major,
Stiles**.

Nunavut has roughly 40,000 residents. A plausibly-generated Inuit name has a
real chance of matching an actual person, who would then appear on a public
website as a director or managing director of a company they have never heard
of. Doe and Roe cannot be mistaken for anyone.

Adam Aliqatuqtuq's biography is his real reviewed copy; his role and appointment
date on this branch are not.

## What is here

| | |
|---|---|
| Pages | 45 |
| Companies | 7 named, all trading, each with leadership, openings and news |
| Job board | 12 postings with full detail pages, salary bands and references |
| News | 10 entries, including the 2024 subsidiary wind-up |
| Reports | 8 documents across 5 years |
| Board | 6 directors, 3 independent, 3 committees |
| Executive | 5 officers |
| Subsidiary management | 7 managing directors |

Pages: home, about, governance, leadership, history, portfolio + 7 company
pages, careers + 12 role pages, community, news + 10 entries, procurement,
reports, contact, privacy, accessibility, thank-you, 404.

## Guards

- Every page carries the banner naming it an illustrative future-state model.
- Every page is `noindex, nofollow`, and `robots.txt` disallows the path.
- The deploy workflow **fails** if any demo page is missing either.

## Returning to the factual site

Set `demo.enabled` to `false` in `src/data/site.mjs`, or use `main`.
