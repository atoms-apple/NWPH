import { html, type SafeHtml } from '../lib/html.ts';
import { all } from '../db/database.ts';
import { isConstraintError } from '../db/database.ts';
import { HttpError, htmlReply, redirect, type Context, type Reply } from '../http/context.ts';
import { parseFields, ValidationError, type Field, type Values, type Errors } from '../domain/fields.ts';
import { ventureOptions, getVentureBySlug, type Venture } from '../domain/ventures.ts';
import { listStages } from '../domain/stages.ts';
import type { Option } from '../domain/vocabulary.ts';
import type { FormValues, RefOptions } from './forms.ts';

export const notFound = (what = 'Page'): never => {
  throw new HttpError(404, `${what} not found.`);
};

/** A same-site return path from ?return= or a _return form field. */
export function returnTo(ctx: Context, fallback: string): string {
  const r = (ctx.method === 'POST' ? ctx.form?.get('_return') : '') || ctx.query.get('return') || '';
  return r.startsWith('/') && !r.startsWith('//') && !r.startsWith('/\\') ? r : fallback;
}

/**
 * Standard POST handling: validate → apply → redirect, or re-render the form
 * with errors and the user's input preserved (422).
 */
export function submit(
  ctx: Context,
  fields: ReadonlyArray<Field>,
  apply: (values: Values) => Reply,
  rerender: (values: FormValues, errors: Errors) => string,
): Reply {
  const { values, errors } = parseFields(fields, ctx.form);
  if (Object.keys(errors).length) return htmlReply(rerender(ctx.form.values(), errors), 422);
  try {
    return apply(values);
  } catch (err) {
    if (err instanceof ValidationError) return htmlReply(rerender(ctx.form.values(), err.errors), 422);
    if (isConstraintError(err)) {
      const msg = isConstraintError(err, 'UNIQUE')
        ? 'A record with these details already exists.'
        : isConstraintError(err, 'FOREIGN KEY')
          ? 'A linked record no longer exists. Refresh and try again.'
          : 'The data did not pass a consistency check. Review the values and try again.';
      return htmlReply(rerender(ctx.form.values(), { _: msg }), 422);
    }
    throw err;
  }
}

/** Options for every ref field in a form. Archived records are excluded except the current value. */
export function refOptions(fields: ReadonlyArray<Field>, current: FormValues = {}): RefOptions {
  const out: Record<string, Option[]> = {};
  for (const f of fields) {
    if (f.type !== 'ref') continue;
    const cur = current[f.name] || '';
    switch (f.ref) {
      case 'venture':
        out[f.name] = ventureOptions(cur);
        break;
      case 'stage':
        out[f.name] = listStages().map((s) => ({ value: s.id, label: s.name }));
        break;
      case 'project':
        out[f.name] = all<{ id: string; name: string; vname: string | null }>(
          `SELECT p.id, p.name, v.name AS vname FROM projects p LEFT JOIN ventures v ON v.id = p.venture_id
            WHERE (p.archived_at IS NULL AND (v.id IS NULL OR v.archived_at IS NULL)) OR p.id = ? ORDER BY vname IS NOT NULL, vname COLLATE NOCASE, p.name COLLATE NOCASE`,
          [cur],
        ).map((r) => ({ value: r.id, label: `${r.vname ?? 'NWPH'} — ${r.name}` }));
        break;
      case 'milestone':
        out[f.name] = all<{ id: string; title: string; vname: string | null }>(
          `SELECT m.id, m.title, v.name AS vname FROM milestones m LEFT JOIN ventures v ON v.id = m.venture_id
            WHERE (m.archived_at IS NULL AND m.status <> 'cancelled') OR m.id = ? ORDER BY vname IS NOT NULL, vname COLLATE NOCASE, m.due_date`,
          [cur],
        ).map((r) => ({ value: r.id, label: `${r.vname ?? 'NWPH'} — ${r.title}` }));
        break;
      case 'scenario':
        out[f.name] = all<{ id: string; name: string; vname: string | null }>(
          `SELECT s.id, s.name, v.name AS vname FROM financial_scenarios s LEFT JOIN ventures v ON v.id = s.venture_id
            WHERE s.archived_at IS NULL OR s.id = ? ORDER BY vname, s.name`,
          [cur],
        ).map((r) => ({ value: r.id, label: `${r.vname ?? 'NWPH'} — ${r.name}` }));
        break;
      case 'opportunity':
        out[f.name] = all<{ id: string; title: string }>(
          `SELECT id, title FROM opportunities WHERE archived_at IS NULL OR id = ? ORDER BY title COLLATE NOCASE`,
          [cur],
        ).map((r) => ({ value: r.id, label: r.title }));
        break;
      case 'document':
        out[f.name] = all<{ id: string; title: string }>(
          `SELECT id, title FROM documents WHERE archived_at IS NULL OR id = ? ORDER BY title COLLATE NOCASE`,
          [cur],
        ).map((r) => ({ value: r.id, label: r.title }));
        break;
      case 'decision':
        out[f.name] = all<{ id: string; title: string; proposed_on: string }>(
          `SELECT id, title, proposed_on FROM decisions WHERE archived_at IS NULL OR id = ? ORDER BY proposed_on DESC`,
          [cur],
        ).map((r) => ({ value: r.id, label: `${r.title} (${r.proposed_on})` }));
        break;
      case 'task':
        out[f.name] = all<{ id: string; title: string }>(
          `SELECT id, title FROM tasks WHERE archived_at IS NULL OR id = ? ORDER BY title COLLATE NOCASE`,
          [cur],
        ).map((r) => ({ value: r.id, label: r.title }));
        break;
    }
  }
  return out;
}

/** Prefill a new record from ?venture=<slug>&project=<id>… */
export function prefill(ctx: Context, defaults: FormValues = {}): FormValues {
  const values: FormValues = { ...defaults };
  const slug = ctx.query.get('venture');
  if (slug) {
    const v = getVentureBySlug(slug);
    if (v) values.venture_id = v.id;
  }
  for (const k of ['project', 'milestone', 'opportunity', 'document']) {
    const id = ctx.query.get(k);
    if (id && /^[0-9a-f-]{36}$/i.test(id)) values[`${k}_id`] = id;
  }
  return values;
}

/** Resolve ?venture=<slug> filter on list pages. 'parent' selects parent-level records. */
export function ventureScope(ctx: Context): { ventureId: string | null; scope: 'parent' | null; venture: Venture | null; slug: string } {
  const slug = ctx.query.get('venture') ?? '';
  if (slug === 'parent') return { ventureId: null, scope: 'parent', venture: null, slug };
  if (!slug) return { ventureId: null, scope: null, venture: null, slug };
  const v = getVentureBySlug(slug);
  return { ventureId: v?.id ?? '00000000-0000-0000-0000-000000000000', scope: null, venture: v ?? null, slug };
}

export function ventureFilterOptions(): Option[] {
  return [
    { value: 'parent', label: 'NWPH (parent organization)' },
    ...all<{ slug: string; name: string }>(`SELECT slug, name FROM ventures WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE`).map((v) => ({
      value: v.slug,
      label: v.name,
    })),
  ];
}

/** Hidden field carrying the page to return to after a POST. */
export const returnField = (path: string): SafeHtml => html`<input type="hidden" name="_return" value="${path}">`;

export const currentPath = (ctx: Context): string => ctx.url.pathname + ctx.url.search;

export function archiveReply(ctx: Context, archived: boolean, label: string, fallback: string): Reply {
  ctx.flash('success', `${label} ${archived ? 'archived. It is hidden from lists and summaries and can be restored at any time.' : 'restored.'}`);
  return redirect(returnTo(ctx, fallback));
}

export const UUID_RE = /^[0-9a-f-]{36}$/i;
