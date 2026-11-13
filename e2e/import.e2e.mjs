import { test, expect, example, fresh, importExample } from './fixtures.mjs';
import { writeFileSync } from 'node:fs';

test('GEDCOM export and import round-trip the example', async ({ page }, info) => {
  await example(page);
  const ged = await page.evaluate(() => withAll(() => toGedcom()));
  const count = () => page.evaluate(() => [Object.keys(ALL.persons).length, Object.values(ALL.persons).filter((p) => p.fatherId || p.motherId).length, Object.keys(ALL.sources).length]);
  const ref = await count();
  const file = info.outputPath('vasa.ged'); writeFileSync(file, ged);
  await page.evaluate(() => exitDemo(true));
  await fresh(page);
  await page.evaluate(() => { location.hash = 'import'; });
  await page.setInputFiles('#impFile', file);
  await expect(page.locator('.ov .ged-stats')).toContainText('37');
  await page.click('.ov [data-ok]');
  await expect.poll(count).toEqual(ref);
});

test('a CSV import is one undoable step', async ({ page }) => {
  await importExample(page);
  await expect(page.locator('#undoBtn')).toHaveAttribute('title', /Import av 10 personer/);
  await page.click('#undoBtn');
  await expect.poll(() => page.evaluate(() => Object.keys(ALL.persons).length)).toBe(0);
});

test('a backup file can be saved and read back', async ({ page }) => {
  await importExample(page);
  await page.evaluate(() => { location.hash = 'import'; });
  await expect(page.locator('.box.backup')).toContainText('inte sparat');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bkSave')]);
  const path = await dl.path();
  await expect(page.locator('.box.backup .bk-line')).toContainText('Inget har ändrats');
  await fresh(page);
  await page.evaluate(() => { location.hash = 'import'; });
  await page.setInputFiles('#restore', path);
  await page.click('.ov .btn.primary');
  await expect.poll(() => page.evaluate(() => Object.keys(ALL.persons).length)).toBe(10);
});

test('a pasted ArkivDigital citation becomes a source with image and page', async ({ page }) => {
  await example(page);
  await page.evaluate(() => select('person', 'p_karl9'));
  await page.click('[data-act=addcite]');
  await page.fill('#ciPaste', 'Hardemo (T) C:3 (1689-1750) Bild 56 / sid 102 (AID: v12345.b56.s102, NAD: SE/ULA/10000)');
  await expect(page.locator('#ciParsed')).toContainText('ArkivDigital');
  await page.click('#ciOk');
  const c = await page.evaluate(() => { const c = P('p_karl9').citations.at(-1); return [ALL.sources[c.sourceId].title, ALL.sources[c.sourceId].type, c.about, c.aid]; });
  expect(c).toEqual(['Hardemo (T) C:3 (1689–1750)', 'Födelse- och dopbok', 'Födelse', 'v12345.b56.s102']);
});
