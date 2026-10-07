import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

export const RO_LAYER_PATH='data/p2/actual-statistical-ro.json';
export const RO_NUTS_PATH='data/sources/ro-nuts-2024.json';
export const RO_OSM_MANIFEST_PATH='data/sources/ro-statistical-osm-current.json';
export const SIRUTA_PATH='data/sources/ro-siruta-current.json';
export const CATALOG_PATH='data/current/entities.json';
export const PUBLIC_PATH='public/data/actual-entities.json';
export const RELEASE_MANIFEST_PATH='data/current/actual-release-manifest.json';
export const RO_ADMIN_GEO_PATH='public/geo/current/ro-administrative.geojson';
export const MD_ADMIN_GEO_PATH='public/geo/current/md-administrative.geojson';

export const sha256=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const fp=value=>sha256(Buffer.from(JSON.stringify(canonical(value)),'utf8'));

export async function buildRoStatisticalLayer({readFileFn=readFile}={}){
 const [nutsBytes,osmManifestBytes,sirutaBytes,catalogBytes,releaseBytes]=await Promise.all([
  readFileFn(RO_NUTS_PATH),readFileFn(RO_OSM_MANIFEST_PATH),readFileFn(SIRUTA_PATH),readFileFn(CATALOG_PATH),readFileFn(RELEASE_MANIFEST_PATH)
 ]);
 const nuts=JSON.parse(nutsBytes),osm=JSON.parse(osmManifestBytes),siruta=JSON.parse(sirutaBytes),catalog=JSON.parse(catalogBytes),release=JSON.parse(releaseBytes);
 const units=nuts.units||[];
 const level12=units.filter(x=>x.level===1||x.level===2).sort((a,b)=>a.code.localeCompare(b.code));
 const level3=units.filter(x=>x.level===3).sort((a,b)=>a.code.localeCompare(b.code));
 const entities=catalog.entities||[];
 const state=entities.find(x=>x.jurisdiction==='RO'&&x.type==='state');
 if(!state)throw new Error('RO state entity missing');
 const counties=entities.filter(x=>x.jurisdiction==='RO'&&x.type==='county');
 const sirutaCounties=(siruta.records||[]).filter(x=>Number(x.level)===1);
 const sirutaByCountyCode=new Map(sirutaCounties.map(x=>[String(x.county_code),x]));
 const unitByCode=new Map(units.map(x=>[x.code,x]));
 const statisticalEntities=level12.map(unit=>{
  const rel=osm.relations?.[unit.code];
  if(!rel)throw new Error('Missing OSM statistical relation '+unit.code);
  const parentEntityId=unit.level===1?state.id:'stat-'+unit.parent_code;
  return {
   id:'stat-'+unit.code,
   status:'current',
   jurisdiction:'RO',
   category:'statistical',
   type:'nuts_level_'+unit.level,
   name:unit.name,
   official_name:unit.name,
   roles:['statistical'],
   statistical:{
    classification:'NUTS',
    version:'2024',
    code:unit.code,
    level:unit.level,
    parent_code:unit.parent_code,
    parent_entity_id:parentEntityId,
    identity_authority:'Eurostat / GISCO',
    source:RO_NUTS_PATH
   },
   representation:{
    source:'OpenStreetMap',
    osm_relation_id:rel.relation_id,
    boundary:'statistical',
    geometry_role:'statistical_boundary',
    geometry_scope:'nuts_level_'+unit.level,
    source_manifest:RO_OSM_MANIFEST_PATH,
    source_snapshot:osm.snapshot_path,
    coordinates_embedded:false,
    geometry_review_class:['RO22','RO2'].includes(unit.code)?'osm_statistical_geometry_differs_from_administrative_union':null
   }
  };
 });
 const memberships=counties.map(entity=>{
  const official=sirutaByCountyCode.get(String(entity.legal?.id??''));
  if(!official?.nuts)throw new Error('Missing SIRUTA NUTS binding for '+entity.id);
  const unit=unitByCode.get(official.nuts);
  if(!unit||unit.level!==3)throw new Error('Invalid NUTS3 binding '+official.nuts+' for '+entity.id);
  return {
   entity_id:entity.id,
   roles:['administrative','statistical'],
   statistical:{
    classification:'NUTS',
    version:'2024',
    code:unit.code,
    level:3,
    parent_code:unit.parent_code,
    parent_entity_id:'stat-'+unit.parent_code,
    identity_authority:'Eurostat / GISCO',
    membership_source:RO_NUTS_PATH,
    bridge_source:SIRUTA_PATH
   },
   geometry_reuse:{
    source_entity_id:entity.id,
    master_geometry_path:RO_ADMIN_GEO_PATH,
    duplicate_geometry:false,
    geometry_modified:false,
    reuse_existing_master_geometry:true,
    additional_geometry_role:'statistical_boundary'
   }
  };
 }).sort((a,b)=>a.statistical.code.localeCompare(b.statistical.code));
 const core={
  schema_version:1,
  contract:'actual-statistical-ro-v1',
  phase:'P2.1_RO',
  mode:'ACTUAL_STATISTICAL_OVERLAY',
  jurisdiction:'RO',
  generated_at:osm.fetched_at,
  policy:'Adds 4 NUTS1 and 8 NUTS2 statistical-only entities and binds NUTS3 membership to the existing 42 county/Bucharest entities. Administrative identity, parentage and master geometry are not rewritten. NUTS3 geometry is reused by reference only.',
  counts:{statistical_only_entities:statisticalEntities.length,reused_existing_nuts3_entities:memberships.length,total_statistical_roles:statisticalEntities.length+memberships.length},
  sources:{
   official_nuts:{path:RO_NUTS_PATH,sha256:sha256(nutsBytes),version:nuts.classification_version},
   osm_statistical:{path:RO_OSM_MANIFEST_PATH,sha256:sha256(osmManifestBytes),snapshot_path:osm.snapshot_path,semantic_sha256:osm.semantic_sha256,compressed_sha256:osm.compressed_sha256},
   siruta_bridge:{path:SIRUTA_PATH,sha256:sha256(sirutaBytes),reference_year:siruta.reference_year},
   p1_catalog:{path:CATALOG_PATH,sha256:sha256(catalogBytes),snapshot_id:release.snapshot_id}
  },
  statistical_entities:statisticalEntities,
  existing_entity_memberships:memberships
 };
 return {...core,layer_fingerprint_algorithm:'actual-statistical-ro-v1',layer_fingerprint_sha256:fp(core)};
}

export async function validateRoStatisticalLayer({readFileFn=readFile}={}){
 const checks=[],failures=[];const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 const expected=await buildRoStatisticalLayer({readFileFn});
 const [layerBytes,osmManifestBytes,releaseBytes,catalogBytes,publicBytes,roGeoBytes,mdGeoBytes]=await Promise.all([
  readFileFn(RO_LAYER_PATH),readFileFn(RO_OSM_MANIFEST_PATH),readFileFn(RELEASE_MANIFEST_PATH),readFileFn(CATALOG_PATH),readFileFn(PUBLIC_PATH),readFileFn(RO_ADMIN_GEO_PATH),readFileFn(MD_ADMIN_GEO_PATH)
 ]);
 const layer=JSON.parse(layerBytes),osm=JSON.parse(osmManifestBytes),release=JSON.parse(releaseBytes),catalog=JSON.parse(catalogBytes),pub=JSON.parse(publicBytes);
 let compressed=null,snapshot=null;
 try{
  compressed=await readFileFn(osm.snapshot_path);
  check('osm_statistical_snapshot_compressed_sha256',sha256(compressed)===osm.compressed_sha256,{expected:osm.compressed_sha256,actual:sha256(compressed)});
  const semantic=gunzipSync(compressed);
  check('osm_statistical_snapshot_semantic_sha256',sha256(semantic)===osm.semantic_sha256,{expected:osm.semantic_sha256,actual:sha256(semantic)});
  snapshot=JSON.parse(semantic.toString('utf8'));
 }catch(error){check('osm_statistical_snapshot_readable',false,{error:String(error?.message||error)});}
 check('layer_recomputes_exactly',JSON.stringify(canonical(layer))===JSON.stringify(canonical(expected)),{expected_fingerprint:expected.layer_fingerprint_sha256,actual_fingerprint:layer.layer_fingerprint_sha256});
 check('layer_counts_exact',layer.counts?.statistical_only_entities===12&&layer.counts?.reused_existing_nuts3_entities===42&&layer.counts?.total_statistical_roles===54,layer.counts||{});
 const newEntities=layer.statistical_entities||[],memberships=layer.existing_entity_memberships||[];
 check('new_entities_are_only_nuts1_nuts2',newEntities.length===12&&newEntities.every(x=>x.id==='stat-'+x.statistical.code&&[1,2].includes(x.statistical.level)),{ids:newEntities.map(x=>x.id)});
 check('new_entity_ids_unique',new Set(newEntities.map(x=>x.id)).size===12,{});
 check('new_entity_geometry_is_reference_only',newEntities.every(x=>x.representation?.coordinates_embedded===false&&!('geometry' in x)),{});
 check('nuts3_memberships_unique',memberships.length===42&&new Set(memberships.map(x=>x.entity_id)).size===42&&new Set(memberships.map(x=>x.statistical.code)).size===42,{});
 check('nuts3_reuses_existing_geometry_only',memberships.every(x=>x.geometry_reuse?.source_entity_id===x.entity_id&&x.geometry_reuse?.duplicate_geometry===false&&x.geometry_reuse?.geometry_modified===false&&x.geometry_reuse?.reuse_existing_master_geometry===true),{});
 check('no_nuts3_duplicate_entities',newEntities.every(x=>x.statistical.level!==3),{});
 const catalogIds=new Set((catalog.entities||[]).map(x=>x.id));
 check('all_nuts3_memberships_target_existing_catalog_entities',memberships.every(x=>catalogIds.has(x.entity_id)),{missing:memberships.filter(x=>!catalogIds.has(x.entity_id)).map(x=>x.entity_id)});
 check('p1_catalog_cardinality_unchanged',(catalog.entities||[]).length===5830&&catalog.entity_count===5830&&[5830,5848].includes(pub.entity_count),{catalog:(catalog.entities||[]).length,public:pub.entity_count});
 check('p1_catalog_bytes_unchanged',release.components?.catalog?.sha256===sha256(catalogBytes),{expected:release.components?.catalog?.sha256,actual:sha256(catalogBytes)});
 check('p1_public_index_bytes_unchanged',release.components?.public_index?.sha256===sha256(publicBytes),{expected:release.components?.public_index?.sha256,actual:sha256(publicBytes)});
 check('p1_ro_geometry_bytes_unchanged',release.components?.ro_geojson?.sha256===sha256(roGeoBytes),{expected:release.components?.ro_geojson?.sha256,actual:sha256(roGeoBytes)});
 check('p1_md_geometry_bytes_unchanged',release.components?.md_geojson?.sha256===sha256(mdGeoBytes),{expected:release.components?.md_geojson?.sha256,actual:sha256(mdGeoBytes)});
 if(snapshot){
  const relById=new Map((snapshot.elements||[]).filter(x=>x.type==='relation').map(x=>[x.id,x]));
  const relationIssues=[];
  for(const entity of newEntities){
   const rel=relById.get(entity.representation.osm_relation_id);
   const ref=rel?.tags?.['ref:nuts']??rel?.tags?.ref??null;
   if(!rel||rel.tags?.boundary!=='statistical'||ref!==entity.statistical.code)relationIssues.push({code:entity.statistical.code,relation_id:entity.representation.osm_relation_id,boundary:rel?.tags?.boundary??null,ref});
  }
  check('osm_relations_match_statistical_identity',relationIssues.length===0,{issues:relationIssues});
 }
 check('known_ro22_ro2_geometry_difference_is_explicit',['RO22','RO2'].every(code=>newEntities.find(x=>x.statistical.code===code)?.representation?.geometry_review_class==='osm_statistical_geometry_differs_from_administrative_union'),{});
 check('overlay_contains_no_coordinate_arrays',!/"coordinates"\s*:/.test(layerBytes.toString('utf8')),{});
 return {schema_version:1,mode:'ACTUAL_STATISTICAL_RO_P2_1_GATE',phase:'P2.1_RO',status:failures.length?'FAIL':'PASS',checks,failures,summary:{statistical_only_entities:newEntities.length,reused_existing_nuts3_entities:memberships.length,p1_entity_count:(catalog.entities||[]).length,geometry_mutations:0,geometry_duplicates:0}};
}
