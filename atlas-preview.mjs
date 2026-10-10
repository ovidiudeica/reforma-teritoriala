export const previewPresets=Object.freeze({desktop:{width:1440,height:900},tablet:{width:768,height:1024},phone:{width:390,height:844}});
export function reducePreview(state,action){
 if(action.type==='mode'){
  if(action.mode==='auto')return {mode:'auto',orientation:'portrait'};
  if(!Object.hasOwn(previewPresets,action.mode))return state;
  return {mode:action.mode,orientation:action.mode==='desktop'?'landscape':'portrait'};
 }
 if(action.type==='rotate'&&state.mode!=='auto')return {...state,orientation:state.orientation==='portrait'?'landscape':'portrait'};
 return state;
}
export function previewSize(state){
 const preset=previewPresets[state.mode];if(!preset)return null;
 const [short,long]=[preset.width,preset.height].sort((a,b)=>a-b);
 return state.orientation==='portrait'?{width:short,height:long}:{width:long,height:short};
}
export function createAtlasPreview({document,layout,browser}){
 const toolbar=document.getElementById('atlas-preview-toolbar'),stage=document.getElementById('atlas-stage'),viewport=document.getElementById('atlas-viewport');
 if(!toolbar||!stage||!viewport||!layout.size)return {get state(){return {mode:'auto',orientation:'portrait'};}};
 const modes=[...toolbar.querySelectorAll('[data-preview-mode]')],rotate=document.getElementById('preview-rotate'),pan=document.getElementById('preview-pan'),status=document.getElementById('preview-status');
 let state={mode:'auto',orientation:'portrait'},panning=false,drag=null;
 const names={desktop:'Desktop',tablet:'Tabletă',phone:'Telefon'};
 function sync(){
  if(state.mode==='auto'){const size=layout.size;state={...state,orientation:size.width>size.height?'landscape':'portrait'};}
  for(const button of modes)button.setAttribute('aria-pressed',String(button.dataset.previewMode===state.mode));
  rotate.disabled=state.mode==='auto';rotate.setAttribute('aria-label',state.orientation==='portrait'?'Rotește previzualizarea în landscape':'Rotește previzualizarea în portret');
  const size=previewSize(state);status.textContent=size?names[state.mode]+' · '+size.width+' × '+size.height:'Responsive automat';
  const overflow=Boolean(size&&(size.width>stage.clientWidth||size.height>stage.clientHeight));
  if(!overflow)panning=false;
  pan.hidden=!overflow;pan.setAttribute('aria-pressed',String(panning));pan.textContent=panning?'Interacționează':'Deplasează cadrul';
  viewport.inert=panning;stage.classList.toggle('preview-panning',panning);
  stage.tabIndex=panning?0:-1;stage.setAttribute('aria-label',panning?'Deplasează cadrul cu săgețile sau prin tragere':'Previzualizare atlas');
 }
 function dispatch(action){state=reducePreview(state,action);panning=false;drag=null;layout.setSize(previewSize(state));sync();}
 for(const button of modes)button.addEventListener('click',()=>dispatch({type:'mode',mode:button.dataset.previewMode}));
 rotate.addEventListener('click',()=>dispatch({type:'rotate'}));
 pan.addEventListener('click',()=>{panning=!panning;sync();if(panning)stage.focus();});
 stage.addEventListener('keydown',event=>{
  if(!panning)return;
  const movement={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]}[event.key];
  if(movement){event.preventDefault();stage.scrollBy({left:movement[0],top:movement[1],behavior:'instant'});}
  else if(event.key==='Escape'){event.preventDefault();panning=false;sync();pan.focus();}
 });
 stage.addEventListener('pointerdown',event=>{if(!panning||event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:stage.scrollLeft,top:stage.scrollTop};stage.setPointerCapture(event.pointerId);event.preventDefault();});
 stage.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;stage.scrollLeft=drag.left+drag.x-event.clientX;stage.scrollTop=drag.top+drag.y-event.clientY;});
 const finish=event=>{if(drag?.id!==event.pointerId)return;drag=null;stage.releasePointerCapture?.(event.pointerId);};
 stage.addEventListener('pointerup',finish);stage.addEventListener('pointercancel',finish);
 layout.onResize(sync);browser.addEventListener('resize',sync);sync();
 return {get state(){return {...state,panning};},setMode:mode=>dispatch({type:'mode',mode})};
}
