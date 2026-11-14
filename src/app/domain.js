/* Släktsagan · domain.js — Family logic on top of the store: names, places, relatives, ancestors, blobs and thumbnails. */
import { loadImg } from './media.js?v=48';
import { renderAll, select, setFocus } from './router.js?v=48';
import { Share } from './share.js?v=48';
import { ALL, S, applyView, bumpRev, ui } from './state.js?v=48';
import { Store } from './store.js?v=48';
import { NOW_Y, clone, dateKey, esc, norm, toast, uid, yearOf } from './util.js?v=48';

/* ============ Domain helpers ============ */
const P=id=>S.persons[id];
/* Call name (tilltalsnamn): p.callName is normally one of the given names. */
const givenName=p=>ui.nameMode==='call'?(p.callName||(p.given||'').trim().split(/\s+/)[0]||''):(p.given||'');
const shortName=p=>p?(p.callName||p.given||fullName(p)):'Okänd';
const fullName=p=>p?([givenName(p),p.surname].filter(Boolean).join(' ')||'Namnlös'):'Okänd';
/** Given names with the call name underlined, Swedish style. */
const givenHtml=p=>{const g=p.given||''; if(!p.callName) return esc(g); const ws=g.split(/\s+/); const i=ws.findIndex(w=>w.replace(/[()]/g,'')===p.callName);
  return i<0?esc(g)+` <span class="muted">(${esc(p.callName)})</span>`:ws.map((w,j)=>j===i?`<u class="tn" title="Tilltalsnamn">${esc(w)}</u>`:esc(w)).join(' ');};
const fullHtml=p=>ui.nameMode==='call'?esc(fullName(p)):([givenHtml(p),esc(p.surname||'')].filter(Boolean).join(' ')||'Namnlös');
const initials=p=>{const w=[p.given,p.surname].filter(Boolean).join(' ').split(/\s+/).filter(x=>/^[A-ZÅÄÖÉŁ]/i.test(x)&&!/^(av|von|de)$/i.test(x)); return ((w[0]||'?')[0]+(w.length>1&&!/^[IVX]+$/.test(w[1])?w[1][0]:'')).toUpperCase();};
function lifespan(p){const b=yearOf(p.birthDate),d=yearOf(p.deathDate); if(!b&&!d) return p.deceased?'†':''; return (b||'?')+' – '+(d||(p.deceased?'?':b&&NOW_Y-b<105?'':'?'));}
const sexColor=p=>p&&p.sex==='M'?'var(--male)':p&&p.sex==='K'?'var(--female)':'var(--unk)';
const placeName=id=>id&&S.places[id]?S.places[id].name:'';
/* Children by parent, rebuilt only when the set of people shown changes (applyView and
   withAll swap S.persons for a new object, so its identity is the cache key). Walking the
   whole archive for every children() call made one edit cost ~120 ms at 1 500 people. */
let _kidsOf=null,_kids=new Map();
function kidsIndex(){
  if(_kidsOf===S.persons) return _kids;
  const m=new Map(); for(const c of Object.values(S.persons)) for(const k of [c.fatherId,c.motherId]) if(k){ let a=m.get(k); if(!a) m.set(k,a=[]); if(!a.includes(c)) a.push(c); }
  const key=new Map(); const k=c=>{let v=key.get(c); if(v===undefined){v=dateKey(c.birthDate)||9999; key.set(c,v);} return v;};
  for(const a of m.values()) if(a.length>1) a.sort((x,y)=>k(x)-k(y));
  _kidsOf=S.persons; _kids=m; return m;
}
function children(id){const a=kidsIndex().get(id); return a?a.slice():[];}
function partners(p){const set=new Set(p.spouseIds||[]); for(const c of children(p.id)){const o=c.fatherId===p.id?c.motherId:c.fatherId; if(o) set.add(o);} set.delete(p.id); return [...set].map(P).filter(Boolean);}
function siblings(p){if(!p.fatherId&&!p.motherId) return []; return Object.values(S.persons).filter(s=>s.id!==p.id&&((p.fatherId&&s.fatherId===p.fatherId)||(p.motherId&&s.motherId===p.motherId))).sort((a,b)=>(dateKey(a.birthDate)||9999)-(dateKey(b.birthDate)||9999));}
const isImg=m=>/^image\//.test(m&&m.contentType||'');
const isAudio=m=>/^audio\//.test(m&&m.contentType||'');
/** Profile image entry (media item) for a person, or null. */
function avatarMedia(p){const imgs=(p.media||[]).filter(isImg); return imgs.find(m=>m.profile)||imgs[0]||null;}
/* Photo framing: m.focus={x,y,z,nw,nh}. x/y = point (0–1) of the image that should sit
   in the centre of the frame, z = zoom (1 = just covers the frame), nw/nh = natural size.
   Returns the image box in % of a frame with aspect ratio A (width/height). */
function cropPct(m,A){const f=m&&m.focus; if(!f||!f.nw||!f.nh) return null;
  const s=Math.max(A/f.nw,1/f.nh)*(f.z||1), w=f.nw*s, h=f.nh*s;
  const l=Math.min(0,Math.max(A-w,A/2-f.x*w)), t=Math.min(0,Math.max(1-h,.5-f.y*h));
  return {w:w/A*100,h:h*100,l:l/A*100,t:t*100};}
/** <img> for a person's avatar in a frame of aspect A, honouring the saved framing. */
function avImg(p,A=1){const m=avatarMedia(p); if(!m) return ''; const c=cropPct(m,A);
  return c?`<img src="${esc(thumbUrl(m))}" alt="" style="position:absolute;max-width:none;object-fit:fill;width:${c.w}%;height:${c.h}%;left:${c.l}%;top:${c.t}%">`:`<img src="${esc(thumbUrl(m))}" alt="">`;}
/* ---- Image store ----
   Photos live in IndexedDB on this device (localStorage is far too small) and are
   referenced from the data as "kl:<id>". In a shared tree they are also stored on the
   server, each one encrypted with the tree's key, and fetched when first needed. */
const BLOB={}, BLOB_WAIT=new Set();
/* IndexedDB, two stores: "blobs" (photos, voice memories) and "archive" (the text of each
   archive: the local one and every shared tree, keyed like the old localStorage keys). */
const IDB={_db:null,
  open(){return this._db||(this._db=new Promise((ok,bad)=>{const r=indexedDB.open('klansagan',2);
    r.onupgradeneeded=()=>{const db=r.result; for(const n of ['blobs','archive']) if(!db.objectStoreNames.contains(n)) db.createObjectStore(n);};
    r.onsuccess=()=>{const db=r.result; db.onversionchange=()=>{db.close(); IDB._db=null;}; ok(db);}; r.onerror=()=>bad(r.error); r.onblocked=()=>bad(new Error('blocked'));}));},
  async tx(mode,fn,store='blobs'){const db=await this.open(); return new Promise((ok,bad)=>{const t=db.transaction(store,mode); const st=t.objectStore(store); const out=fn(st); t.oncomplete=()=>ok(out?out.result:undefined); t.onerror=()=>bad(t.error); t.onabort=()=>bad(t.error||new Error('aborted'));});},
  get(id){return this.tx('readonly',st=>st.get(id));},
  put(id,v){return this.tx('readwrite',st=>st.put(v,id));},
  aget(k){return this.tx('readonly',st=>st.get(k),'archive');},
  aput(k,v){return this.tx('readwrite',st=>st.put(v,k),'archive');},
};
const PIXEL='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const blobId=m=>m&&typeof m.url==='string'&&m.url.startsWith('kl:')?m.url.slice(3):null;
/** URL to show for a media item. Stored photos load in the background and the page redraws. */
/** Small version for trees, lists and avatars; falls back to the full image. */
function thumbUrl(m){ if(!m) return ''; if(m.thumb){ const tid=blobId({url:m.thumb}); if(BLOB[tid]) return BLOB[tid]; const fid=blobId(m); if(fid&&BLOB[fid]) return BLOB[fid]; return murl({url:m.thumb}); } return murl(m); }
/** Scale a data URL down to at most `max` px on the long side. */
function makeThumb(dataUrl,max=240,q=.8){return loadImg(dataUrl).then(img=>{const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)); const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.naturalWidth*k)); c.height=Math.max(1,Math.round(img.naturalHeight*k)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); return c.toDataURL('image/jpeg',q);});}
function murl(m){const id=blobId(m); if(!id) return m?m.url:''; if(BLOB[id]) return BLOB[id]; needBlob(id); return PIXEL;}
let _blobTimer=null;
function needBlob(id){ if(BLOB_WAIT.has(id)) return; BLOB_WAIT.add(id); clearTimeout(_blobTimer); _blobTimer=setTimeout(loadBlobs,30); }
async function loadBlobs(){
  const ids=[...BLOB_WAIT]; let got=0; const missing=[];
  for(const id of ids){ try{const v=await IDB.get(id); if(v){BLOB[id]=v; got++; BLOB_WAIT.delete(id);} else missing.push(id);}catch(e){missing.push(id);} }
  if(missing.length&&Share.cur()){ try{ got+=await Share.fetchBlobs(missing); }catch(e){console.warn('Kunde inte hämta bilder',e);} }
  missing.forEach(id=>{ if(!BLOB[id]) setTimeout(()=>BLOB_WAIT.delete(id),30000); else BLOB_WAIT.delete(id); });
  if(got){ bumpRev(); renderAll(); if(ui.sel) select(ui.sel.type,ui.sel.id); }
}
/** Make sure a media item's image is loaded, and return a usable URL. */
async function blobUrl(m){const id=blobId(m); if(!id) return m.url; if(BLOB[id]) return BLOB[id];
  let v=await IDB.get(id).catch(()=>null); if(!v&&Share.cur()){await Share.fetchBlobs([id]); v=BLOB[id];} if(v) BLOB[id]=v; return v||PIXEL;}
async function storeBlob(dataUrl){const id=KinCore.b64u(crypto.getRandomValues(new Uint8Array(16))); await IDB.put(id,dataUrl); BLOB[id]=dataUrl; return id;}
/** Move photos embedded in the data (older versions, imports) into the image store. */
async function migrateInline(){
  if(Store.mode==='db'||typeof indexedDB==='undefined') return false; let n=0;
  for(const col of ['persons','places','sources']) for(const o of Object.values(ALL[col])){
    if(!(o.media||[]).some(m=>typeof m.url==='string'&&m.url.startsWith('data:'))) continue;
    const map={};
    for(const m of o.media) if(typeof m.url==='string'&&m.url.startsWith('data:')){ try{const full=m.url; m.url='kl:'+await storeBlob(full); map[full]=m.url; if(isImg(m)) m.thumb='kl:'+await storeBlob(await makeThumb(full)); delete m.local; n++;}catch(e){return false;} }
    for(const m of o.media) if(m.forImg&&map[m.forImg]) m.forImg=map[m.forImg]; }
  if(n){ Store.saveNow(); }
  return n>0;
}
/** Give older photos a thumbnail, using full images already on this device. */
async function backfillThumbs(){
  if(Store.mode==='db'||Store.demo||typeof indexedDB==='undefined') return 0; let n=0;
  for(const col of ['persons','places','sources']) for(const id of Object.keys(ALL[col])){ const o=ALL[col][id];
    const todo=(o.media||[]).filter(m=>isImg(m)&&blobId(m)&&!m.thumb); if(!todo.length) continue;
    const q=clone(o); let ch=false;
    for(const m of q.media){ if(!(isImg(m)&&blobId(m)&&!m.thumb)) continue;
      const full=BLOB[blobId(m)]||await IDB.get(blobId(m)).catch(()=>null); if(!full) continue;
      try{ m.thumb='kl:'+await storeBlob(await makeThumb(full)); ch=true; n++; }catch(e){} }
    if(ch) ALL[col][id]=q; }
  if(n){ applyView(); Store.saveNow(); Share.updateStatus(); renderAll(); }
  return n;
}
/** All image ids referenced by the archive. */
function blobRefs(data){const out=new Set(); for(const col of ['persons','places','sources']) for(const o of Object.values(data[col]||{})) for(const m of o.media||[]){const id=blobId(m); if(id) out.add(id); const t=blobId({url:m.thumb}); if(t) out.add(t);} return out;}
function avatarUrl(p){const imgs=(p.media||[]).filter(isImg); const m=imgs.find(m=>m.profile)||imgs[0]; return m?thumbUrl(m):null;}
const homePerson=()=>Object.values(S.persons).find(p=>p.home);
function goHome(){const h=homePerson(); if(h) setFocus(h.id); else {const first=Object.values(S.persons).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''))[0]; if(first) setFocus(first.id);} ui.sel=null; ui.treeKey=null; ui.plQuery=''; if(location.hash!=='#trad') location.hash='trad'; else renderAll(true); window.scrollTo(0,0);}
async function setHome(id){for(const p of Object.values(ALL.persons)) if(p.home&&p.id!==id){const q=clone(p); delete q.home; await Store.put(q,{silent:true});} const q=clone(P(id)); q.home=true; await Store.put(q); toast('★ '+fullName(q)+' är markerad som ”jag”. Startsidan och släktskap utgår nu härifrån.',4500);}
function ancestorsOf(id,max=50){const out=new Set();const walk=(i,d)=>{const p=P(i);if(!p||d>max)return;for(const k of ['fatherId','motherId']){if(p[k]&&!out.has(p[k])){out.add(p[k]);walk(p[k],d+1);}}};walk(id,0);return out;}
function descendantsOf(id){const out=new Set();const walk=i=>{for(const c of children(i)){if(!out.has(c.id)){out.add(c.id);walk(c.id);}}};walk(id);return out;}
function scopeSet(scope){
  const f=ui.focus&&P(ui.focus)?ui.focus:null;
  if(scope==='alla'||!f) return null;
  const s=scope==='anor'?ancestorsOf(f):descendantsOf(f); s.add(f); return s;
}
/** All dated facts for a person (birth, death, events) */
function lifeEvents(p){
  const ev=[];
  if(p.birthDate||p.birthPlace) ev.push({type:'Född',date:p.birthDate,placeId:p.birthPlace,fixed:'birth'});
  for(const e of p.events||[]) ev.push(Object.assign({},e));
  if(p.deathDate||p.deathPlace) ev.push({type:'Död',date:p.deathDate,placeId:p.deathPlace,fixed:'death'});
  return ev.sort((a,b)=>{const ka=dateKey(a.date),kb=dateKey(b.date); if(a.fixed==='birth') return -1; if(b.fixed==='birth') return 1; if(a.fixed==='death'&&kb!=null) return ka==null?1:ka-kb; return (ka??9e9)-(kb??9e9);});
}
function ensurePlace(name){
  name=String(name||'').trim(); if(!name) return {id:'',created:null};
  const n=norm(name);
  const ex=Object.values(S.places).find(pl=>norm(pl.name)===n);
  if(ex) return {id:ex.id,created:null};
  const pl={kind:'place',id:uid('pl'),name}; S.places[pl.id]=pl; return {id:pl.id,created:pl};
}
function ageAt(p){const b=yearOf(p.birthDate),d=yearOf(p.deathDate); if(b&&d) return d-b; return null;}
function personLabel(p){const ls=lifespan(p); return fullName(p)+(ls?' ('+ls.replace(/\s/g,'')+')':'');}

export { P, givenName, shortName, fullName, givenHtml, fullHtml, initials, lifespan, sexColor, placeName, children, partners, siblings, isImg, isAudio, avatarMedia, cropPct, avImg, BLOB, BLOB_WAIT, IDB, PIXEL, blobId, thumbUrl, makeThumb, murl, _blobTimer, needBlob, loadBlobs, blobUrl, storeBlob, migrateInline, backfillThumbs, blobRefs, avatarUrl, homePerson, goHome, setHome, ancestorsOf, descendantsOf, scopeSet, lifeEvents, ensurePlace, ageAt, personLabel };
