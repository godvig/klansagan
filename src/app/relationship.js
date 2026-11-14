/* Släktsagan · relationship.js — The relationship calculator. */
import { demoActive } from './demo.js?v=38';
import { P, fullName, homePerson, partners, shortName } from './domain.js?v=38';
import { personByLabel } from './panel.js?v=38';
import { emptyState, setFocus } from './router.js?v=38';
import { S, ui } from './state.js?v=38';
import { allPersonsDatalist, bindChips, chipHTML, listJoin, openCard, personPicker } from './theme.js?v=38';
import { $, blood, bloodTerm, esc, genitive, sx, toast } from './util.js?v=38';

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
/** Open the tree around the shared ancestor and light up the chain between a and b. */
function showRelInTree(aId,bId,res){
  const ids=new Set([aId,bId]); let top=aId, need=0, label=res.text;
  if(res.r){ const r=res.r; r.pa.forEach(x=>ids.add(x)); r.pb.forEach(x=>ids.add(x)); (r.commons||[]).forEach(x=>ids.add(x));
    top=(r.commons&&r.commons[0])||r.pa[r.pa.length-1]; need=Math.max(r.a,r.b);
    if(res.via){ ids.add(res.via); if(res.viaSide==='b'&&r.b===0) need=Math.max(need,0); } }
  else if(res.kind==='partner'){ top=aId; }
  const commons=res.r&&res.r.commons?res.r.commons:[top];
  ui.relHL={ids,a:aId,b:bId,commons:new Set(commons),label:`${fullName(P(bId))} är ${genitive(shortName(P(aId)))} ${label}`};
  ui.treeLock=false; if(ui.descGen<need) ui.descGen=need; if(ui.showPartners===false&&(res.via||res.kind==='partner'||commons.length>1)) ui.showPartners=true;
  setFocus(top); ui.treeKey=null; ui.sel=null; location.hash='trad';
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
      ${pathHTML}<div style="margin-top:16px;text-align:center"><button class="btn primary" id="relTree">🌳 Visa vägen i trädet</button></div>`
    :`<div class="big">Ingen känd släktskap</div><p class="muted" style="margin:8px 0 0">Hittade ingen gemensam ana eller koppling via giftermål mellan ${an} och ${bn} i arkivet.</p>`}</div></div>`;
  const pick=(inp,key)=>{inp.onchange=()=>{const p=personByLabel(inp.value); if(p){ui[key]=p.id; renderRel();} else toast('Välj en person i listan');};};
  pick($('#relA'),'relA'); pick($('#relB'),'relB');
  $('#relSwap').onclick=()=>{[ui.relA,ui.relB]=[ui.relB,ui.relA]; renderRel();};
  {const rt=$('#relTree'); if(rt) rt.onclick=()=>showRelInTree(A.id,B.id,res);}
  bindChips(v,openCard);
}

export { relation, showRelInTree, renderRel };
