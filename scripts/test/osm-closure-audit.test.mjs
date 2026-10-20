import test from 'node:test';
import assert from 'node:assert/strict';
import {auditOsmClosure as audit} from '../lib/osm-closure-audit.mjs';
const n=id=>({type:'node',id,lat:1,lon:2});
const ring=(role='outer')=>({elements:[{type:'relation',id:1,members:[{type:'way',ref:2,role}]},{type:'way',id:2,nodes:[3,4,5,3]},n(3),n(4),n(5)]});
test('closed outer and legacy empty boundary role both retain real closed rings',()=>{
 for(const role of ['outer','']){const a=audit(ring(role),[1],'MD');assert.equal(a.topology_issue_count,0);assert.equal(a.missing_reference_count,0);assert.equal(a.invalid_coordinate_count,0);}
});
test('missing relation/way/node and coordinates are distinct retained evidence',()=>{
 const r=ring();r.elements[0].members.push({type:'relation',ref:99,role:'subarea'},{type:'way',ref:98,role:'inner'});r.elements.pop();delete r.elements.at(-1).lat;
 const a=audit(r,[1],'MD');assert.equal(a.missing_reference_count,3);assert.equal(a.invalid_coordinate_count,1);assert.deepEqual(new Set(a.missing_references.map(x=>x.missing)),new Set(['relation/99','way/98','node/5']));
});
test('open endpoints remain blocked, including closed subarea that cannot repair parent outer',()=>{
 const r=ring();r.elements[1].nodes.pop();r.elements[0].members.push({type:'relation',ref:6,role:'subarea'});r.elements.push({type:'relation',id:6,members:[{type:'way',ref:7,role:'outer'}]},{type:'way',id:7,nodes:[3,4,5,3]});
 const a=audit(r,[1],'MD');assert.equal(a.topology_issue_count,1);assert.deepEqual(a.topology_issues[0].odd_endpoints.outer.map(x=>x.node_id),[3,5]);
});
test('nested geometric inner relation composes roles without treating subarea as boundary',()=>{
 const r=ring();r.elements[0].members=[{type:'relation',ref:6,role:'inner'}];r.elements.push({type:'relation',id:6,members:[{type:'way',ref:2,role:'outer'}]});assert.equal(audit(r,[1],'MD').topology_issue_count,0);
 r.elements[1].nodes.pop();assert.equal(audit(r,[1],'MD').topology_issues[0].odd_endpoints.inner.length,2);
});
test('diagnostics do not truncate anomalies after 100 records',()=>{
 const r={elements:[{type:'relation',id:1,members:Array.from({length:120},(_,i)=>({type:'relation',ref:i+2,role:'subarea'}))}]};assert.equal(audit(r,[1],'MD').missing_references.length,120);
});
