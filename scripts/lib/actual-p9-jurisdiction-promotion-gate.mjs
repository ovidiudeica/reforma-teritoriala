// P9.0.4.3: fail-closed ACTUAL candidate / promotion / protected PR gate.
// No network, no writes, no clock, no implicit de facto sovereignty.
const MARKER=/(?:nistren|transnistr|transdniestr|приднестр|(?:^|[^a-z])pmr(?:[^a-z]|$)|de[_ -]?facto|osm-r65335|(?:^|\D)65335(?:\D|$))/i;
const P9_PATH=/(?:^|\/)(?:nistren|transnistr|pmr|p9(?:\.|\/|-)|de[-_]facto)/i;
const SAME_ID_KEYS=['jurisdiction','category','legal','hierarchy','roles','representation'];
const restrictedPaths=[
 /^data\/current\//,
 /^data\/sources\//,
 /^public\/data\/actual-/,
 /^public\/geo\/(?:actual|current)\//
];
const guardedEntityFields=['name','display_name','searchable_names','legal','hierarchy','representation','roles','jurisdiction','category','status','de_facto','administrative_memberships'];
export function isActualPublicationPath(path){
 return restrictedPaths.some(r=>r.test(path));
}
export function readEntityArray(doc){
 return Array.isArray(doc?.entities)?doc.entities:Array.isArray(doc)?doc:null;
}
function fingerprint(value){return JSON.stringify(value??null);}
function protectedChanges(before,after){
 const old=new Map(before.map(x=>[x.id,x]));
 const hits=[];
 for(const item of after){
  const preceding=old.get(item.id);
  if(!preceding){
   if(MARKER.test(fingerprint(item)))hits.push({issue:'new_p9_entity',id:item.id});
   if(item.jurisdiction&&!['RO','MD'].includes(item.jurisdiction))hits.push({issue:'new_jurisdiction_code',id:item.id});
   continue;
  }
  if(preceding.jurisdiction!==item.jurisdiction)hits.push({issue:'jurisdiction_reassignment',id:item.id});
  // Any new jurisdiction semantics in an existing entity requires separate policy review,
  // even when the visible entity ID or legal code does not change.
  const changeKeys=new Set([...Object.keys(preceding),...Object.keys(item)]);
  for(const key of changeKeys){
   if(fingerprint(preceding[key])===fingerprint(item[key]))continue;
   if(MARKER.test(key)||(!Object.hasOwn(preceding,key)&&MARKER.test(fingerprint(item[key])))){
    hits.push({issue:'new_p9_semantic_role',id:item.id,key});
   } else if(guardedEntityFields.includes(key) && MARKER.test(fingerprint(item[key])) &&
       !MARKER.test(fingerprint(preceding[key]))){
    hits.push({issue:'p9_semantic_value_change',id:item.id,key});
   }
  }
 }
 return hits;
}
export function evaluateP9JurisdictionGate({
 policy,baseCatalog,candidateCatalog,changedPaths,addedLines=[],knownSensitiveIds=[]
}){
 const failures=[],reasons=[];
 const require=(pass,issue)=>{if(!pass)failures.push({issue});};
 require(policy?.schema_version==='actual-p9-jurisdiction-promotion-policy-v1','policy_schema_mismatch');
 require(policy?.status==='BLOCKED_PENDING_CONTEMPORARY_EVIDENCE','policy_requires_reviewed_gate_change');
 require(policy?.p91_import_allowed===false,'policy_must_deny_import');
 require(policy?.semantic_acceptance==='BLOCKED_INCOMPLETE','policy_semantic_acceptance_must_be_blocked');
 require(policy?.candidate_count===85&&policy?.fully_certified_contemporary_memberships===0,'contemporary_coverage_not_complete');
 require(policy?.require_non_geometric_parent_evidence===true&&policy?.require_exact_osm_snapshot_alignment===true&&
  policy?.require_explicit_production_gate===true&&policy?.never_modify_md_legal_parent_from_de_facto===true,
  'policy_lacks_mandatory_controls');
 const old=readEntityArray(baseCatalog),next=readEntityArray(candidateCatalog);
 require(Array.isArray(old)&&Array.isArray(next),'catalog_schema_missing');
 const paths=Array.isArray(changedPaths)?changedPaths:[];
 const additions=Array.isArray(addedLines)?addedLines:[];
 for(const p of paths){
  if(!isActualPublicationPath(p))continue;
  if(P9_PATH.test(p))reasons.push({issue:'new_p9_publication_path',path:p});
 }
 for(const item of additions){
  if(!isActualPublicationPath(item.path))continue;
  if(MARKER.test(item.text))reasons.push({issue:'p9_diff_addition',path:item.path});
 }
 if(old&&next){
  const oldIds=new Set(old.map(x=>x.id)),newIds=new Set(next.map(x=>x.id));
  require(oldIds.size===old.length&&newIds.size===next.length,'duplicate_catalog_ID');
  for(const id of oldIds)if(!newIds.has(id)&&knownSensitiveIds.includes(id))reasons.push({issue:'sensitive_md_entity_removed',id});
  reasons.push(...protectedChanges(old,next));
  const oldById=new Map(old.map(x=>[x.id,x]));
  for(const id of knownSensitiveIds){
   const a=oldById.get(id),b=next.find(x=>x.id===id);
   if(!a||!b)continue;
   if(fingerprint(a.legal)!==fingerprint(b.legal))reasons.push({issue:'sensitive_md_legal_identity_drift',id});
   if(fingerprint(a.hierarchy?.legal_parent_id)!==fingerprint(b.hierarchy?.legal_parent_id) ||
      fingerprint(a.hierarchy?.parent_catalog_id)!==fingerprint(b.hierarchy?.parent_catalog_id)){
    reasons.push({issue:'sensitive_md_parent_drift',id});
   }
  }
 }
 return {status:failures.length||reasons.length?'FAIL':'PASS',
  policy_status:policy?.status??null,p91_import_allowed:false,
  p9_change_detected:reasons.length>0,policy_failures:failures,
  prohibited_changes:reasons,checked_changed_paths:paths.length,
  protected_existing_entities:knownSensitiveIds.length,
  gate_scope:'ACTUAL publication delta plus 85 pinned MD legal/geometric candidate identities; no P9.1 overlay until explicit reviewed policy and evidence change'};
}
export function parseAddedGitDiff(diff){
 let path=null;
 const rows=[];
 for(const line of String(diff).split(/\r?\n/)){
  if(line.startsWith('+++ b/')){path=line.slice(6);continue;}
  if(line.startsWith('+++ /dev/null')){path=null;continue;}
  if(line.startsWith('+')&&!line.startsWith('+++')&&path)rows.push({path,text:line.slice(1)});
 }
 return rows;
}
