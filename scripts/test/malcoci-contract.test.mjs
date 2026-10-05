import test from 'node:test';
import assert from 'node:assert/strict';
import {MD_MALCOCI_INVALID_OSM_FALLBACK,inspectMalcociInvalidOsmContract,assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints,applyReviewedMalcociLastValidOsmGeometry} from '../lib/md-osm-invalid-geometry-fallback.mjs';
const malcociCfg=MD_MALCOCI_INVALID_OSM_FALLBACK;
function syntheticBrokenMalcociRaw(){
 const endpointPairs=[
  [7298612217,353223870],
  [8401795301,7298612217],
  [8401795301,12742046176],
  [8401795250,12742046176],
  [8401795250,7302127276],
  [1379403421,7302127276],
  [1379403420,1379403421]
 ];
 const nodes=[
  {type:'node',id:353223870,lon:28.6176407,lat:47.0341981},
  {type:'node',id:1379403420,lon:28.617828,lat:47.0343526}
 ];
 const ways=malcociCfg.expected_members.map((expected,index)=>({
  type:'way',id:expected.ref,version:expected.version,changeset:expected.changeset,timestamp:expected.timestamp,nodes:endpointPairs[index]
 }));
 const relation={
  type:'relation',id:malcociCfg.relation_id,version:malcociCfg.expected_relation_version,
  changeset:malcociCfg.expected_relation_changeset,timestamp:malcociCfg.expected_relation_timestamp,
  tags:{admin_level:'9',boundary:'administrative','ref:cuatm:codunic':malcociCfg.legal_id,name:'Malcoci',place:'village',type:'boundary'},
  members:malcociCfg.expected_members.map(x=>({type:'way',ref:x.ref,role:x.role}))
 };
 return {version:0.6,elements:[...nodes,...ways,relation]};
}
function syntheticOpenMalcociGeo(){
 return {type:'FeatureCollection',features:[{
  type:'Feature',id:'relation/18968071',properties:{tags:{name:'Malcoci'}},
  geometry:{type:'Polygon',coordinates:[[
   [28.6176407,47.0341981],[28.63,47.03],[28.64,47.02],[28.617828,47.0343526]
  ]]}
 }]};
}

test('Malcoci invalid-live-boundary exception is exact, OSM-derived and self-expiring',async()=>{
 const raw=syntheticBrokenMalcociRaw();
 const inspected=inspectMalcociInvalidOsmContract(raw);
 assert.deepEqual(inspected.odd_endpoints.map(x=>x.node_id).sort((a,b)=>a-b),[353223870,1379403420].sort((a,b)=>a-b));

 const memberDrift=structuredClone(raw);
 memberDrift.elements.find(x=>x.type==='way'&&x.id===1376180717).version=9;
 assert.throws(()=>inspectMalcociInvalidOsmContract(memberDrift),/member way contract drift/);

 const endpointDrift=structuredClone(raw);
 endpointDrift.elements.find(x=>x.type==='node'&&x.id===353223870).lon+=0.0001;
 assert.throws(()=>inspectMalcociInvalidOsmContract(endpointDrift),/open-ring endpoint contract drift/);

 const open=syntheticOpenMalcociGeo();
 assert.doesNotThrow(()=>assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints(open.features[0]));
 const repaired=structuredClone(open.features[0]);
 repaired.geometry.coordinates[0].push([...repaired.geometry.coordinates[0][0]]);
 assert.throws(()=>assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints(repaired),/now closed; remove stale fallback/);

 const report={warnings:[]};
 await assert.rejects(applyReviewedMalcociLastValidOsmGeometry({
  country:'MD',raw,geo:open,report,
  convertRawToGeoJson:()=>({type:'FeatureCollection',features:[{
   type:'Feature',id:'relation/18968071',properties:{},
   geometry:{type:'Polygon',coordinates:[[[28.6176407,47.0341981],[28.63,47.03],[28.64,47.02],[28.617828,47.0343526],[28.6176407,47.0341981]]]}
  }]})
 }),/Historical geometry fallback is prohibited/);
});

test('exact defect cannot activate stale geometry with different live boundary segments',async()=>{
 await assert.rejects(applyReviewedMalcociLastValidOsmGeometry({country:'MD',raw:syntheticBrokenMalcociRaw(),geo:syntheticOpenMalcociGeo(),convertRawToGeoJson:()=>({features:[{id:'relation/18968071',geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]})}),/differs from current OSM boundary segments/);
});
