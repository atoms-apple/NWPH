#!/usr/bin/env node
/**
 * Local stock simulator.
 *
 * The deployed feed is a static snapshot, so polling it shows no change — which
 * is honest but makes the live behaviour hard to see. This rewrites
 * dist/shop/inventory.json every few seconds the way a till would: a sale here,
 * a delivery there. Run it next to `npm run serve` and watch the browser update
 * without a refresh.
 *
 *   node build.mjs && node tools/serve.mjs &
 *   node tools/inventory-sim.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const feedPath = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'dist/shop/inventory.json',
);

const INTERVAL_MS = Number(process.env.SIM_INTERVAL ?? 4000);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

async function tick() {
  const feed = JSON.parse(await readFile(feedPath, 'utf8'));
  const item = pick(feed.items);
  const storeId = pick(feed.stores).id;
  const current = item.stock[storeId] ?? 0;

  // Mostly sales, occasionally a delivery — which is roughly what a trading
  // day looks like from the till's point of view.
  const delta = Math.random() < 0.78 ? -Math.ceil(Math.random() * 2) : Math.ceil(Math.random() * 6);
  item.stock[storeId] = Math.max(0, current + delta);
  feed.generatedAt = new Date().toISOString();

  await writeFile(feedPath, JSON.stringify(feed));
  const arrow = delta < 0 ? 'sold' : 'received';
  console.log(`  ${item.sku} @ ${storeId}  ${current} → ${item.stock[storeId]}  (${arrow})`);
}

console.log(`\n  Polar Express stock simulator — every ${INTERVAL_MS / 1000}s\n  ${feedPath}\n`);
await tick();
setInterval(() => tick().catch((error) => console.error('  ' + error.message)), INTERVAL_MS);
