#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const CATALOG='data/current/entities.json';
const GEO='public/geo/current/ro-administrative.geojson';
const RECON='data/current/ro-official-reconciliation.json';
const SNAPSHOT='data/sources/ro-siruta-current.json';
const COUNTY_BRIDGE='data/current/ro-county-siruta-bridge.json';
const OUTPUT='data/current/ro-official-application.json';
const SETTLEMENT_POLICY='data/sources/actual-settlement-policy.json';
const BRETCU_ANCPI='data/sources/ro-bretcu-ancpi-current.json';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const catalog=await read(CATALOG);
const geo=await read(GEO);
const reconciliation=await read(RECON);
const official=await read(SNAPSHOT);
const countyBridge=await read(COUNTY_BRIDGE);
const settlementPolicy=await read(SETTLEMENT_POLICY);

if(reconciliation.status!=='PASS')throw new Error('RO official reconciliation is not PASS');
if(countyBridge.status!=='PASS')throw new Error('RO county SIRUTA bridge is not PASS');
if(reconciliation.summary?.unmatched_osm_count!==0)throw new Error('Cannot apply SIRUTA with unmatched RO level-8 entities');
if(reconciliation.summary?.duplicate_legal_mapping_count!==0)throw new Error('Cannot apply SIRUTA with duplicate legal mappings');

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
const applied=[],countyApplied=[],typeChanges=[],parentConflicts=[],missing=[];

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


const officialGeometryApplied=[];
const officialGeometryBindings=settlementPolicy?.jurisdictions?.RO?.official_geometry_exceptions||[];
if(officialGeometryBindings.length){
 if(officialGeometryBindings.length!==1||String(officialGeometryBindings[0]?.legal_id)!=='64096'){
  throw new Error('ACTUAL P1.2 permits exactly the reviewed Brețcu SIRUTA 64096 official geometry exception');
 }
 const binding=officialGeometryBindings[0];
 if(binding.source_path!==BRETCU_ANCPI||binding.authority!=='ANCPI'||binding.geometry_role!=='administrative_boundary'||binding.geometry_scope!=='uat'||binding.public_entity_id!=='ro-siruta-64096'){
  throw new Error('Unexpected Brețcu official geometry policy binding: '+JSON.stringify(binding));
 }
 if(entities.some(e=>e.id===binding.public_entity_id))throw new Error('Brețcu official geometry entity ID already exists');
 if(featureByCatalogId.has(binding.public_entity_id))throw new Error('Brețcu official geometry feature ID already exists');
 const source=await read(BRETCU_ANCPI);
 const sourceFeature=source?.feature;
 if(source?.schema_version!==1||source?.mode!=='ACTUAL_RO_OFFICIAL_GEOMETRY_EXCEPTION'||source?.jurisdiction!=='RO'||String(source?.legal_id)!=='64096'||source?.authority?.includes('ANCPI')!==true){
  throw new Error('Invalid Brețcu ANCPI source envelope');
 }
 if(source?.license!=='CC-BY-4.0'||source?.arcgis_item_id!=='466b7199c19f4904831e14bc7f407af9'||Number(source?.arcgis_layer_id)!==1){
  throw new Error('Unexpected Brețcu ANCPI source provenance');
 }
 if(String(sourceFeature?.properties?.nationalCode)!=='64096'||sourceFeature?.properties?.nationalLevel!=='3rdOrder'||!['Polygon','MultiPolygon'].includes(sourceFeature?.geometry?.type)){
  throw new Error('Brețcu ANCPI feature identity/geometry mismatch');
 }
 const officialRecord=(official.records||[]).find(x=>String(x.siruta)==='64096');
 if(!officialRecord||Number(officialRecord.level)!==2||officialRecord.legal_type!=='commune'||String(officialRecord.county_code)!=='14'){
  throw new Error('SIRUTA 64096 Brețcu baseline is missing or changed');
 }
 const countyEntity=roCounties.find(e=>String(e.legal?.id)==='14');
 if(!countyEntity||Number(countyEntity.osm?.relation_id)!==2248621){
  throw new Error('Brețcu expected Covasna parent is missing or changed');
 }
 const legal={
  registry:'SIRUTA',
  reference_year:Number(official.reference_year)||2026,
  id:'64096',
  name:officialRecord.name||'BREȚCU',
  type:'commune',
  parent_id:'14',
  parent_name:officialRecord.county_name||'JUDEȚUL COVASNA',
  match_method:'official_geometry_exception_ancpi_national_code',
  match_confidence:'high',
  source:SNAPSHOT,
  reconciliation:RECON,
  parent_matches_osm_geometry_parent:null
 };
 const entity={
  id:binding.public_entity_id,
  name:'Brețcu',
  official_name:officialRecord.name||'BREȚCU',
  jurisdiction:'RO',
  category:'administrative',
  type:'commune',
  status:'current',
  parent_id:countyEntity.id,
  osm:null,
  classification:{
   version:'official-geometry-1.0',
   confidence:'high',
   reason:'Current SIRUTA UAT identity 64096 paired with the explicitly reviewed current ANCPI administrative-unit polygon; no OSM relation is assigned.',
   evidence:BRETCU_ANCPI,
   official_registry:'SIRUTA',
   official_legal_id:'64096'
  },
  geometry:{
   role:'administrative_boundary',
   scope:'uat',
   admin_level:8,
   authority:'ANCPI',
   source_path:BRETCU_ANCPI,
   source_feature_id:Number(source.source_feature_id),
   legal_geometry_equivalence_asserted:false
  },
  source:'ANCPI',
  source_url:'https://open-data-ancpi.hub.arcgis.com/datasets/466b7199c19f4904831e14bc7f407af9_1',
  imported_at:source.dataset_metadata_modified,
  legal,
  review_required:false
 };
 const feature={
  type:'Feature',
  properties:{
   catalog_id:entity.id,
   parent_id:entity.parent_id,
   jurisdiction:'RO',
   entity_type:'commune',
   classification_confidence:'high',
   geometry_role:'administrative_boundary',
   geometry_scope:'uat',
   geometry_source:'ANCPI administrative unit feature',
   geometry_authority:'ANCPI',
   source_feature_id:Number(source.source_feature_id),
   osm_relation_id:null,
   admin_level:8,
   legal_registry:'SIRUTA',
   legal_id:'64096',
   legal_name:legal.name,
   legal_type:'commune',
   legal_parent_id:'14',
   legal_parent_name:legal.parent_name,
   legal_match_method:legal.match_method,
   legal_parent_matches_osm_geometry_parent:null
  },
  geometry:structuredClone(sourceFeature.geometry)
 };
 entities.push(entity);
 geo.features.push(feature);
 featureByCatalogId.set(entity.id,feature);
 catalog.entity_count=entities.length;
 officialGeometryApplied.push({
  entity_id:entity.id,
  legal_id:'64096',
  legal_type:'commune',
  parent_entity_id:entity.parent_id,
  source:BRETCU_ANCPI,
  authority:'ANCPI',
  source_feature_id:Number(source.source_feature_id)
 });
}

catalog.official_reconciliation={
 ...(catalog.official_reconciliation||{}),
 RO:{
  registry:'SIRUTA',
  reference_year:Number(official.reference_year)||2026,
  applied_at:new Date().toISOString(),
  source:SNAPSHOT,
  reconciliation:RECON,
  county_bridge:COUNTY_BRIDGE,
  applied_count:applied.length,
  county_applied_count:countyApplied.length,
  official_geometry_exception_applied_count:officialGeometryApplied.length
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

const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'RO',
 status:failures.length?'FAIL':'PASS',
 policy:'SIRUTA is authoritative for RO level-8 legal identity/type and for the exhaustive 42-county legal identity bridge. OSM remains the geometry/provenance representation. Geometry coordinates and OSM geometric parent_id are never rewritten from legal hierarchy; legal parent is stored separately.',
 source:{official_snapshot:SNAPSHOT,reconciliation:RECON},
 checks,
 summary:{
  ro_level8_count:roLevel8.length,
  applied_count:applied.length,
  ro_county_count:roCounties.length,
  county_applied_count:countyApplied.length,
  type_changed_count:typeChanges.length,
  legal_parent_conflict_count:parentConflicts.length,
  osm_semantic_type_conflict_count:semanticConflicts.length,
  official_only_count:reconciliation.summary?.official_only_count??null,
  official_geometry_exception_applied_count:officialGeometryApplied.length,
  reviewed_official_only_resolution_count:reconciliation.summary?.reviewed_official_only_resolution_count??null,
  reviewed_other_level_resolution_count:reconciliation.summary?.reviewed_other_level_resolution_count??null,
  reviewed_semantic_type_resolution_count:reconciliation.summary?.reviewed_semantic_type_resolution_count??null,
  represented_at_other_osm_level_count:reconciliation.summary?.represented_at_other_osm_level_count??null
 },
 type_changes:typeChanges,
 legal_parent_conflicts:parentConflicts,
 osm_semantic_type_conflicts:semanticConflicts,
 official_geometry_exceptions:officialGeometryApplied,
 failures
};

await writeFile(CATALOG,JSON.stringify(catalog,null,2)+'\n');
await writeFile(GEO,JSON.stringify(geo));
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,summary:report.summary,failures},null,2));
if(failures.length)process.exitCode=1;
