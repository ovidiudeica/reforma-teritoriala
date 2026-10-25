import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const directory='docs/evidence/ni-fin31-host-qualification-20261025/';
export const ADMISSION_SHA='ac62e242b6fed4ceaf2490705291aa43933d1d19eef5daba4b63d9998c48ff2c';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=m=>{throw Error('WEB-R2a.1 provenance boundary: '+m);};
const files=['actual-build-environment-gate.json','actual-build-environment-manifest.json','actual-host-trust-manifest.json','actual-release-gate.json','actual-release-manifest.json','actual-release-persisted.json'].map(x=>'data/current/'+x).sort();
export function validateProvenanceBoundary({changed,read,baseline,admissionBytes,authorizationBytes}){
 const protectedChanges=changed.filter(p=>p==='data'||p.startsWith('data/')||p==='public'||p.startsWith('public/'));
 if(!protectedChanges.length)return {status:'PASS',mode:'NO_PROTECTED_CHANGES'};
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
 return validateProvenanceBoundary({changed,read:p=>readFileSync(p),baseline,admissionBytes:readFileSync(directory+'exact-provenance-admission.json'),authorizationBytes:Object.fromEntries(['owner-authorization.json','census-owner-authorization.json'].map(n=>[n,readFileSync(directory+n)]))});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])console.log(JSON.stringify(auditProvenanceBoundary('073a1ee2a2098392df5891fb6b15e69b0eef2d9c')));
