/* Släktsagan · util.js — Small helpers: DOM, escaping, ids, dates, toasts. */
import { P } from './domain.js?v=44';
import { ALL } from './state.js?v=44';

/* Släktsagan — app shell. Storage keys keep the old 'klansagan-' prefix so saved and shared trees keep working. Pure logic lives in src/core.js (window.KinCore). */
const {yearOf,dateKey,MONTHS,fmtDate,whenText,gedDate,genitive,slugify,parseDelimited,nrm,lev,dupScore}=window.KinCore;
const computeHidden=v=>KinCore.computeHidden(ALL.persons,v);
const blood=(a,b)=>KinCore.blood(a,b,P);
const bloodTerm=(r,aId,bId)=>KinCore.bloodTerm(r,bId,P);
const sx=(id,m,f,n)=>{const p=P(id); return p&&p.sex==='M'?m:p&&p.sex==='K'?f:n;};
/* ============ Helpers ============ */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>p+'_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
const norm=s=>String(s??'').toLowerCase().normalize('NFC').replace(/\s+/g,' ').trim();
const clone=o=>JSON.parse(JSON.stringify(o));
const NOW_Y=new Date().getFullYear();
function toast(msg,ms=2600,action){document.querySelectorAll('.toast').forEach(o=>o.remove());const t=document.createElement('div');t.className='toast';const sp=document.createElement('span');sp.textContent=msg;t.appendChild(sp);
  if(action){const b=document.createElement('button');b.className='toast-btn';b.textContent=action.label;b.onclick=()=>{t.remove();action.fn();};t.appendChild(b);}
  document.body.appendChild(t);setTimeout(()=>t.remove(),ms)}

const EVENT_TYPES=['Dop','Konfirmation','Vigsel','Kröning','Skilsmässa','Flytt','Bosatt','Yrke','Militärtjänst','Utvandring','Invandring','Begravning','Bouppteckning','Fotografi','Övrigt'];
const SOURCE_TYPES=['Husförhörslängd','Församlingsbok','Födelse- och dopbok','Lysnings- och vigselbok','Död- och begravningsbok','Flyttlängd','Bouppteckning','Folkräkning','Mantalslängd','Generalmönsterrulla','Emigrantregister','Passagerarlista','Domstolsprotokoll','Fotografi','Brev','Muntlig uppgift','Webbplats','Övrigt'];
const HIST=[
  {a:1520,b:1520,t:'Stockholms blodbad'},
  {a:1527,b:1527,t:'Reformationen inleds (Västerås riksdag)'},
  {a:1542,b:1543,t:'Dackefejden'},
  {a:1563,b:1570,t:'Nordiska sjuårskriget'},
  {a:1618,b:1648,t:'Trettioåriga kriget'},
  {a:1628,b:1628,t:'Regalskeppet Vasa sjunker'},
  {a:1686,b:1686,t:'Kyrkolagen – kyrkböcker krävs'},
  {a:1710,b:1711,t:'Pesten'},
  {a:1808,b:1809,t:'Finska kriget'},
  {a:1834,b:1834,t:'Koleran'},
  {a:1867,b:1869,t:'Nödåren'},
  {a:1868,b:1914,t:'Den stora emigrationen'},
  {a:1901,b:1901,t:'Allmän värnplikt'},
  {a:1918,b:1920,t:'Spanska sjukan'},
  {a:1921,b:1921,t:'Allmän rösträtt'},
  {a:1939,b:1945,t:'Andra världskriget'},
  {a:1991,b:1991,t:'Folkbokföringen till Skatteverket'},
];

export { yearOf, dateKey, MONTHS, fmtDate, whenText, gedDate, genitive, slugify, parseDelimited, nrm, lev, dupScore, computeHidden, blood, bloodTerm, sx, $, esc, uid, norm, clone, NOW_Y, toast, EVENT_TYPES, SOURCE_TYPES, HIST };
