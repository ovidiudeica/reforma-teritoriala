// P5.1: visual shell only. No entity/filter/URL/geometry mutation.
export function createAtlasExplorerShell({document,map,window:browser}){
 const main=document.getElementById('atlas-main');
 const sidebar=document.getElementById('atlas-controls');
 const divider=document.getElementById('explorer-resizer');
 const collapse=document.getElementById('explorer-collapse');
 const min=280,max=660,initial=340;
 // The Node/P4 contract tests use DOM and Leaflet doubles without layout APIs.
 // The real browser has all APIs; never mutate geometry or inject browser state in tests.
 if(!main?.style?.setProperty||!sidebar||!divider?.addEventListener||!browser?.matchMedia||!map?.invalidateSize){
  return {get width(){return initial;},setWidth(){}};
 }
 const small=browser.matchMedia('(max-width: 899px)');
 const storageKey='reforma-teritoriala.explorer-width.v1';
 let pointer=null;
 let width=initial;
 try{
  const saved=browser.localStorage?.getItem(storageKey);
  if(saved!==null&&saved!==undefined&&/^\d{3}$/.test(saved)){
   const parsed=Number(saved);
   if(parsed>=min&&parsed<=max)width=parsed;
  }
 }catch{ /* Privacy mode or unavailable storage: session width still works. */ }
 function persist(){try{browser.localStorage?.setItem(storageKey,String(width));}catch{ /* Storage is optional. */ }}
 const clamp=value=>Math.max(min,Math.min(max,Math.round(value)));
 function apply(value){
  width=clamp(value);
  main.style.setProperty('--explorer-width',width+'px');
  divider.setAttribute('aria-valuenow',String(width));
  map.invalidateSize({animate:false,pan:false});
 }
 function onMove(event){if(pointer!==event.pointerId)return;apply(event.clientX-main.getBoundingClientRect().left);}
 function finish(event){if(pointer!==event.pointerId)return;pointer=null;divider.releasePointerCapture?.(event.pointerId);persist();}
 divider.addEventListener('pointerdown',event=>{
  if(small.matches||event.button!==0)return;
  pointer=event.pointerId;
  divider.setPointerCapture?.(event.pointerId);
  apply(event.clientX-main.getBoundingClientRect().left);
  event.preventDefault();
 });
 divider.addEventListener('pointermove',onMove);
 divider.addEventListener('pointerup',finish);
 divider.addEventListener('pointercancel',finish);
 divider.addEventListener('keydown',event=>{
  if(small.matches)return;
  const step=event.shiftKey?48:20;
  const next={ArrowLeft:width-step,ArrowRight:width+step,Home:min,End:max}[event.key];
  if(next===undefined)return;
  event.preventDefault();
  apply(next);persist();
 });
 let collapsed=false;
 function setCollapsed(next){
  collapsed=Boolean(next);const active=collapsed&&!small.matches;
  main.classList.toggle('atlas-explorer-collapsed',active);
  sidebar.inert=active;
  if(active)sidebar.setAttribute('aria-hidden','true');
  else if(!small.matches)sidebar.setAttribute('aria-hidden','false');
  collapse?.setAttribute('aria-pressed',String(active));
  collapse?.setAttribute('aria-label',active?'Afișează panoul de explorare':'Ascunde panoul de explorare');
  collapse?.setAttribute('title',active?'Afișează panoul de explorare':'Ascunde panoul de explorare');
  map.invalidateSize({animate:false,pan:false});
 }
 small.addEventListener?.('change',()=>{if(small.matches)collapsed=false;setCollapsed(collapsed);map.invalidateSize({animate:false,pan:false});});
 apply(width);setCollapsed(false);
 return {get width(){return width;},setWidth(value){apply(value);persist();},get collapsed(){return collapsed;},setCollapsed,toggleCollapsed(){setCollapsed(!collapsed);}};
}
