import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HISTORICAL_ACTUAL,VARIANT_A_ACTUAL,trustedActualRelease,assertExactVariantARemovals} from '../lib/rt-va1-release-identity.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
const release=read('data/current/actual-release-manifest.json');
const index=read('public/data/actual-entities.json');
const roster=read('docs/evidence/rt-va1-semantic-exclusion/actual-variant-a-exclusions.json');

test('release identity accepts only the exact old or reviewed RT-VA1 semantic profile',()=>{
 const accepted=trustedActualRelease(release,index);
 assert.equal(accepted.entityCount,index.entity_count);
 assert([HISTORICAL_ACTUAL,VARIANT_A_ACTUAL].includes(accepted));
 assert.throws(()=>trustedActualRelease({...release,snapshot_id:'actual-fake'},index),/unauthorized/);
 assert.throws(()=>trustedActualRelease({...release,release_fingerprint_sha256:'f'.repeat(64)},index),/unauthorized/);
 assert.throws(()=>trustedActualRelease({...release,public_contract:{...release.public_contract,entity_count:123}},index),/population mismatch/);
 assert.throws(()=>trustedActualRelease(release,{...index,entity_count:index.entity_count+1}),/cardinality/);
 assert.throws(()=>trustedActualRelease(release,{...index,entities:index.entities.slice(1)}),/cardinality/);
 assert.throws(()=>trustedActualRelease(release,{...index,entities:index.entities.map((x,i)=>i===0?{...x,id:index.entities[1].id}:x)}),/cardinality/);
});
test('123-per-ID exclusion gate refuses unreviewed IDs, retained mutation and non-MD deletion',()=>{
 const deleted=roster.exclusions.map(r=>({id:r.id,jurisdiction:'MD',name:r.name}));
 const keep=Array.from({length:5725},(_,i)=>({id:'osm-rt-va1-fixture-'+i,jurisdiction:i<3246?'RO':'MD'}));
 const before={entities:[...keep,...deleted]},after={entities:keep};
 const good=assertExactVariantARemovals(before,after,roster);
 assert.equal(good.status,'PASS');
 assert.equal(good.excluded,123);
 assert.throws(()=>assertExactVariantARemovals(before,{entities:[...keep.slice(1),deleted[0]]},roster),/unreviewed entity exclusion/);
 assert.throws(()=>assertExactVariantARemovals(before,{entities:[{...keep[0],name:'unauthorized'},...keep.slice(1)]},roster),/retained entity mutated/);
 assert.throws(()=>assertExactVariantARemovals(before,after,{...roster,exclusions:roster.exclusions.slice(1)}),/roster invalid/);
 assert.throws(()=>assertExactVariantARemovals({entities:[...keep,...deleted.slice(0,-1),{...deleted[122],jurisdiction:'RO'}]},after,roster),/non-MD exclusion/);
});
