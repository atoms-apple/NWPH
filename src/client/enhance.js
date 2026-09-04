/*
 * Progressive enhancement only.
 *
 * Every interaction on this site works before this file loads:
 *  - the mobile nav is a native <details> disclosure;
 *  - the accordion is native <details>;
 *  - the subsidiary filter is CSS-only, driven by radio inputs and :has();
 *  - the tab group renders as in-page links with every panel visible;
 *  - forms are real <form method="post"> submissions.
 *
 * This script improves those. It never creates the only path to content.
 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ── Mobile navigation ───────────────────────────────────────────────── */
  var navToggle = document.querySelector('[data-nav-toggle]');
  if (navToggle) {
    var summary = navToggle.querySelector('summary');

    var close = function (refocus) {
      if (!navToggle.open) return;
      navToggle.open = false;
      if (refocus && summary) summary.focus();
    };

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close(true);
    });

    document.addEventListener('click', function (event) {
      if (navToggle.open && !navToggle.contains(event.target)) close(false);
    });

    // Trap nothing, but do move focus into the panel so the first link is next
    // in the tab order rather than whatever follows the header.
    navToggle.addEventListener('toggle', function () {
      if (!navToggle.open) return;
      var first = navToggle.querySelector('.nav-toggle__panel a');
      if (first) first.focus({ preventScroll: true });
    });
  }

  /* ── Tab groups ──────────────────────────────────────────────────────────
     Upgrades the no-JS link list into a WAI-ARIA tabs pattern: roving
     tabindex, arrow/Home/End keys, and only the selected panel exposed. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'), function (group) {
    var tabs = Array.prototype.slice.call(group.querySelectorAll('.tabs__tab'));
    var panels = tabs.map(function (tab) {
      return document.getElementById(tab.getAttribute('href').slice(1));
    });
    if (!tabs.length || panels.indexOf(null) !== -1) return;

    var list = group.querySelector('.tabs__list');
    list.setAttribute('role', 'tablist');
    var label = group.getAttribute('data-tabs-label');
    if (label) list.setAttribute('aria-label', label);
    Array.prototype.forEach.call(list.children, function (li) { li.setAttribute('role', 'presentation'); });

    var select = function (index, focus) {
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.setAttribute('tabindex', selected ? '0' : '-1');
        panels[i].hidden = !selected;
      });
      if (focus) tabs[index].focus();
    };

    tabs.forEach(function (tab, index) {
      tab.setAttribute('role', 'tab');
      tab.id = tab.id || 'tab-' + panels[index].id;
      tab.setAttribute('aria-controls', panels[index].id);
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', tab.id);
      // Panels hold headings and prose, so they must be reachable by keyboard.
      panels[index].setAttribute('tabindex', '0');

      tab.addEventListener('click', function (event) {
        event.preventDefault();
        select(index, false);
      });

      tab.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        select(next, true);
      });
    });

    // Honour a deep link to a panel, otherwise select the first.
    var fromHash = panels.findIndex(function (panel) { return '#' + panel.id === window.location.hash; });
    select(fromHash > -1 ? fromHash : 0, false);
  });

  /* ── Filter result announcement ──────────────────────────────────────────
     The filtering itself is CSS. This only reports the outcome to screen
     reader users, who otherwise get no feedback that anything changed. */
  var browser = document.querySelector('[data-filter-scope]');
  if (browser) {
    var output = browser.querySelector('[data-filter-count]');
    var cards = Array.prototype.slice.call(browser.querySelectorAll('[data-status]'));
    var radios = Array.prototype.slice.call(browser.querySelectorAll('input[name="status-filter"]'));

    var report = function () {
      if (!output) return;
      var checked = radios.filter(function (radio) { return radio.checked; })[0];
      var value = checked ? checked.value : 'all';
      var shown = value === 'all'
        ? cards.length
        : cards.filter(function (card) { return card.getAttribute('data-status') === value; }).length;
      output.textContent = shown === cards.length
        ? 'Showing all ' + cards.length + ' subsidiaries.'
        : 'Showing ' + shown + ' of ' + cards.length + ' subsidiaries.';
    };

    radios.forEach(function (radio) { radio.addEventListener('change', report); });
    report();
  }

  /* ── Forms ───────────────────────────────────────────────────────────────
     Client-side validation mirrors the server rules. It is a convenience, not
     the enforcement point — the endpoint validates independently. */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-validate]'), function (form) {
    var status = form.querySelector('[data-form-status]');
    var started = Date.now();
    var elapsed = form.querySelector('input[name="elapsed"]');

    var messageFor = function (field) {
      var validity = field.validity;
      var label = field.getAttribute('data-label') || 'This field';
      if (validity.valueMissing) return label + ' is required.';
      if (validity.typeMismatch && field.type === 'email') return 'Enter an email address, like name@example.com.';
      if (validity.tooShort) return label + ' must be at least ' + field.minLength + ' characters.';
      if (validity.tooLong) return label + ' must be ' + field.maxLength + ' characters or fewer.';
      if (validity.patternMismatch) return field.getAttribute('data-pattern-message') || ('Check the format of ' + label.toLowerCase() + '.');
      return label + ' is not valid.';
    };

    var showError = function (field, message) {
      var error = document.getElementById(field.id + '-error');
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (error) error.textContent = message || '';
    };

    var validateField = function (field) {
      if (field.checkValidity()) { showError(field, ''); return true; }
      showError(field, messageFor(field));
      return false;
    };

    var fields = Array.prototype.slice.call(form.querySelectorAll('input, textarea, select'))
      .filter(function (field) { return field.type !== 'hidden' && !field.closest('.hp'); });

    fields.forEach(function (field) {
      // Validate on blur, then live once a field has been marked invalid —
      // never while the user is still typing a first attempt.
      field.addEventListener('blur', function () { validateField(field); });
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') validateField(field);
      });
    });

    form.addEventListener('submit', function (event) {
      if (elapsed) elapsed.value = String(Math.round((Date.now() - started) / 1000));

      var invalid = fields.filter(function (field) { return !validateField(field); });
      if (!invalid.length) return;

      event.preventDefault();
      if (status) {
        status.innerHTML =
          '<div class="alert alert--error"><p class="alert__title">Check the form</p>' +
          '<p>' + invalid.length + (invalid.length === 1 ? ' field needs' : ' fields need') +
          ' attention before this can be sent.</p></div>';
      }
      invalid[0].focus();
    });
  });
})();
