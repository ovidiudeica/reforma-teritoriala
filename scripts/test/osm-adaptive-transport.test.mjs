import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAdaptiveRelations,retryAfterMs} from '../lib/osm-adaptive-transport.mjs';
import {applyReviewedMalcociLastValidOsmGeometry as apply} from '../lib/md-osm-invalid-geometry-fallback.mjs';
const raw=id=>({elements:[{type:'relation',id,members:[]}]});
test('failed chunks split sequentially and singleton uses authoritative source',async()=>{
 const calls=[],attempts=[];
 const result=await fetchAdaptiveRelations([1,2,3,4],{attempts,fetchChunk:async ids=>{calls.push(ids);throw Object.assign(new Error('HTTP 504'),{attempts:[{status:'failure'}]});},fetchFull:async id=>({raw:raw(id),attempts:[{status:'success',relation_id:id}]})});
 assert.deepEqual(result.elements.map(e=>e.id),[1,2,3,4]);assert.equal(calls.length,7);assert.equal(attempts.filter(a=>a.status==='success').length,4);
});
test('incomplete successful chunk cannot silently lose selected relations',async()=>{
 const result=await fetchAdaptiveRelations([1,2],{attempts:[],fetchChunk:async()=>({raw:raw(1),attempts:[]}),fetchFull:async id=>({raw:raw(id),attempts:[]})});assert.deepEqual(result.elements.map(e=>e.id),[1,2]);
 await assert.rejects(fetchAdaptiveRelations([2],{attempts:[],fetchChunk:async()=>({raw:raw(1),attempts:[]}),fetchFull:async()=>({raw:raw(1),attempts:[]})}),/Incomplete OSM dependency/);
});
test('authoritative source failure remains fail closed',async()=>{
 await assert.rejects(fetchAdaptiveRelations([1],{attempts:[],fetchChunk:async()=>{throw Error('429');},fetchFull:async()=>{throw Error('authoritative unavailable');}}),/authoritative unavailable/);
});
test('Retry-After seconds and dates respect bounded transport budget',()=>{
 assert.equal(retryAfterMs('5'),5000);assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:00:10 GMT',0),10000);assert.throws(()=>retryAfterMs('120'),/bounded/);
});
const geo=()=>({features:[{id:'relation/18968071',geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]});
for(const version of [7,9])test(`valid Malcoci v${version} is no-op without reading stale snapshot`,async()=>{
 const g=geo(),before=structuredClone(g);assert.equal(await apply({country:'MD',raw:{elements:[{type:'relation',id:18968071,version}]},geo:g,readFileFn:()=>{throw Error('must not read fallback');}}),false);assert.deepEqual(g,before);
});
test('missing Malcoci and different invalid contract fail closed',async()=>{
 await assert.rejects(apply({country:'MD',raw:{elements:[]},geo:geo()}),/missing/);
 const g=geo();g.features[0].geometry.coordinates[0].pop();await assert.rejects(apply({country:'MD',raw:{elements:[{type:'relation',id:18968071,version:9}]},geo:g}),/contract drift/);
});
