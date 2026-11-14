/* Släktsagan · theme.js — Themes, text size, simple mode and settings. */
import { P, avImg, avatarUrl, fullName, homePerson, initials, lifespan, personLabel, setHome, sexColor } from './domain.js?v=39';
import { mapState } from './map.js?v=39';
import { modal } from './modal.js?v=39';
import { personByLabel } from './panel.js?v=39';
import { PWA } from './pwa.js?v=39';
import { renderAll, setFocus } from './router.js?v=39';
import { APP_VERSION, S, ui } from './state.js?v=39';
import { $, esc, toast } from './util.js?v=39';

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
/* Simple mode ("farmorsläge"): big text, only Start, Träd and Personer. ?enkelt turns it on. */
function applySimple(on,save=true){ui.simple=!!on; document.body.classList.toggle('simple',ui.simple); if(save) try{localStorage.setItem('sa-enkelt',on?'1':'');}catch(e){}
}
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
    ${PWA.can()?`<div class="sgroup"><div class="slab">App</div><button class="btn" id="setInstall">📲 Installera Släktsagan som app</button><div class="hint">Lägger en ikon på hemskärmen eller i programmenyn. Appen öppnas i eget fönster och fungerar även utan internet.</div></div>`:''}
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

export { cssv, currentTheme, themeName, applySize, applyTheme, applySimple, settingsModal, NUMW, numw, listJoin, chipHTML, bindChips, openCard, personPicker, allPersonsDatalist };
