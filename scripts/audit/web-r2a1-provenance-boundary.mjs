import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
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

export function validateProvenanceBoundary({changed,read,baseline,admissionBytes,authorizationBytes}){
 const protectedChanges=changed.filter(p=>p==='data'||p.startsWith('data/')||p==='public'||p.startsWith('public/'));
 if(!protectedChanges.length)return {status:'PASS',mode:'NO_PROTECTED_CHANGES'};
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
export function auditProvenanceBoundary(base){
 const changed=execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 const baseline=JSON.parse(execFileSync('git',['show',base+':data/current/actual-release-manifest.json']));
 const newDirectory='docs/evidence/p905-20261026/';
 return validateProvenanceBoundary({changed,read:p=>readFileSync(p),baseline,admissionBytes:readFileSync(newDirectory+'exact-provenance-admission.json'),authorizationBytes:{'owner-authorization.json':readFileSync(newDirectory+'owner-authorization.json')}});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])console.log(JSON.stringify(auditProvenanceBoundary('073a1ee2a2098392df5891fb6b15e69b0eef2d9c')));
