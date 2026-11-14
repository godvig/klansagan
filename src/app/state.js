/* Släktsagan · state.js — The archive in memory (ALL), the filtered view of it (S) and UI state (ui). */
import { computeHidden } from './util.js?v=43';

/* ============ State ============ */
const ALL={persons:{},places:{},sources:{},views:{},comments:{}};
const S={persons:{},places:ALL.places,sources:ALL.sources,views:ALL.views,comments:ALL.comments};
const KIND={person:'persons',place:'places',source:'sources',view:'views',comment:'comments'};
const COLS=KinCore.COLS;
/** Every collection of an archive-shaped object, missing ones as {} (older files and versions have no comments). */
const cols=o=>Object.fromEntries(COLS.map(c=>[c,(o&&o[c])||{}]));
const archiveData=()=>Object.fromEntries(COLS.map(c=>[c,ALL[c]]));
const APP_VERSION='2026-11-14.10';
const ui={nameMode:(()=>{try{return localStorage.getItem('sa-names')||'full';}catch(e){return 'full';}})(),simple:false,view:'trad',focus:null,sel:null,ancGen:3,descGen:2,kinDeg:2,plFilter:'alla',plSort:'namn',plQuery:'',
  tlScope:'alla',tlHist:true,mapScope:'alla',mapRoute:true,placing:null,treeKey:null,viewId:null};
let HIDDEN=new Set();
const activeView=()=>(ui.viewId&&ALL.views[ui.viewId])||null;
/** Bumped whenever the data shown can have changed, so views can skip redrawing when nothing did. */
let DATA_REV=0;
function bumpRev(){ DATA_REV++; }
function applyView(){
  DATA_REV++;
  const v=activeView(); HIDDEN=v?computeHidden(v):new Set();
  const o={}; for(const id in ALL.persons) if(!HIDDEN.has(id)) o[id]=ALL.persons[id];
  S.persons=o; S.places=ALL.places; S.sources=ALL.sources; S.views=ALL.views; S.comments=ALL.comments;
}
function withAll(fn){const saved=S.persons; S.persons=ALL.persons; try{return fn();} finally{S.persons=saved;}}
function viewCounts(v){return computeHidden(v).size;}

export { ALL, S, KIND, COLS, cols, archiveData, APP_VERSION, ui, HIDDEN, activeView, DATA_REV, bumpRev, applyView, withAll, viewCounts };
