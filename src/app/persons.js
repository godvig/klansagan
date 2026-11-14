/* Släktsagan · persons.js — The person list. */
import { P, ancestorsOf, fullName, placeName, sexColor, shortName } from './domain.js?v=40';
import { emptyState, showPerson } from './router.js?v=40';
import { DATA_REV, S, ui } from './state.js?v=40';
import { Store } from './store.js?v=40';
import { $, dateKey, esc, norm, yearOf } from './util.js?v=40';

/* ============ PERSONS ============ */
function renderPersons(fresh){
  const v=$('#view'); const all=Object.values(S.persons);
  if(!all.length){v.innerHTML=emptyState();ui.plSig=null;return;}
  // Only the selection changed: move the highlight instead of rebuilding a list that can have thousands of rows.
  const sig=[DATA_REV,ui.plQuery,ui.plFilter,ui.plSort,ui.focus,ui.nameMode,Store.canEdit].join('|');
  if(!fresh&&ui.plSig===sig&&v.querySelector('table.m-persons')){const sel=ui.sel&&ui.sel.type==='person'?ui.sel.id:null;
    v.querySelectorAll('tr.sel').forEach(r=>r.classList.remove('sel')); if(sel){const r=v.querySelector(`tr[data-id="${CSS.escape(sel)}"]`); if(r) r.classList.add('sel');} return;}
  ui.plSig=sig;
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

export { renderPersons };
