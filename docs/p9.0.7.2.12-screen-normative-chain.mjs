import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const archive='docs/p9.0.7.2.9-annual-census.json.gz';
const out='docs/p9.0.7.2.12-normative-chain-candidates.json';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const shaExpected='8acc0d75a35f65fdac3e5fa88e04f6ef494f5f89822efa85b8467f2108f0a3ad';
const terms=[
 {id:'ATU_FRAMEWORK_EXACT',test:/об административно[-– ]территориальном устройстве приднестровской молдавской республики/i,rank:'DIRECT_NORMATIVE_CHAIN_CANDIDATE'},
 {id:'LOCAL_GOV_FRAMEWORK_EXACT',test:/об органах местной власти, местного самоуправления и государственной администрации в приднестровской молдавской республике/i,rank:'POTENTIALLY_RELEVANT_INSTITUTIONAL_FRAMEWORK'},
 {id:'ATU_REGISTER_EXACT',test:/государственн(?:ого|ом|ый|ому) реестр(?:а|е)?[^«»]{0,110}административно[-– ]территориальн|административно[-– ]территориальн[^«»]{0,100}государственн(?:ого|ом|ый) реестр/i,rank:'REGISTER_CANDIDATE_NOT_EXHAUSTIVE'},
 {id:'SETTLEMENT_BOUNDARY_EXPLICIT',test:/(?:об утверждении|об установлении|об изменении|об уточнении|о корректировке)[^\n]{0,180}границ[^\n]{0,120}(?:города|района|села|поселка|населенного пункта)|(?:границ(?:ах|ы)?)[^\n]{0,100}(?:городов|районов|сел|поселков|населенных пунктов)/i,rank:'BOUNDARY_ACT_CANDIDATE_NEEDS_PRIMARY'},
 {id:'CADASTRE_LAND_GIS',test:/государственн(?:ый|ого|ом) земельн(?:ый|ого|ом) кадастр|землеустройств|межевани[ея]|территориальн[^\n]{0,100}планиров|геодезическ[^\n]{0,100}картограф/i,rank:'CONTEXT_ONLY_CANNOT_ESTABLISH_ADMINISTRATIVE_PARENT'},
 {id:'SPECIFIC_LOCAL_COUNCIL',test:/сельсовет|сельск(?:ого|им|ий|их) совет(?:а|ы|ом)|образовании[^\n]{0,100}сельск(?:ого|их) (?:совет|населенн)/i,rank:'LOCAL_COUNCIL_CANDIDATE_NEEDS_PRIMARY'}
];
function build(){
 const bytes=readFileSync(archive);
 assert.equal(sha256(bytes),shaExpected);
 const data=JSON.parse(gunzipSync(bytes).toString('utf8'));
 const publications=data.years.flatMap(y=>y.publications);
 assert.equal(publications.length,9254);
 assert.equal(new Set(publications.map(x=>x.publication_id)).size,9254);
 const counts=Object.fromEntries(terms.map(t=>[t.id,0]));
 const entries=[];
 for(const row of publications){
   const matched=terms.filter(t=>t.test.test(row.title??''));
   if(!matched.length)continue;
   for(const t of matched)counts[t.id]++;
   entries.push({
     publication_id:row.publication_id,publication_date:row.publication_date,
     act_type:row.act_type,act_number_date:row.act_number_date,
     title:row.title,source_url:row.source_url,
     categories:matched.map(t=>t.id),
     certification_status:'INDEX_TITLE_CANDIDATE_ONLY_NOT_INDIVIDUAL_PRIMARY',
     issuer_verified_for_this_screen:false,
     normative_legal_effect_verified_for_this_screen:false,
     full_polygon_admin_proof:false
   });
 }
 entries.sort((a,b)=>a.publication_id.localeCompare(b.publication_id));
 const law114=entries.find(x=>x.publication_id==='2026000856');
 assert(law114?.categories.includes('ATU_FRAMEWORK_EXACT'));
 const output={
  schema_version:'p907212-title-based-normative-candidate-screen-v1',
  source_archive:archive,source_sha256:shaExpected,
  coverage:'ALL_9254_OFFICIAL_CENTRAL_INDEX_ROWS_THROUGH_2026_10_15',
  year_range:[2023,2024,2025,2026],
  title_screen_not_exhaustive_for_act_content:true,
  external_and_unpublished_sources_not_screened:true,
  filters:terms.map(t=>({id:t.id,rank:t.rank,regex:t.test.source})),
  rows_screened:publications.length,
  rows_selected:entries.length,
  category_counts:counts,
  law114_2026:{
   publication_id:'2026000856',
   publication_date:law114.publication_date,
   act_number_date:law114.act_number_date,
   source_original_pdf:'docs/p9.0.7.2.9-primary/PMR-2026-114-ZID-VIII.pdf',
   archived_original_sha256:'630df1c3a6985539264baa1684c942796b5eb73f93164df6c302eef3d30aece2',
   legislative_effect_clause:'SIX_MONTHS_AFTER_OFFICIAL_PUBLICATION',
   in_effect_on_2026_10_16:false,
   exact_effective_date_certified_by_this_screen:false,
   may_be_used_as_operative_2026_10_16_law:false
  },
  exact_complete_legal_amendment_chain_certified:false,
  exact_2026_full_polygon_de_facto_control_certified:0,
  adjudicated_85:0,
  semantic_acceptance:'BLOCKED_INCOMPLETE',p91_import_allowed:false,actual_mutation_allowed:false,
  candidates:entries
 };
 return JSON.stringify(output,null,2)+'\n';
}
const result=build();
if(process.argv.includes('--check')){
 assert.equal(readFileSync(out,'utf8'),result,'title screen must reproduce byte-for-byte');
 console.log('P907212_SOURCE_SCREEN_REPRO_PASS: all 9254 rows screened; no issuer or full polygon certified');
}else {
 writeFileSync(out,result);
 const j=JSON.parse(result);
 console.log('P907212_SCREEN_BUILT '+JSON.stringify({selected:j.rows_selected,counts:j.category_counts,bytes:Buffer.byteLength(result),sha256:sha256(Buffer.from(result))}));
}
