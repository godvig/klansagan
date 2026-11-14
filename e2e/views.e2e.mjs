import { test, expect, example } from './fixtures.mjs';
test('every view renders without errors', async ({ page }) => {
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await example(page);
  for (const h of ['start', 'trad', 'solfjader', 'personer', 'tidslinje', 'karta', 'kallor', 'platser', 'dubbletter', 'slaktskap', 'trad-lista', 'import', 'om', 'utskrift']) {
    await page.evaluate((h) => { location.hash = h; }, h); await page.waitForTimeout(700);
  }
  await page.evaluate(() => app.openCard('p_gustav1')); await page.waitForTimeout(600);
  await page.evaluate(() => app.settingsModal()); await page.waitForTimeout(300); await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = 'trad'; app.select('person', 'p_karl9'); }); await page.waitForTimeout(500);
  await page.fill('#q', 'Karl'); await page.waitForTimeout(400); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  await page.click('#viewBtn'); await page.waitForTimeout(300);
  await page.evaluate(() => app.openPersonModal()); await page.waitForTimeout(300);
  expect(errs).toEqual([]);
});
