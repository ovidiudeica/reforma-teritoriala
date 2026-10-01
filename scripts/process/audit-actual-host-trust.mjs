#!/usr/bin/env node
import {dirname} from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {
 HOST_TRUST_PATH,
 captureObservedHost,
 sha256,
 validateHostTrustManifest,
 validateObservedHost
} from '../lib/actual-host-trust.mjs';

const manifestBytes=await readFile(HOST_TRUST_PATH);
const manifest=JSON.parse(manifestBytes.toString('utf8'));
const staticValidation=validateHostTrustManifest(manifest);
let observed=null,runtimeValidation=null,error=null;
try{
 observed=await captureObservedHost();
 runtimeValidation=validateObservedHost(manifest,observed);
}catch(err){
 error=err;
 runtimeValidation={status:'FAIL',checks:staticValidation.checks,failures:[...staticValidation.failures,{name:'host_observation_failed',detail:{error:err.message}}]};
}
const report={
 schema_version:1,
 mode:'ACTUAL_HOST_TRUST_AUDIT',
 status:runtimeValidation.status,
 host_trust_path:HOST_TRUST_PATH,
 host_trust_manifest_sha256:sha256(manifestBytes),
 host_trust_fingerprint_sha256:manifest.host_trust_fingerprint_sha256??null,
 policy:'Fail closed before deterministic ACTUAL execution unless the hosted runner image, kernel, Docker/containerd/runc stack and CPU compatibility contract match the committed host-trust manifest. CPU vendor/model are recorded as evidence but are not semantic release identity.',
 checks:runtimeValidation.checks,
 failures:runtimeValidation.failures,
 observed
};
const output=process.env.ACTUAL_HOST_TRUST_AUDIT_PATH||'/tmp/actual-host-trust-audit.json';
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
