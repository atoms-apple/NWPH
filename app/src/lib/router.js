/**
 * Hash routing.
 *
 * The hash rather than the History API because this ships as static files on a
 * path that may move — a subdirectory today, a domain later — and a hash route
 * needs no server rewrite to survive a refresh or a shared link.
 *
 * Routes are patterns with ':name' segments. First match wins, so order them
 * specific to general.
 */

const routes = [];

/** Register a route. `render` returns markup; `title` names the screen. */
export function route(pattern, render, options = {}) {
  const parts = pattern.split('/').filter(Boolean);
  routes.push({ pattern, parts, render, ...options });
}

function match(path) {
  const segments = path.split('/').filter(Boolean);
  for (const candidate of routes) {
    if (candidate.parts.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < candidate.parts.length; i++) {
      const part = candidate.parts[i];
      if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(segments[i]);
      else if (part !== segments[i]) { ok = false; break; }
    }
    if (ok) return { route: candidate, params };
  }
  return null;
}

/** Split '#/book/results?sort=price' into a path and a query object. */
export function parseHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, queryString = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryString));
  return { path: path || '/', query };
}

export function resolve(hash = window.location.hash) {
  const { path, query } = parseHash(hash);
  const found = match(path);
  return found ? { ...found, path, query } : { route: null, params: {}, path, query };
}

/** Navigate. `replace` avoids stacking history for redirects. */
export function go(path, { replace = false } = {}) {
  const target = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export const back = () => window.history.back();

/** Build a hash href with a query string. */
export function href(path, query = {}) {
  const entries = Object.entries(query).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const qs = entries.length ? `?${new URLSearchParams(entries)}` : '';
  return `#${path}${qs}`;
}

export function start(onNavigate) {
  window.addEventListener('hashchange', () => onNavigate(resolve()));
  if (!window.location.hash) window.location.replace('#/');
  onNavigate(resolve());
}
