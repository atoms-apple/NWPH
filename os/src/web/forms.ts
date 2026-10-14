/**
 * Form rendering from the same Field definitions the server validates with.
 * Forms are ordinary POST forms: they work without JavaScript and re-render
 * with inline messages (and the user's input preserved) on validation errors.
 */
import { html, attrs, cx, type SafeHtml } from '../lib/html.ts';
import { moneyInput } from '../lib/money.ts';
import type { Context } from '../http/context.ts';
import type { Field, Errors } from '../domain/fields.ts';
import { optionList } from '../domain/fields.ts';
import type { Option } from '../domain/vocabulary.ts';
import { notice } from './ui.ts';

export type FormValues = Record<string, string>;
export type RefOptions = Record<string, ReadonlyArray<Option>>;

/** Convert a database row into form strings (money → decimal, arrays → CSV). */
export function toFormValues(fields: ReadonlyArray<Field>, row: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const v = row[f.name];
    if (v === null || v === undefined) out[f.name] = '';
    else if (f.type === 'money') out[f.name] = moneyInput(Number(v));
    else out[f.name] = String(v);
  }
  return out;
}

function control(f: Field, value: string, error: string | undefined, refs: RefOptions): SafeHtml {
  const id = `f-${f.name}`;
  const described = [f.help ? `${id}-help` : null, error ? `${id}-err` : null].filter(Boolean).join(' ') || null;
  const common = { id, name: f.name, 'aria-describedby': described, 'aria-invalid': error ? 'true' : null, required: f.required };

  switch (f.type) {
    case 'textarea':
      return html`<textarea${attrs({ ...common, rows: f.rows ?? 4, maxlength: f.max, placeholder: f.placeholder })}>${value}</textarea>`;
    case 'select':
    case 'ref': {
      let options = f.type === 'ref' ? [...(refs[f.name] ?? [])] : optionList(f.options);
      // Preserve a stored freeform value that is not in the standard list.
      if (value && f.freeform && !options.some((o) => o.value === value)) options = [...options, { value, label: value }];
      const empty = !f.required || f.type === 'ref' ? html`<option value="">${f.emptyLabel ?? '—'}</option>` : f.required && !value ? html`<option value="" disabled selected>Choose…</option>` : '';
      return html`<select${attrs(common)}>
        ${empty}
        ${options.map((o) => html`<option value="${o.value}"${attrs({ selected: o.value === value })}>${o.label}</option>`)}
      </select>`;
    }
    case 'date':
      return html`<input type="date"${attrs({ ...common, value })}>`;
    case 'money':
      return html`<input type="text" inputmode="decimal" autocomplete="off"${attrs({ ...common, value, placeholder: f.placeholder ?? '0.00', pattern: '[0-9,\\s$]*(\\.[0-9]{1,2})?' })}>`;
    case 'currency':
      return html`<input type="text" list="currency-list" autocapitalize="characters" maxlength="3"${attrs({ ...common, value: value || 'CAD', pattern: '[A-Za-z]{3}' })}>
        <datalist id="currency-list">${optionList(f.options).map((o) => html`<option value="${o.value}"></option>`)}</datalist>`;
    case 'url':
      return html`<input type="url" inputmode="url"${attrs({ ...common, value, placeholder: f.placeholder ?? 'https://' })}>`;
    case 'integer':
      return html`<input type="number" step="1"${attrs({ ...common, value, min: f.min, max: f.max })}>`;
    case 'tags':
      return html`<input type="text"${attrs({ ...common, value, placeholder: f.placeholder ?? 'e.g. freight, Iqaluit, 2026' })}>`;
    default:
      return html`<input type="text"${attrs({ ...common, value, maxlength: f.max, placeholder: f.placeholder })}>`;
  }
}

export function fieldRow(f: Field, values: FormValues, errors: Errors, refs: RefOptions, extra?: SafeHtml): SafeHtml {
  const error = errors[f.name];
  const id = `f-${f.name}`;
  return html`<div class="${cx('field', f.wide && 'field--wide', error && 'field--error')}">
    <label for="${id}">${f.label}${f.required ? html` <span class="req" aria-hidden="true">*</span>` : ''}</label>
    ${control(f, values[f.name] ?? '', error, refs)}
    ${f.help ? html`<p class="field__help" id="${id}-help">${f.help}</p>` : ''}
    ${error ? html`<p class="field__error" id="${id}-err">${error}</p>` : ''}
    ${extra ?? ''}
  </div>`;
}

export function errorSummary(errors: Errors, fields: ReadonlyArray<Field>): SafeHtml | '' {
  const keys = Object.keys(errors);
  if (!keys.length) return '';
  return notice(
    'error',
    html`<ul>${keys.map((k) => {
      const f = fields.find((x) => x.name === k);
      return html`<li>${f ? html`<a href="#f-${k}">${errors[k]}</a>` : errors[k]}</li>`;
    })}</ul>`,
    keys.length === 1 ? 'There is a problem with this form' : `There are ${keys.length} problems with this form`,
  );
}

export interface FormOptions {
  action: string;
  fields: ReadonlyArray<Field>;
  values: FormValues;
  errors?: Errors;
  refs?: RefOptions;
  submitLabel: string;
  cancelHref?: string;
  multipart?: boolean;
  /** Extra markup per field (e.g. provisional checkboxes), keyed by field name. */
  fieldExtras?: Record<string, SafeHtml>;
  before?: SafeHtml | null;
  after?: SafeHtml | null;
  hidden?: Record<string, string>;
}

export function renderForm(ctx: Context, o: FormOptions): SafeHtml {
  const errors = o.errors ?? {};
  return html`<form method="post" action="${o.action}" class="form" novalidate${attrs({ enctype: o.multipart ? 'multipart/form-data' : null })}>
    <input type="hidden" name="_csrf" value="${ctx.csrf}">
    ${Object.entries(o.hidden ?? {}).map(([k, v]) => html`<input type="hidden" name="${k}" value="${v}">`)}
    ${errorSummary(errors, o.fields)}
    ${errors._ ? notice('error', errors._) : ''}
    ${o.before ?? ''}
    <div class="form__grid">
      ${o.fields.map((f) => fieldRow(f, o.values, errors, o.refs ?? {}, o.fieldExtras?.[f.name]))}
    </div>
    ${o.after ?? ''}
    <div class="form__actions">
      <button type="submit" class="btn btn--primary">${o.submitLabel}</button>
      ${o.cancelHref ? html`<a class="btn btn--ghost" href="${o.cancelHref}">Cancel</a>` : ''}
    </div>
  </form>`;
}
