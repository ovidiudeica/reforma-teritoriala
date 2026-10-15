import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const evidence=read('docs/p9.0.6.2.1-historical-evidence.json');
const scope=read('docs/p9.0.3-missing-relations.json');
const parent=read('docs/p9.0.6.2-verified-evidence-ledger.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
const release=read('data/current/actual-release-manifest.json');
const rows=evidence.rows, cutoff=Date.parse('2026-10-12T20:21:35Z');
const expected=new Set(scope.missing_relations.map(r=>String(r.id)));
const prior=new Map(parent.rows.map(r=>[r.osm_id,r]));
const boundaryIds=new Set(['72634','90726','11883402','11885532','11886169','11951843','11951882','12350286','12350506','12937023','13056466','13159378','13181578','13181579','13181580','13639790','13639791','13639794','13639844']);
assert.equal(evidence.schema_version,'p90621-historical-crossborder-evidence-v1');
assert.equal(evidence.source_261012_sha256,'4ebd791fb953a22961e40ef7921914251c7b7292c33ed1e90e919488f1a397b8');
assert.equal(evidence.source_replication_sequence,4935);
assert.equal(evidence.cutoff,'2026-10-12T20:21:35Z');
assert.equal(evidence.workflow_run_id,38698369025);
assert.equal(evidence.workflow_artifact_id,11955426552);
assert.equal(rows.length,84);
assert.equal(new Set(rows.map(r=>r.osm_id)).size,84);
assert(rows.every(r=>expected.has(r.osm_id)));
const formatHash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
assert(rows.every(r=>
 r.status==='RESOLVED'&&r.historical_geometry_status==='PROVEN_AS_OF_CUTOFF_BY_VERSION_TIMESTAMPS'&&
 r.asof_edges_match_live===true&&r.recovered_historical_elements.length===0&&
 Date.parse(r.live_relation_timestamp)<=cutoff&&
 r.reference_relation_version===r.live_relation_version&&
 formatHash(r.osm_full_sha256)&&formatHash(r.asof_way_version_sha256)&&
 formatHash(r.asof_node_version_coordinate_sha256)&&formatHash(r.asof_polygon_edge_sha256)&&
 r.asof_polygon_edge_sha256===r.live_polygon_edge_sha256&&
 r.asof_polygon_edge_sha256===prior.get(r.osm_id)?.live_polygon_edges_sha256&&
 r.asof_ways>=1&&r.asof_nodes>=4
));
assert.equal(rows.filter(r=>r.historical_spatial?.relation==='disjoint').length,65);
assert.equal(rows.filter(r=>r.historical_spatial?.relation==='boundary').length,19);
assert(rows.every(r=>(r.historical_spatial?.relation==='boundary')===boundaryIds.has(r.osm_id)));
assert.equal(evidence.aggregate.way_references,rows.reduce((n,r)=>n+r.asof_ways,0));
assert.equal(evidence.aggregate.node_references,rows.reduce((n,r)=>n+r.asof_nodes,0));
assert.equal(evidence.source_summary.counts.recovered_history_requests,0);
assert.equal(evidence.source_summary.counts.unresolved,0);
assert.equal(evidence.source_summary.status,'PASS');
assert.equal(evidence.semantics.p91_import_allowed,false);
assert.equal(evidence.semantics.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(policy.p91_import_allowed,false);
assert.equal(policy.semantic_acceptance,'BLOCKED_INCOMPLETE');
assert.equal(release.snapshot_id,'actual-a9e5a4ddcb5277ef');
assert.equal(release.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
console.log('P90621_EXACT_HISTORICAL_84_PASS: full way/node timestamp closure, 65 disjoint + 19 boundary, 0 unresolved, P9.1 denied');