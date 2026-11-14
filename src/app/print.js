/* Släktsagan · print.js — Printing and PDF/PNG export. */
import { storyOf } from './card.js?v=43';
import { P, avatarMedia, avatarUrl, blobUrl, children, fullName, isAudio, lifeEvents, lifespan, partners, personLabel, placeName, siblings } from './domain.js?v=43';
import { fmtDur } from './panel.js?v=43';
import { ui } from './state.js?v=43';
import { saveFile } from './importexport.js?v=43';
import { modal } from './modal.js?v=43';
import { S } from './state.js?v=43';
import { applyTheme, cssv, themeName } from './theme.js?v=43';
import { esc, fmtDate, toast, yearOf } from './util.js?v=43';

/* ============ PRINT / PDF ============ */
function loadJsPDF(){return new Promise((res,rej)=>{if(window.jspdf) return res(); const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload=res; s.onerror=()=>rej(new Error('Kunde inte ladda PDF-verktyget')); document.head.appendChild(s);});}
async function toDataURL(url){if(!url||url.startsWith('data:')) return url; try{const r=await fetch(url); const b=await r.blob(); return await new Promise(res=>{const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(b);});}catch(e){return null;}}
const PROPS=['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','opacity','font-size','font-weight','font-style','text-anchor','dominant-baseline','paint-order','visibility','display'];
async function svgSnapshot(svgEl,title){
  const prev=themeName(); applyTheme('light');
  const vp=svgEl.querySelector('g.vp'); const bb=vp.getBBox(); const M=30, TH=46;
  const clone=svgEl.cloneNode(true);
  const o=[svgEl,...svgEl.querySelectorAll('*')], c=[clone,...clone.querySelectorAll('*')];
  o.forEach((el,i)=>{const cs=getComputedStyle(el); let st=''; for(const p of PROPS){const v=cs.getPropertyValue(p); if(v) st+=`${p}:${v};`;} st+='font-family:Helvetica,Arial,sans-serif;'; c[i].setAttribute('style',st); c[i].removeAttribute('class');});
  o.forEach((el,i)=>{if(el.classList&&(el.classList.contains('ghost')||el.classList.contains('eye'))) c[i].setAttribute('data-drop','1');});
  clone.querySelectorAll('[data-drop]').forEach(el=>el.remove());
  const paper=cssv('--paper'), ink=cssv('--ink'), ink3=cssv('--ink3');
  applyTheme(prev);
  c[o.indexOf(vp)].removeAttribute('transform');
  const w=bb.width+2*M, h=bb.height+2*M+TH;
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg'); clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
  clone.setAttribute('viewBox',`${bb.x-M} ${bb.y-M-TH} ${w} ${h}`); clone.setAttribute('width',w); clone.setAttribute('height',h); clone.style.cursor='';
  const NS='http://www.w3.org/2000/svg';
  const bg=document.createElementNS(NS,'rect'); bg.setAttribute('x',bb.x-M); bg.setAttribute('y',bb.y-M-TH); bg.setAttribute('width',w); bg.setAttribute('height',h); bg.setAttribute('fill',paper); clone.insertBefore(bg,clone.firstChild);
  const t=document.createElementNS(NS,'text'); t.setAttribute('x',bb.x); t.setAttribute('y',bb.y-M-TH+30); t.setAttribute('style',`font-family:Georgia,serif;font-size:22px;font-weight:600;fill:${ink}`); t.textContent=title; clone.appendChild(t);
  const t2=document.createElementNS(NS,'text'); t2.setAttribute('x',bb.x+bb.width); t2.setAttribute('y',bb.y-M-TH+30); t2.setAttribute('style',`font-family:Helvetica,Arial,sans-serif;font-size:11px;fill:${ink3};text-anchor:end`); t2.textContent='Släktsagan · '+fmtDate(new Date().toISOString().slice(0,10)); clone.appendChild(t2);
  for(const im of clone.querySelectorAll('image')){const href=im.getAttribute('href'); const d=await toDataURL(href); if(d) im.setAttribute('href',d); else im.remove();}
  const xml=new XMLSerializer().serializeToString(clone);
  const url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml;charset=utf-8'}));
  const img=await new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('Kunde inte rita bilden')); i.src=url;});
  const scale=Math.max(1,Math.min(3,7000/Math.max(w,h)));
  const cv=document.createElement('canvas'); cv.width=Math.round(w*scale); cv.height=Math.round(h*scale);
  const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,cv.width,cv.height); URL.revokeObjectURL(url);
  return {canvas:cv,w,h};
}
function printChart(svgEl,title,slug,{book}={}){
  modal(`<h3>Skriv ut eller spara</h3><p class="muted" style="line-height:1.5">Hela diagrammet sparas – inte bara det som syns på skärmen – i ljust tema och med titel. Öppna PDF:en och skriv ut, eller beställ en affisch från bilden.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button class="btn primary" data-k="pdf">PDF för utskrift (A3)</button><button class="btn" data-k="pdf4">PDF (A4)</button><button class="btn" data-k="png">Bild (PNG)</button></div>${book?`<div class="book-cta"><b>📖 Släktbok</b><span>Gör grenen du ser till en bok: omslag, trädet, ett kapitel per generation med berättelser, bilder och källor, och ett namnregister.</span><button class="btn primary" data-book>Skapa släktbok…</button></div>`:''}
    <div id="prProg" class="small muted" style="margin-top:10px"></div><div class="foot"><button class="btn" data-x>Stäng</button></div>`,(ov,close)=>{
    ov.querySelector('[data-x]').onclick=close;
    {const bk=ov.querySelector('[data-book]'); if(bk) bk.onclick=()=>{close(); familyBookModal();};}
    ov.querySelectorAll('[data-k]').forEach(b=>b.onclick=async()=>{
      const k=b.dataset.k; ov.querySelector('#prProg').textContent='Skapar fil…';
      try{
        const {canvas,w,h}=await svgSnapshot(svgEl,title);
        const stamp=new Date().toISOString().slice(0,10);
        if(k==='png'){const blob=await new Promise(r=>canvas.toBlob(r,'image/png')); close(); await saveFile(`${slug}-${stamp}.png`,blob); return;}
        await loadJsPDF(); const {jsPDF}=window.jspdf; const land=w>=h; const fmt=k==='pdf'?'a3':'a4';
        const doc=new jsPDF({orientation:land?'landscape':'portrait',unit:'mm',format:fmt});
        const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight(), m=10;
        const sc=Math.min((pw-2*m)/w,(ph-2*m)/h); const iw=w*sc, ih=h*sc;
        doc.addImage(canvas.toDataURL('image/jpeg',0.92),'JPEG',(pw-iw)/2,(ph-ih)/2,iw,ih);
        close(); await saveFile(`${slug}-${stamp}.pdf`,doc.output('blob'));
      }catch(e){ov.querySelector('#prProg').textContent='Det gick inte: '+(e.message||e);}
    });
  });
}
// eslint-disable-next-line no-control-regex
const pdfT=s=>String(s??'').replace(/Ł/g,'L').replace(/ł/g,'l').replace(/[^\u0000-ÿ–—‘’“”…†•]/g,c=>c.normalize('NFD').replace(/[̀-ͯ]/g,'')).replace(/[^\u0000-ÿ–—‘’“”…†•]/g,'?');
/** A file-name-safe slug: 'Släkten Åström' → 'slakten-astrom' (browsers fall back to 'download' on some characters). */
const fileSlug=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'slaktsagan';
async function personPdf(p){
  try{
    toast('Skapar PDF…'); await loadJsPDF(); const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4'}); const W=210, M=18; let y=M;
    const need=h=>{if(y+h>297-M){doc.addPage(); y=M;}};
    const para=(txt,size=10.5,style='normal',color=[42,37,32],lh=1.45)=>{doc.setFont('helvetica',style); doc.setFontSize(size); doc.setTextColor(...color); for(const line of doc.splitTextToSize(pdfT(txt),W-2*M)){need(size*0.36*lh); doc.text(line,M,y+size*0.3); y+=size*0.36*lh;}};
    const head=t=>{y+=4; need(12); doc.setDrawColor(200,190,170); doc.line(M,y,W-M,y); y+=6; para(t.toUpperCase(),9,'bold',[120,110,95]); y+=1;};
    const av=avatarUrl(p); let photo=null; if(av) photo=await toDataURL(av);
    let tx=M; if(photo){try{doc.addImage(photo,photo.includes('image/png')?'PNG':'JPEG',M,y,32,40,undefined,'FAST'); tx=M+38;}catch(e){photo=null;}}
    doc.setFont('times','bold'); doc.setFontSize(24); doc.setTextColor(42,37,32); doc.text(pdfT(fullName(p)),tx,y+9);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(93,85,75);
    const life=[p.birthDate?'* '+fmtDate(p.birthDate)+(p.birthPlace?', '+placeName(p.birthPlace):''):'',p.deathDate?'† '+fmtDate(p.deathDate)+(p.deathPlace?', '+placeName(p.deathPlace):''):''].filter(Boolean);
    life.forEach((l,i)=>doc.text(pdfT(l),tx,y+17+i*6)); if(p.occupation) doc.text(pdfT(p.occupation),tx,y+17+life.length*6);
    y+=photo?44:26;
    const st=storyOf(p); if(st){head('Livsberättelse'); para(st,11,'normal',[42,37,32],1.55);}
    const f=P(p.fatherId),m=P(p.motherId),parts=partners(p),kids=children(p.id),sibs=siblings(p);
    head('Familj');
    if(f||m) para('Föräldrar: '+[f,m].filter(Boolean).map(personLabel).join(', '));
    for(const sp of parts){const ck=kids.filter(c=>c.fatherId===sp.id||c.motherId===sp.id); para('Partner: '+personLabel(sp)+(ck.length?' — barn: '+ck.map(personLabel).join(', '):''));}
    const solo=kids.filter(c=>!parts.some(sp=>c.fatherId===sp.id||c.motherId===sp.id)); if(solo.length) para('Barn: '+solo.map(personLabel).join(', '));
    if(sibs.length) para('Syskon: '+sibs.map(personLabel).join(', '));
    const evs=lifeEvents(p); if(evs.length){head('Händelser'); for(const e of evs) para(`${fmtDate(e.date)||'–'}  ${e.type}${e.placeId?', '+placeName(e.placeId):''}${e.withId&&P(e.withId)?', med '+fullName(P(e.withId)):''}${e.desc?' — '+e.desc:''}`);}
    const cs=(p.citations||[]).filter(c=>S.sources[c.sourceId]); if(cs.length){head('Källor'); for(const c of cs){const s=S.sources[c.sourceId]; para(`• ${s.title}${[c.about&&!c.about.startsWith('event:')?c.about:'',c.detail,s.archive,s.ref].filter(Boolean).length?' ('+[c.about&&!c.about.startsWith('event:')?c.about:'',c.detail,s.archive,s.ref].filter(Boolean).join(', ')+')':''}`,9.5);}}
    if(p.notes){head('Anteckningar'); para(p.notes,10);}
    const n=doc.getNumberOfPages(); for(let i=1;i<=n;i++){doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140,130,115); doc.text(pdfT(`Släktsagan · ${fullName(p)} · sida ${i} av ${n}`),M,297-8);}
    await saveFile(`slaktsagan-${fileSlug(fullName(p))}.pdf`,doc.output('blob'));
  }catch(e){toast('Kunde inte skapa PDF: '+(e.message||e));}
}


/* ============ Family book (PDF) ============
   The branch you see in the tree becomes a book: a cover, the tree as a picture, one chapter per
   generation (oldest first) with every person's story, photo, family, events and sources, numbered
   so parents and children point to each other, and an index of names. */
function bookPeople(){
  const F=P(ui.focus), ids=[...(ui.treeShown||[])].filter(id=>P(id)); if(!F||!ids.length) return null;
  // generation relative to the focus person: parents −1, children +1 (partners take their partner's)
  const gen=new Map([[F.id,0]]), q=[F.id];
  while(q.length){const id=q.shift(), g=gen.get(id), p=P(id);
    const step=(x,d)=>{ if(x&&ids.includes(x)&&!gen.has(x)){gen.set(x,g+d); q.push(x);} };
    step(p.fatherId,-1); step(p.motherId,-1); for(const c of children(id)) step(c.id,1); for(const sp of partners(p)) step(sp.id,0);
    for(const o of ids) if(!gen.has(o)){const op=P(o); if(op.fatherId===id||op.motherId===id) step(o,1);} }
  const by=(a,b)=>(gen.get(a.id)-gen.get(b.id))||((yearOf(a.birthDate)||9999)-(yearOf(b.birthDate)||9999))||fullName(a).localeCompare(fullName(b),'sv');
  return ids.filter(id=>gen.has(id)).map(P).sort(by).map((p,i)=>({p,no:i+1,gen:gen.get(p.id)}));
}
function familyBookModal(){
  const list=bookPeople(); if(!list){toast('Öppna trädet för den gren du vill göra en bok av.'); return;}
  const F=P(ui.focus), sur=F.surname||'', photos=list.filter(x=>avatarUrl(x.p)).length;
  modal(`<h3>📖 Släktbok</h3><p class="muted" style="margin-top:-4px;line-height:1.5">Boken innehåller de <b>${list.length} personer</b> som syns i trädet runt ${esc(fullName(F))}. Vill du ha med fler eller färre, ändra anor, ättlingar och sidogrenar i trädet först.</p>
    <label class="f"><span>Titel</span><input class="t" id="bkT" value="${esc(sur?'Släkten '+sur:'Vår släkt')}"></label>
    <label class="f"><span>Undertitel</span><input class="t" id="bkS" value="${esc('Berättelsen om '+fullName(F)+'s släkt')}"></label>
    <div class="f bk-opts"><label><input type="checkbox" id="bkP" checked> Bilder <span class="muted">(${photos} ${photos===1?'person har':'personer har'} foto)</span></label><label><input type="checkbox" id="bkE" checked> Händelser</label><label><input type="checkbox" id="bkC" checked> Källor</label><label><input type="checkbox" id="bkN" checked> Anteckningar</label></div>
    <div id="bkProg" class="small muted"></div>
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Skapa PDF</button></div>`,
  (ov,close)=>{ const q=x=>ov.querySelector(x); q('[data-x]').onclick=close;
    q('[data-ok]').onclick=async()=>{ const b=q('[data-ok]'); b.disabled=true;
      try{ await familyBookPdf(list,{title:q('#bkT').value.trim()||'Släktbok',subtitle:q('#bkS').value.trim(),photos:q('#bkP').checked,events:q('#bkE').checked,sources:q('#bkC').checked,notes:q('#bkN').checked},t=>{q('#bkProg').textContent=t;}); close(); }
      catch(e){ b.disabled=false; q('#bkProg').textContent='Det gick inte: '+(e.message||e); } };
  });
}
async function familyBookPdf(list,o,progress=()=>{}){
  progress('Laddar…'); await loadJsPDF(); const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'}); const W=210, H=297, M=20, INK=[42,37,32], MUTED=[110,100,88], LINE=[205,195,175], ACC=[47,93,80];
  let y=M; const no=new Map(list.map(x=>[x.p.id,x.no])); const ref=p=>no.has(p.id)?` (${no.get(p.id)})`:'';
  const need=h=>{ if(y+h>H-M){doc.addPage('a4','portrait'); y=M;} };
  const txt=(t,{size=10.5,style='normal',font='helvetica',color=INK,x=M,w=W-2*M,lh=1.42}={})=>{ doc.setFont(font,style); doc.setFontSize(size); doc.setTextColor(...color);
    for(const line of doc.splitTextToSize(pdfT(t),w)){ need(size*0.353*lh); doc.text(line,x,y+size*0.3); y+=size*0.353*lh; } };
  const small=(label,t)=>{ if(t) txt(label+t,{size:9.5,color:[70,63,55]}); };
  // the full photo (a printed book needs the resolution), with its proportions so it can be fitted, not stretched
  const imgOf=async p=>{ const m=avatarMedia(p); let u=m?await blobUrl(m):avatarUrl(p); if(!u) return null; const d=await toDataURL(u); if(!d||!/^data:image\/(jpeg|png)/.test(d)) return null;
    const im=await new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=d;}); return im?{d,r:im.naturalWidth/im.naturalHeight}:null; };
  const putImg=(img,x,y,bw,bh)=>{ let w=bw, h=bw/img.r; if(h>bh){h=bh; w=bh*img.r;} try{ doc.addImage(img.d,img.d.includes('image/png')?'PNG':'JPEG',x+(bw-w)/2,y,w,h,undefined,'FAST'); return {w,h}; }catch(e){ return null; } };

  /* cover */
  doc.setFillColor(246,240,228); doc.rect(0,0,W,H,'F');
  doc.setDrawColor(...ACC); doc.setLineWidth(0.6); doc.rect(12,12,W-24,H-24); doc.setLineWidth(0.2); doc.rect(14,14,W-28,H-28);
  const F=P(ui.focus); const cover=o.photos&&F?await imgOf(F):null;
  if(cover) putImg(cover,W/2-40,62,80,90);
  doc.setFont('times','bold'); doc.setFontSize(34); doc.setTextColor(...INK); doc.text(pdfT(o.title),W/2,cover?170:120,{align:'center'});
  if(o.subtitle){ doc.setFont('times','italic'); doc.setFontSize(15); doc.setTextColor(...MUTED); doc.text(doc.splitTextToSize(pdfT(o.subtitle),140),W/2,cover?182:134,{align:'center'}); }
  const span=list.map(x=>yearOf(x.p.birthDate)).filter(Boolean); 
  doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(...MUTED);
  doc.text(pdfT(`${list.length} personer${span.length?` · ${Math.min(...span)}–${Math.max(...span)}`:''}`),W/2,cover?200:152,{align:'center'});
  doc.setFontSize(9); doc.text(pdfT(`Sammanställd ${fmtDate(new Date().toISOString().slice(0,10))} med Släktsagan`),W/2,H-24,{align:'center'});

  /* the tree as a picture (landscape page) */
  const landPages=new Set(), tocAt=2; doc.addPage('a4','portrait'); // the table of contents is drawn here at the end, when page numbers are known
  const svg=document.querySelector('#treeSvg');
  if(svg){ progress('Ritar trädet…'); try{ const {canvas,w,h}=await svgSnapshot(svg,o.title);
      doc.addPage('a4','landscape'); landPages.add(doc.getNumberOfPages()); const pw=297, ph=210, m=12, sc=Math.min((pw-2*m)/w,(ph-2*m)/h);
      doc.addImage(canvas.toDataURL('image/jpeg',0.9),'JPEG',(pw-w*sc)/2,(ph-h*sc)/2,w*sc,h*sc); }catch(e){} }

  /* chapters */
  const gens=[...new Set(list.map(x=>x.gen))].sort((a,b)=>a-b), toc=[];
  let i=0;
  for(const g of gens){
    doc.addPage('a4','portrait'); y=M; const people=list.filter(x=>x.gen===g);
    const ys=people.map(x=>yearOf(x.p.birthDate)).filter(Boolean);
    const title=`Generation ${gens.indexOf(g)+1}`, sub=ys.length?`födda ${Math.min(...ys)}${Math.max(...ys)!==Math.min(...ys)?'–'+Math.max(...ys):''}`:'';
    toc.push([title+(sub?' · '+sub:''),doc.getNumberOfPages(),people.length]);
    doc.setFont('times','bold'); doc.setFontSize(24); doc.setTextColor(...ACC); doc.text(pdfT(title),M,y+8); y+=12;
    if(sub) txt(sub,{size:11,color:MUTED,font:'times',style:'italic'}); y+=4;
    for(const {p,no:n} of people){
      progress(`Skriver ${++i} av ${list.length}…`);
      need(34); doc.setDrawColor(...LINE); doc.line(M,y,W-M,y); y+=5;
      const photo=o.photos?await imgOf(p):null, top=y; let x=M, w=W-2*M;
      let ph=0; if(photo){ const r=putImg(photo,M,y,24,30); if(r){ x=M+29; w=W-2*M-29; ph=r.h; } }
      txt(`${n}.  ${fullName(p)}`,{size:14,style:'bold',font:'times',x,w,lh:1.25});
      const ls=lifespan(p); if(ls||p.occupation) txt([ls,p.occupation].filter(Boolean).join(' · '),{size:9.5,color:MUTED,x,w});
      const st=storyOf(p); if(st) { y+=1; txt(st,{size:10.5,x,w,lh:1.5}); }
      if(ph&&y<top+ph+2) y=top+ph+2;
      const f=P(p.fatherId), m=P(p.motherId), kids=children(p.id);
      const fam=[]; if(f||m) fam.push('Föräldrar: '+[f,m].filter(Boolean).map(x=>fullName(x)+ref(x)).join(' och '));
      for(const sp of partners(p)) fam.push('Partner: '+fullName(sp)+ref(sp));
      if(kids.length) fam.push('Barn: '+kids.map(c=>fullName(c)+(yearOf(c.birthDate)?' '+yearOf(c.birthDate):'')+ref(c)).join(', '));
      y+=1.5; for(const l of fam) small('',l);
      if(o.events){ const ev=lifeEvents(p).filter(e=>e.date||e.placeId||e.desc); if(ev.length>2){ y+=1; for(const e of ev) small('',`${fmtDate(e.date)||'–'}  ${e.type}${e.placeId?', '+placeName(e.placeId):''}${e.desc?' – '+e.desc:''}`); } }
      const vm=(p.media||[]).filter(isAudio); if(vm.length) small('Röstminnen: ',vm.map(v=>`”${v.caption||'Röstminne'}” (${fmtDur(v.duration)})`).join(', ')+' – finns att lyssna på i Släktsagan.');
      if(o.notes&&p.notes){ y+=1; txt(p.notes,{size:9.5,color:[70,63,55],lh:1.4}); }
      if(o.sources){ const cs=(p.citations||[]).filter(c=>S.sources[c.sourceId]); if(cs.length){ y+=1; txt('Källor: '+cs.map(c=>S.sources[c.sourceId].title+(c.detail?', '+c.detail:'')).join('; '),{size:8.5,color:MUTED,lh:1.35}); } }
      y+=4;
    }
  }

  /* index of names */
  doc.addPage('a4','portrait'); y=M; toc.push(['Namnregister',doc.getNumberOfPages(),0]);
  doc.setFont('times','bold'); doc.setFontSize(24); doc.setTextColor(...ACC); doc.text('Namnregister',M,y+8); y+=16;
  const idx=list.slice().sort((a,b)=>(a.p.surname||'').localeCompare(b.p.surname||'','sv')||(a.p.given||'').localeCompare(b.p.given||'','sv'));
  const colW=(W-2*M-8)/2; let col=0, y0=y;
  for(const {p,no:n} of idx){ if(y>H-M-6){ if(col===0){col=1; y=y0;} else {doc.addPage('a4','portrait'); y=M; y0=y; col=0;} }
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
    const name=pdfT(`${p.surname?p.surname+', ':''}${p.given||''}`), x=M+col*(colW+8);
    doc.text(doc.splitTextToSize(name,colW-14)[0],x,y); doc.setTextColor(...MUTED); doc.text(String(n),x+colW,y,{align:'right'}); y+=5.2; }

  /* table of contents, now that page numbers are known */
  doc.setPage(tocAt); y=M;
  doc.setFont('times','bold'); doc.setFontSize(24); doc.setTextColor(...ACC); doc.text('Innehåll',M,y+8); y+=20;
  for(const [t,pg,n] of toc){ doc.setFont('times','normal'); doc.setFontSize(13); doc.setTextColor(...INK); doc.text(pdfT(t),M,y);
    if(n){ doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(pdfT(`${n} ${n===1?'person':'personer'}`),M,y+5); }
    doc.setFont('times','normal'); doc.setFontSize(13); doc.setTextColor(...INK); doc.text(String(pg),W-M,y,{align:'right'}); y+=n?14:10; }
  y+=6; txt('Siffran framför varje namn är personens nummer i boken. Står ett nummer inom parentes efter ett namn finns personen med på ett eget ställe i boken.',{size:9.5,color:MUTED,lh:1.45});

  const pages=doc.getNumberOfPages(); for(let k=2;k<=pages;k++){ doc.setPage(k); const land=landPages.has(k); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(150,140,125);
    doc.text(pdfT(o.title),M,(land?210:H)-9); doc.text(String(k),(land?297:W)-M,(land?210:H)-9,{align:'right'}); }
  progress('Sparar…');
  await saveFile(`slaktbok-${fileSlug(o.title)}.pdf`,doc.output('blob'));
  toast(`Släktboken är klar – ${pages} sidor.`,5000);
}

export { familyBookModal, familyBookPdf, bookPeople, loadJsPDF, toDataURL, PROPS, svgSnapshot, printChart, pdfT, personPdf };
