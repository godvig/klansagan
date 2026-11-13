import { describe, it, expect } from 'vitest';
import core from '../src/core.js';

const { yearOf, dateKey, fmtDate, whenText, gedDate, genitive, slugify, parseDelimited, dupScore, computeHidden, blood, bloodTerm, components } = core;

/* A small synthetic family used across the relationship and view tests.
 *
 *            ff ─┬─ fm                 mf ─┬─ mm
 *        ┌───────┼────────┐        ┌───────┼──────┐
 *     father   uncleF   auntF    mother  auntM   (half: mf ─ mf2 → halfM)
 *        └──┬──┘    │      │        │      ├── cousinM ── cousinM's son
 *         me, sister cousinF1  cousinF2    │
 *              │                         auntM ─ auntMHusband
 *          sistersSon
 */
const P = (id, sex, fatherId = '', motherId = '', spouseIds = []) => ({ id, sex, fatherId, motherId, spouseIds, given: id });
const fam = Object.fromEntries([
  P('gff', 'M'), P('ff', 'M', 'gff'), P('fm', 'K'), P('mf', 'M'), P('mm', 'K'), P('mf2', 'K'),
  P('father', 'M', 'ff', 'fm', ['mother']), P('mother', 'K', 'mf', 'mm', ['father']),
  P('uncleF', 'M', 'ff', 'fm'), P('auntF', 'K', 'ff', 'fm'),
  P('auntM', 'K', 'mf', 'mm', ['auntMHusband']), P('auntMHusband', 'M', '', '', ['auntM']),
  P('halfM', 'M', 'mf', 'mf2'),
  P('me', 'M', 'father', 'mother'), P('sister', 'K', 'father', 'mother'),
  P('sistersSon', 'M', '', 'sister'), P('sistersDaughter', 'K', '', 'sister'),
  P('cousinF1', 'M', 'uncleF'), P('cousinF2', 'K', '', 'auntF'),
  P('cousinM', 'K', 'auntMHusband', 'auntM'), P('cousinMSon', 'M', '', 'cousinM'),
  P('cousinF1Son', 'M', 'cousinF1'), P('cousinM2', 'M', '', 'cousinMSon'),
].map((p) => [p.id, p]));
const get = (id) => fam[id];
/** "B is A's ___" */
const rel = (a, b) => { const r = blood(a, b, get); return r ? bloodTerm(r, b, get) : null; };

describe('dates', () => {
  it('extracts the year from free text', () => {
    expect(yearOf('ca 1820')).toBe(1820);
    expect(yearOf('1496-05-12')).toBe(1496);
    expect(yearOf('okänt')).toBeNull();
  });
  it('sorts partial dates sensibly', () => {
    expect(dateKey('1820-01-01')).toBeLessThan(dateKey('1820'));
    expect(dateKey('1820')).toBeLessThan(dateKey('1820-12-31'));
    expect(dateKey('')).toBeNull();
  });
  it('formats Swedish dates', () => {
    expect(fmtDate('1496-05-12')).toBe('12 maj 1496');
    expect(fmtDate('1882-04')).toBe('april 1882');
    expect(whenText('1496-05-12')).toBe('den 12 maj 1496');
    expect(whenText('1496')).toBe('år 1496');
  });
  it('converts to GEDCOM dates', () => {
    expect(gedDate('1823-04-12')).toBe('12 APR 1823');
    expect(gedDate('ca 1780')).toBe('ABT 1780');
    expect(gedDate('före 1700')).toBe('BEF 1700');
    expect(gedDate('1882-04')).toBe('APR 1882');
  });
});

describe('text helpers', () => {
  it('builds Swedish genitives', () => {
    expect(genitive('Anna')).toBe('Annas');
    expect(genitive('Lars')).toBe('Lars');
    expect(genitive('Johan III')).toBe('Johan III:s');
  });
  it('slugifies view names', () => {
    expect(slugify('Pappas sida')).toBe('pappas-sida');
    expect(slugify('Mormors släkt – Öland')).toBe('mormors-slakt-oland');
    expect(slugify('')).toBe('vy');
  });
  it('parses pasted Excel (tabs) and Swedish CSV (semicolons, quotes)', () => {
    expect(parseDelimited('Förnamn\tEfternamn\nAnna\tLarsdotter')).toEqual([['Förnamn', 'Efternamn'], ['Anna', 'Larsdotter']]);
    expect(parseDelimited('﻿Namn;Anteckning\r\nErik;"bonde; Born ""by"""\r\n')).toEqual([['Namn', 'Anteckning'], ['Erik', 'bonde; Born "by"']]);
  });
});

describe('duplicate detection', () => {
  const a = { id: 'a', given: 'Gustav', surname: 'Vasa', sex: 'M', birthDate: '1496-05-12' };
  it('matches spelling variants', () => {
    expect(dupScore(a, { id: 'b', given: 'Gustaf', surname: 'Wasa', sex: 'M', birthDate: '1496' })).toBeGreaterThanOrEqual(60);
  });
  it('rejects different people', () => {
    expect(dupScore(a, { id: 'c', given: 'Gustav', surname: 'Vasa', birthDate: '1568' })).toBe(0);
    expect(dupScore(a, { id: 'd', given: 'Gustav', surname: 'Vasa', sex: 'K', birthDate: '1496' })).toBe(0);
    expect(dupScore(a, { id: 'e', given: 'Gustav', surname: 'Vasa', birthDate: '1496', notDup: ['a'] })).toBe(0);
  });
});

describe('Swedish kinship terms', () => {
  it.each([
    ['me', 'father', 'far'],
    ['me', 'ff', 'farfar'],
    ['me', 'mm', 'mormor'],
    ['me', 'gff', 'farfars far'],
    ['ff', 'me', 'sonson'],
    ['me', 'sister', 'syster'],
    ['me', 'uncleF', 'farbror'],
    ['me', 'auntF', 'faster'],
    ['me', 'auntM', 'moster'],
    ['me', 'halfM', 'halvmorbror'],
    ['me', 'sistersSon', 'systerson'],
    ['me', 'sistersDaughter', 'systerdotter'],
    ['uncleF', 'me', 'brorson'],
    ['auntF', 'me', 'brorson'],
    ['uncleF', 'sister', 'brorsdotter'],
    ['me', 'cousinF1', 'kusin'],
    ['me', 'cousinM', 'kusin'],
    ['me', 'cousinF1Son', 'kusins son'],
    ['cousinF1Son', 'me', 'fars kusin'],
    ['cousinF1Son', 'cousinM2', null],
  ])('%s → %s is "%s"', (a, b, term) => {
    expect(rel(a, b)).toBe(term);
  });
  it('detects half-cousins', () => {
    const half = { ...fam, hc: P('hc', 'K', 'halfM') };
    const r = blood('me', 'hc', (id) => half[id]);
    expect(bloodTerm(r, 'hc', (id) => half[id])).toBe('halvkusin');
  });
  it('names second cousins (tremänning)', () => {
    const f = { ...fam, sib: P('sib', 'M', 'gff'), c2: P('c2', 'K', 'sib'), t: P('t', 'M', 'c2') };
    const g = (id) => f[id];
    // father (child of ff, grandchild of gff) vs t (grandchild of sib, great-grandchild of gff)
    expect(bloodTerm(blood('me', 't', g), 't', g)).toBe('tremänning');
  });
});

describe('views (hide branches)', () => {
  it("hides mum's side but keeps mum, me and dad's side", () => {
    const H = computeHidden(fam, { hideUp: ['mother'] });
    for (const id of ['mf', 'mm', 'auntM', 'cousinM', 'halfM', 'mf2', 'auntMHusband', 'cousinMSon', 'cousinM2']) expect(H.has(id), id).toBe(true);
    for (const id of ['mother', 'me', 'sister', 'father', 'ff', 'uncleF', 'cousinF1']) expect(H.has(id), id).toBe(false);
  });
  it('hides descendants only', () => {
    const H = computeHidden(fam, { hideDown: ['sister'] });
    expect([...H].sort()).toEqual(['sistersDaughter', 'sistersSon']);
  });
  it('hides a single person', () => {
    expect([...computeHidden(fam, { hide: ['uncleF'] })]).toEqual(['uncleF']);
  });
});

describe('components (separate trees)', () => {
  it('finds one tree when everyone is linked', () => {
    expect(components(fam).length).toBe(1);
  });
  it('splits unlinked families and ignores dangling ids', () => {
    const ps = {
      a: { id: 'a', spouseIds: ['b'] }, b: { id: 'b' }, c: { id: 'c', fatherId: 'a' },
      x: { id: 'x', motherId: 'gone' }, y: { id: 'y', fatherId: 'x' },
      z: { id: 'z' },
    };
    const cs = components(ps).map(c => c.sort().join(''));
    expect(cs).toEqual(['abc', 'xy', 'z']);
  });
});

describe('sharing: merge and encryption', () => {
  const base = { persons: { a: { id: 'a', given: 'Anna', updatedAt: '1' }, b: { id: 'b', given: 'Bo', updatedAt: '1' }, c: { id: 'c', given: 'Cia', updatedAt: '1' } } };
  const bh = core.hashArchive(base);
  it('keeps changes made on either side and merges deletions', () => {
    const mine = { persons: { ...base.persons, a: { id: 'a', given: 'Anna Maria', updatedAt: '2' }, n: { id: 'n', given: 'Ny' } } };
    const theirs = { persons: { a: base.persons.a, b: { id: 'b', given: 'Bosse', updatedAt: '2' } } }; // c deleted
    const { data, conflicts } = core.merge3(bh, mine, theirs);
    expect(data.persons.a.given).toBe('Anna Maria');
    expect(data.persons.b.given).toBe('Bosse');
    expect(data.persons.c).toBeUndefined();
    expect(data.persons.n.given).toBe('Ny');
    expect(conflicts).toEqual([]);
  });
  it('lets the newer edit win when both changed the same person', () => {
    const mine = { persons: { ...base.persons, a: { id: 'a', given: 'Mitt', updatedAt: '3' } } };
    const theirs = { persons: { ...base.persons, a: { id: 'a', given: 'Deras', updatedAt: '2' } } };
    const r = core.merge3(bh, mine, theirs);
    expect(r.data.persons.a.given).toBe('Mitt');
    expect(r.conflicts).toEqual(['persons:a']);
  });
  it('keeps comments written at the same time by two people, and merges archives without comments', () => {
    const mine = { persons: base.persons, comments: { c1: { id: 'c1', kind: 'comment', personId: 'a', text: 'Vet någon när Anna föddes?' } } };
    const theirs = { persons: base.persons, comments: { c2: { id: 'c2', kind: 'comment', personId: 'a', text: 'Dopboken säger 1850.' } } };
    const r = core.merge3(bh, mine, theirs);
    expect(Object.keys(r.data.comments).sort()).toEqual(['c1', 'c2']);
    expect(r.conflicts).toEqual([]);
    expect(core.merge3(bh, { persons: base.persons }, { persons: base.persons }).data.comments).toEqual({});
  });
  it('round-trips encrypted data and rejects the wrong key', async () => {
    const key = core.newKey();
    const payload = await core.encryptJSON(base, key);
    expect(payload.startsWith('k1.')).toBe(true);
    expect(payload).not.toContain('Anna');
    expect(await core.decryptJSON(payload, key)).toEqual(base);
    await expect(core.decryptJSON(payload, core.newKey())).rejects.toThrow();
    expect(await core.writeSecret(key)).toBe(await core.writeSecret(key));
  });
});

describe('createHistory', () => {
  const doc = (id, given) => ({ kind: 'person', id, given });
  it('groups changes, undoes newest first and redoes in order', () => {
    const h = core.createHistory();
    h.record({ kind: 'person', id: 'a', before: null, after: doc('a', 'Ada') }, 'Ny person');
    h.record({ kind: 'person', id: 'b', before: doc('b', 'Bo'), after: doc('b', 'Bosse') });
    h.close();
    const u = h.undo();
    expect(u.group.label).toBe('Ny person');
    expect(u.apply.map(x => x.id)).toEqual(['b', 'a']);
    expect(u.apply[0].doc.given).toBe('Bo');
    expect(u.apply[1].doc).toBeNull();
    expect(h.canUndo()).toBe(false);
    const r = h.redo();
    expect(r.apply.map(x => [x.id, x.doc.given])).toEqual([['a', 'Ada'], ['b', 'Bosse']]);
  });
  it('keeps the first "before" when one document changes twice in an action', () => {
    const h = core.createHistory();
    h.record({ kind: 'person', id: 'a', before: doc('a', 'A1'), after: doc('a', 'A2') });
    h.record({ kind: 'person', id: 'a', before: doc('a', 'A2'), after: doc('a', 'A3') });
    const u = h.undo();
    expect(u.apply).toHaveLength(1);
    expect(u.apply[0].doc.given).toBe('A1');
    expect(h.redo().apply[0].doc.given).toBe('A3');
  });
  it('drops the redo stack on a new change and caps its length', () => {
    const h = core.createHistory({ limit: 3 });
    for (let i = 0; i < 5; i++) { h.record({ kind: 'person', id: 'p' + i, before: null, after: doc('p' + i, 'x') }); h.close(); }
    expect(h.size().undo).toBe(3);
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.record({ kind: 'person', id: 'z', before: null, after: doc('z', 'z') });
    expect(h.canRedo()).toBe(false);
  });
});

describe('GEDCOM import', () => {
  const GED = [
    '0 HEAD', '1 SOUR DISGEN', '2 NAME Disgen', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8',
    '0 @I1@ INDI', '1 NAME Gustav* Eriksson /Vasa/', '1 SEX M',
    '1 BIRT', '2 DATE 12 MAY 1496', '2 PLAC Rydboholm, Östra Ryd', '3 MAP', '4 LATI N59.4667', '4 LONG E18.2167', '2 SOUR @S1@', '3 PAGE s. 12',
    '1 DEAT', '2 DATE 29 SEP 1560', '2 PLAC Stockholm',
    '1 OCCU Kung av Sverige', '1 BURI', '2 DATE 21 DEC 1560', '2 PLAC Uppsala domkyrka',
    '1 NOTE Valdes till kung i Strängnäs', '2 CONC  1523.', '2 CONT Andra raden.',
    '1 OBJE', '2 FILE gustav.jpg', '1 FAMS @F1@',
    '0 @I2@ INDI', '1 NAME Margareta /Leijonhufvud/', '1 SEX F', '1 BIRT', '2 DATE ABT 1514', '1 FAMS @F1@',
    '0 @I3@ INDI', '1 NAME Johan /Vasa/', '1 SEX M', '1 BIRT', '2 DATE 20 DEC 1537', '2 PLAC Stegeborg', '1 _ODD x', '1 FAMC @F1@',
    '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@', '1 MARR', '2 DATE 1 OCT 1536', '2 PLAC Uppsala',
    '0 @S1@ SOUR', '1 TITL Östra Ryd (AB) C:1 födelsebok', '1 REPO @R1@',
    '0 @R1@ REPO', '1 NAME Riksarkivet',
    '0 TRLR'].join('\r\n');
  it('reads people, families, places, sources and notes', () => {
    const r = core.parseGedcom(GED, { now: '2026-01-01T00:00:00Z' });
    expect(r.stats).toMatchObject({ persons: 3, families: 1, sources: 1, places: 5 });
    expect(r.from).toBe('Disgen');
    const ps = Object.values(r.persons), by = n => ps.find(p => p.given === n);
    const g = by('Gustav Eriksson'), m = by('Margareta'), j = by('Johan');
    expect(g).toMatchObject({ surname: 'Vasa', callName: 'Gustav', sex: 'M', birthDate: '1496-05-12', deathDate: '1560-09-29', occupation: 'Kung av Sverige' });
    expect(g.notes).toBe('Valdes till kung i Strängnäs 1523.\nAndra raden.');
    expect(r.places[g.birthPlace]).toMatchObject({ name: 'Rydboholm, Östra Ryd', lat: 59.4667, lon: 18.2167 });
    expect(m).toMatchObject({ sex: 'K', birthDate: 'ca 1514' });
    expect(j.fatherId).toBe(g.id); expect(j.motherId).toBe(m.id);
    expect(g.spouseIds).toEqual([m.id]);
    const marr = g.events.find(e => e.type === 'Vigsel');
    expect(marr).toMatchObject({ withId: m.id, date: '1536-10-01' });
    expect(g.events.find(e => e.type === 'Begravning').date).toBe('1560-12-21');
    const src = Object.values(r.sources)[0];
    expect(src).toMatchObject({ type: 'Födelse- och dopbok', archive: 'Riksarkivet' });
    expect(g.citations).toEqual([{ sourceId: src.id, about: 'Födelse', detail: 's. 12' }]);
    expect(r.warnings.join(' ')).toMatch(/1 bildlänkar/);
    expect(r.warnings.join(' ')).toMatch(/_ODD/);
  });
  it('converts GEDCOM dates', () => {
    const f = core.fromGedDate;
    expect(f('12 JAN 1850')).toBe('1850-01-12');
    expect(f('JAN 1850')).toBe('1850-01');
    expect(f('1850')).toBe('1850');
    expect(f('ABT 1850')).toBe('ca 1850');
    expect(f('BEF 3 MAR 1700')).toBe('före 1700-03-03');
    expect(f('AFT 1700')).toBe('efter 1700');
    expect(f('BET 1850 AND 1860')).toBe('mellan 1850 och 1860');
    expect(f('@#DJULIAN@ 6 JUN 1523')).toBe('1523-06-06');
    expect(f('11 FEB 1700/01')).toBe('1700-02-11');
    expect(f('(på våren)')).toBe('på våren');
  });
  it('decodes ANSEL, IBM PC and Windows-1252 files', () => {
    const head = s => [...('0 HEAD\r\n1 CHAR ' + s + '\r\n0 @I1@ INDI\r\n1 NAME ')].map(c => c.charCodeAt(0));
    const tail = [...' /x/\r\n0 TRLR'].map(c => c.charCodeAt(0));
    const ansel = new Uint8Array([...head('ANSEL'), 0xEA, 0x41, 0x73, 0x61, 0x20, 0xE8, 0x6F, 0x6C, ...tail]); // "Åsa öl" with combining marks first
    expect(core.decodeGedcom(ansel).text).toContain('Åsa öl');
    const ibm = new Uint8Array([...head('IBMPC'), 0x8F, 0x73, 0x61, 0x20, 0x84, 0x94, ...tail]);
    expect(core.decodeGedcom(ibm).text).toContain('Åsa äö');
    const win = new Uint8Array([...head('ANSI'), 0xC5, 0x73, 0x61, ...tail]);
    expect(core.decodeGedcom(win).text).toContain('Åsa');
    const utf = new TextEncoder().encode('﻿0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Åsa /Öberg/\n0 TRLR');
    const p = Object.values(core.parseGedcom(core.decodeGedcom(utf).text).persons)[0];
    expect([p.given, p.surname]).toEqual(['Åsa', 'Öberg']);
  });
});

describe('Swedish source citations', () => {
  const p = core.parseSwedishCitation;
  it('reads an ArkivDigital citation', () => {
    expect(p('Röke (L) AII:3 (1918-1933) Bild 70 / sid 3 (AID: v350192.b70.s3, NAD: SE/LLA/13324)')).toMatchObject({
      from: 'ad', parish: 'Röke', county: 'Kristianstads län', volume: 'AII:3', years: '1918–1933', type: 'Församlingsbok',
      title: 'Röke (L) AII:3 (1918–1933)', image: '70', page: '3', aid: 'v350192.b70.s3', detail: 'Bild 70 / sid 3 (AID: v350192.b70.s3)', key: 'SE/LLA/13324|AII:3' });
    expect(p('Hardemo (T) C:3 (1689-1750) Bild 56')).toMatchObject({ type: 'Födelse- och dopbok', county: 'Örebro län', detail: 'Bild 56' });
    expect(p('Rättvik (W) AI:15 (1850-1855) Image 12 / Page 3')).toMatchObject({ type: 'Husförhörslängd', image: '12', page: '3' });
  });
  it('reads a Riksarkivet citation and links the image', () => {
    const r = p('Röke kyrkoarkiv, Församlingsböcker, SE/LLA/13324/A II/3 (1918-1933), bildid: 00127782_00010');
    expect(r).toMatchObject({ from: 'ra', parish: 'Röke', type: 'Församlingsbok', bildid: '00127782_00010',
      url: 'https://sok.riksarkivet.se/bildvisning/00127782_00010', detail: 'bildid: 00127782_00010' });
    // the same volume from both services gets the same key, so it becomes one source
    expect(r.key).toBe(p('Röke (L) AII:3 (1918-1933) Bild 70 (AID: v350192.b70.s3, NAD: SE/LLA/13324)').key);
    expect(p('Linköpings domkyrkoförsamlings kyrkoarkiv, Födelse- och dopböcker, SE/VaLA/00222/C I/1 (1664-1694), bildid: C0016904_00105'))
      .toMatchObject({ parish: 'Linköping', type: 'Födelse- och dopbok', years: '1664–1694' });
    expect(p('https://sok.riksarkivet.se/bildvisning/C0016904_00105')).toMatchObject({ bildid: 'C0016904_00105', title: '' });
  });
  it('keeps AID and image ids from GEDCOM page references', () => {
    const g = ['0 HEAD', '1 CHAR UTF-8', '0 @S1@ SOUR', '1 TITL Röke (L) AII:3', '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 SOUR @S1@', '3 PAGE Bild 70 / sid 3 (AID: v350192.b70.s3)', '1 DEAT', '2 SOUR @S1@', '3 PAGE bildid: C0016904_00105', '0 TRLR'].join('\n');
    const c = Object.values(core.parseGedcom(g).persons)[0].citations;
    expect(c[0].aid).toBe('v350192.b70.s3');
    expect(c[1].url).toBe('https://sok.riksarkivet.se/bildvisning/C0016904_00105');
  });
  it('ignores other text', () => { expect(p('Muntligt från moster Lena')).toBeNull(); expect(p('')).toBeNull(); });
});
