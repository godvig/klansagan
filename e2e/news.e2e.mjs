import { test, expect, fakeServer, wire, importExample } from './fixtures.mjs';

test('"Nytt sedan sist" shows what someone else published, until you have seen it', async ({ browser }) => {
  const server = fakeServer();
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  await wire(A, server); await wire(B, server);
  await importExample(A);
  const edit = await A.evaluate(async () => { app.Share.st.name = 'Adam'; app.Share.save(); await app.Share.create(); return app.Share.link(); });
  await B.goto('/#' + edit.split('#')[1]);
  await expect.poll(() => B.evaluate(() => typeof app !== 'undefined' && !!app.Share.cur()), { timeout: 15000 }).toBe(true);
  await B.evaluate(() => { app.Share.st.name = 'Lisa'; app.Share.save(); });

  // Lisa adds a person, changes one, removes one and asks a question.
  const ids = await B.evaluate(async () => {
    const ps = Object.values(app.ALL.persons).sort((a, b) => a.id.localeCompare(b.id));
    await app.Store.put({ kind: 'person', id: 'p_news1', given: 'Nyfunnen', surname: 'Ana', sex: 'K', birthDate: '1850' });
    await app.Store.put({ ...ps[0], occupation: 'Smed', birthDate: '1801-01-01' });
    await app.Store.put({ kind: 'comment', id: 'cm_news1', personId: ps[0].id, text: 'Vem var hans far?', by: 'Lisa', at: new Date().toISOString() });
    const gone = ps[ps.length - 1]; app.Store.del('person', gone.id);
    await app.Share.publish();
    return { changed: ps[0].id, gone: [gone.given, gone.surname].filter(Boolean).join(' ') };
  });

  await A.evaluate(() => app.Share.check(true));
  await expect(A.locator('.toast')).toContainText('Lisa har publicerat');
  await A.evaluate(() => { location.hash = 'start'; app.renderAll(true); });
  const box = A.locator('section.news');
  await expect(box).toContainText('från Lisa');
  await expect(box).toContainText('Nyfunnen Ana');
  await expect(box).toContainText('födelse, yrke');
  await expect(box).toContainText('Vem var hans far?');
  await expect(box).toContainText(ids.gone);

  // Changed people are marked in the tree.
  await A.evaluate((id) => { location.hash = 'trad'; app.setFocus(id); app.renderAll(true); }, ids.changed);
  await expect(A.locator('#treeSvg .newbadge').first()).toBeVisible();

  // Seen: the box goes away and stays away after a reload.
  await A.evaluate(() => { location.hash = 'start'; });
  await A.click('#newsSeen');
  await expect(box).toHaveCount(0);
  await A.reload();
  await expect.poll(() => A.evaluate(() => typeof app !== 'undefined' && document.querySelector('.start') !== null), { timeout: 15000 }).toBe(true);
  await expect(A.locator('section.news')).toHaveCount(0);

  // Your own publishes are never news to you.
  await A.evaluate(async () => { const p = Object.values(app.ALL.persons)[0]; await app.Store.put({ ...p, notes: 'Egen' }); await app.Share.publish(); await app.Share.check(true); });
  expect(await A.evaluate(() => app.Share.news())).toBe(null);
  await ctxA.close(); await ctxB.close();
});
