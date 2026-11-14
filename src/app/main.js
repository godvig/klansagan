/* Släktsagan · main.js — starts the app: wires the header, routes and loads the archive.
   Every other module only declares things; everything that runs on load is here, in order. */
import { Unpub } from './backup.js?v=41';
import { fullName, lifespan, placeName, sexColor } from './domain.js?v=41';
import { mapState, renderMap } from './map.js?v=41';
import { photoTo } from './media.js?v=41';
import { PWA } from './pwa.js?v=41';
import { renderAll, route, setFocus, showPerson, updateMoreBtn } from './router.js?v=41';
import { Share, shareTreeModal } from './share.js?v=41';
import { S, ui } from './state.js?v=41';
import { Hist, Store } from './store.js?v=41';
import { applySimple, applySize, applyTheme, settingsModal } from './theme.js?v=41';
import { $, esc, norm, toast } from './util.js?v=41';
import { openViewMenu } from './views.js?v=41';
import * as util from './util.js?v=41';
import * as state from './state.js?v=41';
import * as store from './store.js?v=41';
import * as domain from './domain.js?v=41';
import * as router from './router.js?v=41';
import * as tree from './tree.js?v=41';
import * as persons from './persons.js?v=41';
import * as panel from './panel.js?v=41';
import * as media from './media.js?v=41';
import * as modal from './modal.js?v=41';
import * as places from './places.js?v=41';
import * as timeline from './timeline.js?v=41';
import * as map from './map.js?v=41';
import * as importexport from './importexport.js?v=41';
import * as theme from './theme.js?v=41';
import * as start from './start.js?v=41';
import * as fan from './fan.js?v=41';
import * as card from './card.js?v=41';
import * as dups from './dups.js?v=41';
import * as relationship from './relationship.js?v=41';
import * as print from './print.js?v=41';
import * as views from './views.js?v=41';
import * as demo from './demo.js?v=41';
import * as share from './share.js?v=41';
import * as backup from './backup.js?v=41';
import * as pwa from './pwa.js?v=41';

/** For the browser console and the browser tests: everything, under one name. */
const app = Object.freeze(Object.assign({}, util, state, store, domain, router, tree, persons, panel, media, modal, places, timeline, map, importexport, theme, start, fan, card, dups, relationship, print, views, demo, share, backup, pwa));
window.app = app;
// Handlers written inline in rendered HTML (onclick="…") look these up on window.
Object.assign(window, Object.fromEntries(['setActiveView', 'viewModal', 'activeView', 'openPersonModal', 'loadDemo', 'select', 'ui', 'goHome', 'openCard', 'shareModal', 'exitDemo', 'applySimple', 'renderAll', 'applySize', 'settingsModal', 'PWA'].map((n) => [n, app[n]])));

try{const f=localStorage.getItem('sa-focus'); if(f) ui.focus=f; const v=localStorage.getItem('sa-viewid'); if(v) ui.viewId=v;}catch(e){}
document.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey) return;
  const k=e.key.toLowerCase(); if(k!=='z'&&k!=='y') return;
  const t=/** @type {HTMLElement} */(e.target); if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; // the field's own undo
  if(document.querySelector('.modal-ov,.ov')) return;
  e.preventDefault(); Hist.run(k==='y'||e.shiftKey?1:-1);
});
matchMedia('(max-width:1100px)').addEventListener('change',updateMoreBtn);
window.addEventListener('hashchange',route);
document.addEventListener('click',e=>{ const b=/** @type {HTMLElement} */(e.target).closest&&/** @type {HTMLElement} */(e.target).closest('[data-copyaid]'); if(!b) return;
  const v=b.getAttribute('data-copyaid'); (navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(()=>toast('AID kopierat – klistra in det i ArkivDigital för att öppna bilden.'),()=>toast('AID: '+v,6000)); });
{ let dragDepth=0;
  const hasFiles=e=>e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files');
  const target=e=>{const t=/** @type {Element} */(e.target); if(!t||!t.closest) return null;
    const c=t.closest('g.card[data-k]'); if(c&&!c.getAttribute('data-k').startsWith('g:')) return {pid:c.getAttribute('data-k'),el:c};
    if(t.closest('#panel')&&ui.sel&&ui.sel.type==='person') return {pid:ui.sel.id,el:$('#panel')};
    const pc=t.closest('.pc'); if(pc&&ui.view==='personkort'&&ui.focus) return {pid:ui.focus,el:pc};
    return null;};
  let lit=null; const light=el=>{ if(lit===el) return; if(lit) lit.classList.remove('drop-on'); lit=el; if(el) el.classList.add('drop-on'); };
  document.addEventListener('dragenter',e=>{ if(!hasFiles(e)||!Store.canEdit) return; dragDepth++; document.body.classList.add('dragging-files'); });
  document.addEventListener('dragleave',()=>{ if(--dragDepth<=0){dragDepth=0; document.body.classList.remove('dragging-files'); light(null);} });
  document.addEventListener('dragover',e=>{ if(!hasFiles(e)) return; e.preventDefault(); const t=Store.canEdit?target(e):null; e.dataTransfer.dropEffect=t?'copy':'none'; light(t&&t.el); });
  document.addEventListener('drop',e=>{ if(!hasFiles(e)) return; e.preventDefault(); dragDepth=0; document.body.classList.remove('dragging-files');
    const t=Store.canEdit?target(e):null; light(null);
    if(t) photoTo(t.pid,e.dataTransfer.files); else if(Store.canEdit) toast('Släpp bilden på en person i trädet, eller i personens panel.'); });
  document.addEventListener('paste',e=>{ const tg=/** @type {HTMLElement} */(e.target); if(tg&&/^(INPUT|TEXTAREA)$/.test(tg.tagName)) return;
    if(!Store.canEdit||!ui.sel||ui.sel.type!=='person') return;
    const files=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>/^image\//.test(f.type)); if(!files.length) return;
    e.preventDefault(); photoTo(ui.sel.id,files); });
}
(function(){let t=null; try{t=localStorage.getItem('sa-tema');}catch(e){} applyTheme(['wood','light','dark'].includes(t)?t:'wood');})();
try{applySize(localStorage.getItem('sa-size')==='lg');}catch(e){}
try{const q=new URLSearchParams(location.search); if(q.has('enkelt')){applySimple(true,false); document.documentElement.dataset.size='lg';} else applySimple(localStorage.getItem('sa-enkelt')==='1',false);}catch(e){}
{const b=$('#simpleExit'); if(b) b.onclick=()=>{applySimple(false); ui.treeKey=null; renderAll(true); toast('Alla funktioner visas igen. Enkelt läge hittar du under Inställningar.',4500);};}
{const b=$('#settingsBtn'); if(b) b.onclick=settingsModal;}
{const u=$('#undoBtn'), r=$('#redoBtn'); if(u) u.onclick=()=>Hist.run(-1); if(r) r.onclick=()=>Hist.run(1);}
{const mb=$('#moreBtn'), mp=$('#morePop'); if(mb&&mp){mb.onclick=e=>{e.stopPropagation(); mp.classList.toggle('open'); const r=mb.getBoundingClientRect(); if(matchMedia('(max-width:700px)').matches){mp.style.left='';mp.style.top='';} else {mp.style.left=r.left+'px'; mp.style.top=(r.bottom+6)+'px';}}; document.addEventListener('click',()=>mp.classList.remove('open'));}}
document.addEventListener('mousedown',e=>{const pop=$('#viewPop'); if(pop&&pop.classList.contains('open')&&!e.target.closest('.viewsel')) pop.classList.remove('open');});
$('#viewBtn').onclick=openViewMenu;
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
route();
{const m=location.hash.match(/^#dela-([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,})$/); if(m){Share.pendingJoin={id:m[1],key:m[2]}; history.replaceState(null,'',location.pathname+location.search+'#start');}}
addEventListener('beforeunload',e=>{ if(Unpub.count()){ e.preventDefault(); e.returnValue=''; } });
{const sb=$('#shareBtn'); if(sb) sb.onclick=shareTreeModal; const st=$('#status'); if(st) st.onclick=()=>{ if(Share.newer) Share.pull(); else if(Share.enabled()) shareTreeModal(); };}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault(); PWA.prompt=e; if(Store.loaded) renderAll();});
window.addEventListener('appinstalled',()=>{PWA.prompt=null;});
if('serviceWorker' in navigator&&location.protocol==='https:'&&window.top===window&&Store.mode!=='db'&&!/claude\.(ai|site)|claudeusercontent/.test(location.hostname)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(e=>console.warn('Service worker',e)));
}
Store.init();
