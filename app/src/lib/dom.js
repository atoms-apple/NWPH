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
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  phone: '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6.5 3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6 8.5-6"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  accessible: '<circle cx="12" cy="4.5" r="1.8"/><path d="M8 8.5l4 1 4-1"/><path d="M12 9.5V14h4l2 5"/><path d="M12 14a4.5 4.5 0 1 0 2.5 8.2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
  tag: '<path d="M3 11V4h7l11 11-7 7z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  snow: '<path d="M12 2v20M4 7l16 10M20 7L4 17"/><path d="M12 6l2-2M12 6l-2-2M12 18l2 2M12 18l-2 2"/>',
  download: '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 7.8 4 4 0 0 1 19 10.8C19 15.6 12 20 12 20z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
  shield: '<path d="M12 3l8 3v6c0 4.4-3.2 7.9-8 9-4.8-1.1-8-4.6-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-13.6-4.6L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 13.6 4.6L20 15.5"/><path d="M20 20v-4.5h-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 5l4 4"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M17.5 20a6.5 6.5 0 0 0-2.2-4.9"/>',
  anchor: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V20"/><path d="M5 13a7 7 0 0 0 14 0"/><path d="M8.5 11H15.5"/>',
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
