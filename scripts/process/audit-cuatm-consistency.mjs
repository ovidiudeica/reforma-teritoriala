#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const rec=JSON.parse(await readFile('data/current/md-cuatm-reconciliation.json','utf8'));
const cat=JSON.parse(await readFile('data/current/entities.json','utf8'));
const entities=(cat.entities||[]).filter(e=>e.jurisdiction==='MD'), byEntity=new Map(entities.map(e=>[e.id,e]));
const matched=(rec.matches||[]).filter(x=>x.legal_id), byMatch=new Map(matched.map(x=>[x.id,x]));
const legalGroups=new Map();
for(const m of matched){if(!legalGroups.has(m.legal_id))legalGroups.set(m.legal_id,[]);legalGroups.get(m.legal_id).push(m);}
const duplicateLegalIds=[...legalGroups.entries()].filter(([,xs])=>xs.length>1).map(([legal_id,xs])=>({legal_id,count:xs.length,legal_name:xs[0].legal_name,items:xs.map(x=>({id:x.id,name:x.name,match_method:x.match_method,confidence:x.confidence,cuatm_key:x.cuatm_key,osm_parent_id:byEntity.get(x.id)?.parent_id||null}))})).sort((a,b)=>b.count-a.count||a.legal_id.localeCompare(b.legal_id));
const parentChecks=[], mismatches=[], missingMatchedParent=[];
for(const m of matched){
 const e=byEntity.get(m.id), osmParentId=e?.parent_id||null, pm=osmParentId?byMatch.get(osmParentId):null;
 const row={id:m.id,name:m.name,legal_id:m.legal_id,legal_name:m.legal_name,legal_parent_id:m.legal_parent_id||null,legal_parent_name:m.legal_parent_name||null,osm_parent_id:osmParentId,osm_parent_name:osmParentId?byEntity.get(osmParentId)?.name||null:null,osm_parent_legal_id:pm?.legal_id||null,osm_parent_legal_name:pm?.legal_name||null};
 if(m.legal_parent_id){
  row.result=!osmParentId?'missing_osm_parent':!pm?'osm_parent_not_cuatm_matched':pm.legal_id===m.legal_parent_id?'consistent':'parent_legal_id_mismatch';
  if(row.result!=='consistent'){mismatches.push(row);if(row.result==='osm_parent_not_cuatm_matched')missingMatchedParent.push(row);}
 }else row.result=osmParentId?(pm?'official_root_has_osm_parent_matched':'official_root_has_osm_parent_unmatched'):'consistent_root';
 parentChecks.push(row);
}
const byResult=parentChecks.reduce((a,x)=>(a[x.result]=(a[x.result]||0)+1,a),{});
const audit={generated_at:new Date().toISOString(),jurisdiction:'MD',scope:'CUATM matched entities only',matched_count:matched.length,policy:'Diagnostic only. This audit does not alter reconciliation, classification or source data.',duplicate_legal_id_summary:{duplicate_legal_id_count:duplicateLegalIds.length,entities_in_duplicate_groups:duplicateLegalIds.reduce((n,g)=>n+g.count,0)},parent_child_summary:byResult,duplicate_legal_ids:duplicateLegalIds,parent_child_issues:mismatches};
await mkdir('data/current',{recursive:true});await writeFile('data/current/md-cuatm-consistency-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({matched_count:matched.length,...audit.duplicate_legal_id_summary,parent_child_summary:byResult,parent_child_issue_count:mismatches.length},null,2));
