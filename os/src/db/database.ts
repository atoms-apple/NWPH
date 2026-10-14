import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export type Params = Record<string, SQLInputValue | boolean | undefined> | SQLInputValue[];
export type Row = Record<string, unknown>;

let current: DatabaseSync | null = null;

export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
  `);
  current = db;
  return db;
}

export function db(): DatabaseSync {
  if (!current) throw new Error('Database has not been opened');
  return current;
}

export function closeDatabase(): void {
  current?.close();
  current = null;
}

/** node:sqlite rejects undefined and booleans; normalise them. */
function bind(sql: string, params?: Params): SQLInputValue[] | Record<string, SQLInputValue> {
  if (!params) return [];
  const fix = (v: unknown): SQLInputValue =>
    v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : (v as SQLInputValue);
  if (Array.isArray(params)) return params.map(fix);
  const out: Record<string, SQLInputValue> = {};
  // node:sqlite rejects named parameters the statement does not use, so
  // shared filter objects only bind what this SQL references.
  for (const [k, v] of Object.entries(params)) if (new RegExp(`[:$@]${k}\\b`).test(sql)) out[k] = fix(v);
  return out;
}

function call<T>(sql: string, params: Params | undefined, fn: 'all' | 'get' | 'run'): T {
  const stmt = db().prepare(sql);
  const bound = bind(sql, params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = stmt as any;
  return (Array.isArray(bound) ? s[fn](...bound) : s[fn](bound)) as T;
}

export const all = <T = Row>(sql: string, params?: Params): T[] => call<T[]>(sql, params, 'all');
export const get = <T = Row>(sql: string, params?: Params): T | undefined => call<T | undefined>(sql, params, 'get');
export const run = (sql: string, params?: Params): { changes: number | bigint } => call(sql, params, 'run');

let depth = 0;

/** Run fn in a transaction. Nested calls use savepoints. */
export function tx<T>(fn: () => T): T {
  const conn = db();
  const name = `sp_${depth}`;
  conn.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${name}`);
  depth++;
  try {
    const result = fn();
    depth--;
    conn.exec(depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
    return result;
  } catch (err) {
    depth--;
    conn.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
    throw err;
  }
}

/** Build "a = :a, b = :b" from a value map, for UPDATE statements. */
export function assignments(values: Record<string, unknown>): string {
  return Object.keys(values)
    .map((k) => `${k} = :${k}`)
    .join(', ');
}

export function isConstraintError(err: unknown, kind?: 'UNIQUE' | 'FOREIGN KEY' | 'CHECK'): boolean {
  const msg = err instanceof Error ? err.message : '';
  if (!/constraint failed/i.test(msg)) return false;
  return kind ? msg.includes(kind) : true;
}
