#!/usr/bin/env node
/** Static file server for local preview. Node built-ins only. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/data/site.mjs';

const dist = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'dist');
const port = Number(process.env.PORT || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  // Mirror the deployment base prefix so local preview matches production.
  if (site.base && url.startsWith(site.base)) url = url.slice(site.base.length) || '/';
  const candidates = url.endsWith('/') ? [path.join(dist, url, 'index.html')] : [path.join(dist, url), path.join(dist, url, 'index.html')];
  for (const file of candidates) {
    if (!path.resolve(file).startsWith(path.resolve(dist))) break;
    try {
      if ((await stat(file)).isDirectory()) continue;
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
      return;
    } catch { /* try next */ }
  }
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  res.end(await readFile(path.join(dist, '404.html')).catch(() => 'Not found'));
}).listen(port, () => console.log(`  NWPH preview → http://localhost:${port}\n`));
