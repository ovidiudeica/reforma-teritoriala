// P6.2: ephemeral responsive controls. Entity selection, URL/history and geometry remain owned by app.js.
export function createAtlasMobileUi({document,media,onClear,isSearchOpen=()=>false,onOpen=()=>{},onCloseDrawer=()=>{},onOpenFilters=()=>{}}){
 const byId=id=>document.getElementById(id);
 const controls=byId('atlas-controls'),trigger=byId('mobile-navigation'),close=byId('drawer-close'),backdrop=byId('drawer-backdrop');
 const toolbar=byId('atlas-mobile-toolbar'),quickSearch=byId('mobile-search'),quickFilters=byId('mobile-filters');
 const details=byId('details-panel'),body=byId('details-body'),expand=byId('sheet-expand'),half=byId('sheet-half'),handle=byId('sheet-drag'),search=byId('entity-search');
 const steps=['peek','half','expanded'],labels=['Minimizat','Jumătate','Extins'];
 let mobile=Boolean(media.matches),drawer=false,selected=null,sheet='closed',drag=null;
 function sync(){
  toolbar.hidden=!mobile||drawer;
  trigger.hidden=!mobile;close.hidden=!mobile;backdrop.hidden=!mobile||!drawer;
  quickSearch.hidden=!mobile;quickFilters.hidden=!mobile;
  expand.hidden=!mobile||!selected;half.hidden=!mobile||!selected;handle.hidden=!mobile||!selected;
  controls.dataset.mobile=String(mobile);controls.classList.toggle('mobile-drawer-open',mobile&&drawer);
  controls.inert=mobile&&!drawer;controls.hidden=mobile&&!drawer;controls.setAttribute('aria-hidden',String(mobile&&!drawer));
  trigger.setAttribute('aria-expanded',String(mobile&&drawer));trigger.setAttribute('aria-controls',controls.id);
  details.dataset.mobile=String(mobile);details.dataset.sheet=mobile?sheet:'desktop';
  details.classList.toggle('mobile-sheet-open',mobile&&sheet!=='closed');
  details.classList.toggle('mobile-sheet-half',mobile&&sheet==='half');
  details.classList.toggle('mobile-sheet-expanded',mobile&&sheet==='expanded');
  details.inert=!selected||(mobile&&sheet==='closed');
  details.hidden=!selected||(mobile&&sheet==='closed');
  details.setAttribute('aria-hidden',String(!selected||(mobile&&sheet==='closed')));
  body.hidden=mobile&&(sheet==='closed'||sheet==='peek');
  expand.setAttribute('aria-expanded',String(mobile&&sheet!=='peek'&&sheet!=='closed'));
  expand.setAttribute('aria-controls',body.id);
  expand.textContent=sheet==='expanded'?'Restrânge':'Extinde';
  half.setAttribute('aria-pressed',String(mobile&&sheet==='half'));
  half.textContent=sheet==='half'?'Minimizează':'Jumătate';
  const index=Math.max(0,steps.indexOf(sheet));
  handle.setAttribute('aria-valuenow',String(index));
  handle.setAttribute('aria-valuetext',labels[index]);
 }
 function closeDrawer(focus=true){if(!mobile)return;drawer=false;onCloseDrawer();sync();if(focus)trigger.focus();}
 function openDrawer(){if(!mobile)return;drawer=true;sync();search.focus();onOpen();}
 function setSheet(next){
  if(!mobile||!selected||!steps.includes(next))return;
  if((next==='peek')&&body.contains?.(document.activeElement))expand.focus();
  sheet=next;sync();
 }
 function selection(entityId,{source}={}){
  const focusHidden=mobile&&(body.contains?.(document.activeElement)||(!entityId&&details.contains?.(document.activeElement)));
  selected=entityId;sheet=selected?'peek':'closed';
  if(mobile&&['search','tree','url'].includes(source))closeDrawer(drawer);
  sync();if(focusHidden)(selected?expand:trigger).focus();
 }
 // Retain P5's one-button peek/full toggle; a second button provides the middle position.
 function toggleSheet(){if(mobile&&selected)setSheet(sheet==='expanded'?'peek':'expanded');}
 function toggleHalf(){if(mobile&&selected)setSheet(sheet==='half'?'peek':'half');}
 function clear(){if(mobile&&details.contains?.(document.activeElement))trigger.focus();onClear();}
 function breakpoint(event){
  const active=document.activeElement;
  mobile=Boolean(event.matches);drawer=false;drag=null;sheet=selected?'peek':'closed';sync();
  if(mobile&&(controls.contains?.(active)||(!selected&&details.contains?.(active))))trigger.focus();
  else if(mobile&&body.contains?.(active))expand.focus();
  else if(!mobile&&[trigger,close,expand,half,handle,quickSearch,quickFilters,backdrop].includes(active))search.focus();
 }
 function escape(event){
  if(event.key!=='Escape'||event.isComposing||!mobile||!drawer)return;
  if(isSearchOpen())return;
  event.preventDefault();closeDrawer();
 }
 function stepSheet(direction){const i=steps.indexOf(sheet);setSheet(steps[Math.min(2,Math.max(0,i+direction))]);}
 function onPointerDown(event){
  if(!mobile||!selected||drag||event.button!==0)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY};
  handle.setPointerCapture?.(event.pointerId);
 }
 function onPointerUp(event){
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag=null;
  if(Math.abs(dy)>=48&&Math.abs(dy)>Math.abs(dx)*1.2)stepSheet(dy<0?1:-1);
 }
 function onPointerCancel(){drag=null;}
 function handleKey(event){
  if(!mobile||!selected)return;
  if(event.key==='ArrowUp'){event.preventDefault();stepSheet(1);}
  else if(event.key==='ArrowDown'){event.preventDefault();stepSheet(-1);}
  else if(event.key==='Home'){event.preventDefault();setSheet('peek');}
  else if(event.key==='End'){event.preventDefault();setSheet('expanded');}
 }
 trigger.addEventListener('click',openDrawer);
 quickSearch.addEventListener('click',openDrawer);
 quickFilters.addEventListener('click',()=>{openDrawer();onOpenFilters();});
 close.addEventListener('click',()=>closeDrawer());backdrop.addEventListener('click',()=>closeDrawer());
 expand.addEventListener('click',toggleSheet);half.addEventListener('click',toggleHalf);
 handle.addEventListener('pointerdown',onPointerDown);handle.addEventListener('pointerup',onPointerUp);
 handle.addEventListener('pointercancel',onPointerCancel);handle.addEventListener('keydown',handleKey);
 document.addEventListener?.('keydown',escape,true);media.addEventListener?.('change',breakpoint);sync();
 return {openDrawer,closeDrawer,toggleSheet,toggleHalf,setSheet,selection,clear,get state(){return {mobile,drawer,sheet,selected};}};
}
