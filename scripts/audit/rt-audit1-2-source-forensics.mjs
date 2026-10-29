#!/usr/bin/env node
// RT-AUDIT.1.2: independent read-only OSM source, CUATM and statistical forensics.
// Outputs are derived; never changes ACTUAL, source snapshots, topological fragments or tree.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),output='outputs/RT-AUDIT.1.2/';
const read=async p=>readFile(new URL(p,root));
const json=async p=>JSON.parse(await read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=s=>{throw Error('RT-AUDIT.1.2: '+s)};
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const histPath='data/sources/md-osm-multiple-representation-history.json';
const sourcePath='data/current/actual-source-bundle-manifest.json';
const reconPath='data/current/md-cuatm-reconciliation.json';
const officialPath='data/sources/cuatm-current.json';
const reviewPath='data/sources/md-cuatm-individual-review.json';
const policyPath='data/sources/actual-statistical-policy.json';
const statPath='data/sources/md-nuts-2017.json';
const geoPath='outputs/RT-AUDIT.1/overlap-254-per-id.json';
const equalPath='outputs/RT-AUDIT.1/semantic-equalities-3.json';
const [geo,equal,summary,sourceBundle,reconciliation,official,review,policy,stat,hist]=await Promise.all([
 json(geoPath),json(equalPath),json('outputs/RT-AUDIT.1/overlap-investigation-summary.json'),
 json(sourcePath),json(reconPath),json(officialPath),json(reviewPath),json(policyPath),json(statPath),json(histPath)
]);
if(geo.length!==254||equal.length!==3||summary.counts.computed_overlaps!==254||summary.baseline.snapshot_id!=='actual-a9e5a4ddcb5277ef')fail('baseline counts/snapshot drift');
if(reconciliation.entity_count!==2596||reconciliation.official_snapshot_records!==1721||reconciliation.jurisdiction!=='MD')fail('official reconciliation mismatch');
if(official.record_count!==1721||official.records.length!==1721)fail('CUATM snapshot mismatch');
if(hist.history_count!==21||hist.error_count!==0)fail('archived history contract mismatch');
if(stat.unit_count!==9||stat.level_counts['3']!==6)fail('statistical nomenclature mismatch');
const md=sourceBundle.sources?.osm?.countries?.MD;
if(md?.element_count!==560474||md?.relation_count!==2596||md.snapshot_at!=='2026-10-05T23:50:05.218Z')fail('MD snapshot manifest mismatch');
const compressed=await read(md.snapshot_path);
if(sha(compressed)!==md.compressed_sha256)fail('MD raw compressed SHA mismatch');
const uncompressed=gunzipSync(compressed);
if(sha(uncompressed)!==md.semantic_sha256)fail('MD raw uncompressed SHA mismatch');
const raw=JSON.parse(uncompressed);
if(!Array.isArray(raw.elements)||raw.elements.length!==md.element_count)fail('MD source element count mismatch');
const relations=new Map(),ways=new Map();
for(const element of raw.elements){
 if(element.type==='relation')relations.set(element.id,element);
 else if(element.type==='way')ways.set(element.id,element);
}
const matches=new Map((reconciliation.matches||[]).map(x=>[x.id,x]));
const officialById=new Map(official.records.map(x=>[x.code,x]));
const historyById=new Map();
for(const group of hist.groups||[])for(const rel of group.relations||[])
 if(rel?.relation_id)historyById.set(rel.relation_id,{group_legal_id:group.legal_id,source:histPath,first_seen:rel.created_at,last_recorded:rel.last_modified_at,version:rel.current_version,number_of_archived_versions:rel.versions?.length??null,archived_change_events:(rel.versions||[]).filter(v=>v.members?.added?.length||v.members?.removed?.length).length});
const reviews=new Map((review.cases||[]).map(x=>[x.osm_id,x]));
const idNum=id=>/^osm-r[0-9]+$/.test(id)?Number(id.slice(5)):null;
const relationRow=(id)=>{
 const n=idNum(id);if(n===null)return null;
 const e=relations.get(n);
 if(!e)return null;
 const all=e.members||[];
 const w=all.filter(m=>m.type==='way'),refs=new Set(w.map(m=>m.ref));
 const directNodes=new Set(w.flatMap(m=>ways.get(m.ref)?.nodes||[]));
 return {id:n,version:e.version??null,changeset:e.changeset??null,timestamp:e.timestamp??null,visible:e.visible??true,
   tags:{admin_level:e.tags?.admin_level??null,boundary:e.tags?.boundary??null,place:e.tags?.place??null,name:e.tags?.['name:ro']??e.tags?.name??null,
     official_name:e.tags?.official_name??null,ref_cuatm:e.tags?.['ref:cuatm:codunic']??e.tags?.['ref:cuatm']??null},
   member_count:all.length,way_member_count:w.length,unique_way_count:refs.size,
   outer_way_count:w.filter(m=>(m.role||'')==='outer').length,
   inner_way_count:w.filter(m=>(m.role||'')==='inner').length,
   non_way_member_count:all.length-w.length,unresolved_way_refs:[...refs].filter(x=>!ways.has(x)).sort((a,b)=>a-b),
   node_refs_count:directNodes.size,
   way_refs:[...refs].sort((a,b)=>a-b),node_refs:[...directNodes].sort((a,b)=>a-b)};
};
const relationRecord=id=>{
 const r=relationRow(id);
 if(r===null)return {available:false,reason:idNum(id)===null?'STATISTICAL_ID_NOT_OSM_RELATION':'MD_RAW_RELATION_MISSING'};
 const {way_refs,node_refs,...meta}=r;
 return {available:true,metadata:meta,way_refs,node_refs};
};
const officialBinding=id=>{
 const m=matches.get(id);
 if(!m)return {status:'NOT_IN_MD_CUATM_RECONCILIATION',id};
 const record=officialById.get(m.legal_id);
 return {status:m.legal_id?'MATCHED_CUATM':'NONMATCHED_OR_NONCUATM',
  legal_id:m.legal_id??null,legal_name:m.legal_name??null,legal_parent_id:m.legal_parent_id??null,
  match_method:m.match_method??null,confidence:m.confidence??null,
  unmapped_reason:m.unmatched_reason??null,
  official_row_present:!!record,official_parent_id:record?.parent_code??null,
  official_status_code:record?.status_code??null,
  official_snapshot:officialPath,reconciliation_source:reconPath};
};
const sortedOverlap=(a,b)=>[...a].filter(x=>b.has(x)).sort((x,y)=>x-y);
const compactRaw=(r)=>{
 if(!r.available)return r;
 const {node_refs,way_refs,...fields}=r;
 return {...fields,way_refs_sha256:sha(Buffer.from(JSON.stringify(way_refs))),node_refs_sha256:sha(Buffer.from(JSON.stringify(node_refs)))};
};
const memberComparison=(a,b)=>{
 if(!a.available||!b.available)return {status:'SOURCE_MEMBERS_NOT_COMPARABLE',reason:!a.available?a.reason:b.reason};
 const aw=new Set(a.way_refs),bw=new Set(b.way_refs);
 const an=new Set(a.node_refs),bn=new Set(b.node_refs);
 const commonWays=sortedOverlap(aw,bw),commonNodes=sortedOverlap(an,bn);
 const onlyChild=[...aw].filter(x=>!bw.has(x)).sort((x,y)=>x-y);
 const onlyParent=[...bw].filter(x=>!aw.has(x)).sort((x,y)=>x-y);
 return {status:onlyChild.length||onlyParent.length?'DISTINCT_SOURCE_WAY_MEMBER_SETS':'SAME_SOURCE_WAY_MEMBER_SETS',
  child_way_count:aw.size,parent_way_count:bw.size,
  shared_way_count:commonWays.length,child_only_way_count:onlyChild.length,parent_only_way_count:onlyParent.length,
  same_way_set:onlyChild.length===0&&onlyParent.length===0,
  child_way_subset_of_parent:onlyChild.length===0,shared_node_count:commonNodes.length,
  common_way_refs:commonWays,child_only_way_refs:onlyChild,parent_only_way_refs:onlyParent,
  common_way_refs_sha256:sha(Buffer.from(JSON.stringify(commonWays))),
  child_only_way_refs_sha256:sha(Buffer.from(JSON.stringify(onlyChild))),
  parent_only_way_refs_sha256:sha(Buffer.from(JSON.stringify(onlyParent)))};
};
const legalRelation=(child,parent)=>{
 if(!child.legal_id||!parent.legal_id)return 'LEGAL_LINK_NOT_CERTIFIABLE_FROM_RECONCILIATION';
 if(child.legal_id===parent.legal_id)return 'BOTH_OSM_RELATIONS_MATCH_SAME_CUATM_CODE';
 if(child.official_parent_id===parent.legal_id)return 'DISTINCT_CUATM_CODES_WITH_OFFICIAL_DIRECT_PARENT';
 if(child.official_parent_id!==parent.legal_id)return 'CURRENT_TREE_PARENT_DIFFERS_FROM_OFFICIAL_CUATM_PARENT';
 return 'UNRESOLVED';
};
const evidences=[],reject=[],legalStatusCounts=new Map(),sourceCounts=new Map(),precisionCounts=new Map(),historicalEvidenceCounts=new Map();
const bump=(m,k)=>m.set(k,(m.get(k)||0)+1);
for(const pair of geo){
 const c=relationRecord(pair.child_id),p=relationRecord(pair.parent_id);
 const source=memberComparison(c,p);
 const childLegal=officialBinding(pair.child_id),parentLegal=officialBinding(pair.parent_id);
 const legal=legalRelation(childLegal,parentLegal);
 const rawChild=c.available?c.metadata:null,rawParent=p.available?p.metadata:null;
 const cHistory=historyById.get(rawChild?.id),pHistory=historyById.get(rawParent?.id);
 const caseReview=reviews.get(pair.child_id)||reviews.get(pair.parent_id)||null;
 const numericTol=pair.numeric_tolerance_m2;
 const residual=pair.child_outside_parent_m2;
 const precision=residual<=numericTol?'AREA_WITHIN_COMPUTATION_TOLERANCE':residual<=1?'SUB_ONE_SQUARE_METRE_ABOVE_TOLERANCE':'AREA_ABOVE_ONE_SQUARE_METRE';
 const historical=(cHistory||pHistory)?'ARCHIVED_RELATION_HISTORY_AVAILABLE':'ARCHIVED_RELATION_HISTORY_NOT_AVAILABLE';
 const provenMechanism=source.status==='DISTINCT_SOURCE_WAY_MEMBER_SETS'
  ?'DIFFERENT_OSM_WAY_MEMBERS_AT_FROZEN_SNAPSHOT'
  :source.status==='SAME_SOURCE_WAY_MEMBER_SETS'?'SAME_OSM_WAY_MEMBERS_AT_FROZEN_SNAPSHOT'
  :'RELATION_MEMBERSHIP_NOT_COMPARABLE';
 const possible=precision==='AREA_WITHIN_COMPUTATION_TOLERANCE'
  ?'NUMERICAL_TOLERANCE_REVIEW'
  :pair.hierarchy_boundary_context==='ADMINISTRATIVE_CHILD_VS_STATISTICAL_PARENT'
    ?'STATISTICAL_VS_ADMINISTRATIVE_FOOTPRINT'
    :legal==='BOTH_OSM_RELATIONS_MATCH_SAME_CUATM_CODE'
      ?'COINCIDENT_CUATM_ID_DIFFERENT_OSM_LEVEL_GEOMETRIES'
      :legal==='DISTINCT_CUATM_CODES_WITH_OFFICIAL_DIRECT_PARENT'
        ?'LEGAL_PARENTAGE_CONFIRMED_BUT_OSM_BOUNDARIES_NOT_CONTAINED'
        :legal==='CURRENT_TREE_PARENT_DIFFERS_FROM_OFFICIAL_CUATM_PARENT'
          ?'CUATM_TREE_PARENT_REVIEW_REQUIRED'
          :'OSM_TOPOLOGY_WITHOUT_OFFICIAL_CAUSE_EVIDENCE';
 const evidenceStatus='SOURCE_STRUCTURE_CONFIRMED_HISTORICAL_CAUSE_NOT_PROVEN';
 const item={child_id:pair.child_id,parent_id:pair.parent_id,
  child_name:pair.child_name,parent_name:pair.parent_name,
  overlap_area_m2:pair.intersection_area_m2,child_outside_parent_m2:residual,
  child_outside_parent_percent:pair.percent_child_outside_parent,
  numeric_tolerance_m2:numericTol,precision_class:precision,
  topology_relation:pair.geometry_relation,observed_pattern:pair.observed_pattern,
  raw_osm_source:{snapshot_at:md.snapshot_at,compressed_sha256:md.compressed_sha256,semantic_sha256:md.semantic_sha256,
    child:compactRaw(c),parent:compactRaw(p)},
  way_membership:source,source_mechanism:provenMechanism,
  official_cuatm:{child:childLegal,parent:parentLegal,relationship:legal},
  current_recorded_history:{status:historical,child:cHistory||null,parent:pHistory||null,source_sha256:sha(await read(histPath))},
  review_evidence:caseReview?{source:reviewPath,review_status:caseReview.review_status,finding:caseReview.finding,
    positive_identity_certified:caseReview.review_status==='resolved_positive_identity',geometry_equivalence_asserted:caseReview.geometry_equivalence_asserted===true}:null,
  review_priority:precision==='AREA_WITHIN_COMPUTATION_TOLERANCE'?'PRECISION_FIRST'
    :legal==='CURRENT_TREE_PARENT_DIFFERS_FROM_OFFICIAL_CUATM_PARENT'?'HIGH_LEGAL_HIERARCHY'
    :pair.child_outside_parent_m2>=100000?'HIGH_GEOMETRIC_AREA'
    :pair.child_outside_parent_m2>=10000?'MEDIUM_GEOMETRIC_AREA':'STANDARD',
  candidate_explanation:possible,causal_certification:evidenceStatus,
  legal_geometric_equivalence_certified:false,
  corrective_action:'NONE_AUTOMATIC',
  needed_evidence:precision==='AREA_WITHIN_COMPUTATION_TOLERANCE'
    ?['Independent high-precision comparison or exact source segment test; numeric residual not a certified territory loss']
    :['Trace differing source way/node versions to timestamped edit history','Validate legally authoritative geometry against an official boundary source','Review CUATM legal assignment separately from OSM geometric footprint']};
 evidences.push(item);
 bump(legalStatusCounts,legal);bump(sourceCounts,source.status);bump(precisionCounts,precision);bump(historicalEvidenceCounts,historical);
 if(source.status==='SOURCE_MEMBERS_NOT_COMPARABLE'&&pair.hierarchy_boundary_context!=='ADMINISTRATIVE_CHILD_VS_STATISTICAL_PARENT')reject.push({id:pair.child_id,problem:'unexpected missing administrative raw relation',source});
}
if(evidences.length!==254)fail('Not all overlap cases processed');
const equality=[];
for(const x of equal){
 const c=relationRecord(x.child_id),p=relationRecord(x.parent_id),source=memberComparison(c,p);
 const childBinding=officialBinding(x.child_id),parentBinding=officialBinding(x.parent_id);
 let verdict,authority=null,remaining=[];
 if(x.child_id==='stat-MD120'&&x.parent_id==='stat-MD12'){
  const unit=stat.units.find(u=>u.code==='MD120'),level2=stat.units.find(u=>u.code==='MD12');
  const siblings=stat.units.filter(u=>u.parent_code==='MD12');
  if(!unit||!level2||unit.parent_code!=='MD12'||siblings.length!==1||siblings[0].code!=='MD120')fail('official MD120 lineage not established');
  if(policy.jurisdictions?.MD?.special_rules?.MD120?.official_code!=='MD120')fail('MD120 policy missing');
  verdict='DOCUMENTED_STATISTICAL_PARENT_SINGLE_CHILD_COEXTENSIVE';authority={path:statPath,source_url:stat.source?.url,
    official_parent_code:level2.code,official_child_code:unit.code,number_of_level3_children:siblings.length,
    osm_ref_conflict:policy.jurisdictions.MD.special_rules.MD120.osm_conflicting_ref};
  remaining=['No legal geometry equivalence claimed; OSM ref conflict must be maintained as provenance'];
 }else{
  const sameCode=childBinding.legal_id&&childBinding.legal_id===parentBinding.legal_id;
  verdict=sameCode?'TWO_OSM_REPRESENTATIONS_MATCH_SAME_CUATM_CODE':'EQUAL_GEOMETRY_DISTINCT_OSM_RELATIONS_LEGAL_LINK_PENDING';
  authority={path:reconPath,child:childBinding,parent:parentBinding,exact_same_legal_id:Boolean(sameCode)};
  remaining=['OSM relation history for both IDs, way membership and edit changesets','Positive interpretation of administrative-level 8 vs locality-level 9; no deduplication on geometric equality'];
 }
 equality.push({child_id:x.child_id,parent_id:x.parent_id,child_name:x.child?.name??null,
  parent_name:x.parent?.name??null,area_km2:x.measured?.child_area_km2??null,
  source_member_comparison:source,child_osm_source:compactRaw(c),parent_osm_source:compactRaw(p),
  official_evidence:authority,semantic_verdict:verdict,remaining_evidence:remaining,
  geometry_relation:'equal',administrative_geometry_equivalence_certified:false,automatic_merge_allowed:false});
}
if(equality.length!==3||new Set(equality.map(x=>x.child_id)).size!==3)fail('equal relations count mismatch');
const obj=m=>Object.fromEntries([...m].sort(([a],[b])=>cmp(a,b)));
const summaryOut={
 contract:'rt-audit1-2-frozen-osm-cuatm-source-forensics-v1',status:reject.length?'PARTIAL':'SOURCE_COMPARISON_COMPLETE_CAUSES_NOT_ALL_CERTIFIED',
 snapshot:md.snapshot_at,source_manifest_sha256:sha(await read(sourcePath)),source_snapshot_sha256:md.compressed_sha256,
 source_snapshot_semantic_sha256:md.semantic_sha256,
 input_evidence_sha256:{geometry:sha(await read(geoPath)),equalities:sha(await read(equalPath)),
  cuatm:sha(await read(officialPath)),reconciliation:sha(await read(reconPath)),history:sha(await read(histPath)),
  statistical:sha(await read(statPath)),statistical_policy:sha(await read(policyPath))},
 cases:254,equalities:3,failed_source_case_count:reject.length,
 by_source_membership:obj(sourceCounts),by_legal_hierarchy:obj(legalStatusCounts),
 by_precision:obj(precisionCounts),by_archived_history_coverage:obj(historicalEvidenceCounts),
 legal_certification_not_automatic:true,geometry_mutated:false,hierarchy_mutated:false,
 limitation:'Source way/member differences and CUATM reconciled identity prove observable evidence only. Causal historic boundary-edit attribution or official legal-border equivalence requires corresponding dated primary evidence.',
 reject};
const unresolved=evidences.filter(x=>x.causal_certification!=='HISTORICAL_CAUSE_CERTIFIED').map(x=>({
 child_id:x.child_id,parent_id:x.parent_id,case_priority:x.review_priority,
 candidate_explanation:x.candidate_explanation,required_evidence:x.needed_evidence,
 why_unresolved:x.precision_class==='AREA_WITHIN_COMPUTATION_TOLERANCE'
  ?'Sub numeric area tolerance; no verified material territorial difference'
  :'Frozen snapshot demonstrates relationship but not why OSM boundaries diverged'}));
await mkdir(new URL(output,root),{recursive:true});
const deliver={
 'forensics-254-per-id.json':evidences,
 'semantics-3-equalities.json':equality,
 'cause-investigation-summary.json':summaryOut,
 'unresolved-causal-queue.json':unresolved,
 'source-validation-exceptions.json':reject};
const digestRows=[];
for(const [name,objValue] of Object.entries(deliver)){
 const bytes=Buffer.from(JSON.stringify(objValue,null,2)+'\n');
 await writeFile(new URL(output+name,root),bytes);
 digestRows.push(sha(bytes)+'  '+name);
}
const headers=['child_id','parent_id','child_name','parent_name','child_outside_parent_m2','precision_class','source_mechanism','cuatm_relationship','candidate_explanation','review_priority','causal_certification'];
const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv=[headers.join(','),...evidences.map(r=>headers.map(k=>escape(k==='cuatm_relationship'?r.official_cuatm.relationship:r[k])).join(','))].join('\n')+'\n';
await writeFile(new URL(output+'forensics-254-per-id.csv',root),csv);
digestRows.push(sha(Buffer.from(csv))+'  forensics-254-per-id.csv');
await writeFile(new URL(output+'checksums.sha256',root),digestRows.join('\n')+'\n');
const mdLines=[
 '# RT-AUDIT.1.2 — verificare probatorie părinte–copil',
 '',
 'Snapshot OSM: '+md.snapshot_at+', hash comprimat SHA256 '+md.compressed_sha256+'.',
 'Suprapuneri verificate: 254. Egalități: 3.',
 'Membri OSM: '+JSON.stringify(summaryOut.by_source_membership),
 'Apartenență CUATM: '+JSON.stringify(summaryOut.by_legal_hierarchy),
 'Precizie: '+JSON.stringify(summaryOut.by_precision),
 'Istoric OSM arhivat: '+JSON.stringify(summaryOut.by_archived_history_coverage),
 'Cauzele istorice specifice nu sunt certificate fără versiunile way/node datate la momentul modificărilor.',
 'Recomandarea rămâne NONE_AUTOMATIC pentru toate cazurile. Nicio schimbare în ACTUAL.'
];
await writeFile(new URL(output+'rt-audit1-2-report.md',root),mdLines.join('\n\n')+'\n');
console.log(JSON.stringify(summaryOut));
if(reject.length)process.exitCode=1;
