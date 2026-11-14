/* Släktsagan · modal.js — Modals and the add/edit person dialog. */
import { P, ensurePlace, fullName, partners, personLabel, placeName } from './domain.js?v=44';
import { personByLabel, personOptions, placeOptions } from './panel.js?v=44';
import { renderAll, setFocus } from './router.js?v=44';
import { S, ui } from './state.js?v=44';
import { Store } from './store.js?v=44';
import { clone, esc, toast, uid } from './util.js?v=44';

/* ============ Modal ============ */
function modal(html,onMount){
  const ov=document.createElement('div'); ov.className='ov'; ov.innerHTML=`<div class="modal">${html}</div>`;
  document.body.appendChild(ov);
  const close=()=>{ov.remove();document.removeEventListener('keydown',kd);};
  const kd=e=>{if(e.key==='Escape') close();};
  document.addEventListener('keydown',kd);
  ov.addEventListener('mousedown',e=>{if(e.target===ov) close();});
  onMount&&onMount(ov,close); return close;
}
function confirmBox(title,text,okLabel,onOk){
  modal(`<h3>${esc(title)}</h3><p style="color:var(--ink2);line-height:1.5">${esc(text)}</p><div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" style="background:var(--err);border-color:var(--err)" data-ok>${esc(okLabel)}</button></div>`,(ov,close)=>{ov.querySelector('[data-x]').onclick=close; ov.querySelector('[data-ok]').onclick=()=>{close();onOk();};});
}
function openPersonModal(p,ctx){
  const isNew=!p; ctx=ctx||{};
  const base=ctx.of?P(ctx.of):null;
  p=p?clone(p):{kind:'person',id:uid('p'),given:'',surname:'',sex:ctx.rel==='father'?'M':ctx.rel==='mother'?'K':'',citations:[],events:[],media:[],spouseIds:[]};
  // prefill for relations
  if(isNew&&base){
    if(ctx.rel==='child'){ if(base.sex==='K') p.motherId=base.id; else p.fatherId=base.id; const ps=partners(base); if(ps.length===1){const o=ps[0]; if(o.sex==='K'&&!p.motherId) p.motherId=o.id; else if(!p.fatherId) p.fatherId=o.id; else p.motherId=o.id;} p.surname=base.sex!=='K'?patronym(base):''; }
    if(ctx.rel==='partner'){p.sex=base.sex==='M'?'K':base.sex==='K'?'M':'';}
    if(ctx.rel==='sibling'){p.fatherId=base.fatherId||''; p.motherId=base.motherId||''; p.surname=base.surname||'';}
  }
  const relTitle={father:'far till',mother:'mor till',child:'barn till',partner:'partner till',sibling:'syskon till'}[ctx.rel];
  const pl=id=>esc(id&&P(id)?personLabel(P(id)):'');
  modal(`<h3>${isNew?(base?'Lägg till '+relTitle+' '+esc(fullName(base)):'Ny person'):'Redigera '+esc(fullName(p))}</h3>
    ${isNew&&base?`<label class="f"><span>Välj en befintlig person istället (valfritt)</span><input class="t" id="mExisting" list="dlPersons" placeholder="Skriv för att söka…">${personOptions(base.id)}<div class="hint">Lämna tomt för att skapa en ny person.</div></label><hr style="border:none;border-top:1px solid var(--paper2);margin:14px 0">`:''}
    <div class="row2"><label class="f"><span>Förnamn</span><input class="t" id="mG" value="${esc(p.given)}" placeholder="t.ex. Anna Maria"></label>
    <label class="f"><span>Efternamn</span><input class="t" id="mS" value="${esc(p.surname)}" placeholder="t.ex. Larsdotter"></label></div>
    <div class="f callpick"><span class="lab">Tilltalsnamn <span class="muted">– klicka på namnet personen kallades</span></span><div id="mCallChips"></div><input type="hidden" id="mCall" value="${esc(p.callName||'')}"></div>
    <div class="row2"><label class="f"><span>Kön</span><select class="t" id="mSex"><option value="">Okänt</option><option value="M" ${p.sex==='M'?'selected':''}>Man</option><option value="K" ${p.sex==='K'?'selected':''}>Kvinna</option></select></label>
    <label class="f"><span>Yrke / titel</span><input class="t" id="mO" value="${esc(p.occupation||'')}" placeholder="t.ex. Bonde, Piga, Soldat"></label></div>
    <div class="row2"><label class="f"><span>Född (datum)</span><input class="t" id="mBD" value="${esc(p.birthDate||'')}" placeholder="1823-04-12, 1823 eller ca 1820"></label>
    <label class="f"><span>Födelseort</span><input class="t" id="mBP" list="dlPlaces" value="${esc(placeName(p.birthPlace))}" placeholder="Församling eller ort"></label></div>
    <div class="row2"><label class="f"><span>Död (datum)</span><input class="t" id="mDD" value="${esc(p.deathDate||'')}"></label>
    <label class="f"><span>Dödsort</span><input class="t" id="mDP" list="dlPlaces" value="${esc(placeName(p.deathPlace))}"></label></div>
    <label class="chk small" style="margin:-4px 0 8px"><input type="checkbox" id="mDec" ${p.deceased?'checked':''}> Avliden, datum okänt <span class="muted">– annars kan personen räknas som levande och döljas för den som har läslänken</span></label>
    ${placeOptions()}
    ${ctx.rel==='father'||ctx.rel==='mother'?'':`<div class="row2"><label class="f"><span>Far</span><input class="t" id="mF" list="dlPersons2" value="${pl(p.fatherId)}" placeholder="${p.fatherId&&!P(p.fatherId)?'Dold i den här vyn – lämna tomt':'Sök befintlig person'}"></label>
    <label class="f"><span>Mor</span><input class="t" id="mM" list="dlPersons2" value="${pl(p.motherId)}" placeholder="${p.motherId&&!P(p.motherId)?'Dold i den här vyn – lämna tomt':'Sök befintlig person'}"></label></div>
    <datalist id="dlPersons2">${Object.values(S.persons).filter(x=>x.id!==p.id).map(x=>`<option value="${esc(personLabel(x))}">`).join('')}</datalist>`}
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>${isNew?'Lägg till':'Spara'}</button></div>`,
  (ov,close)=>{
    const q=s=>ov.querySelector(s);
    q('#mG').focus();
    const chips=()=>{const ws=q('#mG').value.trim().split(/\s+/).map(w=>w.replace(/[()*]/g,'')).filter(Boolean), cur=q('#mCall').value;
      q('#mCallChips').innerHTML=ws.length>1||cur?ws.map(w=>`<button type="button" class="cchip${w===cur?' on':''}" data-w="${esc(w)}">${esc(w)}</button>`).join('')+(cur&&!ws.includes(cur)?`<button type="button" class="cchip on" data-w="${esc(cur)}">${esc(cur)}</button>`:''):'<span class="muted small">Skriv flera förnamn så kan du välja ett.</span>';
      q('#mCallChips').querySelectorAll('.cchip').forEach(b=>b.onclick=()=>{q('#mCall').value=q('#mCall').value===b.dataset.w?'':b.dataset.w; chips();});};
    q('#mG').addEventListener('input',chips); chips();
    q('[data-x]').onclick=close;
    q('[data-ok]').onclick=async()=>{
      let target=null;
      if(q('#mExisting')&&q('#mExisting').value.trim()){target=personByLabel(q('#mExisting').value); if(!target){toast('Hittade ingen sådan person – välj i listan.');return;} target=clone(target);}
      if(!target){
        const g=q('#mG').value.trim(),s=q('#mS').value.trim(); if(!g&&!s){q('#mG').focus();toast('Skriv minst ett namn.');return;}
        Object.assign(p,{given:g,callName:q('#mCall').value,surname:s,sex:q('#mSex').value,occupation:q('#mO').value.trim(),birthDate:q('#mBD').value.trim(),deathDate:q('#mDD').value.trim()}); if(q('#mDec').checked&&!p.deathDate) p.deceased=true; else delete p.deceased;
        const bp=ensurePlace(q('#mBP').value),dp=ensurePlace(q('#mDP').value);
        if(bp.created) Store.put(bp.created,{silent:true}); if(dp.created&&dp.created!==bp.created) Store.put(dp.created,{silent:true});
        p.birthPlace=bp.id; p.deathPlace=dp.id;
        if(q('#mF')){const fv=q('#mF').value.trim(),mv=q('#mM').value.trim(); const f=personByLabel(fv),m=personByLabel(mv);
          if(fv&&!f){toast('Hittade inte fadern i listan.');return;} if(mv&&!m){toast('Hittade inte modern i listan.');return;}
          p.fatherId=f?f.id:(!fv&&p.fatherId&&!P(p.fatherId)?p.fatherId:''); p.motherId=m?m.id:(!mv&&p.motherId&&!P(p.motherId)?p.motherId:'');}
        if(isNew) p.createdAt=new Date().toISOString();
        target=p;
      }
      close();
      // relation wiring
      if(base&&ctx.rel){
        const b=clone(P(base.id));
        if(ctx.rel==='father'){b.fatherId=target.id; if(!target.sex) target.sex='M';}
        if(ctx.rel==='mother'){b.motherId=target.id; if(!target.sex) target.sex='K';}
        if(ctx.rel==='partner'){b.spouseIds=[...new Set([...(b.spouseIds||[]),target.id])]; target.spouseIds=[...new Set([...(target.spouseIds||[]),b.id])];
          // link parents of the other parent with existing children of base where missing
        }
        if(ctx.rel==='child'&&target!==p){ if(b.sex==='K') target.motherId=b.id; else target.fatherId=b.id; }
        if(ctx.rel==='sibling'&&target!==p){ if(!target.fatherId) target.fatherId=b.fatherId||''; if(!target.motherId) target.motherId=b.motherId||''; }
        // if adding a parent and the other parent exists, make them partners
        if((ctx.rel==='father'||ctx.rel==='mother')){const other=P(ctx.rel==='father'?b.motherId:b.fatherId); if(other){target.spouseIds=[...new Set([...(target.spouseIds||[]),other.id])]; const o=clone(other); o.spouseIds=[...new Set([...(o.spouseIds||[]),target.id])]; Store.put(o,{silent:true});}}
        await Store.put(target,{silent:true}); Store.put(b,{silent:true});
      } else { Store.put(target,{silent:true}); }
      if(!ui.focus) setFocus(target.id);
      if(ui.view==='trad') ui.treeKey=null;
      ui.sel={type:'person',id:(ctx.rel==='father'||ctx.rel==='mother')&&base?base.id:target.id};
      if(isNew&&!base) {setFocus(target.id); ui.sel={type:'person',id:target.id};}
      renderAll();
    };
    ov.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT') q('[data-ok]').click();});
  });
}
function patronym(f){
  // Suggest a family surname: keep father's surname unless it's a patronymic
  const s=f.surname||''; if(/(son|dotter)$/i.test(s)) return ''; return s;
}

export { modal, confirmBox, openPersonModal, patronym };
