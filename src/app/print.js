/* Släktsagan · print.js — Printing and PDF/PNG export. */
import { storyOf } from './card.js?v=38';
import { P, avatarUrl, children, fullName, lifeEvents, partners, personLabel, placeName, siblings } from './domain.js?v=38';
import { saveFile } from './importexport.js?v=38';
import { modal } from './modal.js?v=38';
import { S } from './state.js?v=38';
import { applyTheme, cssv, themeName } from './theme.js?v=38';
import { fmtDate, toast } from './util.js?v=38';

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
function printChart(svgEl,title,slug){
  modal(`<h3>Skriv ut eller spara</h3><p class="muted" style="line-height:1.5">Hela diagrammet sparas – inte bara det som syns på skärmen – i ljust tema och med titel. Öppna PDF:en och skriv ut, eller beställ en affisch från bilden.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button class="btn primary" data-k="pdf">PDF för utskrift (A3)</button><button class="btn" data-k="pdf4">PDF (A4)</button><button class="btn" data-k="png">Bild (PNG)</button></div>
    <div id="prProg" class="small muted" style="margin-top:10px"></div><div class="foot"><button class="btn" data-x>Stäng</button></div>`,(ov,close)=>{
    ov.querySelector('[data-x]').onclick=close;
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
    await saveFile(`slaktsagan-${(fullName(p)).toLowerCase().replace(/[^a-z0-9åäö]+/g,'-')}.pdf`,doc.output('blob'));
  }catch(e){toast('Kunde inte skapa PDF: '+(e.message||e));}
}

export { loadJsPDF, toDataURL, PROPS, svgSnapshot, printChart, pdfT, personPdf };
