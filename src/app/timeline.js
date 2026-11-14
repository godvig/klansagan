/* Släktsagan · timeline.js — The timeline. */
import { P, fullName, lifeEvents, placeName, scopeSet, sexColor } from './domain.js?v=41';
import { emptyState, showPerson } from './router.js?v=41';
import { S, ui } from './state.js?v=41';
import { cssv } from './theme.js?v=41';
import { $, HIST, NOW_Y, dateKey, esc } from './util.js?v=41';

/* ============ TIMELINE ============ */
function renderTimeline(){
  const v=$('#view'); const all=Object.values(S.persons);
  if(!all.length){v.innerHTML=emptyState();return;}
  const scope=scopeSet(ui.tlScope);
  const ppl=all.filter(p=>!scope||scope.has(p.id));
  const rows=[];
  for(const p of ppl){
    const b=dateKey(p.birthDate),d=dateKey(p.deathDate);
    const evs=(p.events||[]).map(e=>({e,k:dateKey(e.date)})).filter(x=>x.k!=null);
    let s=b,t=d,fs=false,ft=false;
    if(s==null&&t!=null){s=t-60;fs=true;}
    if(s==null&&evs.length){s=Math.min(...evs.map(x=>x.k))-20;fs=true;}
    if(s==null) continue;
    if(t==null){ if(s>NOW_Y-105&&!fs){t=NOW_Y+0.5;} else {t=Math.max(s+70,...evs.map(x=>x.k));ft=true;} }
    rows.push({p,s,t,fs,ft,evs,alive:t>=NOW_Y&&!ft&&!p.deathDate});
  }
  rows.sort((a,b)=>a.s-b.s);
  const skipped=ppl.length-rows.length;
  const LW=190,RH=24,TOP=74;
  v.innerHTML=`<div class="view-pad" style="max-width:none">
    <div class="toolbar"><h2>Tidslinje</h2>
      <div class="seg" id="tlScope">${[['alla','Alla'],['anor','Anor'],['attlingar','Ättlingar']].map(([k,t])=>`<button data-k="${k}" class="${ui.tlScope===k?'on':''}">${t}${k!=='alla'&&P(ui.focus)?' till '+esc(P(ui.focus).given||''):''}</button>`).join('')}</div>
      <label class="check" style="margin:0"><input type="checkbox" id="tlHist" ${ui.tlHist?'checked':''}> Historiska händelser</label>
    </div>
    ${rows.length?`<div id="tlChart"></div>`:`<div class="box"><p>Ingen i urvalet har några datum ännu. Lägg till födelse- eller dödsår så dyker livslinjerna upp här.</p></div>`}
    ${skipped?`<p class="small muted">${skipped} person(er) saknar datum och visas inte.</p>`:''}
    <div class="evlist"><h3 style="font-size:18px;margin-bottom:10px">Alla händelser i tidsordning</h3><div id="tlList"></div></div></div>`;
  v.querySelectorAll('#tlScope button').forEach(b=>b.onclick=()=>{ui.tlScope=b.dataset.k;renderTimeline();});
  $('#tlHist').onchange=e=>{ui.tlHist=e.target.checked;renderTimeline();};
  // event list
  const list=[]; for(const p of ppl) for(const e of lifeEvents(p)) if(e.date) list.push({p,e,k:dateKey(e.date)});
  list.sort((a,b)=>(a.k??9e9)-(b.k??9e9));
  $('#tlList').innerHTML=list.length?`<table class="list m-events"><thead><tr><th style="width:120px">Datum</th><th>Händelse</th><th>Person</th><th>Plats</th></tr></thead><tbody>${list.map(r=>`<tr class="click" data-id="${r.p.id}"><td>${esc(r.e.date)}</td><td>${esc(r.e.type)}${r.e.desc?`<div class="small muted">${esc(r.e.desc)}</div>`:''}</td><td><span class="dot" style="background:${sexColor(r.p)}"></span>${esc(fullName(r.p))}</td><td>${esc(placeName(r.e.placeId))}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Inga daterade händelser.</p>';
  $('#tlList').querySelectorAll('tr[data-id]').forEach(tr=>tr.onclick=()=>showPerson(tr.dataset.id));
  if(!rows.length) return;
  const box=$('#tlChart'); const W=Math.max(box.clientWidth,760); const H=TOP+rows.length*RH+16;
  const x0=Math.floor((d3.min(rows,r=>r.s)-5)/10)*10, x1=Math.min(NOW_Y+5,Math.ceil((d3.max(rows,r=>r.t)+5)/10)*10);
  const x=d3.scaleLinear().domain([x0,x1]).range([LW,W-20]);
  const svg=d3.select(box).append('svg').attr('width',W).attr('height',H);
  const defs=svg.append('defs');
  ['M','K','U'].forEach(s=>{const c={M:cssv('--male'),K:cssv('--female'),U:cssv('--unk')}[s];
    const gR=defs.append('linearGradient').attr('id','fr'+s); gR.append('stop').attr('offset','0').attr('stop-color',c); gR.append('stop').attr('offset','1').attr('stop-color',c).attr('stop-opacity',0);
    const gL=defs.append('linearGradient').attr('id','fl'+s); gL.append('stop').attr('offset','0').attr('stop-color',c).attr('stop-opacity',0); gL.append('stop').attr('offset','1').attr('stop-color',c);});
  if(ui.tlHist){
    const hs=HIST.filter(h=>h.b>=x0&&h.a<=x1);
    const hg=svg.append('g');
    hs.forEach((h,i)=>{const xa=x(h.a),xb=Math.max(x(h.b+1),xa+2); hg.append('rect').attr('class','hist-band').attr('x',xa).attr('y',TOP-6).attr('width',xb-xa).attr('height',H-TOP); hg.append('text').attr('class','hist-lbl').attr('x',xa>W-200?xb-2:xa+2).attr('text-anchor',xa>W-200?'end':'start').attr('y',TOP-10-(i%3)*12).text(h.t).append('title').text(h.a===h.b?h.a+': '+h.t:h.a+'–'+h.b+': '+h.t);});
  }
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${H-4})`);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,24)`).call(d3.axisTop(x).ticks(Math.min(14,(x1-x0)/10)).tickFormat(d3.format('d')).tickSize(-(H-24))).call(g=>g.selectAll('.tick line').attr('stroke',cssv('--grid'))).call(g=>g.select('.domain').remove());
  const sel=ui.sel&&ui.sel.type==='person'?ui.sel.id:null;
  const g=svg.selectAll('g.tl-row').data(rows).join('g').attr('class','tl-row').attr('transform',(r,i)=>`translate(0,${TOP+i*RH})`);
  g.append('rect').attr('class','tl-bg').attr('x',0).attr('width',W).attr('height',RH).attr('fill',r=>r.p.id===sel?cssv('--accent2'):'transparent');
  g.append('text').attr('class','tl-name').attr('x',12).attr('y',RH/2+4).text(r=>{const n=fullName(r.p);return n.length>24?n.slice(0,23)+'…':n;}).on('click',(e,r)=>showPerson(r.p.id));
  g.each(function(r){
    const el=d3.select(this); const s=r.p.sex==='M'?'M':r.p.sex==='K'?'K':'U'; const col={M:cssv('--male'),K:cssv('--female'),U:cssv('--unk')}[s];
    const xa=x(r.s),xb=x(r.t),y=RH/2-4;
    el.append('rect').attr('x',xa).attr('y',y).attr('width',Math.max(2,xb-xa)).attr('height',8).attr('rx',4).attr('fill',r.ft?`url(#fr${s})`:r.fs?`url(#fl${s})`:col).attr('opacity',.85).style('cursor','pointer').on('click',()=>showPerson(r.p.id))
      .append('title').text(`${fullName(r.p)}: ${r.p.birthDate||'?'} – ${r.p.deathDate||(r.alive?'':'?')}`);
    for(const ev of r.evs){el.append('circle').attr('cx',x(ev.k)).attr('cy',RH/2).attr('r',4.2).attr('fill',cssv('--card')).attr('stroke',col).attr('stroke-width',1.8).append('title').text(`${ev.e.type} ${ev.e.date}${ev.e.placeId?' – '+placeName(ev.e.placeId):''}`);}
    if(!r.fs) el.append('circle').attr('cx',xa).attr('cy',RH/2).attr('r',2.5).attr('fill',cssv('--card'));
  });
}

export { renderTimeline };
