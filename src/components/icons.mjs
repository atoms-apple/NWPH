import { raw } from '../lib/html.mjs';

/**
 * Sector marks.
 *
 * Line-drawn, single weight, on the same 24-unit grid as the corporate mark, so
 * the portfolio reads as one family rather than a set of borrowed pictograms.
 * Inline SVG: no requests, inherits currentColor, sharp at any size.
 */
const ICONS = {
  'Tourism & Expeditions':
    '<path d="M3 20h18"/><path d="M12 4 5.5 17h13L12 4Z"/><path d="M9.2 12.5h5.6"/>',
  'Technology & Communications':
    '<path d="M12 20V11"/><circle cx="12" cy="8.5" r="2"/><path d="M7.4 13.1a6 6 0 0 1 0-9.2"/><path d="M16.6 3.9a6 6 0 0 1 0 9.2"/><path d="M8.5 20h7"/>',
  'Retail & Supply':
    '<path d="M4 8h16l-1.2 12H5.2L4 8Z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/>',
  'Marine Freight & Logistics':
    '<path d="M4 15.5 5.5 11h13L20 15.5"/><path d="M12 11V6.5"/><path d="M8.5 6.5h7"/><path d="M3 18.5c1.8 0 1.8 1.5 3.6 1.5s1.8-1.5 3.6-1.5 1.8 1.5 3.6 1.5 1.8-1.5 3.6-1.5"/>',
  'Financial Services':
    '<path d="M3.5 9.5 12 5l8.5 4.5"/><path d="M6 11v6"/><path d="M12 11v6"/><path d="M18 11v6"/><path d="M4 19.5h16"/>',
  Aviation:
    '<path d="M12 3.5c1 0 1.6 1.2 1.6 3v3.2l6.4 3.6v2l-6.4-1.9v3.4l2.2 1.7v1.6L12 19.6l-3.8 1.5v-1.6l2.2-1.7v-3.4L4 16.3v-2l6.4-3.6V6.5c0-1.8.6-3 1.6-3Z"/>',
  'Real Estate & Housing':
    '<path d="M4 11 12 4.5 20 11"/><path d="M6 10.5V20h12v-9.5"/><path d="M10 20v-5h4v5"/>',
};

const FALLBACK = '<circle cx="12" cy="12" r="7.5"/><path d="M12 8.5v7"/>';

export const SectorIcon = (sector, { size = 28, className = 'sector-icon' } = {}) => raw(`
<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true" focusable="false">${ICONS[sector] ?? FALLBACK}</svg>`);

/**
 * Hero backdrop: contour lines, as on a chart.
 *
 * Generated rather than drawn, so it is a few hundred bytes of markup instead
 * of an image request, and it scales without a raster asset.
 */
export const ContourField = () => {
  const lines = [];
  for (let i = 0; i < 9; i++) {
    const y = 18 + i * 11;
    const amp = 5 + (i % 3) * 3;
    const phase = i * 0.7;
    let d = `M0 ${y}`;
    for (let x = 0; x <= 400; x += 20) {
      d += ` L${x} ${(y + Math.sin(x / 58 + phase) * amp).toFixed(1)}`;
    }
    lines.push(`<path d="${d}" opacity="${(0.5 - i * 0.04).toFixed(2)}"/>`);
  }
  return raw(`
<svg class="contours" viewBox="0 0 400 130" preserveAspectRatio="none" aria-hidden="true" focusable="false"
     fill="none" stroke="currentColor" stroke-width="0.6">${lines.join('')}</svg>`);
};
