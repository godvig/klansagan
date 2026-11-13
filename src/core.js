// @ts-check
/**
 * Släktsagan core — pure, DOM-free logic shared by the app and the test suite.
 *
 * Everything here works on plain person objects of the shape used in the app:
 *   { id, given, surname, sex: 'M'|'K'|'', birthDate, deathDate, birthPlace,
 *     fatherId, motherId, spouseIds: string[], notDup?: string[] }
 * ('K' = kvinna/female, following the Swedish UI.)
 *
 * Loaded as a classic <script> in the browser (exposes `window.KinCore`) and
 * as a CommonJS module in Node (for Vitest).
 */
(function (root) {
  'use strict';

  /** @typedef {{id:string, given?:string, surname?:string, sex?:string, birthDate?:string, deathDate?:string, birthPlace?:string, fatherId?:string, motherId?:string, spouseIds?:string[], notDup?:string[]}} Person */
  /** @typedef {(id:string)=>Person|undefined|null} Getter */
  /** @typedef {{hide?:string[], hideUp?:string[], hideDown?:string[]}} View */

  /* ---------------------------------------------------------------- dates */

  /** First four-digit year in a free-text date ("ca 1820" → 1820). @param {unknown} s */
  const yearOf = (s) => { const m = String(s ?? '').match(/(\d{4})/); return m ? +m[1] : null; };

  /**
   * Sortable number for a genealogical date. Missing month/day sort mid-year.
   * @param {string|null|undefined} s
   * @returns {number|null}
   */
  function dateKey(s) {
    if (!s) return null;
    const m = String(s).match(/(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
    if (!m) return null;
    return +m[1] + ((+(m[2] || 6)) - 1) / 12 + ((+(m[3] || 15)) - 1) / 372;
  }

  const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

  /** "1496-05-12" → "12 maj 1496". Anything else is returned as-is. @param {string|null|undefined} s */
  function fmtDate(s) {
    if (!s) return '';
    const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
    const m2 = String(s).match(/^(\d{4})-(\d{1,2})$/); if (m2) return `${MONTHS[+m2[2] - 1]} ${m2[1]}`;
    return String(s);
  }

  /** Date phrase for running text: "den 12 maj 1496", "år 1496", "ca 1820". @param {string|null|undefined} s */
  function whenText(s) {
    if (!s) return '';
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return 'den ' + fmtDate(s);
    if (/^\d{4}-\d{1,2}$/.test(s)) return 'i ' + fmtDate(s);
    if (/^\d{4}$/.test(s)) return 'år ' + s;
    return s;
  }

  /** Free-text date → GEDCOM 5.5.1 date ("ca 1780" → "ABT 1780"). @param {string|null|undefined} s */
  function gedDate(s) {
    if (!s) return '';
    s = String(s).trim();
    const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    let pre = '';
    if (/^(ca|cirka|omkr|omkring|~)/i.test(s)) pre = 'ABT ';
    else if (/^(före|fore|innan)/i.test(s)) pre = 'BEF ';
    else if (/^(efter)/i.test(s)) pre = 'AFT ';
    const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return pre + (+m[3]) + ' ' + M[+m[2] - 1] + ' ' + m[1];
    const m2 = s.match(/(\d{4})-(\d{1,2})/); if (m2) return pre + M[+m2[2] - 1] + ' ' + m2[1];
    const y = yearOf(s); return y ? pre + y : s;
  }

  /* ---------------------------------------------------------------- text */

  /** Swedish genitive: "Anna" → "Annas", "Lars" → "Lars", "Johan III" → "Johan III:s". @param {string} n */
  const genitive = (n) => /\s[IVXLC]+$|[0-9A-ZÅÄÖ]$/.test(n) ? n + ':s' : /[sxz]$/i.test(n) ? n : n + 's';

  /** URL-safe slug for view links ("Pappas sida" → "pappas-sida"). @param {string} t */
  const slugify = (t) => String(t || 'vy').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'vy';

  /**
   * Parse text copied from Excel or a CSV file. Detects tab, semicolon or comma
   * from the first line and supports quoted fields with "" escapes.
   * @param {string} text
   * @returns {string[][]}
   */
  function parseDelimited(text) {
    text = text.replace(/^\ufeff/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const D = ['\t', ';', ','].map((d) => /** @type {[string, number]} */([d, first.split(d).length])).sort((a, b) => b[1] - a[1])[0][0];
    /** @type {string[][]} */ const rows = []; /** @type {string[]} */ let row = []; let cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"' && cur === '') q = true;
      else if (c === D) { row.push(cur.trim()); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows;
  }

  /* ---------------------------------------------------------------- duplicates */

  /** Normalise a name for fuzzy matching (Gustaf/Gustav, Wasa/Vasa, Larsdtr/Larsdotter). @param {string|undefined} s */
  function nrm(s) {
    return String(s || '').toLowerCase().normalize('NFC').replace(/[éè]/g, 'e').replace(/w/g, 'v').replace(/ph/g, 'f')
      .replace(/th/g, 't').replace(/ck/g, 'k').replace(/c(?=[aou])/g, 'k').replace(/q/g, 'k').replace(/z/g, 's')
      .replace(/dtr$/, 'dotter').replace(/(.)\1+/g, '$1').trim();
  }

  /** Levenshtein distance. @param {string} a @param {string} b */
  function lev(a, b) {
    if (a === b) return 0;
    if (!a || !b) return Math.max(a.length, b.length);
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
    }
    return d[b.length];
  }

  /**
   * 0–100 likelihood that two records are the same person (≥ 60 is shown as a candidate).
   * @param {Person} a @param {Person} b
   */
  function dupScore(a, b) {
    if (a.sex && b.sex && a.sex !== b.sex) return 0;
    if (a.fatherId === b.id || a.motherId === b.id || b.fatherId === a.id || b.motherId === a.id) return 0;
    if ((a.notDup || []).includes(b.id) || (b.notDup || []).includes(a.id)) return 0;
    const ga = nrm((a.given || '').split(/\s+/)[0]), gb = nrm((b.given || '').split(/\s+/)[0]);
    if (!ga || !gb) return 0;
    let s = 0; const gd = lev(ga, gb);
    if (gd === 0) s += 30; else if (gd === 1 && ga.length > 3) s += 18; else return 0;
    const sa = nrm(a.surname), sb = nrm(b.surname);
    if (sa && sb) { const d = lev(sa, sb); if (d === 0) s += 25; else if (d <= 2) s += 15; else s -= 25; } else s += 5;
    const ya = yearOf(a.birthDate), yb = yearOf(b.birthDate);
    if (ya && yb) { const d = Math.abs(ya - yb); if (d === 0) s += 25; else if (d <= 2) s += 14; else if (d > 5) return 0; else s -= 10; } else s += 4;
    const da = yearOf(a.deathDate), db = yearOf(b.deathDate);
    if (da && db) { const d = Math.abs(da - db); if (d === 0) s += 10; else if (d > 3) s -= 30; }
    if (a.fatherId && a.fatherId === b.fatherId) s += 15;
    if (a.motherId && a.motherId === b.motherId) s += 15;
    if (a.birthPlace && a.birthPlace === b.birthPlace) s += 10;
    return Math.max(0, Math.min(100, s));
  }

  /* ---------------------------------------------------------------- views */

  /**
   * Ids hidden by a view.
   *  - hide:     the person only
   *  - hideUp:   the person's ancestors and the ancestors' other descendants
   *              (e.g. "mum's side"), the person and their own descendants stay
   *  - hideDown: the person's descendants
   * People whose only connections are hidden (an aunt's husband) are hidden too.
   * @param {Record<string, Person>} persons @param {View} v
   * @returns {Set<string>}
   */
  function computeHidden(persons, v) {
    /** @type {Set<string>} */ const H = new Set();
    const A = persons; /** @type {Record<string,string[]>} */ const ch = {}; /** @type {Record<string,Set<string>>} */ const spx = {};
    for (const p of Object.values(A)) {
      for (const k of /** @type {const} */(['fatherId', 'motherId'])) { const pid = p[k]; if (pid) (ch[pid] = ch[pid] || []).push(p.id); }
      for (const s of p.spouseIds || []) { (spx[p.id] = spx[p.id] || new Set()).add(s); (spx[s] = spx[s] || new Set()).add(p.id); }
    }
    /** @param {string} id */
    const anc = (id) => { const out = new Set(), st = [id]; while (st.length) { const x = A[/** @type {string} */(st.pop())]; if (!x) continue; for (const k of /** @type {const} */(['fatherId', 'motherId'])) { const y = x[k]; if (y && !out.has(y)) { out.add(y); st.push(y); } } } return out; };
    /** @param {string} id */
    const desc = (id) => { const out = new Set(), st = [id]; while (st.length) { for (const c of ch[/** @type {string} */(st.pop())] || []) if (!out.has(c)) { out.add(c); st.push(c); } } return out; };
    for (const id of v.hideUp || []) { const keep = desc(id); keep.add(id); for (const a of anc(id)) { H.add(a); for (const d of desc(a)) if (!keep.has(d)) H.add(d); } }
    for (const id of v.hideDown || []) for (const d of desc(id)) H.add(d);
    for (const id of v.hide || []) H.add(id);
    for (let pass = 0; pass < 2; pass++) for (const p of Object.values(A)) {
      if (H.has(p.id)) continue;
      const links = new Set([p.fatherId, p.motherId, ...(ch[p.id] || []), ...(spx[p.id] || [])].filter((x) => x && A[x]));
      for (const c of ch[p.id] || []) { const cc = A[c]; const o = cc && (cc.fatherId === p.id ? cc.motherId : cc.fatherId); if (o && A[o]) links.add(o); }
      if (links.size && [...links].every((x) => H.has(/** @type {string} */(x)))) H.add(p.id);
    }
    return H;
  }

  /* ---------------------------------------------------------------- relationships */

  /** Shortest ancestor paths from `id`: ancestorId → {d, path:[id … ancestorId]}. @param {string} id @param {Getter} get */
  function upMap(id, get) {
    /** @type {Map<string,{d:number,path:string[]}>} */ const m = new Map([[id, { d: 0, path: [id] }]]);
    const q = [id];
    while (q.length) {
      const x = /** @type {string} */(q.shift()); const p = get(x); if (!p) continue;
      for (const k of /** @type {const} */(['fatherId', 'motherId'])) {
        const y = p[k];
        if (y && get(y) && !m.has(y)) { const path = /** @type {{path:string[]}} */(m.get(x)).path.concat(y); m.set(y, { d: path.length - 1, path }); q.push(y); }
      }
    }
    return m;
  }

  /**
   * Closest blood relationship between a and b via a common ancestor.
   * a/b = generations from each person up to the common ancestor.
   * @param {string} a @param {string} b @param {Getter} get
   */
  function blood(a, b, get) {
    const A = upMap(a, get), B = upMap(b, get);
    /** @type {{id:string,a:number,b:number,pa:string[],pb:string[],t:number,commons?:string[],half?:boolean}|null} */ let best = null;
    for (const [id, ia] of A) {
      const ib = B.get(id);
      if (ib) { const t = ia.d + ib.d; if (!best || t < best.t || (t === best.t && Math.abs(ia.d - ib.d) < Math.abs(best.a - best.b))) best = { id, a: ia.d, b: ib.d, pa: ia.path, pb: ib.path, t }; }
    }
    if (!best) return null;
    const bb = best;
    bb.commons = [...A].filter(([id, ia]) => { const ib = B.get(id); return ib && ia.d === bb.a && ib.d === bb.b; }).map(([id]) => id);
    if (bb.a > 0 && bb.b > 0 && bb.commons.length === 1) {
      const ca = get(bb.pa[bb.a - 1]), cb = get(bb.pb[bb.b - 1]);
      const oa = ca && (ca.fatherId === bb.id ? ca.motherId : ca.fatherId), ob = cb && (cb.fatherId === bb.id ? cb.motherId : cb.fatherId);
      bb.half = !!(oa && ob && oa !== ob);
    }
    return bb;
  }

  /**
   * Swedish kinship term for "B is A's ___" given a result from blood().
   * @param {NonNullable<ReturnType<typeof blood>>} r @param {string} bId @param {Getter} get
   */
  function bloodTerm(r, bId, get) {
    /** @param {string} id @param {string} m @param {string} f @param {string|null} n */
    const sx = (id, m, f, n) => { const p = get(id); return p && p.sex === 'M' ? m : p && p.sex === 'K' ? f : n; };
    /** @param {string[]} ids @param {string} mw @param {string} fw */
    const chain = (ids, mw, fw) => {
      const w = ids.map((id) => sx(id, mw, fw, null)); if (w.some((x) => !x)) return null;
      const chunks = []; for (let i = 0; i < w.length; i += 2) chunks.push(w.slice(i, i + 2).join('')); return chunks.join('s ');
    };
    /** @param {string[]} path */
    const ancTerm = (path) => { const ids = path.slice(1); const c = chain(ids, 'far', 'mor'); if (c) return c; const k = ids.length; return k === 1 ? 'förälder' : k === 2 ? 'mor- eller farförälder' : `ana i ${k}:e led`; };
    /** @param {string[]} ids */
    const descTerm = (ids) => { const c = chain(ids, 'son', 'dotter'); if (c) return c; const k = ids.length; return k === 1 ? 'barn' : k === 2 ? 'barnbarn' : k === 3 ? 'barnbarnsbarn' : `ättling i ${k}:e led`; };
    /** @param {number} n */
    const cous = (n) => n === 2 ? 'kusin' : n === 3 ? 'tremänning' : n === 4 ? 'fyrmänning' : n === 5 ? 'femmänning' : n === 6 ? 'sexmänning' : `${n}-männing`;
    const { a, b, pa, pb } = r;
    if (a === 0 && b === 0) return 'samma person';
    if (a === 0) return descTerm(pb.slice(0, b).reverse());
    if (b === 0) return ancTerm(pa);
    const h = r.half ? 'halv' : '';
    if (a === 1 && b === 1) return h + sx(bId, 'bror', 'syster', 'syskon');
    if (a === 1) {
      const sib = sx(pb[b - 1], 'bror', 'syster', null), kid = sx(pb[b - 2], 'son', 'dotter', null);
      const base = sib && kid ? ({ bror: { son: 'brorson', dotter: 'brorsdotter' }, syster: { son: 'systerson', dotter: 'systerdotter' } })[sib][kid] : 'syskonbarn';
      const t = h + base;
      return b === 2 ? t : `${t}s ${descTerm(pb.slice(0, b - 2).reverse())}`;
    }
    if (b === 1) {
      const sib = sx(bId, 'bror', 'syster', 'syskon');
      if (a === 2) {
        const pw = sx(pa[1], 'far', 'mor', null);
        if (pw && sib !== 'syskon') return h + ({ far: { bror: 'farbror', syster: 'faster' }, mor: { bror: 'morbror', syster: 'moster' } })[pw][sib];
      }
      return `${ancTerm(pa.slice(0, a))}s ${h}${sib}`;
    }
    if (a === b) return h + cous(a);
    if (a > b) return `${ancTerm(pa.slice(0, a - b + 1))}s ${h}${cous(b)}`;
    return `${h}${cous(a)}s ${descTerm(pb.slice(0, b - a).reverse())}`;
  }

  /**
   * Split people into separate family trees: groups that are not connected
   * through any parent, child or partner link. Largest group first.
   * @param {Record<string, Person>} persons
   * @returns {string[][]}
   */
  function components(persons) {
    /** @type {Record<string, string>} */
    const parent = {};
    /** @param {string} x @returns {string} */
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    /** @param {string} a @param {string} b */
    const join = (a, b) => { if (!(b in parent)) return; const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    for (const id of Object.keys(persons)) parent[id] = id;
    for (const p of Object.values(persons)) {
      if (p.fatherId) join(p.id, p.fatherId);
      if (p.motherId) join(p.id, p.motherId);
      for (const s of p.spouseIds || []) join(p.id, s);
    }
    /** @type {Record<string, string[]>} */
    const groups = {};
    for (const id of Object.keys(persons)) (groups[find(id)] = groups[find(id)] || []).push(id);
    return Object.values(groups).sort((a, b) => b.length - a.length);
  }

  /* ---------- Sharing: hashing, three-way merge, end-to-end encryption ---------- */

  /**
   * Short, stable hash of a JSON-able value (cyrb53). Used to remember what a
   * document looked like at the last published version without storing it.
   * @param {unknown} v
   * @returns {string}
   */
  function docHash(v) {
    const str = JSON.stringify(v);
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  const COLS = ['persons', 'places', 'sources', 'views'];

  /**
   * Hashes of every document in an archive: { persons: { id: hash }, … }.
   * @param {Record<string, Record<string, unknown>>} data
   * @returns {Record<string, Record<string, string>>}
   */
  function hashArchive(data) {
    /** @type {Record<string, Record<string, string>>} */
    const out = {};
    for (const c of COLS) { out[c] = {}; for (const [id, d] of Object.entries((data && data[c]) || {})) out[c][id] = docHash(d); }
    return out;
  }

  /**
   * Three-way merge of two archives that both started from `base` (given as hashes).
   * A document changed on only one side keeps that change; changed on both sides,
   * the one with the later `updatedAt` wins and counts as a conflict. Deletions merge too.
   * @param {Record<string, Record<string, string>>} baseHashes
   * @param {Record<string, Record<string, any>>} mine
   * @param {Record<string, Record<string, any>>} theirs
   * @returns {{ data: Record<string, Record<string, any>>, conflicts: string[] }}
   */
  function merge3(baseHashes, mine, theirs) {
    /** @type {Record<string, Record<string, any>>} */
    const data = {};
    /** @type {string[]} */
    const conflicts = [];
    for (const c of COLS) {
      const B = (baseHashes && baseHashes[c]) || {}, M = (mine && mine[c]) || {}, T = (theirs && theirs[c]) || {};
      data[c] = {};
      for (const id of new Set([...Object.keys(B), ...Object.keys(M), ...Object.keys(T)])) {
        const b = B[id], m = M[id], t = T[id];
        const hm = m === undefined ? undefined : docHash(m), ht = t === undefined ? undefined : docHash(t);
        let pick;
        if (hm === b) pick = t;
        else if (ht === b || hm === ht) pick = m;
        else {
          conflicts.push(c + ':' + id);
          if (m === undefined) pick = t; else if (t === undefined) pick = m;
          else pick = String(m.updatedAt || '') >= String(t.updatedAt || '') ? m : t;
        }
        if (pick !== undefined) data[c][id] = pick;
      }
    }
    return { data, conflicts };
  }

  /** @param {Uint8Array} u @returns {string} */
  function b64u(u) {
    let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  /** @param {string} s @returns {Uint8Array} */
  function unb64u(s) {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
  }

  /** @param {Uint8Array} data @param {'gzip'} fmt @param {boolean} inflate */
  async function zip(data, fmt, inflate) {
    const S = inflate ? DecompressionStream : CompressionStream;
    const stream = new Blob([/** @type {BlobPart} */ (data)]).stream().pipeThrough(new S(fmt));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** New random 256-bit key, base64url. @returns {string} */
  function newKey() { return b64u(crypto.getRandomValues(new Uint8Array(32))); }

  /** @param {string} key */
  function aesKey(key) { return crypto.subtle.importKey('raw', /** @type {BufferSource} */ (unb64u(key)), 'AES-GCM', false, ['encrypt', 'decrypt']); }

  /**
   * Encrypt any JSON value with AES-256-GCM (gzip first when the browser can).
   * Format: "k1.<iv>.<ciphertext>", base64url. The key never leaves the browser.
   * @param {unknown} obj @param {string} key @returns {Promise<string>}
   */
  async function encryptJSON(obj, key) {
    let body = new TextEncoder().encode(JSON.stringify(obj)), flag = 0;
    if (typeof CompressionStream === 'function') { body = await zip(body, 'gzip', false); flag = 1; }
    const plain = new Uint8Array(body.length + 1); plain[0] = flag; plain.set(body, 1);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(key), /** @type {BufferSource} */ (plain)));
    return 'k1.' + b64u(iv) + '.' + b64u(ct);
  }

  /** @param {string} payload @param {string} key @returns {Promise<any>} */
  async function decryptJSON(payload, key) {
    const [ver, iv, ct] = String(payload).split('.');
    if (ver !== 'k1' || !iv || !ct) throw new Error('Okänt format');
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: /** @type {BufferSource} */ (unb64u(iv)) }, await aesKey(key), /** @type {BufferSource} */ (unb64u(ct))));
    let body = plain.subarray(1); if (plain[0] === 1) body = await zip(body, 'gzip', true);
    return JSON.parse(new TextDecoder().decode(body));
  }

  /**
   * Secret that proves to the server you may publish. Derived from the key, so
   * everyone with the link can publish, and the server only ever sees its hash.
   * @param {string} key @returns {Promise<string>}
   */
  async function writeSecret(key) {
    const k = await crypto.subtle.importKey('raw', /** @type {BufferSource} */ (unb64u(key)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('klansagan-write'))));
  }

  /**
   * @typedef {{kind:string,id:string,before:any,after:any}} DocChange
   * @typedef {{label:(string|null),changes:DocChange[]}} HistGroup
   */
  /**
   * Undo/redo history of document changes. Changes recorded close together form one
   * user action (a group); undo returns what to write back, newest change first.
   * Several changes to the same document within a group keep the first "before".
   * @param {{limit?:number}} [opts]
   */
  function createHistory({ limit = 60 } = {}) {
    /** @type {HistGroup[]} */ const undo = [];
    /** @type {HistGroup[]} */ const redo = [];
    /** @type {HistGroup|null} */ let open = null;
    return {
      /** @param {DocChange} ch @param {string} [label] */
      record(ch, label) {
        if (!open) { open = { label: label || null, changes: [] }; undo.push(open); if (undo.length > limit) undo.shift(); redo.length = 0; }
        const ex = open.changes.find(c => c.kind === ch.kind && c.id === ch.id);
        if (ex) ex.after = ch.after; else open.changes.push({ ...ch });
        if (label && !open.label) open.label = label;
      },
      /** Name the action being recorded (or the next one). @param {string} l */
      label(l) { if (open) open.label = l; },
      close() { if (open && !open.changes.length) undo.pop(); open = null; },
      isOpen: () => !!open,
      canUndo: () => undo.length > 0,
      canRedo: () => redo.length > 0,
      peekUndo: () => undo[undo.length - 1] || null,
      peekRedo: () => redo[redo.length - 1] || null,
      /** @returns {{group:HistGroup, apply:{kind:string,id:string,doc:any}[]}|null} */
      undo() {
        this.close(); const g = undo.pop(); if (!g) return null; redo.push(g);
        return { group: g, apply: g.changes.slice().reverse().map(c => ({ kind: c.kind, id: c.id, doc: c.before })) };
      },
      /** @returns {{group:HistGroup, apply:{kind:string,id:string,doc:any}[]}|null} */
      redo() {
        this.close(); const g = redo.pop(); if (!g) return null; undo.push(g);
        return { group: g, apply: g.changes.map(c => ({ kind: c.kind, id: c.id, doc: c.after })) };
      },
      clear() { undo.length = 0; redo.length = 0; open = null; },
      size: () => ({ undo: undo.length, redo: redo.length }),
    };
  }

  const api = { createHistory, yearOf, dateKey, MONTHS, fmtDate, whenText, gedDate, genitive, slugify, parseDelimited, nrm, lev, dupScore, computeHidden, upMap, blood, bloodTerm, components, docHash, hashArchive, merge3, b64u, unb64u, newKey, encryptJSON, decryptJSON, writeSecret };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  // @ts-ignore — browser global
  root.KinCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
