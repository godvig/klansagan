import { test, expect, importExample } from './fixtures.mjs';

test('"Den här dagen" lists a living relative turning 30 today and a wedding day', async ({ page }) => {
  await importExample(page);
  await page.evaluate(() => {
    const d = new Date(), iso = (y, n = 0) => { const x = new Date(d); x.setFullYear(y); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    const [a, b] = Object.values(app.ALL.persons);
    app.Store.put({ ...a, birthDate: iso(d.getFullYear() - 30), deathDate: '' });
    app.Store.put({ ...b, deathDate: iso(1911, 3) });
    location.hash = 'start';
  });
  const box = page.locator('.otd');
  await expect(box.locator('.otd-row.today')).toContainText('fyller 30');
  await expect(box).toContainText('dog 1911');
  await box.locator('.otd-row.today a').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#personkort');
});
