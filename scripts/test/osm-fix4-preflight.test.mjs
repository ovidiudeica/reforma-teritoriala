import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFix4,assembleRings,relationGeometry,changesetElement} from '../lib/osm-fix4-preflight.mjs';
import {osmElementIndex} from '../lib/osm-element-index.mjs';
const meta={version:1,changeset:1,timestamp:'2026-01-01T00:00:00Z'};
const row=(path,elements)=>({path,http_status:200,error:null,elements:structuredClone(elements)});
function fixture(neighbor=false){
 const nodes=[[1,0,1],[2,0,1],[3,1,0],[4,1,1],[5,0,0]].map(([id,lon,lat])=>({type:'node',id,lon,lat,...meta}));
 const way=(id,ns)=>({type:'way',id,nodes:ns,...meta});
 const a=way(10,[3,4,1]),b=way(11,[2,5,3]),c=way(12,[1,5,3]);
 const rel=(id,ways)=>({type:'relation',id,...meta,tags:{type:'boundary',boundary:'administrative',admin_level:'9'},members:ways.map(ref=>({type:'way',ref,role:'outer'}))});
 const x=rel(100,[10,11]),y=rel(200,[10,12]);
 const rows=[row('relation/100/full.json',[...nodes,a,b,x]),row('node/1/ways.json',neighbor?[a,c]:[a]),row('node/2/ways.json',[b]),row('way/10/relations.json',neighbor?[x,y]:[x]),row('way/11/relations.json',[x]),row('relation/100/relations.json',[])];
 if(neighbor)rows.push(row('relation/200/full.json',[...nodes,a,c,y]),row('way/12/relations.json',[y]),row('relation/200/relations.json',[]));
 return {rows,targets:[{relation:100,relation_version:1,way:10,way_version:1,index:2,from:1,to:2}]};
}
test('official changeset-object envelope is required, not silent empty elements',()=>{
 const c=changesetElement({changeset:{id:42,tags:{comment:'synthetic'},uid:99,user:'private'}},42);
 assert.equal(c.id,42);assert.equal(c.user,undefined);assert.equal(c.uid,undefined);
 for(const payload of [{elements:[]},{message:'ANTIDDOS'},{changeset:{id:43}},{changeset:{id:42},elements:[{type:'changeset',id:42}]}])assert.throws(()=>changesetElement(payload,42),/Missing|ambiguous|mismatched/);
});
test('discussion count cannot be accepted as retrieved comment bodies',()=>{
 assert.throws(()=>changesetElement({changeset:{id:42,comments_count:3}},42,{requireDiscussion:true}),/Incomplete/);
 const c=changesetElement({changeset:{id:42,comments_count:1,comments:[{date:'2026-01-01',text:'synthetic',uid:99,user:'private'}]}},42,{requireDiscussion:true});
 assert.equal(c.comments.length,1);assert.equal(c.comments[0].user,undefined);
});
test('ring assembly uses node identity and preserves input order',()=>{
 assert.throws(()=>assembleRings([{id:10,nodes:[1,3,4,2]}]),/OPEN/);
 const a=[{id:10,nodes:[1,2]},{id:11,nodes:[1,3,2]}],before=structuredClone(a);assert.equal(assembleRings(a).length,1);assert.deepEqual(a,before);
 assert.throws(()=>assembleRings([{id:1,nodes:[1,2]},{id:2,nodes:[2,3]},{id:3,nodes:[2,4]}]),/AMBIGUOUS/);
});
test('closed self-intersection fails GIS validation despite even endpoint degrees',()=>{
 const nodes=[[1,0,0],[2,1,1],[3,0,1],[4,1,0]].map(([id,lon,lat])=>({type:'node',id,lon,lat}));
 const raw={elements:[...nodes,{type:'way',id:10,nodes:[1,2,3,4,1]},{type:'relation',id:100,members:[{type:'way',ref:10,role:'outer'}]}]};
 assert.throws(()=>relationGeometry(osmElementIndex(raw),100));
});
test('isolated proposal closes the ring without coordinates/tags or source authority changes',()=>{
 const f=fixture(),before=structuredClone(f.rows),v=assessFix4(f.rows,f.targets);
 assert.equal(v.CONDITIONAL_SIMULATION_PASS,true);assert.equal(v.INVERSE_REFERENCES_VALIDATED,true);assert.deepEqual(f.rows,before);
 assert.equal(v.before[0].geometry_valid,false);assert.equal(v.after[0].geometry_valid,true);assert.ok(v.individual_simulations[0].pass);
 for(const k of ['HORESTI_MAPPER_INTENT_CONFIRMED','BUNETI_MAPPER_INTENT_CONFIRMED','PUBLIC_OSM_EDIT_AUTHORIZED','PUBLIC_OSM_EDIT_EXECUTED','UPSTREAM_TOPOLOGY_FIXED','OSM_SOURCE_PROMOTED','publication_eligible'])assert.equal(v[k],false);
});
test('repairing one relation must not open another parent boundary',()=>{
 const f=fixture(true),v=assessFix4(f.rows,f.targets);
 assert.equal(v.before.find(x=>x.id===200).geometry_valid,true);assert.equal(v.after.find(x=>x.id===200).geometry_valid,false);
 assert.equal(v.CONDITIONAL_SIMULATION_PASS,false);assert.deepEqual(v.individual_simulations[0].new_geometry_failure_ids,[200]);
});
test('partial inverse references remain rejected even with HTTP200',()=>{
 const f=fixture();f.rows.find(r=>r.path==='node/1/ways.json').elements=[];assert.throws(()=>assessFix4(f.rows,f.targets),/Missing known inverse/);
 const g=fixture();g.rows.find(r=>r.path==='way/10/relations.json').elements=[];assert.throws(()=>assessFix4(g.rows,g.targets),/Missing known inverse|Missing target inverse/);
});
test('conflicting versions or failed official requests cannot qualify preflight',()=>{
 const f=fixture();f.rows.find(r=>r.path==='node/1/ways.json').elements[0].version=2;assert.throws(()=>assessFix4(f.rows,f.targets),/Conflicting/);
 const g=fixture();g.rows.find(r=>r.path==='node/1/ways.json').http_status=503;assert.throws(()=>assessFix4(g.rows,g.targets),/Incomplete/);
});
test('coincident-coordinate requirement cannot be waived by authority flags',()=>{
 const f=fixture();for(const r of f.rows)for(const e of r.elements)if(e.type==='node'&&e.id===2)e.lat=.9;
 assert.equal(assessFix4(f.rows,f.targets).CONDITIONAL_SIMULATION_PASS,false);
 const g=fixture();g.targets[0].public_osm_edit_authorized=true;assert.throws(()=>assessFix4(g.rows,g.targets),/authority/);
});
test('fresh version and shifted endpoint are simulated without overwriting recent nodes',()=>{
 const f=fixture();const node={type:'node',id:6,lon:.5,lat:1,...meta};
 for(const r of f.rows){if(r.path.endsWith('/full.json'))r.elements.push(structuredClone(node));for(const e of r.elements)if(e.type==='way'&&e.id===10){e.version=2;e.nodes=[3,4,6,1];}}
 const v=assessFix4(f.rows,f.targets);assert.equal(v.CONDITIONAL_SIMULATION_PASS,true);assert.equal(v.proposals[0].current_way_version,2);assert.equal(v.proposals[0].current_node_index,3);assert.equal(v.proposals[0].proposal_differs_from_reference,true);
});
