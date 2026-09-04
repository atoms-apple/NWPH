/**
 * A tiny schema validator.
 *
 * The point of this file is the `enumOf` validator. Subsidiary status is the
 * single most load-bearing field on this site: it is what stops the company
 * from appearing to be operating when it is not. A typo in a content file must
 * fail the build, not render.
 */

export class ValidationError extends Error {
  constructor(issues) {
    super(`Content validation failed:\n${issues.map((issue) => `  • ${issue}`).join('\n')}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

const typeName = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

export const string = ({ min = 0, max = Infinity, optional = false } = {}) => (value, path, issues) => {
  if (value === undefined || value === null) {
    if (!optional) issues.push(`${path} is required`);
    return optional ? undefined : '';
  }
  if (typeof value !== 'string') { issues.push(`${path} must be a string, got ${typeName(value)}`); return ''; }
  if (value.length < min) issues.push(`${path} must be at least ${min} characters`);
  if (value.length > max) issues.push(`${path} must be at most ${max} characters (got ${value.length})`);
  return value;
};

export const number = ({ optional = false, integer = false } = {}) => (value, path, issues) => {
  if (value === undefined || value === null) {
    if (!optional) issues.push(`${path} is required`);
    return undefined;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) { issues.push(`${path} must be a number`); return undefined; }
  if (integer && !Number.isInteger(value)) issues.push(`${path} must be a whole number`);
  return value;
};

export const boolean = ({ fallback = false } = {}) => (value, path, issues) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') { issues.push(`${path} must be true or false`); return fallback; }
  return value;
};

export const enumOf = (allowed, { optional = false } = {}) => (value, path, issues) => {
  if (value === undefined || value === null) {
    if (!optional) issues.push(`${path} is required and must be one of: ${allowed.join(' | ')}`);
    return undefined;
  }
  if (!allowed.includes(value)) {
    issues.push(`${path} must be one of: ${allowed.join(' | ')} — got ${JSON.stringify(value)}`);
    return undefined;
  }
  return value;
};

export const arrayOf = (item, { min = 0, optional = false } = {}) => (value, path, issues) => {
  if (value === undefined || value === null) {
    if (!optional && min > 0) issues.push(`${path} is required`);
    return [];
  }
  if (!Array.isArray(value)) { issues.push(`${path} must be a list, got ${typeName(value)}`); return []; }
  if (value.length < min) issues.push(`${path} must have at least ${min} item(s)`);
  return value.map((entry, index) => item(entry, `${path}[${index}]`, issues));
};

export const isoDate = ({ optional = false } = {}) => (value, path, issues) => {
  if (value === undefined || value === null) {
    if (!optional) issues.push(`${path} is required (YYYY-MM-DD)`);
    return undefined;
  }
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    issues.push(`${path} must be a valid date as YYYY-MM-DD — got ${JSON.stringify(value)}`);
    return undefined;
  }
  return text;
};

/** Build an object validator. Unknown keys are reported, never silently kept. */
export const object = (shape) => (value, path, issues) => {
  if (value === undefined || value === null || typeName(value) !== 'object') {
    issues.push(`${path} must be an object`);
    return {};
  }
  const result = {};
  for (const [key, validator] of Object.entries(shape)) {
    result[key] = validator(value[key], `${path}.${key}`, issues);
  }
  for (const key of Object.keys(value)) {
    if (!(key in shape)) issues.push(`${path}.${key} is not a recognised field`);
  }
  return result;
};

/** Run a validator, throwing with every issue collected rather than the first. */
export function validate(validator, value, path) {
  const issues = [];
  const result = validator(value, path, issues);
  if (issues.length) throw new ValidationError(issues);
  return result;
}
