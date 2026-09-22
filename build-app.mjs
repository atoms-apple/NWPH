#!/usr/bin/env node
/**
 * Build the North Winds Airlines app into dist/app/.
 *
 * The application code needs no bundling: it is native ES modules, and the
 * browsers this targets load them directly. What this script does is the work a
 * bundler would not do anyway — concatenate and minify the stylesheet, generate
 * the icons, stamp the service worker with a content hash and a precache list,
 * and copy the modules across.
 *
 * Every path the app emits is relative, so the whole directory can be served
 * from any prefix — a GitHub Pages subpath today, a domain later — with no
 * rebuild and no base to configure.
 */

import { mkdir, readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canvas } from './tools/png.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'app');
const out = path.join(root, 'dist', 'app');

/* ── Brand marks ─────────────────────────────────────────────────────────── */

const NAVY = [18, 41, 63];
const GOLD = [227, 205, 166];

/**
 * The mark: three curved strokes of wind over a compass point north.
 *
 * Drawn rather than stored so the same geometry produces every size, and the
 * maskable variant can pull the artwork into the safe area instead of being a
 * separate file someone forgets to update.
 */
function drawMark(size, { padding = 0.18, background = true } = {}) {
  const c = canvas(size);
  if (background) c.fill(NAVY);

  const inset = size * padding;
  const box = size - inset * 2;
  const stroke = Math.max(1, box * 0.075);

  // Three wind lines, longest in the middle.
  const lines = [
    [0.06, 0.32, 0.70, 0.32],
    [0.06, 0.50, 0.84, 0.50],
    [0.06, 0.68, 0.56, 0.68],
  ];
  for (const [x1, y1, x2, y2] of lines) {
    c.line(inset + x1 * box, inset + y1 * box, inset + x2 * box, inset + y2 * box, stroke, GOLD);
  }
  // The hooks that turn the lines into moving air.
  c.line(inset + 0.70 * box, inset + 0.32 * box, inset + 0.82 * box, inset + 0.18 * box, stroke, GOLD);
  c.line(inset + 0.84 * box, inset + 0.50 * box, inset + 0.94 * box, inset + 0.62 * box, stroke, GOLD);
  c.line(inset + 0.56 * box, inset + 0.68 * box, inset + 0.66 * box, inset + 0.80 * box, stroke, GOLD);

  return c;
}

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="North Winds Airlines">
  <rect width="64" height="64" rx="12" fill="#12293F"/>
  <g fill="none" stroke="#E3CDA6" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 25h27l7-8"/>
    <path d="M14 32h33l5 6"/>
    <path d="M14 39h22l5 6"/>
  </g>
</svg>
`;

/* ── Stylesheet ──────────────────────────────────────────────────────────── */

// Cascade order: tokens, then base, then layout, then components, then the
// airline-specific pieces that build on all of them.
const CSS_FILES = ['tokens.css', 'base.css', 'layout.css', 'components.css', 'hero.css', 'flight.css', 'print.css'];

/** Comments and redundant whitespace only — nothing that could change meaning. */
const minifyCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*\n\s*/g, '\n')
  .replace(/\n{2,}/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

/* ── File walking ────────────────────────────────────────────────────────── */

async function walk(dir, base = dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full, base)));
    else found.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return found;
}

async function copy(relative) {
  const target = path.join(out, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await readFile(path.join(source, relative)));
}

/* ── Build ───────────────────────────────────────────────────────────────── */

export async function buildApp({ quiet = false } = {}) {
  const started = Date.now();
  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, 'assets'), { recursive: true });

  // 1. Application modules, copied verbatim — they are already what the browser
  //    runs, and a readable stack trace is worth more than a few kilobytes.
  const modules = (await walk(path.join(source, 'src'))).map((file) => `src/${file}`);
  for (const file of modules) await copy(file);

  // 2. Stylesheet.
  const parts = [];
  for (const file of CSS_FILES) {
    parts.push(await readFile(path.join(source, 'styles', file), 'utf8'));
  }
  const css = minifyCss(parts.join('\n'));
  await writeFile(path.join(out, 'assets/app.css'), css);

  // 3. Shell and manifest.
  await copy('index.html');
  await copy('manifest.webmanifest');

  // 4. Icons.
  await writeFile(path.join(out, 'icon.svg'), markSvg);
  await writeFile(path.join(out, 'icon-192.png'), drawMark(192).toPng());
  await writeFile(path.join(out, 'icon-512.png'), drawMark(512).toPng());
  // Maskable icons are cropped to a circle by the platform, so the artwork sits
  // inside the 80% safe area with the background running to the edge.
  await writeFile(path.join(out, 'icon-maskable.png'), drawMark(512, { padding: 0.28 }).toPng());

  // 5. Service worker, stamped with a precache list and a content hash.
  const precache = [
    './',
    './index.html',
    './assets/app.css',
    './manifest.webmanifest',
    './icon.svg',
    './icon-192.png',
    './icon-512.png',
    ...modules.map((file) => `./${file}`),
  ];

  const hash = createHash('sha256');
  hash.update(css);
  for (const file of ['index.html', 'manifest.webmanifest', ...modules]) {
    hash.update(await readFile(path.join(source, file)));
  }
  const version = hash.digest('hex').slice(0, 12);

  const sw = (await readFile(path.join(source, 'sw.js'), 'utf8'))
    .replace('__BUILD_VERSION__', version)
    .replace('__PRECACHE__', JSON.stringify(precache, null, 2));
  await writeFile(path.join(out, 'sw.js'), sw);

  // 6. Report.
  let bytes = 0;
  for (const file of await walk(out)) bytes += (await stat(path.join(out, file))).size;

  if (!quiet) {
    console.log(`\n  North Winds app — ${Date.now() - started}ms`);
    console.log(`  ${modules.length} modules · CSS ${(css.length / 1024).toFixed(1)} KB · ${(bytes / 1024).toFixed(1)} KB total`);
    console.log(`  ${precache.length} files precached · build ${version}`);
    console.log(`  → dist/app/\n`);
  }

  return { modules: modules.length, bytes, version, precache };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildApp();
}
