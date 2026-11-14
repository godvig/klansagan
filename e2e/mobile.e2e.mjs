import { test, expect, example } from './fixtures.mjs';

test('on a phone the tabs sit at the bottom and a person opens as a sheet', async ({ page }) => {
  await example(page);
  const nav = await page.locator('#nav').boundingBox(), vp = page.viewportSize();
  expect(nav.y + nav.height).toBeGreaterThan(vp.height - 5);
  await page.evaluate(() => app.select('person', 'p_karl9'));
  const panel = page.locator('#panel');
  await expect(panel).toHaveClass(/open/);
  const box = await panel.boundingBox();
  expect(box.height).toBeLessThan(vp.height * 0.5);   // peeks, doesn't cover the tree
  await page.click('.sheet-handle');
  await expect(panel).toHaveClass(/expanded/);
});

test('the presentation page plays its film only when scrolled into view', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { location.hash = 'om'; });
  await expect(page.locator('#view h1')).toHaveText('Om Släktsagan');
  const paused = () => page.evaluate(() => document.querySelector('.lv-video').paused);
  await page.evaluate(() => { const v = document.querySelector('#view'); v.scrollTop = v.scrollHeight; });
  await expect.poll(paused).toBe(true);       // out of view: not playing
  await page.locator('.lv-video').scrollIntoViewIfNeeded();
  await expect.poll(paused).toBe(false);      // in view: plays
});

test('on a phone a relationship is shown as one chain, also over the tree', async ({ page }) => {
  await example(page);
  await page.evaluate(() => { app.ui.relA = 'p_ga2'; app.ui.relB = 'p_gustav1'; location.hash = 'slaktskap'; });
  const chain = page.locator('.rel-chain-wrap .rel-chain');
  await expect(chain).toBeVisible();
  await expect(page.locator('.rel-cols')).toBeHidden();
  const steps = await chain.locator('.rc-step b, .rc-link span').allTextContents();
  expect(steps).toEqual(['Gustav II Adolf', 'son till', 'Karl IX', 'son till', 'Gustav Vasa']);
  await page.click('#relTree');
  const sheet = page.locator('.modal .rel-chain');
  await expect(sheet).toBeVisible();
  await page.click('.modal [data-x]');
  await expect(page.locator('.ov')).toHaveCount(0);
  await expect(page.locator('#relBanner')).toBeVisible();
  await page.click('#relChain');
  await expect(sheet).toBeVisible();
});
