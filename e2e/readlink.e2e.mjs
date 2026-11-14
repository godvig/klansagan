import { test, expect, fakeServer, wire, importExample } from './fixtures.mjs';

/** Make one example person living, with details only editors should see, and add a comment. */
async function livingSetup(page) {
  await importExample(page);
  return page.evaluate(async () => {
    const p = Object.values(app.ALL.persons).find((x) => x.given.startsWith('Harald'));
    await app.Store.put({ ...p, birthDate: '1985-11-19', deathDate: '', deathPlace: '', events: [], notes: 'Bor på Storgatan 1' });
    await app.Store.put({ kind: 'comment', id: 'cm_t1', personId: p.id, text: 'Fråga moster om adressen', by: 'Adam', at: new Date().toISOString() });
    app.Share.st.name = 'Adam'; app.Share.save(); await app.Share.create();
    return { pid: p.id, edit: app.Share.link(), read: app.Share.readLink() };
  });
}

test('a read-only link shows living people as name and birth year, and cannot publish', async ({ browser }) => {
  const server = fakeServer();
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  await wire(A, server); await wire(B, server);
  const { pid, edit, read } = await livingSetup(A);
  expect(read).toMatch(/#visa-[0-9a-f-]{36}\.[\w-]{43}$/);
  expect(edit).toMatch(/#dela-[0-9a-f-]{36}\.[\w-]{43}\.[\w-]{43}$/);

  // Photos of living people are encrypted with the editor key, everyone else's with the read key.
  const plan = await A.evaluate(async () => { const t = app.Share.cur(); const pl = await app.Share.blobPlan({ persons: {
    a: { id: 'a', given: 'Lever', birthDate: '1990', media: [{ url: 'kl:livingphoto1' }] },
    b: { id: 'b', given: 'Död', birthDate: '1850', media: [{ url: 'kl:oldphoto001' }] } } }, t);
    return pl.map(([sid, id, key]) => [id, key === t.e ? 'e' : key === t.r ? 'r' : '?', sid.split('_')[0] === sid ? 'untagged' : 'tagged']); });
  expect(plan.sort()).toEqual([['livingphoto1', 'e', 'tagged'], ['oldphoto001', 'r', 'tagged']]);

  await B.goto('/#' + read.split('#')[1]);
  await expect.poll(() => B.evaluate(() => typeof app !== 'undefined' ? Object.keys(app.ALL.persons).length : 0), { timeout: 15000 }).toBeGreaterThan(5);
  const seen = await B.evaluate((pid) => ({ p: app.ALL.persons[pid], comments: Object.keys(app.ALL.comments).length, canEdit: app.Store.canEdit, ro: app.Share.readOnly() }), pid);
  expect(seen.p.birthDate).toBe('1985'); expect(seen.p.notes).toBeUndefined(); expect(seen.p.living).toBe(true);
  expect(seen.comments).toBe(0); expect(seen.canEdit).toBe(false); expect(seen.ro).toBe(true);
  await B.evaluate((pid) => { location.hash = 'trad'; app.select('person', pid); }, pid);
  await expect(B.locator('#panel')).toContainText('Personen lever');
  await expect(B.locator('#panel')).not.toContainText('Redigera');
  for (const t of ['Inga källor', 'Inga filer', 'Inga händelser', 'Spela in', 'Ladda upp']) await expect(B.locator('#panel')).not.toContainText(t);

  // Even the raw payload, decrypted with the read key, holds nothing more.
  const raw = await B.evaluate(async () => { const t = app.Share.cur(); const r = (await app.Share.rpc('kl_get', { tree: app.Share.st.active }))[0]; return JSON.stringify(await KinCore.decryptJSON(r.payload, t.r)); });
  expect(raw).not.toMatch(/Storgatan|1985-11-19|moster/);
  expect(raw).toContain('Harald');

  // A reader can't publish, even by calling the server directly.
  const r = await B.evaluate(async () => { try { await app.Share.rpc('kl_publish2', { tree: app.Share.st.active, base_version: 1, write_secret: await KinCore.writeSecret(app.Share.cur().r), payload: 'k1.a.b', meta: null }); return 'published'; } catch (e) { return e.code; } });
  expect(r).toBe('forbidden');

  // Editors' changes reach the reader on the next check.
  await A.evaluate(async () => { const p = Object.values(app.ALL.persons).sort((a, b) => a.id.localeCompare(b.id)).find((x) => !KinCore.isLiving(x, app.ALL.persons, 2026)); await app.Store.put({ ...p, occupation: 'Riksföreståndare' }); await app.Share.publish(); });
  await B.evaluate(() => app.Share.check(true));
  await expect.poll(() => B.evaluate(() => Object.values(app.ALL.persons).sort((a, b) => a.id.localeCompare(b.id)).find((x) => !KinCore.isLiving(x, app.ALL.persons, 2026)).occupation)).toBe('Riksföreståndare');
  await ctxA.close(); await ctxB.close();
});

test('an edit link sees everything, and loses editing when the edit link is replaced', async ({ browser }) => {
  const server = fakeServer();
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  await wire(A, server); await wire(B, server);
  const { pid, edit } = await livingSetup(A);
  await B.goto('/#' + edit.split('#')[1]);
  await expect.poll(() => B.evaluate(() => typeof app !== 'undefined' ? Object.keys(app.ALL.comments).length : 0), { timeout: 15000 }).toBe(1);
  expect(await B.evaluate((pid) => [app.ALL.persons[pid].notes, app.Store.canEdit], pid)).toEqual(['Bor på Storgatan 1', true]);

  expect(await A.evaluate(() => app.Share.rekey('edit'))).toBe(true);
  const newEdit = await A.evaluate(() => app.Share.link());
  expect(newEdit).not.toBe(edit);
  // A still sees everything after the change, and history still opens.
  expect(await A.evaluate(async (pid) => { const v = await app.Share.fetchVersion(app.Share.st.active, app.Share.cur(), 1); return v.data.persons[pid].notes; }, pid)).toBe('Bor på Storgatan 1');

  await B.evaluate(() => app.Share.check(true));
  await expect.poll(() => B.evaluate(() => app.Share.readOnly())).toBe(true);
  expect(await B.evaluate((pid) => [app.ALL.persons[pid].notes, app.Store.canEdit], pid)).toEqual([undefined, false]);
  await ctxA.close(); await ctxB.close();
});

test('an old single-key tree gets read-only links, and the old link stops working', async ({ browser }) => {
  const server = fakeServer();
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  await wire(A, server); await wire(B, server);
  await importExample(A);
  const old = await A.evaluate(async () => {
    // Share the way older versions of the app did: one key for everything.
    const key = KinCore.newKey(), data = app.archiveData();
    const id = await app.Share.rpc('kl_create_tree', { write_secret: await KinCore.writeSecret(key), payload: await KinCore.encryptJSON({ ...data, meta: { by: 'Adam' } }, key) });
    app.Share.st.trees[id] = { key, version: 1, base: KinCore.hashArchive(data), uploaded: {} }; app.Share.st.active = id; app.Share.st.name = 'Adam'; app.Share.save();
    return app.Share.link();
  });
  expect(old).toMatch(/#dela-[0-9a-f-]{36}\.[\w-]{43}$/);
  await A.evaluate(() => app.shareTreeModal());
  await A.click('#shUpgrade'); await A.click('[data-ok]');
  await expect(A.locator('#shRead')).toBeVisible();
  const read = await A.evaluate(() => app.Share.readLink());
  expect(await A.evaluate(async () => (await app.Share.fetchVersion(app.Share.st.active, app.Share.cur(), 1)).data.persons !== undefined)).toBe(true);

  await B.goto('/#' + old.split('#')[1]);
  await expect(B.locator('.toast')).toContainText('Kunde inte öppna', { timeout: 15000 });
  await B.goto('/#' + read.split('#')[1]); await B.reload();
  await expect.poll(() => B.evaluate(() => app.Share.readOnly()), { timeout: 15000 }).toBe(true);
  await ctxA.close(); await ctxB.close();
});
