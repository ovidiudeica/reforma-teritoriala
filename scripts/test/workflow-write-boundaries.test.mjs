import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

const workflowsDir='.github/workflows';
const allowedPushWorkflows=new Set([
 'actual-candidate.yml',
 'actual-promote-candidate.yml'
]);

test('only candidate and promotion workflows may execute git push',async()=>{
 const files=(await readdir(workflowsDir)).filter(name=>/\.ya?ml$/i.test(name)).sort();
 const offenders=[];
 for(const name of files){
  const content=await readFile(join(workflowsDir,name),'utf8');
  if(/\bgit\s+push\b/.test(content)&&!allowedPushWorkflows.has(name))offenders.push(name);
 }
 assert.deepEqual(offenders,[]);
});

test('ACTUAL topology audit is strictly read-only',async()=>{
 const content=await readFile(join(workflowsDir,'actual-topology-audit.yml'),'utf8');
 assert.match(content,/permissions:\s*\n\s*contents:\s*read/);
 assert.doesNotMatch(content,/\bcontents:\s*write\b/);
 assert.doesNotMatch(content,/\bgit\s+push\b/);
 assert.doesNotMatch(content,/\bgit\s+commit\b/);
 assert.doesNotMatch(content,/Persist validated release snapshot/);
 assert.doesNotMatch(content,/npm run import:osm/);
 assert.doesNotMatch(content,/audit:ro-official-reconciliation/);
 assert.doesNotMatch(content,/reconcile:cuatm/);
 assert.doesNotMatch(content,/build:actual-release-manifest/);
 assert.match(content,/ACTUAL_RELEASE_GATE_READ_ONLY:\s*'1'/);
 assert.match(content,/npm run audit:actual-topology/);
 assert.match(content,/Prove topology audit is repository read-only/);
});

test('all workflow-level git pushes are isolated-branch lifecycle writes',async()=>{
 for(const name of allowedPushWorkflows){
  const content=await readFile(join(workflowsDir,name),'utf8');
  assert.match(content,/\bgit\s+push\b/);
  assert.doesNotMatch(content,/git\s+push\s+origin\s+(?:HEAD:)?main\b/);
 }
});
