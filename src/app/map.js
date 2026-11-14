/* Släktsagan · map.js — The map. */
import { P, lifeEvents, scopeSet } from './domain.js?v=40';
import { E } from './panel.js?v=40';
import { select } from './router.js?v=40';
import { S, ui } from './state.js?v=40';
import { Store } from './store.js?v=40';
import { $, clone, esc, genitive, toast } from './util.js?v=40';

/* ============ MAP ============ */
const mapState={world:null,loading:false,drawn:false,proj:null,zoom:null,k:1,focusPlace:null};
async function loadWorld(){
  if(mapState.world||mapState.loading) return; mapState.loading=true;
  try{const r=await fetch('data/world-50m.json'); const t=await r.json(); mapState.world=topojson.feature(t,t.objects.countries).features;}catch(e){mapState.world=[];toast('Kunde inte ladda kartan');}
  mapState.loading=false; if(ui.view==='karta'){mapState.drawn=false; renderMap();}
}
function placeStats(scope){
  const st={};
  for(const p of Object.values(S.persons)){ if(scope&&!scope.has(p.id)) continue;
    for(const e of lifeEvents(p)) if(e.placeId){(st[e.placeId]=st[e.placeId]||{n:0,people:new Set()}).n++; st[e.placeId].people.add(p.id);} }
  return st;
}
function renderMap(fresh){
  const v=$('#view');
  const scope=scopeSet(ui.mapScope); const st=placeStats(scope);
  const places=Object.values(S.places);
  const used=places.filter(pl=>st[pl.id]||!scope).sort((a,b)=>(st[b.id]?.n||0)-(st[a.id]?.n||0)||a.name.localeCompare(b.name,'sv'));
  const withC=used.filter(pl=>pl.lat!=null), without=used.filter(pl=>pl.lat==null);
  const placingPl=ui.placing?S.places[ui.placing]:null;
  if(!$('#mapSvg')||fresh){
    v.innerHTML=`<div id="mapWrap"><svg id="mapSvg"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style="fill:var(--err)"/></marker></defs><g class="vp"><g class="lands"></g><g class="routes"></g><g class="mks"></g></g></svg>
      <div class="map-side" id="mapSide"></div><div id="mapBanner"></div>
      <div class="map-zoom"><button id="zIn" title="Zooma in">+</button><button id="zOut" title="Zooma ut">−</button></div></div>`;
    mapState.drawn=false;
    const svg=d3.select('#mapSvg');
    mapState.zoom=d3.zoom().scaleExtent([.5,60]).on('zoom',e=>{mapState.k=e.transform.k; svg.select('g.vp').attr('transform',e.transform); svg.selectAll('.mk').attr('transform',function(){return this.dataset.t+` scale(${1/e.transform.k})`;});});
    svg.call(mapState.zoom).on('dblclick.zoom',null);
    $('#zIn').onclick=()=>svg.transition().call(mapState.zoom.scaleBy,1.6);
    $('#zOut').onclick=()=>svg.transition().call(mapState.zoom.scaleBy,1/1.6);
    svg.on('click',e=>{
      if(!ui.placing||!mapState.proj) return;
      const [mx,my]=d3.pointer(e,svg.select('g.vp').node()); const ll=mapState.proj.invert([mx,my]);
      const pl=clone(S.places[ui.placing]); pl.lat=+ll[1].toFixed(5); pl.lon=+ll[0].toFixed(5); ui.placing=null; ui.sel={type:'place',id:pl.id}; Store.put(pl); toast('📍 '+pl.name+' placerad');
    });
    loadWorld();
  }
  // side panel
  $('#mapSide').innerHTML=`<h3>Platser</h3>
    <div class="seg" style="margin-bottom:10px" id="mpScope">${[['alla','Alla'],['anor','Anor'],['attlingar','Ättlingar']].map(([k,t])=>`<button data-k="${k}" class="${ui.mapScope===k?'on':''}">${t}</button>`).join('')}</div>
    ${ui.sel&&ui.sel.type==='person'?`<label class="check small"><input type="checkbox" id="mpRoute" ${ui.mapRoute?'checked':''}> Visa ${esc(P(ui.sel.id).given?genitive(P(ui.sel.id).given):'vald persons')} livsväg</label>`:'<div class="small muted" style="margin-bottom:6px">Välj en person för att se dennes livsväg.</div>'}
    ${without.length?`<div class="small" style="margin:10px 0 4px;color:var(--warn);font-weight:600">Saknar position (${without.length})</div>${without.map(pl=>`<div class="pl-item" data-pl="${pl.id}"><span class="n">${esc(pl.name)}</span>${E.canEdit?`<button class="btn sm" data-placing="${pl.id}">Placera</button>`:''}</div>`).join('')}`:''}
    <div class="small muted" style="margin:10px 0 4px;font-weight:600">På kartan (${withC.length})</div>
    ${withC.map(pl=>`<div class="pl-item" data-pl="${pl.id}"><span class="dot" style="background:var(--accent)"></span><span class="n">${esc(pl.name)}</span><span class="small muted">${st[pl.id]?st[pl.id].people.size+' pers.':''}</span></div>`).join('')||'<div class="small muted">Inga ännu.</div>'}`;
  $('#mapSide').querySelectorAll('#mpScope button').forEach(b=>b.onclick=()=>{ui.mapScope=b.dataset.k;mapState.drawn=false;renderMap();});
  const rt=$('#mpRoute'); if(rt) rt.onchange=()=>{ui.mapRoute=rt.checked;renderMap();};
  $('#mapSide').querySelectorAll('[data-placing]').forEach(b=>b.onclick=e=>{e.stopPropagation();ui.placing=b.dataset.placing;renderMap();});
  $('#mapSide').querySelectorAll('.pl-item').forEach(el=>el.onclick=()=>{mapState.focusPlace=el.dataset.pl; select('place',el.dataset.pl);});
  $('#mapBanner').innerHTML=placingPl?`<div class="banner">📍 Klicka på kartan där <b>${esc(placingPl.name)}</b> ligger <button class="btn sm" id="cancelPlace">Avbryt</button></div>`:'';
  if(placingPl) $('#cancelPlace').onclick=e=>{e.stopPropagation();ui.placing=null;renderMap();};
  $('#mapSvg').style.cursor=placingPl?'crosshair':'grab';
  if(!mapState.world) return;
  const svg=d3.select('#mapSvg'); const W=$('#mapSvg').clientWidth,H=$('#mapSvg').clientHeight;
  if(!mapState.drawn){
    mapState.drawn=true;
    const pts=withC.map(pl=>[pl.lon,pl.lat]);
    let bb; if(pts.length){const mLo=d3.median(pts,p=>p[0]),mLa=d3.median(pts,p=>p[1]); const core=pts.filter(p=>Math.abs(p[0]-mLo)<22&&Math.abs(p[1]-mLa)<13); const use=core.length?core:pts; const lo=d3.extent(use,p=>p[0]),la=d3.extent(use,p=>p[1]); const pad=Math.max(1.2,(lo[1]-lo[0])*.12); bb=[[lo[0]-pad,la[0]-pad*.6],[lo[1]+pad,la[1]+pad*.6]];} else bb=[[4,54.5],[31,69.5]];
    const sideW=window.innerWidth>900?300:20;
    mapState.proj=d3.geoMercator().fitExtent([[sideW,30],[W-30,H-30]],{type:'MultiPoint',coordinates:[bb[0],bb[1],[bb[0][0],bb[1][1]],[bb[1][0],bb[0][1]]]});
    const path=d3.geoPath(mapState.proj);
    svg.select('g.lands').selectAll('path').data(mapState.world).join('path').attr('class',d=>'land'+(['752','578','246','208'].includes(d.id)?' home':'')).attr('d',path);
    svg.call(mapState.zoom.transform,d3.zoomIdentity); mapState.k=1;
  }
  const proj=mapState.proj,k=mapState.k;
  // route
  const rg=svg.select('g.routes'); rg.selectAll('*').remove();
  if(ui.mapRoute&&ui.sel&&ui.sel.type==='person'){
    const seq=lifeEvents(P(ui.sel.id)).map(e=>S.places[e.placeId]).filter(pl=>pl&&pl.lat!=null);
    const pts=[]; for(const pl of seq){ if(!pts.length||pts[pts.length-1].id!==pl.id) pts.push(pl); }
    for(let i=1;i<pts.length;i++){const a=proj([pts[i-1].lon,pts[i-1].lat]),b=proj([pts[i].lon,pts[i].lat]); const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[0]-a[0],dy=b[1]-a[1]; const cx=mx-dy*.18,cy=my+dx*.18;
      rg.append('path').attr('class','route').attr('d',`M${a[0]},${a[1]}Q${cx},${cy} ${b[0]},${b[1]}`).attr('marker-end','url(#arr)');}
  }
  const selPl=ui.sel&&ui.sel.type==='place'?ui.sel.id:null;
  const routeSet=new Set(ui.sel&&ui.sel.type==='person'?lifeEvents(P(ui.sel.id)).map(e=>e.placeId):[]);
  const mk=svg.select('g.mks').selectAll('g.mk').data(withC,d=>d.id).join(enter=>{const g=enter.append('g').attr('class','mk'); g.append('circle'); g.append('text'); return g;});
  mk.each(function(pl){const [px,py]=proj([pl.lon,pl.lat]); this.dataset.t=`translate(${px},${py})`;})
    .attr('transform',function(){return this.dataset.t+` scale(${1/k})`;})
    .classed('sel',pl=>pl.id===selPl||routeSet.has(pl.id))
    .on('click',(e,pl)=>{e.stopPropagation(); if(ui.placing) return; select('place',pl.id);});
  mk.select('circle').attr('r',pl=>4+Math.sqrt(st[pl.id]?.n||1)*2.6);
  mk.select('text').attr('x',pl=>7+Math.sqrt(st[pl.id]?.n||1)*2.6).attr('y',4).text(pl=>pl.name);
  // centre on a requested place
  if(mapState.focusPlace){const pl=S.places[mapState.focusPlace]; mapState.focusPlace=null; if(pl&&pl.lat!=null){const [px,py]=proj([pl.lon,pl.lat]); const kk=Math.max(k,3); svg.transition().duration(600).call(mapState.zoom.transform,d3.zoomIdentity.translate(W/2+130-kk*px,H/2-kk*py).scale(kk));}}
}

export { mapState, loadWorld, placeStats, renderMap };
