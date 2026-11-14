/* Släktsagan · places.js — Place and source panels. */
import { fullName, lifeEvents } from './domain.js?v=44';
import { mapState, renderMap } from './map.js?v=44';
import { confirmBox, modal } from './modal.js?v=44';
import { E, closeBtn, mediaSection } from './panel.js?v=44';
import { select, sheetMini } from './router.js?v=44';
import { ALL, S, ui } from './state.js?v=44';
import { Store } from './store.js?v=44';
import { $, SOURCE_TYPES, clone, dateKey, esc, uid } from './util.js?v=44';

/* ============ Place panel ============ */
function placePanel(pl){
  const ed=E.canEdit;
  const refs=[];
  for(const p of Object.values(S.persons)) for(const e of lifeEvents(p)) if(e.placeId===pl.id) refs.push({p,e});
  refs.sort((a,b)=>(dateKey(a.e.date)??9e9)-(dateKey(b.e.date)??9e9));
  return `<div class="ph"><div class="top"><div class="avatar">📍</div><div style="flex:1"><h3>${esc(pl.name)}</h3><div class="sub">${esc([pl.parish,pl.county,pl.country].filter(Boolean).join(', '))||'Plats'}</div></div>${closeBtn}</div>
    <div class="acts"><button class="btn sm" data-pact="map">${pl.lat!=null?'Visa på kartan':'Placera på kartan'}</button>${pl.lat!=null&&ed?'<button class="btn sm" data-pact="move">Flytta markören</button>':''}${ed?'<button class="btn sm" data-pact="edit">Redigera</button><button class="btn sm" data-pact="merge">Slå ihop…</button>':''}</div></div>
    <div class="sec"><h4>Detaljer</h4><dl class="facts"><dt>Församling</dt><dd>${esc(pl.parish||'–')}</dd><dt>Län</dt><dd>${esc(pl.county||'–')}</dd><dt>Land</dt><dd>${esc(pl.country||'–')}</dd><dt>Koordinat</dt><dd>${pl.lat!=null?pl.lat.toFixed(4)+', '+pl.lon.toFixed(4):'<span class="tag warn">saknas</span>'}</dd></dl>
    ${pl.notes?`<p style="white-space:pre-wrap">${esc(pl.notes)}</p>`:''}</div>
    <div class="sec"><h4>Händelser här (${refs.length})</h4>${refs.map(r=>`<div class="ev"><span class="d">${esc(r.e.date||'–')}</span><span class="w"><b>${esc(r.e.type)}</b> · <a href="#" data-goto="${r.p.id}">${esc(fullName(r.p))}</a>${r.e.desc?`<div class="small">${esc(r.e.desc)}</div>`:''}${r.e.note&&r.e.note!==r.e.desc?`<div class="small muted">${esc(r.e.note)}</div>`:''}</span><span></span></div>`).join('')||'<div class="muted small">Inga.</div>'}</div>
    ${mediaSection(pl)}`;
}
function bindPlacePanel(pl){
  $('#panel').querySelectorAll('[data-pact]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.pact;
    if(a==='map'||a==='move') sheetMini();
    if(a==='map'){ if(pl.lat==null&&E.canEdit) ui.placing=pl.id; mapState.focusPlace=pl.id; if(ui.view!=='karta') location.hash='karta'; else renderMap(); }
    if(a==='move'){ui.placing=pl.id; if(ui.view!=='karta') location.hash='karta'; else renderMap();}
    if(a==='edit') placeModal(pl);
    if(a==='merge') mergeModal(pl);
  });
}
function placeModal(pl){
  modal(`<h3>Redigera plats</h3>
    <label class="f"><span>Namn</span><input class="t" id="plN" value="${esc(pl.name)}"></label>
    <div class="row2"><label class="f"><span>Församling / socken</span><input class="t" id="plPa" value="${esc(pl.parish||'')}"></label><label class="f"><span>Län / landskap</span><input class="t" id="plC" value="${esc(pl.county||'')}"></label></div>
    <div class="row2"><label class="f"><span>Land</span><input class="t" id="plCo" value="${esc(pl.country||'')}" placeholder="Sverige"></label><div></div></div>
    <div class="row2"><label class="f"><span>Latitud</span><input class="t" id="plLa" value="${pl.lat??''}" placeholder="60.886"></label><label class="f"><span>Longitud</span><input class="t" id="plLo" value="${pl.lon??''}" placeholder="15.118"></label></div>
    <div class="hint" style="margin:-6px 0 12px">Enklast är att klicka på kartan istället (”Placera på kartan”).</div>
    <label class="f"><span>Anteckningar</span><textarea class="t" id="plNo">${esc(pl.notes||'')}</textarea></label>
    <div class="foot"><button class="btn danger ghost" data-del style="margin-right:auto">Ta bort plats</button><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Spara</button></div>`,(ov,close)=>{
    const q=s=>ov.querySelector(s); q('[data-x]').onclick=close;
    q('[data-del]').onclick=()=>{close(); confirmBox('Ta bort '+pl.name+'?','Personer och händelser som hänvisar hit förlorar platsen.','Ta bort',()=>{replacePlace(pl.id,''); ui.sel=null; Store.del('place',pl.id);});};
    q('[data-ok]').onclick=()=>{const n=clone(pl); n.name=q('#plN').value.trim()||pl.name; n.parish=q('#plPa').value.trim(); n.county=q('#plC').value.trim(); n.country=q('#plCo').value.trim(); n.notes=q('#plNo').value;
      const la=parseFloat(q('#plLa').value.replace(',','.')),lo=parseFloat(q('#plLo').value.replace(',','.'));
      if(isFinite(la)&&isFinite(lo)){n.lat=la;n.lon=lo;} else {delete n.lat; delete n.lon;}
      close(); mapState.drawn=false; Store.put(n);};
  });
}
function replacePlace(from,to){
  for(const p of Object.values(ALL.persons)){
    let ch=false; const q=clone(p);
    if(q.birthPlace===from){q.birthPlace=to;ch=true;} if(q.deathPlace===from){q.deathPlace=to;ch=true;}
    (q.events||[]).forEach(e=>{if(e.placeId===from){e.placeId=to;ch=true;}});
    if(ch) Store.put(q,{silent:true});
  }
}
function mergeModal(pl){
  const others=Object.values(S.places).filter(x=>x.id!==pl.id).sort((a,b)=>a.name.localeCompare(b.name,'sv'));
  modal(`<h3>Slå ihop ”${esc(pl.name)}” med…</h3><p class="muted">Användbart när samma plats har stavats olika, t.ex. ”Rättvik” och ”Rättviks socken”. Allt som hänvisar till ”${esc(pl.name)}” flyttas till platsen du väljer, och ”${esc(pl.name)}” tas bort.</p>
    <label class="f"><span>Behåll platsen</span><select class="t" id="mgT">${others.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label>
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok ${others.length?'':'disabled'}>Slå ihop</button></div>`,(ov,close)=>{
    ov.querySelector('[data-x]').onclick=close;
    ov.querySelector('[data-ok]').onclick=()=>{const to=ov.querySelector('#mgT').value; const t=clone(S.places[to]); if(t.lat==null&&pl.lat!=null){t.lat=pl.lat;t.lon=pl.lon;} t.media=(t.media||[]).concat(pl.media||[]); Store.put(t,{silent:true}); replacePlace(pl.id,to); close(); ui.sel={type:'place',id:to}; Store.del('place',pl.id);};
  });
}

/* ============ Sources ============ */
function citationsOf(sid,all){const out=[]; for(const p of Object.values(all?ALL.persons:S.persons)) for(const c of p.citations||[]) if(c.sourceId===sid) out.push({p,c}); return out;}
function renderSources(){
  const v=$('#view'); const all=Object.values(S.sources).sort((a,b)=>a.title.localeCompare(b.title,'sv'));
  const sel=ui.sel&&ui.sel.type==='source'?ui.sel.id:null;
  const unsourced=Object.values(S.persons).filter(p=>!(p.citations||[]).length).length;
  v.innerHTML=`<div class="view-pad"><div class="toolbar"><h2>Källor</h2>${E.canEdit?'<button class="btn primary" id="newSrc">+ Ny källa</button>':''}</div>
    <p class="muted" style="max-width:720px;line-height:1.55;margin-top:-6px">Registrera varje volym eller dokument en gång – t.ex. en husförhörslängd med arkivreferens och bild-ID – och koppla den sedan till de personer den nämner. ${unsourced?`<b style="color:var(--warn)">${unsourced} personer saknar källa.</b> <a href="#personer" onclick="ui.plFilter='kalla'">Visa dem</a>`:''}</p>
    ${all.length?`<table class="list m-sources"><thead><tr><th>Källa</th><th>Typ</th><th>Arkiv / referens</th><th>Hänvisningar</th></tr></thead><tbody>
    ${all.map(s=>`<tr class="click ${sel===s.id?'sel':''}" data-id="${s.id}"><td><b>${esc(s.title)}</b>${s.date?`<div class="small muted">${esc(s.date)}</div>`:''}</td><td>${esc(s.type||'')}</td><td>${esc([s.archive,s.ref].filter(Boolean).join(' · '))}</td><td>${citationsOf(s.id).length}</td></tr>`).join('')}</tbody></table>`
    :`<div class="box"><h3>Inga källor ännu</h3><p>Lägg till din första källa här, eller direkt från en person under ”Källor”.</p></div>`}</div>`;
  v.querySelectorAll('tr[data-id]').forEach(tr=>tr.onclick=()=>select('source',tr.dataset.id));
  const nb=$('#newSrc'); if(nb) nb.onclick=()=>sourceModal(null);
}
function sourcePanel(s){
  const refs=citationsOf(s.id);
  return `<div class="ph"><div class="top"><div class="avatar">📜</div><div style="flex:1"><h3>${esc(s.title)}</h3><div class="sub">${esc(s.type||'Källa')}</div></div>${closeBtn}</div>
   ${E.canEdit?'<div class="acts"><button class="btn sm" data-sact="edit">Redigera</button><button class="btn sm ghost danger" data-sact="del">Ta bort</button></div>':''}</div>
   <div class="sec"><h4>Detaljer</h4><dl class="facts"><dt>Arkiv</dt><dd>${esc(s.archive||'–')}</dd><dt>Referens</dt><dd>${esc(s.ref||'–')}</dd><dt>Period</dt><dd>${esc(s.date||'–')}</dd><dt>Länk</dt><dd>${s.url&&/^https?:/i.test(s.url)?`<a href="${esc(s.url)}" target="_blank" rel="noopener">Öppna</a>`:'–'}</dd></dl>
   ${s.notes?`<p style="white-space:pre-wrap;margin-bottom:0">${esc(s.notes)}</p>`:''}</div>
   <div class="sec"><h4>Nämner (${refs.length})</h4>${refs.map(r=>`<div class="ev"><span class="d">${esc(r.c.detail||'')}</span><span class="w"><a href="#" data-goto="${r.p.id}"><b>${esc(fullName(r.p))}</b></a><div class="small muted">${esc(r.c.about&&!r.c.about.startsWith('event:')?r.c.about:r.c.about?'Händelse':'Allmänt')}</div></span><span></span></div>`).join('')||'<div class="muted small">Inga kopplade personer ännu.</div>'}</div>
   ${mediaSection(s)}`;
}
function bindSourcePanel(s){
  $('#panel').querySelectorAll('[data-sact]').forEach(b=>b.onclick=()=>{
    if(b.dataset.sact==='edit') sourceModal(s);
    if(b.dataset.sact==='del') confirmBox('Ta bort källan?','Källhänvisningar till den tas också bort från personerna.','Ta bort',()=>{for(const r of citationsOf(s.id,true)){const q=clone(ALL.persons[r.p.id]); q.citations=q.citations.filter(c=>c.sourceId!==s.id); Store.put(q,{silent:true});} ui.sel=null; Store.del('source',s.id);});
  });
}
function sourceModal(s){
  const isNew=!s; s=s?clone(s):{kind:'source',id:uid('s'),title:'',type:'Husförhörslängd',createdAt:new Date().toISOString()};
  modal(`<h3>${isNew?'Ny källa':'Redigera källa'}</h3>
    <label class="f"><span>Titel</span><input class="t" id="sT" value="${esc(s.title)}" placeholder="Rättvik (W) AI:15 Husförhörslängd 1850–1855"></label>
    <div class="row2"><label class="f"><span>Typ</span><select class="t" id="sTy">${SOURCE_TYPES.map(t=>`<option ${t===s.type?'selected':''}>${t}</option>`).join('')}</select></label>
    <label class="f"><span>Period / datum</span><input class="t" id="sD" value="${esc(s.date||'')}" placeholder="1850–1855"></label></div>
    <div class="row2"><label class="f"><span>Arkiv</span><input class="t" id="sA" value="${esc(s.archive||'')}" placeholder="Riksarkivet, ArkivDigital…"></label>
    <label class="f"><span>Referens / volym</span><input class="t" id="sR" value="${esc(s.ref||'')}" placeholder="AI:15, AID v12345"></label></div>
    <label class="f"><span>Länk</span><input class="t" id="sU" value="${esc(s.url||'')}" placeholder="https://sok.riksarkivet.se/…"></label>
    <label class="f"><span>Anteckningar / transkription</span><textarea class="t" id="sN">${esc(s.notes||'')}</textarea></label>
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Spara</button></div>`,(ov,close)=>{
    const q=x=>ov.querySelector(x); q('#sT').focus(); q('[data-x]').onclick=close;
    q('[data-ok]').onclick=()=>{const t=q('#sT').value.trim(); if(!t){q('#sT').focus();return;} Object.assign(s,{title:t,type:q('#sTy').value,date:q('#sD').value.trim(),archive:q('#sA').value.trim(),ref:q('#sR').value.trim(),url:q('#sU').value.trim(),notes:q('#sN').value}); close(); ui.sel={type:'source',id:s.id}; Store.put(s);};
  });
}

export { placePanel, bindPlacePanel, placeModal, replacePlace, mergeModal, citationsOf, renderSources, sourcePanel, bindSourcePanel, sourceModal };
