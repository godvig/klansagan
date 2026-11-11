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
