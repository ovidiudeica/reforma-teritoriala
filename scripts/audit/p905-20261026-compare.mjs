#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=lane=>JSON.parse(readFileSync('outputs/p905-runner-qualification/'+lane+'/'+lane+'.json','utf8'));
const A=read('A'),B=read('B');
const failures=[];
const check=(name,ok)=>{if(!ok)failures.push(name)};
check('schema',A.schema===B.schema&&A.schema==='p905-20261026-qualification-v1');
check('observed_profiles_match',JSON.stringify(Object.fromEntries(['runner','kernel','docker','engine'].map(k=>[k,A.observed[k]])))===JSON.stringify(Object.fromEntries(['runner','kernel','docker','engine'].map(k=>[k,B.observed[k]]))));
check('shared_approved_binding',A.baseline_manifest_sha256===B.baseline_manifest_sha256&&A.baseline_fingerprint===B.baseline_fingerprint);
check('same_candidate_fingerprint',A.proposed_fingerprint===B.proposed_fingerprint);
check('positive_and_negative_controls', [A,B].every(x=>x.positive_existing_approved_profile==='PASS'&&x.negative_mutated_containerd==='REJECTED'&&x.negative_mutated_cpu_vendor==='REJECTED'));
check('admission_consistency', [A,B].every(x=>(x.host_profile_approved===true&&x.current_validator_status==='PASS'&&x.current_failures.length===0&&x.proposal_status==='POST_ADMISSION_EXACT_PROFILE_VERIFIED')||(x.host_profile_approved===false&&x.current_validator_status==='FAIL'&&x.current_failures.length===1&&x.current_failures[0]==='runtime_host_profile_is_explicitly_approved')));
check('same_admission_state',A.host_profile_approved===B.host_profile_approved);
check('no_manifest_mutation', [A,B].every(x=>x.actual_manifests_modified===false&&x.actual_reproducibility_A_B_executed===false));
const result={schema:'p905-20261026-independent-comparison-v1',status:failures.length?'EVIDENCE_CONFLICT':(A.host_profile_approved?'POST_ADMISSION_EXACT_HOST_MATCH':'COMPATIBLE_ENVIRONMENT_PENDING_SEPARATE_AUTHORIZATION'),failures,A_sha256:sha(readFileSync('outputs/p905-runner-qualification/A/A.json')),B_sha256:sha(readFileSync('outputs/p905-runner-qualification/B/B.json')),candidate_fingerprint:A.proposed_fingerprint,owner_approval:A.host_profile_approved,actual_manifest_changes_applied:false,actual_reproducibility_executed:false};
writeFileSync('outputs/p905-runner-qualification/comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
