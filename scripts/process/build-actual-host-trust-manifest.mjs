#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {HOST_TRUST_PATH,buildHostTrustManifest} from '../lib/actual-host-trust.mjs';

const manifest=buildHostTrustManifest();
await mkdir('data/current',{recursive:true});
await writeFile(HOST_TRUST_PATH,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({
 status:'PASS',
 host_trust_path:HOST_TRUST_PATH,
 host_trust_fingerprint_sha256:manifest.host_trust_fingerprint_sha256,
 runner:manifest.contract.runner,
 kernel:manifest.contract.kernel,
 docker:manifest.contract.docker,
 engine:manifest.contract.engine,
 cpu_contract:manifest.contract.cpu_contract
},null,2));
