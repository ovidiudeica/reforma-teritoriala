// One effective viewport for CSS container queries and JavaScript consumers.
export function createAtlasLayout({document,browser}){
 const viewport=document.getElementById('atlas-viewport'),stage=document.getElementById('atlas-stage');
 const fallback=browser?.matchMedia?.('(max-width: 899px)')||{matches:false};
 if(!viewport||!stage||!browser?.ResizeObserver)return {media:fallback,onResize:()=>()=>{},get size(){return null;},setSize(){},destroy(){}};
 const listeners=new Set(),changes=new Set();
 let size={width:viewport.clientWidth,height:viewport.clientHeight},small=size.width<900;
 const media={get matches(){return small;},media:'(max-width: 899px)',addEventListener(type,fn){if(type==='change')changes.add(fn);},removeEventListener(type,fn){if(type==='change')changes.delete(fn);}};
 function measure(){
  const next={width:viewport.clientWidth,height:viewport.clientHeight};
  if(next.width===size.width&&next.height===size.height)return;
  const previous=size;size=next;
  for(const fn of listeners)fn(size,previous);
  const matches=size.width<900;
  if(matches!==small){small=matches;for(const fn of changes)fn({matches,media:media.media});}
 }
 const observer=new browser.ResizeObserver(measure);observer.observe(viewport);
 measure();
 return {media,get size(){return {...size};},onResize(fn){listeners.add(fn);return ()=>listeners.delete(fn);},setSize(dimensions){
  viewport.style.width=dimensions?dimensions.width+'px':'';
  viewport.style.height=dimensions?dimensions.height+'px':'';
  stage.scrollLeft=0;stage.scrollTop=0;
 },destroy(){observer.disconnect();listeners.clear();changes.clear();}};
}
