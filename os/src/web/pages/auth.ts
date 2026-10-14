import { html } from '../../lib/html.ts';
import { get, run } from '../../db/database.ts';
import { randomToken } from '../../lib/ids.ts';
import { nowIso } from '../../lib/time.ts';
import { htmlReply, redirect, safeEqual, PRE_AUTH_COOKIE, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import { verifyPassword, dummyHash, MIN_PASSWORD_LENGTH } from '../../auth/password.ts';
import { createSession, destroySession, SESSION_COOKIE } from '../../auth/sessions.ts';
import { isThrottled, recordFailure, clearFailures } from '../../auth/throttle.ts';
import { countUsers, createUser } from '../../auth/users.ts';
import { logActivity } from '../../domain/records.ts';
import { barePage } from '../layout.ts';
import { notice } from '../ui.ts';
import { returnTo } from '../common.ts';

let setupToken: string | null = null;
export const setSetupToken = (t: string | null): void => {
  setupToken = t;
};

/** CSRF token for forms shown before sign-in, bound to a short-lived cookie. */
function preAuthToken(ctx: Context): string {
  let token = ctx.cookies[PRE_AUTH_COOKIE];
  if (!token || token.length < 20) {
    token = randomToken(24);
    ctx.cookies[PRE_AUTH_COOKIE] = token;
    ctx.cookie(PRE_AUTH_COOKIE, token, { maxAgeSeconds: 3600 });
  }
  return token;
}

function loginPage(ctx: Context, opts: { email?: string; error?: string; next?: string } = {}): string {
  const csrf = preAuthToken(ctx);
  return barePage(
    'Sign in',
    html`<h1>Sign in</h1>
    <p class="muted">NWPH OS is a private internal platform. Access is limited to authorised accounts.</p>
    ${opts.error ? notice('error', opts.error) : ''}
    <form method="post" action="/login" class="form form--narrow">
      <input type="hidden" name="_csrf" value="${csrf}">
      <input type="hidden" name="next" value="${opts.next ?? ''}">
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required value="${opts.email ?? ''}" autofocus></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
      <div class="form__actions"><button type="submit" class="btn btn--primary">Sign in</button></div>
    </form>
    ${countUsers() === 0 ? html`<p class="muted small">No accounts exist yet. <a href="/setup">Create the first owner account</a>.</p>` : ''}`,
  );
}

function setupPage(ctx: Context, values: Record<string, string> = {}, error?: string): string {
  const csrf = preAuthToken(ctx);
  return barePage(
    'Set up NWPH OS',
    html`<h1>Create the first owner account</h1>
    <p class="muted">Enter the setup token printed in the server console when NWPH OS started (or the SETUP_TOKEN environment variable). This page stops working once an account exists.</p>
    ${error ? notice('error', error) : ''}
    <form method="post" action="/setup" class="form form--narrow">
      <input type="hidden" name="_csrf" value="${csrf}">
      <div class="field"><label for="token">Setup token</label><input id="token" name="token" type="password" autocomplete="off" required></div>
      <div class="field"><label for="display_name">Your name</label><input id="display_name" name="display_name" required maxlength="120" value="${values.display_name ?? ''}"></div>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required value="${values.email ?? ''}"></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" required>
        <p class="field__help">At least ${MIN_PASSWORD_LENGTH} characters. A passphrase works well.</p></div>
      <div class="form__actions"><button type="submit" class="btn btn--primary">Create owner account</button></div>
    </form>`,
  );
}

export function registerAuth(router: Router): void {
  router.get('/login', 'public', (ctx) => {
    if (ctx.user) return redirect('/');
    if (countUsers() === 0) return redirect('/setup');
    return htmlReply(loginPage(ctx, { next: ctx.query.get('next') ?? '' }));
  });

  router.post('/login', 'public', async (ctx) => {
    const email = ctx.form.get('email').trim().toLowerCase().slice(0, 254);
    const password = ctx.form.get('password').slice(0, 256);
    const next = ctx.form.get('next');
    const keys = [`email:${email}`, `ip:${ctx.clientAddress}`];
    const fail = (message: string, status = 401) => htmlReply(loginPage(ctx, { email, error: message, next }), status);

    if (isThrottled(keys)) return fail('Too many failed attempts. Wait 15 minutes and try again.', 429);
    const user = get<{ id: string; password_hash: string; is_active: number; display_name: string }>(
      'SELECT id, password_hash, is_active, display_name FROM users WHERE email = ?',
      [email],
    );
    // Hash even when the user does not exist so response time does not reveal accounts.
    const ok = await verifyPassword(password, user?.password_hash ?? (await dummyHash()));
    if (!user || !ok || !user.is_active) {
      recordFailure(keys);
      return fail('Email or password is incorrect, or the account is disabled.');
    }
    clearFailures(keys);
    // Fresh session on every sign-in (prevents session fixation).
    if (ctx.session) destroySession(ctx.session.tokenHash);
    const { token } = createSession(user.id, ctx.config.sessionMaxMs);
    ctx.cookie(SESSION_COOKIE, token, { maxAgeSeconds: Math.floor(ctx.config.sessionMaxMs / 1000) });
    ctx.cookie(PRE_AUTH_COOKIE, '', { maxAgeSeconds: 0 });
    run('UPDATE users SET last_login_at = ? WHERE id = ?', [nowIso(), user.id]);
    const safeNext = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
    return redirect(safeNext);
  });

  router.post('/logout', 'read', (ctx) => {
    if (ctx.session) destroySession(ctx.session.tokenHash);
    ctx.cookie(SESSION_COOKIE, '', { maxAgeSeconds: 0 });
    return redirect('/login');
  });

  router.get('/setup', 'public', (ctx) => {
    if (countUsers() > 0) return redirect('/login');
    return htmlReply(setupPage(ctx));
  });

  router.post('/setup', 'public', async (ctx) => {
    if (countUsers() > 0) return redirect('/login');
    const values = ctx.form.values();
    if (!setupToken || !safeEqual(ctx.form.get('token').trim(), setupToken)) {
      return htmlReply(setupPage(ctx, values, 'The setup token is not correct. Check the server console output.'), 403);
    }
    try {
      const user = await createUser({ email: values.email ?? '', displayName: values.display_name ?? '', password: ctx.form.get('password'), role: 'owner' });
      setupToken = null;
      logActivity({ actor: { id: user.id, name: user.display_name }, type: 'user.created', entityType: 'user', entityId: user.id, summary: `First owner account created for ${user.display_name}` });
      const { token } = createSession(user.id, ctx.config.sessionMaxMs);
      ctx.cookie(SESSION_COOKIE, token, { maxAgeSeconds: Math.floor(ctx.config.sessionMaxMs / 1000) });
      ctx.cookie(PRE_AUTH_COOKIE, '', { maxAgeSeconds: 0 });
      return redirect(returnTo(ctx, '/'));
    } catch (err) {
      return htmlReply(setupPage(ctx, values, (err as Error).message), 422);
    }
  });
}
