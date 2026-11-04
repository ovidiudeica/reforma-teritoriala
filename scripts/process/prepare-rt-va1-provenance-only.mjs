#!/usr/bin/env node
// RT-VA1: provenance-only manifest rebinding; never admits semantic or geometry changes.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=message=>{throw Error('RT_VA1_PROVENANCE_REBIND_BLOCKED: '+message)};
const base=process.env.EXPECTED_BASE_SHA;
if(!/^[0-9a-f]{40}$/.test(base??''))fail('exact base SHA required');
const gitBytes=p=>execFileSync('git',['show',base+':'+p],{maxBuffer:256*1024*1024});
const oldBytes=gitBytes('data/current/actual-release-manifest.json');
const old=JSON.parse(oldBytes);
const oldPersisted=JSON.parse(gitBytes('data/current/actual-release-persisted.json'));
if(oldPersisted.manifest_sha256!==sha(oldBytes)||oldPersisted.validated_release_gate_status!=='PASS')fail('persisted baseline is not authenticated');
const manifestBytes=await readFile('data/current/actual-release-manifest.json');
const now=JSON.parse(manifestBytes);
const envBytes=await readFile('data/current/actual-build-environment-manifest.json');
const env=JSON.parse(envBytes);
const envGate=JSON.parse(await readFile('data/current/actual-build-environment-gate.json'));
const relGate=JSON.parse(await readFile('data/current/actual-release-gate.json'));
const hostBytes=await readFile('data/current/actual-host-trust-manifest.json');
const host=JSON.parse(hostBytes);
for(const k of ['snapshot_id','release_fingerprint_sha256','content_fingerprint_sha256','components','geometry','source_bundle','review_evidence_bundle','public_contract','content_identity']){
 if(JSON.stringify(now[k])!==JSON.stringify(old[k]))fail('semantic or canonical drift '+k);
}
if(sha(hostBytes)!==old.host_trust?.sha256||host.host_trust_fingerprint_sha256!==old.host_trust?.host_trust_fingerprint_sha256)fail('host trust drift');
if(env.environment_fingerprint_sha256===old.build_environment?.environment_fingerprint_sha256)fail('new execution environment was not bound');
if(now.build_environment?.sha256!==sha(envBytes)||now.build_environment?.environment_fingerprint_sha256!==env.environment_fingerprint_sha256)fail('environment hash/fingerprint');
if(envGate.status!=='PASS'||envGate.build_environment_sha256!==sha(envBytes)||relGate.status!=='PASS'||relGate.manifest_sha256!==sha(manifestBytes))fail('gates are not PASS on exact bytes');
const allowed=new Set(['.github/workflows/actual-candidate.yml','.github/workflows/actual-promote-candidate.yml','scripts/process/run-actual-deterministic-candidate.sh','scripts/process/prepare-rt-va1-provenance-only.mjs','.github/workflows/rt-va1-provenance-proposal.yml','scripts/audit/web-r2a1-provenance-boundary.mjs','scripts/audit/web-r2a1-admin-level-census.mjs','data/current/actual-build-environment-manifest.json','data/current/actual-build-environment-gate.json','data/current/actual-release-manifest.json','data/current/actual-release-gate.json','data/current/actual-release-persisted.json']);
const changed=execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
if(changed.some(p=>!allowed.has(p)))fail('unapproved files in provenance PR '+changed.filter(p=>!allowed.has(p)).join(','));
const marker={...oldPersisted,manifest_sha256:sha(manifestBytes),build_environment_fingerprint_sha256:env.environment_fingerprint_sha256,provenance_hardening:{previous_manifest_sha256:oldPersisted.manifest_sha256,change_type:'RT-VA1_deterministic_derivative_pipeline_rebind',host_profile_id:'github-ubuntu24-20261101.360.1',method:'provenance_only_no_semantic_change',semantic_identity_unchanged:true,approved_derivatives:['P8.2','WEB-CARD.1','NI-OSM-85']}};
if(marker.snapshot_id!==oldPersisted.snapshot_id||marker.release_fingerprint_sha256!==oldPersisted.release_fingerprint_sha256)fail('persisted semantic drift');
await writeFile('data/current/actual-release-persisted.json',JSON.stringify(marker,null,2)+'\n');
console.log('RT_VA1_PROVENANCE_REBIND_PASS '+JSON.stringify({base,new_manifest_sha256:marker.manifest_sha256,previous_manifest_sha256:oldPersisted.manifest_sha256,environment_fingerprint_sha256:marker.build_environment_fingerprint_sha256,semantic_unchanged:true}));
