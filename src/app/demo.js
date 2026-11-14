/* Släktsagan · demo.js — The House of Vasa example (in memory only). */
import { mapState } from './map.js?v=39';
import { VIEWS, renderAll } from './router.js?v=39';
import { ALL, applyView, archiveData, ui } from './state.js?v=39';
import { Hist, Store } from './store.js?v=39';
import { $, clone, toast, uid } from './util.js?v=39';

/* ============ Demo ============ */
function demoData(){
  const now=new Date().toISOString();
  const pl=(id,name,lat,lon,county,country='Sverige',notes='')=>({kind:'place',id,name,lat,lon,county,country,notes});
  const places=[
    pl('pl_rydbo','Rydboholm',59.474,18.226,'Uppland','Sverige','Vasaättens sätesgård i Östra Ryd. Gustav Vasa föddes troligen här, möjligen på Lindholmen.'),
    pl('pl_sthlm','Stockholm, Tre Kronor',59.327,18.071,'Uppland'),
    pl('pl_uppsala','Uppsala',59.858,17.638,'Uppland','Sverige','Domkyrkan är kröningskyrka och gravkyrka för Gustav Vasa och Johan III.'),
    pl('pl_strangnas','Strängnäs',59.377,17.032,'Södermanland'),
    pl('pl_vadstena','Vadstena',58.448,14.890,'Östergötland'),
    pl('pl_tynnelso','Tynnelsö',59.300,17.140,'Södermanland'),
    pl('pl_stegeborg','Stegeborg',58.433,16.590,'Östergötland'),
    pl('pl_gripsholm','Gripsholm',59.257,17.219,'Södermanland'),
    pl('pl_nykoping','Nyköping',58.753,17.008,'Södermanland'),
    pl('pl_orbyhus','Örbyhus',60.230,17.700,'Uppland'),
    pl('pl_vasteras','Västerås',59.611,16.545,'Västmanland'),
    pl('pl_stromsholm','Strömsholm',59.528,16.250,'Västmanland'),
    pl('pl_gbg','Göteborg',57.708,11.974,'Västergötland'),
    pl('pl_liuksiala','Liuksiala, Kangasala',61.460,24.070,'Tavastland','Finland'),
    pl('pl_krakow','Kraków',50.062,19.937,'','Polen'),
    pl('pl_warszawa','Warszawa',52.230,21.011,'','Polen'),
    pl('pl_vilnius','Vilnius',54.687,25.280,'','Litauen'),
    pl('pl_lutzen','Lützen',51.257,12.142,'Sachsen','Tyskland'),
    pl('pl_konigsberg','Königsberg',54.710,20.510,'Preussen','Ryssland (Kaliningrad)'),
    pl('pl_heidelberg','Heidelberg',49.398,8.672,'Pfalz','Tyskland'),
    pl('pl_innsbruck','Innsbruck',47.269,11.404,'Tyrolen','Österrike'),
    pl('pl_rom','Rom',41.902,12.454,'','Italien'),
    pl('pl_nevers','Nevers',46.990,3.159,'','Frankrike'),
  ];
  const src=(id,title,type,archive,ref,url,notes='')=>({kind:'source',id,title,type,archive,ref,url,notes,createdAt:now});
  const sources=[
    src('s_sbl','Svenskt biografiskt lexikon (SBL)','Webbplats','Riksarkivet','','https://sok.riksarkivet.se/sbl/','Biografiska artiklar om kungar och furstar.'),
    src('s_skbl','Svenskt kvinnobiografiskt lexikon (SKBL)','Webbplats','Göteborgs universitet','','https://skbl.se/','Artiklar om drottningar och prinsessor, bl.a. Margareta Leijonhufvud och Karin Månsdotter.'),
    src('s_kungl','Sveriges regenter – Kungliga slotten','Webbplats','Kungliga Hovstaterna','','https://www.kungligaslotten.se/','Översikt över regenter, gemåler och barn.'),
  ];
  const c=(sid,about,detail)=>({id:uid('c'),sourceId:sid,about,detail});
  const per=(id,given,surname,sex,bd,bp,dd,dp,occ,f,m,sp=[],extra={})=>Object.assign({kind:'person',id,given,surname,sex,birthDate:bd,birthPlace:bp||'',deathDate:dd,deathPlace:dp||'',occupation:occ,fatherId:f||'',motherId:m||'',spouseIds:sp,events:[],citations:[],media:[],notes:'',createdAt:now},extra);
  const ev=(type,date,placeId,desc,withId)=>({id:uid('e'),type,date,placeId:placeId||'',desc:desc||'',withId:withId||''});
  const G='p_gustav1',KS='p_kat_sachsen',ML='p_margareta',KST='p_kat_stenbock';
  const persons=[
    // Gustav Vasa och hans tre hustrur
    per(G,'Gustav','Vasa','M','1496-05-12','pl_rydbo','1560-09-29','pl_sthlm','Kung av Sverige 1523–1560','','',[KS,ML,KST],{createdAt:'1000',home:true,
      notes:'Född Gustav Eriksson. Födelseorten är osäker – Rydboholm eller Lindholmen i Uppland.\n\nDatum i exemplet följer den julianska kalendern (”gamla stilen”) som gällde i Sverige till 1753.',
      events:[ev('Övrigt','1521-08-23','pl_vadstena','Vald till riksföreståndare'),ev('Övrigt','1523-06-06','pl_strangnas','Vald till kung – Sveriges nationaldag'),ev('Vigsel','1531-09-24','pl_sthlm','',KS),ev('Vigsel','1536-10-01','','',ML),ev('Kröning','1528-01-12','pl_uppsala','Krönt i Uppsala domkyrka'),ev('Vigsel','1552-08-22','pl_vadstena','',KST),ev('Begravning','1560-12-21','pl_uppsala','Uppsala domkyrka')],
      citations:[c('s_sbl','','Gustav I'),c('s_kungl','','Gustav I')]}),
    per(KS,'Katarina','av Sachsen-Lauenburg','K','1513-09-24','','1535-09-23','pl_sthlm','Drottning','','',[G],{citations:[c('s_kungl','','Katarina av Sachsen-Lauenburg')]}),
    per(ML,'Margareta','Leijonhufvud','K','1516-01-01','','1551-08-26','pl_tynnelso','Drottning','','',[G],{notes:'Född Margareta Eriksdotter. Födelsedagen 1 januari 1516 är traditionell; SKBL anger att datum och plats är osäkra.',citations:[c('s_skbl','','Margareta, drottning'),c('s_skbl','Död','dog på Tynnelsö')]}),
    per(KST,'Katarina','Stenbock','K','1535-07-22','','1621-12-13','pl_stromsholm','Drottning','','',[G],{notes:'Systerdotter till Margareta Leijonhufvud. Inga barn med Gustav Vasa.'}),
    // Barn med Katarina av Sachsen-Lauenburg
    per('p_erik14','Erik XIV','','M','1533-12-13','pl_sthlm','1577-02-26','pl_orbyhus','Kung av Sverige 1560–1568',G,KS,['p_karin'],{
      events:[ev('Kröning','1561-06-29','pl_uppsala'),ev('Vigsel','1568-07-04','pl_sthlm','',"p_karin"),ev('Övrigt','1568','pl_sthlm','Avsatt av sina bröder Johan och Karl')],citations:[c('s_sbl','','Erik XIV')]}),
    per('p_karin','Karin','Månsdotter','K','1550-11-06','pl_sthlm','1612-09-13','pl_liuksiala','Drottning','','',['p_erik14'],{events:[ev('Kröning','1568-07-05','pl_sthlm')],notes:'Begravd i Åbo domkyrka.',citations:[c('s_skbl','','Karin Månsdotter, drottning')]}),
    per('p_sigrid','Sigrid','Eriksdotter Vasa','K','1566','','1633','','','p_erik14','p_karin'),
    per('p_gustav_e','Gustav','Eriksson Vasa','M','1568-01-28','pl_nykoping','1607','','Prins','p_erik14','p_karin',[],{notes:'Levde större delen av livet i landsflykt och dog i Ryssland.'}),
    // Barn med Margareta Leijonhufvud
    per('p_johan3','Johan III','','M','1537-12-20','pl_stegeborg','1592-11-17','pl_sthlm','Kung av Sverige 1568–1592',G,ML,['p_katjag','p_gunilla'],{
      events:[ev('Vigsel','1562-10-04','pl_vilnius','','p_katjag'),ev('Kröning','1569-07-10','pl_uppsala')],citations:[c('s_sbl','','Johan III')]}),
    per('p_katarina_g','Katarina','Gustavsdotter Vasa','K','1539','','1610','','Grevinna av Ostfriesland',G,ML),
    per('p_cecilia','Cecilia','Gustavsdotter Vasa','K','1540','','1627','','Markgrevinna av Baden-Rodemachern',G,ML),
    per('p_magnus','Magnus','Gustavsson Vasa','M','1542','','1595','','Hertig av Östergötland',G,ML),
    per('p_karl_1544','Karl','Gustavsson Vasa','M','1544','','1544','','',G,ML,[],{notes:'Dog som spädbarn.'}),
    per('p_anna_g','Anna','Gustavsdotter Vasa','K','1545','','1610','','Pfalzgrevinna av Veldenz',G,ML),
    per('p_sten','Sten','Gustavsson Vasa','M','1546','','1547','','',G,ML,[],{notes:'Dog som spädbarn.'}),
    per('p_sofia','Sofia','Gustavsdotter Vasa','K','1547','','1611','','Hertiginna av Sachsen-Lauenburg',G,ML),
    per('p_elisabet','Elisabet','Gustavsdotter Vasa','K','1549','','1597','','Hertiginna av Mecklenburg-Gadebusch',G,ML),
    per('p_karl9','Karl IX','','M','1550-10-04','pl_sthlm','1611-10-30','pl_nykoping','Kung av Sverige 1604–1611',G,ML,['p_maria_pf','p_kristina_hg'],{
      events:[ev('Vigsel','1579-05-11','pl_heidelberg','','p_maria_pf'),ev('Vigsel','1592-08-27','pl_nykoping','','p_kristina_hg'),ev('Kröning','1607-03-15','pl_uppsala')],citations:[c('s_sbl','','Karl IX'),c('s_kungl','','Karl IX – barn')]}),
    // Johan III:s familj
    per('p_katjag','Katarina','Jagellonica','K','1526-11-01','pl_krakow','1583-09-16','pl_sthlm','Drottning','','',['p_johan3']),
    per('p_gunilla','Gunilla','Bielke','K','1568','','1597','','Drottning','','',['p_johan3']),
    per('p_sigismund','Sigismund','','M','1566-06-20','pl_gripsholm','1632-04-30','pl_warszawa','Kung av Sverige 1592–1599 och av Polen 1587–1632','p_johan3','p_katjag',['p_anna_o','p_konstantia'],{citations:[c('s_sbl','','Sigismund')]}),
    per('p_anna_j','Anna','Johansdotter Vasa','K','1568','','1625','','Prinsessa','p_johan3','p_katjag'),
    per('p_johan_og','Johan','Johansson Vasa','M','1589','','1618','','Hertig av Östergötland','p_johan3','p_gunilla'),
    per('p_anna_o','Anna','av Österrike','K','1573','','1598','pl_warszawa','Drottning av Polen','','',['p_sigismund']),
    per('p_konstantia','Konstantia','av Österrike','K','1588','','1631','pl_warszawa','Drottning av Polen','','',['p_sigismund']),
    per('p_wladyslaw','Władysław IV','','M','1595-06-09','pl_krakow','1648-05-20','','Kung av Polen 1632–1648','p_sigismund','p_anna_o'),
    per('p_jan2','Jan II Kazimierz','','M','1609-03-22','pl_krakow','1672-12-16','pl_nevers','Kung av Polen 1648–1668','p_sigismund','p_konstantia',[],{notes:'Den siste av Vasaätten på en kungatron.'}),
    // Karl IX:s familj
    per('p_maria_pf','Maria','av Pfalz','K','1561','','1589','pl_gripsholm','Hertiginna','','',['p_karl9']),
    per('p_kristina_hg','Kristina','av Holstein-Gottorp','K','1573','','1625','pl_gripsholm','Drottning','','',['p_karl9']),
    per('p_katarina_k','Katarina','Karlsdotter Vasa','K','1584-11-10','pl_nykoping','1638-12-13','pl_vasteras','Pfalzgrevinna','p_karl9','p_maria_pf',['p_johan_kasimir'],{notes:'Tog hand om den unga drottning Kristina efter Gustav II Adolfs död.'}),
    per('p_johan_kasimir','Johan Kasimir','av Pfalz-Zweibrücken','M','1589','','1652','','Pfalzgreve','','',['p_katarina_k'],{events:[ev('Vigsel','1615','','','p_katarina_k')]}),
    per('p_karl10','Karl X Gustav','','M','1622-11-08','pl_nykoping','1660-02-13','pl_gbg','Kung av Sverige 1654–1660','p_johan_kasimir','p_katarina_k',[],{events:[ev('Kröning','1654-06-06','pl_uppsala','Krönt samma dag som Kristina abdikerade')],notes:'Första kungen av den pfalziska ätten – Vasaätten på mödernet.'}),
    per('p_ga2','Gustav II Adolf','','M','1594-12-09','pl_sthlm','1632-11-06','pl_lutzen','Kung av Sverige 1611–1632','p_karl9','p_kristina_hg',['p_maria_el'],{
      events:[ev('Kröning','1617-10-12','pl_uppsala'),ev('Vigsel','1620-11-25','pl_sthlm','','p_maria_el'),ev('Övrigt','1632-11-06','pl_lutzen','Stupade i slaget vid Lützen')],citations:[c('s_sbl','','Gustav II Adolf')]}),
    per('p_maria_elisabet','Maria Elisabet','Karlsdotter Vasa','K','1596','','1618','','Hertiginna av Östergötland','p_karl9','p_kristina_hg'),
    per('p_karl_filip','Karl Filip','','M','1601','','1622','','Hertig av Södermanland','p_karl9','p_kristina_hg'),
    per('p_maria_el','Maria Eleonora','av Brandenburg','K','1599-11-11','pl_konigsberg','1655-03-28','pl_sthlm','Drottning','','',['p_ga2']),
    per('p_kristina','Kristina','','K','1626-12-08','pl_sthlm','1689-04-19','pl_rom','Drottning av Sverige 1632–1654','p_ga2','p_maria_el',[],{
      events:[ev('Kröning','1650-10-20','pl_sthlm'),ev('Övrigt','1654-06-06','pl_uppsala','Abdikerade på Uppsala slott'),ev('Övrigt','1655-11-03','pl_innsbruck','Konverterade offentligt till katolicismen')],
      notes:'Den sista av Vasaätten på den svenska tronen. Begravd i Peterskyrkan i Rom.',citations:[c('s_sbl','','Kristina')]}),
  ];
  return {places,sources,persons};
}
let _demoIds=null;
const demoIds=()=>_demoIds||(_demoIds=(()=>{const d=demoData(); return new Set([...d.places,...d.sources,...d.persons].map(o=>o.id));})());
const demoActive=()=>!!Store.demo;
function updateDemoBar(){const b=$('#demoBar'); if(b) b.classList.toggle('on',Store.loaded&&demoActive()); document.body.classList.toggle('demo',demoActive());}
/* The example family lives only in memory: it is never saved, so it can't
   end up in someone's own archive or in a shared tree. */
function loadDemo(){
  /* stay on the page you're on; from the start or import page, go to the tree */
  const stay=!['start','import'].includes(ui.view)&&VIEWS[ui.view];
  if(Store.demo){ if(!stay&&location.hash!=='#trad') location.hash='trad'; return; }
  const {places,sources,persons}=demoData();
  Store.demo={saved:archiveData(),focus:ui.focus,viewId:ui.viewId};
  const m=a=>Object.fromEntries(a.map(o=>[o.id,clone(o)]));
  ALL.persons=m(persons); ALL.places=m(places); ALL.sources=m(sources); ALL.views={}; ALL.comments={}; Hist.clear();
  ui.viewId=null; ui.focus='p_gustav1'; ui.ancGen=2; ui.descGen=3; ui.treeKey=null; ui.sel=null;
  applyView();
  toast('Det här är ett exempel. Inget sparas – dina egna uppgifter ligger kvar orörda.',5000);
  ui.fanKey=null; mapState.drawn=false;
  if(stay||location.hash==='#trad') renderAll(true); else location.hash='trad';
}
function exitDemo(quiet){
  const d=Store.demo; if(!d) return;
  Store.demo=null; Object.assign(ALL,d.saved); Hist.clear();
  ui.viewId=d.viewId&&ALL.views[d.viewId]?d.viewId:null; ui.focus=d.focus; ui.sel=null; ui.treeKey=null;
  applyView();
  if(quiet) return;
  toast('Exemplet är stängt');
  if(location.hash!=='#start') location.hash='start'; else renderAll(true);
}
/* Older versions saved the example into the archive. Remove it quietly. */
function purgeLegacyDemo(){
  if(!Store.canEdit||!Store.isAdmin) return;
  const ids=demoIds(); if(!Object.keys(ALL.persons).some(id=>ids.has(id))) return;
  for(const p of Object.values(ALL.persons)){ if(ids.has(p.id)) continue; const q=clone(p); let ch=false;
    for(const k of ['fatherId','motherId']) if(ids.has(q[k])){q[k]='';ch=true;}
    const sp=(q.spouseIds||[]).filter(x=>!ids.has(x)); if(sp.length!==(q.spouseIds||[]).length){q.spouseIds=sp;ch=true;}
    if(ch) Store.put(q,{silent:true,nohist:true}); }
  for(const v of Object.values(ALL.views)){const refs=[...(v.hide||[]),...(v.hideUp||[]),...(v.hideDown||[])]; if(refs.length&&refs.every(id=>ids.has(id))) Store.del('view',v.id,{silent:true,nohist:true});}
  for(const [kind,col] of [['person','persons'],['place','places'],['source','sources']]) for(const id of Object.keys(ALL[col])) if(ids.has(id)) Store.del(kind,id,{silent:true,nohist:true});
  if(ui.focus&&ids.has(ui.focus)) ui.focus=null;
}

export { demoData, _demoIds, demoIds, demoActive, updateDemoBar, loadDemo, exitDemo, purgeLegacyDemo };
