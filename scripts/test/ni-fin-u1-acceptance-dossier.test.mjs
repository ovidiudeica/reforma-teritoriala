import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDossier,validateReceipts,encode,manifest} from '../audit/ni-fin-u1-acceptance-dossier.mjs';
const base=new URL('../../docs/web-ni-u1/acceptance/',import.meta.url);
const receipts=Object.fromEntries(await Promise.all(['release','ni','cards','shared','coupled','history','pages'].map(async name=>[name,JSON.parse(await readFile(new URL('sources/'+name+'.json',base),'utf8'))])));
test('U1.5 receipts cover published application, 85 canonical references, four-way sync and terminal exact-SHA CI',()=>validateReceipts(receipts));
for(const [name,mutate] of [
 ['failed browser report',r=>r.coupled.status='FAIL'],
 ['local result substituted for published',r=>r.shared.mode='local'],
 ['dirty source',r=>r.history.trackedSourcesClean=false],
 ['wrong deployment SHA',r=>r.pages.expectedPublishedSha='0'.repeat(40)],
 ['wrong coupled application',r=>r.coupled.applicationBaselineSha='0'.repeat(40)],
 ['missing canonical reference',r=>r.shared.references.pop()],
 ['duplicate canonical reference',r=>r.shared.references[1]=r.shared.references[0]],
 ['one failed sync direction',r=>r.shared.references[0].four_way_sync=false],
 ['invented missing outline',r=>r.cards.outlines.pop()],
 ['JavaScript error',r=>r.coupled.errors.push('authentic failure')],
 ['uninspected screenshots',r=>r.release.visual_inspection.status='PENDING'],
 ['unverified artifact ZIP',r=>r.release.artifacts[0].independently_verified_zip_sha256='0'.repeat(64)],
 ['CI from another head',r=>r.release.functional_post_merge.checks[0].head_sha='0'.repeat(40)],
 ['corrupt published resource',r=>r.pages.publishedInventory.records[0].sha256='0'.repeat(64)],
 ['incomplete resource inventory',r=>r.pages.publishedInventory.checkedFiles--],
 ['missing A/B comparison',r=>r.release.functional_post_merge.checks=r.release.functional_post_merge.checks.filter(c=>c.name!=='actual-change-repro-compare')],
 ['SKIPPED treated as pass',r=>r.release.functional_post_merge.checks[0].conclusion='skipped'],
 ['nonterminal CI',r=>r.release.functional_pre_merge.checks[0].status='in_progress']
])test('U1.5 reject '+name,()=>{const r=structuredClone(receipts);mutate(r);assert.throws(()=>validateReceipts(r));});
test('U1.5 generated registers and 32 protected hashes regenerate byte-identically',async()=>{
 const a=await buildDossier(),b=await buildDossier();assert.equal(encode(a),encode(b));
 for(const [name,value] of Object.entries(a))assert.equal(await readFile(new URL(name,base),'utf8'),encode(value),name);
});
test('U1.5 manifest binds all permanent dossier receipts and registers',async()=>{
 const bytes=await readFile(new URL('sha256-manifest.json',base),'utf8');assert.equal(bytes,encode(await manifest()));
});
