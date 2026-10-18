// One effective viewport for CSS container queries and JavaScript consumers.
export function createAtlasLayout({document,browser}){
 const viewport=document.getElementById('atlas-viewport'),stage=document.getElementById('atlas-stage');
 const fallback=browser?.matchMedia?.('(max-width: 899px)')||{matches:false};
 if(!viewport||!stage||!browser?.ResizeObserver)return {media:fallback,onResize:()=>()=>{},get size(){return null;},setSize(){},observeMapAnnotations(){},destroy(){}};
 const main=document.getElementById('atlas-main'),map=document.getElementById('map'),rail=document.getElementById('atlas-navigation-rail');
 const details=document.getElementById('details-panel'),head=details?.querySelector?.('.details-head');
 const measuredMap=map?.getBoundingClientRect?map:null;
 const measuredRail=rail?.getBoundingClientRect&&main?.getBoundingClientRect?rail:null;
 let mapSize=measuredMap?[measuredMap.clientWidth,measuredMap.clientHeight]:null;
 const reservations=new Map();let annotations=[];
 function reserve(name,value){if(!main?.style?.setProperty||reservations.get(name)===value)return;reservations.set(name,value);main.style.setProperty(name,value+'px');}
 function reserveSpace(){
  if(measuredRail){const r=rail.getBoundingClientRect(),m=main.getBoundingClientRect();if(r.top>m.top&&r.bottom>=m.bottom-12)reserve('--navigation-bottom',Math.ceil(m.bottom-r.top+8));else if(reservations.has('--navigation-bottom')){reservations.delete('--navigation-bottom');main.style.removeProperty('--navigation-bottom');}}
  // Reserve only annotations sharing the sheet's horizontal lane. Gutter controls
  // do not consume a second, fictitious band above the card.
  const selected=viewport.clientWidth<900&&details&&!details.hidden&&head?.getBoundingClientRect;
  if(selected){
   const d=details.getBoundingClientRect(),m=main.getBoundingClientRect();
   const top=Math.max(0,...annotations.map(e=>{const r=e.getBoundingClientRect();return r.left<d.right&&r.right>d.left?Math.ceil(r.bottom-m.top+4):0;}));
   const style=browser.getComputedStyle(details);
   const minimum=Math.ceil(head.getBoundingClientRect().height+44+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth));
   reserve('--annotation-space',top);reserve('--selection-min-height',minimum);
   // Enlarged text can require more than the physical frame. Preserve intrinsic
   // controls and expose the excess through the existing scrollable stage.
   reserve('--map-content-min-height',top+minimum+(reservations.get('--navigation-bottom')||0));
  }else{
   reserve('--map-content-min-height',0);
   if(annotations.length)reserve('--annotation-space',Math.max(24,...annotations.map(e=>Math.ceil(e.getBoundingClientRect().height+4))));
  }
 }
 const listeners=new Set(),changes=new Set();
 let size={width:viewport.clientWidth,height:viewport.clientHeight},small=size.width<900;
 const media={get matches(){return small;},media:'(max-width: 899px)',addEventListener(type,fn){if(type==='change')changes.add(fn);},removeEventListener(type,fn){if(type==='change')changes.delete(fn);}};
 function measure(){
  reserveSpace();
  const next={width:viewport.clientWidth,height:viewport.clientHeight};
  const nextMap=measuredMap?[measuredMap.clientWidth,measuredMap.clientHeight]:null;
  const mapChanged=nextMap&&nextMap.some((value,index)=>value!==mapSize[index]);mapSize=nextMap;
  if(next.width===size.width&&next.height===size.height&&!mapChanged)return;
  const previous=size;size=next;
  for(const fn of listeners)fn(size,previous);
  const matches=size.width<900;
  if(matches!==small){small=matches;for(const fn of changes)fn({matches,media:media.media});}
  // Responsive consumers reveal/hide the sheet actions; measure their final rows.
  reserveSpace();
 }
 const observer=new browser.ResizeObserver(measure);observer.observe(viewport);
 if(measuredMap)observer.observe(measuredMap);if(measuredRail)observer.observe(measuredRail);if(head)observer.observe(head);if(details?.getBoundingClientRect)observer.observe(details);
 measure();
 return {media,get size(){return {...size};},onResize(fn){listeners.add(fn);return ()=>listeners.delete(fn);},setSize(dimensions){
  viewport.style.width=dimensions?dimensions.width+'px':'';
  viewport.style.height=dimensions?dimensions.height+'px':'';
  stage.scrollLeft=0;stage.scrollTop=0;
  },observeMapAnnotations(){annotations=[...document.querySelectorAll('.leaflet-control-scale,.leaflet-control-attribution')].filter(e=>e.getBoundingClientRect);for(const element of annotations)observer.observe(element);reserveSpace();},destroy(){observer.disconnect();listeners.clear();changes.clear();}};
}
