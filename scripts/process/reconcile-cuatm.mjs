#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const URL=process.env.CUATM_URL||'https://statistica.gov.md/files/files/Clasificatoare/CUATM_25.xlsx';
const SNAPSHOT='data/sources/cuatm-current.json', OUTPUT='data/current/md-cuatm-reconciliation.json', OVERRIDES='data/sources/md-cuatm-reviewed-overrides.json', NON_CUATM_OVERRIDES='data/sources/md-cuatm-reviewed-non-cuatm-overrides.json';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[„”"'’]/g,'').replace(/\b(municipiul|municipiu|orasul|oras|comuna|satul|sat|raionul|raion|sectorul|sector)\b/g,' ').replace(/[^a-z0-9ăâîșț]+/gi,' ').trim().replace(/\s+/g,' ');
const digits=v=>String(v??'').replace(/\.0$/,'').replace(/\s/g,'').trim();
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const reviewedNonCuatm=JSON.parse(await readFile(NON_CUATM_OVERRIDES,'utf8')).overrides||[];
const reviewedNonCuatmById=new Map(reviewedNonCuatm.map(x=>[x.osm_id,x]));
const entities=(catalog.entities||[]).filter(e=>e.jurisdiction==='MD');
const entityById=new Map(entities.map(e=>[e.id,e]));
const entityByRelationId=new Map(entities.filter(e=>e.osm?.relation_id!=null).map(e=>[String(e.osm.relation_id),e]));
const reviewedOverrides=JSON.parse(await readFile(OVERRIDES,'utf8'));

async function fetchOfficial(){
 const r=await fetch(URL,{headers:{'user-agent':'reforma-teritoriala-cuatm/1.2'}});
 if(!r.ok)throw new Error('CUATM download failed: HTTP '+r.status);
 const buf=Buffer.from(await r.arrayBuffer()); if(buf.length<10000)throw new Error('CUATM download unexpectedly small: '+buf.length);
 const wb=XLSX.read(buf,{type:'buffer'}), records=[];
 for(const sheet of wb.SheetNames){
  const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:null,raw:false,blankrows:false});
  if(!matrix.length)continue;
  const headers=(matrix[0]||[]).map(v=>String(v??'').replace(/^\uFEFF/,'').trim());
  const col=name=>headers.indexOf(name);
  const required=['CodUnic','ParentCodUnic','CodStatistic','ParentCodStatistic','Statut','DenumireRO','DenumireRU'];
  const missing=required.filter(h=>col(h)<0);
  if(missing.length)throw new Error('CUATM schema missing columns in '+sheet+': '+missing.join(', '));
  for(let i=1;i<matrix.length;i++){
   const row=matrix[i]||[];
   const code=digits(row[col('CodUnic')]), name=String(row[col('DenumireRO')]??'').trim();
   if(!/^\d{3,10}$/.test(code)||!name)continue;
   records.push({code,parent_code:digits(row[col('ParentCodUnic')])||null,statistical_code:digits(row[col('CodStatistic')])||null,parent_statistical_code:digits(row[col('ParentCodStatistic')])||null,status_code:digits(row[col('Statut')])||null,name,name_ru:String(row[col('DenumireRU')]??'').trim()||null,normalized_name:norm(name),sheet,row:i+1});
  }
 }
 const deduped=[...new Map(records.map(x=>[x.code,x])).values()];
 if(deduped.length<500)throw new Error('CUATM parse produced too few records: '+deduped.length);
 const byCode=new Map(deduped.map(x=>[x.code,x]));
 for(const x of deduped)x.parent_name=x.parent_code?byCode.get(x.parent_code)?.name||null:null;
 return {source_url:URL,fetched_at:new Date().toISOString(),schema:{legal_id:'CodUnic',parent_code:'ParentCodUnic',statistical_code:'CodStatistic',parent_statistical_code:'ParentCodStatistic',status_code:'Statut',name:'DenumireRO',name_ru:'DenumireRU'},record_count:deduped.length,records:deduped};
}
const official=await fetchOfficial();
 await mkdir('data/sources',{recursive:true}); await writeFile(SNAPSHOT,JSON.stringify(official,null,2)+'\n');
const byCode=new Map(),byName=new Map();
for(const r of official.records){for(const [m,k] of [[byCode,r.code],[byName,r.normalized_name]]){if(!m.has(k))m.set(k,[]);m.get(k).push(r);}}
const exactCode=new Map(), unresolved=[];
for(const e of entities){
 const keys=[e.osm?.cuatm_unique_id,e.osm?.cuatm_code].filter(Boolean).map(digits);
 let hit=null,key=null;
 for(const k of keys){const hs=byCode.get(k)||[];if(hs.length===1){hit=hs[0];key=k;break;}}
 if(hit)exactCode.set(e.id,{hit,key}); else unresolved.push({e,keys});
}
function resolvedLegalCode(e){
 if(!e)return null;
 const exact=exactCode.get(e.id)?.hit?.code;
 if(exact)return exact;
 const parent=entityById.get(e.parent_id);
 const parentExact=parent?exactCode.get(parent.id)?.hit:null;
 if(parentExact&&norm(e.name)===parentExact.normalized_name)return parentExact.code;
 return null;
}
function parentCompatible(child,parentCode){return Boolean(parentCode&&child.parent_code===parentCode);}
const matchById=new Map();
const makeMatch=(e,h,method,confidence,key=null)=>({id:e.id,name:e.name,cuatm_key:key,legal_id:h.code,legal_name:h.name,status_code:h.status_code,legal_parent_id:h.parent_code,legal_parent_name:h.parent_name,legal_source:'BNS CUATM',match_method:method,confidence,unmatched_reason:null});
// Pass 0: human-reviewed overrides. These are explicit audited mappings, not
// heuristic rules, and therefore take precedence over automatic reconciliation.
for(const o of reviewedOverrides.overrides||[]){
 const e=entityByRelationId.get(String(o.osm_relation_id));
 if(!e)throw new Error('Reviewed CUATM override OSM relation not found: '+o.osm_relation_id);
 const hits=byCode.get(digits(o.cuatm_legal_id))||[];
 if(hits.length!==1)throw new Error('Reviewed CUATM override legal ID must resolve uniquely: '+o.cuatm_legal_id);
 matchById.set(e.id,{...makeMatch(e,hits[0],'reviewed_override','high',digits(o.cuatm_legal_id)),reviewed_override:{source_url:o.source_url,source_label:o.source_label,reason:o.reason}});
}
// Pass 1a: authoritative explicit CUATM keys.
for(const e of entities){
 const ec=exactCode.get(e.id);
 if(ec&&!matchById.has(e.id))matchById.set(e.id,makeMatch(e,ec.hit,'explicit_cuatm_key','high',ec.key));
}
// Passes 1b and 2 share one deterministic fixpoint. Each round first applies
// the strict self-parent rule, then exact name + verified official parent. A match
// created by either rule may unlock the other rule in the next round.
let changed=true;
while(changed){
 changed=false;

 // Pass 1b: same legal ID, exact normalized name, and no distinct official child
 // under the verified parent. Existing safeguards are intentionally unchanged.
 for(const e of entities){
  if(matchById.has(e.id))continue;
  const keys=[e.osm?.cuatm_unique_id,e.osm?.cuatm_code].filter(Boolean).map(digits);
  if(keys.length)continue;
  const osmParent=entityById.get(e.parent_id), parentMatch=osmParent?matchById.get(osmParent.id):null;
  if(!parentMatch)continue;
  const nameHits=byName.get(norm(e.name))||[];
  const distinctChildren=nameHits.filter(h=>h.code!==parentMatch.legal_id&&h.parent_code===parentMatch.legal_id);
  const self=nameHits.find(h=>h.code===parentMatch.legal_id);
  if(self&&distinctChildren.length===0&&norm(e.name)===norm(parentMatch.legal_name)){
   matchById.set(e.id,makeMatch(e,self,'osm_self_parent_same_legal_entity','medium'));
   changed=true;
  }
 }

 // Pass 2: unique exact-name candidate under an already verified official parent.
 // Existing safeguards are intentionally unchanged.
 for(const e of entities){
  if(matchById.has(e.id))continue;
  const keys=[e.osm?.cuatm_unique_id,e.osm?.cuatm_code].filter(Boolean).map(digits);
  if(keys.length)continue;
  const parent=entityById.get(e.parent_id), parentMatch=parent?matchById.get(parent.id):null;
  const parentCode=parentMatch?.legal_id||null;
  if(!parentCode)continue;
  const parentHits=(byName.get(norm(e.name))||[]).filter(h=>parentCompatible(h,parentCode));
  if(parentHits.length===1){
   matchById.set(e.id,makeMatch(e,parentHits[0],'exact_normalized_name_and_official_parent','medium'));
   changed=true;
  }
 }
}
const matches=[];
for(const e of entities){
 const resolved=matchById.get(e.id);
 if(resolved){matches.push(resolved);continue;}
 const keys=[e.osm?.cuatm_unique_id,e.osm?.cuatm_code].filter(Boolean).map(digits);
 let reason='no_explicit_cuatm_key';
 if(keys.length){const counts=keys.map(k=>(byCode.get(k)||[]).length);reason=counts.some(n=>n>1)?'code_non_unique':'code_absent_from_official_snapshot';}
 const nameHits=byName.get(norm(e.name))||[], parent=entityById.get(e.parent_id), parentCode=parent?matchById.get(parent.id)?.legal_id||null:null;
 const parentHits=nameHits.filter(h=>parentCompatible(h,parentCode));
 if(!keys.length&&nameHits.length===1&&!parentCode)reason='unique_name_but_parent_unverified';
 else if(!keys.length&&nameHits.length>1)reason=parentCode?'name_ambiguous_with_parent':'name_ambiguous';
 else if(!keys.length&&nameHits.length===0)reason='name_absent_from_official_snapshot';
 matches.push({id:e.id,name:e.name,cuatm_key:keys[0]||null,legal_id:null,legal_name:null,status_code:null,legal_source:'BNS CUATM',match_method:null,confidence:null,unmatched_reason:reason,name_candidate_count:nameHits.length,parent_official_code:parentCode});
 matchById.set(e.id,matches[matches.length-1]);
}
const matched=matches.filter(x=>x.legal_id), unmatched=matches.filter(x=>!x.legal_id);

// Reviewed semantic class: OSM allotment boundaries are retained as geographic
// entities but are outside current legal CUATM reconciliation. Require the full
// reviewed population signature; accept both stale/absent explicit codes and names absent
// from the official snapshot, but do not generalize this to every level-9 feature.
const isNonCuatmAllotment=m=>{
 const e=entityById.get(m.id);
 const eligibleReason=m.unmatched_reason==='code_absent_from_official_snapshot'||m.unmatched_reason==='name_absent_from_official_snapshot';
 if(!eligibleReason||e?.osm?.admin_level!==9||e?.osm?.place!=='allotments')return false;
 const parent=e?.parent_id?entityById.get(e.parent_id):null;
 const parentMatch=parent?matchById.get(parent.id):null;
 return Boolean(parentMatch?.legal_id);
};
const nonCuatmAllotments=unmatched.filter(m=>isNonCuatmAllotment(m)||reviewedNonCuatmById.has(m.id)).map(m=>{
 const e=entityById.get(m.id), parent=entityById.get(e.parent_id), parentMatch=matchById.get(parent.id), reviewed=reviewedNonCuatmById.get(m.id)||null;
 if(reviewed){
  if(reviewed.reconciliation_class!=='non_cuatm_allotment_boundary')throw new Error('Unsupported reviewed non-CUATM class for '+m.id);
  if(Number(reviewed.osm_relation_id)!==Number(e.osm?.relation_id))throw new Error('Reviewed non-CUATM relation mismatch for '+m.id);
  if(reviewed.reviewed_parent_legal_id&&reviewed.reviewed_parent_legal_id!==parentMatch?.legal_id)throw new Error('Reviewed non-CUATM parent mismatch for '+m.id);
 }
 return {...m,reconciliation_class:'non_cuatm_allotment_boundary',classification_method:reviewed?'reviewed_override':'structural_rule',reviewed_override:reviewed,osm_relation_id:e.osm?.relation_id??null,osm_admin_level:e.osm?.admin_level??null,osm_place:e.osm?.place??null,osm_parent_id:e.parent_id||null,osm_parent_name:parent?.name||null,verified_parent_legal_id:parentMatch?.legal_id||null,verified_parent_legal_name:parentMatch?.legal_name||null,raw_cuatm_unique_id:e.osm?.cuatm_unique_id??null,raw_cuatm_code:e.osm?.cuatm_code??null};
});
const nonCuatmAllotmentIds=new Set(nonCuatmAllotments.map(x=>x.id));
const legalUnmatched=unmatched.filter(x=>!nonCuatmAllotmentIds.has(x.id));

// General unmatched queue: intentionally separate from the resolved edge-case audit.
// This is the actionable population for subsequent cleanup of stale/invalid OSM CUATM
// codes and names absent from the current official snapshot.
const unmatchedGeneral=legalUnmatched.map(m=>{
 const e=entityById.get(m.id);
 const parent=e?.parent_id?entityById.get(e.parent_id):null;
 const parentMatch=parent?matchById.get(parent.id):null;
 const rawKeys=[e?.osm?.cuatm_unique_id,e?.osm?.cuatm_code].filter(Boolean);
 const normalizedKeys=rawKeys.map(digits);
 return {...m,osm_relation_id:e?.osm?.relation_id??null,osm_admin_level:e?.osm?.admin_level??null,osm_place:e?.osm?.place??null,osm_parent_id:e?.parent_id||null,osm_parent_name:parent?.name||null,verified_parent_legal_id:parentMatch?.legal_id||null,verified_parent_legal_name:parentMatch?.legal_name||null,raw_cuatm_unique_id:e?.osm?.cuatm_unique_id??null,raw_cuatm_code:e?.osm?.cuatm_code??null,normalized_explicit_keys:normalizedKeys};
});
const unmatchedGeneralByReason=unmatchedGeneral.reduce((a,x)=>(a[x.unmatched_reason]=(a[x.unmatched_reason]||0)+1,a),{});
const unmatchedGroups=Object.fromEntries(Object.entries(unmatchedGeneralByReason).sort().map(([reason,count])=>[reason,{count,items:unmatchedGeneral.filter(x=>x.unmatched_reason===reason)}]));
await writeFile('data/current/md-cuatm-unmatched-review.json',JSON.stringify({generated_at:new Date().toISOString(),jurisdiction:'MD',scope:'Unreconciled general catalog entities only; resolved edge cases are excluded.',count:unmatchedGeneral.length,by_reason:unmatchedGeneralByReason,groups:unmatchedGroups},null,2)+'\n');
await writeFile('data/current/md-cuatm-non-cuatm-allotments.json',JSON.stringify({
 generated_at:new Date().toISOString(),jurisdiction:'MD',
 reconciliation_class:'non_cuatm_allotment_boundary',
 policy:'Retained geographic entities outside current legal CUATM reconciliation. Raw OSM identifiers, geometry linkage and verified legal parent are preserved.',
 count:nonCuatmAllotments.length,
 items:nonCuatmAllotments
},null,2)+'\n');
const nameAbsent=unmatchedGeneral.filter(x=>x.unmatched_reason==='name_absent_from_official_snapshot');
const namePattern=x=>{
 const n=(x.name||'').normalize('NFC').trim();
 if(!n)return 'missing_name';
 const folded=n.normalize('NFD').replace(/\p{M}/gu,'');
 if(/^sovetul\s+satesc\b/iu.test(folded))return 'sovetul_satesc';
 // Inspect only the first token before whitespace/quote. Strip punctuation
 // after diacritic folding: Î.P., Î.P, I.P. and I.P all become IP.
 const token=(folded.match(/^[^\s„"'«»]+/u)||[])[0]||'';
 const compact=token.replace(/[^A-Za-z]/g,'').toUpperCase();
 if(compact==='IP')return 'horticultural_association_prefix';
 return 'other_named';
};
const structuralPattern=x=>{
 if(x.osm_admin_level===9&&x.osm_place==='allotments')return 'level9_allotments';
 if(x.osm_admin_level===9&&!x.osm_place)return 'level9_place_missing';
 if(x.osm_admin_level===8&&!x.osm_place)return 'level8_place_missing';
 return 'other';
};
const nameAbsentClassified=nameAbsent.map(x=>({...x,classification:{admin_level:String(x.osm_admin_level??'missing'),place:x.osm_place??'missing',parent_relation:x.verified_parent_legal_id?'verified_parent':'unverified_parent',name_pattern:namePattern(x),structural_pattern:structuralPattern(x)}}));
const codeAbsent=unmatched.filter(x=>x.unmatched_reason==='code_absent_from_official_snapshot');
const bucket=(items,keyFn)=>items.reduce((a,x)=>{const k=keyFn(x);a[k]=(a[k]||0)+1;return a;},{});
const codeShape=x=>{
 const key=x.normalized_explicit_keys?.[0]||'';
 const parent=x.verified_parent_legal_id||'';
 if(key&&parent&&key.startsWith(parent))return `parent_prefix_plus_${key.length-parent.length}_chars`;
 return `${key.length}_char_other`;
};
const codeAbsentClassified=codeAbsent.map(x=>({...x,classification:{admin_level:String(x.osm_admin_level??'missing'),place:x.osm_place??'missing',code_shape:codeShape(x),parent_relation:x.verified_parent_legal_id?'verified_parent':'unverified_parent'}}));
await writeFile('data/current/md-cuatm-code-absent-classification.json',JSON.stringify({
 generated_at:new Date().toISOString(),jurisdiction:'MD',
 scope:'Entities whose explicit OSM CUATM key is absent from the current official CUATM snapshot; diagnostic only.',
 count:codeAbsentClassified.length,
 dimensions:{
  admin_level:bucket(codeAbsentClassified,x=>x.classification.admin_level),
  place:bucket(codeAbsentClassified,x=>x.classification.place),
  code_shape:bucket(codeAbsentClassified,x=>x.classification.code_shape),
  parent_relation:bucket(codeAbsentClassified,x=>x.classification.parent_relation)
 },
 combinations:bucket(codeAbsentClassified,x=>[x.classification.admin_level,x.classification.place,x.classification.code_shape,x.classification.parent_relation].join('|')),
 items:codeAbsentClassified
},null,2)+'\n');
await writeFile('data/current/md-cuatm-name-absent-classification.json',JSON.stringify({
 generated_at:new Date().toISOString(),jurisdiction:'MD',
 scope:'Current legal-unmatched entities whose normalized OSM name is absent from the current official CUATM snapshot; diagnostic only.',
 count:nameAbsentClassified.length,
 dimensions:{
  admin_level:bucket(nameAbsentClassified,x=>x.classification.admin_level),
  place:bucket(nameAbsentClassified,x=>x.classification.place),
  parent_relation:bucket(nameAbsentClassified,x=>x.classification.parent_relation),
  name_pattern:bucket(nameAbsentClassified,x=>x.classification.name_pattern),
  structural_pattern:bucket(nameAbsentClassified,x=>x.classification.structural_pattern)
 },
 combinations:bucket(nameAbsentClassified,x=>[x.classification.admin_level,x.classification.place,x.classification.parent_relation,x.classification.name_pattern,x.classification.structural_pattern].join('|')),
 items:nameAbsentClassified
},null,2)+'\n');

const noKeyDiagnostics=entities.filter(e=>![e.osm?.cuatm_unique_id,e.osm?.cuatm_code].some(Boolean)).map(e=>{
 const parent=entityById.get(e.parent_id)||null;
 const parentMatch=parent?matchById.get(parent.id):null;
 const verifiedParentLegalId=parentMatch?.legal_id||null;
 const candidates=(byName.get(norm(e.name))||[]).map(h=>({legal_id:h.code,legal_name:h.name,parent_code:h.parent_code||null,parent_name:h.parent_name||null,official_sheet:h.sheet,official_row:h.row,parent_matches_verified_osm_parent:Boolean(verifiedParentLegalId&&h.parent_code===verifiedParentLegalId)}));
 let category;
 if(!candidates.length)category='no_official_name_candidate';
 else if(!verifiedParentLegalId)category='osm_parent_not_reconciled';
 else if(candidates.some(x=>x.parent_matches_verified_osm_parent))category='exact_name_parent_match_available';
 else if(candidates.some(x=>!x.parent_code))category='official_parent_parse_suspect';
 else category='child_name_match_parent_mismatch';
 return {id:e.id,name:e.name,osm_relation_id:e.osm?.relation_id??null,osm_parent_id:e.parent_id||null,osm_parent_name:parent?.name||null,osm_parent_relation_id:parent?.osm?.relation_id??null,verified_osm_parent_legal_id:verifiedParentLegalId,verified_osm_parent_legal_name:parentMatch?.legal_name||null,normalized_child_name:norm(e.name),official_name_candidate_count:candidates.length,official_name_candidates:candidates,diagnostic_category:category};
});
const diagnosticCounts=noKeyDiagnostics.reduce((a,x)=>(a[x.diagnostic_category]=(a[x.diagnostic_category]||0)+1,a),{});
const edgeAudit=noKeyDiagnostics.filter(d=>{
 const m=matchById.get(d.id);
 return d.diagnostic_category==='child_name_match_parent_mismatch'||(d.diagnostic_category==='exact_name_parent_match_available'&&m?.match_method!=='exact_normalized_name_and_official_parent');
}).map(d=>{
 const m=matchById.get(d.id);
 const matchingCandidates=d.official_name_candidates.filter(x=>x.parent_matches_verified_osm_parent);
 let audit_category='genuine_parent_disagreement';
 if(d.diagnostic_category==='exact_name_parent_match_available'){
  audit_category=matchingCandidates.length>1?'multiple_official_candidates_under_same_parent':'diagnostic_match_not_auto_assigned';
 }else if(d.verified_osm_parent_legal_id&&d.official_name_candidates.some(x=>x.legal_id===d.verified_osm_parent_legal_id)){
  audit_category='osm_self_parent_same_legal_entity';
 }
 const parentMatch=d.osm_parent_id?matchById.get(d.osm_parent_id):null;
 const sameLegalId=Boolean(parentMatch?.legal_id&&d.official_name_candidates.some(x=>x.legal_id===parentMatch.legal_id));
 const exactNormalizedName=Boolean(parentMatch?.legal_name&&d.normalized_child_name===norm(parentMatch.legal_name));
 const distinctChildren=parentMatch?.legal_id?d.official_name_candidates.filter(x=>x.legal_id!==parentMatch.legal_id&&x.parent_code===parentMatch.legal_id):[];
 const entity=entityById.get(d.id);
 const rawCuatmUniqueId=entity?.osm?.cuatm_unique_id??null, rawCuatmCode=entity?.osm?.cuatm_code??null;
 const normalizedExplicitKeys=[rawCuatmUniqueId,rawCuatmCode].filter(Boolean).map(digits);
 const explicitKeyLookups=normalizedExplicitKeys.map(key=>({key,official_candidate_count:(byCode.get(key)||[]).length,official_candidates:(byCode.get(key)||[]).map(h=>({legal_id:h.code,legal_name:h.name,parent_code:h.parent_code||null,parent_name:h.parent_name||null,status_code:h.status_code||null}))}));
 const selfParentPredicates={parentMatch:Boolean(parentMatch?.legal_id),parent_legal_id:parentMatch?.legal_id||null,same_legal_id:sameLegalId,exact_normalized_name:exactNormalizedName,distinct_children_count:distinctChildren.length,distinct_children:distinctChildren,raw_cuatm_unique_id:rawCuatmUniqueId,raw_cuatm_code:rawCuatmCode,normalized_explicit_keys:normalizedExplicitKeys,explicit_key_count:normalizedExplicitKeys.length,explicit_key_lookups:explicitKeyLookups};
 return {...d,reconciliation_match_method:m?.match_method||null,reconciliation_unmatched_reason:m?.unmatched_reason||null,matching_candidate_count:matchingCandidates.length,matching_candidates:matchingCandidates,self_parent_predicates:selfParentPredicates,audit_category};
});
const resolvedRepresentationCases=edgeAudit.filter(x=>x.audit_category==='osm_self_parent_same_legal_entity'&&x.reconciliation_match_method==='osm_self_parent_same_legal_entity');
const resolvedReviewedOverrides=edgeAudit.filter(x=>x.reconciliation_match_method==='reviewed_override');
const resolvedEdgeCases=[...resolvedRepresentationCases,...resolvedReviewedOverrides];
const resolvedIds=new Set(resolvedEdgeCases.map(x=>x.id));
const unresolvedReviewCases=edgeAudit.filter(x=>!resolvedIds.has(x.id));
const countByCategory=items=>items.reduce((a,x)=>(a[x.audit_category]=(a[x.audit_category]||0)+1,a),{});
const edgeAuditCounts=countByCategory(edgeAudit);
const resolvedRepresentationCounts=countByCategory(resolvedRepresentationCases);
const resolvedReviewedOverrideCounts=countByCategory(resolvedReviewedOverrides);
const resolvedEdgeCounts=countByCategory(resolvedEdgeCases);
const unresolvedReviewCounts=countByCategory(unresolvedReviewCases);
await writeFile('data/current/md-cuatm-edge-case-audit.json',JSON.stringify({
 generated_at:new Date().toISOString(),
 jurisdiction:'MD',
 scope:{parent_mismatch:noKeyDiagnostics.filter(x=>x.diagnostic_category==='child_name_match_parent_mismatch').length,diagnostic_parent_match_not_auto_assigned:edgeAudit.filter(x=>x.diagnostic_category==='exact_name_parent_match_available').length},
 summary:{all_edge_cases:edgeAudit.length,resolved_edge_cases:resolvedEdgeCases.length,resolved_representation_cases:resolvedRepresentationCases.length,resolved_reviewed_overrides:resolvedReviewedOverrides.length,unresolved_review_cases:unresolvedReviewCases.length},
 by_category:edgeAuditCounts,
 resolved_edge_cases:{count:resolvedEdgeCases.length,by_category:resolvedEdgeCounts,items:resolvedEdgeCases},
 resolved_representation_cases:{count:resolvedRepresentationCases.length,by_category:resolvedRepresentationCounts,items:resolvedRepresentationCases},
 resolved_reviewed_overrides:{count:resolvedReviewedOverrides.length,by_category:resolvedReviewedOverrideCounts,items:resolvedReviewedOverrides},
 unresolved_review_cases:{count:unresolvedReviewCases.length,by_category:unresolvedReviewCounts,items:unresolvedReviewCases},
 items:edgeAudit
},null,2)+'\\n');
const mismatchMatrix=new Map();
for(const d of noKeyDiagnostics.filter(x=>x.diagnostic_category==='child_name_match_parent_mismatch')){
 const parentMatch=d.osm_parent_id?matchById.get(d.osm_parent_id):null;
 const osmParentType=parentMatch?.status_code||'unknown';
 for(const cand of d.official_name_candidates){
  const officialParent=(byCode.get(cand.parent_code)||[])[0]||null;
  const officialParentType=officialParent?.status_code||'unknown';
  const key=osmParentType+'|'+officialParentType;
  if(!mismatchMatrix.has(key))mismatchMatrix.set(key,{verified_osm_parent_status_code:osmParentType,candidate_official_parent_status_code:officialParentType,count:0,examples:[]});
  const cell=mismatchMatrix.get(key); cell.count++;
  if(cell.examples.length<8)cell.examples.push({child_name:d.name,osm_parent_name:d.osm_parent_name,verified_osm_parent_legal_id:d.verified_osm_parent_legal_id,verified_osm_parent_legal_name:d.verified_osm_parent_legal_name,candidate_legal_id:cand.legal_id,candidate_legal_name:cand.legal_name,candidate_parent_code:cand.parent_code,candidate_parent_name:cand.parent_name});
 }
}
const mismatchRows=[...mismatchMatrix.values()].sort((a,b)=>b.count-a.count);
await writeFile('data/current/md-cuatm-parent-mismatch-matrix.json',JSON.stringify({generated_at:new Date().toISOString(),jurisdiction:'MD',mismatch_entity_count:noKeyDiagnostics.filter(x=>x.diagnostic_category==='child_name_match_parent_mismatch').length,matrix_candidate_pair_count:mismatchRows.reduce((n,x)=>n+x.count,0),matrix:mismatchRows},null,2)+'\\n');
await writeFile('data/current/md-cuatm-pair-diagnostics.json',JSON.stringify({generated_at:new Date().toISOString(),jurisdiction:'MD',entity_count:noKeyDiagnostics.length,by_category:diagnosticCounts,policy:'Diagnostic only. No legal fields are assigned from this file.',items:noKeyDiagnostics},null,2)+'\\n');
const reasons=legalUnmatched.reduce((a,x)=>(a[x.unmatched_reason]=(a[x.unmatched_reason]||0)+1,a),{});
const methods=matched.reduce((a,x)=>(a[x.match_method]=(a[x.match_method]||0)+1,a),{});
const out={generated_at:new Date().toISOString(),jurisdiction:'MD',official_source:'BNS CUATM',official_source_url:URL,official_snapshot_records:official.record_count,official_parent_links:official.records.filter(r=>r.parent_code).length,entity_count:matches.length,matched_count:matched.length,unmatched_count:legalUnmatched.length,non_cuatm_count:nonCuatmAllotments.length,non_cuatm_by_class:{non_cuatm_allotment_boundary:nonCuatmAllotments.length},matched_by_method:methods,unmatched_by_reason:reasons,policy:'Automatic legal assignment: unique exact CUATM key (high); exact normalized name plus a uniquely matching verified official parent (medium); or an OSM child whose exact normalized name and official legal ID equal its already CUATM-verified OSM parent, treated explicitly as the same legal entity (medium). Fuzzy and name-only matches never auto-assign.',matches};
if(!matched.length)throw new Error('CUATM reconciliation produced zero verified matches');
await writeFile(OUTPUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({official_records:official.record_count,official_parent_links:official.records.filter(r=>r.parent_code).length,entities:matches.length,matched:matched.length,unmatched:legalUnmatched.length,non_cuatm_allotments:nonCuatmAllotments.length,matched_by_method:methods,unmatched_by_reason:reasons,no_key_pair_diagnostics:diagnosticCounts,edge_case_audit:{count:edgeAudit.length,by_category:edgeAuditCounts,items:edgeAudit},parent_mismatch_matrix:mismatchRows.map(x=>({verified_osm_parent_status_code:x.verified_osm_parent_status_code,candidate_official_parent_status_code:x.candidate_official_parent_status_code,count:x.count,examples:x.examples.slice(0,3)}))},null,2));
