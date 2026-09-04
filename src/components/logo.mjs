import { raw } from '../lib/html.mjs';

/**
 * The NWPH mark: a north chevron above the line of the passage.
 *
 * Inline SVG rather than an image file — it costs no request, inherits
 * currentColor, and stays sharp at every size. Kept to two strokes so it holds
 * together at 20px in a browser tab.
 */
export const Mark = ({ size = 28, className = 'mark' } = {}) => raw(`
<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter"
     aria-hidden="true" focusable="false">
  <path d="M2.5 14 L12 4.5 L21.5 14" />
  <path d="M2.5 19.5 H21.5" />
</svg>`);

/** The same mark as a standalone favicon document. */
export const faviconSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
  `<rect width="24" height="24" fill="#1B3A5C"/>` +
  `<g fill="none" stroke="#E3CDA6" stroke-width="2.4" stroke-linecap="square">` +
  `<path d="M3 14 L12 5 L21 14"/><path d="M3 19 H21"/>` +
  `</g></svg>\n`;
