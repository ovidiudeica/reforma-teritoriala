// P7.2: one owner for contextual navigation, responsive visibility and focus.
export const panelDefinitions=Object.freeze({
 entities:{title:'Entități',content:'entities-panel',trigger:'mobile-navigation'},
 search:{title:'Căutare',content:'results-panel',trigger:'mobile-search'},
 filters:{title:'Filtre',content:'filters-panel',trigger:'filters-toggle'},
 visible:{title:'Straturi vizibile',content:'atlas-advanced-dialog',trigger:'advanced-visible'},
 recent:{title:'Entități recente',content:'atlas-advanced-dialog',trigger:'advanced-recent'},
 compare:{title:'Compară entități',content:'atlas-advanced-dialog',trigger:'advanced-compare'},
 share:{title:'Partajare',content:'share-panel',trigger:'share-toggle'},
 info:{title:'Informații despre hartă',content:'atlas-info-dialog',trigger:'info-toggle'},
 modules:{title:'Module atlas',content:'modules-panel',trigger:'modules-toggle'},
 identify:{title:'Identifică teritoriul',content:'identify-panel',trigger:'identify-toggle'},
 neighbors:{title:'Vecini',content:'neighbors-panel',trigger:'neighbors-toggle'},
 measure:{title:'Măsoară',content:'measure-panel',trigger:'measure-toggle'}
});
export function createAtlasPanels({document,media,isSearchOpen=()=>false}){
 const el=id=>document.getElementById(id),frame=el('atlas-controls'),main=el('atlas-main'),closeButton=el('drawer-close'),backdrop=el('drawer-backdrop'),title=el('atlas-panel-title'),search=el('search-panel'),more=el('navigation-more'),map=el('map'),resetActions=el('atlas-panel-reset-actions'),geometryReset=el('geometries-reset'),filtersReset=el('filters-reset');
 let lastFocused=document.activeElement;
 document.addEventListener?.('focusin',event=>{if(event.target!==document.body)lastFocused=event.target;});
 const listeners=new Set(),beforeListeners=new Set(),buttons=Object.fromEntries(Object.entries(panelDefinitions).map(([key,value])=>[key,el(value.trigger)]));
 const contents=new Set(Object.values(panelDefinitions).map(value=>el(value.content)).filter(Boolean));
 let mobile=Boolean(media.matches),active=mobile?null:'entities',previous='entities',origin=buttons.entities,menu=false;
 const visible=element=>Boolean(element&&!element.hidden&&(!element.getClientRects||element.getClientRects().length));
 function focusReturn(){const target=visible(origin)?origin:visible(more)?more:buttons.entities;target?.focus?.();}
 function sync(){
  const opened=active!==null;
  const overlay=mobile&&(opened||menu);
  if(map)map.inert=overlay;
  frame.hidden=!opened;frame.inert=!opened;frame.setAttribute('aria-hidden',String(!opened));
  frame.setAttribute('aria-labelledby','atlas-panel-title');frame.setAttribute('tabindex','-1');
  frame.classList.toggle('mobile-drawer-open',mobile&&opened);frame.dataset.mobile=String(mobile);frame.dataset.panel=active||'';
  main.classList.toggle('atlas-explorer-collapsed',!mobile&&!opened);main.classList.toggle('atlas-navigation-more',menu);
  const shown=opened?el(panelDefinitions[active].content):null;
  for(const content of contents){content.hidden=content!==shown;content.inert=content!==shown;}
  title.textContent=opened?panelDefinitions[active].title:'Navigare';search.hidden=!['entities','search'].includes(active);
  const resetOwner=opened&&['entities','filters'].includes(active);
  if(resetActions)resetActions.hidden=!resetOwner;
  if(geometryReset)geometryReset.hidden=active!=='entities';
  if(filtersReset)filtersReset.hidden=active!=='filters';
  closeButton.hidden=!opened;backdrop.hidden=!overlay;
  for(const [key,button]of Object.entries(buttons)){if(!button)continue;button.hidden=false;button.setAttribute('aria-pressed',String(key===active));button.setAttribute('aria-expanded',String(key===active));button.setAttribute('aria-controls','atlas-controls');}
  more?.setAttribute('aria-expanded',String(menu));
 }
 function emit(){for(const listener of listeners)listener({active,mobile});}
 function open(key='entities',{source=buttons[key],focus=true}={}){
  if(!Object.hasOwn(panelDefinitions,key))return;
  for(const listener of beforeListeners)listener({from:active,to:key});
  active=key;previous=key;origin=source||buttons[key];menu=false;sync();emit();
  if(focus)(key==='search'?el('entity-search'):closeButton)?.focus?.();
 }
 function close({focus=true}={}){
  if(active===null&&!menu)return;
  for(const listener of beforeListeners)listener({from:active,to:null});
  active=null;menu=false;sync();emit();if(focus)focusReturn();
 }
 function breakpoint(event){
  const focused=document.activeElement===document.body&&lastFocused&&!visible(lastFocused)?lastFocused:document.activeElement,inside=frame.contains?.(focused);
  mobile=Boolean(event.matches);menu=false;
  if(mobile)active=null;else active=active||previous;sync();emit();
  if(inside&&active===null)focusReturn();
  else if(!visible(focused)){origin=focused;focusReturn();}
  else if(!mobile&&focused===more)buttons.entities?.focus?.();
 }
 for(const [key,button]of Object.entries(buttons))button?.addEventListener('click',()=>active===key?close():open(key));
 closeButton.addEventListener('click',()=>close());backdrop.addEventListener('click',()=>close());
 more?.addEventListener('click',()=>{const next=!menu;if(next&&active!==null)close({focus:false});menu=next;origin=more;sync();emit();if(menu)(buttons.identify||buttons.measure||buttons.visible)?.focus?.();});
 document.addEventListener?.('keydown',event=>{
  if(event.key!=='Escape'||event.isComposing||event.defaultPrevented)return;
  // Inline components consume their own first Escape in the target/bubble phase.
  // Do not close their containing pane before that handler can restore focus.
  if(event.target?.closest?.('[data-atlas-escape-owner]:not([hidden])'))return;
  if(menu){event.preventDefault();menu=false;sync();emit();more.focus();return;}
  if(active===null||(['entities','search'].includes(active)&&isSearchOpen()))return;
  event.preventDefault();close();
 },true);
 media.addEventListener?.('change',breakpoint);sync();
 return {open,close,onBeforeChange(fn){beforeListeners.add(fn);return()=>beforeListeners.delete(fn);},toggle(){active===null?open(previous):close();},onChange(fn){listeners.add(fn);return()=>listeners.delete(fn);},get state(){return {active,mobile,drawer:mobile&&active!==null,overlay:mobile&&(active!==null||menu),menu};}};
}
