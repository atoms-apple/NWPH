import { get, run } from '../db/database.ts';
import { randomToken, sha256 } from '../lib/ids.ts';
import type { Role } from './permissions.ts';

export interface SessionUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
}

export interface Session {
  tokenHash: string;
  csrfToken: string;
  user: SessionUser;
  flash: Flash | null;
}

export interface Flash {
  kind: 'success' | 'error' | 'info';
  message: string;
}

export const SESSION_COOKIE = 'nwph_os_session';

export function createSession(userId: string, maxMs: number): { token: string; expiresAt: string } {
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + maxMs).toISOString();
  run(
    `INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sha256(token), userId, randomToken(24), now.toISOString(), now.toISOString(), expiresAt],
  );
  return { token, expiresAt };
}

/** Resolve a cookie token to a live session, enforcing absolute and idle expiry. */
export function loadSession(token: string | undefined, idleMs: number): Session | null {
  if (!token || token.length > 100) return null;
  const tokenHash = sha256(token);
  const row = get<{
    csrf_token: string;
    last_seen_at: string;
    expires_at: string;
    flash: string | null;
    id: string;
    email: string;
    display_name: string;
    role: Role;
    is_active: number;
  }>(
    `SELECT s.csrf_token, s.last_seen_at, s.expires_at, s.flash, u.id, u.email, u.display_name, u.role, u.is_active
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    [tokenHash],
  );
  if (!row) return null;
  const now = Date.now();
  if (!row.is_active || Date.parse(row.expires_at) < now || Date.parse(row.last_seen_at) + idleMs < now) {
    run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    return null;
  }
  // Touch at most once a minute to avoid a write per request.
  if (now - Date.parse(row.last_seen_at) > 60_000) {
    run('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', [new Date(now).toISOString(), tokenHash]);
  }
  let flash: Flash | null = null;
  if (row.flash) {
    try {
      flash = JSON.parse(row.flash) as Flash;
    } catch {
      flash = null;
    }
    run('UPDATE sessions SET flash = NULL WHERE token_hash = ?', [tokenHash]);
  }
  return {
    tokenHash,
    csrfToken: row.csrf_token,
    flash,
    user: { id: row.id, email: row.email, display_name: row.display_name, role: row.role },
  };
}

export function setFlash(tokenHash: string, flash: Flash): void {
  run('UPDATE sessions SET flash = ? WHERE token_hash = ?', [JSON.stringify(flash), tokenHash]);
}

export const destroySession = (tokenHash: string): void => {
  run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
};

export const destroyUserSessions = (userId: string, exceptTokenHash?: string): void => {
  run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, exceptTokenHash ?? '']);
};

export const purgeExpiredSessions = (): void => {
  run('DELETE FROM sessions WHERE expires_at < ?', [new Date().toISOString()]);
};
