import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRelationClosure,completeOsmDependencies} from '../lib/osm-adaptive-transport.mjs';
const relation=(id,members=[])=>({type:'relation',id,version:1,members});
const root=()=>({elements:[relation(55466,[{type:'relation',ref:2,role:'subarea'}]),relation(2,[{type:'way',ref:3,role:'outer'}]),{type:'way',id:3,nodes:[140097206,5]}]});
test('official relation/full nested relation metadata needs explicit node recovery',async()=>{
 const raw=root(),before=structuredClone(raw),calls=[];
 assert.throws(()=>assertRelationClosure(raw,[55466]),/node\/140097206/);
 const result=await completeOsmDependencies(raw,[55466],{fetchMissing:async(type,id)=>{calls.push([type,id]);return {elements:[{type,id,lat:1,lon:2}]};}});
 assert.deepEqual(calls,[['node',140097206],['node',5]]);assert.doesNotThrow(()=>assertRelationClosure(result,[55466]));assert.deepEqual(raw,before);
});
test('subarea relation dependency is preserved and recursively recovered',async()=>{
 const raw={elements:[relation(1699032,[{type:'relation',ref:1706978,role:'subarea'}])]};
 const result=await completeOsmDependencies(raw,[1699032],{fetchMissing:async(type,id)=>({elements:[relation(id)]})});
 assert.equal(result.elements.length,2);assert.equal(result.elements[0].members[0].ref,1706978);
});
test('missing coordinates, deleted dependencies, concurrent versions and budget fail closed',async()=>{
 assert.throws(()=>assertRelationClosure({elements:[relation(1,[{type:'node',ref:2}]),{type:'node',id:2}]},[1]),/coordinates/);
 await assert.rejects(completeOsmDependencies(root(),[55466],{fetchMissing:async()=>({elements:[]})}),/Incomplete authoritative/);
 await assert.rejects(completeOsmDependencies(root(),[55466],{fetchMissing:async(type,id)=>({elements:[{type,id,lat:1,lon:2}, {...relation(55466),version:2}]})}),/version drift/);
 await assert.rejects(completeOsmDependencies(root(),[55466],{maxRequests:0,fetchMissing:async()=>{throw Error('must not fetch');}}),/budget/);
});
test('cyclic subareas terminate without discarding the cycle or faking geometry',async()=>{
 const raw={elements:[relation(1,[{type:'relation',ref:2,role:'subarea'}]),relation(2,[{type:'relation',ref:1,role:'subarea'}])]};
 assert.deepEqual(await completeOsmDependencies(raw,[1],{fetchMissing:async()=>{throw Error('must not fetch');}}),raw);
});
