import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {geometryClass,geometryVisible,geometryLabels,statisticalLevel,administrativeClasses} from '../../geometry-taxonomy.mjs';

const index=JSON.parse(await readFile('public/data/actual-entities.json','utf8'));
const entities=index.entities;
const options=()=>({geometryClasses:new Set(Object.keys(geometryLabels)),statisticalLevels:new Set([1,2,3]),separateStatisticalGeometry:true});

test('v3 geometry taxonomy covers the exact audited ACTUAL population',()=>{
 assert.equal(index.contract,'actual-public-entity-v3');
 assert.equal(index.entity_count,5848);
 assert.equal(entities.length,5848);
 const counts={context:0,regional:0,local_uat:0,sector:0,component_locality:0,auxiliary:0,statistical_only:0,unclassified:0};
 for(const entity of entities)counts[geometryClass(entity)]++;
 assert.deepEqual(counts,{context:2,regional:79,local_uat:4162,sector:11,component_locality:1454,auxiliary:122,statistical_only:18,unclassified:0});
});

test('representation overrides legal and display types; unknown types stay explicit',()=>{
 for(const entity of entities){
  const expected=geometryClass(entity);
  assert.equal(geometryClass({...entity,legal:{type:'commune'},display_type:'commune'}),expected);
  assert.equal(geometryClass({...entity,legal:{type:'municipality'},display_type:'county'}),expected);
 }
 assert.equal(geometryClass({representation:{inferred_type:'future_type'},legal:{type:'town'}}),'unclassified');
 assert.equal(geometryClass({legal:{type:'commune'},display_type:'commune'}),'unclassified');
 for(const entity of entities.filter(e=>e.representation.inferred_type==='component_locality')){
  assert.equal(geometryClass(entity),'component_locality');
  assert.ok(!['commune','town','municipality','regional','local_uat'].includes(geometryClass(entity)));
 }
 for(const [type,expected,count] of [['chisinau_sector','sector',5],['sector','sector',6],['non_administrative_or_auxiliary_area','auxiliary',122],['state','context',2]]){
  const matches=entities.filter(e=>e.representation.inferred_type===type);
  assert.equal(matches.length,count);
  for(const entity of matches)assert.equal(geometryClass(entity),expected);
 }
 const independent=entities.filter(e=>e.legal?.type==='independent_village');
 assert.ok(independent.length>0);
 for(const entity of independent)assert.ok(['local_uat','component_locality'].includes(geometryClass(entity)));
});

test('statistical roles remain 63 at levels 5/10/48 with only 18 separate geometries',async()=>{
 const roles=entities.filter(e=>e.roles.includes('statistical'));
 assert.equal(roles.length,63);
 assert.deepEqual([1,2,3].map(level=>roles.filter(e=>statisticalLevel(e)===level).length),[5,10,48]);
 const only=roles.filter(e=>e.category==='statistical'),reused=roles.filter(e=>e.category!=='statistical');
 assert.equal(only.length,18);assert.equal(reused.length,45);
 for(const entity of only)assert.ok(!administrativeClasses.includes(geometryClass(entity)));
 const manifest=JSON.parse(await readFile('data/current/actual-release-manifest.json','utf8'));
 const features=(await Promise.all(Object.values(manifest.public_contract.statistical_geometry).map(async descriptor=>{
  const bytes=await readFile(descriptor.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.sha256);
  return JSON.parse(bytes).features;
 }))).flat();
 const ids=new Set(features.map(f=>f.properties.entity_id));
 assert.equal(features.length,18);assert.equal(ids.size,18);
 for(const entity of only)assert.ok(ids.has(entity.id));
 for(const entity of reused)assert.ok(!ids.has(entity.id));

 const administrativeFeatures=(await Promise.all(Object.values(manifest.public_contract.geometry_tiers).flatMap(byTier=>Object.values(byTier)).map(async descriptor=>{
  const bytes=await readFile(descriptor.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.sha256);
  return JSON.parse(bytes).features;
 }))).flat();
 const administrativeCounts=new Map();
 for(const feature of administrativeFeatures){const id=feature.properties.entity_id;administrativeCounts.set(id,(administrativeCounts.get(id)||0)+1);}
 for(const entity of reused)assert.equal(administrativeCounts.get(entity.id),1,'missing/duplicated reused statistical geometry '+entity.id);
 for(const entity of only)assert.equal(administrativeCounts.get(entity.id)||0,0,'statistical-only geometry leaked into administrative tiers '+entity.id);

 const md120=entities.find(e=>e.id==='stat-MD120');
 assert.equal(md120.statistical.code,'MD120');
 assert.equal(md120.representation.osm_statistical_ref,'MD121');
 assert.equal(md120.representation.osm_ref_is_identity_authority,false);
 assert.ok(!roles.some(e=>e.statistical.code==='MD121'));
});

test('statistical levels expose all 63 statistical entities through reused or separate geometry',()=>{
 const roles=entities.filter(e=>e.roles.includes('statistical'));
 const statisticalOnly=roles.filter(e=>e.category==='statistical');
 const reused=roles.filter(e=>e.category!=='statistical');
 const statisticalView=options();statisticalView.geometryClasses.clear();
 assert.equal(roles.filter(e=>geometryVisible(e,statisticalView)).length,63);
 assert.deepEqual([1,2,3].map(level=>roles.filter(e=>statisticalLevel(e)===level&&geometryVisible(e,statisticalView)).length),[5,10,48]);
 assert.equal(statisticalOnly.filter(e=>geometryVisible(e,statisticalView)).length,18);
 assert.equal(reused.filter(e=>geometryVisible(e,statisticalView)).length,45);

 const county=reused.find(e=>e.jurisdiction==='RO'&&statisticalLevel(e)===3);
 const dual=options();dual.geometryClasses.delete(geometryClass(county));
 assert.equal(geometryVisible(county,dual),true,'statistical level keeps coalesced county visible');
 dual.statisticalLevels.delete(3);
 assert.equal(geometryVisible(county,dual),false,'both roles off hide shared geometry');
 dual.geometryClasses.add(geometryClass(county));
 assert.equal(geometryVisible(county,dual),true,'administrative role can independently keep shared geometry visible');

 const level3=options();level3.geometryClasses.clear();level3.statisticalLevels.delete(3);
 assert.equal(roles.filter(e=>statisticalLevel(e)===3&&geometryVisible(e,level3)).length,0);
 assert.equal(roles.filter(e=>[1,2].includes(statisticalLevel(e))&&geometryVisible(e,level3)).length,15);

 const noSeparate=options();noSeparate.geometryClasses.clear();noSeparate.separateStatisticalGeometry=false;
 assert.equal(statisticalOnly.filter(e=>geometryVisible(e,noSeparate)).length,0);
 assert.equal(reused.filter(e=>geometryVisible(e,noSeparate)).length,45,'master separate switch must not hide reused statistical geometry');

 const unknown={representation:{inferred_type:'new'}};
 assert.equal(geometryVisible(unknown,options()),true);
});

test('release identity and every bound ACTUAL component retain exact bytes',async()=>{
 const manifest=JSON.parse(await readFile('data/current/actual-release-manifest.json','utf8'));
 assert.equal(manifest.snapshot_id,'actual-a9e5a4ddcb5277ef');
 assert.equal(manifest.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
 for(const component of Object.values(manifest.components)){
  const bytes=await readFile(component.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),component.sha256,component.path);
  if(component.bytes!==undefined)assert.equal(bytes.length,component.bytes,component.path);
 }
});

test('actual frontend rendering and selection respect filters, including async statistical loads',async()=>{
 const only=entities.find(e=>e.category==='statistical');
 const reused=entities.find(e=>e.category!=='statistical'&&e.roles.includes('statistical'));
 const element=()=>({
  textContent:'',innerHTML:'',checked:true,children:[],dataset:{},
  classList:{toggle(){}},setAttribute(){},appendChild(child){this.children.push(child);},
  addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]
 });
 const elements=new Map();
 const doc={getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll:()=>[],createElement:element};
 const layerGroup=()=>({layers:[],clearLayers(){this.layers=[];},addLayer(layer){this.layers.push(layer);},hasLayer(layer){return this.layers.includes(layer);},removeLayer(layer){this.layers=this.layers.filter(x=>x!==layer);},addTo(){return this;},eachLayer(fn){this.layers.forEach(fn);}});
 const pane={style:{}};
 const geoJsonOptions=[];
 const L={
  map:()=>({setView(){return this;},fitBounds(){},getZoom:()=>6,on(){},createPane:name=>name==='statistical-boundaries'?pane:null}),
  tileLayer:()=>({addTo(){}}),control:{scale:()=>({addTo(){}})},layerGroup,
  geoJSON:(data,config)=>{
   geoJsonOptions.push(config);
   const group=layerGroup();
   for(const feature of data.features.filter(config.filter)){
    const layer={feature,bindTooltip(){return this;},on(){},setStyle(style){this.style=style;}};
    config.onEachFeature(feature,layer);group.addLayer(layer);
   }
   group.addTo=target=>{target.addLayer(group);return group;};return group;
  }
 };
 const statPayload=jurisdiction=>({metadata:{contract:'actual-public-statistical-geometry-v1',jurisdiction},features:jurisdiction===only.jurisdiction?[{properties:{entity_id:only.id}}]:[]});
 const fixtures={
  'data/current/actual-release-manifest.json':{
   snapshot_id:'fixture',public_contract:{
    contract:index.contract,path:'index',entity_count:5848,
    geometry_tiers:Object.fromEntries(['RO','MD'].map(j=>[j,Object.fromEntries(['overview','local','detail'].map(t=>[t,{path:j+'/'+t}]))])),
    statistical_geometry:{RO:{path:'RO/stat'},MD:{path:'MD/stat'}}
   }
  },
  'data/current/actual-release-gate.json':{status:'PASS',snapshot_id:'fixture'},
  'public/data/app-build-info.json':null,index
 };
 const respond=path=>{
  const [jurisdiction,tier]=path.split('/');
  const payload=path in fixtures?fixtures[path]:tier==='stat'?statPayload(jurisdiction):{metadata:{jurisdiction,tier},features:[]};
  return {ok:true,json:async()=>payload};
 };
 const previous={L:globalThis.L,document:globalThis.document,fetch:globalThis.fetch};
 try{
  Object.assign(globalThis,{L,document:doc,fetch:async path=>respond(path)});
  const frontend=await import('../../app.js');
  await frontend.frontendReady;
   for(const id of [only.id,reused.id])frontend.visibleEntityIds.add(id);
   frontend.refreshGeometryVisibility();
   const count=()=>frontend.statisticalGroups[only.jurisdiction].layers[0].layers.length;
  assert.equal(count(),1);
  assert.equal(pane.style.zIndex,'450');
  assert.ok(geoJsonOptions.some(options=>options.pane==='statistical-boundaries'));
  frontend.activeStatisticalLevels.delete(statisticalLevel(only));frontend.refreshGeometryVisibility();
  assert.equal(count(),0);
  await frontend.selectEntity(only.id);
  assert.equal(count(),0);assert.equal(frontend.selectedEntityId,only.id);
  assert.match(elements.get('selection-visibility').textContent,/ascunsă/);
  frontend.activeStatisticalLevels.add(statisticalLevel(only));frontend.refreshGeometryVisibility();
  assert.equal(count(),1);
  frontend.setSeparateStatisticalGeometry(false);frontend.refreshGeometryVisibility();assert.equal(count(),0);
  frontend.setSeparateStatisticalGeometry(true);frontend.refreshGeometryVisibility();assert.equal(count(),1);
  const group=layerGroup(),data={features:[{properties:{entity_id:reused.id}}]};
  frontend.renderCollection(group,data);assert.equal(group.layers[0].layers.length,1);
  frontend.activeFilterGroups.delete(geometryClass(reused));
  frontend.renderCollection(group,data);assert.equal(group.layers[0].layers.length,1);
  await frontend.selectEntity(reused.id);assert.equal(group.layers[0].layers.length,1);
  frontend.activeStatisticalLevels.delete(statisticalLevel(reused));frontend.refreshGeometryVisibility();
  frontend.renderCollection(group,data);assert.equal(group.layers[0].layers.length,0);
  assert.match(elements.get('selection-visibility').textContent,/ascunsă/);
  frontend.activeStatisticalLevels.add(statisticalLevel(reused));frontend.refreshGeometryVisibility();
  frontend.renderCollection(group,data);assert.equal(group.layers[0].layers.length,1);
  // A late fetch must apply current switches, never request-time visibility.
  frontend.statisticalGeometryLoaded.delete(only.jurisdiction);
  let resolve;
  globalThis.fetch=()=>new Promise(done=>{resolve=done;});
  const pending=frontend.ensureStatisticalGeometry(only.jurisdiction);
  frontend.setSeparateStatisticalGeometry(false);
  resolve(respond(only.jurisdiction+'/stat'));await pending;
  assert.equal(count(),0);
 }finally{Object.assign(globalThis,previous);}
});
