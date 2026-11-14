/* Släktsagan · fan.js — The fan chart. */
import { P, ancestorsOf, avatarUrl, fullName, lifespan, personLabel, placeName, shortName } from './domain.js?v=45';
import { openPersonModal } from './modal.js?v=45';
import { printChart } from './print.js?v=45';
import { emptyState, select, setFocus } from './router.js?v=45';
import { S, ui } from './state.js?v=45';
import { Store } from './store.js?v=45';
import { cssv } from './theme.js?v=45';
import { $, esc } from './util.js?v=45';

/* ============ FAN CHART ============ */
let fanZoom=null;
function renderFan(fresh){
  const v=$('#view');
  if(!Object.keys(S.persons).length){v.innerHTML=emptyState();return;}
  let F=P(ui.focus); if(!ui.fanGen) ui.fanGen=matchMedia('(max-width:700px)').matches?3:4; let fanNote='';
  if(F&&!F.fatherId&&!F.motherId){let best=null,bn=0; for(const p of Object.values(S.persons)){const n=ancestorsOf(p.id).size; if(n>bn){bn=n;best=p;}} if(best){fanNote=`${esc(shortName(F))} har inga registrerade föräldrar – visar ${esc(fullName(best))}, som har flest kända anor.`; F=best;}}
  if(!$('#fanSvg')||fresh){
    v.innerHTML=`<div id="fanWrap"><svg id="fanSvg"><g class="vp"></g></svg>
      <div class="tree-tools"><span class="fname" id="fanName"></span>
        <span class="ctl">Generationer <select id="fanGen">${[3,4,5,6,7,8,9,10].map(n=>`<option ${n===ui.fanGen?'selected':''}>${n}</option>`).join('')}</select></span>
        <button class="btn sm" id="fanFit">Centrera</button><button class="btn sm" id="fanPrint">⎙ Skriv ut / spara</button><div id="fanNote" class="fan-note" style="display:none"></div></div>
      <div class="fan-legend" id="fanLegend"></div></div>`;
    $('#fanGen').onchange=e=>{ui.fanGen=+e.target.value; ui.fanKey=null; renderFan();};
    $('#fanFit').onclick=()=>{ui.fanKey=null; renderFan();};
    $('#fanPrint').onclick=()=>printChart($('#fanSvg'),'Solfjäder för '+$('#fanName').textContent,'slaktsagan-fan');
    const svg=d3.select('#fanSvg'); fanZoom=d3.zoom().scaleExtent([.2,4]).on('zoom',e=>svg.select('g.vp').attr('transform',e.transform)); svg.call(fanZoom).on('dblclick.zoom',null);
    ui.fanKey=null;
  }
  $('#fanName').textContent=fullName(F); const fnEl=$('#fanNote'); fnEl.style.display=fanNote?'flex':'none'; fnEl.innerHTML=fanNote;
  const N=ui.fanGen, R0=66, W=[0,80,80,86,104,110,112,112,112,112,112];
  const rIn=g=>R0+W.slice(1,g).reduce((a,b)=>a+b,0), rOut=g=>rIn(g)+W[g];
  const cols=[cssv('--male'),'#5f8f7f','#b08a4a',cssv('--female')];
  const slots=[]; const known=Array(N+1).fill(0);
  (function walk(p,g,i){ if(g>N) return; for(const k of [0,1]){ const j=2*i+k; const q=p?P(p[k?'motherId':'fatherId']):null; slots.push({g,j,p:q,child:p,k}); if(q) known[g]++; walk(q,g+1,j);} })(F,1,0);
  const svg=d3.select('#fanSvg'), g=svg.select('g.vp'); g.selectAll('*').remove();
  const defs=g.append('defs'); const arc=d3.arc();
  const pt=(a,r)=>[r*Math.sin(a),-r*Math.cos(a)];
  for(const s of slots){
    const n=2**s.g, span=Math.PI/n, a0=-Math.PI/2+s.j*span, a1=a0+span, r0=rIn(s.g), r1=rOut(s.g);
    const quad=s.g===1?(s.j?3:0):Math.floor(s.j/(n/4));
    const path=arc({innerRadius:r0,outerRadius:r1,startAngle:a0,endAngle:a1});
    if(!s.p){
      const el=g.append('path').attr('d',path).attr('class','fan-empty');
      if(s.child&&Store.canEdit&&!s.child[s.k?'motherId':'fatherId']){el.append('title').text('Lägg till '+(s.k?'mor':'far')+' till '+fullName(s.child)); el.on('click',()=>openPersonModal(null,{rel:s.k?'mother':'father',of:s.child.id}));}
      else el.style('cursor','default').style('opacity',.45);
      continue;
    }
    const p=s.p;
    g.append('path').attr('d',path).attr('class','fan-seg').style('fill',cols[quad]).style('fill-opacity',Math.max(.28,.82-(s.g-1)*.1))
      .on('click',()=>{setFocus(p.id); ui.fanKey=null; select('person',p.id);}).append('title').text(personLabel(p)+(p.birthPlace?' · '+placeName(p.birthPlace):''));
    const rm=(r0+r1)/2, mid=(a0+a1)/2, nm=fullName(p), yrs=lifespan(p).replace(/\s/g,'');
    if(s.g<=3){
      const L=rm*span, fs=s.g===1?13:s.g===2?12:11, maxc=Math.max(4,Math.floor(L/(fs*0.56)));
      const lines=[[p.given||'',fs,600],[p.surname||'',fs,600],[yrs,fs-1.5,400]].filter(l=>l[0]);
      const step=fs+3, start=rm+((lines.length-1)/2)*step;
      lines.forEach(([t,f,w],li)=>{ const r=start-li*step-f/3; const id=`fa${s.g}_${s.j}_${li}`; const A=pt(a0,r),B=pt(a1,r);
        defs.append('path').attr('id',id).attr('d',`M${A[0]},${A[1]}A${r},${r} 0 0 1 ${B[0]},${B[1]}`);
        g.append('text').attr('class','fan-txt').style('font-size',f+'px').style('font-weight',w).append('textPath').attr('href','#'+id).attr('startOffset','50%').attr('text-anchor','middle').text(t.length>maxc?t.slice(0,maxc-1)+'…':t);});
    } else {
      const thick=rm*span, fs=s.g===4?10.5:s.g===5?9.5:s.g===6?8.5:7.5, maxc=Math.floor((W[s.g]-10)/(fs*0.56));
      const deg=mid*180/Math.PI; const flip=mid<0;
      const tg=g.append('g').attr('transform',`rotate(${deg-90}) translate(${rm},0)${flip?' rotate(180)':''}`);
      const lines=thick<fs*0.95?[]:thick>fs*1.8?[[nm,fs,600],[yrs,fs-1,400]]:[[nm,fs,600]];
      const step=fs+1.5, off=-((lines.length-1)/2)*step;
      lines.forEach(([t,f,w],li)=>tg.append('text').attr('class','fan-txt').attr('text-anchor','middle').attr('dy',(off+li*step+f/3).toFixed(1)).style('font-size',f+'px').style('font-weight',w).text(t.length>maxc?t.slice(0,maxc-1)+'…':t));
    }
  }
  // centre
  const cg=g.append('g').style('cursor','pointer').on('click',()=>select('person',F.id));
  cg.append('circle').attr('r',R0-5).style('fill',cssv('--card')).style('stroke',cssv('--accent')).style('stroke-width',2.5);
  const av=avatarUrl(F);
  if(av){defs.append('clipPath').attr('id','fanclip').append('circle').attr('r',R0-9); cg.append('image').attr('href',av).attr('x',-(R0-9)).attr('y',-(R0-9)).attr('width',2*(R0-9)).attr('height',2*(R0-9)).attr('preserveAspectRatio','xMidYMid slice').attr('clip-path','url(#fanclip)').style('opacity',.28);}
  const cn=[F.given||'',F.surname||'',lifespan(F).replace(/\s/g,'')].filter(Boolean);
  cn.forEach((t,i)=>cg.append('text').attr('class','fan-txt').attr('text-anchor','middle').attr('y',(i-(cn.length-1)/2)*15+5).style('font-size',i<2?'13px':'11.5px').style('font-weight',i<2?600:400).text(t.length>14?t.slice(0,13)+'…':t));
  // legend
  let tot=0,kn=0; const rows=[]; for(let i=1;i<=N;i++){const t=2**i; tot+=t; kn+=known[i]; rows.push(`<div class="row"><span style="width:104px">${i===1?'Föräldrar':i===2?'Far-/morföräldrar':'Generation '+i}</span><span class="bar"><i style="width:${100*known[i]/t}%"></i></span><span style="width:44px;text-align:right">${known[i]}/${t}</span></div>`);}
  $('#fanLegend').innerHTML=`<b>Kända anor: ${kn} av ${tot} (${Math.round(100*kn/tot)}%)</b>${rows.join('')}<div class="muted" style="margin-top:6px">Klicka på en ana för att flytta mitten dit.</div>`;
  // fit
  const key=F.id+'|'+N;
  if(ui.fanKey!==key){ui.fanKey=key; const Wd=$('#fanSvg').clientWidth,Hd=$('#fanSvg').clientHeight, R=rOut(N);
    const tb=document.querySelector('#fanWrap .tree-tools'), top=tb?tb.getBoundingClientRect().bottom-$('#fanSvg').getBoundingClientRect().top+12:60, avail=Hd-top-12;
    const k=Math.min(1.6,(Wd-24)/(2*R+20),avail/(R+R0+24)); const cy=top+(avail-(R+R0)*k)/2+R*k;
    svg.call(fanZoom.transform,d3.zoomIdentity.translate(Wd/2,cy).scale(k));}
}

export { fanZoom, renderFan };
