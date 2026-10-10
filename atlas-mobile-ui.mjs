// P7.2: selection sheet only. Contextual navigation belongs to atlas-panels.
export function createAtlasMobileUi({document,media,panels,onClear}){
 const byId=id=>document.getElementById(id),trigger=byId('mobile-navigation');
 const details=byId('details-panel'),body=byId('details-body'),expand=byId('sheet-expand'),half=byId('sheet-half'),handle=byId('sheet-drag');
 const steps=['peek','half','expanded'],labels=['Minimizat','Jumătate','Extins'];
 let mobile=Boolean(media.matches),selected=null,sheet='closed',drag=null;
 function sync(){
  expand.hidden=!mobile||!selected;half.hidden=!mobile||!selected;handle.hidden=!mobile||!selected;
  details.dataset.mobile=String(mobile);details.dataset.sheet=mobile?sheet:'desktop';
  details.classList.toggle('mobile-sheet-open',mobile&&sheet!=='closed');
  details.classList.toggle('mobile-sheet-half',mobile&&sheet==='half');
  details.classList.toggle('mobile-sheet-expanded',mobile&&sheet==='expanded');
  details.inert=!selected||(mobile&&sheet==='closed');details.hidden=details.inert;
  details.setAttribute('aria-hidden',String(details.hidden));
  body.hidden=mobile&&(sheet==='closed'||sheet==='peek');
  expand.setAttribute('aria-expanded',String(mobile&&sheet!=='peek'&&sheet!=='closed'));expand.setAttribute('aria-controls',body.id);
  expand.textContent=sheet==='expanded'?'Restrânge':'Extinde';half.setAttribute('aria-pressed',String(mobile&&sheet==='half'));half.textContent=sheet==='half'?'Minimizează':'Jumătate';
  const index=Math.max(0,steps.indexOf(sheet));handle.setAttribute('aria-valuenow',String(index));handle.setAttribute('aria-valuetext',labels[index]);
 }
 function closeDrawer(focus=true){if(mobile)panels.close({focus});}
 function openDrawer(source=trigger){if(mobile)panels.open('entities',{source});}
 function setSheet(next){
  if(!mobile||!selected||!steps.includes(next))return;
  if(next==='peek'&&body.contains?.(document.activeElement))expand.focus();sheet=next;sync();
 }
 function selection(entityId,{source}={}){
  const focusHidden=mobile&&(body.contains?.(document.activeElement)||(!entityId&&details.contains?.(document.activeElement)));
  selected=entityId;sheet=selected?'peek':'closed';
  if(mobile&&['search','tree','url'].includes(source))closeDrawer(panels.state.drawer);
  sync();if(focusHidden)(selected?expand:trigger).focus();
 }
 function toggleSheet(){if(mobile&&selected)setSheet(sheet==='expanded'?'peek':'expanded');}
 function toggleHalf(){if(mobile&&selected)setSheet(sheet==='half'?'peek':'half');}
 function clear(){if(mobile&&details.contains?.(document.activeElement))trigger.focus();onClear();}
 function breakpoint(event){
  const active=document.activeElement;mobile=Boolean(event.matches);drag=null;sheet=selected?'peek':'closed';sync();
  if(mobile&&body.contains?.(active))expand.focus();
  else if(!mobile&&[expand,half,handle].includes(active))byId('map').focus?.();
 }
 function stepSheet(direction){const index=steps.indexOf(sheet);setSheet(steps[Math.min(2,Math.max(0,index+direction))]);}
 function onPointerDown(event){if(!mobile||!selected||drag||event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};handle.setPointerCapture?.(event.pointerId);}
 function onPointerUp(event){
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag=null;
  if(Math.abs(dy)>=48&&Math.abs(dy)>Math.abs(dx)*1.2)stepSheet(dy<0?1:-1);
 }
 function handleKey(event){
  if(!mobile||!selected)return;
  if(event.key==='ArrowUp'){event.preventDefault();stepSheet(1);}
  else if(event.key==='ArrowDown'){event.preventDefault();stepSheet(-1);}
  else if(event.key==='Home'){event.preventDefault();setSheet('peek');}
  else if(event.key==='End'){event.preventDefault();setSheet('expanded');}
 }
 expand.addEventListener('click',toggleSheet);half.addEventListener('click',toggleHalf);
 handle.addEventListener('pointerdown',onPointerDown);handle.addEventListener('pointerup',onPointerUp);handle.addEventListener('pointercancel',()=>{drag=null;});handle.addEventListener('keydown',handleKey);
 media.addEventListener?.('change',breakpoint);sync();
 return {openDrawer,closeDrawer,toggleSheet,toggleHalf,setSheet,selection,clear,get state(){return {mobile,drawer:panels.state.drawer,sheet,selected};}};
}
