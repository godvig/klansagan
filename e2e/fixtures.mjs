import { test as base, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Offline runs (no CDN): set E2E_LIB_DIR to a folder with d3.min.js, topojson-client.min.js,
 * xlsx.full.min.js and jspdf.umd.min.js and requests for them are answered from there.
 */
const LIB = process.env.E2E_LIB_DIR;
const LIBS = ['d3.min.js', 'topojson-client.min.js', 'xlsx.full.min.js', 'jspdf.umd.min.js'];

/** An in-memory stand-in for the Supabase functions used by sharing (same rules as the SQL). */
export function fakeServer() {
  const trees = {}, ver = {}, blobs = {}, meta = {};
  const h = (s) => createHash('sha256').update(s).digest('hex');
  const rpc = (fn, a) => {
    switch (fn) {
      case 'kl_create_tree': { const id = randomUUID(); trees[id] = h(a.write_secret); ver[id] = { 1: a.payload }; return [200, id]; }
      case 'kl_head': return [200, Math.max(...Object.keys(ver[a.tree]).map(Number))];
      case 'kl_get': { const vs = ver[a.tree]; if (!vs) return [200, []]; const v = a.ver || Math.max(...Object.keys(vs).map(Number)); return [200, [{ version: v, payload: vs[v], created_at: new Date().toISOString() }]]; }
      case 'kl_put_blob': if (trees[a.tree] !== h(a.write_secret)) return [400, { message: 'forbidden' }]; blobs[a.tree + '|' + a.blob_id] ??= a.payload; return [200, null];
      case 'kl_get_blobs': return [200, a.ids.filter((i) => blobs[a.tree + '|' + i]).map((i) => ({ id: i, payload: blobs[a.tree + '|' + i] }))];
      case 'kl_history': return [200, Object.keys(ver[a.tree]).map(Number).sort((x, y) => y - x).map((v) => ({ version: v, created_at: new Date().toISOString(), meta: meta[a.tree + '|' + v] || null, size: ver[a.tree][v].length }))];
      case 'kl_publish': case 'kl_publish2': {
        if (trees[a.tree] !== h(a.write_secret)) return [400, { message: 'forbidden' }];
        const head = Math.max(...Object.keys(ver[a.tree]).map(Number)); if (head !== a.base_version) return [400, { message: 'conflict' }];
        ver[a.tree][head + 1] = a.payload; if (a.meta) meta[a.tree + '|' + (head + 1)] = a.meta; return [200, head + 1];
      }
      default: return [404, { message: 'unknown ' + fn }];
    }
  };
  return { rpc, trees, ver, blobs };
}

/** Route a page: local copies of the CDN libraries (if asked) and Supabase to a fake server (or nowhere). */
export async function wire(page, server) {
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.includes('/rest/v1/rpc/')) {
      if (!server) return route.abort();
      const [status, body] = server.rpc(u.split('/').pop(), JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (LIB) { const f = LIBS.find((n) => u.endsWith(n)); if (f && existsSync(join(LIB, f))) return route.fulfill({ body: readFileSync(join(LIB, f)), contentType: 'application/javascript' }); }
    return route.continue();
  });
}

export const test = base.extend({
  page: async ({ page }, use) => { await wire(page); await use(page); },
});
export { expect };

/** Start with an empty archive. */
export async function fresh(page) {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('klansagan'); q.onsuccess = q.onerror = q.onblocked = () => r(); }); });
  await page.reload();
  await expect(page.locator('#view')).not.toContainText('Laddar');
}
/** Open the House of Vasa example (in memory only). */
export async function example(page, hash = 'trad') {
  await page.goto('/#exempel');
  await expect.poll(() => page.evaluate(() => typeof ALL !== 'undefined' ? Object.keys(ALL.persons).length : 0)).toBeGreaterThan(30);
  await page.evaluate((h) => { location.hash = h; }, hash);
}
/** Import the synthetic example CSV into an empty archive. */
export async function importExample(page) {
  await fresh(page);
  await page.evaluate(() => { location.hash = 'import'; });
  await page.setInputFiles('#impFile', 'examples/slaktsagan-import-example.csv');
  await page.click('#impGo');
  await expect.poll(() => page.evaluate(() => Object.keys(ALL.persons).length)).toBe(10);
  await page.evaluate(() => document.querySelectorAll('.ov').forEach((o) => o.remove()));
}
/** A small synthetic JPEG drawn in the page. */
export const jpeg = (page) => page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#c96'; x.fillRect(0, 0, 300, 400); x.fillStyle = '#734'; x.beginPath(); x.arc(150, 150, 70, 0, 7); x.fill(); return c.toDataURL('image/jpeg', 0.8); });
