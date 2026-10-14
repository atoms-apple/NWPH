/**
 * Money is stored as integer minor units (cents) with an ISO-4217 code.
 * Amounts in different currencies are never summed together: every summary
 * groups by currency first.
 */

export const DEFAULT_CURRENCY = 'CAD';

/** Currencies offered in forms. The schema accepts any 3-letter code. */
export const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'DKK'] as const;

const MAX_MINOR = 1_000_000_000_000_00; // one trillion in major units

/** Parse "12,500.50" / "12500" / "$12 500" into minor units. Returns null if invalid. */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/[\s,$]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) return null;
  return minor;
}

export function formatMoney(minor: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  if (minor === null || minor === undefined) return '—';
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100).toLocaleString('en-CA');
  const cents = String(abs % 100).padStart(2, '0');
  return `${negative ? '−' : ''}${whole}.${cents} ${currency}`;
}

/** Minor units → string suitable for a form input. */
export const moneyInput = (minor: number | null | undefined): string =>
  minor === null || minor === undefined ? '' : (minor / 100).toFixed(2);
