import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

const workflowsDir='.github/workflows';
const contentsWrite=new Set([
 'actual-candidate.yml',
 'actual-promote-candidate.yml',
 'import-osm.yml',
 'refresh-actual-review-evidence.yml',
 'refresh-md-official.yml',
 'refresh-ro-official.yml'
]);
const pullRequestWrite=new Set([
 'actual-promote-candidate.yml',
 'refresh-actual-review-evidence.yml'
]);
const packagesWrite=new Set(['build-actual-runtime-image.yml']);
const gitPushWorkflows=new Set([
 'actual-candidate.yml',
 'actual-promote-candidate.yml',
 'refresh-actual-review-evidence.yml'
]);
const prCreateWorkflows=new Set([
 'actual-promote-candidate.yml',
 'refresh-actual-review-evidence.yml'
]);
const sourceWrappers=new Set([
 'import-osm.yml',
 'refresh-md-official.yml',
 'refresh-ro-official.yml'
]);

const workflowFiles=async()=>(
 await readdir(workflowsDir)
).filter(name=>/\.ya?ml$/i.test(name)).sort();

function extractRunBlocks(content){
 const lines=content.split('\n');
 const blocks=[];
 for(let i=0;i<lines.length;i++){
  const m=lines[i].match(/^(\s*)run:\s*\|\s*$/);
  if(!m)continue;
  const indent=m[1].length;
  const out=[];
  for(let j=i+1;j<lines.length;j++){
   const line=lines[j];
   if(line.trim()&&line.match(/^\s*/)[0].length<=indent)break;
   out.push(line);
  }
  blocks.push(out.join('\n'));
 }
 return blocks;
}

test('workflow write permissions are closed to the exact ACTUAL write surfaces',async()=>{
 const actual={contents:new Set(),pullRequests:new Set(),packages:new Set()};
 for(const name of await workflowFiles()){
  const content=await readFile(join(workflowsDir,name),'utf8');
  if(/\bcontents:\s*write\b/.test(content))actual.contents.add(name);
  if(/\bpull-requests:\s*write\b/.test(content))actual.pullRequests.add(name);
  if(/\bpackages:\s*write\b/.test(content))actual.packages.add(name);
 }
 assert.deepEqual([...actual.contents].sort(),[...contentsWrite].sort());
 assert.deepEqual([...actual.pullRequests].sort(),[...pullRequestWrite].sort());
 assert.deepEqual([...actual.packages].sort(),[...packagesWrite].sort());
});

test('only isolated ACTUAL lifecycle workflows may execute git push or create PRs',async()=>{
 for(const name of await workflowFiles()){
  const content=await readFile(join(workflowsDir,name),'utf8');
  assert.equal(/\bgit\s+push\b/.test(content),gitPushWorkflows.has(name),name+' git push boundary mismatch');
  assert.equal(/\bgh\s+pr\s+create\b/.test(content),prCreateWorkflows.has(name),name+' PR-create boundary mismatch');
  assert.doesNotMatch(content,/git\s+push\s+origin\s+(?:"|')?(?:HEAD:)?(?:refs\/heads\/)?main\b/);
 }
});

test('source refresh wrappers can only delegate to the reusable candidate lifecycle',async()=>{
 for(const name of sourceWrappers){
  const content=await readFile(join(workflowsDir,name),'utf8');
  assert.match(content,/uses:\s*\.\/\.github\/workflows\/actual-candidate\.yml/);
  assert.doesNotMatch(content,/\bsteps:\s*$/m);
  assert.doesNotMatch(content,/\brun:\s*\|/);
  assert.doesNotMatch(content,/\bgit\s+(?:push|commit)\b/);
  assert.doesNotMatch(content,/\bgh\s+pr\s+create\b/);
  assert.match(content,/base_release_commit:\s*\$\{\{ github\.sha \}\}/);
 }
});

test('workflow-dispatch string inputs are never interpolated directly into shell run blocks',async()=>{
 for(const name of await workflowFiles()){
  const content=await readFile(join(workflowsDir,name),'utf8');
  for(const block of extractRunBlocks(content)){
   assert.doesNotMatch(block,/\$\{\{\s*inputs\./,name+' directly interpolates an input into shell');
  }
 }
});

test('candidate and promotion pushes use canonical isolated refs and validate branch names',async()=>{
 const candidate=await readFile(join(workflowsDir,'actual-candidate.yml'),'utf8');
 const promotion=await readFile(join(workflowsDir,'actual-promote-candidate.yml'),'utf8');
 for(const content of [candidate,promotion]){
  assert.match(content,/\^actual\/candidate-\[a-z0-9\]/);
  assert.match(content,/git push origin "HEAD:refs\/heads\/\$CANDIDATE_BRANCH"/);
 }
 assert.match(candidate,/git rev-list --count/);
 assert.match(candidate,/Candidate commit crossed the ACTUAL write boundary/);
 assert.match(promotion,/Candidate branch must contain exactly one candidate commit/);
 assert.match(promotion,/Promotion commit crossed its two-file write boundary/);
 assert.match(promotion,/ACTUAL_CANDIDATE_COMMIT_SHA/);
 assert.match(promotion,/ACTUAL_CANDIDATE_TREE_SHA/);
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
