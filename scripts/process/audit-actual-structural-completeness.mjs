#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {roOfficialComponentLocalities,uniqueLegalIdentityIds} from '../lib/actual-completeness.mjs';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const SETTLEMENT_POLICY_PATH='data/sources/actual-settlement-policy.json';
const RO_LEVEL9_EVIDENCE_PATH='data/sources/ro-level9-exception-evidence.json';
const GEOMETRY_ROLE_CONTRACT_PATH='schemas/actual-geometry-role-contract.json';
const [
 inventory,catalog,pub,siruta,cuatm,mdRecon,mdSemantic,roOfficialOnly,roOtherLevel,
 settlementPolicy,roGeo,mdGeo,roLevel9Evidence,geometryRoleContract
]=await Promise.all([
 read('data/current/administrative-inventory.json'),
 read('data/current/entities.json'),
 read('public/data/actual-entities.json'),
 read('data/sources/ro-siruta-current.json'),
 read('data/sources/cuatm-current.json'),
 read('data/current/md-cuatm-reconciliation.json'),
 read('data/current/md-cuatm-semantic-bridge.json'),
 read('data/sources/ro-official-only-reviewed-resolutions.json'),
 read('data/sources/ro-other-level-reviewed-resolutions.json'),
 read(SETTLEMENT_POLICY_PATH),
 read('public/geo/current/ro-administrative.geojson'),
 read('public/geo/current/md-administrative.geojson'),
 read(RO_LEVEL9_EVIDENCE_PATH),
 read(GEOMETRY_ROLE_CONTRACT_PATH)
]);

if(mdSemantic.status!=='PASS')throw new Error('MD CUATM semantic bridge is not PASS');

const OUTPUT='data/current/actual-structural-completeness-audit.json';
const publicEntities=pub.entities||[], catalogEntities=catalog.entities||[];
const catalogById=new Map(catalogEntities.map(e=>[e.id,e]));
const publicById=new Map(publicEntities.map(e=>[e.id,e]));
const masterById=new Map(
 [...(roGeo.features||[]),...(mdGeo.features||[])]
  .filter(f=>f.properties?.catalog_id)
  .map(f=>[f.properties.catalog_id,f])
);
const mdReconById=new Map((mdRecon.matches||[]).map(x=>[x.id,x]));
const roLevel9EvidenceByRelation=new Map((roLevel9Evidence.items||[]).map(x=>[String(x.osm_relation_id),x]));

const publicLegal=new Map();
for(const e of publicEntities){
 const r=e.legal?.registry,id=e.legal?.id;
 if(r&&id){
  const k=r+':'+String(id);
  if(!publicLegal.has(k))publicLegal.set(k,[]);
  publicLegal.get(k).push(e.id);
 }
}

const reviewedRoOfficialOnly=new Set((roOfficialOnly.items||[]).map(x=>String(x.legal_id)));
const reviewedRoOtherLevel=new Set((roOtherLevel.items||[]).map(x=>String(x.legal_id)));
const reviewedRoCoverage=new Set([...reviewedRoOfficialOnly,...reviewedRoOtherLevel]);

const rows=[],blocking=[];
const add=(jurisdiction,type,official,covered,missing,mode,detail={})=>{
 const row={
  jurisdiction,type,
  official_count:official,
  covered_official_identity_count:covered,
  missing_official_identity_count:missing.length,
  coverage_status:mode,
  missing_official_identities:missing,
  ...detail
 };
 rows.push(row);
 if(mode==='FAIL')blocking.push({
  jurisdiction,type,
  missing_count:missing.length,
  policy_violation_count:Number(detail.policy_violation_count||0),
  missing_official_identities:missing,
  policy_violations:detail.policy_violations||[]
 });
};

const policyIssues=[];
const policyCheck=(ok,issue,detail={})=>{if(!ok)policyIssues.push({issue,...detail});};
policyCheck(settlementPolicy?.schema_version===1,'settlement_policy_schema_version',{actual:settlementPolicy?.schema_version??null});
policyCheck(settlementPolicy?.mode==='ACTUAL','settlement_policy_mode',{actual:settlementPolicy?.mode??null});
policyCheck(settlementPolicy?.scope==='settlements_and_component_localities','settlement_policy_scope',{actual:settlementPolicy?.scope??null});
policyCheck(settlementPolicy?.common_requirements?.exhaustive_polygon_coverage_required===false,'settlement_policy_must_be_non_exhaustive_geometry');
policyCheck(settlementPolicy?.common_requirements?.missing_official_settlement_polygon_is_blocking===false,'settlement_policy_missing_polygon_rule');
policyCheck(settlementPolicy?.common_requirements?.geometry_source==='OpenStreetMap','settlement_policy_geometry_source');
policyCheck(settlementPolicy?.common_requirements?.geometry_coordinate_mutation_allowed===false,'settlement_policy_coordinate_mutation_rule');
policyCheck(settlementPolicy?.common_requirements?.unreviewed_identity_inference_allowed===false,'settlement_policy_unreviewed_inference_rule');
policyCheck(geometryRoleContract?.schema_version===1,'geometry_role_contract_schema_version',{actual:geometryRoleContract?.schema_version??null});
policyCheck(geometryRoleContract?.contract==='actual-geometry-role-v1','geometry_role_contract_id',{actual:geometryRoleContract?.contract??null});
policyCheck(geometryRoleContract?.mode==='ACTUAL','geometry_role_contract_mode',{actual:geometryRoleContract?.mode??null});
for(const role of ['administrative_boundary','statistical_boundary','locality_footprint']){
 policyCheck(Boolean(geometryRoleContract?.roles?.[role]),'geometry_role_contract_missing_role',{role});
}
policyCheck(
 geometryRoleContract?.compatibility?.actual_public_entity_v1?.legacy_geometry_role==='current_representation'
 && geometryRoleContract?.compatibility?.actual_public_entity_v1?.canonical_role_for_existing_master_geometry==='administrative_boundary',
 'geometry_role_contract_v1_compatibility'
);
for(const [j,type] of [['RO','component_locality'],['MD','locality']]){
 const p=settlementPolicy?.jurisdictions?.[j];
 policyCheck(Boolean(p),'settlement_policy_jurisdiction_missing',{jurisdiction:j});
 policyCheck(p?.declared_type===type,'settlement_policy_declared_type_mismatch',{jurisdiction:j,expected:type,actual:p?.declared_type??null});
 const declared=(inventory.countries?.[j]?.levels||[]).some(x=>x.type===type);
 policyCheck(declared,'settlement_policy_type_not_declared_in_inventory',{jurisdiction:j,type});
}
if(policyIssues.length){
 add('POLICY','settlements_and_component_localities',0,null,[],'FAIL',{
  policy_path:SETTLEMENT_POLICY_PATH,
  policy_version:settlementPolicy?.policy_version??null,
  policy_violation_count:policyIssues.length,
  policy_violations:policyIssues
 });
}

const sir=siruta.records||[];
const roUat=sir.filter(r=>Number(r.level)===2);
for(const type of ['municipality','town','commune','sector']){
 const official=roUat.filter(r=>(r.legal_type||'commune')===type);
 const missing=official
  .filter(r=>!publicLegal.has('SIRUTA:'+String(r.siruta))&&!reviewedRoCoverage.has(String(r.siruta)))
  .map(r=>({id:String(r.siruta),name:r.name,parent_id:r.parent_siruta??null,parent_name:r.parent_name??null}));
 add('RO',type,official.length,official.length-missing.length,missing,missing.length?'FAIL':'PASS',{
  official_registry:'SIRUTA',
  exhaustive:true,
  reviewed_exception_coverage_count:official.filter(r=>reviewedRoCoverage.has(String(r.siruta))).length
 });
}

const roCounties=[...new Map(roUat.filter(r=>r.county_code).map(r=>[String(r.county_code),r.county_name||null])).entries()];
const missingRoCounties=roCounties
 .filter(([code])=>!publicLegal.has('SIRUTA:'+code))
 .map(([id,name])=>({id,name}));
add('RO','county',roCounties.length,roCounties.length-missingRoCounties.length,missingRoCounties,missingRoCounties.length?'FAIL':'PASS',{
 official_registry:'SIRUTA',exhaustive:true,identity_bridge:'data/current/ro-county-siruta-bridge.json'
});
add('RO','state',1,null,[],'OBSERVATIONAL',{
 reason:'State boundary is intentionally outside the ACTUAL administrative-unit catalog imported at levels 4/8/9; country geometry is used as import containment context, not a catalog entity.'
});

const allowedGeometryTypes=new Set(settlementPolicy.common_requirements.allowed_geometry_types||[]);
const validateCommonSettlementRepresentation=(e,p)=>{
 const issues=[];
 const master=masterById.get(e.id);
 if(e.status!=='current')issues.push({issue:'settlement_entity_not_current',actual:e.status??null});
 if(!p)issues.push({issue:'settlement_public_entity_missing'});
 if(!master)issues.push({issue:'settlement_master_geometry_missing'});
 else{
  if(!allowedGeometryTypes.has(master.geometry?.type))issues.push({issue:'settlement_geometry_type_not_allowed',actual:master.geometry?.type??null});
  if(!Array.isArray(master.geometry?.coordinates)||master.geometry.coordinates.length===0)issues.push({issue:'settlement_geometry_empty'});
 }
 if(p?.status!=='current')issues.push({issue:'settlement_public_status_not_current',actual:p?.status??null});
 if(p?.representation?.source!=='OpenStreetMap')issues.push({issue:'settlement_representation_source_not_osm',actual:p?.representation?.source??null});
 if(p?.representation?.geometry_role!=='current_representation')issues.push({issue:'settlement_geometry_role_invalid',actual:p?.representation?.geometry_role??null});
 if(p?.representation?.public_geometry_precision!=='master_coordinate_fidelity')issues.push({issue:'settlement_geometry_precision_not_master_fidelity',actual:p?.representation?.public_geometry_precision??null});
 return issues;
};

const roSettlementPolicy=settlementPolicy.jurisdictions.RO;
const roOfficialSettlements=roOfficialComponentLocalities(sir);
const roOfficialSettlementIds=new Set(roOfficialSettlements.map(r=>String(r.siruta)));
const roSettlementTypes=new Set(roSettlementPolicy.inclusion_catalog_types||[]);
const roReviewedTypes=new Set(roSettlementPolicy.accepted_paths?.reviewed_representation?.catalog_types||[]);
const roIncluded=catalogEntities.filter(e=>e.jurisdiction==='RO'&&roSettlementTypes.has(e.type));
const roSettlementViolations=[];
let roOfficialIdentityPathCount=0,roReviewedRepresentationPathCount=0;
for(const e of roIncluded){
 const p=publicById.get(e.id);
 const issues=validateCommonSettlementRepresentation(e,p);
 const officialPath=Boolean(
  p?.legal?.registry==='SIRUTA'
  && p?.legal?.id
  && roOfficialSettlementIds.has(String(p.legal.id))
  && p?.validation?.legal_identity_status==='reconciled'
 );
 let reviewedPath=false;
 if(roReviewedTypes.has(e.type)){
  const ev=roLevel9EvidenceByRelation.get(String(e.osm?.relation_id));
  reviewedPath=Boolean(
   e.classification?.confidence===roSettlementPolicy.accepted_paths.reviewed_representation.classification_confidence
   && e.classification?.evidence===roSettlementPolicy.accepted_paths.reviewed_representation.evidence
   && e.review_required===roSettlementPolicy.accepted_paths.reviewed_representation.review_required
   && ev
   && ev.semantic_classification===e.type
   && ev.legal_hierarchy_verified===true
   && ev.legal_geometry_verified===roSettlementPolicy.accepted_paths.reviewed_representation.legal_geometry_equivalence_asserted
   && (!ev.osm_parent_relation_id||e.parent_id==='osm-r'+String(ev.osm_parent_relation_id))
  );
 }
 if(officialPath)roOfficialIdentityPathCount++;
 else if(reviewedPath)roReviewedRepresentationPathCount++;
 else issues.push({
  issue:'settlement_has_no_accepted_identity_or_review_path',
  legal:p?.legal??null,
  classification:e.classification??null,
  review_required:Boolean(e.review_required)
 });
 if(issues.length)roSettlementViolations.push({entity_id:e.id,name:e.name,osm_relation_id:e.osm?.relation_id??null,catalog_type:e.type,issues});
}
add('RO','component_locality',roOfficialSettlements.length,null,[],roSettlementViolations.length?'FAIL':'PASS',{
 official_registry:'SIRUTA',
 exhaustive:false,
 completeness_basis:'policy_conformance_not_exhaustive_polygon_coverage',
 policy_path:SETTLEMENT_POLICY_PATH,
 policy_version:settlementPolicy.policy_version,
 official_identity_inventory_exhaustive:true,
 exhaustive_polygon_coverage_required:false,
 missing_official_settlement_polygon_is_blocking:false,
 included_representation_count:roIncluded.length,
 policy_conformant_representation_count:roIncluded.length-roSettlementViolations.length,
 official_identity_path_count:roOfficialIdentityPathCount,
 reviewed_representation_path_count:roReviewedRepresentationPathCount,
 policy_violation_count:roSettlementViolations.length,
 policy_violations:roSettlementViolations
});

const md=cuatm.records||[];
const isChisinauSector=r=>r.status_code==='4'&&r.parent_code==='0100';
const semanticByType=new Map();
for(const x of mdSemantic.classifications||[]){
 if(!semanticByType.has(x.semantic_type))semanticByType.set(x.semantic_type,[]);
 semanticByType.get(x.semantic_type).push(x);
}
const officialByType={
 district:md.filter(r=>r.status_code==='2'&&!/gagauz/i.test(r.name||'')),
 level_2_municipality:semanticByType.get('level_2_municipality')||[],
 special_territorial_unit:md.filter(r=>r.status_code==='2'&&/gagauz/i.test(r.name||'')),
 level_1_municipality:semanticByType.get('level_1_municipality')||[],
 town:semanticByType.get('town')||[],
 commune:semanticByType.get('commune')||[],
 independent_village:semanticByType.get('independent_village')||[],
 chisinau_sector:md.filter(isChisinauSector)
};
for(const type of ['district','level_2_municipality','special_territorial_unit','level_1_municipality','town','commune','independent_village','chisinau_sector']){
 const official=officialByType[type]||[];
 const missing=official.filter(r=>{
  const id=String(r.code??r.legal_id);
  return !publicLegal.has('CUATM:'+id);
 }).map(r=>({
  id:String(r.code??r.legal_id),
  name:r.name??r.legal_name??null,
  parent_id:r.parent_code??r.parent_id??null,
  parent_name:r.parent_name??null,
  status_code:r.status_code??null,
  semantic_type:r.semantic_type??type
 }));
 add('MD',type,official.length,official.length-missing.length,missing,missing.length?'FAIL':'PASS',{
  official_registry:'CUATM',
  exhaustive:true,
  semantic_bridge:['level_2_municipality','level_1_municipality','town','commune','independent_village'].includes(type)
   ?'data/current/md-cuatm-semantic-bridge.json':null
 });
}
add('MD','state',1,null,[],'OBSERVATIONAL',{
 reason:'State boundary is intentionally outside the ACTUAL administrative-unit catalog imported at levels 4/6/8/9; country geometry is used as import containment context, not a catalog entity.'
});

const mdSettlementPolicy=settlementPolicy.jurisdictions.MD;
const mdSettlementStatusCodes=new Set((mdSettlementPolicy.official_status_codes||[]).map(String));
const mdOfficialSettlements=md.filter(r=>mdSettlementStatusCodes.has(String(r.status_code)));
const mdOfficialSettlementById=new Map(mdOfficialSettlements.map(r=>[String(r.code),r]));
const mdOfficialById=new Map(md.map(r=>[String(r.code),r]));
const mdSettlementTypes=new Set(mdSettlementPolicy.inclusion_catalog_types||[]);
const mdIncluded=catalogEntities.filter(e=>e.jurisdiction==='MD'&&mdSettlementTypes.has(e.type));
const mdSettlementViolations=[];
const mdOfficialLocalityIdentityIds=new Set(),mdReconciledUatSettlementIdentityIds=new Set();
let mdOfficialLocalityRepresentationPathCount=0,mdReconciledUatRepresentationPathCount=0;
for(const e of mdIncluded){
 const p=publicById.get(e.id);
 const issues=validateCommonSettlementRepresentation(e,p);
 const m=mdReconById.get(e.id);
 const legalId=p?.legal?.id==null?null:String(p.legal.id);
 const officialAny=legalId?mdOfficialById.get(legalId):null;
 const officialLocality=legalId?mdOfficialSettlementById.get(legalId):null;
 const localityPathPolicy=mdSettlementPolicy.accepted_paths?.official_locality_identity||{};
 const uatPathPolicy=mdSettlementPolicy.accepted_paths?.reconciled_uat_settlement_representation||{};
 const localityAllowedStatus=new Set((localityPathPolicy.allowed_status_codes||[]).map(String));
 const uatAllowedStatus=new Set((uatPathPolicy.allowed_status_codes||[]).map(String));
 const uatSemanticTypes=new Set(uatPathPolicy.semantic_types||[]);
 const baseIdentityOk=Boolean(
  p?.legal?.registry==='CUATM'
  && legalId
  && officialAny
  && p?.validation?.legal_identity_status==='reconciled'
  && m?.legal_id
  && String(m.legal_id)===legalId
  && String(m.status_code)===String(p.legal.status_code)
  && String(officialAny.status_code)===String(p.legal.status_code)
  && String(p.legal.parent_id??'')===String(officialAny.parent_code??'')
 );
 const officialLocalityPath=Boolean(
  baseIdentityOk
  && p?.legal?.registry===localityPathPolicy.registry
  && officialLocality
  && localityAllowedStatus.has(String(p.legal.status_code))
  && p?.validation?.legal_identity_status===localityPathPolicy.legal_identity_status
 );
 const reconciledUatRepresentationPath=Boolean(
  baseIdentityOk
  && p?.legal?.registry===uatPathPolicy.registry
  && uatAllowedStatus.has(String(p.legal.status_code))
  && uatSemanticTypes.has(String(p.legal.type||''))
  && p?.validation?.legal_identity_status===uatPathPolicy.legal_identity_status
  && Number(e.osm?.admin_level)===9
 );
 if(officialLocalityPath){
  mdOfficialLocalityRepresentationPathCount++;
  for(const id of uniqueLegalIdentityIds([legalId]))mdOfficialLocalityIdentityIds.add(id);
 }else if(reconciledUatRepresentationPath){
  mdReconciledUatRepresentationPathCount++;
  for(const id of uniqueLegalIdentityIds([legalId]))mdReconciledUatSettlementIdentityIds.add(id);
 }
 else issues.push({
  issue:'settlement_has_no_valid_identity_or_uat_representation_path',
  legal:p?.legal??null,
  reconciliation:m??null,
  official_record:officialAny??null
 });
 if(issues.length)mdSettlementViolations.push({entity_id:e.id,name:e.name,osm_relation_id:e.osm?.relation_id??null,catalog_type:e.type,issues});
}
const missingMdOfficialLocalities=mdOfficialSettlements
 .filter(r=>!mdOfficialLocalityIdentityIds.has(String(r.code)))
 .map(r=>({
  id:String(r.code),
  name:r.name??null,
  parent_id:r.parent_code??null,
  parent_name:r.parent_name??null,
  status_code:r.status_code??null
 }));
add('MD','locality',mdOfficialSettlements.length,mdOfficialLocalityIdentityIds.size,missingMdOfficialLocalities,mdSettlementViolations.length?'FAIL':'PASS',{
 official_registry:'CUATM',
 exhaustive:false,
 completeness_basis:'policy_conformance_not_exhaustive_polygon_coverage',
 policy_path:SETTLEMENT_POLICY_PATH,
 policy_version:settlementPolicy.policy_version,
 official_identity_inventory_exhaustive:true,
 exhaustive_polygon_coverage_required:false,
 missing_official_settlement_polygon_is_blocking:false,
 included_representation_count:mdIncluded.length,
 policy_conformant_representation_count:mdIncluded.length-mdSettlementViolations.length,
 official_locality_identity_path_count:mdOfficialLocalityIdentityIds.size,
 official_locality_representation_path_count:mdOfficialLocalityRepresentationPathCount,
 reconciled_uat_settlement_identity_path_count:mdReconciledUatSettlementIdentityIds.size,
 reconciled_uat_settlement_representation_path_count:mdReconciledUatRepresentationPathCount,
 reviewed_representation_path_count:0,
 policy_violation_count:mdSettlementViolations.length,
 policy_violations:mdSettlementViolations
});

const declared=Object.entries(inventory.countries).flatMap(([j,c])=>c.levels.map(x=>j+':'+x.type));
const audited=new Set(rows.filter(x=>x.jurisdiction!=='POLICY').map(x=>x.jurisdiction+':'+x.type));
const undeclaredCoverage=declared.filter(x=>!audited.has(x));
if(undeclaredCoverage.length){
 blocking.push({
  jurisdiction:'POLICY',
  type:'administrative_inventory',
  missing_count:0,
  policy_violation_count:undeclaredCoverage.length,
  policy_violations:undeclaredCoverage.map(x=>({issue:'declared_type_not_audited',type:x}))
 });
}
const undetermined=rows.filter(x=>x.coverage_status==='NOT_DETERMINED');
const blockingGapCount=blocking.reduce((n,x)=>n+Number(x.missing_count||0),0);
const blockingPolicyViolationCount=blocking.reduce((n,x)=>n+Number(x.policy_violation_count||0),0);
const report={
 schema_version:2,
 generated_at:new Date().toISOString(),
 mode:'ACTUAL',
 scope:['RO','MD'],
 status:blocking.length?'FAIL':undetermined.length?'NOT_DETERMINED':'PASS',
 policy:{
  exact_uat_pass:'Exact official-identity coverage is required where the official registry and subtype mapping define an exhaustive administrative UAT set.',
  settlement_pass:'Settlement/component-locality polygon coverage is intentionally non-exhaustive. PASS requires every included settlement representation to satisfy the explicit identity-or-reviewed-representation policy; absent official settlement polygons do not count as gaps.',
  fail:'Missing exhaustive UAT identities, settlement-policy violations, invalid policy configuration, or unaudited declared inventory types fail closed.',
  not_determined:'Reserved for genuinely unresolved completeness policy. The current settlement policy is explicit and therefore must resolve to PASS or FAIL, never NOT_DETERMINED.'
 },
 settlement_policy:{
  path:SETTLEMENT_POLICY_PATH,
  schema_version:settlementPolicy.schema_version,
  policy_version:settlementPolicy.policy_version,
  policy_issue_count:policyIssues.length
 },
 declared_type_count:declared.length,
 audited_type_count:rows.filter(x=>x.jurisdiction!=='POLICY').length,
 undeclared_coverage:undeclaredCoverage,
 blocking_gap_count:blockingGapCount,
 blocking_policy_violation_count:blockingPolicyViolationCount,
 blocking_issue_count:blockingGapCount+blockingPolicyViolationCount,
 blocking_gaps:blocking,
 not_determined_type_count:undetermined.length,
 not_determined_types:undetermined.map(x=>({jurisdiction:x.jurisdiction,type:x.type,reason:x.reason||null})),
 types:rows
};
await mkdir('data/current',{recursive:true});
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
