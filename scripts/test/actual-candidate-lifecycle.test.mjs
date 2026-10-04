import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {actualSemanticFingerprint} from '../lib/actual-semantic-fingerprint.mjs';
import {roOfficialComponentLocalities,uniqueLegalIdentityIds} from '../lib/actual-completeness.mjs';
import {candidateIdentityFingerprint,classifyCandidateDisposition,validateCandidatePromotion,validateCandidateSemanticManifestBinding} from '../lib/actual-candidate-lifecycle.mjs';

const sha256=value=>createHash('sha256').update(value).digest('hex');
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const clone=value=>structuredClone(value);

async function loadDocuments(){
 return {
  catalog:await readJson('data/current/entities.json'),
  inventory:await readJson('data/current/administrative-inventory.json'),
  roGeo:await readJson('public/geo/current/ro-administrative.geojson'),
  mdGeo:await readJson('public/geo/current/md-administrative.geojson'),
  roOfficial:await readJson('data/sources/ro-siruta-current.json'),
  mdOfficial:await readJson('data/sources/cuatm-current.json'),
  mdIndividualReview:await readJson('data/sources/md-cuatm-individual-review.json'),
  settlementPolicy:await readJson('data/sources/actual-settlement-policy.json'),
  geometryRoleContract:await readJson('schemas/actual-geometry-role-contract.json')
 };
}

function firstNumericCoordinate(value){
 if(Array.isArray(value)){
  for(let i=0;i<value.length;i++){
   if(typeof value[i]==='number')return {container:value,index:i};
   const found=firstNumericCoordinate(value[i]);
   if(found)return found;
  }
 }
 return null;
}

function changeEntityClassification(documents){
 const next=clone(documents);
 const entity=next.catalog.entities?.[0];
 assert.ok(entity,'expected at least one ACTUAL entity');
 entity.display_type=String(entity.display_type??'unknown')+'__synthetic_change';
 return next;
}

function changeLegalIdentity(documents){
 const next=clone(documents);
 const entity=next.catalog.entities?.find(x=>x?.legal?.id!=null);
 assert.ok(entity,'expected at least one reconciled legal identity');
 entity.legal.id=String(entity.legal.id)+'__synthetic_change';
 return next;
}

function changeGeometry(documents){
 const next=clone(documents);
 const feature=[...(next.roGeo.features||[]),...(next.mdGeo.features||[])].find(x=>x?.geometry?.coordinates);
 assert.ok(feature,'expected at least one master geometry');
 const found=firstNumericCoordinate(feature.geometry.coordinates);
 assert.ok(found,'expected a numeric coordinate');
 found.container[found.index]=found.container[found.index]+0.000001;
 return next;
}

function changeOfficialRegistry(documents){
 const next=clone(documents);
 const record=next.roOfficial.records?.[0]??next.mdOfficial.records?.[0];
 assert.ok(record,'expected at least one official registry record');
 record.__synthetic_change='registry';
 return next;
}

test('NO_CHANGE ignores volatile timestamps and informational metadata',async()=>{
 const base=await loadDocuments();
 const changed=clone(base);
 changed.catalog.generated_at='2099-01-01T00:00:00.000Z';
 if(changed.catalog.entities?.[0]){
  changed.catalog.entities[0].imported_at='2099-01-01T00:00:00.000Z';
  changed.catalog.entities[0].osm={...(changed.catalog.entities[0].osm||{}),wikipedia:'ro:Synthetic',wikidata:'Q999999999'};
 }
 changed.roOfficial.fetched_at='2099-01-01T00:00:00.000Z';
 changed.mdOfficial.fetched_at='2099-01-01T00:00:00.000Z';
 if(changed.mdGeo.features?.[0])changed.mdGeo.features[0].properties={...(changed.mdGeo.features[0].properties||{}),wikipedia:'ro:Synthetic'};
 const a=actualSemanticFingerprint(base);
 const b=actualSemanticFingerprint(changed);
 assert.equal(b.sha256,a.sha256);
});

for(const [name,mutate] of [
 ['classification',changeEntityClassification],
 ['legal identity',changeLegalIdentity],
 ['geometry',changeGeometry],
 ['official registry',changeOfficialRegistry]
]){
 test('CHANGE fingerprint reacts to '+name,async()=>{
  const base=await loadDocuments();
  const changed=mutate(base);
  const a=actualSemanticFingerprint(base);
  const b=actualSemanticFingerprint(changed);
  assert.notEqual(b.sha256,a.sha256);
 });
}

test('candidate disposition is stable for NO_CHANGE and promotable for CHANGE',async()=>{
 const docs=await loadDocuments();
 const base=actualSemanticFingerprint(docs);
 const persisted=await readJson('data/current/actual-release-persisted.json');
 const noChange=classifyCandidateDisposition({
  baseContentFingerprint:base.sha256,
  candidateContentFingerprint:base.sha256,
  baseSnapshotId:persisted.snapshot_id,
  baseReleaseFingerprint:persisted.release_fingerprint_sha256,
  candidateSnapshotId:persisted.snapshot_id,
  candidateReleaseFingerprint:persisted.release_fingerprint_sha256,
  detailedChangeCount:0
 });
 assert.equal(noChange.status,'NO_CHANGE');
 assert.equal(noChange.review_required,false);
 assert.equal(noChange.substantive_change_count,0);

 const deliveryOnly=classifyCandidateDisposition({
  baseContentFingerprint:base.sha256,
  candidateContentFingerprint:base.sha256,
  baseSnapshotId:persisted.snapshot_id,
  baseReleaseFingerprint:persisted.release_fingerprint_sha256,
  candidateSnapshotId:persisted.snapshot_id,
  candidateReleaseFingerprint:persisted.release_fingerprint_sha256,
  detailedChangeCount:1
 });
 assert.equal(deliveryOnly.status,'CHANGE');
 assert.equal(deliveryOnly.semantic_content_changed,false);
 assert.equal(deliveryOnly.review_required,true);
 assert.equal(deliveryOnly.substantive_change_count,1);

 const changed=actualSemanticFingerprint(changeEntityClassification(docs));
 const candidateSnapshot='actual-'+changed.sha256.slice(0,16);
 const disposition=classifyCandidateDisposition({
  baseContentFingerprint:base.sha256,
  candidateContentFingerprint:changed.sha256,
  baseSnapshotId:persisted.snapshot_id,
  baseReleaseFingerprint:persisted.release_fingerprint_sha256,
  candidateSnapshotId:candidateSnapshot,
  candidateReleaseFingerprint:changed.sha256,
  detailedChangeCount:1
 });
 assert.equal(disposition.status,'CHANGE');
 assert.equal(disposition.review_required,true);
 assert.ok(disposition.substantive_change_count>0);
 assert.notEqual(candidateSnapshot,persisted.snapshot_id);
});

test('synthetic CHANGE lifecycle creates an isolated branch and exact-snapshot promotion passes',async(t)=>{
 const docs=await loadDocuments();
 const persisted=await readJson('data/current/actual-release-persisted.json');
 const currentManifestBytes=await readFile('data/current/actual-release-manifest.json');
 const currentManifest=JSON.parse(currentManifestBytes.toString('utf8'));
 const baseFp=actualSemanticFingerprint(docs);
 const changedDocs=changeEntityClassification(docs);
 const changedFp=actualSemanticFingerprint(changedDocs);
 assert.notEqual(changedFp.sha256,baseFp.sha256);

 const candidateSnapshot='actual-'+changedFp.sha256.slice(0,16);
 const baseCommitSha='a'.repeat(40);
 const candidateCommitSha='c'.repeat(40);
 const disposition=classifyCandidateDisposition({
  baseContentFingerprint:baseFp.sha256,
  candidateContentFingerprint:changedFp.sha256,
  baseSnapshotId:persisted.snapshot_id,
  baseReleaseFingerprint:persisted.release_fingerprint_sha256,
  candidateSnapshotId:candidateSnapshot,
  candidateReleaseFingerprint:changedFp.sha256,
  detailedChangeCount:1
 });
 assert.equal(disposition.status,'CHANGE');

 const sourceBundleFingerprint='c'.repeat(64);
 const reviewEvidenceFingerprint='e'.repeat(64);
 const networkDenialSha='f'.repeat(64);
 const hostTrustFingerprint='b'.repeat(64);
 const buildEnvironmentFingerprint='d'.repeat(64);
 const manifest={
  schema_version:8,
  mode:'ACTUAL',
  snapshot_id:candidateSnapshot,
  generated_at:'2026-09-27T20:37:28.323Z',
  release_fingerprint_sha256:changedFp.sha256,
  content_fingerprint_sha256:changedFp.sha256,
  source_bundle:{bundle_fingerprint_sha256:sourceBundleFingerprint},
  review_evidence_bundle:{bundle_fingerprint_sha256:reviewEvidenceFingerprint},
  network_denial:{sha256:networkDenialSha},
  host_trust:{host_trust_fingerprint_sha256:hostTrustFingerprint},
  build_environment:{environment_fingerprint_sha256:buildEnvironmentFingerprint}
 };
 const gate={status:'PASS',snapshot_id:candidateSnapshot};
 const diff={
  status:'CHANGE',
  base_ref:baseCommitSha,
  base_release:{
   snapshot_id:persisted.snapshot_id,
   release_fingerprint_sha256:persisted.release_fingerprint_sha256,
   manifest_sha256:persisted.manifest_sha256,
   source_bundle_fingerprint_sha256:persisted.source_bundle_fingerprint_sha256,
   review_evidence_bundle_fingerprint_sha256:persisted.review_evidence_bundle_fingerprint_sha256,
   network_denial_sha256:persisted.network_denial_sha256,
   host_trust_fingerprint_sha256:persisted.host_trust_fingerprint_sha256,
   build_environment_fingerprint_sha256:persisted.build_environment_fingerprint_sha256
  },
  candidate:{snapshot_id:candidateSnapshot,source_bundle_fingerprint_sha256:sourceBundleFingerprint,review_evidence_bundle_fingerprint_sha256:reviewEvidenceFingerprint,network_denial_sha256:networkDenialSha,host_trust_fingerprint_sha256:hostTrustFingerprint,build_environment_fingerprint_sha256:buildEnvironmentFingerprint},
  summary:{semantic_content_changed:true,substantive_change_count:disposition.substantive_change_count,review_required:true}
 };
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 const diffBytes=Buffer.from(JSON.stringify(diff,null,2)+'\n');
 const markerCandidate={snapshot_id:candidateSnapshot,manifest_sha256:sha256(manifestBytes),source_bundle_fingerprint_sha256:sourceBundleFingerprint,review_evidence_bundle_fingerprint_sha256:reviewEvidenceFingerprint,network_denial_sha256:networkDenialSha,host_trust_fingerprint_sha256:hostTrustFingerprint,build_environment_fingerprint_sha256:buildEnvironmentFingerprint};
 const markerDiffSha256=sha256(diffBytes);
 const markerIdentity=candidateIdentityFingerprint({baseRef:baseCommitSha,baseRelease:diff.base_release,candidate:markerCandidate,diffReportSha256:markerDiffSha256});
 const marker={
  schema_version:2,
  mode:'ACTUAL_CANDIDATE',
  status:'CHANGE',
  base_ref:baseCommitSha,
  base_release:diff.base_release,
  candidate:markerCandidate,
  diff_report_sha256:markerDiffSha256,
  candidate_identity_algorithm:markerIdentity.algorithm,
  candidate_identity_sha256:markerIdentity.sha256,
  review_required:true,
  substantive_change_count:disposition.substantive_change_count
 };

 const validation=validateCandidatePromotion({
  candidateMarker:marker,
  diff,
  manifest,
  gate,
  expectedSnapshot:candidateSnapshot,
  confirmation:'PROMOTE '+candidateSnapshot,
  candidateManifestSha256:marker.candidate.manifest_sha256,
  actualCandidateManifestSha256:sha256(manifestBytes),
  candidateDiffSha256:marker.diff_report_sha256,
  actualCandidateDiffSha256:sha256(diffBytes),
  currentPersisted:persisted,
  currentManifest,
  currentManifestSha256:sha256(currentManifestBytes),
  currentBaseCommitSha:baseCommitSha,
  expectedCandidateCommitSha:candidateCommitSha,
  actualCandidateCommitSha:candidateCommitSha
 });
 assert.equal(validation.status,'PASS',JSON.stringify(validation.failures));

 const movedCandidateCommit=validateCandidatePromotion({
  candidateMarker:marker,diff,manifest,gate,
  expectedSnapshot:candidateSnapshot,
  confirmation:'PROMOTE '+candidateSnapshot,
  candidateManifestSha256:marker.candidate.manifest_sha256,
  actualCandidateManifestSha256:sha256(manifestBytes),
  candidateDiffSha256:marker.diff_report_sha256,
  actualCandidateDiffSha256:sha256(diffBytes),
  currentPersisted:persisted,currentManifest,currentManifestSha256:sha256(currentManifestBytes),currentBaseCommitSha:baseCommitSha,
  expectedCandidateCommitSha:candidateCommitSha,actualCandidateCommitSha:'d'.repeat(40)
 });
 assert.equal(movedCandidateCommit.status,'FAIL');
 assert.ok(movedCandidateCommit.failures.some(x=>x.issue==='candidate_commit_sha_mismatch'));

 const wrongSnapshot=validateCandidatePromotion({
  candidateMarker:marker,diff,manifest,gate,
  expectedSnapshot:candidateSnapshot+'-wrong',
  confirmation:'PROMOTE '+candidateSnapshot+'-wrong',
  candidateManifestSha256:marker.candidate.manifest_sha256,
  actualCandidateManifestSha256:sha256(manifestBytes),
  candidateDiffSha256:marker.diff_report_sha256,
  actualCandidateDiffSha256:sha256(diffBytes),
  currentPersisted:persisted,currentManifest,currentManifestSha256:sha256(currentManifestBytes),currentBaseCommitSha:baseCommitSha,
  expectedCandidateCommitSha:candidateCommitSha,
  actualCandidateCommitSha:candidateCommitSha
 });
 assert.equal(wrongSnapshot.status,'FAIL');
 assert.ok(wrongSnapshot.failures.some(x=>x.issue==='unexpected_candidate_snapshot'));

 const movedBase=validateCandidatePromotion({
  candidateMarker:marker,diff,manifest,gate,
  expectedSnapshot:candidateSnapshot,
  confirmation:'PROMOTE '+candidateSnapshot,
  candidateManifestSha256:marker.candidate.manifest_sha256,
  actualCandidateManifestSha256:sha256(manifestBytes),
  candidateDiffSha256:marker.diff_report_sha256,
  actualCandidateDiffSha256:sha256(diffBytes),
  currentPersisted:persisted,currentManifest,currentManifestSha256:sha256(currentManifestBytes),
  currentBaseCommitSha:'b'.repeat(40),
  expectedCandidateCommitSha:candidateCommitSha,
  actualCandidateCommitSha:candidateCommitSha
 });
 assert.equal(movedBase.status,'FAIL');
 assert.ok(movedBase.failures.some(x=>x.issue==='base_commit_moved'));

 const noChangeMarker={...marker,status:'NO_CHANGE',review_required:false,substantive_change_count:0};
 const rejectedNoChange=validateCandidatePromotion({
  candidateMarker:noChangeMarker,diff:{...diff,status:'NO_CHANGE',summary:{...diff.summary,semantic_content_changed:false}},
  manifest,gate,expectedSnapshot:candidateSnapshot,confirmation:'PROMOTE '+candidateSnapshot,
  candidateManifestSha256:marker.candidate.manifest_sha256,actualCandidateManifestSha256:sha256(manifestBytes),
  candidateDiffSha256:marker.diff_report_sha256,actualCandidateDiffSha256:sha256(diffBytes),
  currentPersisted:persisted,currentManifest,currentManifestSha256:sha256(currentManifestBytes),currentBaseCommitSha:baseCommitSha,
  expectedCandidateCommitSha:candidateCommitSha,
  actualCandidateCommitSha:candidateCommitSha
 });
 assert.equal(rejectedNoChange.status,'FAIL');
 assert.ok(rejectedNoChange.failures.some(x=>x.issue==='candidate_marker_not_promotable'));

 const buildSyntheticRepo=async()=>{
  const temp=await mkdtemp(join(tmpdir(),'actual-synthetic-change-'));
  const deterministicDate=manifest.generated_at;
  const git=(...args)=>execFileSync('git',args,{cwd:temp,stdio:'pipe',env:{...process.env,GIT_AUTHOR_DATE:deterministicDate,GIT_COMMITTER_DATE:deterministicDate}}).toString().trim();
  git('init','-b','main');
  git('config','user.name','ACTUAL regression test');
  git('config','user.email','actual-regression@example.invalid');
  await writeFile(join(temp,'release.json'),JSON.stringify({snapshot_id:persisted.snapshot_id})+'\n');
  git('add','release.json');
  git('commit','-m','synthetic persisted base');
  git('checkout','-b','actual/synthetic-change');
  await mkdir(join(temp,'candidate'),{recursive:true});
  await writeFile(join(temp,'candidate','manifest.json'),manifestBytes);
  await writeFile(join(temp,'candidate','diff.json'),diffBytes);
  await writeFile(join(temp,'candidate','marker.json'),JSON.stringify(marker,null,2)+'\n');
  git('add','candidate');
  git('commit','-m','synthetic ACTUAL CHANGE candidate');
  assert.equal(git('branch','--show-current'),'actual/synthetic-change');
  assert.equal(git('rev-list','--count','main..HEAD'),'1');
  return {tree:git('rev-parse','HEAD^{tree}'),commit:git('rev-parse','HEAD')};
 };
 const firstSynthetic=await buildSyntheticRepo();
 const secondSynthetic=await buildSyntheticRepo();
 assert.equal(firstSynthetic.tree,secondSynthetic.tree,'synthetic CHANGE tree must be byte-identical across independent builds');
 assert.equal(firstSynthetic.commit,secondSynthetic.commit,'synthetic CHANGE commit object must be identical across independent builds');
 t.diagnostic(JSON.stringify({
  status:'PASS',
  mode:'SYNTHETIC_CHANGE_LIFECYCLE',
  base_snapshot_id:persisted.snapshot_id,
  candidate_snapshot_id:candidateSnapshot,
  candidate_identity_sha256:marker.candidate_identity_sha256,
  base_content_fingerprint_sha256:baseFp.sha256,
  candidate_content_fingerprint_sha256:changedFp.sha256,
  tree_sha:firstSynthetic.tree,
  commit_sha:firstSynthetic.commit,
  repeated_build_tree_sha:secondSynthetic.tree,
  repeated_build_commit_sha:secondSynthetic.commit,
  branch:'actual/synthetic-change',
  remote_push:false,
  exact_snapshot_promotion:'PASS',
  wrong_snapshot_promotion:'REJECTED',
  no_change_promotion:'REJECTED'
 }));
});


test('candidate semantic manifest binding supports only explicit v3 binding or exact legacy base-byte reuse',()=>{
 const semantic='a'.repeat(64);
 const changed='b'.repeat(64);

 const explicit=validateCandidateSemanticManifestBinding({
  manifestContentFingerprint:semantic,
  candidateContentFingerprint:semantic,
  baselineContentFingerprint:semantic,
  exactBaseManifestBytesReused:false
 });
 assert.equal(explicit.status,'PASS');
 assert.equal(explicit.binding,'explicit_manifest_fingerprint');

 const exactLegacy=validateCandidateSemanticManifestBinding({
  manifestContentFingerprint:undefined,
  candidateContentFingerprint:semantic,
  baselineContentFingerprint:semantic,
  exactBaseManifestBytesReused:true
 });
 assert.equal(exactLegacy.status,'PASS');
 assert.equal(exactLegacy.binding,'exact_base_manifest_byte_reuse');

 const nonExactLegacy=validateCandidateSemanticManifestBinding({
  manifestContentFingerprint:undefined,
  candidateContentFingerprint:semantic,
  baselineContentFingerprint:semantic,
  exactBaseManifestBytesReused:false
 });
 assert.equal(nonExactLegacy.status,'FAIL');

 const changedSemantic=validateCandidateSemanticManifestBinding({
  manifestContentFingerprint:undefined,
  candidateContentFingerprint:changed,
  baselineContentFingerprint:semantic,
  exactBaseManifestBytesReused:true
 });
 assert.equal(changedSemantic.status,'FAIL');
});


test('candidate tree excludes volatile execution metadata and Git commits use deterministic release time',async()=>{
 const [builder,receipt,candidateWorkflow,promotion,promotionWorkflow]=await Promise.all([
  readFile('scripts/process/build-actual-candidate-diff.mjs','utf8'),
  readFile('scripts/process/write-actual-candidate-execution-receipt.mjs','utf8'),
  readFile('.github/workflows/actual-candidate.yml','utf8'),
  readFile('scripts/process/prepare-actual-candidate-promotion.mjs','utf8'),
  readFile('.github/workflows/actual-promote-candidate.yml','utf8')
 ]);
 assert.doesNotMatch(builder,/new Date\(\)\.toISOString\(\)/);
 assert.doesNotMatch(builder,/GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT|GITHUB_SHA/);
 assert.match(receipt,/new Date\(\)\.toISOString\(\)/);
 assert.match(receipt,/GITHUB_RUN_ID/);
 assert.match(candidateWorkflow,/runner\.temp.*actual-candidate-execution-receipt\.json/);
 assert.doesNotMatch(candidateWorkflow,/--env GITHUB_RUN_ID|--env GITHUB_RUN_ATTEMPT|--env GITHUB_SHA/);
 assert.match(candidateWorkflow,/GIT_AUTHOR_DATE="\$COMMIT_DATE" GIT_COMMITTER_DATE="\$COMMIT_DATE" git commit/);
 assert.doesNotMatch(promotion,/new Date\(\)\.toISOString\(\)/);
 assert.doesNotMatch(promotion,/source_candidate/);
 assert.match(promotionWorkflow,/GIT_AUTHOR_DATE="\$COMMIT_DATE" GIT_COMMITTER_DATE="\$COMMIT_DATE" git commit/);
});

test('candidate base is an exact trigger-time SHA through build wrappers and promotion',async()=>{
 const [candidateWorkflow,promotionWorkflow,promotionScript,diffBuilder,roWrapper,mdWrapper,osmWrapper]=await Promise.all([
  readFile('.github/workflows/actual-candidate.yml','utf8'),
  readFile('.github/workflows/actual-promote-candidate.yml','utf8'),
  readFile('scripts/process/prepare-actual-candidate-promotion.mjs','utf8'),
  readFile('scripts/process/build-actual-candidate-diff.mjs','utf8'),
  readFile('.github/workflows/refresh-ro-official.yml','utf8'),
  readFile('.github/workflows/refresh-md-official.yml','utf8'),
  readFile('.github/workflows/import-osm.yml','utf8')
 ]);
 assert.match(candidateWorkflow,/REQUESTED_BASE_SHA: \$\{\{ inputs\.base_release_commit \|\| github\.sha \}\}/);
 assert.match(candidateWorkflow,/ref: \$\{\{ steps\.requested_base\.outputs\.base_release_commit \}\}/);
 assert.doesNotMatch(candidateWorkflow,/ref:\s*main\b/);
 assert.match(candidateWorkflow,/BASE_RELEASE_COMMIT="\$\(git rev-parse HEAD\)"/);
 assert.match(candidateWorkflow,/\[ "\$BASE_RELEASE_COMMIT" != "\$REQUESTED_BASE_SHA" \]/);
 assert.match(diffBuilder,/ACTUAL_BASE_REF must be an exact lowercase 40-hex commit SHA/);
 assert.doesNotMatch(promotionScript,/\|\|'origin\/main'/);
 assert.match(promotionWorkflow,/CURRENT_MAIN_SHA="\$\(git rev-parse refs\/remotes\/origin\/main\)"/);
 assert.match(promotionWorkflow,/CANDIDATE_BASE_SHA="\$\(node -p/);
 assert.match(promotionWorkflow,/\[ "\$CURRENT_MAIN_SHA" != "\$CANDIDATE_BASE_SHA" \]/);
 assert.match(promotionWorkflow,/ACTUAL_BASE_REF: \$\{\{ steps\.current_main\.outputs\.current_main_sha \}\}/);
 for(const wrapper of [roWrapper,mdWrapper,osmWrapper])assert.match(wrapper,/base_release_commit: \$\{\{ github\.sha \}\}/);
});


test('RO component-locality inventory is exactly SIRUTA level 3',()=>{
 const records=[
  {siruta:'10',level:1},
  {siruta:'100',level:2},
  {siruta:'101',level:3},
  {siruta:'102',level:'3'}
 ];
 assert.deepEqual(roOfficialComponentLocalities(records).map(x=>x.siruta),['101','102']);
});

test('CUATM locality coverage counts unique legal identities, not polygon representations',()=>{
 const ids=uniqueLegalIdentityIds(['8341','8341','1910',null,'']);
 assert.deepEqual([...ids].sort(),['1910','8341']);
});

test('geometry-role contract keeps administrative, statistical and locality semantics distinct',async()=>{
 const contract=JSON.parse(await readFile('schemas/actual-geometry-role-contract.json','utf8'));
 assert.equal(contract.schema_version,1);
 assert.equal(contract.contract,'actual-geometry-role-v1');
 assert.equal(contract.mode,'ACTUAL');
 assert.deepEqual(Object.keys(contract.roles).sort(),[
  'administrative_boundary',
  'locality_footprint',
  'statistical_boundary'
 ]);
 assert.equal(contract.roles.administrative_boundary.legal_geometry_equivalence_implied,false);
 assert.equal(contract.roles.statistical_boundary.must_not_be_inferred_from_administrative_hierarchy_alone,true);
 assert.ok(contract.roles.locality_footprint.allowed_subtypes.includes('intravilan'));
 assert.equal(contract.compatibility.actual_public_entity_v1.legacy_geometry_role,'current_representation');
 assert.equal(contract.compatibility.actual_public_entity_v1.canonical_role_for_existing_master_geometry,'administrative_boundary');
});


test('geometry policy migration upgrades semantic identity only after explicit opt-in',async()=>{
 const current=await loadDocuments();
 const legacy=clone(current);
 legacy.settlementPolicy.policy_version='2026-09-27';
 delete legacy.settlementPolicy.coverage_contract_version;
 delete legacy.settlementPolicy.geometry_role_contract;
 legacy.settlementPolicy.jurisdictions.RO.official_inventory_selector='SIRUTA records whose level is not 2';
 delete legacy.settlementPolicy.jurisdictions.RO.coverage_accounting;
 delete legacy.settlementPolicy.jurisdictions.MD.coverage_accounting;
 const legacyFingerprint=actualSemanticFingerprint(legacy);
 assert.equal(legacyFingerprint.algorithm,'actual-semantic-v1');

 const migrated=clone(legacy);
 migrated.settlementPolicy.policy_version='2026-10-02-v1.1';
 migrated.settlementPolicy.coverage_contract_version=2;
 migrated.settlementPolicy.geometry_role_contract={
  path:'schemas/actual-geometry-role-contract.json',
  contract:'actual-geometry-role-v1',
  schema_version:1
 };
 migrated.settlementPolicy.jurisdictions.RO.official_inventory_selector='SIRUTA records whose level is 3';
 migrated.settlementPolicy.jurisdictions.RO.coverage_accounting='unique_official_legal_identity';
 migrated.settlementPolicy.jurisdictions.MD.coverage_accounting='unique_official_legal_identity';
 const migratedFingerprint=actualSemanticFingerprint(migrated);
 assert.equal(migratedFingerprint.algorithm,'actual-semantic-v2');
 assert.notEqual(migratedFingerprint.sha256,legacyFingerprint.sha256);
 assert.equal(migratedFingerprint.payload.geometry_role_contract.contract,'actual-geometry-role-v1');
});

test('candidate lifecycle is the only write path for ACTUAL v1.1 geometry policy migration',async()=>{
 const [candidate,promotion,publication]=await Promise.all([
  readFile('.github/workflows/actual-candidate.yml','utf8'),
  readFile('.github/workflows/actual-promote-candidate.yml','utf8'),
  readFile('scripts/process/audit-actual-publication-path.mjs','utf8')
 ]);
 assert.match(candidate,/migrate_geometry_policy_v1_1:/);
 assert.match(candidate,/apply-actual-geometry-policy-v1-1\.mjs/);
 assert.match(candidate,/data\/sources\/actual-settlement-policy\.json/);
 assert.match(candidate,/--network none/);
 assert.match(promotion,/path == 'data\/sources\/actual-settlement-policy\.json'/);
 assert.match(publication,/path==='data\/sources\/actual-settlement-policy\.json'/);
});


test('P1.1 state boundaries are explicit context geometries without changing UAT parentage',async()=>{
 const [builder,publicBuilder,structural,regression]=await Promise.all([
  readFile('scripts/process/build-osm-actual.mjs','utf8'),
  readFile('scripts/process/build-actual-public-data.mjs','utf8'),
  readFile('scripts/process/audit-actual-structural-completeness.mjs','utf8'),
  readFile('scripts/process/audit-actual-regression.mjs','utf8')
 ]);
 assert.match(builder,/stateRelationId:90689/);
 assert.match(builder,/stateRelationId:58974/);
 assert.match(builder,/category:c\.type==='state'\?'context':'administrative'/);
 assert.match(builder,/p\.type!=='state'/);
 assert.match(builder,/role:'administrative_boundary',scope:'state_context'/);
 assert.match(publicBuilder,/canonical_geometry_role:e\.geometry\?\.role\|\|null/);
 assert.match(publicBuilder,/geometry_scope:e\.geometry\?\.scope\|\|null/);
 assert.match(publicBuilder,/if\(e\.category==='context'\)legalIdentityStatus='not_bound_to_official_registry'/);
 assert.match(structural,/STATE_RELATION_IDS=\{RO:90689,MD:58974\}/);
 assert.match(structural,/auditStateContext\('RO'\)/);
 assert.match(structural,/auditStateContext\('MD'\)/);
 assert.match(regression,/bretcuFallbackEnabled=fallbackIds\.includes\('64096'\)/);
 assert.match(regression,/EXPECTED=\{RO:bretcuFallbackEnabled\?3234:3233,MD:2596\}/);
 assert.match(regression,/EXPECTED_TOTAL=EXPECTED\.RO\+EXPECTED\.MD/);
});


test('Brețcu ANCPI fallback source is exact and dormant until policy migration',async()=>{
 const [fallback,policy,schema,migration,sourceBundle]=await Promise.all([
  readJson('data/sources/ro-ancpi-uat-fallbacks.json'),
  readJson('data/sources/actual-settlement-policy.json'),
  readJson('schemas/actual-public-entity.schema.json'),
  readFile('scripts/process/apply-actual-geometry-policy-v1-1.mjs','utf8'),
  readFile('scripts/lib/actual-source-bundle.mjs','utf8')
 ]);
 assert.equal(fallback.schema_version,1);
 assert.equal(fallback.mode,'ACTUAL_RO_ANCPI_UAT_FALLBACKS');
 assert.equal(fallback.source?.arcgis_item_id,'466b7199c19f4904831e14bc7f407af9');
 assert.equal(fallback.features?.length,1);
 const bretcu=fallback.features[0];
 assert.equal(String(bretcu.legal_id),'64096');
 assert.equal(Number(bretcu.source_object_id),1227);
 assert.equal(bretcu.inspire_id_local_id,'1.145.64096');
 assert.equal(bretcu.geometry_role,'administrative_boundary');
 assert.equal(bretcu.geometry_scope,'uat_fallback');
 assert.ok(['Polygon','MultiPolygon'].includes(bretcu.geometry?.type));
 const fallbackBinding=policy.administrative_geometry_fallbacks?.RO;
 if(fallbackBinding){
  assert.equal(policy.public_contract,'actual-public-entity-v2');
  assert.equal(fallbackBinding.path,'data/sources/ro-ancpi-uat-fallbacks.json');
  assert.equal(fallbackBinding.mode,'ACTUAL_RO_ANCPI_UAT_FALLBACKS');
  assert.deepEqual(fallbackBinding.legal_ids,['64096']);
  assert.equal(fallbackBinding.geometry_role,'administrative_boundary');
  assert.equal(fallbackBinding.geometry_scope,'uat_fallback');
 }else{
  assert.equal(policy.public_contract,undefined,'dormant support state must keep public contract v1 implicit');
 }
 assert.equal(schema.$defs.entity.properties.id.pattern,'^(?:osm-r[0-9]+|siruta-u[0-9]+)$');
 assert.deepEqual(schema.$defs.entity.properties.representation.properties.source.enum,['OpenStreetMap','ANCPI RELUAT']);
 assert.match(migration,/policy_version='2026-10-04-v1\.4'/);
 assert.match(migration,/administrative_geometry_fallbacks/);
 assert.match(migration,/legal_ids:\['64096'\]/);
 assert.match(sourceBundle,/ancpiBinding=policy\?\.administrative_geometry_fallbacks\?\.RO/);
 const ojdula=await readJson('data/sources/ro-ancpi-ojdula-reviewed.json');
 assert.equal(ojdula.mode,'ACTUAL_RO_ANCPI_REVIEWED_GEOMETRY_OVERRIDE');
 assert.equal(String(ojdula.feature?.legal_id),'64602');
 assert.equal(Number(ojdula.feature?.source_object_id),1167);
 assert.equal(ojdula.feature?.inspire_id_local_id,'1.145.64602');
 assert.equal(Number(ojdula.feature?.replacement_osm_relation_id),14735731);
 assert.match(migration,/partition_osm_shell_by_ancpi_shared_boundary/);
});

test('reviewed Brețcu–Ojdula hybrid partition is pinned to old OSM shell and exact ANCPI divider contract',async()=>{
 const [shell,fallback,ojdula,helper,reconciliation,roGate]=await Promise.all([
  readJson('data/sources/ro-osm-ojdula-14735731-reviewed-shell.json'),
  readJson('data/sources/ro-ancpi-uat-fallbacks.json'),
  readJson('data/sources/ro-ancpi-ojdula-reviewed.json'),
  readFile('scripts/lib/bretcu-ojdula-hybrid-partition.mjs','utf8'),
  readFile('scripts/process/apply-ro-official-reconciliation.mjs','utf8'),
  readFile('scripts/process/audit-ro-release-gate.mjs','utf8')
 ]);
 assert.equal(shell.mode,'ACTUAL_RO_REVIEWED_OSM_OUTER_SHELL');
 assert.equal(Number(shell.relation_id),14735731);
 assert.equal(shell.source_commit_sha,'f21e4954063a884df9922efa5ac31229c5b51d43');
 assert.equal(shell.source_snapshot_id,'actual-990c892d9d27fa46');
 assert.equal(shell.geometry?.type,'Polygon');
 const bretcu=fallback.features.find(x=>String(x.legal_id)==='64096');
 assert.ok(bretcu);
 assert.equal(String(ojdula.feature?.legal_id),'64602');
 const edgeKey=(a,b)=>[JSON.stringify([Number(a[0]),Number(a[1])]),JSON.stringify([Number(b[0]),Number(b[1])])].sort().join('|');
 const edges=geometry=>{
  const rings=geometry.type==='Polygon'?geometry.coordinates:geometry.coordinates.flat();
  return new Set(rings.flatMap(r=>r.slice(0,-1).map((p,i)=>edgeKey(p,r[i+1]))));
 };
 const oe=edges(ojdula.feature.geometry),be=edges(bretcu.geometry);
 const shared=[...oe].filter(k=>be.has(k));
 assert.equal(shared.length,826,'reviewed ANCPI common boundary edge count drifted');
 assert.match(helper,/shell_symmetric_difference_m2/);
 assert.match(helper,/osm_shell_edges_preserved/);
 assert.match(helper,/area_balance_delta_m2/);
 assert.match(helper,/partition_area_sum_residual_m2/);
 assert.match(helper,/turf\.area\(union\)-turf\.area\(old\)/);
 assert.match(helper,/exact_partition_boundary_edge_proof/);
 assert.match(helper,/invalid_edge_multiplicity_count/);
 assert.match(helper,/partition_interior_edge_count/);
 assert.match(helper,/edgeMultiplicity/);
 assert.match(helper,/exteriorEdgeSet/);
 assert.match(helper,/ancpi_shared_edges_preserved/);
 assert.match(helper,/circularArc/);
 assert.match(helper,/Projected ANCPI divider endpoints are not distinct vertices on the OSM shell/);
 assert.doesNotMatch(helper,/turf\.polygonize/);
 assert.match(reconciliation,/osmOjdulaGeometry=structuredClone\(ojdulaOsmShell\.geometry\)/);
 assert.match(reconciliation,/exact_partition_boundary_edge_proof/);
 assert.doesNotMatch(reconciliation,/area_balance_delta_m2>0\.01/);
 assert.doesNotMatch(reconciliation,/overlap_m2>0\.01/);
 assert.match(roGate,/exact_partition_boundary_edge_proof/);
 assert.doesNotMatch(roGate,/Number\(audit\?\.overlap_m2\)<=0\.01/);
 assert.doesNotMatch(reconciliation,/osmOjdulaGeometry=structuredClone\(ojdulaFeature\.geometry\)/);
});

test('Brețcu fallback application never fabricates an OSM relation',async()=>{
 const apply=await readFile('scripts/process/apply-ro-official-reconciliation.mjs','utf8');
 assert.match(apply,/id='siruta-u'\+legalId/);
 assert.match(apply,/source:'ANCPI RELUAT'/);
 assert.match(apply,/geometry_equivalence_asserted:false/);
 assert.match(apply,/parentId='osm-r'\+String\(resolution\.expected_parent_osm_relation_id\)/);
 assert.doesNotMatch(apply,/osm:\s*\{[^}]*64096/s);
});
