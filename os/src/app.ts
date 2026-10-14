/**
 * Request pipeline: security headers → static assets → session → route match
 * → access check (server-side, per route) → CSRF/origin check on POST →
 * handler → error mapping. No route is reachable without passing the access
 * check declared in its registration.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Config } from './config.ts';
import { APP_ROOT } from './config.ts';
import { Context, HttpError, htmlReply, redirect, safeEqual, PRE_AUTH_COOKIE, type Reply } from './http/context.ts';
import { parseForm } from './http/body.ts';
import { Router } from './http/router.ts';
import { loadSession, SESSION_COOKIE } from './auth/sessions.ts';
import { html } from './lib/html.ts';
import { barePage } from './web/layout.ts';
import { linkButton } from './web/ui.ts';
import { registerAuth } from './web/pages/auth.ts';
import { registerDashboard } from './web/pages/dashboard.ts';
import { registerOrganization } from './web/pages/organization.ts';
import { registerVentures } from './web/pages/ventures.ts';
import { registerWork } from './web/pages/work.ts';
import { registerFinance } from './web/pages/finance.ts';
import { registerDecisions } from './web/pages/decisions.ts';
import { registerDocuments } from './web/pages/documents.ts';
import { registerOpportunities } from './web/pages/opportunities.ts';
import { registerRisks } from './web/pages/risks.ts';
import { registerActivity } from './web/pages/activity.ts';
import { registerSettings } from './web/pages/settings.ts';

const PUBLIC_DIR = path.join(APP_ROOT, 'src', 'public');
const STATIC_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

export function buildRouter(): Router {
  const router = new Router();
  registerAuth(router);
  registerDashboard(router);
  registerOrganization(router);
  registerVentures(router);
  registerWork(router);
  registerFinance(router);
  registerDecisions(router);
  registerDocuments(router);
  registerOpportunities(router);
  registerRisks(router);
  registerActivity(router);
  registerSettings(router);
  router.get('/healthz', 'public', () => ({ status: 200, headers: { 'content-type': 'text/plain' }, body: 'ok' }));
  return router;
}

function serveStatic(pathname: string): Reply | null {
  if (!pathname.startsWith('/assets/')) return null;
  const name = pathname.slice('/assets/'.length);
  if (!/^[a-z0-9-]+\.(css|js|svg)$/.test(name)) return { status: 404, body: 'Not found' };
  const file = path.join(PUBLIC_DIR, name);
  if (!fs.existsSync(file)) return { status: 404, body: 'Not found' };
  return {
    status: 200,
    headers: { 'content-type': STATIC_TYPES[path.extname(name)]!, 'cache-control': 'public, max-age=3600' },
    body: fs.readFileSync(file),
  };
}

function errorPage(status: number, message: string, signedIn: boolean): string {
  const titles: Record<number, string> = { 400: 'Bad request', 403: 'Not permitted', 404: 'Not found', 405: 'Not allowed', 413: 'Too large', 415: 'Unsupported', 500: 'Something went wrong' };
  return barePage(
    titles[status] ?? 'Error',
    html`<h1>${titles[status] ?? 'Error'}</h1><p>${message}</p><p>${signedIn ? linkButton('/', 'Back to dashboard', 'primary') : linkButton('/login', 'Sign in', 'primary')}</p>`,
  );
}

export function createHandler(config: Config, router: Router = buildRouter()) {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const requestId = randomBytes(6).toString('hex');
    const ctx = new Context(req, res, config, requestId);
    let reply: Reply;
    try {
      reply = (await dispatch(ctx, router)) ?? { status: 204 };
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401) {
          const next = ctx.method === 'GET' ? `?next=${encodeURIComponent(ctx.url.pathname + ctx.url.search)}` : '';
          reply = redirect(`/login${next}`);
        } else {
          reply = htmlReply(errorPage(err.status, err.message, Boolean(ctx.user)), err.status);
        }
      } else {
        // Log server-side with a reference; never show internals to the user.
        console.error(`[${requestId}] ${ctx.method} ${ctx.url.pathname}:`, err);
        reply = htmlReply(errorPage(500, `An unexpected error occurred. Reference: ${requestId}. No changes were saved if the action did not complete.`, Boolean(ctx.user)), 500);
      }
    }
    const headers: Record<string, string | string[]> = { ...SECURITY_HEADERS, ...(reply.headers ?? {}) };
    if (config.cookieSecure) headers['strict-transport-security'] = 'max-age=31536000';
    if (!headers['cache-control']) headers['cache-control'] = 'no-store';
    if (ctx.setCookies.length) headers['set-cookie'] = ctx.setCookies;
    res.writeHead(reply.status, headers);
    res.end(ctx.method === 'HEAD' ? undefined : reply.body);
  };
}

async function dispatch(ctx: Context, router: Router): Promise<Reply> {
  if (ctx.method === 'GET' || ctx.method === 'HEAD') {
    const asset = serveStatic(ctx.url.pathname);
    if (asset) return asset;
  }
  ctx.session = loadSession(ctx.cookies[SESSION_COOKIE], ctx.config.sessionIdleMs);

  const match = router.match(ctx.method, ctx.url.pathname);
  if (match === 'method') throw new HttpError(405, 'That action is not available at this address.');
  if (!match) throw new HttpError(ctx.user ? 404 : 401, 'Page not found.');
  ctx.params = match.params;
  const { route } = match;

  // Server-side authorization, declared per route.
  if (route.access !== 'public') ctx.require(route.access);

  if (ctx.method === 'POST') {
    // Origin check: browsers send Origin on POST; reject cross-site submissions.
    const origin = ctx.req.headers.origin;
    if (origin && origin !== 'null') {
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        /* invalid */
      }
      if (originHost !== ctx.req.headers.host) throw new HttpError(403, 'Cross-site request refused.');
    }
    ctx.form = await parseForm(ctx.req, ctx.config.maxUploadBytes);
    const expected = ctx.session?.csrfToken ?? ctx.cookies[PRE_AUTH_COOKIE] ?? '';
    if (!safeEqual(ctx.form.get('_csrf'), expected)) {
      throw new HttpError(403, 'This form has expired or was submitted from another page. Go back, reload and try again.');
    }
  }
  return route.handler(ctx);
}

export function createServer(config: Config): http.Server {
  const server = http.createServer(createHandler(config));
  server.headersTimeout = 30_000;
  server.requestTimeout = 120_000;
  return server;
}
