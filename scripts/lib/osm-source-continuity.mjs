// Read-only, per-relation continuity gate for a freshly fetched OSM source candidate.
// No historical relation is silently copied into the new OSM snapshot.
const codes=['RO','MD'];
const selectedIds=(entry,code)=>{
  if(!entry||!Array.isArray(entry.selected_relation_ids))throw new Error('Missing OSM '+code+' selected_relation_ids');
  const ids=entry.selected_relation_ids.map(Number);
  if(ids.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==ids.length)throw new Error('Invalid or duplicate OSM '+code+' selected relation IDs');
  if(entry.selected_relation_count!==ids.length)throw new Error('OSM '+code+' selected relation count/IDs mismatch');
  return new Set(ids);
};
const relations=raw=>{
  if(!Array.isArray(raw?.elements))throw new Error('Missing OSM raw elements');
  const result=new Map();
  for(const element of raw.elements){
    if(element.type!=='relation')continue;
    const id=Number(element.id);
    if(!Number.isSafeInteger(id)||id<=0||result.has(id))throw new Error('Invalid or duplicate raw OSM relation');
    result.set(id,element);
  }
  return result;
};
const evidence=element=>element?{
  name:element.tags?.['name:ro']||element.tags?.name||null,
  boundary:element.tags?.boundary||null,
  admin_level:element.tags?.admin_level||null,
  place:element.tags?.place||null,
  version:element.version??null,
  timestamp:element.timestamp||null
}:null;
export function assessOsmSourceContinuityCountry({code,before,after,beforeRaw,afterRaw}){
  if(!codes.includes(code))throw new Error('Unknown OSM country '+code);
  if(before?.schema_version!==2||after?.schema_version!==2)throw new Error('Invalid OSM source manifest schema');
  const oldIds=selectedIds(before.countries?.[code],code);
  const newIds=selectedIds(after.countries?.[code],code);
  const oldRels=relations(beforeRaw);
  const newRels=relations(afterRaw);
  // Every selected ID must be backed by its own relation in the corresponding raw snapshot.
  for(const id of oldIds)if(!oldRels.has(id))throw new Error('Baseline OSM '+code+' selected relation has no raw provenance: '+id);
  for(const id of newIds)if(!newRels.has(id))throw new Error('Candidate OSM '+code+' selected relation has no raw provenance: '+id);
  const missing=[...oldIds].filter(id=>!newIds.has(id)).sort((a,b)=>a-b).map(id=>{
    const prior=oldRels.get(id),current=newRels.get(id);
    return {relation_id:id,entity_id:'osm-r'+id,osm_url:'https://www.openstreetmap.org/relation/'+id,
      cause_class:current?'present_in_raw_but_excluded_from_selected_scope':'missing_from_candidate_raw',
      previous:evidence(prior),candidate:evidence(current),
      authoritative_probe:(after.countries[code].continuity_relation_attempts||[])
        .filter(x=>Number(x.relation_id)===id)
        .map(x=>({status:x.status,http_status:x.http_status??null,started_at:x.started_at||null}))};
  });
  const added=[...newIds].filter(id=>!oldIds.has(id)).sort((a,b)=>a-b).map(id=>({
    relation_id:id,entity_id:'osm-r'+id,candidate:evidence(newRels.get(id))
  }));
  return {previous_selected_count:oldIds.size,candidate_selected_count:newIds.size,
    missing_count:missing.length,added_count:added.length,missing,added,
    recovered_by_api:after.countries[code].continuity_recovered_relation_ids||[],
    retired_by_api:after.countries[code].continuity_retired_relation_ids||[]};
}
export function summarizeOsmSourceContinuity({before,after,countries}){
  if(!countries?.RO||!countries?.MD)throw new Error('Missing per-country OSM continuity results');
  const missing_total=Object.values(countries).reduce((n,c)=>n+c.missing_count,0);
  const added_total=Object.values(countries).reduce((n,c)=>n+c.added_count,0);
  return {schema:'osm-source-per-id-continuity-v1',
    status:missing_total?'BLOCKED_UNADJUDICATED_OSM_RELATION_DRIFT':'PASS',
    baseline_snapshot_at:before.snapshot_at,candidate_snapshot_at:after.snapshot_at,
    countries,missing_total,added_total};
}
export function assessOsmSourceContinuity({before,after,beforeRaw,afterRaw}){
  const countries=Object.fromEntries(codes.map(code=>[code,assessOsmSourceContinuityCountry({
    code,before,after,beforeRaw:beforeRaw[code],afterRaw:afterRaw[code]})]));
  return summarizeOsmSourceContinuity({before,after,countries});
}


// Authoritative reconciliation must also inspect relations PRESENT in an Overpass
// reply but no longer matching the original scope, not just completely absent IDs.
export function previousScopedRelationsNeedingLiveVerification(previousRaw,currentRaw,matchesScope){
  if(typeof matchesScope!=='function')throw new Error('Missing OSM source scope classifier');
  const previous=relations(previousRaw),current=relations(currentRaw);
  const ids=[];
  for(const [id,relation] of previous){
    if(!matchesScope(relation))continue;
    const candidate=current.get(id);
    if(!candidate||!matchesScope(candidate))ids.push(id);
  }
  return ids.sort((a,b)=>a-b);
}
