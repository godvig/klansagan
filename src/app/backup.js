/* Släktsagan · backup.js — Backup reminders and the unpublished-changes warning. */
import { doExport } from './importexport.js?v=44';
import { Share } from './share.js?v=44';
import { ALL } from './state.js?v=44';
import { Store } from './store.js?v=44';
import { fmtDate, toast } from './util.js?v=44';

/* ============ Backups ============
   A local archive lives only in this browser. Remember when a backup file was last saved,
   show it on the "Läs in & spara" page, and nudge (at most every few days) when it's overdue. */
const Backup={
  key:()=>'klansagan-backup-'+Share.lsKey(),
  last(){ try{return JSON.parse(localStorage.getItem(this.key())||'null');}catch(e){return null;} },
  mark(){ try{localStorage.setItem(this.key(),JSON.stringify({at:new Date().toISOString(),n:Object.keys(ALL.persons).length}));}catch(e){} },
  changedSince(at){ let n=0; for(const col of ['persons','places','sources']) for(const d of Object.values(ALL[col])) if((d.updatedAt||d.createdAt||'')>at) n++; return n; },
  status(){ const l=this.last(), n=Object.keys(ALL.persons).length;
    if(!l) return {n,last:null,changed:n,days:Infinity};
    return {n,last:l.at,changed:this.changedSince(l.at),days:(Date.now()-Date.parse(l.at))/864e5}; },
  /** Only local archives: a shared tree is kept, encrypted, on the server in 30 versions. */
  overdue(){ if(Store.demo||Store.mode==='db'||!Store.canEdit||Share.cur()) return false;
    const st=this.status(); if(st.n<5) return false; return !st.last||(st.changed>0&&st.days>=14); },
  async save(){ await doExport('json'); },
  box(){ const st=this.status(), d=st.last?fmtDate(st.last.slice(0,10)):'';
    const line=!st.last?'Du har inte sparat någon säkerhetskopia än.':st.changed?`Senaste kopian sparades ${d}. ${st.changed} ${st.changed===1?'sak har':'saker har'} ändrats sedan dess.`:`Senaste kopian sparades ${d}. Inget har ändrats sedan dess.`;
    return `<div class="box backup ${this.overdue()?'due':''}"><h3>Säkerhetskopia</h3>
      <p>${Share.cur()?'Det här trädet är delat, så de publicerade versionerna finns krypterade på servern. En egen kopia skadar ändå aldrig.':'Arkivet finns bara i den här webbläsaren. Rensas webbläsaren, eller byter du dator, försvinner det – om du inte har en kopia.'} Kopian är en fil med allt, bilder och röstminnen inräknade, som du kan läsa in igen här.</p>
      <p class="bk-line"><b>${line}</b></p>
      <button class="btn primary" id="bkSave">💾 Spara säkerhetskopia</button></div>`; },
  remind(){ if(!this.overdue()) return;
    try{ const sn=+localStorage.getItem('klansagan-backup-nudged')||0; if(Date.now()-sn<3*864e5) return; localStorage.setItem('klansagan-backup-nudged',String(Date.now())); }catch(e){}
    const st=this.status();
    toast(st.last?`Det var ${Math.round(st.days)} dagar sedan du sparade en säkerhetskopia.`:`Du har ${st.n} personer i arkivet men ingen säkerhetskopia.`,12000,{label:'Spara kopia',fn:()=>this.save()}); },
};

/* ============ Unpublished changes ============
   In a shared tree your edits stay on this device until you publish them. Leaving with
   unpublished edits asks first; coming back to them, and sitting on them for a while, gets a nudge. */
const Unpub={
  count(){ if(!Share.cur()||Store.demo||Store.mode==='db') return 0; try{return Share.recount();}catch(e){return 0;} },
  nudge(msg){ const n=this.count(); if(!n) return; toast(msg(n===1?'1 ändring':n+' ändringar',n===1?'':'a'),9000,{label:'Publicera',fn:()=>Share.publish()}); },
  arm(){ clearTimeout(this._t); if(this._done) return; this._t=setTimeout(()=>{ if(this.count()&&!document.hidden){ this._done=true; this.nudge(n=>`Du har ${n} som släkten inte ser ännu.`); } },10*60*1000); },
};

export { Backup, Unpub };
