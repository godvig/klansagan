"use strict";
/* Klansagan — app shell. Pure logic lives in src/core.js (window.KinCore). */
const {yearOf,dateKey,MONTHS,fmtDate,whenText,gedDate,genitive,slugify,parseDelimited,nrm,lev,dupScore}=window.KinCore;
const computeHidden=v=>KinCore.computeHidden(ALL.persons,v);
const blood=(a,b)=>KinCore.blood(a,b,P);
const bloodTerm=(r,aId,bId)=>KinCore.bloodTerm(r,bId,P);
const sx=(id,m,f,n)=>{const p=P(id); return p&&p.sex==='M'?m:p&&p.sex==='K'?f:n;};
/* ============ Helpers ============ */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>p+'_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
const norm=s=>String(s??'').toLowerCase().normalize('NFC').replace(/\s+/g,' ').trim();
const clone=o=>JSON.parse(JSON.stringify(o));
const NOW_Y=new Date().getFullYear();
function toast(msg,ms=2600,action){document.querySelectorAll('.toast').forEach(o=>o.remove());const t=document.createElement('div');t.className='toast';const sp=document.createElement('span');sp.textContent=msg;t.appendChild(sp);
  if(action){const b=document.createElement('button');b.className='toast-btn';b.textContent=action.label;b.onclick=()=>{t.remove();action.fn();};t.appendChild(b);}
  document.body.appendChild(t);setTimeout(()=>t.remove(),ms)}

const EVENT_TYPES=['Dop','Konfirmation','Vigsel','Kröning','Skilsmässa','Flytt','Bosatt','Yrke','Militärtjänst','Utvandring','Invandring','Begravning','Bouppteckning','Fotografi','Övrigt'];
const SOURCE_TYPES=['Husförhörslängd','Församlingsbok','Födelse- och dopbok','Lysnings- och vigselbok','Död- och begravningsbok','Flyttlängd','Bouppteckning','Folkräkning','Mantalslängd','Generalmönsterrulla','Emigrantregister','Passagerarlista','Domstolsprotokoll','Fotografi','Brev','Muntlig uppgift','Webbplats','Övrigt'];
const HIST=[
  {a:1520,b:1520,t:'Stockholms blodbad'},
  {a:1527,b:1527,t:'Reformationen inleds (Västerås riksdag)'},
  {a:1542,b:1543,t:'Dackefejden'},
  {a:1563,b:1570,t:'Nordiska sjuårskriget'},
  {a:1618,b:1648,t:'Trettioåriga kriget'},
  {a:1628,b:1628,t:'Regalskeppet Vasa sjunker'},
  {a:1686,b:1686,t:'Kyrkolagen – kyrkböcker krävs'},
  {a:1710,b:1711,t:'Pesten'},
  {a:1808,b:1809,t:'Finska kriget'},
  {a:1834,b:1834,t:'Koleran'},
  {a:1867,b:1869,t:'Nödåren'},
  {a:1868,b:1914,t:'Den stora emigrationen'},
  {a:1901,b:1901,t:'Allmän värnplikt'},
  {a:1918,b:1920,t:'Spanska sjukan'},
  {a:1921,b:1921,t:'Allmän rösträtt'},
  {a:1939,b:1945,t:'Andra världskriget'},
  {a:1991,b:1991,t:'Folkbokföringen till Skatteverket'},
];

/* ============ State ============ */
const ALL={persons:{},places:{},sources:{},views:{}};
const S={persons:{},places:ALL.places,sources:ALL.sources,views:ALL.views};
const KIND={person:'persons',place:'places',source:'sources',view:'views'};
const APP_VERSION='2026-11-13.12';
const ui={nameMode:(()=>{try{return localStorage.getItem('sa-names')||'full';}catch(e){return 'full';}})(),simple:false,view:'trad',focus:null,sel:null,ancGen:3,descGen:2,kinDeg:2,plFilter:'alla',plSort:'namn',plQuery:'',
  tlScope:'alla',tlHist:true,mapScope:'alla',mapRoute:true,placing:null,treeKey:null,viewId:null};
try{const f=localStorage.getItem('sa-focus'); if(f) ui.focus=f; const v=localStorage.getItem('sa-viewid'); if(v) ui.viewId=v;}catch(e){}
let HIDDEN=new Set();
const activeView=()=>(ui.viewId&&ALL.views[ui.viewId])||null;
function applyView(){
  const v=activeView(); HIDDEN=v?computeHidden(v):new Set();
  const o={}; for(const id in ALL.persons) if(!HIDDEN.has(id)) o[id]=ALL.persons[id];
  S.persons=o; S.places=ALL.places; S.sources=ALL.sources; S.views=ALL.views;
}
function withAll(fn){const saved=S.persons; S.persons=ALL.persons; try{return fn();} finally{S.persons=saved;}}
function viewCounts(v){return computeHidden(v).size;}

/* ============ Store ============ */
const Store={
  mode:'loading',col:null,demo:null,canEdit:true,isAdmin:true,myId:null,user:null,assets:null,downloads:null,chains:{},loaded:false,
  async init(){
    let db=null,user=null;
    if(window.claude && typeof window.claude.use==='function'){
      const get=n=>Promise.resolve(window.claude.use(n)).catch(()=>null);
      [db,user,this.assets,this.downloads]=await Promise.all([get('db'),get('user'),get('assets'),get('downloads')]);
    }
    if(db){
      this.mode='db'; this.col=db.collection('tree'); this.user=user;
      if(user){
        try{const w=await user.can('data.write'); if(w===false) this.canEdit=false;}catch(e){}
        try{this.isAdmin=!!(await user.canEdit());}catch(e){this.isAdmin=false;}
        try{this.myId=await user.id();}catch(e){}
      } else this.isAdmin=false;
      this.subscribe();
    }else{
      this.mode='local';
      if(Share.pendingJoin){const j=Share.pendingJoin; Share.pendingJoin=null; await Share.join(j.id,j.key);}
      this.loadLocal(); this.loaded=true; purgeLegacyDemo(); applyView();
      Share.updateStatus(); Share.startPolling();
      renderAll();
      migrateInline().then(ch=>{ if(ch){ Share.updateStatus(); renderAll(); } });
    }
  },
  subscribe(){
    setStatus('', 'Hämtar…');
    let timer=setTimeout(()=>setStatus('warn','Databasen svarar inte ännu'),10000);
    this.col.onSnapshot(snap=>{
      if(!snap.metadata.fromCache){clearTimeout(timer); setStatus('ok',this.canEdit?'Delas & sparas i molnet':'Endast läsning');}
      const T=this.demo?this.demo.saved:ALL;
      T.persons={};T.places={};T.sources={};T.views={};
      for(const d of snap.docs){const o=d.data(); if(o&&KIND[o.kind]) T[KIND[o.kind]][d.id]=o;}
      if(this.demo) return;
      this.loaded=true; if(!this._purged){this._purged=true; purgeLegacyDemo();} applyView(); renderAll();
    },err=>{clearTimeout(timer); setStatus('err','Kunde inte läsa data ('+err.code+')'); this.loaded=true; renderAll();});
  },
  loadLocal(){
    try{const k=Share.lsKey(); const raw=localStorage.getItem(k)||(k==='klansagan-v1'?(localStorage.getItem('kinsaga-v1')||localStorage.getItem('slaktarkivet-v1')):null); ALL.persons={};ALL.places={};ALL.sources={};ALL.views={}; if(raw){const o=JSON.parse(raw); ALL.persons=o.persons||{}; ALL.places=o.places||{}; ALL.sources=o.sources||{}; ALL.views=o.views||{};}}catch(e){}
  },
  saveLocal(){
    if(this.demo) return;
    clearTimeout(this._lt);
    this._lt=setTimeout(()=>this.saveNow(),250);
  },
  saveNow(){
    clearTimeout(this._lt);
    try{localStorage.setItem(Share.lsKey(),JSON.stringify({persons:ALL.persons,places:ALL.places,sources:ALL.sources,views:ALL.views}));}catch(e){toast('Webbläsarens lagring är full – ta bort några bilder eller exportera en säkerhetskopia.',6000);}
    Share.changed();
  },
  async write(id,fn){
    const prev=this.chains[id]||Promise.resolve();
    const next=prev.catch(()=>{}).then(fn);
    this.chains[id]=next; return next;
  },
  async retry(fn){
    for(let i=0;;i++){
      try{return await fn();}catch(e){
        if(i<4&&(e&&(e.code==='unavailable'||e.code==='resource_exhausted'))){await new Promise(r=>setTimeout(r,400*(i+1)+Math.random()*300));continue;}
        throw e;
      }
    }
  },
  stamp(o){o.updatedAt=new Date().toISOString(); if(this.myId) o.updatedBy=this.myId; return o;},
  put(obj,{silent}={}){
    obj=this.stamp(clone(obj));
    ALL[KIND[obj.kind]][obj.id]=obj; applyView();
    if(!silent) renderAll();
    if(this.demo) return Promise.resolve();
    if(this.mode==='db'){
      return this.write(obj.id,()=>this.retry(()=>this.col.doc(obj.id).set(obj))).catch(e=>{
        if(e&&e.code==='quota_exceeded') toast('Databasen är full – ta bort något först.');
        else if(e&&e.code==='invalid_argument'){toast('Du har inte behörighet att ändra i det här trädet.',5000); this.canEdit=false; renderAll();}
        else toast('Kunde inte spara: '+(e&&e.code||e));
      });
    } else {this.saveLocal(); return Promise.resolve();}
  },
  del(kind,id,{silent}={}){
    delete ALL[KIND[kind]][id]; applyView();
    if(!silent) renderAll();
    if(this.demo) return Promise.resolve();
    if(this.mode==='db') return this.write(id,()=>this.retry(()=>this.col.doc(id).delete())).catch(e=>toast('Kunde inte ta bort: '+(e&&e.code||e)));
    this.saveLocal(); return Promise.resolve();
  },
  async putMany(objs,onProgress){
    let done=0; const queue=objs.slice();
    for(const o of queue){this.stamp(o); ALL[KIND[o.kind]][o.id]=clone(o);} applyView();
    if(this.demo){onProgress&&onProgress(1); renderAll(); return;}
    if(this.mode!=='db'){this.saveLocal(); onProgress&&onProgress(1); renderAll(); return;}
    renderAll();
    const worker=async()=>{while(queue.length){const o=queue.shift(); await this.write(o.id,()=>this.retry(()=>this.col.doc(o.id).set(clone(o)))).catch(e=>{console.warn(e)}); done++; onProgress&&onProgress(done/objs.length);}};
    await Promise.all([worker(),worker(),worker()]);
  }
};
function setStatus(cls,txt){const s=$('#status'); s.className='status '+cls; const short={'Sparas bara i den här webbläsaren':'Lokalt','Delas & sparas i molnet':'Delat','Endast läsning':'Läsläge','Hämtar…':'Hämtar…','Databasen svarar inte ännu':'Väntar…'}[txt]; s.querySelector('span').textContent=short||txt; s.title=txt;}

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
function lifespan(p){const b=yearOf(p.birthDate),d=yearOf(p.deathDate); if(!b&&!d) return ''; return (b||'?')+' – '+(d||(b&&NOW_Y-b<105?'':'?'));}
const sexColor=p=>p&&p.sex==='M'?'var(--male)':p&&p.sex==='K'?'var(--female)':'var(--unk)';
const placeName=id=>id&&S.places[id]?S.places[id].name:'';
function children(id){return Object.values(S.persons).filter(c=>c.fatherId===id||c.motherId===id).sort((a,b)=>(dateKey(a.birthDate)||9999)-(dateKey(b.birthDate)||9999));}
function partners(p){const set=new Set(p.spouseIds||[]); for(const c of children(p.id)){const o=c.fatherId===p.id?c.motherId:c.fatherId; if(o) set.add(o);} set.delete(p.id); return [...set].map(P).filter(Boolean);}
function siblings(p){if(!p.fatherId&&!p.motherId) return []; return Object.values(S.persons).filter(s=>s.id!==p.id&&((p.fatherId&&s.fatherId===p.fatherId)||(p.motherId&&s.motherId===p.motherId))).sort((a,b)=>(dateKey(a.birthDate)||9999)-(dateKey(b.birthDate)||9999));}
const isImg=m=>/^image\//.test(m&&m.contentType||'');
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
  return c?`<img src="${esc(murl(m))}" alt="" style="position:absolute;max-width:none;object-fit:fill;width:${c.w}%;height:${c.h}%;left:${c.l}%;top:${c.t}%">`:`<img src="${esc(murl(m))}" alt="">`;}
/* ---- Image store ----
   Photos live in IndexedDB on this device (localStorage is far too small) and are
   referenced from the data as "kl:<id>". In a shared tree they are also stored on the
   server, each one encrypted with the tree's key, and fetched when first needed. */
const BLOB={}, BLOB_WAIT=new Set();
const IDB={_db:null,
  open(){return this._db||(this._db=new Promise((ok,bad)=>{const r=indexedDB.open('klansagan',1); r.onupgradeneeded=()=>r.result.createObjectStore('blobs'); r.onsuccess=()=>ok(r.result); r.onerror=()=>bad(r.error);}));},
  async tx(mode,fn){const db=await this.open(); return new Promise((ok,bad)=>{const t=db.transaction('blobs',mode); const st=t.objectStore('blobs'); const out=fn(st); t.oncomplete=()=>ok(out?out.result:undefined); t.onerror=()=>bad(t.error);});},
  get(id){return this.tx('readonly',st=>st.get(id));},
  put(id,v){return this.tx('readwrite',st=>st.put(v,id));},
};
const PIXEL='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const blobId=m=>m&&typeof m.url==='string'&&m.url.startsWith('kl:')?m.url.slice(3):null;
/** URL to show for a media item. Stored photos load in the background and the page redraws. */
function murl(m){const id=blobId(m); if(!id) return m?m.url:''; if(BLOB[id]) return BLOB[id]; needBlob(id); return PIXEL;}
let _blobTimer=null;
function needBlob(id){ if(BLOB_WAIT.has(id)) return; BLOB_WAIT.add(id); clearTimeout(_blobTimer); _blobTimer=setTimeout(loadBlobs,30); }
async function loadBlobs(){
  const ids=[...BLOB_WAIT]; let got=0; const missing=[];
  for(const id of ids){ try{const v=await IDB.get(id); if(v){BLOB[id]=v; got++; BLOB_WAIT.delete(id);} else missing.push(id);}catch(e){missing.push(id);} }
  if(missing.length&&Share.cur()){ try{ got+=await Share.fetchBlobs(missing); }catch(e){console.warn('Kunde inte hämta bilder',e);} }
  missing.forEach(id=>{ if(!BLOB[id]) setTimeout(()=>BLOB_WAIT.delete(id),30000); else BLOB_WAIT.delete(id); });
  if(got){ renderAll(); if(ui.sel) select(ui.sel.type,ui.sel.id); }
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
    for(const m of o.media) if(typeof m.url==='string'&&m.url.startsWith('data:')){ try{m.url='kl:'+await storeBlob(m.url); delete m.local; n++;}catch(e){return false;} } }
  if(n){ Store.saveNow(); }
  return n>0;
}
/** All image ids referenced by the archive. */
function blobRefs(data){const out=new Set(); for(const col of ['persons','places','sources']) for(const o of Object.values(data[col]||{})) for(const m of o.media||[]){const id=blobId(m); if(id) out.add(id);} return out;}
function avatarUrl(p){const imgs=(p.media||[]).filter(isImg); const m=imgs.find(m=>m.profile)||imgs[0]; return m?murl(m):null;}
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

/* ============ Router ============ */
const VIEWS={start:renderStart,trad:renderTree,solfjader:renderFan,personer:renderPersons,slaktskap:renderRel,personkort:renderCard,dubbletter:renderDups,tidslinje:renderTimeline,karta:renderMap,kallor:renderSources,import:renderImport};
const NAVMAP={personkort:'personer',dubbletter:'personer'};
function route(){const h=location.hash.slice(1); if(h.startsWith('vy-')){ui.pendingView=h.slice(3); location.replace('#trad'); return;} if(h==='exempel'){ui.pendingDemo=true; location.replace('#trad'); return;} ui.view=VIEWS[h]?h:'start'; followSelection(); if(matchMedia('(max-width:700px)').matches) ui.sel=null; /* on phones the person sheet would cover the new tab */ const nv=NAVMAP[ui.view]||ui.view; document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===nv)); {const mb=$('#moreBtn'); if(mb){const inMore=!!document.querySelector('#morePop a.on'); mb.classList.toggle('on',inMore); mb.querySelector('span').firstChild.textContent=inMore?document.querySelector('#morePop a.on b').textContent:'Mer'; $('#morePop').classList.remove('open');}} $('#view').scrollTop=0; ui.treeKey=null; mapState.drawn=false; renderAll(true);}
window.addEventListener('hashchange',route);
let lastView=null;
function renderAll(force){
  if(!Store.loaded){ $('#view').innerHTML='<div class="empty"><p class="muted">Laddar släktarkivet…</p></div>'; return; }
  if(ui.pendingDemo){ui.pendingDemo=false; loadDemo(); return;}
  if(ui.pendingView){const pv=Object.values(ALL.views).find(x=>x.slug===ui.pendingView); ui.pendingView=null; if(pv){ui.viewId=pv.id; try{localStorage.setItem('sa-viewid',pv.id);}catch(e){} applyView(); ui.treeKey=null; setTimeout(()=>toast('Visar vyn '+pv.name),300);}}
  if(ui.viewId&&!ALL.views[ui.viewId]){ui.viewId=null; applyView();}
  if(ui.focus&&!P(ui.focus)) ui.focus=null;
  if(!ui.focus){const h=homePerson(); if(h) ui.focus=h.id;}
  if(!ui.focus){const first=Object.values(S.persons).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''))[0]; if(first) ui.focus=first.id;}
  if(ui.sel&&ui.sel.type==='person'&&!P(ui.sel.id)) ui.sel=null;
  if(ui.sel&&ui.sel.type==='place'&&!S.places[ui.sel.id]) ui.sel=null;
  if(ui.sel&&ui.sel.type==='source'&&!S.sources[ui.sel.id]) ui.sel=null;
  renderPanel(); updateDemoBar(); updateViewBtn();
  try{ VIEWS[ui.view](force||lastView!==ui.view); lastView=ui.view; }
  catch(e){ console.error(e); lastView=null;
    $('#view').innerHTML=`<div class="empty"><h2>Något gick fel på den här sidan</h2><p>Dina uppgifter är orörda. Prova att ladda om sidan. Om felet kommer tillbaka: skicka texten här nedanför till den som sköter sidan.</p><p class="muted small" style="font-family:monospace">${esc(APP_VERSION)} · ${esc(ui.view)} · ${esc(String(e&&e.message||e))}</p><p><button class="btn primary" onclick="location.reload()">Ladda om</button></p></div>`; }
}
/* When switching tab with a person selected, the new tab shows that person. */
function followSelection(){
  const id=ui.sel&&ui.sel.type==='person'?ui.sel.id:null; if(!id||!P(id)) return;
  if(ui.view==='solfjader'||ui.view==='personkort') setFocus(id);
  if(ui.view==='trad'){ if(ui.treeLock) ui.treeZoomTo=id; else if(ui.focus!==id){setFocus(id); ui.treeZoomTo=id;} }
  if(ui.view==='slaktskap'){const h=homePerson(); ui.relB=id; if(!ui.relA||ui.relA===id) ui.relA=h&&h.id!==id?h.id:null;}
}
function setFocus(id){ui.focus=id; try{localStorage.setItem('sa-focus',id)}catch(e){} }
function select(type,id){ui.sel=id?{type,id}:null; renderAll();}
function showPerson(id,{focus}={}){if(focus) setFocus(id); select('person',id);}
/* Clicking a name in the side panel moves the current view to that person. */
function followPerson(id){
  if(ui.view==='trad'&&ui.treeLock){
    if(ui.treeShown&&ui.treeShown.has(id)) ui.treePan=id; else toast(`${fullName(P(id))} syns inte i det låsta trädet. Lås upp trädet för att gå dit.`,4500);
    select('person',id); return; }
  if(ui.view==='trad'||ui.view==='solfjader'){setFocus(id); ui.treeKey=null;}
  if(ui.view==='personkort') setFocus(id);
  if(ui.view==='slaktskap'){ui.relB=id; const h=homePerson(); if(!ui.relA||ui.relA===id) ui.relA=h&&h.id!==id?h.id:null;}
  select('person',id);
}

/* ============ Empty state ============ */
function emptyState(){
  if(Object.keys(ALL.persons).length&&!Object.keys(S.persons).length){const v=activeView(); return `<div class="empty"><h2>Alla är dolda i den här vyn</h2><p>Vyn <b>${esc(v?v.name:'')}</b> döljer alla ${Object.keys(ALL.persons).length} personer. Byt vy, eller ändra vad vyn döljer.</p><div class="acts"><button class="btn primary" onclick="setActiveView(null)">Visa hela släkten</button>${v&&Store.canEdit?'<button class="btn" onclick="viewModal(activeView())">Anpassa vyn</button>':''}</div></div>`;}
  return `<div class="empty">
    <svg width="64" height="64" viewBox="0 0 26 26" fill="none" stroke="var(--accent)" stroke-width="1.2"><path d="M13 24V13M13 13c0-4 -3-6-6-6M13 13c0-4 3-6 6-6M13 17c-2-1-5-1-7 1M13 17c2-1 5-1 7 1"/><circle cx="7" cy="6" r="2.4"/><circle cx="19" cy="6" r="2.4"/><circle cx="13" cy="3.6" r="2"/></svg>
    <h2>Börja ditt släktarkiv</h2>
    <p>Lägg till dig själv eller den äldsta ana du känner till, eller läs in din släktlista från Excel. Du kan också titta på ett exempel först.</p>
    <div class="acts">
      ${Store.canEdit?`<button class="btn primary" onclick="openPersonModal()">+ Lägg till första personen</button>
      <a class="btn" href="#import">Importera från Excel</a>
      <button class="btn" onclick="loadDemo()">Titta på ett exempel</button>`:'<p class="muted">Arkivet är tomt.</p>'}
    </div></div>`;
}

/* ============ TREE ============ */
const KIN_LEVELS=['Inga','Syskon','Kusiner','Sysslingar','Tremänningar','Fyrmänningar','Femmänningar','Sexmänningar','Sjumänningar','Åttamänningar','Niomänningar'];
// Card size (big or small); the left part of a card holds a 3:4 portrait (PW×PH)
let CW=224,CH=100,PX=12,PY=10,PW=60,PH=80,MAXC=17,SMALL=false;
function setCardSize(small){SMALL=!!small; [CW,CH,PX,PY,PW,PH,MAXC]=small?[156,74,7,8,42,58,12]:[224,100,12,10,60,80,17];}

/* Tree layout: ancestors above, the focus person's row, descendants below, and side
   branches (siblings, cousins …) packed outside the direct line. Couples sit side by side. */
function treeLayout(F,showSp){
  const ROW=CH+56, SEP=20, CG=14, nodes=[], links=[];
  const W=d=>CW+((d&&d.sps)?d.sps.length:0)*(CW+CG);
  const sepF=(a,b)=>(W(a.data)+W(b.data))/2+(a.parent===b.parent?SEP:SEP*2);
  // ancestors
  const anc=(p,depth)=>{const n={p,children:[]}; if(depth<ui.ancGen){for(const rel of ['father','mother']){const q=P(p[rel+'Id']); if(q) n.children.push(anc(q,depth+1)); else if(Store.canEdit&&!p[rel+'Id']&&depth<2) n.children.push({ghost:rel,of:p.id,children:[]});}} return n;};
  const aRoot=d3.hierarchy(anc(F,0));
  // an ancestor's other partners (e.g. a father's later wife) sit on the outer side of the couple
  const ancIds=new Set(); aRoot.each(n=>{if(n.data.p) ancIds.add(n.data.p.id);});
  const taken=new Set([...ancIds,...(showSp?partners(F).map(q=>q.id):[])]);
  aRoot.each(n=>{n.data.sps=[]; if(!showSp||n.depth===0||!n.data.p) return;
    n.data.sps=partners(n.data.p).filter(q=>!taken.has(q.id)); n.data.sps.forEach(q=>taken.add(q.id));});
  d3.tree().nodeSize([1,ROW]).separation((a,b)=>(W(a.data)+W(b.data))/2+(a.parent===b.parent?18:40))(aRoot);
  const extraPos={};
  aRoot.each(n=>{n.y=-n.depth*ROW; if(n.depth===0) return; nodes.push(n);
    const sps=n.data.sps||[]; if(!sps.length) return;
    const side=n.parent.children[0]===n&&n.parent.children.length>1?-1:1, w=W(n.data);
    n.x=n.x-side*(w-CW)/2;
    sps.forEach((q,i)=>{const x=n.x+side*(i+1)*(CW+CG); const pn={data:{p:q,partner:true},x,y:n.y}; nodes.push(pn); extraPos[q.id]=pn;
      const inner=n.x+side*i*(CW+CG); links.push({type:'cp',x1:inner+side*CW/2,x2:x-side*CW/2,y:n.y,dash:i>0});});});
  // parents are drawn as a couple: a line between them, a dot in the middle, one line down to the child
  aRoot.each(n=>{ const ps=n.children||[]; if(!ps.length) return; const tgt=n.depth===0?{x:0,y:0}:n;
    if(ps.length===2){const [a,b]=ps[0].x<ps[1].x?ps:[ps[1],ps[0]]; const ghost=!a.data.p||!b.data.p;
      links.push({type:'cp',x1:a.x+CW/2,x2:b.x-CW/2,y:a.y,dash:ghost});
      links.push({type:'desc',s:{x:(a.x+b.x)/2,y:a.y,mid:true},t:tgt});}
    else links.push({type:'desc',s:{x:ps[0].x,y:ps[0].y},t:tgt}); });
  // focus partners: man to the left, woman to the right
  // Partners alternate sides (first one to the right for a man, left for a woman), so each
  // couple gets its own gap and its own junction for their children.
  const PG=CW+34;
  const parts=showSp?partners(F).sort((a,b)=>children(b.id).filter(c=>c.fatherId===F.id||c.motherId===F.id).length-children(a.id).filter(c=>c.fatherId===F.id||c.motherId===F.id).length):[];
  const pPos={}, junc={}; const sideCount={'-1':0,'1':0}; const first=F.sex==='K'?-1:1;
  parts.forEach((sp,i)=>{const side=i%2===0?first:-first; const k=++sideCount[side]; const x=side*k*PG;
    const n={data:{p:sp,partner:true},x,y:0}; nodes.push(n); pPos[sp.id]=n;
    const inner=x-side*PG; links.push({type:'cp',x1:inner+side*CW/2,x2:x-side*CW/2,y:0,dash:k>1});
    junc[sp.id]=x-side*PG/2;});
  const shown=new Set([F.id]); aRoot.each(n=>{if(n.data.p) shown.add(n.data.p.id);}); parts.forEach(q=>shown.add(q.id)); Object.keys(extraPos).forEach(id=>shown.add(id));
  // a person with partners and (step)children, down to depth maxD
  const mk=(p,dd,maxD)=>{shown.add(p.id);
    const sps=showSp?partners(p).filter(q=>!shown.has(q.id)):[]; sps.forEach(q=>shown.add(q.id));
    let kids=[]; if(dd<maxD){kids=children(p.id); if(showSp) for(const q of sps) for(const c of children(q.id)) if(!kids.includes(c)) kids.push(c);}
    kids=kids.filter(c=>!shown.has(c.id)); kids.forEach(c=>shown.add(c.id));
    return {p,sps,children:kids.map(c=>mk(c,dd+1,maxD))};};
  // place a laid-out node: couple centred on c, person card first, partners to the right
  const expand=(n,c,y)=>{const w=W(n.data); n.y=y; n.x=c-(w-CW)/2; n.spx=n.data.sps.map((q,i)=>n.x+(i+1)*(CW+CG)); nodes.push(n);
    n.data.sps.forEach((q,i)=>{nodes.push({data:{p:q,partner:true},x:n.spx[i],y}); links.push({type:'cp',x1:(i?n.spx[i-1]:n.x)+CW/2,x2:n.spx[i]-CW/2,y});});};
  // where the line down to child n starts
  const srcOf=n=>{const pn=n.parent, c=n.data.p, pp=pn.data.p;
    const own=c.fatherId===pp.id||c.motherId===pp.id, other=c.fatherId===pp.id?c.motherId:c.fatherId;
    const i=pn.data.sps.findIndex(q=>q.id===(own?other:(c.fatherId&&pn.data.sps.some(q=>q.id===c.fatherId)?c.fatherId:c.motherId)));
    if(own&&i>=0) return {x:pn.spx[i]-(CW+CG)/2,y:pn.y,mid:true};
    if(!own&&i>=0) return {x:pn.spx[i],y:pn.y};
    return {x:pn.x,y:pn.y};};
  // descendants of the focus person: one block per couple, centred under that couple's junction
  {const groups=new Map();
   if(ui.descGen>0){
     const add=(key,c)=>{if(shown.has(c.id)) return; shown.add(c.id); if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(c);};
     for(const c of children(F.id)){const other=c.fatherId===F.id?c.motherId:c.fatherId; add(other&&pPos[other]?other:'',c);}
     if(showSp) for(const q of parts) for(const c of children(q.id)) add('step:'+q.id,c);}
   const blocks=[...groups.entries()].map(([key,kids])=>{
     const q=key.startsWith('step:')?key.slice(5):key;
     const jx=key.startsWith('step:')?pPos[q].x:(q?junc[q]:0);
     const h=d3.hierarchy({root:true,sps:[],children:kids.map(c=>mk(c,1,ui.descGen))});
     d3.tree().nodeSize([1,ROW]).separation(sepF)(h);
     const bn=h.descendants().filter(n=>n.depth>0), kx=bn.filter(n=>n.depth===1).map(n=>n.x);
     return {key,jx,mid:!!q&&!key.startsWith('step:'),bn,ideal:jx-(Math.min(...kx)+Math.max(...kx))/2};
   }).sort((a,b)=>a.jx-b.jx);
   const right={};
   for(const bl of blocks){
     const ext={}; for(const n of bl.bn){const w=W(n.data); const e=ext[n.depth]||(ext[n.depth]=[n.x-w/2,n.x+w/2]); e[0]=Math.min(e[0],n.x-w/2); e[1]=Math.max(e[1],n.x+w/2);}
     let sh=bl.ideal; for(const [d,e] of Object.entries(ext)) if(right[d]!==undefined) sh=Math.max(sh,right[d]+SEP*2-e[0]);
     for(const [d,e] of Object.entries(ext)) right[d]=e[1]+sh;
     bl.sh=sh;}
   // centre the whole set of blocks under the focus row if they were pushed aside
   if(blocks.length>1){const lo=Math.min(...blocks.map(b=>b.sh+Math.min(...b.bn.filter(n=>n.depth===1).map(n=>n.x)))), hi=Math.max(...blocks.map(b=>b.sh+Math.max(...b.bn.filter(n=>n.depth===1).map(n=>n.x))));
     const jlo=Math.min(...blocks.map(b=>b.jx)), jhi=Math.max(...blocks.map(b=>b.jx)); const adj=((jlo+jhi)/2)-((lo+hi)/2);
     const can=blocks.every(b=>Math.abs(b.sh+adj-b.ideal)<=Math.abs(b.sh-b.ideal)+Math.abs(adj)); if(can) blocks.forEach(b=>b.sh+=adj);}
   for(const bl of blocks){
     for(const n of bl.bn){ expand(n,n.x+bl.sh,n.depth*ROW);
       if(n.depth===1) links.push({type:'desc',s:{x:bl.jx,y:0,mid:bl.mid},t:n,fam:'f:'+bl.key});
       else links.push({type:'desc',s:srcOf(n),t:n}); }}}
  // side branches. Siblings may bring their descendants; further out, branches stop at the focus's generation.
  {const occ={}, GAPX=SEP*2;
   const occAdd=(r,l,rr)=>{const o=occ[r]||(occ[r]=[l,rr]); if(l<o[0]) o[0]=l; if(rr>o[1]) o[1]=rr;};
   for(const n of nodes) occAdd(Math.round(n.y/ROW),n.x-CW/2,n.x+CW/2); occAdd(0,-CW/2,CW/2);
   const sideDefault=parts.some(q=>!(q.sex==='M'&&F.sex!=='M'))?-1:1;
   const lim=Math.min(ui.kinDeg,ui.ancGen);
   const groups=[]; aRoot.each(n=>{ if(n.depth>=1&&n.depth<=lim&&n.data.p){ let g0=groups.find(g=>g.child===n.parent); if(!g0){g0={child:n.parent,d:n.depth,par:[]}; groups.push(g0);} g0.par.push(n);} });
   groups.sort((a,b)=>a.d-b.d);
   for(const g0 of groups){
     const pos={}; for(const n of g0.par) pos[n.data.p.id]=n;
     const kids=[]; for(const n of g0.par) for(const c of children(n.data.p.id)) if(!shown.has(c.id)&&!kids.includes(c)) kids.push(c);
     if(!kids.length) continue; kids.forEach(c=>shown.add(c.id));
     const xs=g0.par.map(n=>n.x), mxAll=xs.reduce((a,b)=>a+b,0)/xs.length, py=g0.par[0].y;
     const maxD=g0.d===1?1+ui.descGen:g0.d;
     // one block per parent couple (full siblings, half-siblings via each partner …), each next to its own junction
     const jOf=c=>{const fa=pos[c.fatherId]||extraPos[c.fatherId], mo=pos[c.motherId]||extraPos[c.motherId]; return fa&&mo?(fa.x+mo.x)/2:(fa||mo).x;};
     const parts2=new Map(); for(const c of kids){const k=(c.fatherId||'')+'|'+(c.motherId||''); if(!parts2.has(k)) parts2.set(k,[]); parts2.get(k).push(c);}
     const blocks=[...parts2.values()].sort((a,b)=>Math.abs(jOf(a[0]))-Math.abs(jOf(b[0])));
     for(const bk of blocks){
     const mx=jOf(bk[0]);
     const dir=g0.d===1?(mx<-CW/2?-1:mx>CW/2?1:(mxAll<-1?-1:mxAll>1?1:sideDefault)):(mxAll<-1?-1:mxAll>1?1:sideDefault);
     const block=d3.hierarchy({root:true,sps:[],children:bk.map(k=>mk(k,1,maxD))});
     d3.tree().nodeSize([1,ROW]).separation(sepF)(block);
     const bn=block.descendants().filter(n=>n.depth>0);
     const ext={}; for(const n of bn){const r=Math.round(py/ROW)+n.depth, w=W(n.data); const e=ext[r]||(ext[r]=[n.x-w/2,n.x+w/2]); if(n.x-w/2<e[0]) e[0]=n.x-w/2; if(n.x+w/2>e[1]) e[1]=n.x+w/2;}
     const kx=bn.filter(n=>n.depth===1).map(n=>n.x); let sh=mx-(Math.min(...kx)+Math.max(...kx))/2;
     for(const [r,e] of Object.entries(ext)){const o=occ[r]; if(!o) continue;
       if(dir<0) sh=Math.min(sh,o[0]-GAPX-e[1]); else sh=Math.max(sh,o[1]+GAPX-e[0]);}
     for(const n of bn){ expand(n,n.x+sh,py+n.depth*ROW); const w=W(n.data); occAdd(Math.round(n.y/ROW),n.x-CW/2,n.x-CW/2+w);
       if(n.depth===1){const fa=pos[n.data.p.fatherId]||extraPos[n.data.p.fatherId], mo=pos[n.data.p.motherId]||extraPos[n.data.p.motherId];
         const q=fa&&mo?{x:(fa.x+mo.x)/2,y:py,mid:true}:{x:(fa||mo).x,y:py}; links.push({type:'desc',s:q,t:n});}
       else links.push({type:'desc',s:srcOf(n),t:n}); }
     }
   }}
  nodes.push({data:{p:F},x:0,y:0,focus:true});
  // give each family its own lane in the gap between two rows, so lines never merge
  {const G=new Map();
   for(const l of links){ if(l.type==='cp') continue;
     if(l.type==='dot') continue;
    const top=l.type==='anc'?l.t.y:l.s.y, key=l.type==='anc'?l.s:(l.s.x+'|'+l.s.y);
     let g=G.get(key); if(!g){g={top,lo:Infinity,hi:-Infinity,ls:[]}; G.set(key,g);}
     g.lo=Math.min(g.lo,l.s.x,l.t.x); g.hi=Math.max(g.hi,l.s.x,l.t.x); g.ls.push(l);}
   const byGap={}; for(const g of G.values()) (byGap[g.top]=byGap[g.top]||[]).push(g);
   for(const gs of Object.values(byGap)){ gs.sort((a,b)=>a.lo-b.lo); const lanes=[];
     for(const g of gs){let i=lanes.findIndex(r=>r<g.lo-14); if(i<0){i=lanes.length; lanes.push(0);} lanes[i]=g.hi; g.lane=i;}
     const nL=lanes.length, step=nL>1?Math.min(13,(ROW-CH-12)/(nL-1)):0;
     // colour a family's lines only where they run alongside another family's
     let ci=0; for(const g of gs){const crowd=gs.some(o=>o!==g&&o.lo<g.hi+30&&o.hi>g.lo-30); const f=crowd?(ci++%5)+1:0; for(const l of g.ls) l.fam=f;}
     for(const g of gs){const my=g.top+ROW/2+(g.lane-(nL-1)/2)*step; for(const l of g.ls) l.my=my;}}}
  // junction dots where a couple's line to their children starts
  const dots=new Map(); for(const l of links) if(l.type==='desc'&&l.s.mid) dots.set(l.s.x+'|'+l.s.y,{x:l.s.x,y:l.s.y,fam:l.fam});
  links.push(...[...dots.values()].map(d=>({type:'dot',...d})));
  return {nodes,links,aRoot};
}
let treeZoom=null;
/** Zoom the tree onto a person. If they aren't in the current tree, rebuild it around them (unless locked). */
function treeGoTo(id){
  if(!id||!P(id)) return;
  const pos=ui.treePos&&ui.treePos.get(id);
  if(!pos){ if(ui.treeLock){toast(`${fullName(P(id))} syns inte i det låsta trädet.`,4000);return;}
    setFocus(id); ui.treeKey=null; ui.treeZoomTo=id; select('person',id); return; }
  const el0=$('#treeSvg'), t=d3.zoomTransform(el0), k=Math.max(t.k,.95), W=el0.clientWidth, H=el0.clientHeight;
  d3.select(el0).transition().duration(450).call(treeZoom.transform,d3.zoomIdentity.translate(W/2-pos.x*k,(H+50)/2-pos.y*k).scale(k));
  if(!(ui.sel&&ui.sel.id===id)) select('person',id);
}
function renderTree(fresh){
  const v=$('#view');
  if(!Object.keys(S.persons).length){v.innerHTML=emptyState();ui.treeKey=null;return;}
  const F=P(ui.focus);
  if(!$('#treeSvg')||fresh){
    v.innerHTML=`<div id="treeWrap"><svg id="treeSvg"><defs><clipPath id="avclip"><rect x="12" y="10" width="60" height="80" rx="6"/></clipPath></defs><g class="vp"></g></svg>
      <div class="tree-tools tt-tree">
        <span class="fname" id="tfName"></span>
        <button class="btn sm mob-only" id="tOpts" aria-expanded="false">Visa ▾</button>
        <span id="tTrees" class="ctl"></span>
        <span class="ctl">Anor <select id="tAnc">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option ${n===ui.ancGen?'selected':''}>${n}</option>`).join('')}</select></span>
        <span class="ctl">Ättlingar <select id="tDesc">${[0,1,2,3,4,5,6,7,8,9,10].map(n=>`<option ${n===ui.descGen?'selected':''}>${n}</option>`).join('')}</select></span>
        <span class="ctl" title="Hur långt ut åt sidan trädet ska visa släktingar">Sidogrenar <select id="tKin">${KIN_LEVELS.map((t,n)=>`<option value="${n}" ${n===ui.kinDeg?'selected':''}>${t}</option>`).join('')}</select></span>
        <label class="ctl chk" title="Visa makar och sambor, och deras barn"><input type="checkbox" id="tSp" ${ui.showPartners!==false?'checked':''}> Partner</label>
        <span class="ctl" title="Små kort får plats med fler personer">Kort <select id="tSize">${[['auto','Auto'],['big','Stora'],['small','Små']].map(([v,t])=>`<option value="${v}" ${v===(ui.cardSize||'auto')?'selected':''}>${t}</option>`).join('')}</select></span>
        <button class="btn sm" id="tLock"></button>
        <button class="btn sm" id="tMe" title="Zooma in på dig">★ Jag</button>
        <button class="btn sm" id="tSel" title="Zooma in på den markerade personen">⌖ Markerad</button>
        <button class="btn sm" id="tFit" title="Visa hela trädet">Visa hela</button>
        <button class="btn sm" id="tPrint">⎙ Skriv ut / spara</button>
        ${Store.canEdit?'<button class="btn sm primary" onclick="openPersonModal()">+ Person</button>':''}
        <span id="tView"></span>
      </div></div>`;
    $('#tAnc').onchange=e=>{ui.ancGen=+e.target.value;ui.treeKey=null;renderTree();};
    $('#tDesc').onchange=e=>{ui.descGen=+e.target.value;ui.treeKey=null;renderTree();};
    $('#tKin').onchange=e=>{ui.kinDeg=+e.target.value;ui.treeKey=null;renderTree();};
    $('#tFit').onclick=()=>{ui.treeKey=null;renderTree();};
    $('#tSp').onchange=e=>{ui.showPartners=e.target.checked;ui.treeKey=null;renderTree();};
    $('#tSize').onchange=e=>{ui.cardSize=e.target.value;ui.treeKey=null;renderTree();};
    $('#tMe').onclick=()=>{const h=homePerson(); if(!h){toast('Välj vem du är under Inställningar eller med ”Det här är jag” på ditt personkort.',5000);return;} treeGoTo(h.id);};
    $('#tSel').onclick=()=>{const id=ui.sel&&ui.sel.type==='person'?ui.sel.id:ui.focus; treeGoTo(id);};
    $('#tfName').onclick=()=>treeGoTo(ui.focus);
    $('#tOpts').onclick=e=>{const tt=e.target.closest('.tree-tools'); const o=tt.classList.toggle('open'); e.target.setAttribute('aria-expanded',o); e.target.textContent=o?'Stäng ▴':'Visa ▾';};
    $('#tLock').onclick=()=>{ui.treeLock=!ui.treeLock; toast(ui.treeLock?'Trädet är låst. Klicka på vem du vill och läs – trädet står kvar.':'Trädet är upplåst. Ett klick på en person bygger om trädet kring den personen.',4500); renderTree();};
    $('#tPrint').onclick=()=>printChart($('#treeSvg'),'Släktträd för '+fullName(P(ui.focus)),'klansagan-tree');
    const svg=d3.select('#treeSvg');
    treeZoom=d3.zoom().scaleExtent([.15,2.5]).on('zoom',e=>svg.select('g.vp').attr('transform',e.transform));
    svg.call(treeZoom).on('dblclick.zoom',null);
    ui.treeKey=null;
  }
  $('#tfName').textContent=fullName(F);
  {const lb=$('#tLock'); lb.textContent=ui.treeLock?'🔒 Låst':'🔓 Lås trädet'; lb.classList.toggle('primary',!!ui.treeLock); lb.title=ui.treeLock?'Trädet står kvar när du klickar på en person. Klicka för att låsa upp.':'Lås trädet så att det står kvar när du klickar på andra personer';
   $('#treeWrap').classList.toggle('locked',!!ui.treeLock);}
  {const ts=trees(), cur=treeOf(F.id); const opts=ts.filter(t=>t.size>1||t===cur);
   $('#tTrees').innerHTML=ts.length>1?`<select id="tTreeSel" title="Byt släktträd">${opts.map(t=>`<option value="${t.root.id}" ${t===cur?'selected':''}>${esc(t.name)} (${t.size})</option>`).join('')}</select>${Store.canEdit?'<button class="btn sm" id="tLink">🔗 Koppla ihop</button>':''}`:'';
   const sel=$('#tTreeSel'); if(sel) sel.onchange=()=>{setFocus(sel.value); ui.treeKey=null; renderAll(true);};
   const lk=$('#tLink'); if(lk) lk.onclick=()=>linkModal(ui.focus);}
  const av0=activeView(); $('#tView').innerHTML=av0?`<span class="vchip">Vy: <b>${esc(av0.name)}</b> · ${HIDDEN.size} dolda <button class="btn sm ghost" onclick="setActiveView(null)">Visa alla</button></span>`:'';
  const svg=d3.select('#treeSvg'), g=svg.select('g.vp');
  const showSp=ui.showPartners!==false;
  setCardSize(ui.cardSize==='small'); let LY=treeLayout(F,showSp);
  if((ui.cardSize||'auto')==='auto'&&LY.nodes.length>40){setCardSize(true); LY=treeLayout(F,showSp);}
  const {nodes,links,aRoot}=LY;
  svg.select('#avclip rect').attr('x',PX).attr('y',PY).attr('width',PW).attr('height',PH);
  svg.classed('small',SMALL);

  // links
  const lp=l=>{
    if(l.type==='cp') return `M${l.x1},${l.y}H${l.x2}`;
    if(l.type==='dot') return `M${l.x-4},${l.y}a4,4 0 1,0 8,0a4,4 0 1,0 -8,0`;
    if(l.type==='anc') return `M${l.s.x},${l.s.y-CH/2}V${l.my}H${l.t.x}V${l.t.y+CH/2}`;
    return `M${l.s.x},${l.s.mid?l.s.y:l.s.y+CH/2}V${l.my}H${l.t.x}V${l.t.y-CH/2}`;
  };
  g.selectAll('*').remove();
  // generation labels
  for(let d=1; d<=ui.ancGen; d++){ if(aRoot.descendants().some(n=>n.depth===d&&n.data.p)){ const xs=aRoot.descendants().filter(n=>n.depth===d).map(n=>n.x); g.append('text').attr('class','gen-label').attr('x',Math.min(...xs)-CW/2).attr('y',-d*(CH+56)-CH/2-8).text(['','Föräldrar','Farföräldrar & morföräldrar','Farfars- och morfarsföräldrar','Generation 4','Generation 5','Generation 6'][d]||('Generation '+d)); } }
  g.selectAll('path.link').data(links).join('path').attr('class',l=>'link'+(l.type==='cp'?' sp'+(l.dash?' far':''):'')+(l.type==='dot'?' dot':'')+(l.fam?' fam'+l.fam:'')).attr('d',lp);
  const sel=ui.sel&&ui.sel.type==='person'?ui.sel.id:null;
  const cards=g.selectAll('g.node').data(nodes).join('g').attr('transform',n=>`translate(${n.x-CW/2},${n.y-CH/2})`);
  cards.each(function(n){
    const el=d3.select(this), d=n.data;
    if(d.ghost){
      el.attr('class','ghost');
      el.append('rect').attr('width',CW).attr('height',CH).attr('rx',9);
      el.append('text').attr('x',CW/2).attr('y',CH/2+4).attr('text-anchor','middle').text('+ Lägg till '+(d.ghost==='father'?'far':'mor'));
      el.on('click',()=>openPersonModal(null,{rel:d.ghost,of:d.of}));
      return;
    }
    const p=d.p;
    el.attr('class','card'+(n.focus?' focus':'')+(sel===p.id?' sel':''));
    el.append('rect').attr('class','bg').attr('width',CW).attr('height',CH).attr('rx',9);
    el.append('rect').attr('width',5).attr('height',CH-16).attr('x',0).attr('y',8).attr('rx',2).style('fill',sexColor(p));
    const av=avatarUrl(p), tx=PX+PW+(SMALL?8:12), maxc=MAXC, LH=SMALL?13:16, Y0=SMALL?20:28;
    if(av){const c=cropPct(avatarMedia(p),PW/PH), im=el.append('image').attr('href',av).attr('clip-path','url(#avclip)');
      if(c) im.attr('x',PX+c.l/100*PW).attr('y',PY+c.t/100*PH).attr('width',c.w/100*PW).attr('height',c.h/100*PH).attr('preserveAspectRatio','none');
      else im.attr('x',PX).attr('y',PY).attr('width',PW).attr('height',PH).attr('preserveAspectRatio','xMidYMin slice');}
    else{const ph=el.append('g').attr('class','ph-slot'+(Store.canEdit?' can':''));
      ph.append('rect').attr('x',PX).attr('y',PY).attr('width',PW).attr('height',PH).attr('rx',6);
      ph.append('text').attr('class','ini').attr('x',PX+PW/2).attr('y',PY+PH/2+2).attr('text-anchor','middle').text(initials(p));
      if(Store.canEdit){ph.append('text').attr('class','add').attr('x',PX+PW/2).attr('y',PY+PH-9).attr('text-anchor','middle').text('+ bild');
        ph.append('title').text('Lägg till en bild');
        ph.on('click',ev=>{ev.stopPropagation(); select('person',p.id); setTimeout(()=>{const i=$('#uplAv'); if(i) i.click();},30);});}}
    const nm=fullName(p), words=nm.split(' '), lines=['']; for(const w of words){const cur=lines[lines.length-1]; if(cur&&(cur+' '+w).length>maxc){if(lines.length===2){lines[1]+=' '+w; continue;} lines.push(w);} else lines[lines.length-1]=cur?cur+' '+w:w;}
    const L=lines.map(l=>l.length>maxc+1?l.slice(0,maxc)+'…':l);
    const t0=el.append('text').attr('class','nm').attr('x',tx).attr('y',Y0); L.forEach((l,i)=>t0.append('tspan').attr('x',tx).attr('dy',i?LH:0).text(l)); t0.append('title').text(nm);
    const yy=Y0+(L.length-1)*LH;
    el.append('text').attr('class','yr').attr('x',tx).attr('y',yy+(SMALL?15:20)).text(lifespan(p)||'år okänt');
    const pl=placeName(p.birthPlace)||p.occupation||''; el.append('text').attr('class','pl').attr('x',tx).attr('y',yy+(SMALL?28:37)).text(pl.length>maxc+3?pl.slice(0,maxc+2)+'…':pl);
    const nc=(p.citations||[]).length; if(!nc){el.append('circle').attr('cx',CW-11).attr('cy',11).attr('r',3.5).style('fill','var(--warn)').append('title').text('Ingen källa ännu');}
    if(Store.canEdit){const eg=el.append('g').attr('class','eye').attr('transform',`translate(${CW-(SMALL?26:30)},${CH-(SMALL?24:26)})`); eg.append('rect').attr('width',22).attr('height',20).attr('rx',5);
      eg.append('path').attr('d','M4 10s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zM4 4l14 12').attr('transform','translate(0,0)');
      eg.append('title').text('Dölj i vyn…'); eg.on('click',ev=>{ev.stopPropagation(); hideModal(p);});}
    el.on('click',()=>{ if(n.focus){select('person',p.id);} else if(ui.treeLock){ui.treePan=p.id; select('person',p.id);} else { const t=d3.zoomTransform($('#treeSvg')); ui.treeAnchor={x:t.applyX(n.x),y:t.applyY(n.y),k:t.k}; setFocus(p.id); ui.treeKey=null; select('person',p.id);} });
  });
  // locked tree: only the camera moves, to the person that was clicked
  ui.treeShown=new Set(nodes.filter(n=>n.data&&n.data.p).map(n=>n.data.p.id));
  ui.treePos=new Map(nodes.filter(n=>n.data&&n.data.p).map(n=>[n.data.p.id,{x:n.x,y:n.y}]));
  if(ui.treePan){const n=nodes.find(x=>x.data&&x.data.p&&x.data.p.id===ui.treePan); ui.treePan=null;
    if(n){const el0=$('#treeSvg'), t=d3.zoomTransform(el0), W=el0.clientWidth, H=el0.clientHeight;
      svg.transition().duration(400).call(treeZoom.transform,d3.zoomIdentity.translate(W/2-n.x*t.k,H/2-n.y*t.k).scale(t.k));}}
  // fit
  const key=[F.id,ui.ancGen,ui.descGen,ui.kinDeg,showSp,SMALL].join('|');
  if(ui.treeKey!==key&&ui.treeAnchor){
    ui.treeKey=key; const a=ui.treeAnchor; ui.treeAnchor=null;
    svg.transition().duration(350).call(treeZoom.transform,d3.zoomIdentity.translate(a.x,a.y).scale(a.k));
  }
  if(ui.treeKey!==key){
    ui.treeKey=key;
    const W=$('#treeSvg').clientWidth,H=$('#treeSvg').clientHeight;
    const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);
    const x0=Math.min(...xs)-CW/2-30,x1=Math.max(...xs)+CW/2+30,y0=Math.min(...ys)-CH/2-40,y1=Math.max(...ys)+CH/2+30;
    let k=Math.min(1.05,Math.min(W/(x1-x0),(H-60)/(y1-y0)));
    let cx=(x0+x1)/2, cy=(y0+y1)/2;
    if(k<(ui.simple?.85:.6)){k=ui.simple?.85:.6; cx=Math.max(x0+W/(2*k),Math.min(x1-W/(2*k),CW)); cy=Math.max(y0+(H-60)/(2*k),Math.min(y1-(H-60)/(2*k),0));}
    const t=d3.zoomIdentity.translate(W/2-k*cx,(H+50)/2-k*cy).scale(k);
    svg.transition().duration(fresh?0:450).call(treeZoom.transform,t);
  }
  if(ui.treeZoomTo){const id=ui.treeZoomTo; ui.treeZoomTo=null; setTimeout(()=>treeGoTo(id),fresh?0:470);}
}

/* ============ PERSONS ============ */
function renderPersons(){
  const v=$('#view'); const all=Object.values(S.persons);
  if(!all.length){v.innerHTML=emptyState();return;}
  const flt={
    alla:()=>true,
    kalla:p=>!(p.citations||[]).length,
    fodd:p=>!p.birthDate,
    foraldrar:p=>!p.fatherId&&!p.motherId,
    plats:p=>!p.birthPlace,
  };
  const q=norm(ui.plQuery);
  let list=all.filter(flt[ui.plFilter]).filter(p=>!q||norm(fullName(p)+' '+(p.occupation||'')+' '+placeName(p.birthPlace)).includes(q));
  const sorters={namn:(a,b)=>(a.surname||'').localeCompare(b.surname||'','sv')||(a.given||'').localeCompare(b.given||'','sv'),fodd:(a,b)=>(dateKey(a.birthDate)??9e9)-(dateKey(b.birthDate)??9e9),senast:(a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')};
  list.sort(sorters[ui.plSort]);
  const nSrc=all.filter(p=>(p.citations||[]).length).length;
  const years=all.map(p=>yearOf(p.birthDate)).filter(Boolean);
  const anc=ui.focus?ancestorsOf(ui.focus).size:0;
  const sel=ui.sel&&ui.sel.type==='person'?ui.sel.id:null;
  const cnt=k=>all.filter(flt[k]).length;
  v.innerHTML=`<div class="view-pad">
    <div class="toolbar"><h2>Personer</h2><a class="btn" href="#dubbletter">🧩 Hitta dubbletter</a>${Store.canEdit?'<button class="btn primary" onclick="openPersonModal()">+ Ny person</button>':''}</div>
    <div class="stats">
      <div class="stat"><b>${all.length}</b><span>personer</span></div>
      <div class="stat"><b>${Math.round(100*nSrc/all.length)}%</b><span>har minst en källa</span></div>
      <div class="stat"><b>${years.length?Math.min(...years):'–'}</b><span>äldsta kända födelseår</span></div>
      <div class="stat"><b>${anc}</b><span>kända anor till ${esc(P(ui.focus)?shortName(P(ui.focus)):'–')}</span></div>
    </div>
    <div class="toolbar">
      <input class="t" id="plq" placeholder="Filtrera på namn, yrke, ort…" style="max-width:280px" value="${esc(ui.plQuery)}">
      <div class="chips">
        ${[['alla','Alla'],['kalla','Saknar källa'],['fodd','Saknar födelsedatum'],['plats','Saknar födelseort'],['foraldrar','Saknar föräldrar']].map(([k,t])=>`<button class="chip ${ui.plFilter===k?'on':''}" data-f="${k}">${t}${k!=='alla'?' · '+cnt(k):''}</button>`).join('')}
      </div>
      <span class="ctl" style="margin-left:auto">Sortera <select id="pls"><option value="namn">Efternamn</option><option value="fodd">Födelseår</option><option value="senast">Senast ändrad</option></select></span>
    </div>
    <table class="list m-persons"><thead><tr><th>Namn</th><th>Född</th><th>Död</th><th>Yrke</th><th>Underlag</th></tr></thead><tbody>
    ${list.map(p=>`<tr class="click ${sel===p.id?'sel':''}" data-id="${p.id}"><td><span class="dot" style="background:${sexColor(p)}"></span><b>${esc(fullName(p))}</b></td>
      <td>${esc(p.birthDate||'')}<div class="small muted">${esc(placeName(p.birthPlace))}</div></td>
      <td>${esc(p.deathDate||'')}<div class="small muted">${esc(placeName(p.deathPlace))}</div></td>
      <td>${esc(p.occupation||'')}</td>
      <td>${(p.citations||[]).length?`<span class="tag">${p.citations.length} ${p.citations.length===1?'källa':'källor'}</span>`:'<span class="tag warn">ingen källa</span>'}${(p.media||[]).length?`<span class="tag">${p.media.length} ${p.media.length===1?'fil':'filer'}</span>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Inga personer matchar.</td></tr>'}
    </tbody></table></div>`;
  $('#pls').value=ui.plSort;
  $('#pls').onchange=e=>{ui.plSort=e.target.value;renderPersons();};
  const inp=$('#plq'); inp.oninput=()=>{ui.plQuery=inp.value;const pos=inp.selectionStart;renderPersons();const n=$('#plq');n.focus();n.setSelectionRange(pos,pos);};
  v.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{ui.plFilter=c.dataset.f;renderPersons();});
  v.querySelectorAll('tr[data-id]').forEach(tr=>tr.onclick=()=>showPerson(tr.dataset.id));
}

/* ============ PANEL ============ */
function renderPanel(){
  const pn=$('#panel');
  if(!ui.sel){pn.classList.remove('open');pn.innerHTML='';return;}
  pn.classList.add('open');
  const st=pn.scrollTop;
  if(ui.sel.type==='person') pn.innerHTML=personPanel(P(ui.sel.id));
  else if(ui.sel.type==='place') pn.innerHTML=placePanel(S.places[ui.sel.id]);
  else if(ui.sel.type==='source') pn.innerHTML=sourcePanel(S.sources[ui.sel.id]);
  pn.scrollTop=st;
  bindPanel();
}
const closeBtn=`<button class="iconbtn" onclick="select(null)" title="Stäng" style="margin-left:auto"><svg width="18" height="18" viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`;
const E=Store; // shorthand for canEdit checks in templates
function relRow(lbl,p,extra=''){return `<div class="rel"><span class="lbl">${lbl}</span><span class="dot" style="background:${sexColor(p)}"></span><span class="who" data-goto="${p.id}"><b>${esc(fullName(p))}</b> <span class="muted small">${esc(lifespan(p))}</span></span>${extra}</div>`;}
function personPanel(p){
  const ed=E.canEdit;
  const av=avatarUrl(p);
  const age=ageAt(p);
  const father=P(p.fatherId),mother=P(p.motherId);
  const parts=partners(p), kids=children(p.id), sibs=siblings(p);
  const evs=lifeEvents(p);
  const cites=p.citations||[];
  const aboutLabel=a=>{if(!a) return 'Allmänt'; if(a.startsWith('event:')){const e=(p.events||[]).find(e=>'event:'+e.id===a); return e?e.type+(e.date?' '+e.date:''):'Händelse';} return a;};
  return `<div class="ph"><div class="top">
      ${ed?`<label class="avatar clickable" style="border-color:${sexColor(p)}" title="${av?'Byt profilbild':'Lägg till profilbild'}">${av?avImg(p):`<span>${esc(initials(p))}</span>`}<input type="file" id="uplAv" accept="image/*" hidden></label>`:`<div class="avatar" style="border-color:${sexColor(p)}">${av?avImg(p):esc(initials(p))}</div>`}
      <div style="flex:1;min-width:0"><h3>${fullHtml(p)}</h3><div class="sub">${esc(lifespan(p))}${age!=null?` · ${age} år`:''}${p.occupation?` · ${esc(p.occupation)}`:''}</div></div>
      ${closeBtn}</div>
    <div class="acts">
      <button class="btn sm" data-act="card">Personkort</button>${ed&&av?'<button class="btn sm" data-act="photo" title="Flytta och zooma bilden så att ansiktet hamnar rätt">Justera bild</button>':''}
      <button class="btn sm" data-act="focus">Visa i trädet</button>
      <button class="btn sm" data-act="rel">Hur är vi släkt?</button>
      ${ed?'<button class="btn sm" data-act="hide" title="Dölj personen eller en hel gren i en vy">👁 Dölj i vyn…</button>':''}
      ${ed?`<button class="btn sm ${p.home?'primary':''}" data-act="home" title="Startsidan, trädet och släktskap utgår från den här personen">${p.home?'★ Det här är jag':'Det här är jag'}</button>`:''}
      ${ed?`<button class="btn sm" data-act="edit">Redigera</button><button class="btn sm ghost danger" data-act="delp">Ta bort</button>`:''}
    </div></div>
  ${p.updatedBy&&Store.user?`<div class="sec small muted" style="padding:8px 20px">Senast ändrad ${esc(fmtDate((p.updatedAt||'').slice(0,10)))} av <span data-uid="${esc(p.updatedBy)}">…</span></div>`:''}
  <div class="sec"><h4>Fakta</h4><dl class="facts">
    <dt>Född</dt><dd>${esc(p.birthDate||'–')}${p.birthPlace?` <a href="#" data-place="${p.birthPlace}">${esc(placeName(p.birthPlace))}</a>`:''}</dd>
    <dt>Död</dt><dd>${esc(p.deathDate||'–')}${p.deathPlace?` <a href="#" data-place="${p.deathPlace}">${esc(placeName(p.deathPlace))}</a>`:''}</dd>
    <dt>Kön</dt><dd>${p.sex==='M'?'Man':p.sex==='K'?'Kvinna':'Okänt'}</dd>
  </dl></div>
  <div class="sec"><h4>Familj</h4>
    ${father?relRow('Far',father,ed?`<button class="iconbtn" title="Koppla bort" data-unlink="fatherId">×</button>`:''):p.fatherId?`<div class="rel"><span class="lbl">Far</span><span class="muted small">Dold i den här vyn</span></div>`:ed?`<div class="rel"><span class="lbl">Far</span><button class="btn sm ghost" data-add="father">+ Lägg till far</button></div>`:''}
    ${mother?relRow('Mor',mother,ed?`<button class="iconbtn" title="Koppla bort" data-unlink="motherId">×</button>`:''):p.motherId?`<div class="rel"><span class="lbl">Mor</span><span class="muted small">Dold i den här vyn</span></div>`:ed?`<div class="rel"><span class="lbl">Mor</span><button class="btn sm ghost" data-add="mother">+ Lägg till mor</button></div>`:''}
    ${parts.map(sp=>relRow('Partner',sp,ed&&(p.spouseIds||[]).includes(sp.id)?`<button class="iconbtn" title="Koppla bort" data-unspouse="${sp.id}">×</button>`:'')).join('')}
    ${kids.map(c=>relRow('Barn',c)).join('')}
    ${sibs.map(s=>relRow('Syskon',s)).join('')}
    ${ed?`<div class="acts" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-add="partner">+ Partner</button><button class="btn sm" data-add="child">+ Barn</button><button class="btn sm" data-add="sibling">+ Syskon</button><button class="btn sm" data-act="link" title="Koppla till en person som redan finns i arkivet">🔗 Koppla till befintlig person</button></div>`:''}
  </div>
  <div class="sec"><h4>Händelser ${ed?'<button class="btn sm" data-act="addev">+ Händelse</button>':''}</h4>
    <div id="evform"></div>
    ${evs.length?evs.map(e=>{const nc=e.id?cites.filter(c=>c.about==='event:'+e.id).length:0; return `<div class="ev"><span class="d">${esc(e.date||'–')}</span><span class="w"><b>${esc(e.type)}</b>${e.placeId?` · <a href="#" data-place="${e.placeId}">${esc(placeName(e.placeId))}</a>`:''}${e.withId&&P(e.withId)?` · med <a href="#" data-goto="${e.withId}">${esc(fullName(P(e.withId)))}</a>`:''}${e.desc?`<div class="small muted">${esc(e.desc)}</div>`:''}${nc?`<div class="small muted">📜 ${nc} källhänvisning${nc>1?'ar':''}</div>`:''}</span>
      <span>${ed&&e.id?`<button class="iconbtn" data-editev="${e.id}" title="Redigera">✎</button>`:''}</span></div>`}).join(''):'<div class="muted small">Inga händelser registrerade.</div>'}
  </div>
  <div class="sec cites"><h4>Källor ${ed?'<button class="btn sm" data-act="addcite">+ Källhänvisning</button>':''}</h4>
    <div id="citeform"></div>
    ${cites.length?cites.map(c=>{const s=S.sources[c.sourceId]; return `<div class="cite"><div style="display:flex;gap:6px"><b data-src="${c.sourceId}" style="flex:1">${esc(s?s.title:'(borttagen källa)')}</b>${ed?`<button class="iconbtn" data-delcite="${c.id}" title="Ta bort">×</button>`:''}</div>
      <div class="small muted">${esc(aboutLabel(c.about))}${c.detail?' · '+esc(c.detail):''}${s&&s.ref?' · '+esc(s.ref):''}</div></div>`}).join(''):`<div class="muted small">Inga källor ännu. Koppla husförhörslängder, dopböcker m.m. så vet du var uppgifterna kommer ifrån.</div>`}
  </div>
  ${mediaSection(p)}
  <div class="sec"><h4>Anteckningar</h4>
    ${ed?`<textarea class="t" id="notes" placeholder="Forskningsanteckningar, frågor, ledtrådar…">${esc(p.notes||'')}</textarea><div class="hint" id="notesHint">Sparas när du klickar utanför rutan.</div>`:`<div style="white-space:pre-wrap">${esc(p.notes||'–')}</div>`}
  </div>`;
}
function mediaSection(o){
  const ed=E.canEdit; const can=ed;
  return `<div class="sec"><h4>Bilder &amp; dokument ${can?`<label class="btn sm" style="cursor:pointer">+ Ladda upp<input type="file" id="upl" multiple accept="${E.assets?'image/*,application/pdf':'image/*'}" hidden></label>`:''}</h4>
    <div id="uplprog"></div>
    ${(o.media||[]).length?`<div class="media">${o.media.map((m,i)=>`<div class="m" data-media="${i}" title="${esc(m.caption||m.name)}">${/^image\//.test(m.contentType||'')?`<img src="${esc(murl(m))}" alt="${esc(m.caption||'')}">`:`📄<br>${esc((m.name||'dokument').slice(0,26))}`}${m.profile?'<span style="position:absolute;top:4px;left:4px;background:var(--ink);color:#fff;border-radius:99px;font-size:10px;padding:1px 6px">profil</span>':''}</div>`).join('')}</div>`:`<div class="muted small">${can?(E.assets?'Lägg till foton, inskannade brev eller kyrkboksutdrag (bild eller PDF).':'Lägg till foton eller inskannade dokument som bild. Bilderna förminskas och sparas i webbläsaren.'):'Inga filer.'}</div>`}
  </div>`;
}
function bindPanel(){
  const pn=$('#panel');
  pn.querySelectorAll('[data-goto]').forEach(el=>el.onclick=e=>{e.preventDefault(); followPerson(el.dataset.goto);});
  pn.querySelectorAll('[data-place]').forEach(el=>el.onclick=e=>{e.preventDefault();select('place',el.dataset.place);});
  pn.querySelectorAll('[data-src]').forEach(el=>el.onclick=e=>{e.preventDefault();select('source',el.dataset.src);});
  if(!ui.sel) return;
  if(ui.sel.type==='person') bindPersonPanel(P(ui.sel.id));
  fillNames(pn);
  if(ui.sel.type==='place') bindPlacePanel(S.places[ui.sel.id]);
  if(ui.sel.type==='source') bindSourcePanel(S.sources[ui.sel.id]);
  bindMedia();
}
function bindPersonPanel(p){
  const pn=$('#panel'); const a=s=>pn.querySelector(s);
  pn.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
    const act=b.dataset.act;
    if(act==='focus'){setFocus(p.id);ui.treeKey=null; if(ui.view!=='trad') location.hash='trad'; else renderAll();}
    if(act==='edit') openPersonModal(p);
    if(act==='card') openCard(p.id);
    if(act==='hide') hideModal(p);
    if(act==='rel'){ui.relB=p.id; if(!ui.relA||ui.relA===p.id) ui.relA=(homePerson()&&homePerson().id!==p.id)?homePerson().id:(ui.focus!==p.id?ui.focus:null); location.hash='slaktskap';}
    if(act==='home'&&!p.home) setHome(p.id);
    if(act==='delp') confirmBox(`Ta bort ${fullName(p)}?`,'Personen tas bort och kopplingar till familjemedlemmar lossas. Det går inte att ångra.','Ta bort',()=>deletePerson(p.id));
    if(act==='addev') eventForm(p,null);
    if(act==='addcite') citeForm(p);
    if(act==='link') linkModal(p.id);
    if(act==='photo') photoModal(p.id);
  });
  pn.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
    if(b.dataset.add==='sibling'&&!p.fatherId&&!p.motherId){toast(`Syskon kopplas via föräldrarna. Lägg först till far eller mor till ${fullName(p)}.`,5000);return;}
    openPersonModal(null,{rel:b.dataset.add,of:p.id});});
  pn.querySelectorAll('[data-unlink]').forEach(b=>b.onclick=()=>{const q=clone(p); q[b.dataset.unlink]=''; Store.put(q);});
  pn.querySelectorAll('[data-unspouse]').forEach(b=>b.onclick=()=>{const o=P(b.dataset.unspouse); const q=clone(p); q.spouseIds=(q.spouseIds||[]).filter(x=>x!==o.id); Store.put(q,{silent:true}); if(o){const r=clone(o); r.spouseIds=(r.spouseIds||[]).filter(x=>x!==p.id); Store.put(r,{silent:true});} renderAll();});
  pn.querySelectorAll('[data-editev]').forEach(b=>b.onclick=()=>eventForm(p,(p.events||[]).find(e=>e.id===b.dataset.editev)));
  pn.querySelectorAll('[data-delcite]').forEach(b=>b.onclick=()=>{const q=clone(p); q.citations=(q.citations||[]).filter(c=>c.id!==b.dataset.delcite); Store.put(q);});
  const nt=a('#notes'); if(nt) nt.onblur=()=>{if((p.notes||'')!==nt.value){const q=clone(P(p.id)); q.notes=nt.value; Store.put(q,{silent:true}); $('#notesHint').textContent='Sparat ✓';}};
}
function placeOptions(){return `<datalist id="dlPlaces">${Object.values(S.places).sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(pl=>`<option value="${esc(pl.name)}">`).join('')}</datalist>`;}
function personOptions(exclude){return `<datalist id="dlPersons">${Object.values(S.persons).filter(x=>x.id!==exclude).map(x=>{const l=personLabel(x);return `<option value="${esc(l)}">`;}).join('')}</datalist>`;}
function personByLabel(label){label=norm(label); if(!label) return null; const all=Object.values(S.persons); return all.find(x=>norm(personLabel(x))===label)||(()=>{const m=all.filter(x=>norm(fullName(x))===label); return m.length===1?m[0]:null;})();}
function eventForm(p,ev){
  const f=$('#evform'); const isNew=!ev; ev=ev||{type:'Flytt'};
  f.innerHTML=`<div class="mini">
    <div class="row2"><label class="f"><span>Typ</span><select class="t" id="evT">${EVENT_TYPES.map(t=>`<option ${t===ev.type?'selected':''}>${t}</option>`).join('')}</select></label>
    <label class="f"><span>Datum</span><input class="t" id="evD" value="${esc(ev.date||'')}" placeholder="1823-04-12, 1823, ca 1820"></label></div>
    <label class="f"><span>Plats</span><input class="t" id="evP" list="dlPlaces" value="${esc(placeName(ev.placeId))}" placeholder="t.ex. Rättvik">${placeOptions()}</label>
    <label class="f" id="evWithL"><span>Med (t.ex. make/maka vid vigsel)</span><input class="t" id="evW" list="dlPersons" value="${esc(ev.withId&&P(ev.withId)?personLabel(P(ev.withId)):'')}">${personOptions(p.id)}</label>
    <label class="f"><span>Beskrivning</span><input class="t" id="evX" value="${esc(ev.desc||'')}" placeholder="t.ex. Flyttar till Stockholm, Klara församling"></label>
    <div style="display:flex;gap:6px">${!isNew?'<button class="btn sm danger ghost" id="evDel">Ta bort</button>':''}<span style="flex:1"></span><button class="btn sm" id="evC">Avbryt</button><button class="btn sm primary" id="evS">Spara</button></div></div>`;
  $('#evD').focus();
  $('#evC').onclick=()=>f.innerHTML='';
  if(!isNew) $('#evDel').onclick=()=>{const q=clone(P(p.id)); q.events=(q.events||[]).filter(e=>e.id!==ev.id); q.citations=(q.citations||[]).filter(c=>c.about!=='event:'+ev.id); Store.put(q);};
  $('#evS').onclick=()=>{
    const q=clone(P(p.id)); const pl=ensurePlace($('#evP').value); if(pl.created) Store.put(pl.created,{silent:true});
    const w=personByLabel($('#evW').value);
    const ne={id:ev.id||uid('e'),type:$('#evT').value,date:$('#evD').value.trim(),placeId:pl.id,desc:$('#evX').value.trim(),withId:w?w.id:''};
    q.events=(q.events||[]).filter(e=>e.id!==ne.id).concat([ne]);
    Store.put(q);
  };
}
function citeForm(p){
  const f=$('#citeform');
  const srcs=Object.values(S.sources).sort((a,b)=>a.title.localeCompare(b.title,'sv'));
  f.innerHTML=`<div class="mini">
    <label class="f"><span>Källa</span><select class="t" id="ciS"><option value="__new">+ Ny källa…</option>${srcs.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label>
    <div id="ciNew"><div class="row2"><label class="f"><span>Titel på ny källa</span><input class="t" id="ciT" placeholder="Rättvik (W) AI:15 1850–1855"></label>
      <label class="f"><span>Typ</span><select class="t" id="ciTy">${SOURCE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></label></div></div>
    <div class="row2"><label class="f"><span>Gäller</span><select class="t" id="ciA"><option value="">Allmänt</option><option>Födelse</option><option>Död</option><option>Föräldrar</option><option>Namn</option><option>Yrke</option>${(p.events||[]).map(e=>`<option value="event:${e.id}">${esc(e.type+(e.date?' '+e.date:''))}</option>`).join('')}</select></label>
    <label class="f"><span>Sida / bild-ID</span><input class="t" id="ciD" placeholder="sid 45, bild 50"></label></div>
    <div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn sm" id="ciC">Avbryt</button><button class="btn sm primary" id="ciOk">Spara</button></div></div>`;
  const sync=()=>$('#ciNew').style.display=$('#ciS').value==='__new'?'':'none';
  if(srcs.length) $('#ciS').value=srcs[0].id; sync(); $('#ciS').onchange=sync;
  $('#ciC').onclick=()=>f.innerHTML='';
  $('#ciOk').onclick=()=>{
    let sid=$('#ciS').value;
    if(sid==='__new'){const t=$('#ciT').value.trim(); if(!t){$('#ciT').focus();return;} const s={kind:'source',id:uid('s'),title:t,type:$('#ciTy').value,createdAt:new Date().toISOString()}; Store.put(s,{silent:true}); sid=s.id;}
    const q=clone(P(p.id)); q.citations=(q.citations||[]).concat([{id:uid('c'),sourceId:sid,about:$('#ciA').value,detail:$('#ciD').value.trim()}]);
    Store.put(q);
  };
}
function shrinkImage(file,max=900,q=.8){
  return new Promise((res,rej)=>{const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',q));};
    img.onerror=()=>{URL.revokeObjectURL(url); rej(new Error('Kunde inte läsa bilden'));}; img.src=url;});
}
async function uploadMedia(files,{profile}={}){
  files=[...files]; if(!files.length) return;
  const prog=$('#uplprog'); if(prog) prog.innerHTML=`<div class="small muted">Laddar upp ${files.length} fil(er)…</div><div class="progress"><i></i></div>`;
  const added=[]; let i=0;
  for(const file of files){
    try{
      if(E.assets){const r=await E.assets.upload(file); added.push({assetId:r.id,url:r.url,name:file.name,contentType:r.contentType||file.type,caption:''});}
      else{ if(!/^image\//.test(file.type)) throw new Error('bara bilder kan sparas här'); const url=await shrinkImage(file,1100,.82); const id=await storeBlob(url); added.push({url:'kl:'+id,name:file.name,contentType:'image/jpeg',caption:''}); }
    }catch(e){toast('Kunde inte ladda upp '+file.name+(e&&e.message?': '+e.message:''));}
    i++; const bar=prog&&prog.querySelector('i'); if(bar) bar.style.width=(100*i/files.length)+'%';
  }
  if(!added.length){if(prog) prog.innerHTML=''; return;}
  const cur=clone(currentSelObj()); cur.media=cur.media||[];
  const hasProfile=cur.media.some(m=>m.profile);
  if(profile||(!hasProfile&&!cur.media.some(isImg))){ const first=added.find(isImg); if(first){cur.media.forEach(m=>delete m.profile); first.profile=true;} }
  cur.media=cur.media.concat(added); await Store.put(cur);
  if(cur.kind==='person'&&added.some(m=>m.profile)) autoFrame(cur.id);
}
/* ---- Face framing ---- */
function loadImg(url){return new Promise((ok,bad)=>{const i=new Image(); if(!/^data:|^blob:/.test(url)) i.crossOrigin='anonymous'; i.onload=()=>ok(i); i.onerror=()=>bad(new Error('bilden kunde inte läsas')); i.src=url;});}
let _faceDet=null;
/** Find the largest face. Uses the browser's FaceDetector if present, else MediaPipe (loaded on demand). */
async function detectFace(img){
  if('FaceDetector' in window){try{const fs=await new window.FaceDetector({fastMode:false,maxDetectedFaces:5}).detect(img); if(fs.length){const b=fs.sort((a,c)=>c.boundingBox.width-a.boundingBox.width)[0].boundingBox; return {x:b.x,y:b.y,w:b.width,h:b.height};}}catch(e){}}
  if(!_faceDet) _faceDet=(async()=>{const V='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const mp=await import(V+'/vision_bundle.mjs'); const fr=await mp.FilesetResolver.forVisionTasks(V+'/wasm');
    return mp.FaceDetector.createFromOptions(fr,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'},runningMode:'IMAGE',minDetectionConfidence:.4});})();
  const det=await _faceDet; const r=det.detect(img).detections;
  if(!r.length) return null; const b=r.sort((a,c)=>c.boundingBox.width-a.boundingBox.width)[0].boundingBox;
  return {x:b.originX,y:b.originY,w:b.width,h:b.height};
}
/** Framing that puts a face slightly above centre of a 3:4 portrait, face ≈ 45% of the height. */
function frameForFace(f,nw,nh){const s0=Math.max((3/4)/nw,1/nh), visH=f.h/.45, z=Math.min(6,Math.max(1,1/(s0*visH)));
  return {x:(f.x+f.w/2)/nw,y:Math.min(1,(f.y+f.h/2+.08*Math.min(visH,nh))/nh),z,nw,nh};}
async function findFrame(url){const img=await loadImg(url); const nw=img.naturalWidth,nh=img.naturalHeight; let f=null; try{f=await detectFace(img);}catch(e){console.warn('Ansiktsigenkänning ej tillgänglig',e);}
  return {frame:f?frameForFace(f,nw,nh):null,nw,nh};}
async function autoFrame(pid){
  const p=P(pid), m=p&&avatarMedia(p); if(!m) return;
  try{const {frame,nw,nh}=await findFrame(await blobUrl(m)); const q=clone(P(pid)), mm=avatarMedia(q); if(!mm) return;
    mm.focus=frame||{x:.5,y:.35,z:1,nw,nh}; await Store.put(q);
    toast(frame?'Bilden är centrerad på ansiktet.':'Hittade inget ansikte. Du kan flytta bilden själv.',5000,{label:'Justera',fn:()=>photoModal(pid)});
  }catch(e){toast('Bilden är sparad. Vill du flytta den?',5000,{label:'Justera',fn:()=>photoModal(pid)});}
}
function photoModal(pid){
  const p=P(pid), m=p&&avatarMedia(p); if(!m) return;
  const W=240,H=320; let f=Object.assign({x:.5,y:.35,z:1},m.focus||{});
  modal(`<h3>Justera bilden</h3>
    <p class="muted" style="margin-top:-4px">Dra i bilden så att ansiktet hamnar i rutan. Zooma med reglaget eller mushjulet.</p>
    <div class="cropwrap"><div class="cropbox" id="cropBox" style="width:${W}px;height:${H}px"><img id="cropImg" src="${esc(murl(m))}" alt="" draggable="false"></div>
      <div class="cropside"><div class="avatar" id="cropCircle" style="width:96px;height:96px;position:relative"><img src="${esc(murl(m))}" alt=""></div><span class="muted small">Så blir den runda bilden</span>
      <label class="f" style="width:100%"><span>Zoom</span><input type="range" id="cropZ" min="1" max="6" step="0.01" value="${f.z}"></label>
      <button class="btn" id="cropAuto">✨ Hitta ansiktet automatiskt</button><span class="muted small" id="cropMsg"></span></div></div>
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Spara</button></div>`,
  async(ov,close)=>{
    const q=x=>ov.querySelector(x), img=q('#cropImg'), circ=q('#cropCircle img');
    try{const i=await loadImg(murl(m)); f.nw=f.nw||i.naturalWidth; f.nh=f.nh||i.naturalHeight;}catch(e){f.nw=f.nw||W; f.nh=f.nh||H;}
    const place=(el,A)=>{const c=cropPct({focus:f},A); Object.assign(el.style,{position:'absolute',maxWidth:'none',width:c.w+'%',height:c.h+'%',left:c.l+'%',top:c.t+'%'});};
    const draw=()=>{place(img,W/H); place(circ,1); q('#cropZ').value=f.z;};
    const clampF=()=>{f.x=Math.min(1,Math.max(0,f.x)); f.y=Math.min(1,Math.max(0,f.y)); f.z=Math.min(6,Math.max(1,f.z));};
    draw();
    const box=q('#cropBox'); let drag=null;
    box.onpointerdown=e=>{drag={sx:e.clientX,sy:e.clientY,x:f.x,y:f.y}; box.setPointerCapture(e.pointerId);};
    box.onpointermove=e=>{if(!drag) return; const c=cropPct({focus:f},W/H), wpx=c.w/100*W, hpx=c.h/100*H;
      f.x=drag.x-(e.clientX-drag.sx)/wpx; f.y=drag.y-(e.clientY-drag.sy)/hpx; clampF(); draw();};
    box.onpointerup=()=>{drag=null;};
    box.onwheel=e=>{e.preventDefault(); f.z*=e.deltaY<0?1.08:1/1.08; clampF(); draw();};
    q('#cropZ').oninput=e=>{f.z=+e.target.value; draw();};
    q('#cropAuto').onclick=async()=>{const msg=q('#cropMsg'); msg.textContent='Letar efter ansikte…';
      try{const r=await findFrame(murl(m)); if(r.frame){f=r.frame; draw(); msg.textContent='Klart!';} else msg.textContent='Hittade inget ansikte – flytta bilden själv.';}
      catch(e){msg.textContent='Det gick inte att söka efter ansikten här.';}};
    q('[data-x]').onclick=close;
    q('[data-ok]').onclick=async()=>{const pq=clone(P(pid)), mm=avatarMedia(pq); if(mm){mm.focus={x:+f.x.toFixed(4),y:+f.y.toFixed(4),z:+f.z.toFixed(3),nw:f.nw,nh:f.nh}; await Store.put(pq);} close(); ui.treeKey=null; renderAll(true);};
  });
}
function bindMedia(){
  const pn=$('#panel'); const o=currentSelObj(); if(!o) return;
  const up=pn.querySelector('#upl'); if(up) up.onchange=()=>uploadMedia(up.files);
  const av=pn.querySelector('#uplAv'); if(av) av.onchange=()=>uploadMedia(av.files,{profile:true});
  pn.querySelectorAll('[data-media]').forEach(el=>el.onclick=()=>openLightbox(o,+el.dataset.media));
}
function currentSelObj(){if(!ui.sel) return null; return ui.sel.type==='person'?P(ui.sel.id):ui.sel.type==='place'?S.places[ui.sel.id]:S.sources[ui.sel.id];}
function openLightbox(o,i){
  const m=o.media[i]; const isImg=/^image\//.test(m.contentType||'');
  const lb=document.createElement('div'); lb.className='lightbox';
  lb.innerHTML=`${isImg?`<img src="${esc(murl(m))}" alt="">`:`<div style="font-size:48px">📄</div><p>${esc(m.name)}</p><a class="btn" href="${esc(murl(m))}" target="_blank" rel="noopener" style="color:var(--ink)">Öppna dokumentet</a>`}
    <div class="cap">${E.canEdit?`<input class="t" id="lbCap" style="width:320px;max-width:60vw" placeholder="Bildtext, t.ex. 'Konfirmation 1902'" value="${esc(m.caption||'')}"><button class="btn" id="lbSave">Spara text</button>${isImg&&ui.sel&&ui.sel.type==='person'&&!m.profile?'<button class="btn" id="lbProf">Använd som profilbild</button>':''}<button class="btn danger" id="lbDel">Ta bort</button>`:`<span>${esc(m.caption||'')}</span>`}<button class="btn" id="lbClose">Stäng</button></div>`;
  document.body.appendChild(lb);
  const close=()=>lb.remove();
  lb.onclick=e=>{if(e.target===lb) close();};
  $('#lbClose').onclick=close;
  if(E.canEdit){
    $('#lbSave').onclick=()=>{const c=clone(currentSelObj()); c.media[i].caption=$('#lbCap').value; Store.put(c); close();};
    const pb=$('#lbProf'); if(pb) pb.onclick=()=>{const c=clone(currentSelObj()); c.media.forEach((x,j)=>{if(j===i) x.profile=true; else delete x.profile;}); Store.put(c); close(); toast('Profilbilden är bytt');};
    $('#lbDel').onclick=()=>{close(); confirmBox('Ta bort filen?','Filen tas bort från arkivet för gott.','Ta bort',async()=>{const c=clone(currentSelObj()); const [rm]=c.media.splice(i,1); await Store.put(c); if(rm&&rm.assetId&&E.assets){try{await E.assets.delete(rm.assetId);}catch(e){}}});};
  }
}
async function deletePerson(id){
  const others=Object.values(ALL.persons).filter(x=>x.id!==id&&(x.fatherId===id||x.motherId===id||(x.spouseIds||[]).includes(id)||(x.events||[]).some(e=>e.withId===id)));
  for(const o of others){const q=clone(o); if(q.fatherId===id) q.fatherId=''; if(q.motherId===id) q.motherId=''; q.spouseIds=(q.spouseIds||[]).filter(x=>x!==id); (q.events||[]).forEach(e=>{if(e.withId===id) e.withId='';}); Store.put(q,{silent:true});}
  if(ui.focus===id) ui.focus=null;
  ui.sel=null; Store.del('person',id);
}

/* ============ Modal ============ */
function modal(html,onMount){
  const ov=document.createElement('div'); ov.className='ov'; ov.innerHTML=`<div class="modal">${html}</div>`;
  document.body.appendChild(ov);
  const close=()=>{ov.remove();document.removeEventListener('keydown',kd);};
  const kd=e=>{if(e.key==='Escape') close();};
  document.addEventListener('keydown',kd);
  ov.addEventListener('mousedown',e=>{if(e.target===ov) close();});
  onMount&&onMount(ov,close); return close;
}
function confirmBox(title,text,okLabel,onOk){
  modal(`<h3>${esc(title)}</h3><p style="color:var(--ink2);line-height:1.5">${esc(text)}</p><div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" style="background:var(--err);border-color:var(--err)" data-ok>${esc(okLabel)}</button></div>`,(ov,close)=>{ov.querySelector('[data-x]').onclick=close; ov.querySelector('[data-ok]').onclick=()=>{close();onOk();};});
}
function openPersonModal(p,ctx){
  const isNew=!p; ctx=ctx||{};
  const base=ctx.of?P(ctx.of):null;
  p=p?clone(p):{kind:'person',id:uid('p'),given:'',surname:'',sex:ctx.rel==='father'?'M':ctx.rel==='mother'?'K':'',citations:[],events:[],media:[],spouseIds:[]};
  // prefill for relations
  if(isNew&&base){
    if(ctx.rel==='child'){ if(base.sex==='K') p.motherId=base.id; else p.fatherId=base.id; const ps=partners(base); if(ps.length===1){const o=ps[0]; if(o.sex==='K'&&!p.motherId) p.motherId=o.id; else if(!p.fatherId) p.fatherId=o.id; else p.motherId=o.id;} p.surname=base.sex!=='K'?patronym(base):''; }
    if(ctx.rel==='partner'){p.sex=base.sex==='M'?'K':base.sex==='K'?'M':'';}
    if(ctx.rel==='sibling'){p.fatherId=base.fatherId||''; p.motherId=base.motherId||''; p.surname=base.surname||'';}
  }
  const relTitle={father:'far till',mother:'mor till',child:'barn till',partner:'partner till',sibling:'syskon till'}[ctx.rel];
  const pl=id=>esc(id&&P(id)?personLabel(P(id)):'');
  modal(`<h3>${isNew?(base?'Lägg till '+relTitle+' '+esc(fullName(base)):'Ny person'):'Redigera '+esc(fullName(p))}</h3>
    ${isNew&&base?`<label class="f"><span>Välj en befintlig person istället (valfritt)</span><input class="t" id="mExisting" list="dlPersons" placeholder="Skriv för att söka…">${personOptions(base.id)}<div class="hint">Lämna tomt för att skapa en ny person.</div></label><hr style="border:none;border-top:1px solid var(--paper2);margin:14px 0">`:''}
    <div class="row2"><label class="f"><span>Förnamn</span><input class="t" id="mG" value="${esc(p.given)}" placeholder="t.ex. Anna Maria"></label>
    <label class="f"><span>Efternamn</span><input class="t" id="mS" value="${esc(p.surname)}" placeholder="t.ex. Larsdotter"></label></div>
    <div class="f callpick"><span class="lab">Tilltalsnamn <span class="muted">– klicka på namnet personen kallades</span></span><div id="mCallChips"></div><input type="hidden" id="mCall" value="${esc(p.callName||'')}"></div>
    <div class="row2"><label class="f"><span>Kön</span><select class="t" id="mSex"><option value="">Okänt</option><option value="M" ${p.sex==='M'?'selected':''}>Man</option><option value="K" ${p.sex==='K'?'selected':''}>Kvinna</option></select></label>
    <label class="f"><span>Yrke / titel</span><input class="t" id="mO" value="${esc(p.occupation||'')}" placeholder="t.ex. Bonde, Piga, Soldat"></label></div>
    <div class="row2"><label class="f"><span>Född (datum)</span><input class="t" id="mBD" value="${esc(p.birthDate||'')}" placeholder="1823-04-12, 1823 eller ca 1820"></label>
    <label class="f"><span>Födelseort</span><input class="t" id="mBP" list="dlPlaces" value="${esc(placeName(p.birthPlace))}" placeholder="Församling eller ort"></label></div>
    <div class="row2"><label class="f"><span>Död (datum)</span><input class="t" id="mDD" value="${esc(p.deathDate||'')}"></label>
    <label class="f"><span>Dödsort</span><input class="t" id="mDP" list="dlPlaces" value="${esc(placeName(p.deathPlace))}"></label></div>
    ${placeOptions()}
    ${ctx.rel==='father'||ctx.rel==='mother'?'':`<div class="row2"><label class="f"><span>Far</span><input class="t" id="mF" list="dlPersons2" value="${pl(p.fatherId)}" placeholder="${p.fatherId&&!P(p.fatherId)?'Dold i den här vyn – lämna tomt':'Sök befintlig person'}"></label>
    <label class="f"><span>Mor</span><input class="t" id="mM" list="dlPersons2" value="${pl(p.motherId)}" placeholder="${p.motherId&&!P(p.motherId)?'Dold i den här vyn – lämna tomt':'Sök befintlig person'}"></label></div>
    <datalist id="dlPersons2">${Object.values(S.persons).filter(x=>x.id!==p.id).map(x=>`<option value="${esc(personLabel(x))}">`).join('')}</datalist>`}
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>${isNew?'Lägg till':'Spara'}</button></div>`,
  (ov,close)=>{
    const q=s=>ov.querySelector(s);
    q('#mG').focus();
    const chips=()=>{const ws=q('#mG').value.trim().split(/\s+/).map(w=>w.replace(/[()*]/g,'')).filter(Boolean), cur=q('#mCall').value;
      q('#mCallChips').innerHTML=ws.length>1||cur?ws.map(w=>`<button type="button" class="cchip${w===cur?' on':''}" data-w="${esc(w)}">${esc(w)}</button>`).join('')+(cur&&!ws.includes(cur)?`<button type="button" class="cchip on" data-w="${esc(cur)}">${esc(cur)}</button>`:''):'<span class="muted small">Skriv flera förnamn så kan du välja ett.</span>';
      q('#mCallChips').querySelectorAll('.cchip').forEach(b=>b.onclick=()=>{q('#mCall').value=q('#mCall').value===b.dataset.w?'':b.dataset.w; chips();});};
    q('#mG').addEventListener('input',chips); chips();
    q('[data-x]').onclick=close;
    q('[data-ok]').onclick=async()=>{
      let target=null;
      if(q('#mExisting')&&q('#mExisting').value.trim()){target=personByLabel(q('#mExisting').value); if(!target){toast('Hittade ingen sådan person – välj i listan.');return;} target=clone(target);}
      if(!target){
        const g=q('#mG').value.trim(),s=q('#mS').value.trim(); if(!g&&!s){q('#mG').focus();toast('Skriv minst ett namn.');return;}
        Object.assign(p,{given:g,callName:q('#mCall').value,surname:s,sex:q('#mSex').value,occupation:q('#mO').value.trim(),birthDate:q('#mBD').value.trim(),deathDate:q('#mDD').value.trim()});
        const bp=ensurePlace(q('#mBP').value),dp=ensurePlace(q('#mDP').value);
        if(bp.created) Store.put(bp.created,{silent:true}); if(dp.created&&dp.created!==bp.created) Store.put(dp.created,{silent:true});
        p.birthPlace=bp.id; p.deathPlace=dp.id;
        if(q('#mF')){const fv=q('#mF').value.trim(),mv=q('#mM').value.trim(); const f=personByLabel(fv),m=personByLabel(mv);
          if(fv&&!f){toast('Hittade inte fadern i listan.');return;} if(mv&&!m){toast('Hittade inte modern i listan.');return;}
          p.fatherId=f?f.id:(!fv&&p.fatherId&&!P(p.fatherId)?p.fatherId:''); p.motherId=m?m.id:(!mv&&p.motherId&&!P(p.motherId)?p.motherId:'');}
        if(isNew) p.createdAt=new Date().toISOString();
        target=p;
      }
      close();
      // relation wiring
      if(base&&ctx.rel){
        const b=clone(P(base.id));
        if(ctx.rel==='father'){b.fatherId=target.id; if(!target.sex) target.sex='M';}
        if(ctx.rel==='mother'){b.motherId=target.id; if(!target.sex) target.sex='K';}
        if(ctx.rel==='partner'){b.spouseIds=[...new Set([...(b.spouseIds||[]),target.id])]; target.spouseIds=[...new Set([...(target.spouseIds||[]),b.id])];
          // link parents of the other parent with existing children of base where missing
        }
        if(ctx.rel==='child'&&target!==p){ if(b.sex==='K') target.motherId=b.id; else target.fatherId=b.id; }
        if(ctx.rel==='sibling'&&target!==p){ if(!target.fatherId) target.fatherId=b.fatherId||''; if(!target.motherId) target.motherId=b.motherId||''; }
        // if adding a parent and the other parent exists, make them partners
        if((ctx.rel==='father'||ctx.rel==='mother')){const other=P(ctx.rel==='father'?b.motherId:b.fatherId); if(other){target.spouseIds=[...new Set([...(target.spouseIds||[]),other.id])]; const o=clone(other); o.spouseIds=[...new Set([...(o.spouseIds||[]),target.id])]; Store.put(o,{silent:true});}}
        await Store.put(target,{silent:true}); Store.put(b,{silent:true});
      } else { Store.put(target,{silent:true}); }
      if(!ui.focus) setFocus(target.id);
      if(ui.view==='trad') ui.treeKey=null;
      ui.sel={type:'person',id:(ctx.rel==='father'||ctx.rel==='mother')&&base?base.id:target.id};
      if(isNew&&!base) {setFocus(target.id); ui.sel={type:'person',id:target.id};}
      renderAll();
    };
    ov.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT') q('[data-ok]').click();});
  });
}
function patronym(f){
  // Suggest a family surname: keep father's surname unless it's a patronymic
  const s=f.surname||''; if(/(son|dotter)$/i.test(s)) return ''; return s;
}

/* ============ Place panel ============ */
function placePanel(pl){
  const ed=E.canEdit;
  const refs=[];
  for(const p of Object.values(S.persons)) for(const e of lifeEvents(p)) if(e.placeId===pl.id) refs.push({p,e});
  refs.sort((a,b)=>(dateKey(a.e.date)??9e9)-(dateKey(b.e.date)??9e9));
  return `<div class="ph"><div class="top"><div class="avatar">📍</div><div style="flex:1"><h3>${esc(pl.name)}</h3><div class="sub">${esc([pl.parish,pl.county,pl.country].filter(Boolean).join(', '))||'Plats'}</div></div>${closeBtn}</div>
    <div class="acts"><button class="btn sm" data-pact="map">${pl.lat!=null?'Visa på kartan':'Placera på kartan'}</button>${pl.lat!=null&&ed?'<button class="btn sm" data-pact="move">Flytta markören</button>':''}${ed?'<button class="btn sm" data-pact="edit">Redigera</button><button class="btn sm" data-pact="merge">Slå ihop…</button>':''}</div></div>
    <div class="sec"><h4>Detaljer</h4><dl class="facts"><dt>Församling</dt><dd>${esc(pl.parish||'–')}</dd><dt>Län</dt><dd>${esc(pl.county||'–')}</dd><dt>Land</dt><dd>${esc(pl.country||'–')}</dd><dt>Koordinat</dt><dd>${pl.lat!=null?pl.lat.toFixed(4)+', '+pl.lon.toFixed(4):'<span class="tag warn">saknas</span>'}</dd></dl>
    ${pl.notes?`<p style="white-space:pre-wrap">${esc(pl.notes)}</p>`:''}</div>
    <div class="sec"><h4>Händelser här (${refs.length})</h4>${refs.map(r=>`<div class="ev"><span class="d">${esc(r.e.date||'–')}</span><span class="w"><b>${esc(r.e.type)}</b> · <a href="#" data-goto="${r.p.id}">${esc(fullName(r.p))}</a>${r.e.desc?`<div class="small">${esc(r.e.desc)}</div>`:''}${r.e.note&&r.e.note!==r.e.desc?`<div class="small muted">${esc(r.e.note)}</div>`:''}</span><span></span></div>`).join('')||'<div class="muted small">Inga.</div>'}</div>
    ${mediaSection(pl)}`;
}
function bindPlacePanel(pl){
  $('#panel').querySelectorAll('[data-pact]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.pact;
    if(a==='map'){ if(pl.lat==null&&E.canEdit) ui.placing=pl.id; mapState.focusPlace=pl.id; if(ui.view!=='karta') location.hash='karta'; else renderMap(); }
    if(a==='move'){ui.placing=pl.id; if(ui.view!=='karta') location.hash='karta'; else renderMap();}
    if(a==='edit') placeModal(pl);
    if(a==='merge') mergeModal(pl);
  });
}
function placeModal(pl){
  modal(`<h3>Redigera plats</h3>
    <label class="f"><span>Namn</span><input class="t" id="plN" value="${esc(pl.name)}"></label>
    <div class="row2"><label class="f"><span>Församling / socken</span><input class="t" id="plPa" value="${esc(pl.parish||'')}"></label><label class="f"><span>Län / landskap</span><input class="t" id="plC" value="${esc(pl.county||'')}"></label></div>
    <div class="row2"><label class="f"><span>Land</span><input class="t" id="plCo" value="${esc(pl.country||'')}" placeholder="Sverige"></label><div></div></div>
    <div class="row2"><label class="f"><span>Latitud</span><input class="t" id="plLa" value="${pl.lat??''}" placeholder="60.886"></label><label class="f"><span>Longitud</span><input class="t" id="plLo" value="${pl.lon??''}" placeholder="15.118"></label></div>
    <div class="hint" style="margin:-6px 0 12px">Enklast är att klicka på kartan istället (”Placera på kartan”).</div>
    <label class="f"><span>Anteckningar</span><textarea class="t" id="plNo">${esc(pl.notes||'')}</textarea></label>
    <div class="foot"><button class="btn danger ghost" data-del style="margin-right:auto">Ta bort plats</button><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Spara</button></div>`,(ov,close)=>{
    const q=s=>ov.querySelector(s); q('[data-x]').onclick=close;
    q('[data-del]').onclick=()=>{close(); confirmBox('Ta bort '+pl.name+'?','Personer och händelser som hänvisar hit förlorar platsen.','Ta bort',()=>{replacePlace(pl.id,''); ui.sel=null; Store.del('place',pl.id);});};
    q('[data-ok]').onclick=()=>{const n=clone(pl); n.name=q('#plN').value.trim()||pl.name; n.parish=q('#plPa').value.trim(); n.county=q('#plC').value.trim(); n.country=q('#plCo').value.trim(); n.notes=q('#plNo').value;
      const la=parseFloat(q('#plLa').value.replace(',','.')),lo=parseFloat(q('#plLo').value.replace(',','.'));
      if(isFinite(la)&&isFinite(lo)){n.lat=la;n.lon=lo;} else {delete n.lat; delete n.lon;}
      close(); mapState.drawn=false; Store.put(n);};
  });
}
function replacePlace(from,to){
  for(const p of Object.values(ALL.persons)){
    let ch=false; const q=clone(p);
    if(q.birthPlace===from){q.birthPlace=to;ch=true;} if(q.deathPlace===from){q.deathPlace=to;ch=true;}
    (q.events||[]).forEach(e=>{if(e.placeId===from){e.placeId=to;ch=true;}});
    if(ch) Store.put(q,{silent:true});
  }
}
function mergeModal(pl){
  const others=Object.values(S.places).filter(x=>x.id!==pl.id).sort((a,b)=>a.name.localeCompare(b.name,'sv'));
  modal(`<h3>Slå ihop ”${esc(pl.name)}” med…</h3><p class="muted">Användbart när samma plats har stavats olika, t.ex. ”Rättvik” och ”Rättviks socken”. Allt som hänvisar till ”${esc(pl.name)}” flyttas till platsen du väljer, och ”${esc(pl.name)}” tas bort.</p>
    <label class="f"><span>Behåll platsen</span><select class="t" id="mgT">${others.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label>
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok ${others.length?'':'disabled'}>Slå ihop</button></div>`,(ov,close)=>{
    ov.querySelector('[data-x]').onclick=close;
    ov.querySelector('[data-ok]').onclick=()=>{const to=ov.querySelector('#mgT').value; const t=clone(S.places[to]); if(t.lat==null&&pl.lat!=null){t.lat=pl.lat;t.lon=pl.lon;} t.media=(t.media||[]).concat(pl.media||[]); Store.put(t,{silent:true}); replacePlace(pl.id,to); close(); ui.sel={type:'place',id:to}; Store.del('place',pl.id);};
  });
}

/* ============ Sources ============ */
function citationsOf(sid,all){const out=[]; for(const p of Object.values(all?ALL.persons:S.persons)) for(const c of p.citations||[]) if(c.sourceId===sid) out.push({p,c}); return out;}
function renderSources(){
  const v=$('#view'); const all=Object.values(S.sources).sort((a,b)=>a.title.localeCompare(b.title,'sv'));
  const sel=ui.sel&&ui.sel.type==='source'?ui.sel.id:null;
  const unsourced=Object.values(S.persons).filter(p=>!(p.citations||[]).length).length;
  v.innerHTML=`<div class="view-pad"><div class="toolbar"><h2>Källor</h2>${E.canEdit?'<button class="btn primary" id="newSrc">+ Ny källa</button>':''}</div>
    <p class="muted" style="max-width:720px;line-height:1.55;margin-top:-6px">Registrera varje volym eller dokument en gång – t.ex. en husförhörslängd med arkivreferens och bild-ID – och koppla den sedan till de personer den nämner. ${unsourced?`<b style="color:var(--warn)">${unsourced} personer saknar källa.</b> <a href="#personer" onclick="ui.plFilter='kalla'">Visa dem</a>`:''}</p>
    ${all.length?`<table class="list m-sources"><thead><tr><th>Källa</th><th>Typ</th><th>Arkiv / referens</th><th>Hänvisningar</th></tr></thead><tbody>
    ${all.map(s=>`<tr class="click ${sel===s.id?'sel':''}" data-id="${s.id}"><td><b>${esc(s.title)}</b>${s.date?`<div class="small muted">${esc(s.date)}</div>`:''}</td><td>${esc(s.type||'')}</td><td>${esc([s.archive,s.ref].filter(Boolean).join(' · '))}</td><td>${citationsOf(s.id).length}</td></tr>`).join('')}</tbody></table>`
    :`<div class="box"><h3>Inga källor ännu</h3><p>Lägg till din första källa här, eller direkt från en person under ”Källor”.</p></div>`}</div>`;
  v.querySelectorAll('tr[data-id]').forEach(tr=>tr.onclick=()=>select('source',tr.dataset.id));
  const nb=$('#newSrc'); if(nb) nb.onclick=()=>sourceModal(null);
}
function sourcePanel(s){
  const refs=citationsOf(s.id);
  return `<div class="ph"><div class="top"><div class="avatar">📜</div><div style="flex:1"><h3>${esc(s.title)}</h3><div class="sub">${esc(s.type||'Källa')}</div></div>${closeBtn}</div>
   ${E.canEdit?'<div class="acts"><button class="btn sm" data-sact="edit">Redigera</button><button class="btn sm ghost danger" data-sact="del">Ta bort</button></div>':''}</div>
   <div class="sec"><h4>Detaljer</h4><dl class="facts"><dt>Arkiv</dt><dd>${esc(s.archive||'–')}</dd><dt>Referens</dt><dd>${esc(s.ref||'–')}</dd><dt>Period</dt><dd>${esc(s.date||'–')}</dd><dt>Länk</dt><dd>${s.url&&/^https?:/i.test(s.url)?`<a href="${esc(s.url)}" target="_blank" rel="noopener">Öppna</a>`:'–'}</dd></dl>
   ${s.notes?`<p style="white-space:pre-wrap;margin-bottom:0">${esc(s.notes)}</p>`:''}</div>
   <div class="sec"><h4>Nämner (${refs.length})</h4>${refs.map(r=>`<div class="ev"><span class="d">${esc(r.c.detail||'')}</span><span class="w"><a href="#" data-goto="${r.p.id}"><b>${esc(fullName(r.p))}</b></a><div class="small muted">${esc(r.c.about&&!r.c.about.startsWith('event:')?r.c.about:r.c.about?'Händelse':'Allmänt')}</div></span><span></span></div>`).join('')||'<div class="muted small">Inga kopplade personer ännu.</div>'}</div>
   ${mediaSection(s)}`;
}
function bindSourcePanel(s){
  $('#panel').querySelectorAll('[data-sact]').forEach(b=>b.onclick=()=>{
    if(b.dataset.sact==='edit') sourceModal(s);
    if(b.dataset.sact==='del') confirmBox('Ta bort källan?','Källhänvisningar till den tas också bort från personerna.','Ta bort',()=>{for(const r of citationsOf(s.id,true)){const q=clone(ALL.persons[r.p.id]); q.citations=q.citations.filter(c=>c.sourceId!==s.id); Store.put(q,{silent:true});} ui.sel=null; Store.del('source',s.id);});
  });
}
function sourceModal(s){
  const isNew=!s; s=s?clone(s):{kind:'source',id:uid('s'),title:'',type:'Husförhörslängd',createdAt:new Date().toISOString()};
  modal(`<h3>${isNew?'Ny källa':'Redigera källa'}</h3>
    <label class="f"><span>Titel</span><input class="t" id="sT" value="${esc(s.title)}" placeholder="Rättvik (W) AI:15 Husförhörslängd 1850–1855"></label>
    <div class="row2"><label class="f"><span>Typ</span><select class="t" id="sTy">${SOURCE_TYPES.map(t=>`<option ${t===s.type?'selected':''}>${t}</option>`).join('')}</select></label>
    <label class="f"><span>Period / datum</span><input class="t" id="sD" value="${esc(s.date||'')}" placeholder="1850–1855"></label></div>
    <div class="row2"><label class="f"><span>Arkiv</span><input class="t" id="sA" value="${esc(s.archive||'')}" placeholder="Riksarkivet, ArkivDigital…"></label>
    <label class="f"><span>Referens / volym</span><input class="t" id="sR" value="${esc(s.ref||'')}" placeholder="AI:15, AID v12345"></label></div>
    <label class="f"><span>Länk</span><input class="t" id="sU" value="${esc(s.url||'')}" placeholder="https://sok.riksarkivet.se/…"></label>
    <label class="f"><span>Anteckningar / transkription</span><textarea class="t" id="sN">${esc(s.notes||'')}</textarea></label>
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Spara</button></div>`,(ov,close)=>{
    const q=x=>ov.querySelector(x); q('#sT').focus(); q('[data-x]').onclick=close;
    q('[data-ok]').onclick=()=>{const t=q('#sT').value.trim(); if(!t){q('#sT').focus();return;} Object.assign(s,{title:t,type:q('#sTy').value,date:q('#sD').value.trim(),archive:q('#sA').value.trim(),ref:q('#sR').value.trim(),url:q('#sU').value.trim(),notes:q('#sN').value}); close(); ui.sel={type:'source',id:s.id}; Store.put(s);};
  });
}

/* ============ TIMELINE ============ */
function renderTimeline(){
  const v=$('#view'); const all=Object.values(S.persons);
  if(!all.length){v.innerHTML=emptyState();return;}
  const scope=scopeSet(ui.tlScope);
  const ppl=all.filter(p=>!scope||scope.has(p.id));
  const rows=[];
  for(const p of ppl){
    const b=dateKey(p.birthDate),d=dateKey(p.deathDate);
    const evs=(p.events||[]).map(e=>({e,k:dateKey(e.date)})).filter(x=>x.k!=null);
    let s=b,t=d,fs=false,ft=false;
    if(s==null&&t!=null){s=t-60;fs=true;}
    if(s==null&&evs.length){s=Math.min(...evs.map(x=>x.k))-20;fs=true;}
    if(s==null) continue;
    if(t==null){ if(s>NOW_Y-105&&!fs){t=NOW_Y+0.5;} else {t=Math.max(s+70,...evs.map(x=>x.k));ft=true;} }
    rows.push({p,s,t,fs,ft,evs,alive:t>=NOW_Y&&!ft&&!p.deathDate});
  }
  rows.sort((a,b)=>a.s-b.s);
  const skipped=ppl.length-rows.length;
  const LW=190,RH=24,TOP=74;
  v.innerHTML=`<div class="view-pad" style="max-width:none">
    <div class="toolbar"><h2>Tidslinje</h2>
      <div class="seg" id="tlScope">${[['alla','Alla'],['anor','Anor'],['attlingar','Ättlingar']].map(([k,t])=>`<button data-k="${k}" class="${ui.tlScope===k?'on':''}">${t}${k!=='alla'&&P(ui.focus)?' till '+esc(P(ui.focus).given||''):''}</button>`).join('')}</div>
      <label class="check" style="margin:0"><input type="checkbox" id="tlHist" ${ui.tlHist?'checked':''}> Historiska händelser</label>
    </div>
    ${rows.length?`<div id="tlChart"></div>`:`<div class="box"><p>Ingen i urvalet har några datum ännu. Lägg till födelse- eller dödsår så dyker livslinjerna upp här.</p></div>`}
    ${skipped?`<p class="small muted">${skipped} person(er) saknar datum och visas inte.</p>`:''}
    <div class="evlist"><h3 style="font-size:18px;margin-bottom:10px">Alla händelser i tidsordning</h3><div id="tlList"></div></div></div>`;
  v.querySelectorAll('#tlScope button').forEach(b=>b.onclick=()=>{ui.tlScope=b.dataset.k;renderTimeline();});
  $('#tlHist').onchange=e=>{ui.tlHist=e.target.checked;renderTimeline();};
  // event list
  const list=[]; for(const p of ppl) for(const e of lifeEvents(p)) if(e.date) list.push({p,e,k:dateKey(e.date)});
  list.sort((a,b)=>(a.k??9e9)-(b.k??9e9));
  $('#tlList').innerHTML=list.length?`<table class="list m-events"><thead><tr><th style="width:120px">Datum</th><th>Händelse</th><th>Person</th><th>Plats</th></tr></thead><tbody>${list.map(r=>`<tr class="click" data-id="${r.p.id}"><td>${esc(r.e.date)}</td><td>${esc(r.e.type)}${r.e.desc?`<div class="small muted">${esc(r.e.desc)}</div>`:''}</td><td><span class="dot" style="background:${sexColor(r.p)}"></span>${esc(fullName(r.p))}</td><td>${esc(placeName(r.e.placeId))}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Inga daterade händelser.</p>';
  $('#tlList').querySelectorAll('tr[data-id]').forEach(tr=>tr.onclick=()=>showPerson(tr.dataset.id));
  if(!rows.length) return;
  const box=$('#tlChart'); const W=Math.max(box.clientWidth,760); const H=TOP+rows.length*RH+16;
  const x0=Math.floor((d3.min(rows,r=>r.s)-5)/10)*10, x1=Math.min(NOW_Y+5,Math.ceil((d3.max(rows,r=>r.t)+5)/10)*10);
  const x=d3.scaleLinear().domain([x0,x1]).range([LW,W-20]);
  const svg=d3.select(box).append('svg').attr('width',W).attr('height',H);
  const defs=svg.append('defs');
  ['M','K','U'].forEach(s=>{const c={M:cssv('--male'),K:cssv('--female'),U:cssv('--unk')}[s];
    const gR=defs.append('linearGradient').attr('id','fr'+s); gR.append('stop').attr('offset','0').attr('stop-color',c); gR.append('stop').attr('offset','1').attr('stop-color',c).attr('stop-opacity',0);
    const gL=defs.append('linearGradient').attr('id','fl'+s); gL.append('stop').attr('offset','0').attr('stop-color',c).attr('stop-opacity',0); gL.append('stop').attr('offset','1').attr('stop-color',c);});
  if(ui.tlHist){
    const hs=HIST.filter(h=>h.b>=x0&&h.a<=x1);
    const hg=svg.append('g');
    hs.forEach((h,i)=>{const xa=x(h.a),xb=Math.max(x(h.b+1),xa+2); hg.append('rect').attr('class','hist-band').attr('x',xa).attr('y',TOP-6).attr('width',xb-xa).attr('height',H-TOP); hg.append('text').attr('class','hist-lbl').attr('x',xa>W-200?xb-2:xa+2).attr('text-anchor',xa>W-200?'end':'start').attr('y',TOP-10-(i%3)*12).text(h.t).append('title').text(h.a===h.b?h.a+': '+h.t:h.a+'–'+h.b+': '+h.t);});
  }
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${H-4})`);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,24)`).call(d3.axisTop(x).ticks(Math.min(14,(x1-x0)/10)).tickFormat(d3.format('d')).tickSize(-(H-24))).call(g=>g.selectAll('.tick line').attr('stroke',cssv('--grid'))).call(g=>g.select('.domain').remove());
  const sel=ui.sel&&ui.sel.type==='person'?ui.sel.id:null;
  const g=svg.selectAll('g.tl-row').data(rows).join('g').attr('class','tl-row').attr('transform',(r,i)=>`translate(0,${TOP+i*RH})`);
  g.append('rect').attr('class','tl-bg').attr('x',0).attr('width',W).attr('height',RH).attr('fill',r=>r.p.id===sel?cssv('--accent2'):'transparent');
  g.append('text').attr('class','tl-name').attr('x',12).attr('y',RH/2+4).text(r=>{const n=fullName(r.p);return n.length>24?n.slice(0,23)+'…':n;}).on('click',(e,r)=>showPerson(r.p.id));
  g.each(function(r){
    const el=d3.select(this); const s=r.p.sex==='M'?'M':r.p.sex==='K'?'K':'U'; const col={M:cssv('--male'),K:cssv('--female'),U:cssv('--unk')}[s];
    const xa=x(r.s),xb=x(r.t),y=RH/2-4;
    el.append('rect').attr('x',xa).attr('y',y).attr('width',Math.max(2,xb-xa)).attr('height',8).attr('rx',4).attr('fill',r.ft?`url(#fr${s})`:r.fs?`url(#fl${s})`:col).attr('opacity',.85).style('cursor','pointer').on('click',()=>showPerson(r.p.id))
      .append('title').text(`${fullName(r.p)}: ${r.p.birthDate||'?'} – ${r.p.deathDate||(r.alive?'':'?')}`);
    for(const ev of r.evs){el.append('circle').attr('cx',x(ev.k)).attr('cy',RH/2).attr('r',4.2).attr('fill',cssv('--card')).attr('stroke',col).attr('stroke-width',1.8).append('title').text(`${ev.e.type} ${ev.e.date}${ev.e.placeId?' – '+placeName(ev.e.placeId):''}`);}
    if(!r.fs) el.append('circle').attr('cx',xa).attr('cy',RH/2).attr('r',2.5).attr('fill',cssv('--card'));
  });
}

/* ============ MAP ============ */
const mapState={world:null,loading:false,drawn:false,proj:null,zoom:null,k:1,focusPlace:null};
async function loadWorld(){
  if(mapState.world||mapState.loading) return; mapState.loading=true;
  try{const r=await fetch('data/world-50m.json'); const t=await r.json(); mapState.world=topojson.feature(t,t.objects.countries).features;}catch(e){mapState.world=[];toast('Kunde inte ladda kartan');}
  mapState.loading=false; if(ui.view==='karta'){mapState.drawn=false; renderMap();}
}
function placeStats(scope){
  const st={};
  for(const p of Object.values(S.persons)){ if(scope&&!scope.has(p.id)) continue;
    for(const e of lifeEvents(p)) if(e.placeId){(st[e.placeId]=st[e.placeId]||{n:0,people:new Set()}).n++; st[e.placeId].people.add(p.id);} }
  return st;
}
function renderMap(fresh){
  const v=$('#view');
  const scope=scopeSet(ui.mapScope); const st=placeStats(scope);
  const places=Object.values(S.places);
  const used=places.filter(pl=>st[pl.id]||!scope).sort((a,b)=>(st[b.id]?.n||0)-(st[a.id]?.n||0)||a.name.localeCompare(b.name,'sv'));
  const withC=used.filter(pl=>pl.lat!=null), without=used.filter(pl=>pl.lat==null);
  const placingPl=ui.placing?S.places[ui.placing]:null;
  if(!$('#mapSvg')||fresh){
    v.innerHTML=`<div id="mapWrap"><svg id="mapSvg"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style="fill:var(--err)"/></marker></defs><g class="vp"><g class="lands"></g><g class="routes"></g><g class="mks"></g></g></svg>
      <div class="map-side" id="mapSide"></div><div id="mapBanner"></div>
      <div class="map-zoom"><button id="zIn" title="Zooma in">+</button><button id="zOut" title="Zooma ut">−</button></div></div>`;
    mapState.drawn=false;
    const svg=d3.select('#mapSvg');
    mapState.zoom=d3.zoom().scaleExtent([.5,60]).on('zoom',e=>{mapState.k=e.transform.k; svg.select('g.vp').attr('transform',e.transform); svg.selectAll('.mk').attr('transform',function(){return this.dataset.t+` scale(${1/e.transform.k})`;});});
    svg.call(mapState.zoom).on('dblclick.zoom',null);
    $('#zIn').onclick=()=>svg.transition().call(mapState.zoom.scaleBy,1.6);
    $('#zOut').onclick=()=>svg.transition().call(mapState.zoom.scaleBy,1/1.6);
    svg.on('click',e=>{
      if(!ui.placing||!mapState.proj) return;
      const [mx,my]=d3.pointer(e,svg.select('g.vp').node()); const ll=mapState.proj.invert([mx,my]);
      const pl=clone(S.places[ui.placing]); pl.lat=+ll[1].toFixed(5); pl.lon=+ll[0].toFixed(5); ui.placing=null; ui.sel={type:'place',id:pl.id}; Store.put(pl); toast('📍 '+pl.name+' placerad');
    });
    loadWorld();
  }
  // side panel
  $('#mapSide').innerHTML=`<h3>Platser</h3>
    <div class="seg" style="margin-bottom:10px" id="mpScope">${[['alla','Alla'],['anor','Anor'],['attlingar','Ättlingar']].map(([k,t])=>`<button data-k="${k}" class="${ui.mapScope===k?'on':''}">${t}</button>`).join('')}</div>
    ${ui.sel&&ui.sel.type==='person'?`<label class="check small"><input type="checkbox" id="mpRoute" ${ui.mapRoute?'checked':''}> Visa ${esc(P(ui.sel.id).given?genitive(P(ui.sel.id).given):'vald persons')} livsväg</label>`:'<div class="small muted" style="margin-bottom:6px">Välj en person för att se dennes livsväg.</div>'}
    ${without.length?`<div class="small" style="margin:10px 0 4px;color:var(--warn);font-weight:600">Saknar position (${without.length})</div>${without.map(pl=>`<div class="pl-item" data-pl="${pl.id}"><span class="n">${esc(pl.name)}</span>${E.canEdit?`<button class="btn sm" data-placing="${pl.id}">Placera</button>`:''}</div>`).join('')}`:''}
    <div class="small muted" style="margin:10px 0 4px;font-weight:600">På kartan (${withC.length})</div>
    ${withC.map(pl=>`<div class="pl-item" data-pl="${pl.id}"><span class="dot" style="background:var(--accent)"></span><span class="n">${esc(pl.name)}</span><span class="small muted">${st[pl.id]?st[pl.id].people.size+' pers.':''}</span></div>`).join('')||'<div class="small muted">Inga ännu.</div>'}`;
  $('#mapSide').querySelectorAll('#mpScope button').forEach(b=>b.onclick=()=>{ui.mapScope=b.dataset.k;mapState.drawn=false;renderMap();});
  const rt=$('#mpRoute'); if(rt) rt.onchange=()=>{ui.mapRoute=rt.checked;renderMap();};
  $('#mapSide').querySelectorAll('[data-placing]').forEach(b=>b.onclick=e=>{e.stopPropagation();ui.placing=b.dataset.placing;renderMap();});
  $('#mapSide').querySelectorAll('.pl-item').forEach(el=>el.onclick=()=>{mapState.focusPlace=el.dataset.pl; select('place',el.dataset.pl);});
  $('#mapBanner').innerHTML=placingPl?`<div class="banner">📍 Klicka på kartan där <b>${esc(placingPl.name)}</b> ligger <button class="btn sm" id="cancelPlace">Avbryt</button></div>`:'';
  if(placingPl) $('#cancelPlace').onclick=e=>{e.stopPropagation();ui.placing=null;renderMap();};
  $('#mapSvg').style.cursor=placingPl?'crosshair':'grab';
  if(!mapState.world) return;
  const svg=d3.select('#mapSvg'); const W=$('#mapSvg').clientWidth,H=$('#mapSvg').clientHeight;
  if(!mapState.drawn){
    mapState.drawn=true;
    const pts=withC.map(pl=>[pl.lon,pl.lat]);
    let bb; if(pts.length){const mLo=d3.median(pts,p=>p[0]),mLa=d3.median(pts,p=>p[1]); const core=pts.filter(p=>Math.abs(p[0]-mLo)<22&&Math.abs(p[1]-mLa)<13); const use=core.length?core:pts; const lo=d3.extent(use,p=>p[0]),la=d3.extent(use,p=>p[1]); const pad=Math.max(1.2,(lo[1]-lo[0])*.12); bb=[[lo[0]-pad,la[0]-pad*.6],[lo[1]+pad,la[1]+pad*.6]];} else bb=[[4,54.5],[31,69.5]];
    const sideW=window.innerWidth>900?300:20;
    mapState.proj=d3.geoMercator().fitExtent([[sideW,30],[W-30,H-30]],{type:'MultiPoint',coordinates:[bb[0],bb[1],[bb[0][0],bb[1][1]],[bb[1][0],bb[0][1]]]});
    const path=d3.geoPath(mapState.proj);
    svg.select('g.lands').selectAll('path').data(mapState.world).join('path').attr('class',d=>'land'+(['752','578','246','208'].includes(d.id)?' home':'')).attr('d',path);
    svg.call(mapState.zoom.transform,d3.zoomIdentity); mapState.k=1;
  }
  const proj=mapState.proj,k=mapState.k;
  // route
  const rg=svg.select('g.routes'); rg.selectAll('*').remove();
  if(ui.mapRoute&&ui.sel&&ui.sel.type==='person'){
    const seq=lifeEvents(P(ui.sel.id)).map(e=>S.places[e.placeId]).filter(pl=>pl&&pl.lat!=null);
    const pts=[]; for(const pl of seq){ if(!pts.length||pts[pts.length-1].id!==pl.id) pts.push(pl); }
    for(let i=1;i<pts.length;i++){const a=proj([pts[i-1].lon,pts[i-1].lat]),b=proj([pts[i].lon,pts[i].lat]); const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[0]-a[0],dy=b[1]-a[1]; const cx=mx-dy*.18,cy=my+dx*.18;
      rg.append('path').attr('class','route').attr('d',`M${a[0]},${a[1]}Q${cx},${cy} ${b[0]},${b[1]}`).attr('marker-end','url(#arr)');}
  }
  const selPl=ui.sel&&ui.sel.type==='place'?ui.sel.id:null;
  const routeSet=new Set(ui.sel&&ui.sel.type==='person'?lifeEvents(P(ui.sel.id)).map(e=>e.placeId):[]);
  const mk=svg.select('g.mks').selectAll('g.mk').data(withC,d=>d.id).join(enter=>{const g=enter.append('g').attr('class','mk'); g.append('circle'); g.append('text'); return g;});
  mk.each(function(pl){const [px,py]=proj([pl.lon,pl.lat]); this.dataset.t=`translate(${px},${py})`;})
    .attr('transform',function(){return this.dataset.t+` scale(${1/k})`;})
    .classed('sel',pl=>pl.id===selPl||routeSet.has(pl.id))
    .on('click',(e,pl)=>{e.stopPropagation(); if(ui.placing) return; select('place',pl.id);});
  mk.select('circle').attr('r',pl=>4+Math.sqrt(st[pl.id]?.n||1)*2.6);
  mk.select('text').attr('x',pl=>7+Math.sqrt(st[pl.id]?.n||1)*2.6).attr('y',4).text(pl=>pl.name);
  // centre on a requested place
  if(mapState.focusPlace){const pl=S.places[mapState.focusPlace]; mapState.focusPlace=null; if(pl&&pl.lat!=null){const [px,py]=proj([pl.lon,pl.lat]); const kk=Math.max(k,3); svg.transition().duration(600).call(mapState.zoom.transform,d3.zoomIdentity.translate(W/2+130-kk*px,H/2-kk*py).scale(kk));}}
}

/* ============ IMPORT / EXPORT ============ */
const FIELDS=[
  ['ref','Id / referens',['id','ref','nr','nummer','löpnr','person-id','personid']],
  ['given','Förnamn',['förnamn','fornamn','first name','firstname','given']],
  ['callName','Tilltalsnamn',['tilltalsnamn','tilltal','call name','callname','known as']],
  ['surname','Efternamn',['efternamn','släktnamn','slaktnamn','surname','last name','lastname']],
  ['fullname','Hela namnet',['namn','name','fullständigt namn','fullname','person']],
  ['sex','Kön',['kön','kon','sex','gender']],
  ['birthPlace','Födelseort',['födelseort','född plats','födelseplats','födelseförsamling','birthplace','birth place','född i','fodelseort']],
  ['birthDate','Född (datum)',['född','fodd','födelsedatum','födelseår','birth','born','birth date','fodelsedatum']],
  ['deathPlace','Dödsort',['dödsort','död plats','dödsplats','dödsförsamling','death place','dodsort']],
  ['deathDate','Död (datum)',['död','dod','dödsdatum','dödsår','death','died','death date','dodsdatum']],
  ['occupation','Yrke',['yrke','titel','occupation','title']],
  ['father','Far',['far','fader','father','pappa','far id','far (id)']],
  ['mother','Mor',['mor','moder','mother','mamma','mor id','mor (id)']],
  ['spouse','Make/maka',['make','maka','make/maka','partner','gift med','spouse']],
  ['notes','Anteckningar',['anteckningar','anteckning','notering','noter','kommentar','kommentarer','notes','övrigt']],
  ['source','Källa',['källa','kalla','källor','source','sources']],
];
const imp={headers:[],rows:[],map:{},sheets:null,wb:null,skipDup:true,createMissing:true,hasHeader:true};
function renderImport(){
  const v=$('#view');
  v.innerHTML=`<div class="view-pad"><div class="toolbar"><h2>Import &amp; export</h2></div>
    ${E.canEdit?`<div class="box"><h3>1. Läs in din släktlista</h3>
      <p>Välj en Excel-fil (.xlsx, .xls) eller CSV – eller kopiera cellerna i Excel och klistra in dem nedan. En rad per person. Föräldrar kan anges med namn eller med personens id-nummer i listan.</p>
      <div class="drop" id="drop"><b>Släpp filen här</b> eller klicka för att välja<input type="file" id="impFile" accept=".xlsx,.xls,.csv,.tsv,.txt,.ods" hidden></div>
      <details style="margin-top:12px"><summary style="cursor:pointer;color:var(--accent)">…eller klistra in från Excel</summary>
        <textarea class="t" id="impPaste" style="margin-top:8px;min-height:120px;font-family:ui-monospace,monospace;font-size:12px" placeholder="Förnamn&#9;Efternamn&#9;Född&#9;Födelseort&#9;Far&#9;Mor"></textarea>
        <button class="btn sm" id="impPasteBtn" style="margin-top:6px">Läs in inklistrat</button></details>
      <div style="margin-top:12px" class="small muted">Osäker på formatet? <a href="#" id="tplDl">Ladda ner en mall</a> med rätt kolumner.</div>
    </div>
    <div id="impStep2"></div>`:''}
    <div class="box"><h3>Exportera &amp; säkerhetskopiera</h3>
      <p>Spara en kopia av hela arkivet. GEDCOM är standardformatet som MyHeritage, Ancestry, Geni, Disgen och de flesta släktprogram kan läsa.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-exp="json">Säkerhetskopia (.json)</button>
        <button class="btn" data-exp="ged">GEDCOM</button>
        <button class="btn" data-exp="csv">Personlista (.csv för Excel)</button>
      </div><div id="expOut"></div></div>
    ${Store.isAdmin?`<div class="box"><h3>Återställ från säkerhetskopia</h3><p>Läs in en .json-fil som du tidigare exporterat härifrån. Befintliga poster med samma id skrivs över, övriga behålls.</p>
      <label class="btn" style="cursor:pointer">Välj säkerhetskopia<input type="file" id="restore" accept=".json" hidden></label></div>
    <div class="box"><h3>Övrigt</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${Object.keys(S.persons).length?'':'<button class="btn" onclick="loadDemo()">Ladda Vasaätten som exempel</button>'}<button class="btn danger" id="wipe">Töm hela arkivet…</button></div>
      <p class="small muted" style="margin-top:10px">${Store.mode==='db'?'Ditt arkiv sparas i molnet och syns bara för dig tills du väljer att dela sidan. Delar du den kan andra läsa, men bara du och de du gör till redigerare kan ändra.':'Sidan körs utanför claude.ai, så allt sparas bara i den här webbläsaren. Exportera regelbundet!'}</p></div>`:''}
  </div>`;
  v.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>doExport(b.dataset.exp));
  if(!E.canEdit) return;
  const drop=$('#drop'),fi=$('#impFile');
  drop.onclick=()=>fi.click();
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('over');};
  drop.ondragleave=()=>drop.classList.remove('over');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over'); if(e.dataTransfer.files[0]) readImportFile(e.dataTransfer.files[0]);};
  fi.onchange=()=>fi.files[0]&&readImportFile(fi.files[0]);
  $('#impPasteBtn').onclick=()=>{const t=$('#impPaste').value; if(!t.trim()) return; setImportRows(parseDelimited(t));};
  $('#tplDl').onclick=e=>{e.preventDefault(); saveFile('klansagan-import-template.csv','\ufeff'+['Id;Förnamn;Efternamn;Kön;Född;Födelseort;Död;Dödsort;Yrke;Far;Mor;Make/maka;Källa;Anteckningar','1;Erik;Larsson;M;1798-03-02;Rättvik;1861-11-20;Rättvik;Bonde;;;2;Rättvik C:9;','2;Kerstin;Olsdotter;K;1801;Leksand;1870;Rättvik;;;;1;;','3;Lars;Ersson;M;1826-05-14;Rättvik;1889;Rättvik;Bonde;1;2;;Rättvik AI:15 sid 45;'].join('\r\n'));};
  if($('#restore')) $('#restore').onchange=e=>{const f=e.target.files[0]; if(!f) return; f.text().then(t=>{let o; try{o=JSON.parse(t);}catch(x){toast('Filen är inte giltig JSON');return;} const objs=[...Object.values(o.persons||{}),...Object.values(o.places||{}),...Object.values(o.sources||{}),...Object.values(o.views||{})].filter(x=>x&&x.id&&KIND[x.kind]); if(!objs.length){toast('Hittade inga poster i filen');return;} confirmBox('Återställ '+objs.length+' poster?','Poster med samma id ersätts av versionen i filen.','Återställ',()=>Store.putMany(objs).then(()=>toast('Återställt ✓')));});};
  if($('#wipe')) $('#wipe').onclick=()=>modal(`<h3>Töm hela arkivet?</h3><p>Alla ${Object.keys(ALL.persons).length} personer, ${Object.keys(S.sources).length} källor och ${Object.keys(S.places).length} platser tas bort. Exportera en säkerhetskopia först! Skriv <b>TÖM</b> för att bekräfta.</p><input class="t" id="wipeIn"><div class="foot" style="margin-top:12px"><button class="btn" data-x>Avbryt</button><button class="btn primary" style="background:var(--err);border-color:var(--err)" data-ok>Töm arkivet</button></div>`,(ov,close)=>{ov.querySelector('[data-x]').onclick=close; ov.querySelector('[data-ok]').onclick=async()=>{if(ov.querySelector('#wipeIn').value.trim().toUpperCase()!=='TÖM')return; close(); ui.sel=null; ui.focus=null; const all=[...Object.values(ALL.persons),...Object.values(ALL.places),...Object.values(ALL.sources),...Object.values(ALL.views)]; for(const o of all) Store.del(o.kind,o.id,{silent:true}); renderAll(); toast('Arkivet är tömt');};});
  if(imp.rows.length) renderImportStep2();
}
function loadXLSX(){return new Promise((res,rej)=>{if(window.XLSX) return res(); const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=()=>rej(new Error('Kunde inte ladda Excel-läsaren')); document.head.appendChild(s);});}
async function readImportFile(file){
  try{
    if(/\.(csv|tsv|txt)$/i.test(file.name)){ setImportRows(parseDelimited(await file.text())); return; }
    await loadXLSX();
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    imp.wb=wb; imp.sheets=wb.SheetNames;
    useSheet(wb.SheetNames[0]);
  }catch(e){toast('Kunde inte läsa filen: '+(e.message||e));}
}
function useSheet(name){
  const ws=imp.wb.Sheets[name];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  const cell=c=>{ if(c instanceof Date&&!isNaN(c)){const d=new Date(c.getTime()+12*3600e3); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');} return String(c??'').trim(); };
  imp.sheet=name; setImportRows(rows.map(r=>r.map(cell)));
}
function setImportRows(rows){
  rows=rows.filter(r=>r.some(c=>c));
  if(!rows.length){toast('Hittade inga rader');return;}
  imp.raw=rows; imp.hasHeader=true; applyHeader();
  renderImportStep2();
  $('#impStep2').scrollIntoView({behavior:'smooth',block:'start'});
}
function applyHeader(){
  const rows=imp.raw; const n=Math.max(...rows.map(r=>r.length));
  imp.headers=imp.hasHeader?Array.from({length:n},(_,i)=>rows[0][i]||('Kolumn '+(i+1))):Array.from({length:n},(_,i)=>'Kolumn '+String.fromCharCode(65+i));
  imp.rows=imp.hasHeader?rows.slice(1):rows;
  imp.map={}; const used=new Set(); const H=imp.headers.map(norm);
  for(const [k,,syn] of FIELDS){const i=H.findIndex((h,ix)=>!used.has(ix)&&syn.includes(h)); if(i>=0){imp.map[k]=i;used.add(i);}}
  for(const [k,,syn] of FIELDS){ if(imp.map[k]!=null) continue; const i=H.findIndex((h,ix)=>!used.has(ix)&&syn.some(s=>s.length>2&&h.startsWith(s))); if(i>=0){imp.map[k]=i;used.add(i);}}
}
function renderImportStep2(){
  const el=$('#impStep2'); if(!el) return;
  const opt=k=>`<select data-map="${k}"><option value="">— ingen —</option>${imp.headers.map((h,i)=>`<option value="${i}" ${imp.map[k]===i?'selected':''}>${esc(h)}</option>`).join('')}</select>`;
  const prev=imp.rows.slice(0,6).map(mapRow);
  el.innerHTML=`<div class="box"><h3>2. Koppla kolumnerna</h3>
    <p>Jag har gissat vilka kolumner som hör ihop med vad – kontrollera och ändra vid behov. ${imp.rows.length} rader hittades${imp.sheets&&imp.sheets.length>1?` i bladet <select id="impSheet">${imp.sheets.map(s=>`<option ${s===imp.sheet?'selected':''}>${esc(s)}</option>`).join('')}</select>`:''}.</p>
    <label class="check"><input type="checkbox" id="impHdr" ${imp.hasHeader?'checked':''}> Första raden är rubriker</label>
    <div class="mapgrid" style="margin-top:10px">${FIELDS.map(([k,l])=>`<label>${l}${opt(k)}</label>`).join('')}</div>
    <div class="prev"><table class="list"><thead><tr><th>Namn</th><th>Kön</th><th>Född</th><th>Död</th><th>Far</th><th>Mor</th><th>Make/maka</th></tr></thead><tbody>
      ${prev.map(r=>`<tr><td><b>${esc([r.given,r.surname].filter(Boolean).join(' ')||'—')}</b></td><td>${r.sex||''}</td><td>${esc(r.birthDate)} <span class="muted">${esc(r.birthPlace)}</span></td><td>${esc(r.deathDate)} <span class="muted">${esc(r.deathPlace)}</span></td><td>${esc(r.father)}</td><td>${esc(r.mother)}</td><td>${esc(r.spouse)}</td></tr>`).join('')}</tbody></table></div>
    <h3 style="margin-top:18px">3. Importera</h3>
    <label class="check"><input type="checkbox" id="impDup" ${imp.skipDup?'checked':''}> Hoppa över personer som redan finns (samma namn och födelseår)</label>
    <label class="check"><input type="checkbox" id="impMiss" ${imp.createMissing?'checked':''}> Skapa föräldrar och partners som bara nämns vid namn</label>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" id="impGo">Importera ${imp.rows.length} personer</button><button class="btn" id="impCancel">Avbryt</button></div>
    <div id="impProg"></div></div>`;
  el.querySelectorAll('[data-map]').forEach(s=>s.onchange=()=>{imp.map[s.dataset.map]=s.value===''?null:+s.value; renderImportStep2();});
  $('#impHdr').onchange=e=>{imp.hasHeader=e.target.checked; applyHeader(); renderImportStep2();};
  const sh=$('#impSheet'); if(sh) sh.onchange=()=>useSheet(sh.value);
  $('#impDup').onchange=e=>imp.skipDup=e.target.checked;
  $('#impMiss').onchange=e=>imp.createMissing=e.target.checked;
  $('#impCancel').onclick=()=>{imp.rows=[];imp.raw=null;el.innerHTML='';};
  $('#impGo').onclick=runImport;
}
function mapRow(r){
  const g=k=>imp.map[k]!=null?String(r[imp.map[k]]??'').trim():'';
  const o={ref:g('ref'),given:g('given'),callName:g('callName'),surname:g('surname'),sex:'',birthDate:g('birthDate'),birthPlace:g('birthPlace'),deathDate:g('deathDate'),deathPlace:g('deathPlace'),occupation:g('occupation'),father:g('father'),mother:g('mother'),spouse:g('spouse'),notes:g('notes'),source:g('source')};
  const fn=g('fullname'); if(fn&&!o.given&&!o.surname){const parts=fn.split(/\s+/); o.surname=parts.length>1?parts.pop():''; o.given=parts.join(' ');}
  const sx=norm(g('sex')); o.sex=/^(m|man|male|pojke|herr)$/.test(sx)?'M':/^(k|kvinna|f|female|flicka|fru|kv)$/.test(sx)?'K':'';
  if(!o.sex){ if(/(dotter|dtr)$/i.test(o.surname)) o.sex='K'; else if(/son$/i.test(o.surname)) o.sex='M'; }
  return o;
}
async function runImport(){
  if(Store.demo) exitDemo(true);
  const rows=imp.rows.map(mapRow).filter(r=>r.given||r.surname);
  const created=[],newPlaces={},newSources={};
  const byRef={},byName={};
  const existing=Object.values(ALL.persons);
  const key=(n,y)=>norm(n)+'|'+(y||'');
  const addName=(p)=>{const n=norm(fullName(p)); (byName[n]=byName[n]||[]).push(p);};
  existing.forEach(addName);
  const place=name=>{const r=ensurePlace(name); if(r.created) newPlaces[r.id]=r.created; return r.id;};
  let skipped=0;
  const now=new Date().toISOString();
  for(const r of rows){
    if(imp.skipDup){const ex=existing.find(p=>key(fullName(p),yearOf(p.birthDate))===key([r.given,r.surname].filter(Boolean).join(' '),yearOf(r.birthDate))); if(ex){skipped++; if(r.ref) byRef[norm(r.ref)]=ex; continue;}}
    let given=r.given||'', call=r.callName||''; if(given.includes('*')){const w=given.split(/\s+/).find(x=>x.includes('*')); if(w&&!call) call=w.replace(/\*/g,''); given=given.replace(/\*/g,'');}
    const p={kind:'person',id:uid('p'),given,callName:call,surname:r.surname,sex:r.sex,birthDate:r.birthDate,birthPlace:place(r.birthPlace),deathDate:r.deathDate,deathPlace:place(r.deathPlace),occupation:r.occupation,notes:r.notes,events:[],citations:[],media:[],spouseIds:[],createdAt:now,_r:r};
    if(r.source){const sk=norm(r.source); let s=Object.values(S.sources).find(x=>norm(x.title)===sk)||newSources[sk]; if(!s){s={kind:'source',id:uid('s'),title:r.source,type:'Övrigt',createdAt:now}; newSources[sk]=s;} p.citations.push({id:uid('c'),sourceId:s.id,about:'',detail:''});}
    created.push(p); if(r.ref) byRef[norm(r.ref)]=p; addName(p);
  }
  let linked=0,made=0,unres=[];
  const resolve=(val,sex)=>{
    if(!val) return null; const n=norm(val);
    if(byRef[n]) return byRef[n];
    const m=byName[n]; if(m&&m.length) return m.length===1?m[0]:(m.find(x=>!sex||x.sex===sex)||m[0]);
    if(/^\d+$/.test(n)){unres.push(val); return null;}
    if(!imp.createMissing){unres.push(val); return null;}
    const parts=val.trim().split(/\s+/); const sn=parts.length>1?parts.pop():'';
    const np={kind:'person',id:uid('p'),given:parts.join(' '),surname:sn,sex:sex||'',events:[],citations:[],media:[],spouseIds:[],createdAt:now};
    created.push(np); addName(np); made++; return np;
  };
  const touched=new Map();
  for(const p of created.slice()){
    const r=p._r; if(!r) continue;
    const f=resolve(r.father,'M'),m=resolve(r.mother,'K');
    if(f){p.fatherId=f.id; if(!f.sex) f.sex='M'; linked++; if(!created.includes(f)) touched.set(f.id,f);}
    if(m){p.motherId=m.id; if(!m.sex) m.sex='K'; linked++; if(!created.includes(m)) touched.set(m.id,m);}
    if(f&&m){ for(const [a,b] of [[f,m],[m,f]]){ const x=created.includes(a)?a:(touched.get(a.id)||clone(a)); x.spouseIds=[...new Set([...(x.spouseIds||[]),b.id])]; if(!created.includes(a)) touched.set(a.id,x);} }
    if(r.spouse){ for(const sv of r.spouse.split(/[,;&]| och /).map(s=>s.trim()).filter(Boolean)){ const s=resolve(sv,p.sex==='M'?'K':p.sex==='K'?'M':''); if(s){ p.spouseIds=[...new Set([...(p.spouseIds||[]),s.id])]; const x=created.includes(s)?s:(touched.get(s.id)||clone(s)); x.spouseIds=[...new Set([...(x.spouseIds||[]),p.id])]; if(!created.includes(s)) touched.set(s.id,x); linked++; } } }
  }
  // fix references to existing persons that were cloned before being touched again
  created.forEach(p=>delete p._r);
  const objs=[...Object.values(newPlaces),...Object.values(newSources),...created,...touched.values()];
  if(!created.length){toast(skipped?'Alla '+skipped+' personer fanns redan':'Inga personer att importera');return;}
  $('#impGo').disabled=true;
  const prog=$('#impProg'); prog.innerHTML=`<div class="progress"><i></i></div>`;
  await Store.putMany(objs,f=>{const b=prog.querySelector('i'); if(b) b.style.width=Math.round(f*100)+'%';});
  if(!ui.focus||!P(ui.focus)){const oldest=created.filter(p=>p.birthDate).sort((a,b)=>dateKey(b.birthDate)-dateKey(a.birthDate))[0]; if(oldest) setFocus(oldest.id);}
  imp.rows=[]; imp.raw=null;
  modal(`<h3>Importen är klar</h3><p style="line-height:1.6">✓ <b>${created.length-made}</b> personer importerade${made?`<br>✓ <b>${made}</b> föräldrar/partners skapade från namn`:''}<br>✓ <b>${linked}</b> familjekopplingar${Object.keys(newPlaces).length?`<br>✓ <b>${Object.keys(newPlaces).length}</b> nya platser – placera dem på kartan när du vill`:''}${skipped?`<br>– ${skipped} fanns redan och hoppades över`:''}${unres.length?`<br><span style="color:var(--warn)">⚠ ${unres.length} hänvisningar kunde inte kopplas: ${esc([...new Set(unres)].slice(0,8).join(', '))}${unres.length>8?'…':''}</span>`:''}</p>
    <div class="foot"><a class="btn" href="#karta" data-x>Till kartan</a><a class="btn primary" href="#trad" data-x>Visa släktträdet</a></div>`,(ov,close)=>ov.querySelectorAll('[data-x]').forEach(b=>b.addEventListener('click',close)));
}
async function saveFile(name,data){
  if(E.downloads){ try{await E.downloads.save({filename:name,data}); return;}catch(e){ if(e&&e.code==='declined') return; if(e&&e.code!=='unavailable'&&e.code!=='not_granted'){toast('Kunde inte spara: '+(e.message||e.code)); } } }
  try{const blob=data instanceof Blob?data:new Blob([data],{type:'application/octet-stream'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);}
  catch(e){toast('Kunde inte spara filen: '+(e.message||e));}
}
function doExport(kind){ return withAll(()=>doExport0(kind)); }
async function doExport0(kind){
  const stamp=new Date().toISOString().slice(0,10);
  if(kind==='json'){ const inl=async col=>{const o=clone(ALL[col]); for(const d of Object.values(o)) for(const m of d.media||[]) if(blobId(m)) m.url=await blobUrl(m); return o;};
    const [persons,places,sources]=await Promise.all([inl('persons'),inl('places'),inl('sources')]);
    saveFile(`klansagan-${stamp}.json`,JSON.stringify({app:'Klansagan',version:1,exported:new Date().toISOString(),persons,places,sources,views:ALL.views},null,1)); }
  if(kind==='csv'){
    const ids={}; Object.values(S.persons).forEach((p,i)=>ids[p.id]=i+1);
    const c=v=>{v=String(v??''); return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    const lines=['Id;Förnamn;Efternamn;Kön;Född;Födelseort;Död;Dödsort;Yrke;Far;Mor;Make/maka;Källa;Anteckningar'];
    for(const p of Object.values(S.persons)) lines.push([ids[p.id],p.given,p.surname,p.sex,p.birthDate,placeName(p.birthPlace),p.deathDate,placeName(p.deathPlace),p.occupation,ids[p.fatherId]||'',ids[p.motherId]||'',(p.spouseIds||[]).map(x=>ids[x]).filter(Boolean).join(','),(p.citations||[]).map(x=>S.sources[x.sourceId]?.title).filter(Boolean).join(' | '),p.notes].map(c).join(';'));
    saveFile(`klansagan-people-${stamp}.csv`,'\ufeff'+lines.join('\r\n'));
  }
  if(kind==='ged'){ saveFile(`klansagan-${stamp}.ged.txt`,toGedcom()); toast('Ta bort ”.txt” i filnamnet innan du läser in den i ett släktprogram.',5000); }
}
function toGedcom(){
  const L=[]; const add=(lvl,tag,val)=>{val=val==null?'':String(val).replace(/\r?\n/g,' '); L.push(lvl+' '+tag+(val?' '+val:''));};
  const note=(lvl,txt)=>{const lines=String(txt).split(/\r?\n/); add(lvl,'NOTE',lines[0]); lines.slice(1).forEach(l=>add(lvl+1,'CONT',l));};
  const iid={},sid={}; let n=1; Object.values(S.persons).forEach(p=>iid[p.id]='@I'+(n++)+'@'); n=1; Object.values(S.sources).forEach(s=>sid[s.id]='@S'+(n++)+'@');
  const fams={}; const famKey=(a,b)=>[a||'',b||''].join('+');
  const getFam=(h,w)=>{const k=famKey(h,w); return fams[k]=fams[k]||{id:'@F'+(Object.keys(fams).length+1)+'@',h,w,c:[]};};
  for(const p of Object.values(S.persons)){ if(p.fatherId||p.motherId) getFam(P(p.fatherId)?p.fatherId:'',P(p.motherId)?p.motherId:'').c.push(p.id); }
  for(const p of Object.values(S.persons)) for(const s of partners(p)){ const [h,w]=p.sex==='K'?[s.id,p.id]:[p.id,s.id]; if(!fams[famKey(h,w)]&&!fams[famKey(w,h)]) getFam(h,w); }
  add(0,'HEAD'); add(1,'SOUR','KLANSAGAN'); add(2,'NAME','Klansagan'); add(1,'GEDC'); add(2,'VERS','5.5.1'); add(2,'FORM','LINEAGE-LINKED'); add(1,'CHAR','UTF-8'); add(1,'DATE',gedDate(new Date().toISOString().slice(0,10)));
  const TAG={Dop:'BAPM',Konfirmation:'CONF',Begravning:'BURI',Utvandring:'EMIG',Invandring:'IMMI',Bosatt:'RESI',Yrke:'OCCU',Bouppteckning:'PROB',Militärtjänst:'_MILT'};
  const cites=(p,lvl,about)=>{for(const c of (p.citations||[]).filter(c=>c.about===about)) if(sid[c.sourceId]){add(lvl,'SOUR',sid[c.sourceId]); if(c.detail) add(lvl+1,'PAGE',c.detail);}};
  for(const p of Object.values(S.persons)){
    add(0,iid[p.id],'INDI'); add(1,'NAME',`${p.given||''} /${p.surname||''}/`.trim()); if(p.given) add(2,'GIVN',p.given); if(p.surname) add(2,'SURN',p.surname);
    if(p.sex) add(1,'SEX',p.sex==='K'?'F':'M');
    if(p.birthDate||p.birthPlace){add(1,'BIRT'); if(p.birthDate) add(2,'DATE',gedDate(p.birthDate)); if(p.birthPlace) add(2,'PLAC',placeName(p.birthPlace)); cites(p,2,'Födelse');}
    if(p.deathDate||p.deathPlace){add(1,'DEAT'); if(p.deathDate) add(2,'DATE',gedDate(p.deathDate)); if(p.deathPlace) add(2,'PLAC',placeName(p.deathPlace)); cites(p,2,'Död');}
    if(p.occupation) add(1,'OCCU',p.occupation);
    for(const e of p.events||[]){ const t=TAG[e.type]; if(t&&!t.startsWith('_')){add(1,t,t==='OCCU'?e.desc:'');} else {add(1,'EVEN',e.desc||''); add(2,'TYPE',e.type);} if(e.date) add(2,'DATE',gedDate(e.date)); if(e.placeId) add(2,'PLAC',placeName(e.placeId)); if(e.desc&&t&&t!=='OCCU') note(2,e.desc); cites(p,2,'event:'+e.id); }
    cites(p,1,''); for(const a of ['Föräldrar','Namn','Yrke']) cites(p,1,a);
    if(p.notes) note(1,p.notes);
    for(const f of Object.values(fams)){ if(f.c.includes(p.id)) add(1,'FAMC',f.id); if(f.h===p.id||f.w===p.id) add(1,'FAMS',f.id); }
  }
  for(const f of Object.values(fams)){ add(0,f.id,'FAM'); if(f.h) add(1,'HUSB',iid[f.h]); if(f.w) add(1,'WIFE',iid[f.w]); f.c.forEach(c=>add(1,'CHIL',iid[c]));
    const h=P(f.h); const mar=h&&(h.events||[]).find(e=>e.type==='Vigsel'&&e.withId===f.w); if(mar){add(1,'MARR'); if(mar.date) add(2,'DATE',gedDate(mar.date)); if(mar.placeId) add(2,'PLAC',placeName(mar.placeId));} }
  for(const s of Object.values(S.sources)){ add(0,sid[s.id],'SOUR'); add(1,'TITL',s.title); if(s.archive) add(1,'REPO',s.archive); if(s.ref) add(1,'PUBL',s.ref); if(s.url) add(1,'WWW',s.url); if(s.notes) note(1,s.notes); }
  add(0,'TRLR'); return L.join('\r\n');
}

/* ============ Theme ============ */
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function currentTheme(){return document.documentElement.dataset.theme==='dark'?'dark':'light';}
const themeName=()=>document.documentElement.dataset.theme||'wood';
function applySize(lg){document.documentElement.dataset.size=lg?'lg':''; try{localStorage.setItem('sa-size',lg?'lg':'');}catch(e){} const b=$('#sizeBtn'); if(b){b.classList.toggle('on',!!lg); b.title=lg?'Mindre text':'Större text';}}
function applyTheme(t){
  document.documentElement.dataset.theme=t;
  const b=$('#themeBtn'); if(b) b.innerHTML=t==='dark'
    ?'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>'
    :'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';
}
(function(){let t=null; try{t=localStorage.getItem('sa-tema');}catch(e){} applyTheme(['wood','light','dark'].includes(t)?t:'wood');})();
try{applySize(localStorage.getItem('sa-size')==='lg');}catch(e){}
/* Simple mode ("farmorsläge"): big text, only Start, Träd and Personer. ?enkelt turns it on. */
function applySimple(on,save=true){ui.simple=!!on; document.body.classList.toggle('simple',ui.simple); if(save) try{localStorage.setItem('sa-enkelt',on?'1':'');}catch(e){}
}
try{const q=new URLSearchParams(location.search); if(q.has('enkelt')){applySimple(true,false); document.documentElement.dataset.size='lg';} else applySimple(localStorage.getItem('sa-enkelt')==='1',false);}catch(e){}
{const b=$('#simpleExit'); if(b) b.onclick=()=>{applySimple(false); ui.treeKey=null; renderAll(true); toast('Alla funktioner visas igen. Enkelt läge hittar du under Inställningar.',4500);};}
{const b=$('#settingsBtn'); if(b) b.onclick=settingsModal;}
{const mb=$('#moreBtn'), mp=$('#morePop'); if(mb&&mp){mb.onclick=e=>{e.stopPropagation(); mp.classList.toggle('open'); const r=mb.getBoundingClientRect(); if(matchMedia('(max-width:700px)').matches){mp.style.left='';mp.style.top='';} else {mp.style.left=r.left+'px'; mp.style.top=(r.bottom+6)+'px';}}; document.addEventListener('click',()=>mp.classList.remove('open'));}}
function settingsModal(){
  const h=homePerson(), lg=document.documentElement.dataset.size==='lg';
  const opt=(name,val,cur,label,hint)=>`<label class="sopt"><input type="radio" name="${name}" value="${val}" ${val===cur?'checked':''}><span><b>${label}</b>${hint?`<small>${hint}</small>`:''}</span></label>`;
  modal(`<h3>Inställningar</h3>
    <div class="sgroup"><div class="slab">Vem är du?</div>
      <div class="row-inline">${personPicker('setMe',h?h.id:'','Skriv ditt namn')}<button class="btn" id="setMeOk">Det här är jag</button></div>
      <div class="hint">Startsidan, trädet och släktskap utgår från dig.</div></div>
    <div class="sgroup"><div class="slab">Namn</div>
      ${opt('nm','full',ui.nameMode,'Fullständigt namn','Lars Anders Godvig Englund')}
      ${opt('nm','call',ui.nameMode,'Bara tilltalsnamn','Lars Englund. Saknas tilltalsnamn visas första förnamnet.')}</div>
    <div class="sgroup"><div class="slab">Utseende</div>
      ${opt('th','wood',themeName(),'Trä','Varm träbrun – standard')}${opt('th','light',themeName(),'Ljust','')}${opt('th','dark',themeName(),'Mörkt','')}
      <label class="sopt"><input type="checkbox" id="setLg" ${lg?'checked':''}><span><b>Större text</b></span></label></div>
    ${PWA.can()?`<div class="sgroup"><div class="slab">App</div><button class="btn" id="setInstall">📲 Installera Klansagan som app</button><div class="hint">Lägger en ikon på hemskärmen eller i programmenyn. Appen öppnas i eget fönster och fungerar även utan internet.</div></div>`:''}
    <div class="sgroup"><div class="slab">Enkelt läge</div>
      <label class="sopt"><input type="checkbox" id="setSimple" ${ui.simple?'checked':''}><span><b>Visa bara det viktigaste</b><small>Stor text och bara Start, Träd och Personer. Bra för den som inte vill krångla – till exempel farmor. Länk som öppnar i enkelt läge: lägg till <code>?enkelt</code> i adressen.</small></span></label></div>
    ${allPersonsDatalist()}
    <div class="foot"><span class="muted small" style="margin-right:auto">Version ${APP_VERSION}</span><button class="btn primary" data-x>Klar</button></div>`,
  (ov,close)=>{
    const q=x=>ov.querySelector(x);
    q('[data-x]').onclick=close;
    q('#setMeOk').onclick=async()=>{const p=personByLabel(q('#setMe').value); if(!p){toast('Välj ditt namn i listan som kommer upp när du skriver.');return;} await setHome(p.id); setFocus(p.id); ui.treeKey=null; renderAll(true);};
    ov.querySelectorAll('[name=nm]').forEach(i=>i.onchange=()=>{ui.nameMode=i.value; try{localStorage.setItem('sa-names',i.value);}catch(e){} ui.treeKey=null; renderAll(true);});
    ov.querySelectorAll('[name=th]').forEach(i=>i.onchange=()=>{applyTheme(i.value); try{localStorage.setItem('sa-tema',i.value);}catch(e){} mapState.drawn=false; renderAll();});
    q('#setLg').onchange=e=>applySize(e.target.checked);
    {const ib=q('#setInstall'); if(ib) ib.onclick=()=>{close(); PWA.install();};}
    q('#setSimple').onchange=e=>{applySimple(e.target.checked); if(e.target.checked){applySize(true); q('#setLg').checked=true;} ui.treeKey=null; renderAll(true);};
  });
}

/* ============ Shared bits ============ */
const NUMW=['noll','ett','två','tre','fyra','fem','sex','sju','åtta','nio','tio','elva','tolv'];
const numw=n=>NUMW[n]||String(n);
function listJoin(a){return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' och '+a[a.length-1];}
function chipHTML(p,extra=''){const av=avatarUrl(p); return `<div class="pchip" data-card="${p.id}"><div class="avatar" style="border-color:${sexColor(p)}">${av?avImg(p):esc(initials(p))}</div><div class="t"><b>${esc(fullName(p))}</b><span>${esc(lifespan(p))}${extra?' · '+extra:''}</span></div></div>`;}
function bindChips(root,fn){root.querySelectorAll('[data-card]').forEach(el=>el.onclick=()=>fn(el.dataset.card));}
function openCard(id){ui.cardId=id; if(location.hash!=='#personkort') location.hash='personkort'; else renderAll(true);}
function personPicker(id,value,ph){return `<input class="t" id="${id}" list="dlAllP" value="${esc(value&&P(value)?personLabel(P(value)):'')}" placeholder="${ph}">`;}
function allPersonsDatalist(){return `<datalist id="dlAllP">${Object.values(S.persons).map(x=>`<option value="${esc(personLabel(x))}">`).join('')}</datalist>`;}

/* ============ START ============ */
function heroArt(){
  const arc=d3.arc(); const parts=[]; const cols=[cssv('--male'),'#5f8f7f','#b08a4a',cssv('--female')];
  for(let g=1;g<=5;g++){const n=2**g, span=Math.PI/n; for(let j=0;j<n;j++){const q=g===1?(j?3:0):Math.floor(j/(n/4)); const r0=34+(g-1)*30, r1=r0+29;
    parts.push(`<path d="${arc({innerRadius:r0,outerRadius:r1,startAngle:-Math.PI/2+j*span,endAngle:-Math.PI/2+(j+1)*span})}" fill="${cols[q]}" fill-opacity="${(0.9-g*0.13).toFixed(2)}" stroke="${cssv('--card')}" stroke-width="1.5"/>`);}}
  return `<svg viewBox="-200 -200 400 230" width="88%"><g>${parts.join('')}<circle r="30" fill="${cssv('--accent')}"/></g></svg>`;
}
function renderStart(){
  const v=$('#view'); const all=Object.values(S.persons);
  const ed=Store.canEdit;
  if(!all.length){
    v.innerHTML=`<div class="start"><div class="hero"><div>
      <h1>Välkommen till Klansagan</h1>
      <p>Här samlar du släkten på ett ställe: släktträd, bilder, källor, tidslinje och karta. Allt sparas automatiskt. Välj hur du vill börja.</p>
    </div><div class="hero-art">${heroArt()}</div></div>
    <div class="choices">
      ${ed?`<a class="choice primary" href="#import"><span class="ic">📄</span><b>Jag har en släktlista</b><span>Läs in en Excel- eller CSV-fil. Du ser allt innan något sparas.</span><span class="go">Läs in fil →</span></a>
      <button class="choice" onclick="openPersonModal()"><span class="ic">✏️</span><b>Börja med mig själv</b><span>Skriv in dig själv och lägg sedan till föräldrar, mor- och farföräldrar.</span><span class="go">Lägg till första personen →</span></button>`:''}
      <button class="choice" onclick="loadDemo()"><span class="ic">👑</span><b>Titta på ett exempel</b><span>Vasaätten, från Gustav Vasa till drottning Kristina. Exemplet sparas inte.</span><span class="go">Visa exemplet →</span></button>
    </div></div>`;
    return;
  }
  const home=homePerson()||P(ui.focus);
  const years=all.map(p=>yearOf(p.birthDate)).filter(Boolean);
  const anc=home?ancestorsOf(home.id).size:0;
  let maxGen=0; if(home){const walk=(id,d)=>{const p=P(id); if(!p) return; maxGen=Math.max(maxGen,d); walk(p.fatherId,d+1); walk(p.motherId,d+1);}; walk(home.id,0);}
  const nNoSrc=all.filter(p=>!(p.citations||[]).length).length;
  const nPl=Object.values(S.places).filter(pl=>pl.lat==null).length;
  const dups=findDups().length;
  const recent=all.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,8);
  const tiles=[
    ['#trad','🌳','Släktträd','Anor och ättlingar runt '+esc(home?shortName(home):'dig')],
    ['#solfjader','◠','Solfjäder',anc?`${anc} kända anor i ${maxGen} generationer`:'Anorna i en halvcirkel'],
    ['#personer','👥','Personer',`${all.length} personer${nNoSrc?` · ${nNoSrc} utan källa`:''}`],
    ['#slaktskap','🔗','Släktskap','Hur är två personer släkt med varandra?'],
    ['#tidslinje','📅','Tidslinje','Livslinjer mot historiska händelser'],
    ['#karta','🗺️','Karta',`${Object.keys(S.places).length} platser${nPl?` · ${nPl} saknar position`:''}`],
    ['#kallor','📜','Källor',`${Object.keys(S.sources).length} registrerade källor`],
    ['#dubbletter','🧩','Dubbletter',dups?`${dups} möjliga dubbletter att granska`:'Inga misstänkta dubbletter'],
    ['#import','⇅','Import & export','Excel, GEDCOM och säkerhetskopior'],
  ];
  v.innerHTML=`<div class="start"><div class="hero"><div>
      <h1>${home?'Släkten kring '+esc(fullName(home)):'Ditt släktarkiv'}</h1>
      <p>${all.length} personer${years.length?`, från ${Math.min(...years)} till ${Math.max(...years)}`:''}. ${home&&anc?`Du har hittat ${anc} anor till ${esc(shortName(home))}, ${maxGen} generationer bakåt.`:''}${home&&!anc&&descendantsOf(home.id).size?`${descendantsOf(home.id).size} ättlingar till ${esc(shortName(home))}.`:''}</p>
      <div class="acts"><button class="btn primary" onclick="goHome()">Öppna släktträdet</button>${home?`<button class="btn" onclick="openCard('${home.id}')">Personkort</button>`:''}${ed?'<button class="btn" onclick="openPersonModal()">+ Ny person</button>':''}<button class="btn" onclick="shareModal(activeView())">🔗 Dela med släkten</button>${demoActive()?'<button class="btn" onclick="exitDemo()">Stäng exemplet</button>':''}</div>
      <div class="hero-links">${demoActive()?'':'<a href="#" onclick="loadDemo();return false">👑 Titta på exemplet Vasaätten</a>'}${ui.simple?'<a href="#" onclick="applySimple(false);renderAll(true);return false">Visa alla funktioner</a>':'<a href="#" onclick="applySimple(true);applySize(true);renderAll(true);return false">Enkelt läge</a>'}<a href="#" onclick="settingsModal();return false">Inställningar</a>${PWA.can()?'<a href="#" onclick="PWA.install();return false">📲 Installera som app</a>':''}</div>
    </div><div class="hero-art">${heroArt()}</div></div>
    ${treesSection()}
    <div class="tiles">${tiles.map(([h,ic,t,d])=>`<a class="tile" href="${h}"><span class="ic">${ic}</span><b>${t}</b><span>${d}</span></a>`).join('')}</div>
    <h2 class="sec-t">Senast ändrade</h2>
    <div class="recent">${recent.map(p=>chipHTML(p,p.updatedBy&&Store.user?`av <span data-uid="${esc(p.updatedBy)}">…</span>`:'')).join('')}</div>
    ${activeView()?`<p class="small muted" style="margin-top:18px">Du tittar på vyn <b>${esc(activeView().name)}</b> – ${HIDDEN.size} personer är dolda. Byt vy uppe till höger.</p>`:''}</div>`;
  bindChips(v,openCard); fillNames(v); bindTrees(v);
}

/* ============ SEPARATE TREES ============ */
let _treesKey=null,_trees=null;
/** Groups of people not (yet) connected to each other, biggest first. */
function trees(){
  const ps0=Object.values(S.persons);
  const key=ps0.length+'|'+ps0.reduce((m,p)=>(p.updatedAt||'')>m?p.updatedAt:m,'')+'|'+(Store.demo?'d':'');
  if(key===_treesKey) return _trees;
  const home=homePerson();
  _trees=KinCore.components(S.persons).map((ids,i)=>{
    const ps=ids.map(P);
    const cnt={}; for(const p of ps){const sn=(p.surname||'').trim().split(/\s+/).pop(); if(sn) cnt[sn]=(cnt[sn]||0)+1;}
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
    const hasHome=!!(home&&ids.includes(home.id));
    let root=hasHome?home:null;
    if(!root){ if(ids.length<=400){let best=-1; for(const p of ps){const n=ancestorsOf(p.id).size+descendantsOf(p.id).size; if(n>best){best=n;root=p;}}} else root=ps[0]; }
    const ys=ps.map(p=>yearOf(p.birthDate)).filter(Boolean);
    return {i,ids,set:new Set(ids),size:ids.length,root,home:hasHome,
      name:top.length?'Släkten '+(top[1]&&cnt[top[1]]>=cnt[top[0]]/2?top[0]+' & '+top[1]:top[0]):fullName(root),
      span:ys.length?[Math.min(...ys),Math.max(...ys)]:null};
  });
  _treesKey=key; return _trees;
}
const treeOf=id=>trees().find(t=>t.set.has(id))||null;
function crossTreeDups(){return findDups().filter(d=>treeOf(d.a.id)!==treeOf(d.b.id));}
function treesSection(){
  const ts=trees(); if(ts.length<2) return '';
  const big=ts.filter(t=>t.size>1), lone=ts.filter(t=>t.size===1);
  const sugg=Store.canEdit?crossTreeDups().slice(0,4):[];
  const card=t=>`<div class="treecard${t.home?' mine':''}">
      <div class="tc-h"><b>${esc(t.name)}</b>${t.home?'<span class="tag">Din släkt</span>':''}</div>
      <div class="muted small">${t.size} personer${t.span?` · ${t.span[0]}–${t.span[1]}`:''}</div>
      <div class="small tc-names">${t.ids.slice(0,40).map(P).sort((a,b)=>(yearOf(a.birthDate)||9999)-(yearOf(b.birthDate)||9999)).slice(0,3).map(p=>esc(fullName(p))).join(', ')}${t.size>3?' …':''}</div>
      <div class="tc-acts"><button class="btn sm primary" data-topen="${t.root.id}">Visa trädet</button>${Store.canEdit?`<button class="btn sm" data-tlink="${t.root.id}">🔗 Koppla ihop</button>`:''}</div></div>`;
  return `<h2 class="sec-t">Dina släktträd <span class="muted" style="font-weight:400">· ${ts.length} st som inte hänger ihop än</span></h2>
    <p class="muted small" style="margin:-4px 0 12px;max-width:720px">Varje kort är en grupp personer som inte är kopplade till de andra. När du vet hur de är släkt klickar du på <b>Koppla ihop</b>, så blir de ett träd.</p>
    ${sugg.length?`<div class="box suggest"><h3>Kanske samma person?</h3><p>De här personerna finns i olika träd men liknar varandra. Är det samma person blir träden ett när du slår ihop dem.</p>
      ${sugg.map((d,i)=>`<div class="sg-row"><span><b>${esc(personLabel(d.a))}</b> <span class="muted small">i ${esc(treeOf(d.a.id).name)}</span><br><b>${esc(personLabel(d.b))}</b> <span class="muted small">i ${esc(treeOf(d.b.id).name)}</span></span><span class="sg-acts"><button class="btn sm primary" data-sgyes="${i}">Ja, samma person</button><button class="btn sm ghost" data-sgno="${i}">Nej</button></span></div>`).join('')}</div>`:''}
    <div class="treecards">${big.map(card).join('')}
    ${lone.length?`<div class="treecard"><div class="tc-h"><b>Ensamma personer</b></div><div class="muted small">${lone.length} personer utan kopplingar</div>
      <div class="lone">${lone.slice(0,12).map(t=>`<span class="lone-p"><a href="#" data-topen="${t.root.id}">${esc(fullName(t.root))}</a>${Store.canEdit?` <button class="iconbtn" title="Koppla ihop" data-tlink="${t.root.id}">🔗</button>`:''}</span>`).join('')}${lone.length>12?` <span class="muted small">+${lone.length-12} till</span>`:''}</div></div>`:''}</div>`;
}
function bindTrees(root){
  root.querySelectorAll('[data-topen]').forEach(b=>b.onclick=e=>{e.preventDefault(); setFocus(b.dataset.topen); ui.treeKey=null; if(location.hash!=='#trad') location.hash='trad'; else renderAll(true);});
  root.querySelectorAll('[data-tlink]').forEach(b=>b.onclick=()=>linkModal(b.dataset.tlink));
  const sugg=crossTreeDups().slice(0,4);
  root.querySelectorAll('[data-sgyes]').forEach(b=>b.onclick=()=>{const d=sugg[+b.dataset.sgyes]; const score=p=>Object.values(p).filter(Boolean).length+(p.citations||[]).length; const [k,x]=score(d.a)>=score(d.b)?[d.a,d.b]:[d.b,d.a];
    confirmBox(`Slå ihop till en person?`,`${fullName(k)} och ${fullName(x)} blir en och samma person. Uppgifter som saknas fylls i från den andra, och deras släktträd blir ett.`,'Slå ihop',()=>mergePersons(k.id,x.id));});
  root.querySelectorAll('[data-sgno]').forEach(b=>b.onclick=()=>{const d=sugg[+b.dataset.sgno]; const a=clone(d.a); a.notDup=[...new Set([...(a.notDup||[]),d.b.id])]; Store.put(a);});
}
const LINK_REL=[['parent','är förälder till'],['child','är barn till'],['partner','är gift eller sambo med'],['sibling','är syskon till'],['same','är samma person som']];
function linkModal(aId,bId){
  modal(`<h3>Koppla ihop två personer</h3>
    <p class="muted" style="margin-top:-4px;line-height:1.5">Välj två personer och hur de hör ihop. Ligger de i olika släktträd blir träden ett.</p>
    <label class="f"><span>Den här personen …</span>${personPicker('lkA',aId,'Skriv ett namn')}</label>
    <div class="relpick">${LINK_REL.map(([k,t],i)=>`<label class="rp"><input type="radio" name="lkR" value="${k}" ${i===0?'checked':''}><span>${t}</span></label>`).join('')}</div>
    <label class="f"><span>… den här personen</span>${personPicker('lkB',bId,'Skriv ett namn')}</label>
    <div class="lk-sum" id="lkSum"></div>
    ${allPersonsDatalist()}
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Koppla ihop</button></div>`,
  (ov,close)=>{
    const q=x=>ov.querySelector(x);
    const read=()=>({a:personByLabel(q('#lkA').value),b:personByLabel(q('#lkB').value),rel:(ov.querySelector('[name=lkR]:checked')||{}).value});
    const upd=()=>{const {a,b}=read(); const el=q('#lkSum');
      ov.querySelectorAll('.rp span').forEach((sp,i)=>{const k=LINK_REL[i][0]; sp.textContent=k==='parent'&&a&&a.sex?(a.sex==='M'?'är far till':'är mor till'):k==='child'&&a&&a.sex?(a.sex==='M'?'är son till':'är dotter till'):k==='sibling'&&a&&a.sex?(a.sex==='M'?'är bror till':'är syster till'):LINK_REL[i][1];});
      if(!a||!b){el.innerHTML='<span class="muted">Välj båda personerna i listorna som kommer upp när du skriver.</span>'; return;}
      const ta=treeOf(a.id),tb=treeOf(b.id); const lbl=ov.querySelector('[name=lkR]:checked+span').textContent;
      el.innerHTML=`<b>${esc(fullName(a))}</b> ${esc(lbl)} <b>${esc(fullName(b))}</b>.${ta&&tb&&ta!==tb?`<br><span class="ok-t">✓ ${esc(ta.name)} (${ta.size}) och ${esc(tb.name)} (${tb.size}) blir ett släktträd.</span>`:''}`;};
    ov.querySelectorAll('input').forEach(i=>{i.oninput=upd; i.onchange=upd;}); upd();
    (aId?q('#lkB'):q('#lkA')).focus();
    q('[data-x]').onclick=close;
    q('[data-ok]').onclick=()=>{const {a,b,rel}=read();
      if(!a||!b){toast('Välj båda personerna i listan.');return;}
      if(a.id===b.id){toast('Välj två olika personer.');return;}
      const ta=treeOf(a.id),tb=treeOf(b.id), joined=ta&&tb&&ta!==tb, total=joined?ta.size+tb.size:0;
      const done=()=>{ui.treeKey=null; setFocus(rel==='same'?a.id:b.id); toast(joined?`Klart! Två släktträd blev ett – ${total} personer.`:'Klart! Kopplingen är sparad.',4000); renderAll(true);};
      if(rel==='same'){close(); confirmBox('Slå ihop till en person?',`${fullName(a)} och ${fullName(b)} blir en och samma person. Uppgifter som saknas fylls i från den andra.`,'Slå ihop',async()=>{await mergePersons(a.id,b.id); done();}); return;}
      const err=linkPersons(a,rel,b); if(err){toast(err,6000);return;}
      close(); done();
    };
  });
}
/** Wire two existing people together. Returns an error message or ''. */
function linkPersons(a,rel,b){
  if(rel==='child') return linkPersons(b,'parent',a);
  const A=clone(a),B=clone(b);
  if(rel==='partner'){A.spouseIds=[...new Set([...(A.spouseIds||[]),B.id])]; B.spouseIds=[...new Set([...(B.spouseIds||[]),A.id])]; Store.put(A,{silent:true}); Store.put(B,{silent:true}); return '';}
  if(rel==='parent'){
    if(ancestorsOf(A.id).has(B.id)) return `${fullName(b)} står redan som ana till ${fullName(a)} – det kan inte vara tvärtom också.`;
    const slot=A.sex==='M'?'fatherId':A.sex==='K'?'motherId':(!B.fatherId?'fatherId':'motherId');
    if(B[slot]&&B[slot]!==A.id){const o=P(B[slot]); return `${fullName(b)} har redan ${slot==='fatherId'?'en far':'en mor'}${o?' ('+fullName(o)+')':''}. Är det samma person? Välj då ”är samma person som”.`;}
    B[slot]=A.id; if(!A.sex){A.sex=slot==='fatherId'?'M':'K'; Store.put(A,{silent:true});}
    const other=P(B[slot==='fatherId'?'motherId':'fatherId']);
    if(other&&!(A.spouseIds||[]).includes(other.id)){const a2=clone(P(A.id)||A); a2.sex=a2.sex||A.sex; a2.spouseIds=[...new Set([...(a2.spouseIds||[]),other.id])]; Store.put(a2,{silent:true}); const o2=clone(other); o2.spouseIds=[...new Set([...(o2.spouseIds||[]),A.id])]; Store.put(o2,{silent:true});}
    Store.put(B,{silent:true}); return '';
  }
  if(rel==='sibling'){
    if(!A.fatherId&&!A.motherId&&!B.fatherId&&!B.motherId) return `Syskon kopplas ihop via föräldrarna. Lägg först till far eller mor för ${fullName(a)} eller ${fullName(b)}.`;
    for(const k of ['fatherId','motherId']){ if(A[k]&&B[k]&&A[k]!==B[k]) return `${fullName(a)} och ${fullName(b)} har olika ${k==='fatherId'?'fäder':'mödrar'} inlagda. Halvsyskon kopplar du genom att ge dem samma ${k==='fatherId'?'mor':'far'}.`; }
    for(const k of ['fatherId','motherId']){ if(A[k]&&!B[k]) B[k]=A[k]; if(B[k]&&!A[k]) A[k]=B[k]; }
    Store.put(A,{silent:true}); Store.put(B,{silent:true}); return '';
  }
  return 'Okänd koppling';
}

/* ============ FAN CHART ============ */
let fanZoom=null;
function renderFan(fresh){
  const v=$('#view');
  if(!Object.keys(S.persons).length){v.innerHTML=emptyState();return;}
  let F=P(ui.focus); if(!ui.fanGen) ui.fanGen=matchMedia('(max-width:700px)').matches?3:4; let fanNote='';
  if(F&&!F.fatherId&&!F.motherId){let best=null,bn=0; for(const p of Object.values(S.persons)){const n=ancestorsOf(p.id).size; if(n>bn){bn=n;best=p;}} if(best){fanNote=`${esc(shortName(F))} har inga registrerade föräldrar – visar ${esc(fullName(best))}, som har flest kända anor.`; F=best;}}
  if(!$('#fanSvg')||fresh){
    v.innerHTML=`<div id="fanWrap"><svg id="fanSvg"><g class="vp"></g></svg>
      <div class="tree-tools"><span class="fname" id="fanName"></span>
        <span class="ctl">Generationer <select id="fanGen">${[3,4,5,6,7,8,9,10].map(n=>`<option ${n===ui.fanGen?'selected':''}>${n}</option>`).join('')}</select></span>
        <button class="btn sm" id="fanFit">Centrera</button><button class="btn sm" id="fanPrint">⎙ Skriv ut / spara</button><div id="fanNote" class="fan-note" style="display:none"></div></div>
      <div class="fan-legend" id="fanLegend"></div></div>`;
    $('#fanGen').onchange=e=>{ui.fanGen=+e.target.value; ui.fanKey=null; renderFan();};
    $('#fanFit').onclick=()=>{ui.fanKey=null; renderFan();};
    $('#fanPrint').onclick=()=>printChart($('#fanSvg'),'Solfjäder för '+$('#fanName').textContent,'klansagan-fan');
    const svg=d3.select('#fanSvg'); fanZoom=d3.zoom().scaleExtent([.2,4]).on('zoom',e=>svg.select('g.vp').attr('transform',e.transform)); svg.call(fanZoom).on('dblclick.zoom',null);
    ui.fanKey=null;
  }
  $('#fanName').textContent=fullName(F); const fnEl=$('#fanNote'); fnEl.style.display=fanNote?'flex':'none'; fnEl.innerHTML=fanNote;
  const N=ui.fanGen, R0=66, W=[0,80,80,86,104,110,112,112,112,112,112];
  const rIn=g=>R0+W.slice(1,g).reduce((a,b)=>a+b,0), rOut=g=>rIn(g)+W[g];
  const cols=[cssv('--male'),'#5f8f7f','#b08a4a',cssv('--female')];
  const slots=[]; const known=Array(N+1).fill(0);
  (function walk(p,g,i){ if(g>N) return; for(const k of [0,1]){ const j=2*i+k; const q=p?P(p[k?'motherId':'fatherId']):null; slots.push({g,j,p:q,child:p,k}); if(q) known[g]++; walk(q,g+1,j);} })(F,1,0);
  const svg=d3.select('#fanSvg'), g=svg.select('g.vp'); g.selectAll('*').remove();
  const defs=g.append('defs'); const arc=d3.arc();
  const pt=(a,r)=>[r*Math.sin(a),-r*Math.cos(a)];
  for(const s of slots){
    const n=2**s.g, span=Math.PI/n, a0=-Math.PI/2+s.j*span, a1=a0+span, r0=rIn(s.g), r1=rOut(s.g);
    const quad=s.g===1?(s.j?3:0):Math.floor(s.j/(n/4));
    const path=arc({innerRadius:r0,outerRadius:r1,startAngle:a0,endAngle:a1});
    if(!s.p){
      const el=g.append('path').attr('d',path).attr('class','fan-empty');
      if(s.child&&Store.canEdit&&!s.child[s.k?'motherId':'fatherId']){el.append('title').text('Lägg till '+(s.k?'mor':'far')+' till '+fullName(s.child)); el.on('click',()=>openPersonModal(null,{rel:s.k?'mother':'father',of:s.child.id}));}
      else el.style('cursor','default').style('opacity',.45);
      continue;
    }
    const p=s.p;
    g.append('path').attr('d',path).attr('class','fan-seg').style('fill',cols[quad]).style('fill-opacity',Math.max(.28,.82-(s.g-1)*.1))
      .on('click',()=>{setFocus(p.id); ui.fanKey=null; select('person',p.id);}).append('title').text(personLabel(p)+(p.birthPlace?' · '+placeName(p.birthPlace):''));
    const rm=(r0+r1)/2, mid=(a0+a1)/2, nm=fullName(p), yrs=lifespan(p).replace(/\s/g,'');
    if(s.g<=3){
      const L=rm*span, fs=s.g===1?13:s.g===2?12:11, maxc=Math.max(4,Math.floor(L/(fs*0.56)));
      const lines=[[p.given||'',fs,600],[p.surname||'',fs,600],[yrs,fs-1.5,400]].filter(l=>l[0]);
      const step=fs+3, start=rm+((lines.length-1)/2)*step;
      lines.forEach(([t,f,w],li)=>{ const r=start-li*step-f/3; const id=`fa${s.g}_${s.j}_${li}`; const A=pt(a0,r),B=pt(a1,r);
        defs.append('path').attr('id',id).attr('d',`M${A[0]},${A[1]}A${r},${r} 0 0 1 ${B[0]},${B[1]}`);
        g.append('text').attr('class','fan-txt').style('font-size',f+'px').style('font-weight',w).append('textPath').attr('href','#'+id).attr('startOffset','50%').attr('text-anchor','middle').text(t.length>maxc?t.slice(0,maxc-1)+'…':t);});
    } else {
      const thick=rm*span, fs=s.g===4?10.5:s.g===5?9.5:s.g===6?8.5:7.5, maxc=Math.floor((W[s.g]-10)/(fs*0.56));
      const deg=mid*180/Math.PI; const flip=mid<0;
      const tg=g.append('g').attr('transform',`rotate(${deg-90}) translate(${rm},0)${flip?' rotate(180)':''}`);
      const lines=thick<fs*0.95?[]:thick>fs*1.8?[[nm,fs,600],[yrs,fs-1,400]]:[[nm,fs,600]];
      const step=fs+1.5, off=-((lines.length-1)/2)*step;
      lines.forEach(([t,f,w],li)=>tg.append('text').attr('class','fan-txt').attr('text-anchor','middle').attr('dy',(off+li*step+f/3).toFixed(1)).style('font-size',f+'px').style('font-weight',w).text(t.length>maxc?t.slice(0,maxc-1)+'…':t));
    }
  }
  // centre
  const cg=g.append('g').style('cursor','pointer').on('click',()=>select('person',F.id));
  cg.append('circle').attr('r',R0-5).style('fill',cssv('--card')).style('stroke',cssv('--accent')).style('stroke-width',2.5);
  const av=avatarUrl(F);
  if(av){defs.append('clipPath').attr('id','fanclip').append('circle').attr('r',R0-9); cg.append('image').attr('href',av).attr('x',-(R0-9)).attr('y',-(R0-9)).attr('width',2*(R0-9)).attr('height',2*(R0-9)).attr('preserveAspectRatio','xMidYMid slice').attr('clip-path','url(#fanclip)').style('opacity',.28);}
  const cn=[F.given||'',F.surname||'',lifespan(F).replace(/\s/g,'')].filter(Boolean);
  cn.forEach((t,i)=>cg.append('text').attr('class','fan-txt').attr('text-anchor','middle').attr('y',(i-(cn.length-1)/2)*15+5).style('font-size',i<2?'13px':'11.5px').style('font-weight',i<2?600:400).text(t.length>14?t.slice(0,13)+'…':t));
  // legend
  let tot=0,kn=0; const rows=[]; for(let i=1;i<=N;i++){const t=2**i; tot+=t; kn+=known[i]; rows.push(`<div class="row"><span style="width:104px">${i===1?'Föräldrar':i===2?'Far-/morföräldrar':'Generation '+i}</span><span class="bar"><i style="width:${100*known[i]/t}%"></i></span><span style="width:44px;text-align:right">${known[i]}/${t}</span></div>`);}
  $('#fanLegend').innerHTML=`<b>Kända anor: ${kn} av ${tot} (${Math.round(100*kn/tot)}%)</b>${rows.join('')}<div class="muted" style="margin-top:6px">Klicka på en ana för att flytta mitten dit.</div>`;
  // fit
  const key=F.id+'|'+N;
  if(ui.fanKey!==key){ui.fanKey=key; const Wd=$('#fanSvg').clientWidth,Hd=$('#fanSvg').clientHeight, R=rOut(N);
    const tb=document.querySelector('#fanWrap .tree-tools'), top=tb?tb.getBoundingClientRect().bottom-$('#fanSvg').getBoundingClientRect().top+12:60, avail=Hd-top-12;
    const k=Math.min(1.6,(Wd-24)/(2*R+20),avail/(R+R0+24)); const cy=top+(avail-(R+R0)*k)/2+R*k;
    svg.call(fanZoom.transform,d3.zoomIdentity.translate(Wd/2,cy).scale(k));}
}

/* ============ PERSON CARD ============ */
function storyOf(p){
  const he=p.sex==='K'?'hon':p.sex==='M'?'han':'hen', He=he[0].toUpperCase()+he.slice(1);
  const name=fullName(p), out=[];
  const f=P(p.fatherId), m=P(p.motherId);
  const child=p.sex==='K'?'dotter':p.sex==='M'?'son':'barn';
  if(p.birthDate||p.birthPlace){
    let t=`${name} föddes${p.birthDate?' '+whenText(p.birthDate):''}${p.birthPlace?' i '+placeName(p.birthPlace):''}`;
    if(f||m) t+=`, ${f&&m?child+' till '+fullName(f)+' och '+fullName(m):child+' till '+fullName(f||m)}`;
    out.push(t+'.');
  } else if(f||m) out.push(`${name} var ${child} till ${f&&m?fullName(f)+' och '+fullName(m):fullName(f||m)}.`);
  if(p.occupation) out.push(`${out.length?He:name} var ${/^[A-ZÅÄÖ][a-zåäö]/.test(p.occupation)?p.occupation[0].toLowerCase()+p.occupation.slice(1):p.occupation}.`);
  const evs=(p.events||[]).filter(e=>e.type!=='Vigsel').sort((a,b)=>(dateKey(a.date)??9e9)-(dateKey(b.date)??9e9));
  const pl=e=>e.placeId?' i '+placeName(e.placeId):'';
  const verbs={Dop:'döptes',Konfirmation:'konfirmerades',Kröning:'kröntes',Begravning:'begravdes',Militärtjänst:'gjorde militärtjänst',Bosatt:'bodde'};
  const parts=partners(p); const kids=children(p.id);
  for(const sp of parts){
    const vig=(p.events||[]).find(e=>e.type==='Vigsel'&&e.withId===sp.id)||(sp.events||[]).find(e=>e.type==='Vigsel'&&e.withId===p.id);
    const married=(p.spouseIds||[]).includes(sp.id)||vig;
    let t=married?`${He} gifte sig${vig&&vig.date?' '+whenText(vig.date):''}${vig&&vig.placeId?' i '+placeName(vig.placeId):''} med ${fullName(sp)}`:`${He} fick barn med ${fullName(sp)}`;
    const ck=kids.filter(c=>c.fatherId===sp.id||c.motherId===sp.id);
    const kl=listJoin(ck.map(c=>(shortName(c))+(yearOf(c.birthDate)?` (${yearOf(c.birthDate)})`:'')));
    if(ck.length) t+=married?`, och tillsammans fick de ${numw(ck.length)} barn: ${kl}`:` – ${kl}`;
    out.push(t+'.');
  }
  const solo=kids.filter(c=>!parts.some(sp=>c.fatherId===sp.id||c.motherId===sp.id));
  if(solo.length) out.push(`${He} hade ${parts.length?'också ':''}${solo.length===1?'barnet':'barnen'} ${listJoin(solo.map(c=>fullName(c)))}.`);
  for(const e of evs){
    const w=e.date?whenText(e.date):'';
    if(e.type==='Flytt') out.push(`${w?w[0].toUpperCase()+w.slice(1)+' flyttade '+he:He+' flyttade'}${e.placeId?' till '+placeName(e.placeId):''}${e.desc?' – '+e.desc.replace(/\.$/,''):''}.`);
    else if(e.type==='Utvandring') out.push(`${w?w[0].toUpperCase()+w.slice(1)+' utvandrade '+he:He+' utvandrade'}${e.placeId?' via '+placeName(e.placeId):''}${e.desc?' – '+e.desc.replace(/\.$/,''):''}.`);
    else if(verbs[e.type]) out.push(`${He} ${verbs[e.type]}${w?' '+w:''}${pl(e)}${e.desc&&!['Begravning','Kröning'].includes(e.type)?' ('+e.desc.replace(/\.$/,'')+')':''}.`);
    else if(e.desc) out.push(`${w?w[0].toUpperCase()+w.slice(1)+' – ':''}${w?e.desc[0].toLowerCase()+e.desc.slice(1).replace(/\.$/,''):e.desc.replace(/\.$/,'')}${e.placeId&&!e.desc.includes(placeName(e.placeId))?pl(e):''}.`);
  }
  if(p.deathDate||p.deathPlace){const age=ageAt(p); out.push(`${He} dog${p.deathDate?' '+whenText(p.deathDate):''}${p.deathPlace?' i '+placeName(p.deathPlace):''}${age!=null&&age>0?`, ${age} år gammal`:''}.`);}
  return out.join(' ');
}
function renderCard(){
  const v=$('#view'); const p=P(ui.cardId)||(ui.sel&&ui.sel.type==='person'&&P(ui.sel.id))||P(ui.focus);
  if(!p){v.innerHTML=emptyState();return;}
  ui.cardId=p.id;
  const av=avatarUrl(p), f=P(p.fatherId), m=P(p.motherId), parts=partners(p), kids=children(p.id), sibs=siblings(p);
  const imgs=(p.media||[]);
  const evs=lifeEvents(p); const by=yearOf(p.birthDate);
  const story=storyOf(p);
  v.innerHTML=`<div class="pc">
    <div class="pc-head"><div class="pc-photo" style="box-shadow:0 0 0 2px ${sexColor(p)},var(--shadow)">${av?avImg(p):esc(initials(p))}</div>
      <div><h1>${esc(fullName(p))}</h1><div class="life">${esc([p.birthDate?'* '+fmtDate(p.birthDate):'',p.deathDate?'† '+fmtDate(p.deathDate):''].filter(Boolean).join('   '))}${p.occupation?`<br>${esc(p.occupation)}`:''}</div>
      <div class="acts">${Store.canEdit?'<button class="btn" data-pc="edit">Redigera</button>':''}<button class="btn" data-pc="tree">Visa i trädet</button><button class="btn" data-pc="fan">Solfjäder</button><button class="btn" data-pc="rel">Hur är vi släkt?</button><button class="btn" data-pc="pdf">⎙ Skriv ut / PDF</button></div></div></div>
    <div class="pc-grid"><div>
      <h3>Livsberättelse</h3><p class="story">${story?esc(story):'<span class="muted">Lägg till datum, platser och händelser så skrivs en berättelse automatiskt.</span>'}</p>
      ${imgs.length?`<h3>Bilder &amp; dokument</h3><div class="gallery">${imgs.map((mm,i)=>`<div class="m" data-img="${i}" title="${esc(mm.caption||mm.name||'')}">${isImg(mm)?`<img src="${esc(murl(mm))}" alt="${esc(mm.caption||'')}">`:'📄'}</div>`).join('')}</div>`:''}
      <h3>Tidslinje</h3><div class="vtl">${evs.map(e=>{const y=yearOf(e.date); const age=by&&y&&e.fixed!=='birth'?y-by:null; return `<div class="it"><div class="d">${esc(fmtDate(e.date)||'okänt datum')}${age!=null&&age>=0?` · ${age} år`:''}</div><b>${esc(e.type==='Övrigt'&&e.desc?e.desc:e.type)}</b>${e.placeId?` · ${esc(placeName(e.placeId))}`:''}${e.withId&&P(e.withId)?` · med ${esc(fullName(P(e.withId)))}`:''}${e.desc&&e.type!=='Övrigt'?`<div class="muted small">${esc(e.desc)}</div>`:''}</div>`;}).join('')||'<p class="muted">Inga händelser.</p>'}</div>
      ${p.notes?`<h3>Anteckningar</h3><p style="white-space:pre-wrap;line-height:1.6">${esc(p.notes)}</p>`:''}
    </div><div>
      <h3>Familj</h3>
      ${f||m?`<div class="fam-group"><h5>Föräldrar</h5><div class="recent" style="grid-template-columns:1fr">${[f,m].filter(Boolean).map(x=>chipHTML(x)).join('')}</div></div>`:''}
      ${parts.map(sp=>{const ck=kids.filter(c=>c.fatherId===sp.id||c.motherId===sp.id); return `<div class="fam-group"><h5>${(p.spouseIds||[]).includes(sp.id)?(sp.sex==='K'?'Hustru':sp.sex==='M'?'Make':'Partner'):'Partner'}</h5><div class="recent" style="grid-template-columns:1fr">${chipHTML(sp)}</div>${ck.length?`<h5 style="margin-top:8px">Barn (${ck.length})</h5><div class="recent" style="grid-template-columns:1fr">${ck.map(c=>chipHTML(c)).join('')}</div>`:''}</div>`;}).join('')}
      ${(()=>{const solo=kids.filter(c=>!parts.some(sp=>c.fatherId===sp.id||c.motherId===sp.id)); return solo.length?`<div class="fam-group"><h5>Barn</h5><div class="recent" style="grid-template-columns:1fr">${solo.map(c=>chipHTML(c)).join('')}</div></div>`:'';})()}
      ${sibs.length?`<div class="fam-group"><h5>Syskon (${sibs.length})</h5><div class="recent" style="grid-template-columns:1fr">${sibs.map(c=>chipHTML(c)).join('')}</div></div>`:''}
      <h3 style="margin-top:22px">Källor</h3>
      ${(p.citations||[]).map(c=>{const s=S.sources[c.sourceId]; return s?`<div class="cite"><b>${esc(s.title)}</b><div class="small muted">${esc([c.about&&!c.about.startsWith('event:')?c.about:'',c.detail,s.ref].filter(Boolean).join(' · '))}</div></div>`:'';}).join('')||'<p class="muted small">Inga källor kopplade ännu.</p>'}
    </div></div></div>`;
  bindChips(v,openCard);
  v.querySelectorAll('[data-img]').forEach(el=>el.onclick=()=>{ui.sel={type:'person',id:p.id}; openLightbox(p,+el.dataset.img);});
  v.querySelectorAll('[data-pc]').forEach(b=>b.onclick=()=>{const a=b.dataset.pc;
    if(a==='edit') openPersonModal(p);
    if(a==='tree'){setFocus(p.id); ui.treeKey=null; location.hash='trad';}
    if(a==='fan'){setFocus(p.id); ui.fanKey=null; location.hash='solfjader';}
    if(a==='rel'){ui.relB=p.id; const h=homePerson(); ui.relA=h&&h.id!==p.id?h.id:null; location.hash='slaktskap';}
    if(a==='pdf') personPdf(p);
  });
}

/* ============ DUPLICATES ============ */
function findDups(){
  const all=Object.values(S.persons); const buckets={};
  for(const p of all){const k=nrm((p.given||'').split(/\s+/)[0]).slice(0,2); if(k) (buckets[k]=buckets[k]||[]).push(p);}
  const out=[];
  for(const list of Object.values(buckets)) for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++){const sc=dupScore(list[i],list[j]); if(sc>=60) out.push({a:list[i],b:list[j],sc});}
  return out.sort((x,y)=>y.sc-x.sc);
}
function renderDups(){
  const v=$('#view'); const dups=findDups();
  const row=(lbl,fa,fb)=>{const x=fa||'–',y=fb||'–'; const diff=fa&&fb&&norm(fa)!==norm(fb); return `<span class="k">${lbl}</span><span class="${diff?'diff':''}">${esc(x)}</span><span class="${diff?'diff':''}">${esc(y)}</span>`;};
  v.innerHTML=`<div class="view-pad"><div class="toolbar"><h2>Möjliga dubbletter</h2><a class="btn" href="#personer">← Personer</a></div>
    <p class="muted" style="max-width:720px;line-height:1.55;margin-top:-6px">Personer med liknande namn, födelseår, föräldrar och födelseort. Vid sammanslagning fylls tomma uppgifter i från den andra posten, och händelser, källor, bilder och familjekopplingar flyttas över.</p>
    ${dups.length?dups.map((d,i)=>`<div class="dup" data-i="${i}"><div style="display:flex;align-items:center;gap:10px"><span class="score">${d.sc}% lika</span><b>${esc(fullName(d.a))}</b><span class="muted">och</span><b>${esc(fullName(d.b))}</b></div>
      <div class="dup-grid"><span></span><span class="h">A</span><span class="h">B</span>
      ${row('Född',[d.a.birthDate,placeName(d.a.birthPlace)].filter(Boolean).join(', '),[d.b.birthDate,placeName(d.b.birthPlace)].filter(Boolean).join(', '))}
      ${row('Död',[d.a.deathDate,placeName(d.a.deathPlace)].filter(Boolean).join(', '),[d.b.deathDate,placeName(d.b.deathPlace)].filter(Boolean).join(', '))}
      ${row('Far',fullName(P(d.a.fatherId))==='Okänd'?'':fullName(P(d.a.fatherId)),fullName(P(d.b.fatherId))==='Okänd'?'':fullName(P(d.b.fatherId)))}
      ${row('Mor',fullName(P(d.a.motherId))==='Okänd'?'':fullName(P(d.a.motherId)),fullName(P(d.b.motherId))==='Okänd'?'':fullName(P(d.b.motherId)))}
      ${row('Partner',partners(d.a).map(fullName).join(', '),partners(d.b).map(fullName).join(', '))}
      ${row('Barn / källor',children(d.a.id).length+' barn, '+(d.a.citations||[]).length+' källor',children(d.b.id).length+' barn, '+(d.b.citations||[]).length+' källor')}
      </div>${Store.canEdit?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm primary" data-merge="a">Slå ihop – behåll A</button><button class="btn sm" data-merge="b">Slå ihop – behåll B</button><button class="btn sm ghost" data-notdup>Inte samma person</button></div>`:''}</div>`).join('')
    :`<div class="box"><h3>Inga misstänkta dubbletter</h3><p>Hittade inga personer som verkar vara samma person. Kör gärna sökningen igen efter en import.</p></div>`}</div>`;
  v.querySelectorAll('.dup').forEach(el=>{const d=dups[+el.dataset.i];
    el.querySelectorAll('[data-merge]').forEach(b=>b.onclick=()=>{const [k,x]=b.dataset.merge==='a'?[d.a,d.b]:[d.b,d.a]; confirmBox(`Slå ihop till ${fullName(k)}?`,`Uppgifterna från den andra posten läggs in där de saknas, och den andra posten tas bort.`,'Slå ihop',()=>mergePersons(k.id,x.id));});
    const nd=el.querySelector('[data-notdup]'); if(nd) nd.onclick=()=>{const a=clone(d.a); a.notDup=[...new Set([...(a.notDup||[]),d.b.id])]; Store.put(a);};
  });
}
async function mergePersons(keepId,dropId){
  const k=clone(P(keepId)), d=P(dropId); if(!k||!d) return;
  for(const f of ['given','callName','surname','sex','birthDate','birthPlace','deathDate','deathPlace','occupation','fatherId','motherId']) if(!k[f]&&d[f]) k[f]=d[f];
  if(d.notes&&d.notes!==k.notes) k.notes=[k.notes,d.notes].filter(Boolean).join('\n\n');
  const evKey=e=>e.type+'|'+(e.date||'')+'|'+(e.placeId||'');
  const evs=(k.events||[]).slice(); for(const e of d.events||[]) if(!evs.some(x=>evKey(x)===evKey(e))) evs.push(e); k.events=evs;
  const cKey=c=>c.sourceId+'|'+(c.about||'')+'|'+(c.detail||'');
  const cs=(k.citations||[]).slice(); for(const c of d.citations||[]) if(!cs.some(x=>cKey(x)===cKey(c))) cs.push(c); k.citations=cs;
  k.media=(k.media||[]).concat((d.media||[]).map(m=>Object.assign({},m,{profile:(k.media||[]).some(x=>x.profile)?false:m.profile})));
  k.spouseIds=[...new Set([...(k.spouseIds||[]),...(d.spouseIds||[])])].filter(x=>x!==keepId&&x!==dropId);
  k.notDup=[...new Set([...(k.notDup||[]),...(d.notDup||[])])].filter(x=>x!==dropId);
  if(d.home) k.home=true;
  await Store.put(k,{silent:true});
  for(const o of Object.values(ALL.persons)){ if(o.id===keepId||o.id===dropId) continue; let ch=false; const q=clone(o);
    if(q.fatherId===dropId){q.fatherId=keepId;ch=true;} if(q.motherId===dropId){q.motherId=keepId;ch=true;}
    if((q.spouseIds||[]).includes(dropId)){q.spouseIds=[...new Set(q.spouseIds.map(x=>x===dropId?keepId:x))];ch=true;}
    (q.events||[]).forEach(e=>{if(e.withId===dropId){e.withId=keepId;ch=true;}});
    if((q.notDup||[]).includes(dropId)){q.notDup=q.notDup.filter(x=>x!==dropId);ch=true;}
    if(ch) Store.put(q,{silent:true}); }
  if(ui.focus===dropId) setFocus(keepId);
  if(ui.sel&&ui.sel.id===dropId) ui.sel={type:'person',id:keepId};
  await Store.del('person',dropId);
  toast('Sammanslaget till '+fullName(k));
}

/* ============ RELATIONSHIP ============ */
function relation(aId,bId){
  if(aId===bId) return {text:'samma person'};
  const r=blood(aId,bId);
  if(r) return {text:bloodTerm(r,aId,bId),r,kind:'blood'};
  const A=P(aId),B=P(bId);
  if(partners(A).some(x=>x.id===bId)) return {text:(A.spouseIds||[]).includes(bId)?sx(bId,'make','maka','make/maka'):'partner',kind:'partner'};
  for(const q of partners(B)){const r2=blood(aId,q.id); if(r2){ let t;
    if(r2.a===0&&r2.b===1) t=sx(bId,'svärson','svärdotter','svärbarn');
    else if(r2.a===1&&r2.b===1) t=sx(bId,'svåger','svägerska','svåger/svägerska');
    else t=`${bloodTerm(r2,aId,q.id)}s ${sx(bId,'make','maka','partner')}`;
    return {text:t,r:r2,kind:'inlaw',via:q.id,viaSide:'b'};}}
  for(const q of partners(A)){const r2=blood(q.id,bId); if(r2){ let t;
    if(r2.a===1&&r2.b===0) t=sx(bId,'svärfar','svärmor','svärförälder');
    else if(r2.a===1&&r2.b===1) t=sx(bId,'svåger','svägerska','svåger/svägerska');
    else t=`${sx(q.id,'makens','makans','partnerns')} ${bloodTerm(r2,q.id,bId)}`;
    return {text:t,r:r2,kind:'inlaw',via:q.id,viaSide:'a'};}}
  return {text:null};
}
function renderRel(){
  const v=$('#view'); const all=Object.values(S.persons);
  if(all.length<2){v.innerHTML=emptyState();return;}
  if((!ui.relA||!P(ui.relA))&&demoActive()&&P('p_gustav1')&&P('p_ga2')){ui.relA='p_gustav1'; if(!ui.relB||!P(ui.relB)||ui.relB==='p_gustav1') ui.relB='p_ga2';}
  if(!ui.relA||!P(ui.relA)){const h=homePerson(); ui.relA=h?h.id:ui.focus;}
  if(!ui.relB||!P(ui.relB)||ui.relB===ui.relA){const s=ui.sel&&ui.sel.type==='person'&&ui.sel.id!==ui.relA?ui.sel.id:null; ui.relB=s||(all.find(p=>p.id!==ui.relA)||{}).id;}
  const A=P(ui.relA),B=P(ui.relB);
  const res=relation(A.id,B.id);
  let pathHTML='';
  if(res.r){const r=res.r; const top=r.commons.map(id=>P(id)).filter(Boolean);
    const left=r.pa.slice(0,r.a).reverse(), right=r.pb.slice(0,r.b).reverse();
    const col=(ids)=>ids.map(id=>`<div class="arrow"></div>${chipHTML(P(id))}`).join('');
    pathHTML=`<div class="rel-path" style="flex-direction:column;align-items:center;gap:0"><div class="rel-top">${top.map(p=>chipHTML(p,'gemensam ana')).join('')}</div>
      <div style="display:flex;gap:30px;justify-content:center;flex-wrap:wrap"><div class="rel-col">${col(left)}</div>${right.length?`<div class="rel-col">${col(right)}</div>`:''}</div></div>`;
  }
  const an=esc(shortName(A)), bn=esc(fullName(B));
  v.innerHTML=`<div class="view-pad" style="max-width:980px"><div class="toolbar"><h2>Hur är vi släkt?</h2></div>
    <div class="rel-pick"><label class="f" style="margin:0"><span>Person A</span>${personPicker('relA',A.id,'Välj person')}</label>
      <button class="btn" id="relSwap" title="Byt plats">⇄</button>
      <label class="f" style="margin:0"><span>Person B</span>${personPicker('relB',B.id,'Välj person')}</label>${allPersonsDatalist()}</div>
    <div class="rel-answer">${res.text?`<div class="muted small" style="margin-bottom:6px">${res.kind==='blood'&&res.r?`${res.r.a+res.r.b} generationssteg via ${listJoin(res.r.commons.map(id=>esc(fullName(P(id)))))}`:res.kind==='inlaw'?'Släkt genom giftermål':res.kind==='partner'?'Partner':''}</div>
      <div class="big"><b>${bn}</b> är ${genitive(an)} <b>${esc(res.text)}</b>.</div>
      ${res.kind==='blood'&&res.r&&res.r.a!==res.r.b&&res.r.a>0&&res.r.b>0?`<div class="muted" style="margin-top:8px">Omvänt: ${an} är ${esc(genitive(shortName(B)))} ${esc(bloodTerm({...res.r,a:res.r.b,b:res.r.a,pa:res.r.pb,pb:res.r.pa},B.id,A.id))}.</div>`:''}
      ${pathHTML}`
    :`<div class="big">Ingen känd släktskap</div><p class="muted" style="margin:8px 0 0">Hittade ingen gemensam ana eller koppling via giftermål mellan ${an} och ${bn} i arkivet.</p>`}</div></div>`;
  const pick=(inp,key)=>{inp.onchange=()=>{const p=personByLabel(inp.value); if(p){ui[key]=p.id; renderRel();} else toast('Välj en person i listan');};};
  pick($('#relA'),'relA'); pick($('#relB'),'relB');
  $('#relSwap').onclick=()=>{[ui.relA,ui.relB]=[ui.relB,ui.relA]; renderRel();};
  bindChips(v,openCard);
}

/* ============ PRINT / PDF ============ */
function loadJsPDF(){return new Promise((res,rej)=>{if(window.jspdf) return res(); const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload=res; s.onerror=()=>rej(new Error('Kunde inte ladda PDF-verktyget')); document.head.appendChild(s);});}
async function toDataURL(url){if(!url||url.startsWith('data:')) return url; try{const r=await fetch(url); const b=await r.blob(); return await new Promise(res=>{const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(b);});}catch(e){return null;}}
const PROPS=['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','opacity','font-size','font-weight','font-style','text-anchor','dominant-baseline','paint-order','visibility','display'];
async function svgSnapshot(svgEl,title){
  const prev=themeName(); applyTheme('light');
  const vp=svgEl.querySelector('g.vp'); const bb=vp.getBBox(); const M=30, TH=46;
  const clone=svgEl.cloneNode(true);
  const o=[svgEl,...svgEl.querySelectorAll('*')], c=[clone,...clone.querySelectorAll('*')];
  o.forEach((el,i)=>{const cs=getComputedStyle(el); let st=''; for(const p of PROPS){const v=cs.getPropertyValue(p); if(v) st+=`${p}:${v};`;} st+='font-family:Helvetica,Arial,sans-serif;'; c[i].setAttribute('style',st); c[i].removeAttribute('class');});
  o.forEach((el,i)=>{if(el.classList&&(el.classList.contains('ghost')||el.classList.contains('eye'))) c[i].setAttribute('data-drop','1');});
  clone.querySelectorAll('[data-drop]').forEach(el=>el.remove());
  const paper=cssv('--paper'), ink=cssv('--ink'), ink3=cssv('--ink3');
  applyTheme(prev);
  c[o.indexOf(vp)].removeAttribute('transform');
  const w=bb.width+2*M, h=bb.height+2*M+TH;
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg'); clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
  clone.setAttribute('viewBox',`${bb.x-M} ${bb.y-M-TH} ${w} ${h}`); clone.setAttribute('width',w); clone.setAttribute('height',h); clone.style.cursor='';
  const NS='http://www.w3.org/2000/svg';
  const bg=document.createElementNS(NS,'rect'); bg.setAttribute('x',bb.x-M); bg.setAttribute('y',bb.y-M-TH); bg.setAttribute('width',w); bg.setAttribute('height',h); bg.setAttribute('fill',paper); clone.insertBefore(bg,clone.firstChild);
  const t=document.createElementNS(NS,'text'); t.setAttribute('x',bb.x); t.setAttribute('y',bb.y-M-TH+30); t.setAttribute('style',`font-family:Georgia,serif;font-size:22px;font-weight:600;fill:${ink}`); t.textContent=title; clone.appendChild(t);
  const t2=document.createElementNS(NS,'text'); t2.setAttribute('x',bb.x+bb.width); t2.setAttribute('y',bb.y-M-TH+30); t2.setAttribute('style',`font-family:Helvetica,Arial,sans-serif;font-size:11px;fill:${ink3};text-anchor:end`); t2.textContent='Klansagan · '+fmtDate(new Date().toISOString().slice(0,10)); clone.appendChild(t2);
  for(const im of clone.querySelectorAll('image')){const href=im.getAttribute('href'); const d=await toDataURL(href); if(d) im.setAttribute('href',d); else im.remove();}
  const xml=new XMLSerializer().serializeToString(clone);
  const url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}));
  const img=await new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('Kunde inte rita bilden')); i.src=url;});
  const scale=Math.max(1,Math.min(3,7000/Math.max(w,h)));
  const cv=document.createElement('canvas'); cv.width=Math.round(w*scale); cv.height=Math.round(h*scale);
  const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,cv.width,cv.height); URL.revokeObjectURL(url);
  return {canvas:cv,w,h};
}
function printChart(svgEl,title,slug){
  modal(`<h3>Skriv ut eller spara</h3><p class="muted" style="line-height:1.5">Hela diagrammet sparas – inte bara det som syns på skärmen – i ljust tema och med titel. Öppna PDF:en och skriv ut, eller beställ en affisch från bilden.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button class="btn primary" data-k="pdf">PDF för utskrift (A3)</button><button class="btn" data-k="pdf4">PDF (A4)</button><button class="btn" data-k="png">Bild (PNG)</button></div>
    <div id="prProg" class="small muted" style="margin-top:10px"></div><div class="foot"><button class="btn" data-x>Stäng</button></div>`,(ov,close)=>{
    ov.querySelector('[data-x]').onclick=close;
    ov.querySelectorAll('[data-k]').forEach(b=>b.onclick=async()=>{
      const k=b.dataset.k; ov.querySelector('#prProg').textContent='Skapar fil…';
      try{
        const {canvas,w,h}=await svgSnapshot(svgEl,title);
        const stamp=new Date().toISOString().slice(0,10);
        if(k==='png'){const blob=await new Promise(r=>canvas.toBlob(r,'image/png')); close(); await saveFile(`${slug}-${stamp}.png`,blob); return;}
        await loadJsPDF(); const {jsPDF}=window.jspdf; const land=w>=h; const fmt=k==='pdf'?'a3':'a4';
        const doc=new jsPDF({orientation:land?'landscape':'portrait',unit:'mm',format:fmt});
        const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight(), m=10;
        const sc=Math.min((pw-2*m)/w,(ph-2*m)/h); const iw=w*sc, ih=h*sc;
        doc.addImage(canvas.toDataURL('image/jpeg',0.92),'JPEG',(pw-iw)/2,(ph-ih)/2,iw,ih);
        close(); await saveFile(`${slug}-${stamp}.pdf`,doc.output('blob'));
      }catch(e){ov.querySelector('#prProg').textContent='Det gick inte: '+(e.message||e);}
    });
  });
}
// eslint-disable-next-line no-control-regex
const pdfT=s=>String(s??'').replace(/Ł/g,'L').replace(/ł/g,'l').replace(/[^\u0000-ÿ–—‘’“”…†•]/g,c=>c.normalize('NFD').replace(/[̀-ͯ]/g,'')).replace(/[^\u0000-ÿ–—‘’“”…†•]/g,'?');
async function personPdf(p){
  try{
    toast('Skapar PDF…'); await loadJsPDF(); const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4'}); const W=210, M=18; let y=M;
    const need=h=>{if(y+h>297-M){doc.addPage(); y=M;}};
    const para=(txt,size=10.5,style='normal',color=[42,37,32],lh=1.45)=>{doc.setFont('helvetica',style); doc.setFontSize(size); doc.setTextColor(...color); for(const line of doc.splitTextToSize(pdfT(txt),W-2*M)){need(size*0.36*lh); doc.text(line,M,y+size*0.3); y+=size*0.36*lh;}};
    const head=t=>{y+=4; need(12); doc.setDrawColor(200,190,170); doc.line(M,y,W-M,y); y+=6; para(t.toUpperCase(),9,'bold',[120,110,95]); y+=1;};
    const av=avatarUrl(p); let photo=null; if(av) photo=await toDataURL(av);
    let tx=M; if(photo){try{doc.addImage(photo,photo.includes('image/png')?'PNG':'JPEG',M,y,32,40,undefined,'FAST'); tx=M+38;}catch(e){photo=null;}}
    doc.setFont('times','bold'); doc.setFontSize(24); doc.setTextColor(42,37,32); doc.text(pdfT(fullName(p)),tx,y+9);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(93,85,75);
    const life=[p.birthDate?'* '+fmtDate(p.birthDate)+(p.birthPlace?', '+placeName(p.birthPlace):''):'',p.deathDate?'† '+fmtDate(p.deathDate)+(p.deathPlace?', '+placeName(p.deathPlace):''):''].filter(Boolean);
    life.forEach((l,i)=>doc.text(pdfT(l),tx,y+17+i*6)); if(p.occupation) doc.text(pdfT(p.occupation),tx,y+17+life.length*6);
    y+=photo?44:26;
    const st=storyOf(p); if(st){head('Livsberättelse'); para(st,11,'normal',[42,37,32],1.55);}
    const f=P(p.fatherId),m=P(p.motherId),parts=partners(p),kids=children(p.id),sibs=siblings(p);
    head('Familj');
    if(f||m) para('Föräldrar: '+[f,m].filter(Boolean).map(personLabel).join(', '));
    for(const sp of parts){const ck=kids.filter(c=>c.fatherId===sp.id||c.motherId===sp.id); para('Partner: '+personLabel(sp)+(ck.length?' — barn: '+ck.map(personLabel).join(', '):''));}
    const solo=kids.filter(c=>!parts.some(sp=>c.fatherId===sp.id||c.motherId===sp.id)); if(solo.length) para('Barn: '+solo.map(personLabel).join(', '));
    if(sibs.length) para('Syskon: '+sibs.map(personLabel).join(', '));
    const evs=lifeEvents(p); if(evs.length){head('Händelser'); for(const e of evs) para(`${fmtDate(e.date)||'–'}  ${e.type}${e.placeId?', '+placeName(e.placeId):''}${e.withId&&P(e.withId)?', med '+fullName(P(e.withId)):''}${e.desc?' — '+e.desc:''}`);}
    const cs=(p.citations||[]).filter(c=>S.sources[c.sourceId]); if(cs.length){head('Källor'); for(const c of cs){const s=S.sources[c.sourceId]; para(`• ${s.title}${[c.about&&!c.about.startsWith('event:')?c.about:'',c.detail,s.archive,s.ref].filter(Boolean).length?' ('+[c.about&&!c.about.startsWith('event:')?c.about:'',c.detail,s.archive,s.ref].filter(Boolean).join(', ')+')':''}`,9.5);}}
    if(p.notes){head('Anteckningar'); para(p.notes,10);}
    const n=doc.getNumberOfPages(); for(let i=1;i<=n;i++){doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140,130,115); doc.text(pdfT(`Klansagan · ${fullName(p)} · sida ${i} av ${n}`),M,297-8);}
    await saveFile(`klansagan-${(fullName(p)).toLowerCase().replace(/[^a-z0-9åäö]+/g,'-')}.pdf`,doc.output('blob'));
  }catch(e){toast('Kunde inte skapa PDF: '+(e.message||e));}
}

/* ============ Views (dölj/visa) & sharing ============ */
const ARTIFACT_URL='https://claude.ai/artifact/JvGs2s1WF8hstNwPqi7SW1';
function viewLink(v){const base=Store.mode==='db'?ARTIFACT_URL:location.href.split('#')[0]; return base+(v?'#vy-'+v.slug:'');}
function setActiveView(id){ui.viewId=id||null; try{id?localStorage.setItem('sa-viewid',id):localStorage.removeItem('sa-viewid');}catch(e){} applyView(); ui.treeKey=null; ui.fanKey=null; mapState.drawn=false; if(ui.sel&&ui.sel.type==='person'&&!P(ui.sel.id)) ui.sel=null; renderAll(true);}
function updateViewBtn(){
  const b=$('#viewBtn'); if(!b) return; const v=activeView();
  b.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span class="vlabel">Vy:</span><span class="vname">${esc(v?v.name:'Hela släkten')}</span>${v&&HIDDEN.size?`<span class="tag" style="margin:0">${HIDDEN.size} dolda</span>`:''}<span style="opacity:.6">▾</span>`;
  b.classList.toggle('active',!!v);
}
function openViewMenu(){
  const pop=$('#viewPop'); if(pop.classList.contains('open')){pop.classList.remove('open');return;}
  const vs=Object.values(ALL.views).sort((a,b)=>a.name.localeCompare(b.name,'sv')); const cur=activeView();
  pop.innerHTML=`<div class="vp-h">Vad vill du se?</div>
    <div class="vp-i ${!cur?'on':''}" data-v=""><b>Hela släkten</b><span>${Object.keys(ALL.persons).length} personer</span></div>
    ${vs.map(v=>`<div class="vp-i ${cur&&cur.id===v.id?'on':''}" data-v="${v.id}"><b>${esc(v.name)}</b><span>${viewCounts(v)} dolda</span></div>`).join('')}
    <div class="vp-sep"></div>
    ${Store.canEdit?'<div class="vp-a" data-a="new">+ Ny vy…</div>':''}
    ${cur&&Store.canEdit?'<div class="vp-a" data-a="edit">Anpassa vyn…</div>':''}
    <div class="vp-a" data-a="share">🔗 Dela ${cur?'länk till vyn':'med släkten'}…</div>`;
  pop.classList.add('open');
  pop.querySelectorAll('[data-v]').forEach(el=>el.onclick=()=>{pop.classList.remove('open'); setActiveView(el.dataset.v||null); toast(el.dataset.v?'Visar vyn '+ALL.views[el.dataset.v].name:'Visar hela släkten');});
  pop.querySelectorAll('[data-a]').forEach(el=>el.onclick=()=>{pop.classList.remove('open'); const a=el.dataset.a; if(a==='new') viewModal(null); if(a==='edit') viewModal(activeView()); if(a==='share') shareModal(activeView());});
}
document.addEventListener('mousedown',e=>{const pop=$('#viewPop'); if(pop&&pop.classList.contains('open')&&!e.target.closest('.viewsel')) pop.classList.remove('open');});
function ruleLabel(kind,id){const p=ALL.persons[id]; const n=p?fullName(p):'(borttagen person)'; return kind==='hide'?`Dölj ${n}`:kind==='hideUp'?`Dölj ${genitive(n)} släkt bakåt`:`Dölj ${genitive(n)} ättlingar`;}
function baseForView(){return Object.values(ALL.persons).find(p=>p.home)||ALL.persons[ui.focus]||null;}
function quickBranches(){
  const B=baseForView(); if(!B) return {B:null,rows:[]}; const A=ALL.persons, rows=[];
  const side=(pid,label,sub)=>{const p=A[pid]; if(!p) return; rows.push({id:p.id,label,who:fullName(p),lvl:0});
    for(const [k,l] of sub){const g=A[p[k]]; if(g) rows.push({id:g.id,label:l,who:fullName(g),lvl:1,par:p.id});}};
  side(B.fatherId,'Pappas släkt',[['fatherId','Farfars släkt'],['motherId','Farmors släkt']]);
  side(B.motherId,'Mammas släkt',[['fatherId','Morfars släkt'],['motherId','Mormors släkt']]);
  return {B,rows};
}
function viewModal(v,preset){
  const isNew=!v; v=v?clone(v):{kind:'view',id:uid('v'),name:'',hide:[],hideUp:[],hideDown:[]};
  if(preset) for(const k of ['hide','hideUp','hideDown']) v[k]=[...new Set([...(v[k]||[]),...(preset[k]||[])])];
  const {B,rows:qb}=quickBranches(); const qIds=new Set(qb.map(r=>r.id));
  const rules=()=>['hideUp','hideDown','hide'].flatMap(k=>(v[k]||[]).filter(id=>!(k==='hideUp'&&qIds.has(id))).map(id=>({k,id})));
  const total=Object.keys(ALL.persons).length;
  modal(`<h3>${isNew?'Ny vy':'Anpassa vyn'}</h3>
    <p class="muted" style="line-height:1.5;margin-top:-6px">En vy bestämmer vad som syns, t.ex. <i>Pappas sida</i> för kusinerna på fars sida. Inget raderas – allt finns kvar i <i>Hela släkten</i>.</p>
    <label class="f"><span>Namn på vyn</span><input class="t" id="vwN" value="${esc(v.name)}" placeholder="t.ex. Pappas sida"></label>
    ${qb.length?`<div class="qb"><div class="qb-h">Visa grenar <span class="muted small">utifrån ${esc(fullName(B))}</span></div>${qb.map(r=>`<label class="qb-row" style="padding-left:${r.lvl*22}px"><input type="checkbox" data-qb="${r.id}" data-par="${r.par||''}" ${(v.hideUp||[]).includes(r.id)?'':'checked'}><span><b>${r.label}</b> <span class="muted small">via ${esc(r.who)}</span></span></label>`).join('')}</div>`
      :`<p class="small muted">Tips: markera dig själv som <i>jag</i> (Inställningar eller ”Det här är jag” på ditt personkort) så kan du välja pappas och mammas sida med ett klick här.</p>`}
    <div class="qb-h" style="margin-top:14px">Dolda personer och grenar</div>
    <div id="vwRules"></div>
    <details style="margin-top:6px"><summary style="cursor:pointer;color:var(--accent);font-size:13px">+ Dölj en viss person eller gren</summary>
    <div class="mini"><div class="row2"><label class="f"><span>Person</span><input class="t" id="vwP" list="dlVwP" placeholder="Sök person"><datalist id="dlVwP">${Object.values(ALL.persons).map(x=>`<option value="${esc(personLabel(x))}">`).join('')}</datalist></label>
      <label class="f"><span>Vad ska döljas?</span><select class="t" id="vwK"><option value="hideUp">Hens släkt bakåt (personen syns)</option><option value="hideUpSelf">Personen och hens släkt bakåt</option><option value="hideDown">Hens ättlingar</option><option value="hide">Bara personen</option></select></label></div>
      <button class="btn sm" id="vwAdd">Dölj</button></div></details>
    <p class="small" id="vwCount" style="margin:12px 0 0"></p>
    <div class="foot">${!isNew?'<button class="btn ghost danger" data-del style="margin-right:auto">Ta bort vyn</button>':''}<button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>${isNew?'Skapa och visa':'Spara'}</button></div>`,(ov,close)=>{
    const q=x=>ov.querySelector(x);
    const draw=()=>{const rs=rules(); q('#vwRules').innerHTML=rs.length?rs.map(r=>`<div class="rel"><span style="flex:1">${esc(ruleLabel(r.k,r.id))}</span><button class="btn sm ghost" data-rm="${r.k}|${r.id}">Visa igen</button></div>`).join(''):'<p class="muted small" style="margin:4px 0">Inga enskilda personer dolda.</p>';
      const n=computeHidden(v).size; const el=q('#vwCount'); el.textContent=n?`${n} av ${total} personer döljs i vyn.`:'Inget döljs ännu.'; el.style.color=n>=total*.8&&n?'var(--err)':'var(--ink2)'; if(n>=total*.8&&n) el.textContent+=' Det är nästan alla – kontrollera valen.';
      ov.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const [k,id]=b.dataset.rm.split('|'); v[k]=v[k].filter(x=>x!==id); draw();});
      ov.querySelectorAll('[data-qb]').forEach(cb=>{const off=cb.dataset.par&&(v.hideUp||[]).includes(cb.dataset.par); cb.disabled=!!off; if(off) cb.checked=false; else cb.checked=!(v.hideUp||[]).includes(cb.dataset.qb); cb.closest('label').style.opacity=off?.45:1;});};
    draw(); if(isNew) q('#vwN').focus();
    ov.querySelectorAll('[data-qb]').forEach(cb=>cb.onchange=()=>{const id=cb.dataset.qb; v.hideUp=(v.hideUp||[]).filter(x=>x!==id); if(!cb.checked) v.hideUp.push(id);
      if(!q('#vwN').value.trim()&&!cb.checked){const r=qb.find(x=>x.id===id); const onlyDad=r.label==='Mammas släkt', onlyMom=r.label==='Pappas släkt'; q('#vwN').value=onlyDad?'Pappas sida':onlyMom?'Mammas sida':'Utan '+r.label.toLowerCase();}
      draw();});
    q('#vwAdd').onclick=()=>{const p=personByLabelAll(q('#vwP').value); if(!p){toast('Välj en person i listan');return;} const k=q('#vwK').value;
      if(k==='hideUpSelf'){v.hideUp=[...new Set([...(v.hideUp||[]),p.id])]; v.hide=[...new Set([...(v.hide||[]),p.id])];} else v[k]=[...new Set([...(v[k]||[]),p.id])];
      q('#vwP').value=''; draw();};
    q('[data-x]').onclick=close;
    if(!isNew) q('[data-del]').onclick=()=>{close(); confirmBox(`Ta bort vyn ${v.name}?`,'Länkar till vyn slutar fungera. Inga personer tas bort.','Ta bort',()=>{if(ui.viewId===v.id) setActiveView(null); Store.del('view',v.id);});};
    q('[data-ok]').onclick=async()=>{const n=q('#vwN').value.trim(); if(!n){q('#vwN').focus();toast('Ge vyn ett namn');return;}
      const prev=isNew?null:clone(ALL.views[v.id]), prevActive=ui.viewId;
      v.name=n; if(!v.slug||isNew){let sl=slugify(n),i=2; while(Object.values(ALL.views).some(x=>x.slug===sl&&x.id!==v.id)) sl=slugify(n)+'-'+(i++); v.slug=sl;}
      close(); await Store.put(v,{silent:true}); setActiveView(v.id);
      toast(`Visar vyn ${n} – ${HIDDEN.size} personer dolda`,7000,{label:'Ångra',fn:async()=>{if(prev){await Store.put(prev,{silent:true}); setActiveView(prev.id);} else {setActiveView(prevActive); Store.del('view',v.id);}}});};
  });
}
function personByLabelAll(label){return withAll(()=>personByLabel(label));}
function hideModal(p){
  const cur=activeView(); const name=fullName(p), total=Object.keys(ALL.persons).length; const hen=p.sex==='K'?'hennes':p.sex==='M'?'hans':'hens';
  const opts=[
    ['hideUp',`${genitive(name)} släkt bakåt`,`${p.given||name} syns, men inte föräldrar, anor och deras övriga ättlingar (t.ex. "mammas sida").`],
    ['hideUpSelf',`${name} och ${hen} släkt bakåt`,'Som ovan, men även personen själv döljs.'],
    ['hideDown',`${genitive(name)} ättlingar`,'Barn, barnbarn och så vidare.'],
    ['hide',`Bara ${name}`,''],
  ];
  const base=cur?HIDDEN.size:0;
  const count=k=>{const v=clone(cur||{hide:[],hideUp:[],hideDown:[]}); if(k==='hideUpSelf'){v.hideUp=[...(v.hideUp||[]),p.id]; v.hide=[...(v.hide||[]),p.id];} else v[k]=[...(v[k]||[]),p.id]; return computeHidden(v).size;};
  modal(`<h3>Dölj i ${cur?'vyn '+esc(cur.name):'en ny vy'}</h3>
    <p class="muted" style="margin-top:-6px;line-height:1.5">${cur?'':'Du tittar på <i>Hela släkten</i>, så vyn <i>Min vy</i> skapas – byt namn under <b>Vy</b> uppe till höger. '}Inget raderas, och du kan ångra direkt efteråt.</p>
    <div style="display:flex;flex-direction:column;gap:8px">${opts.map(([k,t,d])=>{const n=count(k), add=n-base, warn=n>=total*.8; return `<button class="btn" data-k="${k}" ${add<=0?'disabled':''} style="justify-content:flex-start;text-align:left;white-space:normal;padding:10px 12px"><span style="flex:1"><b>${esc(t)}</b>${d?`<br><span class="small muted">${esc(d)}</span>`:''}${warn?`<br><span class="small" style="color:var(--err)">Döljer ${n} av ${total} – nästan alla.</span>`:''}</span><span class="tag ${warn?'warn':''}">${add>0?'+'+add:'0'} pers.</span></button>`;}).join('')}</div>
    <div class="foot"><button class="btn" data-x>Avbryt</button></div>`,(ov,close)=>{
    ov.querySelector('[data-x]').onclick=close;
    ov.querySelectorAll('[data-k]').forEach(b=>b.onclick=async()=>{
      const k=b.dataset.k, prev=cur?clone(cur):null, prevActive=ui.viewId;
      const v=cur?clone(cur):{kind:'view',id:uid('v'),name:'Min vy',hide:[],hideUp:[],hideDown:[]};
      if(!v.slug){let sl=slugify(v.name),i=2; while(Object.values(ALL.views).some(x=>x.slug===sl)) sl=slugify(v.name)+'-'+(i++); v.slug=sl;}
      if(k==='hideUpSelf'){v.hideUp=[...new Set([...(v.hideUp||[]),p.id])]; v.hide=[...new Set([...(v.hide||[]),p.id])];} else v[k]=[...new Set([...(v[k]||[]),p.id])];
      close(); if(ui.focus===p.id&&(k==='hide'||k==='hideUpSelf')) ui.focus=null;
      await Store.put(v,{silent:true}); setActiveView(v.id);
      toast(`${HIDDEN.size} personer dolda i vyn ${v.name}`,7000,{label:'Ångra',fn:async()=>{if(prev){await Store.put(prev,{silent:true}); setActiveView(prev.id);} else {setActiveView(prevActive); Store.del('view',v.id);}}});
    });
  });
}
function shareModal(v){
  if(Share.enabled()&&!v) return shareTreeModal();
  const link=viewLink(v); const inClaude=Store.mode==='db';
  modal(`<h3>Dela med släkten</h3>
    ${inClaude?`<p style="line-height:1.55;margin-top:-6px">Alla som får tillgång ser samma träd, och ändringar syns för alla direkt. Varje ändring märks med vem som gjorde den.</p>
      <label class="f"><span>${v?`Länk som öppnar vyn ${esc(v.name)}`:'Länk till hela släkten'}</span><div style="display:flex;gap:6px"><input class="t" id="shL" readonly value="${esc(link)}"><button class="btn primary" id="shC">Kopiera</button></div></label>
      <div class="box" style="background:var(--paper);margin:6px 0 0">
        <b>Så bjuder du in släktingar som ska kunna lägga till uppgifter</b>
        <ol style="margin:8px 0 0;padding-left:20px;line-height:1.6;color:var(--ink2)">
          <li>Öppna sidan på claude.ai och klicka på <b>Dela</b> uppe till höger.</li>
          <li>Bjud in varje släkting med e-postadress som <b>redigerare</b>. De behöver ett (gratis) claude.ai-konto.</li>
          <li>Skicka länken ovan. ${v?'Den öppnar direkt i vyn '+esc(v.name)+'.':''}</li>
        </ol>
        <p class="small muted" style="margin:10px 0 0;line-height:1.5">Slå inte på delning via öppen länk om släktingarna ska kunna ändra – då kan inbjudna redigerare utanför ditt konto bara läsa. En öppen länk passar för den som bara ska titta.</p>
      </div>
      <p class="small muted" style="margin-top:12px;line-height:1.5">⚠️ Vyer döljer i visningen, men skyddar inte uppgifterna: den som har tillgång kan byta till <i>Hela släkten</i>. Lägg inte in sådant du inte vill att alla inbjudna ska kunna se.</p>`
    :`<p style="line-height:1.55;margin-top:-6px">Den här kopian körs utanför claude.ai, så allt sparas bara i din webbläsare och kan inte delas härifrån.</p>
      <p style="line-height:1.55">För ett gemensamt träd: använd versionen på claude.ai och bjud in släkten där, eller exportera en säkerhetskopia (Import/export) och skicka filen så kan andra läsa in den.</p>`}
    <div class="foot"><button class="btn" data-x>Stäng</button></div>`,(ov,close)=>{
    ov.querySelector('[data-x]').onclick=close;
    const c=ov.querySelector('#shC'); if(c) c.onclick=async()=>{try{await navigator.clipboard.writeText(link); toast('Länken är kopierad');}catch(e){const i=ov.querySelector('#shL'); i.select(); toast('Markerad – tryck Ctrl/Cmd+C');}};
  });
}
async function fillNames(root){
  const els=[...root.querySelectorAll('[data-uid]')]; if(!els.length||!Store.user) return;
  try{const ps=await Store.user.profiles([...new Set(els.map(e=>e.dataset.uid))]); for(const e of els){const p=ps[e.dataset.uid]; e.textContent=p&&p.isMe?'dig':(p&&p.name)||'någon i släkten';}}catch(e){}
}
$('#viewBtn').onclick=openViewMenu;
/* ============ Global search ============ */
(function(){
  const q=$('#q'),res=$('#qres'); let hl=0,items=[];
  const draw=()=>{res.innerHTML=items.map((p,i)=>`<div class="item ${i===hl?'hl':''}" data-id="${p.id}"><span class="dot" style="background:${sexColor(p)}"></span><b>${esc(fullName(p))}</b> <span class="muted small">${esc(lifespan(p))} ${esc(placeName(p.birthPlace))}</span></div>`).join('')||'<div class="item muted">Ingen träff</div>'; res.classList.add('open'); res.querySelectorAll('[data-id]').forEach(el=>el.onmousedown=e=>{e.preventDefault();pick(el.dataset.id);});};
  const pick=id=>{q.value='';res.classList.remove('open');q.blur(); setFocus(id); ui.treeKey=null; showPerson(id);};
  q.oninput=()=>{const t=norm(q.value); if(!t){res.classList.remove('open');return;} items=Object.values(S.persons).filter(p=>norm(fullName(p)).includes(t)).slice(0,12); hl=0; draw();};
  q.onkeydown=e=>{if(!res.classList.contains('open')) return; if(e.key==='ArrowDown'){hl=Math.min(hl+1,items.length-1);draw();e.preventDefault();} if(e.key==='ArrowUp'){hl=Math.max(hl-1,0);draw();e.preventDefault();} if(e.key==='Enter'&&items[hl]) pick(items[hl].id); if(e.key==='Escape'){res.classList.remove('open');}};
  q.onblur=()=>setTimeout(()=>res.classList.remove('open'),120);
})();
$('#home').addEventListener('click',e=>{e.preventDefault(); ui.sel=null; if(location.hash!=='#start') location.hash='start'; else renderAll(true);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.placing){ui.placing=null; if(ui.view==='karta') renderMap();}});
window.addEventListener('resize',()=>{clearTimeout(window._rz); window._rz=setTimeout(()=>{ui.treeKey=null; mapState.drawn=false; renderAll();},200);});

/* ============ Demo ============ */
function demoData(){
  const now=new Date().toISOString();
  const pl=(id,name,lat,lon,county,country='Sverige',notes='')=>({kind:'place',id,name,lat,lon,county,country,notes});
  const places=[
    pl('pl_rydbo','Rydboholm',59.474,18.226,'Uppland','Sverige','Vasaättens sätesgård i Östra Ryd. Gustav Vasa föddes troligen här, möjligen på Lindholmen.'),
    pl('pl_sthlm','Stockholm, Tre Kronor',59.327,18.071,'Uppland'),
    pl('pl_uppsala','Uppsala',59.858,17.638,'Uppland','Sverige','Domkyrkan är kröningskyrka och gravkyrka för Gustav Vasa och Johan III.'),
    pl('pl_strangnas','Strängnäs',59.377,17.032,'Södermanland'),
    pl('pl_vadstena','Vadstena',58.448,14.890,'Östergötland'),
    pl('pl_tynnelso','Tynnelsö',59.300,17.140,'Södermanland'),
    pl('pl_stegeborg','Stegeborg',58.433,16.590,'Östergötland'),
    pl('pl_gripsholm','Gripsholm',59.257,17.219,'Södermanland'),
    pl('pl_nykoping','Nyköping',58.753,17.008,'Södermanland'),
    pl('pl_orbyhus','Örbyhus',60.230,17.700,'Uppland'),
    pl('pl_vasteras','Västerås',59.611,16.545,'Västmanland'),
    pl('pl_stromsholm','Strömsholm',59.528,16.250,'Västmanland'),
    pl('pl_gbg','Göteborg',57.708,11.974,'Västergötland'),
    pl('pl_liuksiala','Liuksiala, Kangasala',61.460,24.070,'Tavastland','Finland'),
    pl('pl_krakow','Kraków',50.062,19.937,'','Polen'),
    pl('pl_warszawa','Warszawa',52.230,21.011,'','Polen'),
    pl('pl_vilnius','Vilnius',54.687,25.280,'','Litauen'),
    pl('pl_lutzen','Lützen',51.257,12.142,'Sachsen','Tyskland'),
    pl('pl_konigsberg','Königsberg',54.710,20.510,'Preussen','Ryssland (Kaliningrad)'),
    pl('pl_heidelberg','Heidelberg',49.398,8.672,'Pfalz','Tyskland'),
    pl('pl_innsbruck','Innsbruck',47.269,11.404,'Tyrolen','Österrike'),
    pl('pl_rom','Rom',41.902,12.454,'','Italien'),
    pl('pl_nevers','Nevers',46.990,3.159,'','Frankrike'),
  ];
  const src=(id,title,type,archive,ref,url,notes='')=>({kind:'source',id,title,type,archive,ref,url,notes,createdAt:now});
  const sources=[
    src('s_sbl','Svenskt biografiskt lexikon (SBL)','Webbplats','Riksarkivet','','https://sok.riksarkivet.se/sbl/','Biografiska artiklar om kungar och furstar.'),
    src('s_skbl','Svenskt kvinnobiografiskt lexikon (SKBL)','Webbplats','Göteborgs universitet','','https://skbl.se/','Artiklar om drottningar och prinsessor, bl.a. Margareta Leijonhufvud och Karin Månsdotter.'),
    src('s_kungl','Sveriges regenter – Kungliga slotten','Webbplats','Kungliga Hovstaterna','','https://www.kungligaslotten.se/','Översikt över regenter, gemåler och barn.'),
  ];
  const c=(sid,about,detail)=>({id:uid('c'),sourceId:sid,about,detail});
  const per=(id,given,surname,sex,bd,bp,dd,dp,occ,f,m,sp=[],extra={})=>Object.assign({kind:'person',id,given,surname,sex,birthDate:bd,birthPlace:bp||'',deathDate:dd,deathPlace:dp||'',occupation:occ,fatherId:f||'',motherId:m||'',spouseIds:sp,events:[],citations:[],media:[],notes:'',createdAt:now},extra);
  const ev=(type,date,placeId,desc,withId)=>({id:uid('e'),type,date,placeId:placeId||'',desc:desc||'',withId:withId||''});
  const G='p_gustav1',KS='p_kat_sachsen',ML='p_margareta',KST='p_kat_stenbock';
  const persons=[
    // Gustav Vasa och hans tre hustrur
    per(G,'Gustav','Vasa','M','1496-05-12','pl_rydbo','1560-09-29','pl_sthlm','Kung av Sverige 1523–1560','','',[KS,ML,KST],{createdAt:'1000',home:true,
      notes:'Född Gustav Eriksson. Födelseorten är osäker – Rydboholm eller Lindholmen i Uppland.\n\nDatum i exemplet följer den julianska kalendern (”gamla stilen”) som gällde i Sverige till 1753.',
      events:[ev('Övrigt','1521-08-23','pl_vadstena','Vald till riksföreståndare'),ev('Övrigt','1523-06-06','pl_strangnas','Vald till kung – Sveriges nationaldag'),ev('Vigsel','1531-09-24','pl_sthlm','',KS),ev('Vigsel','1536-10-01','','',ML),ev('Kröning','1528-01-12','pl_uppsala','Krönt i Uppsala domkyrka'),ev('Vigsel','1552-08-22','pl_vadstena','',KST),ev('Begravning','1560-12-21','pl_uppsala','Uppsala domkyrka')],
      citations:[c('s_sbl','','Gustav I'),c('s_kungl','','Gustav I')]}),
    per(KS,'Katarina','av Sachsen-Lauenburg','K','1513-09-24','','1535-09-23','pl_sthlm','Drottning','','',[G],{citations:[c('s_kungl','','Katarina av Sachsen-Lauenburg')]}),
    per(ML,'Margareta','Leijonhufvud','K','1516-01-01','','1551-08-26','pl_tynnelso','Drottning','','',[G],{notes:'Född Margareta Eriksdotter. Födelsedagen 1 januari 1516 är traditionell; SKBL anger att datum och plats är osäkra.',citations:[c('s_skbl','','Margareta, drottning'),c('s_skbl','Död','dog på Tynnelsö')]}),
    per(KST,'Katarina','Stenbock','K','1535-07-22','','1621-12-13','pl_stromsholm','Drottning','','',[G],{notes:'Systerdotter till Margareta Leijonhufvud. Inga barn med Gustav Vasa.'}),
    // Barn med Katarina av Sachsen-Lauenburg
    per('p_erik14','Erik XIV','','M','1533-12-13','pl_sthlm','1577-02-26','pl_orbyhus','Kung av Sverige 1560–1568',G,KS,['p_karin'],{
      events:[ev('Kröning','1561-06-29','pl_uppsala'),ev('Vigsel','1568-07-04','pl_sthlm','',"p_karin"),ev('Övrigt','1568','pl_sthlm','Avsatt av sina bröder Johan och Karl')],citations:[c('s_sbl','','Erik XIV')]}),
    per('p_karin','Karin','Månsdotter','K','1550-11-06','pl_sthlm','1612-09-13','pl_liuksiala','Drottning','','',['p_erik14'],{events:[ev('Kröning','1568-07-05','pl_sthlm')],notes:'Begravd i Åbo domkyrka.',citations:[c('s_skbl','','Karin Månsdotter, drottning')]}),
    per('p_sigrid','Sigrid','Eriksdotter Vasa','K','1566','','1633','','','p_erik14','p_karin'),
    per('p_gustav_e','Gustav','Eriksson Vasa','M','1568-01-28','pl_nykoping','1607','','Prins','p_erik14','p_karin',[],{notes:'Levde större delen av livet i landsflykt och dog i Ryssland.'}),
    // Barn med Margareta Leijonhufvud
    per('p_johan3','Johan III','','M','1537-12-20','pl_stegeborg','1592-11-17','pl_sthlm','Kung av Sverige 1568–1592',G,ML,['p_katjag','p_gunilla'],{
      events:[ev('Vigsel','1562-10-04','pl_vilnius','','p_katjag'),ev('Kröning','1569-07-10','pl_uppsala')],citations:[c('s_sbl','','Johan III')]}),
    per('p_katarina_g','Katarina','Gustavsdotter Vasa','K','1539','','1610','','Grevinna av Ostfriesland',G,ML),
    per('p_cecilia','Cecilia','Gustavsdotter Vasa','K','1540','','1627','','Markgrevinna av Baden-Rodemachern',G,ML),
    per('p_magnus','Magnus','Gustavsson Vasa','M','1542','','1595','','Hertig av Östergötland',G,ML),
    per('p_karl_1544','Karl','Gustavsson Vasa','M','1544','','1544','','',G,ML,[],{notes:'Dog som spädbarn.'}),
    per('p_anna_g','Anna','Gustavsdotter Vasa','K','1545','','1610','','Pfalzgrevinna av Veldenz',G,ML),
    per('p_sten','Sten','Gustavsson Vasa','M','1546','','1547','','',G,ML,[],{notes:'Dog som spädbarn.'}),
    per('p_sofia','Sofia','Gustavsdotter Vasa','K','1547','','1611','','Hertiginna av Sachsen-Lauenburg',G,ML),
    per('p_elisabet','Elisabet','Gustavsdotter Vasa','K','1549','','1597','','Hertiginna av Mecklenburg-Gadebusch',G,ML),
    per('p_karl9','Karl IX','','M','1550-10-04','pl_sthlm','1611-10-30','pl_nykoping','Kung av Sverige 1604–1611',G,ML,['p_maria_pf','p_kristina_hg'],{
      events:[ev('Vigsel','1579-05-11','pl_heidelberg','','p_maria_pf'),ev('Vigsel','1592-08-27','pl_nykoping','','p_kristina_hg'),ev('Kröning','1607-03-15','pl_uppsala')],citations:[c('s_sbl','','Karl IX'),c('s_kungl','','Karl IX – barn')]}),
    // Johan III:s familj
    per('p_katjag','Katarina','Jagellonica','K','1526-11-01','pl_krakow','1583-09-16','pl_sthlm','Drottning','','',['p_johan3']),
    per('p_gunilla','Gunilla','Bielke','K','1568','','1597','','Drottning','','',['p_johan3']),
    per('p_sigismund','Sigismund','','M','1566-06-20','pl_gripsholm','1632-04-30','pl_warszawa','Kung av Sverige 1592–1599 och av Polen 1587–1632','p_johan3','p_katjag',['p_anna_o','p_konstantia'],{citations:[c('s_sbl','','Sigismund')]}),
    per('p_anna_j','Anna','Johansdotter Vasa','K','1568','','1625','','Prinsessa','p_johan3','p_katjag'),
    per('p_johan_og','Johan','Johansson Vasa','M','1589','','1618','','Hertig av Östergötland','p_johan3','p_gunilla'),
    per('p_anna_o','Anna','av Österrike','K','1573','','1598','pl_warszawa','Drottning av Polen','','',['p_sigismund']),
    per('p_konstantia','Konstantia','av Österrike','K','1588','','1631','pl_warszawa','Drottning av Polen','','',['p_sigismund']),
    per('p_wladyslaw','Władysław IV','','M','1595-06-09','pl_krakow','1648-05-20','','Kung av Polen 1632–1648','p_sigismund','p_anna_o'),
    per('p_jan2','Jan II Kazimierz','','M','1609-03-22','pl_krakow','1672-12-16','pl_nevers','Kung av Polen 1648–1668','p_sigismund','p_konstantia',[],{notes:'Den siste av Vasaätten på en kungatron.'}),
    // Karl IX:s familj
    per('p_maria_pf','Maria','av Pfalz','K','1561','','1589','pl_gripsholm','Hertiginna','','',['p_karl9']),
    per('p_kristina_hg','Kristina','av Holstein-Gottorp','K','1573','','1625','pl_gripsholm','Drottning','','',['p_karl9']),
    per('p_katarina_k','Katarina','Karlsdotter Vasa','K','1584-11-10','pl_nykoping','1638-12-13','pl_vasteras','Pfalzgrevinna','p_karl9','p_maria_pf',['p_johan_kasimir'],{notes:'Tog hand om den unga drottning Kristina efter Gustav II Adolfs död.'}),
    per('p_johan_kasimir','Johan Kasimir','av Pfalz-Zweibrücken','M','1589','','1652','','Pfalzgreve','','',['p_katarina_k'],{events:[ev('Vigsel','1615','','','p_katarina_k')]}),
    per('p_karl10','Karl X Gustav','','M','1622-11-08','pl_nykoping','1660-02-13','pl_gbg','Kung av Sverige 1654–1660','p_johan_kasimir','p_katarina_k',[],{events:[ev('Kröning','1654-06-06','pl_uppsala','Krönt samma dag som Kristina abdikerade')],notes:'Första kungen av den pfalziska ätten – Vasaätten på mödernet.'}),
    per('p_ga2','Gustav II Adolf','','M','1594-12-09','pl_sthlm','1632-11-06','pl_lutzen','Kung av Sverige 1611–1632','p_karl9','p_kristina_hg',['p_maria_el'],{
      events:[ev('Kröning','1617-10-12','pl_uppsala'),ev('Vigsel','1620-11-25','pl_sthlm','','p_maria_el'),ev('Övrigt','1632-11-06','pl_lutzen','Stupade i slaget vid Lützen')],citations:[c('s_sbl','','Gustav II Adolf')]}),
    per('p_maria_elisabet','Maria Elisabet','Karlsdotter Vasa','K','1596','','1618','','Hertiginna av Östergötland','p_karl9','p_kristina_hg'),
    per('p_karl_filip','Karl Filip','','M','1601','','1622','','Hertig av Södermanland','p_karl9','p_kristina_hg'),
    per('p_maria_el','Maria Eleonora','av Brandenburg','K','1599-11-11','pl_konigsberg','1655-03-28','pl_sthlm','Drottning','','',['p_ga2']),
    per('p_kristina','Kristina','','K','1626-12-08','pl_sthlm','1689-04-19','pl_rom','Drottning av Sverige 1632–1654','p_ga2','p_maria_el',[],{
      events:[ev('Kröning','1650-10-20','pl_sthlm'),ev('Övrigt','1654-06-06','pl_uppsala','Abdikerade på Uppsala slott'),ev('Övrigt','1655-11-03','pl_innsbruck','Konverterade offentligt till katolicismen')],
      notes:'Den sista av Vasaätten på den svenska tronen. Begravd i Peterskyrkan i Rom.',citations:[c('s_sbl','','Kristina')]}),
  ];
  return {places,sources,persons};
}
let _demoIds=null;
const demoIds=()=>_demoIds||(_demoIds=(()=>{const d=demoData(); return new Set([...d.places,...d.sources,...d.persons].map(o=>o.id));})());
const demoActive=()=>!!Store.demo;
function updateDemoBar(){const b=$('#demoBar'); if(b) b.classList.toggle('on',Store.loaded&&demoActive()); document.body.classList.toggle('demo',demoActive());}
/* The example family lives only in memory: it is never saved, so it can't
   end up in someone's own archive or in a shared tree. */
function loadDemo(){
  /* stay on the page you're on; from the start or import page, go to the tree */
  const stay=!['start','import'].includes(ui.view)&&VIEWS[ui.view];
  if(Store.demo){ if(!stay&&location.hash!=='#trad') location.hash='trad'; return; }
  const {places,sources,persons}=demoData();
  Store.demo={saved:{persons:ALL.persons,places:ALL.places,sources:ALL.sources,views:ALL.views},focus:ui.focus,viewId:ui.viewId};
  const m=a=>Object.fromEntries(a.map(o=>[o.id,clone(o)]));
  ALL.persons=m(persons); ALL.places=m(places); ALL.sources=m(sources); ALL.views={};
  ui.viewId=null; ui.focus='p_gustav1'; ui.ancGen=2; ui.descGen=3; ui.treeKey=null; ui.sel=null;
  applyView();
  toast('Det här är ett exempel. Inget sparas – dina egna uppgifter ligger kvar orörda.',5000);
  ui.fanKey=null; mapState.drawn=false;
  if(stay||location.hash==='#trad') renderAll(true); else location.hash='trad';
}
function exitDemo(quiet){
  const d=Store.demo; if(!d) return;
  Store.demo=null; Object.assign(ALL,d.saved);
  ui.viewId=d.viewId&&ALL.views[d.viewId]?d.viewId:null; ui.focus=d.focus; ui.sel=null; ui.treeKey=null;
  applyView();
  if(quiet) return;
  toast('Exemplet är stängt');
  if(location.hash!=='#start') location.hash='start'; else renderAll(true);
}
/* Older versions saved the example into the archive. Remove it quietly. */
function purgeLegacyDemo(){
  if(!Store.canEdit||!Store.isAdmin) return;
  const ids=demoIds(); if(!Object.keys(ALL.persons).some(id=>ids.has(id))) return;
  for(const p of Object.values(ALL.persons)){ if(ids.has(p.id)) continue; const q=clone(p); let ch=false;
    for(const k of ['fatherId','motherId']) if(ids.has(q[k])){q[k]='';ch=true;}
    const sp=(q.spouseIds||[]).filter(x=>!ids.has(x)); if(sp.length!==(q.spouseIds||[]).length){q.spouseIds=sp;ch=true;}
    if(ch) Store.put(q,{silent:true}); }
  for(const v of Object.values(ALL.views)){const refs=[...(v.hide||[]),...(v.hideUp||[]),...(v.hideDown||[])]; if(refs.length&&refs.every(id=>ids.has(id))) Store.del('view',v.id,{silent:true});}
  for(const [kind,col] of [['person','persons'],['place','places'],['source','sources']]) for(const id of Object.keys(ALL[col])) if(ids.has(id)) Store.del(kind,id,{silent:true});
  if(ui.focus&&ids.has(ui.focus)) ui.focus=null;
}

/* ============ Boot ============ */
route();
/* ============ SHARING (Supabase, end-to-end encrypted) ============
   A shared tree lives on the server only as ciphertext. The key is in the link's
   #fragment, so only people with the link can read it. Everyone edits a local working
   copy and publishes when they are ready; parallel edits are merged document by document. */
const Share={
  cfg:window.KLANSAGAN_CONFIG||{}, pendingJoin:null, newer:false, busy:false, _dirty:0, _ct:null,
  st:(()=>{try{return JSON.parse(localStorage.getItem('klansagan-shares')||'')||{active:null,trees:{}};}catch(e){return {active:null,trees:{}};}})(),
  save(){try{localStorage.setItem('klansagan-shares',JSON.stringify(this.st));}catch(e){}},
  enabled(){return !!this.cfg.supabaseUrl&&Store.mode!=='db';},
  cur(){return this.st.active?this.st.trees[this.st.active]:null;},
  lsKey(){return this.st.active?'klansagan-tree-'+this.st.active:'klansagan-v1';},
  link(id=this.st.active){const t=this.st.trees[id]; return `${location.origin}${location.pathname}#dela-${id}.${t.key}`;},
  archive(){return {persons:ALL.persons,places:ALL.places,sources:ALL.sources,views:ALL.views};},
  async rpc(fn,args){
    const r=await fetch(`${this.cfg.supabaseUrl}/rest/v1/rpc/${fn}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:this.cfg.supabaseKey,Authorization:'Bearer '+this.cfg.supabaseKey},body:JSON.stringify(args)});
    const txt=await r.text(); let body=null; try{body=txt?JSON.parse(txt):null;}catch(e){body=txt;}
    if(!r.ok){const m=(body&&body.message)||String(txt||r.status); const e=new Error(m); e.code=/conflict/.test(m)?'conflict':/forbidden/.test(m)?'forbidden':'server'; throw e;}
    return body;
  },
  dirty(){return this._dirty;},
  /** Download and decrypt images, 40 at a time. Returns how many arrived. */
  async fetchBlobs(ids){
    const t=this.cur(); if(!t||!ids.length) return 0; let n=0; t.uploaded=t.uploaded||{};
    for(let i=0;i<ids.length;i+=40){
      const rows=await this.rpc('kl_get_blobs',{tree:this.st.active,ids:ids.slice(i,i+40)})||[];
      for(const r of rows){ try{const v=await KinCore.decryptJSON(r.payload,t.key); await IDB.put(r.id,v); BLOB[r.id]=v; t.uploaded[r.id]=1; n++;}catch(e){console.warn('Bild kunde inte dekrypteras',r.id);} }
    }
    if(n) this.save(); return n;
  },
  /** Upload images the server doesn't have yet. */
  async uploadBlobs(data,onProg){
    const t=this.cur(); t.uploaded=t.uploaded||{}; const todo=[...blobRefs(data)].filter(id=>!t.uploaded[id]); if(!todo.length) return;
    const ws=await KinCore.writeSecret(t.key); let i=0;
    for(const id of todo){ const v=BLOB[id]||await IDB.get(id).catch(()=>null);
      if(v){ await this.rpc('kl_put_blob',{tree:this.st.active,write_secret:ws,blob_id:id,payload:await KinCore.encryptJSON(v,t.key)}); t.uploaded[id]=1; this.save(); }
      onProg&&onProg(++i,todo.length); }
  },
  recount(){const t=this.cur(); if(!t){this._dirty=0; return 0;} const now=KinCore.hashArchive(this.archive()); let n=0;
    for(const c of Object.keys(now)){const a=now[c], b=(t.base&&t.base[c])||{}; for(const id in a) if(a[id]!==b[id]) n++; for(const id in b) if(!(id in a)) n++;}
    this._dirty=n; return n;},
  changedNames(){const t=this.cur(); if(!t) return []; const b=(t.base&&t.base.persons)||{}, out=[];
    for(const p of Object.values(ALL.persons)) if(KinCore.docHash(p)!==b[p.id]) out.push((b[p.id]?'':'Ny: ')+fullName(p));
    for(const id in b) if(!ALL.persons[id]) out.push('Borttagen person'); return out;},
  changed(){if(!this.cur()) return; clearTimeout(this._ct); this._ct=setTimeout(()=>{this.recount(); this.updateStatus();},500);},
  updateStatus(){
    const b=$('#shareBtn'); if(b) b.hidden=!this.enabled()||Store.demo;
    if(Store.mode==='db') return;
    const t=this.cur();
    if(!t){setStatus('warn','Sparas bara i den här webbläsaren'); return;}
    const n=this.recount();
    if(this.newer) setStatus('warn new','Ny version finns – klicka för att hämta');
    else if(n) setStatus('warn dirty',`Delat · ${n} ${n===1?'ändring':'ändringar'} ej publicerade`);
    else setStatus('ok',`Delat · version ${t.version}`);
    const s=$('#status'); if(s){s.querySelector('span').textContent=this.newer?'Ny version':n?`${n} att publicera`:'Delat';}
  },
  async create(){
    await migrateInline();
    const key=KinCore.newKey(), data=this.archive();
    const payload=await KinCore.encryptJSON({...data,meta:{by:this.st.name||'',at:new Date().toISOString()}},key);
    const id=await this.rpc('kl_create_tree',{write_secret:await KinCore.writeSecret(key),payload});
    this.st.trees[id]={key,version:1,base:KinCore.hashArchive(data),created:new Date().toISOString(),name:treeTitle(),uploaded:{}};
    this.st.active=id; this.save(); Store.saveNow(); this.updateStatus();
    try{await this.uploadBlobs(data,(i,n)=>{if(i===1||i===n||i%10===0) toast(`Laddar upp bilder… ${i} av ${n}`,4000);});}
    catch(e){toast('Länken är klar, men alla bilder kom inte upp. De laddas upp nästa gång du publicerar.',7000);}
    return id;
  },
  async fetchVersion(id,key,ver){const rows=await this.rpc('kl_get',{tree:id,ver:ver??null}); const r=rows&&rows[0]; if(!r) throw new Error('Trädet finns inte (länken kan vara fel eller trädet borttaget).');
    return {version:r.version,at:r.created_at,data:await KinCore.decryptJSON(r.payload,key)};},
  async join(id,key){
    try{
      const known=this.st.trees[id];
      if(known&&known.key===key){this.st.active=id; this.save(); setTimeout(()=>this.check(true),300); return;}
      const v=await this.fetchVersion(id,key);
      const data={persons:v.data.persons||{},places:v.data.places||{},sources:v.data.sources||{},views:v.data.views||{}};
      this.st.trees[id]={key,version:v.version,base:KinCore.hashArchive(data),joined:new Date().toISOString(),name:'',uploaded:Object.fromEntries([...blobRefs(data)].map(b=>[b,1]))};
      this.st.active=id; this.save();
      localStorage.setItem('klansagan-tree-'+id,JSON.stringify(data));
      setTimeout(()=>{const n=Object.keys(data.persons).length; toast(`Du är med i ett delat släktträd – ${n} personer. Dina ändringar syns för de andra när du publicerar.`,7000);},600);
    }catch(e){ const msg=e&&e.name==='OperationError'?'länken verkar vara fel eller ofullständig. Kopiera hela länken igen.':(e.message||e); setTimeout(()=>toast('Kunde inte öppna det delade trädet: '+msg,8000),600); }
  },
  async check(quiet){
    const t=this.cur(); if(!t||!this.enabled()||this.busy) return;
    try{const head=await this.rpc('kl_head',{tree:this.st.active});
      if(head>t.version){ if(!this.recount()) await this.pull(true); else {this.newer=true; this.updateStatus(); if(!quiet) toast('Någon har publicerat en ny version.',5000,{label:'Hämta',fn:()=>this.pull()});} }
    }catch(e){ if(!quiet) toast('Kunde inte nå servern just nu.'); }
  },
  /** Fetch the latest version and merge in any unpublished local changes. */
  async pull(quiet){
    const t=this.cur(); if(!t) return {conflicts:[]};
    const v=await this.fetchVersion(this.st.active,t.key);
    const theirs={persons:v.data.persons||{},places:v.data.places||{},sources:v.data.sources||{},views:v.data.views||{}};
    const mine=this.archive(), hadLocal=this.recount()>0;
    const {data,conflicts}=hadLocal?KinCore.merge3(t.base,mine,theirs):{data:theirs,conflicts:[]};
    Object.assign(ALL,data); t.version=v.version; t.base=KinCore.hashArchive(theirs); this.newer=false;
    t.uploaded=t.uploaded||{}; for(const b of blobRefs(theirs)) t.uploaded[b]=1; this.save();
    applyView(); Store.saveNow(); ui.treeKey=null; renderAll(true); this.updateStatus();
    if(!quiet||conflicts.length){const by=v.data.meta&&v.data.meta.by; toast(`Hämtade version ${v.version}${by?' från '+by:''}.`+(conflicts.length?` ${conflicts.length} uppgift(er) hade ändrats av er båda – den senaste ändringen behölls.`:'')+(hadLocal?' Dina egna ändringar ligger kvar opublicerade.':''),6500);}
    return {conflicts};
  },
  async publish(){
    const t=this.cur(); if(!t||this.busy) return; if(Store.demo){toast('Stäng exemplet först.');return;}
    if(!this.st.name){ const n=await askName(); if(!n) return; this.st.name=n; this.save(); }
    this.busy=true;
    try{
      for(let attempt=0;attempt<3;attempt++){
        await migrateInline();
        const data=this.archive();
        await this.uploadBlobs(data,(i,n)=>{if(i===1||i===n||i%10===0) toast(`Laddar upp bilder… ${i} av ${n}`,4000);});
        const at=new Date().toISOString(), names=this.changedNames();
        const payload=await KinCore.encryptJSON({...data,meta:{by:this.st.name,at}},t.key);
        if(payload.length>20000000) throw new Error('Trädet är för stort att publicera (för många eller för stora bilder).');
        const meta=await KinCore.encryptJSON({by:this.st.name,at,n:this.recount(),names:names.slice(0,12),persons:Object.keys(data.persons).length},t.key);
        try{
          const args={tree:this.st.active,base_version:t.version,write_secret:await KinCore.writeSecret(t.key),payload};
          let v; try{ v=await this.rpc('kl_publish2',{...args,meta}); }catch(e2){ if(!/kl_publish2|function|404|PGRST202/i.test(e2.message)) throw e2; v=await this.rpc('kl_publish',args); }
          t.version=v; t.base=KinCore.hashArchive(data); this.newer=false; this.save(); this.updateStatus();
          toast(`Publicerat! Version ${v} syns nu för alla med länken.`,4500); return true;
        }catch(e){ if(e.code!=='conflict') throw e; this.busy=false; await this.pull(true); this.busy=true; }
      }
      throw new Error('Andra publicerar just nu – försök igen om en stund.');
    }catch(e){ toast('Kunde inte publicera: '+(e.code==='forbidden'?'länken saknar skrivrätt.':(e.message||e)),7000); }
    finally{ this.busy=false; }
  },
  async discard(){const t=this.cur(); if(!t) return; const v=await this.fetchVersion(this.st.active,t.key,t.version);
    Object.assign(ALL,{persons:v.data.persons||{},places:v.data.places||{},sources:v.data.sources||{},views:v.data.views||{}}); applyView(); Store.saveNow(); ui.treeKey=null; renderAll(true); this.updateStatus(); toast('Dina opublicerade ändringar är borttagna.');},
  async history(){const t=this.cur(); const rows=await this.rpc('kl_history',{tree:this.st.active})||[];
    for(const r of rows){ r.info=null; if(r.meta) try{r.info=await KinCore.decryptJSON(r.meta,t.key);}catch(e){} } return rows;},
  /** Make an older version the working copy. It goes live for everyone when published. */
  async restore(ver){const t=this.cur(); const v=await this.fetchVersion(this.st.active,t.key,ver);
    Object.assign(ALL,{persons:v.data.persons||{},places:v.data.places||{},sources:v.data.sources||{},views:v.data.views||{}});
    applyView(); Store.saveNow(); ui.treeKey=null; ui.sel=null; renderAll(true); this.updateStatus();
    toast(`Trädet ser nu ut som i version ${ver}. Tryck Publicera för att alla ska få det.`,7000,{label:'Publicera',fn:()=>this.publish()});},
  switchTo(id){Store.saveNow(); this.st.active=id||null; this.newer=false; this.save(); Store.loadLocal(); applyView(); ui.focus=null; ui.sel=null; ui.treeKey=null; this.updateStatus(); renderAll(true); if(id) this.check(true);},
  startPolling(){ if(this._poll) return; this._poll=setInterval(()=>this.check(true),60000); document.addEventListener('visibilitychange',()=>{if(!document.hidden) this.check(true);}); if(this.cur()) setTimeout(()=>this.check(true),1500); },
};
{const m=location.hash.match(/^#dela-([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,})$/); if(m){Share.pendingJoin={id:m[1],key:m[2]}; history.replaceState(null,'',location.pathname+location.search+'#start');}}
function treeTitle(){const h=homePerson(); const t=trees()[0]; return t?t.name:(h?'Släkten kring '+fullName(h):'Släktträd');}
async function historyModal(){
  const t=Share.cur(); if(!t) return;
  modal(`<h3>Versionshistorik</h3><p class="muted" style="margin-top:-4px">De 30 senaste publiceringarna. Du kan gå tillbaka till en tidigare version om något blivit fel.</p><div id="hList" class="hlist"><p class="muted">Hämtar…</p></div><div class="foot"><button class="btn" data-x>Stäng</button></div>`,
  async(ov,close)=>{ov.querySelector('[data-x]').onclick=close; const box=ov.querySelector('#hList');
    let rows; try{rows=await Share.history();}catch(e){box.innerHTML=`<p class="muted">Kunde inte hämta historiken${/kl_history|PGRST202|function/i.test(e.message)?' – kör filen 0003_history.sql i Supabase först.':'.'}</p>`; return;}
    const dt=d=>new Date(d).toLocaleString('sv-SE',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    box.innerHTML=rows.map((r,i)=>{const m=r.info||{}; const nm=m.names||[];
      return `<div class="hrow${r.version===t.version?' cur':''}"><div class="hv">v${r.version}</div><div class="hb"><b>${esc(m.by||(r.version===1?'Skapad':'Okänd'))}</b> <span class="muted small">${esc(dt(r.created_at))}</span>
        <div class="small">${r.version===1&&!r.meta?'Trädet delades.':m.n?`${m.n} ${m.n===1?'ändring':'ändringar'}${nm.length?': '+nm.map(esc).join(', ')+(m.n>nm.length?' …':''):''}`:'—'}</div></div>
        <div class="ha">${i===0?'<span class="tag">Senaste</span>':`<button class="btn sm" data-rv="${r.version}">Återställ</button>`}</div></div>`;}).join('')||'<p class="muted">Inga versioner.</p>';
    box.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>{const v=+b.dataset.rv; close();
      confirmBox(`Gå tillbaka till version ${v}?`,'Trädet blir som det var då. Det blir en ny version först när du publicerar, och inget försvinner ur historiken.','Återställ',async()=>{try{await Share.restore(v);}catch(e){toast('Kunde inte hämta versionen: '+(e.message||e),6000);}});});
  });
}
function askName(){return new Promise(res=>{modal(`<h3>Vad heter du?</h3><p class="muted" style="margin-top:-4px">Namnet syns för de andra när du publicerar, så att de vet vem som ändrat.</p>
  <label class="f"><span>Ditt namn</span><input class="t" id="anName" placeholder="t.ex. Adam"></label>
  <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Fortsätt</button></div>`,(ov,close)=>{const i=ov.querySelector('#anName'); i.focus();
  const done=v=>{close(); res(v);}; ov.querySelector('[data-x]').onclick=()=>done(''); ov.querySelector('[data-ok]').onclick=()=>{const v=i.value.trim(); if(!v){i.focus();return;} done(v);}; i.onkeydown=e=>{if(e.key==='Enter') ov.querySelector('[data-ok]').click();};});});}
function shareTreeModal(){
  if(!Share.enabled()){toast('Delning är inte påslagen på den här sidan.');return;}
  if(Store.demo){toast('Stäng exemplet först – exemplet kan inte delas.');return;}
  const t=Share.cur(), others=Object.entries(Share.st.trees).filter(([id])=>id!==Share.st.active);
  const n=Share.recount(), names=Share.changedNames();
  const otherList=`${others.length||t?`<div class="sgroup"><div class="slab">Byt arkiv</div>
      ${t?'<button class="btn sm" data-sw="">← Mitt lokala arkiv (inte delat)</button> ':''}${others.map(([id,o])=>`<button class="btn sm" data-sw="${id}">${esc(o.name||'Delat träd')}</button>`).join(' ')}</div>`:''}`;
  modal(t?`<h3>Delat släktträd</h3>
    <p class="muted" style="margin-top:-4px;line-height:1.5">Alla med länken kan se och ändra. Ändringar syns för de andra först när de publiceras. Trädet är krypterat – inte ens servern kan läsa det.</p>
    <label class="f"><span>Länk att skicka till släkten</span><div class="row-inline"><input class="t" id="shLink" readonly value="${esc(Share.link())}"><button class="btn" id="shCopy">Kopiera</button></div></label>
    <div class="sh-state">${Share.newer?'<b>Det finns en ny version.</b> Hämta den innan du fortsätter.':n?`<b>${n} ${n===1?'ändring':'ändringar'} att publicera</b>${names.length?`<div class="small muted" style="margin-top:4px">${names.slice(0,8).map(esc).join(', ')}${names.length>8?' …':''}</div>`:''}`:`Allt är publicerat (version ${t.version}).`}</div>
    <div class="sh-acts">${Share.newer?'<button class="btn primary" id="shPull">Hämta senaste</button>':''}<button class="btn ${Share.newer?'':'primary'}" id="shPub" ${n?'':'disabled'}>Publicera ändringar</button>${n?'<button class="btn ghost" id="shDiscard">Släng mina ändringar</button>':''}</div>
    <p><button class="btn sm" id="shHist">🕓 Versionshistorik</button></p>
    <p class="small muted">Skicka länken bara till dem som ska ha tillgång. Den som har länken kan inte uteslutas i efterhand – då får du skapa ett nytt delat träd.</p>
    ${otherList}
    <div class="foot"><button class="btn" data-x>Stäng</button></div>`
  :`<h3>Dela släktträdet</h3>
    <p style="line-height:1.55">Du får en länk som du skickar till släkten. Alla med länken kan titta och lägga till uppgifter. Deras ändringar syns för de andra när de trycker <b>Publicera</b>.</p>
    <ul class="sh-list"><li>🔒 Trädet krypteras i din webbläsare. Nyckeln finns bara i länken – varken servern eller någon annan kan läsa det.</li><li>👥 Ingen behöver konto eller lösenord.</li><li>💾 Ditt nuvarande arkiv blir startpunkten. Ditt lokala arkiv finns kvar orört.</li></ul>
    ${Object.keys(ALL.persons).length?'':'<p class="muted">Arkivet är tomt – lägg in några personer först.</p>'}
    ${otherList}
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" id="shCreate" ${Object.keys(ALL.persons).length?'':'disabled'}>Skapa delningslänk</button></div>`,
  (ov,close)=>{const q=x=>ov.querySelector(x);
    q('[data-x]').onclick=close;
    ov.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{close(); Share.switchTo(b.dataset.sw||null); toast(b.dataset.sw?'Bytte till det delade trädet.':'Du är i ditt lokala arkiv.');});
    const cp=q('#shCopy'); if(cp) cp.onclick=async()=>{const i=q('#shLink'); i.select(); try{await navigator.clipboard.writeText(i.value);}catch(e){document.execCommand('copy');} cp.textContent='Kopierad ✓';};
    const pb=q('#shPub'); if(pb) pb.onclick=async()=>{pb.disabled=true; pb.textContent='Publicerar…'; const ok=await Share.publish(); close(); if(ok) shareTreeModal();};
    const pl=q('#shPull'); if(pl) pl.onclick=async()=>{pl.disabled=true; await Share.pull(); close(); shareTreeModal();};
    const hs=q('#shHist'); if(hs) hs.onclick=()=>{close(); historyModal();};
    const dc=q('#shDiscard'); if(dc) dc.onclick=()=>{close(); confirmBox('Släng dina ändringar?','Allt du ändrat sedan senaste publiceringen försvinner.','Släng',()=>Share.discard());};
    const cr=q('#shCreate'); if(cr) cr.onclick=async()=>{ if(!Share.st.name){const nm=await askName(); if(!nm) return; Share.st.name=nm; Share.save();}
      cr.disabled=true; cr.textContent='Krypterar och laddar upp…';
      try{await Share.create(); close(); shareTreeModal(); toast('Klart! Kopiera länken och skicka den till släkten.',5000);}
      catch(e){cr.disabled=false; cr.textContent='Skapa delningslänk'; toast('Kunde inte skapa delningen: '+(e.message||e),7000);} };
  });
}
{const sb=$('#shareBtn'); if(sb) sb.onclick=shareTreeModal; const st=$('#status'); if(st) st.onclick=()=>{ if(Share.newer) Share.pull(); else if(Share.enabled()) shareTreeModal(); };}
/* ============ Install as an app (PWA) ============ */
const PWA={prompt:null,
  standalone:()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,
  ios:()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),
  can(){return !this.standalone()&&(!!this.prompt||this.ios());},
  async install(){
    if(this.prompt){this.prompt.prompt(); const r=await this.prompt.userChoice.catch(()=>null); this.prompt=null; if(r&&r.outcome==='accepted') toast('Klansagan finns nu på din hemskärm.'); renderAll(); return;}
    if(this.ios()) modal(`<h3>Lägg Klansagan på hemskärmen</h3><ol class="ios-steps"><li>Tryck på <b>Dela</b>-knappen <span class="ios-share">⬆︎</span> längst ner i Safari.</li><li>Välj <b>Lägg till på hemskärmen</b>.</li><li>Tryck <b>Lägg till</b>. Nu öppnas Klansagan som en egen app.</li></ol><div class="foot"><button class="btn primary" data-x>Klar</button></div>`,(ov,close)=>{ov.querySelector('[data-x]').onclick=close;});
  }};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); PWA.prompt=e; if(Store.loaded) renderAll();});
window.addEventListener('appinstalled',()=>{PWA.prompt=null;});
if('serviceWorker' in navigator&&location.protocol==='https:'&&window.top===window&&Store.mode!=='db'&&!/claude\.(ai|site)|claudeusercontent/.test(location.hostname)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(e=>console.warn('Service worker',e)));
}
Store.init();
