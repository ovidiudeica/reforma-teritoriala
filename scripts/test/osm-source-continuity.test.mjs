import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOsmSourceContinuity,assessOsmSourceContinuityCountry,summarizeOsmSourceContinuity,previousScopedRelationsNeedingLiveVerification} from '../lib/osm-source-continuity.mjs';

const mkEntry=ids=>({selected_relation_ids:ids,selected_relation_count:ids.length,
  continuity_recovered_relation_ids:[],continuity_retired_relation_ids:[]});
const manifest=(ro,md,at='2026-10-18T09:00:45.897Z')=>({
  schema_version:2,snapshot_at:at,countries:{RO:mkEntry(ro),MD:mkEntry(md)}
});
const raw=(ids,overrides={})=>({elements:ids.map(id=>({
  type:'relation',id,version:1,tags:{
    boundary:'administrative',admin_level:'8',name:'Relation '+id,...(overrides[id]||{})
  }
}))});
const fixture=()=>{
  const before=manifest([1,2],[100,101,102],'2026-10-05T23:50:05.218Z');
  const after=manifest([1,2],[100,101,102]);
  return {before,after,beforeRaw:{RO:raw([1,2]),MD:raw([100,101,102])},
    afterRaw:{RO:raw([1,2]),MD:raw([100,101,102])}};
};
test('unchanged accepted membership passes without fabricating new relations',()=>{
  const result=assessOsmSourceContinuity(fixture());
  assert.equal(result.status,'PASS');
  assert.equal(result.missing_total,0);
  assert.equal(result.countries.MD.previous_selected_count,3);
});
test('each missing relation gets a stable individual OSM-ID and original provenance',()=>{
  const input=fixture();
  input.after.countries.MD=mkEntry([100]);
  input.afterRaw.MD=raw([100,101,102]);
  const result=assessOsmSourceContinuity(input);
  assert.equal(result.status,'BLOCKED_UNADJUDICATED_OSM_RELATION_DRIFT');
  assert.equal(result.missing_total,2);
  assert.deepEqual(result.countries.MD.missing.map(x=>x.relation_id),[101,102]);
  assert.equal(result.countries.MD.missing[0].cause_class,'present_in_raw_but_excluded_from_selected_scope');
  assert.equal(result.countries.MD.missing[0].previous.name,'Relation 101');
});
test('absent source relation remains blocked, never inherited from old geometry',()=>{
  const input=fixture();
  input.after.countries.MD=mkEntry([100]);
  input.afterRaw.MD=raw([100]);
  const result=assessOsmSourceContinuity(input);
  assert.equal(result.countries.MD.missing[0].cause_class,'missing_from_candidate_raw');
  assert.equal(result.countries.MD.missing[0].candidate,null);
});
test('new OSM membership is recorded, not silently discarded',()=>{
  const input=fixture();
  input.after.countries.MD=mkEntry([100,101,102,104]);
  input.afterRaw.MD=raw([100,101,102,104]);
  const result=assessOsmSourceContinuity(input);
  assert.equal(result.status,'PASS');
  assert.equal(result.added_total,1);
  assert.deepEqual(result.countries.MD.added.map(x=>x.relation_id),[104]);
});
test('fail closed when selected ID is not backed by a raw OSM relation',()=>{
  const input=fixture();
  input.afterRaw.MD=raw([100,101]);
  assert.throws(()=>assessOsmSourceContinuityCountry({
    code:'MD',before:input.before,after:input.after,
    beforeRaw:input.beforeRaw.MD,afterRaw:input.afterRaw.MD
  }),/no raw provenance/);
});
test('duplicate IDs and forged selected counts fail closed',()=>{
  const input=fixture();
  input.after.countries.MD.selected_relation_ids=[100,100,102];
  assert.throws(()=>assessOsmSourceContinuity(input),/duplicate/);
  input.after.countries.MD.selected_relation_ids=[100,101,102];
  input.after.countries.MD.selected_relation_count=2;
  assert.throws(()=>assessOsmSourceContinuity(input),/count\/IDs mismatch/);
});
test('cannot mark partial country evidence as PASS',()=>{
  const input=fixture();
  assert.throws(()=>summarizeOsmSourceContinuity({before:input.before,after:input.after,
    countries:{MD:{missing_count:0,added_count:0}}}),/Missing per-country/);
});

test('re-query official OSM API when previous relation survives Overpass but loses scope tags',()=>{
  const old=raw([100,101,102]);
  const current=raw([100,101,103],{101:{boundary:'historic',admin_level:'10'}});
  const matches=element=>element?.tags?.boundary==='administrative'
    &&['4','6','8','9'].includes(element?.tags?.admin_level);
  assert.deepEqual(previousScopedRelationsNeedingLiveVerification(old,current,matches),[101,102]);
});
test('previously in-scope IDs unchanged in Overpass do not trigger unnecessary API calls',()=>{
  const old=raw([100,101]),current=raw([100,101]);
  const matches=element=>element?.tags?.boundary==='administrative';
  assert.deepEqual(previousScopedRelationsNeedingLiveVerification(old,current,matches),[]);
});

test('authoritative HTTP 410 retirement remains visible as evidence, not as a synthetic source recovery',()=>{
  const input=fixture();
  input.after.countries.MD={...mkEntry([100,102]),continuity_retired_relation_ids:[101],
    continuity_relation_attempts:[{relation_id:101,status:'not_found',http_status:410,started_at:'2026-10-20T12:00:22Z'}]};
  input.afterRaw.MD=raw([100,102]);
  const result=assessOsmSourceContinuity(input);
  assert.equal(result.status,'BLOCKED_UNADJUDICATED_OSM_RELATION_DRIFT');
  assert.deepEqual(result.countries.MD.missing[0].authoritative_probe.map(x=>x.http_status),[410]);
  assert.deepEqual(result.countries.MD.retired_by_api,[101]);
});
