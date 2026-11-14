/* Släktsagan · media.js — Photos and documents: upload, drag and drop, thumbnails, face framing, lightbox. */
import { P, avatarMedia, avatarUrl, blobUrl, cropPct, fullName, isAudio, isImg, makeThumb, murl, shortName, storeBlob } from './domain.js?v=39';
import { confirmBox, modal } from './modal.js?v=39';
import { E, audioDuration, bindComments, bindVoices, recordModal, saveVoice, shrinkImage, voiceRows } from './panel.js?v=39';
import { renderAll, select } from './router.js?v=39';
import { ALL, S, ui } from './state.js?v=39';
import { Hist, Store } from './store.js?v=39';
import { $, clone, esc, genitive, toast } from './util.js?v=39';

/* ============ Photos straight onto a person ============
   Click the empty photo on a card (on a phone: take a picture or pick one), drop image
   files on a card or the person panel, or paste an image while a person is selected. */
function pickImageFor(pid){
  // created and clicked inside the click handler itself, so phones allow it and offer the camera
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=()=>{ if(inp.files&&inp.files.length) photoTo(pid,inp.files); };
  inp.click();
}
async function photoTo(pid,files){
  const imgs=[...files].filter(f=>/^image\//.test(f.type)); const p=P(pid);
  if(!p||!Store.canEdit) return;
  if(!imgs.length){toast('Det där var ingen bild. Släpp en bildfil (jpg, png, heic…).'); return;}
  select('person',pid); const had=!!avatarUrl(p);
  await uploadMedia(imgs,{profile:!had});
  if(had) toast(`Bilden lades till bland ${genitive(shortName(p))} bilder.`,4000); // a new profile photo shows itself (and its framing toast)
}
async function uploadMedia(files,{profile}={}){
  Hist.label(files.length>1?`Uppladdning av ${files.length} filer`:'Uppladdning av '+(files[0]&&files[0].name||'bild'),6000);
  files=[...files]; if(!files.length) return;
  const prog=$('#uplprog'); if(prog) prog.innerHTML=`<div class="small muted">Laddar upp ${files.length} fil(er)…</div><div class="progress"><i></i></div>`;
  const added=[]; let i=0;
  for(const file of files){
    try{
      if(E.assets){const r=await E.assets.upload(file); added.push({assetId:r.id,url:r.url,name:file.name,contentType:r.contentType||file.type,caption:''});}
      else{ if(!/^image\//.test(file.type)) throw new Error('bara bilder kan sparas här'); const url=await shrinkImage(file,1100,.82); const id=await storeBlob(url); const tid=await storeBlob(await makeThumb(url)); added.push({url:'kl:'+id,thumb:'kl:'+tid,name:file.name,contentType:'image/jpeg',caption:''}); }
    }catch(e){toast('Kunde inte ladda upp '+file.name+(e&&e.message?': '+e.message:''));}
    i++; const bar=prog&&prog.querySelector('i'); if(bar) bar.style.width=(100*i/files.length)+'%';
  }
  if(!added.length){if(prog) prog.innerHTML=''; return;}
  const cur=clone(currentSelObj()); cur.media=cur.media||[];
  const hasProfile=cur.media.some(m=>m.profile);
  if(profile||(!hasProfile&&!cur.media.some(isImg))){ const first=added.find(isImg); if(first){cur.media.forEach(m=>delete m.profile); first.profile=true;} }
  cur.media=cur.media.concat(added); await Store.put(cur);
  if(cur.kind==='person'&&added.some(m=>m.profile)) autoFrame(cur.id);
}
/* ---- Face framing ---- */
function loadImg(url){return new Promise((ok,bad)=>{const i=new Image(); if(!/^data:|^blob:/.test(url)) i.crossOrigin='anonymous'; i.onload=()=>ok(i); i.onerror=()=>bad(new Error('bilden kunde inte läsas')); i.src=url;});}
let _faceDet=null;
/** Find the largest face. Uses the browser's FaceDetector if present, else MediaPipe (loaded on demand). */
async function detectFace(img){
  if('FaceDetector' in window){try{const fs=await new window.FaceDetector({fastMode:false,maxDetectedFaces:5}).detect(img); if(fs.length){const b=fs.sort((a,c)=>c.boundingBox.width-a.boundingBox.width)[0].boundingBox; return {x:b.x,y:b.y,w:b.width,h:b.height};}}catch(e){}}
  if(!_faceDet) _faceDet=(async()=>{const V='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    const mp=await import(V+'/vision_bundle.mjs'); const fr=await mp.FilesetResolver.forVisionTasks(V+'/wasm');
    return mp.FaceDetector.createFromOptions(fr,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'},runningMode:'IMAGE',minDetectionConfidence:.4});})();
  const det=await _faceDet; const r=det.detect(img).detections;
  if(!r.length) return null; const b=r.sort((a,c)=>c.boundingBox.width-a.boundingBox.width)[0].boundingBox;
  return {x:b.originX,y:b.originY,w:b.width,h:b.height};
}
/** Framing that puts a face slightly above centre of a 3:4 portrait, face ≈ 45% of the height. */
function frameForFace(f,nw,nh){const s0=Math.max((3/4)/nw,1/nh), visH=f.h/.45, z=Math.min(6,Math.max(1,1/(s0*visH)));
  return {x:(f.x+f.w/2)/nw,y:Math.min(1,(f.y+f.h/2+.08*Math.min(visH,nh))/nh),z,nw,nh};}
async function findFrame(url){const img=await loadImg(url); const nw=img.naturalWidth,nh=img.naturalHeight; let f=null; try{f=await detectFace(img);}catch(e){console.warn('Ansiktsigenkänning ej tillgänglig',e);}
  return {frame:f?frameForFace(f,nw,nh):null,nw,nh};}
async function autoFrame(pid){
  const p=P(pid), m=p&&avatarMedia(p); if(!m) return;
  try{const {frame,nw,nh}=await findFrame(await blobUrl(m)); const q=clone(P(pid)), mm=avatarMedia(q); if(!mm) return;
    mm.focus=frame||{x:.5,y:.35,z:1,nw,nh}; await Store.put(q);
    toast(frame?'Bilden är centrerad på ansiktet.':'Hittade inget ansikte. Du kan flytta bilden själv.',5000,{label:'Justera',fn:()=>photoModal(pid)});
  }catch(e){toast('Bilden är sparad. Vill du flytta den?',5000,{label:'Justera',fn:()=>photoModal(pid)});}
}
function photoModal(pid){
  const p=P(pid), m=p&&avatarMedia(p); if(!m) return;
  const W=240,H=320; let f=Object.assign({x:.5,y:.35,z:1},m.focus||{});
  modal(`<h3>Justera bilden</h3>
    <p class="muted" style="margin-top:-4px">Dra i bilden så att ansiktet hamnar i rutan. Zooma med reglaget eller mushjulet.</p>
    <div class="cropwrap"><div class="cropbox" id="cropBox" style="width:${W}px;height:${H}px"><img id="cropImg" src="${esc(murl(m))}" alt="" draggable="false"></div>
      <div class="cropside"><div class="avatar" id="cropCircle" style="width:96px;height:96px;position:relative"><img src="${esc(murl(m))}" alt=""></div><span class="muted small">Så blir den runda bilden</span>
      <label class="f" style="width:100%"><span>Zoom</span><input type="range" id="cropZ" min="1" max="6" step="0.01" value="${f.z}"></label>
      <button class="btn" id="cropAuto">✨ Hitta ansiktet automatiskt</button><span class="muted small" id="cropMsg"></span></div></div>
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Spara</button></div>`,
  async(ov,close)=>{
    const q=x=>ov.querySelector(x), img=q('#cropImg'), circ=q('#cropCircle img');
    try{const i=await loadImg(murl(m)); f.nw=f.nw||i.naturalWidth; f.nh=f.nh||i.naturalHeight;}catch(e){f.nw=f.nw||W; f.nh=f.nh||H;}
    const place=(el,A)=>{const c=cropPct({focus:f},A); Object.assign(el.style,{position:'absolute',maxWidth:'none',width:c.w+'%',height:c.h+'%',left:c.l+'%',top:c.t+'%'});};
    const draw=()=>{place(img,W/H); place(circ,1); q('#cropZ').value=f.z;};
    const clampF=()=>{f.x=Math.min(1,Math.max(0,f.x)); f.y=Math.min(1,Math.max(0,f.y)); f.z=Math.min(6,Math.max(1,f.z));};
    draw();
    const box=q('#cropBox'); let drag=null;
    box.onpointerdown=e=>{drag={sx:e.clientX,sy:e.clientY,x:f.x,y:f.y}; box.setPointerCapture(e.pointerId);};
    box.onpointermove=e=>{if(!drag) return; const c=cropPct({focus:f},W/H), wpx=c.w/100*W, hpx=c.h/100*H;
      f.x=drag.x-(e.clientX-drag.sx)/wpx; f.y=drag.y-(e.clientY-drag.sy)/hpx; clampF(); draw();};
    box.onpointerup=()=>{drag=null;};
    box.onwheel=e=>{e.preventDefault(); f.z*=e.deltaY<0?1.08:1/1.08; clampF(); draw();};
    q('#cropZ').oninput=e=>{f.z=+e.target.value; draw();};
    q('#cropAuto').onclick=async()=>{const msg=q('#cropMsg'); msg.textContent='Letar efter ansikte…';
      try{const r=await findFrame(murl(m)); if(r.frame){f=r.frame; draw(); msg.textContent='Klart!';} else msg.textContent='Hittade inget ansikte – flytta bilden själv.';}
      catch(e){msg.textContent='Det gick inte att söka efter ansikten här.';}};
    q('[data-x]').onclick=close;
    q('[data-ok]').onclick=async()=>{const pq=clone(P(pid)), mm=avatarMedia(pq); if(mm){mm.focus={x:+f.x.toFixed(4),y:+f.y.toFixed(4),z:+f.z.toFixed(3),nw:f.nw,nh:f.nh}; await Store.put(pq);} close(); ui.treeKey=null; renderAll(true);};
  });
}
function bindMedia(){
  const pn=$('#panel'); const o=currentSelObj(); if(!o) return;
  const up=pn.querySelector('#upl'); if(up) up.onchange=()=>uploadMedia(up.files);
  const av=pn.querySelector('#uplAv'); if(av) av.onchange=()=>uploadMedia(av.files,{profile:true});
  pn.querySelectorAll('[data-media]').forEach(el=>el.onclick=()=>openLightbox(o,+el.dataset.media));
  bindVoices(pn,o);
  if(ui.sel&&ui.sel.type==='person') bindComments(pn,o);
  {const ua=pn.querySelector('#uplAudio'); if(ua) ua.onchange=async()=>{const f=ua.files[0]; if(!f) return; try{const d=await audioDuration(f); await saveVoice(o,f,{duration:d,caption:f.name.replace(/\.[^.]+$/,'')}); toast('Ljudfilen är sparad som röstminne.');}catch(e){toast('Kunde inte spara: '+(e.message||e),6000);}};}
}
function currentSelObj(){if(!ui.sel) return null; return ui.sel.type==='person'?P(ui.sel.id):ui.sel.type==='place'?S.places[ui.sel.id]:S.sources[ui.sel.id];}
function openLightbox(o,i){
  const m=o.media[i]; const isImg=/^image\//.test(m.contentType||'');
  const lb=document.createElement('div'); lb.className='lightbox';
  lb.innerHTML=`${isImg?`<img src="${esc(murl(m))}" alt="">`:`<div style="font-size:48px">📄</div><p>${esc(m.name)}</p><a class="btn" href="${esc(murl(m))}" target="_blank" rel="noopener" style="color:var(--ink)">Öppna dokumentet</a>`}
    ${isImg&&(o.media||[]).some(x=>isAudio(x)&&x.forImg===m.url)?`<div class="lb-voices vms">${voiceRows(o,{forImg:m.url})}</div>`:''}
    <div class="cap">${E.canEdit?`<input class="t" id="lbCap" style="width:320px;max-width:60vw" placeholder="Bildtext, t.ex. 'Konfirmation 1902'" value="${esc(m.caption||'')}"><button class="btn" id="lbSave">Spara text</button>${isImg&&ui.sel&&ui.sel.type==='person'&&!m.profile?'<button class="btn" id="lbProf">Använd som profilbild</button>':''}${isImg&&ui.sel&&ui.sel.type==='person'?'<button class="btn" id="lbRec">🎙 Berätta om bilden</button>':''}<button class="btn danger" id="lbDel">Ta bort</button>`:`<span>${esc(m.caption||'')}</span>`}<button class="btn" id="lbClose">Stäng</button></div>`;
  document.body.appendChild(lb);
  const close=()=>lb.remove();
  lb.onclick=e=>{if(e.target===lb) close();};
  $('#lbClose').onclick=close;
  bindVoices(lb,o);
  if(E.canEdit){
    const rb=$('#lbRec'); if(rb) rb.onclick=()=>{close(); recordModal(currentSelObj(),{forImg:m.url});};
    $('#lbSave').onclick=()=>{const c=clone(currentSelObj()); c.media[i].caption=$('#lbCap').value; Store.put(c); close();};
    const pb=$('#lbProf'); if(pb) pb.onclick=()=>{const c=clone(currentSelObj()); c.media.forEach((x,j)=>{if(j===i) x.profile=true; else delete x.profile;}); Store.put(c); close(); toast('Profilbilden är bytt');};
    $('#lbDel').onclick=()=>{close(); confirmBox('Ta bort filen?','Filen tas bort från arkivet för gott.','Ta bort',async()=>{const c=clone(currentSelObj()); const [rm]=c.media.splice(i,1); await Store.put(c); if(rm&&rm.assetId&&E.assets){try{await E.assets.delete(rm.assetId);}catch(e){}}});};
  }
}
async function deletePerson(id){
  {const d=P(id); if(d) Hist.label('Borttagning av '+fullName(d),1500);}
  for(const c of Object.values(ALL.comments)) if(c.personId===id) Store.del('comment',c.id,{silent:true});
  const others=Object.values(ALL.persons).filter(x=>x.id!==id&&(x.fatherId===id||x.motherId===id||(x.spouseIds||[]).includes(id)||(x.events||[]).some(e=>e.withId===id)));
  for(const o of others){const q=clone(o); if(q.fatherId===id) q.fatherId=''; if(q.motherId===id) q.motherId=''; q.spouseIds=(q.spouseIds||[]).filter(x=>x!==id); (q.events||[]).forEach(e=>{if(e.withId===id) e.withId='';}); Store.put(q,{silent:true});}
  if(ui.focus===id) ui.focus=null;
  ui.sel=null; Store.del('person',id);
}

export { pickImageFor, photoTo, uploadMedia, loadImg, _faceDet, detectFace, frameForFace, findFrame, autoFrame, photoModal, bindMedia, currentSelObj, openLightbox, deletePerson };
