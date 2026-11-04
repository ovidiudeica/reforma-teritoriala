import {createHash} from 'node:crypto';
import {canonicalizeHostTrust,hostTrustFingerprint,validateObservedHost,validateHostTrustManifest} from './actual-host-trust.mjs';

export const RT_HOST_SCHEMA='rt-host-qualification-v1';
export const RT_HOST_REPOSITORY='ovidiudeica/reforma-teritoriala';
export const RT_HOST_WORKFLOW='.github/workflows/rt-host-qualification.yml';
export const HOST_PARTS=['runner','kernel','docker','engine'];
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
export const same=(a,b)=>JSON.stringify(canonicalizeHostTrust(a))===JSON.stringify(canonicalizeHostTrust(b));
export const hostProfile=o=>Object.fromEntries(HOST_PARTS.map(k=>[k,structuredClone(o?.[k]??null)]));
export const profileId=o=>'github-ubuntu24-'+String(o?.runner?.image_version??'');
const recordFailure=(failures,name,ok)=>{if(!ok)failures.push(name);};
const shaPattern=/^[a-f0-9]{40}$/;
const versionPattern=/^20\d{6}\.\d+\.\d+$/;

export function captureHostEvidence({baseline,baselineBytes,observed,source}){
 if(validateHostTrustManifest(baseline).status!=='PASS')throw Error('RT_HOST_BASELINE_STATIC_CONTRACT_INVALID');
 if(!Buffer.isBuffer(baselineBytes)||!same(baseline,JSON.parse(baselineBytes)))throw Error('RT_HOST_BASELINE_BYTES_INVALID');
 if(source?.repository!==RT_HOST_REPOSITORY||!shaPattern.test(source?.commit_sha??'')||
    source?.workflow!==RT_HOST_WORKFLOW||!['A','B'].includes(source?.lane)||
    !Number.isSafeInteger(source?.run_id)||source.run_id<1||
    !Number.isSafeInteger(source?.run_attempt)||source.run_attempt<1)
  throw Error('RT_HOST_SOURCE_METADATA_INVALID');
 if(!versionPattern.test(observed?.runner?.image_version??'')||observed?.runner?.image_os!=='ubuntu24')
  throw Error('RT_HOST_IMAGE_ID_INVALID');
 const assessed=validateObservedHost(baseline,observed);
 const cpu=assessed.checks.filter(c=>c.name.startsWith('cpu_')).map(c=>({name:c.name,ok:c.ok}));
 const last=baseline.contract.accepted_runtime_profiles.at(-1);
 if(!last)throw Error('RT_HOST_NO_APPROVED_POSITIVE_CONTROL');
 const positive={...structuredClone(observed),...hostProfile(last)};
 const negativeContainerd=structuredClone(positive);
 negativeContainerd.docker.components.containerd.version='rt-host-unauthorized-negative';
 const negativeCpu=structuredClone(positive);
 negativeCpu.cpu.vendor='rt-host-unauthorized-negative';
 return {
  schema:RT_HOST_SCHEMA,
  source:{...source},
  baseline_manifest_sha256:hash(baselineBytes),
  baseline_fingerprint:baseline.host_trust_fingerprint_sha256,
  profile_id:profileId(observed),
  profile_sha256:hash(bytes(hostProfile(observed))),
  observed,
  checks:{
   static_manifest:'PASS',
   validator_status:assessed.status,
   validator_failures:assessed.failures.map(x=>x.name),
   cpu,
   existing_profile_positive:validateObservedHost(baseline,positive).status,
   containerd_negative:validateObservedHost(baseline,negativeContainerd).status,
   cpu_negative:validateObservedHost(baseline,negativeCpu).status
  },
  approved_now:assessed.status==='PASS',
  admission:false,
  semantic_data_modified:false
 };
}

// RT-HOST.1: independent observations may be from distinct workflow runs.
// The two lanes must use the same exact source SHA and host-trust baseline.
// CPU models are observed, but only the approved compatibility floor is required.
export function compareHostEvidence({baseline,baselineBytes,A,B,targetImage=null}){
 const failures=[];
 const check=(name,ok)=>recordFailure(failures,name,ok);
 const sha=hash(baselineBytes);
 check('baseline_fingerprint_self_consistent',baseline?.host_trust_fingerprint_sha256===hostTrustFingerprint(baseline).sha256);
 check('baseline_bytes_match',same(baseline,JSON.parse(baselineBytes)));
 check('independent_source_lanes',[A?.source?.lane,B?.source?.lane].join(',')==='A,B');
 check('schema',[A,B].every(x=>x?.schema===RT_HOST_SCHEMA));
 check('same_repository',[A,B].every(x=>x?.source?.repository===RT_HOST_REPOSITORY));
 check('same_approved_workflow',[A,B].every(x=>x?.source?.workflow===RT_HOST_WORKFLOW));
 check('same_exact_checked_out_sha',[A,B].every(x=>shaPattern.test(x?.source?.commit_sha??''))&&A?.source?.commit_sha===B?.source?.commit_sha);
 check('genuinely_distinct_observation_jobs',
  Number.isSafeInteger(A?.source?.run_id)&&Number.isSafeInteger(B?.source?.run_id)&&
  Number.isSafeInteger(A?.source?.run_attempt)&&Number.isSafeInteger(B?.source?.run_attempt)&&
  (A.source.run_id!==B.source.run_id||A.source.run_attempt!==B.source.run_attempt||A.source.lane!==B.source.lane));
 check('same_baseline_manifest',[A,B].every(x=>x?.baseline_manifest_sha256===sha&&x?.baseline_fingerprint===baseline?.host_trust_fingerprint_sha256));
 check('same_exact_runner_kernel_docker_engine',same(hostProfile(A?.observed),hostProfile(B?.observed)));
 check('same_profile_digest',[A,B].every(x=>x?.profile_sha256===hash(bytes(hostProfile(x?.observed))))&&A?.profile_sha256===B?.profile_sha256);
 check('image_version_well_formed',[A,B].every(x=>versionPattern.test(x?.observed?.runner?.image_version??'')&&x?.observed?.runner?.image_os==='ubuntu24'&&x?.profile_id===profileId(x?.observed)));
 if(targetImage!==null)check('exact_target_image',[A,B].every(x=>x?.observed?.runner?.image_version===targetImage));
 check('cpu_contract_and_positive_negative_controls',[A,B].every(x=>{
  const c=x?.checks;
  return c?.static_manifest==='PASS'&&c?.cpu?.length===6&&c.cpu.every(y=>y.ok===true)&&
   c.existing_profile_positive==='PASS'&&c.containerd_negative==='FAIL'&&c.cpu_negative==='FAIL';
 }));
 const approvedProfiles=baseline?.contract?.accepted_runtime_profiles??[];
 const alreadyApproved=approvedProfiles.some(p=>same(hostProfile(p),hostProfile(A?.observed)));
 check('only_unknown_host_profile_failure_or_approved_pass',[A,B].every(x=>
   alreadyApproved?(x?.checks?.validator_status==='PASS'&&x?.checks?.validator_failures?.length===0&&x?.approved_now===true):
   (x?.checks?.validator_status==='FAIL'&&same(x?.checks?.validator_failures,['runtime_host_profile_is_explicitly_approved'])&&x?.approved_now===false)));
 check('observation_is_never_admission',[A,B].every(x=>x?.admission===false&&x?.semantic_data_modified===false));
 return {
  schema:'rt-host-independent-comparison-v1',
  status:failures.length?'NOT_QUALIFIED':alreadyApproved?'ALREADY_APPROVED':'QUALIFIED_PENDING_SEPARATE_ADMISSION',
  failures,
  target_image:targetImage,
  baseline_manifest_sha256:sha,
  baseline_fingerprint:baseline?.host_trust_fingerprint_sha256??null,
  repository:RT_HOST_REPOSITORY,
  commit_sha:A?.source?.commit_sha??null,
  proposed_profile_id:A?.profile_id??null,
  profile_sha256:A?.profile_sha256??null,
  proposed_profile:hostProfile(A?.observed),
  evidence_A_sha256:hash(bytes(A)),
  evidence_B_sha256:hash(bytes(B)),
  independent_sources:[A?.source??null,B?.source??null],
  host_profile_admitted:false,
  semantic_data_modified:false
 };
}

// RT-HOST.2: validates one reviewed addition; does not modify the manifest.
// Source authenticity (GitHub Actions run, workflow, artifacts and SHA) must
// be checked separately against the GitHub API before this gate is actionable.
export function validateHostAdmission({baseline,baselineBytes,proposed,A,B,comparison}){
 const failures=[],check=(name,ok)=>recordFailure(failures,name,ok);
 const current=compareHostEvidence({baseline,baselineBytes,A,B,targetImage:comparison?.target_image??null});
 check('technical_qualification_success',current.status==='QUALIFIED_PENDING_SEPARATE_ADMISSION');
 check('comparison_evidence_is_unchanged',same(comparison,current));
 check('authoritative_workflow_dispatch_from_main',
  [A,B].every(x=>x?.source?.event==='workflow_dispatch'&&x?.source?.ref==='refs/heads/main'));
 check('proposed_manifest_is_exactly_pinned_in_code',validateHostTrustManifest(proposed).status==='PASS');
 check('manifest_header_and_policy_unchanged',
  same({...baseline,contract:null,host_trust_fingerprint_sha256:null},
       {...proposed,contract:null,host_trust_fingerprint_sha256:null}));
 const prior=baseline?.contract?.accepted_runtime_profiles??[];
 const next=proposed?.contract?.accepted_runtime_profiles??[];
 check('sole_append_only_profile',next.length===prior.length+1&&prior.every((p,i)=>same(p,next[i])));
 check('all_other_contract_fields_unchanged',
  same({...baseline?.contract,accepted_runtime_profiles:[]},
       {...proposed?.contract,accepted_runtime_profiles:[]}));
 check('new_profile_exactly_qualified',
  same(next.at(-1),{id:comparison?.proposed_profile_id,...comparison?.proposed_profile}));
 check('new_profile_not_approved_before',
  !prior.some(x=>x.id===comparison?.proposed_profile_id));
 check('new_profile_id_is_exact_image_version',
  comparison?.proposed_profile_id===profileId(A?.observed));
 check('proposed_fingerprint_recomputed',
  proposed?.host_trust_fingerprint_sha256===hostTrustFingerprint(proposed).sha256);
 return {
  schema:'rt-host-admission-review-v1',
  status:failures.length?'BLOCKED':'EVIDENCE_AND_CONTRACT_VALID_PENDING_PROTECTED_PR_AND_PROVENANCE_REBIND',
  failures,
  baseline_manifest_sha256:hash(baselineBytes),
  admitted_candidate_profile:comparison?.proposed_profile_id??null,
  new_fingerprint:proposed?.host_trust_fingerprint_sha256??null,
  no_auto_admission:true,
  canonical_data_changed:false
 };
}
