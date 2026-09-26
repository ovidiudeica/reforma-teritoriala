#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const CATALOG='data/current/entities.json';
const GEO='public/geo/current/ro-administrative.geojson';
const RECON='data/current/ro-official-reconciliation.json';
const SNAPSHOT='data/sources/ro-siruta-current.json';
const OUTPUT='data/current/ro-official-application.json';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const catalog=await read(CATALOG);
const geo=await read(GEO);
const reconciliation=await read(RECON);
const official=await read(SNAPSHOT);

if(reconciliation.status!=='PASS')throw new Error('RO official reconciliation is not PASS');
if(reconciliation.summary?.unmatched_osm_count!==0)throw new Error('Cannot apply SIRUTA with unmatched RO level-8 entities');
if(reconciliation.summary?.duplicate_legal_mapping_count!==0)throw new Error('Cannot apply SIRUTA with duplicate legal mappings');

const entities=catalog.entities||[];
const roLevel8=entities.filter(e=>e.jurisdiction==='RO'&&Number(e.osm?.admin_level)===8);
const matches=reconciliation.matches||[];
if(matches.length!==roLevel8.length){
 throw new Error(`Reconciliation/application cardinality mismatch: matches=${matches.length}, level8=${roLevel8.length}`);
}

const byRelation=new Map(roLevel8.map(e=>[Number(e.osm?.relation_id),e]));
const featureByCatalogId=new Map((geo.features||[]).map(f=>[f.properties?.catalog_id,f]));
const applied=[],typeChanges=[],parentConflicts=[],missing=[];

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

catalog.official_reconciliation={
 ...(catalog.official_reconciliation||{}),
 RO:{
  registry:'SIRUTA',
  reference_year:Number(official.reference_year)||2026,
  applied_at:new Date().toISOString(),
  source:SNAPSHOT,
  reconciliation:RECON,
  applied_count:applied.length
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

const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'RO',
 status:failures.length?'FAIL':'PASS',
 policy:'SIRUTA is authoritative for RO level-8 legal identity/type. OSM remains the geometry/provenance representation. OSM geometric parent_id is never rewritten from legal hierarchy; legal parent is stored separately.',
 source:{official_snapshot:SNAPSHOT,reconciliation:RECON},
 checks,
 summary:{
  ro_level8_count:roLevel8.length,
  applied_count:applied.length,
  type_changed_count:typeChanges.length,
  legal_parent_conflict_count:parentConflicts.length,
  osm_semantic_type_conflict_count:semanticConflicts.length,
  official_only_count:reconciliation.summary?.official_only_count??null,
  represented_at_other_osm_level_count:reconciliation.summary?.represented_at_other_osm_level_count??null
 },
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
