/* Släktsagan · views.js — Views that hide branches. */
import { P, fullName, personLabel } from './domain.js?v=47';
import { mapState } from './map.js?v=47';
import { confirmBox, modal } from './modal.js?v=47';
import { personByLabel } from './panel.js?v=47';
import { renderAll } from './router.js?v=47';
import { Share, shareTreeModal } from './share.js?v=47';
import { ALL, HIDDEN, activeView, applyView, ui, viewCounts, withAll } from './state.js?v=47';
import { Store } from './store.js?v=47';
import { $, clone, computeHidden, esc, genitive, slugify, toast, uid } from './util.js?v=47';

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

export { ARTIFACT_URL, viewLink, setActiveView, updateViewBtn, openViewMenu, ruleLabel, baseForView, quickBranches, viewModal, personByLabelAll, hideModal, shareModal, fillNames };
