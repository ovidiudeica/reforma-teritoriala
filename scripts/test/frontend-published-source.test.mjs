import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {verifyPublishedSource,publishedSourceContext} from '../audit/helpers/published-source.mjs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=async(url)=>{const name=new URL(url).pathname.slice('/reforma-teritoriala/'.length);return new Response(await readFile(new URL('../../'+name,import.meta.url)));};
test('live acceptance fingerprints the actual published source bytes',async()=>{const rows=await verifyPublishedSource(root,{fetcher:fixture});assert.equal(rows.length,9);assert.ok(rows.every(r=>r.status==='PASS'&&/^[a-f0-9]{64}$/.test(r.sha256)));});
test('a stale deployed application fails even if the local commit is correct',async()=>{await assert.rejects(verifyPublishedSource(root,{fetcher:async url=>url.endsWith('/app.js')?new Response('stale application'):fixture(url)}),/Published source differs.*app.js/);});
test('missing published resources cannot be accepted',async()=>{await assert.rejects(verifyPublishedSource(root,{fetcher:async()=>new Response('missing',{status:404})}),/Published source HTTP/);});
test('PR audit identifies deployed base separately from the unpublished candidate auditor',()=>{const head='a'.repeat(40),base='b'.repeat(40),context=publishedSourceContext(root,{eventName:'pull_request',baseSha:base,readSource:p=>({sha:p===path.join(root,'published-baseline')?base:head,trackedSourcesClean:true})});assert.equal(context.auditor.sha,head);assert.equal(context.published.sha,base);assert.equal(context.coverage,'PR_PUBLISHED_BASELINE_ONLY');assert.throws(()=>publishedSourceContext(root,{eventName:'pull_request',baseSha:base,readSource:()=>({sha:head})}),/differs from PR base/);});
test('post-merge/manual audit requires published bytes from the exact auditor checkout',()=>{const context=publishedSourceContext(root,{eventName:'workflow_dispatch',readSource:()=>({sha:'a'.repeat(40),trackedSourcesClean:true})});assert.equal(context.sourceRoot,root);assert.equal(context.published.sha,context.auditor.sha);assert.equal(context.coverage,'PUBLISHED_EXACT_CHECKOUT');});

test('initial published source manifest recovers from transient503 with exact bytes and history',async()=>{
 let calls=0;const file='data/current/actual-release-manifest.json';
 const rows=await verifyPublishedSource(root,{pause:async()=>{},fetcher:async url=>url.endsWith(file)&&++calls===1?new Response('temporary',{status:503}):fixture(url)});
 const manifest=rows.find(r=>r.file===file);assert.equal(calls,2);assert.equal(manifest.httpAttempts,2);assert.deepEqual(manifest.httpHistory,[503,200]);assert.equal(manifest.status,'PASS');
});
test('source retry never admits HTTP200 stale manifest bytes',async()=>{
 let calls=0;const file='data/current/actual-release-manifest.json';
 await assert.rejects(verifyPublishedSource(root,{pause:async()=>{},fetcher:async url=>url.endsWith(file)?(++calls===1?new Response('temporary',{status:503}):new Response('stale')):fixture(url)}),/Published source differs.*actual-release-manifest/);assert.equal(calls,2);
});
test('initial source persistent503 remains blocked after three attempts',async()=>{
 let calls=0;await assert.rejects(verifyPublishedSource(root,{pause:async()=>{},fetcher:async()=>{calls++;return new Response('temporary',{status:503});}}),/Published source HTTP/);assert.equal(calls,3);
});
test('initial source404 is never retried',async()=>{
 let calls=0;await assert.rejects(verifyPublishedSource(root,{pause:async()=>{},fetcher:async()=>{calls++;return new Response('missing',{status:404});}}),/Published source HTTP/);assert.equal(calls,1);
});
test('initial source timeout can recover without bypassing byte verification',async()=>{
 let calls=0;const rows=await verifyPublishedSource(root,{pause:async()=>{},fetcher:async url=>{if(++calls===1)throw new DOMException('fixture timeout','TimeoutError');return fixture(url);}});assert.equal(rows.length,9);assert.equal(calls,10);assert.equal(rows[0].httpAttempts,2);
});

test('source retry evidence manifest references tracked byte-identical files',async()=>{
 const base='docs/evidence/published-source-retry-20261022/';
 const manifest=JSON.parse(await readFile(path.join(root,base,'manifest-sha256.json')));
 const names=['before.txt','after.txt','before.original.txt.gz','after.original.txt.gz','failed-artifact-receipt.json','proof.json'];assert.equal(manifest.files.length,names.length);
 for(const name of names){const relative=base+name,row=manifest.files.find(r=>r.name===name);assert.ok(row,'Missing manifest entry '+name);assert.equal(execFileSync('git',['ls-files','--',relative],{cwd:root,encoding:'utf8'}).trim(),relative,'Evidence is not tracked');const raw=await readFile(path.join(root,base,name));assert.equal(raw.length,row.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),row.sha256);}
});
