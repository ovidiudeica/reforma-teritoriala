#!/usr/bin/env node
import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {sha,key,verifyUniquePairs,parseCsv,verifySourceManifest} from './rt-audit1-evidence-lib.mjs';
const root=new URL('../../',import.meta.url),dir='outputs/RT-AUDIT.1.2/';
const safe=p=>{assert(typeof p==='string'&&!/^[a-z]+:|^[/\\]/i.test(p)&&!p.split(/[\\/]/).includes('..'),'Cale nepermisa');return p;};
const read=p=>readFile(new URL(safe(p),root)),j=async p=>JSON.parse(await read(p));
const manifest=(await read(dir+'checksums.sha256')).toString().trim().split('\n'),names=new Set();
for(const line of manifest){const match=/^([a-f0-9]{64})  ([a-zA-Z0-9._-]+)$/.exec(line);assert(match,'Intrare checksum invalida');assert(!names.has(match[2]),'Checksum duplicat');names.add(match[2]);assert.equal(sha(await read(dir+match[2])),match[1],match[2]);}
assert.deepEqual([...names].sort(),(await readdir(new URL(dir,root))).filter(x=>x!=='checksums.sha256').sort());
const rows=await j(dir+'forensics-254-per-id.json'),all=await j(dir+'administrative-5846-per-id.json'),equal=await j(dir+'semantics-3-equalities.json');verifyUniquePairs(rows,254);verifyUniquePairs(all,5846);verifyUniquePairs(equal,3);
const baseline=await j('outputs/RT-AUDIT.1/parent-child-register.json'),original=new Map(baseline.map(r=>[key(r),r]));
for(const r of all){assert(original.has(key(r)));assert.equal(r.initial_classification,original.get(key(r)).category);assert.equal(r.geometry_relation,original.get(key(r)).geometry_relation);assert.equal(r.legal_boundary_certified,false);}
assert.equal(rows.filter(r=>r.child_outside_parent_m2<=1).length,42);assert.equal(rows.filter(r=>r.precision_class==='AREA_WITHIN_COMPUTATION_TOLERANCE').length,11);
for(const r of rows){assert.equal(original.get(key(r)).category,'GEO');assert.equal(r.evidence_levels.CERTIFIED_HISTORICAL_CAUSE,false);assert.equal(r.corrective_action,'NONE_AUTOMATIC');assert.equal(r.historical_investigation.status,'HISTORY_INCOMPLETE');}
const csv=parseCsv((await read(dir+'forensics-254-per-id.csv')).toString());assert.equal(csv.length,255);assert.deepEqual(csv.slice(1).map(r=>r[0]+'|'+r[1]),rows.map(key));
const headers=csv[0];for(let i=0;i<rows.length;i++){assert.equal(Number(csv[i+1][headers.indexOf('child_outside_parent_m2')]),rows[i].child_outside_parent_m2);assert.equal(csv[i+1][headers.indexOf('certified_historical_cause')],'false');}
for(const r of equal){assert(r.exact_boundary_comparison.boundary_sets_equal);assert.equal(r.automatic_merge_allowed,false);assert.equal(r.legal_border_certification,false);}
const queue=await j(dir+'unresolved-causal-queue.json');verifyUniquePairs(queue,254);assert.deepEqual(queue.map(key),rows.map(key));
const inventory=await j(dir+'evidence-inventory.json');await verifySourceManifest(inventory.sources,read);
const integrity=await j(dir+'actual-integrity.json');assert.equal(integrity.components.length,32);for(const r of integrity.components)assert.equal(sha(await read(r.path)),r.sha256,r.path);
const histories=await j(dir+'osm-history-register.json');assert(histories.length>=70);assert(histories.every(r=>['EPOCH_VERSION_RECOVERED','HISTORY_INCOMPLETE','FROZEN_PAYLOAD_HISTORY_MISMATCH'].includes(r.status)));
const official=await j(dir+'official-source-register.json');assert.equal(official.find(r=>r.name==='CUATM_25.xlsx').record_hierarchy_status_mismatches.length,0);assert(official.find(r=>r.name==='NUTS.zip').original_matches_frozen_sha256);
console.log(JSON.stringify({status:'PASS',relations:5846,overlaps:254,equalities:3,source_hashes:inventory.sources.length,output_hashes:names.size,protected_components:32,historical_causes_certified:0}));
