// P9.0.4.2 final read-only semantic adjudication gate. NEVER promote OSM geometry contains into administrative parentage.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const ROOT=new URL('../../',import.meta.url),OUT=new URL('../../outputs/P9.0.4.2/',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,ROOT),'utf8'));
const requireGate=(v,msg)=>{if(!v)throw Error('P9042 gate: '+msg)};
const candidate=await read('docs/p9.0.4.2-individual-review.json');
const previous=await read('docs/p9.0.4.1-individual-candidates.json');
const source=await read('docs/p9.0.4.2-source-evidence.json');
const locals=await read('docs/p9.0.4.2-four-localities.json');
const previousLocals=await read('docs/p9.0.4.1-local-identity-bindings.json');
const catalog=await read('public/data/actual-entities.json');
const topIndex=await read('public/data/actual-topology-index.json');
const predecessor=new Map(previous.records.map(x=>[x.actual_id,x]));
const sources=new Map(source.evidence.map(x=>[x.id,x]));
const md=new Map(catalog.entities.filter(x=>x.jurisdiction==='MD').map(x=>[x.id,x]));
const expectedClasses={
 historic_claim_only:80,
 contemporary_claim_geo_parent_divergence:1,
 bender_city_locality_role_resolved:1,
 bender_official_municipality_role_resolved:1,
 plopi_cross_language_alias_supported:1,
 ofatinti_cross_language_alias_supported:1
};
requireGate(source.schema_version==='p9042-evidence-registry-v1'&&source.reviewed_at_utc==='2026-10-13','source registry');
requireGate(candidate.schema_version==='p9042-contemporary-review-v1'&&candidate.review_as_of==='2026-10-13','candidate contract');
requireGate(candidate.baseline_parent_catalog_sha256===previous.parent_catalog_sha256,'immutable predecessor SHA');
requireGate(candidate.records.length===85&&previous.records.length===85,'85 candidates');
requireGate(source.evidence.length>=10&&sources.size===source.evidence.length,'unique provenance sources');
for(const [id,s]of sources){
 requireGate(/^https:\/\//.test(s.url)&&s.effective_date&&s.scope&&s.limitation&&s.organization,'source metadata '+id);
}
requireGate(catalog.entities.length===5848&&Object.keys(topIndex.sources).length===123,'ACTUAL baseline count');
const seen=new Set(),groups={};
const review=[];
for(const x of candidate.records){
 requireGate(!seen.has(x.actual_id)&&predecessor.has(x.actual_id),'candidate ID mismatch or duplicate '+x.actual_id);
 const orig=predecessor.get(x.actual_id),actual=md.get(x.actual_id);
 requireGate(actual&&orig.geometric_parent_osm_id===x.geometric_parent_osm_id&&orig.name_ro===x.name_ro,'candidate identity or parent drift '+x.actual_id);
 requireGate(!x.data_promotion_permitted&&x.legal_parent_override===false&&x.new_geometry===false&&x.observed_control_2026==='not_verified','illegal semantic promotion '+x.actual_id);
 requireGate(x.evidence_ids.length&&x.evidence_ids.every(id=>sources.has(id)),'uncited case '+x.actual_id);
 if(x.label==='historic_claim_only'){
   requireGate(x.legacy_2010_disposition==='historic_administrative_claim_name_match'&&x.contemporaneous_individual_parent_proven===false&&
     x.claimed_de_facto_admin_parent_osm_id===null,'legacy claim overstated '+x.actual_id);
 }
 if(x.label==='contemporary_claim_geo_parent_divergence'){
   requireGate(x.actual_id==='osm-r1216706'&&x.geometric_parent_osm_id==='1702218'&&
      x.claimed_de_facto_admin_parent_osm_id==='1702219'&&x.proof_date==='2025'&&x.evidence_ids.includes('de_facto_Tiraspol_2025'),'Cremenciug not separated from geometry');
   requireGate(actual.legal?.id==='0703'&&actual.hierarchy?.legal_parent_id==='2700','Cremenciug legal Causeni hierarchy drift');
 }
 if(x.label==='bender_official_municipality_role_resolved'){
   requireGate(x.actual_id==='osm-r9581354'&&actual.legal?.id==='0500'&&actual.representation?.admin_level===4&&
      x.evidence_ids.includes('OSM_Bender_Municipality'),'Bender official municipality role');
 }
 if(x.label==='bender_city_locality_role_resolved'){
   requireGate(x.actual_id==='osm-r12463379'&&actual.representation?.admin_level===8&&
      actual.hierarchy?.parent_catalog_id==='osm-r9581354'&&x.evidence_ids.includes('OSM_Bender_DeFacto'),'Bender city locality role');
 }
 if(x.label==='plopi_cross_language_alias_supported'){
   requireGate(x.actual_id==='osm-r19015286'&&actual.legal?.id==='6939'&&x.legacy_2010_name_ru==='Плоть'&&
     x.evidence_ids.includes('de_facto_Ribnita_2025'),'Plopi identity and alias');
 }
 if(x.label==='ofatinti_cross_language_alias_supported'){
   requireGate(x.actual_id==='osm-r9660049'&&actual.legal?.id==='6937'&&x.legacy_2010_name_ru==='Выхватинцы'&&
     x.evidence_ids.includes('OSM_Ofatinti'),'Ofatinți identity and alias');
 }
 groups[x.label]=(groups[x.label]||0)+1;
 seen.add(x.actual_id);
 review.push({...x,administrative_promotion_verdict:'NOT_ACCEPTED_AS_OF_2026',
  geometry_role_verified:x.label.startsWith('bender_'),
  administrative_claim_verified_with_source_date:x.contemporaneous_individual_parent_proven===true,
  current_polygon_control_certified:false});
}
for(const [k,v]of Object.entries(expectedClasses))requireGate(groups[k]===v,'class count '+k+' '+groups[k]);
requireGate(Object.keys(groups).length===Object.keys(expectedClasses).length,'unexpected disposition');
requireGate(source.semantic_acceptance_criteria.never_promote_from_GIS_contains_alone===true,'source policy weakened');
requireGate(locals.schema_version==='p9042-locality-conflict-resolution-v1'&&locals.cases.length===4,'four locality overlay');
const old4=new Map(previousLocals.records.map(x=>[x.locality,x]));
const localReviews=[];
for(const item of locals.cases){
 const old=old4.get(item.name);
 requireGate(old&&item.legal_cuatm===old.cuatm_code&&item.legal_parent===old.official_parent&&item.actual_polygon_id===old.actual_polygon_id,'local identity drift '+item.name);
 requireGate(item.legal_identity==='confirmed'&&item.current_polygon_control==='unverified'&&item.source_ids.every(id=>sources.has(id)),'local parent promotion '+item.name);
 if(item.name==='Pohrebea')requireGate(item.actual_polygon_id==='osm-r18968121'&&md.has(item.actual_polygon_id),'existing Pohrebea geometry disappeared');
 else requireGate(item.actual_polygon_id===null,'unreviewed local polygon '+item.name);
 localReviews.push({...item,legal_parent_change:false,de_facto_assignment:false});
}
requireGate(new Set(localReviews.map(x=>x.name)).size===4,'duplicate local names');
const digest=x=>createHash('sha256').update(x).digest('hex');
let geometryFiles=0;
for(const [path,sha]of Object.entries(topIndex.sources)){
 requireGate(/^public\/geo\/actual\/(?:[a-z0-9._-]+\/)*[a-z0-9._-]+\.geojson$/.test(path),'unsafe geometry pathname');
 const bytes=await readFile(new URL(path,ROOT));
 requireGate(digest(bytes)===sha,'ACTUAL geometry mutated '+path);
 geometryFiles++;
}
requireGate(geometryFiles===123,'not all ACTUAL geometry verified');
const result={
 schema_version:'p9042-final-semantic-acceptance-v1',
 audit_result:'PASS',audit_timestamp_utc:'2026-10-13',
 jurisdiction_contract_review:'PASS_DE_JURE_DE_FACTO_ROLE_SEPARATION',
 final_semantic_acceptance:'BLOCKED_INCOMPLETE',
 p91_import_allowed:false,production_promotion_gate_integrated:false,
 total_candidate_ids:85,case_dispositions:groups,
 date_scoped_de_facto_administrative_claims:1,
 role_disambiguations:2,provisional_name_alias_resolutions:2,
 historical_only_candidates:80,fully_certified_de_facto_membership_as_of_2026:0,
 actual_MD_entity_count:md.size,actual_total_entities:catalog.entities.length,
 actual_geometry_master_sha256_verified:geometryFiles,
 legal_locality_identities_verified:localReviews.length,
 localities_without_distinct_polygons:3,localities_with_reusable_existing_polygon:1,
 copies_created:0,legal_parents_modified:0,
 provenance_source_count:sources.size,
 blocking_conditions:[
   'Contemporary village-by-village legal/de facto administrative evidence is absent for 80 legacy-only cases.',
   'Even the 2025 Tiraspol administrative claim for Cremenciug does not certify exact 2026 control or match the OSM geometrical Slobozia parent.',
   'OSM Bender municipal 9581354 and Bender city 12463379 are different roles; same CUATM 0500 binding needs review before new semantic hierarchy.',
   'Plopi/Плоть and Ofatinți/Выхватинцы aliases are supported but their precise 2026 de facto polygons/administrative authority are not certified.',
   'Roghi, Mahala and Vasilievca (Cocieri) have legal CUATM but no positive separate ACTUAL polygon.',
   'OSM live geometry revisions versus pinned Geofabrik 2026-10-12 snapshot not aligned version-by-version.',
   'Production ACTUAL candidate lifecycle does not yet enforce a P9.1 jurisdiction-semantic promotion gate.'
 ],
  scope:'Evidence-scoped acceptance of audit classification ONLY. No final acceptance of full 2026 de facto administrative coverage or P9.1 import.'
};
if(process.argv.includes('--self-test')){
 assert.equal(review.length,85);assert.equal(localReviews.length,4);
 assert.equal(result.final_semantic_acceptance,'BLOCKED_INCOMPLETE');
 console.log('P9042_SELF_TEST PASS');
}else{
 await mkdir(OUT,{recursive:true});
 for(const [name,body] of [
 ['acceptance.json',result],['review-85.json',review],['localities.json',localReviews],['blocking-conditions.json',{approved_for_p91:false,conditions:result.blocking_conditions}]]){
  await writeFile(new URL(name,OUT),JSON.stringify(body,null,2)+'\n');
 }
 console.log('P9042_ACCEPTANCE '+JSON.stringify(result));
}
