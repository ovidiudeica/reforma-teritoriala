#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const URL=process.env.CUATM_URL||'https://statistica.gov.md/files/files/Clasificatoare/CUATM_25.xlsx';
const SNAPSHOT='data/sources/cuatm-current.json', OUTPUT='data/current/md-cuatm-reconciliation.json';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[„”"'’]/g,'').replace(/\b(municipiul|municipiu|orasul|oras|comuna|satul|sat|raionul|raion|sectorul|sector)\b/g,' ').replace(/[^a-z0-9ăâîșț]+/gi,' ').trim().replace(/\s+/g,' ');
const digits=v=>String(v??'').replace(/\.0$/,'').replace(/\s/g,'').trim();
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const entities=(catalog.entities||[]).filter(e=>e.jurisdiction==='MD');
const entityById=new Map(entities.map(e=>[e.id,e]));

async function fetchOfficial(){
 const r=await fetch(URL,{headers:{'user-agent':'reforma-teritoriala-cuatm/1.1'}});
 if(!r.ok)throw new Error('CUATM download failed: HTTP '+r.status);
 const buf=Buffer.from(await r.arrayBuffer()); if(buf.length<10000)throw new Error('CUATM download unexpectedly small: '+buf.length);
 const wb=XLSX.read(buf,{type:'buffer'}), rows=[];
 for(const sheet of wb.SheetNames){
  const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:null,raw:false});
  for(let i=0;i<matrix.length;i++){
   const cells=(matrix[i]||[]).map(x=>String(x??'').trim());
   const ci=cells.findIndex(x=>/^\d{3,10}$/.test(x.replace(/\s/g,''))); if(ci<0)continue;
   const code=digits(cells[ci]), text=cells.filter((x,j)=>j!==ci&&x&&!/^\d+$/.test(x)).sort((a,b)=>b.length-a.length)[0]||null;
   if(text)rows.push({code,name:text,normalized_name:norm(text),legal_type:legalType(text),sheet,row:i+1});
  }
 }
 const records=[...new Map(rows.map(x=>[x.code+'|'+x.normalized_name,x])).values()];
 if(records.length<500)throw new Error('CUATM parse produced too few records: '+records.length);
 return {source_url:URL,fetched_at:new Date().toISOString(),record_count:records.length,records};
}
function legalType(name){const n=String(name||'').toLowerCase();if(n.includes('municip'))return'municipality';if(n.includes('raion'))return'district';if(n.includes('sector'))return'sector';if(n.includes('oraș')||n.includes('oras'))return'town';if(n.includes('comun'))return'commune';if(n.includes('sat'))return'village';return'administrative_or_territorial_unit';}
function hierarchyRank(type){return ({district:1,municipality:1,sector:2,town:2,commune:2,village:3,administrative_or_territorial_unit:9})[type]??9;}
function attachOfficialParents(records){
 const bySheet=new Map(); for(const r of records){if(!bySheet.has(r.sheet))bySheet.set(r.sheet,[]);bySheet.get(r.sheet).push(r);}
 for(const rows of bySheet.values()){
  rows.sort((a,b)=>a.row-b.row); const stack=[];
  for(const r of rows){
   const rank=hierarchyRank(r.legal_type);
   while(stack.length&&stack.at(-1).rank>=rank)stack.pop();
   const parent=stack.at(-1)?.record||null;
   r.parent_code=parent?.code||null; r.parent_name=parent?.name||null;
   if(rank<9)stack.push({rank,record:r});
  }
 }
 return records;
}
const official=await fetchOfficial();
official.records=attachOfficialParents(official.records);
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
function officialParentCode(e){
 const p=entityById.get(e.parent_id); if(!p)return null;
 return exactCode.get(p.id)?.hit?.code||null;
}
function parentCompatible(child,parentCode){return Boolean(parentCode&&child.parent_code===parentCode);}
const matches=[];
for(const e of entities){
 const ec=exactCode.get(e.id);
 if(ec){const h=ec.hit;matches.push({id:e.id,name:e.name,cuatm_key:ec.key,legal_id:h.code,legal_name:h.name,legal_type:h.legal_type,legal_parent_id:h.parent_code,legal_parent_name:h.parent_name,legal_source:'BNS CUATM',match_method:'explicit_cuatm_key',confidence:'high',unmatched_reason:null});continue;}
 const keys=[e.osm?.cuatm_unique_id,e.osm?.cuatm_code].filter(Boolean).map(digits);
 let reason='no_explicit_cuatm_key';
 if(keys.length){const counts=keys.map(k=>(byCode.get(k)||[]).length);reason=counts.some(n=>n>1)?'code_non_unique':'code_absent_from_official_snapshot';}
 const nameHits=byName.get(norm(e.name))||[], parentCode=officialParentCode(e), parentHits=nameHits.filter(h=>parentCompatible(h,parentCode));
 if(!keys.length&&parentCode&&parentHits.length===1){const h=parentHits[0];matches.push({id:e.id,name:e.name,cuatm_key:null,legal_id:h.code,legal_name:h.name,legal_type:h.legal_type,legal_parent_id:h.parent_code,legal_parent_name:h.parent_name,legal_source:'BNS CUATM',match_method:'exact_normalized_name_and_official_parent',confidence:'medium',unmatched_reason:null});continue;}
 if(!keys.length&&nameHits.length===1&&!parentCode)reason='unique_name_but_parent_unverified';
 else if(!keys.length&&nameHits.length>1)reason=parentCode?'name_ambiguous_with_parent':'name_ambiguous';
 else if(!keys.length&&nameHits.length===0)reason='name_absent_from_official_snapshot';
 matches.push({id:e.id,name:e.name,cuatm_key:keys[0]||null,legal_id:null,legal_name:null,legal_type:null,legal_source:'BNS CUATM',match_method:null,confidence:null,unmatched_reason:reason,name_candidate_count:nameHits.length,parent_official_code:parentCode});
}
const matched=matches.filter(x=>x.legal_id), unmatched=matches.filter(x=>!x.legal_id);
const matchById=new Map(matches.map(x=>[x.id,x]));
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
const mismatchMatrix=new Map();
for(const d of noKeyDiagnostics.filter(x=>x.diagnostic_category==='child_name_match_parent_mismatch')){
 const parentMatch=d.osm_parent_id?matchById.get(d.osm_parent_id):null;
 const osmParentType=parentMatch?.legal_type||'unknown';
 for(const cand of d.official_name_candidates){
  const officialParent=(byCode.get(cand.parent_code)||[])[0]||null;
  const officialParentType=officialParent?.legal_type||'unknown';
  const key=osmParentType+'|'+officialParentType;
  if(!mismatchMatrix.has(key))mismatchMatrix.set(key,{verified_osm_parent_legal_type:osmParentType,candidate_official_parent_legal_type:officialParentType,count:0,examples:[]});
  const cell=mismatchMatrix.get(key); cell.count++;
  if(cell.examples.length<8)cell.examples.push({child_name:d.name,osm_parent_name:d.osm_parent_name,verified_osm_parent_legal_id:d.verified_osm_parent_legal_id,verified_osm_parent_legal_name:d.verified_osm_parent_legal_name,candidate_legal_id:cand.legal_id,candidate_legal_name:cand.legal_name,candidate_parent_code:cand.parent_code,candidate_parent_name:cand.parent_name});
 }
}
const mismatchRows=[...mismatchMatrix.values()].sort((a,b)=>b.count-a.count);
await writeFile('data/current/md-cuatm-parent-mismatch-matrix.json',JSON.stringify({generated_at:new Date().toISOString(),jurisdiction:'MD',mismatch_entity_count:noKeyDiagnostics.filter(x=>x.diagnostic_category==='child_name_match_parent_mismatch').length,matrix_candidate_pair_count:mismatchRows.reduce((n,x)=>n+x.count,0),matrix:mismatchRows},null,2)+'\\n');
await writeFile('data/current/md-cuatm-pair-diagnostics.json',JSON.stringify({generated_at:new Date().toISOString(),jurisdiction:'MD',entity_count:noKeyDiagnostics.length,by_category:diagnosticCounts,policy:'Diagnostic only. No legal fields are assigned from this file.',items:noKeyDiagnostics},null,2)+'\\n');
const reasons=unmatched.reduce((a,x)=>(a[x.unmatched_reason]=(a[x.unmatched_reason]||0)+1,a),{});
const methods=matched.reduce((a,x)=>(a[x.match_method]=(a[x.match_method]||0)+1,a),{});
const out={generated_at:new Date().toISOString(),jurisdiction:'MD',official_source:'BNS CUATM',official_source_url:URL,official_snapshot_records:official.record_count,official_parent_links:official.records.filter(r=>r.parent_code).length,entity_count:matches.length,matched_count:matched.length,unmatched_count:unmatched.length,matched_by_method:methods,unmatched_by_reason:reasons,policy:'Automatic legal assignment: unique exact CUATM key (high), or exact normalized name plus verified official parent when unique (medium). Fuzzy and name-only matches never auto-assign.',matches};
if(!matched.length)throw new Error('CUATM reconciliation produced zero verified matches');
await writeFile(OUTPUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({official_records:official.record_count,official_parent_links:official.records.filter(r=>r.parent_code).length,entities:matches.length,matched:matched.length,unmatched:unmatched.length,matched_by_method:methods,unmatched_by_reason:reasons,no_key_pair_diagnostics:diagnosticCounts,parent_mismatch_matrix:mismatchRows.map(x=>({verified_osm_parent_legal_type:x.verified_osm_parent_legal_type,candidate_official_parent_legal_type:x.candidate_official_parent_legal_type,count:x.count,examples:x.examples.slice(0,3)}))},null,2));
