import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {VARIANT_A_ACTUAL} from '../lib/rt-va1-release-identity.mjs';
import {validateRtVa1Candidate} from './rt-va1-current-census.mjs';
import {fileURLToPath} from 'node:url';
const directory='docs/evidence/ni-fin31-host-qualification-20261025/';
export const ADMISSION_SHA='ac62e242b6fed4ceaf2490705291aa43933d1d19eef5daba4b63d9998c48ff2c';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=m=>{throw Error('WEB-R2a.1 provenance boundary: '+m);};
const files=['actual-build-environment-gate.json','actual-build-environment-manifest.json','actual-host-trust-manifest.json','actual-release-gate.json','actual-release-manifest.json','actual-release-persisted.json'].map(x=>'data/current/'+x).sort();
export const ADMISSION_SHA_20261026='4d54eb55e7cf55d8c7f12bc2f0e616f1da663f51a27a8e6ca9c46d3f72f6f9b8';
const P905_PROFILE_ID='github-ubuntu24-20261026.354.1';
const P905_FINGERPRINT='90137aeb9032a2612a9414fe595213ac9daa0f0af8c28bcd4fce3c5341456b8d';
function validateAuthorizedProvenance20261026({changed,read,baseline,admissionBytes,authorizationBytes}){
 const protectedChanges=changed.filter(p=>p==='data'||p.startsWith('data/')||p==='public'||p.startsWith('public/'));
 if(!protectedChanges.length)return {status:'PASS',mode:'NO_PROTECTED_CHANGES'};
 if(sha(admissionBytes)!==ADMISSION_SHA_20261026)fail('new admission record hash');
 const admission=JSON.parse(admissionBytes);
 if(admission.schema!=='p905-exact-provenance-admission-v2'||admission.historical_base!=='073a1ee2a2098392df5891fb6b15e69b0eef2d9c'||admission.source_provenance_base!=='91ebb643ea5539d8710f86f2a64aef0b348d85c2')fail('new admission provenance');
 if(admission.profile!==P905_PROFILE_ID||admission.fingerprint!==P905_FINGERPRINT)fail('new profile authorization target');
 if(JSON.stringify(Object.keys(admission.files).sort())!==JSON.stringify(files))fail('new exact six-file surface');
 const authorization=authorizationBytes['owner-authorization.json'];
 if(!authorization||sha(authorization)!==admission.owner_authorization_sha256||admission.owner_authorization_sha256!=='b59822bd9a947cd5e8d5d6c5f97e0f7f18584c6aa4852e62ee393323f6caa831')fail('new owner authorization binding');
 const owner=JSON.parse(authorization);
 if(owner.schema!=='p905-owner-authorization-v2'||owner.authorization_source!=='explicit_user_chat_instruction'||
 owner.exact_reply!=='Ai autorizarea să faci admiterea explicită a profilului calificat, actualizarea controlată a lanțului de proveniență și executarea reală a reproductibilității ACTUAL A/B.'||
 owner.approved_profile_id!==P905_PROFILE_ID||owner.approved_contract_fingerprint!==P905_FINGERPRINT||
 owner.authorization_scope!=='host_profile_admission_provenance_rebind_and_real_A_B_only'||
 JSON.stringify(owner.forbidden_scope)!==JSON.stringify(['administrative_reparenting','geometry_mutation','P9.1_authorization']))fail('new owner authorization scope');
 for(const p of protectedChanges)if(!files.includes(p))fail('forbidden protected change '+p);
 for(const p of files){const b=read(p),binding=admission.files[p];if(!b||b.length!==binding.bytes||sha(b)!==binding.sha256)fail('exact approved bytes '+p);}
 const release=JSON.parse(read('data/current/actual-release-manifest.json'));
 for(const k of ['snapshot_id','release_fingerprint_sha256','content_fingerprint_sha256','components','geometry','source_bundle','review_evidence_bundle'])if(JSON.stringify(release[k])!==JSON.stringify(baseline[k]))fail('semantic drift '+k);
 if(release.content_fingerprint_sha256!==admission.assertions.semantic_fingerprint_unchanged)fail('approved semantic identity mismatch');
 const host=JSON.parse(read('data/current/actual-host-trust-manifest.json'));
 const envGate=JSON.parse(read('data/current/actual-build-environment-gate.json'));
 const releaseGate=JSON.parse(read('data/current/actual-release-gate.json'));
 const persisted=JSON.parse(read('data/current/actual-release-persisted.json'));
 if(host.host_trust_fingerprint_sha256!==P905_FINGERPRINT||release.host_trust?.host_trust_fingerprint_sha256!==P905_FINGERPRINT||persisted.host_trust_fingerprint_sha256!==P905_FINGERPRINT)fail('new profile fingerprint');
 if(envGate.status!=='PASS'||releaseGate.status!=='PASS'||persisted.validated_release_gate_status!=='PASS')fail('new provenance quality gates');
 if(persisted.provenance_hardening?.host_profile_id!==P905_PROFILE_ID||persisted.provenance_hardening?.semantic_identity_unchanged!==true)fail('new provenance persisted marker');
 return {status:'PASS',mode:'OWNER_AUTHORIZED_EXACT_P905_PROVENANCE_V2',admission_sha256:ADMISSION_SHA_20261026,protected_changes:protectedChanges};
}


export const ADMISSION_SHA_20261101='7848d2bbee9a3f72058a7d7ccd0e9c614e2e333a80066bd449a1b43fa885c87f';
const P905_PROFILE_ID_20261101='github-ubuntu24-20261101.360.1';
const P905_FINGERPRINT_20261101='d67648e3eee23c2a2a5f3f3b68aca71afbf5d3910467bd5fae81f6fc0274c73f';
function validateAuthorizedProvenance20261101({changed,read,baseline,admissionBytes,authorizationBytes}){
 const protectedChanges=changed.filter(p=>p==='data'||p.startsWith('data/')||p==='public'||p.startsWith('public/'));
 if(sha(admissionBytes)!==ADMISSION_SHA_20261101)fail('20261101 admission sha256');
 const admission=JSON.parse(admissionBytes);
 if(admission.schema!=='p905-exact-provenance-admission-v3'||admission.baseline_main_sha!=='2928118c871d1d02ef7d2f364b6bd2e9d0344adb')fail('20261101 base');
 if(admission.profile!==P905_PROFILE_ID_20261101||admission.fingerprint!==P905_FINGERPRINT_20261101)fail('20261101 exact profile');
 if(JSON.stringify(Object.keys(admission.files).sort())!==JSON.stringify(files))fail('20261101 six-file surface');
 const authorization=authorizationBytes['owner-authorization.json'];
 if(!authorization||sha(authorization)!==admission.owner_authorization_sha256)fail('20261101 owner hash');
 const owner=JSON.parse(authorization);
 if(owner.schema!=='p905-owner-authorization-v3'||owner.authorization_source!=='explicit_user_chat_instruction'||
 owner.exact_reply!=='Fă următoarea etapă permisă.'||owner.baseline_main_sha!=='2928118c871d1d02ef7d2f364b6bd2e9d0344adb'||
 owner.approved_profile_id!==P905_PROFILE_ID_20261101||owner.approved_contract_fingerprint!==P905_FINGERPRINT_20261101||
 owner.authorization_scope!=='host_profile_admission_provenance_rebind_and_real_A_B_only'||
 owner.qualification?.pr!==506||owner.qualification?.run_id!==41691671042||owner.qualification?.attempt!==3||owner.qualification?.conclusion!=='success'||
 JSON.stringify(owner.forbidden_scope)!==JSON.stringify(['administrative_reparenting','geometry_mutation','P9.1_authorization','source_mutation','direct_main_push']))fail('20261101 authorization');
 for(const p of protectedChanges)if(!files.includes(p))fail('20261101 unauthorized protected change '+p);
 for(const p of files){const b=read(p),v=admission.files[p];if(!b||!v||b.length!==v.bytes||sha(b)!==v.sha256)fail('20261101 exact bytes '+p);}
 const release=JSON.parse(read('data/current/actual-release-manifest.json'));
 for(const k of ['snapshot_id','release_fingerprint_sha256','content_fingerprint_sha256','components','geometry','source_bundle','review_evidence_bundle'])
   if(JSON.stringify(release[k])!==JSON.stringify(baseline[k]))fail('20261101 semantic drift '+k);
 if(release.content_fingerprint_sha256!==admission.assertions.semantic_fingerprint_unchanged||
 release.snapshot_id!==admission.assertions.snapshot_id_unchanged)fail('20261101 recorded identity');
 const host=JSON.parse(read('data/current/actual-host-trust-manifest.json'));
 const envGate=JSON.parse(read('data/current/actual-build-environment-gate.json'));
 const releaseGate=JSON.parse(read('data/current/actual-release-gate.json'));
 const persisted=JSON.parse(read('data/current/actual-release-persisted.json'));
 if(host.host_trust_fingerprint_sha256!==P905_FINGERPRINT_20261101||release.host_trust?.host_trust_fingerprint_sha256!==P905_FINGERPRINT_20261101||
 persisted.host_trust_fingerprint_sha256!==P905_FINGERPRINT_20261101)fail('20261101 bound fingerprint');
 if(host.contract.accepted_runtime_profiles.filter(x=>x.id===P905_PROFILE_ID_20261101&&x.runner.image_version==='20261101.360.1').length!==1)
   fail('20261101 approved profile cardinality');
 if(envGate.status!=='PASS'||releaseGate.status!=='PASS'||persisted.validated_release_gate_status!=='PASS')fail('20261101 gates');
 if(persisted.provenance_hardening?.host_profile_id!==P905_PROFILE_ID_20261101||
 persisted.provenance_hardening?.semantic_identity_unchanged!==true)fail('20261101 marker');
 return {status:'PASS',mode:'OWNER_AUTHORIZED_EXACT_P905_PROVENANCE_V3',admission_sha256:ADMISSION_SHA_20261101,protected_changes:protectedChanges};
}

export function validateProvenanceBoundary({changed,read,baseline,admissionBytes,authorizationBytes}){
 const protectedChanges=changed.filter(p=>p==='data'||p.startsWith('data/')||p==='public'||p.startsWith('public/'));
 if(!protectedChanges.length)return {status:'PASS',mode:'NO_PROTECTED_CHANGES'};
 if(sha(admissionBytes)===ADMISSION_SHA_20261101)return validateAuthorizedProvenance20261101({changed,read,baseline,admissionBytes,authorizationBytes});
 if(sha(admissionBytes)===ADMISSION_SHA_20261026)return validateAuthorizedProvenance20261026({changed,read,baseline,admissionBytes,authorizationBytes});
 if(sha(admissionBytes)!==ADMISSION_SHA)fail('admission record hash');
 const admission=JSON.parse(admissionBytes);
 if(JSON.stringify(Object.keys(admission.files).sort())!==JSON.stringify(files))fail('exact six-file surface');
 if(admission.historical_base!=='073a1ee2a2098392df5891fb6b15e69b0eef2d9c')fail('historical base');
 for(const [name,digest] of Object.entries(admission.authorizations)){
  const raw=authorizationBytes[name];if(!raw||sha(raw)!==digest)fail('owner authorization binding');
 }
 const owner=JSON.parse(authorizationBytes['owner-authorization.json']);
 const census=JSON.parse(authorizationBytes['census-owner-authorization.json']);
 if(owner.exact_reply!=='Autorizez profilul exact și rebindul P9.0.5'||owner.approved_contract_fingerprint!==admission.fingerprint||owner.approved_profile_id!==admission.profile)fail('profile authorization');
 if(census.exact_reply!=='Autorizez adaptarea strictă descrisă')fail('census authorization');
 for(const p of protectedChanges)if(!files.includes(p))fail('forbidden protected change '+p);
 for(const p of files){const b=read(p),binding=admission.files[p];if(b.length!==binding.bytes||sha(b)!==binding.sha256)fail('exact approved bytes '+p);}
 const release=JSON.parse(read('data/current/actual-release-manifest.json'));
 for(const k of ['snapshot_id','release_fingerprint_sha256','content_fingerprint_sha256','components','geometry','source_bundle','review_evidence_bundle'])if(JSON.stringify(release[k])!==JSON.stringify(baseline[k]))fail('semantic drift '+k);
 const host=JSON.parse(read('data/current/actual-host-trust-manifest.json'));
 if(host.host_trust_fingerprint_sha256!==admission.fingerprint)fail('profile fingerprint');
 return {status:'PASS',mode:'OWNER_AUTHORIZED_EXACT_P905_PROVENANCE',admission_sha256:ADMISSION_SHA,protected_changes:protectedChanges};
}

// Exact RT-VA1 provenance-only Linux receipt: no semantic, canonical or historical reclassification.
const VA1_PROVENANCE_BASE='cdbae72d6dc7a4428ecb9862f43daf3bfff454fd';
// Immutable integrated provenance snapshot: later read-only PRs are not part of the historical receipt.
const VA1_CERTIFIED_COMMIT='252ac975129436d2991da564232c576d23b7803b';
const VA1_EXACT_FILES={
 'data/current/actual-build-environment-manifest.json':['a0908d0a8380a79c95f8d3997d3d527104cad60e9cb7cc91dc63bdb792ad3c22',12324],
 'data/current/actual-build-environment-gate.json':['0dc117b132b5adf3b87a42b6a042e94fc41269475925a644f5f294b3f2064142',12509],
 'data/current/actual-release-manifest.json':['b193080d81d49a0d6cf77a173fb55fd2cea6274f1ba6d4cd08c4a352e60890e7',22513],
 'data/current/actual-release-gate.json':['71ffd989b8d4d48f604ade9c6abb66fcf5372561054a95fdc3833036afdea70d',39860],
 'data/current/actual-release-persisted.json':['a86cba4e37fb1659d8fba0fa47775e25c0676a8b4e2aea562f915ca0f0b9d986',2228]
};
export function certifyLaterReadOnlyPaths(changed){
 const protectedPaths=changed.filter(p=>
   p==='data'||p.startsWith('data/')||
   p==='public'||p.startsWith('public/')||
   p==='assets'||p.startsWith('assets/'));
 if(protectedPaths.length)fail('RT-VA1 certified release protected paths changed after provenance: '+protectedPaths.join(','));
 return {status:'PASS',mode:'POST_CERTIFICATION_READ_ONLY',changed_count:changed.length};
}
function auditExactVariantAProvenance(){
 try{execFileSync('git',['merge-base','--is-ancestor',VA1_CERTIFIED_COMMIT,'HEAD']);}
 catch{fail('RT-VA1 certified provenance commit is not an ancestor of HEAD');}
 const expected=[
 '.github/workflows/actual-candidate.yml','.github/workflows/actual-promote-candidate.yml',
 '.github/workflows/rt-va1-provenance-proposal.yml','scripts/process/run-actual-deterministic-candidate.sh',
 'scripts/process/prepare-rt-va1-provenance-only.mjs',
 'scripts/audit/web-r2a1-provenance-boundary.mjs','scripts/audit/web-r2a1-admin-level-census.mjs',
 '.github/workflows/actual-change-reproducibility-gate.yml','scripts/lib/actual-build-environment.mjs',
 'scripts/process/audit-actual-publication-path.mjs','scripts/process/rebind-rt-va1-card-audit.mjs',
 ...Object.keys(VA1_EXACT_FILES)
 ].sort();
 const changed=execFileSync('git',['diff','--name-only',VA1_PROVENANCE_BASE,VA1_CERTIFIED_COMMIT],{encoding:'utf8'}).trim().split(String.fromCharCode(10)).filter(Boolean).sort();
 if(JSON.stringify(changed)!==JSON.stringify(expected))fail('RT-VA1 provenance write boundary differs from approved file list');
 const changedAfterCertification=execFileSync('git',['diff','--name-only',VA1_CERTIFIED_COMMIT,'HEAD'],{encoding:'utf8'}).trim().split(String.fromCharCode(10)).filter(Boolean).sort();
 certifyLaterReadOnlyPaths(changedAfterCertification);
 for(const [path,[digest,size]]of Object.entries(VA1_EXACT_FILES)){
  const content=readFileSync(path);if(content.length!==size||sha(content)!==digest)fail('RT-VA1 Linux artifact bytes mismatch '+path);
 }
 const priorPath=p=>JSON.parse(execFileSync('git',['show',VA1_PROVENANCE_BASE+':'+p]));
 const old=priorPath('data/current/actual-release-manifest.json');
 const oldPersisted=priorPath('data/current/actual-release-persisted.json');
 const current=JSON.parse(readFileSync('data/current/actual-release-manifest.json'));
 const persisted=JSON.parse(readFileSync('data/current/actual-release-persisted.json'));
 const env=JSON.parse(readFileSync('data/current/actual-build-environment-manifest.json'));
 const envGate=JSON.parse(readFileSync('data/current/actual-build-environment-gate.json'));
 const releaseGate=JSON.parse(readFileSync('data/current/actual-release-gate.json'));
 for(const key of ['snapshot_id','release_fingerprint_sha256','content_fingerprint_sha256','components','geometry','source_bundle','review_evidence_bundle','public_contract','content_identity']){
  if(JSON.stringify(current[key])!==JSON.stringify(old[key]))fail('RT-VA1 canonical semantic drift '+key);
 }
 if(current.snapshot_id!=='actual-a9e5a4ddcb5277ef'||persisted.snapshot_id!==oldPersisted.snapshot_id||
  persisted.release_fingerprint_sha256!==oldPersisted.release_fingerprint_sha256||
  persisted.provenance_hardening?.previous_manifest_sha256!==oldPersisted.manifest_sha256||
  persisted.provenance_hardening?.change_type!=='RT-VA1_deterministic_derivative_pipeline_rebind'||
  persisted.provenance_hardening?.semantic_identity_unchanged!==true)fail('RT-VA1 historical marker drift');
 const envBytes=readFileSync('data/current/actual-build-environment-manifest.json'),manifestBytes=readFileSync('data/current/actual-release-manifest.json');
 if(envGate.status!=='PASS'||releaseGate.status!=='PASS'||persisted.validated_release_gate_status!=='PASS'||
   envGate.build_environment_sha256!==sha(envBytes)||releaseGate.manifest_sha256!==sha(manifestBytes)||
   persisted.manifest_sha256!==sha(manifestBytes)||persisted.build_environment_fingerprint_sha256!==env.environment_fingerprint_sha256||
   current.build_environment?.sha256!==sha(envBytes)||
   current.build_environment?.environment_fingerprint_sha256!==env.environment_fingerprint_sha256||
   current.host_trust?.sha256!==old.host_trust?.sha256)fail('RT-VA1 provenance chain mismatch');
 const policy=JSON.parse(readFileSync('docs/p9.0.4.3-promotion-policy.json'));
 if(policy.p91_import_allowed!==false||policy.semantic_acceptance!=='BLOCKED_INCOMPLETE')fail('RT-VA1 P9.1 gate changed');
 return {status:'PASS',mode:'RT_VA1_EXACT_PROVENANCE_REBIND',historical_snapshot:current.snapshot_id,base:VA1_PROVENANCE_BASE,certified_commit:VA1_CERTIFIED_COMMIT,post_certification_read_only:true};
}

export function auditProvenanceBoundary(base){
 const live=JSON.parse(readFileSync('data/current/actual-release-manifest.json'));
 if(sha(readFileSync('data/current/actual-release-manifest.json'))===VA1_EXACT_FILES['data/current/actual-release-manifest.json'][0])return auditExactVariantAProvenance();
 if(live.snapshot_id===VARIANT_A_ACTUAL.snapshot){
  const audit=validateRtVa1Candidate();
  return {status:'PASS',mode:'EXACT_PROMOTED_RT_VA1_SEMANTIC_CHANGE',audit};
 }
 const changed=execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 const baseline=JSON.parse(execFileSync('git',['show',base+':data/current/actual-release-manifest.json']));
 const newDirectory=changed.includes('docs/evidence/p905-20261101/exact-provenance-admission.json')?'docs/evidence/p905-20261101/':'docs/evidence/p905-20261026/';
 return validateProvenanceBoundary({changed,read:p=>readFileSync(p),baseline,admissionBytes:readFileSync(newDirectory+'exact-provenance-admission.json'),authorizationBytes:{'owner-authorization.json':readFileSync(newDirectory+'owner-authorization.json')}});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])console.log(JSON.stringify(auditProvenanceBoundary('073a1ee2a2098392df5891fb6b15e69b0eef2d9c')));
