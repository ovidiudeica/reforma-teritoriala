import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {geometryClass,geometrySubtype,geometryVisible,geometryLabels,geometrySubtypeLabels,geometryFilterTree,createGeometryFilterIndex,statisticalLevel} from '../../geometry-taxonomy.mjs';
import {createAtlasFilters} from '../../atlas-filters.mjs';
const index=JSON.parse(await readFile('public/data/actual-entities.json','utf8'));
const tree=JSON.parse(await readFile('public/data/actual-consolidated-tree.json','utf8'));
const filters=createGeometryFilterIndex(index.entities);
const expected={
 'ro.counties':42,'md.districts':32,'md.level2_municipalities':3,'md.special_units':2,
 'ro.municipalities':100,'ro.towns':217,'ro.communes':2862,'ro.local_unspecified':1,
 'md.municipalities':14,'md.towns':48,'md.rural_uat':372,'md.level1_unspecified':548,
 'ro.bucharest_sectors':6,'md.chisinau_sectors':5,'ro.component_villages':3,'ro.municipality_components':2,
 'md.component_localities':1446,'md.component_areas':3,'ro.context':1,'md.context':1,'md.auxiliary':122
};
const options=()=>({geometryClasses:new Set(Object.keys(geometryLabels)),geometrySubtypes:new Set(Object.keys(geometrySubtypeLabels)),statisticalLevels:new Set([1,2,3]),separateStatisticalGeometry:true});
const breakdown=cls=>Object.fromEntries(filters.groups.filter(g=>g.id===cls).flatMap(g=>g.jurisdictions.flatMap(j=>j.subtypes.map(s=>[s.id,s.count]))));

test('all 5848 representations have deterministic classes/subtypes; only 18 separate boundaries are exempt',()=>{
 assert.equal(index.entities.length,5848);
 for(const e of index.entities){
  assert.ok(geometryClass(e) in geometryLabels);assert.notEqual(geometryClass(e),'unclassified');
  assert.equal(geometrySubtype(e),geometrySubtype(structuredClone(e)));
  if(e.category==='statistical')assert.equal(geometrySubtype(e),null);
  else{assert.ok(geometrySubtype(e) in geometrySubtypeLabels);assert.ok(!geometrySubtype(e).startsWith('unclassified:'));}
 }
 assert.deepEqual(Object.fromEntries([...filters.subtypeMembers].map(([id,members])=>[id,members.size])),expected);
});
test('large classes retain exact 2/79/4162/11/1454/122/18 population',()=>{
 assert.deepEqual(Object.fromEntries(Object.keys(geometryLabels).map(k=>[k,filters.classCounts.get(k)||0])),{regional:79,local_uat:4162,sector:11,component_locality:1454,context:2,auxiliary:122,statistical_only:18,unclassified:0});
});
test('regional subtypes reflect actual representations: RO 42, MD 32+3+2',()=>{
 assert.deepEqual(breakdown('regional'),{'ro.counties':42,'md.districts':32,'md.level2_municipalities':3,'md.special_units':2});
 assert.equal(geometrySubtype({jurisdiction:'MD',representation:{inferred_type:'level_2_or_special_unit'}}),'md.regional_unspecified');
});
test('Bucharest and Chisinau sectors are explicitly separate 6+5',()=>{
 assert.deepEqual(breakdown('sector'),{'ro.bucharest_sectors':6,'md.chisinau_sectors':5});
 for(const e of index.entities.filter(e=>e.representation.inferred_type==='chisinau_sector'))assert.equal(geometrySubtype(e),'md.chisinau_sectors');
});
test('local UAT counts come from inferred_type, including explicit unspecified geometry',()=>{
 assert.deepEqual(breakdown('local_uat'),{'ro.municipalities':100,'ro.towns':217,'ro.communes':2862,'ro.local_unspecified':1,'md.municipalities':14,'md.towns':48,'md.rural_uat':372,'md.level1_unspecified':548});
 assert.equal(Object.values(breakdown('local_uat')).reduce((a,b)=>a+b),4162);
});
test('all four component representation types map explicitly; current RO 5 and MD 1449',()=>{
 assert.deepEqual(breakdown('component_locality'),{'ro.component_villages':3,'ro.municipality_components':2,'md.component_localities':1446,'md.component_areas':3});
 for(const [j,type,id] of [['MD','component_locality','md.component_localities'],['MD','subdivision_or_component_area','md.component_areas'],['RO','component_village_boundary_representation','ro.component_villages'],['RO','municipality_component_locality_boundary_representation','ro.municipality_components']])assert.equal(geometrySubtype({jurisdiction:j,representation:{inferred_type:type}}),id);
});
test('unknown types stay explicit; legal/display/admin_level cannot override the geometry taxonomy',()=>{
 for(const e of index.entities){
  const changed={...e,legal:{type:'county'},display_type:'municipality',representation:{...e.representation,admin_level:2}};
  assert.equal(geometryClass(changed),geometryClass(e));assert.equal(geometrySubtype(changed),geometrySubtype(e));
 }
 const unknown={id:'future',jurisdiction:'RO',representation:{inferred_type:'future_type'},legal:{type:'town'}};
 assert.equal(geometryClass(unknown),'unclassified');assert.equal(geometrySubtype(unknown),'unclassified:RO:future_type');
 const future=createGeometryFilterIndex([unknown]);assert.equal(future.groups[0].jurisdictions[0].subtypes[0].id,'unclassified:RO:future_type');
 for(const g of geometryFilterTree)for(const j of g.jurisdictions)for(const sub of j.subtypes)for(const type of sub.types){
  const e={jurisdiction:j.id,representation:{inferred_type:type}};assert.equal(geometryClass(e),g.id);assert.equal(geometrySubtype(e),sub.id);
 }
});
test('45 coalesced roles retain one polygon and are visible through either administrative or statistical role',()=>{
 const reused=index.entities.filter(e=>e.category!=='statistical'&&e.roles.includes('statistical'));assert.equal(reused.length,45);
 for(const e of reused){
  assert.ok(filters.subtypeMembers.get(geometrySubtype(e)).has(e.id));
  assert.equal([...filters.subtypeMembers.values()].filter(ids=>ids.has(e.id)).length,1);
  const state=options();assert.equal(geometryVisible(e,state),true);
  state.geometryClasses.delete(geometryClass(e));assert.equal(geometryVisible(e,state),true,'statistical role keeps shared polygon visible');
  state.statisticalLevels.delete(statisticalLevel(e));assert.equal(geometryVisible(e,state),false,'both roles off hide shared polygon');
  state.geometryClasses.add(geometryClass(e));assert.equal(geometryVisible(e,state),true,'administrative role independently restores shared polygon');
  assert.ok(state.geometrySubtypes.has(geometrySubtype(e)));
 }
 assert.equal(filters.statisticalOnly,18);assert.equal(filters.statisticalRoles,63);
 assert.deepEqual([...filters.statisticalCounts].sort(),[[1,5],[2,10],[3,48]]);
 const l1=filters.statisticalLevelStats.get(1),l2=filters.statisticalLevelStats.get(2),l3=filters.statisticalLevelStats.get(3);
 assert.deepEqual([l1.roles,l2.roles,l3.roles],[5,10,48]);
 assert.deepEqual([l1.separate,l2.separate,l3.separate],[4,10,4]);
 assert.deepEqual([l1.reused,l2.reused,l3.reused],[1,0,44]);
 assert.deepEqual([l3.jurisdictions.RO.roles,l3.jurisdictions.RO.separate,l3.jurisdictions.MD.roles,l3.jurisdictions.MD.separate],[42,0,6,4]);
});
test('current public/hierarchy contract and official MD120/OSM-only MD121 stay intact',()=>{
 assert.equal(index.contract,'actual-public-entity-v3');assert.equal(index.entity_count,5848);assert.equal(tree.node_count,5848);
 const md=index.entities.find(e=>e.id==='stat-MD120');assert.equal(md.statistical.code,'MD120');assert.equal(md.representation.osm_statistical_ref,'MD121');assert.equal(md.representation.osm_ref_is_identity_authority,false);
 assert.ok(!index.entities.some(e=>e.statistical?.code==='MD121'));
});
test('semantic manifest and all bound protected component bytes match immutable ACTUAL baseline',async()=>{
 const manifest=JSON.parse(await readFile('data/current/actual-release-manifest.json','utf8'));
 assert.equal(manifest.snapshot_id,'actual-a9e5a4ddcb5277ef');assert.equal(manifest.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
 for(const c of Object.values(manifest.components))assert.equal(createHash('sha256').update(await readFile(c.path)).digest('hex'),c.sha256,c.path);
});

class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.listeners={};this.classes=new Set();this.checked=true;this.indeterminate=false;this.scrollTop=0;this.clientHeight=100;this._text='';this._html='';this.open=false;}
 set className(v){this.classes=new Set(v.split(' '));}get className(){return [...this.classes].join(' ');}
 classList={toggle:(key,on)=>{if(on)this.classes.add(key);else this.classes.delete(key);}};
 set textContent(v){this._text=v;this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set innerHTML(v){this._html=v;this._text='';this.children=[];}get innerHTML(){return this._html;}
 appendChild(child){this.children.push(child);child.parentElement=this;return child;}
 setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k]??null;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 async dispatch(k){for(const fn of this.listeners[k]??[])await fn({target:this,preventDefault(){},stopPropagation(){}});}
 async click(){if(this.tagName==='INPUT'&&this.type==='checkbox'){this.checked=this.indeterminate?true:!this.checked;this.indeterminate=false;await this.dispatch('change');}else await this.dispatch('click');}
 descendants(){return this.children.flatMap(c=>[c,...c.descendants()]);}
 querySelectorAll(s){return this.descendants().filter(c=>s==='button'?c.tagName==='BUTTON':s==='nav'?c.tagName==='NAV':s==='details'?c.tagName==='DETAILS':s==='[aria-pressed="true"]'?c.getAttribute('aria-pressed')==='true':s==='.tree-select'?c.classes.has('tree-select'):false);}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 getBoundingClientRect(){return {top:0,bottom:30,height:30};}
}
function doc(){const elements=new Map();return {elements,getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:tag=>new Element(tag),querySelectorAll:()=>[]};}
function filterHarness(){const document=doc(),container=new Element(),state=options();let changes=0;const controller=createAtlasFilters({document,container,index:filters,state,onSeparate:v=>{state.separateStatisticalGeometry=v;},onChange:()=>changes++});return {document,container,state,controller,get changes(){return changes;}};}
const section=(container,title)=>container.children.find(e=>e.children.some(c=>c.tagName==='H3'&&c.textContent===title));

test('DOM parent checkbox follows all/none/mixed children; native indeterminate click selects all',async()=>{
 const {controller,state}=filterHarness(),parent=controller.parents.get('local_uat');
 assert.equal(parent.checked,true);assert.equal(parent.indeterminate,false);
 await controller.children.get('ro.towns').input.click();assert.equal(parent.checked,false);assert.equal(parent.indeterminate,true);
 await parent.click();assert.equal(parent.checked,true);assert.equal(parent.indeterminate,false);assert.ok(state.geometrySubtypes.has('ro.towns'));
 await parent.click();assert.equal(parent.checked,false);assert.equal(parent.indeterminate,false);
 assert.ok(![...controller.children].some(([id,{group}])=>group.id==='local_uat'&&state.geometrySubtypes.has(id)));
 await parent.click();assert.equal(parent.checked,true);
});
test('filter DOM persists expansion; population counts, semantic ordering and independent section actions',async()=>{
 const {container,controller,state}=filterHarness();const disclosures=container.querySelectorAll('details');disclosures[0].open=true;
 const before=container.children.slice(),stats=[...state.statisticalLevels];
 const admin=section(container,'Tipuri administrative');await admin.querySelectorAll('button').find(b=>b.textContent==='Niciuna').click();
 assert.deepEqual(container.children,before);assert.equal(disclosures[0].open,true);assert.deepEqual([...state.statisticalLevels],stats);assert.equal(state.separateStatisticalGeometry,true);
 assert.equal(controller.parents.get('regional').checked,false);
 await admin.querySelectorAll('button').find(b=>b.textContent==='Toate').click();assert.equal(controller.parents.get('regional').checked,true);
 const subtypes=[...state.geometrySubtypes],classes=[...state.geometryClasses],statSection=section(container,'Niveluri statistice');
 await statSection.querySelectorAll('button').find(b=>b.textContent==='Niciun nivel').click();assert.deepEqual([...state.statisticalLevels],[]);assert.deepEqual([...state.geometrySubtypes],subtypes);assert.deepEqual([...state.geometryClasses],classes);assert.equal(state.separateStatisticalGeometry,true);
 assert.ok(statSection.textContent.includes('Nivel statistic 1'));assert.ok(statSection.textContent.includes('5 entități · 1 reutilizate · 4 separate'));assert.ok(statSection.textContent.includes('Nivel statistic 3'));assert.ok(statSection.textContent.includes('48 entități · 44 reutilizate · 4 separate'));assert.ok(statSection.textContent.includes('RO: 42 total / 42 reutilizate / 0 separate · MD: 6 total / 2 reutilizate / 4 separate'));
 assert.ok(statSection.textContent.includes('controlează toate cele 63 entități cu rol statistic'));
 await controller.separate.click();assert.equal(state.separateStatisticalGeometry,false);assert.ok([...controller.levels.values()].every(input=>!input.disabled));assert.ok(statSection.querySelectorAll('button').every(button=>!button.disabled));
 await statSection.querySelectorAll('button').find(b=>b.textContent==='Niciun nivel').click();assert.deepEqual([...state.statisticalLevels],[]);assert.equal(state.separateStatisticalGeometry,false);
 await statSection.querySelectorAll('button').find(b=>b.textContent==='Toate nivelurile').click();assert.deepEqual([...state.statisticalLevels],[1,2,3]);assert.equal(state.separateStatisticalGeometry,false);
 await controller.separate.click();assert.equal(state.separateStatisticalGeometry,true);
 assert.ok(container.textContent.includes('Județe / Municipiul București(42)'));assert.ok(container.textContent.includes('România (42)'));
 assert.deepEqual(filters.groups.find(g=>g.id==='local_uat').jurisdictions[0].subtypes.map(s=>s.id),['ro.municipalities','ro.towns','ro.communes','ro.local_unspecified']);
 for(const g of filters.groups)for(const j of g.jurisdictions)for(const sub of j.subtypes)assert.ok(sub.count>0);
});

test('real frontend filters integrate late chunks/tiers, jurisdictions, hidden selection and statistical independence',async t=>{
 const document=doc(),groups=[],mounted=new Set(),requests=[];
 let zoom=6,releaseChunk;
 const group=()=>{const g={layers:[],clearLayers(){this.layers=[];},addLayer(l){this.layers.push(l);},hasLayer(l){return this.layers.includes(l);},removeLayer(l){this.layers=this.layers.filter(x=>x!==l);},addTo(target){target.addLayer?.(this);return this;},eachLayer(fn){this.layers.forEach(fn);}};groups.push(g);return g;};
 const map={setView(){return this;},addLayer:g=>mounted.add(g),removeLayer:g=>mounted.delete(g),fitBounds(){zoom=12;},getZoom:()=>zoom,getBounds:()=>({intersects:()=>true}),on(){}};
 const walk=g=>g.layers.flatMap(l=>l.layers?walk(l):[l]);
 const visible=()=>groups.slice(0,2).filter(g=>mounted.has(g)).flatMap(walk);
 const L={map:()=>map,tileLayer:()=>({addTo(){}}),control:{scale:()=>({addTo(){}})},layerGroup:group,latLngBounds:()=>({}),geoJSON:(data,config)=>{
  const result=group();for(const feature of data.features.filter(config.filter)){const layer={feature,handlers:{},bindTooltip(){return this;},on(k,fn){this.handlers[k]=fn;},setStyle(style){this.style=style;}};config.onEachFeature(feature,layer);result.addLayer(layer);}
  result.addTo=target=>{target.addLayer(result);return result;};return result;
 }};
 const town=index.entities.find(e=>e.jurisdiction==='RO'&&e.representation.inferred_type==='town'&&e.map.tier==='local');
 let root=town;while(root.map.tier!=='overview')root=index.entities.find(e=>e.id===root.hierarchy.parent_catalog_id);
 const entry={jurisdiction:'RO',tier:'local',root_entity_id:root.id,feature_count:1,path:'late-chunk'};
 const manifest={snapshot_id:'fixture',public_contract:{contract:index.contract,path:'index',entity_count:5848,hierarchy:{path:'tree'},geometry_chunks:{path:'chunks'},geometry_tiers:Object.fromEntries(['RO','MD'].map(j=>[j,Object.fromEntries(['overview','local','detail'].map(level=>[level,{path:j+'/'+level}]))])),statistical_geometry:{RO:{path:'RO/stat'},MD:{path:'MD/stat'}}}};
 const payload=path=>{
  if(path==='data/current/actual-release-manifest.json')return manifest;
  if(path==='data/current/actual-release-gate.json')return {status:'PASS',snapshot_id:'fixture'};
  if(path==='public/data/app-build-info.json')return null;if(path==='index')return index;if(path==='tree')return tree;
  if(path==='chunks')return {contract:'actual-public-geometry-chunks-v1',chunk_count:1,chunks:[entry]};
  if(path==='late-chunk')return {metadata:{...entry},features:[{properties:{entity_id:town.id}}]};
  const [jurisdiction,tier]=path.split('/');const found=index.entities.filter(e=>e.jurisdiction===jurisdiction&&(tier==='stat'?e.category==='statistical':e.category!=='statistical'&&e.map.tier===tier));
  return {metadata:tier==='stat'?{contract:'actual-public-statistical-geometry-v1',jurisdiction}:{jurisdiction,tier},features:found.map(e=>({properties:{entity_id:e.id}}))};
 };
 const fetch=async path=>{requests.push(path);if(path==='late-chunk')return new Promise(resolve=>{releaseChunk=()=>resolve({ok:true,json:async()=>payload(path)});});return {ok:true,json:async()=>payload(path)};};
 const previous={document:globalThis.document,L:globalThis.L,fetch:globalThis.fetch};
 try{
  Object.assign(globalThis,{document,L,fetch});const app=await import('../../app.js?atlas-filters-tests');await app.frontendReady;
  assert.equal(app.activeGeometryClasses,app.activeFilterGroups);
  const container=document.getElementById('filter-list'),treeDOM=document.getElementById('hierarchy-tree'),body=document.getElementById('details-body');
  const input=id=>container.descendants().find(e=>e.tagName==='INPUT'&&e.dataset.kind==='geometry-subtype'&&e.dataset.filter===id);
  const key=entry.jurisdiction+'_'+entry.tier+'_'+entry.root_entity_id;
  await t.test('late chunk and tier rendering evaluates current subtype state and reuses cache',async()=>{
   const pending=app.ensureChunk(entry);await input('ro.towns').click();releaseChunk();await pending;
   assert.equal(walk(app.chunkGroups.get(key)).length,0);
   await app.ensureTier('RO','local');assert.ok(!walk(app.tierGroups.RO_local).some(l=>l.feature.properties.entity_id===town.id));
   await input('ro.towns').click();assert.equal(walk(app.chunkGroups.get(key)).length,1);
   const count=requests.length;await app.ensureChunk(entry);await app.ensureTier('RO','local');assert.equal(requests.length,count);
  });
  await t.test('selected subtype off preserves details/breadcrumb/lazy tree and restores highlight',async()=>{
   await app.selectEntity(town.id,{zoom:true,source:'tree'});assert.equal(app.selectedEntityId,town.id);
   assert.ok(visible().some(l=>l.feature.properties.entity_id===town.id&&l.style?.color==='#b54a38'));
   const nav=body.querySelector('nav'),selected=treeDOM.querySelectorAll('[aria-pressed="true"]')[0];
   const treeCount=treeDOM.querySelectorAll('.tree-select').length,opened=treeDOM.querySelectorAll('details').filter(d=>d.open);
   await input('ro.towns').click();assert.equal(app.selectedEntityId,town.id);assert.equal(body.querySelector('nav'),nav);
   assert.equal(document.getElementById('details-title').textContent,town.display_name);assert.equal(selected.getAttribute('aria-pressed'),'true');assert.equal(treeDOM.querySelectorAll('.tree-select').length,treeCount);assert.ok(opened.every(d=>d.open));
   assert.ok(!visible().some(l=>l.feature.properties.entity_id===town.id));assert.match(document.getElementById('selection-visibility').textContent,/ascunsă/);
   const fetches=requests.length;await input('ro.towns').click();assert.equal(requests.length,fetches);
   assert.ok(visible().some(l=>l.feature.properties.entity_id===town.id&&l.style?.color==='#b54a38'));assert.equal(body.querySelector('nav'),nav);
  });
  await t.test('jurisdiction off/on preserves subtype state and only restores enabled geometry',async()=>{
   for(const [j,subtype,target] of [['RO','ro.towns',town],['MD','md.level2_municipalities',index.entities.find(e=>e.jurisdiction==='MD'&&e.representation.inferred_type==='level_2_municipality')]]){
    await input(subtype).click();const state=[...app.activeGeometrySubtypes];const checkbox=document.getElementById('layer-'+j.toLowerCase()),rootGroup=groups[j==='RO'?0:1];
    checkbox.checked=false;await checkbox.dispatch('change');await app.syncTiers();
    assert.ok(!mounted.has(rootGroup));assert.deepEqual([...app.activeGeometrySubtypes],state);
    checkbox.checked=true;await checkbox.dispatch('change');await app.syncTiers();
    assert.ok(mounted.has(rootGroup));assert.deepEqual([...app.activeGeometrySubtypes],state);assert.ok(!visible().some(l=>l.feature.properties.entity_id===target.id));
    await input(subtype).click();assert.ok(visible().some(l=>l.feature.properties.entity_id===target.id));
   }
  });
  await t.test('administrative and statistical filters provide OR visibility for reused geometry',async()=>{
   const reused=index.entities.find(e=>e.jurisdiction==='RO'&&e.representation.inferred_type==='county'&&e.roles.includes('statistical'));
   await app.selectEntity(reused.id);const statState=[...app.activeStatisticalLevels],separate=container.descendants().find(e=>e.dataset.kind==='separate-statistical');const separateState=separate.checked;
   await input('ro.counties').click();assert.deepEqual([...app.activeStatisticalLevels],statState);assert.equal(separate.checked,separateState);assert.ok(visible().some(l=>l.feature.properties.entity_id===reused.id&&l.style?.color==='#b54a38'));
   const separateLevel3=index.entities.find(e=>e.category==='statistical'&&e.statistical?.level===3),level3=container.descendants().find(e=>e.dataset.kind==='statistical'&&e.dataset.filter==='3');
   assert.ok(visible().some(l=>l.feature.properties.entity_id===separateLevel3.id));
   await level3.click();assert.ok(!visible().some(l=>l.feature.properties.entity_id===reused.id));assert.ok(!visible().some(l=>l.feature.properties.entity_id===separateLevel3.id));assert.match(document.getElementById('selection-visibility').textContent,/ascunsă/);
   await input('ro.counties').click();assert.ok(visible().some(l=>l.feature.properties.entity_id===reused.id&&l.style?.color==='#b54a38'));assert.ok(!visible().some(l=>l.feature.properties.entity_id===separateLevel3.id));
   await level3.click();assert.ok(visible().some(l=>l.feature.properties.entity_id===reused.id));assert.ok(visible().some(l=>l.feature.properties.entity_id===separateLevel3.id));
   const subtypes=[...app.activeGeometrySubtypes];
   for(const j of ['RO','MD'])for(const layer of walk(app.statisticalGroups[j]))assert.equal(index.entities.find(e=>e.id===layer.feature.properties.entity_id).category,'statistical');
   await separate.click();assert.deepEqual([...app.activeGeometrySubtypes],subtypes);assert.ok(visible().some(l=>l.feature.properties.entity_id===reused.id));assert.ok(!visible().some(l=>l.feature.properties.entity_id===separateLevel3.id));assert.ok(!level3.disabled);
   const opened=treeDOM.querySelectorAll('details').filter(d=>d.open);app.clearSelection();assert.equal(body.querySelector('nav'),null);assert.equal(treeDOM.querySelectorAll('[aria-pressed="true"]').length,0);assert.ok(opened.every(d=>d.open));
  });
 }finally{Object.assign(globalThis,previous);}
});
