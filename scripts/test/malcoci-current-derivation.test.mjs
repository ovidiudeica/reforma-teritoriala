import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
// Persisted-release regressions run before production dependency installation.
// Provision only the cryptographically verified offline bundle, with scripts and network disabled.
const require=createRequire(import.meta.url);
try{require.resolve('osmtogeojson');require.resolve('jsts/org/locationtech/jts/io/GeoJSONReader.js');}
catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;execFileSync(process.execPath,['scripts/process/install-actual-npm-offline.mjs'],{stdio:'pipe'});}
const {default:osmtogeojson}=await import('osmtogeojson');
const {applyReviewedMalcociCurrentOsmGeometry:apply,deriveReviewedMalcociCurrentOsmGeometry:derive,geometrySegments,segmentDifference}=await import('../lib/md-current-osm-boundary-derivation.mjs');
const {auditCountryOsmFidelity}=await import('../lib/actual-osm-fidelity.mjs');
import {MD_MALCOCI_INVALID_OSM_FALLBACK as old,applyReviewedMalcociLastValidOsmGeometry as historicalApply} from '../lib/md-osm-invalid-geometry-fallback.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/malcoci-reviewed-current-osm.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(fixture),sourceGeo=raw=>osmtogeojson(raw,{flatProperties:false});
test('exact reviewed live defect derives only current OSM union, preserves raw source and every live/connector segment',()=>{
 const raw=copy(),before=JSON.stringify(raw),geo=sourceGeo(raw),report={warnings:[]};
 const d=derive(raw),actual=geometrySegments(d.geometry),expected=new Set([...d.liveSegments,...d.connectorSegments]);
 assert.deepEqual(segmentDifference(expected,actual),{missing:[],extra:[]});
 assert.equal(d.audit.live_segment_count,498);assert.equal(d.audit.connector_segment_count,2);assert.equal(d.audit.union_segment_count,500);
 assert.ok([...d.liveSegments].every(s=>actual.has(s)));assert.ok([...d.connectorSegments].every(s=>actual.has(s)));
 assert.equal(apply({country:'MD',raw,geo,report}),true);assert.equal(JSON.stringify(raw),before);
 assert.equal(raw.elements.find(e=>e.type==='relation'&&e.id===18968071).members.some(m=>m.ref===123810097),false);
 const f=geo.features.find(f=>f.id==='relation/18968071');assert.equal(f.properties.geometry_derivation,'reviewed_current_osm_boundary_network');
 assert.equal(f.properties.coordinate_edit,false);assert.equal(f.properties.source_relation_membership_edit,false);assert.equal(f.properties.historical_geometry_fallback,false);assert.equal(report.warnings[0].missing,0);assert.equal(report.warnings[0].extra,0);
});
for(const [name,mutate,pattern] of [
 ['connector endpoint drift',r=>r.elements.find(e=>e.type==='way'&&e.id===123810097).nodes[0]=42,/connector endpoint drift/],
 ['connector node membership drift',r=>r.elements.find(e=>e.type==='way'&&e.id===123810097).nodes.splice(1,0,353223870),/connector geometry\/node contract drift/],
 ['connector coordinate drift',r=>r.elements.find(e=>e.type==='node'&&e.id===14251506230).lon+=0.000001,/connector geometry\/node contract drift/],
 ['connector version drift',r=>r.elements.find(e=>e.type==='way'&&e.id===123810097).version++,/connector geometry\/node contract drift/],
 ['live member node drift',r=>{const w=r.elements.find(e=>e.type==='way'&&e.id===1565133360);r.elements.find(e=>e.type==='node'&&e.id===w.nodes[2]).lat+=0.000001;},/live member geometry\/node contract drift/],
 ['evidence membership drift',r=>{const e=r.elements.find(e=>e.type==='relation'&&e.id===1691800);e.members=e.members.filter(m=>m.ref!==123810097);},/evidence relation membership\/contract drift/],
 ['evidence version drift',r=>r.elements.find(e=>e.type==='relation'&&e.id===1691801).version++,/evidence relation membership\/contract drift/],
 ['different invalid relation contract',r=>r.elements.find(e=>e.type==='relation'&&e.id===18968071).version++,/relation contract drift/],
 ['different odd endpoints',r=>r.elements.find(e=>e.type==='node'&&e.id===353223870).lon+=0.000001,/endpoint contract drift/],
 ['missing evidence',r=>r.elements=r.elements.filter(e=>!(e.type==='relation'&&e.id===18822134)),/evidence relation membership\/contract drift/]
])test(name+' fails closed',()=>{const raw=copy();mutate(raw);assert.throws(()=>derive(raw),pattern);});
test('repaired valid OSM relation uses source polygon directly without connector exception',()=>{
 const raw=copy(),r=raw.elements.find(e=>e.type==='relation'&&e.id===18968071);r.version++;r.members.push({type:'way',ref:123810097,role:'outer'});
 const geo=sourceGeo(raw),before=structuredClone(geo);assert.equal(apply({country:'MD',raw,geo}),false);assert.deepEqual(geo,before);
});
test('missing relation fails closed even if a polygon is supplied',()=>{const raw=copy(),geo=sourceGeo(raw);raw.elements=raw.elements.filter(e=>!(e.type==='relation'&&e.id===18968071));assert.throws(()=>apply({country:'MD',raw,geo}),/source relation missing/);});
test('historical valid snapshot is no-op; all 98 segments absent from history survive current derivation',async()=>{
 const historic=JSON.parse(gunzipSync(await readFile(old.fallback_snapshot.path)));const historicGeo=sourceGeo(historic);
 const before=JSON.stringify(historicGeo.features.find(f=>f.id==='relation/18968071'));assert.equal(apply({country:'MD',raw:historic,geo:historicGeo}),false);
 assert.equal(JSON.stringify(historicGeo.features.find(f=>f.id==='relation/18968071')),before);
 const oldSegments=geometrySegments(historicGeo.features.find(f=>f.id==='relation/18968071').geometry),d=derive(copy()),newSegments=geometrySegments(d.geometry);
 const missingFromHistory=[...d.liveSegments].filter(s=>!oldSegments.has(s));assert.equal(missingFromHistory.length,98);assert.equal(missingFromHistory.filter(s=>newSegments.has(s)).length,98);
 console.log('Malcoci historical drift coverage: 98/98; live=498 connector=2 union=500 missing=0 extra=0');
 await assert.rejects(historicalApply({country:'MD',raw:copy(),geo:sourceGeo(copy()),convertRawToGeoJson:osmtogeojson}),/differs from current OSM boundary segments.*98/);
});

test('exact fidelity audit accepts only pinned Malcoci union and rejects a corrupted or generic exemption',()=>{
 const raw=copy(),geo=sourceGeo(raw);apply({country:'MD',raw,geo});const f=geo.features.find(f=>f.id==='relation/18968071');
 const master={features:[f]};assert.equal(auditCountryOsmFidelity({country:'MD',raw,master}).status,'PASS');
 const bad=structuredClone(master);bad.features[0].geometry.coordinates[0][10][0]+=0.0001;assert.equal(auditCountryOsmFidelity({country:'MD',raw,master:bad}).status,'FAIL');
 const generic=structuredClone(master);generic.features[0].id='relation/18822134';assert.equal(auditCountryOsmFidelity({country:'MD',raw,master:generic}).status,'FAIL');
 const metadata=structuredClone(master);metadata.features[0].properties.connector_way_id=1;assert.equal(auditCountryOsmFidelity({country:'MD',raw,master:metadata}).status,'FAIL');
});

test('candidate mandatory fidelity proof runs after reconciliation with source phase already complete',async()=>{
 const runner=await readFile('scripts/process/run-actual-deterministic-candidate.sh','utf8');
 assert.ok(runner.indexOf('npm run build:actual-public-data')>runner.indexOf('npm run apply:md-reviewed-reconciliation'));
 const builder=await readFile('scripts/process/build-osm-actual.mjs','utf8');assert.match(builder,/applyReviewedMalcociCurrentOsmGeometry/);assert.doesNotMatch(builder,/applyReviewedMalcociLastValidOsmGeometry/);
 const importer=await readFile('scripts/import/import-osm.mjs','utf8');assert.match(importer,/18968071,1691800,1691801,18822134/);
 const publicBuilder=await readFile('scripts/process/build-actual-public-data.mjs','utf8');assert.match(publicBuilder,/historical_geometry_fallback/);assert.match(publicBuilder,/reviewed_current_osm_boundary_network/);
});
