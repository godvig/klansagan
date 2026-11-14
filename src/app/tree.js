/* Släktsagan · tree.js — The family tree: layout, drawing, animation and the kinship highlight. */
import { P, avatarMedia, avatarUrl, children, cropPct, fullName, homePerson, initials, lifespan, partners, placeName, sexColor, shortName } from './domain.js?v=40';
import { pickImageFor } from './media.js?v=40';
import { openPersonModal } from './modal.js?v=40';
import { openCount } from './panel.js?v=40';
import { printChart } from './print.js?v=40';
import { relation } from './relationship.js?v=40';
import { emptyState, renderAll, select, setFocus } from './router.js?v=40';
import { linkModal, treeOf, trees } from './start.js?v=40';
import { DATA_REV, HIDDEN, S, activeView, ui } from './state.js?v=40';
import { Store } from './store.js?v=40';
import { themeName } from './theme.js?v=40';
import { $, esc, toast } from './util.js?v=40';
import { hideModal } from './views.js?v=40';

/* ============ TREE ============ */
const KIN_LEVELS=['Inga','Syskon','Kusiner','Sysslingar','Tremänningar','Fyrmänningar','Femmänningar','Sexmänningar','Sjumänningar','Åttamänningar','Niomänningar'];
// Card size (big or small); the left part of a card holds a 3:4 portrait (PW×PH)
let CW=224,CH=100,PX=12,PY=10,PW=60,PH=80,MAXC=17,SMALL=false;
function setCardSize(small){SMALL=!!small; [CW,CH,PX,PY,PW,PH,MAXC]=small?[156,74,7,8,42,58,12]:[224,100,12,10,60,80,17];}

/* Tree layout: ancestors above, the focus person's row, descendants below, and side
   branches (siblings, cousins …) packed outside the direct line. Couples sit side by side. */
function treeLayout(F,showSp){
  const ROW=CH+56, SEP=20, CG=14, nodes=[], links=[];
  const W=d=>CW+((d&&d.sps)?d.sps.length:0)*(CW+CG);
  const sepF=(a,b)=>(W(a.data)+W(b.data))/2+(a.parent===b.parent?SEP:SEP*2);
  // ancestors
  const anc=(p,depth)=>{const n={p,children:[]}; if(depth<ui.ancGen){for(const rel of ['father','mother']){const q=P(p[rel+'Id']); if(q) n.children.push(anc(q,depth+1)); else if(Store.canEdit&&!p[rel+'Id']&&depth<2) n.children.push({ghost:rel,of:p.id,children:[]});}} return n;};
  const aRoot=d3.hierarchy(anc(F,0));
  // an ancestor's other partners (e.g. a father's later wife) sit on the outer side of the couple
  const ancIds=new Set(); aRoot.each(n=>{if(n.data.p) ancIds.add(n.data.p.id);});
  const taken=new Set([...ancIds,...(showSp?partners(F).map(q=>q.id):[])]);
  aRoot.each(n=>{n.data.sps=[]; if(!showSp||n.depth===0||!n.data.p) return;
    n.data.sps=partners(n.data.p).filter(q=>!taken.has(q.id)); n.data.sps.forEach(q=>taken.add(q.id));});
  d3.tree().nodeSize([1,ROW]).separation((a,b)=>(W(a.data)+W(b.data))/2+(a.parent===b.parent?18:40))(aRoot);
  const extraPos={};
  aRoot.each(n=>{n.y=-n.depth*ROW; if(n.depth===0) return; nodes.push(n);
    const sps=n.data.sps||[]; if(!sps.length) return;
    const side=n.parent.children[0]===n&&n.parent.children.length>1?-1:1, w=W(n.data);
    n.x=n.x-side*(w-CW)/2;
    sps.forEach((q,i)=>{const x=n.x+side*(i+1)*(CW+CG); const pn={data:{p:q,partner:true},x,y:n.y}; nodes.push(pn); extraPos[q.id]=pn;
      const inner=n.x+side*i*(CW+CG); links.push({type:'cp',x1:inner+side*CW/2,x2:x-side*CW/2,y:n.y,dash:i>0});});});
  // parents are drawn as a couple: a line between them, a dot in the middle, one line down to the child
  aRoot.each(n=>{ const ps=n.children||[]; if(!ps.length) return; const tgt=n.depth===0?{x:0,y:0}:n;
    if(ps.length===2){const [a,b]=ps[0].x<ps[1].x?ps:[ps[1],ps[0]]; const ghost=!a.data.p||!b.data.p;
      links.push({type:'cp',x1:a.x+CW/2,x2:b.x-CW/2,y:a.y,dash:ghost});
      links.push({type:'desc',s:{x:(a.x+b.x)/2,y:a.y,mid:true},t:tgt});}
    else links.push({type:'desc',s:{x:ps[0].x,y:ps[0].y},t:tgt}); });
  // focus partners: man to the left, woman to the right
  // Partners alternate sides (first one to the right for a man, left for a woman), so each
  // couple gets its own gap and its own junction for their children.
  const PG=CW+34;
  const parts=showSp?partners(F).sort((a,b)=>children(b.id).filter(c=>c.fatherId===F.id||c.motherId===F.id).length-children(a.id).filter(c=>c.fatherId===F.id||c.motherId===F.id).length):[];
  const pPos={}, junc={}; const sideCount={'-1':0,'1':0}; const first=F.sex==='K'?-1:1;
  parts.forEach((sp,i)=>{const side=i%2===0?first:-first; const k=++sideCount[side]; const x=side*k*PG;
    const n={data:{p:sp,partner:true},x,y:0}; nodes.push(n); pPos[sp.id]=n;
    const inner=x-side*PG; links.push({type:'cp',x1:inner+side*CW/2,x2:x-side*CW/2,y:0,dash:k>1});
    junc[sp.id]=x-side*PG/2;});
  const shown=new Set([F.id]); aRoot.each(n=>{if(n.data.p) shown.add(n.data.p.id);}); parts.forEach(q=>shown.add(q.id)); Object.keys(extraPos).forEach(id=>shown.add(id));
  // a person with partners and (step)children, down to depth maxD
  const mk=(p,dd,maxD)=>{shown.add(p.id);
    const sps=showSp?partners(p).filter(q=>!shown.has(q.id)):[]; sps.forEach(q=>shown.add(q.id));
    let kids=[]; if(dd<maxD){kids=children(p.id); if(showSp) for(const q of sps) for(const c of children(q.id)) if(!kids.includes(c)) kids.push(c);}
    kids=kids.filter(c=>!shown.has(c.id)); kids.forEach(c=>shown.add(c.id));
    return {p,sps,children:kids.map(c=>mk(c,dd+1,maxD))};};
  // place a laid-out node: couple centred on c, person card first, partners to the right
  const expand=(n,c,y)=>{const w=W(n.data); n.y=y; n.x=c-(w-CW)/2; n.spx=n.data.sps.map((q,i)=>n.x+(i+1)*(CW+CG)); nodes.push(n);
    n.data.sps.forEach((q,i)=>{nodes.push({data:{p:q,partner:true},x:n.spx[i],y}); links.push({type:'cp',x1:(i?n.spx[i-1]:n.x)+CW/2,x2:n.spx[i]-CW/2,y});});};
  // where the line down to child n starts
  const srcOf=n=>{const pn=n.parent, c=n.data.p, pp=pn.data.p;
    const own=c.fatherId===pp.id||c.motherId===pp.id, other=c.fatherId===pp.id?c.motherId:c.fatherId;
    const i=pn.data.sps.findIndex(q=>q.id===(own?other:(c.fatherId&&pn.data.sps.some(q=>q.id===c.fatherId)?c.fatherId:c.motherId)));
    if(own&&i>=0) return {x:pn.spx[i]-(CW+CG)/2,y:pn.y,mid:true};
    if(!own&&i>=0) return {x:pn.spx[i],y:pn.y};
    return {x:pn.x,y:pn.y};};
  // descendants of the focus person: one block per couple, centred under that couple's junction
  {const groups=new Map();
   if(ui.descGen>0){
     const add=(key,c)=>{if(shown.has(c.id)) return; shown.add(c.id); if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(c);};
     for(const c of children(F.id)){const other=c.fatherId===F.id?c.motherId:c.fatherId; add(other&&pPos[other]?other:'',c);}
     if(showSp) for(const q of parts) for(const c of children(q.id)) add('step:'+q.id,c);}
   const blocks=[...groups.entries()].map(([key,kids])=>{
     const q=key.startsWith('step:')?key.slice(5):key;
     const jx=key.startsWith('step:')?pPos[q].x:(q?junc[q]:0);
     const h=d3.hierarchy({root:true,sps:[],children:kids.map(c=>mk(c,1,ui.descGen))});
     d3.tree().nodeSize([1,ROW]).separation(sepF)(h);
     const bn=h.descendants().filter(n=>n.depth>0), kx=bn.filter(n=>n.depth===1).map(n=>n.x);
     return {key,jx,mid:!!q&&!key.startsWith('step:'),bn,ideal:jx-(Math.min(...kx)+Math.max(...kx))/2};
   }).sort((a,b)=>a.jx-b.jx);
   const right={};
   for(const bl of blocks){
     const ext={}; for(const n of bl.bn){const w=W(n.data); const e=ext[n.depth]||(ext[n.depth]=[n.x-w/2,n.x+w/2]); e[0]=Math.min(e[0],n.x-w/2); e[1]=Math.max(e[1],n.x+w/2);}
     let sh=bl.ideal; for(const [d,e] of Object.entries(ext)) if(right[d]!==undefined) sh=Math.max(sh,right[d]+SEP*2-e[0]);
     for(const [d,e] of Object.entries(ext)) right[d]=e[1]+sh;
     bl.sh=sh;}
   // centre the whole set of blocks under the focus row if they were pushed aside
   if(blocks.length>1){const lo=Math.min(...blocks.map(b=>b.sh+Math.min(...b.bn.filter(n=>n.depth===1).map(n=>n.x)))), hi=Math.max(...blocks.map(b=>b.sh+Math.max(...b.bn.filter(n=>n.depth===1).map(n=>n.x))));
     const jlo=Math.min(...blocks.map(b=>b.jx)), jhi=Math.max(...blocks.map(b=>b.jx)); const adj=((jlo+jhi)/2)-((lo+hi)/2);
     const can=blocks.every(b=>Math.abs(b.sh+adj-b.ideal)<=Math.abs(b.sh-b.ideal)+Math.abs(adj)); if(can) blocks.forEach(b=>b.sh+=adj);}
   for(const bl of blocks){
     for(const n of bl.bn){ expand(n,n.x+bl.sh,n.depth*ROW);
       if(n.depth===1) links.push({type:'desc',s:{x:bl.jx,y:0,mid:bl.mid},t:n,fam:'f:'+bl.key});
       else links.push({type:'desc',s:srcOf(n),t:n}); }}}
  // side branches. Siblings may bring their descendants; further out, branches stop at the focus's generation.
  {const occ={}, GAPX=SEP*2;
   const occAdd=(r,l,rr)=>{const o=occ[r]||(occ[r]=[l,rr]); if(l<o[0]) o[0]=l; if(rr>o[1]) o[1]=rr;};
   for(const n of nodes) occAdd(Math.round(n.y/ROW),n.x-CW/2,n.x+CW/2); occAdd(0,-CW/2,CW/2);
   const sideDefault=parts.some(q=>!(q.sex==='M'&&F.sex!=='M'))?-1:1;
   const lim=Math.min(ui.kinDeg,ui.ancGen);
   const groups=[]; aRoot.each(n=>{ if(n.depth>=1&&n.depth<=lim&&n.data.p){ let g0=groups.find(g=>g.child===n.parent); if(!g0){g0={child:n.parent,d:n.depth,par:[]}; groups.push(g0);} g0.par.push(n);} });
   groups.sort((a,b)=>a.d-b.d);
   for(const g0 of groups){
     const pos={}; for(const n of g0.par) pos[n.data.p.id]=n;
     const kids=[]; for(const n of g0.par) for(const c of children(n.data.p.id)) if(!shown.has(c.id)&&!kids.includes(c)) kids.push(c);
     if(!kids.length) continue; kids.forEach(c=>shown.add(c.id));
     const xs=g0.par.map(n=>n.x), mxAll=xs.reduce((a,b)=>a+b,0)/xs.length, py=g0.par[0].y;
     const maxD=g0.d===1?1+ui.descGen:g0.d;
     // one block per parent couple (full siblings, half-siblings via each partner …), each next to its own junction
     const jOf=c=>{const fa=pos[c.fatherId]||extraPos[c.fatherId], mo=pos[c.motherId]||extraPos[c.motherId]; return fa&&mo?(fa.x+mo.x)/2:(fa||mo).x;};
     const parts2=new Map(); for(const c of kids){const k=(c.fatherId||'')+'|'+(c.motherId||''); if(!parts2.has(k)) parts2.set(k,[]); parts2.get(k).push(c);}
     const blocks=[...parts2.values()].sort((a,b)=>Math.abs(jOf(a[0]))-Math.abs(jOf(b[0])));
     for(const bk of blocks){
     const mx=jOf(bk[0]);
     const dir=g0.d===1?(mx<-CW/2?-1:mx>CW/2?1:(mxAll<-1?-1:mxAll>1?1:sideDefault)):(mxAll<-1?-1:mxAll>1?1:sideDefault);
     const block=d3.hierarchy({root:true,sps:[],children:bk.map(k=>mk(k,1,maxD))});
     d3.tree().nodeSize([1,ROW]).separation(sepF)(block);
     const bn=block.descendants().filter(n=>n.depth>0);
     const ext={}; for(const n of bn){const r=Math.round(py/ROW)+n.depth, w=W(n.data); const e=ext[r]||(ext[r]=[n.x-w/2,n.x+w/2]); if(n.x-w/2<e[0]) e[0]=n.x-w/2; if(n.x+w/2>e[1]) e[1]=n.x+w/2;}
     const kx=bn.filter(n=>n.depth===1).map(n=>n.x); let sh=mx-(Math.min(...kx)+Math.max(...kx))/2;
     for(const [r,e] of Object.entries(ext)){const o=occ[r]; if(!o) continue;
       if(dir<0) sh=Math.min(sh,o[0]-GAPX-e[1]); else sh=Math.max(sh,o[1]+GAPX-e[0]);}
     for(const n of bn){ expand(n,n.x+sh,py+n.depth*ROW); const w=W(n.data); occAdd(Math.round(n.y/ROW),n.x-CW/2,n.x-CW/2+w);
       if(n.depth===1){const fa=pos[n.data.p.fatherId]||extraPos[n.data.p.fatherId], mo=pos[n.data.p.motherId]||extraPos[n.data.p.motherId];
         const q=fa&&mo?{x:(fa.x+mo.x)/2,y:py,mid:true}:{x:(fa||mo).x,y:py}; links.push({type:'desc',s:q,t:n});}
       else links.push({type:'desc',s:srcOf(n),t:n}); }
     }
   }}
  nodes.push({data:{p:F},x:0,y:0,focus:true});
  // give each family its own lane in the gap between two rows, so lines never merge
  {const G=new Map();
   for(const l of links){ if(l.type==='cp') continue;
     if(l.type==='dot') continue;
    const top=l.type==='anc'?l.t.y:l.s.y, key=l.type==='anc'?l.s:(l.s.x+'|'+l.s.y);
     let g=G.get(key); if(!g){g={top,lo:Infinity,hi:-Infinity,ls:[]}; G.set(key,g);}
     g.lo=Math.min(g.lo,l.s.x,l.t.x); g.hi=Math.max(g.hi,l.s.x,l.t.x); g.ls.push(l);}
   const byGap={}; for(const g of G.values()) (byGap[g.top]=byGap[g.top]||[]).push(g);
   for(const gs of Object.values(byGap)){ gs.sort((a,b)=>a.lo-b.lo); const lanes=[];
     for(const g of gs){let i=lanes.findIndex(r=>r<g.lo-14); if(i<0){i=lanes.length; lanes.push(0);} lanes[i]=g.hi; g.lane=i;}
     const nL=lanes.length, step=nL>1?Math.min(13,(ROW-CH-12)/(nL-1)):0;
     // colour a family's lines only where they run alongside another family's
     let ci=0; for(const g of gs){const crowd=gs.some(o=>o!==g&&o.lo<g.hi+30&&o.hi>g.lo-30); const f=crowd?(ci++%5)+1:0; for(const l of g.ls) l.fam=f;}
     for(const g of gs){const my=g.top+ROW/2+(g.lane-(nL-1)/2)*step; for(const l of g.ls) l.my=my;}}}
  // junction dots where a couple's line to their children starts
  const dots=new Map(); for(const l of links) if(l.type==='desc'&&l.s.mid) dots.set(l.s.x+'|'+l.s.y,{x:l.s.x,y:l.s.y,fam:l.fam});
  links.push(...[...dots.values()].map(d=>({type:'dot',...d})));
  return {nodes,links,aRoot};
}
let treeZoom=null;
/** Zoom the tree onto a person. If they aren't in the current tree, rebuild it around them (unless locked). */
/* Locked tree, step 2: someone outside the locked tree was picked (from search, the panel or a link).
   Instead of rebuilding the tree around them, grow it – more generations, wider side branches or
   partners, same focus – until they are in it. The new branch glides in; the old view is one click away. */
function growLockedTree(id){
  const F=P(ui.focus); if(!F||!P(id)) return null;
  const was={ancGen:ui.ancGen,descGen:ui.descGen,kinDeg:ui.kinDeg,showPartners:ui.showPartners};
  const rel=relation(F.id,id), r=rel&&rel.r;
  let a=ui.ancGen, d=ui.descGen, k=ui.kinDeg, sp=ui.showPartners!==false;
  if(r){ a=Math.max(a,Math.min(10,r.a)); d=Math.max(d,Math.min(10,r.b-r.a)); k=Math.max(k,Math.min(KIN_LEVELS.length-1,r.a,r.b)); }
  if(rel&&(rel.kind==='inlaw'||rel.kind==='partner')) sp=true;
  const fits=()=>{ Object.assign(ui,{ancGen:a,descGen:d,kinDeg:k,showPartners:sp}); return treeLayout(F,sp).nodes.some(n=>n.data.p&&n.data.p.id===id); };
  let ok=false;
  for(let i=0;i<16;i++){ if(fits()){ok=true; break;}
    if(!sp) sp=true; else if(k<Math.min(a,KIN_LEVELS.length-1)) k++; else if(a<10) a++; else if(d<10) d++; else break; }
  if(!ok){ Object.assign(ui,was); return null; }
  const ch=[]; if(a!==was.ancGen) ch.push(`anor ${was.ancGen} → ${a}`); if(d!==was.descGen) ch.push(`ättlingar ${was.descGen} → ${d}`);
  if(k!==was.kinDeg) ch.push(`sidogrenar ${KIN_LEVELS[was.kinDeg].toLowerCase()} → ${KIN_LEVELS[k].toLowerCase()}`); if(sp&&was.showPartners===false) ch.push('partner visas');
  return {was,changes:ch};
}
function reachInLockedTree(id){
  const name=fullName(P(id)), g=growLockedTree(id);
  if(!g){ toast(`${name} är inte släkt med ${shortName(P(ui.focus))} på ett sätt som ryms i trädet.`,7000,{label:'Bygg om runt '+shortName(P(id)),fn:()=>{ui.treeLock=false; setFocus(id); ui.treeKey=null; select('person',id); renderAll();}}); select('person',id); return; }
  // keep the focus card where it is while the tree grows, then glide over to the new person
  const pos=ui.treePos&&ui.treePos.get(ui.focus), el0=$('#treeSvg');
  if(pos&&el0){ const t=d3.zoomTransform(el0); ui.treeAnchor={x:t.applyX(pos.x),y:t.applyY(pos.y),k:t.k}; }
  ui.treeKey=null; select('person',id);
  setTimeout(()=>{ const p2=ui.treePos&&ui.treePos.get(id); if(p2) treeGoTo(id); },750);
  toast(`Trädet växte så att ${name} syns${g.changes.length?' ('+g.changes.join(', ')+')':''}.`,7000,{label:'Ångra',fn:()=>{Object.assign(ui,g.was); ui.treeKey=null; renderAll();}});
}
function treeGoTo(id){
  if(!id||!P(id)) return;
  const pos=ui.treePos&&ui.treePos.get(id);
  if(!pos){ if(ui.treeLock){ reachInLockedTree(id); return; }
    setFocus(id); ui.treeKey=null; ui.treeZoomTo=id; select('person',id); return; }
  const el0=$('#treeSvg'), t=d3.zoomTransform(el0), k=Math.max(t.k,.95), W=el0.clientWidth, H=el0.clientHeight;
  d3.select(el0).transition().duration(450).call(treeZoom.transform,d3.zoomIdentity.translate(W/2-pos.x*k,(H+50)/2-pos.y*k).scale(k));
  if(!(ui.sel&&ui.sel.id===id)) select('person',id);
}
function renderTree(fresh){
  const v=$('#view');
  if(!Object.keys(S.persons).length){v.innerHTML=emptyState();ui.treeKey=null;return;}
  const F=P(ui.focus);
  if(!$('#treeSvg')||fresh){
    v.innerHTML=`<div id="treeWrap"><svg id="treeSvg"><defs><clipPath id="avclip"><rect x="12" y="10" width="60" height="80" rx="6"/></clipPath></defs><g class="vp"></g></svg>
      <div class="tree-tools tt-tree">
        <span class="fname" id="tfName"></span>
        <button class="btn sm mob-only" id="tOpts" aria-expanded="false">Visa ▾</button>
        <span id="tTrees" class="ctl"></span>
        <span class="ctl">Anor <select id="tAnc">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option ${n===ui.ancGen?'selected':''}>${n}</option>`).join('')}</select></span>
        <span class="ctl">Ättlingar <select id="tDesc">${[0,1,2,3,4,5,6,7,8,9,10].map(n=>`<option ${n===ui.descGen?'selected':''}>${n}</option>`).join('')}</select></span>
        <span class="ctl" title="Hur långt ut åt sidan trädet ska visa släktingar">Sidogrenar <select id="tKin">${KIN_LEVELS.map((t,n)=>`<option value="${n}" ${n===ui.kinDeg?'selected':''}>${t}</option>`).join('')}</select></span>
        <label class="ctl chk" title="Visa makar och sambor, och deras barn"><input type="checkbox" id="tSp" ${ui.showPartners!==false?'checked':''}> Partner</label>
        <span class="ctl" title="Små kort får plats med fler personer">Kort <select id="tSize">${[['auto','Auto'],['big','Stora'],['small','Små']].map(([v,t])=>`<option value="${v}" ${v===(ui.cardSize||'auto')?'selected':''}>${t}</option>`).join('')}</select></span>
        <button class="btn sm" id="tLock"></button>
        <button class="btn sm" id="tMe" title="Zooma in på dig">★ Jag</button>
        <button class="btn sm" id="tSel" title="Zooma in på den markerade personen">⌖ Markerad</button>
        <button class="btn sm" id="tFit" title="Visa hela trädet">Visa hela</button>
        <button class="btn sm" id="tPrint">⎙ Skriv ut / spara</button>
        ${Store.canEdit?'<button class="btn sm primary" onclick="openPersonModal()">+ Person</button>':''}
        <span id="tView"></span>
      </div></div>`;
    $('#tAnc').onchange=e=>{ui.ancGen=+e.target.value;ui.treeKey=null;renderTree();};
    $('#tDesc').onchange=e=>{ui.descGen=+e.target.value;ui.treeKey=null;renderTree();};
    $('#tKin').onchange=e=>{ui.kinDeg=+e.target.value;ui.treeKey=null;renderTree();};
    $('#tFit').onclick=()=>{ui.treeKey=null;renderTree();};
    $('#tSp').onchange=e=>{ui.showPartners=e.target.checked;ui.treeKey=null;renderTree();};
    $('#tSize').onchange=e=>{ui.cardSize=e.target.value;ui.treeKey=null;renderTree();};
    $('#tMe').onclick=()=>{const h=homePerson(); if(!h){toast('Välj vem du är under Inställningar eller med ”Det här är jag” på ditt personkort.',5000);return;} treeGoTo(h.id);};
    $('#tSel').onclick=()=>{const id=ui.sel&&ui.sel.type==='person'?ui.sel.id:ui.focus; treeGoTo(id);};
    $('#tfName').onclick=()=>treeGoTo(ui.focus);
    $('#tOpts').onclick=e=>{const tt=e.target.closest('.tree-tools'); const o=tt.classList.toggle('open'); e.target.setAttribute('aria-expanded',o); e.target.textContent=o?'Stäng ▴':'Visa ▾';};
    $('#tLock').onclick=()=>{ui.treeLock=!ui.treeLock; toast(ui.treeLock?'Trädet är låst. Klicka på vem du vill och läs – trädet står kvar.':'Trädet är upplåst. Ett klick på en person bygger om trädet kring den personen.',4500); renderTree();};
    $('#tPrint').onclick=()=>printChart($('#treeSvg'),'Släktträd för '+fullName(P(ui.focus)),'slaktsagan-tree',{book:true});
    const svg=d3.select('#treeSvg');
    treeZoom=d3.zoom().scaleExtent([.15,2.5]).on('zoom',e=>svg.select('g.vp').attr('transform',e.transform));
    svg.call(treeZoom).on('dblclick.zoom',null);
    ui.treeKey=null;
  }
  $('#tfName').textContent=fullName(F);
  // the settings can change from elsewhere (a locked tree growing, the kinship path), so the controls follow ui
  {const set=(sel,v)=>{const el=$(sel); if(el&&el.value!==String(v)) el.value=String(v);}; set('#tAnc',ui.ancGen); set('#tDesc',ui.descGen); set('#tKin',ui.kinDeg); const sp=$('#tSp'); if(sp) sp.checked=ui.showPartners!==false;}
  {const lb=$('#tLock'); lb.textContent=ui.treeLock?'🔒 Låst':'🔓 Lås trädet'; lb.classList.toggle('primary',!!ui.treeLock); lb.title=ui.treeLock?'Trädet står kvar när du klickar på en person. Klicka för att låsa upp.':'Lås trädet så att det står kvar när du klickar på andra personer';
   $('#treeWrap').classList.toggle('locked',!!ui.treeLock);}
  {const ts=trees(), cur=treeOf(F.id); const opts=ts.filter(t=>t.size>1||t===cur);
   $('#tTrees').innerHTML=ts.length>1?`<select id="tTreeSel" title="Byt släktträd">${opts.map(t=>`<option value="${t.root.id}" ${t===cur?'selected':''}>${esc(t.name)} (${t.size})</option>`).join('')}</select>${Store.canEdit?'<button class="btn sm" id="tLink">🔗 Koppla ihop</button>':''}`:'';
   const sel=$('#tTreeSel'); if(sel) sel.onchange=()=>{setFocus(sel.value); ui.treeKey=null; renderAll(true);};
   const lk=$('#tLink'); if(lk) lk.onclick=()=>linkModal(ui.focus);}
  const av0=activeView(); $('#tView').innerHTML=av0?`<span class="vchip">Vy: <b>${esc(av0.name)}</b> · ${HIDDEN.size} dolda <button class="btn sm ghost" onclick="setActiveView(null)">Visa alla</button></span>`:'';
  const svg=d3.select('#treeSvg'), g=svg.select('g.vp');
  const showSp=ui.showPartners!==false;
  // Nothing in the tree changed (only the selection, or the panel): mark the selected card and move the camera, no redraw.
  if(ui.relHL&&!ui.relHL.n) ui.relHL.n=ui.relHLn=(ui.relHLn||0)+1;
  const sig=[F&&F.id,ui.ancGen,ui.descGen,ui.kinDeg,showSp,ui.cardSize,ui.nameMode,ui.relHL?ui.relHL.n:0,DATA_REV,Store.canEdit,themeName(),$('#treeSvg').clientWidth>700].join('|');
  if(!fresh&&ui.treeSig===sig&&ui.treeKey!=null&&!ui.treeAnchor&&ui.treePos&&!g.select('g[data-k]').empty()){
    const sel0=ui.sel&&ui.sel.type==='person'?ui.sel.id:null;
    g.selectAll('g.card').classed('sel',function(){return this.getAttribute('data-k')===sel0;});
    if(ui.treePan){const n=ui.treePos.get(ui.treePan); ui.treePan=null;
      if(n){const el0=svg.node(), t=d3.zoomTransform(el0); svg.transition().duration(400).call(treeZoom.transform,d3.zoomIdentity.translate(el0.clientWidth/2-n.x*t.k,el0.clientHeight/2-n.y*t.k).scale(t.k));}}
    if(ui.treeZoomTo){const id=ui.treeZoomTo; ui.treeZoomTo=null; setTimeout(()=>treeGoTo(id),0);}
    return;
  }
  ui.treeSig=sig;
  setCardSize(ui.cardSize==='small'); let LY=treeLayout(F,showSp);
  if((ui.cardSize||'auto')==='auto'&&LY.nodes.length>40){setCardSize(true); LY=treeLayout(F,showSp);}
  const {nodes,links,aRoot}=LY;
  svg.select('#avclip rect').attr('x',PX).attr('y',PY).attr('width',PW).attr('height',PH);
  svg.classed('small',SMALL);

  // links
  const lp=l=>{
    if(l.type==='cp') return `M${l.x1},${l.y}H${l.x2}`;
    if(l.type==='dot') return `M${l.x-4},${l.y}a4,4 0 1,0 8,0a4,4 0 1,0 -8,0`;
    if(l.type==='anc') return `M${l.s.x},${l.s.y-CH/2}V${l.my}H${l.t.x}V${l.t.y+CH/2}`;
    return `M${l.s.x},${l.s.mid?l.s.y:l.s.y+CH/2}V${l.my}H${l.t.x}V${l.t.y-CH/2}`;
  };
  // Animation (FLIP): remember where every card is drawn right now, mid-glide included,
  // so the new layout can start each card there and let it slide to its new place.
  const nodeKey=n=>n.data.ghost?'g:'+n.data.ghost+':'+n.data.of:n.data.p.id;
  const ANIM=!fresh&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches), DUR=650;
  const was=new Map(), keys=new Set(nodes.map(nodeKey));
  g.selectAll('g[data-k]').each(function(){const k=this.getAttribute('data-k'); const m=/translate\(([-\d.e]+),\s*([-\d.e]+)\)/.exec(this.getAttribute('transform')||''); if(k&&m&&!was.has(k)) was.set(k,{x:+m[1]+CW/2,y:+m[2]+CH/2});});
  const exitEls=ANIM?g.selectAll('g[data-k]').interrupt('glide').filter(function(){return !keys.has(this.getAttribute('data-k'));}).nodes():[];
  const t0=d3.zoomTransform(svg.node());
  // Focus moved to someone already on screen (search, side panel): keep them where they are and let the tree rearrange around them.
  if(ANIM&&!ui.treeAnchor&&ui.treeFocusWas&&ui.treeFocusWas!==F.id&&was.has(F.id)){const o=was.get(F.id), sx=t0.applyX(o.x), sy=t0.applyY(o.y), el0=svg.node();
    if(sx>40&&sy>60&&sx<el0.clientWidth-40&&sy<el0.clientHeight-40){ui.treeAnchor={x:sx,y:sy,k:t0.k}; ui.treeKey=null;}}
  ui.treeFocusWas=F.id;
  // Shift between old and new coordinates: the focus person stays put on screen.
  const fNew=nodes.find(n=>n.focus), fOld=fNew&&was.get(nodeKey(fNew));
  const anchored=ANIM&&!!ui.treeAnchor&&!!fOld;
  const dx=fOld&&anchored?fNew.x-fOld.x:0, dy=fOld&&anchored?fNew.y-fOld.y:0;
  const moving=ANIM&&was.size>0&&(anchored||!ui.treeAnchor);
  g.selectAll('*').remove();
  // generation labels
  for(let d=1; d<=ui.ancGen; d++){ if(aRoot.descendants().some(n=>n.depth===d&&n.data.p)){ const xs=aRoot.descendants().filter(n=>n.depth===d).map(n=>n.x); g.append('text').attr('class','gen-label').attr('x',Math.min(...xs)-CW/2).attr('y',-d*(CH+56)-CH/2-8).text(['','Föräldrar','Farföräldrar & morföräldrar','Farfars- och morfarsföräldrar','Generation 4','Generation 5','Generation 6'][d]||('Generation '+d)); } }
  const linkSel=g.selectAll('path.link').data(links).join('path').attr('class',l=>'link'+(l.type==='cp'?' sp'+(l.dash?' far':''):'')+(l.type==='dot'?' dot':'')+(l.fam?' fam'+l.fam:'')).attr('d',lp);
  const sel=ui.sel&&ui.sel.type==='person'?ui.sel.id:null;
  const HL=ui.relHL&&nodes.some(n=>n.data.p&&n.data.p.id===ui.relHL.a)&&nodes.some(n=>n.data.p&&n.data.p.id===ui.relHL.b)?ui.relHL:null;
  svg.classed('relhl',!!HL);
  if(HL){ // links on the chain: a child on the path hangs from its parents on the path; couple lines between two lit cards
    const lit=nodes.filter(n=>n.data.p&&HL.ids.has(n.data.p.id)), litAt=(x,y)=>lit.some(n=>Math.abs(n.y-y)<2&&(Math.abs(n.x+CW/2-x)<2||Math.abs(n.x-CW/2-x)<2));
    const srcs=[];
    linkSel.classed('hl',l=>{
      if(l.type==='desc'||l.type==='anc'){const c=l.type==='desc'?l.t:l.s, q=l.type==='desc'?l.s:l.t, cid=c.data&&c.data.p&&c.data.p.id;
        if(!cid||!HL.ids.has(cid)||HL.commons.has(cid)&&l.type==='desc') return false;
        if(l.type==='anc'){const pid=q.data&&q.data.p&&q.data.p.id; return !!pid&&HL.ids.has(pid);}
        srcs.push(q); return true;}
      if(l.type==='cp') return litAt(l.x1,l.y)&&litAt(l.x2,l.y);
      return false;});
    linkSel.filter(l=>l.type==='dot').classed('hl',l=>srcs.some(q=>Math.abs(q.x-l.x)<2&&Math.abs(q.y-l.y)<2));
  }
  {let bn=$('#relBanner'); if(HL){ if(!bn){bn=document.createElement('div'); bn.id='relBanner'; $('#treeWrap').appendChild(bn);}
      bn.innerHTML=`<span>🔗 ${esc(HL.label)}</span><button class="btn sm" id="relBack">Tillbaka</button><button class="iconbtn" id="relOff" title="Sluta markera" aria-label="Sluta markera">×</button>`;
      $('#relOff').onclick=()=>{ui.relHL=null; renderTree();}; $('#relBack').onclick=()=>{ui.relHL=null; location.hash='slaktskap';};}
    else if(bn) bn.remove(); if(!HL) ui.relHL=null;}
  const cards=g.selectAll('g.node').data(nodes).join('g').attr('data-k',nodeKey).attr('transform',n=>`translate(${n.x-CW/2},${n.y-CH/2})`);
  cards.each(function(n){
    const el=d3.select(this), d=n.data;
    if(d.ghost){
      el.attr('class','ghost');
      el.append('rect').attr('width',CW).attr('height',CH).attr('rx',9);
      el.append('text').attr('x',CW/2).attr('y',CH/2+4).attr('text-anchor','middle').text('+ Lägg till '+(d.ghost==='father'?'far':'mor'));
      el.on('click',()=>openPersonModal(null,{rel:d.ghost,of:d.of}));
      return;
    }
    const p=d.p;
    el.attr('class','card'+(n.focus?' focus':'')+(sel===p.id?' sel':'')+(HL&&HL.ids.has(p.id)?' hl'+(p.id===HL.a||p.id===HL.b?' hl-end':''):''));
    el.append('rect').attr('class','bg').attr('width',CW).attr('height',CH).attr('rx',9);
    el.append('rect').attr('width',5).attr('height',CH-16).attr('x',0).attr('y',8).attr('rx',2).style('fill',sexColor(p));
    const av=avatarUrl(p), tx=PX+PW+(SMALL?8:12), maxc=MAXC, LH=SMALL?13:16, Y0=SMALL?20:28;
    if(av){const c=cropPct(avatarMedia(p),PW/PH), im=el.append('image').attr('href',av).attr('clip-path','url(#avclip)');
      if(c) im.attr('x',PX+c.l/100*PW).attr('y',PY+c.t/100*PH).attr('width',c.w/100*PW).attr('height',c.h/100*PH).attr('preserveAspectRatio','none');
      else im.attr('x',PX).attr('y',PY).attr('width',PW).attr('height',PH).attr('preserveAspectRatio','xMidYMin slice');}
    else{const ph=el.append('g').attr('class','ph-slot'+(Store.canEdit?' can':''));
      ph.append('rect').attr('x',PX).attr('y',PY).attr('width',PW).attr('height',PH).attr('rx',6);
      ph.append('text').attr('class','ini').attr('x',PX+PW/2).attr('y',PY+PH/2+2).attr('text-anchor','middle').text(initials(p));
      if(Store.canEdit){ph.append('text').attr('class','add').attr('x',PX+PW/2).attr('y',PY+PH-9).attr('text-anchor','middle').text('+ bild');
        ph.append('title').text('Lägg till en bild');
        ph.on('click',ev=>{ev.stopPropagation(); pickImageFor(p.id);});}}
    const nm=fullName(p), words=nm.split(' '), lines=['']; for(const w of words){const cur=lines[lines.length-1]; if(cur&&(cur+' '+w).length>maxc){if(lines.length===2){lines[1]+=' '+w; continue;} lines.push(w);} else lines[lines.length-1]=cur?cur+' '+w:w;}
    const L=lines.map(l=>l.length>maxc+1?l.slice(0,maxc)+'…':l);
    const t0=el.append('text').attr('class','nm').attr('x',tx).attr('y',Y0); L.forEach((l,i)=>t0.append('tspan').attr('x',tx).attr('dy',i?LH:0).text(l)); t0.append('title').text(nm);
    const yy=Y0+(L.length-1)*LH;
    el.append('text').attr('class','yr').attr('x',tx).attr('y',yy+(SMALL?15:20)).text(lifespan(p)||'år okänt');
    const pl=placeName(p.birthPlace)||p.occupation||''; el.append('text').attr('class','pl').attr('x',tx).attr('y',yy+(SMALL?28:37)).text(pl.length>maxc+3?pl.slice(0,maxc+2)+'…':pl);
    const nc=(p.citations||[]).length; if(!nc){el.append('circle').attr('cx',CW-11).attr('cy',11).attr('r',3.5).style('fill','var(--warn)').append('title').text('Ingen källa ännu');}
    {const oq=openCount(p.id); if(oq){const g=el.append('g').attr('class','qbadge').attr('transform',`translate(${CW-(nc?13:26)},${CH-15})`);
      g.append('path').attr('d','M-8 -6h16a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-9l-4 3v-3h-3a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z');
      g.append('text').attr('x',0).attr('y',3).attr('text-anchor','middle').text(oq>9?'9+':oq); g.append('title').text(oq===1?'1 öppen fråga':oq+' öppna frågor');}}
    if(Store.canEdit){const eg=el.append('g').attr('class','eye').attr('transform',`translate(${CW-(SMALL?26:30)},${CH-(SMALL?24:26)})`); eg.append('rect').attr('width',22).attr('height',20).attr('rx',5);
      eg.append('path').attr('d','M4 10s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zM4 4l14 12').attr('transform','translate(0,0)');
      eg.append('title').text('Dölj i vyn…'); eg.on('click',ev=>{ev.stopPropagation(); hideModal(p);});}
    el.on('click',()=>{ if(n.focus){select('person',p.id);} else if(ui.treeLock){ui.treePan=p.id; select('person',p.id);} else { const t=d3.zoomTransform($('#treeSvg')); ui.treeAnchor={x:t.applyX(n.x),y:t.applyY(n.y),k:t.k}; setFocus(p.id); ui.treeKey=null; select('person',p.id);} });
  });
  if(moving){
    const ease=d3.easeCubicInOut, labels=g.selectAll('text.gen-label'); let changed=exitEls.length>0;
    cards.each(function(n){const o=was.get(nodeKey(n)), el=d3.select(this);
      if(o){const sx=o.x+dx, sy=o.y+dy; if(Math.abs(sx-n.x)+Math.abs(sy-n.y)<1) return; changed=true;
        el.attr('transform',`translate(${sx-CW/2},${sy-CH/2})`).transition('glide').duration(DUR).ease(ease).attr('transform',`translate(${n.x-CW/2},${n.y-CH/2})`);}
      else {changed=true; el.style('opacity',0).transition('glide').delay(DUR*.55).duration(DUR*.6).style('opacity',1).on('end interrupt',function(){this.style.opacity='';});}});
    if(changed){ linkSel.style('opacity',0).transition('glide').delay(DUR*.7).duration(DUR*.5).style('opacity',null);
    labels.style('opacity',0).transition('glide').delay(DUR*.7).duration(DUR*.5).style('opacity',null);
    // cards that leave the view fade out where they were
    const ex=g.insert('g',':first-child').attr('class','exiting').attr('pointer-events','none');
    for(const el of exitEls){const m=/translate\(([-\d.e]+),\s*([-\d.e]+)\)/.exec(el.getAttribute('transform')||''); if(!m) continue;
      el.setAttribute('transform',`translate(${+m[1]+dx},${+m[2]+dy})`); ex.node().appendChild(el);}
    ex.transition('glide').duration(DUR*.45).style('opacity',0).remove();
    }
  }
  // locked tree: only the camera moves, to the person that was clicked
  ui.treeShown=new Set(nodes.filter(n=>n.data&&n.data.p).map(n=>n.data.p.id));
  ui.treePos=new Map(nodes.filter(n=>n.data&&n.data.p).map(n=>[n.data.p.id,{x:n.x,y:n.y}]));
  if(ui.treePan){const n=nodes.find(x=>x.data&&x.data.p&&x.data.p.id===ui.treePan); ui.treePan=null;
    if(n){const el0=$('#treeSvg'), t=d3.zoomTransform(el0), W=el0.clientWidth, H=el0.clientHeight;
      svg.transition().duration(400).call(treeZoom.transform,d3.zoomIdentity.translate(W/2-n.x*t.k,H/2-n.y*t.k).scale(t.k));}}
  // fit
  const key=[F.id,ui.ancGen,ui.descGen,ui.kinDeg,showSp,SMALL].join('|');
  if(ui.treeKey!==key&&ui.treeAnchor){
    ui.treeKey=key; const a=ui.treeAnchor; ui.treeAnchor=null;
    const at=d3.zoomIdentity.translate(a.x-(fNew?fNew.x*a.k:0),a.y-(fNew?fNew.y*a.k:0)).scale(a.k);
    if(anchored){ svg.interrupt().call(treeZoom.transform,at);
      // after the glide: if the person ended up near an edge, ease them towards the middle
      const el0=svg.node(), W=el0.clientWidth, H=el0.clientHeight, fx=at.applyX(fNew.x), fy=at.applyY(fNew.y);
      if(fx<W*.28||fx>W*.72||fy<H*.25||fy>H*.75){const tx=Math.max(W*.3,Math.min(W*.7,fx)), ty=Math.max(H*.3,Math.min(H*.7,fy));
        svg.transition().delay(DUR*.85).duration(550).ease(d3.easeCubicInOut).call(treeZoom.transform,d3.zoomIdentity.translate(at.x+(tx-fx),at.y+(ty-fy)).scale(at.k));}}
    else svg.transition().duration(350).call(treeZoom.transform,at);
  }
  if(ui.treeKey!==key){
    ui.treeKey=key;
    const W=$('#treeSvg').clientWidth,H=$('#treeSvg').clientHeight;
    const fitN=HL?nodes.filter(n=>n.data.p&&HL.ids.has(n.data.p.id)):nodes;
    const xs=fitN.map(n=>n.x),ys=fitN.map(n=>n.y);
    const x0=Math.min(...xs)-CW/2-30,x1=Math.max(...xs)+CW/2+30,y0=Math.min(...ys)-CH/2-40,y1=Math.max(...ys)+CH/2+30;
    let k=Math.min(1.05,Math.min(W/(x1-x0),(H-60)/(y1-y0)));
    let cx=(x0+x1)/2, cy=(y0+y1)/2;
    if(HL) k=Math.max(k,W<700?.16:.3);
    else if(k<(ui.simple?.85:.6)){k=ui.simple?.85:.6; cx=Math.max(x0+W/(2*k),Math.min(x1-W/(2*k),CW)); cy=Math.max(y0+(H-60)/(2*k),Math.min(y1-(H-60)/(2*k),0));}
    const t=d3.zoomIdentity.translate(W/2-k*cx,(H+50)/2-k*cy).scale(k);
    svg.transition().duration(fresh?0:450).call(treeZoom.transform,t);
  }
  if(ui.treeZoomTo){const id=ui.treeZoomTo; ui.treeZoomTo=null; setTimeout(()=>treeGoTo(id),fresh?0:470);}
}

export { growLockedTree, reachInLockedTree, KIN_LEVELS, CW, CH, PX, PY, PW, PH, MAXC, SMALL, setCardSize, treeLayout, treeZoom, treeGoTo, renderTree };
