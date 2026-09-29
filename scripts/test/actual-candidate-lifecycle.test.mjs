import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {actualSemanticFingerprint} from '../lib/actual-semantic-fingerprint.mjs';
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
  settlementPolicy:await readJson('data/sources/actual-settlement-policy.json')
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
