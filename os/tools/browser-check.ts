/**
 * Real-browser check at desktop and iPhone widths. Starts NWPH OS on a
 * temporary database with example records, signs in, visits the main pages,
 * fails on horizontal page overflow or console errors, and saves screenshots
 * to test-results/.
 *
 *   npm run e2e            (needs Playwright; uses PLAYWRIGHT_BROWSERS_PATH)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { startApp, PASSWORD } from '../test/helpers.ts';
import { addExamples } from '../src/domain/examples.ts';

// Playwright is optional (not a project dependency), so it is typed loosely here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Playwright = { chromium: any };

function loadPlaywright(): Playwright {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

const { chromium } = loadPlaywright();
const OUT = path.resolve(import.meta.dirname, '..', 'test-results');
fs.mkdirSync(OUT, { recursive: true });

const app = await startApp();
addExamples({ id: null, name: 'Browser check' });
const browser = await chromium.launch();
const problems: string[] = [];

const PAGES: Array<[string, string]> = [
  ['dashboard', '/'],
  ['portfolio', '/ventures'],
  ['portfolio-list', '/ventures?view=list'],
  ['workspace', '/ventures/polar-express'],
  ['workspace-plan', '/ventures/polar-express/plan'],
  ['workspace-finance', '/ventures/polar-express/finance'],
  ['workspace-settings', '/ventures/polar-express/settings'],
  ['tasks', '/projects?view=tasks'],
  ['board', '/projects?view=board'],
  ['finance', '/finance'],
  ['decisions', '/decisions'],
  ['documents', '/documents'],
  ['opportunities', '/opportunities'],
  ['risks', '/risks'],
  ['activity', '/activity'],
  ['task-form', '/tasks/new'],
  ['settings', '/settings'],
];

for (const [label, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['iphone', { width: 390, height: 844 }],
] as const) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: label === 'iphone' ? 2 : 1, isMobile: label === 'iphone', hasTouch: label === 'iphone' });
  const page = await context.newPage();
  page.on('console', (m: { type(): string; text(): string }) => {
    if (m.type() === 'error') problems.push(`${label}: console error: ${m.text()}`);
  });
  page.on('pageerror', (e: Error) => problems.push(`${label}: page error: ${e.message}`));

  await page.goto(app.base + '/login');
  await page.fill('#email', 'owner@example.test');
  await page.fill('#password', PASSWORD);
  await Promise.all([page.waitForURL(app.base + '/'), page.click('button[type=submit]')]);

  for (const [name, url] of PAGES) {
    const res = await page.goto(app.base + url);
    if (res?.status() !== 200) problems.push(`${label} ${url}: HTTP ${res?.status()}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) problems.push(`${label} ${url}: page overflows horizontally by ${overflow}px`);
    await page.screenshot({ path: path.join(OUT, `${label}-${name}.png`), fullPage: name === 'dashboard' || name === 'workspace' });
  }

  if (label === 'iphone') {
    // The mobile menu opens and navigates.
    await page.goto(app.base + '/');
    await page.click('.menu__toggle');
    await page.screenshot({ path: path.join(OUT, 'iphone-menu.png') });
    await Promise.all([page.waitForURL(/\/decisions$/), page.click('.menu__panel a[href="/decisions"]')]);
  } else {
    // Auto-submitting status select and confirmation dialog work with JS.
    await page.goto(app.base + '/projects?view=tasks');
    const select = page.locator('.status-form select').first();
    const formAction = await page.locator('.status-form').first().getAttribute('action');
    await Promise.all([page.waitForLoadState('load'), select.selectOption('in_progress')]);
    await page.waitForSelector('.notice--success');
    if (!formAction) problems.push('desktop: no status form found');
    let dialogSeen = false;
    page.once('dialog', async (d: { dismiss(): Promise<void> }) => {
      dialogSeen = true;
      await d.dismiss();
    });
    await page.goto(app.base + '/ventures/polar-express/settings');
    await page.click('form[action$="/archive"] button');
    if (!dialogSeen) problems.push('desktop: archive did not ask for confirmation');
  }
  await context.close();
}

await browser.close();
await app.close();

if (problems.length) {
  console.error('Browser check found problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`Browser check passed. Screenshots in ${OUT}`);
