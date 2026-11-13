import { test, expect, fakeServer, wire, importExample } from './fixtures.mjs';

test('two relatives comment at the same time and both see both', async ({ browser }) => {
  const server = fakeServer();
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  await wire(A, server); await wire(B, server);
  await importExample(A);
  await A.evaluate(async () => { Share.st.name = 'Adam'; Share.save(); await Share.create(); });
  const link = await A.evaluate(() => Share.link());
  const pid = await A.evaluate(() => Object.values(ALL.persons).find((p) => p.given.startsWith('Harald')).id);
  await A.evaluate((pid) => { location.hash = 'trad'; select('person', pid); }, pid);
  await A.fill('#cmText', 'Vet någon var Harald arbetade?'); await A.click('#cmSend');
  await A.evaluate(() => Share.publish());
  await expect.poll(() => Object.keys(Object.values(server.ver)[0]).length).toBe(2);

  await B.goto('/#' + link.split('#')[1]);
  await expect.poll(() => B.evaluate(() => typeof ALL !== 'undefined' ? Object.keys(ALL.comments).length : 0), { timeout: 15000 }).toBe(1);
  await B.evaluate(() => { Share.st.name = 'Mamma'; Share.save(); });
  await B.evaluate((pid) => { location.hash = 'trad'; select('person', pid); }, pid);
  await expect(B.locator(`#treeSvg g.card[data-k="${pid}"] .qbadge`)).toBeVisible();
  await B.click('[data-cmreply]'); await B.fill('[data-replybox] textarea', 'På verkstaden.'); await B.click('[data-replybox] button');

  await A.fill('#cmText', 'Finns det foto?'); await A.click('#cmSend');
  await A.evaluate(() => Share.publish());
  await expect.poll(() => Object.keys(Object.values(server.ver)[0]).length).toBe(3);
  await B.evaluate(() => Share.publish());   // conflicts with A's publish and merges
  await expect.poll(() => Object.keys(Object.values(server.ver)[0]).length).toBe(4);
  await A.evaluate(() => Share.check(false));
  for (const pg of [A, B]) await expect.poll(() => pg.evaluate(() => Object.values(ALL.comments).map((c) => c.text).sort())).toEqual(['Finns det foto?', 'På verkstaden.', 'Vet någon var Harald arbetade?']);
  // nothing readable reaches the server
  expect(JSON.stringify(server.ver)).not.toContain('Harald');
  await ctxA.close(); await ctxB.close();
});
