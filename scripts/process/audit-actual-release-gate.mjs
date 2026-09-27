#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const MANIFEST='data/current/actual-release-manifest.json';
const TOPOLOGY_AUDIT='data/current/actual-topology-audit.json';
const topologyRun=spawnSync(process.execPath,['scripts/process/audit-actual-topology.mjs'],{encoding:'utf8'});
let topology=null;
try{topology=JSON.parse(await readFile(TOPOLOGY_AUDIT,'utf8'));}catch{}

const OUTPUT='data/current/actual-release-gate.json';
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const manifestBuf=await readFile(MANIFEST);
const manifest=JSON.parse(manifestBuf.toString('utf8'));
const paths=Object.fromEntries(Object.entries(manifest.components||{}).map(([key,value])=>[key,value?.path]).filter(([,path])=>path));
const buffers={};
for(const [key,path] of Object.entries(paths))buffers[key]=await readFile(path);
const json=key=>JSON.parse(buffers[key].toString('utf8'));
const catalog=json('catalog');
const inventory=json('inventory');
const roGeo=json('ro_geojson');
const mdGeo=json('md_geojson');
const publicIndex=json('public_index');
const roGate=json('ro_gate');
const mdGate=json('md_gate');
const siruta=json('ro_official');
const cuatm=json('md_official');
const mdIndividual=json('md_individual_review');
const jurisdictions=['RO','MD'];
const tierKeys=['ro_overview','ro_local','ro_detail','md_overview','md_local','md_detail'];
const entities=Array.isArray(catalog.entities)?catalog.entities:[];
const entityCounts=Object.fromEntries(jurisdictions.map(j=>[j,entities.filter(e=>e.jurisdiction===j).length]));
const featureCounts={
 RO:Array.isArray(roGeo.features)?roGeo.features.length:0,
 MD:Array.isArray(mdGeo.features)?mdGeo.features.length:0
};
const currentHashes=Object.fromEntries(Object.entries(buffers).map(([key,buf])=>[key,sha256(buf)]));
const fingerprintPayload={
 mode:'ACTUAL',
 jurisdictions,
 components:Object.fromEntries(Object.keys(manifest.components||{}).map(key=>[key,currentHashes[key]??null]))
};
const fingerprint=sha256(Buffer.from(JSON.stringify(fingerprintPayload),'utf8'));
const expectedSnapshotId='actual-'+fingerprint.slice(0,16);
const failures=[],checks=[];
const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};

check('master_topology_audit_passes',topologyRun.status===0&&topology?.status==='PASS',{status:topology?.status??null,blocking_issue_count:topology?.blocking_issue_count??null,observation_count:topology?.observation_count??null,process_status:topologyRun.status,error:topologyRun.error?String(topologyRun.error):null});

check('manifest_mode_is_actual',manifest.mode==='ACTUAL',{mode:manifest.mode});
check('manifest_jurisdictions_are_exactly_ro_md',
 Array.isArray(manifest.jurisdictions)&&manifest.jurisdictions.length===2&&manifest.jurisdictions[0]==='RO'&&manifest.jurisdictions[1]==='MD',
 {jurisdictions:manifest.jurisdictions});
check('jurisdiction_release_gates_pass',roGate.status==='PASS'&&mdGate.status==='PASS',{RO:roGate.status,MD:mdGate.status});
check('manifest_records_passing_jurisdiction_gates',
 manifest.jurisdiction_gates?.RO?.status==='PASS'&&manifest.jurisdiction_gates?.MD?.status==='PASS',
 {RO:manifest.jurisdiction_gates?.RO?.status,MD:manifest.jurisdiction_gates?.MD?.status});

const componentDrift=[];
for(const [key,entry] of Object.entries(manifest.components||{})){
 const actual=currentHashes[key]??null;
 if(actual!==entry?.sha256)componentDrift.push({key,path:entry?.path??null,expected:entry?.sha256??null,actual});
}
check('manifest_component_hashes_match_current_snapshot',componentDrift.length===0,{drift:componentDrift});
check('release_fingerprint_matches_current_components',
 manifest.release_fingerprint_sha256===fingerprint,
 {expected:manifest.release_fingerprint_sha256,actual:fingerprint});
check('snapshot_id_matches_release_fingerprint',manifest.snapshot_id===expectedSnapshotId,{expected:expectedSnapshotId,actual:manifest.snapshot_id});

const validTimes=[
 catalog.generated_at,roGate.generated_at,mdGate.generated_at,siruta.fetched_at,cuatm.fetched_at
].filter(Boolean).map(x=>new Date(x)).filter(x=>Number.isFinite(x.getTime()));
const expectedGeneratedAt=(validTimes.length?new Date(Math.max(...validTimes.map(x=>x.getTime()))):new Date(0)).toISOString();
check('manifest_generated_at_matches_snapshot_watermark',manifest.generated_at===expectedGeneratedAt,{expected:expectedGeneratedAt,actual:manifest.generated_at});

check('catalog_declared_entity_count_is_consistent',catalog.entity_count===entities.length,{declared:catalog.entity_count,actual:entities.length});
check('manifest_catalog_entity_count_is_current',
 manifest.catalog?.entity_count===entities.length&&manifest.catalog?.declared_entity_count===catalog.entity_count,
 {manifest:manifest.catalog?.entity_count,catalog_declared:catalog.entity_count,actual:entities.length});
check('actual_catalog_contains_current_entities_only',
 entities.every(e=>e.status==='current'),
 {non_current:entities.filter(e=>e.status!=='current').slice(0,25).map(e=>({id:e.id,status:e.status}))});
check('manifest_jurisdiction_entity_counts_are_current',
 jurisdictions.every(j=>manifest.catalog?.entity_count_by_jurisdiction?.[j]===entityCounts[j]),
 {manifest:manifest.catalog?.entity_count_by_jurisdiction,actual:entityCounts});
check('manifest_classifier_version_is_current',
 manifest.catalog?.classifier_version===catalog.classifier_version,
 {manifest:manifest.catalog?.classifier_version,actual:catalog.classifier_version});
check('manifest_administrative_model_is_current',
 manifest.administrative_model?.schema_version===inventory.schema_version&&manifest.administrative_model?.as_of===inventory.as_of,
 {manifest:manifest.administrative_model,actual:{schema_version:inventory.schema_version,as_of:inventory.as_of}});

check('public_geojson_feature_counts_are_nonzero',featureCounts.RO>0&&featureCounts.MD>0,featureCounts);
check('manifest_public_geojson_feature_counts_are_current',
 manifest.geometry?.RO?.feature_count===featureCounts.RO&&manifest.geometry?.MD?.feature_count===featureCounts.MD,
 {manifest:{RO:manifest.geometry?.RO?.feature_count,MD:manifest.geometry?.MD?.feature_count},actual:featureCounts});

const publicEntities=Array.isArray(publicIndex.entities)?publicIndex.entities:[];
const publicIds=new Set(publicEntities.map(x=>x.id));
const catalogIds=new Set(entities.map(x=>x.id));
const missingPublic=[...catalogIds].filter(id=>!publicIds.has(id));
const unexpectedPublic=[...publicIds].filter(id=>!catalogIds.has(id));
check('public_contract_identity_set_matches_catalog',
 publicIndex.contract==='actual-public-entity-v1'&&publicEntities.length===entities.length&&missingPublic.length===0&&unexpectedPublic.length===0,
 {contract:publicIndex.contract,public_count:publicEntities.length,catalog_count:entities.length,missing:missingPublic.slice(0,25),unexpected:unexpectedPublic.slice(0,25)});
check('public_contract_contains_current_entities_only',
 publicEntities.every(x=>x.status==='current'),
 {non_current:publicEntities.filter(x=>x.status!=='current').slice(0,25).map(x=>({id:x.id,status:x.status}))});
check('public_contract_separates_legal_and_representation',
 publicEntities.every(x=>Object.prototype.hasOwnProperty.call(x,'legal')&&x.representation?.source==='OpenStreetMap'&&x.representation?.geometry_role==='current_representation'),
 {invalid:publicEntities.filter(x=>!Object.prototype.hasOwnProperty.call(x,'legal')||x.representation?.source!=='OpenStreetMap'||x.representation?.geometry_role!=='current_representation').slice(0,25).map(x=>x.id)});
check('public_contract_jurisdiction_counts_match_catalog',
 jurisdictions.every(j=>publicIndex.entity_count_by_jurisdiction?.[j]===entityCounts[j]),
 {public:publicIndex.entity_count_by_jurisdiction,actual:entityCounts});

const reviewedPublicById=new Map(publicEntities.map(x=>[x.id,x]));
const reviewedStatusIssues=(mdIndividual.cases||[]).flatMap(review=>{
 const entity=reviewedPublicById.get(review.osm_id);
 const expected=review.review_status==='resolved_semantic_classification'
  ?'reviewed_representation_without_legal_identity'
  :review.review_status==='unresolved_identity'?'unresolved':null;
 return entity&&expected&&entity.validation?.legal_identity_status===expected
  ?[]
  :[{osm_id:review.osm_id,review_status:review.review_status,expected,actual:entity?.validation?.legal_identity_status??null}];
});
check('md_reviewed_public_identity_status_is_stable',reviewedStatusIssues.length===0,{issues:reviewedStatusIssues});

const tierDocs=Object.fromEntries(tierKeys.map(key=>[key,json(key)]));
const tierIssues=[];
const fidelityIssues=[];
const seenGeometryIds=new Set();
const publicById=new Map(publicEntities.map(x=>[x.id,x]));
const masterGeometryById=new Map(
 [...(roGeo.features||[]),...(mdGeo.features||[])]
  .filter(f=>f.properties?.catalog_id)
  .map(f=>[f.properties.catalog_id,f.geometry])
);
for(const key of tierKeys){
 const doc=tierDocs[key];
 const [jurisdictionRaw,tier]=key.split('_');
 const jurisdiction=jurisdictionRaw.toUpperCase();
 for(const f of doc.features||[]){
  const p=f.properties||{};
  const entity=publicById.get(p.entity_id);
  if(!entity)tierIssues.push({key,entity_id:p.entity_id,issue:'unknown_entity'});
  if(entity&&entity.jurisdiction!==jurisdiction)tierIssues.push({key,entity_id:p.entity_id,issue:'jurisdiction_mismatch'});
  if(entity&&entity.map?.tier!==tier)tierIssues.push({key,entity_id:p.entity_id,issue:'tier_mismatch',expected:entity.map?.tier});
  if('tags' in p)tierIssues.push({key,entity_id:p.entity_id,issue:'raw_tags_leaked'});
  if(p.geometry_precision!=='master_coordinate_fidelity')fidelityIssues.push({key,entity_id:p.entity_id,issue:'precision_marker_mismatch',actual:p.geometry_precision??null});
  const masterGeometry=masterGeometryById.get(p.entity_id);
  if(!masterGeometry)fidelityIssues.push({key,entity_id:p.entity_id,issue:'master_geometry_missing'});
  else if(JSON.stringify(f.geometry)!==JSON.stringify(masterGeometry))fidelityIssues.push({key,entity_id:p.entity_id,issue:'coordinate_drift'});
  if(seenGeometryIds.has(p.entity_id))tierIssues.push({key,entity_id:p.entity_id,issue:'duplicate_public_geometry'});
  seenGeometryIds.add(p.entity_id);
 }
}
const missingGeometry=[...publicIds].filter(id=>!seenGeometryIds.has(id));
check('tiered_public_geometry_matches_public_contract',
 tierIssues.length===0&&missingGeometry.length===0&&seenGeometryIds.size===publicEntities.length,
 {issues:tierIssues.slice(0,25),missing:missingGeometry.slice(0,25),geometry_count:seenGeometryIds.size,entity_count:publicEntities.length});
check('tiered_public_geometry_preserves_master_coordinates',
 fidelityIssues.length===0,
 {issues:fidelityIssues.slice(0,25),checked_geometry_count:seenGeometryIds.size});

const publicTierCounts={
 RO:['ro_overview','ro_local','ro_detail'].reduce((n,key)=>n+(tierDocs[key].features||[]).length,0),
 MD:['md_overview','md_local','md_detail'].reduce((n,key)=>n+(tierDocs[key].features||[]).length,0)
};
check('tiered_public_geometry_cardinality_matches_master',
 publicTierCounts.RO===featureCounts.RO&&publicTierCounts.MD===featureCounts.MD,
 {public:publicTierCounts,master:featureCounts});
check('manifest_public_contract_is_current',
 manifest.public_contract?.contract===publicIndex.contract
 && manifest.public_contract?.entity_count===publicIndex.entity_count
 && manifest.public_contract?.sha256===currentHashes.public_index,
 {manifest:manifest.public_contract,actual:{contract:publicIndex.contract,entity_count:publicIndex.entity_count,sha256:currentHashes.public_index}});

check('manifest_jurisdiction_gate_timestamps_are_current',
 manifest.jurisdiction_gates?.RO?.generated_at===roGate.generated_at&&manifest.jurisdiction_gates?.MD?.generated_at===mdGate.generated_at,
 {manifest:{RO:manifest.jurisdiction_gates?.RO?.generated_at,MD:manifest.jurisdiction_gates?.MD?.generated_at},actual:{RO:roGate.generated_at,MD:mdGate.generated_at}});

const sirutaCount=siruta.record_count??(Array.isArray(siruta.records)?siruta.records.length:null);
const cuatmCount=cuatm.record_count??(Array.isArray(cuatm.records)?cuatm.records.length:null);
check('manifest_ro_official_source_is_current',
 manifest.official_sources?.RO?.reference_year===siruta.reference_year
 && manifest.official_sources?.RO?.fetched_at===siruta.fetched_at
 && manifest.official_sources?.RO?.record_count===sirutaCount
 && manifest.official_sources?.RO?.semantic_sha256===(siruta.semantic_sha256??null)
 && manifest.official_sources?.RO?.source_content_sha256===(siruta.source?.content_sha256??null),
 {manifest:manifest.official_sources?.RO,actual:{reference_year:siruta.reference_year,fetched_at:siruta.fetched_at,record_count:sirutaCount}});
check('manifest_md_official_source_is_current',
 manifest.official_sources?.MD?.source_url===(cuatm.source_url??null)
 && manifest.official_sources?.MD?.fetched_at===(cuatm.fetched_at??null)
 && manifest.official_sources?.MD?.record_count===cuatmCount,
 {manifest:manifest.official_sources?.MD,actual:{source_url:cuatm.source_url??null,fetched_at:cuatm.fetched_at??null,record_count:cuatmCount}});

const report={
 schema_version:2,
 generated_at:new Date().toISOString(),
 mode:'ACTUAL',
 snapshot_id:manifest.snapshot_id??null,
 manifest_path:MANIFEST,
 manifest_sha256:sha256(manifestBuf),
 status:failures.length?'FAIL':'PASS',
 policy:'The public ACTUAL RO+MD release is publishable only when master topology has no blocking structural corruption, both jurisdiction gates pass, the manifest fingerprints exact master and public bytes, the public entity contract matches the catalog identity set one-to-one, and every tiered web geometry maps to exactly one current contract entity while preserving master coordinates without simplification. Any drift fails closed.',
 checks,
 failures
};
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
