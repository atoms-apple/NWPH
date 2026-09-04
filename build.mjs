#!/usr/bin/env node
/**
 * Static site build. No dependencies — Node built-ins only.
 *
 * Order matters: content is validated before anything is rendered, so a bad
 * status value fails the build before it can reach a page.
 */

import { mkdir, readFile, writeFile, readdir, copyFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { site } from './src/data/site.mjs';
import { collections } from './src/content.config.mjs';
import { loadCollection, loadDrafts } from './src/lib/collections.mjs';
import { operatingCount, STATUS_VALUES } from './src/data/status.mjs';
import { ValidationError } from './src/lib/schema.mjs';
import { BaseLayout } from './src/layouts/base.mjs';
import { faviconSvg } from './src/components/logo.mjs';

import homePage from './src/pages/index.mjs';
import aboutPage from './src/pages/about.mjs';
import { subsidiariesIndex, subsidiaryDetail } from './src/pages/subsidiaries.mjs';
import procurementPage from './src/pages/procurement.mjs';
import careersPage from './src/pages/careers.mjs';
import contactPage from './src/pages/contact.mjs';
import { newsIndex, newsDetail } from './src/pages/news.mjs';
import { thankYouPage, notFoundPage } from './src/pages/static.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const base = site.base;

/* ── Asset pipeline ──────────────────────────────────────────────────────── */

// Order is cascade order: tokens, then base, then layout, then components.
const CSS_FILES = ['tokens.css', 'base.css', 'layout.css', 'components.css', 'forms.css', 'print.css'];

/** Conservative minifier: strips comments and collapses whitespace only. */
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function buildStyles() {
  const parts = [];
  for (const file of CSS_FILES) {
    parts.push(await readFile(path.join(root, 'src/styles', file), 'utf8'));
  }
  const printHost = site.origin.replace(/^https?:\/\//, '');
  const css = minifyCss(parts.join('\n')).replaceAll('__PRINT_HOST__', printHost);
  await writeFile(path.join(dist, 'assets/site.css'), css);
  return css.length;
}

async function buildScripts() {
  const js = await readFile(path.join(root, 'src/client/enhance.js'), 'utf8');
  // Left unminified: it is small, and a readable script a maintainer can open
  // in devtools is worth more here than the few hundred bytes gzip recovers.
  await writeFile(path.join(dist, 'assets/enhance.js'), js);
  return js.length;
}

/** Copy public/ verbatim. */
async function copyPublic() {
  const source = path.join(root, 'public');
  let copied = 0;
  async function walk(dir, target) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    await mkdir(target, { recursive: true });
    for (const entry of entries) {
      const from = path.join(dir, entry.name);
      const to = path.join(target, entry.name);
      if (entry.isDirectory()) await walk(from, to);
      else { await copyFile(from, to); copied++; }
    }
  }
  await walk(source, dist);
  return copied;
}

/* ── Page writing ────────────────────────────────────────────────────────── */

async function writePage(page, stats) {
  const file = page.path.endsWith('.html')
    ? path.join(dist, page.path)
    : path.join(dist, page.path, 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, BaseLayout({ ...page, stats }));
  return { path: page.path, bytes: (await stat(file)).size };
}

/* ── SEO ─────────────────────────────────────────────────────────────────── */

function sitemap(paths) {
  const urls = paths
    .filter((p) => !p.endsWith('.html'))
    .map((p) => `  <url><loc>${site.origin}${base}${p}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const robots = () =>
  `User-agent: *\nAllow: /\nDisallow: /thank-you/\n\nSitemap: ${site.origin}${base}/sitemap.xml\n`;

/** Favicon — the same mark the header and footer use. */
const favicon = faviconSvg;

/* ── Build ───────────────────────────────────────────────────────────────── */

async function build() {
  const started = Date.now();
  await rm(dist, { recursive: true, force: true });
  await mkdir(path.join(dist, 'assets'), { recursive: true });

  // 1. Content — validated before a single page renders.
  const loaded = {};
  for (const [name, config] of Object.entries(collections)) {
    loaded[name] = await loadCollection(name, config.schema, { sort: config.sort });
  }
  const { subsidiaries, people, roles, procurement, faq, news, milestones } = loaded;

  // 2. Derived statistics. Never authored by hand — see src/data/status.mjs.
  const stats = {
    headquarters: site.headquarters,
    total: subsidiaries.length,
    operating: operatingCount(subsidiaries),
    byStatus: Object.fromEntries(
      STATUS_VALUES.map((value) => [value, subsidiaries.filter((s) => s.status === value).length]),
    ),
  };

  // 3. Pages.
  const pages = [
    homePage({ subsidiaries, stats, base }),
    aboutPage({ people, stats, base }),
    subsidiariesIndex({ subsidiaries, stats, base }),
    // Only named ventures get a detail page. An unnamed one has nothing to put
    // on it beyond its sector and stage, both already on the index.
    ...subsidiaries
      .filter((subsidiary) => subsidiary.name)
      .map((subsidiary) => subsidiaryDetail(subsidiary, {
        stats,
        base,
        milestones: milestones.filter((milestone) => milestone.venture === subsidiary.name),
      })),
    procurementPage({ tiers: procurement, faq, base }),
    careersPage({ roles, base }),
    newsIndex({ news, base }),
    ...news.map((entry) => newsDetail(entry, { base })),
    contactPage({ base }),
    thankYouPage({ base }),
    notFoundPage({ base }),
  ];

  const written = [];
  for (const page of pages) written.push(await writePage(page, stats));

  // 4. Assets and SEO files.
  const cssBytes = await buildStyles();
  const jsBytes = await buildScripts();
  await writeFile(path.join(dist, 'sitemap.xml'), sitemap(pages.filter((p) => !p.noindex).map((p) => p.path)));
  await writeFile(path.join(dist, 'robots.txt'), robots());
  await writeFile(path.join(dist, 'favicon.svg'), favicon());
  // Tell GitHub Pages not to run Jekyll over the output.
  await writeFile(path.join(dist, '.nojekyll'), '');
  const publicFiles = await copyPublic();

  // 5. Report.
  const drafts = [];
  for (const [name, config] of Object.entries(collections)) {
    drafts.push(...(await loadDrafts(name, config.schema)));
  }

  const totalHtml = written.reduce((sum, page) => sum + page.bytes, 0);
  console.log(`\n  NWPH build — ${Date.now() - started}ms`);
  console.log(`  ${written.length} pages · ${(totalHtml / 1024).toFixed(1)} KB HTML`);
  console.log(`  CSS ${(cssBytes / 1024).toFixed(1)} KB · JS ${(jsBytes / 1024).toFixed(1)} KB · ${publicFiles} public file(s)`);
  const named = subsidiaries.filter((s) => s.name).length;
  console.log(`  Portfolio: ${stats.total} ventures — ${stats.operating} operating (${STATUS_VALUES.map((v) => `${stats.byStatus[v]} ${v}`).join(', ')})`);
  console.log(`  ${named} named, ${stats.total - named} published by sector only`);

  const fonts = await readdir(path.join(root, 'public/fonts')).catch(() => []);
  if (!fonts.some((file) => file.endsWith('.woff2'))) {
    console.log('\n  Note: no webfonts in public/fonts — the site will render on fallback stacks.');
    console.log('        Run `npm run fetch-fonts` on a machine with network access.');
  }
  if (drafts.length) {
    console.log(`\n  ${drafts.length} draft entr${drafts.length === 1 ? 'y' : 'ies'} excluded from the build:`);
    for (const draft of drafts) console.log(`    · ${draft.title ?? '(untitled)'} — ${draft.file}`);
  }
  console.log('');
}

try {
  await build();
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`\n  Build failed — content did not validate.\n`);
    console.error(error.message);
    console.error('');
    process.exit(1);
  }
  throw error;
}
