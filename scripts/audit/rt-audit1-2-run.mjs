#!/usr/bin/env node
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url),phases=['rt-audit1-parent-child.mjs','rt-audit1-overlap-investigation.mjs','rt-audit1-2-source-forensics.mjs','rt-audit1-causal-certification.mjs','rt-audit1-2-final.mjs','rt-audit1-2-verify.mjs'];
function run(){for(const p of phases){const r=spawnSync(process.execPath,['--max-old-space-size=4096','scripts/audit/'+p],{cwd:root,stdio:'inherit',windowsHide:true});assert.equal(r.status,0,p+' a esuat');}}
run();if(process.argv.includes('--reproduce')){const before=await readFile(new URL('outputs/RT-AUDIT.1.2/checksums.sha256',root),'utf8');run();assert.equal(await readFile(new URL('outputs/RT-AUDIT.1.2/checksums.sha256',root),'utf8'),before,'Regenerarea nu este byte-identica');console.log('RT_AUDIT_REPRODUCIBILITY_BYTE_IDENTICAL PASS');}
