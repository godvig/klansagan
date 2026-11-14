/* Släktsagan · share.js — Sharing: end-to-end encrypted trees on Supabase, publish, merge, history. */
import { Unpub } from './backup.js?v=45';
import { BLOB, IDB, blobRefs, fullName, homePerson, migrateInline } from './domain.js?v=45';
import { confirmBox, modal } from './modal.js?v=45';
import { renderAll } from './router.js?v=45';
import { trees } from './start.js?v=45';
import { ALL, applyView, archiveData, cols, ui } from './state.js?v=45';
import { Hist, Store, setStatus } from './store.js?v=45';
import { $, esc, toast } from './util.js?v=45';

/* ============ Boot ============ */
/* ============ SHARING (Supabase, end-to-end encrypted) ============
   A shared tree lives on the server only as ciphertext. The key is in the link's
   #fragment, so only people with the link can read it. Everyone edits a local working
   copy and publishes when they are ready; parallel edits are merged document by document.

   Two kinds of shared trees exist:
   - old ones (t.key): one key, in the link, that both reads and publishes.
   - new ones (t.v===2): a read key t.r and an editor key t.e. The edit link carries both,
     the read-only link only t.r. Publishing needs a secret derived from t.e. Living people's
     details, comments, and places, sources and photos only they use are encrypted with t.e,
     so a reader can't decrypt them even with the raw payload. Older keys are kept in t.keys
     (and inside the editors' part) so editors can still open older versions. */
const Share={
  cfg:window.KLANSAGAN_CONFIG||{}, pendingJoin:null, newer:false, busy:false, _dirty:0, _ct:null,
  st:(()=>{try{return JSON.parse(localStorage.getItem('klansagan-shares')||'')||{active:null,trees:{}};}catch(e){return {active:null,trees:{}};}})(),
  save(){try{localStorage.setItem('klansagan-shares',JSON.stringify(this.st));}catch(e){}},
  enabled(){return !!this.cfg.supabaseUrl&&Store.mode!=='db';},
  cur(){return this.st.active?this.st.trees[this.st.active]:null;},
  lsKey(){return this.st.active?'klansagan-tree-'+this.st.active:'klansagan-v1';},
  base(){return location.origin+location.pathname;},
  link(id=this.st.active){const t=this.st.trees[id]; if(!t) return ''; if(t.v!==2) return `${this.base()}#dela-${id}.${t.key}`; return t.e?`${this.base()}#dela-${id}.${t.r}.${t.e}`:this.readLink(id);},
  readLink(id=this.st.active){const t=this.st.trees[id]; return t&&t.v===2?`${this.base()}#visa-${id}.${t.r}`:'';},
  readOnly(){const t=this.cur(); return !!t&&t.v===2&&!t.e;},
  /** The key whose write secret publishes, or null for readers. */
  wkey(t=this.cur()){return !t?null:t.v===2?(t.e||null):t.key;},
  applyRole(){ if(Store.mode==='db') return; Store.canEdit=!this.readOnly(); },
  /** Encrypt an archive as one version payload for tree t. */
  async encode(data,meta,t){
    if(t.v!==2) return KinCore.encryptJSON({...data,meta},t.key);
    const {pub,priv}=KinCore.splitForReaders(data,new Date().getFullYear());
    priv.keys=t.keys||[];
    return KinCore.encryptJSON({v:2,...pub,meta,priv:await KinCore.encryptJSON(priv,t.e)},t.r);
  },
  /** Try keys in turn. */
  async tryKeys(payload,keys){let err; for(const k of keys.filter(Boolean)){ try{return await KinCore.decryptJSON(payload,k);}catch(e){err=e;} } throw err||new Error('Ingen nyckel');},
  /** Decrypt a version payload. Returns {data, meta, lost}: lost means an editor's key no longer opens the editors' part. */
  async decode(payload,t){
    if(t.v!==2){const d=await KinCore.decryptJSON(payload,t.key); return {data:cols(d),meta:d.meta};}
    const d=await this.tryKeys(payload,[t.r,...(t.keys||[])]);
    if(d.v!==2) return {data:cols(d),meta:d.meta}; // a version from before the tree got read-only links
    const pub=cols(d); pub.comments={};
    if(!t.e) return {data:pub,meta:d.meta};
    let priv; try{priv=await this.tryKeys(d.priv,[t.e,...(t.keys||[])]);}catch(e){return {data:pub,meta:d.meta,lost:true};}
    for(const k of priv.keys||[]) if(!(t.keys||[]).includes(k)){(t.keys=t.keys||[]).push(k);}
    return {data:cols(KinCore.joinPrivate(pub,priv)),meta:d.meta};
  },
  /** Which photos go where: [serverId, localId, key] for every photo this tree should have on the server. */
  async blobPlan(data,t=this.cur()){
    if(t.v!==2) return [...blobRefs(data)].map(id=>[id,id,t.key]);
    const {pub}=KinCore.splitForReaders(data,new Date().getFullYear()), pubRefs=blobRefs(pub), rt=await KinCore.keyTag(t.r);
    const out=[...pubRefs].map(id=>[rt+'_'+id,id,t.r]);
    if(t.e){const et=await KinCore.keyTag(t.e); for(const id of blobRefs(data)) if(!pubRefs.has(id)) out.push([et+'_'+id,id,t.e]);}
    return out;
  },
  archive(){return archiveData();},
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
    /** @type {[string,string,string][]} */ let want;
    if(t.v!==2) want=ids.map(id=>[id,id,t.key]);
    else { const rt=await KinCore.keyTag(t.r), et=t.e?await KinCore.keyTag(t.e):null;
      want=ids.flatMap(id=>[[rt+'_'+id,id,t.r],...(et?[[et+'_'+id,id,t.e]]:[])]); }
    const by=new Map(want.map(w=>[w[0],w]));
    for(let i=0;i<want.length;i+=40){
      const rows=await this.rpc('kl_get_blobs',{tree:this.st.active,ids:want.slice(i,i+40).map(w=>w[0])})||[];
      for(const r of rows){ const w=by.get(r.id); if(!w||BLOB[w[1]]) continue;
        try{const v=await KinCore.decryptJSON(r.payload,w[2]); await IDB.put(w[1],v); BLOB[w[1]]=v; t.uploaded[r.id]=1; n++;}catch(e){console.warn('Bild kunde inte dekrypteras',r.id);} }
    }
    if(n) this.save(); return n;
  },
  /** Upload images the server doesn't have yet. */
  async uploadBlobs(data,onProg){
    const t=this.cur(); if(!this.wkey(t)) return; t.uploaded=t.uploaded||{}; const todo=(await this.blobPlan(data,t)).filter(([sid])=>!t.uploaded[sid]); if(!todo.length) return;
    const ws=await KinCore.writeSecret(this.wkey(t)); let i=0;
    for(const [sid,id,key] of todo){ const v=BLOB[id]||await IDB.get(id).catch(()=>null);
      if(v){ await this.rpc('kl_put_blob',{tree:this.st.active,write_secret:ws,blob_id:sid,payload:await KinCore.encryptJSON(v,key)}); t.uploaded[sid]=1; this.save(); }
      onProg&&onProg(++i,todo.length); }
  },
  /** Mark every photo the server already has for this archive as uploaded. */
  async markUploaded(t,data){t.uploaded={}; for(const [sid] of await this.blobPlan(data,t)) t.uploaded[sid]=1;},
  recount(){const t=this.cur(); if(!t||this.readOnly()){this._dirty=0; return 0;} const now=KinCore.hashArchive(this.archive()); let n=0;
    for(const c of Object.keys(now)){const a=now[c], b=(t.base&&t.base[c])||{}; for(const id in a) if(a[id]!==b[id]) n++; for(const id in b) if(!(id in a)) n++;}
    this._dirty=n; return n;},
  changedNames(){const t=this.cur(); if(!t) return []; const b=(t.base&&t.base.persons)||{}, out=[];
    for(const p of Object.values(ALL.persons)) if(KinCore.docHash(p)!==b[p.id]) out.push((b[p.id]?'':'Ny: ')+fullName(p));
    for(const id in b) if(!ALL.persons[id]) out.push('Borttagen person'); return out;},
  changed(){if(!this.cur()) return; clearTimeout(this._ct); this._ct=setTimeout(()=>{this.recount(); this.updateStatus();},500); Unpub.arm();},
  updateStatus(){
    const b=$('#shareBtn'); if(b) b.hidden=!this.enabled()||Store.demo;
    if(Store.mode==='db') return;
    const t=this.cur();
    if(!t){setStatus('warn','Sparas bara i den här webbläsaren'); return;}
    if(this.readOnly()){ setStatus(this.newer?'warn new':'ok',this.newer?'Ny version finns – klicka för att hämta':`Läsversion · version ${t.version}`); const s=$('#status'); if(s) s.querySelector('span').textContent='Läser'; return; }
    const n=this.recount();
    if(this.newer) setStatus('warn new','Ny version finns – klicka för att hämta');
    else if(n) setStatus('warn dirty',`Delat · ${n} ${n===1?'ändring':'ändringar'} ej publicerade`);
    else setStatus('ok',`Delat · version ${t.version}`);
    const s=$('#status'); if(s){s.querySelector('span').textContent=this.newer?'Ny version':n?`${n} att publicera`:'Delat';}
  },
  async create(){
    await migrateInline();
    const t={v:2,r:KinCore.newKey(),e:KinCore.newKey(),keys:[],version:1,created:new Date().toISOString(),name:treeTitle(),uploaded:{}}, data=this.archive();
    const payload=await this.encode(data,{by:this.st.name||'',at:new Date().toISOString()},t);
    const id=await this.rpc('kl_create_tree',{write_secret:await KinCore.writeSecret(t.e),payload});
    this.st.trees[id]={...t,base:KinCore.hashArchive(data)};
    this.st.active=id; this.save(); Store.saveNow(); this.updateStatus();
    try{await this.uploadBlobs(data,(i,n)=>{if(i===1||i===n||i%10===0) toast(`Laddar upp bilder… ${i} av ${n}`,4000);});}
    catch(e){toast('Länken är klar, men alla bilder kom inte upp. De laddas upp nästa gång du publicerar.',7000);}
    return id;
  },
  /** A version decrypted for tree t (defaults to the active tree). */
  async fetchVersion(id,t,ver){const rows=await this.rpc('kl_get',{tree:id,ver:ver??null}); const r=rows&&rows[0]; if(!r) throw new Error('Trädet finns inte (länken kan vara fel eller trädet borttaget).');
    try{ const d=await this.decode(r.payload,t); return {version:r.version,at:r.created_at,...d}; }
    catch(e){ const x=new Error('Länken öppnar inte längre trädet. Den kan ha bytts ut – be den som delade om en ny länk.'); x.code='key'; throw x; }},
  /** Open a link. kind: 'edit' (#dela-) or 'read' (#visa-). An old-style link has a single key. */
  async join(id,r,e,kind='edit'){
    try{
      const known=this.st.trees[id];
      if(known&&(known.key===r||known.r===r&&(!e||known.e===e))){this.st.active=id; this.save(); this.applyRole(); setTimeout(()=>this.check(true),300); return;}
      // Work out which kind of tree this is from what the key opens.
      const rows=await this.rpc('kl_get',{tree:id,ver:null}); const row=rows&&rows[0]; if(!row) throw new Error('Trädet finns inte (länken kan vara fel eller trädet borttaget).');
      let probe; try{probe=await KinCore.decryptJSON(row.payload,r);}catch(err){const x=new Error('länken verkar vara fel, ofullständig eller utbytt. Kopiera hela länken igen, eller be om en ny.'); throw x;}
      /** @type {any} */ let t;
      if(probe.v===2) t={v:2,r,keys:[],...(e?{e}:{})};
      else { if(kind==='read') throw new Error('det här är en gammal länk utan läsläge.'); t={key:r}; }
      const v=await this.decode(row.payload,t);
      if(v.lost) throw new Error('redigeringsnyckeln i länken stämmer inte längre. Be om en ny länk.');
      const data=v.data;
      Object.assign(t,{version:row.version,base:KinCore.hashArchive(data),joined:new Date().toISOString(),name:(known&&known.name)||''});
      await this.markUploaded(t,data);
      this.st.trees[id]=t; this.st.active=id; this.save(); this.applyRole();
      await Store.writeArchive('klansagan-tree-'+id,data);
      const ro=t.v===2&&!t.e;
      setTimeout(()=>{const n=Object.keys(data.persons).length; toast(ro?`Du tittar på ett delat släktträd – ${n} personer. Levande personer visas med namn och födelseår.`:`Du är med i ett delat släktträd – ${n} personer. Dina ändringar syns för de andra när du publicerar.`,7000);},600);
    }catch(err){ setTimeout(()=>toast('Kunde inte öppna det delade trädet: '+(err.message||err),8000),600); }
  },
  async check(quiet){
    const t=this.cur(); if(!t||!this.enabled()||this.busy) return;
    try{const head=await this.rpc('kl_head',{tree:this.st.active});
      if(head>t.version&&!t.stale){ if(!this.recount()) await this.pull(true); else {this.newer=true; this.updateStatus(); if(!quiet) toast('Någon har publicerat en ny version.',5000,{label:'Hämta',fn:()=>this.pull()});} }
    }catch(e){ if(!quiet) toast('Kunde inte nå servern just nu.'); }
  },
  /** Fetch the latest version and merge in any unpublished local changes. */
  async pull(quiet){
    const t=this.cur(); if(!t) return {conflicts:[]};
    let v; try{ v=await this.fetchVersion(this.st.active,t); }catch(e){ if(e.code==='key'){ t.stale=true; this.save(); this.newer=false; this.updateStatus(); if(!quiet) toast(e.message,8000); return {conflicts:[]}; } throw e; }
    if(v.lost){ delete t.e; t.lostEdit=true; this.save(); this.applyRole(); toast('Redigeringslänken till det här trädet har bytts ut. Du kan fortfarande läsa det, men be om den nya länken för att kunna ändra.',9000); }
    const theirs=v.data;
    const mine=this.archive(), hadLocal=this.recount()>0, oldBase=t.base, oldVer=t.version;
    const {data,conflicts}=hadLocal?KinCore.merge3(t.base,mine,theirs):{data:theirs,conflicts:[]};
    Object.assign(ALL,data); Hist.clear(); t.version=v.version; t.base=KinCore.hashArchive(theirs); this.newer=false;
    t.uploaded=t.uploaded||{}; for(const [sid] of await this.blobPlan(theirs,t)) t.uploaded[sid]=1; this.save();
    if(v.version!==oldVer) await this.noteNews(t,oldBase,mine,theirs,oldVer,v,quiet);
    applyView(); Store.saveNow(); ui.treeKey=null; renderAll(true); this.updateStatus();
    if(!quiet||conflicts.length){const by=v.meta&&v.meta.by; toast(`Hämtade version ${v.version}${by?' från '+by:''}.`+(conflicts.length?` ${conflicts.length} uppgift(er) hade ändrats av er båda – den senaste ändringen behölls.`:'')+(hadLocal?' Dina egna ändringar ligger kvar opublicerade.':''),6500);}
    return {conflicts};
  },
  /** Remember what others changed, for "Nytt sedan sist" on the start page. */
  async noteNews(t,oldBase,mine,theirs,oldVer,v,quiet){
    try{
      const d=KinCore.diffNews(oldBase,mine,theirs,this.st.name||'');
      let by=[v.meta&&v.meta.by].filter(Boolean);
      if(v.version-oldVer>1&&this.wkey(t)){ try{ by=(await this.history()).filter(r=>r.version>oldVer&&r.info&&r.info.by).map(r=>r.info.by).reverse(); }catch(e){} }
      by=by.filter(b=>b!==this.st.name);
      const before=t.news; t.news=KinCore.addNews(t.news,d,by,new Date().toISOString()); this.save();
      if(quiet&&t.news!==before){ const n=d.added.length+Object.keys(d.changed).length; const who=by.length?by.join(' och '):'Någon';
        toast(`${who} har publicerat ändringar${n?` (${n} ${n===1?'person':'personer'})`:''}. Se "Nytt sedan sist" på startsidan.`,7000); }
    }catch(e){ console.warn('Kunde inte räkna fram nyheter',e); }
  },
  /** What's waiting to be seen in the active tree, without people who have since been removed. */
  news(){const t=this.cur(); return t&&t.news?KinCore.pruneNews(t.news,ALL):null;},
  seen(){const t=this.cur(); if(t){delete t.news; this.save();}},
  async publish(){
    const t=this.cur(); if(!t||this.busy) return; if(Store.demo){toast('Stäng exemplet först.');return;} if(!this.wkey(t)){toast('Du har en läslänk och kan inte publicera.');return;}
    if(!this.st.name){ const n=await askName(); if(!n) return; this.st.name=n; this.save(); }
    this.busy=true;
    try{
      for(let attempt=0;attempt<3;attempt++){
        await migrateInline();
        const data=this.archive();
        await this.uploadBlobs(data,(i,n)=>{if(i===1||i===n||i%10===0) toast(`Laddar upp bilder… ${i} av ${n}`,4000);});
        const at=new Date().toISOString(), names=this.changedNames();
        const payload=await this.encode(data,{by:this.st.name,at},t);
        if(payload.length>20000000) throw new Error('Trädet är för stort att publicera (för många eller för stora bilder).');
        const meta=await KinCore.encryptJSON({by:this.st.name,at,n:this.recount(),names:names.slice(0,12),persons:Object.keys(data.persons).length},this.wkey(t));
        try{
          const args={tree:this.st.active,base_version:t.version,write_secret:await KinCore.writeSecret(this.wkey(t)),payload};
          let v; try{ v=await this.rpc('kl_publish2',{...args,meta}); }catch(e2){ if(!/kl_publish2|function|404|PGRST202/i.test(e2.message)) throw e2; v=await this.rpc('kl_publish',args); }
          t.version=v; t.base=KinCore.hashArchive(data); this.newer=false; this.save(); this.updateStatus();
          toast(`Publicerat! Version ${v} syns nu för alla med länken.`,4500); return true;
        }catch(e){ if(e.code!=='conflict') throw e; this.busy=false; await this.pull(true); this.busy=true; }
      }
      throw new Error('Andra publicerar just nu – försök igen om en stund.');
    }catch(e){ toast('Kunde inte publicera: '+(e.code==='forbidden'?'länken saknar skrivrätt.':(e.message||e)),7000); }
    finally{ this.busy=false; }
  },
  async discard(){const t=this.cur(); if(!t) return; const v=await this.fetchVersion(this.st.active,t,t.version);
    Object.assign(ALL,v.data); Hist.clear(); applyView(); Store.saveNow(); ui.treeKey=null; renderAll(true); this.updateStatus(); toast('Dina opublicerade ändringar är borttagna.');},
  async history(){const t=this.cur(); const rows=await this.rpc('kl_history',{tree:this.st.active})||[];
    const keys=t.v===2?[t.e,...(t.keys||[])]:[t.key];
    for(const r of rows){ r.info=null; if(r.meta) try{r.info=await this.tryKeys(r.meta,keys);}catch(e){} } return rows;},
  /** Make an older version the working copy. It goes live for everyone when published. */
  async restore(ver){const t=this.cur(); const v=await this.fetchVersion(this.st.active,t,ver);
    Object.assign(ALL,v.data); Hist.clear();
    applyView(); Store.saveNow(); ui.treeKey=null; ui.sel=null; renderAll(true); this.updateStatus();
    toast(`Trädet ser nu ut som i version ${ver}. Tryck Publicera för att alla ska få det.`,7000,{label:'Publicera',fn:()=>this.publish()});},
  async switchTo(id){await Store.saveNow(); this.st.active=id||null; this.newer=false; this.save(); this.applyRole(); await Store.loadLocal(); applyView(); ui.focus=null; ui.sel=null; ui.treeKey=null; this.updateStatus(); renderAll(true); if(id) this.check(true);},
  /**
   * New keys for the active tree, published as a new version in one step.
   * what: 'upgrade' (old single-key tree → read-only links), 'edit' (new edit link),
   * 'read' (new read-only link). Old keys stay with the editors so history still opens.
   */
  async rekey(what){
    const t=this.cur(); if(!t||!this.wkey(t)||this.busy) return false;
    if(!this.st.name){ const n=await askName(); if(!n) return false; this.st.name=n; this.save(); }
    this.busy=true;
    try{
      await migrateInline();
      if(this.newer) { this.busy=false; await this.pull(true); this.busy=true; }
      const data=this.archive();
      // Photos must be here before they can be encrypted again under the new keys.
      const missing=[]; for(const id of blobRefs(data)) if(!BLOB[id]&&!await IDB.get(id).catch(()=>null)) missing.push(id);
      if(missing.length) await this.fetchBlobs(missing);
      const old=t.v===2?[t.r,t.e]:[t.key];
      const nt={...t,v:2,r:what==='edit'?t.r:KinCore.newKey(),e:what==='read'?t.e:KinCore.newKey(),keys:[...new Set([...(t.keys||[]),...old])],uploaded:{}};
      if(what==='upgrade'){ nt.r=KinCore.newKey(); nt.e=KinCore.newKey(); delete nt.key; }
      const at=new Date().toISOString();
      const payload=await this.encode(data,{by:this.st.name,at},nt);
      const meta=await KinCore.encryptJSON({by:this.st.name,at,n:this.recount(),names:[what==='read'?'Ny läslänk':what==='edit'?'Ny redigeringslänk':'Läslänk skapad'],persons:Object.keys(data.persons).length},nt.e);
      const v=await this.rpc('kl_rekey',{tree:this.st.active,base_version:t.version,write_secret:await KinCore.writeSecret(this.wkey(t)),new_write_hash:await KinCore.sha256hex(await KinCore.writeSecret(nt.e)),payload,meta});
      nt.version=v; nt.base=KinCore.hashArchive(data); delete nt.key; this.st.trees[this.st.active]=nt; this.newer=false; this.save(); this.updateStatus();
      try{ await this.uploadBlobs(data,(i,n)=>{if(i===1||i===n||i%10===0) toast(`Krypterar om bilder… ${i} av ${n}`,4000);}); }catch(e){ toast('Alla bilder kom inte upp. De laddas upp nästa gång du publicerar.',7000); }
      return true;
    }catch(e){ toast('Kunde inte byta länk: '+(/kl_rekey|PGRST202|function/i.test(e.message)?'kör filen 0004_rekey.sql i Supabase först.':e.code==='conflict'?'någon publicerade samtidigt – försök igen.':e.code==='forbidden'?'länken saknar skrivrätt.':(e.message||e)),8000); return false; }
    finally{ this.busy=false; }
  },
  startPolling(){ if(this._poll) return; this._poll=setInterval(()=>this.check(true),60000); document.addEventListener('visibilitychange',()=>{if(!document.hidden) this.check(true);}); if(this.cur()) setTimeout(()=>this.check(true),1500); },
};
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
  const linkRow=(id,label,val,hint)=>`<label class="f"><span>${label}</span><div class="row-inline"><input class="t" id="${id}" readonly value="${esc(val)}"><button class="btn" data-copy="${id}">Kopiera</button></div>${hint?`<small class="muted">${hint}</small>`:''}</label>`;
  const ro=Share.readOnly(), v2=t&&t.v===2;
  const stateBox=`<div class="sh-state">${Share.newer?'<b>Det finns en ny version.</b> Hämta den innan du fortsätter.':n?`<b>${n} ${n===1?'ändring':'ändringar'} att publicera</b>${names.length?`<div class="small muted" style="margin-top:4px">${names.slice(0,8).map(esc).join(', ')}${names.length>8?' …':''}</div>`:''}`:`Allt är publicerat (version ${t&&t.version}).`}</div>
    <div class="sh-acts">${Share.newer?'<button class="btn primary" id="shPull">Hämta senaste</button>':''}<button class="btn ${Share.newer?'':'primary'}" id="shPub" ${n?'':'disabled'}>Publicera ändringar</button>${n?'<button class="btn ghost" id="shDiscard">Släng mina ändringar</button>':''}</div>
    <p><button class="btn sm" id="shHist">🕓 Versionshistorik</button></p>`;
  modal(t&&ro?`<h3>Delat släktträd – läsläge</h3>
    <p class="muted" style="margin-top:-4px;line-height:1.5">Du har en läslänk. Du ser trädet och hämtar nya versioner automatiskt, men kan inte ändra. Personer som lever visas bara med namn och födelseår.</p>
    ${t.lostEdit?'<p class="small" style="color:var(--warn)">Redigeringslänken du hade har bytts ut. Be den som delade trädet om den nya.</p>':''}
    ${Share.newer?'<p><button class="btn primary" id="shPull">Hämta senaste</button></p>':`<p class="small muted">Version ${t.version}.</p>`}
    <p class="small muted">Har du fått en redigeringslänk? Öppna den så byter du till redigeringsläge.</p>
    ${otherList}
    <div class="foot"><button class="btn" data-x>Stäng</button></div>`
  :t&&v2?`<h3>Delat släktträd</h3>
    <p class="muted" style="margin-top:-4px;line-height:1.5">Ändringar syns för de andra först när de publiceras. Trädet är krypterat – inte ens servern kan läsa det.</p>
    ${linkRow('shLink','✏️ Redigeringslänk – kan ändra',Share.link(),'Bara till dem som ska kunna lägga till och rätta.')}
    ${linkRow('shRead','👀 Läslänk – kan bara titta',Share.readLink(),'Levande personer visas med namn och födelseår. Frågor och kommentarer syns inte.')}
    ${stateBox}
    <details class="sgroup"><summary class="slab" style="cursor:pointer">Byt ut en länk</summary>
      <p class="small muted" style="line-height:1.5">Den gamla länken slutar fungera direkt. Skicka den nya till dem som ska ha den. Dina opublicerade ändringar följer med.</p>
      <button class="btn sm" id="shNewEdit">Ny redigeringslänk</button> <button class="btn sm" id="shNewRead">Ny läslänk</button></details>
    ${otherList}
    <div class="foot"><button class="btn" data-x>Stäng</button></div>`
  :t?`<h3>Delat släktträd</h3>
    <p class="muted" style="margin-top:-4px;line-height:1.5">Alla med länken kan se och ändra. Ändringar syns för de andra först när de publiceras. Trädet är krypterat – inte ens servern kan läsa det.</p>
    ${linkRow('shLink','Länk att skicka till släkten',Share.link(),'')}
    ${stateBox}
    <div class="sh-up"><b>Nytt: läslänk</b><p class="small" style="line-height:1.5;margin:4px 0 8px">Få en länk som bara kan titta, där personer som lever visas med namn och födelseår. Du får också en ny redigeringslänk, och den gamla länken slutar fungera – skicka den nya till dem som ska kunna ändra.</p><button class="btn sm primary" id="shUpgrade">Skapa läslänk</button></div>
    ${otherList}
    <div class="foot"><button class="btn" data-x>Stäng</button></div>`
  :`<h3>Dela släktträdet</h3>
    <p style="line-height:1.55">Du får en länk som du skickar till släkten. Alla med länken kan titta och lägga till uppgifter. Deras ändringar syns för de andra när de trycker <b>Publicera</b>.</p>
    <ul class="sh-list"><li>👀 Du får också en läslänk för dem som bara ska titta. Där visas personer som lever bara med namn och födelseår.</li><li>🔒 Trädet krypteras i din webbläsare. Nyckeln finns bara i länken – varken servern eller någon annan kan läsa det.</li><li>👥 Ingen behöver konto eller lösenord.</li><li>💾 Ditt nuvarande arkiv blir startpunkten. Ditt lokala arkiv finns kvar orört.</li></ul>
    ${Object.keys(ALL.persons).length?'':'<p class="muted">Arkivet är tomt – lägg in några personer först.</p>'}
    ${otherList}
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" id="shCreate" ${Object.keys(ALL.persons).length?'':'disabled'}>Skapa delningslänk</button></div>`,
  (ov,close)=>{const q=x=>ov.querySelector(x);
    q('[data-x]').onclick=close;
    ov.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{close(); Share.switchTo(b.dataset.sw||null); toast(b.dataset.sw?'Bytte till det delade trädet.':'Du är i ditt lokala arkiv.');});
    ov.querySelectorAll('[data-copy]').forEach(cp=>cp.onclick=async()=>{const i=q('#'+cp.dataset.copy); i.select(); try{await navigator.clipboard.writeText(i.value);}catch(e){document.execCommand('copy');} cp.textContent='Kopierad ✓';});
    const rk=(sel,what,title,text)=>{const b=q(sel); if(b) b.onclick=()=>{close(); confirmBox(title,text,'Byt',async()=>{ if(await Share.rekey(what)){ shareTreeModal(); toast('Klart! Kopiera den nya länken och skicka den.',6000);} });};};
    rk('#shUpgrade','upgrade','Skapa läslänk?','Du får en läslänk och en ny redigeringslänk. Den gamla länken slutar fungera, så skicka den nya redigeringslänken till dem som ska kunna ändra.');
    rk('#shNewEdit','edit','Byta redigeringslänk?','Den nuvarande redigeringslänken slutar fungera för alla. De som har den kan fortfarande titta, som med läslänken. Skicka den nya till dem som ska fortsätta ändra.');
    rk('#shNewRead','read','Byta läslänk?','Både läslänken och redigeringslänken byts ut och de gamla slutar fungera. Skicka de nya länkarna till dem som ska ha dem.');
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

export { Share, treeTitle, historyModal, askName, shareTreeModal };
