/**
 * Polar Express Stores — store directory and catalogue.
 *
 * In production this is not a file: the catalogue and the stock counts come
 * from the point-of-sale system, and `shop.inventoryEndpoint` points at that
 * feed. This module is the shape that feed must produce, and the build emits it
 * as a static snapshot so the app has something real to run against.
 *
 * Prices and counts are illustrative, like everything else on this branch.
 */

export const shop = {
  name: 'Polar Express Stores',
  short: 'Polar Express',
  /**
   * Where the app reads stock from.
   *
   * A path means the static snapshot this build emits. Point it at an absolute
   * URL and the same app polls a live point-of-sale feed instead — no other
   * change. The response shape is documented in docs/INVENTORY-FEED.md.
   */
  inventoryEndpoint: '/shop/inventory.json',
  /** How often the app re-checks stock while the page is visible, in seconds. */
  pollSeconds: 60,
  /** A count older than this is shown as stale rather than current. */
  staleMinutes: 45,
  /** At or below this many units, an item is flagged as low rather than in stock. */
  lowStockAt: 3,
  currency: 'CAD',
  pickupNote: 'Reserved items are held until close the following day.',
};

export const stores = [
  { id: 'PNG', name: 'Pangnirtung', opened: 2027, hours: 'Mon–Sat 10:00–19:00, Sun 12:00–17:00' },
  { id: 'QIK', name: 'Qikiqtarjuaq', opened: 2028, hours: 'Mon–Sat 10:00–18:00, closed Sunday' },
];

export const categories = [
  { id: 'pantry', name: 'Food & pantry' },
  { id: 'fresh', name: 'Fresh & frozen' },
  { id: 'household', name: 'Household' },
  { id: 'hardware', name: 'Hardware & tools' },
  { id: 'outdoor', name: 'Harvesting & outdoor' },
  { id: 'clothing', name: 'Clothing' },
  { id: 'craft', name: 'Art & craft supplies' },
  { id: 'baby', name: 'Baby & health' },
];

/**
 * The catalogue. `stock` is units on the shelf per store.
 *
 * `confidence: 'counted'` means a physical count backs the number. `'system'`
 * means it is the point-of-sale figure and has not been verified on the shelf.
 * The app shows the difference, because a wrong count that looks certain is
 * worse than an uncertain one that says so.
 */
export const products = [
  // Food & pantry
  { sku: 'PE-1001', name: 'All-purpose flour', unit: '10 kg', category: 'pantry', price: 42.99, stock: { PNG: 14, QIK: 6 }, confidence: 'counted' },
  { sku: 'PE-1002', name: 'White sugar', unit: '4 kg', category: 'pantry', price: 23.49, stock: { PNG: 9, QIK: 3 }, confidence: 'counted' },
  { sku: 'PE-1003', name: 'Pilot biscuits', unit: 'Box of 24', category: 'pantry', price: 18.79, stock: { PNG: 22, QIK: 17 }, confidence: 'counted' },
  { sku: 'PE-1004', name: 'Black tea bags', unit: '100 ct', category: 'pantry', price: 11.99, stock: { PNG: 31, QIK: 12 }, confidence: 'counted' },
  { sku: 'PE-1005', name: 'Instant coffee', unit: '300 g', category: 'pantry', price: 26.49, stock: { PNG: 7, QIK: 0 }, confidence: 'counted' },
  { sku: 'PE-1006', name: 'Long grain rice', unit: '5 kg', category: 'pantry', price: 34.99, stock: { PNG: 11, QIK: 4 }, confidence: 'system' },
  { sku: 'PE-1007', name: 'Canned stewing beef', unit: '400 g', category: 'pantry', price: 9.29, stock: { PNG: 26, QIK: 19 }, confidence: 'counted' },
  { sku: 'PE-1008', name: 'Rolled oats', unit: '1 kg', category: 'pantry', price: 12.99, stock: { PNG: 2, QIK: 8 }, confidence: 'counted' },
  { sku: 'PE-1009', name: 'Powdered milk', unit: '1 kg', category: 'pantry', price: 28.99, stock: { PNG: 5, QIK: 2 }, confidence: 'system' },
  { sku: 'PE-1010', name: 'Cooking oil', unit: '3 L', category: 'pantry', price: 24.99, stock: { PNG: 13, QIK: 7 }, confidence: 'counted' },

  // Fresh & frozen
  { sku: 'PE-2001', name: 'Whole chicken, frozen', unit: 'approx. 1.6 kg', category: 'fresh', price: 31.99, stock: { PNG: 6, QIK: 0 }, confidence: 'counted' },
  { sku: 'PE-2002', name: 'Ground beef, frozen', unit: '1 kg', category: 'fresh', price: 27.49, stock: { PNG: 9, QIK: 5 }, confidence: 'counted' },
  { sku: 'PE-2003', name: 'Eggs, large', unit: 'Dozen', category: 'fresh', price: 8.99, stock: { PNG: 18, QIK: 11 }, confidence: 'counted' },
  { sku: 'PE-2004', name: 'Butter', unit: '454 g', category: 'fresh', price: 12.49, stock: { PNG: 3, QIK: 6 }, confidence: 'counted' },
  { sku: 'PE-2005', name: 'Apples', unit: 'Each', category: 'fresh', price: 2.19, stock: { PNG: 44, QIK: 0 }, confidence: 'system', note: 'Air freight — availability follows the flight schedule.' },
  { sku: 'PE-2006', name: 'Potatoes', unit: '2 kg', category: 'fresh', price: 14.99, stock: { PNG: 8, QIK: 2 }, confidence: 'counted' },
  { sku: 'PE-2007', name: 'Frozen mixed vegetables', unit: '750 g', category: 'fresh', price: 10.49, stock: { PNG: 16, QIK: 9 }, confidence: 'counted' },
  { sku: 'PE-2008', name: 'Bread, sliced', unit: '675 g', category: 'fresh', price: 7.49, stock: { PNG: 0, QIK: 4 }, confidence: 'counted' },

  // Household
  { sku: 'PE-3001', name: 'Laundry detergent', unit: '2.95 L', category: 'household', price: 38.99, stock: { PNG: 10, QIK: 5 }, confidence: 'counted' },
  { sku: 'PE-3002', name: 'Toilet paper', unit: '12 rolls', category: 'household', price: 26.99, stock: { PNG: 21, QIK: 14 }, confidence: 'counted' },
  { sku: 'PE-3003', name: 'Dish soap', unit: '740 mL', category: 'household', price: 9.99, stock: { PNG: 17, QIK: 8 }, confidence: 'counted' },
  { sku: 'PE-3004', name: 'Garbage bags', unit: '40 ct', category: 'household', price: 22.49, stock: { PNG: 12, QIK: 3 }, confidence: 'system' },
  { sku: 'PE-3005', name: 'Light bulbs, LED', unit: '4 pack', category: 'household', price: 19.99, stock: { PNG: 6, QIK: 7 }, confidence: 'counted' },
  { sku: 'PE-3006', name: 'Batteries, AA', unit: '8 pack', category: 'household', price: 17.49, stock: { PNG: 24, QIK: 10 }, confidence: 'counted' },

  // Hardware & tools
  { sku: 'PE-4001', name: 'Duct tape', unit: '48 mm × 55 m', category: 'hardware', price: 16.99, stock: { PNG: 15, QIK: 9 }, confidence: 'counted' },
  { sku: 'PE-4002', name: 'Rope, polypropylene', unit: '15 m', category: 'hardware', price: 29.99, stock: { PNG: 8, QIK: 4 }, confidence: 'counted' },
  { sku: 'PE-4003', name: 'Tarpaulin', unit: '3 m × 4 m', category: 'hardware', price: 54.99, stock: { PNG: 5, QIK: 2 }, confidence: 'counted' },
  { sku: 'PE-4004', name: 'Jerry can', unit: '20 L', category: 'hardware', price: 44.99, stock: { PNG: 7, QIK: 0 }, confidence: 'counted' },
  { sku: 'PE-4005', name: 'Two-stroke oil', unit: '1 L', category: 'hardware', price: 21.99, stock: { PNG: 19, QIK: 11 }, confidence: 'counted' },
  { sku: 'PE-4006', name: 'Spark plugs', unit: 'Each', category: 'hardware', price: 12.49, stock: { PNG: 13, QIK: 6 }, confidence: 'system' },
  { sku: 'PE-4007', name: 'Work gloves, insulated', unit: 'Pair', category: 'hardware', price: 34.99, stock: { PNG: 9, QIK: 3 }, confidence: 'counted' },

  // Harvesting & outdoor
  { sku: 'PE-5001', name: 'Rifle ammunition, .223', unit: 'Box of 20', category: 'outdoor', price: 39.99, stock: { PNG: 12, QIK: 5 }, confidence: 'counted', note: 'Photo identification required at pickup.' },
  { sku: 'PE-5002', name: 'Fishing line', unit: '100 m', category: 'outdoor', price: 18.99, stock: { PNG: 14, QIK: 8 }, confidence: 'counted' },
  { sku: 'PE-5003', name: 'Jigging hooks', unit: 'Pack of 6', category: 'outdoor', price: 11.49, stock: { PNG: 22, QIK: 13 }, confidence: 'counted' },
  { sku: 'PE-5004', name: 'Ice auger blades', unit: 'Pair', category: 'outdoor', price: 89.99, stock: { PNG: 3, QIK: 1 }, confidence: 'counted' },
  { sku: 'PE-5005', name: 'Coleman fuel', unit: '3.78 L', category: 'outdoor', price: 32.99, stock: { PNG: 11, QIK: 6 }, confidence: 'counted' },
  { sku: 'PE-5006', name: 'Snow goggles', unit: 'Each', category: 'outdoor', price: 46.99, stock: { PNG: 6, QIK: 2 }, confidence: 'counted' },
  { sku: 'PE-5007', name: 'Komatik rope', unit: '30 m', category: 'outdoor', price: 64.99, stock: { PNG: 4, QIK: 0 }, confidence: 'counted' },

  // Clothing
  { sku: 'PE-6001', name: 'Thermal socks', unit: 'Pair', category: 'clothing', price: 19.99, stock: { PNG: 27, QIK: 12 }, confidence: 'counted' },
  { sku: 'PE-6002', name: 'Insulated mitts', unit: 'Pair', category: 'clothing', price: 59.99, stock: { PNG: 8, QIK: 4 }, confidence: 'counted' },
  { sku: 'PE-6003', name: 'Wool toque', unit: 'Each', category: 'clothing', price: 24.99, stock: { PNG: 16, QIK: 9 }, confidence: 'counted' },
  { sku: 'PE-6004', name: 'Winter boots, adult', unit: 'Pair', category: 'clothing', price: 189.99, stock: { PNG: 5, QIK: 2 }, confidence: 'counted' },
  { sku: 'PE-6005', name: 'Base layer, adult', unit: 'Each', category: 'clothing', price: 49.99, stock: { PNG: 11, QIK: 0 }, confidence: 'system' },

  // Art & craft supplies
  { sku: 'PE-7001', name: 'Carving stone, serpentine', unit: 'Per kg', category: 'craft', price: 28.00, stock: { PNG: 34, QIK: 18 }, confidence: 'system' },
  { sku: 'PE-7002', name: 'Carving files, set', unit: 'Set of 6', category: 'craft', price: 72.99, stock: { PNG: 4, QIK: 1 }, confidence: 'counted' },
  { sku: 'PE-7003', name: 'Sinew thread', unit: 'Spool', category: 'craft', price: 14.99, stock: { PNG: 19, QIK: 7 }, confidence: 'counted' },
  { sku: 'PE-7004', name: 'Beading needles', unit: 'Pack of 25', category: 'craft', price: 9.49, stock: { PNG: 23, QIK: 11 }, confidence: 'counted' },
  { sku: 'PE-7005', name: 'Seed beads, assorted', unit: '50 g', category: 'craft', price: 16.99, stock: { PNG: 2, QIK: 5 }, confidence: 'counted' },

  // Baby & health
  { sku: 'PE-8001', name: 'Disposable nappies', unit: 'Pack of 60', category: 'baby', price: 48.99, stock: { PNG: 9, QIK: 3 }, confidence: 'counted' },
  { sku: 'PE-8002', name: 'Infant formula', unit: '900 g', category: 'baby', price: 54.99, stock: { PNG: 6, QIK: 2 }, confidence: 'counted' },
  { sku: 'PE-8003', name: 'Baby wipes', unit: '4 × 72 ct', category: 'baby', price: 27.99, stock: { PNG: 14, QIK: 6 }, confidence: 'counted' },
  { sku: 'PE-8004', name: 'Paracetamol, adult', unit: '100 tablets', category: 'baby', price: 18.49, stock: { PNG: 12, QIK: 5 }, confidence: 'counted' },
  { sku: 'PE-8005', name: 'First aid kit', unit: 'Each', category: 'baby', price: 64.99, stock: { PNG: 3, QIK: 1 }, confidence: 'counted' },
];
