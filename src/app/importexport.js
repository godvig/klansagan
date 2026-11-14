/* Släktsagan · importexport.js — Excel/CSV and GEDCOM import, export (GEDCOM, CSV, JSON backup). */
import { Backup } from './backup.js?v=44';
import { exitDemo } from './demo.js?v=44';
import { P, blobId, blobUrl, ensurePlace, fullName, partners, personLabel, placeName } from './domain.js?v=44';
import { confirmBox, modal } from './modal.js?v=44';
import { E } from './panel.js?v=44';
import { renderAll, setFocus } from './router.js?v=44';
import { ALL, COLS, KIND, S, ui, withAll } from './state.js?v=44';
import { Hist, Store } from './store.js?v=44';
import { $, clone, dateKey, esc, gedDate, norm, parseDelimited, toast, uid, yearOf } from './util.js?v=44';

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
    ${Store.mode!=='db'&&!Store.demo&&Object.keys(ALL.persons).length?Backup.box():''}
    ${E.canEdit?`<div class="box"><h3>1. Läs in din släktlista</h3>
      <p>Välj en <b>GEDCOM-fil</b> (.ged) från ett annat släktprogram – Disgen, MyHeritage, Ancestry, Geni, Holger, Legacy… – eller en Excel-fil (.xlsx, .xls) eller CSV med en rad per person. Du kan också kopiera cellerna i Excel och klistra in dem nedan.</p>
      <div class="drop" id="drop"><b>Släpp filen här</b> eller klicka för att välja<input type="file" id="impFile" accept=".ged,.gedcom,.xlsx,.xls,.csv,.tsv,.txt,.ods" hidden></div>
      <details style="margin-top:12px"><summary style="cursor:pointer;color:var(--accent)">…eller klistra in från Excel</summary>
        <textarea class="t" id="impPaste" style="margin-top:8px;min-height:120px;font-family:ui-monospace,monospace;font-size:12px" placeholder="Förnamn&#9;Efternamn&#9;Född&#9;Födelseort&#9;Far&#9;Mor"></textarea>
        <button class="btn sm" id="impPasteBtn" style="margin-top:6px">Läs in inklistrat</button></details>
      <div style="margin-top:12px" class="small muted">Osäker på formatet? <a href="#" id="tplDl">Ladda ner en mall</a> med rätt kolumner.</div>
    </div>
    <div id="impStep2"></div>`:''}
    <div class="box"><h3>Exportera</h3>
      <p>GEDCOM är standardformatet som MyHeritage, Ancestry, Geni, Disgen och de flesta släktprogram kan läsa.</p>
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
  v.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>doExport(b.dataset.exp).then(()=>{ if(b.dataset.exp==='json') renderImport(true); }));
  {const bb=$('#bkSave'); if(bb) bb.onclick=async()=>{bb.disabled=true; bb.textContent='Sparar…'; try{await Backup.save();}finally{renderImport(true);}};}
  if(!E.canEdit) return;
  const drop=$('#drop'),fi=$('#impFile');
  drop.onclick=()=>fi.click();
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('over');};
  drop.ondragleave=()=>drop.classList.remove('over');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over'); if(e.dataTransfer.files[0]) readImportFile(e.dataTransfer.files[0]);};
  fi.onchange=()=>fi.files[0]&&readImportFile(fi.files[0]);
  $('#impPasteBtn').onclick=()=>{const t=$('#impPaste').value; if(!t.trim()) return; setImportRows(parseDelimited(t));};
  $('#tplDl').onclick=e=>{e.preventDefault(); saveFile('slaktsagan-import-template.csv','\ufeff'+['Id;Förnamn;Efternamn;Kön;Född;Födelseort;Död;Dödsort;Yrke;Far;Mor;Make/maka;Källa;Anteckningar','1;Erik;Larsson;M;1798-03-02;Rättvik;1861-11-20;Rättvik;Bonde;;;2;Rättvik C:9;','2;Kerstin;Olsdotter;K;1801;Leksand;1870;Rättvik;;;;1;;','3;Lars;Ersson;M;1826-05-14;Rättvik;1889;Rättvik;Bonde;1;2;;Rättvik AI:15 sid 45;'].join('\r\n'));};
  if($('#restore')) $('#restore').onchange=e=>{const f=e.target.files[0]; if(!f) return; f.text().then(t=>{let o; try{o=JSON.parse(t);}catch(x){toast('Filen är inte giltig JSON');return;} const objs=COLS.flatMap(c=>Object.values(o[c]||{})).filter(x=>x&&x.id&&KIND[x.kind]); if(!objs.length){toast('Hittade inga poster i filen');return;} confirmBox('Återställ '+objs.length+' poster?','Poster med samma id ersätts av versionen i filen.','Återställ',()=>(Hist.label('Återställning från säkerhetskopia',3000), Store.putMany(objs).then(()=>toast('Återställt ✓'))));});};
  if($('#wipe')) $('#wipe').onclick=()=>modal(`<h3>Töm hela arkivet?</h3><p>Alla ${Object.keys(ALL.persons).length} personer, ${Object.keys(S.sources).length} källor och ${Object.keys(S.places).length} platser tas bort. Exportera en säkerhetskopia först! Skriv <b>TÖM</b> för att bekräfta.</p><input class="t" id="wipeIn"><div class="foot" style="margin-top:12px"><button class="btn" data-x>Avbryt</button><button class="btn primary" style="background:var(--err);border-color:var(--err)" data-ok>Töm arkivet</button></div>`,(ov,close)=>{ov.querySelector('[data-x]').onclick=close; ov.querySelector('[data-ok]').onclick=async()=>{if(ov.querySelector('#wipeIn').value.trim().toUpperCase()!=='TÖM')return; close(); ui.sel=null; ui.focus=null; const all=[...Object.values(ALL.persons),...Object.values(ALL.places),...Object.values(ALL.sources),...Object.values(ALL.views)]; for(const o of all) Store.del(o.kind,o.id,{silent:true}); renderAll(); toast('Arkivet är tömt');};});
  if(imp.rows.length) renderImportStep2();
}
function loadXLSX(){return new Promise((res,rej)=>{if(window.XLSX) return res(); const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=()=>rej(new Error('Kunde inte ladda Excel-läsaren')); document.head.appendChild(s);});}
async function readImportFile(file){
  try{
    if(/\.(ged|gedcom)(\.txt)?$/i.test(file.name)){ await importGedcom(file); return; }
    if(/\.txt$/i.test(file.name)&&/^\uFEFF?\s*0\s+HEAD/.test((await file.slice(0,64).text()))){ await importGedcom(file); return; }
    if(/\.(csv|tsv|txt)$/i.test(file.name)){ setImportRows(parseDelimited(await file.text())); return; }
    await loadXLSX();
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    imp.wb=wb; imp.sheets=wb.SheetNames;
    useSheet(wb.SheetNames[0]);
  }catch(e){toast('Kunde inte läsa filen: '+(e.message||e));}
}
/* ============ GEDCOM import ============
   The parsing lives in core.js (decodeGedcom + parseGedcom, unit tested). Here: match places and
   sources with ones already in the archive, show what was found, then save it as one undoable step. */
async function importGedcom(file){
  const {text,charset}=KinCore.decodeGedcom(new Uint8Array(await file.arrayBuffer()));
  if(!/^\s*0\s+HEAD/.test(text.replace(/^\uFEFF/,''))){toast('Det här ser inte ut som en GEDCOM-fil.',5000); return;}
  const r=KinCore.parseGedcom(text,{uid});
  if(!r.stats.persons){toast('Hittade inga personer i filen.',5000); return;}
  // reuse places and sources the archive already has (same name / title)
  const plMap={}, srcMap={}, newPl=[], newSrc=[];
  const plIdx={}; for(const x of Object.values(ALL.places)) plIdx[norm(x.name)]=x;
  const srIdx={}; for(const x of Object.values(ALL.sources)) srIdx[norm(x.title)]=x;
  for(const pl of Object.values(r.places)){const ex=plIdx[norm(pl.name)]; if(ex) plMap[pl.id]=ex.id; else newPl.push(pl);}
  for(const so of Object.values(r.sources)){const ex=srIdx[norm(so.title)]; if(ex) srcMap[so.id]=ex.id; else newSrc.push(so);}
  const pm=id=>plMap[id]||id, sm=id=>srcMap[id]||id;
  const people=Object.values(r.persons).map(p=>{ if(p.birthPlace) p.birthPlace=pm(p.birthPlace); if(p.deathPlace) p.deathPlace=pm(p.deathPlace);
    (p.events||[]).forEach(e=>{ if(e.placeId) e.placeId=pm(e.placeId); }); (p.citations||[]).forEach(c=>c.sourceId=sm(c.sourceId)); return p; });
  const had=Object.keys(ALL.persons).length, st=r.stats, n=people.length;
  const sample=people.slice(0,6).map(p=>`<li>${esc(personLabel(p))}</li>`).join('');
  const nf=x=>x.toLocaleString('sv-SE');
  modal(`<h3>Läs in GEDCOM-fil</h3>
    <p class="muted" style="margin-top:-6px">${esc(file.name)}${r.from?' · från '+esc(r.from):''} · ${esc(charset)}</p>
    <div class="ged-stats"><div><b>${nf(n)}</b><span>personer</span></div><div><b>${nf(st.families)}</b><span>familjer</span></div><div><b>${nf(newSrc.length)}</b><span>nya källor</span></div><div><b>${nf(newPl.length)}</b><span>nya platser</span></div></div>
    <p class="small" style="margin:10px 0 4px">Bland annat:</p><ul class="ged-sample">${sample}${n>6?`<li class="muted">… och ${nf(n-6)} till</li>`:''}</ul>
    ${had?`<p class="ged-note">Personerna läggs till bredvid dina ${nf(had)}. Finns samma person redan kan du slå ihop dem under <b>Hitta dubbletter</b> efteråt – och hela inläsningen går att ångra.</p>`:''}
    ${r.warnings.length?`<details class="ged-warn"><summary>${r.warnings.length} ${r.warnings.length===1?'sak':'saker'} att känna till</summary><ul>${r.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></details>`:''}
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Läs in ${nf(n)} personer</button></div>`,
  (ov,close)=>{
    ov.querySelector('[data-x]').onclick=close;
    const ok=ov.querySelector('[data-ok]');
    ok.onclick=async()=>{ ok.disabled=true; ok.textContent='Läser in…';
      Hist.label(`Import av ${nf(n)} personer från GEDCOM`,5000);
      await Store.putMany([...newPl,...newSrc,...people],f=>{ok.textContent=`Läser in… ${Math.round(f*100)} %`;});
      close();
      const first=people[0]; if(!had&&first){ setFocus(first.id); ui.treeKey=null; }
      toast(`${nf(n)} personer inlästa från ${esc(file.name)}.`,7000,{label:'Visa i trädet',fn:()=>{ if(first){setFocus(first.id); ui.treeKey=null;} location.hash='trad'; }});
      renderAll();
    };
  });
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
  Hist.label(`Import av ${objs.filter(o=>o.kind==='person').length} personer`,3000);
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
  if(kind==='json'){ const inl=async col=>{const o=clone(ALL[col]); for(const d of Object.values(o)) {const map={}; for(const m of d.media||[]){ if(blobId(m)){const old=m.url; m.url=await blobUrl(m); map[old]=m.url;} delete m.thumb; } for(const m of d.media||[]) if(m.forImg&&map[m.forImg]) m.forImg=map[m.forImg];} return o;};
    const [persons,places,sources]=await Promise.all([inl('persons'),inl('places'),inl('sources')]);
    saveFile(`slaktsagan-${stamp}.json`,JSON.stringify({app:'Släktsagan',version:1,exported:new Date().toISOString(),persons,places,sources,views:ALL.views,comments:ALL.comments},null,1)); Backup.mark(); }
  if(kind==='csv'){
    const ids={}; Object.values(S.persons).forEach((p,i)=>ids[p.id]=i+1);
    const c=v=>{v=String(v??''); return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    const lines=['Id;Förnamn;Efternamn;Kön;Född;Födelseort;Död;Dödsort;Yrke;Far;Mor;Make/maka;Källa;Anteckningar'];
    for(const p of Object.values(S.persons)) lines.push([ids[p.id],p.given,p.surname,p.sex,p.birthDate,placeName(p.birthPlace),p.deathDate,placeName(p.deathPlace),p.occupation,ids[p.fatherId]||'',ids[p.motherId]||'',(p.spouseIds||[]).map(x=>ids[x]).filter(Boolean).join(','),(p.citations||[]).map(x=>S.sources[x.sourceId]?.title).filter(Boolean).join(' | '),p.notes].map(c).join(';'));
    saveFile(`slaktsagan-people-${stamp}.csv`,'\ufeff'+lines.join('\r\n'));
  }
  if(kind==='ged'){ saveFile(`slaktsagan-${stamp}.ged.txt`,toGedcom()); toast('Ta bort ”.txt” i filnamnet innan du läser in den i ett släktprogram.',5000); }
}
function toGedcom(){
  const L=[]; const add=(lvl,tag,val)=>{val=val==null?'':String(val).replace(/\r?\n/g,' '); L.push(lvl+' '+tag+(val?' '+val:''));};
  const note=(lvl,txt)=>{const lines=String(txt).split(/\r?\n/); add(lvl,'NOTE',lines[0]); lines.slice(1).forEach(l=>add(lvl+1,'CONT',l));};
  const iid={},sid={}; let n=1; Object.values(S.persons).forEach(p=>iid[p.id]='@I'+(n++)+'@'); n=1; Object.values(S.sources).forEach(s=>sid[s.id]='@S'+(n++)+'@');
  const fams={}; const famKey=(a,b)=>[a||'',b||''].join('+');
  const getFam=(h,w)=>{const k=famKey(h,w); return fams[k]=fams[k]||{id:'@F'+(Object.keys(fams).length+1)+'@',h,w,c:[]};};
  for(const p of Object.values(S.persons)){ if(p.fatherId||p.motherId) getFam(P(p.fatherId)?p.fatherId:'',P(p.motherId)?p.motherId:'').c.push(p.id); }
  for(const p of Object.values(S.persons)) for(const s of partners(p)){ const [h,w]=p.sex==='K'?[s.id,p.id]:[p.id,s.id]; if(!fams[famKey(h,w)]&&!fams[famKey(w,h)]) getFam(h,w); }
  add(0,'HEAD'); add(1,'SOUR','SLAKTSAGAN'); add(2,'NAME','Släktsagan'); add(1,'GEDC'); add(2,'VERS','5.5.1'); add(2,'FORM','LINEAGE-LINKED'); add(1,'CHAR','UTF-8'); add(1,'DATE',gedDate(new Date().toISOString().slice(0,10)));
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

export { FIELDS, imp, renderImport, loadXLSX, readImportFile, importGedcom, useSheet, setImportRows, applyHeader, renderImportStep2, mapRow, runImport, saveFile, doExport, doExport0, toGedcom };
