/* Släktsagan · router.js — Hash routing, renderAll and the empty state. */
import { renderCard } from './card.js?v=48';
import { loadDemo, updateDemoBar } from './demo.js?v=48';
import { P, homePerson } from './domain.js?v=48';
import { renderDups } from './dups.js?v=48';
import { renderFan } from './fan.js?v=48';
import { renderImport } from './importexport.js?v=48';
import { mapState, renderMap } from './map.js?v=48';
import { renderPanel } from './panel.js?v=48';
import { renderPersons } from './persons.js?v=48';
import { renderSources } from './places.js?v=48';
import { renderRel } from './relationship.js?v=48';
import { renderAbout, renderStart } from './start.js?v=48';
import { ALL, APP_VERSION, S, activeView, applyView, ui } from './state.js?v=48';
import { Store, updateUndoBtns } from './store.js?v=48';
import { renderTimeline } from './timeline.js?v=48';
import { reachInLockedTree, renderTree } from './tree.js?v=48';
import { $, esc, toast } from './util.js?v=48';
import { updateViewBtn } from './views.js?v=48';

/* ============ Router ============ */
const VIEWS={om:renderAbout,start:renderStart,trad:renderTree,solfjader:renderFan,personer:renderPersons,slaktskap:renderRel,personkort:renderCard,dubbletter:renderDups,tidslinje:renderTimeline,karta:renderMap,kallor:renderSources,import:renderImport};
const NAVMAP={personkort:'personer',dubbletter:'personer'};
/** The "Mer" button names the page you're on when that page lives in its menu. */
function updateMoreBtn(){const mb=$('#moreBtn'); if(!mb) return; const desk=!matchMedia('(max-width:1100px)').matches, onA=document.querySelector(desk?'#morePop a.on:not(.mob-only)':'#morePop a.on'), inMore=!!onA; mb.classList.toggle('on',inMore); mb.querySelector('span').firstChild.textContent=inMore?onA.querySelector('b').textContent:'Mer';}
function route(){const h=location.hash.slice(1); if(h.startsWith('vy-')){ui.pendingView=h.slice(3); location.replace('#trad'); return;} if(h==='exempel'){ui.pendingDemo=true; location.replace('#trad'); return;} ui.view=VIEWS[h]?h:'start'; followSelection(); if(matchMedia('(max-width:700px)').matches&&!ui.keepSel) ui.sel=null; ui.keepSel=false; /* on phones the person sheet would cover the new tab */ const nv=NAVMAP[ui.view]||ui.view; document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===nv)); {updateMoreBtn(); $('#morePop').classList.remove('open');} $('#view').scrollTop=0; ui.treeKey=null; mapState.drawn=false; renderAll(true);}
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
  renderPanel(); updateDemoBar(); updateViewBtn(); updateUndoBtns();
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
/* Phone bottom sheet: tap or drag the handle up to expand, down to shrink or close. */
/** On phones: shrink the sheet to a small strip so the page behind it (e.g. the map) shows. */
function sheetMini(){ if(!matchMedia('(max-width:700px)').matches) return; ui.keepSel=true; const pn=$('#panel'); pn.classList.remove('expanded'); pn.classList.add('mini'); pn.scrollTop=0; }
function bindSheet(pn){
  const h=pn.querySelector('.sheet-handle'); if(!h) return;
  const lbl=()=>{h.querySelector('span').textContent=pn.classList.contains('expanded')?'Visa mindre':'Visa mer'; h.setAttribute('aria-label',h.querySelector('span').textContent);};
  const setExp=on=>{ if(on&&pn.classList.contains('mini')){pn.classList.remove('mini'); lbl(); return;} pn.classList.toggle('expanded',on); if(!on) pn.scrollTop=0; lbl();};
  lbl();
  let y0=null, moved=false;
  h.onpointerdown=e=>{y0=e.clientY; moved=false; h.setPointerCapture(e.pointerId);};
  h.onpointermove=e=>{if(y0!=null&&Math.abs(e.clientY-y0)>8) moved=true;};
  h.onpointerup=e=>{ if(y0==null) return; const dy=e.clientY-y0; y0=null;
    if(!moved) return setExp(!pn.classList.contains('expanded'));
    if(dy<-30) setExp(true);
    else if(dy>30){ if(pn.classList.contains('expanded')) setExp(false); else if(!pn.classList.contains('mini')) {pn.classList.add('mini'); lbl();} else select(null); } };
  const top=pn.querySelector('.ph .top h3'); if(top) top.onclick=()=>{ if(matchMedia('(max-width:700px)').matches&&!pn.classList.contains('expanded')) setExp(true); };
}
function select(type,id){ui.sel=id?{type,id}:null; renderAll();}
function showPerson(id,{focus}={}){if(focus) setFocus(id); select('person',id);}
/* Clicking a name in the side panel moves the current view to that person. */
function followPerson(id){
  if(ui.view==='trad'&&ui.treeLock){
    if(ui.treeShown&&ui.treeShown.has(id)){ ui.treePan=id; select('person',id); } else reachInLockedTree(id);
    return; }
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

export { VIEWS, NAVMAP, updateMoreBtn, route, lastView, renderAll, followSelection, setFocus, sheetMini, bindSheet, select, showPerson, followPerson, emptyState };
