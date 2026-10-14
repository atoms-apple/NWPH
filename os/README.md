# NWPH OS

Private enterprise management platform for NWPH and its venture portfolio.
Polar Express is configured as the first venture.

NWPH OS is a planning and management tool for an organization that is still
being developed. It does **not** assume NWPH or any venture is incorporated,
funded, staffed or trading. Every fact is user-entered, and the data model keeps
these pairs apart:

- forecasts, budgets, entered actuals and verified actuals
- potential funding and secured funding
- proposals and approved decisions
- development stage, legal status and operational status

> This directory is separate from the public website in the repository root.
> The website is a static GitHub Pages site. NWPH OS is a private server
> application and must never be published to GitHub Pages.

---

## Run it on GitHub (Codespaces)

The quickest way to try NWPH OS is to run it in your browser in a GitHub
Codespace. This needs no installation, and the codespace is private to your
GitHub account.

1. On the repository page, click **Code → Codespaces → Create codespace on main**.
2. Wait for it to build (a few minutes the first time). The database is
   created automatically, and a terminal named **NWPH OS server** starts the
   app.
3. In that terminal, copy the **Setup token** line. A browser tab opens on
   NWPH OS; if it doesn't, open the **Ports** tab and click the globe icon
   next to port 4400.
4. Paste the token into the **Create the first owner account** page and
   choose your email and password. You're in.

Keep in mind:

- **Access:** the forwarded port is **private**, so only your signed-in
  GitHub account can open it. Don't change its visibility to Public.
- **Your data:** it lives in `os/data/` inside the codespace. It survives
  stopping and restarting the codespace, but is **deleted with the
  codespace**. GitHub deletes inactive codespaces after 30 days by default.
  Download anything you need to keep.
- **Cost:** codespaces use your GitHub Codespaces allowance. Personal
  accounts get a free monthly quota; stop the codespace when you're done
  (**Codespaces → Stop**) so it doesn't run down the quota.
- **Restarting the server:** if you close its terminal, open a new one and run
  `cd os && npm start`.
- **Not for production:** Codespaces is meant for trying NWPH OS out, not for
  holding NWPH's real records long-term. See
  [Deployment considerations](#deployment-considerations).

The configuration is in `.devcontainer/devcontainer.json` at the repository
root. It sets `TRUST_PROXY=true` because GitHub's port forwarding is a reverse
proxy (see Configuration).

## Requirements

- **Node.js 22.18 or newer.** Node runs the TypeScript source directly through
  type stripping, so there is no build step.
- Nothing else is needed. Storage uses Node's built-in SQLite (`node:sqlite`), so
  there is no database server to install.

**There are no npm dependencies.** `npm install` has nothing to install. See
[Why no dependencies](#why-no-dependencies).

## Quick start

```bash
cd os
cp .env.example .env          # optional; the defaults suit local development
npm run db:migrate            # creates data/nwph-os.db: NWPH, stages and Polar Express
npm run user:create           # create the first owner account (interactive)
npm start                     # http://127.0.0.1:4400
```

Alternatively, skip `user:create`, run `npm start` and open `/setup`. While no
account exists, the server prints a one-time **setup token** to the console. The
setup page asks for it, so a stranger who reaches the URL first cannot claim the
owner account. You can also set `SETUP_TOKEN` in `.env`.

`npm run dev` restarts the server whenever a source file changes.

Running a command prints `.env not found. Continuing without it.` when you have
no `.env` file. That is expected: every setting has a safe default.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with automatic restart on file changes |
| `npm run db:migrate` | Apply pending migrations and create baseline records (idempotent) |
| `npm run db:reset` | **Deletes** the database and uploads, then re-initialises. Asks you to type `reset`. Refuses to run when `NODE_ENV=production`. |
| `npm run db:examples` | Add clearly-marked `[Example]` records to explore the app |
| `npm run db:examples -- remove` | Permanently remove all example records |
| `npm run user:create` | Create a user (owner, editor or viewer) |
| `npm test` | Run the automated test suite (Node's built-in test runner) |
| `npm run typecheck` | Type-check with `tsc` (needs TypeScript and `@types/node`; see below) |
| `npm run e2e` | Browser check at desktop and iPhone widths (needs Playwright) |

## Configuration

Everything is configured through environment variables, read from `os/.env` when
it exists. `.env` is git-ignored; `.env.example` lists every variable.

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Interface to bind. Keep it local unless the app sits behind a TLS reverse proxy. |
| `PORT` | `4400` | HTTP port |
| `NODE_ENV` | `development` | `production` turns on Secure cookies and blocks `db:reset` |
| `DATABASE_PATH` | `./data/nwph-os.db` | SQLite file (relative to `os/`) |
| `UPLOAD_DIR` | `./data/uploads` | Private file storage, never served statically |
| `MAX_UPLOAD_MB` | `20` | Maximum size of one uploaded file |
| `SESSION_IDLE_HOURS` | `12` | Idle timeout |
| `SESSION_MAX_DAYS` | `7` | Absolute session lifetime |
| `COOKIE_SECURE` | `true` in production | Adds `Secure` to cookies, plus an HSTS header |
| `TRUST_PROXY` | `false` | Behind a reverse proxy you trust (your own, or Codespaces): read `X-Forwarded-For` for login throttling and `X-Forwarded-Host` for the cross-site check. Leave `false` when clients connect directly. |
| `SETUP_TOKEN` | random each start | Token for the first-owner `/setup` page |
| `TZ` | system | Sets which date counts as "today" for overdue checks. `America/Iqaluit` is a sensible value. |

`os/data/` is git-ignored. Never commit the database or uploads.

## Database

- **Engine:** SQLite through `node:sqlite`, in WAL mode with foreign keys enforced.
- **Schema:** `migrations/*.sql`, applied in filename order by
  `src/db/migrate.ts` and recorded in `schema_migrations`. Each migration runs in a
  transaction.
- **Changing the schema:** add a new file such as `migrations/002_add_x.sql`. Never
  edit a migration that has already been applied. Migrations run automatically on
  `npm start` and `npm run db:migrate`.
- **Baseline seed** (`src/db/seed.ts`, runs only on an empty database):
  - the NWPH organization, with legal status *Not verified*
  - the seven default development stages
  - Polar Express at stage *Idea*, legal status *Not established*, operational
    status *Proposed*, with its default text fields marked **provisional**

  No projects, finances, decisions, people or documents are invented.
- **Backups:** copy `nwph-os.db` together with the `uploads/` directory. To get a
  consistent copy while the server is running, use
  `sqlite3 data/nwph-os.db ".backup backup.db"`.
- **Resetting a development database safely:** stop the server, then run
  `npm run db:reset`. It deletes only the files named by `DATABASE_PATH` and
  `UPLOAD_DIR`, and refuses to run when `NODE_ENV=production`.

## Testing

```bash
npm test            # 42 tests: security, workflows, finance rules, persistence
npm run typecheck   # tsc --noEmit
npm run e2e         # real Chromium, desktop 1440px and iPhone 390px
```

The tests start a real server on a random port with a temporary database. They
drive it over HTTP with cookies and CSRF tokens, the same way a browser does.
They cover:

- **Security:**
  - anonymous access and POSTs are refused
  - wrong passwords are rejected and repeated failures are throttled
  - CSRF and cross-origin requests are rejected
  - viewer, editor and owner permissions are enforced on the server
  - sign-out invalidates the session
  - stored text is escaped, and errors don't leak internals
- **Ventures:**
  - create, edit, search, filter and sort
  - stage changes leave legal and operational status untouched
  - archive and restore keep every related record
  - organization edits keep their history
  - stages are configurable
- **Projects:**
  - project → milestone → tasks for Polar Express, with dashboard counts
    following each change
  - venture/project mismatch is rejected
  - dependencies block and unblock work
- **Finance:**
  - no funding gap without both a requirement and funding sources
  - potential funding never counts as secured
  - totals never add across basis or currency
  - only actuals can be verified, only owners can verify, and editing a
    verified amount clears the verification
  - scenarios work, and archived entries leave the summaries
- **Governance, documents, opportunities and risks:**
  - an approved decision needs a decision date, and history keeps
    before/after values
  - document upload, versioning, private download, metadata search, and the
    contents not being searched
  - eligibility must be confirmed with a recorded basis
  - high-band risks appear on the dashboard
  - example data stays away from Polar Express and can be removed
- **Persistence:** records and relationships survive a full restart.
- **Rendering:** every main page renders for all three roles.

**Type checking:** `npm run typecheck` needs `typescript` and `@types/node`. CI
installs them. Locally, run
`npm i --no-save typescript @types/node`, or point `--typeRoots` at an existing
`@types` directory.

**Browser check:** `npm run e2e` needs Playwright and a Chromium build. It
resolves a local or global `playwright`, fails on horizontal overflow or console
errors, and writes screenshots to `test-results/`.

## Users and roles

| Role | Can |
|---|---|
| Owner | Everything, including users, development stages, legal status, verification of financial actuals and documents, and example data |
| Editor | Create, edit and archive business records |
| Viewer | Read everything; change nothing |

Every route declares the permission it needs, and the server checks it before
the handler runs. Hiding buttons in the interface is only a convenience. There
must always be at least one active owner.

There is no email delivery, so invitations and password resets are done by an
owner in Settings or with `npm run user:create`.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). In brief:

```
os/
├── migrations/          SQL schema, versioned
├── src/
│   ├── server.ts        entry: config → database → migrate → seed → listen
│   ├── app.ts           request pipeline: headers, session, route access, CSRF
│   ├── cli.ts           migrate / reset / examples / create-user
│   ├── config.ts        environment variables
│   ├── db/              connection, migration runner, baseline seed
│   ├── auth/            passwords (scrypt), sessions, roles, login throttling
│   ├── http/            context, router, body parsing
│   ├── domain/          business rules and queries, one module per area
│   ├── web/             layout, components, forms, one page module per area
│   └── public/          app.css, app.js (progressive enhancement only)
├── test/                integration tests (node:test)
└── tools/               browser check
```

## Known limitations

- **No external integrations.** Opportunities, funding sources and documents are
  entered by hand. Nothing is imported, scraped or matched automatically.
- **Document search covers metadata only:** titles, descriptions, sources, tags
  and file names. File contents are not read or indexed, and the interface says
  so wherever search appears. Content indexing would add a text-extraction step
  that writes into the existing `documents_fts` table.
- **No email:** no notifications, reminders, invitations or self-service password
  reset.
- **Single instance only.** SQLite and the in-memory login throttle assume one
  server process. Running several instances would need PostgreSQL and a shared
  throttle store.
- **Financial planning is not accounting.** There is no double-entry ledger, tax,
  payroll or bank reconciliation. Amounts are whole cents per currency, and there
  is no currency conversion: each currency is summarised separately.
- **The decision register is not a corporate minute book.** It does not replace
  legally required records or board resolutions.
- **The risk score is ordinal.** Likelihood × impact only places a risk in a
  coarse planning band.
- **No two-factor authentication** and no single sign-on yet.
- **`node:sqlite` is marked experimental in Node 22.** The npm scripts hide its
  warning. The API has been stable in practice. If it changes, only
  `src/db/database.ts` needs updating.
- **No reporting or exports yet** (CSV or PDF). Browser printing is styled.

## Deployment considerations

This is a private internal tool. **Do not expose it to the internet without
TLS.** A minimal production setup:

1. A small Linux VM or container with Node 22.18+, and a persistent volume for
   `os/data/`.
2. `NODE_ENV=production`, `COOKIE_SECURE=true`, `HOST=127.0.0.1`, and
   `TZ=America/Iqaluit`.
3. A reverse proxy (Caddy or nginx) terminating HTTPS, forwarding to
   `127.0.0.1:4400`, with `TRUST_PROXY=true`.
4. A process supervisor (systemd or a container restart policy) running
   `npm start`.
5. Scheduled backups of `nwph-os.db` (use `.backup`) and `uploads/`, stored
   off-machine.
6. Optionally restrict network access (VPN or IP allowlist) on top of
   application login.

Work still needed before handling sensitive production data:

- a third-party security review
- two-factor authentication
- tested backups and restores
- a decision on data residency for NWPH's records

## Why no dependencies

The original brief suggested Next.js, Prisma and PostgreSQL. The development
environment used to build this version could not reach the npm registry (403
from its egress policy). That is the same constraint recorded in
`../docs/STACK.md` for the public website.

Code written against packages that could not be installed could not be run or
tested. So NWPH OS uses only what ships with Node 22:

- HTTP server
- SQLite
- `crypto` (scrypt, random tokens)
- the Fetch API's multipart parser for uploads
- the test runner
- TypeScript type stripping

What was gained:

- every workflow here was tested, not just written
- no supply chain to audit
- nothing to keep upgrading

What was given up:

- a component framework
- an ORM
- hot module reloading

**Moving to PostgreSQL later.** The schema is plain SQL with explicit foreign
keys and CHECK constraints. Data access goes through `src/db/database.ts` and
the domain modules. A migration would port `migrations/001_initial.sql` to
PostgreSQL types, replace that one database module with a `pg` client, and make
the queries async. The business rules, page modules and tests would carry over.
