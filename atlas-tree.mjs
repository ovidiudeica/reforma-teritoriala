import {flattenVisibleTree,createTreeWindow} from './atlas-tree-window.mjs';
import {formatEntityName} from './atlas-name-format.mjs';
import {compactTreeName,nistreniaTreeContext} from './atlas-tree-labels.mjs';
import {createOsmLevelBadge} from './atlas-osm-admin-badges.mjs';
// Navigation uses only actual-consolidated-hierarchy-v1 relationships.
export function parentId(nodeById,id){
 const node=nodeById.get(id);
 if(!node)throw new Error('Atlas hierarchy: unknown entity '+id);
 return node.parent_id??null;
}
export function hasChildren(nodeById,id){
 if(!nodeById.has(id))throw new Error('Atlas hierarchy: unknown entity '+id);
 return Boolean(nodeById.get(id).child_ids?.length);
}
export function ancestorPath(nodeById,rootIds,id){
 const path=[],seen=new Set();
 let current=id;
 while(current!==null){
  if(seen.has(current))throw new Error('Atlas hierarchy: cycle for '+id+' at '+current);
  seen.add(current);
  const node=nodeById.get(current);
  if(!node)throw new Error('Atlas hierarchy: orphan for '+id+' at '+current);
  path.push(current);
  const parent=parentId(nodeById,current);
  if(parent!==null&&!nodeById.get(parent)?.child_ids?.includes(current))throw new Error('Atlas hierarchy: inconsistent parent for '+id+' at '+current);
  current=parent;
 }
 path.reverse();
 if(!rootIds.includes(path[0]))throw new Error('Atlas hierarchy: invalid root for '+id);
 return path;
}

// Pure semantic labels: hierarchy roles describe identity, not geometry visibility.
export function treeRoleLabel(node,typeLabel=String){
 const administrative=node.display_type==='state'?'stat':typeLabel(node.display_type);
 if(!node.roles?.includes('statistical'))return administrative;
 const level=Number(node.statistical_level);
 const statistical=Number.isInteger(level)&&level>=1&&level<=3
  ?(node.jurisdiction==='RO'?'NUTS '+level:'nivel statistic '+level)
  :'rol statistic';
 return node.roles.some(role=>role!=='statistical')
  ?administrative+' · '+statistical
  :statistical+' · limită statistică separată';
}

// Only peers under the same parent need an additional visible identifier.
export function ambiguousSiblingIds(nodeById){
 const seen=new Map(),ambiguous=new Set();
 for(const node of nodeById.values()){
  const key=(node.parent_id??'ROOT')+'\\0'+formatEntityName(node.display_name).toLocaleLowerCase('ro-RO');
  const previous=seen.get(key);
  if(previous){ambiguous.add(previous);ambiguous.add(node.id);}
  else seen.set(key,node.id);
 }
 return ambiguous;
}

// Deterministic descendant counts, computed once without expanding the DOM.
export function countDescendants(nodeById,rootIds){
 const counts=new Map(),seen=new Set(),pending=rootIds.map(id=>[id,false]);
 while(pending.length){
  const [id,finished]=pending.pop(),node=nodeById.get(id);
  if(!node)throw new Error('Atlas hierarchy: missing node '+id);
  if(finished){
   counts.set(id,(node.child_ids||[]).reduce((sum,child)=>sum+1+(counts.get(child)||0),0));
   continue;
  }
  if(seen.has(id))continue;
  seen.add(id);pending.push([id,true]);
  for(const child of node.child_ids||[])pending.push([child,false]);
 }
 return counts;
}

// Scroll only the tree container. Native scrollIntoView also scrolls outer panels.
export function revealInTree(container,button){
 if(!container.getBoundingClientRect||!button.getBoundingClientRect)return;
 const viewport=container.getBoundingClientRect(),row=button.getBoundingClientRect();
 const top=viewport.top+(container.clientTop||0),bottom=top+container.clientHeight;
 if(row.top>=top&&row.bottom<=bottom)return;
 container.scrollTop+=row.top-top-(container.clientHeight-row.height)/2;
}

export function createAtlasTree({container,nodeById,rootIds,document,onSelect,onDisclosureChange=()=>{},isGeometryAvailable=()=>true,isGeometryVisible=()=>true,isEntityChecked=isGeometryVisible,onVisibilityChange=()=>{},getOsmAdminLevel=()=>null,visibleIds=null}){
 const openIds=new Set(rootIds.filter(id=>hasChildren(nodeById,id))),rendered=new Map();
 const view=document.defaultView||globalThis;
 const layout=createTreeWindow(flattenVisibleTree(nodeById,rootIds,openIds,visibleIds));
 let selected=null,active=rootIds[0],column=2,frame=null,width=0,destroyed=false;
 container.innerHTML='';container.setAttribute('role','treegrid');container.setAttribute('aria-label','Entități teritoriale');container.setAttribute('aria-colcount','3');
 const canvas=document.createElement('div');canvas.className='tree-window';container.appendChild(canvas);
 function style(element,name,value){if(element.style)element.style[name]=value;}
 function anchor(){const index=layout.indexAt(container.scrollTop||0);return {id:layout.rows[index]?.id,within:(container.scrollTop||0)-layout.offset(index)};}
 function restoreAnchor(saved){const index=layout.indexOf(saved.id);if(index>=0)container.scrollTop=Math.max(0,layout.offset(index)+saved.within);}
 function controls(entry){return [entry.toggle,entry.checkbox,entry.button];}
 function focused(){for(const [id,entry] of rendered){const col=controls(entry).indexOf(document.activeElement);if(col>=0)return {id,col};}return null;}
 function schedule(){if(destroyed||frame!==null)return;if(view.requestAnimationFrame)frame=view.requestAnimationFrame(()=>{frame=null;render();});else render();}
 function alignRow(id){const index=layout.indexOf(id);if(index<0)return;const top=layout.offset(index),bottom=top+layout.height(index),height=container.clientHeight||300;
  if(top<(container.scrollTop||0)||layout.height(index)>height)container.scrollTop=top;else if(bottom>(container.scrollTop||0)+height)container.scrollTop=Math.max(0,bottom-height);}
 function show(id){if(layout.indexOf(id)<0)return;alignRow(id);render();
  // Explicit navigation must settle wrapped visible rows before its final scroll.
  // This bounded read batch uses the same height model as ResizeObserver.
  let changed=false;for(const [rowId,entry] of rendered)if(layout.measure(rowId,entry.outer.getBoundingClientRect?.().height))changed=true;
  if(changed){layout.remeasure();render();}alignRow(id);render();}
 function focusRow(id,col){active=id;column=col;show(id);const entry=rendered.get(id);if(entry.checkbox.disabled&&col===1)col=2;column=col;const control=controls(entry)[col];control.focus?.({preventScroll:true});
  // Keyboard navigation must reveal the target through every clipping ancestor.
  // Selection alone still scrolls only the virtual tree; enlarged text can make
  // its host overflow the contextual panel, which the height model cannot see.
  control.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});}
 function rebuild(){const saved=anchor(),focus=focused();layout.reset(flattenVisibleTree(nodeById,rootIds,openIds,visibleIds));
  if(layout.indexOf(active)<0){let id=active;while(id&&layout.indexOf(id)<0)id=nodeById.get(id)?.parent_id;active=id||layout.rows[0]?.id;}
  restoreAnchor(saved);render();if(focus&&layout.indexOf(focus.id)<0&&active)focusRow(active,focus.col);}
 function toggle(id){if(!hasChildren(nodeById,id))return;if(openIds.has(id))openIds.delete(id);else openIds.add(id);rebuild();onDisclosureChange();}
 function keydown(event,id,col){const index=layout.indexOf(id);let target=index,nextColumn=col;
  switch(event.key){
   case 'ArrowDown':target=Math.min(layout.rows.length-1,index+1);break;
   case 'ArrowUp':target=Math.max(0,index-1);break;
   case 'ArrowRight':nextColumn=Math.min(2,col+1);if(nextColumn===1&&rendered.get(id)?.checkbox.disabled)nextColumn=2;break;
   case 'ArrowLeft':nextColumn=Math.max(0,col-1);if(nextColumn===1&&rendered.get(id)?.checkbox.disabled)nextColumn=0;break;
   case 'Home':if(event.ctrlKey)target=0;else nextColumn=0;break;
   case 'End':if(event.ctrlKey)target=layout.rows.length-1;else nextColumn=2;break;
   case 'PageDown':target=layout.indexAt(layout.offset(index)+(container.clientHeight||300));break;
   case 'PageUp':target=layout.indexAt(Math.max(0,layout.offset(index)-(container.clientHeight||300)));break;
   default:return;
  }
  event.preventDefault();event.stopPropagation();if(layout.rows[target])focusRow(layout.rows[target].id,nextColumn);
 }
 function make(id){const node=nodeById.get(id),name=compactTreeName(node),branch=hasChildren(nodeById,id),statistical=node.roles?.includes('statistical'),coalesced=statistical&&node.roles.some(role=>role!=='statistical');
  const outer=document.createElement('div');outer.dataset.entityId=id;outer.className='tree-node '+(branch?'tree-branch':'tree-leaf')+' '+(coalesced?'tree-coalesced':statistical?'tree-statistical-only':'tree-administrative');outer.setAttribute('role','row');
  const disclosure=document.createElement('div');disclosure.setAttribute('role','gridcell');disclosure.setAttribute('aria-colindex','1');
  const toggleButton=branch?document.createElement('button'):disclosure;toggleButton.className='tree-toggle';toggleButton.dataset.entityId=id;toggleButton.setAttribute('aria-label',branch?'Extinde sau restrânge '+name:'Fără subniveluri: '+name);if(branch){toggleButton.type='button';toggleButton.addEventListener('click',()=>toggle(id));}if(branch)disclosure.appendChild(toggleButton);
  const visibility=document.createElement('div');visibility.setAttribute('role','gridcell');visibility.setAttribute('aria-colindex','2');
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.className='tree-visibility-toggle';checkbox.dataset.entityId=id;checkbox.disabled=!isGeometryAvailable(id);checkbox.setAttribute('aria-label','Afișează geometria pentru '+name);checkbox.addEventListener('change',()=>onVisibilityChange(id,checkbox.checked));visibility.appendChild(checkbox);
  const heading=document.createElement('div');heading.setAttribute('role','rowheader');heading.setAttribute('aria-colindex','3');
  const button=document.createElement('button');button.type='button';button.className='tree-select';button.dataset.entityId=id;button.title=name==='Entitate fără nume'?name:formatEntityName(node.display_name);button.setAttribute('aria-label','Selectează '+name);
  const documentaryContext=nistreniaTreeContext(node);if(documentaryContext)for(const control of [toggleButton,checkbox,button])control.setAttribute('aria-description',documentaryContext);
  const svg=document.createElementNS?document.createElementNS('http://www.w3.org/2000/svg','svg'):document.createElement('svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','tree-kind-icon');
  const shape=document.createElementNS?document.createElementNS('http://www.w3.org/2000/svg','path'):document.createElement('path');
  const path=node.parent_id===null?'M10 2a8 8 0 1 0 0 16a8 8 0 1 0 0-16M2 10h16M10 2c-4 4-4 12 0 16M10 2c4 4 4 12 0 16':statistical?'M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z':branch?'M3 4h5l2 3h7v10H3z':'M10 18l-5-8a6 6 0 1 1 10 0zM8 7h4';
  shape.setAttribute('d',path);shape.setAttribute('fill','none');shape.setAttribute('stroke','currentColor');shape.setAttribute('stroke-width','1.4');svg.appendChild(shape);button.appendChild(svg);
  const osmBadge=createOsmLevelBadge(document,getOsmAdminLevel(node));
  if(osmBadge){button.appendChild(osmBadge);button.setAttribute('aria-label','Selectează '+name+' · Nivel administrativ OSM '+osmBadge.textContent);}
  const label=document.createElement('span');label.className='tree-name';label.textContent=name;button.appendChild(label);button.addEventListener('click',()=>onSelect(id,{zoom:true,source:'tree'}));heading.appendChild(button);
  outer.appendChild(disclosure);outer.appendChild(visibility);outer.appendChild(heading);
  const entry={outer,wrapper:outer,button,checkbox,toggle:toggleButton,visibilityValue:null,updateVisibility(){const checked=Boolean(isEntityChecked(id)),shown=Boolean(isGeometryVisible(id)),changed=this.visibilityValue!==shown||checkbox.checked!==checked;this.visibilityValue=shown;checkbox.checked=checked;outer.classList.toggle('tree-geometry-hidden',!shown);checkbox.title=checkbox.disabled?'Fără contur propriu certificat; detaliile administrative rămân disponibile.':checked&&!shown?'Geometrie bifată, dar ascunsă de filtre: '+name:'Afișează sau ascunde geometria: '+name;return changed;}};
  controls(entry).forEach((control,col)=>{control.addEventListener('focus',()=>{active=id;column=col;updateTabStops();});control.addEventListener('keydown',event=>keydown(event,id,col));});entry.updateVisibility();observer?.observe(outer);return entry;
 }
 function updateTabStops(){for(const [id,entry] of rendered)controls(entry).forEach(control=>control.tabIndex=id===active&&!control.disabled?0:-1);}
 function render(){if(destroyed)return;const focus=focused(),range=layout.range(container.scrollTop||0,container.clientHeight||300),ids=new Set(layout.rows.slice(range.start,range.end).map(row=>row.id));
  if(focus&&layout.indexOf(focus.id)>=0)ids.add(focus.id);
  if(selected&&layout.indexOf(selected)>=0)ids.add(selected);
  if(!focus&&!ids.has(active))active=layout.rows[range.start]?.id;
  for(const [id,entry] of rendered)if(!ids.has(id)){observer?.unobserve(entry.outer);entry.outer.remove();rendered.delete(id);}
  container.setAttribute('aria-rowcount',String(layout.rows.length));style(canvas,'height',layout.totalHeight+'px');
  for(const id of ids){let entry=rendered.get(id);if(!entry){entry=make(id);rendered.set(id,entry);canvas.appendChild(entry.outer);}const index=layout.indexOf(id),row=layout.rows[index],branch=hasChildren(nodeById,id);
   style(entry.outer,'transform','translateY('+layout.offset(index)+'px)');style(entry.outer,'paddingInlineStart',(row.depth*8)+'px');
   entry.outer.setAttribute('aria-rowindex',String(index+1));entry.outer.setAttribute('aria-level',String(row.depth+1));entry.outer.setAttribute('aria-posinset',String(row.pos));entry.outer.setAttribute('aria-setsize',String(row.size));
   if(branch){entry.outer.setAttribute('aria-expanded',String(openIds.has(id)));entry.toggle.textContent=openIds.has(id)?'−':'+';}
   entry.button.classList.toggle('selected',id===selected);entry.button.setAttribute('aria-pressed',String(id===selected));
   if(id===selected)entry.outer.setAttribute('aria-selected','true');else entry.outer.removeAttribute?.('aria-selected');entry.updateVisibility();
  }
  // Keep accessibility order aligned with logical row order even on reverse scroll.
  if(canvas.insertBefore){
   let cursor=canvas.firstChild;
   for(const id of [...ids].sort((a,b)=>layout.indexOf(a)-layout.indexOf(b))){
    const row=rendered.get(id).outer;
    if(row===cursor)cursor=cursor.nextSibling;
    else if(canvas.moveBefore)canvas.moveBefore(row,cursor);
    else canvas.insertBefore(row,cursor);
   }
   // A History collapse can remove the previously focused descendant.
   // rebuild() moves focus to its surviving ancestor after this render.
   const retainedFocus=focus?rendered.get(focus.id):null;
   if(retainedFocus&&document.activeElement!==controls(retainedFocus)[focus.col])controls(retainedFocus)[focus.col].focus?.({preventScroll:true});
  }
  updateTabStops();
 }
 const observer=view.ResizeObserver?new view.ResizeObserver(entries=>{const saved=anchor();let changed=false;
  for(const entry of entries){if(entry.target===container){const next=entry.contentRect.width;if(next>0&&Math.abs(next-width)>0.5){width=next;layout.invalidate();changed=true;}}else if(layout.measure(entry.target.dataset.entityId,entry.borderBoxSize?.[0]?.blockSize||entry.target.getBoundingClientRect().height))changed=true;}
  if(changed){layout.remeasure();restoreAnchor(saved);}schedule();
 }):null;
 observer?.observe(container);container.addEventListener('scroll',schedule,{passive:true});render();
 return {
  select(id){const path=ancestorPath(nodeById,rootIds,id);for(const ancestor of path.slice(0,-1))openIds.add(ancestor);selected=id;active=id;rebuild();show(id);return path;},
  revealSelected(){if(selected)show(selected);},
  reveal(id){show(id);},
  clear(){selected=null;render();},
  getOpenIds:()=>[...openIds].sort(),isOpen:id=>openIds.has(id),
  setOpenIds(ids){const requested=new Set();for(const id of ids)if(nodeById.get(id)?.child_ids?.length){ancestorPath(nodeById,rootIds,id);requested.add(id);}openIds.clear();for(const id of requested)openIds.add(id);rebuild();},
  toggle,
  setVisibleIds(ids){visibleIds=ids;rebuild();},
  refreshVisibility(){let changed=0;for(const entry of rendered.values())if(entry.updateVisibility())changed++;return changed;},
  getRenderedCount:()=>rendered.size,getVisibleCount:()=>layout.rows.length,getVisibleIds:()=>layout.rows.map(row=>row.id),getNode:id=>rendered.get(id),
  openToDepth(value,{nodeBudget=550}={}){const depth=Number(value);if(!Number.isInteger(depth)||depth<0||depth>3)throw new RangeError('Atlas hierarchy: invalid expansion depth '+value);const requested=new Set(),pending=rootIds.map(id=>[id,0]);while(pending.length){const [id,level]=pending.pop();if(level>=depth||!hasChildren(nodeById,id))continue;requested.add(id);for(const child of nodeById.get(id).child_ids)pending.push([child,level+1]);}const count=flattenVisibleTree(nodeById,rootIds,requested).length;if(count>nodeBudget)return {applied:false,renderedNodes:count};this.setOpenIds(requested);return {applied:true,renderedNodes:count,openBranches:requested.size};},
  destroy(){destroyed=true;observer?.disconnect();if(frame!==null)view.cancelAnimationFrame?.(frame);container.removeEventListener?.('scroll',schedule);},
  get selectedId(){return selected;}
 };
}
