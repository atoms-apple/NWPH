/**
 * Deterministic pseudo-randomness.
 *
 * Load factors, seat occupancy, delays and the demand component of a fare all
 * have to look varied and be completely stable: the same flight on the same
 * date must cost the same thing on Tuesday as it did on Monday, in a different
 * browser, offline. So nothing here touches Math.random — every value is a pure
 * function of a seed string.
 */

/** FNV-1a, 32-bit. Small, fast, and good enough to decorrelate similar keys. */
export function hash(seed) {
  let h = 0x811c9dc5;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number in [0, 1) from a seed. */
export const unit = (seed) => hash(seed) / 0x100000000;

/** An integer in [min, max]. */
export const int = (seed, min, max) => min + Math.floor(unit(seed) * (max - min + 1));

/** True with the given probability. */
export const chance = (seed, probability) => unit(seed) < probability;

/** One item from a list. */
export const pick = (seed, items) => items[int(seed, 0, items.length - 1)];

/**
 * A value in [min, max] pulled toward the middle.
 *
 * Averaging two draws gives a triangular distribution, which is closer to how
 * real load factors sit — mostly middling, occasionally extreme — than a flat
 * one is.
 */
export function centred(seed, min, max) {
  const a = unit(`${seed}:a`);
  const b = unit(`${seed}:b`);
  return min + ((a + b) / 2) * (max - min);
}
