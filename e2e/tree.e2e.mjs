import { test, expect, example } from './fixtures.mjs';

test('the example opens with a tree of cards', async ({ page }) => {
  await example(page);
  await expect(page.locator('#treeSvg g.card').first()).toBeVisible();
  expect(await page.locator('#treeSvg g.card').count()).toBeGreaterThan(10);
});

test('clicking a card keeps it in place while the tree rearranges around it', async ({ page }) => {
  await example(page);
  await expect(page.locator('#treeSvg g.card').first()).toBeVisible();
  // a card well inside the view that isn't the focus person
  const k = await page.evaluate(() => [...document.querySelectorAll('#treeSvg g.card:not(.focus)')].map((e) => [e.dataset.k, e.querySelector('rect.bg').getBoundingClientRect()])
    .find(([k, r]) => !k.startsWith('g:') && r.x > 60 && r.right < innerWidth - 460 && r.y > 200 && r.bottom < innerHeight - 40)[0]);
  const card = () => page.locator(`#treeSvg g.card[data-k="${k}"] rect.bg`);
  const before = await card().boundingBox();
  await card().click({ position: { x: before.width - 30, y: 18 } });
  await expect.poll(() => page.evaluate(() => app.ui.focus)).toBe(k);
  const after = await card().boundingBox();
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeLessThan(2);
});

test('the kinship path lights up in the tree', async ({ page }) => {
  await example(page, 'slaktskap');
  await page.evaluate(() => { app.ui.relA = 'p_sigrid'; app.ui.relB = 'p_wladyslaw'; app.renderRel(); });
  await expect(page.locator('#view')).toContainText('halvkusins son');
  await page.click('#relTree');
  await expect(page.locator('#relBanner')).toContainText('Władysław IV');
  await expect(page.locator('#treeSvg g.card.hl')).toHaveCount(6);
  await page.click('#relOff');
  await expect(page.locator('#treeSvg g.card.hl')).toHaveCount(0);
});

test('undo and redo an edit with the keyboard', async ({ page }) => {
  await example(page);
  await page.evaluate(() => { const q = app.clone(app.P('p_karl9')); q.occupation = 'Testkung'; app.Store.put(q); });
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => app.P('p_karl9').occupation)).not.toBe('Testkung');
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => page.evaluate(() => app.P('p_karl9').occupation)).toBe('Testkung');
});

test('deleting a person with all their links is one undo step', async ({ page }) => {
  await example(page);
  await page.evaluate(() => app.deletePerson('p_johan3'));
  await expect.poll(() => page.evaluate(() => !!app.P('p_johan3'))).toBe(false);
  await page.click('#undoBtn');
  await expect.poll(() => page.evaluate(() => Object.values(app.ALL.persons).filter((p) => p.fatherId === 'p_johan3').length)).toBe(3);
});
