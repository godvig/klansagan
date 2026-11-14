import { test, expect, example } from './fixtures.mjs';

test('the tree you see becomes a family book PDF', async ({ page }) => {
  await example(page);
  await page.evaluate(() => { app.ui.ancGen = 2; app.ui.descGen = 2; app.setFocus('p_gustav1'); app.ui.treeKey = null; app.renderAll(); });
  const n = await page.evaluate(() => app.bookPeople().length);
  await page.click('#tPrint');
  await page.click('[data-book]');
  await expect(page.locator('.ov .modal')).toContainText(`${n} personer`);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('.ov [data-ok]')]);
  expect(dl.suggestedFilename()).toBe('slaktbok-slakten-vasa.pdf');
  const pdf = (await import('node:fs')).readFileSync(await dl.path(), 'latin1');
  expect(pdf.startsWith('%PDF')).toBe(true);
  const pages = (pdf.match(/\/Type \/Page[^s]/g) || []).length;
  expect(pages).toBeGreaterThan(5);
  await expect(page.locator('.toast')).toContainText(`${pages} sidor`);
});
