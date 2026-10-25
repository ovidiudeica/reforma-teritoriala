import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {buildHostTrustManifest,validateHostTrustManifest,validateObservedHost,hostTrustFingerprint,canonicalizeHostTrust} from '../../docs/evidence/ni-fin31-host-qualification-20261025/baseline-host-trust.mjs';
import {captureObservedHost,validateObservedHost as validateCurrentHost} from '../lib/actual-host-trust.mjs';
const root=new URL('../../',import.meta.url),directory='docs/evidence/ni-fin31-host-qualification-20261025/';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const read=p=>readFileSync(new URL(p,root)),parse=p=>JSON.parse(read(p));
const fail=m=>{throw Error('NI-FIN.3.1 qualification: '+m);};
export function fieldComparisons(a,b,prefix=''){
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().flatMap(k=>fieldComparisons(a[k],b[k],prefix?prefix+'.'+k:k));
 return [{field:prefix,approved:a??null,observed:b??null,match:JSON.stringify(a)===JSON.stringify(b)}];
}
export const fieldDifferences=(a,b)=>fieldComparisons(a,b).filter(x=>!x.match);
const profileOf=o=>Object.fromEntries(['runner','kernel','docker','engine'].map(k=>[k,structuredClone(o[k])]));
export function qualifyObserved(manifest,observed){
 if(validateHostTrustManifest(manifest).status!=='PASS')fail('approved manifest invalid');
 const old=manifest.contract.accepted_runtime_profiles.find(x=>x.id==='github-ubuntu24-20261012.334.1');if(!old)fail('last approved profile missing');
 const differences=fieldDifferences(profileOf(old),profileOf(observed));
 const validation=validateObservedHost(manifest,observed);
 if(differences.length!==1||differences[0].field!=='runner.image_version'||differences[0].observed!=='20261023.334.3')fail('unexpected runtime difference');
 if(validation.status!=='FAIL'||validation.failures.length!==1||validation.failures[0].name!=='runtime_host_profile_is_explicitly_approved')fail('CPU or static contract differs');
 const counterfactual=structuredClone(observed);counterfactual.runner.image_version=old.runner.image_version;
 if(validateObservedHost(manifest,counterfactual).status!=='PASS')fail('image-only positive control failed');
 return {differences,contract_field_comparison:fieldComparisons(profileOf(old),profileOf(observed)),cpu_checks:validation.checks.filter(x=>x.name.startsWith('cpu_')),approved_validator_status:'FAIL',counterfactual_previous_image_only:'PASS_SYNTHETIC_CONTROL_NOT_RUNTIME_APPROVAL'};
}
export function buildQualification({manifest,manifest_sha256,a,b,release,readme}){
 if(release.tag_name!=='ubuntu24/20261023.334'||release.draft!==false||!release.body.includes('Image Version: 20261023.334.3')||!readme.includes('Image Version: 20261023.334.3'))fail('official publication does not corroborate version');
 if([a,b].some(x=>x.mode!=='ACTUAL_HOST_TRUST_AUDIT'||x.status!=='FAIL'||x.host_trust_fingerprint_sha256!==manifest.host_trust_fingerprint_sha256||x.host_trust_manifest_sha256!==manifest_sha256))fail('audit manifest binding');
 const A=qualifyObserved(manifest,a.observed),B=qualifyObserved(manifest,b.observed);
 if(fieldDifferences(profileOf(a.observed),profileOf(b.observed)).length)fail('A/B runtime conflict');
 const profile={id:'github-ubuntu24-20261023.334.3',...profileOf(a.observed)};
 const candidate=structuredClone(manifest);candidate.contract.accepted_runtime_profiles.push(profile);
 return {schema:'ni-fin31-host-qualification-proposal-v1',status:'TECHNICALLY_COMPATIBLE_PENDING_OWNER_AUTHORIZATION',runtime_authorized:false,owner_authorization:'WAITING_OWNER_AUTHORIZATION',actual_manifest_changes_applied:false,reproducibility_A_B:'NOT_EXECUTED_ON_PROPOSED_PROFILE',previous_profile_id:'github-ubuntu24-20261012.334.1',proposed_profile:profile,preserved_approved_profile_ids:manifest.contract.accepted_runtime_profiles.map(x=>x.id),current_host_trust_fingerprint:manifest.host_trust_fingerprint_sha256,proposed_contract_fingerprint:hostTrustFingerprint(candidate).sha256,official_release:{id:release.id,url:release.html_url,published_at:release.published_at,prerelease:release.prerelease,target_commitish:release.target_commitish},setup_job_release_url_discrepancy:'Set up job links 20261012.334; independent official20261023release and immutable README corroborate observed20261023.334.3. Discrepancy retained, not silently rewritten.',A,B};
}
export function loadQualificationInputs(){return {manifest:parse(directory+'baseline-host-trust-manifest.json'),manifest_sha256:hash(read(directory+'baseline-host-trust-manifest.json')),a:parse(directory+'actual-change-repro-A.json'),b:parse(directory+'actual-change-repro-B.json'),release:parse(directory+'official-release-20261023.json'),readme:read(directory+'official-image-readme.md').toString('utf8')};}
export function generateQualification(check=false){
 const report=buildQualification(loadQualificationInputs()),bytes=json(report),file=new URL(directory+'proposal.json',root);
 if(check){if(!readFileSync(file).equals(bytes))fail('proposal byte drift');}else writeFileSync(file,bytes);
 const files=readdirSync(new URL(directory,root)).filter(x=>x!=='manifest-sha256.json').sort().map(name=>{const raw=read(directory+name);return {path:name,bytes:raw.length,sha256:hash(raw)};});
 const manifest=json({schema:'ni-fin31-evidence-manifest-v1',files,approved_profile_changed:false});
 const target=new URL(directory+'manifest-sha256.json',root);if(check){if(!readFileSync(target).equals(manifest))fail('evidence manifest drift');}else writeFileSync(target,manifest);
 return {status:check?'BYTE_IDENTICAL_EVIDENCE':'EVIDENCE_GENERATED',runtime_authorized:false,proposed_contract_fingerprint:report.proposed_contract_fingerprint,files:files.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 if(args.length===1&&['--capture-live=A','--capture-live=B'].includes(args[0])){
  const observed=await captureObservedHost(),approved=parse('data/current/actual-host-trust-manifest.json');let assessment,error;
  try{assessment=qualifyObserved(loadQualificationInputs().manifest,observed);}catch(e){error=e.message;}
  const record={schema:'ni-fin31-live-observation-v1',captured_at:new Date().toISOString(),github_run_id:process.env.GITHUB_RUN_ID??null,checkout_sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),observed,current_approved_validator:validateCurrentHost(approved,observed),assessment:assessment??null,error:error??null,runtime_authorized:false,reproducibility_executed:false};
  mkdirSync(new URL('outputs/ni-fin31-live/',root),{recursive:true});writeFileSync(new URL(args[0]==='--capture-live=A'?'outputs/ni-fin31-live/A.json':'outputs/ni-fin31-live/B.json',root),json(record));console.log(JSON.stringify({evidence_recorded:true,compatibility:assessment?'IMAGE_VERSION_ONLY':'UNEXPECTED_ENVIRONMENT',runtime_authorized:false}));if(error)process.exitCode=1;
 }else{if(args.some(x=>x!=='--check')||args.length>1)fail('unsupported argument');console.log(JSON.stringify(generateQualification(args.includes('--check'))));}
}
