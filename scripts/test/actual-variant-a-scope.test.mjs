import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectCanonicalVariantA} from '../lib/actual-canonical-scope-variant-a.mjs';

const policy=JSON.parse(await readFile('data/sources/actual-variant-a-exclusions.json','utf8'));
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
