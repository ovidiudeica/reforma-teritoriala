import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

const workflowsDir='.github/workflows';
const allowedPushWorkflows=new Set([
 'actual-candidate.yml',
 'actual-promote-candidate.yml',
 'refresh-actual-review-evidence.yml',
 'bootstrap-hermetic-candidate.yml'
]);

test('only isolated ACTUAL lifecycle workflows may execute git push',async()=>{
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
 assert.doesNotMatch(content,/npm run build:osm-actual/);
 assert.doesNotMatch(content,/audit:ro-official-reconciliation/);
 assert.doesNotMatch(content,/reconcile:cuatm/);
 assert.doesNotMatch(content,/build:actual-release-manifest/);
 assert.match(content,/ACTUAL_RELEASE_GATE_READ_ONLY:\s*'1'/);
 assert.match(content,/npm run audit:actual-topology/);
 assert.match(content,/Prove topology audit is repository read-only/);
});

test('all workflow-level git pushes are isolated-branch lifecycle writes',async()=>{
 const files=(await readdir(workflowsDir)).filter(name=>/\.ya?ml$/i.test(name)).sort();
 for(const name of files){
  if(!allowedPushWorkflows.has(name))continue;
  const content=await readFile(join(workflowsDir,name),'utf8');
  if(!/\bgit\s+push\b/.test(content))continue;
  assert.doesNotMatch(content,/git\s+push\s+origin\s+(?:HEAD:)?main\b/);
 }
});

test('write-capable workflows are manual or reusable only and cannot use alternate GitHub API writes',async()=>{
 const allowedContentsWrite=new Set([
  'actual-candidate.yml',
  'actual-promote-candidate.yml',
  'import-osm.yml',
  'refresh-actual-review-evidence.yml',
  'refresh-md-official.yml',
  'refresh-ro-official.yml'
 ]);
 const allowedUses=new Set([
  'actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09',
  'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  './.github/workflows/actual-candidate.yml'
 ]);
 const allowedScheduledWrite=new Set([
  'refresh-md-official.yml',
  'refresh-ro-official.yml'
 ]);
 const files=(await readdir(workflowsDir)).filter(name=>/\.ya?ml$/i.test(name)).sort();
 for(const name of files){
  const content=await readFile(join(workflowsDir,name),'utf8');
  const contentsWrite=/^\s*contents:\s*write\s*$/m.test(content);
  assert.equal(contentsWrite,allowedContentsWrite.has(name),name+' contents:write boundary drift');
  if(!contentsWrite)continue;
  assert.doesNotMatch(content,/^\s{2}(?:push|pull_request):/m,name+' must not receive repository-event write triggers');
  const hasSchedule=/^\s{2}schedule:/m.test(content);
  assert.equal(hasSchedule,allowedScheduledWrite.has(name),name+' scheduled-write boundary drift');
  assert.doesNotMatch(content,/\bgh\s+api\b[^\n]*(?:--method|-X)\s+(?:POST|PUT|PATCH|DELETE)\b/i,name+' must not write through gh api');
  assert.doesNotMatch(content,/\bcurl\b[^\n]*(?:-X|--request)\s+(?:POST|PUT|PATCH|DELETE)\b[^\n]*api\.github\.com/i,name+' must not write through GitHub REST curl');
  assert.doesNotMatch(content,/actions\/github-script@/i,name+' must not gain generic GitHub API scripting');
  const uses=[...content.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)].map(match=>match[1]);
  assert.deepEqual(uses.filter(value=>!allowedUses.has(value)),[],name+' uses an unapproved action while holding contents:write');
 }
});

test('promotion trust-chain gate separates candidate and promotion commit write boundaries',async()=>{
 const content=await readFile(join(workflowsDir,'actual-release-trust-chain-gate.yml'),'utf8');
 assert.match(content,/candidateCommit=execFileSync\('git',\['rev-parse',head\+'\^'\]/);
 assert.match(content,/candidate_commit_write_boundary_violation/);
 assert.match(content,/promotion_commit_write_boundary_violation/);
 assert.match(content,/actual-release-persisted\.json/);
 assert.match(content,/actual-candidate-promotion-audit\.json/);
 assert.match(content,/count===2/);
});

test('review-evidence refresh stages an exact artifact allowlist',async()=>{
 const content=await readFile(join(workflowsDir,'refresh-actual-review-evidence.yml'),'utf8');
 assert.match(content,/ALLOWED=\(/);
 assert.match(content,/review-evidence-changed\.txt/);
 assert.match(content,/comm -23/);
 assert.match(content,/git add -- "\$\{ALLOWED\[@\]\}"/);
 assert.doesNotMatch(content,/git add data\/current\//);
});


test('candidate branch creation is confined to the isolated namespace',async()=>{
 const content=await readFile(join(workflowsDir,'actual-candidate.yml'),'utf8');
 assert.match(content,/Candidate branch must stay inside the isolated actual\/candidate-\* namespace/);
 assert.match(content,/\^actual\/candidate-\[A-Za-z0-9\._-\]\+\$/);
});

test('promotion preflights untrusted candidate data before executing candidate code',async()=>{
 const content=await readFile(join(workflowsDir,'actual-promote-candidate.yml'),'utf8');
 const namespaceStep=content.indexOf('Validate candidate branch namespace before checkout');
 const trustedCheckout=content.indexOf('Check out trusted main for candidate preflight');
 const preflightStep=content.indexOf('Preflight candidate ref without executing candidate code');
 const candidateCheckout=content.indexOf('Check out exact preflighted candidate commit');
 assert.ok(namespaceStep>=0);
 assert.ok(trustedCheckout>namespaceStep);
 assert.ok(preflightStep>trustedCheckout);
 assert.ok(candidateCheckout>preflightStep);
 assert.match(content,/CANDIDATE_PARENT_SHA/);
 assert.match(content,/rev-list --count/);
 assert.match(content,/candidate-preflight-paths\.txt/);
 assert.match(content,/Candidate preflight write-boundary violation/);
 assert.match(content,/candidate-preflight-marker\.json/);
 assert.match(content,/genuine CHANGE candidate/);
 assert.doesNotMatch(content,/ref:\s*\$\{\{ inputs\.candidate_branch \}\}/);
});
