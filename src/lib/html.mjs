/**
 * Escape-by-default HTML templating.
 *
 * Interpolations into the `html` tagged template are escaped unless they are
 * wrapped in `raw()`. This makes injection the explicit choice rather than the
 * accidental default — content comes from markdown files that may contain
 * anything, so the safe direction has to be the lazy one.
 */

const RAW = Symbol('raw');

export const raw = (value) => ({ [RAW]: true, value: String(value ?? '') });
export const isRaw = (value) => Boolean(value && typeof value === 'object' && value[RAW]);

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

function resolve(value) {
  if (value === null || value === undefined || value === false) return '';
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map(resolve).join('');
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += resolve(values[i]) + strings[i + 1];
  return raw(out);
}

/** Render a tagged-template result (or plain string) to a final string. */
export const render = (value) => (isRaw(value) ? value.value : esc(value));

/** Build an attribute string, skipping null/undefined/false. */
export function attrs(map) {
  const parts = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === null || value === undefined || value === false) continue;
    if (value === true) parts.push(esc(key));
    else parts.push(`${esc(key)}="${esc(value)}"`);
  }
  return raw(parts.length ? ' ' + parts.join(' ') : '');
}

/** Join a list of class names, dropping falsy entries. */
export const cx = (...names) => names.filter(Boolean).join(' ');
