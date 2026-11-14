/* Släktsagan · store.js — Saving and loading: undo/redo history, IndexedDB/localStorage, the artifact database, photos and voice memories as blobs. */
import { Backup, Unpub } from './backup.js?v=42';
import { purgeLegacyDemo } from './demo.js?v=42';
import { IDB, P, backfillThumbs, fullName, migrateInline } from './domain.js?v=42';
import { renderAll } from './router.js?v=42';
import { Share } from './share.js?v=42';
import { ALL, COLS, KIND, applyView, archiveData, cols, ui } from './state.js?v=42';
import { $, clone, toast } from './util.js?v=42';

/* ============ Store ============ */
/* ============ Undo / redo ============
   Every write through Store.put/del/putMany is recorded. Writes that happen close together
   (one click that touches several people, an upload and its face framing) become one action. */
const Hist={h:KinCore.createHistory({limit:60}), _t:null, _hold:450, applying:false,
  rec(kind,id,before,after){
    if(this.applying) return;
    if(!Store.canEdit) return;
    const strip=o=>o?JSON.stringify(Object.assign({},o,{updatedAt:0,updatedBy:0})):'';
    if(strip(before)===strip(after)) return;
    this.h.record({kind,id,before:before?clone(before):null,after:after?clone(after):null},this._next||undefined);
    clearTimeout(this._t); this._t=setTimeout(()=>{this.h.close(); this._hold=450; this._next=null; updateUndoBtns();},this._hold);
    updateUndoBtns();
  },
  /** Name the current action; hold keeps it open longer for slow multi-step work. */
  label(l,hold){ if(hold) this._hold=hold; if(this.h.isOpen()) this.h.label(l); this._next=l;
    clearTimeout(this._lt); this._lt=setTimeout(()=>{ if(!this.h.isOpen()) this._next=null; },hold||450); },
  clear(){ this.h.clear(); updateUndoBtns(); },
  describe(g){ if(!g) return '';
    if(g.label) return g.label;
    const ch=g.changes, nm=d=>d?(d.kind==='person'?fullName(d):d.kind==='source'?(d.title||'källa'):(d.name||'')):'';
    if(ch.length===1){const c=ch[0], d=c.after||c.before; return (c.before?c.after?'Ändring av ':'Borttagning av ':'Ny: ')+nm(d);}
    const ppl=ch.filter(c=>c.kind==='person');
    const verb=ppl.every(c=>!c.before)?'Ny: ':ppl.every(c=>!c.after)?'Borttagning av ':'Ändring av ';
    return ppl.length?`${verb}${nm(ppl[0].after||ppl[0].before)}${ppl.length>1?` och ${ppl.length-1} till`:''}`:`${ch.length} ändringar`;
  },
  async run(dir){
    if(!Store.canEdit) return;
    clearTimeout(this._t); this.h.close();
    const r=dir<0?this.h.undo():this.h.redo(); if(!r){toast(dir<0?'Inget att ångra.':'Inget att göra om.'); return;}
    this.applying=true;
    try{ for(const a of r.apply){ if(a.doc) await Store.put(a.doc,{silent:true,nohist:true}); else if(ALL[KIND[a.kind]][a.id]) await Store.del(a.kind,a.id,{silent:true,nohist:true}); } }
    finally{ this.applying=false; }
    if(ui.sel&&ui.sel.type==='person'&&!P(ui.sel.id)) ui.sel=null;
    renderAll(); updateUndoBtns();
    const what=this.describe(r.group);
    toast((dir<0?'Ångrade: ':'Gjorde om: ')+what,5000,{label:dir<0?'Gör om':'Ångra',fn:()=>this.run(-dir)});
  },
};
function updateUndoBtns(){
  const u=$('#undoBtn'), r=$('#redoBtn'); if(!u||!r) return;
  const on=Store.canEdit&&Store.loaded; u.hidden=r.hidden=!on;
  const pu=Hist.h.peekUndo(), pr=Hist.h.peekRedo();
  u.disabled=!pu; r.disabled=!pr;
  u.title=pu?'Ångra: '+Hist.describe(pu)+' (Ctrl+Z)':'Inget att ångra'; r.title=pr?'Gör om: '+Hist.describe(pr)+' (Ctrl+Shift+Z)':'Inget att göra om';
}
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
      if(Share.pendingJoin){const j=Share.pendingJoin; Share.pendingJoin=null; await Share.join(j.id,j.r,j.e,j.kind);}
      await this.loadLocal(); this.loaded=true; purgeLegacyDemo(); applyView();
      // IndexedDB is asynchronous and may not finish while a page closes, so unsaved edits
      // also get a synchronous emergency copy that the next start picks up.
      const flush=()=>{ if(!this._dirty) return; try{localStorage.setItem('klansagan-unsaved',JSON.stringify({k:Share.lsKey(),data:archiveData()}));}catch(e){} this.saveNow(); };
      addEventListener('pagehide',flush); document.addEventListener('visibilitychange',()=>{ if(document.hidden) flush(); });
      Share.updateStatus(); Share.startPolling();
      setTimeout(()=>Backup.remind(),5000);
      setTimeout(()=>Unpub.nudge((n,pl)=>`Välkommen tillbaka! Du har ${n} från förra gången som inte är publicerad${pl} än.`),1500);
      renderAll();
      migrateInline().then(ch=>{ if(ch){ Share.updateStatus(); renderAll(); } return backfillThumbs(); });
    }
  },
  subscribe(){
    setStatus('', 'Hämtar…');
    let timer=setTimeout(()=>setStatus('warn','Databasen svarar inte ännu'),10000);
    this.col.onSnapshot(snap=>{
      if(!snap.metadata.fromCache){clearTimeout(timer); setStatus('ok',this.canEdit?'Delas & sparas i molnet':'Endast läsning');}
      const T=this.demo?this.demo.saved:ALL;
      for(const c of COLS) T[c]={};
      for(const d of snap.docs){const o=d.data(); if(o&&KIND[o.kind]) T[KIND[o.kind]][d.id]=o;}
      if(this.demo) return;
      this.loaded=true; if(!this._purged){this._purged=true; purgeLegacyDemo();} applyView(); renderAll();
    },err=>{clearTimeout(timer); setStatus('err','Kunde inte läsa data ('+err.code+')'); this.loaded=true; renderAll();});
  },
  /* The archive text lives in IndexedDB (no 5 MB cap like localStorage). Older versions kept it
     in localStorage: it is moved over the first time and the old copy removed once the new one is safe.
     If IndexedDB is unavailable (some private modes), localStorage is still used. */
  backend:'idb',
  async loadLocal(){
    Share.applyRole();
    const k=Share.lsKey(); Object.assign(ALL,cols(null)); Hist.clear();
    const use=o=>{ if(!o) return; Object.assign(ALL,cols(o)); };
    let o=null;
    if(this.backend==='idb' && typeof indexedDB!=='undefined'){
      try{ o=await IDB.aget(k); }catch(e){ console.warn('IndexedDB unavailable, using localStorage',e); this.backend='ls'; }
    } else this.backend='ls';
    const legacy=()=>{try{const raw=localStorage.getItem(k)||(k==='klansagan-v1'?(localStorage.getItem('kinsaga-v1')||localStorage.getItem('slaktarkivet-v1')):null); return raw?JSON.parse(raw):null;}catch(e){return null;}};
    try{const u=JSON.parse(localStorage.getItem('klansagan-unsaved')||'null'); if(u&&u.k===k&&u.data){ o=u.data; if(this.backend==='idb'){ await IDB.aput(k,o); } else localStorage.setItem(k,JSON.stringify(o)); localStorage.removeItem('klansagan-unsaved'); }}catch(e){}
    if(o){ use(o); return; }
    const old=legacy(); use(old);
    if(old&&this.backend==='idb'){ // move it over, then free the old space
      try{ await IDB.aput(k,old); const back=await IDB.aget(k);
        if(back&&Object.keys(back.persons||{}).length===Object.keys(old.persons||{}).length){ for(const x of [k,'kinsaga-v1','slaktarkivet-v1']) if(x===k||k==='klansagan-v1') try{localStorage.removeItem(x);}catch(e){} }
      }catch(e){ console.warn('Could not move the archive to IndexedDB',e); this.backend='ls'; }
    }
  },
  async writeArchive(k,data){
    if(this.backend==='idb'){ try{ await IDB.aput(k,data); try{localStorage.removeItem('klansagan-unsaved');}catch(e){} return; }catch(e){ console.warn('IndexedDB write failed, falling back',e); this.backend='ls'; } }
    localStorage.setItem(k,JSON.stringify(data));
  },
  saveLocal(){
    if(this.demo) return;
    clearTimeout(this._lt);
    this._dirty=true; this._lt=setTimeout(()=>this.saveNow(),250);
  },
  saveNow(){
    clearTimeout(this._lt); this._dirty=false;
    const data=archiveData(), k=Share.lsKey();
    // IndexedDB copies the object when the write starts (structured clone), so later edits can't sneak in half-done
    const p=this.writeArchive(k,data).catch(()=>toast('Webbläsarens lagring är full – ta bort några bilder eller exportera en säkerhetskopia.',6000));
    this._saving=p; Share.changed();
    if(!this._persistAsked&&Object.keys(ALL.persons).length&&navigator.storage&&navigator.storage.persist){this._persistAsked=true; navigator.storage.persisted().then(y=>y||navigator.storage.persist()).catch(()=>{});}
    return p;
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
  put(obj,{silent,nohist}={}){
    obj=this.stamp(clone(obj));
    if(!nohist) Hist.rec(obj.kind,obj.id,ALL[KIND[obj.kind]][obj.id],obj);
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
  del(kind,id,{silent,nohist}={}){
    if(!nohist) Hist.rec(kind,id,ALL[KIND[kind]][id],null);
    delete ALL[KIND[kind]][id]; applyView();
    if(!silent) renderAll();
    if(this.demo) return Promise.resolve();
    if(this.mode==='db') return this.write(id,()=>this.retry(()=>this.col.doc(id).delete())).catch(e=>toast('Kunde inte ta bort: '+(e&&e.code||e)));
    this.saveLocal(); return Promise.resolve();
  },
  async putMany(objs,onProgress){
    let done=0; const queue=objs.slice();
    for(const o of queue){this.stamp(o); Hist.rec(o.kind,o.id,ALL[KIND[o.kind]][o.id],o); ALL[KIND[o.kind]][o.id]=clone(o);} applyView();
    if(this.demo){onProgress&&onProgress(1); renderAll(); return;}
    if(this.mode!=='db'){this.saveLocal(); onProgress&&onProgress(1); renderAll(); return;}
    renderAll();
    const worker=async()=>{while(queue.length){const o=queue.shift(); await this.write(o.id,()=>this.retry(()=>this.col.doc(o.id).set(clone(o)))).catch(e=>{console.warn(e)}); done++; onProgress&&onProgress(done/objs.length);}};
    await Promise.all([worker(),worker(),worker()]);
  }
};
function setStatus(cls,txt){const s=$('#status'); s.className='status '+cls; const short={'Sparas bara i den här webbläsaren':'Lokalt','Delas & sparas i molnet':'Delat','Endast läsning':'Läsläge','Hämtar…':'Hämtar…','Databasen svarar inte ännu':'Väntar…'}[txt]; s.querySelector('span').textContent=short||txt; s.title=txt;}

export { Hist, updateUndoBtns, Store, setStatus };
