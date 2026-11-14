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
  await expect.poll(() => page.evaluate((pid) => !!app.avatarUrl(app.P(pid)), pid), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate((pid) => !!app.P(pid).media[0].thumb, pid)).toBe(true);
});

test('a voice memory can be recorded, saved and played', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await importExample(page);
  const pid = await page.evaluate(() => Object.keys(app.ALL.persons)[0]);
  await page.evaluate((pid) => { location.hash = 'trad'; app.select('person', pid); }, pid);
  await page.click('[data-act=record]');
  await page.click('#recBtn');
  await page.waitForTimeout(2200);
  await page.click('#recBtn');
  await page.fill('#recT', 'Farmor berättar');
  await page.click('.ov [data-ok]');
  await expect.poll(() => page.evaluate((pid) => (app.P(pid).media || []).filter(app.isAudio).map((m) => [m.caption, m.duration > 0]), pid)).toEqual([['Farmor berättar', true]]);
  await page.click('.vm [data-play]');
  await expect.poll(() => page.evaluate(() => { const a = document.querySelector('.vm audio'); return !!a && a.currentTime > 0; })).toBe(true);
});

test('the photo viewer steps through a person\'s photos with arrows, keys and swipes', async ({ page }) => {
  await importExample(page);
  const url = await jpeg(page);
  const pid = await page.evaluate(async (url) => {
    const p = Object.values(app.ALL.persons)[0];
    await app.Store.put({ ...p, media: ['Konfirmation 1902', 'Bröllopet', ''].map((c, i) => ({ url, contentType: 'image/jpeg', name: `bild${i}.jpg`, caption: c })) });
    return p.id;
  }, url);
  await page.evaluate((pid) => app.openCard(pid), pid);
  await expect(page.locator('.gallery.feat figure')).toHaveCount(3);
  await expect(page.locator('.gallery figcaption').first()).toHaveText('Konfirmation 1902');
  await page.locator('.gallery figure').nth(1).click();
  const lb = page.locator('.lightbox');
  await expect(lb.locator('.lb-count')).toHaveText('2 / 3');
  await expect(lb.locator('#lbCap')).toHaveValue('Bröllopet');
  await lb.locator('.lb-nav.next').click();
  await expect(lb.locator('.lb-count')).toHaveText('3 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(lb.locator('.lb-count')).toHaveText('1 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(lb.locator('.lb-count')).toHaveText('3 / 3');
  await lb.locator('.lb-th').first().click();
  await expect(lb.locator('.lb-count')).toHaveText('1 / 3');
  // Swipe left = next.
  await page.evaluate(() => { const el = document.querySelector('.lightbox .lb-stage'); const t = (x) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })];
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: t(300), changedTouches: t(300) }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: t(150) })); });
  await expect(lb.locator('.lb-count')).toHaveText('2 / 3');
  // Saving a caption keeps you on the same photo.
  await lb.locator('#lbCap').fill('Bröllopet 1925');
  await lb.locator('#lbSave').click();
  await expect(lb.locator('.lb-count')).toHaveText('2 / 3');
  expect(await page.evaluate((pid) => app.P(pid).media[1].caption, pid)).toBe('Bröllopet 1925');
  await page.keyboard.press('Escape');
  await expect(lb).toHaveCount(0);
});
