import { test, expect, importExample, jpeg } from './fixtures.mjs';

test('an image dropped on a tree card becomes the profile photo', async ({ page }) => {
  await importExample(page);
  await page.evaluate(() => { location.hash = 'trad'; });
  const pid = await page.evaluate(() => [...document.querySelectorAll('#treeSvg g.card[data-k]')].map((e) => e.dataset.k).find((k) => !k.startsWith('g:')));
  const url = await jpeg(page);
  await page.evaluate(([pid, url]) => {
    const bin = atob(url.split(',')[1]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const dt = new DataTransfer(); dt.items.add(new File([u], 'farmor.jpg', { type: 'image/jpeg' }));
    const el = document.querySelector(`#treeSvg g.card[data-k="${pid}"] rect.bg`);
    for (const t of ['dragenter', 'dragover', 'drop']) el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, [pid, url]);
  await expect.poll(() => page.evaluate((pid) => !!avatarUrl(P(pid)), pid), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate((pid) => !!P(pid).media[0].thumb, pid)).toBe(true);
});

test('a voice memory can be recorded, saved and played', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await importExample(page);
  const pid = await page.evaluate(() => Object.keys(ALL.persons)[0]);
  await page.evaluate((pid) => { location.hash = 'trad'; select('person', pid); }, pid);
  await page.click('[data-act=record]');
  await page.click('#recBtn');
  await page.waitForTimeout(2200);
  await page.click('#recBtn');
  await page.fill('#recT', 'Farmor berättar');
  await page.click('.ov [data-ok]');
  await expect.poll(() => page.evaluate((pid) => (P(pid).media || []).filter(isAudio).map((m) => [m.caption, m.duration > 0]), pid)).toEqual([['Farmor berättar', true]]);
  await page.click('.vm [data-play]');
  await expect.poll(() => page.evaluate(() => { const a = document.querySelector('.vm audio'); return !!a && a.currentTime > 0; })).toBe(true);
});
