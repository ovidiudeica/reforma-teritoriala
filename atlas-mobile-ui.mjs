// Ephemeral responsive shell; semantic selection/history remain owned by app.js.
export function createAtlasMobileUi({document,media,onClear,isSearchOpen=()=>false}){
 const controls=document.getElementById('atlas-controls'),trigger=document.getElementById('mobile-navigation'),close=document.getElementById('drawer-close'),backdrop=document.getElementById('drawer-backdrop'),details=document.getElementById('details-panel'),body=document.getElementById('details-body'),expand=document.getElementById('sheet-expand'),search=document.getElementById('entity-search');
 let mobile=Boolean(media.matches),drawer=false,selected=null,sheet='closed';
 function sync(){
  trigger.hidden=!mobile;close.hidden=!mobile;backdrop.hidden=!mobile||!drawer;expand.hidden=!mobile||!selected;
  controls.dataset.mobile=String(mobile);controls.classList.toggle('mobile-drawer-open',mobile&&drawer);controls.inert=mobile&&!drawer;controls.setAttribute('aria-hidden',String(mobile&&!drawer));
  trigger.setAttribute('aria-expanded',String(mobile&&drawer));trigger.setAttribute('aria-controls',controls.id);
  details.dataset.mobile=String(mobile);details.classList.toggle('mobile-sheet-open',mobile&&sheet!=='closed');details.classList.toggle('mobile-sheet-expanded',mobile&&sheet==='expanded');details.inert=mobile&&sheet==='closed';details.setAttribute('aria-hidden',String(mobile&&sheet==='closed'));
  body.hidden=mobile&&sheet!=='expanded';expand.setAttribute('aria-expanded',String(mobile&&sheet==='expanded'));expand.setAttribute('aria-controls',body.id);expand.textContent=sheet==='expanded'?'Restrânge':'Extinde';
 }
 function closeDrawer(focus=true){if(!mobile)return;drawer=false;if(focus)trigger.focus();sync();}
 function openDrawer(){if(!mobile)return;drawer=true;sync();search.focus();}
 function selection(entityId,{source}={}){const focusHidden=mobile&&(body.contains?.(document.activeElement)||(!entityId&&details.contains?.(document.activeElement)));selected=entityId;sheet=selected?'peek':'closed';if(mobile&&['search','tree','url'].includes(source))closeDrawer(drawer);sync();if(focusHidden)(selected?expand:trigger).focus();}
 function toggleSheet(){if(!mobile||!selected)return;if(sheet==='expanded'&&body.contains?.(document.activeElement))expand.focus();sheet=sheet==='expanded'?'peek':'expanded';sync();}
 function clear(){if(mobile&&details.contains?.(document.activeElement))trigger.focus();onClear();}
 function breakpoint(event){const active=document.activeElement;mobile=Boolean(event.matches);drawer=false;sheet=selected?'peek':'closed';sync();if(mobile&&(controls.contains?.(active)||(!selected&&details.contains?.(active))))trigger.focus();else if(mobile&&body.contains?.(active))expand.focus();else if(!mobile&&[trigger,close,expand,backdrop].includes(active))search.focus();}
 function escape(event){if(event.key!=='Escape'||event.isComposing||!mobile||!drawer)return;if(isSearchOpen())return;event.preventDefault();closeDrawer();}
 trigger.addEventListener('click',openDrawer);close.addEventListener('click',()=>closeDrawer());backdrop.addEventListener('click',()=>closeDrawer());expand.addEventListener('click',toggleSheet);
 document.addEventListener?.('keydown',escape,true);media.addEventListener?.('change',breakpoint);sync();
 return {openDrawer,closeDrawer,toggleSheet,selection,clear,get state(){return {mobile,drawer,sheet,selected};}};
}
