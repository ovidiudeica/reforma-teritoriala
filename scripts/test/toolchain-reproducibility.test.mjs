import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

const packageJson=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const EXPECTED_NODE='24.21.0';
const EXPECTED_NPM='11.19.0';

test('Node/npm and direct dependencies are pinned exactly',()=>{
 assert.equal(packageJson.engines?.node,EXPECTED_NODE);
 assert.equal(packageJson.engines?.npm,EXPECTED_NPM);
 assert.equal(packageJson.packageManager,`npm@${EXPECTED_NPM}`);
 assert.equal(process.version,`v${EXPECTED_NODE}`);
 const npmCommand=process.platform==='win32'?'npm.cmd':'npm';
 assert.equal(execFileSync(npmCommand,['--version'],{encoding:'utf8'}).trim(),EXPECTED_NPM);
 for(const spec of Object.values(packageJson.dependencies??{})){
  assert.match(spec,/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/);
 }
});

test('package-lock is v3 and exactly synchronized with package.json',()=>{
 assert.equal(lock.lockfileVersion,3);
 assert.deepEqual(lock.packages?.['']?.dependencies,packageJson.dependencies);
 for(const [name,spec] of Object.entries(packageJson.dependencies??{})){
  assert.equal(lock.packages?.[`node_modules/${name}`]?.version,spec,name);
 }
});

test('all Node workflows pin the exact runtime and never use npm install',async()=>{
 const dir='.github/workflows';
 const files=(await readdir(dir)).filter(name=>/\.ya?ml$/i.test(name)).sort();
 const offenders=[];
 for(const name of files){
  const content=await readFile(join(dir,name),'utf8');
  if(/actions\/setup-node@/.test(content)&&!/node-version:\s*['"]24\.21\.0['"]/.test(content)){
   offenders.push({name,issue:'node_version_not_exact'});
  }
  if(/\bnpm\s+install\b/.test(content)){
   offenders.push({name,issue:'npm_install_forbidden'});
  }
 }
 assert.deepEqual(offenders,[]);
});

test('dependency-consuming ACTUAL workflows install only from the vendored offline bundle',async()=>{
 for(const name of ['actual-candidate.yml','actual-topology-audit.yml']){
  const content=await readFile(join('.github/workflows',name),'utf8');
  assert.match(content,/npm run audit:node-toolchain/);
  assert.match(content,/npm run audit:actual-npm-dependency-bundle/);
  assert.match(content,/npm run install:actual-offline-deps/);
  assert.doesNotMatch(content,/run:\s*npm ci\b/);
 }
 for(const name of ['actual-promote-candidate.yml','verify-persisted-actual-release.yml']){
  const content=await readFile(join('.github/workflows',name),'utf8');
  assert.match(content,/npm run audit:node-toolchain/);
  assert.match(content,/npm run audit:actual-npm-dependency-bundle/);
 }
});
