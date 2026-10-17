// P9.0.8 — offline proof-retention gate. Never touches legacy PRs/ACTUAL; never authorizes P9.1.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
const m=read('docs/p9.0.8-retention-manifest.json');
const policy=read('docs/p9.0.4.3-promotion-policy.json');
const release=read('data/current/actual-release-manifest.json');
const carto=read('docs/p9.0.7.2.19-acceptance-manifest.json');
const safeSHA=/^[0-9a-f]{40}$/;
const arrays=Array.from({length:4},(_,i)=>read('docs/p9.0.8-pr-archive-0'+(i+1)+'.json'));
const sources=arrays.flatMap(x=>x.records);
function expectedPolicy(a,p){
 assert.equal(a.schema_version,'p908-evidence-preservation-and-cleanup-v1');
 assert.equal(a.repository,'ovidiudeica/reforma-teritoriala');
 assert.equal(a.source_main_sha,'651921e32aac53dfbc441335860ccc245bec90c8');
 assert.equal(a.conserved_before_cleanup,true);
 assert.equal(a.scope,'37_OPEN_DRAFT_P9_PRs_ONLY');
 assert.equal(a.p91_import_allowed,false);
 assert.equal(a.actual_mutation_allowed,false);
 assert.equal(a.merge_of_any_legacy_p9_pr_permitted,false);
 assert.equal(a.import_of_legal_normative_stack_to_main_permitted,false);
 assert.equal(a.source_branch_deletion_permitted,false);
 assert.equal(a.archive_ref_deletion_permitted,false);
 assert.equal(a.legal_provenance_status,'BLOCKED_INCOMPLETE');
 assert.equal(a.de_facto_full_polygon_certifications,0);
 assert.equal(p.semantic_acceptance,'BLOCKED_INCOMPLETE');
 assert.equal(p.p91_import_allowed,false);
 assert.equal(p.fully_certified_contemporary_memberships,0);
 assert.equal(carto.juridical.status,'BLOCKED_INCOMPLETE');
 assert.equal(carto.juridical.p91_import_allowed,false);
 assert.equal(carto.juridical.actual_mutation_allowed,false);
}
function verifySnapshots(a,arr){
 assert.equal(a.parts.length,4);
 assert.equal(arr.length,4);
 const seen=new Map();
 for(let i=0;i<4;i++){
  assert.equal(a.parts[i].path,'docs/p9.0.8-pr-archive-0'+(i+1)+'.json');
  assert.match(a.parts[i].blob_sha,safeSHA);
  assert.equal(arr[i].schema,'p908-pr-record-snapshot-v1');
  assert.equal(arr[i].batch,'0'+(i+1));
  assert.equal(arr[i].records.length,a.parts[i].pr_count);
  for(const r of arr[i].records){
   assert.equal(r.state,'open','source metadata must be pre-cleanup');
   assert.equal(r.draft,true);
   assert.equal(r.listing_complete,true,'source changed-file list incomplete');
   assert.match(r.head_sha,safeSHA);
   assert.match(r.base_sha,safeSHA);
   assert(r.head_ref.startsWith('audit/'),'unexpected legacy source branch');
   assert.equal(r.url,'https://github.com/ovidiudeica/reforma-teritoriala/pull/'+r.number);
   assert(r.title.includes('P9')||r.title.includes('Nistrenia'));
   assert(r.body.length>0,'original PR description not preserved');
   assert(r.filenames.length>0);
   assert.equal(new Set(r.filenames).size,r.filenames.length);
   assert(!seen.has(r.number),'duplicate PR');
   seen.set(r.number,r);
  }
 }
 assert.equal(seen.size,37);
 return seen;
}
function verifyRetention(a,s){
 assert.equal(a.counts.original_open_total,40);
 assert.equal(a.counts.p9_open_in_scope,37);
 assert.equal(a.counts.dependabot_untouched,3);
 assert.equal(a.counts.distinct_p9_snapshot_heads,22);
 assert.equal(a.counts.primary_evidence_prs,22);
 assert.equal(a.counts.primary_normative_chain_prs,20);
 assert.equal(a.counts.independent_semantic_prs,2);
 assert.equal(a.counts.ci_only_duplicates_for_cleanup,15);
 const primary=[...s.values()].filter(r=>!r.title.startsWith('CI-only')).sort((x,y)=>x.number-y.number);
 const ci=[...s.values()].filter(r=>r.title.startsWith('CI-only')).sort((x,y)=>x.number-y.number);
 assert.equal(primary.length,22);
 assert.equal(ci.length,15);
 assert.deepEqual(primary.map(r=>r.number),a.retained_primary_pr_numbers);
 assert.deepEqual(ci.map(r=>r.number),a.cleanup_only_ci_pr_numbers);
 assert.equal(new Set([...s.values()].map(r=>r.head_sha)).size,22);
 const pairs=[];
 for(const c of ci){
  assert.equal(c.number%2,0);
  assert(c.title.includes('DO NOT MERGE')||c.title.includes('NO MERGE'));
  const p=primary.find(x=>x.head_sha===c.head_sha);
  assert(p,'CI-only source head not matched to primary: '+c.number);
  assert.equal(p.number,c.number-1,'CI-only must be paired with its primary PR');
  assert.notEqual(c.base_sha,p.base_sha,'CI and primary boundaries must be distinct');
  pairs.push({ci_pr:c.number,primary_pr:p.number,exact_head_sha:c.head_sha,retain_source_ref:p.head_ref});
 }
 const chain=primary.filter(r=>r.number>=320).sort((x,y)=>x.number-y.number);
 assert.equal(chain.length,20);
 for(let i=1;i<chain.length;i++)assert.equal(chain[i].base_sha,chain[i-1].head_sha,'evidence chain ancestry linkage broken at '+chain[i].number);
 assert.equal(chain[0].number,320);
 assert.equal(chain.at(-1).number,353);
 assert.equal(chain.at(-1).head_sha,'f8a219807074308d35886e8ef98cd825ae2c498e');
 for(const [pr,head] of [[318,'d9126ed867e0608bb072be913042acd046a59999'],[310,'10cf4cee0b5050e042d22aa5a9ef19d103febc22']]){
  assert.equal(s.get(pr).head_sha,head);
 }
 assert.equal(a.archived_refs.length,3);
 const refs=[
 ['archive/p9.0.8-20261017-normative-320-353',chain.at(-1).head_sha],
 ['archive/p9.0.8-20261017-semantic-318',s.get(318).head_sha],
 ['archive/p9.0.8-20261017-semantic-310',s.get(310).head_sha]
 ];
 for(let i=0;i<3;i++){
  assert.equal(a.archived_refs[i].branch,refs[i][0]);
  assert.equal(a.archived_refs[i].git_sha,refs[i][1]);
  assert.equal(a.archived_refs[i].genealogy_compare_verified,true);
 }
 assert.equal(a.post_cleanup.preserved_primaries,22);
 assert.equal(a.post_cleanup.unresolved_sources_remain_open,true);
 assert(['PENDING_GATE','VERIFIED_CI_DUPLICATES_CLOSED'].includes(a.post_cleanup.status));
 if(a.post_cleanup.status==='PENDING_GATE')assert.equal(a.post_cleanup.closed_prs.length,0);
 else assert.deepEqual(a.post_cleanup.closed_prs,a.cleanup_only_ci_pr_numbers);
 return {primary,ci,chain,pairs};
}
expectedPolicy(m,policy);
assert.equal(release.snapshot_id,'actual-a9e5a4ddcb5277ef');
assert.equal(release.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
assert.equal(carto.cartographic.relation_roles,85);
assert.equal(carto.cartographic.status,'CLOSED_EVIDENCE_BOUND');
const refs=verifySnapshots(m,arrays);
const result=verifyRetention(m,refs);
if(process.argv.includes('--self-test')){
 assert.throws(()=>expectedPolicy({...m,p91_import_allowed:true},policy),/true !== false/);
 assert.throws(()=>expectedPolicy(m,{...policy,semantic_acceptance:'ACCEPTED'}),/ACCEPTED/);
 const damaged=new Map(refs);damaged.set(354,{...damaged.get(354),head_sha:'0'.repeat(40)});
 assert.throws(()=>verifyRetention(m,damaged),/Expected values to be strictly equal|CI-only source head not matched/);
 const missing=new Map(refs);missing.delete(320);
 assert.throws(()=>verifyRetention(m,missing),/22/);
 console.log('P908_FAIL_CLOSED_SELF_TEST_PASS');process.exit(0);
}
if(!process.argv.includes('--audit'))throw Error('Use --self-test or --audit');
const out={schema:'p908-pr-evidence-preservation-verdict-v1',source_main:m.source_main_sha,read_only:true,
  original_legacy_pr_count:refs.size,primary_evidence_prs:result.primary.length,ci_only_exact_head_duplicates:result.pairs.length,
  exact_git_snapshot_heads:new Set([...refs.values()].map(r=>r.head_sha)).size,
  archival_ref_count:m.archived_refs.length,
  provenance_reread_of_binary_sources:false,original_source_blobs_retained_by_git_refs:true,
  normative_primaries_still_unmerged:true,actual_release_mutated:false,
  p91_import_allowed:false,legal_semantics:'BLOCKED_INCOMPLETE',
  stage:m.post_cleanup.status,closed_ci_only_prs:m.post_cleanup.closed_prs,
  ci_duplicate_matches:result.pairs,
  primary_retained:result.primary.map(x=>({pr:x.number,sha:x.head_sha,ref:x.head_ref,changed_files:x.filenames.length})),
  verdict:'EVIDENCE_RETAINED_LEGAL_BLOCKED'};
mkdirSync(resolve('outputs/P9.0.8'),{recursive:true});
writeFileSync(resolve('outputs/P9.0.8/evidence-verdict.json'),JSON.stringify(out,null,2)+'\n');
console.log('P908_SUMMARY '+JSON.stringify({verdict:out.verdict,legacy_prs:out.original_legacy_pr_count,primaries:out.primary_evidence_prs,ci_duplicates:out.ci_only_exact_head_duplicates,archive_refs:out.archival_ref_count,stage:out.stage}));
