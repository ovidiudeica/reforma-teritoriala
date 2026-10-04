#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {buildBretcuOjdulaHybridPartition} from '../lib/bretcu-ojdula-hybrid-partition.mjs';

const CATALOG='data/current/entities.json';
const GEO='public/geo/current/ro-administrative.geojson';
const RECON='data/current/ro-official-reconciliation.json';
const SNAPSHOT='data/sources/ro-siruta-current.json';
const COUNTY_BRIDGE='data/current/ro-county-siruta-bridge.json';
const ANCPI_FALLBACKS='data/sources/ro-ancpi-uat-fallbacks.json';
const OFFICIAL_ONLY_RESOLUTIONS='data/sources/ro-official-only-reviewed-resolutions.json';
const OJDULA_REVIEW='data/sources/ro-ancpi-ojdula-reviewed.json';
const OJDULA_OSM_SHELL='data/sources/ro-osm-ojdula-14735731-reviewed-shell.json';
const TERMINAL_CLOSURE_REVIEW='data/sources/ro-bretcu-ojdula-terminal-closure-reviewed.json';
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
const ojdulaReview=await read(OJDULA_REVIEW);
const ojdulaOsmShell=await read(OJDULA_OSM_SHELL);
const terminalClosureBytes=await readFile(TERMINAL_CLOSURE_REVIEW);
const terminalClosureReview=JSON.parse(terminalClosureBytes.toString('utf8'));
const settlementPolicy=await read(SETTLEMENT_POLICY);
const ancpiFallbackBinding=settlementPolicy?.administrative_geometry_fallbacks?.RO??null;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const exactCoord=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exactEdgeKey=(a,b)=>[JSON.stringify(a),JSON.stringify(b)].sort().join('|');
const geometryRings=geometry=>geometry?.type==='Polygon'?geometry.coordinates:(geometry?.type==='MultiPolygon'?geometry.coordinates.flat():[]);
const exactEdgeUserIds=(featureCollection,segment)=>{
 const target=exactEdgeKey(segment.a,segment.b),users=[];
 for(const feature of featureCollection.features||[]){
  let found=false;
  for(const ring of geometryRings(feature.geometry)){
   for(let i=0;i<ring.length-1;i++)if(exactEdgeKey(ring[i],ring[i+1])===target){found=true;break;}
   if(found)break;
  }
  if(found&&feature.properties?.catalog_id)users.push(String(feature.properties.catalog_id));
 }
 return users.sort();
};

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
 const id='siruta-u'+legalId;
 if(!legalId||entities.some(e=>e.id===id)||entities.some(e=>String(e.legal?.id||'')===legalId))throw new Error('Duplicate/invalid ANCPI fallback identity '+legalId);
 const officialRow=officialBySiruta.get(legalId);
 const resolution=resolutionByLegalId.get(legalId);
 if(!officialRow||Number(officialRow.level)!==2)throw new Error('ANCPI fallback legal ID is not a current SIRUTA UAT '+legalId);
 if(!resolution||resolution.classification!=='official_uat_without_distinct_osm_boundary_representation')throw new Error('ANCPI fallback lacks reviewed OSM-gap resolution '+legalId);
 if(String(fallback.national_code)!==legalId||fallback.geometry_role!=='administrative_boundary'||fallback.geometry_scope!=='uat_fallback')throw new Error('ANCPI fallback metadata mismatch '+legalId);
 if(!['Polygon','MultiPolygon'].includes(fallback.geometry?.type)||!Array.isArray(fallback.geometry?.coordinates)||!fallback.geometry.coordinates.length)throw new Error('ANCPI fallback geometry invalid '+legalId);
 const parentId='osm-r'+String(resolution.expected_parent_osm_relation_id);
 const parent=entities.find(e=>e.id===parentId);
 if(!parent||parent.jurisdiction!=='RO'||parent.type!=='county')throw new Error('ANCPI fallback parent is not the reviewed county '+legalId);
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
  classification:{version:catalog.classifier_version??null,confidence:'high',reason:'Current UAT geometry supplied by ANCPI/RELUAT as a reviewed fallback because OSM has no distinct Brețcu boundary relation.',evidence:ANCPI_FALLBACKS,official_registry:'SIRUTA',official_legal_id:legalId},
  legal,source:'ANCPI RELUAT',source_url:ancpiFallbacks.source?.source_url||null,imported_at:ancpiFallbacks.source?.item_modified_at||null,review_required:false
 };
 const feature={
  type:'Feature',
  properties:{catalog_id:id,parent_id:parentId,jurisdiction:'RO',entity_type:legal.type,classification_confidence:'high',geometry_role:'administrative_boundary',geometry_scope:'uat_fallback',legal_registry:'SIRUTA',legal_id:legalId,legal_name:legal.name,legal_type:legal.type,legal_parent_id:legal.parent_id,legal_parent_name:legal.parent_name,legal_match_method:legal.match_method,legal_parent_matches_osm_geometry_parent:true,source:'ANCPI RELUAT',source_object_id:fallback.source_object_id,inspire_id_local_id:fallback.inspire_id_local_id,national_code:fallback.national_code},
  geometry:fallback.geometry
 };
 entities.push(entity);
 geo.features.push(feature);
 featureByCatalogId.set(id,feature);
 fallbackApplied.push({mode:'add_missing_uat',entity_id:id,legal_id:legalId,legal_type:legal.type,parent_id:parentId,source_object_id:fallback.source_object_id,inspire_id_local_id:fallback.inspire_id_local_id});
}

for(const override of ancpiFallbackBinding?.reviewed_geometry_overrides||[]){
 const legalId=String(override.legal_id||'');
 if(legalId!=='64602'||override.entity_id!=='osm-r14735731'||Number(override.osm_relation_id)!==14735731||override.evidence!==OJDULA_REVIEW){
  throw new Error('Unexpected reviewed geometry override '+legalId);
 }
 if(!['replace_osm_geometry_keep_stable_entity_id','partition_osm_shell_by_ancpi_shared_boundary'].includes(override.disposition))throw new Error('Unexpected Brețcu–Ojdula partition disposition');
 const terminalClosureBound=Boolean(override.terminal_closure_evidence);
 if(terminalClosureBound){
  if(override.terminal_closure_evidence!==TERMINAL_CLOSURE_REVIEW||override.terminal_closure_evidence_sha256!==sha256(terminalClosureBytes))throw new Error('Reviewed Brețcu–Ojdula terminal-closure evidence hash/path mismatch');
  if(
   terminalClosureReview.schema_version!==1
   ||terminalClosureReview.mode!=='ACTUAL_RO_BRETCU_OJDULA_TERMINAL_CLOSURE_REVIEW'
   ||terminalClosureReview.conclusion!=='retain_legacy_osm_shell_with_reviewed_terminal_adaptations'
   ||terminalClosureReview.decision?.preserve_legacy_osm_exterior!==true
   ||terminalClosureReview.decision?.allow_non_ancpi_terminal_closure!==true
   ||Number(terminalClosureReview.decision?.non_ancpi_terminal_closure_count)!==1
  )throw new Error('Unexpected Brețcu–Ojdula terminal-closure review contract');
 }
 const source=ojdulaReview.feature;
 if(String(source?.legal_id)!==legalId||Number(source?.replacement_osm_relation_id)!==14735731)throw new Error('Reviewed Ojdula source identity mismatch');
 const existing=entities.find(e=>e.id===override.entity_id);
 if(!existing||String(existing.legal?.id||'')!==legalId||Number(existing.osm?.relation_id)!==14735731)throw new Error('Reviewed Ojdula entity binding mismatch');
 const ojdulaFeature=featureByCatalogId.get(existing.id);
 if(!ojdulaFeature)throw new Error('Missing Ojdula master feature');
 if(override.disposition==='replace_osm_geometry_keep_stable_entity_id'){
  existing.representation={source:'ANCPI RELUAT',admin_level:8,source_object_id:source.source_object_id,inspire_id_local_id:source.inspire_id_local_id,inspire_id_version_id:source.inspire_id_version_id,national_code:source.national_code,reviewed_osm_relation_id:14735731,osm_relation_geometry_accepted:false};
  existing.geometry={role:'administrative_boundary',scope:'uat_fallback',legal_geometry_equivalence_asserted:false};
  existing.source='ANCPI RELUAT';
  existing.source_url=ojdulaReview.source?.source_url||null;
  existing.classification={...(existing.classification||{}),confidence:'high',reason:'Reviewed geometry override: OSM relation 14735731 merges Ojdula with the distinct Brețcu UAT; current Ojdula geometry is the exact ANCPI/RELUAT SIRUTA 64602 polygon.',evidence:OJDULA_REVIEW,official_registry:'SIRUTA',official_legal_id:legalId};
  ojdulaFeature.geometry=source.geometry;
  ojdulaFeature.properties={...(ojdulaFeature.properties||{}),geometry_role:'administrative_boundary',geometry_scope:'uat_fallback',source:'ANCPI RELUAT',source_object_id:source.source_object_id,inspire_id_local_id:source.inspire_id_local_id,national_code:source.national_code,reviewed_osm_relation_id:14735731,osm_relation_geometry_accepted:false};
  fallbackApplied.push({mode:'replace_osm_geometry',entity_id:existing.id,legal_id:legalId,legal_type:existing.type,parent_id:existing.parent_id,source_object_id:source.source_object_id,inspire_id_local_id:source.inspire_id_local_id,replaced_osm_relation_id:14735731});
  continue;
 }
 const bretcuEntity=entities.find(e=>e.id==='siruta-u64096');
 const bretcuFeature=featureByCatalogId.get('siruta-u64096');
 const bretcuSource=(ancpiFallbacks.features||[]).find(x=>String(x.legal_id)==='64096');
 if(!bretcuEntity||!bretcuFeature||!bretcuSource)throw new Error('Missing Brețcu–Ojdula partition inputs');
 if(
  ojdulaOsmShell.schema_version!==1
  ||ojdulaOsmShell.mode!=='ACTUAL_RO_REVIEWED_OSM_OUTER_SHELL'
  ||Number(ojdulaOsmShell.relation_id)!==14735731
  ||ojdulaOsmShell.source_commit_sha!=='f21e4954063a884df9922efa5ac31229c5b51d43'
  ||ojdulaOsmShell.source_snapshot_id!=='actual-990c892d9d27fa46'
  ||ojdulaOsmShell.geometry?.type!=='Polygon'
 )throw new Error('Reviewed Ojdula OSM outer-shell fixture mismatch');
 const osmOjdulaGeometry=structuredClone(ojdulaOsmShell.geometry);
 if(terminalClosureBound){
  for(const key of ['west','east']){
   const reviewed=terminalClosureReview.terminals?.[key];
   if(!reviewed?.shell_segment)throw new Error('Missing reviewed terminal shell segment '+key);
   const expectedUsers=(reviewed.shell_segment.exact_osm_users||[]).map(x=>String(x.entity_id)).sort();
   const actualUsers=exactEdgeUserIds(geo,reviewed.shell_segment);
   if(JSON.stringify(actualUsers)!==JSON.stringify(expectedUsers))throw new Error('Reviewed terminal shell-neighbor set drifted '+key+': expected='+JSON.stringify(expectedUsers)+' actual='+JSON.stringify(actualUsers));
  }
 }
 const partition=buildBretcuOjdulaHybridPartition({
  osmOjdulaGeometry,
  ancpiOjdulaGeometry:source.geometry,
  ancpiBretcuGeometry:bretcuSource.geometry
 });
 if(partition.audit.osm_shell_edges_preserved!==true)throw new Error('Hybrid Brețcu–Ojdula exterior does not preserve the reviewed OSM shell edges');
 if(partition.audit.exact_partition_boundary_edge_proof!==true)throw new Error('Hybrid Brețcu–Ojdula exact boundary-edge proof failed');
 if(partition.audit.partition_polygons_valid!==true)throw new Error('Hybrid Brețcu–Ojdula polygons are not topologically valid');
 if(!Number.isFinite(Number(partition.audit.overlap_m2)))throw new Error('Hybrid Brețcu–Ojdula overlap diagnostic is not finite');
 if(partition.audit.ancpi_shared_path_preserved_with_terminal_clipping!==true)throw new Error('Hybrid Brețcu–Ojdula partition does not preserve the ANCPI shared path after terminal shell clipping');
 if(terminalClosureBound){
  const west=terminalClosureReview.terminals.west,east=terminalClosureReview.terminals.east,audit=partition.audit;
  if(
   audit.ancpi_terminal_start_mode!==west.role
   ||audit.ancpi_terminal_end_mode!==east.role
   ||!exactCoord(audit.ancpi_terminal_start_original_coordinate,west.ancpi_endpoint)
   ||!exactCoord(audit.ancpi_terminal_start_final_coordinate,west.shell_contact)
   ||!exactCoord(audit.ancpi_terminal_end_original_coordinate,east.ancpi_endpoint)
   ||!exactCoord(audit.ancpi_terminal_end_final_coordinate,east.shell_contact)
   ||Number(audit.non_ancpi_terminal_closure_count)!==1
   ||Number(audit.ancpi_clipped_start_m)!==Number(west.adjustment_m)
   ||Number(audit.connector_end_m)!==Number(east.adjustment_m)
  )throw new Error('Brețcu–Ojdula terminal adaptations drifted from reviewed evidence');
 }

 const partitionMeta={
  mode:'osm_shell_ancpi_shared_boundary_partition',
  osm_shell_relation_id:14735731,
  osm_shell_evidence:OJDULA_OSM_SHELL,
  osm_shell_source_commit_sha:ojdulaOsmShell.source_commit_sha,
  osm_shell_source_snapshot_id:ojdulaOsmShell.source_snapshot_id,
  ancpi_ojdula_source_object_id:source.source_object_id,
  ancpi_bretcu_source_object_id:bretcuSource.source_object_id,
  ...(terminalClosureBound?{terminal_closure_evidence:TERMINAL_CLOSURE_REVIEW,terminal_closure_evidence_sha256:sha256(terminalClosureBytes)}:{}),
  audit:partition.audit
 };

 existing.representation={
  source:'OpenStreetMap',
  admin_level:8,
  reviewed_osm_relation_id:14735731,
  osm_relation_geometry_accepted_as_outer_shell:true,
  internal_boundary_source:'ANCPI RELUAT',
  internal_boundary_source_object_id:source.source_object_id,
  partition_mode:partitionMeta.mode,
  outer_shell_evidence:OJDULA_OSM_SHELL,
  ...(terminalClosureBound?{internal_boundary_terminal_policy:'ancpi_shared_path_with_reviewed_osm_shell_terminal_adaptations',terminal_closure_evidence:TERMINAL_CLOSURE_REVIEW}:{})
 };
 existing.geometry={role:'administrative_boundary',scope:'uat_hybrid_partition',legal_geometry_equivalence_asserted:false};
 existing.source='OpenStreetMap';
 existing.source_url='https://www.openstreetmap.org/relation/14735731';
 existing.classification={
  ...(existing.classification||{}),
  confidence:'high',
  reason:terminalClosureBound
   ?'Reviewed hybrid partition: preserve the legacy OSM Ojdula exterior for neighbor continuity; retain the ANCPI Brețcu–Ojdula shared path except for the reviewed terminal clip and one 82.596 m non-ANCPI closure to the preserved OSM Tulnici/Vrancea shell.'
   :'Reviewed hybrid partition: preserve the legacy OSM Ojdula outer shell for neighbor continuity and split Brețcu/Ojdula only along their exact ANCPI shared UAT boundary.',
  evidence:OJDULA_REVIEW,
  official_registry:'SIRUTA',
  official_legal_id:legalId
 };
 ojdulaFeature.geometry=partition.ojdula_geometry;
 ojdulaFeature.properties={
  ...(ojdulaFeature.properties||{}),
  geometry_role:'administrative_boundary',
  geometry_scope:'uat_hybrid_partition',
  source:'OpenStreetMap',
  reviewed_osm_relation_id:14735731,
  osm_relation_geometry_accepted_as_outer_shell:true,
  internal_boundary_source:'ANCPI RELUAT',
  internal_boundary_source_object_id:source.source_object_id,
  partition_mode:partitionMeta.mode,
  outer_shell_evidence:OJDULA_OSM_SHELL,
  ...(terminalClosureBound?{internal_boundary_terminal_policy:'ancpi_shared_path_with_reviewed_osm_shell_terminal_adaptations',terminal_closure_evidence:TERMINAL_CLOSURE_REVIEW}:{})
 };

 bretcuEntity.representation={
  ...(bretcuEntity.representation||{}),
  source:'ANCPI RELUAT',
  admin_level:8,
  osm_shell_relation_id:14735731,
  outer_shell_source:'OpenStreetMap',
  internal_boundary_source:'ANCPI RELUAT',
  internal_boundary_source_object_id:bretcuSource.source_object_id,
  partition_mode:partitionMeta.mode,
  outer_shell_evidence:OJDULA_OSM_SHELL,
  ...(terminalClosureBound?{internal_boundary_terminal_policy:'ancpi_shared_path_with_reviewed_osm_shell_terminal_adaptations',terminal_closure_evidence:TERMINAL_CLOSURE_REVIEW}:{})
 };
 bretcuEntity.geometry={role:'administrative_boundary',scope:'uat_hybrid_partition',legal_geometry_equivalence_asserted:false};
 bretcuEntity.classification={
  ...(bretcuEntity.classification||{}),
  reason:terminalClosureBound
   ?'Reviewed hybrid partition: Brețcu uses the preserved legacy OSM exterior against neighboring UATs; the ANCPI Brețcu–Ojdula shared path is retained except for the reviewed terminal clip and one 82.596 m non-ANCPI closure to the Tulnici/Vrancea shell.'
   :'Reviewed hybrid partition: Brețcu uses the legacy OSM Ojdula outer shell where it borders neighboring UATs and the exact ANCPI Brețcu–Ojdula shared boundary internally.'
 };
 bretcuFeature.geometry=partition.bretcu_geometry;
 bretcuFeature.properties={
  ...(bretcuFeature.properties||{}),
  geometry_scope:'uat_hybrid_partition',
  osm_shell_relation_id:14735731,
  outer_shell_source:'OpenStreetMap',
  internal_boundary_source:'ANCPI RELUAT',
  partition_mode:partitionMeta.mode,
  outer_shell_evidence:OJDULA_OSM_SHELL,
  ...(terminalClosureBound?{internal_boundary_terminal_policy:'ancpi_shared_path_with_reviewed_osm_shell_terminal_adaptations',terminal_closure_evidence:TERMINAL_CLOSURE_REVIEW}:{})
 };

 fallbackApplied.push({
  mode:'partition_osm_shell_by_ancpi_shared_boundary',
  entity_id:existing.id,
  paired_entity_id:bretcuEntity.id,
  legal_id:legalId,
  paired_legal_id:'64096',
  replaced_osm_relation_id:14735731,
  partition:partitionMeta
 });
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
const reviewedOverrides=ancpiFallbackBinding?.reviewed_geometry_overrides||[];
const reviewedOverrideActivationExact=reviewedOverrides.every(override=>{
 const expectedMode=override.disposition==='partition_osm_shell_by_ancpi_shared_boundary'
  ?'partition_osm_shell_by_ancpi_shared_boundary'
  :override.disposition==='replace_osm_geometry_keep_stable_entity_id'
   ?'replace_osm_geometry'
   :null;
 return Boolean(expectedMode)&&fallbackApplied.some(x=>
  x.entity_id===override.entity_id
  &&String(x.legal_id)===String(override.legal_id)
  &&x.mode===expectedMode
  &&Number(x.replaced_osm_relation_id)===Number(override.osm_relation_id)
 );
});
check('ancpi_reviewed_fallback_activation_is_exact',
 !ancpiFallbackBinding
 ||(
  fallbackApplied.some(x=>x.entity_id==='siruta-u64096'&&x.legal_id==='64096'&&x.mode==='add_missing_uat')
  &&reviewedOverrideActivationExact
  &&fallbackApplied.length===(ancpiFallbackBinding.legal_ids||[]).length+reviewedOverrides.length
 ),
 {enabled:Boolean(ancpiFallbackBinding),authorized_ids:(ancpiFallbackBinding?.legal_ids||[]).map(String).sort(),reviewed_geometry_overrides:reviewedOverrides,fallback_applied:fallbackApplied});

const report={
 schema_version:1,
 generated_at:new Date().toISOString(),
 jurisdiction:'RO',
 status:failures.length?'FAIL':'PASS',
 policy:'SIRUTA is authoritative for RO legal identity/type and the exhaustive county/UAT inventory. OSM remains the primary geometry source. A reviewed UAT with no distinct OSM boundary may use an ANCPI/RELUAT fallback. For the reviewed Brețcu–Ojdula conflict, the legacy OSM Ojdula shell is preserved for neighbor continuity and partitioned only by the exact ANCPI shared UAT boundary; provenance remains separate from legal identity.',
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
