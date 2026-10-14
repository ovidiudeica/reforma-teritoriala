// P9.0.4.1 — review all 85 OSM geometric-parent candidates and 4 separate CUATM localities.
// READ-ONLY. Historic de facto registry evidence is NOT current control, membership, or sovereignty.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ROOT=new URL('../../',import.meta.url);
const OUT=new URL('../../outputs/P9.0.4.1/',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,ROOT),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const requireContract=(pass,msg)=>{if(!pass)throw Error('P9041: '+msg)};
const candidates=await json('docs/p9.0.4-geometric-candidates.json');
const individual=await json('docs/p9.0.4.1-individual-candidates.json');
const locals=await json('docs/p9.0.4.1-local-identity-bindings.json');
const prior=await json('docs/p9.0.4-semantic-decisions.json');
const current=await json('data/sources/cuatm-current.json');
const actual=await json('public/data/actual-entities.json');
const topo=await json('public/data/actual-topology-index.json');
const parentNames={'944727':'Bender/Tighina','1702214':'Grigoriopol','1702215':'Dubăsari','1702216':'Camenca','1702217':'Rîbnița','1702218':'Slobozia','1702219':'Tiraspol'};
const parentExpected={'944727':4,'1702214':16,'1702215':10,'1702216':13,'1702217':23,'1702218':16,'1702219':3};
const dispositions={historic_administrative_claim_name_match:80,ambiguous_same_name_distinct_osm_entities:2,
  unmatched_historical_register:2,conflict_geometric_vs_register:1};
const planned=new Map(candidates.candidates.filter(x=>x.geometric_parent).map(x=>[x.actual_id,x]));
const md=new Map(actual.entities.filter(x=>x.jurisdiction==='MD').map(x=>[x.id,x]));
requireContract(candidates.candidates.length===153&&planned.size===85,'P9.0.4 scope drift');
requireContract(individual.schema_version==='p9041-member-claim-ledger-v1'&&individual.records.length===85,'85-case register contract');
requireContract(individual.parent_catalog_sha256===candidates.source_sha256&&individual.parent_catalog_snapshot===candidates.source_snapshot,'immutable P9.0.2 binding');
requireContract(individual.registry_edition==='2010-09-30'&&individual.registry_status==='historical_not_current','historical source timeframe');
requireContract(locals.schema_version==='p9041-four-locality-bindings-v1'&&locals.records.length===4,'4-locality contract');
requireContract(prior.jurisdiction.recognized_sovereign_state===false&&prior.jurisdiction.legal_sovereignty==='Republica Moldova','sovereignty separation');
requireContract(actual.entities.length===5848&&Object.keys(topo.sources).length===123,'ACTUAL indexed baseline drift');
const counts={},parentCounts={},rowIDs=new Set(),anomalies=[];
for(const row of individual.records){
  const id=row.actual_id,source=planned.get(id),src=row.historical_de_facto_register;
  requireContract(source&&!rowIDs.has(id),'unknown/duplicate ACTUAL candidate '+id);
  rowIDs.add(id);
  requireContract(md.has(id),'candidate absent from ACTUAL MD '+id);
  requireContract(source.name===row.name_ro&&source.geometric_parent===row.geometric_parent_osm_id,'candidate-pair drift '+id);
  requireContract(parentNames[row.geometric_parent_osm_id]&&src.reviewed===true,'unreviewed parent or missing historical evidence '+id);
  requireContract(row.current_administration_evidence==='NOT_ESTABLISHED_FOR_EXACT_POLYGON_2026'&&
    row.de_facto_membership_2026==='NOT_CERTIFIED'&&row.legal_md_parent_unchanged===true&&
    row.master_geometry_unchanged===true&&row.allow_import===false,'forbidden promotion '+id);
  requireContract(/^https:\/\/www\.ulpmr\.ru\/ul\/show\//.test(src.url)&&src.version==='2010-09-30 historical edition','unknown historical register origin '+id);
  counts[src.disposition]=(counts[src.disposition]||0)+1;
  parentCounts[row.geometric_parent_osm_id]=(parentCounts[row.geometric_parent_osm_id]||0)+1;
  if(src.disposition==='historic_administrative_claim_name_match'){
    requireContract(!!src.mapped_name_ru&&src.claimed_parent_osm_id===row.geometric_parent_osm_id,'unproven historical parent '+id);
  }else if(src.disposition==='ambiguous_same_name_distinct_osm_entities'){
    requireContract(row.name_ro==='Bender'&&row.geometric_parent_osm_id==='944727','unexpected duplicate-name scope '+id);
    anomalies.push({id,name:row.name_ro,kind:'same_name_different_osm_relations'});
  }else if(src.disposition==='unmatched_historical_register'){
    requireContract(!src.mapped_name_ru&&['Plopi','Ofatinți'].includes(row.name_ro),'unsupported mismatch '+id);
    anomalies.push({id,name:row.name_ro,kind:'not_matched_in_historical_2010_registry'});
  }else if(src.disposition==='conflict_geometric_vs_register'){
    requireContract(id==='osm-r1216706'&&src.claimed_parent_osm_id==='1702219'&&row.geometric_parent_osm_id==='1702218','Kremenchug conflict not captured');
    anomalies.push({id,name:row.name_ro,kind:'de_facto_documented_Tiraspol_vs_geometric_Slobozia'});
  }else requireContract(false,'unrecognized disposition '+id);
}
for(const [k,v]of Object.entries(dispositions))requireContract(counts[k]===v,'disposition mismatch '+k);
for(const [k,v]of Object.entries(parentExpected))requireContract(parentCounts[k]===v,'parent count drift '+k);
const required={
  Roghi:{code:'3840',statistical:'3817001',parent_code:'3839',parent:'Molovata Nouă',parent_actual:'osm-r19008287',geometry:null},
  Mahala:{code:'3817',statistical:'3811001',parent_code:'3816',parent:'Corjova',parent_actual:'osm-r19001620',geometry:null},
  Pohrebea:{code:'3819',statistical:'3812001',parent_code:'3818',parent:'Coșnița',parent_actual:'osm-r19013515',geometry:'osm-r18968121'},
  Vasilievca:{code:'3811',statistical:'3810001',parent_code:'3810',parent:'Cocieri',parent_actual:'osm-r19008286',geometry:null}
};
const legalClaims=[];
for(const row of locals.records){
 const expected=required[row.locality];
 requireContract(expected&&row.cuatm_code===expected.code&&row.statistical_code===expected.statistical&&
  row.cuatm_parent_code===expected.parent_code&&row.official_parent===expected.parent&&
  row.md_parent_actual_id===expected.parent_actual&&row.actual_polygon_id===expected.geometry,'local legal-parent binding '+row.locality);
 const matches=current.records.filter(x=>x.code===row.cuatm_code&&x.parent_code===row.cuatm_parent_code&&x.statistical_code===row.statistical_code&&x.status_code==='9');
 requireContract(matches.length===1&&matches[0].normalized_name===row.locality.toLowerCase(),'CUATM code not uniquely verified '+row.locality);
 requireContract(md.has(row.md_parent_actual_id),'official legal parent not in ACTUAL MD '+row.locality);
 const sameLegalId=actual.entities.filter(x=>x.jurisdiction==='MD'&&x.legal?.registry==='CUATM'&&x.legal?.id===row.cuatm_code);
 if(row.locality==='Pohrebea'){
   requireContract(sameLegalId.length===1&&sameLegalId[0].id===row.actual_polygon_id&&
    sameLegalId[0].hierarchy?.parent_catalog_id===row.md_parent_actual_id,'existing positive Pohrebea polygon not verified');
   requireContract(sameLegalId[0].representation?.osm_relation_id===18968121,'Pohrebea OSM relation mismatch');
 }else requireContract(sameLegalId.length===0&&row.actual_polygon_id===null,'polygon for locality unexpectedly exists '+row.locality);
 if(row.locality==='Vasilievca'){
   const other=current.records.filter(x=>x.normalized_name==='vasilievca'&&x.code!=='3811');
   requireContract(other.some(x=>x.code==='6945'&&x.parent_code==='6944'&&x.statistical_code==='9865001'),'second Vasilievca missing');
   requireContract(row.explicitly_excluded_homonym?.cuatm_code==='6945','Vasilievca homonym guard missing');
 }
 legalClaims.push({locality:row.locality,legal_code:row.cuatm_code,legal_parent:row.official_parent,
  existing_master:row.actual_polygon_id,legal_identity_confirmed:true,polygon_binding_confirmed:!!row.actual_polygon_id,
  de_facto_membership_certified:false});
}
let geometryVerified=0;
for(const [path,expected]of Object.entries(topo.sources)){
 requireContract(/^public\/geo\/actual\/[a-z0-9./_-]+\.geojson$/.test(path),'untrusted geometry path '+path);
 const bytes=await readFile(new URL(path,ROOT));
 requireContract(hash(bytes)===expected,'ACTUAL master SHA mismatch '+path);
 geometryVerified++;
}
const summary={schema_version:'p9041-independent-membership-review-v1',
 review_result:'PASS_WITH_EXPLICIT_UNRESOLVED_CASES',
 p91_import_allowed:false,semantic_promotion_ready:false,
 reviewed_geometric_candidates:individual.records.length,
 historical_parent_name_matches:counts.historic_administrative_claim_name_match,
 two_bender_osm_relations:counts.ambiguous_same_name_distinct_osm_entities,
 unresolved_historical_name_matches:counts.unmatched_historical_register,
 contradictory_historical_parent:counts.conflict_geometric_vs_register,
 current_de_facto_membership_certified:0,
 geometric_parent_counts:parentCounts,
 four_cuatm_identities_confirmed:legalClaims.length,
 four_localities_with_existing_ACTUAL_polygons:legalClaims.filter(x=>x.polygon_binding_confirmed).length,
 four_localities_without_distinct_ACTUAL_polygons:legalClaims.filter(x=>!x.polygon_binding_confirmed).length,
 additional_cuatm_homonyms_explicitly_excluded:1,
 actual_entities_verified:actual.entities.length,actual_geometry_sha256_verified:geometryVerified,
 legal_parent_changes:0,master_geometries_created:0,source_independence_note:'2010 de facto register documents historical administrative claims, not proof of control/current membership in Oct 2026.',
 unresolved_conditions:['Cremenciug claimed under Tiraspol but OSM geometric parent Slobozia','Bender two distinct ACTUAL geometries without identity equivalence','Plopi and Ofatinți absent from consulted historical register','Roghi/Mahala/Vasilievca legal IDs confirmed but no distinct ACTUAL polygons','85 de facto membership assertions require current provenance and positive geometric-to-administrative identity mapping','OSM API vs 2026-10-12 Geofabrik snapshot alignment not demonstrated']};
if(process.argv.includes('--self-test')){
 assert.equal(individual.records.length,85);assert.equal(locals.records.length,4);
 assert.equal(summary.current_de_facto_membership_certified,0);
 console.log('P9041_SELF_TEST PASS');
}else{
 await mkdir(OUT,{recursive:true});
 for(const [n,obj] of [['summary.json',summary],['individual-review.json',individual.records],
   ['local-identity-bindings.json',legalClaims],['exceptions.json',anomalies],
   ['p91-blockers.json',{allowed:false,conditions:summary.unresolved_conditions}]]){
   await writeFile(new URL(n,OUT),JSON.stringify(obj,null,2)+'\n');
 }
 console.log('P9041_SUMMARY '+JSON.stringify(summary));
}
