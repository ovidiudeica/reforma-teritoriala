import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {selectCanonicalVariantA,rebindVariantAStatisticalPolicy} from '../lib/actual-canonical-scope-variant-a.mjs';

const policy=JSON.parse(await readFile('docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json','utf8'));
const feature=x=>({
 type:'Feature',
 id:'relation/'+x.osm_relation_id,
 properties:{tags:{
  admin_level:'9',boundary:'administrative',
  ...(x.classification_method==='structural_rule'?{place:'allotments'}:{name:'Î.P. „Mure Dulci”','name:prefix':'Întovărășirea pomicolă'})
 }},
 geometry:{type:'Polygon',coordinates:[]}
});
const relationId=f=>Number(f.id.split('/')[1]);
const readTags=f=>f.properties.tags;
const options={jurisdiction:'MD',relationId,readTags};
const active={type:'Feature',id:'relation/987654321',properties:{tags:{admin_level:'8',boundary:'administrative',place:'village'}},geometry:{type:'Polygon',coordinates:[]}};

test('RT-VA1 excludes exactly 123 verified IDs, including Mure Dulci, preserving administrative locality',()=>{
 const selected=[...policy.exclusions.map(feature),active];
 const r=selectCanonicalVariantA(selected,policy,options);
 assert.equal(r.excluded.length,123);
 assert.deepEqual(r.polygons.map(x=>x.id),[active.id]);
 assert.equal(r.excluded.filter(x=>x.classification_method==='reviewed_override').length,1);
 assert.ok(r.excluded.some(x=>x.id==='osm-r12104738'));
});

test('RT-VA1 does not exclude Romanian canonical geometries',()=>{
 const candidates=[...policy.exclusions.map(feature),active];
 const r=selectCanonicalVariantA(candidates,policy,{...options,jurisdiction:'RO'});
 assert.equal(r.polygons.length,candidates.length);
 assert.equal(r.excluded.length,0);
});

test('RT-VA1 fails closed when reviewed relation disappeared',()=>{
 const absent=policy.exclusions.filter(x=>x.id!=='osm-r12104738').map(feature);
 assert.throws(()=>selectCanonicalVariantA(absent,policy,options),/missing|absent/i);
});

test('RT-VA1 fails closed on changed reviewed OSM semantics',()=>{
 const altered=policy.exclusions.map(feature);
 const mure=altered.find(x=>x.id==='relation/12104738');
 mure.properties.tags.place='allotments';
 assert.throws(()=>selectCanonicalVariantA(altered,policy,options),/Mure Dulci/);
});

test('RT-VA1 blocks silently importing a new allotment outside the vetted 123',()=>{
 const newAllotment={...active,properties:{tags:{admin_level:'9',boundary:'administrative',place:'allotments'}}};
 assert.throws(()=>selectCanonicalVariantA([...policy.exclusions.map(feature),newAllotment],policy,options),/individual review/i);
});

test('RT-VA1 does not accept an incomplete or duplicated reviewed roster',()=>{
 const bad={...policy,exclusions:policy.exclusions.slice(1)};
 assert.throws(()=>selectCanonicalVariantA(policy.exclusions.map(feature),bad,options),/missing|population/i);
});

test('RT-VA1 binds all 123 reviewed IDs to archived raw evidence and current MD OSM selection',async()=>{
 const evidenceBytes=await readFile(policy.source_evidence.path);
 assert.equal(createHash('sha256').update(evidenceBytes).digest('hex'),policy.source_evidence.sha256);
 const evidence=JSON.parse(evidenceBytes);
 assert.equal(evidence.count,123);
 const archived=new Set(evidence.items.map(x=>x.id));
 assert.equal(archived.size,123);
 assert.deepEqual([...archived].sort(),policy.exclusions.map(x=>x.id).sort());
 const osm=JSON.parse(await readFile('data/sources/osm-current.json','utf8'));
 const mdIds=new Set(osm.countries.MD.selected_relation_ids.map(Number));
 for(const row of policy.exclusions)assert.ok(mdIds.has(row.osm_relation_id),'missing OSM selection '+row.id);
});

test('RT-VA1 importer executes the reviewed selector before materializing canonical entities',async()=>{
 const source=await readFile('scripts/process/build-osm-actual.mjs','utf8');
 const selector=source.indexOf('selectCanonicalVariantA(polygons,policy,');
 const entityBuild=source.indexOf('const entities=polygons.map(');
 assert.ok(selector>0&&entityBuild>selector,'semantic selector must precede canonical materialization');
 assert.match(source,/evidenceSha!==policy\.source_evidence\.sha256/);
 assert.match(source,/if\(code==='MD'\)/);
});

test('RT-VA1 changes only four exact P2 census fields and is idempotent',async()=>{
 const baseline=JSON.parse(await readFile('data/sources/actual-statistical-policy.json','utf8'));
 const migrated=rebindVariantAStatisticalPolicy(baseline);
 assert.notStrictEqual(migrated,baseline);
 assert.equal(baseline.progress.P2_3_PUBLIC.public_entity_count,5848);
 assert.equal(migrated.progress.P2_3_PUBLIC.public_entity_count,5725);
 assert.equal(migrated.p1_invariants.expected_entity_count,5707);
 assert.equal(migrated.p1_invariants.expected_entity_count_by_jurisdiction.MD,2473);
 assert.equal(migrated.progress.P2_3_PUBLIC.entity_count_by_jurisdiction.MD,2479);
 assert.equal(migrated.progress.P2_3_PUBLIC.statistical_role_entity_count,63);
 assert.equal(migrated.progress.P2_3_PUBLIC.entity_count_by_jurisdiction.RO,3246);
 assert.strictEqual(rebindVariantAStatisticalPolicy(migrated),migrated);
 const reverted=structuredClone(migrated);reverted.progress.P2_3_PUBLIC.public_entity_count=5848;
 assert.throws(()=>rebindVariantAStatisticalPolicy(reverted),/population/);
});
