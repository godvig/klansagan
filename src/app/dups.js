/* Släktsagan · dups.js — Duplicate finder and merging. */
import { P, children, fullName, partners, placeName } from './domain.js?v=43';
import { confirmBox } from './modal.js?v=43';
import { setFocus } from './router.js?v=43';
import { ALL, S, ui } from './state.js?v=43';
import { Hist, Store } from './store.js?v=43';
import { $, clone, dupScore, esc, norm, nrm, toast } from './util.js?v=43';

/* ============ DUPLICATES ============ */
function findDups(){
  const all=Object.values(S.persons); const buckets={};
  for(const p of all){const k=nrm((p.given||'').split(/\s+/)[0]).slice(0,2); if(k) (buckets[k]=buckets[k]||[]).push(p);}
  const out=[];
  for(const list of Object.values(buckets)) for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++){const sc=dupScore(list[i],list[j]); if(sc>=60) out.push({a:list[i],b:list[j],sc});}
  return out.sort((x,y)=>y.sc-x.sc);
}
function renderDups(){
  const v=$('#view'); const dups=findDups();
  const row=(lbl,fa,fb)=>{const x=fa||'–',y=fb||'–'; const diff=fa&&fb&&norm(fa)!==norm(fb); return `<span class="k">${lbl}</span><span class="${diff?'diff':''}">${esc(x)}</span><span class="${diff?'diff':''}">${esc(y)}</span>`;};
  v.innerHTML=`<div class="view-pad"><div class="toolbar"><h2>Möjliga dubbletter</h2><a class="btn" href="#personer">← Personer</a></div>
    <p class="muted" style="max-width:720px;line-height:1.55;margin-top:-6px">Personer med liknande namn, födelseår, föräldrar och födelseort. Vid sammanslagning fylls tomma uppgifter i från den andra posten, och händelser, källor, bilder och familjekopplingar flyttas över.</p>
    ${dups.length?dups.map((d,i)=>`<div class="dup" data-i="${i}"><div style="display:flex;align-items:center;gap:10px"><span class="score">${d.sc}% lika</span><b>${esc(fullName(d.a))}</b><span class="muted">och</span><b>${esc(fullName(d.b))}</b></div>
      <div class="dup-grid"><span></span><span class="h">A</span><span class="h">B</span>
      ${row('Född',[d.a.birthDate,placeName(d.a.birthPlace)].filter(Boolean).join(', '),[d.b.birthDate,placeName(d.b.birthPlace)].filter(Boolean).join(', '))}
      ${row('Död',[d.a.deathDate,placeName(d.a.deathPlace)].filter(Boolean).join(', '),[d.b.deathDate,placeName(d.b.deathPlace)].filter(Boolean).join(', '))}
      ${row('Far',fullName(P(d.a.fatherId))==='Okänd'?'':fullName(P(d.a.fatherId)),fullName(P(d.b.fatherId))==='Okänd'?'':fullName(P(d.b.fatherId)))}
      ${row('Mor',fullName(P(d.a.motherId))==='Okänd'?'':fullName(P(d.a.motherId)),fullName(P(d.b.motherId))==='Okänd'?'':fullName(P(d.b.motherId)))}
      ${row('Partner',partners(d.a).map(fullName).join(', '),partners(d.b).map(fullName).join(', '))}
      ${row('Barn / källor',children(d.a.id).length+' barn, '+(d.a.citations||[]).length+' källor',children(d.b.id).length+' barn, '+(d.b.citations||[]).length+' källor')}
      </div>${Store.canEdit?`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm primary" data-merge="a">Slå ihop – behåll A</button><button class="btn sm" data-merge="b">Slå ihop – behåll B</button><button class="btn sm ghost" data-notdup>Inte samma person</button></div>`:''}</div>`).join('')
    :`<div class="box"><h3>Inga misstänkta dubbletter</h3><p>Hittade inga personer som verkar vara samma person. Kör gärna sökningen igen efter en import.</p></div>`}</div>`;
  v.querySelectorAll('.dup').forEach(el=>{const d=dups[+el.dataset.i];
    el.querySelectorAll('[data-merge]').forEach(b=>b.onclick=()=>{const [k,x]=b.dataset.merge==='a'?[d.a,d.b]:[d.b,d.a]; confirmBox(`Slå ihop till ${fullName(k)}?`,`Uppgifterna från den andra posten läggs in där de saknas, och den andra posten tas bort.`,'Slå ihop',()=>mergePersons(k.id,x.id));});
    const nd=el.querySelector('[data-notdup]'); if(nd) nd.onclick=()=>{const a=clone(d.a); a.notDup=[...new Set([...(a.notDup||[]),d.b.id])]; Store.put(a);};
  });
}
async function mergePersons(keepId,dropId){
  const k=clone(P(keepId)), d=P(dropId); if(!k||!d) return;
  Hist.label('Sammanslagning av '+fullName(d)+' med '+fullName(k),1500);
  for(const c of Object.values(ALL.comments)) if(c.personId===dropId) Store.put({...c,personId:keepId},{silent:true});
  for(const f of ['given','callName','surname','sex','birthDate','birthPlace','deathDate','deathPlace','occupation','fatherId','motherId']) if(!k[f]&&d[f]) k[f]=d[f];
  if(d.notes&&d.notes!==k.notes) k.notes=[k.notes,d.notes].filter(Boolean).join('\n\n');
  const evKey=e=>e.type+'|'+(e.date||'')+'|'+(e.placeId||'');
  const evs=(k.events||[]).slice(); for(const e of d.events||[]) if(!evs.some(x=>evKey(x)===evKey(e))) evs.push(e); k.events=evs;
  const cKey=c=>c.sourceId+'|'+(c.about||'')+'|'+(c.detail||'');
  const cs=(k.citations||[]).slice(); for(const c of d.citations||[]) if(!cs.some(x=>cKey(x)===cKey(c))) cs.push(c); k.citations=cs;
  k.media=(k.media||[]).concat((d.media||[]).map(m=>Object.assign({},m,{profile:(k.media||[]).some(x=>x.profile)?false:m.profile})));
  k.spouseIds=[...new Set([...(k.spouseIds||[]),...(d.spouseIds||[])])].filter(x=>x!==keepId&&x!==dropId);
  k.notDup=[...new Set([...(k.notDup||[]),...(d.notDup||[])])].filter(x=>x!==dropId);
  if(d.home) k.home=true;
  await Store.put(k,{silent:true});
  for(const o of Object.values(ALL.persons)){ if(o.id===keepId||o.id===dropId) continue; let ch=false; const q=clone(o);
    if(q.fatherId===dropId){q.fatherId=keepId;ch=true;} if(q.motherId===dropId){q.motherId=keepId;ch=true;}
    if((q.spouseIds||[]).includes(dropId)){q.spouseIds=[...new Set(q.spouseIds.map(x=>x===dropId?keepId:x))];ch=true;}
    (q.events||[]).forEach(e=>{if(e.withId===dropId){e.withId=keepId;ch=true;}});
    if((q.notDup||[]).includes(dropId)){q.notDup=q.notDup.filter(x=>x!==dropId);ch=true;}
    if(ch) Store.put(q,{silent:true}); }
  if(ui.focus===dropId) setFocus(keepId);
  if(ui.sel&&ui.sel.id===dropId) ui.sel={type:'person',id:keepId};
  await Store.del('person',dropId);
  toast('Sammanslaget till '+fullName(k));
}

export { findDups, renderDups, mergePersons };
