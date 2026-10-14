# NWPH OS architecture

## Principles

1. **Every number traces back to records.** Dashboard and finance figures are
   computed with COUNT or SUM over records each time a page loads. Nothing is
   stored pre-aggregated, and nothing is typed in by hand.
2. **Honesty is structural.** Distinctions the brief requires are enforced by
   the schema, not left to convention:
   - **Figures:**
     - `basis` + `verification_status` on financial entries
     - `funding_status` on funding entries, with a CHECK that only `received`
       can be an actual
   - **Decisions:** an approved decision must carry a decision date.
   - **Opportunities:** eligibility-asserting statuses require a recorded
     `eligibility_basis`.
   - **Ventures:** independent `stage_id`, `legal_status` and
     `operational_status` columns, with no code path that changes one as a
     side effect of another.
3. **One schema for every venture.** Adding a venture adds rows, never tables or
   pages. A venture's workspace is the same module pages, filtered by
   `venture_id`. `venture_id IS NULL` means a parent-organization record.
4. **History is append-only.** Every create, update, status change and
   archive writes an `activity_events` row. Updates store
   `{"field": [before, after]}`, so a change never silently overwrites
   history. Passwords, tokens and session data are never logged.
5. **Archive, don't delete.** Business records have `archived_at`. The only hard
   deletes are of rows flagged `is_example = 1`.

## Request pipeline (`src/app.ts`)

```
request
  → security headers (CSP: self only, no inline script or style; frame-ancestors none; nosniff)
  → /assets/* static files (public, no data)
  → session lookup (cookie token → SHA-256 → sessions row; idle and absolute expiry)
  → route match
  → access check: route.access is 'public' or a Permission, checked against the session's role
  → POST only: Origin must match Host; body parsed with size limits; _csrf must match
  → handler → Reply
  → errors: 401 → redirect to /login; 4xx → plain message; 5xx → generic page with a reference id (details only in server logs)
```

Every route is registered with its required permission
(`router.get(path, 'read', …)`, `router.post(path, 'write', …)`). The
permission table is in `src/auth/permissions.ts`.

## Layers

| Layer | Responsibility | Examples |
|---|---|---|
| `db/` | Connection, transactions, migrations, baseline seed | `tx()`, `migrate()` |
| `domain/` | Business rules, validation beyond field types, queries | `finance.summarize()`, `work.reconcileLinks()` |
| `domain/fields.ts` | Field definitions shared by server validation and form rendering | `parseFields()` |
| `domain/records.ts` | Insert, update-with-diff, archive and activity logging for every entity | `updateRow()` returns changes |
| `web/` | Pages: HTML built with an escape-by-default template tag | `web/pages/*.ts` |
| `auth/` | scrypt hashing, sessions, roles, throttling | |

Pages never write SQL that changes data. All writes go through domain
functions, which log activity.

## Data model

```
organizations ─┬─ development_stages (configurable, ordered)
               └─ ventures ──┬─ venture_stage_changes (history)
                             ├─ projects ─┬─ milestones
                             │            └─ tasks ── (milestone_id)
                             ├─ decisions (superseded_by_id → decisions)
                             ├─ documents ─┬─ document_files (versions)
                             │             └─ document_tags ── tags
                             ├─ opportunities
                             ├─ financial_scenarios
                             ├─ financial_entries → project, scenario, opportunity, document
                             ├─ risks → project
                             └─ dependencies: blocked {project|milestone|task}
                                              on {project|milestone|task|decision|opportunity|external}
users ── sessions
activity_events → (entity_type, entity_id), venture_id
documents_fts (FTS5, metadata only)
```

Relationship rules enforced in `domain/`:

- A task's, milestone's, risk's, document's or financial entry's venture must
  match the venture of its project. The venture is derived from the project when
  one is given; a contradiction is a validation error.
- Moving a project to another venture moves its tasks and milestones with it.
- Scenario entries must belong to the same venture as the scenario.

CHECK constraints in SQL back these rules up: exactly one blocked item and one
prerequisite per dependency, `completed_on` set if and only if status is
completed, valid dates, non-negative amounts, and three-letter currency codes.

## Financial aggregation

`summarize(entries)` groups entries by currency, then by entry type. For each
type it reports four separate cells: forecast, budget, entered actual and
verified actual. These are never added together, which is how double counting
between a budget line and its actual is prevented.

**Funding:**

- **Requirement:** the sum of *budget* requirement entries if any exist,
  otherwise the sum of *forecast* requirement entries. Never both.
- **Secured:** committed plus received.
- **Gap:** requirement minus secured. It is calculated only when both a
  requirement and at least one funding entry exist; otherwise the summary
  states what is missing.
- **Potential and applied funding:** shown separately and never subtracted.

Scenario views are the baseline plus the selected scenario's entries.

## Front end

The front end renders HTML on the server and uses ordinary forms, following
the post-redirect-get pattern with flash messages. It works without
JavaScript. `public/app.js` only adds:

- confirmation dialogs
- selects that submit when changed
- Escape-to-close for the mobile menu

On mobile:

- the sidebar becomes a `<details>` menu
- tables marked `table--stack` turn into labelled cards
- the kanban board scrolls horizontally inside its own container

## Extension points

- **New venture-scoped module:**
  1. Add a table with a `venture_id` column.
  2. Add a domain module that uses `records.ts` helpers.
  3. Add a page module.
  4. Add a tab in `SECTIONS` in `web/pages/ventures.ts`.
- **Integrations** (procurement feeds, calendars) should write through the
  existing domain functions, so validation and history still apply.
- **Document content search:** extract text on upload and add it as a column
  in `documents_fts`.
- **PostgreSQL:** see the README, "Why no dependencies".
