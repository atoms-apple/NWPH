import { html, raw } from '../lib/html.mjs';
import { Breadcrumbs, Facts } from '../components/ui.mjs';
import { shop, stores, categories, products } from '../data/polar-express.mjs';
import { money, stockState, totalUnits } from '../lib/shop.mjs';

const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? id;

/**
 * Availability for one product, every store listed.
 *
 * Both stores are always rendered rather than swapped by a picker, so the page
 * is complete without JavaScript. The store control filters which products
 * show; it never hides a number that is already on the page.
 */
const Availability = (product, { compact = false } = {}) => html`
  <ul class="stock ${compact ? 'stock--compact' : ''}" role="list">
    ${stores.map((store) => {
      const state = stockState(product.stock[store.id] ?? 0, product.confidence);
      return html`
        <li class="stock__row">
          <span class="stock__store">${store.name}</span>
          <span class="stock__state stock__state--${state.key}"
                data-store="${store.id}" data-sku="${product.sku}">
            <span class="stock__dot" aria-hidden="true"></span>${state.label}
          </span>
        </li>`;
    })}
  </ul>`;

const ProductCard = (product, { base }) => html`
  <li class="product" data-sku="${product.sku}" data-category="${product.category}"
      data-name="${product.name.toLowerCase()}"
      ${raw(stores.map((s) => `data-stock-${s.id.toLowerCase()}="${product.stock[s.id] ?? 0}"`).join(' '))}>
    <div class="product__head">
      <p class="product__category">${categoryName(product.category)}</p>
      <h3 class="product__name">
        <a href="${base}/shop/item/${product.sku.toLowerCase()}/">${product.name}</a>
      </h3>
      <p class="product__unit">${product.unit}</p>
    </div>
    <p class="product__price">${money(product.price)}</p>
    ${Availability(product, { compact: true })}
    <div class="product__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-add="${product.sku}"
              aria-label="Add ${product.name} to order">Add to order</button>
    </div>
  </li>`;

/** Browse and search the catalogue. */
export function shopIndex({ base }) {
  const inStockAnywhere = products.filter((p) => totalUnits(p) > 0).length;

  return {
    path: '/shop/',
    current: '/shop/',
    title: 'Shop & availability',
    description:
      'Browse what is on the shelf right now at Polar Express Stores in Pangnirtung and Qikiqtarjuaq, and reserve it for collection.',
    body: html`
      <section class="section section--dark shop-hero">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/subsidiaries/polar-express-stores/`, label: 'Polar Express Stores' },
            { label: 'Shop & availability' },
          ])}
          <p class="section__label">Polar Express Stores</p>
          <h1>What is on the shelf, right now</h1>
          <p class="section__intro">
            Live stock for both stores. Check before you make the trip, and reserve anything you
            want held for collection.
          </p>

          <div class="feed-status" data-feed-status aria-live="polite">
            <span class="feed-status__dot" aria-hidden="true"></span>
            <span data-feed-label>Stock as published by the store</span>
            <button type="button" class="feed-status__refresh" data-refresh>Refresh</button>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <form class="shop-controls" data-shop-controls role="search" aria-label="Filter the catalogue">
            <div class="field">
              <label class="field__label" for="shop-search">Search</label>
              <input type="search" id="shop-search" name="q" data-search
                     placeholder="Flour, ammunition, nappies…" autocomplete="off" />
            </div>

            <fieldset class="shop-controls__group">
              <legend class="field__label">Category</legend>
              <div class="chips">
                <span class="chip">
                  <input type="radio" name="category" id="cat-all" value="all" checked />
                  <label for="cat-all">All</label>
                </span>
                ${categories.map((category) => html`
                  <span class="chip">
                    <input type="radio" name="category" id="cat-${category.id}" value="${category.id}" />
                    <label for="cat-${category.id}">${category.name}</label>
                  </span>`)}
              </div>
            </fieldset>

            <fieldset class="shop-controls__group">
              <legend class="field__label">Availability</legend>
              <div class="chips">
                <span class="chip">
                  <input type="radio" name="availability" id="avail-all" value="all" checked />
                  <label for="avail-all">Everything</label>
                </span>
                ${stores.map((store) => html`
                  <span class="chip">
                    <input type="radio" name="availability" id="avail-${store.id}" value="${store.id}" />
                    <label for="avail-${store.id}">In stock in ${store.name}</label>
                  </span>`)}
              </div>
            </fieldset>

            <p class="shop-controls__count" data-result-count role="status">
              Showing all ${products.length} items. ${inStockAnywhere} are in stock somewhere.
            </p>
          </form>

          <h2 class="visually-hidden">Catalogue</h2>
          <ul class="product-grid" data-product-grid role="list">
            ${products.map((product) => ProductCard(product, { base }))}
          </ul>

          <p class="product-grid__empty" data-empty hidden>
            Nothing matches those filters. Try a different category, or clear the search.
          </p>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <div class="split split--wide">
            <div class="prose">
              <h2>How the stock count works</h2>
              <p>
                Counts come from the till as items are sold and received, and are republished
                through the day. Where a count has been checked against the shelf it is marked
                <strong>counted</strong>; where it is the till figure and nobody has verified it,
                the item says so.
              </p>
              <p>
                It is not a guarantee. A count can be wrong — a mis-scan, a damaged item, something
                put back on the wrong shelf. What it is, is a great deal better than driving over
                to find out.
              </p>
              <p>
                If you reserve an item and it turns out not to be there, you are not charged and
                the store will tell you when it is back.
              </p>
            </div>
            <div>
              ${Facts([
                ['Stores', stores.map((s) => s.name).join(' · ')],
                ['Items listed', String(products.length)],
                ['Updated', 'Through the trading day'],
                ['Reservation', 'Free, held to close the next day'],
                ['Payment', 'In store, at collection'],
              ], { label: 'Availability at a glance' })}
            </div>
          </div>
        </div>
      </section>`,
  };
}

/** One product, with full availability and store hours. */
export function productDetail(product, { base }) {
  const state = stores.map((store) => ({
    store,
    state: stockState(product.stock[store.id] ?? 0, product.confidence),
  }));
  const anywhere = totalUnits(product) > 0;

  return {
    path: `/shop/item/${product.sku.toLowerCase()}/`,
    current: '/shop/',
    title: product.name,
    description: `${product.name} (${product.unit}) at Polar Express Stores — ${money(product.price)}. Live availability for Pangnirtung and Qikiqtarjuaq.`,
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/shop/`, label: 'Shop' },
            { label: product.name },
          ])}
          <p class="section__label">${categoryName(product.category)}</p>
          <h1>${product.name}</h1>
          <p class="section__intro">${product.unit} · ${money(product.price)}</p>
          ${!anywhere ? html`
            <div class="status-notice">
              <p class="status-notice__head">Out of stock in both stores.</p>
              <p>
                You can still add it to an order — the store will contact you when it is back on
                the shelf rather than holding anything now.
              </p>
            </div>` : ''}
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split split--wide">
            <div>
              <h2>Availability</h2>
              <div class="table-scroll" tabindex="0" role="region" aria-label="Availability by store">
                <table>
                  <caption>Units on the shelf, by store.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Store</th><th scope="col">Availability</th>
                      <th scope="col">Count</th><th scope="col">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.map(({ store, state: s }) => html`
                      <tr>
                        <th scope="row">${store.name}</th>
                        <td>
                          <span class="stock__state stock__state--${s.key}"
                                data-store="${store.id}" data-sku="${product.sku}">
                            <span class="stock__dot" aria-hidden="true"></span>${s.label}
                          </span>
                        </td>
                        <td>${s.confidence === 'counted' ? 'Counted on the shelf' : 'From the till, unverified'}</td>
                        <td>${store.hours}</td>
                      </tr>`)}
                  </tbody>
                </table>
              </div>

              ${product.note ? html`
                <div class="callout" style="margin-top: var(--space-m)">
                  <p><strong>Note.</strong> ${product.note}</p>
                </div>` : ''}

              <div class="cta" style="margin-top: var(--space-l)">
                <h2 class="cta__title">Reserve this item</h2>
                <p>
                  Adding an item puts it on an order you confirm at the end. Nothing is charged
                  here — reserved items are held at the counter and paid for at collection.
                  ${shop.pickupNote}
                </p>
                <p class="cta__actions">
                  <button type="button" class="btn btn--primary" data-add="${product.sku}">Add to order</button>
                  <a class="btn btn--ghost" href="${base}/shop/order/">View order</a>
                </p>
              </div>
            </div>
            <div class="stack-l">
              ${Facts([
                ['Item code', product.sku],
                ['Size', product.unit],
                ['Price', money(product.price)],
                ['Category', categoryName(product.category)],
                ['Count source', product.confidence === 'counted' ? 'Shelf count' : 'Till, unverified'],
              ], { label: `${product.name} details` })}
              <p style="margin-top: var(--space-m)"><a href="${base}/shop/">← Back to everything</a></p>
            </div>
          </div>
        </div>
      </section>`,
  };
}

/** Review and submit a reservation. */
export function orderPage({ base }) {
  return {
    path: '/shop/order/',
    current: '/shop/',
    title: 'Your order',
    description: 'Review and confirm a Polar Express reservation for collection in store.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([
            { href: `${base}/`, label: 'Home' },
            { href: `${base}/shop/`, label: 'Shop' },
            { label: 'Your order' },
          ])}
          <p class="section__label">Reservation</p>
          <h1>Your order</h1>
          <p class="section__intro">
            Nothing is charged here. Reserved items are held at the counter and paid for when you
            collect them. ${shop.pickupNote}
          </p>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="split split--wide">
            <div>
              <h2>Items</h2>
              <div data-order-items>
                <p class="callout" data-order-empty>
                  Your order is empty. <a href="${base}/shop/">Browse what is in stock →</a>
                </p>
              </div>
            </div>
            <div>
              <h2>Collection</h2>
              <form class="form" id="order-form" data-order-form novalidate>
                <div class="form__grid">
                  <p class="field">
                    <label class="field__label" for="order-store">Collect from <span class="req" aria-hidden="true">*</span></label>
                    <select id="order-store" name="store" data-label="Collection store" required
                            aria-describedby="order-store-error">
                      ${stores.map((store) => html`<option value="${store.id}">${store.name}</option>`)}
                    </select>
                    <span class="field__error" id="order-store-error" role="alert"></span>
                  </p>
                  <p class="field">
                    <label class="field__label" for="order-name">Your name <span class="req" aria-hidden="true">*</span></label>
                    <input type="text" id="order-name" name="name" data-label="Your name" required
                           maxlength="100" autocomplete="name" aria-describedby="order-name-error" />
                    <span class="field__error" id="order-name-error" role="alert"></span>
                  </p>
                  <p class="field">
                    <label class="field__label" for="order-phone">Phone <span class="req" aria-hidden="true">*</span></label>
                    <span class="field__hint" id="order-phone-hint">So the store can tell you if something is not there after all.</span>
                    <input type="tel" id="order-phone" name="phone" data-label="Phone" required
                           maxlength="40" inputmode="tel" autocomplete="tel"
                           aria-describedby="order-phone-hint order-phone-error" />
                    <span class="field__error" id="order-phone-error" role="alert"></span>
                  </p>
                  <p class="field">
                    <label class="field__label" for="order-notes">Notes <span class="field__optional">(optional)</span></label>
                    <textarea id="order-notes" name="notes" rows="3" maxlength="500"
                              data-label="Notes" aria-describedby="order-notes-error"></textarea>
                    <span class="field__error" id="order-notes-error" role="alert"></span>
                  </p>
                </div>
                <div class="form__status" data-order-status role="status" aria-live="polite"></div>
                <p class="form__actions">
                  <button type="submit" class="btn btn--primary" data-order-submit>Confirm reservation</button>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>`,
  };
}
