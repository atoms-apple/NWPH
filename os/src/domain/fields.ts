/**
 * Field definitions drive both server-side validation and form rendering, so
 * the rules a user sees in a form are exactly the rules the server enforces.
 * Nothing submitted is trusted because it came from the application's own UI.
 */
import { get } from '../db/database.ts';
import { parseMoney, CURRENCIES } from '../lib/money.ts';
import { isValidDate } from '../lib/time.ts';
import type { Option } from './vocabulary.ts';
import type { FormInput } from '../http/context.ts';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'date'
  | 'money'
  | 'currency'
  | 'url'
  | 'integer'
  | 'ref'
  | 'tags';

/** Referenceable record kinds and the table that holds them. */
export const REF_TABLES = {
  venture: 'ventures',
  project: 'projects',
  milestone: 'milestones',
  task: 'tasks',
  decision: 'decisions',
  document: 'documents',
  opportunity: 'opportunities',
  scenario: 'financial_scenarios',
  stage: 'development_stages',
} as const;
export type RefKind = keyof typeof REF_TABLES;

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Max characters for text; max value for integer. */
  max?: number;
  min?: number;
  /** Fixed choices for select. Strings become value = label. */
  options?: ReadonlyArray<Option | string>;
  /** Allow a value outside `options` (category lists that users may extend). */
  freeform?: boolean;
  ref?: RefKind;
  /** Label for the empty choice of an optional select/ref. */
  emptyLabel?: string;
  help?: string;
  placeholder?: string;
  rows?: number;
  wide?: boolean;
}

export type Values = Record<string, string | number | string[] | null>;
export type Errors = Record<string, string>;

export const optionList = (options: ReadonlyArray<Option | string> = []): Option[] =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

const DEFAULT_TEXT_MAX = 200;
const DEFAULT_TEXTAREA_MAX = 20_000;

/** Validate and coerce one field. Returns [value, error]. */
function parseField(field: Field, rawValue: string, input: FormInput): [Values[string], string | null] {
  const value = rawValue.trim();
  if (field.type === 'tags') {
    const tags = [
      ...new Set(
        input
          .get(field.name)
          .split(',')
          .map((t) => t.trim().replace(/\s+/g, ' '))
          .filter(Boolean),
      ),
    ];
    if (tags.some((t) => t.length > 40)) return [tags, 'Each tag must be 40 characters or fewer.'];
    if (tags.length > 20) return [tags, 'Use at most 20 tags.'];
    return [tags, null];
  }

  if (!value) return [null, field.required ? `${field.label} is required.` : null];

  switch (field.type) {
    case 'text':
    case 'textarea': {
      const max = field.max ?? (field.type === 'text' ? DEFAULT_TEXT_MAX : DEFAULT_TEXTAREA_MAX);
      if (value.length > max) return [value, `${field.label} must be ${max.toLocaleString()} characters or fewer.`];
      if (field.min && value.length < field.min) return [value, `${field.label} must be at least ${field.min} characters.`];
      return [field.type === 'textarea' ? rawValue.replace(/\r\n/g, '\n').trim() : value, null];
    }
    case 'select': {
      const allowed = optionList(field.options).map((o) => o.value);
      if (!allowed.includes(value) && !field.freeform) return [value, `Choose a valid ${field.label.toLowerCase()}.`];
      if (value.length > (field.max ?? 80)) return [value, `${field.label} is too long.`];
      return [value, null];
    }
    case 'date':
      return isValidDate(value) ? [value, null] : [value, `${field.label} must be a valid date (YYYY-MM-DD).`];
    case 'money': {
      const minor = parseMoney(value);
      return minor === null
        ? [value, `${field.label} must be a positive amount with at most two decimal places.`]
        : [minor, null];
    }
    case 'currency': {
      const code = value.toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return [value, 'Currency must be a three-letter ISO code such as CAD.'];
      return [code, null];
    }
    case 'url': {
      if (value.length > 2000) return [value, `${field.label} is too long.`];
      try {
        const u = new URL(value);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
        return [u.toString(), null];
      } catch {
        return [value, `${field.label} must be a full http:// or https:// address.`];
      }
    }
    case 'integer': {
      if (!/^-?\d+$/.test(value)) return [value, `${field.label} must be a whole number.`];
      const n = Number(value);
      if (field.min !== undefined && n < field.min) return [value, `${field.label} must be at least ${field.min}.`];
      if (field.max !== undefined && n > field.max) return [value, `${field.label} must be at most ${field.max}.`];
      return [n, null];
    }
    case 'ref': {
      const table = REF_TABLES[field.ref!];
      if (!/^[0-9a-f-]{36}$/i.test(value) || !get(`SELECT 1 FROM ${table} WHERE id = ?`, [value])) {
        return [value, `The selected ${field.label.toLowerCase()} does not exist.`];
      }
      return [value, null];
    }
  }
}

export function parseFields(fields: ReadonlyArray<Field>, input: FormInput): { values: Values; errors: Errors } {
  const values: Values = {};
  const errors: Errors = {};
  for (const field of fields) {
    const [value, error] = parseField(field, input.get(field.name), input);
    values[field.name] = value;
    if (error) errors[field.name] = error;
  }
  return { values, errors };
}

export class ValidationError extends Error {
  readonly errors: Errors;
  constructor(errors: Errors) {
    super('Validation failed');
    this.errors = errors;
  }
}

/** Throw if there are errors. */
export function assertValid(errors: Errors): void {
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

export const currencyField = (name = 'currency'): Field => ({
  name,
  label: 'Currency',
  type: 'currency',
  required: true,
  options: CURRENCIES.map((c) => ({ value: c, label: c })),
});

/** Pick a subset of fields by name, preserving the requested order. */
export function pick(fields: ReadonlyArray<Field>, names: ReadonlyArray<string>): Field[] {
  return names.map((n) => {
    const f = fields.find((x) => x.name === n);
    if (!f) throw new Error(`Unknown field ${n}`);
    return f;
  });
}
