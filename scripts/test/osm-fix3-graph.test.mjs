import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRelationClosure,fetchAdaptiveRelations} from '../lib/osm-adaptive-transport.mjs';
const graph=(id,lon=1)=>({elements:[
 {type:'relation',id,version:1,members:[{type:'way',ref:7,role:'outer'}]},
 {type:'way',id:7,version:1,nodes:[1,2,3,1]},
 {type:'node',id:1,version:1,lat:1,lon:1},
 {type:'node',id:2,version:1,lat:1,lon},
 {type:'node',id:3,version:1,lat:2,lon:2}]});
test('conflicting duplicate versions in one response must fail closed',()=>{
 const raw=graph(10);raw.elements.push({...raw.elements[2],version:2});
 assert.throws(()=>assertRelationClosure(raw,[10]),/Conflicting OSM element/);
});
test('adaptive shards cannot overwrite a contradictory shared node',async()=>{
 await assert.rejects(fetchAdaptiveRelations([10,20],{attempts:[],
  fetchChunk:async ids=>{if(ids.length>1)throw Error('HTTP 502');return {raw:graph(ids[0],ids[0]===10?1:9),attempts:[]};},
  fetchFull:async()=>{throw Error('unexpected full fallback');}}),/Conflicting OSM element/);
});
test('identical shared objects may deduplicate without losing roots',async()=>{
 const value=await fetchAdaptiveRelations([10,20],{attempts:[],
  fetchChunk:async ids=>{if(ids.length>1)throw Error('HTTP 504');return {raw:graph(ids[0]),attempts:[]};},
  fetchFull:async()=>{throw Error('unexpected full fallback');}});
 assert.deepEqual(value.elements.filter(e=>e.type==='relation').map(e=>e.id),[10,20]);
 assert.equal(value.elements.filter(e=>e.type==='node'&&e.id===2).length,1);
});

import {osmElementIndex} from '../lib/osm-element-index.mjs';
test('key-order-only duplicates are identical, but tags/timestamps/member order conflicts are not',()=>{
 const node=graph(10).elements[2];
 assert.equal(osmElementIndex({elements:[node,{lon:1,lat:1,version:1,id:1,type:'node'}]}).size,1);
 for(const patch of [{timestamp:'2026-10-25T00:00:00Z'},{tags:{name:'changed'}},{lon:9}])
  assert.throws(()=>osmElementIndex({elements:[node,{...node,...patch}]}),/Conflicting/);
 const relation=graph(10).elements[0];
 assert.throws(()=>osmElementIndex({elements:[relation,{...relation,members:[]}]}),/Conflicting/);
});
test('invalid identities and missing element arrays are rejected',()=>{
 for(const elements of [[{type:'node',id:-1}],[{type:'node',id:1.5}],[{type:'derived',id:1}]])
  assert.throws(()=>osmElementIndex({elements}),/Invalid/);
 assert.throws(()=>osmElementIndex({}),/Invalid/);
});
test('empty, duplicate and invalid selections fail before any network call',async()=>{
 for(const ids of [[],[1,1],[0],[1.5],null]){
  let calls=0;await assert.rejects(fetchAdaptiveRelations(ids,{attempts:[],fetchChunk:async()=>{calls++;throw Error('network must not run');},fetchFull:async()=>{calls++;throw Error('network must not run');}}),/non-empty distinct positive/);
  assert.equal(calls,0);
 }
});
