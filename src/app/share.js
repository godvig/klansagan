/* Släktsagan · share.js — Sharing: end-to-end encrypted trees on Supabase, publish, merge, history. */
import { Unpub } from './backup.js?v=38';
import { BLOB, IDB, blobRefs, fullName, homePerson, migrateInline } from './domain.js?v=38';
import { confirmBox, modal } from './modal.js?v=38';
import { renderAll } from './router.js?v=38';
import { trees } from './start.js?v=38';
import { ALL, applyView, archiveData, cols, ui } from './state.js?v=38';
import { Hist, Store, setStatus } from './store.js?v=38';
import { $, esc, toast } from './util.js?v=38';

/* ============ Boot ============ */
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
  changed(){if(!this.cur()) return; clearTimeout(this._ct); this._ct=setTimeout(()=>{this.recount(); this.updateStatus();},500); Unpub.arm();},
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
      const data=cols(v.data);
      this.st.trees[id]={key,version:v.version,base:KinCore.hashArchive(data),joined:new Date().toISOString(),name:'',uploaded:Object.fromEntries([...blobRefs(data)].map(b=>[b,1]))};
      this.st.active=id; this.save();
      await Store.writeArchive('klansagan-tree-'+id,data);
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
    const theirs=cols(v.data);
    const mine=this.archive(), hadLocal=this.recount()>0;
    const {data,conflicts}=hadLocal?KinCore.merge3(t.base,mine,theirs):{data:theirs,conflicts:[]};
    Object.assign(ALL,data); Hist.clear(); t.version=v.version; t.base=KinCore.hashArchive(theirs); this.newer=false;
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
    Object.assign(ALL,cols(v.data)); Hist.clear(); applyView(); Store.saveNow(); ui.treeKey=null; renderAll(true); this.updateStatus(); toast('Dina opublicerade ändringar är borttagna.');},
  async history(){const t=this.cur(); const rows=await this.rpc('kl_history',{tree:this.st.active})||[];
    for(const r of rows){ r.info=null; if(r.meta) try{r.info=await KinCore.decryptJSON(r.meta,t.key);}catch(e){} } return rows;},
  /** Make an older version the working copy. It goes live for everyone when published. */
  async restore(ver){const t=this.cur(); const v=await this.fetchVersion(this.st.active,t.key,ver);
    Object.assign(ALL,cols(v.data)); Hist.clear();
    applyView(); Store.saveNow(); ui.treeKey=null; ui.sel=null; renderAll(true); this.updateStatus();
    toast(`Trädet ser nu ut som i version ${ver}. Tryck Publicera för att alla ska få det.`,7000,{label:'Publicera',fn:()=>this.publish()});},
  async switchTo(id){await Store.saveNow(); this.st.active=id||null; this.newer=false; this.save(); await Store.loadLocal(); applyView(); ui.focus=null; ui.sel=null; ui.treeKey=null; this.updateStatus(); renderAll(true); if(id) this.check(true);},
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

export { Share, treeTitle, historyModal, askName, shareTreeModal };
