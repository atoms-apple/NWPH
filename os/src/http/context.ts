import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { Config } from '../config.ts';
import type { Session, SessionUser, Flash } from '../auth/sessions.ts';
import { setFlash } from '../auth/sessions.ts';
import { can, type Permission } from '../auth/permissions.ts';

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Reply {
  status: number;
  headers?: Record<string, string | string[]>;
  body?: string | Buffer;
}

/** Parsed form submission: urlencoded or multipart. */
export class FormInput {
  readonly #data: FormData;
  constructor(data: FormData) {
    this.#data = data;
  }
  get(name: string): string {
    const v = this.#data.get(name);
    return typeof v === 'string' ? v : '';
  }
  getAll(name: string): string[] {
    return this.#data.getAll(name).filter((v): v is string => typeof v === 'string');
  }
  has(name: string): boolean {
    return this.#data.has(name);
  }
  file(name: string): File | null {
    const v = this.#data.get(name);
    return v && typeof v !== 'string' && v.size > 0 ? v : null;
  }
  /** Plain string values for re-rendering a form after a validation error. */
  values(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.#data.entries()) if (typeof v === 'string' && !(k in out)) out[k] = v;
    return out;
  }
}

export interface Actor {
  id: string | null;
  name: string;
}

export class Context {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly url: URL;
  readonly method: string;
  readonly config: Config;
  params: Record<string, string> = {};
  session: Session | null = null;
  readonly cookies: Record<string, string>;
  /** Set by the router after CSRF verification on POST. */
  form!: FormInput;
  readonly setCookies: string[] = [];
  readonly requestId: string;

  constructor(req: IncomingMessage, res: ServerResponse, config: Config, requestId: string) {
    this.req = req;
    this.res = res;
    this.config = config;
    this.method = (req.method || 'GET').toUpperCase();
    this.url = new URL(req.url || '/', 'http://internal');
    this.cookies = parseCookies(req.headers.cookie);
    this.requestId = requestId;
  }

  get query(): URLSearchParams {
    return this.url.searchParams;
  }

  get user(): SessionUser | null {
    return this.session?.user ?? null;
  }

  get actor(): Actor {
    return this.user ? { id: this.user.id, name: this.user.display_name } : { id: null, name: 'System' };
  }

  can(permission: Permission): boolean {
    return can(this.user?.role, permission);
  }

  require(permission: Permission): void {
    if (!this.user) throw new HttpError(401, 'Sign in required');
    if (!this.can(permission)) throw new HttpError(403, 'You do not have permission to do that.');
  }

  get csrf(): string {
    return this.session?.csrfToken ?? this.cookies[PRE_AUTH_COOKIE] ?? '';
  }

  flash(kind: Flash['kind'], message: string): void {
    if (this.session) setFlash(this.session.tokenHash, { kind, message });
  }

  /**
   * The host the browser addressed. Behind a trusted reverse proxy (TRUST_PROXY,
   * e.g. GitHub Codespaces port forwarding) the Host header is rewritten, so the
   * original is read from X-Forwarded-Host instead.
   */
  get publicHost(): string {
    if (this.config.trustProxy) {
      const fwd = this.req.headers['x-forwarded-host'];
      const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return this.req.headers.host ?? '';
  }

  /** The address used for throttling. Only trusts X-Forwarded-For when configured. */
  get clientAddress(): string {
    if (this.config.trustProxy) {
      const fwd = this.req.headers['x-forwarded-for'];
      const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return this.req.socket.remoteAddress || 'unknown';
  }

  cookie(name: string, value: string, opts: { maxAgeSeconds?: number; httpOnly?: boolean } = {}): void {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
    if (opts.httpOnly !== false) parts.push('HttpOnly');
    if (this.config.cookieSecure) parts.push('Secure');
    if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
    this.setCookies.push(parts.join('; '));
  }
}

/** Cookie used for CSRF protection of the login and setup forms (no session yet). */
export const PRE_AUTH_COOKIE = 'nwph_os_pre';

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

// ── Reply helpers ────────────────────────────────────────────────────────────

export const htmlReply = (body: string, status = 200): Reply => ({
  status,
  headers: { 'content-type': 'text/html; charset=utf-8' },
  body,
});

/** Redirect only to same-site paths, so a crafted ?next= cannot leave the app. */
export function redirect(location: string, status = 303): Reply {
  const safe = location.startsWith('/') && !location.startsWith('//') && !location.startsWith('/\\') ? location : '/';
  return { status, headers: { location: safe } };
}

export const jsonReply = (data: unknown, status = 200): Reply => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(data),
});
