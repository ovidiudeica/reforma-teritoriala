#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const rec=JSON.parse(await readFile('data/current/md-cuatm-reconciliation.json','utf8'));
const cat=JSON.parse(await readFile('data/current/entities.json','utf8'));
const entities=(cat.entities||[]).filter(e=>e.jurisdiction==='MD'), byEntity=new Map(entities.map(e=>[e.id,e]));
const matched=(rec.matches||[]).filter(x=>x.legal_id), byMatch=new Map(matched.map(x=>[x.id,x]));
const groups=new Map(); for(const m of matched){if(!groups.has(m.legal_id))groups.set(m.legal_id,[]);groups.get(m.legal_id).push(m);}
function classifyGroup([legal_id,xs]){
 const ids=new Set(xs.map(x=>x.id)), edges=[];
 for(const x of xs){const p=byEntity.get(x.id)?.parent_id||null;if(p&&ids.has(p))edges.push([x.id,p]);}
 const children=new Set(edges.map(e=>e[0])), parents=new Set(edges.map(e=>e[1]));
 const parallelPairs=[]; const byParent=new Map();
 for(const x of xs){const p=byEntity.get(x.id)?.parent_id||null;if(!byParent.has(p))byParent.set(p,[]);byParent.get(p).push(x.id);}
 for(const [p,a] of byParent)if(a.length>1)parallelPairs.push({osm_parent_id:p,items:a});
 let duplicate_class='mixed_parallel_and_chain_representations';
 if(edges.length===xs.length-1){
  const roots=xs.filter(x=>!children.has(x.id)); // nodes not children in same-id edges
  // connected undirected chain/tree with one external/root representation
  const adj=new Map(xs.map(x=>[x.id,new Set()]));
  for(const [a,b] of edges){adj.get(a).add(b);adj.get(b).add(a);}
  const seen=new Set(), stack=[xs[0].id];while(stack.length){const n=stack.pop();if(seen.has(n))continue;seen.add(n);for(const q of adj.get(n))stack.push(q);}
  if(seen.size===xs.length&&roots.length===1)duplicate_class='same_identity_parent_child_chain';
 }
 if(duplicate_class==='mixed_parallel_and_chain_representations'&&edges.length===0&&parallelPairs.length&&parallelPairs.reduce((n,p)=>n+p.items.length,0)===xs.length)duplicate_class='parallel_same_parent';
 return {legal_id,legal_name:xs[0].legal_name,count:xs.length,duplicate_class,same_identity_edges:edges.map(([child,parent])=>({child,parent})),parallel_sets:parallelPairs,items:xs.map(x=>({id:x.id,name:x.name,match_method:x.match_method,confidence:x.confidence,cuatm_key:x.cuatm_key,osm_parent_id:byEntity.get(x.id)?.parent_id||null}))};
}
const duplicateGroups=[...groups.entries()].filter(([,xs])=>xs.length>1).map(classifyGroup).sort((a,b)=>a.duplicate_class.localeCompare(b.duplicate_class)||a.legal_id.localeCompare(b.legal_id));
const dupByClass=duplicateGroups.reduce((a,g)=>(a[g.duplicate_class]=(a[g.duplicate_class]||0)+1,a),{});
function climbDistinctLegalParent(m){
 let cur=byEntity.get(m.id), seen=new Set([m.id]), path=[];
 while(cur?.parent_id&&!seen.has(cur.parent_id)){
  const pid=cur.parent_id;seen.add(pid);const pm=byMatch.get(pid)||null;path.push({id:pid,name:byEntity.get(pid)?.name||null,legal_id:pm?.legal_id||null});
  if(pm?.legal_id&&pm.legal_id!==m.legal_id)return {parent_match:pm,path};
  cur=byEntity.get(pid);
 }
 return {parent_match:null,path};
}
const identityChecks=[], identityIssues=[];
for(const m of matched){
 const r=climbDistinctLegalParent(m), actual=r.parent_match?.legal_id||null, expected=m.legal_parent_id||null;
 let result;
 if(expected) result=actual===expected?'consistent_identity_parent':actual?'identity_parent_mismatch':'identity_parent_not_resolved';
 else result=actual?'official_root_has_distinct_legal_parent':'consistent_root';
 const row={legal_id:m.legal_id,legal_name:m.legal_name,representative_osm_id:m.id,expected_legal_parent_id:expected,expected_legal_parent_name:m.legal_parent_name||null,resolved_distinct_parent_legal_id:actual,resolved_distinct_parent_name:r.parent_match?.legal_name||null,collapsed_same_identity_depth:r.path.filter(x=>x.legal_id===m.legal_id).length,path:r.path,result};
 identityChecks.push(row);if(result==='identity_parent_mismatch'||result==='identity_parent_not_resolved')identityIssues.push(row);
}
const byResult=identityChecks.reduce((a,x)=>(a[x.result]=(a[x.result]||0)+1,a),{});
const reviewedGeometryConflictIds=new Set(['0123','6432','9255','6453','8961','9639']);
const geometryHistoryReviewIds=new Set([]);
const uniqueIdentityIssues=[];
for(const [legal_id,xs] of groups){
 const rows=identityChecks.filter(x=>x.legal_id===legal_id);
 const bad=rows.filter(x=>x.result==='identity_parent_mismatch'||x.result==='identity_parent_not_resolved');
 if(!bad.length)continue;
 const first=bad[0], expected=first.expected_legal_parent_id, observed=[...new Set(bad.map(x=>x.resolved_distinct_parent_legal_id).filter(Boolean))];
 const chisinauSectorGap=['0110','0120','0130','0140','0150'].includes(expected)&&observed.length===1&&observed[0]==='0100';
 uniqueIdentityIssues.push({legal_id,legal_name:first.legal_name,expected_legal_parent_id:expected,expected_legal_parent_name:first.expected_legal_parent_name,observed_distinct_parent_legal_ids:observed,diagnostic_class:chisinauSectorGap?'chisinau_sector_geometry_gap':reviewedGeometryConflictIds.has(legal_id)?'verified_legal_parent_geometry_conflict':geometryHistoryReviewIds.has(legal_id)?'needs_geometry_history_review':'cross_legal_parent_conflict',representation_count:xs.length,affected_representations:bad.map(x=>x.representative_osm_id)});
}
const uniqueIssueByClass=uniqueIdentityIssues.reduce((a,x)=>(a[x.diagnostic_class]=(a[x.diagnostic_class]||0)+1,a),{});
const reviewedRepresentationClasses=new Map([
 ['1050','uat_and_component_locality_with_parallel_uat_boundary'],
 ['3417','component_locality_with_parallel_uat_boundaries_same_changeset'],
 ['7160','component_locality_with_parallel_uat_boundaries_same_changeset'],
 ['8034','parallel_boundaries_same_identity_same_changeset'],
 ['8341','later_duplicate_same_identity']
]);
for(const g of duplicateGroups){
 const reviewed=reviewedRepresentationClasses.get(g.legal_id);
 if(reviewed){g.structural_duplicate_class=g.duplicate_class;g.duplicate_class=reviewed;g.review_basis='OSM relation history audit';}
}
const reviewedRepresentationIds=new Set(reviewedRepresentationClasses.keys());
const reviewedDupByClass=duplicateGroups.reduce((a,g)=>(a[g.duplicate_class]=(a[g.duplicate_class]||0)+1,a),{});
const targetedDuplicateReview=duplicateGroups.filter(g=>reviewedRepresentationIds.has(g.legal_id));

const audit={generated_at:new Date().toISOString(),jurisdiction:'MD',scope:'CUATM matched entities; duplicate OSM representations collapsed logically by legal identity',matched_count:matched.length,policy:'Diagnostic only. No reconciliation, classification or source data are altered.',duplicate_identity_summary:{duplicate_legal_id_count:duplicateGroups.length,entities_in_duplicate_groups:duplicateGroups.reduce((n,g)=>n+g.count,0),by_class:reviewedDupByClass},legal_identity_parent_summary:byResult,unique_legal_identity_issue_summary:{count:uniqueIdentityIssues.length,by_class:uniqueIssueByClass},targeted_duplicate_review_summary:{count:targetedDuplicateReview.length,by_class:targetedDuplicateReview.reduce((a,g)=>(a[g.duplicate_class]=(a[g.duplicate_class]||0)+1,a),{})},duplicate_legal_ids:duplicateGroups,unique_legal_identity_issues:uniqueIdentityIssues,targeted_duplicate_review:targetedDuplicateReview,legal_identity_parent_issues_by_representation:identityIssues};
await mkdir('data/current',{recursive:true});await writeFile('data/current/md-cuatm-consistency-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({matched_count:matched.length,...audit.duplicate_identity_summary,legal_identity_parent_summary:byResult,unique_legal_identity_issue_summary:audit.unique_legal_identity_issue_summary,targeted_duplicate_review_summary:audit.targeted_duplicate_review_summary},null,2));
