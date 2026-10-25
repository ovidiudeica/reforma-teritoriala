import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {publishedRuntimeFiles,verifyPublishedRuntime} from '../audit/helpers/published-runtime.mjs';
async function fixture(fn){const root=await mkdtemp(path.join(tmpdir(),'atlas-published-runtime-'));assert.ok(root.startsWith(path.join(tmpdir(),'atlas-published-runtime-')));try{
 const files={'index.html':'<title>fixture</title>','app.js':'export const ready=true;','atlas-demo.mjs':"import './vendor/gis/engine.js';",'vendor/gis/engine.js':'globalThis.fixtureEngine=true;','vendor/gis/manifest.json':'{"fixtureVendor":true}','style.css':'body{}','public/data/catalog.json':'{"fixture":true}','public/geo/shape.geojson':'{"type":"FeatureCollection","features":[]}','data/current/actual-release-manifest.json':'{"snapshot":"fixture"}','data/current/actual-release-gate.json':'{"status":"PASS"}'};
 for(const [name,bytes]of Object.entries(files)){await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),bytes);}execFileSync('git',['init','--quiet'],{cwd:root});execFileSync('git',['add','.'],{cwd:root});await writeFile(path.join(root,'public/data/untracked.json'),'not a deployed source');
 const fetcher=async url=>new Response(await readFile(path.join(root,new URL(url).pathname.slice('/reforma-teritoriala/'.length))),{headers:{'Content-Type':'application/octet-stream'}});return await fn({root,fetcher});
 }finally{assert.ok(root.startsWith(path.join(tmpdir(),'atlas-published-runtime-')));await rm(root,{recursive:true,force:true});}}
test('published inventory covers tracked code, worker GIS dependencies, contracts, catalogs and geometry, excluding untracked bytes',()=>fixture(async({root,fetcher})=>{const files=publishedRuntimeFiles(root);assert.equal(files.length,10);assert.ok(files.includes('vendor/gis/engine.js'));assert.ok(files.includes('vendor/gis/manifest.json'));assert.ok(!files.some(f=>f.includes('untracked')));const r=await verifyPublishedRuntime(root,{fetcher});assert.equal(r.status,'PASS');assert.equal(r.checkedFiles,10);assert.equal(r.geojsonFiles,1);assert.ok(r.records.every(x=>x.sha256===x.expectedSha256));}));
test('stale worker GIS dependency fails even when the root modules match',()=>fixture(async({root,fetcher})=>{await assert.rejects(verifyPublishedRuntime(root,{fetcher:async url=>url.endsWith('engine.js')?new Response('stale engine'):fetcher(url)}),/Published runtime bytes differ: vendor\/gis\/engine.js/);}));
test('an HTTP200 stale geometry fails with the exact mismatched resource and hashes',()=>fixture(async({root,fetcher})=>{await assert.rejects(verifyPublishedRuntime(root,{fetcher:async url=>url.endsWith('shape.geojson')?new Response('stale geometry'):fetcher(url)}),e=>{assert.match(e.message,/bytes differ.*shape.geojson/);assert.equal(e.inventory.status,'FAIL');assert.ok(e.inventory.records.some(r=>r.file==='public/geo/shape.geojson'&&r.status==='FAIL'&&r.sha256!==r.expectedSha256));return true;});}));
test('missing runtime resources fail instead of being omitted from the inventory',()=>fixture(async({root})=>{await assert.rejects(verifyPublishedRuntime(root,{fetcher:async()=>new Response('not found',{status:404})}),e=>{assert.match(e.message,/Published runtime HTTP/);assert.ok(e.inventory.records.some(r=>r.httpStatus===404&&r.status==='FAIL'));return true;});}));

test('a transient 503 followed by HTTP200 stale geometry still fails the exact-byte gate',()=>fixture(async({root,fetcher})=>{let calls=0;await assert.rejects(verifyPublishedRuntime(root,{fetcher:async url=>{if(!url.endsWith('shape.geojson'))return fetcher(url);return ++calls===1?new Response('busy',{status:503}):new Response('stale geometry');}}),e=>{assert.match(e.message,/bytes differ.*shape.geojson/);const record=e.inventory.records.find(r=>r.file==='public/geo/shape.geojson');assert.deepEqual(record.httpHistory,[503,200]);assert.equal(record.httpAttempts,2);assert.equal(record.status,'FAIL');return true;});assert.equal(calls,2);}));

async function addVirtualModel(root){
 const files={'atlas-nistrenia-administrative.mjs':'export const virtual=true;','views/nistrenia/administration.json':'{"schema":"fixture-model"}','views/nistrenia/manifest.json':'{"schema":"fixture-manifest"}'};
 for(const [name,body] of Object.entries(files)){await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),body);}
 execFileSync('git',['add','--',...Object.keys(files)],{cwd:root});
}
test('NI virtual model and manifest are both hashed as deployed runtime assets',()=>fixture(async({root,fetcher})=>{
 await addVirtualModel(root);const files=publishedRuntimeFiles(root);
 assert.equal(files.length,13);for(const name of ['views/nistrenia/administration.json','views/nistrenia/manifest.json'])assert.ok(files.includes(name));
 const report=await verifyPublishedRuntime(root,{fetcher});assert.equal(report.status,'PASS');assert.equal(report.checkedFiles,13);
 assert.ok(report.records.filter(r=>r.file.startsWith('views/nistrenia/')).every(r=>r.sha256===r.expectedSha256));
}));
test('NI module cannot silently omit its tracked model or manifest',()=>fixture(async({root})=>{
 await addVirtualModel(root);execFileSync('git',['rm','--cached','--','views/nistrenia/manifest.json'],{cwd:root});
 assert.throws(()=>publishedRuntimeFiles(root),/must both be tracked/);
}));
for(const file of ['views/nistrenia/administration.json','views/nistrenia/manifest.json']){
 test('HTTP200 stale NI asset fails exact bytes: '+file,()=>fixture(async({root,fetcher})=>{
  await addVirtualModel(root);await assert.rejects(verifyPublishedRuntime(root,{fetcher:async url=>url.endsWith(file)?new Response('stale virtual asset'):fetcher(url)}),e=>{
   assert.match(e.message,/Published runtime bytes differ/);assert.ok(e.inventory.records.some(r=>r.file===file&&r.status==='FAIL'&&r.sha256!==r.expectedSha256));return true;
  });
 }));
 test('missing NI asset fails rather than narrowing inventory: '+file,()=>fixture(async({root,fetcher})=>{
  await addVirtualModel(root);await assert.rejects(verifyPublishedRuntime(root,{fetcher:async url=>url.endsWith(file)?new Response('not found',{status:404}):fetcher(url)}),e=>{
   assert.ok(e.inventory.records.some(r=>r.file===file&&r.httpStatus===404&&r.status==='FAIL'));return true;
  });
 }));
}
