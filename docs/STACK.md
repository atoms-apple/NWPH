# Stack rationale

**Zero-dependency static site generator: Node built-ins only, no `node_modules`.**

## How this was decided

Astro was the original recommendation and was agreed. It lost to a constraint
discovered during setup, not to a change of mind about its merits.

The npm registry is unreachable from the build environment used to write this
project (403 from the egress policy on a direct request to
`registry.npmjs.org`), and every font CDN is blocked with it. Astro could still
have been *written* — a correct scaffold would build on any normal machine — but
it could not be run, and none of the quality-bar numbers in the brief
(Lighthouse, WCAG 2.2 AA, 320px, print) could have been verified. The choice was
between the preferred tool unverified and a lesser tool measured. Measured won.

## What was kept from the Astro plan

The reason Astro was chosen in the first place was schema validation of the
subsidiary status field, and that survives intact:

```
Build failed — content did not validate.
  • content/subsidiaries/arctrek.md.status must be one of:
    development | planned | concept — got "operating"
```

`src/lib/schema.mjs` is roughly 120 lines and provides the validators this
content model actually needs — `enumOf` being the one that matters. Content is
validated before a single page renders, every issue in a collection is reported
at once rather than one per run, and CI runs the same gate. The honesty
guarantee is structural, exactly as intended.

Also kept: content collections as markdown with frontmatter, componentised
templates, a token-based stylesheet, and zero framework runtime shipped to the
browser.

## What was given up

- **The ecosystem.** No integrations, no image pipeline, no MDX, no plugins. If
  the site later needs image optimisation or i18n, that is real work here and a
  one-line install in Astro.
- **Familiarity.** A new contributor knows Astro. Nobody knows `build.mjs` yet,
  which is why it is commented for a reader rather than for its author.
- **A dev server with hot reload.** `npm run dev` builds and serves; changes
  need a re-run.

`src/lib/` is about 400 lines total: a YAML-subset frontmatter parser, a
markdown subset, the validator, and an escape-by-default HTML templating
helper. That is the honest cost of the trade.

## What was gained

- **The build is verified, not asserted.** Every claim in
  `docs/ACCESSIBILITY.md` was measured against the built output, and the
  keyboard, 320px and JavaScript-disabled behaviour was driven in a real
  browser.
- **Nothing to rot.** No lockfile, no advisories, no upgrade treadmill. For an
  organisation with no developer on staff, a site that still builds untouched in
  three years has genuine value.
- **Nothing to audit.** The supply chain is Node itself.
- **Speed.** The full build is around 60ms.

## Migrating to Astro later

Reasonable if the site grows a CMS, image processing, or more contributors. The
content directory ports directly — Astro content collections read the same
frontmatter, and `content.config.mjs` maps to Zod almost line for line
(`enumOf([...])` → `z.enum([...])`). The stylesheet and `enhance.js` carry over
unchanged. The work is re-expressing `src/components/*.mjs` and `src/pages/*.mjs`
as `.astro` files, which is mechanical.

## Hosting

GitHub Pages, as chosen. It cannot run server-side code, so form submissions go
to a separate endpoint (`tools/form-worker.js`) — see the README. Everything
else about the site is static files with no server requirement.
