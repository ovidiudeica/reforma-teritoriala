import {formatEntityName} from './atlas-name-format.mjs';
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

// Scroll only the tree container. Native scrollIntoView also scrolls outer panels.
export function revealInTree(container,button){
 if(!container.getBoundingClientRect||!button.getBoundingClientRect)return;
 const viewport=container.getBoundingClientRect(),row=button.getBoundingClientRect();
 const top=viewport.top+(container.clientTop||0),bottom=top+container.clientHeight;
 if(row.top>=top&&row.bottom<=bottom)return;
 container.scrollTop+=row.top-top-(container.clientHeight-row.height)/2;
}

export function createAtlasTree({container,nodeById,rootIds,document,onSelect,onDisclosureChange=()=>{},typeLabel=String}){
 const rendered=new Map(),openIds=new Set(),ambiguous=ambiguousSiblingIds(nodeById);
 function setOpen(id,value){const entry=rendered.get(id);if(!entry)return;entry.wrapper.open=value;if(value)openIds.add(id);else openIds.delete(id);}
 let selected=null;
 function mark(id,value){
  const button=rendered.get(id)?.button;
  if(!button)return;
  button.classList.toggle('selected',value);
  button.setAttribute('aria-pressed',String(value));
 }
 function makeNode(id){
  if(rendered.has(id))throw new Error('Atlas hierarchy: duplicate node '+id);
  const node=nodeById.get(id);
  if(!node)throw new Error('Atlas hierarchy: missing node '+id);
  const branch=hasChildren(nodeById,id);
  const outer=document.createElement('div');
  const statistical=node.roles?.includes('statistical');
  const coalesced=statistical&&node.roles.some(role=>role!=='statistical');
  outer.className='tree-node'+(branch?' tree-branch':' tree-leaf')+
   (coalesced?' tree-coalesced':statistical?' tree-statistical-only':' tree-administrative');
  const wrapper=branch?document.createElement('details'):outer;
  if(branch)wrapper.className='tree-disclosure';
  if(branch){
   const summary=document.createElement('summary');
   summary.className='tree-toggle';
   summary.setAttribute('aria-label','Extinde sau restrânge '+formatEntityName(node.display_name));
   wrapper.appendChild(summary);
  }
  const button=document.createElement('button');
  button.type='button';button.className='tree-select';button.dataset.entityId=id;
  const name=formatEntityName(node.display_name),role=treeRoleLabel(node,typeLabel);
  const parentName=node.parent_id?formatEntityName(nodeById.get(node.parent_id)?.display_name):'';
  const duplicate=ambiguous.has(id);
  const label=document.createElement('span');label.className='tree-name';label.textContent=name;button.appendChild(label);
  const secondary=document.createElement('span');secondary.className='tree-role';secondary.textContent=role;
  if(node.statistical_code){
   const code=document.createElement('span');code.className='tree-code';code.textContent=node.statistical_code;
   secondary.appendChild(code);
  }
  if(duplicate){
   const identifier=document.createElement('span');identifier.className='tree-identity';
   identifier.textContent=' · '+id;secondary.appendChild(identifier);
  }
  button.appendChild(secondary);
  const description=[name,role,node.statistical_code,duplicate?'ID '+id:null,parentName?'în '+parentName:null].filter(Boolean).join(' · ');
  button.title=description;
  button.setAttribute('aria-label',description);
  button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>onSelect(id,{zoom:true,source:'tree'}));
  outer.appendChild(button);
  if(branch)outer.appendChild(wrapper);
  let children=null;
  const ensureChildren=()=>{
   if(!branch||children)return;
   children=document.createElement('div');children.className='tree-children';
   for(const child of node.child_ids)children.appendChild(makeNode(child));
   wrapper.appendChild(children);
  };
  rendered.set(id,{wrapper,button,ensureChildren});
  if(branch){
   wrapper.addEventListener('toggle',()=>{if(wrapper.open)ensureChildren();const changed=openIds.has(id)!==wrapper.open;if(wrapper.open)openIds.add(id);else openIds.delete(id);if(changed)onDisclosureChange();});
   if(rootIds.includes(id)){setOpen(id,true);ensureChildren();}
  }
  return outer;
 }
 container.innerHTML='';
 for(const root of rootIds)container.appendChild(makeNode(root));
 return {
  select(id){
   // Validate before touching the DOM; malformed paths cannot leave half a selection.
   const path=ancestorPath(nodeById,rootIds,id);
   for(const ancestor of path.slice(0,-1)){
    const entry=rendered.get(ancestor);
    entry.ensureChildren();setOpen(ancestor,true);
   }
   if(selected!==id){mark(selected,false);selected=id;mark(id,true);}
   revealInTree(container,rendered.get(id).button);
   return path;
  },
  revealSelected(){if(selected)revealInTree(container,rendered.get(selected).button);},
  clear(){mark(selected,false);selected=null;},
  getOpenIds:()=>[...openIds].sort(),
  setOpenIds(ids){
   for(const [id,entry] of rendered)if(entry.wrapper.tagName==='DETAILS')setOpen(id,false);
   for(const id of new Set(ids)){
    if(!nodeById.get(id)?.child_ids?.length)continue;
    const path=ancestorPath(nodeById,rootIds,id);
    for(const ancestor of path.slice(0,-1))rendered.get(ancestor).ensureChildren();
    rendered.get(id).ensureChildren();setOpen(id,true);
   }
  },
  getNode:id=>rendered.get(id),
  get selectedId(){return selected;}
 };
}
