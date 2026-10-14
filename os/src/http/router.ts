import type { Context, Reply } from './context.ts';
import type { Permission } from '../auth/permissions.ts';

export type Handler = (ctx: Context) => Reply | Promise<Reply>;

/**
 * `access` is the server-side gate for the route:
 *   'public'  no session needed (login, setup, assets, health)
 *   a Permission  signed-in user whose role grants it
 */
export interface Route {
  method: 'GET' | 'POST';
  pattern: string;
  access: 'public' | Permission;
  handler: Handler;
  regex: RegExp;
  keys: string[];
}

export class Router {
  readonly routes: Route[] = [];

  add(method: Route['method'], pattern: string, access: Route['access'], handler: Handler): void {
    const keys: string[] = [];
    const source = pattern
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.routes.push({ method, pattern, access, handler, regex: new RegExp(`^${source}/?$`), keys });
  }

  get(pattern: string, access: Route['access'], handler: Handler): void {
    this.add('GET', pattern, access, handler);
  }

  post(pattern: string, access: Route['access'], handler: Handler): void {
    this.add('POST', pattern, access, handler);
  }

  match(method: string, pathname: string): { route: Route; params: Record<string, string> } | 'method' | null {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method && !(method === 'HEAD' && route.method === 'GET')) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => {
        try {
          params[k] = decodeURIComponent(m[i + 1]!);
        } catch {
          params[k] = m[i + 1]!;
        }
      });
      return { route, params };
    }
    return pathMatched ? 'method' : null;
  }
}
