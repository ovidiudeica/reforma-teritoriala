import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildOfflineLockfile,validateNpmDependencyBundle} from '../lib/actual-npm-dependency-bundle.mjs';

test('committed npm dependency bundle exactly covers package-lock',async()=>{
 const validation=await validateNpmDependencyBundle();
 assert.equal(validation.status,'PASS',JSON.stringify(validation.failures));
 const lock=JSON.parse(await readFile('package-lock.json','utf8'));
 const expected=Object.entries(lock.packages||{}).filter(([path,pkg])=>path&&pkg.resolved).length;
 assert.equal(validation.manifest.package_entry_count,expected);
 assert.equal(validation.manifest.unique_tarball_count,new Set(validation.manifest.packages.map(item=>item.tarball_sha256)).size);
});

test('offline lock rewrites every remote resolution to a vendored file tarball',async()=>{
 const lock=JSON.parse(await readFile('package-lock.json','utf8'));
 const validation=await validateNpmDependencyBundle();
 const offline=buildOfflineLockfile(lock,validation.manifest,'../tarballs');
 for(const [path,pkg] of Object.entries(offline.packages||{})){
  if(!path||!pkg.resolved)continue;
  assert.match(pkg.resolved,/^file:\.\.\/tarballs\/[0-9a-f]{64}\.tgz$/);
 }
});

test('dependency-consuming workflows require the vendored offline installer',async()=>{
 for(const name of ['actual-candidate.yml','actual-topology-audit.yml']){
  const content=await readFile('.github/workflows/'+name,'utf8');
  assert.match(content,/npm run audit:actual-npm-dependency-bundle/);
  assert.match(content,/npm run install:actual-offline-deps/);
  assert.doesNotMatch(content,/run:\s*npm ci --no-audit --no-fund/);
 }
});

test('offline installer denies registry and proxy access and disables lifecycle scripts',async()=>{
 const content=await readFile('scripts/process/install-actual-npm-offline.mjs','utf8');
 assert.match(content,/npm_config_offline:'true'/);
 assert.match(content,/127\.0\.0\.1:9/);
 assert.match(content,/--offline/);
 assert.match(content,/--ignore-scripts/);
 assert.match(content,/HTTP_PROXY:denied/);
 assert.match(content,/HTTPS_PROXY:denied/);
});
