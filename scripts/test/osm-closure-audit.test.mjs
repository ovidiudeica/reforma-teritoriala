import test from 'node:test';
import assert from 'node:assert/strict';
import {auditOsmClosure as audit} from '../lib/osm-closure-audit.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeOsmMembers} from '../lib/osm-source-membership.mjs';
import {posix} from 'node:path';
const n=id=>({type:'node',id,lat:1,lon:2});
test('source continuity CI selects isolated changes to every tested OSM module or regression',()=>{
 const workflow=readFileSync(new URL('../../.github/workflows/osm-source-continuity.yml',import.meta.url),'utf8');
 const protectedInputs=['scripts/lib/osm-closure-audit.mjs','scripts/lib/osm-adaptive-transport.mjs','scripts/lib/osm-source-paths.mjs','scripts/lib/osm-source-membership.mjs','scripts/test/osm-closure-audit.test.mjs','scripts/test/osm-dependency-recovery.test.mjs','scripts/test/osm-source-paths.test.mjs','scripts/test/osm-adaptive-transport.test.mjs'];
 for(const trigger of ['pull_request','push']){const section=workflow.split('  '+trigger+':')[1].split('\n  push:')[0].split('\npermissions:')[0],patterns=[...section.matchAll(/^\s+- '([^']+)'/gm)].map(m=>m[1]);for(const file of protectedInputs)assert.ok(patterns.some(pattern=>posix.matchesGlob(file,pattern)),trigger+' omits '+file);}
});
const officialCases=[
 {id:18967493,version:6,nodes:[12318728194,12318728593],ways:2,sha:'4a723a70c4795c1af555fcad91e4a89af1d44e247bac45c46d6540ba307d01bd',file:new URL('../../docs/evidence/osm-fix2/source-repair-review-20261021/closure/4a723a70c4795c1af555fcad91e4a89af1d44e247bac45c46d6540ba307d01bd.response',import.meta.url)},
 {id:18968082,version:7,nodes:[8265822008,11649857778],ways:6,sha:'3615b35c5421b693dcb9621011eb26eb3731b5082d5897964b03558419fb2389',file:new URL('../../docs/evidence/osm-fix2/source-repair-review-20261021/closure/3615b35c5421b693dcb9621011eb26eb3731b5082d5897964b03558419fb2389.response',import.meta.url)}
];
for(const fixture of officialCases)test('official relation '+fixture.id+' retains its real disconnected node graph',()=>{
 const bytes=readFileSync(fixture.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),fixture.sha);const raw=JSON.parse(bytes),result=audit(raw,[fixture.id],'MD'),relation=raw.elements.find(e=>e.type==='relation'&&e.id===fixture.id);
 assert.equal(relation.version,fixture.version);assert.equal(relation.tags.type,'boundary');assert.equal(raw.elements.filter(e=>e.type==='way').length,fixture.ways);assert.equal(result.missing_reference_count,0);assert.equal(result.invalid_coordinate_count,0);assert.equal(result.topology_issue_count,1);
 const issue=result.topology_issues[0];assert.deepEqual(issue.odd_endpoints.outer.map(e=>e.node_id).sort((a,b)=>a-b),fixture.nodes);assert.ok(issue.odd_endpoints.outer.every(e=>e.degree===1));assert.equal(issue.coincident_distinct_endpoint_groups.length,1);assert.equal(issue.invalid_geometry_members.length,0);
});
test('Overpass embedded coordinates and object key order are not relation membership drift',()=>{
 const a=[{type:'way',ref:8,role:'outer',geometry:[{lat:1,lon:2}]}],b=[{role:'outer',ref:8,type:'way'}];assert.deepEqual(normalizeOsmMembers(a),normalizeOsmMembers(b));
 for(const change of [{type:'relation'},{ref:9},{role:'inner'}])assert.notDeepEqual(normalizeOsmMembers(a),normalizeOsmMembers([{...b[0],...change}]));assert.ok(a[0].geometry,'Normalization must not mutate source objects');
});
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
test('coincident distinct node IDs are disclosed without silently welding the source graph',()=>{
 const raw={elements:[{type:'relation',id:1,members:[{type:'way',ref:2,role:'outer'},{type:'way',ref:7,role:'outer'}]},{type:'way',id:2,nodes:[3,4]},{type:'way',id:7,nodes:[4,5,6]},n(3),{...n(4),lat:2},{...n(5),lon:3},n(6)]};
 const before=structuredClone(raw),a=audit(raw,[1],'MD');
 assert.equal(a.topology_issue_count,1);assert.deepEqual(a.topology_issues[0].coincident_distinct_endpoint_groups,[{role:'outer',coordinates:[2,1],node_ids:[3,6]}]);assert.deepEqual(raw,before);
});
