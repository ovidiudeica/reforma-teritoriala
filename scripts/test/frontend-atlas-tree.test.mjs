import {formatEntityName} from '../../atlas-name-format.mjs';
import {compactTreeName} from '../../atlas-tree-labels.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ancestorPath,parentId,hasChildren,createAtlasTree,revealInTree,treeRoleLabel,ambiguousSiblingIds,countDescendants} from '../../atlas-tree.mjs';
import {typeLabel} from '../../atlas-search.mjs';
import {geometryClass} from '../../geometry-taxonomy.mjs';
const tree=JSON.parse(await readFile('public/data/actual-consolidated-tree.json','utf8'));
const index=JSON.parse(await readFile('public/data/actual-entities.json','utf8'));
const nodes=new Map(tree.nodes.map(n=>[n.id,n]));
const entities=new Map(index.entities.map(e=>[e.id,e]));
const deep=tree.nodes.find(n=>n.depth===5&&n.jurisdiction==='MD');

// Minimal event-capable DOM: no dependencies and no string/regex selection tests.
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.listeners={};this.classes=new Set();this.checked=true;this.scrollTop=0;this.clientTop=0;this.clientHeight=100;this._text='';this._html='';this._open=false;}
 set className(v){this.classes=new Set(v.split(' '));} get className(){return [...this.classes].join(' ');}
 classList={toggle:(name,on)=>{if(on)this.classes.add(name);else this.classes.delete(name);},contains:name=>this.classes.has(name)};
 set textContent(v){this._text=v;this.children=[];} get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set innerHTML(v){this._html=v;this._text='';this.children=[];} get innerHTML(){return this._html;}
 set open(value){if(this._open===value)return;this._open=value;this.togglePending=true;} get open(){return this._open;}
 appendChild(child){this.children.push(child);child.parentElement=this;return child;}
 setAttribute(k,v){this.attributes[k]=v;} getAttribute(k){return this.attributes[k]??null;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 async dispatch(k){for(const fn of this.listeners[k]??[])await fn({target:this,preventDefault(){},stopPropagation(){}});}
 async click(){await this.dispatch('click');}
 descendants(){return this.children.flatMap(c=>[c,...c.descendants()]);}
 querySelectorAll(selector){return this.descendants().filter(c=>selector==='[aria-pressed="true"]'?c.getAttribute('aria-pressed')==='true':selector==='button'?c.tagName==='BUTTON':selector==='nav'?c.tagName==='NAV':selector==='details'?c.tagName==='DETAILS':selector==='.tree-select'?c.classes.has('tree-select'):false);}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 getBoundingClientRect(){return this.rect??{top:0,bottom:30,height:30};}
}
const documentFactory=()=>{
 const elements=new Map();
 return {elements,getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:tag=>new Element(tag),querySelectorAll:()=>[]};
};
function harness(){const document=documentFactory(),container=new Element();return {document,container,controller:createAtlasTree({document,container,nodeById:nodes,rootIds:tree.root_ids,typeLabel,onSelect(){}})};}

test('all 5848 consolidated paths are rooted, reciprocal, unique and match public parents',()=>{
 assert.equal(nodes.size,5848);assert.equal(entities.size,5848);
 for(const node of nodes.values()){
  const path=ancestorPath(nodes,tree.root_ids,node.id);
  assert.ok(tree.root_ids.includes(path[0]));assert.equal(path.at(-1),node.id);
  assert.equal(new Set(path).size,path.length);assert.equal(path.length,node.depth+1);
  assert.equal(parentId(nodes,node.id),entities.get(node.id).hierarchy.consolidated_parent_id);
  assert.equal(hasChildren(nodes,node.id),node.child_ids.length>0);
 }
});

test('P5.2.1 all 63 statistical identities survive with no metadata in menu',()=>{
 const {controller}=harness(),stats=tree.nodes.filter(n=>n.roles?.includes('statistical'));
 assert.equal(stats.length,63);assert.equal(stats.filter(n=>n.roles.length===1).length,18);
 assert.equal(stats.filter(n=>n.roles.some(r=>r!=='statistical')).length,45);
 for(const node of stats){assert.ok(treeRoleLabel(node,typeLabel));controller.select(node.id);const entry=controller.getNode(node.id);
  assert.equal(entry.button.textContent,compactTreeName(node));assert.equal(entry.button.dataset.entityId,node.id);
  assert.equal(entry.checkbox.dataset.entityId,node.id);assert.equal(entry.button.title,formatEntityName(node.display_name));
  assert.ok(!entry.button.textContent.includes(node.statistical_code||'invalid-code'));
  assert.ok(entry.outer.classList.contains(node.roles.length===1?'tree-statistical-only':'tree-coalesced'));
 }
});

test('duplicate sibling names preserve distinct per-ID controls and official identity',()=>{
 const root={id:'root',parent_id:null,child_ids:['a','b'],display_name:'ROMÂNIA',display_type:'state'};
 const a={id:'a',parent_id:'root',child_ids:[],display_name:'ALBEȘTI'};
 const b={id:'b',parent_id:'root',child_ids:[],display_name:'ALBEȘTI'};
 const fixture=new Map([root,a,b].map(n=>[n.id,n]));
 assert.deepEqual([...ambiguousSiblingIds(fixture)].sort(),['a','b']);
 const document=documentFactory(),container=new Element(),ctrl=createAtlasTree({document,container,nodeById:fixture,rootIds:['root'],onSelect(){}});
 for(const id of ['a','b']){const e=ctrl.getNode(id);
  assert.equal(e.button.textContent,'Albești');assert.equal(e.button.dataset.entityId,id);
  assert.equal(e.checkbox.dataset.entityId,id);assert.equal(e.button.getAttribute('aria-label'),'Selectează Albești');
 }
 ctrl.select('b');assert.equal(ctrl.selectedId,'b');assert.equal(fixture.get('a').display_name,'ALBEȘTI');
});

test('known RO/MD hierarchy examples include coalesced MD114/MD115 and official MD120',()=>{
 for(const [jurisdiction,type] of [['RO','county'],['RO','municipality'],['RO','sector'],['MD','district'],['MD','local_uat'],['MD','component_locality']]){
  const node=tree.nodes.find(n=>n.jurisdiction===jurisdiction&&(n.display_type===type||entities.get(n.id).representation.inferred_type===type||geometryClass(entities.get(n.id))===type));
  assert.ok(node,jurisdiction+' '+type);assert.equal(ancestorPath(nodes,tree.root_ids,node.id).length,node.depth+1);
 }
 for(const code of ['MD114','MD115','MD120']){
  const node=tree.nodes.find(n=>n.statistical_code===code);assert.ok(node);
  assert.equal(ancestorPath(nodes,tree.root_ids,node.id)[0],'osm-r58974');
 }
 assert.deepEqual(ancestorPath(nodes,tree.root_ids,'stat-MD120'),['osm-r58974','stat-MD12','stat-MD120']);
});

test('P3.2 counts descendants once from the complete 5848-node contract without DOM expansion',()=>{
 const counts=countDescendants(nodes,tree.root_ids);
 assert.equal(counts.size,5848);
 for(const root of tree.root_ids){
  const members=tree.nodes.filter(n=>n.jurisdiction===nodes.get(root).jurisdiction).length;
  assert.equal(counts.get(root),members-1);
 }
 for(const node of nodes.values()){
  if(!node.child_ids.length)assert.equal(counts.get(node.id),0);
  else assert.equal(counts.get(node.id),node.child_ids.reduce((sum,id)=>sum+1+counts.get(id),0));
 }
 const {controller}=harness();
 assert.ok(controller.getRenderedCount()<100,'only roots and immediate children are initially rendered');
 const root=controller.getNode(tree.root_ids[0]);
 assert.equal(root.button.textContent,compactTreeName(nodes.get(tree.root_ids[0])));
});

test('P3.2 bounded levels, root reset and collapse retain selection, URL-ready open IDs',()=>{
 const {controller,container}=harness();
 const level=controller.openToDepth(3);
 assert.equal(level.applied,true);
 assert.ok(level.renderedNodes<=550);
 assert.ok(controller.getRenderedCount()<=550);
 assert.ok(controller.getOpenIds().length>tree.root_ids.length);
 assert.deepEqual([...new Set(container.querySelectorAll('.tree-select').map(e=>e.dataset.entityId))].length,container.querySelectorAll('.tree-select').length);
 const before=controller.getOpenIds(),rendered=controller.getRenderedCount();
 assert.deepEqual(controller.openToDepth(3,{nodeBudget:1}),{applied:false,renderedNodes:level.renderedNodes});
 assert.deepEqual(controller.getOpenIds(),before,'failed bounded expansion changes no disclosure state');
 assert.equal(controller.getRenderedCount(),rendered,'no additional DOM allocated when blocked');
 controller.select(deep.id);
 controller.setOpenIds(tree.root_ids);
 assert.deepEqual(controller.getOpenIds(),[...tree.root_ids].sort());
 assert.equal(controller.selectedId,deep.id,'selected identity survives root reset');
 controller.setOpenIds([]);
 assert.deepEqual(controller.getOpenIds(),[]);
 assert.equal(controller.selectedId,deep.id);
 assert.equal(container.querySelectorAll('[aria-pressed="true"]').length,1);
 assert.throws(()=>controller.openToDepth(4),/invalid expansion depth/);
});

test('checkbox intent survives global geometry filters and lazy rendering',()=>{
 let visible=true;const document=documentFactory(),container=new Element();
 const ctrl=createAtlasTree({document,container,nodeById:nodes,rootIds:tree.root_ids,isEntityChecked:()=>true,isGeometryVisible:()=>visible,onSelect(){}});
 const initial=ctrl.getRenderedCount();assert.ok(initial<100);
 visible=false;assert.equal(ctrl.refreshVisibility(),initial);
 const root=ctrl.getNode(tree.root_ids[0]);
 assert.equal(root.checkbox.checked,true);assert.match(root.checkbox.title,/ascunsă de filtre/);
 assert.equal(root.outer.classList.contains('tree-geometry-hidden'),true);assert.equal(ctrl.refreshVisibility(),0);
 ctrl.select(deep.id);const n=ctrl.getRenderedCount();assert.ok(n>initial&&n<5848);
 visible=true;assert.equal(ctrl.refreshVisibility(),n);
 assert.equal(root.checkbox.checked,true);assert.equal(root.outer.classList.contains('tree-geometry-hidden'),false);
 assert.equal(ctrl.selectedId,deep.id);
});

test('malformed paths fail with entity IDs, without looping or replacing selection',()=>{
 assert.throws(()=>ancestorPath(nodes,tree.root_ids,'missing'),/missing/);
 const cycle=new Map([['a',{parent_id:'b',child_ids:['b']}],['b',{parent_id:'a',child_ids:['a'] }]]);
 assert.throws(()=>ancestorPath(cycle,['a'],'a'),/cycle.*a/);
 assert.throws(()=>ancestorPath(new Map([['a',{parent_id:'missing'}]]),['root'],'a'),/parent.*a/);
 const {controller}=harness();controller.select(deep.id);
 assert.throws(()=>controller.select('missing'),/missing/);assert.equal(controller.selectedId,deep.id);
});

test('lazy depth 4/5 materialization opens ancestors synchronously and selection/clear preserve branches',async()=>{
 const {container,controller}=harness();assert.ok(container.querySelectorAll('.tree-select').length<100);
 for(const node of [tree.nodes.find(n=>n.depth===4&&n.jurisdiction==='RO'),deep]){
  assert.equal(controller.getNode(node.id),undefined);
  const path=controller.select(node.id);
  for(const id of path.slice(0,-1))assert.equal(controller.getNode(id).wrapper.open,true);
  assert.ok(controller.getNode(node.id).button);
  assert.equal(container.querySelectorAll('[aria-pressed="true"]').length,1);
  assert.equal(controller.getNode(node.id).button.getAttribute('aria-pressed'),'true');
  // Browser toggle events are deferred: materialization cannot depend on them.
  for(const item of container.querySelectorAll('details'))await item.dispatch('toggle');
 }
 const open=container.querySelectorAll('details').filter(e=>e.open);
 controller.clear();assert.equal(container.querySelectorAll('[aria-pressed="true"]').length,0);
 assert.ok(open.every(e=>e.open));
});

test('closed native disclosure keeps selection outside its hidden content and summary independent',async()=>{
 const {controller}=harness();
 const root=controller.getNode(tree.root_ids[0]);
 root.wrapper.open=false;
 assert.equal(root.wrapper.tagName,'DETAILS');
 assert.equal(root.button.parentElement.tagName,'DIV');
 assert.equal(root.wrapper.parentElement,root.button.parentElement);
 assert.equal(root.wrapper.children[0].tagName,'SUMMARY');
 assert.equal(root.wrapper.children[0].querySelectorAll('button').length,0);
 await root.wrapper.children[0].click();
 assert.equal(controller.selectedId,null);
});

test('scroll touches only the tree, is skipped for visible rows, and repeated selection does not jitter',()=>{
 const container=new Element(),button=new Element();container.rect={top:10,bottom:110,height:100};
 button.rect={top:40,bottom:70,height:30};revealInTree(container,button);assert.equal(container.scrollTop,0);
 button.rect={top:200,bottom:230,height:30};revealInTree(container,button);assert.equal(container.scrollTop,155);
 button.rect={top:45,bottom:75,height:30};revealInTree(container,button);assert.equal(container.scrollTop,155);
});

test('all 45 coalesced administrative/statistical entities have one representation',()=>{
 const {controller,container}=harness();
 const reused=index.entities.filter(e=>e.category!=='statistical'&&e.roles.includes('statistical'));
 assert.equal(reused.length,45);
 for(const entity of reused)controller.select(entity.id);
 const ids=container.querySelectorAll('.tree-select').map(b=>b.dataset.entityId);
 assert.equal(new Set(ids).size,ids.length);
 for(const entity of reused)assert.equal(ids.filter(id=>id===entity.id).length,1);
});

test('real frontend controller synchronizes map/search/tree/breadcrumb/details and hidden selection/clear',async()=>{
 const document=documentFactory(),fitBounds=[],layers=[],groups=[];
 const group=()=>{const result={layers:[],clearLayers(){this.layers=[];},addLayer(l){this.layers.push(l);},hasLayer(l){return this.layers.includes(l);},removeLayer(l){this.layers=this.layers.filter(x=>x!==l);},addTo(){return this;},eachLayer(fn){this.layers.forEach(fn);}};groups.push(result);return result;};
 const liveLayers=()=>{const walk=g=>g.layers.flatMap(l=>l.layers?walk(l):[l]);return groups.slice(0,2).flatMap(walk);};
 const L={map:()=>({setView(){return this;},fitBounds(...args){fitBounds.push(args);},getZoom:()=>12,on(){}}),tileLayer:()=>({addTo(){}}),control:{scale:()=>({addTo(){}})},layerGroup:group,
  geoJSON:(data,config)=>{const result=group();for(const feature of data.features.filter(config.filter)){
   const layer={feature,handlers:{},bindTooltip(){return this;},on(event,fn){this.handlers[event]=fn;},setStyle(style){this.style=style;}};
   config.onEachFeature(feature,layer);result.addLayer(layer);layers.push(layer);
  }result.addTo=target=>{target.addLayer(result);return result;};return result;}
 };
 const manifest={snapshot_id:'fixture',public_contract:{contract:index.contract,path:'index',entity_count:5848,hierarchy:{path:'tree'},geometry_tiers:Object.fromEntries(['RO','MD'].map(j=>[j,Object.fromEntries(['overview','local','detail'].map(t=>[t,{path:j+'/'+t}]))])),statistical_geometry:{RO:{path:'RO/stat'},MD:{path:'MD/stat'}}}};
 let resolveHierarchy,notifyHierarchy;
 const hierarchyRequested=new Promise(resolve=>{notifyHierarchy=resolve;});
 const hierarchyPayload=new Promise(resolve=>{resolveHierarchy=resolve;});
 const fetch=async path=>({ok:true,json:async()=>{
  if(path==='data/current/actual-release-manifest.json')return manifest;
  if(path==='data/current/actual-release-gate.json')return {status:'PASS',snapshot_id:'fixture'};
  if(path==='public/data/app-build-info.json')return null;
  if(path==='index')return index;if(path==='tree'){notifyHierarchy();return hierarchyPayload;}
  const [jurisdiction,tier]=path.split('/');
  const found=index.entities.filter(e=>e.jurisdiction===jurisdiction&&(tier==='stat'?e.category==='statistical':e.category!=='statistical'&&e.map.tier===tier));
  return {metadata:tier==='stat'?{contract:'actual-public-statistical-geometry-v1',jurisdiction}:{jurisdiction,tier},features:found.map(e=>({properties:{entity_id:e.id}}))};
 }});
 const previous={document:globalThis.document,L:globalThis.L,fetch:globalThis.fetch};
 try{
  Object.assign(globalThis,{document,L,fetch});const app=await import('../../app.js?atlas-tests');
  await hierarchyRequested;
  // Search is already wired while the lazy hierarchy request is still pending.
  app.activeFilterGroups.delete(geometryClass(entities.get(deep.id)));
  await app.selectEntity(deep.id,{source:'search'});
  assert.equal(app.selectedEntityId,deep.id);
  resolveHierarchy(tree);await app.frontendReady;
  const container=document.getElementById('hierarchy-tree'),body=document.getElementById('details-body');
  const assertSelection=id=>{
   assert.equal(app.selectedEntityId,id);assert.equal(document.getElementById('details-title').textContent,formatEntityName(entities.get(id).display_name));
   const selected=container.querySelectorAll('[aria-pressed="true"]');assert.equal(selected.length,1);assert.equal(selected[0].dataset.entityId,id);
   const nav=body.querySelector('nav');assert.equal(nav.getAttribute('aria-label'),'Ierarhie teritorială');
   assert.deepEqual(nav.querySelectorAll('button').map(b=>b.dataset.entityId),ancestorPath(nodes,tree.root_ids,id));
   for(const button of nav.querySelectorAll('button'))assert.ok(button.textContent.startsWith(formatEntityName(nodes.get(button.dataset.entityId).display_name)));
  };
  assertSelection(deep.id); // Loading the hierarchy must rebuild the early breadcrumb.
  const entity=entities.get(deep.id),cls=geometryClass(entity);
  app.activeFilterGroups.delete(cls);await app.selectEntity(deep.id,{zoom:true,source:'map'});assertSelection(deep.id);
  assert.equal(app.activeFilterGroups.has(cls),false);assert.equal(fitBounds.length,0);
  assert.ok(!liveLayers().some(l=>l.feature.properties.entity_id===deep.id));
  assert.match(document.getElementById('selection-visibility').textContent,/ascunsă/);
  const input=document.getElementById('entity-search');input.value=String(entity.representation.osm_relation_id);
  await input.dispatch('input');const result=document.getElementById('search-results').children[0];assert.ok(result);await result.click();assertSelection(deep.id);
  assert.equal(app.activeFilterGroups.has(cls),false);
  app.activeFilterGroups.add(cls);
   const cb=container.descendants().find(e=>e.className==='tree-visibility-toggle'&&e.dataset.entityId===deep.id);
   assert.ok(cb);cb.checked=true;await cb.dispatch('change');assert.equal(app.visibleEntityIds.has(deep.id),true);
   // Select the actual tree button; central selection must prepare zoom and highlight.
  await container.querySelectorAll('.tree-select').find(b=>b.dataset.entityId===deep.id).click();
  // Click handler returns its promise through onSelect.
  assertSelection(deep.id);assert.ok(fitBounds.length>0);
  assert.ok(liveLayers().some(l=>l.feature.properties.entity_id===deep.id&&l.style?.color==='#b54a38'));
  const other=tree.nodes.find(n=>n.depth===5&&n.jurisdiction==='RO');
  await app.selectEntity(other.id,{source:'search'});assertSelection(other.id);
  const layer=layers.find(l=>l.feature.properties.entity_id===deep.id);await layer.handlers.click();assertSelection(deep.id);
  const parent=nodes.get(deep.id).parent_id;
  await body.querySelector('nav').querySelectorAll('button').find(b=>b.dataset.entityId===parent).click();assertSelection(parent);
  const branch=container.querySelectorAll('details').find(d=>d.open);const before=app.selectedEntityId;
  branch.open=false;await branch.dispatch('toggle');assert.equal(app.selectedEntityId,before);
  await app.selectEntity(deep.id);assertSelection(deep.id);
  const opened=container.querySelectorAll('details').filter(d=>d.open);
  await document.getElementById('details-close').click();assert.equal(app.selectedEntityId,null);
  assert.equal(container.querySelectorAll('[aria-pressed="true"]').length,0);assert.equal(body.querySelector('nav'),null);
  assert.equal(document.getElementById('details-title').textContent,'Nicio selecție');assert.ok(opened.every(d=>d.open));
  assert.ok(!liveLayers().some(l=>l.style?.color==='#b54a38'));
 }finally{Object.assign(globalThis,previous);}
});
