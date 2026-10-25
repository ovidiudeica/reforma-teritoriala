import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=new URL('../../docs/osm-fix3/',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>readFileSync(new URL(name,root));
test('input bindings hash the actual frozen bytes, never Buffer JSON wrappers',()=>{
 const report=JSON.parse(read('analysis.json'));
 assert.equal(report.input_sha256.observations,sha(read('observations.json')));
 assert.equal(report.input_sha256.baseline,sha(read('baseline.json')));
});
test('thirteen identities and conditional simulations preserve independent blocked acceptance',()=>{
 const r=JSON.parse(read('analysis.json'));
 assert.equal(r.matrix.length,13);assert.equal(new Set(r.matrix.map(x=>x.relation_id)).size,13);
 assert.equal(r.matrix.filter(x=>x.current_state==='OFFICIALLY_RETIRED').length,12);
 assert.equal(r.successor.legal_verdict,'UNRESOLVED');assert.equal(r.successor.coordinate_cycles_equal,false);
 assert.equal(r.joint_simulation.status,'PASS_FOR_ISOLATED_CONDITIONAL_SUBGRAPH');
 assert.ok(r.proposals.every(x=>x.coordinate_sequence_unchanged&&x.public_edit_authorization==='NOT_GRANTED'&&!x.upload_performed));
 assert.equal(r.OSM_SOURCE_CANDIDATE_VALIDATED,false);assert.equal(r.OSM_SOURCE_PROMOTED,false);
 assert.equal(r.guards.actual_mutation_allowed,false);assert.equal(r.guards.p91_import_allowed,false);
 assert.equal(r.joint_simulation.audit.full_topology_certified,false);
});
test('frozen analysis regenerates byte-identically without network or source writes',()=>{
 const before=read('analysis.json');
 const child=spawnSync(process.execPath,['scripts/process/audit-osm-fix3-current.mjs'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);assert.deepEqual(read('analysis.json'),before);
});

test('every frozen evidence member matches the SHA-256 manifest within the fixed proof directory',()=>{
 const manifest=JSON.parse(read('manifest.json')),seen=new Set();
 for(const entry of manifest.files){
  assert.match(entry.path,/^[a-z0-9][a-z0-9._-]*$/i);assert.ok(!seen.has(entry.path));seen.add(entry.path);
  const bytes=read(entry.path);assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);
 }
 assert.ok(seen.has('observations.json'));assert.ok(seen.has('analysis.json'));assert.ok(seen.has('baseline.json'));
});
