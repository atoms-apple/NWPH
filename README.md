# North West Passage Holdings Corporation — website

Static site for NWPH, an Inuit-owned holding company in Iqaluit, Nunavut.

**The site's central claim is that nothing is operating yet.** That is not a
disclaimer bolted on to marketing copy — it is enforced by the content schema.
Read [The status enum](#the-status-enum) before editing anything.

---

## Requirements

Node 20.6 or newer. **There are no dependencies** — `node_modules` does not
exist and `npm install` has nothing to install. The build uses only Node
built-ins.

## Local development

```bash
npm run dev      # build, then serve at http://localhost:4321
npm run build    # build to dist/
npm run check    # build, then run contrast + accessibility + link checks
npm run serve    # serve an existing dist/
```

`npm run check` is the gate CI uses. Run it before pushing.

---

## The status enum

Every subsidiary has a `status` of exactly one of:

| Value | Renders as | Means |
|---|---|---|
| `development` | In development | Active work: incorporation, licensing, financing or crew |
| `planned` | Planned | Committed to the portfolio, but work has not begun |
| `concept` | Concept | Identified as a gap worth filling. Nothing beyond that |

**There is deliberately no `operating` value.** The "0 currently operating"
figure in the hero, the footer, and on every subsidiary page is *derived* by
counting statuses — it is never typed into a template. Two consequences:

1. The number cannot go stale or be edited into something flattering.
2. Any other value — `launching`, `active`, a typo — **fails the build**:

   ```
   Build failed — content did not validate.
     • content/subsidiaries/arctrek.md.status must be one of:
       development | planned | concept — got "operating"
   ```

Adding a genuinely operating company means editing `src/data/status.mjs` on
purpose, in a reviewed commit. That is the intended friction.

---

## Editing content

All copy lives in `src/content/`. No templates need touching.

```
src/content/
├── subsidiaries/   one file per venture (named or sector-only)
├── milestones/     steps a named venture must complete before trading
├── people/         leadership
├── roles/          open positions (currently empty — this is accurate)
├── procurement/    procurement categories (currently empty)
├── faq/            questions shown on the procurement page
└── news/           updates
```

Each file is markdown with a frontmatter block:

```markdown
---
name: ArcTrek Expeditions
legalName: ArcTrek Expeditions Ltd.
sector: Tourism & Expeditions
status: development
target: Targeting summer 2027
summary: Inuit-guided Arctic adventure tourism delivering land-based experiences…
order: 1
draft: false
---

Body prose appears on the subsidiary's own page.
```

- `summary` is the card text **and** the page's meta description. Keep it under
  400 characters.
- **`name` and `legalName` are optional.** Omit them and the venture publishes by
  sector only, with no detail page and no link — the deliberate treatment for a
  company that is not yet incorporated. Add a name and a detail page appears
  automatically.
- `draft: true` keeps an entry out of the build entirely. The build prints what
  it excluded, so a draft cannot be silently forgotten.
- Empty collections are handled honestly: with no `roles/`, the careers page
  says there are no open positions rather than hiding the section.

Every field is validated. Unknown fields, missing required fields, bad dates and
out-of-range lengths all fail the build with the file and field named.

### Naming a venture

Six of the seven ventures have no `name`. When one incorporates, add `name` and
`legalName` to its file. That single change gives it a card heading, a detail
page at `/subsidiaries/<slug>/`, a link from the index, and a sitemap entry.
Nothing else needs editing.

### Milestones

`src/content/milestones/` holds the steps a named venture must complete before
it can trade, rendered as a numbered sequence on its detail page.

```markdown
---
title: Secure financing for equipment and working capital
venture: ArcTrek Expeditions     # must match the venture's `name` exactly
state: underway                  # optional: not-started | underway | complete
order: 2
draft: false
---
```

`state` is **optional and currently unset on every step**. An unset step renders
as a required step with no progress claimed. Only set it when the state can be
stated accurately — a milestone wrongly marked complete is precisely the kind of
overstatement this site exists to avoid.

### Adding a venture

1. Create `src/content/subsidiaries/<slug>.md` with at least `sector`, `status`,
   `summary`, `order` and `draft`.
2. Run `npm run check`.

The card, the filter counts, the stage table, the portfolio totals and the
sitemap all update from that one file.

---

## Deployment

Pushes to `main` build and deploy to GitHub Pages via
`.github/workflows/deploy.yml`. The workflow runs `node build.mjs` then
`node tools/check.mjs`, so a content or accessibility regression blocks the
deploy. Pull requests build and verify without deploying.

The site is currently configured for the Pages project URL
**https://atoms-apple.github.io/NWPH/** (`src/data/site.mjs`):

```js
origin: 'https://atoms-apple.github.io',
base: '/NWPH',
```

`base` is load-bearing: it prefixes every link, asset and canonical URL. On a
project subpath an empty `base` 404s the entire site.

**To move to the nwph.ca custom domain**, three changes: set `origin` to
`https://nwph.ca`, set `base` to `''`, and add `public/CNAME` containing
`nwph.ca`. Then point the domain's DNS at GitHub Pages and set the custom domain
in the repository's Pages settings.

---

## Forms

Four forms: supplier registration, partnership enquiry, career expression of
interest, and document request.

**GitHub Pages cannot run server-side code**, so the endpoint is external.
`src/data/site.mjs` holds one setting:

```js
export const formEndpoint = null;
```

While it is `null`, the pages render a clearly-labelled email fallback instead
of a form. This is deliberate: a form that silently discards a supplier's
details is worse than no form.

To turn the forms on, deploy the handler in `tools/form-worker.js` and set
`formEndpoint` to its URL:

```bash
npx wrangler deploy tools/form-worker.js
# secrets: MAIL_TO, RESEND_API_KEY
# optional: a KV namespace bound as RATE_LIMIT
```

The handler does the server-side half: schema validation mirroring the client
rules, honeypot, a submission-timing check, an origin allowlist, per-IP rate
limiting, and a redirect allowlist so the `_redirect` field cannot be pointed at
another host. It is a standard `fetch` handler — adapt it to any serverless
platform, or run it on a small Node server if you would rather self-host.

Both success and failure land on real pages (`/thank-you/`), so confirmation
works with JavaScript disabled.

---

## Fonts

Newsreader (display) and Inter (body) are self-hosted. The files are **not** in
this repository yet:

```bash
npm run fetch-fonts   # writes public/fonts/*.woff2 — then commit them
```

Run this once on a machine with network access and commit the result, so
neither the build nor CI needs the network. Until then the site renders on
metric-matched fallbacks (Georgia and system sans) with no layout break and no
invisible text — `font-display: swap` throughout.

---

## Architecture

```
build.mjs              the whole build
src/
├── content/           all editable copy
├── content.config.mjs schemas — the validation gate
├── data/
│   ├── site.mjs       nav, contact, origin, form endpoint
│   └── status.mjs     the status enum (read this before changing statuses)
├── lib/               frontmatter, markdown, schema, html templating
├── components/        ui.mjs, forms.mjs, chrome.mjs
├── layouts/base.mjs   document shell, meta, Open Graph, JSON-LD
├── pages/             one module per route
├── styles/            tokens → base → layout → components → forms → print
└── client/enhance.js  progressive enhancement only
tools/
├── check.mjs          contrast + accessibility + link verification
├── serve.mjs          local preview
├── fetch-fonts.mjs    one-off font download
└── form-worker.js     server-side form handler (deploy separately)
```

HTML is generated through an escape-by-default tagged template (`src/lib/html.mjs`),
so content is escaped unless explicitly wrapped in `raw()`.

### Interactions

Everything works before `enhance.js` loads:

| Feature | Without JavaScript | With JavaScript |
|---|---|---|
| Mobile navigation | native `<details>` disclosure | Escape and outside-click to close |
| Subsidiary filter | CSS `:has()` on radio inputs | live result count announced |
| FAQ accordion | native `<details>` | unchanged |
| Tab group | linked list, all panels visible | ARIA tablist, arrow keys, roving tabindex |
| Forms | normal POST, server validation | inline errors, no reload |

If `:has()` is unsupported the filter shows every card. The failure mode is
always "shows everything", never "shows nothing".

---

## Further reading

- [`docs/STACK.md`](docs/STACK.md) — why this stack
- [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) — audit, fixes, what is outstanding
- [`docs/CONTENT-GAPS.md`](docs/CONTENT-GAPS.md) — **decisions needed before launch**
