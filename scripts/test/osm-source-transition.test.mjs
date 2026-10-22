import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessOsmSourceTransition} from '../lib/osm-source-transition.mjs';

const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const clone=value=>structuredClone(value);

async function fixture(){
 const policy=await readJson('data/sources/osm-source-transition-policy.json');
 const baseline={
  schema_version:2,snapshot_at:policy.baseline.snapshot_at,
  countries:{
   RO:{...policy.baseline.countries.RO},
   MD:{...policy.baseline.countries.MD}
  }
 };
 const candidate=clone(baseline);
 candidate.snapshot_at='2026-10-20T12:00:00.000Z';
 for(const code of ['RO','MD']){
  candidate.countries[code].snapshot_path='data/sources/osm-snapshots/'+code.toLowerCase()+'-'+'a'.repeat(64)+'.json.gz';
  candidate.countries[code].semantic_sha256='a'.repeat(64);
  candidate.countries[code].compressed_sha256='b'.repeat(64);
 }
 candidate.countries.MD.selected_relation_count=2585;
 const missing=policy.expected_transition.retired_relations.map(x=>({
  relation_id:x.relation_id,
  previous:{boundary:x.expected_previous.boundary,admin_level:x.expected_previous.admin_level,place:x.expected_previous.place},
  candidate:null,
  authoritative_probe:[{status:'not_found',http_status:410,started_at:'2026-10-20T12:00:00.000Z'}]
 }));
 const addedExpected=policy.expected_transition.added_relations[0];
 const added=[{
  relation_id:addedExpected.relation_id,
  candidate:{
   name:addedExpected.name,boundary:addedExpected.expected_current.boundary,
   admin_level:addedExpected.expected_current.admin_level,place:addedExpected.expected_current.place,
   type:addedExpected.expected_current.type,ref_cuatm_codunic:addedExpected.cuatm_unique_id,
   ref_rson_idno:addedExpected.rson_idno,version:addedExpected.version,
   timestamp:addedExpected.timestamp,changeset:addedExpected.changeset
  }
 }];
 const continuity={
  schema:'osm-source-per-id-continuity-v1',
  countries:{
   RO:{missing_count:0,added_count:0,missing:[],added:[],retired_by_api:[]},
   MD:{missing_count:missing.length,added_count:added.length,missing,added,
    retired_by_api:policy.expected_transition.retired_relations.map(x=>x.relation_id)}
  }
 };
 return {policy,baseline,candidate,continuity};
}

test('exact 12-retired/1-added OSM-FIX.2 transition passes source-only without ACTUAL authorization',async()=>{
 const x=await fixture();
 const result=assessOsmSourceTransition(x);
 assert.equal(result.status,'PASS_SOURCE_ONLY_TRANSITION',JSON.stringify(result.failures));
 assert.equal(result.actual_contract.mutation_allowed,false);
 assert.equal(result.actual_contract.p91_import_allowed,false);
 assert.equal(result.actual_contract.semantic_acceptance,'BLOCKED_INCOMPLETE');
});

test('unknown retired relation remains fail-closed',async()=>{
 const x=await fixture();
 x.continuity.countries.MD.missing.push({
  relation_id:999999999,previous:{boundary:'administrative',admin_level:'9',place:'allotments'},
  candidate:null,authoritative_probe:[{status:'not_found',http_status:410}]
 });
 x.continuity.countries.MD.missing_count++;
 const result=assessOsmSourceTransition(x);
 assert.equal(result.status,'BLOCKED_SOURCE_TRANSITION');
 assert.ok(result.failures.some(f=>f.name==='exact_retired_relation_set'));
});

test('retirement without authoritative 410 remains fail-closed',async()=>{
 const x=await fixture();
 x.continuity.countries.MD.missing[0].authoritative_probe=[{status:'not_found',http_status:404}];
 const result=assessOsmSourceTransition(x);
 assert.equal(result.status,'BLOCKED_SOURCE_TRANSITION');
 assert.ok(result.failures.some(f=>f.name.includes('authoritative_410')));
});

test('unexpected added-relation identity metadata remains fail-closed',async()=>{
 const x=await fixture();
 x.continuity.countries.MD.added[0].candidate.ref_cuatm_codunic='DIFFERENT';
 const result=assessOsmSourceTransition(x);
 assert.equal(result.status,'BLOCKED_SOURCE_TRANSITION');
 assert.ok(result.failures.some(f=>f.name.includes('current_osm_semantics')));
});

test('source contract leaves ACTUAL bundle pinned to historical OSM manifest',async()=>{
 const [contract,bundle,release]=await Promise.all([
  readJson('data/sources/osm-source-contract.json'),
  readJson('data/current/actual-source-bundle-manifest.json'),
  readJson('data/current/actual-release-manifest.json')
 ]);
 assert.equal(contract.mode,'OSM_SOURCE_ACTUAL_SEPARATION');
 assert.equal(contract.current_osm.manifest_path,'data/sources/osm-source-current.json');
 assert.equal(contract.actual_osm_pin.manifest_path,'data/sources/osm-current.json');
 assert.notEqual(contract.current_osm.manifest_path,contract.actual_osm_pin.manifest_path);
 assert.equal(bundle.sources.osm.manifest_path,'data/sources/osm-current.json');
 assert.equal(bundle.bundle_fingerprint_sha256,'af47dea86743da4fe6dc95928b5b3e311b83f392b1bc094568a47a2af27c657b');
 assert.equal(release.snapshot_id,'actual-a9e5a4ddcb5277ef');
 assert.equal(release.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
 assert.equal(contract.guards.actual_mutation_allowed,false);
 assert.equal(contract.guards.p91_import_allowed,false);
 assert.equal(contract.guards.semantic_acceptance,'BLOCKED_INCOMPLETE');
});
