// P5.1: visual shell only. No entity/filter/URL/geometry mutation.
export function createAtlasExplorerShell({document,map,window:browser}){
 const main=document.getElementById('atlas-main');
 const sidebar=document.getElementById('atlas-controls');
 const divider=document.getElementById('explorer-resizer');
 const min=280,max=660,initial=340;
 // The Node/P4 contract tests use DOM and Leaflet doubles without layout APIs.
 // The real browser has all APIs; never mutate geometry or inject browser state in tests.
 if(!main?.style?.setProperty||!sidebar||!divider?.addEventListener||!browser?.matchMedia||!map?.invalidateSize){
  return {get width(){return initial;},setWidth(){}};
 }
 const small=browser.matchMedia('(max-width: 720px)');
 let pointer=null;
 let width=initial;
 const clamp=value=>Math.max(min,Math.min(max,Math.round(value)));
 function apply(value){
  width=clamp(value);
  main.style.setProperty('--explorer-width',width+'px');
  divider.setAttribute('aria-valuenow',String(width));
  map.invalidateSize({animate:false,pan:false});
 }
 function onMove(event){if(pointer!==event.pointerId)return;apply(event.clientX-main.getBoundingClientRect().left);}
 function finish(event){if(pointer!==event.pointerId)return;pointer=null;divider.releasePointerCapture?.(event.pointerId);}
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
  apply(next);
 });
 small.addEventListener?.('change',()=>map.invalidateSize({animate:false,pan:false}));
 apply(initial);
 return {get width(){return width;},setWidth:apply};
}
