#!/usr/bin/env node
/**
 * Download the self-hosted webfonts into public/fonts/.
 *
 * Run once, on a machine with network access:  npm run fetch-fonts
 * The files are then committed, so the build and CI never need the network.
 *
 * Google's css2 endpoint already splits each family by unicode-range, so the
 * `latin` file it serves is the subset — no font tooling required here. The
 * @font-face rules in src/styles/base.css declare the matching unicode-range.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public/fonts');

// A modern browser UA is required, otherwise the API returns legacy TTF.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const WANTED = [
  { family: 'Newsreader', weight: 400, file: 'newsreader-latin-400.woff2' },
  { family: 'Newsreader', weight: 600, file: 'newsreader-latin-600.woff2' },
  { family: 'Inter', weight: 400, file: 'inter-latin-400.woff2' },
  { family: 'Inter', weight: 600, file: 'inter-latin-600.woff2' },
];

// The unicode-range that identifies the plain `latin` block (not latin-ext).
const LATIN = 'U+0000-00FF';

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

async function main() {
  await mkdir(outDir, { recursive: true });

  for (const { family, weight, file } of WANTED) {
    const css = await fetchText(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
    );

    // Each @font-face block carries its own unicode-range; take the latin one.
    const block = css.split('@font-face').find((chunk) => chunk.includes(LATIN));
    if (!block) throw new Error(`No latin subset found for ${family} ${weight}`);

    const url = /src:\s*url\((https:\/\/[^)]+\.woff2)\)/.exec(block)?.[1];
    if (!url) throw new Error(`No woff2 URL for ${family} ${weight}`);

    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!response.ok) throw new Error(`${response.status} downloading ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(path.join(outDir, file), bytes);
    console.log(`  ${file} — ${(bytes.length / 1024).toFixed(1)} KB`);
  }

  console.log('\n  Done. Commit public/fonts/ so CI does not need the network.\n');
}

main().catch((error) => {
  console.error(`\n  Font download failed: ${error.message}`);
  console.error('  The site still builds and renders on its fallback stacks.\n');
  process.exit(1);
});
