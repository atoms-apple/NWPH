/**
 * Rendering.
 *
 * The app builds strings and hands them to the DOM in one assignment per view.
 * With no framework that is both the smallest thing that works and the fastest
 * on the hardware this is aimed at — an older phone on a satellite link, where
 * a 90 KB framework costs more than every screen in this app put together.
 *
 * Two rules make it safe:
 *   1. `html` escapes every interpolation unless it is wrapped in `raw`, so
 *      passenger names and free text cannot become markup.
 *   2. Nothing is ever wired with an inline handler. Views mark buttons with
 *      `data-action` and a single delegated listener dispatches them.
 */

const RAW = Symbol('raw');

export const raw = (value) => ({ [RAW]: true, value: String(value ?? '') });
const isRaw = (v) => Boolean(v && typeof v === 'object' && v[RAW]);

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => (value === null || value === undefined ? '' : String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]));

function resolve(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map(resolve).join('');
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += resolve(values[i]) + strings[i + 1];
  return raw(out);
}

export const render = (value) => (isRaw(value) ? value.value : esc(value));

/** Class list from names and a conditional map. */
export function cx(...parts) {
  const names = [];
  for (const part of parts) {
    if (!part) continue;
    if (typeof part === 'string') names.push(part);
    else for (const [name, on] of Object.entries(part)) if (on) names.push(name);
  }
  return names.join(' ');
}

/** Attributes, skipping anything null, undefined or false. */
export function attrs(map) {
  const parts = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === null || value === undefined || value === false) continue;
    if (value === true) parts.push(esc(key));
    else parts.push(`${esc(key)}="${esc(value)}"`);
  }
  return raw(parts.length ? ` ${parts.join(' ')}` : '');
}

/** Replace an element's contents with rendered markup. */
export function mount(element, content) {
  element.innerHTML = render(content);
  return element;
}

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/**
 * Delegated events.
 *
 * `on(root, 'click', '[data-action="x"]', handler)` survives every re-render,
 * because the listener is on the root and the markup underneath is free to
 * change. Nothing has to be unbound.
 */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

/** Announce something to a screen reader without moving focus. */
export function announce(message) {
  const region = document.getElementById('live-region');
  if (!region) return;
  // Clearing first makes a repeated message announce again.
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 60);
}

/** Icons, inline so a screen with no network still has them. */
const ICONS = {
  plane: '<path d="M2 14l20-8-6 14-3-5-5-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  map: '<path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  forward: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  seat: '<path d="M7 4v9h8"/><path d="M5 13h13a2 2 0 0 1 2 2v5"/><path d="M5 13v7"/>',
  bag: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V5h6v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  warning: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  offline: '<path d="M3 3l18 18"/><path d="M5 12.5a10 10 0 0 1 4-2.4M12 5c2.7 0 5.2 1 7 2.7"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20v.01"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 18h8"/>',
  swap: '<path d="M7 4v14"/><path d="M4 15l3 3 3-3"/><path d="M17 20V6"/><path d="M14 9l3-3 3 3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  star: '<path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6.1-5.3-2.9-5.3 2.9 1.1-6.1L3.4 9.9l6-.8z"/>',
  cargo: '<rect x="3" y="7" width="18" height="12" rx="1"/><path d="M3 11h18M9 7v12"/>',
};

/** An inline SVG icon. Decorative by default; pass a label to name it. */
export function icon(name, { label = null, size = 20, className = '' } = {}) {
  const path = ICONS[name] ?? ICONS.info;
  return html`<svg class="${cx('icon', className)}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    ${label ? raw(`role="img" aria-label="${esc(label)}"`) : raw('aria-hidden="true" focusable="false"')}
  >${raw(path)}</svg>`;
}

export const hasIcon = (name) => name in ICONS;
