import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
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
 const md120=entities.find(e=>e.id==='stat-MD120');
 assert.equal(md120.statistical.code,'MD120');
 assert.equal(md120.representation.osm_statistical_ref,'MD121');
 assert.equal(md120.representation.osm_ref_is_identity_authority,false);
 assert.ok(!roles.some(e=>e.statistical.code==='MD121'));
});

test('visibility intersects geometry and statistical role switches without duplicating reuse',()=>{
 for(const entity of entities){
  const state=options();assert.equal(geometryVisible(entity,state),true);
  if(entity.category!=='statistical'){
   state.geometryClasses.delete(geometryClass(entity));
   assert.equal(geometryVisible(entity,state),false);
  }
  const stats=options();stats.separateStatisticalGeometry=false;
  assert.equal(geometryVisible(entity,stats),entity.category!=='statistical');
  if(entity.roles.includes('statistical')){
   const role=options();role.statisticalLevels.delete(statisticalLevel(entity));
   assert.equal(geometryVisible(entity,role),false);
  }
 }
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
 let app=await readFile('app.js','utf8');
 app=app.replace(/^import .*?;\n/,'');
 const start=app.indexOf('const actualReleasePromise='),end=app.indexOf('async function loadIndex()',start);
 app=app.slice(0,start)+'const actualReleasePromise=Promise.resolve();\n'+app.slice(end);
 app=app.slice(0,app.indexOf("document.getElementById('details-close')"));
 const element=()=>({textContent:'',innerHTML:'',checked:true,querySelector:()=>null});
 const elements=new Map();
 const doc={getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll:()=>[]};
 const layerGroup=()=>({layers:[],clearLayers(){this.layers=[];},addLayer(layer){this.layers.push(layer);},hasLayer(layer){return this.layers.includes(layer);},removeLayer(layer){this.layers=this.layers.filter(x=>x!==layer);},addTo(){return this;},eachLayer(fn){this.layers.forEach(fn);}});
 const L={
  map:()=>({setView(){return this;},fitBounds(){},getZoom:()=>6}),tileLayer:()=>({addTo(){}}),control:{scale:()=>({addTo(){}})},layerGroup,
  geoJSON:(data,config)=>{
   const group=layerGroup();
   for(const feature of data.features.filter(config.filter)){
    const layer={feature,bindTooltip(){return this;},on(){},setStyle(style){this.style=style;}};
    config.onEachFeature(feature,layer);group.addLayer(layer);
   }
   group.addTo=target=>{target.addLayer(group);return group;};return group;
  }
 };
 const context=vm.createContext({L,document:doc,console,geometryClass,geometryVisible,geometryLabels,statisticalLevel,administrativeClasses});
 vm.runInContext(app,context);
 context.entities=entities;
 vm.runInContext('for(const entity of entities)entityById.set(entity.id,entity);',context);
 const only=entities.find(e=>e.category==='statistical'),reused=entities.find(e=>e.category!=='statistical'&&e.roles.includes('statistical'));
 context.only=only;context.reused=reused;
 vm.runInContext(`statisticalGeometryLoaded.add(only.jurisdiction);
 statisticalFeatureById.set(only.id,{type:'Feature',properties:{entity_id:only.id},geometry:null});
 renderStatisticalGeometry(only.jurisdiction);`,context);
 const count=()=>vm.runInContext('statisticalGroups[only.jurisdiction].layers[0].layers.length',context);
 assert.equal(count(),1);
 vm.runInContext('activeStatisticalLevels.delete(statisticalLevel(only));refreshGeometryVisibility();',context);
 assert.equal(count(),0);
 await vm.runInContext('selectEntity(only.id)',context);
 assert.equal(count(),0);
 assert.equal(vm.runInContext('selectedEntityId',context),only.id);
 assert.match(elements.get('selection-visibility').textContent,/ascunsă/);
 vm.runInContext('activeStatisticalLevels.add(statisticalLevel(only));refreshGeometryVisibility();',context);
 assert.equal(count(),1);
 vm.runInContext('separateStatisticalGeometry=false;refreshGeometryVisibility();',context);
 assert.equal(count(),0);
 vm.runInContext('separateStatisticalGeometry=true;refreshGeometryVisibility();',context);
 assert.equal(count(),1);
 context.data={features:[{properties:{entity_id:reused.id}}]};
 vm.runInContext('const testGroup=L.layerGroup();renderCollection(testGroup,data);',context);
 assert.equal(vm.runInContext('testGroup.layers[0].layers.length',context),1);
 vm.runInContext('activeFilterGroups.delete(geometryClass(reused));renderCollection(testGroup,data);',context);
 assert.equal(vm.runInContext('testGroup.layers[0].layers.length',context),0);
 await vm.runInContext('selectEntity(reused.id)',context);
 assert.equal(vm.runInContext('testGroup.layers[0].layers.length',context),0);
 // A late fetch must apply current switches, never stale selection-time visibility.
 context.payload={metadata:{contract:'actual-public-statistical-geometry-v1',jurisdiction:only.jurisdiction},features:[{properties:{entity_id:only.id}}]};
 let resolve;
 context.fetch=()=>new Promise(done=>{resolve=done;});
 vm.runInContext('statisticalGeometryLoaded.delete(only.jurisdiction);releaseData={manifest:{public_contract:{statistical_geometry:{[only.jurisdiction]:{path:"fixture"}}}}};',context);
 const pending=vm.runInContext('ensureStatisticalGeometry(only.jurisdiction)',context);
 vm.runInContext('separateStatisticalGeometry=false;',context);
 resolve({ok:true,json:async()=>context.payload});await pending;
 assert.equal(count(),0);
});
