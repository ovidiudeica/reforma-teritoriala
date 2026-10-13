// P9.0.4.3 provenance evidence builder. Writes only local ephemeral files on a read-only CI runner.
// Never pushes, never creates or mutates ACTUAL geometries, never changes semantic release identity.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const prior=JSON.parse(execFileSync('git',['show','HEAD:data/current/actual-release-manifest.json'],{maxBuffer:4*1024*1024}).toString('utf8'));
const priorMarker=JSON.parse(execFileSync('git',['show','HEAD:data/current/actual-release-persisted.json'],{maxBuffer:4*1024*1024}).toString('utf8'));
const nowBytes=await readFile('data/current/actual-release-manifest.json');
const now=JSON.parse(nowBytes);
const environmentBytes=await readFile('data/current/actual-build-environment-manifest.json');
const environment=JSON.parse(environmentBytes);
const releaseGate=JSON.parse(await readFile('data/current/actual-release-gate.json','utf8'));
const envGate=JSON.parse(await readFile('data/current/actual-build-environment-gate.json','utf8'));
const guard=(x,m)=>{if(!x)throw Error('P9043_PROVENANCE_DENIED: '+m)};
guard(now.snapshot_id===prior.snapshot_id,'snapshot drift');
guard(now.release_fingerprint_sha256===prior.release_fingerprint_sha256,'release semantic fingerprint drift');
guard(now.content_fingerprint_sha256===prior.content_fingerprint_sha256,'content fingerprint drift');
guard(JSON.stringify(now.components)===JSON.stringify(prior.components),'release components drift');
guard(JSON.stringify(now.geometry)===JSON.stringify(prior.geometry),'release master geometry drift');
guard(now.build_environment?.sha256===sha(environmentBytes),'environment exact byte binding');
guard(now.build_environment?.environment_fingerprint_sha256===environment.environment_fingerprint_sha256,'environment semantic fingerprint binding');
guard(releaseGate.status==='PASS'&&envGate.status==='PASS','release or environment gate failure');
guard(priorMarker.snapshot_id===prior.snapshot_id&&priorMarker.release_fingerprint_sha256===prior.release_fingerprint_sha256,'persisted marker identity drift');
guard(priorMarker.validated_release_gate_status==='PASS','previous persisted release not validated');
const marker={...priorMarker,
 manifest_sha256:sha(nowBytes),
 build_environment_fingerprint_sha256:environment.environment_fingerprint_sha256,
 provenance_hardening:{
  previous_manifest_sha256:priorMarker.manifest_sha256,
  change_type:'P9.0.4.3_promotion_workflow_enforcement_rebind_only',
  method:'evidence_only_manual_review_required',
  semantic_identity_unchanged:true
 }
};
guard(marker.snapshot_id===priorMarker.snapshot_id&&marker.release_fingerprint_sha256===priorMarker.release_fingerprint_sha256,'persisted semantic identity drift');
await writeFile('data/current/actual-release-persisted.json',JSON.stringify(marker,null,2)+'\n');
console.log('P9043_PROVENANCE_PREPARED '+JSON.stringify({old_manifest_sha256:priorMarker.manifest_sha256,new_manifest_sha256:marker.manifest_sha256,snapshot_id:now.snapshot_id,build_environment_fingerprint:environment.environment_fingerprint_sha256}));
