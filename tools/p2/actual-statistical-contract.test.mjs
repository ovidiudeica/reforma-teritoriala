import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 STATISTICAL_CONTRACT_PATH,
 STATISTICAL_POLICY_PATH,
 STATISTICAL_SOURCE_BUNDLE_PATH,
 RO_STATISTICAL_SOURCE_PATH,
 MD_STATISTICAL_SOURCE_PATH,
 statisticalSourceBundleFingerprint,
 validateActualStatisticalContract
} from './actual-statistical-contract.mjs';

const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const buffer=value=>Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');

test('P2.0 statistical contract and official source bindings pass fail-closed gate',async()=>{
 const report=await validateActualStatisticalContract();
 assert.equal(report.status,'PASS',JSON.stringify(report.failures));
 assert.deepEqual(report.summary.RO.level_counts,{'1':4,'2':8,'3':42});
 assert.equal(report.summary.RO.reused_nuts3_entity_count,42);
 assert.deepEqual(report.summary.MD.level_counts,{'1':1,'2':2,'3':6});
 assert.equal(report.summary.MD.component_assignment_count,37);
 assert.equal(report.summary.p1_entity_count,5830);
 const policy=await readJson(STATISTICAL_POLICY_PATH);
 assert.equal(report.summary.p2_entities_activated,policy.activated===true);
});

test('P2.0 source bundle fingerprint binds exact normalized RO and MD source bytes',async()=>{
 const bundle=await readJson(STATISTICAL_SOURCE_BUNDLE_PATH);
 const fp=statisticalSourceBundleFingerprint(bundle);
 assert.equal(bundle.bundle_fingerprint_algorithm,fp.algorithm);
 assert.equal(bundle.bundle_fingerprint_sha256,fp.sha256);
 const roBytes=await readFile(RO_STATISTICAL_SOURCE_PATH);
 const mdBytes=await readFile(MD_STATISTICAL_SOURCE_PATH);
 const crypto=await import('node:crypto');
 const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
 assert.equal(bundle.sources.RO.sha256,sha(roBytes));
 assert.equal(bundle.sources.MD.sha256,sha(mdBytes));
});

test('P2.0 contract defines typed hierarchy reuse without administrative-parent overwrite',async()=>{
 const contract=await readJson(STATISTICAL_CONTRACT_PATH);
 assert.equal(contract.contract,'actual-statistical-hierarchy-v1');
 const policy=await readJson(STATISTICAL_POLICY_PATH);
 assert.equal(contract.phase,policy.activated?'P2_ACTIVATED':'P2_PREPARED');
 assert.equal(contract.hierarchies.administrative.immutable_during_p2_activation,true);
 assert.equal(contract.hierarchies.statistical.must_not_replace_administrative_parentage,true);
 assert.equal(contract.entity_reuse.duplicate_entity_for_same_territorial_unit,false);
 assert.equal(contract.entity_reuse.duplicate_geometry_for_same_extent,false);
 assert.equal(contract.web_consolidation.single_descending_tree,true);
 assert.deepEqual(contract.web_consolidation.order,[
  'country','statistical_level_1','statistical_level_2','statistical_level_3','administrative_descendants'
 ]);
});

test('P2 activation gate fails on an incoherent policy phase',async()=>{
 const policy=await readJson(STATISTICAL_POLICY_PATH);
 policy.phase=policy.activated?'P2_PREPARED':'P2_ACTIVATED';
 const report=await validateActualStatisticalContract({
  readFileFn:async path=>path===STATISTICAL_POLICY_PATH?buffer(policy):readFile(path)
 });
 assert.equal(report.status,'FAIL');
 assert.ok(report.failures.some(x=>x.name==='policy_activation_state_is_coherent'));
});

test('P2.0 gate fails on MD121 substitution for official MD120',async()=>{
 const md=await readJson(MD_STATISTICAL_SOURCE_PATH);
 const unit=md.units.find(x=>x.code==='MD120');
 assert.ok(unit);
 unit.code='MD121';
 const report=await validateActualStatisticalContract({
  readFileFn:async path=>path===MD_STATISTICAL_SOURCE_PATH?buffer(md):readFile(path)
 });
 assert.equal(report.status,'FAIL');
 assert.ok(report.failures.some(x=>x.name==='source_bundle_MD_sha256'));
 assert.ok(report.failures.some(x=>x.name==='md_codes_exact_and_no_md121'));
});

test('P2 statistical activation state is explicit and source bundle remains separately bound',async()=>{
 const active=await readJson('data/current/actual-source-bundle-manifest.json');
 assert.ok(!active.sources.RO);
 assert.ok(!active.sources.MD);
 assert.equal(active.sources.ro_nuts_2024,undefined);
 assert.equal(active.sources.md_nuts_2017,undefined);
 const policy=await readJson(STATISTICAL_POLICY_PATH);
 const publicIndex=await readJson('public/data/actual-entities.json');
 if(policy.activated){
  assert.equal(policy.phase,'P2_ACTIVATED');
  assert.equal(publicIndex.contract,'actual-public-entity-v3');
  assert.equal(publicIndex.entity_count,5848);
 }else{
  assert.equal(policy.phase,'P2_PREPARED');
  assert.equal(publicIndex.contract,'actual-public-entity-v2');
  assert.equal(publicIndex.entity_count,5830);
 }
});

test('P2.0 gate stays outside pinned deterministic runner until activation',async()=>{
 const [runner,pkg]=await Promise.all([
  readFile('scripts/process/run-actual-deterministic-candidate.sh','utf8'),
  readJson('package.json')
 ]);
 assert.doesNotMatch(runner,/audit:actual-statistical-contract/);
 assert.equal(pkg.scripts?.['audit:actual-statistical-contract'],undefined);
});


test('dedicated P2 workflow enforces the statistical foundation gate',async()=>{
 const workflow=await readFile('.github/workflows/p2-statistical-foundation.yml','utf8');
 assert.match(workflow,/node tools\/p2\/audit-actual-statistical-contract\.mjs/);
 assert.match(workflow,/node --test tools\/p2\/actual-statistical-contract\.test\.mjs/);
 assert.match(workflow,/git status --porcelain/);
});
