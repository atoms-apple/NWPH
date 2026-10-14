# Polar Express — stock feed

The app reads one endpoint. Everything else about it is static.

```js
// src/data/polar-express.mjs
inventoryEndpoint: '/shop/inventory.json',
```

A path means the static snapshot this build emits. Point it at an absolute URL
and the same app polls a live point-of-sale feed instead. **That is the only
change needed** — the client does not care where the JSON comes from.

## Response shape

```json
{
  "generatedAt": "2028-10-14T13:04:11.000Z",
  "currency": "CAD",
  "lowStockAt": 3,
  "stores": [
    { "id": "PNG", "name": "Pangnirtung" },
    { "id": "QIK", "name": "Qikiqtarjuaq" }
  ],
  "items": [
    { "sku": "PE-1001", "stock": { "PNG": 14, "QIK": 6 }, "confidence": "counted" }
  ]
}
```

| Field | Meaning |
|---|---|
| `generatedAt` | When the counts were published. Drives the "updated N ago" line and the stale warning. **Required** — without it the app cannot tell the customer how old the number is. |
| `lowStockAt` | At or below this, an item shows as Low rather than In stock. |
| `stores[].id` | Must match the keys used in each item's `stock` object. |
| `items[].sku` | Must match a catalogue SKU. Unknown SKUs are ignored rather than rendered. |
| `items[].confidence` | `counted` (checked against the shelf) or `system` (till figure, unverified). Shown to the customer. |

The feed carries **only stock** — no names, prices or descriptions. Those come
from the catalogue at build time, which keeps the polled payload to a few
kilobytes. On a metered satellite connection that difference matters.

## How the client behaves

- Polls every `pollSeconds` (60 by default) **only while the tab is visible**.
  Nobody should pay for updates to a page they are not looking at.
- Caches the last good response in `localStorage` and in a service worker
  cache. Offline, it shows that copy and says plainly that it is offline and
  how old the figures are.
- Recomputes stock badges *and* the filter attributes, so "in stock in
  Qikiqtarjuaq" stays accurate after an update rather than filtering on the
  numbers the page was built with.
- A feed older than `staleMinutes` (45) is shown as stale, not current.

## Seeing it update

The deployed feed is a static snapshot, so polling it shows no change. To watch
the live path work:

```bash
node build.mjs
node tools/serve.mjs &
npm run sim          # rewrites dist/shop/inventory.json like a till would
```

Open `/shop/` and watch counts move without a reload. The simulator mostly
sells and occasionally receives, which is roughly what a trading day looks like
from the till's point of view.

## Replacing it with a real till

The point-of-sale system needs to publish the shape above. Two practical
approaches:

1. **Push on change.** The till posts to a small endpoint that writes the JSON
   to object storage behind a CDN. Lowest latency, and the CDN absorbs the read
   traffic.
2. **Poll and republish.** A scheduled job reads the till's API every minute and
   writes the same file. Simpler, and the staleness is bounded and visible.

Either way the customer-facing contract is unchanged: one small JSON document,
with an honest timestamp on it.

## What the app does not do

- It does not take payment. A reservation is a hold, paid at the counter.
- It does not promise the item is there. The copy says so, and the `confidence`
  field carries the uncertainty through to the customer rather than hiding it.
