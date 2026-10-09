/* P5.0 exploratory shell. Reuses production ACTUAL controllers and released GeoJSON.
   This module MUST stay outside the published production index. */
import * as atlas from '../../app.js';
import {geometryClass,geometryVisible} from '../../geometry-taxonomy.mjs';

const byId = id=>document.getElementById(id);
const buttons={tree:byId('p5-tab-tree'),filters:byId('p5-tab-filters')};
const panels={tree:byId('p5-panel-tree'),filters:byId('p5-panel-filters')};
const selectedBoundaryIds=new Set();
const visibleOverlays=new Map();
const geometryResponses=new Map();
const demo = {ready:false,selectedBoundaryIds,visibleOverlays,get tab(){return document.body.dataset.p5Tab;},get map(){return window.__p5Map;}};
window.p5Navigation=demo;
let manifest=null,chunkIndex=null;
const labelCount=n=>n.toLocaleString('ro-RO');
const escapeLabel=value=>String(value??'').trim();

function showTab(name,{focus=false}={}){
 if(!buttons[name])return;
 document.body.dataset.p5Tab=name;
 for(const key of ['tree','filters']){
  const active=key===name;
  buttons[key].setAttribute('aria-selected',String(active));
  buttons[key].tabIndex=active?0:-1;
  panels[key].hidden=!active;
 }
 if(focus)buttons[name].focus();
}
for(const name of ['tree','filters']){
 buttons[name].addEventListener('click',()=>showTab(name));
 buttons[name].addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const next=event.key==='Home'?'tree':event.key==='End'?'filters':name==='tree'?'filters':'tree';
  showTab(next,{focus:true});
 });
}
byId('p5-filter-shortcut').addEventListener('click',()=>showTab('filters',{focus:true}));
function openNavigation(name){
 showTab(name);
 if(atlas.atlasMobile.state.mobile)atlas.atlasMobile.openDrawer();
 else if(name==='tree')byId('entity-search').focus();
 else buttons.filters.focus();
}
byId('p5-show-tree').addEventListener('click',()=>openNavigation('tree'));
byId('p5-show-filters').addEventListener('click',()=>openNavigation('filters'));

function updateSelectionIndicator(){
 const n=selectedBoundaryIds.size;
 byId('p5-selection-count').textContent=n+' '+(n===1?'limită adăugată':'limite adăugate');
 byId('p5-clear-pins').disabled=n===0;
 byId('p5-map-badge').textContent=n?labelCount(n)+' '+(n===1?'contur individual':'contururi individuale')+' în selecție':'RO + MD · Hartă ACTUAL';
 document.body.dataset.p5Selection=atlas.selectedEntityId?'entity':'none';
}
byId('p5-clear-pins').addEventListener('click',()=>{
 selectedBoundaryIds.clear();
 for(const group of visibleOverlays.values())group.remove();
 visibleOverlays.clear();
 syncCheckboxes();
 updateSelectionIndicator();
});

function findOverviewRoot(entity){
 let e=entity;
 for(let i=0;e&&i<32;i++){
  if(e.map?.tier==='overview')return e.id;
  e=atlas.entityById.get(e.hierarchy?.parent_catalog_id);
 }
 return null;
}
async function geometryFile(path){
 // Paths only originate in the verified current release descriptors, never UI input.
 if(!geometryResponses.has(path)){
  geometryResponses.set(path,fetch(path,{cache:'force-cache'}).then(async response=>{
   if(!response.ok)throw new Error('HTTP '+response.status+' for '+path);
   return response.json();
  }).catch(e=>{geometryResponses.delete(path);throw e;}));
 }
 return geometryResponses.get(path);
}
function geometryDescriptor(entity){
 const jur=entity.jurisdiction;
 if(geometryClass(entity)==='statistical_only')return manifest.public_contract.statistical_geometry?.[jur]?.path;
 if(entity.map?.tier==='overview')return manifest.public_contract.geometry_tiers?.[jur]?.overview?.path;
 const root=findOverviewRoot(entity);
 return chunkIndex.chunks.find(e=>e.jurisdiction===jur&&e.tier===entity.map?.tier&&e.root_entity_id===root)?.path;
}
function allowedByFilters(entity){
 const jurisdiction=byId('layer-'+entity.jurisdiction.toLowerCase());
 if(!jurisdiction?.checked)return false;
 return geometryVisible(entity,{
  geometryClasses:atlas.activeGeometryClasses,
  geometrySubtypes:atlas.activeGeometrySubtypes,
  statisticalLevels:atlas.activeStatisticalLevels,
  separateStatisticalGeometry:document.querySelector('input[data-kind="separate-statistical"]')?.checked!==false
 });
}
function syncOverlayVisibility(){
 for(const [id,layer] of visibleOverlays){
  const entity=atlas.entityById.get(id);
  if(entity&&selectedBoundaryIds.has(id)&&allowedByFilters(entity)){
   if(!demo.map.hasLayer(layer))layer.addTo(demo.map);
  }else if(demo.map.hasLayer(layer))layer.remove();
 }
}
async function toggleBoundary(id,checked){
 const entity=atlas.entityById.get(id);
 if(!entity)return;
 if(!checked){
  selectedBoundaryIds.delete(id);
  const layer=visibleOverlays.get(id);
  if(layer)layer.remove();
  visibleOverlays.delete(id);
  updateSelectionIndicator();
  return;
 }
 if(selectedBoundaryIds.size>=20){
  byId('p5-map-badge').textContent='Prototip: cel mult 20 de contururi simultane.';
  syncCheckboxes();
  return;
 }
 selectedBoundaryIds.add(id);
 updateSelectionIndicator();
 try{
  const path=geometryDescriptor(entity);
  if(!path)throw new Error('Fără descriptor geometric pentru '+id);
  const collection=await geometryFile(path);
  const feature=collection.features?.find(f=>f.properties?.entity_id===id);
  if(!feature)throw new Error('Geometrie neidentificată pentru '+id);
  if(!selectedBoundaryIds.has(id))return;
  const overlay=L.geoJSON(feature,{
   smoothFactor:0,
   style:{color:'#df7b31',weight:3,opacity:1,fillColor:'#ed9f65',fillOpacity:.13},
   onEachFeature:(_f,layer)=>{
    layer.bindTooltip(escapeLabel(entity.display_name),{sticky:true});
    layer.on('click',()=>atlas.selectEntity(id,{source:'tree'}).catch(console.error));
   }
  });
  visibleOverlays.set(id,overlay);
  syncOverlayVisibility();
 }catch(e){
  selectedBoundaryIds.delete(id);
  syncCheckboxes();
  byId('p5-map-badge').textContent='Limita nu poate fi încărcată: '+String(e.message||e);
  console.error('P5.0 overlay read-only failed',e);
 }
 updateSelectionIndicator();
}
function syncCheckboxes(){
 for(const el of byId('hierarchy-tree').querySelectorAll('input.tree-pin')){
  el.checked=selectedBoundaryIds.has(el.dataset.entityId);
 }
}
function decorateTree(){
 for(const outer of byId('hierarchy-tree').querySelectorAll('.tree-node')){
  if(outer.querySelector(':scope > input.tree-pin'))continue;
  const button=outer.querySelector(':scope > button.tree-select');
  if(!button)continue;
  const id=button.dataset.entityId;
  if(!id||!atlas.entityById.has(id))continue;
  const box=document.createElement('input');
  box.type='checkbox';box.className='tree-pin';
  box.dataset.entityId=id;box.checked=selectedBoundaryIds.has(id);
  box.setAttribute('aria-label','Afișează individual limita pentru '+atlas.entityById.get(id).display_name);
  box.title='Afișează/ascunde doar acest contur; selecția rămâne independentă';
  outer.insertBefore(box,outer.firstChild);
 }
}
const tree=byId('hierarchy-tree');
tree.addEventListener('change',event=>{
 const input=event.target.closest('input.tree-pin');
 if(!input)return;
 toggleBoundary(input.dataset.entityId,input.checked);
});
let scheduled=false;
new MutationObserver(()=>{
 if(scheduled)return;
 scheduled=true;
 queueMicrotask(()=>{scheduled=false;decorateTree();updateSelectionIndicator();});
}).observe(tree,{subtree:true,childList:true});
const detailsObserver=new MutationObserver(()=>updateSelectionIndicator());
detailsObserver.observe(byId('details-title'),{subtree:true,childList:true,characterData:true});
const filterInputs=()=>[...byId('p5-panel-filters').querySelectorAll('input[type=checkbox]')];
let defaultFilters=new Map();
function updateFilterIndicator(){
 const changed=filterInputs().filter(e=>defaultFilters.has(e)&&e.checked!==defaultFilters.get(e)).length;
 const badge=byId('p5-filter-count');badge.hidden=changed===0;
 badge.textContent=changed?'● '+changed:'';
 syncOverlayVisibility();
}
byId('p5-panel-filters').addEventListener('change',()=>queueMicrotask(updateFilterIndicator));

async function initialize(){
 await atlas.frontendReady;
 if(atlas.entityById.size!==5848)throw new Error('P5.0: index ACTUAL incomplet: '+atlas.entityById.size);
 manifest=await geometryFile('data/current/actual-release-manifest.json');
 chunkIndex=await geometryFile('public/data/actual-geometry-chunks.json');
 if(!manifest.public_contract?.geometry_tiers||chunkIndex.chunk_count!==115)throw new Error('P5.0: contract geometric nesuportat');
 byId('p5-count-label').textContent=labelCount(atlas.entityById.size)+' entități · 2 jurisdicții';
 decorateTree();
 defaultFilters=new Map(filterInputs().map(e=>[e,e.checked]));
 updateFilterIndicator();
 updateSelectionIndicator();
 demo.ready=true;
 document.documentElement.dataset.p5Ready='true';
}
initialize().catch(e=>{
 byId('p5-count-label').textContent='Eroare de inițializare — verifică datele ACTUAL';
 console.error('P5.0 initialization error',e);
 document.documentElement.dataset.p5Ready='error';
});
