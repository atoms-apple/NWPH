#!/usr/bin/env node
/**
 * Build verification: colour contrast against the token system, plus static
 * accessibility and SEO checks over the generated HTML.
 *
 * No dependencies. Run with `npm run check` after `npm run build`.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/data/site.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

let failures = 0;
let warnings = 0;
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };
const warn = (msg) => { warnings++; console.log(`  WARN  ${msg}`); };
const pass = (msg) => console.log(`  ok    ${msg}`);

/* ── Contrast ────────────────────────────────────────────────────────────── */

const srgb = (hex) => {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};

const luminance = (hex) => {
  const [r, g, b] = srgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const TOKENS = {
  navy: '#1B3A5C', ice: '#2E6E8E', gold: '#B08D57', paper: '#F7F7F5', white: '#FFFFFF',
  goldText: '#8A6D3B', goldLight: '#E3CDA6', tint: '#ECEFF2', ink: '#1B2733',
  inkMuted: '#5A646E', onDark: '#FFFFFF', onDarkMuted: '#B9C6D4',
  statusDev: '#1F6B4E', statusDevDark: '#6FD3A6', error: '#8C2618', navyStat: '#16304C',
};

// [label, foreground, background, minimum ratio]
const PAIRS = [
  ['body text on paper', TOKENS.ink, TOKENS.paper, 4.5],
  ['body text on white', TOKENS.ink, TOKENS.white, 4.5],
  ['muted text on paper', TOKENS.inkMuted, TOKENS.paper, 4.5],
  ['muted text on white', TOKENS.inkMuted, TOKENS.white, 4.5],
  ['muted text on tint', TOKENS.inkMuted, TOKENS.tint, 4.5],
  ['headings (navy) on paper', TOKENS.navy, TOKENS.paper, 4.5],
  ['links (ice) on paper', TOKENS.ice, TOKENS.paper, 4.5],
  ['links (ice) on white', TOKENS.ice, TOKENS.white, 4.5],
  ['gold text token on paper', TOKENS.goldText, TOKENS.paper, 4.5],
  ['gold text token on white', TOKENS.goldText, TOKENS.white, 4.5],
  ['white on navy', TOKENS.onDark, TOKENS.navy, 4.5],
  ['muted on navy', TOKENS.onDarkMuted, TOKENS.navy, 4.5],
  ['gold-light on navy', TOKENS.goldLight, TOKENS.navy, 4.5],
  ['gold-light on stat panel', TOKENS.goldLight, TOKENS.navyStat, 4.5],
  ['status "in development" on white', TOKENS.statusDev, TOKENS.white, 4.5],
  ['status "in development" on navy', TOKENS.statusDevDark, TOKENS.navy, 4.5],
  ['error text on white', TOKENS.error, TOKENS.white, 4.5],
  ['focus ring (navy) on paper', TOKENS.navy, TOKENS.paper, 3],
  ['focus ring (white) on navy', TOKENS.white, TOKENS.navy, 3],
  ['selected-tab indicator on paper', TOKENS.goldText, TOKENS.paper, 3],
  ['accordion expand icon on paper', TOKENS.goldText, TOKENS.paper, 3],
];

// Uses the palette deliberately excludes, kept here so a regression is caught.
const FORBIDDEN = [
  ['brand gold as text on white', TOKENS.gold, TOKENS.white, 4.5],
  ['brand gold as text on paper', TOKENS.gold, TOKENS.paper, 4.5],
  ['brand gold as a state indicator on paper', TOKENS.gold, TOKENS.paper, 3],
];

function checkContrast() {
  console.log('\nContrast (WCAG 2.2)');
  for (const [label, fg, bg, min] of PAIRS) {
    const ratio = contrast(fg, bg);
    const line = `${label} — ${ratio.toFixed(2)}:1 (needs ${min}:1)`;
    if (ratio >= min) pass(line); else fail(line);
  }
  console.log('\nBrand gold: roles it is excluded from');
  for (const [label, fg, bg, min] of FORBIDDEN) {
    const ratio = contrast(fg, bg);
    const verdict = ratio >= min ? 'ABOVE' : 'below';
    console.log(`  note  ${label} — ${ratio.toFixed(2)}:1, ${verdict} ${min}:1 — purely decorative rules only`);
  }
}

/* ── HTML checks ─────────────────────────────────────────────────────────── */

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const matchAll = (html, re) => [...html.matchAll(re)];

function checkDocument(file, html) {
  const rel = path.relative(dist, file);
  const problem = (msg) => fail(`${rel}: ${msg}`);

  if (!/<html lang="en-CA">/.test(html)) problem('missing lang on <html>');
  if (!/<title>.+<\/title>/.test(html)) problem('missing <title>');
  const description = /<meta name="description" content="([^"]*)"/.exec(html);
  if (!description || description[1].length < 50) problem('missing or short meta description');
  if (!/<link rel="canonical"/.test(html)) problem('missing canonical link');

  // Landmarks
  if (!/<main id="main">/.test(html)) problem('missing <main> landmark');
  if (!/<header class="site-header">/.test(html)) problem('missing <header> landmark');
  if (!/<footer class="site-footer">/.test(html)) problem('missing <footer> landmark');
  if (!/class="skip-link"/.test(html)) problem('missing skip link');

  // Exactly one h1
  const h1s = matchAll(html, /<h1[\s>]/g).length;
  if (h1s !== 1) problem(`expected exactly one <h1>, found ${h1s}`);

  // Heading order must not skip a level
  const levels = matchAll(html, /<h([1-4])[\s>]/g).map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      problem(`heading level jumps from h${levels[i - 1]} to h${levels[i]}`);
      break;
    }
  }

  // Duplicate ids
  const ids = matchAll(html, /\sid="([^"]+)"/g).map((m) => m[1]);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) problem(`duplicate id(s): ${[...new Set(duplicates)].join(', ')}`);

  // Every form control has an associated label
  for (const control of matchAll(html, /<(input|select|textarea)\b[^>]*>/g)) {
    const tag = control[0];
    if (/type="(hidden|submit|button)"/.test(tag)) continue;
    const id = /\sid="([^"]+)"/.exec(tag)?.[1];
    if (!id) { problem(`form control without id: ${tag.slice(0, 60)}`); continue; }
    if (!new RegExp(`<label[^>]*for="${id}"`).test(html)) problem(`no <label for="${id}">`);
  }

  // aria-describedby / aria-controls / aria-labelledby targets must exist
  for (const ref of matchAll(html, /aria-(describedby|controls|labelledby)="([^"]+)"/g)) {
    for (const target of ref[2].split(/\s+/)) {
      if (!ids.includes(target)) problem(`aria-${ref[1]} points at missing id "${target}"`);
    }
  }

  // Images need alt
  for (const img of matchAll(html, /<img\b[^>]*>/g)) {
    if (!/\salt=/.test(img[0])) problem(`<img> without alt: ${img[0].slice(0, 60)}`);
  }

  // Links need an href and discernible text
  for (const link of matchAll(html, /<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    if (!/\shref="[^"]+"/.test(link[1])) problem('anchor without href');
    const text = link[2].replace(/<[^>]*>/g, '').trim();
    if (!text && !/aria-label=/.test(link[1])) problem('link with no discernible text');
  }

  // Buttons need discernible text
  for (const button of matchAll(html, /<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const text = button[2].replace(/<[^>]*>/g, '').trim();
    if (!text && !/aria-label=/.test(button[1])) problem('button with no discernible text');
  }

  // Tables need a caption or accessible name, and header cells
  for (const table of matchAll(html, /<table\b[\s\S]*?<\/table>/g)) {
    if (!/<caption>/.test(table[0])) problem('table without <caption>');
    if (!/<th\b/.test(table[0])) problem('table without <th>');
  }

  // The honesty statement must survive on every page that carries the footer
  // Wording-agnostic so the guard survives a copy change, but the derived
  // "N of M operating" statement still has to be on every page.
  if (!/\d+ of \d+ (ventures|companies) are (currently )?operating/.test(html)) {
    problem('footer operating-count statement is missing');
  }

  // No inline event handlers or javascript: URLs
  if (/\son(click|load|error|submit)=/.test(html)) problem('inline event handler present');
  if (/href="javascript:/.test(html)) problem('javascript: URL present');
}

async function checkHtml() {
  console.log('\nHTML, accessibility and metadata');
  const files = await htmlFiles(dist);
  const before = failures;
  for (const file of files) checkDocument(file, await readFile(file, 'utf8'));
  if (failures === before) pass(`${files.length} pages passed all structural checks`);

  // Internal links must resolve to a built page
  console.log('\nInternal links');
  const known = new Set(files.map((f) => '/' + path.relative(dist, f).replace(/index\.html$/, '').replace(/\\/g, '/')));
  let broken = 0;
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    for (const link of matchAll(html, /href="(\/[^"#?]*)/g)) {
      // Links carry the deployment base prefix; dist/ paths do not.
      if (site.base && !link[1].startsWith(site.base)) {
        fail(`${path.relative(dist, file)}: link ${link[1]} is missing the base prefix ${site.base}`);
        broken++;
        continue;
      }
      const stripped = site.base ? link[1].slice(site.base.length) || '/' : link[1];
      const target = stripped.endsWith('/') ? stripped : stripped + '/';
      const isAsset = /\.(css|js|svg|xml|txt|woff2?|png|jpg)\/?$/.test(stripped);
      if (isAsset || known.has(target) || known.has(stripped)) continue;
      fail(`${path.relative(dist, file)}: broken internal link ${link[1]}`);
      broken++;
    }
  }
  if (!broken) pass('all internal links resolve');
}

/* ── Output weight ───────────────────────────────────────────────────────── */

async function checkWeight() {
  console.log('\nPage weight (matters on metered satellite connections)');
  const files = await htmlFiles(dist);
  const css = (await readFile(path.join(dist, 'assets/site.css'), 'utf8')).length;
  const js = (await readFile(path.join(dist, 'assets/enhance.js'), 'utf8')).length;
  let largest = 0;
  for (const file of files) largest = Math.max(largest, (await readFile(file)).length);
  const total = largest + css + js;
  const line = `heaviest page ${(largest / 1024).toFixed(1)} KB + CSS ${(css / 1024).toFixed(1)} KB + JS ${(js / 1024).toFixed(1)} KB = ${(total / 1024).toFixed(1)} KB uncompressed`;
  if (total < 150 * 1024) pass(line); else warn(line);
  if (js === 0) warn('no client JS emitted');
}

checkContrast();
await checkHtml();
await checkWeight();

console.log(`\n${failures} failure(s), ${warnings} warning(s)\n`);
process.exit(failures ? 1 : 0);
