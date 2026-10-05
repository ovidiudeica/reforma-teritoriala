import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {resolveOsmSourceScopeConflicts} from '../lib/osm-source-scope-conflicts.mjs';
const relation={type:'relation',id:18967922,version:5,changeset:177933459,tags:{boundary:'administrative',admin_level:'9','ref:cuatm:codunic':'9201'},members:[{type:'way',ref:1,role:'outer'}]};
const raw={elements:[relation,{type:'way',id:1,nodes:[1,2,3,1]},{type:'node',id:1,lon:28,lat:47},{type:'node',id:2,lon:28.1,lat:47},{type:'node',id:3,lon:28.1,lat:47.1}]};
const inventories=()=>({RO:{relation_ids:[90689,18967922],raw:structuredClone(raw)},MD:{relation_ids:[58974,18967922],raw:structuredClone(raw)}});
const fetchAuthoritativeRelation=async()=>({raw:structuredClone(raw),attempts:[{status:'success'}]});
test('authoritative CUATM namespace routes border-overlap Ungheni once to MD without changing raw or coordinates',async()=>{
 const input=inventories(),before=JSON.stringify(input),result=await resolveOsmSourceScopeConflicts({inventories:input,fetchAuthoritativeRelation});
 assert.deepEqual(result.relation_ids.RO,[90689]);assert.deepEqual(result.relation_ids.MD,[58974,18967922]);assert.equal(JSON.stringify(input),before);assert.equal(result.resolutions.length,1);assert.equal(result.resolutions[0].raw_snapshot_edit,false);assert.equal(result.resolutions[0].coordinate_edit,false);assert.equal(result.resolutions[0].legal_identity_assignment,false);assert.equal(result.resolutions[0].registry_namespace_evidence[0].value,'9201');
});
test('disjoint source inventories do not require network scope verification',async()=>{const input=inventories();input.RO.relation_ids=[90689];const result=await resolveOsmSourceScopeConflicts({inventories:input,fetchAuthoritativeRelation:()=>{throw Error('unexpected network');}});assert.equal(result.resolutions.length,0);});
for(const [name,mutate,pattern] of [
 ['unknown namespace',r=>delete r.tags['ref:cuatm:codunic'],/requires review/],
 ['conflicting namespaces',r=>r.tags['ref:siruta']='12345',/requires review/],
 ['changed namespace evidence',r=>r.tags['ref:cuatm:codunic']='9999',/disagrees with snapshot/],
 ['scope retirement',r=>r.tags.boundary='historic',/requires review/]
])test(name+' fails closed',async()=>{const modified=structuredClone(raw);mutate(modified.elements[0]);await assert.rejects(resolveOsmSourceScopeConflicts({inventories:inventories(),fetchAuthoritativeRelation:async()=>({raw:modified})}),pattern);});
test('missing relation or authoritative failure cannot silently remove a selected relation',async()=>{
 await assert.rejects(resolveOsmSourceScopeConflicts({inventories:inventories(),fetchAuthoritativeRelation:async()=>({raw:{elements:[]}})}),/relation missing/);
 await assert.rejects(resolveOsmSourceScopeConflicts({inventories:inventories(),fetchAuthoritativeRelation:async()=>{throw Error('authoritative unavailable');}}),/authoritative unavailable/);
});
test('scope conflict resolution is source-refresh only and persisted before snapshot publication',async()=>{
 const importer=await readFile('scripts/import/import-osm.mjs','utf8');assert.ok(importer.indexOf('const scope=await resolveOsmSourceScopeConflicts')<importer.indexOf('result.snapshotPath=await materializeContentAddressedSnapshot'));assert.match(importer,/source_scope_collision_resolutions/);assert.match(importer,/source_scope_collision_authoritative_attempts/);
 const builder=await readFile('scripts/process/build-osm-actual.mjs','utf8');assert.doesNotMatch(builder,/resolveOsmSourceScopeConflicts|\bfetch\(/);assert.match(builder,/source scope/);
});
