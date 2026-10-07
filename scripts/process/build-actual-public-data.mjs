#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import * as turf from '@turf/turf';
import {auditActualOsmFidelity} from '../lib/actual-osm-fidelity.mjs';
import {activateStatisticalPublic} from '../lib/actual-statistical-public.mjs';

const osmFidelity=await auditActualOsmFidelity();
if(osmFidelity.status!=='PASS')throw new Error('Exact OSM-to-ACTUAL fidelity failed closed: '+JSON.stringify(osmFidelity));
console.log(JSON.stringify({gate:'exact_osm_fidelity',...osmFidelity}));

const CATALOG='data/current/entities.json';
const RO_GEO='public/geo/current/ro-administrative.geojson';
const MD_GEO='public/geo/current/md-administrative.geojson';
const MD_RECON='data/current/md-cuatm-reconciliation.json';
const MD_NON_CUATM='data/current/md-cuatm-non-cuatm-allotments.json';
const MD_INDIVIDUAL='data/sources/md-cuatm-individual-review.json';
const RO_COUNTY_BRIDGE='data/current/ro-county-siruta-bridge.json';
const MD_SEMANTIC_BRIDGE='data/current/md-cuatm-semantic-bridge.json';
const SETTLEMENT_POLICY='data/sources/actual-settlement-policy.json';
const OUT_INDEX='public/data/actual-entities.json';
const OUT_DIR='public/geo/actual';
const OUT_CHUNK_INDEX='public/data/actual-geometry-chunks.json';
const OUT_CHUNK_DIR=OUT_DIR+'/chunks';
const sha256=value=>createHash('sha256').update(value).digest('hex');

const read=async path=>JSON.parse(await readFile(path,'utf8'));
const [catalog,roGeo,mdGeo,mdRecon,mdNonCuatm,mdIndividual,roCountyBridge,mdSemanticBridge,settlementPolicy]=await Promise.all([
 read(CATALOG),read(RO_GEO),read(MD_GEO),read(MD_RECON),read(MD_NON_CUATM),read(MD_INDIVIDUAL),read(RO_COUNTY_BRIDGE),read(MD_SEMANTIC_BRIDGE),read(SETTLEMENT_POLICY)
]);
const publicContractV2=['actual-public-entity-v2','actual-public-entity-v3'].includes(settlementPolicy?.public_contract);
if(roCountyBridge.status!=='PASS')throw new Error('RO county SIRUTA bridge is not PASS');
if(mdSemanticBridge.status!=='PASS')throw new Error('MD CUATM semantic bridge is not PASS');

const entities=catalog.entities||[];
const entityById=new Map(entities.map(e=>[e.id,e]));
const mdMatchById=new Map((mdRecon.matches||[]).map(x=>[x.id,x]));
const mdNonCuatmById=new Map((mdNonCuatm.items||[]).map(x=>[x.id,x]));
const mdIndividualById=new Map((mdIndividual.cases||[]).map(x=>[x.osm_id,x]));
const roCountyById=new Map((roCountyBridge.matches||[]).map(x=>[x.entity_id,x]));
const mdSemanticByLegalId=new Map();
for(const x of mdSemanticBridge.classifications||[]){
 const id=String(x.legal_id);
 if(mdSemanticByLegalId.has(id))throw new Error('Duplicate MD semantic bridge legal ID '+id);
 mdSemanticByLegalId.set(id,x);
}
if(roCountyById.size!==42)throw new Error('RO county SIRUTA bridge must contain exactly 42 unique entity mappings');
for(const [id,m] of roCountyById){
 const e=entityById.get(id);
 if(!e||e.jurisdiction!=='RO'||Number(e.osm?.admin_level)!==4)throw new Error('RO county bridge points to non-county catalog entity '+id);
 if(e.legal?.registry!=='SIRUTA'||e.legal?.type!=='county'||String(e.legal?.id||'')!==String(m.county_code)){
  throw new Error('RO county official identity was not applied to catalog for '+id);
 }
}
const featureById=new Map();
for(const [jurisdiction,geo] of [['RO',roGeo],['MD',mdGeo]]){
 for(const f of geo.features||[]){
  const id=f.properties?.catalog_id;
  if(!id)throw new Error('Public ACTUAL source feature without catalog_id in '+jurisdiction);
  if(featureById.has(id))throw new Error('Duplicate public ACTUAL source geometry for '+id);
  featureById.set(id,{jurisdiction,feature:f});
 }
}
if(featureById.size!==entities.length)throw new Error('Catalog/geometry cardinality mismatch: catalog='+entities.length+' geometry='+featureById.size);

const cleanText=value=>value==null?null:String(value);
const uniqueStrings=values=>[...new Set(values.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))];

function publicTypeFor(e,legal){
 if(e.jurisdiction==='MD'&&legal?.registry==='CUATM'&&String(legal.status_code)==='4'&&String(legal.parent_id)==='0100'&&e.parent_id==='osm-r1691801')return 'chisinau_sector';
 return e.type||null;
}

function legalFor(e){
 if(e.jurisdiction==='RO'&&e.legal?.registry==='SIRUTA'&&e.legal?.id){
  return {
   registry:'SIRUTA',
   id:String(e.legal.id),
   name:e.legal.name||null,
   type:e.legal.type||null,
   status_code:null,
   parent_id:e.legal.parent_id==null?null:String(e.legal.parent_id),
   parent_name:e.legal.parent_name||null,
   reference_year:e.legal.reference_year??null,
   match_method:e.legal.match_method||null,
   confidence:e.legal.match_confidence||null,
   source:e.legal.source||'data/sources/ro-siruta-current.json'
  };
 }
 if(e.jurisdiction==='MD'){
  const m=mdMatchById.get(e.id);
  if(e.legal?.registry==='CUATM'&&e.legal?.id){
   if(!m?.legal_id||String(m.legal_id)!==String(e.legal.id))throw new Error('Catalog/reconciliation CUATM identity mismatch for '+e.id);
   const semantic=mdSemanticByLegalId.get(String(m.legal_id))||null;
   if(['3','5','8'].includes(String(m.status_code))&&!semantic)throw new Error('Missing MD semantic subtype for reconciled CUATM '+m.legal_id+' ('+m.legal_name+')');
   if(e.legal.type&&semantic?.semantic_type&&e.legal.type!==semantic.semantic_type)throw new Error('Catalog/semantic bridge type mismatch for '+e.id);
   return {
    registry:'CUATM',
    id:String(e.legal.id),
    name:e.legal.name||m.legal_name||null,
    type:e.legal.type||semantic?.semantic_type||null,
    status_code:m.status_code||e.legal.status_code||null,
    parent_id:e.legal.parent_id==null?(m.legal_parent_id==null?null:String(m.legal_parent_id)):String(e.legal.parent_id),
    parent_name:e.legal.parent_name||m.legal_parent_name||null,
    reference_year:null,
    match_method:e.legal.match_method||m.match_method||null,
    confidence:e.legal.match_confidence||m.confidence||null,
    source:e.legal.source||'data/sources/cuatm-current.json',
    geometry_equivalence_asserted:e.legal.geometry_equivalence_asserted??null
   };
  }
  if(m?.legal_id){
   const semantic=mdSemanticByLegalId.get(String(m.legal_id))||null;
   if(['3','5','8'].includes(String(m.status_code))&&!semantic)throw new Error('Missing MD semantic subtype for reconciled CUATM '+m.legal_id+' ('+m.legal_name+')');
   return {
    registry:'CUATM',
    id:String(m.legal_id),
    name:m.legal_name||null,
    type:semantic?.semantic_type||null,
    status_code:m.status_code||null,
    parent_id:m.legal_parent_id==null?null:String(m.legal_parent_id),
    parent_name:m.legal_parent_name||null,
    reference_year:null,
    match_method:m.match_method||null,
    confidence:m.confidence||null,
    source:'data/sources/cuatm-current.json',
    geometry_equivalence_asserted:null
   };
  }
 }
 return null;
}

function validationFor(e,legal){
 const mdMatch=e.jurisdiction==='MD'?mdMatchById.get(e.id):null;
 const nonCuatm=e.jurisdiction==='MD'?mdNonCuatmById.get(e.id):null;
 const individualReview=e.jurisdiction==='MD'?mdIndividualById.get(e.id):null;
 let legalIdentityStatus;
 if(e.category==='context')legalIdentityStatus='not_bound_to_official_registry';
 else if(legal)legalIdentityStatus='reconciled';
 else if(nonCuatm)legalIdentityStatus='outside_current_legal_registry';
 else if(individualReview?.review_status==='resolved_semantic_classification')legalIdentityStatus='reviewed_representation_without_legal_identity';
 else if(individualReview?.review_status==='unresolved_identity')legalIdentityStatus='unresolved';
 else if(e.jurisdiction==='MD'&&mdMatch&&!mdMatch.legal_id)legalIdentityStatus='unresolved';
 else legalIdentityStatus='not_bound_to_official_registry';
 return {
  legal_identity_status:legalIdentityStatus,
  reconciliation_class:nonCuatm?.reconciliation_class||individualReview?.classification_action||null,
  review_status:individualReview?.review_status||null,
  review_source:individualReview?MD_INDIVIDUAL:null,
  match_confidence:legal?.confidence||null,
  representation_confidence:e.classification?.confidence||null,
  review_required:Boolean(e.review_required)
 };
}

function tierFor(level){
 const n=Number(level);
 if(Number.isFinite(n)&&n<=4)return 'overview';
 if(Number.isFinite(n)&&n<=8)return 'local';
 return 'detail';
}

const publicEntities=[];
const publicById=new Map();
for(const e of entities){
 const source=featureById.get(e.id);
 if(!source)throw new Error('Missing ACTUAL geometry for '+e.id);
 const f=source.feature;
 const legal=legalFor(e);
 const publicType=publicTypeFor(e,legal);
 const bounds=turf.bbox(f);
 const center=turf.centroid(f).geometry.coordinates;
 const parent=entityById.get(e.parent_id)||null;
 const level=e.osm?.admin_level??e.representation?.admin_level??null;
 const tier=tierFor(level);
 const representationSource=e.representation?.source||e.source||'OpenStreetMap';
 const representationSourceUrl=e.source_url||(
  e.osm?.relation_id!=null?'https://www.openstreetmap.org/relation/'+e.osm.relation_id:null
 );
 const currentOsmDerivation=f.properties?.geometry_derivation==='reviewed_current_osm_boundary_network'?Object.fromEntries(['geometry_derivation','source_relation_id','connector_way_id','evidence_relation_ids','reviewed_contract_sha256','live_relation_version','connector_version','coordinate_edit','source_relation_membership_edit','historical_geometry_fallback','snapping','clipping','simplification'].map(key=>[key,f.properties[key]])):null;
 const geometrySource=currentOsmDerivation?'Reviewed current OpenStreetMap administrative boundary network':e.representation?.partition_mode==='osm_shell_ancpi_shared_boundary_partition'?'OpenStreetMap outer shell partitioned by the exact ANCPI/RELUAT shared UAT boundary':(representationSource==='ANCPI RELUAT'?'ANCPI/RELUAT administrative unit':'OpenStreetMap administrative relation');
 const validation=validationFor(e,legal);
 const item={
  id:e.id,
  status:'current',
  jurisdiction:e.jurisdiction,
  category:e.category||'administrative',
  name:e.name||null,
  official_name:e.official_name||legal?.name||null,
  display_name:legal?.name||e.official_name||e.name||e.id,
  display_type:legal?.type||publicType||'administrative',
  searchable_names:uniqueStrings([e.name,e.official_name,legal?.name]),
  legal,
  hierarchy:{
   parent_catalog_id:e.parent_id||null,
   parent_name:parent?.name||null,
   legal_parent_id:legal?.parent_id||null,
   legal_parent_name:legal?.parent_name||null
  },
  representation:{
   ...(currentOsmDerivation||{}),
   source:representationSource,
   source_url:representationSourceUrl,
   osm_relation_id:e.osm?.relation_id??null,
   source_feature_id:e.representation?.source_object_id??null,
   source_inspire_id:e.representation?.inspire_id_local_id??null,
   partition_mode:e.representation?.partition_mode||null,
   outer_shell_source:e.representation?.outer_shell_source||null,
   internal_boundary_source:e.representation?.internal_boundary_source||null,
   osm_shell_relation_id:e.representation?.osm_shell_relation_id??null,
   admin_level:level,
   place:e.osm?.place||null,
   inferred_type:e.classification?.osm_inferred_type||publicType||null,
   geometry_source:geometrySource,
   geometry_role:'current_representation',
   canonical_geometry_role:e.geometry?.role||null,
   geometry_scope:e.geometry?.scope||null,
   public_geometry_precision:'master_coordinate_fidelity',
   master_geometry_path:source.jurisdiction==='RO'?RO_GEO:MD_GEO
  },
  validation,
  map:{
   tier,
   bbox:bounds,
   center
  }
 };
 publicEntities.push(item);
 publicById.set(item.id,item);
}
publicEntities.sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||(Number(a.representation.admin_level)||99)-(Number(b.representation.admin_level)||99)||a.display_name.localeCompare(b.display_name,'ro'));

const tierFeatures={};
for(const jurisdiction of ['RO','MD']){
 for(const tier of ['overview','local','detail'])tierFeatures[jurisdiction+'_'+tier]=[];
}
for(const [id,source] of featureById){
 const item=publicById.get(id);
 if(!item)throw new Error('Public geometry points to unknown entity '+id);
 const key=item.jurisdiction+'_'+item.map.tier;
 tierFeatures[key].push({
  type:'Feature',
  properties:{
   entity_id:item.id,
   jurisdiction:item.jurisdiction,
   display_name:item.display_name,
   display_type:item.display_type,
   admin_level:item.representation.admin_level,
   tier:item.map.tier,
   legal_registry:item.legal?.registry||null,
   legal_id:item.legal?.id||null,
   legal_type:item.legal?.type||null,
   parent_catalog_id:item.hierarchy.parent_catalog_id,
   osm_relation_id:item.representation.osm_relation_id,
   legal_identity_status:item.validation.legal_identity_status,
   geometry_source:item.representation.geometry_derivation==='reviewed_current_osm_boundary_network'?item.representation.geometry_source:item.representation.source,
   canonical_geometry_role:item.representation.canonical_geometry_role,
   geometry_scope:item.representation.geometry_scope,
   geometry_precision:'master_coordinate_fidelity',
   ...(item.representation.geometry_derivation==='reviewed_current_osm_boundary_network'?Object.fromEntries(['geometry_derivation','source_relation_id','connector_way_id','evidence_relation_ids','reviewed_contract_sha256','live_relation_version','connector_version','coordinate_edit','source_relation_membership_edit','historical_geometry_fallback','snapping','clipping','simplification'].map(key=>[key,item.representation[key]])):{})
  },
  geometry:source.feature.geometry
 });
}


const overviewRootIdFor=item=>{
 let cursor=item,depth=0;
 while(cursor&&cursor.map?.tier!=='overview'&&depth++<32){
  cursor=publicById.get(cursor.hierarchy?.parent_catalog_id)||null;
 }
 return cursor?.map?.tier==='overview'?cursor.id:null;
};
const safeChunkName=value=>String(value).replace(/[^A-Za-z0-9._-]+/g,'_');
const chunkFeatures=new Map();
for(const [key,features] of Object.entries(tierFeatures)){
 const [jurisdiction,tier]=key.split('_');
 if(tier==='overview')continue;
 for(const feature of features){
  const item=publicById.get(feature.properties.entity_id);
  const rootId=overviewRootIdFor(item);
  if(!rootId)throw new Error('Missing overview root for public geometry '+feature.properties.entity_id);
  const chunkKey=jurisdiction+'_'+tier+'_'+rootId;
  if(!chunkFeatures.has(chunkKey))chunkFeatures.set(chunkKey,{jurisdiction,tier,root_entity_id:rootId,features:[]});
  chunkFeatures.get(chunkKey).features.push(feature);
 }
}
const geometryChunks=[...chunkFeatures.values()].map(chunk=>({
 jurisdiction:chunk.jurisdiction,
 tier:chunk.tier,
 root_entity_id:chunk.root_entity_id,
 path:OUT_CHUNK_DIR+'/'+chunk.jurisdiction.toLowerCase()+'/'+chunk.tier+'/'+safeChunkName(chunk.root_entity_id)+'.geojson',
 feature_count:chunk.features.length
})).sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||a.tier.localeCompare(b.tier)||a.root_entity_id.localeCompare(b.root_entity_id));

const countsByJurisdiction=Object.fromEntries(['RO','MD'].map(j=>[j,publicEntities.filter(x=>x.jurisdiction===j).length]));
const countsByTier=Object.fromEntries(Object.entries(tierFeatures).map(([key,features])=>[key,features.length]));
const legalStatusCounts=publicEntities.reduce((a,x)=>(a[x.validation.legal_identity_status]=(a[x.validation.legal_identity_status]||0)+1,a),{});
const index={
 schema_version:publicContractV2?2:1,
 contract:publicContractV2?'actual-public-entity-v2':'actual-public-entity-v1',
 mode:'ACTUAL',
 generated_at:catalog.generated_at??null,
 policy:publicContractV2
  ?'Public contract separates official legal identity from geometry representation provenance. OpenStreetMap remains the primary ACTUAL geometry source; exactly reviewed ANCPI/RELUAT UAT fallback geometry is permitted only where no distinct OSM boundary exists. Geometry provenance never creates legal identity. Public web geometries preserve exact master coordinates and are partitioned only for progressive loading.'
  :'Public contract separates official legal identity from geometry representation provenance. OSM is the primary ACTUAL geometry source; geometry provenance never creates legal identity. Public web geometries preserve exact master coordinates and are partitioned only for progressive loading.',
 entity_count:publicEntities.length,
 entity_count_by_jurisdiction:countsByJurisdiction,
 feature_count_by_tier:countsByTier,
 legal_identity_status_counts:legalStatusCounts,
 entities:publicEntities
};

if(index.entity_count!==entities.length)throw new Error('Public ACTUAL index cardinality mismatch');
if(new Set(publicEntities.map(x=>x.id)).size!==publicEntities.length)throw new Error('Duplicate IDs in public ACTUAL contract');
for(const x of publicEntities){
 if(x.status!=='current')throw new Error('Non-current entity leaked into ACTUAL contract: '+x.id);
 if(x.legal?.registry==='SIRUTA'&&x.jurisdiction!=='RO')throw new Error('SIRUTA identity outside RO: '+x.id);
 if(x.legal?.registry==='CUATM'&&x.jurisdiction!=='MD')throw new Error('CUATM identity outside MD: '+x.id);
}
for(const [key,features] of Object.entries(tierFeatures)){
 for(const f of features){
  if('tags' in (f.properties||{}))throw new Error('Raw OSM tags leaked into public geometry '+key);
  if(!publicById.has(f.properties.entity_id))throw new Error('Unknown entity in public geometry '+f.properties.entity_id);
 }
}

await mkdir('public/data',{recursive:true});
await mkdir(OUT_DIR,{recursive:true});
await writeFile(OUT_INDEX,JSON.stringify(index,null,2)+'\n');
const geometrySourceSummary=features=>{
 const values=[...new Set(features.map(f=>f.properties?.geometry_source).filter(Boolean))].sort();
 return values.length===1?values[0]:(values.length?'mixed':null);
};
for(const jurisdiction of ['RO','MD']){
 for(const tier of ['overview','local','detail']){
  const key=jurisdiction+'_'+tier;
  const out={
   type:'FeatureCollection',
   metadata:{
    schema_version:1,
    contract:'actual-public-geometry-v1',
    mode:'ACTUAL',
    jurisdiction,
    tier,
    feature_count:tierFeatures[key].length,
    geometry_source:geometrySourceSummary(tierFeatures[key]),
    geometry_precision:'master_coordinate_fidelity'
   },
   features:tierFeatures[key]
  };
  await writeFile(OUT_DIR+'/'+jurisdiction.toLowerCase()+'-'+tier+'.geojson',JSON.stringify(out));
 }
}

await rm(OUT_CHUNK_DIR,{recursive:true,force:true});
for(const chunk of geometryChunks){
 const source=chunkFeatures.get(chunk.jurisdiction+'_'+chunk.tier+'_'+chunk.root_entity_id);
 const out={
  type:'FeatureCollection',
  metadata:{
   schema_version:1,
   contract:'actual-public-geometry-chunk-v1',
   mode:'ACTUAL',
   jurisdiction:chunk.jurisdiction,
   tier:chunk.tier,
   root_entity_id:chunk.root_entity_id,
   feature_count:source.features.length,
   geometry_source:'OpenStreetMap',
   geometry_precision:'master_coordinate_fidelity'
  },
  features:source.features
 };
 const slash=chunk.path.lastIndexOf('/');
 await mkdir(chunk.path.slice(0,slash),{recursive:true});
 const bytes=Buffer.from(JSON.stringify(out));
 await writeFile(chunk.path,bytes);
 chunk.sha256=sha256(bytes);
 chunk.bytes=bytes.length;
}
const chunkIndex={
 schema_version:1,
 contract:'actual-public-geometry-chunks-v1',
 mode:'ACTUAL',
 generated_at:index.generated_at,
 policy:'Viewport chunks partition existing public geometries by overview ancestor without coordinate simplification or mutation.',
 chunk_count:geometryChunks.length,
 chunks:geometryChunks
};
await writeFile(OUT_CHUNK_INDEX,JSON.stringify(chunkIndex,null,2)+'\n');

console.log(JSON.stringify({
 contract:index.contract,
 entity_count:index.entity_count,
 entity_count_by_jurisdiction:index.entity_count_by_jurisdiction,
 feature_count_by_tier:index.feature_count_by_tier,
 legal_identity_status_counts:index.legal_identity_status_counts,
 geometry_chunk_count:geometryChunks.length
},null,2));

const statisticalActivation=await activateStatisticalPublic();
if(statisticalActivation.status==='PASS')console.log(JSON.stringify({gate:'p2_3_public_activation',...statisticalActivation}));
