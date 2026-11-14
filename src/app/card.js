/* Släktsagan · card.js — The person card page. */
import { P, ageAt, avImg, avatarUrl, children, fullName, homePerson, initials, isAudio, isImg, lifeEvents, partners, placeName, sexColor, shortName, siblings, thumbUrl } from './domain.js?v=41';
import { openLightbox } from './media.js?v=41';
import { openPersonModal } from './modal.js?v=41';
import { bindVoices, citeLinks, voiceRows } from './panel.js?v=41';
import { personPdf } from './print.js?v=41';
import { emptyState, setFocus } from './router.js?v=41';
import { S, ui } from './state.js?v=41';
import { Store } from './store.js?v=41';
import { bindChips, chipHTML, listJoin, numw, openCard } from './theme.js?v=41';
import { $, dateKey, esc, fmtDate, whenText, yearOf } from './util.js?v=41';

/* ============ PERSON CARD ============ */
function storyOf(p){
  const he=p.sex==='K'?'hon':p.sex==='M'?'han':'hen', He=he[0].toUpperCase()+he.slice(1);
  const name=fullName(p), out=[];
  const f=P(p.fatherId), m=P(p.motherId);
  const child=p.sex==='K'?'dotter':p.sex==='M'?'son':'barn';
  if(p.birthDate||p.birthPlace){
    let t=`${name} föddes${p.birthDate?' '+whenText(p.birthDate):''}${p.birthPlace?' i '+placeName(p.birthPlace):''}`;
    if(f||m) t+=`, ${f&&m?child+' till '+fullName(f)+' och '+fullName(m):child+' till '+fullName(f||m)}`;
    out.push(t+'.');
  } else if(f||m) out.push(`${name} var ${child} till ${f&&m?fullName(f)+' och '+fullName(m):fullName(f||m)}.`);
  if(p.occupation) out.push(`${out.length?He:name} var ${/^[A-ZÅÄÖ][a-zåäö]/.test(p.occupation)?p.occupation[0].toLowerCase()+p.occupation.slice(1):p.occupation}.`);
  const evs=(p.events||[]).filter(e=>e.type!=='Vigsel').sort((a,b)=>(dateKey(a.date)??9e9)-(dateKey(b.date)??9e9));
  const pl=e=>e.placeId?' i '+placeName(e.placeId):'';
  const verbs={Dop:'döptes',Konfirmation:'konfirmerades',Kröning:'kröntes',Begravning:'begravdes',Militärtjänst:'gjorde militärtjänst',Bosatt:'bodde'};
  const parts=partners(p); const kids=children(p.id);
  for(const sp of parts){
    const vig=(p.events||[]).find(e=>e.type==='Vigsel'&&e.withId===sp.id)||(sp.events||[]).find(e=>e.type==='Vigsel'&&e.withId===p.id);
    const married=(p.spouseIds||[]).includes(sp.id)||vig;
    let t=married?`${He} gifte sig${vig&&vig.date?' '+whenText(vig.date):''}${vig&&vig.placeId?' i '+placeName(vig.placeId):''} med ${fullName(sp)}`:`${He} fick barn med ${fullName(sp)}`;
    const ck=kids.filter(c=>c.fatherId===sp.id||c.motherId===sp.id);
    const kl=listJoin(ck.map(c=>(shortName(c))+(yearOf(c.birthDate)?` (${yearOf(c.birthDate)})`:'')));
    if(ck.length) t+=married?`, och tillsammans fick de ${numw(ck.length)} barn: ${kl}`:` – ${kl}`;
    out.push(t+'.');
  }
  const solo=kids.filter(c=>!parts.some(sp=>c.fatherId===sp.id||c.motherId===sp.id));
  if(solo.length) out.push(`${He} hade ${parts.length?'också ':''}${solo.length===1?'barnet':'barnen'} ${listJoin(solo.map(c=>fullName(c)))}.`);
  for(const e of evs){
    const w=e.date?whenText(e.date):'';
    if(e.type==='Flytt') out.push(`${w?w[0].toUpperCase()+w.slice(1)+' flyttade '+he:He+' flyttade'}${e.placeId?' till '+placeName(e.placeId):''}${e.desc?' – '+e.desc.replace(/\.$/,''):''}.`);
    else if(e.type==='Utvandring') out.push(`${w?w[0].toUpperCase()+w.slice(1)+' utvandrade '+he:He+' utvandrade'}${e.placeId?' via '+placeName(e.placeId):''}${e.desc?' – '+e.desc.replace(/\.$/,''):''}.`);
    else if(verbs[e.type]) out.push(`${He} ${verbs[e.type]}${w?' '+w:''}${pl(e)}${e.desc&&!['Begravning','Kröning'].includes(e.type)?' ('+e.desc.replace(/\.$/,'')+')':''}.`);
    else if(e.desc) out.push(`${w?w[0].toUpperCase()+w.slice(1)+' – ':''}${w?e.desc[0].toLowerCase()+e.desc.slice(1).replace(/\.$/,''):e.desc.replace(/\.$/,'')}${e.placeId&&!e.desc.includes(placeName(e.placeId))?pl(e):''}.`);
  }
  if(p.deathDate||p.deathPlace){const age=ageAt(p); out.push(`${He} dog${p.deathDate?' '+whenText(p.deathDate):''}${p.deathPlace?' i '+placeName(p.deathPlace):''}${age!=null&&age>0?`, ${age} år gammal`:''}.`);}
  return out.join(' ');
}
function renderCard(){
  const v=$('#view'); const p=P(ui.cardId)||(ui.sel&&ui.sel.type==='person'&&P(ui.sel.id))||P(ui.focus);
  if(!p){v.innerHTML=emptyState();return;}
  ui.cardId=p.id;
  const av=avatarUrl(p), f=P(p.fatherId), m=P(p.motherId), parts=partners(p), kids=children(p.id), sibs=siblings(p);
  const imgs=(p.media||[]);
  const evs=lifeEvents(p); const by=yearOf(p.birthDate);
  const story=storyOf(p);
  v.innerHTML=`<div class="pc">
    <div class="pc-head"><div class="pc-photo" style="box-shadow:0 0 0 2px ${sexColor(p)},var(--shadow)">${av?avImg(p):esc(initials(p))}</div>
      <div><h1>${esc(fullName(p))}</h1><div class="life">${esc([p.birthDate?'* '+fmtDate(p.birthDate):'',p.deathDate?'† '+fmtDate(p.deathDate):''].filter(Boolean).join('   '))}${p.occupation?`<br>${esc(p.occupation)}`:''}</div>
      <div class="acts">${Store.canEdit?'<button class="btn" data-pc="edit">Redigera</button>':''}<button class="btn" data-pc="tree">Visa i trädet</button><button class="btn" data-pc="fan">Solfjäder</button><button class="btn" data-pc="rel">Hur är vi släkt?</button><button class="btn" data-pc="pdf">⎙ Skriv ut / PDF</button></div></div></div>
    <div class="pc-grid"><div>
      <h3>Livsberättelse</h3><p class="story">${story?esc(story):'<span class="muted">Lägg till datum, platser och händelser så skrivs en berättelse automatiskt.</span>'}</p>
      ${imgs.some(isAudio)?`<h3>Röstminnen</h3><div class="vms">${voiceRows(p)}</div>`:''}
      ${imgs.some(x=>!isAudio(x))?`<h3>Bilder &amp; dokument</h3><div class="gallery">${imgs.map((mm,i)=>isAudio(mm)?'':`<div class="m" data-img="${i}" title="${esc(mm.caption||mm.name||'')}">${isImg(mm)?`<img src="${esc(thumbUrl(mm))}" alt="${esc(mm.caption||'')}" loading="lazy">`:'📄'}</div>`).join('')}</div>`:''}
      <h3>Tidslinje</h3><div class="vtl">${evs.map(e=>{const y=yearOf(e.date); const age=by&&y&&e.fixed!=='birth'?y-by:null; return `<div class="it"><div class="d">${esc(fmtDate(e.date)||'okänt datum')}${age!=null&&age>=0?` · ${age} år`:''}</div><b>${esc(e.type==='Övrigt'&&e.desc?e.desc:e.type)}</b>${e.placeId?` · ${esc(placeName(e.placeId))}`:''}${e.withId&&P(e.withId)?` · med ${esc(fullName(P(e.withId)))}`:''}${e.desc&&e.type!=='Övrigt'?`<div class="muted small">${esc(e.desc)}</div>`:''}</div>`;}).join('')||'<p class="muted">Inga händelser.</p>'}</div>
      ${p.notes?`<h3>Anteckningar</h3><p style="white-space:pre-wrap;line-height:1.6">${esc(p.notes)}</p>`:''}
    </div><div>
      <h3>Familj</h3>
      ${f||m?`<div class="fam-group"><h5>Föräldrar</h5><div class="recent" style="grid-template-columns:1fr">${[f,m].filter(Boolean).map(x=>chipHTML(x)).join('')}</div></div>`:''}
      ${parts.map(sp=>{const ck=kids.filter(c=>c.fatherId===sp.id||c.motherId===sp.id); return `<div class="fam-group"><h5>${(p.spouseIds||[]).includes(sp.id)?(sp.sex==='K'?'Hustru':sp.sex==='M'?'Make':'Partner'):'Partner'}</h5><div class="recent" style="grid-template-columns:1fr">${chipHTML(sp)}</div>${ck.length?`<h5 style="margin-top:8px">Barn (${ck.length})</h5><div class="recent" style="grid-template-columns:1fr">${ck.map(c=>chipHTML(c)).join('')}</div>`:''}</div>`;}).join('')}
      ${(()=>{const solo=kids.filter(c=>!parts.some(sp=>c.fatherId===sp.id||c.motherId===sp.id)); return solo.length?`<div class="fam-group"><h5>Barn</h5><div class="recent" style="grid-template-columns:1fr">${solo.map(c=>chipHTML(c)).join('')}</div></div>`:'';})()}
      ${sibs.length?`<div class="fam-group"><h5>Syskon (${sibs.length})</h5><div class="recent" style="grid-template-columns:1fr">${sibs.map(c=>chipHTML(c)).join('')}</div></div>`:''}
      <h3 style="margin-top:22px">Källor</h3>
      ${(p.citations||[]).map(c=>{const s=S.sources[c.sourceId]; return s?`<div class="cite"><b>${esc(s.title)}</b><div class="small muted">${esc([c.about&&!c.about.startsWith('event:')?c.about:'',c.detail,s.ref].filter(Boolean).join(' · '))}</div>${citeLinks(c)}</div>`:'';}).join('')||'<p class="muted small">Inga källor kopplade ännu.</p>'}
    </div></div></div>`;
  bindChips(v,openCard);
  v.querySelectorAll('[data-img]').forEach(el=>el.onclick=()=>{ui.sel={type:'person',id:p.id}; openLightbox(p,+el.dataset.img);});
  bindVoices(v,p);
  v.querySelectorAll('[data-pc]').forEach(b=>b.onclick=()=>{const a=b.dataset.pc;
    if(a==='edit') openPersonModal(p);
    if(a==='tree'){setFocus(p.id); ui.treeKey=null; location.hash='trad';}
    if(a==='fan'){setFocus(p.id); ui.fanKey=null; location.hash='solfjader';}
    if(a==='rel'){ui.relB=p.id; const h=homePerson(); ui.relA=h&&h.id!==p.id?h.id:null; location.hash='slaktskap';}
    if(a==='pdf') personPdf(p);
  });
}

export { storyOf, renderCard };
