import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {validateProvenanceBoundary} from '../audit/web-r2a1-provenance-boundary.mjs';
const dir='docs/evidence/ni-fin31-host-qualification-20261025/';
function fixture(){
 const admissionBytes=readFileSync(dir+'exact-provenance-admission.json');
 const admission=JSON.parse(admissionBytes);
 const buffers=Object.fromEntries(Object.keys(admission.files).map(p=>[p,readFileSync(p)]));
 return {changed:Object.keys(buffers),read:p=>buffers[p],buffers,admissionBytes,
 baseline:JSON.parse(execFileSync('git',['show',admission.historical_base+':data/current/actual-release-manifest.json'])),
 authorizationBytes:Object.fromEntries(Object.keys(admission.authorizations).map(n=>[n,readFileSync(dir+n)]))};
}
test('exact owner-authorized six-file rebind passes',()=>assert.equal(validateProvenanceBoundary(fixture()).mode,'OWNER_AUTHORIZED_EXACT_P905_PROVENANCE'));
test('ordinary read-only branch remains valid',()=>assert.equal(validateProvenanceBoundary({changed:['app.js']}).mode,'NO_PROTECTED_CHANGES'));
for(const file of ['public/data/actual-entities.json','data/sources/cuatm-current.json','data/current/unreviewed.json'])test('reject protected addition '+file,()=>{const x=fixture();x.changed.push(file);assert.throws(()=>validateProvenanceBoundary(x),/forbidden/);});
for(const file of Object.keys(JSON.parse(readFileSync(dir+'exact-provenance-admission.json')).files))test('reject byte/hash drift '+file,()=>{const x=fixture();x.buffers[file]=Buffer.concat([x.buffers[file],Buffer.from(' ')]);assert.throws(()=>validateProvenanceBoundary(x),/approved bytes/);});
test('reject altered admission manifest',()=>{const x=fixture();x.admissionBytes=Buffer.from('{}');assert.throws(()=>validateProvenanceBoundary(x),/record hash/);});
test('reject missing profile authorization',()=>{const x=fixture();delete x.authorizationBytes['owner-authorization.json'];assert.throws(()=>validateProvenanceBoundary(x),/authorization binding/);});
test('reject altered census authorization',()=>{const x=fixture();x.authorizationBytes['census-owner-authorization.json']=Buffer.from('{}');assert.throws(()=>validateProvenanceBoundary(x),/authorization binding/);});
for(const field of ['snapshot_id','components','geometry','source_bundle','review_evidence_bundle'])test('reject semantic baseline drift '+field,()=>{const x=fixture();x.baseline[field]=null;assert.throws(()=>validateProvenanceBoundary(x),/semantic drift/);});
test('missing required bytes fail closed',()=>{const x=fixture();delete x.buffers['data/current/actual-host-trust-manifest.json'];assert.throws(()=>validateProvenanceBoundary(x));});
