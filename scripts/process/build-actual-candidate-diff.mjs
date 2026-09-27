#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {actualSemanticFingerprint,semanticCatalogEntities} from '../lib/actual-semantic-fingerprint.mjs';

const BASE_REF=process.env.ACTUAL_BASE_REF;
if(!BASE_REF)throw new Error('ACTUAL_BASE_REF is required and must identify the persisted release commit/ref.');
const MANIFEST='data/current/actual-release-manifest.json';
const GATE='data/current/actual-release-gate.json';
const PERSISTED='data/current/actual-release-persisted.json';
const PUBLIC='public/data/actual-entities.json';
const CATALOG='data/current/entities.json';
const INVENTORY='data/current/administrative-inventory.json';
const REVIEW='data/sources/md-cuatm-individual-review.json';
const SETTLEMENT_POLICY='data/sources/actual-settlement-policy.json';
const GEO={RO:'public/geo/current/ro-administrative.geojson',MD:'public/geo/current/md-administrative.geojson'};
const OFFICIAL={RO:'data/sources/ro-siruta-current.json',MD:'data/sources/cuatm-current.json'};
const OUTPUT='data/current/actual-candidate-diff.json';
const MARKER='data/current/actual-release-candidate.json';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value);
const hashValue=value=>sha256(Buffer.from(stable(value),'utf8'));
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const gitBuffer=path=>execFileSync('git',['show',BASE_REF+':'+path],{maxBuffer:256*1024*1024});
const gitJson=path=>JSON.parse(gitBuffer(path).toString('utf8'));
const volatileKeys=new Set(['generated_at','fetched_at','downloaded_at','retrieved_at','created_at','updated_at']);
const stripVolatile=value=>{
 if(Array.isArray(value))return value.map(stripVolatile);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!volatileKeys.has(k)).map(([k,v])=>[k,stripVolatile(v)]));
 return value;
};
const manifestBytes=await readFile(MANIFEST);
const [manifest,gate,candidatePublic,candidateCatalog,candidateInventory,candidateReview,candidateSettlementPolicy]=await Promise.all([readJson(MANIFEST),readJson(GATE),readJson(PUBLIC),readJson(CATALOG),readJson(INVENTORY),readJson(REVIEW),readJson(SETTLEMENT_POLICY)]);
const baselineMarker=gitJson(PERSISTED);
const baselineManifestBytes=gitBuffer(MANIFEST);
const baselineManifest=JSON.parse(baselineManifestBytes.toString('utf8'));
const baselinePublic=gitJson(PUBLIC);
const baselineCatalog=gitJson(CATALOG);
const baselineInventory=gitJson(INVENTORY);
const baselineReview=gitJson(REVIEW);
const baselineSettlementPolicy=gitJson(SETTLEMENT_POLICY);
const baselineManifestSha=sha256(baselineManifestBytes);
const failures=[];
const requireCheck=(ok,issue,detail={})=>{if(!ok)failures.push({issue,...detail});};
requireCheck(baselineMarker.schema_version===1,'baseline_marker_schema',{actual:baselineMarker.schema_version});
requireCheck(baselineMarker.validated_release_gate_status==='PASS','baseline_marker_not_pass',{actual:baselineMarker.validated_release_gate_status});
requireCheck(baselineMarker.snapshot_id===baselineManifest.snapshot_id,'baseline_snapshot_mismatch',{marker:baselineMarker.snapshot_id,manifest:baselineManifest.snapshot_id});
requireCheck(baselineMarker.release_fingerprint_sha256===baselineManifest.release_fingerprint_sha256,'baseline_fingerprint_mismatch');
requireCheck(baselineMarker.manifest_sha256===baselineManifestSha,'baseline_manifest_hash_mismatch',{marker:baselineMarker.manifest_sha256,actual:baselineManifestSha});
requireCheck(gate.status==='PASS','candidate_release_gate_not_pass',{status:gate.status});
requireCheck(gate.snapshot_id===manifest.snapshot_id,'candidate_gate_snapshot_mismatch',{gate:gate.snapshot_id,manifest:manifest.snapshot_id});
requireCheck(manifest.mode==='ACTUAL','candidate_manifest_mode',{actual:manifest.mode});
const baselineSemantic=actualSemanticFingerprint({
 catalog:baselineCatalog,
 inventory:baselineInventory,
 roGeo:gitJson(GEO.RO),
 mdGeo:gitJson(GEO.MD),
 roOfficial:gitJson(OFFICIAL.RO),
 mdOfficial:gitJson(OFFICIAL.MD),
 mdIndividualReview:baselineReview,
 settlementPolicy:baselineSettlementPolicy
});
const candidateSemantic=actualSemanticFingerprint({
 catalog:candidateCatalog,
 inventory:candidateInventory,
 roGeo:await readJson(GEO.RO),
 mdGeo:await readJson(GEO.MD),
 roOfficial:await readJson(OFFICIAL.RO),
 mdOfficial:await readJson(OFFICIAL.MD),
 mdIndividualReview:candidateReview,
 settlementPolicy:candidateSettlementPolicy
});
requireCheck(manifest.content_fingerprint_sha256===candidateSemantic.sha256,'candidate_semantic_fingerprint_mismatch',{manifest:manifest.content_fingerprint_sha256??null,actual:candidateSemantic.sha256});


const entityList=doc=>Array.isArray(doc.entities)?doc.entities:[];
const byId=list=>new Map(list.map(x=>[x.id,x]));
const beforeEntities=entityList(baselinePublic),afterEntities=entityList(candidatePublic);
const beforeById=byId(beforeEntities),afterById=byId(afterEntities);
const added=[...afterById.keys()].filter(id=>!beforeById.has(id)).sort();
const removed=[...beforeById.keys()].filter(id=>!afterById.has(id)).sort();
const shared=[...afterById.keys()].filter(id=>beforeById.has(id)).sort();
const legalIdentity=e=>e?.legal??null;
const classification=e=>({
 display_type:e?.display_type??null,
 parent_catalog_id:e?.hierarchy?.parent_catalog_id??null,
 inferred_type:e?.representation?.inferred_type??null,
 legal_identity_status:e?.validation?.legal_identity_status??null
});
const legalChanged=shared.filter(id=>stable(legalIdentity(beforeById.get(id)))!==stable(legalIdentity(afterById.get(id))));
const classificationChanged=shared.filter(id=>stable(classification(beforeById.get(id)))!==stable(classification(afterById.get(id))));
const legalChangeSamples=legalChanged.slice(0,100).map(id=>({id,before:legalIdentity(beforeById.get(id)),after:legalIdentity(afterById.get(id))}));
const classificationChangeSamples=classificationChanged.slice(0,100).map(id=>({id,before:classification(beforeById.get(id)),after:classification(afterById.get(id))}));

const geometry={};
let geometryChangedTotal=0;
for(const jurisdiction of ['RO','MD']){
 const before=gitJson(GEO[jurisdiction]),after=await readJson(GEO[jurisdiction]);
 const map=f=>new Map((f.features||[]).map(x=>[x.properties?.catalog_id,hashValue(x.geometry)]).filter(([id])=>id));
 const a=map(before),b=map(after);
 const addedIds=[...b.keys()].filter(id=>!a.has(id)).sort();
 const removedIds=[...a.keys()].filter(id=>!b.has(id)).sort();
 const changedIds=[...b.keys()].filter(id=>a.has(id)&&a.get(id)!==b.get(id)).sort();
 geometryChangedTotal+=addedIds.length+removedIds.length+changedIds.length;
 geometry[jurisdiction]={
  before_feature_count:(before.features||[]).length,
  after_feature_count:(after.features||[]).length,
  added_count:addedIds.length,removed_count:removedIds.length,changed_count:changedIds.length,
  added_ids:addedIds,removed_ids:removedIds,changed_ids:changedIds
 };
}

const registries={};
let semanticRegistryChanges=0;
for(const jurisdiction of ['RO','MD']){
 const before=gitJson(OFFICIAL[jurisdiction]),after=await readJson(OFFICIAL[jurisdiction]);
 const beforeSemantic=hashValue(stripVolatile(before));
 const afterSemantic=hashValue(stripVolatile(after));
 const changed=beforeSemantic!==afterSemantic;
 if(changed)semanticRegistryChanges++;
 registries[jurisdiction]={
  semantic_changed:changed,
  before_semantic_sha256:beforeSemantic,
  after_semantic_sha256:afterSemantic,
  before_record_count:before.record_count??(Array.isArray(before.records)?before.records.length:null),
  after_record_count:after.record_count??(Array.isArray(after.records)?after.records.length:null),
  before_manifest_sha256:baselineManifest.components?.[jurisdiction==='RO'?'ro_official':'md_official']?.sha256??null,
  after_manifest_sha256:manifest.components?.[jurisdiction==='RO'?'ro_official':'md_official']?.sha256??null
 };
}

const componentChanges=[];
for(const key of [...new Set([...Object.keys(baselineManifest.components||{}),...Object.keys(manifest.components||{})])].sort()){
 const before=baselineManifest.components?.[key]??null,after=manifest.components?.[key]??null;
 if(before?.sha256!==after?.sha256)componentChanges.push({key,path:after?.path??before?.path??null,before_sha256:before?.sha256??null,after_sha256:after?.sha256??null});
}
const beforeSemanticEntities=new Map(semanticCatalogEntities(baselineCatalog).map(x=>[x.id,hashValue(x)]));
const afterSemanticEntities=new Map(semanticCatalogEntities(candidateCatalog).map(x=>[x.id,hashValue(x)]));
const entityContentChanged=[...afterSemanticEntities.keys()].filter(id=>beforeSemanticEntities.has(id)&&beforeSemanticEntities.get(id)!==afterSemanticEntities.get(id)).sort();
const semanticChanged=baselineSemantic.sha256!==candidateSemantic.sha256;
const substantiveChangeCount=added.length+removed.length+entityContentChanged.length+geometryChangedTotal+semanticRegistryChanges;
const disposition=failures.length?'FAIL':semanticChanged?'CHANGE':'NO_CHANGE';
if(!semanticChanged){
 requireCheck(manifest.snapshot_id===baselineMarker.snapshot_id,'no_change_snapshot_identity_churn',{base:baselineMarker.snapshot_id,candidate:manifest.snapshot_id});
 requireCheck(manifest.release_fingerprint_sha256===baselineMarker.release_fingerprint_sha256,'no_change_release_fingerprint_churn',{base:baselineMarker.release_fingerprint_sha256,candidate:manifest.release_fingerprint_sha256});
}
const report={
 schema_version:2,
 generated_at:new Date().toISOString(),
 mode:'ACTUAL_CANDIDATE_DIFF',
 status:disposition,
 base_ref:BASE_REF,
 base_release:{
  snapshot_id:baselineMarker.snapshot_id,
  release_fingerprint_sha256:baselineMarker.release_fingerprint_sha256,
  manifest_sha256:baselineMarker.manifest_sha256
 },
 candidate:{
  snapshot_id:manifest.snapshot_id,
  release_fingerprint_sha256:manifest.release_fingerprint_sha256,
  manifest_sha256:sha256(manifestBytes),
  release_gate_status:gate.status,
  content_fingerprint_sha256:candidateSemantic.sha256
 },
 summary:{
  entity_count_before:beforeEntities.length,
  entity_count_after:afterEntities.length,
  entity_added_count:added.length,
  entity_removed_count:removed.length,
  legal_identity_changed_count:legalChanged.length,
  classification_changed_count:classificationChanged.length,
  geometry_change_count:geometryChangedTotal,
  semantic_registry_changed_count:semanticRegistryChanges,
  component_hash_changed_count:componentChanges.length,
  entity_content_changed_count:entityContentChanged.length,
  semantic_content_changed:semanticChanged,
  base_content_fingerprint_sha256:baselineSemantic.sha256,
  candidate_content_fingerprint_sha256:candidateSemantic.sha256,
  substantive_change_count:substantiveChangeCount,
  review_required:semanticChanged
 },
 entities:{added_ids:added,removed_ids:removed,content_changed_ids:entityContentChanged,legal_identity_changed_ids:legalChanged,classification_changed_ids:classificationChanged,legal_change_samples:legalChangeSamples,classification_change_samples:classificationChangeSamples},
 geometry,
 official_registries:registries,
 component_hash_changes:componentChanges,
 failures,
 policy:'Candidate comparison is fail-closed on persisted-baseline integrity and candidate release-gate validity. Differences are reported, never auto-accepted. Promotion always requires explicit acknowledgement of the candidate snapshot.'
};
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
const diffBytes=await readFile(OUTPUT);
const marker={
 schema_version:1,
 mode:'ACTUAL_CANDIDATE',
 status:report.status,
 generated_at:report.generated_at,
 base_ref:BASE_REF,
 base_release:report.base_release,
 candidate:report.candidate,
 diff_report_path:OUTPUT,
 diff_report_sha256:sha256(diffBytes),
 review_required:report.summary.review_required,
 substantive_change_count:substantiveChangeCount,
 source:{workflow_run_id:process.env.GITHUB_RUN_ID??null,workflow_run_attempt:process.env.GITHUB_RUN_ATTEMPT??null,source_sha:process.env.GITHUB_SHA??null},
 policy:'NO_CHANGE candidates retain the persisted snapshot identity and cannot be promoted. CHANGE candidates may be promoted only while their persisted base remains unchanged and exact candidate bytes still pass the release gate.'
};
await writeFile(MARKER,JSON.stringify(marker,null,2)+'\n');
console.log(JSON.stringify({status:report.status,base_snapshot_id:report.base_release.snapshot_id,candidate_snapshot_id:report.candidate.snapshot_id,summary:report.summary,diff_report_sha256:marker.diff_report_sha256},null,2));
if(failures.length)process.exit(1);
