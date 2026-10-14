import { all, get, run } from '../db/database.ts';
import { newId } from '../lib/ids.ts';
import { nowIso } from '../lib/time.ts';
import { hashPassword, passwordProblem } from './password.ts';
import type { Role } from './permissions.ts';

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
}

export const countUsers = (): number => get<{ n: number }>('SELECT count(*) AS n FROM users')!.n;

export const listUsers = (): UserRow[] =>
  all<UserRow>('SELECT id, email, display_name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at');

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUser(input: {
  email: string;
  displayName: string;
  password: string;
  role: Role;
}): Promise<UserRow> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
  const problem = passwordProblem(input.password);
  if (problem) throw new Error(problem);
  if (get('SELECT 1 FROM users WHERE email = ?', [email])) throw new Error('A user with that email already exists.');
  const id = newId();
  const now = nowIso();
  run(
    `INSERT INTO users (id, email, display_name, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, email, input.displayName.trim() || email, await hashPassword(input.password), input.role, now, now],
  );
  return get<UserRow>('SELECT id, email, display_name, role, is_active, created_at, last_login_at FROM users WHERE id = ?', [id])!;
}

export const activeOwnerCount = (): number =>
  get<{ n: number }>("SELECT count(*) AS n FROM users WHERE role = 'owner' AND is_active = 1")!.n;
