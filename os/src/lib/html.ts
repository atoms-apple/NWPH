/**
 * Escape-by-default HTML templating (ported from the public site's
 * src/lib/html.mjs). Interpolations are escaped unless wrapped in `raw()`, so
 * injecting markup is the explicit choice and escaping is the lazy default.
 * Every business record in NWPH OS is user-entered text; this is the main XSS
 * defence and must not be bypassed for record content.
 */

const RAW = Symbol('raw');

export interface SafeHtml {
  readonly [RAW]: true;
  readonly value: string;
}

export type Renderable = SafeHtml | string | number | null | undefined | false | readonly Renderable[];

export const raw = (value: unknown): SafeHtml => ({ [RAW]: true, value: String(value ?? '') });

export const isRaw = (value: unknown): value is SafeHtml =>
  Boolean(value && typeof value === 'object' && (value as Record<symbol, unknown>)[RAW]);

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]!);
}

function resolve(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map(resolve).join('');
  return esc(value);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0]!;
  for (let i = 0; i < values.length; i++) out += resolve(values[i]) + strings[i + 1]!;
  return raw(out);
}

export const render = (value: unknown): string => resolve(value);

/** Build an attribute string, skipping null/undefined/false. */
export function attrs(map: Record<string, unknown>): SafeHtml {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === null || value === undefined || value === false) continue;
    if (value === true) parts.push(esc(key));
    else parts.push(`${esc(key)}="${esc(value)}"`);
  }
  return raw(parts.length ? ' ' + parts.join(' ') : '');
}

export const cx = (...names: unknown[]): string => names.filter(Boolean).join(' ');

/** Plain text with line breaks preserved as paragraphs. Still fully escaped. */
export function paragraphs(text: string | null | undefined): SafeHtml {
  if (!text || !text.trim()) return raw('');
  return raw(
    text
      .trim()
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join(''),
  );
}
