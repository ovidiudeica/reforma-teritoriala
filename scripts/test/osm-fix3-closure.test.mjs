import test from 'node:test';
import assert from 'node:assert/strict';
import {auditOsmClosure as audit} from '../lib/osm-closure-audit.mjs';
const node=(id,lat=0,lon=0)=>({type:'node',id,lat,lon});
const raw=()=>({elements:[{type:'relation',id:100,version:1,members:[{type:'way',ref:10,role:'outer'}]},
 {type:'way',id:10,version:1,nodes:[1,3,4,2]},node(1),node(2),node(3,0,1),node(4,1,0)]});
test('coincident distinct endpoints remain open by node identity',()=>{
 const v=audit(raw(),[100],'MD');assert.equal(v.topology_issue_count,1);assert.equal(v.topology_issues[0].odd_endpoints.outer.length,2);
 assert.equal(v.topology_issues[0].coincident_distinct_endpoint_groups.length,1);assert.equal(v.full_topology_certified,false);
});
test('explicit isolated reference substitution preserves coordinates but never certifies full topology',()=>{
 const a=raw(),b=structuredClone(a);b.elements[1].nodes[3]=1;
 const coordinates=x=>x.elements[1].nodes.map(id=>{const n=x.elements.find(e=>e.type==='node'&&e.id===id);return [n.lon,n.lat];});
 assert.deepEqual(coordinates(a),coordinates(b));assert.equal(audit(b,[100],'MD').topology_issue_count,0);assert.equal(audit(b,[100],'MD').full_topology_certified,false);
});
test('way orientation does not change endpoint incidence',()=>{
 const a=raw(),b=structuredClone(a);b.elements[1].nodes.reverse();assert.equal(audit(a,[100],'MD').topology_issue_count,audit(b,[100],'MD').topology_issue_count);
});
test('empty selected geometry is rejected',()=>{
 const a=raw();a.elements[0].members=[];const v=audit(a,[100],'MD');assert.equal(v.topology_issue_count,1);assert.equal(v.topology_issues[0].invalid_geometry_members[0].reason,'no_polygon_way_members');
});
test('missing way/node and invalid coordinate remain explicit failures',()=>{
 for(const id of [10,4]){const a=raw();a.elements=a.elements.filter(e=>e.id!==id);assert.ok(audit(a,[100],'MD').missing_reference_count>0);}
 const a=raw();a.elements.find(e=>e.type==='node'&&e.id===3).lat=91;assert.equal(audit(a,[100],'MD').invalid_coordinate_count,1);
});
test('inner-ring gaps cannot be closed by unrelated outer endpoints',()=>{
 const a=raw();a.elements[0].members.push({type:'way',ref:11,role:'inner'});a.elements.push({type:'way',id:11,nodes:[2,4,3,1]});
 const v=audit(a,[100],'MD');assert.equal(v.topology_issues[0].odd_endpoints.outer.length,2);assert.equal(v.topology_issues[0].odd_endpoints.inner.length,2);
});
test('nested geometry and relation cycles are inspected separately from subareas',()=>{
 const a=raw();a.elements[1].nodes[3]=1;a.elements[0].members=[{type:'relation',ref:200,role:'outer'}];a.elements.push({type:'relation',id:200,members:[{type:'way',ref:10,role:'outer'}]});assert.equal(audit(a,[100],'MD').topology_issue_count,0);
 a.elements.at(-1).members=[{type:'relation',ref:100,role:'outer'}];assert.ok(audit(a,[100],'MD').topology_issues[0].invalid_geometry_members.some(x=>x.reason==='cyclic_geometry_relation'));
});
