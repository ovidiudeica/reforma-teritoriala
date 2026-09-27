#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import * as turf from '@turf/turf';

const CATALOG='data/current/entities.json';
const RO_GEO='public/geo/current/ro-administrative.geojson';
const MD_GEO='public/geo/current/md-administrative.geojson';
const MD_RECON='data/current/md-cuatm-reconciliation.json';
const MD_NON_CUATM='data/current/md-cuatm-non-cuatm-allotments.json';
const MD_INDIVIDUAL='data/sources/md-cuatm-individual-review.json';
const OUT_INDEX='public/data/actual-entities.json';
const OUT_DIR='public/geo/actual';

const read=async path=>JSON.parse(await readFile(path,'utf8'));
const [catalog,roGeo,mdGeo,mdRecon,mdNonCuatm,mdIndividual]=await Promise.all([
 read(CATALOG),read(RO_GEO),read(MD_GEO),read(MD_RECON),read(MD_NON_CUATM),read(MD_INDIVIDUAL)
]);

const entities=catalog.entities||[];
const entityById=new Map(entities.map(e=>[e.id,e]));
const mdMatchById=new Map((mdRecon.matches||[]).map(x=>[x.id,x]));
const mdNonCuatmById=new Map((mdNonCuatm.items||[]).map(x=>[x.id,x]));
const mdIndividualById=new Map((mdIndividual.cases||[]).map(x=>[x.osm_id,x]));
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
  if(m?.legal_id){
   return {
    registry:'CUATM',
    id:String(m.legal_id),
    name:m.legal_name||null,
    type:null,
    status_code:m.status_code||null,
    parent_id:m.legal_parent_id==null?null:String(m.legal_parent_id),
    parent_name:m.legal_parent_name||null,
    reference_year:null,
    match_method:m.match_method||null,
    confidence:m.confidence||null,
    source:'data/sources/cuatm-current.json'
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
 if(legal)legalIdentityStatus='reconciled';
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
 const bounds=turf.bbox(f);
 const center=turf.centroid(f).geometry.coordinates;
 const parent=entityById.get(e.parent_id)||null;
 const level=e.osm?.admin_level??null;
 const tier=tierFor(level);
 const validation=validationFor(e,legal);
 const item={
  id:e.id,
  status:'current',
  jurisdiction:e.jurisdiction,
  category:e.category||'administrative',
  name:e.name||null,
  official_name:e.official_name||legal?.name||null,
  display_name:legal?.name||e.official_name||e.name||e.id,
  display_type:legal?.type||e.type||'administrative',
  searchable_names:uniqueStrings([e.name,e.official_name,legal?.name]),
  legal,
  hierarchy:{
   parent_catalog_id:e.parent_id||null,
   parent_name:parent?.name||null,
   legal_parent_id:legal?.parent_id||null,
   legal_parent_name:legal?.parent_name||null
  },
  representation:{
   source:'OpenStreetMap',
   source_url:e.source_url||('https://www.openstreetmap.org/relation/'+e.osm?.relation_id),
   osm_relation_id:e.osm?.relation_id??null,
   admin_level:level,
   place:e.osm?.place||null,
   inferred_type:e.classification?.osm_inferred_type||e.type||null,
   geometry_source:'OpenStreetMap administrative relation',
   geometry_role:'current_representation',
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
   geometry_source:'OpenStreetMap',
   geometry_precision:'master_coordinate_fidelity'
  },
  geometry:source.feature.geometry
 });
}

const countsByJurisdiction=Object.fromEntries(['RO','MD'].map(j=>[j,publicEntities.filter(x=>x.jurisdiction===j).length]));
const countsByTier=Object.fromEntries(Object.entries(tierFeatures).map(([key,features])=>[key,features.length]));
const legalStatusCounts=publicEntities.reduce((a,x)=>(a[x.validation.legal_identity_status]=(a[x.validation.legal_identity_status]||0)+1,a),{});
const index={
 schema_version:1,
 contract:'actual-public-entity-v1',
 mode:'ACTUAL',
 generated_at:catalog.generated_at??null,
 policy:'Public contract separates official legal identity from OSM representation. Null legal fields are preserved when no positive official identity is bound; OSM metadata never creates legal identity. Public web geometries preserve the exact master feature coordinates and are partitioned only for progressive loading.',
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
    geometry_source:'OpenStreetMap',
    geometry_precision:'master_coordinate_fidelity'
   },
   features:tierFeatures[key]
  };
  await writeFile(OUT_DIR+'/'+jurisdiction.toLowerCase()+'-'+tier+'.geojson',JSON.stringify(out));
 }
}
console.log(JSON.stringify({
 contract:index.contract,
 entity_count:index.entity_count,
 entity_count_by_jurisdiction:index.entity_count_by_jurisdiction,
 feature_count_by_tier:index.feature_count_by_tier,
 legal_identity_status_counts:index.legal_identity_status_counts
},null,2));
