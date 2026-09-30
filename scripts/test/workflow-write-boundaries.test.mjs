import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

const workflowsDir='.github/workflows';
const allowedPushWorkflows=new Set([
 'actual-candidate.yml',
 'actual-promote-candidate.yml',
 'refresh-actual-review-evidence.yml'
]);

test('only isolated ACTUAL lifecycle workflows may execute git push',async()=>{
 const files=(await readdir(workflowsDir)).filter(name=>/\.ya?ml$/i.test(name)).sort();
 const offenders=[];
 for(const name of files){
  const content=await readFile(join(workflowsDir,name),'utf8');
  if(/\bgit(?:\s+-c\s+"[^"]*")?\s+push\b/.test(content)&&!allowedPushWorkflows.has(name))offenders.push(name);
 }
 assert.deepEqual(offenders,[]);
});

test('ACTUAL topology audit is strictly read-only',async()=>{
 const content=await readFile(join(workflowsDir,'actual-topology-audit.yml'),'utf8');
 assert.match(content,/permissions:\s*\n\s*contents:\s*read/);
 assert.doesNotMatch(content,/\bcontents:\s*write\b/);
 assert.doesNotMatch(content,/\bgit(?:\s+-c\s+"[^"]*")?\s+push\b/);
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
  if(!/\bgit(?:\s+-c\s+"[^"]*")?\s+push\b/.test(content))continue;
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


test('workflow write permissions match the exact audited matrix',async()=>{
 const expected=new Map([
  ['actual-candidate.yml',['contents']],
  ['actual-promote-candidate.yml',['contents','pull-requests']],
  ['build-actual-runtime-image.yml',['packages']],
  ['import-osm.yml',['contents']],
  ['refresh-actual-review-evidence.yml',['contents','pull-requests']],
  ['refresh-md-official.yml',['contents']],
  ['refresh-ro-official.yml',['contents']]
 ]);
 const files=(await readdir(workflowsDir)).filter(name=>/\.ya?ml$/i.test(name)).sort();
 for(const name of files){
  const content=await readFile(join(workflowsDir,name),'utf8');
  const actual=[...content.matchAll(/^\s+([a-z][a-z-]*):\s*write\s*$/gm)].map(match=>match[1]).sort();
  assert.deepEqual(actual,[...(expected.get(name)??[])].sort(),name+' write permission matrix drift');
 }
});

test('repository and package write jobs never persist checkout credentials',async()=>{
 const repositoryPushWorkflows=[
  'actual-candidate.yml',
  'actual-promote-candidate.yml',
  'refresh-actual-review-evidence.yml'
 ];
 for(const name of repositoryPushWorkflows){
  const content=await readFile(join(workflowsDir,name),'utf8');
  assert.match(content,/persist-credentials:\s*false/,name+' must not persist checkout credentials');
  assert.match(content,/GITHUB_TOKEN:\s*\$\{\{ github\.token \}\}/,name+' must scope the repository token to the exact write step');
  assert.match(content,/http\.https:\/\/github\.com\/\.extraheader=AUTHORIZATION: basic \$AUTH_HEADER/,name+' must authenticate only the exact git push command');
 }
 const candidate=await readFile(join(workflowsDir,'actual-candidate.yml'),'utf8');
 const promotion=await readFile(join(workflowsDir,'actual-promote-candidate.yml'),'utf8');
 const review=await readFile(join(workflowsDir,'refresh-actual-review-evidence.yml'),'utf8');
 assert.match(candidate,/docker logout ghcr\.io/,'candidate must discard the contents:write GHCR credential before later repository execution');
 assert.match(candidate,/--force-with-lease="refs\/heads\/\$CANDIDATE_BRANCH:"/);
 assert.match(promotion,/--force-with-lease="refs\/heads\/\$CANDIDATE_BRANCH:\$EXPECTED_CANDIDATE_COMMIT"/);
 assert.match(review,/--force-with-lease="refs\/heads\/\$BRANCH:"/);

 const runtime=await readFile(join(workflowsDir,'build-actual-runtime-image.yml'),'utf8');
 assert.match(runtime,/permissions:\s*\n\s*contents:\s*read\s*\n\s*packages:\s*write/);
 assert.match(runtime,/persist-credentials:\s*false/,'GHCR publisher must not persist a packages:write token through checkout');
 assert.doesNotMatch(runtime,/\bcontents:\s*write\b/);
 assert.doesNotMatch(runtime,/\bgit(?:\s+-c\s+"[^"]*")?\s+push\b/);
 assert.match(runtime,/branches:\s*\n\s*- 'actual\/pin-oci-runtime'/);
});

test('candidate and promotion writes are pinned to isolated branch plus exact candidate commit',async()=>{
 const [candidate,promotion]=await Promise.all([
  readFile(join(workflowsDir,'actual-candidate.yml'),'utf8'),
  readFile(join(workflowsDir,'actual-promote-candidate.yml'),'utf8')
 ]);
 assert.match(candidate,/\^actual\/candidate-\[A-Za-z0-9\]/);
 assert.match(candidate,/HEAD:refs\/heads\/\$CANDIDATE_BRANCH/);
 assert.match(candidate,/Candidate commit SHA:/);
 assert.match(promotion,/expected_candidate_commit:/);
 assert.match(promotion,/ref: \$\{\{ inputs\.expected_candidate_commit \}\}/);
 assert.match(promotion,/REMOTE_CANDIDATE_COMMIT=/);
 assert.match(promotion,/ACTUAL_CANDIDATE_COMMIT_SHA: \$\{\{ inputs\.expected_candidate_commit \}\}/);
 assert.match(promotion,/--force-with-lease="refs\/heads\/\$CANDIDATE_BRANCH:\$EXPECTED_CANDIDATE_COMMIT"/);
 assert.match(promotion,/HEAD:refs\/heads\/\$CANDIDATE_BRANCH/);
});

test('promotion trust-chain gate separates candidate and promotion commit write boundaries',async()=>{
 const [workflow,audit]=await Promise.all([
  readFile(join(workflowsDir,'actual-release-trust-chain-gate.yml'),'utf8'),
  readFile('scripts/process/audit-actual-publication-path.mjs','utf8')
 ]);
 assert.match(workflow,/node scripts\/process\/audit-actual-publication-path\.mjs/);
 assert.match(audit,/candidateCommit=git\('rev-parse',head\+'\^'\)/);
 assert.match(audit,/candidate_commit_write_boundary_violation/);
 assert.match(audit,/promotion_commit_write_boundary_violation/);
 assert.match(audit,/actual-release-persisted\.json/);
 assert.match(audit,/actual-candidate-promotion-audit\.json/);
 assert.match(audit,/count===2/);
 assert.match(audit,/promotion_audit_candidate_commit_mismatch/);
 assert.match(audit,/persisted_candidate_commit_mismatch/);
});

test('trust-chain gate permits only exact provenance migration publication files',async()=>{
 const audit=await readFile('scripts/process/audit-actual-publication-path.mjs','utf8');
 assert.match(audit,/actual\\\/provenance-/);
 for(const path of [
  'data/current/actual-host-trust-manifest.json',
  'data/current/actual-oci-builder.json',
  'data/current/actual-oci-builder-gate.json',
  'data/current/actual-runtime-image.json',
  'data/current/actual-build-environment-manifest.json',
  'data/current/actual-build-environment-gate.json',
  'data/current/actual-release-manifest.json',
  'data/current/actual-release-gate.json',
  'data/current/actual-release-persisted.json'
 ])assert.ok(audit.includes(path),path+' missing from provenance allowlist');
 assert.match(audit,/provenance_migration_changed_forbidden_publication_paths/);
 assert.match(audit,/provenance_migration_changed_snapshot_identity/);
 assert.match(audit,/provenance_migration_changed_release_fingerprint/);
 assert.match(audit,/provenance_migration_previous_manifest_binding_missing/);
 assert.match(audit,/provenance_migration_oci_toolchain_changed/);
 assert.match(audit,/provenance_migration_runtime_identity_changed/);
 assert.match(audit,/provenance_migration_oci_builder_gate_manifest_mismatch/);
 assert.match(audit,/provenance_migration_build_environment_runtime_hash_mismatch/);
 assert.match(audit,/provenance_migration_release_gate_not_pass/);
});

test('review-evidence refresh stages an exact artifact allowlist',async()=>{
 const content=await readFile(join(workflowsDir,'refresh-actual-review-evidence.yml'),'utf8');
 assert.match(content,/ALLOWED=\(/);
 assert.match(content,/review-evidence-changed\.txt/);
 assert.match(content,/comm -23/);
 assert.match(content,/git add -- "\$\{ALLOWED\[@\]\}"/);
 assert.doesNotMatch(content,/git add data\/current\//);
});


test('promotion validates candidate parent and write surface before repository code executes',async()=>{
 const promotion=await readFile(join(workflowsDir,'actual-promote-candidate.yml'),'utf8');
 const preflight=promotion.indexOf('Preflight candidate commit before repository code execution');
 const firstRepoCode=promotion.indexOf('npm run ');
 assert.ok(preflight>=0);
 assert.ok(firstRepoCode>preflight);
 assert.match(promotion,/CANDIDATE_PARENT_SHA/);
 assert.match(promotion,/rev-list --count/);
 assert.match(promotion,/candidate-preexecution-paths\.txt/);
 assert.match(promotion,/Candidate pre-execution write-boundary violation/);
 assert.match(promotion,/Candidate pre-execution marker is not a genuine CHANGE candidate/);
 assert.match(promotion,/marker\.get\('base_ref'\) != base/);
});

test('each authenticated push receives its token in that exact step',async()=>{
 for(const name of ['actual-candidate.yml','actual-promote-candidate.yml','refresh-actual-review-evidence.yml']){
  const workflow=await readFile(join(workflowsDir,name),'utf8');
  const steps=workflow.split(/(?=^      - name:)/m);
  for(const step of steps){
   if(!step.includes('AUTH_HEADER='))continue;
   const [configuration]=step.split('        run:');
   assert.match(configuration,/GITHUB_TOKEN:.*github\.token/,name+' push token must belong to its own step');
  }
 }
});

test('string dispatch inputs never become shell source',async()=>{
 for(const name of ['actual-candidate.yml','actual-promote-candidate.yml']){
  const workflow=await readFile(join(workflowsDir,name),'utf8');
  for(const step of workflow.split(/(?=^      - name:)/m)){
   const script=step.split('        run:')[1]??'';
   assert.doesNotMatch(script,/\$\{\{ inputs\.(?:candidate_branch|source_trigger|expected_candidate_snapshot|expected_candidate_commit|confirmation|base_release_commit)\b/,name+' string input must pass through env');
  }
 }
});

test('candidate preflight rejects merge parents and non-regular tree objects',async()=>{
 const workflow=await readFile(join(workflowsDir,'actual-promote-candidate.yml'),'utf8');
 const preflight=workflow.split('Preflight candidate commit before repository code execution')[1].split('      - name:')[0];
 assert.match(preflight,/git show -s --format=%P/);
 assert.match(preflight,/git diff --no-renames --name-only -z/);
 assert.match(preflight,/git','ls-tree','-rz'/);
 assert.match(preflight,/modes\[p\] != b'100644'/);
 const candidate=await readFile(join(workflowsDir,'actual-candidate.yml'),'utf8');
 const bind=candidate.split('Bind immutable candidate base')[1].split('      - name:')[0];
 assert.match(bind,/git fetch origin main/);
 assert.match(bind,/test "\$BASE_RELEASE_COMMIT" = "\$\(git rev-parse refs\/remotes\/origin\/main\)"/);
});


import './actual-preexecution-objects.test.mjs';

test('PR credentials belong to a separate runner job with no repository checkout',async()=>{
 for(const [name,job] of [['actual-promote-candidate.yml','open-promotion-pr'],['refresh-actual-review-evidence.yml','open-review-pr']]){
  const workflow=await readFile(join(workflowsDir,name),'utf8');
  const [preparation,opener]=workflow.split('  '+job+':');
  assert.ok(opener);
  assert.doesNotMatch(preparation,/pull-requests: write/);
  assert.doesNotMatch(opener,/uses:|npm run |node scripts\//);
  assert.match(opener,/contents: read/);
  assert.match(opener,/pull-requests: write/);
  assert.match(opener,/runs-on: ubuntu-24\.04/);
  assert.match(opener,/gh api/);
  assert.match(opener,/gh pr create/);
 }
});

test('container writers select bash and callers preserve runtime pull permission',async()=>{
 for(const name of ['actual-promote-candidate.yml','refresh-actual-review-evidence.yml']){
  const text=await readFile(join(workflowsDir,name),'utf8');
  assert.match(text,/defaults:\s+run:\s+shell: bash/);
 }
 for(const name of ['import-osm.yml','refresh-ro-official.yml','refresh-md-official.yml']){
  const text=await readFile(join(workflowsDir,name),'utf8');
  assert.match(text,/packages: read/);
 }
});

test('required status contexts have unique workflow owners',async()=>{
 const jobCheckContexts=content=>{
  const lines=content.split('\n');
  const jobs=[];
  let inJobs=false,current=null;
  const finish=()=>{if(current){jobs.push(current);current=null;}};
  for(const line of lines){
   if(!inJobs){
    if(/^jobs:\s*$/.test(line))inJobs=true;
    continue;
   }
   if(/^\S/.test(line)){finish();break;}
   const job=line.match(/^  ([A-Za-z_][A-Za-z0-9_-]*):\s*$/);
   if(job){finish();current={id:job[1],name:null};continue;}
   if(current){
    const explicit=line.match(/^    name:\s*(.*?)\s*$/);
    if(explicit&&current.name===null)current.name=explicit[1].replace(/^['"]|['"]$/g,'');
   }
  }
  finish();
  return jobs.map(job=>job.name||job.id);
 };
 const owners=new Map([
  ['verify-persisted-release','verify-persisted-actual-release.yml'],
  ['actual-change-reproducibility','actual-change-reproducibility-gate.yml'],
  ['actual-release-trust-chain','actual-release-trust-chain-gate.yml']
 ]);
 const files=(await readdir(workflowsDir)).filter(name=>/\.ya?ml$/i.test(name)).sort();
 const texts=new Map(await Promise.all(files.map(async name=>[name,await readFile(join(workflowsDir,name),'utf8')])));
 for(const [context,owner] of owners){
  const occurrences=[];
  for(const [name,content] of texts){
   for(const checkContext of jobCheckContexts(content)){
    if(checkContext===context)occurrences.push(name);
   }
  }
  assert.deepEqual(occurrences,[owner],context+' required status owner drift');
 }
});


import './frontend-smoke.test.mjs';
