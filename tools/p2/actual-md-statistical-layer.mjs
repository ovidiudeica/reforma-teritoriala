import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

export const MD_LAYER_PATH='data/p2/actual-statistical-md.json';
export const MD_NUTS_PATH='data/sources/md-nuts-2017.json';
export const MD_OSM_MANIFEST_PATH='data/sources/md-statistical-osm-current.json';
export const CUATM_PATH='data/sources/cuatm-current.json';
export const CATALOG_PATH='data/current/entities.json';
export const PUBLIC_PATH='public/data/actual-entities.json';
export const RELEASE_MANIFEST_PATH='data/current/actual-release-manifest.json';
export const MD_ADMIN_GEO_PATH='public/geo/current/md-administrative.geojson';
export const RO_ADMIN_GEO_PATH='public/geo/current/ro-administrative.geojson';

export const sha256=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const fp=value=>sha256(Buffer.from(JSON.stringify(canonical(value)),'utf8'));

function canonicalMdEntity(publicEntities,cuatmRecord){
 const matches=publicEntities.filter(e=>e.jurisdiction==='MD'
  &&String(e.legal?.id??'')===String(cuatmRecord?.code??'')
  &&Number(e.representation?.admin_level)===4
  &&e.hierarchy?.parent_catalog_id==='MD');
 if(matches.length!==1)throw new Error('Expected exactly one canonical MD entity for CUATM '+String(cuatmRecord?.code??'?')+', got '+matches.length);
 return matches[0];
}

export async function buildMdStatisticalLayer({readFileFn=readFile}={}){
 const [nutsBytes,osmManifestBytes,cuatmBytes,catalogBytes,publicBytes,releaseBytes]=await Promise.all([
  readFileFn(MD_NUTS_PATH),readFileFn(MD_OSM_MANIFEST_PATH),readFileFn(CUATM_PATH),readFileFn(CATALOG_PATH),readFileFn(PUBLIC_PATH),readFileFn(RELEASE_MANIFEST_PATH)
 ]);
 const nuts=JSON.parse(nutsBytes),osm=JSON.parse(osmManifestBytes),cuatm=JSON.parse(cuatmBytes),catalog=JSON.parse(catalogBytes),pub=JSON.parse(publicBytes),release=JSON.parse(releaseBytes);
 const units=nuts.units||[];const unitByCode=new Map(units.map(x=>[x.code,x]));
 const publicEntities=pub.entities||[];
 const state=publicEntities.find(x=>x.jurisdiction==='MD'&&x.display_type==='state');
 if(!state)throw new Error('MD state entity missing');
 const cuatmByStat=new Map((cuatm.records||[]).map(x=>[String(x.statistical_code),x]));
 const reusedSpecs=[
  {code:'MD1',entity:state,component_statistical_code:null},
  {code:'MD114',entity:canonicalMdEntity(publicEntities,cuatmByStat.get('9600000')),component_statistical_code:'9600000'},
  {code:'MD115',entity:canonicalMdEntity(publicEntities,cuatmByStat.get('0101000')),component_statistical_code:'0101000'}
 ];
 const reusedStatisticalRoles=reusedSpecs.map(({code,entity,component_statistical_code})=>{
  const unit=unitByCode.get(code);if(!unit)throw new Error('Missing official unit '+code);
  return {
   entity_id:entity.id,
   roles:['administrative','statistical'],
   statistical:{
    classification:'NUTS_MOLDOVA',
    version:'2017',
    code,
    level:unit.level,
    parent_code:unit.parent_code,
    parent_entity_id:code==='MD1'?null:'stat-'+unit.parent_code,
    identity_authority:'Biroul Național de Statistică al Republicii Moldova',
    source:MD_NUTS_PATH,
    component_statistical_code
   },
   geometry_reuse:{
    source_entity_id:entity.id,
    master_geometry_path:MD_ADMIN_GEO_PATH,
    duplicate_geometry:false,
    geometry_modified:false,
    reuse_existing_master_geometry:true,
    additional_geometry_role:'statistical_boundary'
   }
  };
 });
 const newCodes=['MD11','MD12','MD111','MD112','MD113','MD120'];
 const statisticalEntities=newCodes.map(code=>{
  const unit=unitByCode.get(code),rel=osm.relations?.[code];
  if(!unit||!rel)throw new Error('Missing unit/source for '+code);
  return {
   id:'stat-'+code,
   status:'current',
   jurisdiction:'MD',
   category:'statistical',
   type:'nuts_moldova_level_'+unit.level,
   name:unit.name,
   official_name:unit.name,
   roles:['statistical'],
   statistical:{
    classification:'NUTS_MOLDOVA',
    version:'2017',
    code,
    level:unit.level,
    parent_code:unit.parent_code,
    parent_entity_id:unit.level===2?state.id:'stat-'+unit.parent_code,
    identity_authority:'Biroul Național de Statistică al Republicii Moldova',
    source:MD_NUTS_PATH
   },
   representation:{
    source:'OpenStreetMap',
    osm_relation_id:rel.relation_id,
    boundary:'statistical',
    geometry_role:'statistical_boundary',
    geometry_scope:'nuts_moldova_level_'+unit.level,
    source_manifest:MD_OSM_MANIFEST_PATH,
    source_snapshot:osm.snapshot_path,
    coordinates_embedded:false,
    osm_statistical_ref:rel.tags?.ref_nuts??rel.tags?.ref??null,
    osm_ref_is_identity_authority:false,
    identity_ref_conflict:code==='MD120'?'official_MD120_osm_MD121':null
   }
  };
 });
 const componentBindings=[];
 for(const unit of units.filter(x=>x.level===3)){
  for(const statisticalCode of unit.component_statistical_codes||[]){
   const rec=cuatmByStat.get(String(statisticalCode));if(!rec)throw new Error('Missing CUATM component '+statisticalCode);
   const entity=canonicalMdEntity(publicEntities,rec);
   const reused=reusedStatisticalRoles.find(x=>x.statistical.code===unit.code);
   const coalescedSameEntity=Boolean(reused&&reused.entity_id===entity.id);
   componentBindings.push({
    entity_id:entity.id,
    legal_registry:'CUATM',
    legal_id:String(rec.code),
    component_statistical_code:String(statisticalCode),
    statistical_parent_code:unit.code,
    statistical_parent_entity_id:reused?reused.entity_id:'stat-'+unit.code,
    tree_edge_created:!coalescedSameEntity,
    coalesced_same_territorial_entity:coalescedSameEntity,
    source:MD_NUTS_PATH
   });
  }
 }
 componentBindings.sort((a,b)=>a.component_statistical_code.localeCompare(b.component_statistical_code));
 const core={
  schema_version:1,
  contract:'actual-statistical-md-v1',
  phase:'P2.2_MD',
  mode:'ACTUAL_STATISTICAL_OVERLAY',
  jurisdiction:'MD',
  generated_at:osm.fetched_at,
  policy:'Adds 2 level-2 and 4 level-3 statistical-only entities, reuses the existing Moldova/Gagauzia/Chisinau entities for MD1/MD114/MD115, and binds all 37 official CUATM components. Administrative identity, parentage and master geometry are not rewritten. MD120 identity is BNS-authoritative even where OSM geometry is tagged MD121.',
  counts:{statistical_only_entities:statisticalEntities.length,reused_existing_statistical_entities:reusedStatisticalRoles.length,total_statistical_roles:statisticalEntities.length+reusedStatisticalRoles.length,component_bindings:componentBindings.length},
  sources:{
   official_nomenclature:{path:MD_NUTS_PATH,sha256:sha256(nutsBytes),version:nuts.classification_version},
   osm_statistical:{path:MD_OSM_MANIFEST_PATH,sha256:sha256(osmManifestBytes),snapshot_path:osm.snapshot_path,semantic_sha256:osm.semantic_sha256,compressed_sha256:osm.compressed_sha256},
   cuatm_bridge:{path:CUATM_PATH,sha256:sha256(cuatmBytes),fetched_at:cuatm.fetched_at},
   p1_catalog:{path:CATALOG_PATH,sha256:sha256(catalogBytes),snapshot_id:JSON.parse(await readFileFn('data/sources/actual-statistical-policy.json')).p1_invariants.expected_snapshot_id}
  },
  statistical_entities:statisticalEntities,
  existing_entity_statistical_roles:reusedStatisticalRoles,
  administrative_component_bindings:componentBindings
 };
 return {...core,layer_fingerprint_algorithm:'actual-statistical-md-v1',layer_fingerprint_sha256:fp(core)};
}

export async function validateMdStatisticalLayer({readFileFn=readFile}={}){
 const checks=[],failures=[];const check=(name,ok,detail={})=>{checks.push({name,ok:Boolean(ok),detail});if(!ok)failures.push({name,detail});};
 const expected=await buildMdStatisticalLayer({readFileFn});
 const [layerBytes,osmManifestBytes,releaseBytes,catalogBytes,publicBytes,mdGeoBytes,roGeoBytes]=await Promise.all([
  readFileFn(MD_LAYER_PATH),readFileFn(MD_OSM_MANIFEST_PATH),readFileFn(RELEASE_MANIFEST_PATH),readFileFn(CATALOG_PATH),readFileFn(PUBLIC_PATH),readFileFn(MD_ADMIN_GEO_PATH),readFileFn(RO_ADMIN_GEO_PATH)
 ]);
 const layer=JSON.parse(layerBytes),osm=JSON.parse(osmManifestBytes),release=JSON.parse(releaseBytes),catalog=JSON.parse(catalogBytes),pub=JSON.parse(publicBytes);
 let snapshot=null;
 try{
  const compressed=await readFileFn(osm.snapshot_path);
  check('osm_statistical_snapshot_compressed_sha256',sha256(compressed)===osm.compressed_sha256,{expected:osm.compressed_sha256,actual:sha256(compressed)});
  const semantic=gunzipSync(compressed);
  check('osm_statistical_snapshot_semantic_sha256',sha256(semantic)===osm.semantic_sha256,{expected:osm.semantic_sha256,actual:sha256(semantic)});
  snapshot=JSON.parse(semantic.toString('utf8'));
 }catch(error){check('osm_statistical_snapshot_readable',false,{error:String(error?.message||error)});}
 check('layer_recomputes_exactly',JSON.stringify(canonical(layer))===JSON.stringify(canonical(expected)),{expected_fingerprint:expected.layer_fingerprint_sha256,actual_fingerprint:layer.layer_fingerprint_sha256});
 check('layer_counts_exact',layer.counts?.statistical_only_entities===6&&layer.counts?.reused_existing_statistical_entities===3&&layer.counts?.total_statistical_roles===9&&layer.counts?.component_bindings===37,layer.counts||{});
 const newEntities=layer.statistical_entities||[],reused=layer.existing_entity_statistical_roles||[],components=layer.administrative_component_bindings||[];
 check('new_statistical_codes_exact',JSON.stringify(newEntities.map(x=>x.statistical.code).sort())===JSON.stringify(['MD11','MD12','MD111','MD112','MD113','MD120'].sort()),{codes:newEntities.map(x=>x.statistical.code)});
 check('reused_statistical_codes_exact',JSON.stringify(reused.map(x=>x.statistical.code).sort())===JSON.stringify(['MD1','MD114','MD115'].sort()),{codes:reused.map(x=>x.statistical.code)});
 const reusedIds=Object.fromEntries(reused.map(x=>[x.statistical.code,x.entity_id]));
 check('reused_entity_ids_exact',reusedIds.MD1==='osm-r58974'&&reusedIds.MD114==='osm-r1699032'&&reusedIds.MD115==='osm-r1691801',{reusedIds});
 check('new_entity_geometry_is_reference_only',newEntities.every(x=>x.representation?.coordinates_embedded===false&&!('geometry' in x)),{});
 check('reused_geometry_is_reference_only',reused.every(x=>x.geometry_reuse?.source_entity_id===x.entity_id&&x.geometry_reuse?.duplicate_geometry===false&&x.geometry_reuse?.geometry_modified===false&&x.geometry_reuse?.reuse_existing_master_geometry===true),{});
 check('component_bindings_exact_and_unique',components.length===37&&new Set(components.map(x=>x.component_statistical_code)).size===37,{count:components.length,unique:new Set(components.map(x=>x.component_statistical_code)).size});
 const publicIds=new Set((pub.entities||[]).map(x=>x.id));
 check('all_component_bindings_target_existing_entities',components.every(x=>publicIds.has(x.entity_id)),{missing:components.filter(x=>!publicIds.has(x.entity_id)).map(x=>x.entity_id)});
 const md114=components.find(x=>x.statistical_parent_code==='MD114'),md115=components.find(x=>x.statistical_parent_code==='MD115');
 check('md114_md115_coalesce_same_entity',md114?.coalesced_same_territorial_entity===true&&md114?.tree_edge_created===false&&md115?.coalesced_same_territorial_entity===true&&md115?.tree_edge_created===false,{md114,md115});
 const md120=components.filter(x=>x.statistical_parent_code==='MD120');
 check('md120_components_exact',JSON.stringify(md120.map(x=>x.component_statistical_code).sort())===JSON.stringify(['0501000','9800000']),{components:md120.map(x=>x.component_statistical_code)});
 check('md120_identity_authority_is_official',newEntities.find(x=>x.statistical.code==='MD120')?.statistical?.identity_authority==='Biroul Național de Statistică al Republicii Moldova'&&newEntities.find(x=>x.statistical.code==='MD120')?.representation?.osm_ref_is_identity_authority===false,{});
 check('md120_osm_ref_conflict_is_explicit',newEntities.find(x=>x.statistical.code==='MD120')?.representation?.osm_statistical_ref==='MD121'&&newEntities.find(x=>x.statistical.code==='MD120')?.representation?.identity_ref_conflict==='official_MD120_osm_MD121',{});
 check('no_md121_statistical_identity',![...newEntities,...reused].some(x=>x.statistical?.code==='MD121'),{});
 const publicActivated=pub.contract==='actual-public-entity-v3';
 check('p1_catalog_cardinality_unchanged',
  (catalog.entities||[]).length===5830
  &&catalog.entity_count===5830
  &&(publicActivated?pub.entity_count===5848:pub.entity_count===5830),
  {catalog:(catalog.entities||[]).length,public:pub.entity_count,public_contract:pub.contract});
 check('public_statistical_reuse_state_is_coherent',
  !publicActivated
   || (reused.length===3
    &&reused.every(binding=>{
      const entity=(pub.entities||[]).find(x=>x.id===binding.entity_id);
      return entity?.roles?.includes('statistical')&&entity?.statistical?.code===binding.statistical.code;
    })),
  {activated:publicActivated,reused_count:reused.length});
 check('p1_catalog_bytes_unchanged',release.components?.catalog?.sha256===sha256(catalogBytes),{expected:release.components?.catalog?.sha256,actual:sha256(catalogBytes)});
 check('p1_public_index_bytes_unchanged',release.components?.public_index?.sha256===sha256(publicBytes),{expected:release.components?.public_index?.sha256,actual:sha256(publicBytes)});
 check('p1_md_geometry_bytes_unchanged',release.components?.md_geojson?.sha256===sha256(mdGeoBytes),{expected:release.components?.md_geojson?.sha256,actual:sha256(mdGeoBytes)});
 check('p1_ro_geometry_bytes_unchanged',release.components?.ro_geojson?.sha256===sha256(roGeoBytes),{expected:release.components?.ro_geojson?.sha256,actual:sha256(roGeoBytes)});
 if(snapshot){
  const relById=new Map((snapshot.elements||[]).filter(x=>x.type==='relation').map(x=>[x.id,x]));const issues=[];
  for(const [code,src] of Object.entries(osm.relations||{})){
   const rel=relById.get(src.relation_id);const ref=rel?.tags?.['ref:nuts']??rel?.tags?.ref??null;
   const ok=rel?.tags?.boundary==='statistical'&&(code==='MD120'?['MD120','MD121'].includes(ref):ref===code);
   if(!ok)issues.push({code,relation_id:src.relation_id,boundary:rel?.tags?.boundary??null,ref});
  }
  check('osm_relations_match_reviewed_statistical_geometry_bindings',issues.length===0,{issues});
 }
 check('overlay_contains_no_coordinate_arrays',!/"coordinates"\s*:/.test(layerBytes.toString('utf8')),{});
 return {schema_version:1,mode:'ACTUAL_STATISTICAL_MD_P2_2_GATE',phase:'P2.2_MD',status:failures.length?'FAIL':'PASS',checks,failures,summary:{statistical_only_entities:newEntities.length,reused_existing_statistical_entities:reused.length,component_bindings:components.length,p1_entity_count:(catalog.entities||[]).length,geometry_mutations:0,geometry_duplicates:0,md121_identity_count:0}};
}
