/* Släktsagan · start.js — The start page, the presentation page and separate trees. */
import { demoActive } from './demo.js?v=44';
import { P, ancestorsOf, descendantsOf, fullName, homePerson, personLabel, shortName } from './domain.js?v=44';
import { findDups, mergePersons } from './dups.js?v=44';
import { confirmBox, modal } from './modal.js?v=44';
import { ago, commentsFor, nameColor, openQuestions, personByLabel } from './panel.js?v=44';
import { PWA } from './pwa.js?v=44';
import { Share } from './share.js?v=44';
import { renderAll, setFocus } from './router.js?v=44';
import { ALL, APP_VERSION, HIDDEN, S, activeView, ui } from './state.js?v=44';
import { Store } from './store.js?v=44';
import { allPersonsDatalist, bindChips, chipHTML, cssv, openCard, personPicker } from './theme.js?v=44';
import { $, clone, esc, toast, yearOf } from './util.js?v=44';
import { fillNames } from './views.js?v=44';

/* ============ START ============ */
function heroArt(){
  const arc=d3.arc(); const parts=[]; const cols=[cssv('--male'),'#5f8f7f','#b08a4a',cssv('--female')];
  for(let g=1;g<=5;g++){const n=2**g, span=Math.PI/n; for(let j=0;j<n;j++){const q=g===1?(j?3:0):Math.floor(j/(n/4)); const r0=34+(g-1)*30, r1=r0+29;
    parts.push(`<path d="${arc({innerRadius:r0,outerRadius:r1,startAngle:-Math.PI/2+j*span,endAngle:-Math.PI/2+(j+1)*span})}" fill="${cols[q]}" fill-opacity="${(0.9-g*0.13).toFixed(2)}" stroke="${cssv('--card')}" stroke-width="1.5"/>`);}}
  return `<svg viewBox="-200 -200 400 230" width="88%"><g>${parts.join('')}<circle r="30" fill="${cssv('--accent')}"/></g></svg>`;
}
/* ============ Presentation (first visit, and "Om Släktsagan") ============ */
const REPO_URL='https://github.com/godvig/slaktsagan';
function landingMore(){
  const F=[
    ['🌳','Ett träd som rör sig','Klicka på någon så glider släkten på plats runt hen. Anor, ättlingar, kusiner och ingifta – utan att linjerna trasslar.'],
    ['🔗','Hur är vi släkt?','Välj två personer så får du svaret på svenska – ”farmors kusins dotter” – och vägen mellan dem lyser upp i trädet.'],
    ['🎙','Röstminnen','Spela in farmor när hon berättar, direkt i telefonen, och koppla inspelningen till personen eller till ett foto.'],
    ['👥','Hela släkten hjälper till','Skicka en länk. Alla kan fylla i det de vet och publicera – ändringarna slås ihop och de 30 senaste versionerna sparas.'],
    ['📜','Källor från kyrkböckerna','Klistra in en hänvisning från ArkivDigital eller Riksarkivet så blir volym, bild och sida rätt – med länk till bilden.'],
    ['🖼','Bilder på rätt person','Dra en bild till ett kort eller fota med mobilen. Ansiktet hamnar i mitten av sig självt.'],
    ['🗺','Karta och tidslinje','Se var släkten levde och vad som hände i världen samtidigt.'],
    ['↶','Ångra allt','Råkade du ta bort fel person eller läsa in fel fil? Ett klick, så är allt som förut.'],
  ];
  return `<section class="land-sec land-video"><div class="lv-text"><h2>Se den i rörelse</h2><p>Gustav Vasas ättlingar – och hur Sigrid och Władysław IV är släkt. Exemplet Vasaätten finns inbyggt, så du kan prova allt utan att skriva in en enda person.</p><button class="btn primary" onclick="loadDemo()">👑 Öppna exemplet</button></div>
      <video class="lv-video" poster="docs/media/demo-poster.jpg" muted loop playsinline preload="none" aria-label="Kort film: trädet glider mellan personer och släktvägen lyser upp"><source src="docs/media/demo.webm" type="video/webm"><source src="docs/media/demo.mp4" type="video/mp4"></video></section>
    <section class="land-sec"><h2>Det här kan Släktsagan</h2><div class="feat-grid">${F.map(([i,t,d])=>`<div class="feat"><span class="ic">${i}</span><b>${t}</b><p>${d}</p></div>`).join('')}</div></section>
    <section class="land-sec trust"><h2>Din släkt, dina uppgifter</h2><div class="trust-grid">
      <div><b>Sparas hos dig</b><p>Allt ligger i din webbläsare. Inget konto, ingen reklam, ingen spårning – och appen fungerar utan internet.</p></div>
      <div><b>Krypterat när du delar</b><p>Delar du trädet krypteras det på din dator. Servern ser bara oläsbar data – nyckeln finns bara i länken du skickar.</p></div>
      <div><b>Ta med dig allt</b><p>Exportera till GEDCOM, som alla släktprogram läser, eller spara en säkerhetskopia med bilder och röstminnen.</p></div>
    </div></section>
    <footer class="land-foot">Släktsagan byggs av <a href="https://godvig.github.io" target="_blank" rel="noopener">Adam Englund</a> · <a href="${REPO_URL}" target="_blank" rel="noopener">Öppen källkod på GitHub</a> (AGPL-3.0) · <a href="${REPO_URL}/issues" target="_blank" rel="noopener">Tipsa om en idé</a></footer>`;
}
/** Start the film only when it scrolls into view, so the start page stays light. */
function bindLanding(v){
  const vid=v.querySelector('.lv-video'); if(!vid) return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){ vid.controls=true; return; }
  if(!('IntersectionObserver' in window)){ vid.preload='auto'; vid.play().catch(()=>{}); return; }
  new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) vid.play().catch(()=>{vid.controls=true;}); else vid.pause(); }),{threshold:.35}).observe(vid);
}
function renderAbout(){
  const v=$('#view'), has=Object.keys(ALL.persons).length;
  v.innerHTML=`<div class="start about"><div class="hero"><div>
      <h1>Om Släktsagan</h1>
      <p>Släktträd, bilder, röstminnen, källor, tidslinje och karta – och en länk som låter hela släkten hjälpa till. Gratis, utan konto, och allt sparas automatiskt.</p>
      <div class="badges"><span>Inget konto</span><span>Fungerar offline</span><span>Krypterad delning</span><span>Öppen källkod</span></div>
      <div class="hero-links">${has?'<a href="#trad">🌳 Till ditt släktträd</a>':'<a href="#start">Kom igång →</a>'}<a href="${REPO_URL}" target="_blank" rel="noopener">Källkoden på GitHub ↗</a></div>
    </div><div class="hero-art">${heroArt()}</div></div>${landingMore()}<p class="muted small" style="text-align:center;margin-top:-8px">Version ${esc(APP_VERSION)}</p></div>`;
  bindLanding(v);
}
/** "Den här dagen": birthdays (living relatives turning N), death days and wedding days, today and the coming two weeks. */
/** "Nytt sedan sist": what others published since you last said you'd seen it. */
function newsHTML(){
  const n=Share.news(); if(!n) return '';
  const added=Object.keys(n.added).map(P).filter(Boolean), changed=Object.entries(n.changed).map(([id,f])=>[P(id),f]).filter(([p])=>p);
  const comments=n.comments.map(id=>ALL.comments[id]).filter(Boolean);
  if(!added.length&&!changed.length&&!n.removed.length&&!comments.length) return '';
  const MAX=8, more=(k)=>k>MAX?`<span class="muted small news-more">och ${k-MAX} till</span>`:'';
  const d=new Date(n.since), when=isNaN(+d)?'':d.toLocaleDateString('sv-SE',{weekday:'long',day:'numeric',month:'long'});
  return `<section class="news"><div class="news-h"><h2 class="sec-t">Nytt sedan sist${n.by.length?` <span class="muted" style="font-weight:400">· från ${esc(n.by.join(' och '))}</span>`:''}</h2>
    <button class="btn sm" id="newsSeen">Jag har sett allt</button></div>
    ${when?`<p class="small muted news-since">Ändringar som kommit in sedan ${esc(when)}.</p>`:''}
    ${added.length?`<h3 class="news-t">➕ ${added.length===1?'Ny person':added.length+' nya personer'}</h3><div class="recent">${added.slice(0,MAX).map(p=>chipHTML(p)).join('')}${more(added.length)}</div>`:''}
    ${changed.length?`<h3 class="news-t">✏️ ${changed.length===1?'Ändrad':changed.length+' ändrade'}</h3><div class="recent">${changed.slice(0,MAX).map(([p,f])=>chipHTML(p,f.length?esc(f.join(', ')):'')).join('')}${more(changed.length)}</div>`:''}
    ${comments.length?`<h3 class="news-t">💬 ${comments.length===1?'Ny kommentar':comments.length+' nya kommentarer'}</h3><div class="qlist">${comments.slice(-4).reverse().map(c=>{const p=P(c.personId);
      return `<a class="qrow" href="#" data-q="${c.personId}"><span class="cm-av" style="background:${nameColor(c.by)}">${esc((c.by||'?').charAt(0).toUpperCase())}</span><span class="qbody"><b>${esc(p?fullName(p):'')}</b><span>${esc(c.text.length>110?c.text.slice(0,108)+'…':c.text)}</span><small class="muted">${esc(c.by||'Någon')} · ${ago(c.at)}</small></span></a>`;}).join('')}</div>`:''}
    ${n.removed.length?`<p class="small muted news-rm">🗑 Borttagna: ${esc(n.removed.slice(-MAX).join(', '))}${n.removed.length>MAX?` och ${n.removed.length-MAX} till`:''}</p>`:''}
  </section>`;
}
function onThisDayHTML(){
  const items=KinCore.onThisDay(S.persons,new Date(),{days:13}).filter(x=>P(x.personId)).slice(0,6); if(!items.length) return '';
  const wd=['sön','mån','tis','ons','tors','fre','lör'], mo=['jan','feb','mars','april','maj','juni','juli','aug','sep','okt','nov','dec'];
  const when=n=>{ if(n===0) return 'I dag'; if(n===1) return 'I morgon'; const d=new Date(); d.setDate(d.getDate()+n); return `${wd[d.getDay()]} ${d.getDate()} ${mo[d.getMonth()]}`; };
  const nm=id=>`<a href="#" data-otd="${esc(id)}">${esc(fullName(P(id)))}</a>`;
  const on=n=>{ if(n===0) return ' i dag'; if(n===1) return ' i morgon'; const d=new Date(); d.setDate(d.getDate()+n); return n<7?` på ${['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'][d.getDay()]}`:` den ${d.getDate()} ${mo[d.getMonth()]}`; };
  const line=x=>{ const w=x.withId&&P(x.withId), ago=x.inDays===0?'i dag för':'för';
    if(x.kind==='birth') return x.living?`🎂 ${nm(x.personId)} fyller <b>${x.years}</b>${on(x.inDays)}`:`${nm(x.personId)} föddes ${x.year} – ${ago} ${x.years} år sedan`;
    if(x.kind==='death') return `${nm(x.personId)} dog ${x.year} – ${ago} ${x.years} år sedan`;
    return x.living?`💍 ${nm(x.personId)}${w?' och '+nm(w.id):''} har bröllopsdag${on(x.inDays)} – <b>${x.years}</b> år`:`${nm(x.personId)}${w?' och '+nm(w.id):''} gifte sig ${x.year} – ${ago} ${x.years} år sedan`; };
  const head=items.every(x=>x.inDays===0)?'Den här dagen':'I dag och de närmaste dagarna';
  return `<h2 class="sec-t">${head}</h2><div class="otd">${items.map(x=>`<div class="otd-row${x.inDays===0?' today':''}"><span class="otd-when">${when(x.inDays)}</span><span class="otd-what">${line(x)}</span></div>`).join('')}</div>`;
}
function renderStart(){
  const v=$('#view'); const all=Object.values(S.persons);
  const ed=Store.canEdit;
  if(!all.length){
    v.innerHTML=`<div class="start"><div class="hero"><div>
      <h1>Släktens saga, samlad på ett ställe</h1>
      <p>Släktträd, bilder, röstminnen, källor, tidslinje och karta – och en länk som låter hela släkten hjälpa till. Gratis, utan konto, och allt sparas automatiskt. Välj hur du vill börja.</p>
      <div class="badges"><span>Inget konto</span><span>Fungerar offline</span><span>Krypterad delning</span><span>Öppen källkod</span></div>
    </div><div class="hero-art">${heroArt()}</div></div>
    <div class="choices">
      ${ed?`<a class="choice primary" href="#import"><span class="ic">📄</span><b>Jag har redan släktdata</b><span>Läs in en GEDCOM-fil från Disgen, MyHeritage, Ancestry eller Geni – eller en Excel-lista. Du ser allt innan något sparas.</span><span class="go">Läs in fil →</span></a>
      <button class="choice" onclick="openPersonModal()"><span class="ic">✏️</span><b>Börja med mig själv</b><span>Skriv in dig själv och lägg sedan till föräldrar, mor- och farföräldrar.</span><span class="go">Lägg till första personen →</span></button>`:''}
      <button class="choice" onclick="loadDemo()"><span class="ic">👑</span><b>Titta på ett exempel</b><span>Vasaätten, från Gustav Vasa till drottning Kristina. Exemplet sparas inte.</span><span class="go">Visa exemplet →</span></button>
    </div>${landingMore()}</div>`;
    bindLanding(v);
    return;
  }
  const home=homePerson()||P(ui.focus);
  const years=all.map(p=>yearOf(p.birthDate)).filter(Boolean);
  const anc=home?ancestorsOf(home.id).size:0;
  let maxGen=0; if(home){const walk=(id,d)=>{const p=P(id); if(!p) return; maxGen=Math.max(maxGen,d); walk(p.fatherId,d+1); walk(p.motherId,d+1);}; walk(home.id,0);}
  const nNoSrc=all.filter(p=>!(p.citations||[]).length).length;
  const nPl=Object.values(S.places).filter(pl=>pl.lat==null).length;
  const dups=findDups().length;
  const recent=all.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,8);
  const tiles=[
    ['#trad','🌳','Släktträd','Anor och ättlingar runt '+esc(home?shortName(home):'dig')],
    ['#solfjader','◠','Solfjäder',anc?`${anc} kända anor i ${maxGen} generationer`:'Anorna i en halvcirkel'],
    ['#personer','👥','Personer',`${all.length} personer${nNoSrc?` · ${nNoSrc} utan källa`:''}`],
    ['#slaktskap','🔗','Släktskap','Hur är två personer släkt med varandra?'],
    ['#tidslinje','📅','Tidslinje','Livslinjer mot historiska händelser'],
    ['#karta','🗺️','Karta',`${Object.keys(S.places).length} platser${nPl?` · ${nPl} saknar position`:''}`],
    ['#kallor','📜','Källor',`${Object.keys(S.sources).length} registrerade källor`],
    ['#dubbletter','🧩','Dubbletter',dups?`${dups} möjliga dubbletter att granska`:'Inga misstänkta dubbletter'],
    ['#import','⇅','Import & export','Excel, GEDCOM och säkerhetskopior'],
  ];
  v.innerHTML=`<div class="start"><div class="hero"><div>
      <h1>${home?'Släkten kring '+esc(fullName(home)):'Ditt släktarkiv'}</h1>
      <p>${all.length} personer${years.length?`, från ${Math.min(...years)} till ${Math.max(...years)}`:''}. ${home&&anc?`Du har hittat ${anc} anor till ${esc(shortName(home))}, ${maxGen} generationer bakåt.`:''}${home&&!anc&&descendantsOf(home.id).size?`${descendantsOf(home.id).size} ättlingar till ${esc(shortName(home))}.`:''}</p>
      <div class="acts"><button class="btn primary" onclick="goHome()">Öppna släktträdet</button>${home?`<button class="btn" onclick="openCard('${home.id}')">Personkort</button>`:''}${ed?'<button class="btn" onclick="openPersonModal()">+ Ny person</button>':''}<button class="btn" onclick="shareModal(activeView())">🔗 Dela med släkten</button>${demoActive()?'<button class="btn" onclick="exitDemo()">Stäng exemplet</button>':''}</div>
      <div class="hero-links">${demoActive()?'':'<a href="#" onclick="loadDemo();return false">👑 Titta på exemplet Vasaätten</a>'}${ui.simple?'<a href="#" onclick="applySimple(false);renderAll(true);return false">Visa alla funktioner</a>':'<a href="#" onclick="applySimple(true);applySize(true);renderAll(true);return false">Enkelt läge</a>'}<a href="#" onclick="settingsModal();return false">Inställningar</a>${PWA.can()?'<a href="#" onclick="PWA.install();return false">📲 Installera som app</a>':''}</div>
    </div><div class="hero-art">${heroArt()}</div></div>
    ${newsHTML()}
    ${treesSection()}
    ${onThisDayHTML()}
    <div class="tiles">${tiles.map(([h,ic,t,d])=>`<a class="tile" href="${h}"><span class="ic">${ic}</span><b>${t}</b><span>${d}</span></a>`).join('')}</div>
    ${(()=>{const qs=openQuestions().sort((a,b)=>(b.at||'').localeCompare(a.at||'')); if(!qs.length) return '';
      return `<h2 class="sec-t">Öppna frågor <span class="muted" style="font-weight:400">· ${qs.length}</span></h2><div class="qlist">${qs.slice(0,6).map(c=>{const p=P(c.personId); const nr=commentsFor(c.personId).filter(r=>r.replyTo===c.id).length;
        return `<a class="qrow" href="#" data-q="${c.personId}"><span class="cm-av" style="background:${nameColor(c.by)}">${esc((c.by||'?').charAt(0).toUpperCase())}</span><span class="qbody"><b>${esc(fullName(p))}</b><span>${esc(c.text.length>110?c.text.slice(0,108)+'…':c.text)}</span><small class="muted">${esc(c.by||'Någon')} · ${esc(ago(c.at))}${nr?` · ${nr} svar`:''}</small></span></a>`;}).join('')}${qs.length>6?`<div class="muted small" style="padding:6px 2px">… och ${qs.length-6} till</div>`:''}</div>`;})()}
    <h2 class="sec-t">Senast ändrade</h2>
    <div class="recent">${recent.map(p=>chipHTML(p,p.updatedBy&&Store.user?`av <span data-uid="${esc(p.updatedBy)}">…</span>`:'')).join('')}</div>
    ${activeView()?`<p class="small muted" style="margin-top:18px">Du tittar på vyn <b>${esc(activeView().name)}</b> – ${HIDDEN.size} personer är dolda. Byt vy uppe till höger.</p>`:''}</div>`;
  bindChips(v,openCard); fillNames(v); bindTrees(v);
  {const b=v.querySelector('#newsSeen'); if(b) b.onclick=()=>{Share.seen(); renderAll(true);};}
  v.querySelectorAll('[data-otd]').forEach(a=>a.onclick=e=>{e.preventDefault(); openCard(a.dataset.otd);});
  v.querySelectorAll('[data-q]').forEach(a=>a.onclick=e=>{e.preventDefault(); setFocus(a.dataset.q); ui.sel={type:'person',id:a.dataset.q}; location.hash='trad'; setTimeout(()=>{const el=document.querySelector('#panel .comments'); if(el) el.scrollIntoView({block:'start',behavior:'smooth'});},350);});
}

/* ============ SEPARATE TREES ============ */
let _treesKey=null,_trees=null;
/** Groups of people not (yet) connected to each other, biggest first. */
function trees(){
  const ps0=Object.values(S.persons);
  const key=ps0.length+'|'+ps0.reduce((m,p)=>(p.updatedAt||'')>m?p.updatedAt:m,'')+'|'+(Store.demo?'d':'');
  if(key===_treesKey) return _trees;
  const home=homePerson();
  _trees=KinCore.components(S.persons).map((ids,i)=>{
    const ps=ids.map(P);
    const cnt={}; for(const p of ps){const sn=(p.surname||'').trim().split(/\s+/).pop(); if(sn) cnt[sn]=(cnt[sn]||0)+1;}
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
    const hasHome=!!(home&&ids.includes(home.id));
    let root=hasHome?home:null;
    if(!root){ if(ids.length<=400){let best=-1; for(const p of ps){const n=ancestorsOf(p.id).size+descendantsOf(p.id).size; if(n>best){best=n;root=p;}}} else root=ps[0]; }
    const ys=ps.map(p=>yearOf(p.birthDate)).filter(Boolean);
    return {i,ids,set:new Set(ids),size:ids.length,root,home:hasHome,
      name:top.length?'Släkten '+(top[1]&&cnt[top[1]]>=cnt[top[0]]/2?top[0]+' & '+top[1]:top[0]):fullName(root),
      span:ys.length?[Math.min(...ys),Math.max(...ys)]:null};
  });
  _treesKey=key; return _trees;
}
const treeOf=id=>trees().find(t=>t.set.has(id))||null;
function crossTreeDups(){return findDups().filter(d=>treeOf(d.a.id)!==treeOf(d.b.id));}
function treesSection(){
  const ts=trees(); if(ts.length<2) return '';
  const big=ts.filter(t=>t.size>1), lone=ts.filter(t=>t.size===1);
  const sugg=Store.canEdit?crossTreeDups().slice(0,4):[];
  const card=t=>`<div class="treecard${t.home?' mine':''}">
      <div class="tc-h"><b>${esc(t.name)}</b>${t.home?'<span class="tag">Din släkt</span>':''}</div>
      <div class="muted small">${t.size} personer${t.span?` · ${t.span[0]}–${t.span[1]}`:''}</div>
      <div class="small tc-names">${t.ids.slice(0,40).map(P).sort((a,b)=>(yearOf(a.birthDate)||9999)-(yearOf(b.birthDate)||9999)).slice(0,3).map(p=>esc(fullName(p))).join(', ')}${t.size>3?' …':''}</div>
      <div class="tc-acts"><button class="btn sm primary" data-topen="${t.root.id}">Visa trädet</button>${Store.canEdit?`<button class="btn sm" data-tlink="${t.root.id}">🔗 Koppla ihop</button>`:''}</div></div>`;
  return `<h2 class="sec-t">Dina släktträd <span class="muted" style="font-weight:400">· ${ts.length} st som inte hänger ihop än</span></h2>
    <p class="muted small" style="margin:-4px 0 12px;max-width:720px">Varje kort är en grupp personer som inte är kopplade till de andra. När du vet hur de är släkt klickar du på <b>Koppla ihop</b>, så blir de ett träd.</p>
    ${sugg.length?`<div class="box suggest"><h3>Kanske samma person?</h3><p>De här personerna finns i olika träd men liknar varandra. Är det samma person blir träden ett när du slår ihop dem.</p>
      ${sugg.map((d,i)=>`<div class="sg-row"><span><b>${esc(personLabel(d.a))}</b> <span class="muted small">i ${esc(treeOf(d.a.id).name)}</span><br><b>${esc(personLabel(d.b))}</b> <span class="muted small">i ${esc(treeOf(d.b.id).name)}</span></span><span class="sg-acts"><button class="btn sm primary" data-sgyes="${i}">Ja, samma person</button><button class="btn sm ghost" data-sgno="${i}">Nej</button></span></div>`).join('')}</div>`:''}
    <div class="treecards">${big.map(card).join('')}
    ${lone.length?`<div class="treecard"><div class="tc-h"><b>Ensamma personer</b></div><div class="muted small">${lone.length} personer utan kopplingar</div>
      <div class="lone">${lone.slice(0,12).map(t=>`<span class="lone-p"><a href="#" data-topen="${t.root.id}">${esc(fullName(t.root))}</a>${Store.canEdit?` <button class="iconbtn" title="Koppla ihop" data-tlink="${t.root.id}">🔗</button>`:''}</span>`).join('')}${lone.length>12?` <span class="muted small">+${lone.length-12} till</span>`:''}</div></div>`:''}</div>`;
}
function bindTrees(root){
  root.querySelectorAll('[data-topen]').forEach(b=>b.onclick=e=>{e.preventDefault(); setFocus(b.dataset.topen); ui.treeKey=null; if(location.hash!=='#trad') location.hash='trad'; else renderAll(true);});
  root.querySelectorAll('[data-tlink]').forEach(b=>b.onclick=()=>linkModal(b.dataset.tlink));
  const sugg=crossTreeDups().slice(0,4);
  root.querySelectorAll('[data-sgyes]').forEach(b=>b.onclick=()=>{const d=sugg[+b.dataset.sgyes]; const score=p=>Object.values(p).filter(Boolean).length+(p.citations||[]).length; const [k,x]=score(d.a)>=score(d.b)?[d.a,d.b]:[d.b,d.a];
    confirmBox(`Slå ihop till en person?`,`${fullName(k)} och ${fullName(x)} blir en och samma person. Uppgifter som saknas fylls i från den andra, och deras släktträd blir ett.`,'Slå ihop',()=>mergePersons(k.id,x.id));});
  root.querySelectorAll('[data-sgno]').forEach(b=>b.onclick=()=>{const d=sugg[+b.dataset.sgno]; const a=clone(d.a); a.notDup=[...new Set([...(a.notDup||[]),d.b.id])]; Store.put(a);});
}
const LINK_REL=[['parent','är förälder till'],['child','är barn till'],['partner','är gift eller sambo med'],['sibling','är syskon till'],['same','är samma person som']];
function linkModal(aId,bId){
  modal(`<h3>Koppla ihop två personer</h3>
    <p class="muted" style="margin-top:-4px;line-height:1.5">Välj två personer och hur de hör ihop. Ligger de i olika släktträd blir träden ett.</p>
    <label class="f"><span>Den här personen …</span>${personPicker('lkA',aId,'Skriv ett namn')}</label>
    <div class="relpick">${LINK_REL.map(([k,t],i)=>`<label class="rp"><input type="radio" name="lkR" value="${k}" ${i===0?'checked':''}><span>${t}</span></label>`).join('')}</div>
    <label class="f"><span>… den här personen</span>${personPicker('lkB',bId,'Skriv ett namn')}</label>
    <div class="lk-sum" id="lkSum"></div>
    ${allPersonsDatalist()}
    <div class="foot"><button class="btn" data-x>Avbryt</button><button class="btn primary" data-ok>Koppla ihop</button></div>`,
  (ov,close)=>{
    const q=x=>ov.querySelector(x);
    const read=()=>({a:personByLabel(q('#lkA').value),b:personByLabel(q('#lkB').value),rel:(ov.querySelector('[name=lkR]:checked')||{}).value});
    const upd=()=>{const {a,b}=read(); const el=q('#lkSum');
      ov.querySelectorAll('.rp span').forEach((sp,i)=>{const k=LINK_REL[i][0]; sp.textContent=k==='parent'&&a&&a.sex?(a.sex==='M'?'är far till':'är mor till'):k==='child'&&a&&a.sex?(a.sex==='M'?'är son till':'är dotter till'):k==='sibling'&&a&&a.sex?(a.sex==='M'?'är bror till':'är syster till'):LINK_REL[i][1];});
      if(!a||!b){el.innerHTML='<span class="muted">Välj båda personerna i listorna som kommer upp när du skriver.</span>'; return;}
      const ta=treeOf(a.id),tb=treeOf(b.id); const lbl=ov.querySelector('[name=lkR]:checked+span').textContent;
      el.innerHTML=`<b>${esc(fullName(a))}</b> ${esc(lbl)} <b>${esc(fullName(b))}</b>.${ta&&tb&&ta!==tb?`<br><span class="ok-t">✓ ${esc(ta.name)} (${ta.size}) och ${esc(tb.name)} (${tb.size}) blir ett släktträd.</span>`:''}`;};
    ov.querySelectorAll('input').forEach(i=>{i.oninput=upd; i.onchange=upd;}); upd();
    (aId?q('#lkB'):q('#lkA')).focus();
    q('[data-x]').onclick=close;
    q('[data-ok]').onclick=()=>{const {a,b,rel}=read();
      if(!a||!b){toast('Välj båda personerna i listan.');return;}
      if(a.id===b.id){toast('Välj två olika personer.');return;}
      const ta=treeOf(a.id),tb=treeOf(b.id), joined=ta&&tb&&ta!==tb, total=joined?ta.size+tb.size:0;
      const done=()=>{ui.treeKey=null; setFocus(rel==='same'?a.id:b.id); toast(joined?`Klart! Två släktträd blev ett – ${total} personer.`:'Klart! Kopplingen är sparad.',4000); renderAll(true);};
      if(rel==='same'){close(); confirmBox('Slå ihop till en person?',`${fullName(a)} och ${fullName(b)} blir en och samma person. Uppgifter som saknas fylls i från den andra.`,'Slå ihop',async()=>{await mergePersons(a.id,b.id); done();}); return;}
      const err=linkPersons(a,rel,b); if(err){toast(err,6000);return;}
      close(); done();
    };
  });
}
/** Wire two existing people together. Returns an error message or ''. */
function linkPersons(a,rel,b){
  if(rel==='child') return linkPersons(b,'parent',a);
  const A=clone(a),B=clone(b);
  if(rel==='partner'){A.spouseIds=[...new Set([...(A.spouseIds||[]),B.id])]; B.spouseIds=[...new Set([...(B.spouseIds||[]),A.id])]; Store.put(A,{silent:true}); Store.put(B,{silent:true}); return '';}
  if(rel==='parent'){
    if(ancestorsOf(A.id).has(B.id)) return `${fullName(b)} står redan som ana till ${fullName(a)} – det kan inte vara tvärtom också.`;
    const slot=A.sex==='M'?'fatherId':A.sex==='K'?'motherId':(!B.fatherId?'fatherId':'motherId');
    if(B[slot]&&B[slot]!==A.id){const o=P(B[slot]); return `${fullName(b)} har redan ${slot==='fatherId'?'en far':'en mor'}${o?' ('+fullName(o)+')':''}. Är det samma person? Välj då ”är samma person som”.`;}
    B[slot]=A.id; if(!A.sex){A.sex=slot==='fatherId'?'M':'K'; Store.put(A,{silent:true});}
    const other=P(B[slot==='fatherId'?'motherId':'fatherId']);
    if(other&&!(A.spouseIds||[]).includes(other.id)){const a2=clone(P(A.id)||A); a2.sex=a2.sex||A.sex; a2.spouseIds=[...new Set([...(a2.spouseIds||[]),other.id])]; Store.put(a2,{silent:true}); const o2=clone(other); o2.spouseIds=[...new Set([...(o2.spouseIds||[]),A.id])]; Store.put(o2,{silent:true});}
    Store.put(B,{silent:true}); return '';
  }
  if(rel==='sibling'){
    if(!A.fatherId&&!A.motherId&&!B.fatherId&&!B.motherId) return `Syskon kopplas ihop via föräldrarna. Lägg först till far eller mor för ${fullName(a)} eller ${fullName(b)}.`;
    for(const k of ['fatherId','motherId']){ if(A[k]&&B[k]&&A[k]!==B[k]) return `${fullName(a)} och ${fullName(b)} har olika ${k==='fatherId'?'fäder':'mödrar'} inlagda. Halvsyskon kopplar du genom att ge dem samma ${k==='fatherId'?'mor':'far'}.`; }
    for(const k of ['fatherId','motherId']){ if(A[k]&&!B[k]) B[k]=A[k]; if(B[k]&&!A[k]) A[k]=B[k]; }
    Store.put(A,{silent:true}); Store.put(B,{silent:true}); return '';
  }
  return 'Okänd koppling';
}

export { newsHTML, onThisDayHTML, heroArt, REPO_URL, landingMore, bindLanding, renderAbout, renderStart, _treesKey, _trees, trees, treeOf, crossTreeDups, treesSection, bindTrees, LINK_REL, linkModal, linkPersons };
