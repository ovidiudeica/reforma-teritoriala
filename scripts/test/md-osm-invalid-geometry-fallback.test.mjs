import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 MD_MALCOCI_INVALID_OSM_FALLBACK,
 inspectMalcociInvalidOsmContract,
 assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints,
 applyReviewedMalcociLastValidOsmGeometry
} from '../lib/md-osm-invalid-geometry-fallback.mjs';

const cfg=MD_MALCOCI_INVALID_OSM_FALLBACK;

function syntheticBrokenRaw(){
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
 const ways=cfg.expected_members.map((expected,index)=>({
  type:'way',
  id:expected.ref,
  version:expected.version,
  changeset:expected.changeset,
  timestamp:expected.timestamp,
  nodes:endpointPairs[index]
 }));
 const relation={
  type:'relation',
  id:cfg.relation_id,
  version:cfg.expected_relation_version,
  changeset:cfg.expected_relation_changeset,
  timestamp:cfg.expected_relation_timestamp,
  tags:{admin_level:'9',boundary:'administrative','ref:cuatm:codunic':cfg.legal_id,name:'Malcoci',place:'village',type:'boundary'},
  members:cfg.expected_members.map(x=>({type:'way',ref:x.ref,role:x.role}))
 };
 return {version:0.6,elements:[...nodes,...ways,relation]};
}

function syntheticOpenGeo(){
 return {
  type:'FeatureCollection',
  features:[{
   type:'Feature',
   id:'relation/18968071',
   properties:{tags:{name:'Malcoci'}},
   geometry:{type:'Polygon',coordinates:[[
    [28.6176407,47.0341981],
    [28.63,47.03],
    [28.64,47.02],
    [28.617828,47.0343526]
   ]]}
  }]
 };
}

test('reviewed Malcoci live OSM defect contract is exact and fail-closed',()=>{
 const raw=syntheticBrokenRaw();
 const inspected=inspectMalcociInvalidOsmContract(raw);
 assert.deepEqual(inspected.odd_endpoints.map(x=>x.node_id).sort((a,b)=>a-b),[353223870,1379403420].sort((a,b)=>a-b));

 const memberDrift=structuredClone(raw);
 memberDrift.elements.find(x=>x.type==='way'&&x.id===1376180717).version=9;
 assert.throws(()=>inspectMalcociInvalidOsmContract(memberDrift),/member way contract drift/);

 const endpointDrift=structuredClone(raw);
 endpointDrift.elements.find(x=>x.type==='node'&&x.id===353223870).lon+=0.0001;
 assert.throws(()=>inspectMalcociInvalidOsmContract(endpointDrift),/open-ring endpoint contract drift/);
});

test('reviewed Malcoci exception only accepts the exact open live ring',()=>{
 const open=syntheticOpenGeo().features[0];
 assert.doesNotThrow(()=>assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints(open));

 const fixed=structuredClone(open);
 fixed.geometry.coordinates[0].push([...fixed.geometry.coordinates[0][0]]);
 assert.throws(
  ()=>assertMalcociGeojsonIsExactlyOpenAtReviewedEndpoints(fixed),
  /now closed; remove stale fallback/
 );
});

test('reviewed Malcoci fallback derives a closed polygon from the content-addressed OSM snapshot without fabricating a closure',async()=>{
 const raw=syntheticBrokenRaw(),geo=syntheticOpenGeo(),report={warnings:[]};
 const applied=await applyReviewedMalcociLastValidOsmGeometry({country:'MD',raw,geo,report});
 assert.equal(applied,true);
 const f=geo.features[0];
 assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type));
 const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
 assert.ok(rings.length>0);
 for(const ring of rings)assert.deepEqual(ring[0],ring.at(-1));
 assert.equal(f.properties.topology_normalization,'reviewed_last_valid_osm_geometry_fallback');
 assert.equal(f.properties.fabricated_closure,false);
 assert.equal(f.properties.geometry_source_snapshot_semantic_sha256,cfg.fallback_snapshot.semantic_sha256);
 assert.equal(report.warnings.length,1);
 assert.equal(report.warnings[0].geometry_source_snapshot_stale,true);
 assert.equal(report.warnings[0].fabricated_closure,false);

 const bytes=await readFile(cfg.fallback_snapshot.path);
 assert.ok(bytes.length>0);
});

test('OSM importer reads Malcoci authoritatively and builder applies fallback before country membership',async()=>{
 const [importer,builder]=await Promise.all([
  readFile('scripts/import/import-osm.mjs','utf8'),
  readFile('scripts/process/build-osm-actual.mjs','utf8')
 ]);
 assert.match(importer,/requiredRelations:\[1813306,1813297,58512,1813315,1813316,18968071\]/);
 const normalize=builder.indexOf('applyReviewedMalcociLastValidOsmGeometry({country:code,raw,geo,report})');
 const membership=builder.indexOf('const allPolygons=geo.features.filter');
 assert.ok(normalize>=0&&membership>normalize,'Malcoci reviewed fallback must be applied before country-membership filtering');
});
