/* Släktsagan · panel.js — The side panel for a person: facts, family, events, sources, questions and voice memories. */
import { P, PIXEL, ageAt, avImg, avatarUrl, blobUrl, children, ensurePlace, fullHtml, fullName, homePerson, initials, isAudio, isImg, lifeEvents, lifespan, partners, personLabel, placeName, setHome, sexColor, shortName, siblings, storeBlob, thumbUrl } from './domain.js?v=41';
import { bindMedia, deletePerson, photoModal } from './media.js?v=41';
import { confirmBox, modal, openPersonModal } from './modal.js?v=41';
import { bindPlacePanel, bindSourcePanel, placePanel, sourcePanel } from './places.js?v=41';
import { bindSheet, followPerson, renderAll, select, setFocus } from './router.js?v=41';
import { Share, askName } from './share.js?v=41';
import { linkModal } from './start.js?v=41';
import { ALL, S, ui } from './state.js?v=41';
import { Hist, Store } from './store.js?v=41';
import { openCard } from './theme.js?v=41';
import { $, EVENT_TYPES, SOURCE_TYPES, clone, esc, fmtDate, norm, toast, uid } from './util.js?v=41';
import { fillNames, hideModal } from './views.js?v=41';

/* ============ PANEL ============ */
function renderPanel(){
  const pn=$('#panel');
  if(!ui.sel){pn.classList.remove('open','expanded','mini');pn.innerHTML='';ui.sheetFor=null;return;}
  pn.classList.add('open');
  // on phones a newly picked person opens as a small sheet; the same person keeps its size
  const selKey=ui.sel.type+':'+ui.sel.id; if(ui.sheetFor!==selKey){ui.sheetFor=selKey; pn.classList.remove('expanded','mini'); pn.scrollTop=0;}
  const st=pn.scrollTop;
  if(ui.sel.type==='person') pn.innerHTML=personPanel(P(ui.sel.id));
  else if(ui.sel.type==='place') pn.innerHTML=placePanel(S.places[ui.sel.id]);
  else if(ui.sel.type==='source') pn.innerHTML=sourcePanel(S.sources[ui.sel.id]);
  pn.insertAdjacentHTML('afterbegin','<button class="sheet-handle" aria-label="Visa mer"><i></i><span></span></button>');
  bindSheet(pn);
  pn.scrollTop=st;
  bindPanel();
}
const closeBtn=`<button class="iconbtn" onclick="select(null)" title="Stäng" style="margin-left:auto"><svg width="18" height="18" viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`;
const E=Store; // shorthand for canEdit checks in templates
function relRow(lbl,p,extra=''){return `<div class="rel"><span class="lbl">${lbl}</span><span class="dot" style="background:${sexColor(p)}"></span><span class="who" data-goto="${p.id}"><b>${esc(fullName(p))}</b> <span class="muted small">${esc(lifespan(p))}</span></span>${extra}</div>`;}
function personPanel(p){
  const ed=E.canEdit;
  const av=avatarUrl(p);
  const age=ageAt(p);
  const father=P(p.fatherId),mother=P(p.motherId);
  const parts=partners(p), kids=children(p.id), sibs=siblings(p);
  const evs=lifeEvents(p);
  const cites=p.citations||[];
  const aboutLabel=a=>{if(!a) return 'Allmänt'; if(a.startsWith('event:')){const e=(p.events||[]).find(e=>'event:'+e.id===a); return e?e.type+(e.date?' '+e.date:''):'Händelse';} return a;};
  return `<div class="ph"><div class="top">
      ${ed?`<label class="avatar clickable" style="border-color:${sexColor(p)}" title="${av?'Byt profilbild':'Lägg till profilbild'}">${av?avImg(p):`<span>${esc(initials(p))}</span>`}<input type="file" id="uplAv" accept="image/*" hidden></label>`:`<div class="avatar" style="border-color:${sexColor(p)}">${av?avImg(p):esc(initials(p))}</div>`}
      <div style="flex:1;min-width:0"><h3>${fullHtml(p)}</h3><div class="sub">${esc(lifespan(p))}${age!=null?` · ${age} år`:''}${p.occupation?` · ${esc(p.occupation)}`:''}</div></div>
      ${closeBtn}</div>
    <div class="acts">
      <button class="btn sm" data-act="card">Personkort</button>${ed&&av?'<button class="btn sm" data-act="photo" title="Flytta och zooma bilden så att ansiktet hamnar rätt">Justera bild</button>':''}
      <button class="btn sm" data-act="focus">Visa i trädet</button>
      <button class="btn sm" data-act="rel">Hur är vi släkt?</button>
      ${ed?'<button class="btn sm" data-act="hide" title="Dölj personen eller en hel gren i en vy">👁 Dölj i vyn…</button>':''}
      ${ed?`<button class="btn sm ${p.home?'primary':''}" data-act="home" title="Startsidan, trädet och släktskap utgår från den här personen">${p.home?'★ Det här är jag':'Det här är jag'}</button>`:''}
      ${ed?`<button class="btn sm" data-act="edit">Redigera</button><button class="btn sm ghost danger" data-act="delp">Ta bort</button>`:''}
    </div></div>
  ${p.updatedBy&&Store.user?`<div class="sec small muted" style="padding:8px 20px">Senast ändrad ${esc(fmtDate((p.updatedAt||'').slice(0,10)))} av <span data-uid="${esc(p.updatedBy)}">…</span></div>`:''}
  <div class="sec"><h4>Fakta</h4><dl class="facts">
    <dt>Född</dt><dd>${esc(p.birthDate||'–')}${p.birthPlace?` <a href="#" data-place="${p.birthPlace}">${esc(placeName(p.birthPlace))}</a>`:''}</dd>
    <dt>Död</dt><dd>${esc(p.deathDate||'–')}${p.deathPlace?` <a href="#" data-place="${p.deathPlace}">${esc(placeName(p.deathPlace))}</a>`:''}</dd>
    <dt>Kön</dt><dd>${p.sex==='M'?'Man':p.sex==='K'?'Kvinna':'Okänt'}</dd>
  </dl></div>
  <div class="sec"><h4>Familj</h4>
    ${father?relRow('Far',father,ed?`<button class="iconbtn" title="Koppla bort" data-unlink="fatherId">×</button>`:''):p.fatherId?`<div class="rel"><span class="lbl">Far</span><span class="muted small">Dold i den här vyn</span></div>`:ed?`<div class="rel"><span class="lbl">Far</span><button class="btn sm ghost" data-add="father">+ Lägg till far</button></div>`:''}
    ${mother?relRow('Mor',mother,ed?`<button class="iconbtn" title="Koppla bort" data-unlink="motherId">×</button>`:''):p.motherId?`<div class="rel"><span class="lbl">Mor</span><span class="muted small">Dold i den här vyn</span></div>`:ed?`<div class="rel"><span class="lbl">Mor</span><button class="btn sm ghost" data-add="mother">+ Lägg till mor</button></div>`:''}
    ${parts.map(sp=>relRow('Partner',sp,ed&&(p.spouseIds||[]).includes(sp.id)?`<button class="iconbtn" title="Koppla bort" data-unspouse="${sp.id}">×</button>`:'')).join('')}
    ${kids.map(c=>relRow('Barn',c)).join('')}
    ${sibs.map(s=>relRow('Syskon',s)).join('')}
    ${ed?`<div class="acts" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-add="partner">+ Partner</button><button class="btn sm" data-add="child">+ Barn</button><button class="btn sm" data-add="sibling">+ Syskon</button><button class="btn sm" data-act="link" title="Koppla till en person som redan finns i arkivet">🔗 Koppla till befintlig person</button></div>`:''}
  </div>
  <div class="sec"><h4>Händelser ${ed?'<button class="btn sm" data-act="addev">+ Händelse</button>':''}</h4>
    <div id="evform"></div>
    ${evs.length?evs.map(e=>{const nc=e.id?cites.filter(c=>c.about==='event:'+e.id).length:0; return `<div class="ev"><span class="d">${esc(e.date||'–')}</span><span class="w"><b>${esc(e.type)}</b>${e.placeId?` · <a href="#" data-place="${e.placeId}">${esc(placeName(e.placeId))}</a>`:''}${e.withId&&P(e.withId)?` · med <a href="#" data-goto="${e.withId}">${esc(fullName(P(e.withId)))}</a>`:''}${e.desc?`<div class="small muted">${esc(e.desc)}</div>`:''}${nc?`<div class="small muted">📜 ${nc} källhänvisning${nc>1?'ar':''}</div>`:''}</span>
      <span>${ed&&e.id?`<button class="iconbtn" data-editev="${e.id}" title="Redigera">✎</button>`:''}</span></div>`}).join(''):'<div class="muted small">Inga händelser registrerade.</div>'}
  </div>
  <div class="sec cites"><h4>Källor ${ed?'<button class="btn sm" data-act="addcite">+ Källhänvisning</button>':''}</h4>
    <div id="citeform"></div>
    ${cites.length?cites.map(c=>{const s=S.sources[c.sourceId]; return `<div class="cite"><div style="display:flex;gap:6px"><b data-src="${c.sourceId}" style="flex:1">${esc(s?s.title:'(borttagen källa)')}</b>${ed?`<button class="iconbtn" data-delcite="${c.id}" title="Ta bort">×</button>`:''}</div>
      <div class="small muted">${esc(aboutLabel(c.about))}${c.detail?' · '+esc(c.detail):''}${s&&s.ref&&!(c.detail||'').includes(s.ref)?' · '+esc(s.ref):''}</div>${citeLinks(c)}</div>`}).join(''):`<div class="muted small">Inga källor ännu. Koppla husförhörslängder, dopböcker m.m. så vet du var uppgifterna kommer ifrån.</div>`}
  </div>
  ${commentSection(p)}
  ${voiceSection(p)}
  ${mediaSection(p)}
  <div class="sec"><h4>Anteckningar</h4>
    ${ed?`<textarea class="t" id="notes" placeholder="Forskningsanteckningar, frågor, ledtrådar…">${esc(p.notes||'')}</textarea><div class="hint" id="notesHint">Sparas när du klickar utanför rutan.</div>`:`<div style="white-space:pre-wrap">${esc(p.notes||'–')}</div>`}
  </div>`;
}
/* ============ Voice memories ============
   Recorded in the browser (MediaRecorder), kept in the image store like photos and,
   in shared trees, uploaded encrypted. A memory can be tied to one of the person's photos. */
const fmtDur=s=>{s=Math.round(s||0); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
/* ============ Questions & comments per person ============
   Each comment is its own document ({kind:'comment', personId, text, by, at, resolved}), so two
   relatives commenting at the same time never overwrite each other when they publish. */
const commentsFor=pid=>Object.values(ALL.comments).filter(c=>c.personId===pid).sort((a,b)=>(a.at||'').localeCompare(b.at||''));
const openQuestions=()=>Object.values(ALL.comments).filter(c=>!c.resolved&&!c.replyTo&&P(c.personId));
const openCount=pid=>Object.values(ALL.comments).filter(c=>c.personId===pid&&!c.resolved&&!c.replyTo).length;
function ago(iso){ if(!iso) return ''; const d=(Date.now()-Date.parse(iso))/1000;
  if(d<60) return 'nyss'; if(d<3600) return Math.floor(d/60)+' min sedan'; if(d<86400) return Math.floor(d/3600)+' tim sedan'; if(d<7*86400){const n=Math.floor(d/86400); return n===1?'i går':n+' dagar sedan';}
  return fmtDate(iso.slice(0,10)); }
const myName=()=>Share.st.name||'';
function commentSection(p){
  const all=commentsFor(p.id), roots=all.filter(c=>!c.replyTo), ed=Store.canEdit, nOpen=roots.filter(c=>!c.resolved).length;
  const one=(c,reply)=>`<div class="cm${c.resolved?' done':''}${reply?' reply':''}" data-cm="${c.id}">
      <span class="cm-av" style="background:${nameColor(c.by)}">${esc((c.by||'?').trim().charAt(0).toUpperCase()||'?')}</span>
      <div class="cm-b"><div class="cm-h"><b>${esc(c.by||'Någon')}</b><span class="muted small">${esc(ago(c.at))}</span>${c.resolved&&!reply?'<span class="cm-tag">✓ Löst</span>':''}</div>
        <div class="cm-t">${esc(c.text).replace(/\n/g,'<br>')}</div>
        ${ed?`<div class="cm-acts">${reply?'':`<button class="linkbtn" data-cmreply="${c.id}">Svara</button><button class="linkbtn" data-cmres="${c.id}">${c.resolved?'Öppna igen':'Markera som löst'}</button>`}${!c.by||c.by===myName()||!Share.cur()?`<button class="linkbtn muted" data-cmdel="${c.id}">Ta bort</button>`:''}</div>`:''}</div></div>`;
  return `<div class="sec comments"><h4>Frågor &amp; kommentarer${nOpen?` <span class="cm-count">${nOpen} öppen${nOpen===1?'':'a'}</span>`:''}</h4>
    ${roots.length?roots.map(c=>one(c,false)+all.filter(r=>r.replyTo===c.id).map(r=>one(r,true)).join('')+`<div class="cm-replybox" data-replybox="${c.id}" hidden></div>`).join(''):`<div class="muted small">${Share.cur()?'Undrar du något om '+esc(shortName(p))+'? Skriv en fråga här – alla som har länken ser den när du har publicerat.':'Skriv en fråga eller en ledtråd om '+esc(shortName(p))+' som du vill komma ihåg. Delar du trädet ser hela släkten den.'}</div>`}
    ${ed?`<div class="cm-new"><textarea class="t" id="cmText" rows="2" placeholder="Vet någon när ${esc(shortName(p))} föddes? …"></textarea><button class="btn sm primary" id="cmSend">Skicka</button></div>`:''}
  </div>`;
}
/** A stable soft colour per name, for the little avatar. */
function nameColor(n){ let h=0; for(const ch of String(n||'?')) h=(h*31+ch.charCodeAt(0))>>>0; return `hsl(${h%360} 32% 46%)`; }
async function addComment(pid,text,replyTo){
  text=String(text||'').trim(); if(!text) return false;
  if(Share.cur()&&!myName()){ const n=await askName(); if(!n) return false; Share.st.name=n; Share.save(); }
  const c={kind:'comment',id:uid('cm'),personId:pid,text,by:myName(),at:new Date().toISOString()}; if(replyTo) c.replyTo=replyTo;
  Hist.label(replyTo?'Svar på en fråga':'Ny fråga om '+shortName(P(pid))); await Store.put(c); return true;
}
function bindComments(pn,p){
  const send=pn.querySelector('#cmSend'), ta=pn.querySelector('#cmText');
  if(send) send.onclick=async()=>{ if(await addComment(p.id,ta.value)) toast(Share.cur()?'Skickad – publicera så att släkten ser den.':'Sparad.',3500,Share.cur()?{label:'Publicera',fn:()=>Share.publish()}:undefined); };
  if(ta) ta.onkeydown=e=>{ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)) send.click(); };
  pn.querySelectorAll('[data-cmres]').forEach(b=>b.onclick=()=>{ const c=clone(ALL.comments[b.dataset.cmres]); c.resolved=!c.resolved; if(c.resolved){c.resolvedBy=myName(); c.resolvedAt=new Date().toISOString();} else {delete c.resolvedBy; delete c.resolvedAt;} Store.put(c); });
  pn.querySelectorAll('[data-cmdel]').forEach(b=>b.onclick=()=>{ const id=b.dataset.cmdel; Hist.label('Borttagen kommentar'); Store.del('comment',id,{silent:true}); for(const r of Object.values(ALL.comments)) if(r.replyTo===id) Store.del('comment',r.id,{silent:true}); renderAll(); });
  pn.querySelectorAll('[data-cmreply]').forEach(b=>b.onclick=()=>{ const box=pn.querySelector(`[data-replybox="${b.dataset.cmreply}"]`); box.hidden=false;
    box.innerHTML='<textarea class="t" rows="2" placeholder="Ditt svar…"></textarea><button class="btn sm primary">Svara</button>'; const t=box.querySelector('textarea'); t.focus();
    box.querySelector('button').onclick=()=>addComment(p.id,t.value,b.dataset.cmreply); t.onkeydown=e=>{ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)) box.querySelector('button').click(); }; });
}
function voiceRows(o,{forImg,edit}={}){
  const list=(o.media||[]).map((m,i)=>({m,i})).filter(({m})=>isAudio(m)&&(forImg===undefined||m.forImg===forImg));
  return list.map(({m,i})=>{const img=!forImg&&m.forImg?(o.media||[]).find(x=>x.url===m.forImg):null;
    return `<div class="vm" data-vm="${i}"><button class="vm-play" data-play="${i}" aria-label="Spela upp">▶</button>
      <div class="vm-b"><b>${esc(m.caption||'Röstminne')}</b><span class="small muted">${fmtDur(m.duration)}${m.recordedAt?' · '+esc(fmtDate(m.recordedAt.slice(0,10))):''}${m.by?' · '+esc(m.by):''}</span><div class="vm-player"></div></div>
      ${img?`<img class="vm-img" src="${esc(thumbUrl(img))}" alt="" title="Hör till bilden ${esc(img.caption||img.name||'')}">`:''}
      ${edit?`<button class="iconbtn" data-vedit="${i}" title="Ändra">✎</button>`:''}</div>`;}).join('');
}
function voiceSection(o){
  const n=(o.media||[]).filter(isAudio).length, ed=E.canEdit;
  if(!n&&!ed) return '';
  return `<div class="sec"><h4>Röstminnen ${ed?`<span style="display:flex;gap:6px"><button class="btn sm" data-act="record">🎙 Spela in</button><label class="btn sm" style="cursor:pointer" title="Ladda upp en ljudfil">↑ Fil<input type="file" id="uplAudio" accept="audio/*" hidden></label></span>`:''}</h4>
    ${n?`<div class="vms">${voiceRows(o,{edit:ed})}</div>`:`<div class="muted small">Spela in när någon berättar om personen – en historia, ett minne, hur rösten lät. Inspelningen sparas här${Share.cur()?' och delas krypterad med släkten':''}.</div>`}</div>`;
}
/** Wire play buttons (and edit buttons) inside an element. */
function bindVoices(root,o){
  root.querySelectorAll('[data-play]').forEach(b=>b.onclick=async e=>{e.stopPropagation(); const m=o.media[+b.dataset.play]; const row=b.closest('.vm'); const box=row.querySelector('.vm-player');
    if(box.firstChild){ const a=box.querySelector('audio'); if(a.paused) a.play(); else a.pause(); return; }
    b.textContent='…'; const src=await blobUrl(m); if(!src||src===PIXEL){b.textContent='▶'; toast('Inspelningen kunde inte hämtas just nu.'); return;}
    box.innerHTML=`<audio controls autoplay src="${esc(src)}"></audio>`; const a=box.querySelector('audio');
    a.onplay=()=>b.textContent='❚❚'; a.onpause=a.onended=()=>b.textContent='▶'; b.textContent='❚❚'; a.play().catch(()=>{});});
  root.querySelectorAll('[data-vedit]').forEach(b=>b.onclick=e=>{e.stopPropagation(); voiceEdit(o,+b.dataset.vedit);});
}
function voiceEdit(o,i){
  const m=o.media[i], imgs=(o.media||[]).filter(isImg);
  modal(`<h3>Röstminne</h3>
    <label class="f"><span>Titel</span><input class="t" id="veT" value="${esc(m.caption||'')}" placeholder="t.ex. Farmor berättar om flytten till Göteborg"></label>
    ${imgs.length?`<div class="f"><span class="lab">Hör till bild</span><div class="vimgs"><label class="vimg"><input type="radio" name="veI" value="" ${!m.forImg?'checked':''}><span>Ingen</span></label>${imgs.map(x=>`<label class="vimg"><input type="radio" name="veI" value="${esc(x.url)}" ${m.forImg===x.url?'checked':''}><img src="${esc(thumbUrl(x))}" alt=""></label>`).join('')}</div></div>`:''}
    <div class="foot"><button class="btn ghost danger" id="veDel" style="margin-right:auto">Ta bort</button><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Spara</button></div>`,
  (ov,close)=>{const q=x=>ov.querySelector(x); q('[data-x]').onclick=close;
    q('[data-ok]').onclick=()=>{const c=clone(o); const mm=c.media[i]; mm.caption=q('#veT').value.trim(); const r=ov.querySelector('[name=veI]:checked'); if(r){ if(r.value) mm.forImg=r.value; else delete mm.forImg; } Store.put(c); close();};
    q('#veDel').onclick=()=>{close(); confirmBox('Ta bort röstminnet?','Inspelningen tas bort ur arkivet.','Ta bort',()=>{const c=clone(o); c.media.splice(i,1); Store.put(c);});};});
}
async function saveVoice(o,blob,{duration,caption,forImg}){
  if(blob.size>2600000) throw new Error('inspelningen är för stor (max cirka 10 minuter)');
  const type=(blob.type||'audio/webm').split(';')[0], ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':type.includes('mpeg')?'mp3':'webm';
  let item;
  if(E.assets){const r=await E.assets.upload(new File([blob],'rostminne.'+ext,{type})); item={assetId:r.id,url:r.url,contentType:type};}
  else{ const dataUrl=await new Promise((ok,bad)=>{const fr=new FileReader(); fr.onload=()=>ok(fr.result); fr.onerror=()=>bad(fr.error); fr.readAsDataURL(blob);}); item={url:'kl:'+await storeBlob(dataUrl),contentType:type}; }
  Object.assign(item,{name:'rostminne.'+ext,caption:caption||'',duration:Math.round(duration||0),recordedAt:new Date().toISOString(),by:Share.st.name||''});
  if(forImg) item.forImg=forImg;
  const c=clone(P(o.id)||o); c.media=(c.media||[]).concat([item]); await Store.put(c);
}
function audioDuration(blob){return new Promise(res=>{const a=document.createElement('audio'); a.preload='metadata'; const u=URL.createObjectURL(blob);
  a.onloadedmetadata=()=>{ if(a.duration===Infinity){a.currentTime=1e9; a.ontimeupdate=()=>{a.ontimeupdate=null; res(a.duration); URL.revokeObjectURL(u);};} else {res(a.duration); URL.revokeObjectURL(u);} };
  a.onerror=()=>{res(0); URL.revokeObjectURL(u);}; a.src=u;});}
function recordModal(o,{forImg}={}){
  if(!navigator.mediaDevices||!window.MediaRecorder){toast('Den här webbläsaren kan inte spela in ljud. Ladda upp en ljudfil i stället.',6000);return;}
  const imgs=(o.media||[]).filter(isImg), MAX=600;
  modal(`<h3>Spela in ett röstminne</h3>
    <p class="muted" style="margin-top:-4px">${esc(fullName(o))}. Håll telefonen nära den som berättar. Max 10 minuter.</p>
    <div class="rec"><button class="rec-btn" id="recBtn" aria-label="Börja spela in"><i></i></button>
      <div class="rec-info"><div class="rec-time" id="recTime">0:00</div><div class="rec-meter"><i id="recLvl"></i></div><div class="small muted" id="recMsg">Tryck på den röda knappen för att börja.</div></div></div>
    <div id="recAfter" hidden>
      <audio id="recPlay" controls style="width:100%;margin:8px 0 12px"></audio>
      <label class="f"><span>Titel</span><input class="t" id="recT" placeholder="t.ex. Farmor berättar om flytten till Göteborg"></label>
      ${imgs.length?`<div class="f"><span class="lab">Hör till bild (valfritt)</span><div class="vimgs"><label class="vimg"><input type="radio" name="recI" value="" ${!forImg?'checked':''}><span>Ingen</span></label>${imgs.map(x=>`<label class="vimg"><input type="radio" name="recI" value="${esc(x.url)}" ${forImg===x.url?'checked':''}><img src="${esc(thumbUrl(x))}" alt=""></label>`).join('')}</div></div>`:''}
    </div>
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok disabled>Spara</button></div>`,
  (ov,close0)=>{
    const q=x=>ov.querySelector(x); let stream=null, rec=null, chunks=[], t0=0, timer=null, raf=null, ctx=null, blob=null, secs=0;
    const stopAll=()=>{clearInterval(timer); cancelAnimationFrame(raf); if(stream) stream.getTracks().forEach(t=>t.stop()); stream=null; if(ctx) ctx.close().catch(()=>{}); ctx=null;};
    const close=()=>{ if(rec&&rec.state==='recording'){rec.onstop=null; rec.stop();} stopAll(); close0(); };
    q('[data-x]').onclick=close;
    const btn=q('#recBtn');
    btn.onclick=async()=>{
      if(rec&&rec.state==='recording'){rec.stop(); return;}
      try{ stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}); }
      catch(e){ q('#recMsg').textContent='Fick inte använda mikrofonen. Tillåt mikrofon för sidan i webbläsarens inställningar.'; return; }
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));
      rec=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:24000}:{audioBitsPerSecond:24000}); chunks=[];
      rec.ondataavailable=e=>{if(e.data&&e.data.size) chunks.push(e.data);};
      rec.onstop=async()=>{ stopAll(); blob=new Blob(chunks,{type:rec.mimeType||mime||'audio/webm'}); btn.classList.remove('on'); btn.setAttribute('aria-label','Spela in igen');
        q('#recMsg').textContent='Klart! Lyssna, ge den en titel och spara. Tryck på knappen igen för att börja om.';
        const u=URL.createObjectURL(blob); q('#recPlay').src=u; q('#recAfter').hidden=false; q('[data-ok]').disabled=false; q('#recT').focus(); };
      rec.start(1000); t0=Date.now(); btn.classList.add('on'); btn.setAttribute('aria-label','Stoppa'); q('#recMsg').textContent='Spelar in… tryck igen för att stoppa.'; q('#recAfter').hidden=true; q('[data-ok]').disabled=true;
      timer=setInterval(()=>{secs=(Date.now()-t0)/1000; q('#recTime').textContent=fmtDur(secs); if(secs>=MAX) rec.stop();},250);
      try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); const an=ctx.createAnalyser(); an.fftSize=512; ctx.createMediaStreamSource(stream).connect(an); const d=new Uint8Array(an.fftSize);
        const tick=()=>{an.getByteTimeDomainData(d); let m=0; for(const v of d) m=Math.max(m,Math.abs(v-128)); q('#recLvl').style.width=Math.min(100,m/64*100)+'%'; raf=requestAnimationFrame(tick);}; tick(); }catch(e){}
    };
    q('[data-ok]').onclick=async()=>{ if(!blob) return; const b=q('[data-ok]'); b.disabled=true; b.textContent='Sparar…';
      const r=ov.querySelector('[name=recI]:checked');
      try{ await saveVoice(o,blob,{duration:secs,caption:q('#recT').value.trim(),forImg:r&&r.value||''}); close(); toast('Röstminnet är sparat.'+(Share.cur()?' Publicera så att släkten kan lyssna.':''),5000); }
      catch(e){ b.disabled=false; b.textContent='Spara'; toast('Kunde inte spara: '+(e.message||e),6000); }
    };
  });
}
function mediaSection(o){
  const ed=E.canEdit; const can=ed;
  return `<div class="sec"><h4>Bilder &amp; dokument ${can?`<label class="btn sm" style="cursor:pointer">+ Ladda upp<input type="file" id="upl" multiple accept="${E.assets?'image/*,application/pdf':'image/*'}" hidden></label>`:''}</h4>
    <div id="uplprog"></div>
    ${(o.media||[]).some(m=>!isAudio(m))?`<div class="media">${o.media.map((m,i)=>isAudio(m)?'':`<div class="m" data-media="${i}" title="${esc(m.caption||m.name)}">${/^image\//.test(m.contentType||'')?`<img src="${esc(thumbUrl(m))}" alt="${esc(m.caption||'')}" loading="lazy">`:`📄<br>${esc((m.name||'dokument').slice(0,26))}`}${m.profile?'<span style="position:absolute;top:4px;left:4px;background:var(--ink);color:#fff;border-radius:99px;font-size:10px;padding:1px 6px">profil</span>':''}</div>`).join('')}</div>`:`<div class="muted small">${can?(E.assets?'Lägg till foton, inskannade brev eller kyrkboksutdrag (bild eller PDF).':'Lägg till foton eller inskannade dokument som bild. Bilderna förminskas och sparas i webbläsaren.'):'Inga filer.'}</div>`}
  </div>`;
}
function bindPanel(){
  const pn=$('#panel');
  pn.querySelectorAll('[data-goto]').forEach(el=>el.onclick=e=>{e.preventDefault(); followPerson(el.dataset.goto);});
  pn.querySelectorAll('[data-place]').forEach(el=>el.onclick=e=>{e.preventDefault();select('place',el.dataset.place);});
  pn.querySelectorAll('[data-src]').forEach(el=>el.onclick=e=>{e.preventDefault();select('source',el.dataset.src);});
  if(!ui.sel) return;
  if(ui.sel.type==='person') bindPersonPanel(P(ui.sel.id));
  fillNames(pn);
  if(ui.sel.type==='place') bindPlacePanel(S.places[ui.sel.id]);
  if(ui.sel.type==='source') bindSourcePanel(S.sources[ui.sel.id]);
  bindMedia();
}
function bindPersonPanel(p){
  const pn=$('#panel'); const a=s=>pn.querySelector(s);
  pn.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
    const act=b.dataset.act;
    if(act==='focus'){setFocus(p.id);ui.treeKey=null; if(ui.view!=='trad') location.hash='trad'; else renderAll();}
    if(act==='edit') openPersonModal(p);
    if(act==='card') openCard(p.id);
    if(act==='hide') hideModal(p);
    if(act==='rel'){ui.relB=p.id; if(!ui.relA||ui.relA===p.id) ui.relA=(homePerson()&&homePerson().id!==p.id)?homePerson().id:(ui.focus!==p.id?ui.focus:null); location.hash='slaktskap';}
    if(act==='home'&&!p.home) setHome(p.id);
    if(act==='delp') confirmBox(`Ta bort ${fullName(p)}?`,'Personen tas bort och kopplingar till familjemedlemmar lossas. Du kan ångra det efteråt med ↶ eller Ctrl+Z.','Ta bort',()=>deletePerson(p.id));
    if(act==='addev') eventForm(p,null);
    if(act==='addcite') citeForm(p);
    if(act==='link') linkModal(p.id);
    if(act==='record') recordModal(p);
    if(act==='photo') photoModal(p.id);
  });
  pn.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
    if(b.dataset.add==='sibling'&&!p.fatherId&&!p.motherId){toast(`Syskon kopplas via föräldrarna. Lägg först till far eller mor till ${fullName(p)}.`,5000);return;}
    openPersonModal(null,{rel:b.dataset.add,of:p.id});});
  pn.querySelectorAll('[data-unlink]').forEach(b=>b.onclick=()=>{const q=clone(p); q[b.dataset.unlink]=''; Store.put(q);});
  pn.querySelectorAll('[data-unspouse]').forEach(b=>b.onclick=()=>{const o=P(b.dataset.unspouse); const q=clone(p); q.spouseIds=(q.spouseIds||[]).filter(x=>x!==o.id); Store.put(q,{silent:true}); if(o){const r=clone(o); r.spouseIds=(r.spouseIds||[]).filter(x=>x!==p.id); Store.put(r,{silent:true});} renderAll();});
  pn.querySelectorAll('[data-editev]').forEach(b=>b.onclick=()=>eventForm(p,(p.events||[]).find(e=>e.id===b.dataset.editev)));
  pn.querySelectorAll('[data-delcite]').forEach(b=>b.onclick=()=>{const q=clone(p); q.citations=(q.citations||[]).filter(c=>c.id!==b.dataset.delcite); Store.put(q);});
  const nt=a('#notes'); if(nt) nt.onblur=()=>{if((p.notes||'')!==nt.value){const q=clone(P(p.id)); q.notes=nt.value; Store.put(q,{silent:true}); $('#notesHint').textContent='Sparat ✓';}};
}
function placeOptions(){return `<datalist id="dlPlaces">${Object.values(S.places).sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(pl=>`<option value="${esc(pl.name)}">`).join('')}</datalist>`;}
function personOptions(exclude){return `<datalist id="dlPersons">${Object.values(S.persons).filter(x=>x.id!==exclude).map(x=>{const l=personLabel(x);return `<option value="${esc(l)}">`;}).join('')}</datalist>`;}
function personByLabel(label){label=norm(label); if(!label) return null; const all=Object.values(S.persons); return all.find(x=>norm(personLabel(x))===label)||(()=>{const m=all.filter(x=>norm(fullName(x))===label); return m.length===1?m[0]:null;})();}
function eventForm(p,ev){
  const f=$('#evform'); const isNew=!ev; ev=ev||{type:'Flytt'};
  f.innerHTML=`<div class="mini">
    <div class="row2"><label class="f"><span>Typ</span><select class="t" id="evT">${EVENT_TYPES.map(t=>`<option ${t===ev.type?'selected':''}>${t}</option>`).join('')}</select></label>
    <label class="f"><span>Datum</span><input class="t" id="evD" value="${esc(ev.date||'')}" placeholder="1823-04-12, 1823, ca 1820"></label></div>
    <label class="f"><span>Plats</span><input class="t" id="evP" list="dlPlaces" value="${esc(placeName(ev.placeId))}" placeholder="t.ex. Rättvik">${placeOptions()}</label>
    <label class="f" id="evWithL"><span>Med (t.ex. make/maka vid vigsel)</span><input class="t" id="evW" list="dlPersons" value="${esc(ev.withId&&P(ev.withId)?personLabel(P(ev.withId)):'')}">${personOptions(p.id)}</label>
    <label class="f"><span>Beskrivning</span><input class="t" id="evX" value="${esc(ev.desc||'')}" placeholder="t.ex. Flyttar till Stockholm, Klara församling"></label>
    <div style="display:flex;gap:6px">${!isNew?'<button class="btn sm danger ghost" id="evDel">Ta bort</button>':''}<span style="flex:1"></span><button class="btn sm" id="evC">Avbryt</button><button class="btn sm primary" id="evS">Spara</button></div></div>`;
  $('#evD').focus();
  $('#evC').onclick=()=>f.innerHTML='';
  if(!isNew) $('#evDel').onclick=()=>{const q=clone(P(p.id)); q.events=(q.events||[]).filter(e=>e.id!==ev.id); q.citations=(q.citations||[]).filter(c=>c.about!=='event:'+ev.id); Store.put(q);};
  $('#evS').onclick=()=>{
    const q=clone(P(p.id)); const pl=ensurePlace($('#evP').value); if(pl.created) Store.put(pl.created,{silent:true});
    const w=personByLabel($('#evW').value);
    const ne={id:ev.id||uid('e'),type:$('#evT').value,date:$('#evD').value.trim(),placeId:pl.id,desc:$('#evX').value.trim(),withId:w?w.id:''};
    q.events=(q.events||[]).filter(e=>e.id!==ne.id).concat([ne]);
    Store.put(q);
  };
}
/** Links for a citation: the image at Riksarkivet, or the AID to paste into ArkivDigital. */
function citeLinks(c){
  if(!c.url&&!c.aid) return '';
  return `<div class="cite-links">${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener">Visa bilden hos Riksarkivet ↗</a>`:''}${c.aid?`<button class="linkbtn" data-copyaid="${esc(c.aid)}" title="Klistra in i ArkivDigitals sökruta för att öppna bilden">Kopiera AID ${esc(c.aid)}</button>`:''}</div>`;
}
function citeForm(p){
  const f=$('#citeform');
  const srcs=Object.values(S.sources).sort((a,b)=>a.title.localeCompare(b.title,'sv'));
  f.innerHTML=`<div class="mini">
    <label class="f"><span>Klistra in från ArkivDigital eller Riksarkivet <small class="muted">– fyller i resten åt dig</small></span><textarea class="t" id="ciPaste" rows="2" placeholder="Röke (L) AII:3 (1918-1933) Bild 70 / sid 3 (AID: v350192.b70.s3, NAD: SE/LLA/13324)"></textarea></label>
    <div id="ciParsed" class="ci-parsed" hidden></div>
    <label class="f"><span>Källa</span><select class="t" id="ciS"><option value="__new">+ Ny källa…</option>${srcs.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label>
    <div id="ciNew"><div class="row2"><label class="f"><span>Titel på ny källa</span><input class="t" id="ciT" placeholder="Rättvik (W) AI:15 1850–1855"></label>
      <label class="f"><span>Typ</span><select class="t" id="ciTy">${SOURCE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></label></div></div>
    <div class="row2"><label class="f"><span>Gäller</span><select class="t" id="ciA"><option value="">Allmänt</option><option>Födelse</option><option>Död</option><option>Föräldrar</option><option>Namn</option><option>Yrke</option>${(p.events||[]).map(e=>`<option value="event:${e.id}">${esc(e.type+(e.date?' '+e.date:''))}</option>`).join('')}</select></label>
    <label class="f"><span>Sida / bild-ID</span><input class="t" id="ciD" placeholder="sid 45, bild 50"></label></div>
    <div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn sm" id="ciC">Avbryt</button><button class="btn sm primary" id="ciOk">Spara</button></div></div>`;
  const sync=()=>$('#ciNew').style.display=$('#ciS').value==='__new'?'':'none';
  if(srcs.length) $('#ciS').value=srcs[0].id; sync(); $('#ciS').onchange=sync;
  $('#ciC').onclick=()=>f.innerHTML='';
  // A pasted ArkivDigital / Riksarkivet citation picks (or prepares) the volume as the source and fills in image and page.
  let parsed=null;
  $('#ciPaste').oninput=()=>{
    const r=KinCore.parseSwedishCitation($('#ciPaste').value), box=$('#ciParsed'); parsed=r;
    if(!r){ box.hidden=!$('#ciPaste').value.trim(); box.innerHTML='Känner inte igen texten. Kopiera hänvisningen från ArkivDigital (Kopiera källa) eller Riksarkivets bildvisning (Källa).'; box.className='ci-parsed bad'; return; }
    const ex=r.key&&Object.values(S.sources).find(x=>x.volKey===r.key) || r.title&&Object.values(S.sources).find(x=>norm(x.title)===norm(r.title));
    if(ex) $('#ciS').value=ex.id; else if(r.title){ $('#ciS').value='__new'; $('#ciT').value=r.title; if(SOURCE_TYPES.includes(r.type)) $('#ciTy').value=r.type; }
    sync(); $('#ciD').value=r.detail;
    const ab={'Födelse- och dopbok':'Födelse','Död- och begravningsbok':'Död'}[r.type]; const vig=r.type==='Lysnings- och vigselbok'&&(p.events||[]).find(e=>e.type==='Vigsel');
    if(ab) $('#ciA').value=ab; else if(vig) $('#ciA').value='event:'+vig.id;
    box.hidden=false; box.className='ci-parsed ok';
    box.innerHTML=`✓ ${r.from==='ad'?'ArkivDigital':'Riksarkivet'}${r.parish?` · ${esc(r.parish)}${r.county?' ('+esc(r.county)+')':''}`:''}${r.type!=='Övrigt'?' · '+esc(r.type):''} – ${ex?`kopplas till <b>${esc(ex.title)}</b>`:r.title?'ny källa skapas':'välj vilken källa bilden hör till'}${r.url?` · <a href="${esc(r.url)}" target="_blank" rel="noopener">visa bilden ↗</a>`:''}`;
  };
  $('#ciOk').onclick=()=>{
    let sid=$('#ciS').value;
    if(sid==='__new'){const t=$('#ciT').value.trim(); if(!t){$('#ciT').focus();return;} const s={kind:'source',id:uid('s'),title:t,type:$('#ciTy').value,createdAt:new Date().toISOString()};
      if(parsed&&parsed.title&&norm(parsed.title)===norm(t)){ if(parsed.key) s.volKey=parsed.key; if(parsed.nad) s.ref=parsed.nad+(parsed.from==='ad'?'':'/'+parsed.volume); s.archive=parsed.from==='ad'?'ArkivDigital':'Riksarkivet'; if(parsed.county) s.county=parsed.county; if(parsed.parish) s.parish=parsed.parish; if(parsed.nad) s.url='https://sok.riksarkivet.se/?postid=ArkisRef%20'+parsed.nad.split('/').slice(0,3).join('/'); }
      Store.put(s,{silent:true}); sid=s.id;}
    const c={id:uid('c'),sourceId:sid,about:$('#ciA').value,detail:$('#ciD').value.trim()};
    if(parsed){ if(parsed.aid) c.aid=parsed.aid; if(parsed.bildid) c.bildid=parsed.bildid; if(parsed.url) c.url=parsed.url; }
    const q=clone(P(p.id)); q.citations=(q.citations||[]).concat([c]);
    Store.put(q);
  };
}
function shrinkImage(file,max=900,q=.8){
  return new Promise((res,rej)=>{const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',q));};
    img.onerror=()=>{URL.revokeObjectURL(url); rej(new Error('Kunde inte läsa bilden'));}; img.src=url;});
}

export { renderPanel, closeBtn, E, relRow, personPanel, fmtDur, commentsFor, openQuestions, openCount, ago, myName, commentSection, nameColor, addComment, bindComments, voiceRows, voiceSection, bindVoices, voiceEdit, saveVoice, audioDuration, recordModal, mediaSection, bindPanel, bindPersonPanel, placeOptions, personOptions, personByLabel, eventForm, citeLinks, citeForm, shrinkImage };
