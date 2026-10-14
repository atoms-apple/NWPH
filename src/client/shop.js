/*
 * Polar Express — browse, reserve, and keep stock current.
 *
 * Progressive enhancement, same as the rest of the site. Without this file the
 * catalogue is a complete server-rendered list with every store's count on the
 * page; what this adds is filtering, an order you can build up, and a stock
 * count that refreshes itself.
 *
 * Designed for a satellite connection: the feed is a few kilobytes, it is only
 * polled while the tab is visible, the last good copy is cached, and the app
 * states plainly when it is showing you something old.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var config = JSON.parse(document.getElementById('shop-config').textContent);
  var CART_KEY = 'pe.order.v1';
  var FEED_KEY = 'pe.inventory.v1';

  /* ── storage, which can throw in private windows ─────────────────────── */

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* not fatal */ }
  }

  /* ── stock presentation, mirroring src/lib/shop.mjs ──────────────────── */

  function stockState(units, lowAt) {
    if (units <= 0) return { key: 'out', label: 'Out of stock' };
    if (units <= lowAt) return { key: 'low', label: 'Low — ' + units + ' left' };
    return { key: 'in', label: 'In stock — ' + units };
  }

  function relativeTime(iso) {
    var seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (!isFinite(seconds)) return 'unknown';
    if (seconds < 90) return 'just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
    var days = Math.round(hours / 24);
    return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  }

  var money = function (value) {
    try {
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: config.currency }).format(value);
    } catch (e) { return '$' + value.toFixed(2); }
  };

  /* ── the order ───────────────────────────────────────────────────────── */

  var cart = read(CART_KEY) || {};

  function cartCount() {
    return Object.keys(cart).reduce(function (sum, sku) { return sum + cart[sku]; }, 0);
  }

  function saveCart() {
    write(CART_KEY, cart);
    paintCartBadges();
  }

  function paintCartBadges() {
    var count = cartCount();
    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-count]'), function (node) {
      node.textContent = String(count);
      node.hidden = count === 0;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-cart-label]'), function (node) {
      node.textContent = count === 0 ? 'Order' : 'Order (' + count + ')';
    });
  }

  function announce(message) {
    var live = document.querySelector('[data-shop-live]');
    if (live) live.textContent = message;
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-add]');
    if (!button) return;
    var sku = button.getAttribute('data-add');
    cart[sku] = (cart[sku] || 0) + 1;
    saveCart();
    var was = button.textContent;
    button.textContent = 'Added';
    button.classList.add('is-added');
    announce(sku + ' added to your order. ' + cartCount() + ' items on the order.');
    window.setTimeout(function () {
      button.textContent = was;
      button.classList.remove('is-added');
    }, 1600);
  });

  /* ── filtering ───────────────────────────────────────────────────────── */

  var grid = document.querySelector('[data-product-grid]');
  if (grid) {
    var controls = document.querySelector('[data-shop-controls]');
    var search = controls.querySelector('[data-search]');
    var countNode = controls.querySelector('[data-result-count]');
    var empty = document.querySelector('[data-empty]');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.product'));

    // The form only exists to group the controls; it must never navigate.
    controls.addEventListener('submit', function (event) { event.preventDefault(); });

    function currentValue(name) {
      var checked = controls.querySelector('input[name="' + name + '"]:checked');
      return checked ? checked.value : 'all';
    }

    function applyFilters() {
      var term = (search.value || '').trim().toLowerCase();
      var category = currentValue('category');
      var availability = currentValue('availability');
      var shown = 0;

      cards.forEach(function (card) {
        var matchesTerm = !term ||
          card.getAttribute('data-name').indexOf(term) !== -1 ||
          card.getAttribute('data-sku').toLowerCase().indexOf(term) !== -1;
        var matchesCategory = category === 'all' || card.getAttribute('data-category') === category;
        var matchesStock = availability === 'all' ||
          Number(card.getAttribute('data-stock-' + availability.toLowerCase()) || 0) > 0;

        var visible = matchesTerm && matchesCategory && matchesStock;
        card.hidden = !visible;
        if (visible) shown++;
      });

      empty.hidden = shown !== 0;
      countNode.textContent = shown === cards.length
        ? 'Showing all ' + cards.length + ' items.'
        : 'Showing ' + shown + ' of ' + cards.length + ' items.';
    }

    search.addEventListener('input', applyFilters);
    controls.addEventListener('change', applyFilters);
    applyFilters();
  }

  /* ── the live feed ───────────────────────────────────────────────────── */

  var statusBox = document.querySelector('[data-feed-status]');
  var statusLabel = document.querySelector('[data-feed-label]');

  function paintFeed(feed, fromCache) {
    if (!feed || !feed.items) return;
    var lowAt = typeof feed.lowStockAt === 'number' ? feed.lowStockAt : config.lowStockAt;

    feed.items.forEach(function (item) {
      Object.keys(item.stock).forEach(function (storeId) {
        var units = item.stock[storeId];
        var state = stockState(units, lowAt);

        var selector = '.stock__state[data-sku="' + item.sku + '"][data-store="' + storeId + '"]';
        Array.prototype.forEach.call(document.querySelectorAll(selector), function (node) {
          node.className = 'stock__state stock__state--' + state.key;
          node.innerHTML = '<span class="stock__dot" aria-hidden="true"></span>' + state.label;
        });

        // Keep the filter attributes in step, or "in stock here" goes stale.
        var card = document.querySelector('.product[data-sku="' + item.sku + '"]');
        if (card) card.setAttribute('data-stock-' + storeId.toLowerCase(), String(units));
      });
    });

    if (statusBox && feed.generatedAt) {
      var age = (Date.now() - new Date(feed.generatedAt).getTime()) / 60000;
      var stale = age > config.staleMinutes;
      statusBox.setAttribute('data-state', fromCache ? 'cached' : stale ? 'stale' : 'live');
      statusLabel.textContent = fromCache
        ? 'Showing a saved copy from ' + relativeTime(feed.generatedAt) + ' — you are offline'
        : (stale ? 'Last published ' : 'Stock updated ') + relativeTime(feed.generatedAt);
    }
  }

  function loadFeed(manual) {
    if (!statusBox) return Promise.resolve();
    if (!navigator.onLine) {
      var cached = read(FEED_KEY);
      if (cached) paintFeed(cached, true);
      else if (statusLabel) statusLabel.textContent = 'Offline, and no saved copy yet';
      if (statusBox) statusBox.setAttribute('data-state', 'cached');
      return Promise.resolve();
    }

    if (manual) statusLabel.textContent = 'Checking…';

    return fetch(config.inventoryEndpoint, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('feed ' + response.status);
        return response.json();
      })
      .then(function (feed) {
        write(FEED_KEY, feed);
        paintFeed(feed, false);
      })
      .catch(function () {
        var cached = read(FEED_KEY);
        if (cached) paintFeed(cached, true);
        else if (statusLabel) statusLabel.textContent = 'Could not reach the store just now';
      });
  }

  if (statusBox) {
    var refresh = statusBox.querySelector('[data-refresh]');
    if (refresh) refresh.addEventListener('click', function () { loadFeed(true); });

    loadFeed(false);

    // Poll only while the tab is visible. Nobody on a metered connection
    // should pay for updates to a page they are not looking at.
    var timer = null;
    function startPolling() {
      stopPolling();
      timer = window.setInterval(function () { loadFeed(false); }, config.pollSeconds * 1000);
    }
    function stopPolling() { if (timer) { window.clearInterval(timer); timer = null; } }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopPolling();
      else { loadFeed(false); startPolling(); }
    });
    window.addEventListener('online', function () { loadFeed(false); startPolling(); });
    window.addEventListener('offline', stopPolling);
    if (!document.hidden) startPolling();
  }

  /* ── the order page ──────────────────────────────────────────────────── */

  var orderItems = document.querySelector('[data-order-items]');
  if (orderItems) {
    var catalogue = JSON.parse(document.getElementById('shop-catalogue').textContent);
    var bySku = {};
    catalogue.forEach(function (item) { bySku[item.sku] = item; });

    function renderOrder() {
      var skus = Object.keys(cart).filter(function (sku) { return cart[sku] > 0 && bySku[sku]; });

      if (!skus.length) {
        orderItems.innerHTML =
          '<p class="callout">Your order is empty. <a href="' + config.base +
          '/shop/">Browse what is in stock →</a></p>';
        return;
      }

      var total = 0;
      var rows = skus.map(function (sku) {
        var item = bySku[sku];
        var line = item.price * cart[sku];
        total += line;
        return '<li class="order-line">' +
          '<div><p class="order-line__name">' + item.name + '</p>' +
          '<p class="order-line__unit">' + item.unit + ' · ' + money(item.price) + '</p></div>' +
          '<div class="order-line__qty">' +
          '<button type="button" class="qty" data-qty="-1" data-sku="' + sku +
          '" aria-label="One fewer ' + item.name + '">−</button>' +
          '<span aria-label="Quantity">' + cart[sku] + '</span>' +
          '<button type="button" class="qty" data-qty="1" data-sku="' + sku +
          '" aria-label="One more ' + item.name + '">+</button>' +
          '</div>' +
          '<p class="order-line__total">' + money(line) + '</p>' +
          '</li>';
      }).join('');

      orderItems.innerHTML =
        '<ul class="order-lines" role="list">' + rows + '</ul>' +
        '<p class="order-total"><span>Estimated total</span><strong>' + money(total) + '</strong></p>' +
        '<p class="field__hint">Prices are as published and may change before collection. ' +
        'Nothing is charged until you collect.</p>';
    }

    orderItems.addEventListener('click', function (event) {
      var button = event.target.closest('[data-qty]');
      if (!button) return;
      var sku = button.getAttribute('data-sku');
      cart[sku] = Math.max(0, (cart[sku] || 0) + Number(button.getAttribute('data-qty')));
      if (cart[sku] === 0) delete cart[sku];
      saveCart();
      renderOrder();
      announce('Order updated. ' + cartCount() + ' items.');
    });

    renderOrder();

    var form = document.querySelector('[data-order-form]');
    var status = document.querySelector('[data-order-status]');
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var fields = Array.prototype.slice.call(form.querySelectorAll('input, select, textarea'));
      var invalid = fields.filter(function (field) {
        var ok = field.checkValidity();
        field.setAttribute('aria-invalid', ok ? 'false' : 'true');
        var error = document.getElementById(field.id + '-error');
        if (error) {
          error.textContent = ok ? '' :
            (field.getAttribute('data-label') || 'This field') + ' is required.';
        }
        return !ok;
      });

      if (!Object.keys(cart).length) {
        status.innerHTML = '<div class="alert alert--error"><p class="alert__title">' +
          'Nothing to reserve</p><p>Add at least one item before confirming.</p></div>';
        return;
      }
      if (invalid.length) {
        status.innerHTML = '<div class="alert alert--error"><p class="alert__title">Check the form</p>' +
          '<p>' + invalid.length + (invalid.length === 1 ? ' field needs' : ' fields need') +
          ' attention.</p></div>';
        invalid[0].focus();
        return;
      }

      // No endpoint is configured in this model, so the app says what would
      // happen rather than pretending a reservation was taken.
      status.innerHTML = '<div class="alert alert--success"><p class="alert__title">' +
        'This is a demonstration</p><p>In the live app this would reach the store at ' +
        'the counter, which would confirm by phone and hold the items. Nothing has been ' +
        'sent, and your order is still saved on this device.</p></div>';
      status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  /* ── offline ─────────────────────────────────────────────────────────
     Registered from the shop only: the corporate pages do not need it, and a
     worker that caches more than it should is worse than none. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(config.base + '/sw.js', { scope: config.base + '/' })
        .catch(function () { /* offline support is an enhancement, not a requirement */ });
    });
  }

  paintCartBadges();
  root.classList.add('shop-ready');
})();
