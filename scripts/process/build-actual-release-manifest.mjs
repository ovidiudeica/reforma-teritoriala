#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const OUTPUT='data/current/actual-release-manifest.json';
const PATHS={
 catalog:'data/current/entities.json',
 inventory:'data/current/administrative-inventory.json',
 ro_geojson:'public/geo/current/ro-administrative.geojson',
 md_geojson:'public/geo/current/md-administrative.geojson',
 public_index:'public/data/actual-entities.json',
 ro_overview:'public/geo/actual/ro-overview.geojson',
 ro_local:'public/geo/actual/ro-local.geojson',
 ro_detail:'public/geo/actual/ro-detail.geojson',
 md_overview:'public/geo/actual/md-overview.geojson',
 md_local:'public/geo/actual/md-local.geojson',
 md_detail:'public/geo/actual/md-detail.geojson',
 ro_gate:'data/current/ro-release-gate.json',
 md_gate:'data/current/md-release-gate.json',
 ro_official:'data/sources/ro-siruta-current.json',
 md_official:'data/sources/cuatm-current.json',
 md_individual_review:'data/sources/md-cuatm-individual-review.json',
 md_semantic_bridge:'data/current/md-cuatm-semantic-bridge.json',
 topology_audit:'data/current/actual-topology-audit.json',
 regression_audit:'data/current/actual-regression-audit.json',
 structural_completeness_audit:'data/current/actual-structural-completeness-audit.json',
 official_identity_audit:'data/current/actual-official-identity-audit.json',
 settlement_policy:'data/sources/actual-settlement-policy.json'
};
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const buffers=Object.fromEntries(await Promise.all(Object.entries(PATHS).map(async([key,path])=>[key,await readFile(path)])));
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
const topologyAudit=json('topology_audit');
const regressionAudit=json('regression_audit');
const structuralCompletenessAudit=json('structural_completeness_audit');
const officialIdentityAudit=json('official_identity_audit');
const mdSemanticBridge=json('md_semantic_bridge');
const settlementPolicy=json('settlement_policy');

const jurisdictions=['RO','MD'];
const entities=Array.isArray(catalog.entities)?catalog.entities:[];
const entityCounts=Object.fromEntries(jurisdictions.map(j=>[j,entities.filter(e=>e.jurisdiction===j).length]));
const featureCounts={
 RO:Array.isArray(roGeo.features)?roGeo.features.length:0,
 MD:Array.isArray(mdGeo.features)?mdGeo.features.length:0
};
const components=Object.fromEntries(Object.entries(PATHS).map(([key,path])=>[key,{
 path,
 sha256:sha256(buffers[key]),
 bytes:buffers[key].byteLength
}]));
const fingerprintPayload={
 mode:'ACTUAL',
 jurisdictions,
 components:Object.fromEntries(Object.entries(components).map(([key,value])=>[key,value.sha256]))
};
const releaseFingerprint=sha256(Buffer.from(JSON.stringify(fingerprintPayload),'utf8'));
const validTimes=[
 catalog.generated_at,roGate.generated_at,mdGate.generated_at,siruta.fetched_at,cuatm.fetched_at
].filter(Boolean).map(x=>new Date(x)).filter(x=>Number.isFinite(x.getTime()));
const generatedAt=(validTimes.length?new Date(Math.max(...validTimes.map(x=>x.getTime()))):new Date(0)).toISOString();
const tier=(jurisdiction,name)=>{
 const key=jurisdiction.toLowerCase()+'_'+name;
 const doc=json(key);
 return {
  path:PATHS[key],
  feature_count:Array.isArray(doc.features)?doc.features.length:0,
  sha256:components[key].sha256
 };
};

const manifest={
 schema_version:2,
 mode:'ACTUAL',
 snapshot_id:'actual-'+releaseFingerprint.slice(0,16),
 generated_at:generatedAt,
 release_fingerprint_sha256:releaseFingerprint,
 policy:'Immutable content fingerprint for the current public RO+MD administrative snapshot. The manifest binds validated master catalog/GeoJSON, official registries, jurisdiction gates, the public entity contract and tiered web geometries to exact bytes.',
 jurisdictions,
 catalog:{
  path:PATHS.catalog,
  schema_version:catalog.schema_version??null,
  generated_at:catalog.generated_at??null,
  classifier_version:catalog.classifier_version??null,
  source:catalog.source??null,
  license:catalog.license??null,
  entity_count:entities.length,
  declared_entity_count:catalog.entity_count??null,
  entity_count_by_jurisdiction:entityCounts,
  sha256:components.catalog.sha256
 },
 administrative_model:{
  path:PATHS.inventory,
  schema_version:inventory.schema_version??null,
  as_of:inventory.as_of??null,
  sha256:components.inventory.sha256
 },
 settlement_policy:{
  path:PATHS.settlement_policy,
  schema_version:settlementPolicy.schema_version??null,
  policy_version:settlementPolicy.policy_version??null,
  scope:settlementPolicy.scope??null,
  sha256:components.settlement_policy.sha256
 },
 geometry:{
  RO:{path:PATHS.ro_geojson,feature_count:featureCounts.RO,sha256:components.ro_geojson.sha256},
  MD:{path:PATHS.md_geojson,feature_count:featureCounts.MD,sha256:components.md_geojson.sha256}
 },
 public_contract:{
  path:PATHS.public_index,
  contract:publicIndex.contract??null,
  schema_version:publicIndex.schema_version??null,
  generated_at:publicIndex.generated_at??null,
  entity_count:publicIndex.entity_count??null,
  entity_count_by_jurisdiction:publicIndex.entity_count_by_jurisdiction??null,
  legal_identity_status_counts:publicIndex.legal_identity_status_counts??null,
  sha256:components.public_index.sha256,
  geometry_tiers:{
   RO:{overview:tier('RO','overview'),local:tier('RO','local'),detail:tier('RO','detail')},
   MD:{overview:tier('MD','overview'),local:tier('MD','local'),detail:tier('MD','detail')}
  }
 },
 semantic_bridges:{
  MD:{path:PATHS.md_semantic_bridge,status:mdSemanticBridge.status??null,summary:mdSemanticBridge.summary??null,sha256:components.md_semantic_bridge.sha256}
 },
 quality_gates:{
  topology:{path:PATHS.topology_audit,status:topologyAudit.status??null,blocking_issue_count:topologyAudit.blocking_issue_count??null,sha256:components.topology_audit.sha256},
  regression:{path:PATHS.regression_audit,status:regressionAudit.status??null,blocking_issue_count:regressionAudit.blocking_issue_count??null,sha256:components.regression_audit.sha256},
  structural_completeness:{path:PATHS.structural_completeness_audit,status:structuralCompletenessAudit.status??null,blocking_gap_count:structuralCompletenessAudit.blocking_gap_count??null,blocking_policy_violation_count:structuralCompletenessAudit.blocking_policy_violation_count??null,blocking_issue_count:structuralCompletenessAudit.blocking_issue_count??null,sha256:components.structural_completeness_audit.sha256},
  official_identity:{path:PATHS.official_identity_audit,status:officialIdentityAudit.status??null,blocking_issue_count:officialIdentityAudit.blocking_issue_count??null,sha256:components.official_identity_audit.sha256}
 },
 jurisdiction_gates:{
  RO:{path:PATHS.ro_gate,status:roGate.status??null,generated_at:roGate.generated_at??null,sha256:components.ro_gate.sha256},
  MD:{path:PATHS.md_gate,status:mdGate.status??null,generated_at:mdGate.generated_at??null,sha256:components.md_gate.sha256}
 },
 official_sources:{
  RO:{
   registry:siruta.registry??'SIRUTA',
   authority:siruta.authority??null,
   path:PATHS.ro_official,
   reference_year:siruta.reference_year??null,
   fetched_at:siruta.fetched_at??null,
   record_count:siruta.record_count??(Array.isArray(siruta.records)?siruta.records.length:null),
   source_content_sha256:siruta.source?.content_sha256??null,
   semantic_sha256:siruta.semantic_sha256??null,
   sha256:components.ro_official.sha256
  },
  MD:{
   registry:'CUATM',
   authority:'Biroul Național de Statistică al Republicii Moldova',
   path:PATHS.md_official,
   source_url:cuatm.source_url??null,
   fetched_at:cuatm.fetched_at??null,
   record_count:cuatm.record_count??(Array.isArray(cuatm.records)?cuatm.records.length:null),
   sha256:components.md_official.sha256
  }
 },
 components
};

await mkdir('data/current',{recursive:true});
await writeFile(OUTPUT,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({
 snapshot_id:manifest.snapshot_id,
 generated_at:manifest.generated_at,
 release_fingerprint_sha256:manifest.release_fingerprint_sha256,
 entity_count:manifest.catalog.entity_count,
 public_contract:manifest.public_contract.contract,
 feature_count:{RO:manifest.geometry.RO.feature_count,MD:manifest.geometry.MD.feature_count},
 gates:{RO:manifest.jurisdiction_gates.RO.status,MD:manifest.jurisdiction_gates.MD.status}
},null,2));
