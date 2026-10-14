/*
 * NWPH OS progressive enhancement. Every feature works without this file:
 * forms are real POSTs, the mobile menu is a native <details>, filters are GET
 * forms. This adds confirmation dialogs, auto-submitting selects and menu
 * keyboard handling.
 */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  // Confirmation for destructive or significant actions.
  document.addEventListener('submit', function (event) {
    var form = event.target;
    var message = form && form.getAttribute && form.getAttribute('data-confirm');
    if (message && !window.confirm(message)) event.preventDefault();
  });

  // Selects marked data-autosubmit submit their form on change.
  document.addEventListener('change', function (event) {
    var el = event.target;
    if (!el || !el.hasAttribute || !el.hasAttribute('data-autosubmit')) return;
    var form = el.form;
    if (!form) return;
    if (form.getAttribute('data-confirm') && !window.confirm(form.getAttribute('data-confirm'))) return;
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.submit();
  });

  // Mobile menu: Escape and outside click close it.
  var menu = document.querySelector('[data-menu]');
  if (menu) {
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  }

  // Focus the first invalid field after a failed submission.
  var firstError = document.querySelector('.field--error input, .field--error select, .field--error textarea');
  if (firstError) firstError.focus();
})();
