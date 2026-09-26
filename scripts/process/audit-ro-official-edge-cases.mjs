#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {area,intersect,featureCollection} from '@turf/turf';

const REC='data/current/ro-official-reconciliation.json';
const SNAP='data/sources/ro-siruta-current.json';
const GEO='public/geo/current/ro-administrative.geojson';
const OUT='data/current/ro-official-edge-case-audit.json';

const reconciliation=JSON.parse(await readFile(REC,'utf8'));
const official=JSON.parse(await readFile(SNAP,'utf8'));
const geo=JSON.parse(await readFile(GEO,'utf8'));

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[„”"'’]/g,' ').replace(/\b(judetul|judet|municipiul|municipiu|orasul|oras|comuna|sectorul|sector)\b/g,' ')
 .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const relationId=f=>{
 const raw=String(f?.id||f?.properties?.id||f?.properties?.catalog_id||'');
 const m=raw.match(/(?:relation\/|osm-r)?(\d+)/);
 return m?Number(m[1]):null;
};
const records=official.records||[];
const byCode=new Map(records.map(x=>[String(x.siruta),x]));
const uats=records.filter(x=>Number(x.level)===2);
const localities=records.filter(x=>Number(x.level)===3);
const countyOfUat=uat=>byCode.get(String(uat?.parent_siruta||''))||null;
const countyOfLocality=loc=>{
 const uat=byCode.get(String(loc?.parent_siruta||''));
 return countyOfUat(uat);
};
const featureByRelation=new Map((geo.features||[]).map(f=>[relationId(f),f]).filter(([id])=>id));
const officialOnlyIds=new Set((reconciliation.official_only||[]).map(x=>String(x.legal_id)));

function levenshtein(a,b){
 a=norm(a); b=norm(b);
 const dp=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){
  let prev=dp[0]; dp[0]=i;
  for(let j=1;j<=b.length;j++){
   const tmp=dp[j];
   dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
   prev=tmp;
  }
 }
 return dp[b.length];
}
function similarity(a,b){
 const aa=norm(a),bb=norm(b),m=Math.max(aa.length,bb.length);
 return m?1-levenshtein(aa,bb)/m:1;
}
function countyMatches(osmCounty,recordCounty){
 return norm(osmCounty)===norm(recordCounty);
}
function sameCountyOfficialOnly(osmCounty){
 return uats.filter(u=>officialOnlyIds.has(String(u.siruta))&&countyMatches(osmCounty,countyOfUat(u)?.name));
}
function localityExactCandidates(osmName,osmCounty){
 return localities.filter(loc=>norm(loc.name)===norm(osmName)&&countyMatches(osmCounty,countyOfLocality(loc)?.name))
  .map(loc=>{
   const uat=byCode.get(String(loc.parent_siruta||''));
   return {locality_siruta:loc.siruta,locality_name:loc.name,uat_siruta:uat?.siruta||null,uat_name:uat?.name||null,uat_type:uat?.legal_type||null,uat_is_official_only:uat?officialOnlyIds.has(String(uat.siruta)):false};
  });
}
function rankedUatCandidates(osmName,osmCounty){
 return sameCountyOfficialOnly(osmCounty).map(u=>({
  legal_id:u.siruta,legal_name:u.name,legal_type:u.legal_type,
  similarity:Number(similarity(osmName,u.name).toFixed(4))
 })).sort((a,b)=>b.similarity-a.similarity).slice(0,5);
}

const unresolved=(reconciliation.unmatched_osm||[]).map(x=>{
 const exactLocalities=localityExactCandidates(x.osm_name,x.osm_parent_name);
 const ranked=rankedUatCandidates(x.osm_name,x.osm_parent_name);
 let classification='unresolved_identity',review_status='manual_review',resolution=null,evidence={};

 if(x.explicit_siruta_tag?.value){
  const tagged=byCode.get(String(x.explicit_siruta_tag.value));
  if(tagged&&Number(tagged.level)===3){
   const parent=byCode.get(String(tagged.parent_siruta||''));
   const county=countyOfUat(parent);
   const sameName=norm(tagged.name)===norm(x.osm_name);
   const sameCounty=countyMatches(x.osm_parent_name,county?.name);
   if(parent&&Number(parent.level)===2&&sameName&&sameCounty){
    classification='explicit_siruta_points_to_seat_locality';
    review_status='resolved_identity_mapping';
    resolution={legal_id:parent.siruta,legal_name:parent.name,legal_type:parent.legal_type,action:'map_osm_uat_to_parent_level2_siruta'};
    evidence={tagged_record:{siruta:tagged.siruta,name:tagged.name,level:tagged.level,parent_siruta:tagged.parent_siruta},county_name:county?.name||null};
   }
  }
 }

 if(review_status==='manual_review'&&exactLocalities.length===1){
  const c=exactLocalities[0];
  classification=c.uat_is_official_only?'osm_name_matches_component_locality_of_official_only_uat':'osm_name_matches_component_locality';
  review_status='candidate_identity_mapping';
  resolution={legal_id:c.uat_siruta,legal_name:c.uat_name,legal_type:c.uat_type,action:'manual_verify_relation_represents_parent_uat'};
  evidence={exact_component_locality:c};
 }

 return {
  osm_relation_id:x.osm_relation_id,osm_name:x.osm_name,osm_county:x.osm_parent_name,original_issue:x.issue,
  explicit_siruta_tag:x.explicit_siruta_tag,
  classification,review_status,resolution,evidence,
  exact_component_locality_candidates:exactLocalities,
  ranked_official_only_uat_candidates:ranked
 };
});

const typeMismatches=(reconciliation.type_mismatches||[]).map(x=>({
 osm_relation_id:x.osm_relation_id,osm_name:x.osm_name,osm_county:x.osm_parent_name,
 legal_id:x.legal_id,legal_name:x.legal_name,
 osm_entity_type:x.osm_entity_type,official_legal_type:x.legal_type,
 classification:'osm_type_conflicts_with_official_siruta',
 review_status:'resolved_legal_type',
 resolution_action:'use_official_siruta_type_for_legal_catalog; retain OSM tags as provenance'
}));

const duplicateAudits=(reconciliation.duplicate_legal_mappings||[]).map(d=>{
 const [aId,bId]=d.osm_relation_ids||[];
 const a=featureByRelation.get(aId),b=featureByRelation.get(bId);
 let aa=null,bb=null,ia=null;
 try{aa=a?area(a)/1e6:null;}catch{}
 try{bb=b?area(b)/1e6:null;}catch{}
 try{
  const i=a&&b?intersect(featureCollection([a,b])):null;
  ia=i?area(i)/1e6:0;
 }catch{ia=null;}
 const smaller=aa!=null&&bb!=null?Math.min(aa,bb):null;
 const union=aa!=null&&bb!=null&&ia!=null?aa+bb-ia:null;
 const overlapSmaller=smaller&&ia!=null?ia/smaller:null;
 const iou=union&&ia!=null?ia/union:null;
 return {
  legal_id:d.legal_id,osm_relation_ids:d.osm_relation_ids,
  geometry:{area_km2:{[aId]:aa,[bId]:bb},intersection_km2:ia,intersection_over_smaller:overlapSmaller,intersection_over_union:iou},
  classification:overlapSmaller!=null&&overlapSmaller>0.98?'near_duplicate_geometry':'distinct_or_partial_geometry',
  review_status:'manual_role_review',
  resolution_action:'do_not_choose_canonical_relation_without_role/history evidence'
 };
});

const summary={
 signal_count:unresolved.length+typeMismatches.length+duplicateAudits.length,
 unmatched_osm_count:unresolved.length,
 resolved_identity_mapping_count:unresolved.filter(x=>x.review_status==='resolved_identity_mapping').length,
 candidate_identity_mapping_count:unresolved.filter(x=>x.review_status==='candidate_identity_mapping').length,
 unresolved_identity_count:unresolved.filter(x=>x.review_status==='manual_review').length,
 resolved_legal_type_count:typeMismatches.length,
 duplicate_mapping_count:duplicateAudits.length,
 near_duplicate_geometry_count:duplicateAudits.filter(x=>x.classification==='near_duplicate_geometry').length
};
const checks=[],failures=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)failures.push({name,detail});};
check('input_reconciliation_is_pass',reconciliation.status==='PASS',{status:reconciliation.status});
check('all_reported_unmatched_audited',unresolved.length===(reconciliation.unmatched_osm||[]).length,{expected:(reconciliation.unmatched_osm||[]).length,actual:unresolved.length});
check('all_type_mismatches_audited',typeMismatches.length===(reconciliation.type_mismatches||[]).length,{expected:(reconciliation.type_mismatches||[]).length,actual:typeMismatches.length});
check('all_duplicate_mappings_audited',duplicateAudits.length===(reconciliation.duplicate_legal_mappings||[]).length,{expected:(reconciliation.duplicate_legal_mappings||[]).length,actual:duplicateAudits.length});

const out={
 schema_version:1,generated_at:new Date().toISOString(),jurisdiction:'RO',
 scope:'Targeted audit of unresolved and conflicting signals from RO official reconciliation.',
 policy:'SIRUTA is authoritative for legal identity/hierarchy/type. OSM geometry/tags remain provenance. Level-3 SIRUTA codes may identify a seat/locality and are mapped to their level-2 parent only when name and county both agree. Component-locality and fuzzy/name-similarity signals are candidates only and never auto-applied.',
 status:failures.length?'FAIL':'PASS',checks,summary,
 unmatched_osm_audit:unresolved,
 type_mismatch_audit:typeMismatches,
 duplicate_mapping_audit:duplicateAudits,
 failures
};
await mkdir('data/current',{recursive:true});
await writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({status:out.status,summary:out.summary,failures},null,2));
if(failures.length)process.exitCode=1;
