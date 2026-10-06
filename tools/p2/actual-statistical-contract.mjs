import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const STATISTICAL_CONTRACT_PATH='schemas/actual-statistical-hierarchy-contract.json';
export const STATISTICAL_POLICY_PATH='data/sources/actual-statistical-policy.json';
export const STATISTICAL_SOURCE_BUNDLE_PATH='data/sources/actual-statistical-source-bundle.json';
export const RO_STATISTICAL_SOURCE_PATH='data/sources/ro-nuts-2024.json';
export const MD_STATISTICAL_SOURCE_PATH='data/sources/md-nuts-2017.json';
export const STATISTICAL_SOURCE_BUNDLE_ALGORITHM='actual-statistical-source-bundle-v1';

export const sha256=value=>createHash('sha256').update(value).digest('hex');

export function canonicalize(value){
 if(Array.isArray(value))return value.map(canonicalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
 return value;
}

export function statisticalSourceBundleFingerprint(bundle){
 const payload=canonicalize({
  algorithm:STATISTICAL_SOURCE_BUNDLE_ALGORITHM,
  sources:bundle?.sources??null
 });
 return {
  algorithm:STATISTICAL_SOURCE_BUNDLE_ALGORITHM,
  sha256:sha256(Buffer.from(JSON.stringify(payload),'utf8')),
  payload
 };
}

const sameSet=(a,b)=>JSON.stringify([...new Set(a)].sort())===JSON.stringify([...new Set(b)].sort());
const countLevels=units=>Object.fromEntries([1,2,3].map(level=>[String(level),units.filter(x=>Number(x.level)===level).length]));
const canonicalMdCodes=['MD1','MD11','MD12','MD111','MD112','MD113','MD114','MD115','MD120'];
const canonicalRoLevel1=['RO1','RO2','RO3','RO4'];
const canonicalRoLevel2=['RO11','RO12','RO21','RO22','RO31','RO32','RO41','RO42'];

export async function validateActualStatisticalContract({readFileFn=readFile}={}){
 const checks=[],failures=[];
 const check=(name,ok,detail={})=>{
  checks.push({name,ok:Boolean(ok),detail});
  if(!ok)failures.push({name,detail});
 };
 const paths=[
  STATISTICAL_CONTRACT_PATH,STATISTICAL_POLICY_PATH,STATISTICAL_SOURCE_BUNDLE_PATH,
  RO_STATISTICAL_SOURCE_PATH,MD_STATISTICAL_SOURCE_PATH,
  'data/sources/ro-siruta-current.json','data/sources/cuatm-current.json',
  'data/current/entities.json','public/data/actual-entities.json',
  'data/current/actual-release-manifest.json','data/current/actual-release-persisted.json',
  'public/geo/current/ro-administrative.geojson','public/geo/current/md-administrative.geojson',
  'schemas/actual-geometry-role-contract.json'
 ];
 const bytes={};
 for(const path of paths)bytes[path]=await readFileFn(path);
 const json=path=>JSON.parse(bytes[path].toString('utf8'));
 const contract=json(STATISTICAL_CONTRACT_PATH);
 const policy=json(STATISTICAL_POLICY_PATH);
 const bundle=json(STATISTICAL_SOURCE_BUNDLE_PATH);
 const ro=json(RO_STATISTICAL_SOURCE_PATH);
 const md=json(MD_STATISTICAL_SOURCE_PATH);
 const siruta=json('data/sources/ro-siruta-current.json');
 const cuatm=json('data/sources/cuatm-current.json');
 const catalog=json('data/current/entities.json');
 const publicIndex=json('public/data/actual-entities.json');
 const manifest=json('data/current/actual-release-manifest.json');
 const persisted=json('data/current/actual-release-persisted.json');
 const geometryRole=json('schemas/actual-geometry-role-contract.json');

 check('contract_identity',
  contract?.schema_version===1&&contract?.contract==='actual-statistical-hierarchy-v1'&&contract?.mode==='ACTUAL'&&contract?.phase==='P2_PREPARED',
  {schema_version:contract?.schema_version??null,contract:contract?.contract??null,mode:contract?.mode??null,phase:contract?.phase??null});
 check('contract_preserves_typed_hierarchies',
  contract?.hierarchies?.administrative?.immutable_during_p2_activation===true
  &&contract?.hierarchies?.statistical?.must_not_replace_administrative_parentage===true
  &&contract?.entity_reuse?.duplicate_entity_for_same_territorial_unit===false
  &&contract?.web_consolidation?.single_descending_tree===true,
  {});
 check('statistical_geometry_role_is_registered',
  geometryRole?.roles?.statistical_boundary?.hierarchy==='statistical'
  &&geometryRole?.rules?.legal_identity_and_geometry_role_must_be_separate===true,
  {role:geometryRole?.roles?.statistical_boundary??null});

 check('policy_is_prepared_not_activated',
  policy?.schema_version===1&&policy?.mode==='ACTUAL_STATISTICAL_POLICY'&&policy?.phase==='P2_PREPARED'&&policy?.activated===false,
  {phase:policy?.phase??null,activated:policy?.activated??null});
 check('policy_contract_binding',
  policy?.contract?.path===STATISTICAL_CONTRACT_PATH
  &&policy?.contract?.id===contract?.contract
  &&Number(policy?.contract?.schema_version)===Number(contract?.schema_version),
  {policy:policy?.contract??null});
 check('policy_source_bundle_binding',
  policy?.source_bundle?.path===STATISTICAL_SOURCE_BUNDLE_PATH
  &&policy?.source_bundle?.algorithm===STATISTICAL_SOURCE_BUNDLE_ALGORITHM,
  {policy:policy?.source_bundle??null});

 const sourceBytes={RO:bytes[RO_STATISTICAL_SOURCE_PATH],MD:bytes[MD_STATISTICAL_SOURCE_PATH]};
 const sourcePaths={RO:RO_STATISTICAL_SOURCE_PATH,MD:MD_STATISTICAL_SOURCE_PATH};
 check('source_bundle_identity',
  bundle?.schema_version===1&&bundle?.mode==='ACTUAL_STATISTICAL_SOURCE_BUNDLE'&&bundle?.phase==='P2_PREPARED',
  {schema_version:bundle?.schema_version??null,mode:bundle?.mode??null,phase:bundle?.phase??null});
 for(const jurisdiction of ['RO','MD']){
  check('source_bundle_'+jurisdiction+'_path',
   bundle?.sources?.[jurisdiction]?.path===sourcePaths[jurisdiction],
   {expected:sourcePaths[jurisdiction],actual:bundle?.sources?.[jurisdiction]?.path??null});
  check('source_bundle_'+jurisdiction+'_sha256',
   bundle?.sources?.[jurisdiction]?.sha256===sha256(sourceBytes[jurisdiction]),
   {expected:sha256(sourceBytes[jurisdiction]),actual:bundle?.sources?.[jurisdiction]?.sha256??null});
 }
 const bundleFp=statisticalSourceBundleFingerprint(bundle);
 check('source_bundle_fingerprint',
  bundle?.bundle_fingerprint_algorithm===bundleFp.algorithm&&bundle?.bundle_fingerprint_sha256===bundleFp.sha256,
  {expected:bundleFp.sha256,actual:bundle?.bundle_fingerprint_sha256??null});

 const roUnits=Array.isArray(ro?.units)?ro.units:[];
 const roCodes=roUnits.map(x=>x.code);
 const roLevel3=roUnits.filter(x=>Number(x.level)===3);
 check('ro_source_identity',
  ro?.schema_version===1&&ro?.mode==='ACTUAL_STATISTICAL_SOURCE'&&ro?.jurisdiction==='RO'&&ro?.classification==='NUTS'&&ro?.classification_version==='2024',
  {jurisdiction:ro?.jurisdiction??null,classification:ro?.classification??null,version:ro?.classification_version??null});
 check('ro_level_counts',
  ro?.unit_count===54&&JSON.stringify(countLevels(roUnits))===JSON.stringify({'1':4,'2':8,'3':42}),
  {declared:ro?.level_counts??null,actual:countLevels(roUnits),unit_count:ro?.unit_count??null});
 check('ro_codes_unique_and_well_formed',
  new Set(roCodes).size===roCodes.length&&roCodes.every(code=>/^RO[1-4][0-9]{0,2}$/.test(String(code))),
  {unique:new Set(roCodes).size,count:roCodes.length});
 check('ro_level_1_codes_exact',sameSet(roUnits.filter(x=>x.level===1).map(x=>x.code),canonicalRoLevel1),{});
 check('ro_level_2_codes_exact',sameSet(roUnits.filter(x=>x.level===2).map(x=>x.code),canonicalRoLevel2),{});
 check('ro_parent_chain_exact',
  roUnits.every(unit=>unit.level===1?unit.parent_code===null:unit.parent_code===unit.code.slice(0,-1)),
  {});
 const sirutaCounties=(siruta?.records||[]).filter(x=>Number(x.level)===1);
 const sirutaNuts=sirutaCounties.map(x=>x.nuts).filter(Boolean);
 check('ro_siruta_counties_bind_all_nuts3',
  sirutaCounties.length===42&&sirutaNuts.length===42&&sameSet(sirutaNuts,roLevel3.map(x=>x.code)),
  {county_count:sirutaCounties.length,nuts_count:sirutaNuts.length,source_level3_count:roLevel3.length});
 const publicRoCounties=(publicIndex?.entities||[]).filter(x=>x.jurisdiction==='RO'&&x.display_type==='county');
 const sirutaCountyByCode=new Map(sirutaCounties.map(x=>[String(x.county_code),x]));
 check('ro_public_counties_are_reusable_nuts3_entities',
  publicRoCounties.length===42&&publicRoCounties.every(entity=>{
   const official=sirutaCountyByCode.get(String(entity?.legal?.id??''));
   return entity?.legal?.registry==='SIRUTA'&&official&&roLevel3.some(unit=>unit.code===official.nuts);
  }),
  {public_county_count:publicRoCounties.length});

 const mdUnits=Array.isArray(md?.units)?md.units:[];
 const mdCodes=mdUnits.map(x=>x.code);
 check('md_source_identity',
  md?.schema_version===1&&md?.mode==='ACTUAL_STATISTICAL_SOURCE'&&md?.jurisdiction==='MD'&&md?.classification==='NUTS_MOLDOVA'&&md?.classification_version==='2017',
  {jurisdiction:md?.jurisdiction??null,classification:md?.classification??null,version:md?.classification_version??null});
 check('md_level_counts',
  md?.unit_count===9&&JSON.stringify(countLevels(mdUnits))===JSON.stringify({'1':1,'2':2,'3':6}),
  {declared:md?.level_counts??null,actual:countLevels(mdUnits),unit_count:md?.unit_count??null});
 check('md_codes_exact_and_no_md121',sameSet(mdCodes,canonicalMdCodes)&&!mdCodes.includes('MD121'),{codes:mdCodes});
 const mdByCode=new Map(mdUnits.map(x=>[x.code,x]));
 const mdParentExpected={MD1:null,MD11:'MD1',MD12:'MD1',MD111:'MD11',MD112:'MD11',MD113:'MD11',MD114:'MD11',MD115:'MD11',MD120:'MD12'};
 check('md_parent_chain_exact',
  canonicalMdCodes.every(code=>mdByCode.get(code)?.parent_code===mdParentExpected[code]),
  {});
 const mdComponents=mdUnits.filter(x=>x.level===3).flatMap(x=>x.component_statistical_codes||[]);
 check('md_component_assignment_contract',
  md?.component_assignment_count===37&&mdComponents.length===37&&new Set(mdComponents).size===37,
  {declared:md?.component_assignment_count??null,count:mdComponents.length,unique:new Set(mdComponents).size});
 check('md120_official_components_exact',
  sameSet(mdByCode.get('MD120')?.component_statistical_codes||[],['9800000','0501000']),
  {components:mdByCode.get('MD120')?.component_statistical_codes??null});
 const cuatmByStat=new Map();
 for(const record of cuatm?.records||[]){
  const key=String(record.statistical_code??'');
  if(!key)continue;
  if(!cuatmByStat.has(key))cuatmByStat.set(key,[]);
  cuatmByStat.get(key).push(record);
 }
 const missingMdComponents=mdComponents.filter(code=>(cuatmByStat.get(String(code))||[]).length!==1);
 check('md_components_bind_unique_cuatm_records',missingMdComponents.length===0,{missing_or_ambiguous:missingMdComponents});
 const canonicalMdEntityForLegal=id=>(publicIndex?.entities||[]).filter(x=>
  x.jurisdiction==='MD'
  &&String(x?.legal?.id??'')===String(id)
  &&Number(x?.representation?.admin_level)===4
  &&x?.hierarchy?.parent_catalog_id==='MD'
 );
 const componentLegalId=code=>{
  const records=cuatmByStat.get(code)||[];
  return records.length===1?String(records[0].code):null;
 };
 check('md114_reuses_gagauzia_entity',
  canonicalMdEntityForLegal(componentLegalId('9600000')).length===1,
  {legal_id:componentLegalId('9600000')});
 check('md115_reuses_chisinau_level4_entity',
  canonicalMdEntityForLegal(componentLegalId('0101000')).length===1,
  {legal_id:componentLegalId('0101000')});
 check('md1_reuses_country_context',
  (publicIndex?.entities||[]).filter(x=>x.jurisdiction==='MD'&&x.display_type==='state').length===1,
  {});

 const expected=policy?.p1_invariants??{};
 const catalogEntities=Array.isArray(catalog?.entities)?catalog.entities:[];
 const catalogCounts=Object.fromEntries(['RO','MD'].map(j=>[j,catalogEntities.filter(x=>x.jurisdiction===j).length]));
 check('p1_catalog_cardinality_unchanged',
  catalogEntities.length===expected.expected_entity_count
  &&JSON.stringify(catalogCounts)===JSON.stringify(expected.expected_entity_count_by_jurisdiction),
  {expected:expected.expected_entity_count_by_jurisdiction,actual:catalogCounts,total:catalogEntities.length});
 check('p1_public_contract_unchanged',
  publicIndex?.contract===expected.expected_public_contract&&publicIndex?.entity_count===expected.expected_entity_count,
  {contract:publicIndex?.contract??null,entity_count:publicIndex?.entity_count??null});
 check('p2_entities_not_activated',
  !catalogEntities.some(x=>String(x.id||'').startsWith('stat-'))
  &&!(publicIndex?.entities||[]).some(x=>String(x.id||'').startsWith('stat-')),
  {});
 check('p1_release_identity_unchanged',
  manifest?.snapshot_id===expected.expected_snapshot_id
  &&manifest?.release_fingerprint_sha256===expected.expected_release_fingerprint_sha256
  &&persisted?.snapshot_id===expected.expected_snapshot_id
  &&persisted?.release_fingerprint_sha256===expected.expected_release_fingerprint_sha256,
  {manifest_snapshot:manifest?.snapshot_id??null,persisted_snapshot:persisted?.snapshot_id??null});
 check('p1_catalog_bytes_unchanged',
  manifest?.components?.catalog?.sha256===sha256(bytes['data/current/entities.json']),
  {manifest:manifest?.components?.catalog?.sha256??null,actual:sha256(bytes['data/current/entities.json'])});
 check('p1_ro_geometry_bytes_unchanged',
  manifest?.components?.ro_geojson?.sha256===sha256(bytes['public/geo/current/ro-administrative.geojson']),
  {manifest:manifest?.components?.ro_geojson?.sha256??null,actual:sha256(bytes['public/geo/current/ro-administrative.geojson'])});
 check('p1_md_geometry_bytes_unchanged',
  manifest?.components?.md_geojson?.sha256===sha256(bytes['public/geo/current/md-administrative.geojson']),
  {manifest:manifest?.components?.md_geojson?.sha256??null,actual:sha256(bytes['public/geo/current/md-administrative.geojson'])});

 return {
  schema_version:1,
  mode:'ACTUAL_STATISTICAL_P2_0_GATE',
  phase:'P2_PREPARED',
  status:failures.length?'FAIL':'PASS',
  source_bundle_fingerprint_sha256:bundleFp.sha256,
  checks,
  failures,
  summary:{
   RO:{unit_count:roUnits.length,level_counts:countLevels(roUnits),reused_nuts3_entity_count:publicRoCounties.length},
   MD:{unit_count:mdUnits.length,level_counts:countLevels(mdUnits),component_assignment_count:mdComponents.length},
   p1_entity_count:catalogEntities.length,
   p2_entities_activated:false
  }
 };
}
