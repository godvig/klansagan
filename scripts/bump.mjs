#!/usr/bin/env node
/* Release helper: bump the asset version everywhere at once.
   - ?v=N on the scripts and styles in index.html and on every import between the app's modules
     (a browser must never mix modules from two releases, so they all move together)
   - APP_VERSION (shown in Settings and on the presentation page)
   - the service worker cache, so installed apps pick up the new shell
   Usage: node scripts/bump.mjs            */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const edit = (f, fn) => { const s = readFileSync(f, 'utf8'), t = fn(s); if (t !== s) writeFileSync(f, t); };
const html = readFileSync('index.html', 'utf8');
const cur = Math.max(...[...html.matchAll(/\?v=(\d+)/g)].map((m) => +m[1]).filter((n) => n < 1000));
const next = cur + 1;

edit('index.html', (s) => s.replace(/\?v=(\d+)/g, (m, n) => (+n === cur ? `?v=${next}` : m)));
for (const f of readdirSync('src/app')) edit(`src/app/${f}`, (s) => s.replace(/(from '\.\/[\w-]+\.js)\?v=\d+'/g, `$1?v=${next}'`).replace(/(import \* as \w+ from '\.\/[\w-]+\.js)\?v=\d+'/g, `$1?v=${next}'`));

const today = new Date().toISOString().slice(0, 10);
edit('src/app/state.js', (s) => s.replace(/const APP_VERSION='([\d-]+)\.(\d+)'/, (m, d, n) => `const APP_VERSION='${today}.${d === today ? +n + 1 : 1}'`));
edit('sw.js', (s) => s.replace(/const CACHE = 'klansagan-v(\d+)'/, (m, n) => `const CACHE = 'klansagan-v${+n + 1}'`));

console.log(`assets ?v=${cur} → ?v=${next}`);
