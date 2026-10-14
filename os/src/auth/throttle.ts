/**
 * Login throttling: after MAX_FAILURES failed attempts for the same account or
 * from the same address within WINDOW_MS, further attempts are refused until
 * the window passes. In-memory by design: it protects one process and resets
 * on restart, which is acceptable for a single-instance internal tool.
 */

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export function isThrottled(keys: string[], now = Date.now()): boolean {
  return keys.some((k) => recent(k, now).length >= MAX_FAILURES);
}

export function recordFailure(keys: string[], now = Date.now()): void {
  for (const k of keys) failures.set(k, [...recent(k, now), now]);
}

export function clearFailures(keys: string[]): void {
  for (const k of keys) failures.delete(k);
}

export const resetThrottle = (): void => failures.clear();
