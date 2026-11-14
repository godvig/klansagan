/* Släktsagan · pwa.js — Installing as an app. */
import { modal } from './modal.js?v=39';
import { renderAll } from './router.js?v=39';
import { toast } from './util.js?v=39';

/* ============ Install as an app (PWA) ============ */
const PWA={prompt:null,
  standalone:()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,
  ios:()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),
  can(){return !this.standalone()&&(!!this.prompt||this.ios());},
  async install(){
    if(this.prompt){this.prompt.prompt(); const r=await this.prompt.userChoice.catch(()=>null); this.prompt=null; if(r&&r.outcome==='accepted') toast('Släktsagan finns nu på din hemskärm.'); renderAll(); return;}
    if(this.ios()) modal(`<h3>Lägg Släktsagan på hemskärmen</h3><ol class="ios-steps"><li>Tryck på <b>Dela</b>-knappen <span class="ios-share">⬆︎</span> längst ner i Safari.</li><li>Välj <b>Lägg till på hemskärmen</b>.</li><li>Tryck <b>Lägg till</b>. Nu öppnas Klansagan som en egen app.</li></ol><div class="foot"><button class="btn primary" data-x>Klar</button></div>`,(ov,close)=>{ov.querySelector('[data-x]').onclick=close;});
  }};

export { PWA };
