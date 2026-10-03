#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const CATALOG='data/current/entities.json';
const GEO='public/geo/current/ro-administrative.geojson';
const RECON='data/current/ro-official-reconciliation.json';
const SNAPSHOT='data/sources/ro-siruta-current.json';
const COUNTY_BRIDGE='data/current/ro-county-siruta-bridge.json';
const ANCPI_FALLBACKS='data/sources/ro-ancpi-uat-fallbacks.json';
const OFFICIAL_ONLY_RESOLUTIONS='data/sources/ro-official-only-reviewed-resolutions.json';
const SETTLEMENT_POLICY='data/sources/actual-settlement-policy.json';
const OUTPUT='data/current/ro-official-application.json';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const catalog=await read(CATALOG);
const geo=await read(GEO);
const reconciliation=await read(RECON);
const official=await read(SNAPSHOT);
const countyBridge=await read(COUNTY_BRIDGE);
const ancpiFallbacks=await read(ANCPI_FALLBACKS);
const officialOnlyResolutions=await read(OFFICIAL_ONLY_RESOLUTIONS);
const settlementPolicy=await read(SETTLEMENT_POLICY);
const ancpiFallbackBinding=settlementPolicy?.administrative_geometry_fallbacks?.RO??null;

if(reconciliation.status!=='PASS')throw new Error('RO official reconciliation is not PASS');
if(countyBridge.status!=='PASS')throw new Error('RO county SIRUTA bridge is not PASS');
if(reconciliation.summary?.unmatched_osm_count!==0)throw new Error('Cannot apply SIRUTA with unmatched RO level-8 entities');
if(reconciliation.summary?.duplicate_legal_mapping_count!==0)throw new Error('Cannot apply SIRUTA with duplicate legal mappings');
if(ancpiFallbackBinding){
 if(ancpiFallbackBinding.path!==ANCPI_FALLBACKS||ancpiFallbackBinding.mode!=='ACTUAL_RO_ANCPI_UAT_FALLBACKS')throw new Error('Invalid ANCPI fallback policy binding');
 if(ancpiFallbacks.schema_version!==1||ancpiFallbacks.mode!=='ACTUAL_RO_ANCPI_UAT_FALLBACKS')throw new Error('Invalid ANCPI fallback source');
 if(ancpiFallbacks.source?.authority!=='Agenția Națională de Cadastru și Publicitate Imobiliară'||ancpiFallbacks.source?.arcgis_item_id!=='466b7199c19f4904831e14bc7f407af9')throw new Error('Unexpected ANCPI fallback provenance');
}

const entities=catalog.entities||[];
const roLevel8=entities.filter(e=>e.jurisdiction==='RO'&&Number(e.osm?.admin_level)===8);
const roCounties=entities.filter(e=>e.jurisdiction==='RO'&&Number(e.osm?.admin_level)===4);
const matches=reconciliation.matches||[];
const countyMatches=countyBridge.matches||[];
if(roCounties.length!==42||countyMatches.length!==42){
 throw new Error(`RO county bridge/application cardinality mismatch: catalog=${roCounties.length}, bridge=${countyMatches.length}, expected=42`);
}
const countyMatchById=new Map();
const countyCodes=new Set();
for(const m of countyMatches){
 if(!m.entity_id||!m.county_code)throw new Error('Invalid RO county bridge row: '+JSON.stringify(m));
 if(countyMatchById.has(m.entity_id))throw new Error('Duplicate RO county bridge entity: '+m.entity_id);
 if(countyCodes.has(String(m.county_code)))throw new Error('Duplicate RO county SIRUTA code: '+m.county_code);
 countyMatchById.set(m.entity_id,m);countyCodes.add(String(m.county_code));
}
if(matches.length!==roLevel8.length){
 throw new Error(`Reconciliation/application cardinality mismatch: matches=${matches.length}, level8=${roLevel8.length}`);
}

const byRelation=new Map(roLevel8.map(e=>[Number(e.osm?.relation_id),e]));
const featureByCatalogId=new Map((geo.features||[]).map(f=>[f.properties?.catalog_id,f]));
const applied=[],countyApplied=[],fallbackApplied=[],typeChanges=[],parentConflicts=[],missing=[];

for(const m of matches){
 const relationId=Number(m.osm_relation_id);
 const e=byRelation.get(relationId);
 if(!e){missing.push({osm_relation_id:relationId,legal_id:m.legal_id});continue;}
 const legalType=m.legal_type;
 if(!['municipality','town','commune','sector'].includes(legalType)){
  throw new Error('Unsupported SIRUTA legal type '+legalType+' for relation '+relationId);
 }
 const oldType=e.type;
 const legal={
  registry:'SIRUTA',
  reference_year:Number(official.reference_year)||2026,
  id:String(m.legal_id),
  name:m.legal_name||null,
  type:legalType,
  parent_id:m.legal_parent_id==null?null:String(m.legal_parent_id),
  parent_name:m.legal_parent_name||null,
  match_method:m.match_method||null,
  match_confidence:m.confidence||null,
  source:SNAPSHOT,
  reconciliation:RECON,
  parent_matches_osm_geometry_parent:m.parent_matches
 };
 e.legal=legal;
 e.type=legalType;
 e.review_required=false;
 e.classification={
  ...(e.classification||{}),
  confidence:'high',
  reason:'Legal UAT type resolved from official INS SIRUTA 2026 reconciliation; OSM geometry and tags remain provenance/representation evidence.',
  evidence:RECON,
  osm_inferred_type:e.classification?.osm_inferred_type||oldType,
  official_registry:'SIRUTA',
  official_legal_id:String(m.legal_id)
 };
 const f=featureByCatalogId.get(e.id);
 if(!f)throw new Error('Missing RO GeoJSON feature for '+e.id);
 f.properties=f.properties||{};
 if(f.properties.osm_inferred_entity_type==null)f.properties.osm_inferred_entity_type=f.properties.entity_type||oldType||null;
 f.properties.entity_type=legalType;
 f.properties.classification_confidence='high';
 f.properties.legal_registry='SIRUTA';
 f.properties.legal_id=String(m.legal_id);
 f.properties.legal_name=m.legal_name||null;
 f.properties.legal_type=legalType;
 f.properties.legal_parent_id=m.legal_parent_id==null?null:String(m.legal_parent_id);
 f.properties.legal_parent_name=m.legal_parent_name||null;
 f.properties.legal_match_method=m.match_method||null;
 f.properties.legal_parent_matches_osm_geometry_parent=m.parent_matches;
 if(oldType!==legalType)typeChanges.push({osm_relation_id:relationId,name:e.name,osm_inferred_type:oldType,official_legal_type:legalType,legal_id:String(m.legal_id)});
 if(m.parent_matches===false)parentConflicts.push({
  osm_relation_id:relationId,name:e.name,osm_geometry_parent_id:e.parent_id,
  osm_geometry_parent_name:m.osm_parent_name||null,legal_id:String(m.legal_id),
  legal_parent_id:m.legal_parent_id==null?null:String(m.legal_parent_id),legal_parent_name:m.legal_parent_name||null
 });
 applied.push({osm_relation_id:relationId,legal_id:String(m.legal_id),legal_type:legalType,match_method:m.match_method||null});
}
if(missing.length)throw new Error('Missing reconciled entities: '+JSON.stringify(missing));

for(const e of roCounties){
 const m=countyMatchById.get(e.id);
 if(!m)throw new Error('Missing RO county bridge mapping for '+e.id);
 const relationId=Number(e.osm?.relation_id);
 if(Number(m.osm_relation_id)!==relationId)throw new Error(`RO county bridge relation mismatch for ${e.id}: catalog=${relationId}, bridge=${m.osm_relation_id}`);
 const code=String(m.county_code);
 const legal={
  registry:'SIRUTA',
  reference_year:Number(official.reference_year)||2026,
  id:code,
  name:m.official_name||e.name||null,
  type:'county',
  parent_id:null,
  parent_name:'România',
  match_method:m.match_method||'exact_normalized_county_name',
  match_confidence:'high',
  source:SNAPSHOT,
  reconciliation:COUNTY_BRIDGE,
  parent_matches_osm_geometry_parent:true
 };
 e.legal=legal;
 e.type='county';
 e.review_required=false;
 e.classification={
  ...(e.classification||{}),
  confidence:'high',
  reason:'County legal identity resolved from the exhaustive 1:1 SIRUTA county-code bridge; OSM remains the geometry/provenance representation.',
  evidence:COUNTY_BRIDGE,
  osm_inferred_type:e.classification?.osm_inferred_type||'county',
  official_registry:'SIRUTA',
  official_legal_id:code
 };
 const f=featureByCatalogId.get(e.id);
 if(!f)throw new Error('Missing RO county GeoJSON feature for '+e.id);
 f.properties=f.properties||{};
 if(f.properties.osm_inferred_entity_type==null)f.properties.osm_inferred_entity_type=f.properties.entity_type||'county';
 f.properties.entity_type='county';
 f.properties.classification_confidence='high';
 f.properties.legal_registry='SIRUTA';
 f.properties.legal_id=code;
 f.properties.legal_name=legal.name;
 f.properties.legal_type='county';
 f.properties.legal_parent_id=null;
 f.properties.legal_parent_name='România';
 f.properties.legal_match_method=legal.match_method;
 f.properties.legal_parent_matches_osm_geometry_parent=true;
 countyApplied.push({entity_id:e.id,osm_relation_id:relationId,legal_id:code,legal_type:'county',match_method:legal.match_method});
}

const officialBySiruta=new Map((official.records||[]).map(r=>[String(r.siruta),r]));
const resolutionByLegalId=new Map((officialOnlyResolutions.items||[]).map(r=>[String(r.legal_id),r]));
for(const fallback of ancpiFallbackBinding?(ancpiFallbacks.features||[]):[]){
 const legalId=String(fallback.legal_id||'');
 if(!(ancpiFallbackBinding.legal_ids||[]).map(String).includes(legalId))throw new Error('ANCPI fallback legal ID is not policy-authorized '+legalId);
 const officialRow=officialBySiruta.get(legalId);
 const resolution=resolutionByLegalId.get(legalId);
 if(!officialRow||Number(officialRow.level)!==2)throw new Error('ANCPI fallback legal ID is not a current SIRUTA UAT '+legalId);
 if(!resolution||!['official_uat_without_distinct_osm_boundary_representation','osm_boundary_conflicts_with_official_ancpi_uat_geometry'].includes(resolution.classification))throw new Error('ANCPI fallback lacks reviewed geometry resolution '+legalId);
 if(String(fallback.national_code)!==legalId||fallback.geometry_role!=='administrative_boundary'||fallback.geometry_scope!=='uat_fallback')throw new Error('ANCPI fallback metadata mismatch '+legalId);
 if(!['Polygon','MultiPolygon'].includes(fallback.geometry?.type)||!Array.isArray(fallback.geometry?.coordinates)||!fallback.geometry.coordinates.length)throw new Error('ANCPI fallback geometry invalid '+legalId);
 const parentId='osm-r'+String(resolution.expected_parent_osm_relation_id);
 const parent=entities.find(e=>e.id===parentId);
 if(!parent||parent.jurisdiction!=='RO'||parent.type!=='county')throw new Error('ANCPI fallback parent is not the reviewed county '+legalId);

 if(resolution.classification==='osm_boundary_conflicts_with_official_ancpi_uat_geometry'){
  const entity=entities.find(e=>String(e.legal?.id||'')===legalId);
  if(!entity)throw new Error('Reviewed ANCPI geometry override lacks existing reconciled entity '+legalId);
  if(Number(entity.osm?.relation_id)!==Number(resolution.osm_relation_id))throw new Error('Reviewed ANCPI geometry override OSM relation mismatch '+legalId);
  const feature=featureByCatalogId.get(entity.id);
  if(!feature)throw new Error('Reviewed ANCPI geometry override lacks master feature '+legalId);
  entity.representation={
   ...(entity.representation||{}),
   source:'ANCPI RELUAT',
   admin_level:8,
   source_object_id:fallback.source_object_id,
   inspire_id_local_id:fallback.inspire_id_local_id,
   inspire_id_version_id:fallback.inspire_id_version_id,
   national_code:fallback.national_code
  };
  entity.geometry={role:'administrative_boundary',scope:'uat_fallback',legal_geometry_equivalence_asserted:false};
  entity.classification={
   ...(entity.classification||{}),
   confidence:'high',
   reason:'Reviewed OSM UAT boundary materially conflicts with the official ANCPI/RELUAT UAT polygon; legal SIRUTA identity and stable catalog ID are preserved while only the geometry representation is replaced.',
   evidence:ANCPI_FALLBACKS,
   official_registry:'SIRUTA',
   official_legal_id:legalId
  };
  entity.source='ANCPI RELUAT';
  entity.source_url=ancpiFallbacks.source?.source_url||null;
  entity.imported_at=ancpiFallbacks.source?.item_modified_at||null;
  feature.geometry=fallback.geometry;
  feature.properties={...(feature.properties||{}),geometry_role:'administrative_boundary',geometry_scope:'uat_fallback',source:'ANCPI RELUAT',source_object_id:fallback.source_object_id,inspire_id_local_id:fallback.inspire_id_local_id,national_code:fallback.national_code};
  fallbackApplied.push({action:'replace_existing_geometry',entity_id:entity.id,legal_id:legalId,legal_type:entity.legal?.type||fallback.legal_type,parent_id:entity.parent_id,source_object_id:fallback.source_object_id,inspire_id_local_id:fallback.inspire_id_local_id});
  continue;
 }

 const id='siruta-u'+legalId;
 if(!legalId||entities.some(e=>e.id===id)||entities.some(e=>String(e.legal?.id||'')===legalId))throw new Error('Duplicate/invalid ANCPI fallback identity '+legalId);
 const legal={
  registry:'SIRUTA',
  reference_year:Number(official.reference_year)||2026,
  id:legalId,
  name:officialRow.name||fallback.name||null,
  type:officialRow.legal_type||fallback.legal_type||null,
  parent_id:officialRow.parent_siruta==null?null:String(officialRow.parent_siruta),
  parent_name:officialRow.county_name||officialRow.parent_name||resolution.legal_parent_name||null,
  match_method:'exact_siruta_national_code_ancpi_fallback',
  match_confidence:'high',
  source:SNAPSHOT,
  geometry_source:ANCPI_FALLBACKS,
  parent_matches_osm_geometry_parent:true,
  geometry_equivalence_asserted:false
 };
 if(legal.type!=='commune'||String(resolution.legal_type)!==legal.type)throw new Error('ANCPI fallback legal type mismatch '+legalId);
 const entity={
  id,name:legal.name,official_name:legal.name,jurisdiction:'RO',category:'administrative',type:legal.type,status:'current',parent_id:parentId,
  representation:{source:'ANCPI RELUAT',admin_level:8,source_object_id:fallback.source_object_id,inspire_id_local_id:fallback.inspire_id_local_id,inspire_id_version_id:fallback.inspire_id_version_id,national_code:fallback.national_code},
  geometry:{role:'administrative_boundary',scope:'uat_fallback',legal_geometry_equivalence_asserted:false},
  classification:{version:catalog.classifier_version??null,confidence:'high',reason:'Current UAT geometry supplied by ANCPI/RELUAT as a reviewed fallback because OSM has no distinct boundary relation.',evidence:ANCPI_FALLBACKS,official_registry:'SIRUTA',official_legal_id:legalId},
  legal,source:'ANCPI RELUAT',source_url:ancpiFallbacks.source?.source_url||null,imported_at:ancpiFallbacks.source?.item_modified_at||null,review_required:false
 };
 const feature={type:'Feature',properties:{catalog_id:id,parent_id:parentId,jurisdiction:'RO',entity_type:legal.type,classification_confidence:'high',geometry_role:'administrative_boundary',geometry_scope:'uat_fallback',legal_registry:'SIRUTA',legal_id:legalId,legal_name:legal.name,legal_type:legal.type,legal_parent_id:legal.parent_id,legal_parent_name:legal.parent_name,legal_match_method:legal.match_method,legal_parent_matches_osm_geometry_parent:true,source:'ANCPI RELUAT',source_object_id:fallback.source_object_id,inspire_id_local_id:fallback.inspire_id_local_id,national_code:fallback.national_code},geometry:fallback.geometry};
 entities.push(entity); geo.features.push(feature); featureByCatalogId.set(id,feature);
 fallbackApplied.push({action:'add_missing_uat',entity_id:id,legal_id:legalId,legal_type:legal.type,parent_id:parentId,source_object_id:fallback.source_object_id,inspire_id_local_id:fallback.inspire_id_local_id});
}
catalog.entity_count=entities.length;

catalog.official_reconciliation={
 ...(catalog.official_reconciliation||{}),
 RO:{
  registry:'SIRUTA',
  reference_year:Number(official.reference_year)||2026,
  applied_at:new Date().toISOString(),
  source:SNAPSHOT,
  reconciliation:RECON,
  county_bridge:COUNTY_BRIDGE,
  ancpi_uat_fallbacks:ANCPI_FALLBACKS,
  applied_count:applied.length,
  county_applied_count:countyApplied.length,
  ancpi_fallback_applied_count:fallbackApplied.length
 }
};

const semanticConflicts=(reconciliation.type_mismatches||[]).map(x=>({
 osm_relation_id:x.osm_relation_id,
 name:x.osm_name,
 osm_claimed_legal_type:x.osm_claimed_legal_type||null,
 official_legal_type:x.legal_type,
 legal_id:String(x.legal_id)
}));

const failures=[];
const checks=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)failures.push({name,detail});};
check('all_ro_level8_entities_applied',applied.length===roLevel8.length,{applied_count:applied.length,ro_level8_count:roLevel8.length});
check('all_applied_entities_have_siruta_legal_identity',roLevel8.every(e=>e.legal?.registry==='SIRUTA'&&e.legal?.id&&e.type===e.legal.type),{});
check('all_ro_level8_geojson_features_have_siruta_identity',roLevel8.every(e=>featureByCatalogId.get(e.id)?.properties?.legal_registry==='SIRUTA'),{});
check('all_42_ro_counties_applied',roCounties.length===42&&countyApplied.length===42,{catalog_count:roCounties.length,applied_count:countyApplied.length});
check('all_ro_counties_have_siruta_county_identity',roCounties.every(e=>e.legal?.registry==='SIRUTA'&&e.legal?.type==='county'&&e.legal?.id&&countyCodes.has(String(e.legal.id))),{});
check('all_ro_county_geojson_features_have_siruta_identity',roCounties.every(e=>{
 const p=featureByCatalogId.get(e.id)?.properties;return p?.legal_registry==='SIRUTA'&&p?.legal_type==='county'&&String(p?.legal_id||'')===String(e.legal?.id||'');
}),{});
check('ancpi_reviewed_uat_geometry_fallbacks_are_exact',
 !ancpiFallbackBinding
 ||(fallbackApplied.length===2
   &&fallbackApplied.some(x=>x.action==='add_missing_uat'&&x.entity_id==='siruta-u64096'&&x.legal_id==='64096')
   &&fallbackApplied.some(x=>x.action==='replace_existing_geometry'&&x.entity_id==='osm-r14735731'&&x.legal_id==='64602')),
 {enabled:Boolean(ancpiFallbackBinding),fallback_applied:fallbackApplied});

const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'RO',
 status:failures.length?'FAIL':'PASS',
 policy:'SIRUTA is authoritative for RO legal identity/type and the exhaustive county/UAT inventory. OSM remains the primary geometry source. A reviewed UAT may use an exact materialized ANCPI/RELUAT polygon when OSM lacks a distinct boundary or when the OSM polygon materially conflicts with the reviewed official UAT geometry; provenance remains separate from legal identity.',
 source:{official_snapshot:SNAPSHOT,reconciliation:RECON,ancpi_uat_fallbacks:ANCPI_FALLBACKS},
 checks,
 summary:{
  ro_level8_count:roLevel8.length,
  applied_count:applied.length,
  ro_county_count:roCounties.length,
  county_applied_count:countyApplied.length,
  ancpi_fallback_applied_count:fallbackApplied.length,
  type_changed_count:typeChanges.length,
  legal_parent_conflict_count:parentConflicts.length,
  osm_semantic_type_conflict_count:semanticConflicts.length,
  official_only_count:reconciliation.summary?.official_only_count??null,
  reviewed_official_only_resolution_count:reconciliation.summary?.reviewed_official_only_resolution_count??null,
  reviewed_other_level_resolution_count:reconciliation.summary?.reviewed_other_level_resolution_count??null,
  reviewed_semantic_type_resolution_count:reconciliation.summary?.reviewed_semantic_type_resolution_count??null,
  represented_at_other_osm_level_count:reconciliation.summary?.represented_at_other_osm_level_count??null
 },
 ancpi_fallbacks:fallbackApplied,
 type_changes:typeChanges,
 legal_parent_conflicts:parentConflicts,
 osm_semantic_type_conflicts:semanticConflicts,
 failures
};

await writeFile(CATALOG,JSON.stringify(catalog,null,2)+'\n');
await writeFile(GEO,JSON.stringify(geo));
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,summary:report.summary,failures},null,2));
if(failures.length)process.exitCode=1;
