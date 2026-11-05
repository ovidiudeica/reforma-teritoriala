import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateProvenanceBoundary,certifyLaterReadOnlyPaths} from '../audit/web-r2a1-provenance-boundary.mjs';
const dir='docs/evidence/ni-fin31-host-qualification-20261025/';
const current='docs/evidence/p905-20261101/';
const archivalRoot='docs/evidence/rt-va1-release-acceptance/historical-p905/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const previousBytes=(p,descriptor)=>{
 if(!p.startsWith('data/current/')||p.split('/').length!==3)throw Error('Unexpected historic fixture path '+p);
 const bytes=readFileSync(archivalRoot+p.split('/').at(-1));
 if(bytes.length!==descriptor.bytes||hash(bytes)!==descriptor.sha256)throw Error('Historical P9.0.5 fixture hash mismatch '+p);
 return bytes;
};
function fixture(){
 const admissionBytes=readFileSync(current+'exact-provenance-admission.json');
 const admission=JSON.parse(admissionBytes);
 const buffers=Object.fromEntries(Object.entries(admission.files).map(([p,descriptor])=>[p,previousBytes(p,descriptor)]));
 return {changed:Object.keys(buffers),read:p=>buffers[p],buffers,admissionBytes,
 baseline:JSON.parse(readFileSync(dir+'baseline-release-manifest.json')),
 authorizationBytes:{'owner-authorization.json':readFileSync(current+'owner-authorization.json')}};
}
test('exact owner-authorized six-file rebind passes',()=>assert.equal(validateProvenanceBoundary(fixture()).mode,'OWNER_AUTHORIZED_EXACT_P905_PROVENANCE_V3'));
test('ordinary read-only branch remains valid',()=>assert.equal(validateProvenanceBoundary({changed:['app.js']}).mode,'NO_PROTECTED_CHANGES'));
for(const file of ['public/data/actual-entities.json','data/sources/cuatm-current.json','data/current/unreviewed.json'])test('reject protected addition '+file,()=>{const x=fixture();x.changed.push(file);assert.throws(()=>validateProvenanceBoundary(x),/unauthorized protected change/);});
for(const file of Object.keys(JSON.parse(readFileSync(current+'exact-provenance-admission.json')).files))test('reject byte/hash drift '+file,()=>{const x=fixture();x.buffers[file]=Buffer.concat([x.buffers[file],Buffer.from(' ')]);assert.throws(()=>validateProvenanceBoundary(x),/exact bytes/);});
test('reject altered admission manifest',()=>{const x=fixture();x.admissionBytes=Buffer.from('{}');assert.throws(()=>validateProvenanceBoundary(x),/admission record hash/);});
test('reject missing profile authorization',()=>{const x=fixture();delete x.authorizationBytes['owner-authorization.json'];assert.throws(()=>validateProvenanceBoundary(x),/owner hash/);});
test('reject altered owner authorization',()=>{const x=fixture();x.authorizationBytes['owner-authorization.json']=Buffer.from('{}');assert.throws(()=>validateProvenanceBoundary(x),/owner hash/);});
for(const field of ['snapshot_id','components','geometry','source_bundle','review_evidence_bundle'])test('reject semantic baseline drift '+field,()=>{const x=fixture();x.baseline[field]=null;assert.throws(()=>validateProvenanceBoundary(x),/semantic drift/);});
test('missing required bytes fail closed',()=>{const x=fixture();delete x.buffers['data/current/actual-host-trust-manifest.json'];assert.throws(()=>validateProvenanceBoundary(x));});

test('historical fixture is independently hash-bound and needs no Git history',()=>assert.equal(createHash('sha256').update(readFileSync(dir+'baseline-release-manifest.json')).digest('hex'),'52ae583f284bac2d00bc3b5e4b96b6c429c659b8def297197d7f3f38dc042856'));

test('legacy admission cannot silently validate newly rebound bytes',()=>{const x=fixture();x.admissionBytes=readFileSync(dir+'exact-provenance-admission.json');x.authorizationBytes={'owner-authorization.json':readFileSync(dir+'owner-authorization.json'),'census-owner-authorization.json':readFileSync(dir+'census-owner-authorization.json')};assert.throws(()=>validateProvenanceBoundary(x),/approved bytes/);});

test('RT-VA1 exact historical provenance remains certified after unrelated read-only changes',()=>{
 const changed=['scripts/lib/rt-host-qualification.mjs','.github/workflows/rt-host-qualification.yml','docs/rt-host-qualification.md'];
 assert.deepEqual(certifyLaterReadOnlyPaths(changed),{status:'PASS',mode:'POST_CERTIFICATION_READ_ONLY',changed_count:3});
});
for(const p of ['data/current/actual-release-manifest.json','data/sources/osm-current.json',
 'public/data/actual-entities.json','assets/web-card-audit/manifest.json']){
 test('RT-VA1 post-certification guard refuses altered protected bytes '+p,()=>{
  assert.throws(()=>certifyLaterReadOnlyPaths(['docs/a.md',p]),/protected paths changed after provenance/);
 });
}
