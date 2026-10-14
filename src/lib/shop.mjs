/**
 * Stock presentation rules, shared by the build and the client script so the
 * server-rendered page and the live-updated page cannot disagree.
 */

import { shop } from '../data/polar-express.mjs';

export const money = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: shop.currency }).format(value);

/**
 * Classify a count.
 *
 * `confidence` is carried through rather than folded into the status: an
 * unverified count of 8 is still "in stock", but the page says the number came
 * from the till rather than from someone looking at the shelf.
 */
export function stockState(units, confidence = 'counted') {
  if (units <= 0) return { key: 'out', label: 'Out of stock', units, confidence };
  if (units <= shop.lowStockAt) return { key: 'low', label: `Low — ${units} left`, units, confidence };
  return { key: 'in', label: `In stock — ${units}`, units, confidence };
}

/** Total units across every store, used for the "anywhere" view. */
export const totalUnits = (product) =>
  Object.values(product.stock).reduce((sum, units) => sum + units, 0);

/** The feed the app polls. Emitted by the build; replaceable with a live API. */
export function inventoryFeed({ stores, products, generatedAt }) {
  return {
    generatedAt,
    currency: shop.currency,
    lowStockAt: shop.lowStockAt,
    stores: stores.map(({ id, name }) => ({ id, name })),
    items: products.map((product) => ({
      sku: product.sku,
      stock: product.stock,
      confidence: product.confidence,
    })),
  };
}
