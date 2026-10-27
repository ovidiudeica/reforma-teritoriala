// Official per-ID evidence interpretation only. No source admission, repair or upload.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mergeOsmElements,osmElementIndex} from './osm-element-index.mjs';
import {auditOsmClosure} from './osm-closure-audit.mjs';
import {relationGeometry} from './osm-fix4-preflight.mjs';
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
export const sha=x=>createHash('sha256').update(Buffer.isBuffer(x)||typeof x==='string'?x:JSON.stringify(stable(x))).digest('hex');
export const equal=(a,b)=>a===b||(a!==undefined&&b!==undefined&&sha(a)===sha(b));
export function indexRows(rows){
 assert(Array.isArray(rows));const index=new Map();
 for(const r of rows){assert.match(r.path,/^(relation|way|node)\/[1-9][0-9]*(\/(history|full|ways|relations))?\.json$|^changeset\/164736346\.json\?include_discussion=true$/);assert.equal(r.url,'https://api.openstreetmap.org/api/0.6/'+r.path);assert.match(r.raw_sha256,/^[a-f0-9]{64}$/);assert(Number.isFinite(Date.parse(r.accessed_at)));assert(Number.isSafeInteger(r.bytes)&&r.bytes>=0);assert(Array.isArray(r.elements));
  for(const e of r.elements){assert(['node','way','relation'].includes(e.type)&&Number.isSafeInteger(e.id)&&e.id>0);assert(Number.isSafeInteger(e.version)&&e.version>0&&Number.isSafeInteger(e.changeset)&&e.changeset>0);assert(Number.isFinite(Date.parse(e.timestamp))&&Date.parse(e.timestamp)<=Date.parse(r.accessed_at),'Invalid/future object timestamp');}
  const prior=index.get(r.path);if(prior?.http_status===200&&r.http_status===200)assert(equal(prior.elements,r.elements),'Conflicting repeated successful observation');index.set(r.path,r);
 }return index;
}
const requireRow=(index,path,status=200)=>{const r=index.get(path);assert(r&&!r.error&&r.http_status===status,'Incomplete official evidence '+path);return r;};
export function assessReuse(previous,rows){
 const current=indexRows(rows),changed=[],proof=[];const fullIndex=new Map(),oldIndex=new Map();
 for(const r of previous)if(r.path.endsWith('/full.json'))mergeOsmElements(oldIndex,r.elements);
 for(const r of previous){const n=requireRow(current,r.path);if(!equal(r.elements,n.elements))changed.push(r.path);proof.push({path:r.path,previous_elements_sha256:sha(r.elements),current_elements_sha256:sha(n.elements),identical:equal(r.elements,n.elements)});if(r.path.endsWith('/full.json'))mergeOsmElements(fullIndex,n.elements);}
 for(const e of fullIndex.values()){const old=oldIndex.get(`${e.type}/${e.id}`);if(old?.version===e.version)for(const k of ['timestamp','changeset','tags','nodes','members','lat','lon'])if(Object.hasOwn(old,k)&&Object.hasOwn(e,k))assert(equal(old[k],e[k]),'Immutable OSM version changed payload '+e.type+'/'+e.id+'/'+k);}
 for(const p of proof){const r=current.get(p.path);for(const e of r.elements){assert.notEqual(e.visible,false);const f=fullIndex.get(`${e.type}/${e.id}`);if(f)for(const k of ['version','timestamp','changeset','tags','nodes','members','lat','lon'])if(Object.hasOwn(f,k)&&Object.hasOwn(e,k))assert(equal(f[k],e[k]),'Contradictory current views for '+e.type+'/'+e.id+'/'+k);}}
 return {scope:'Only the previously observed bounded inverse/neighbor domain',paths:proof,changed_paths:changed,unchanged:changed.length===0,replay_required:changed.length!==0,simulation_reexecuted:false,source_atomic:false};
}
function history(index,id){
 const row=requireRow(index,`relation/${id}/history.json`),h=row.elements;assert(h.length);
 for(const [i,e]of h.entries()){assert(e.type==='relation'&&e.id===id&&e.version===i+1,'Missing/conflicting relation history version');assert(Number.isSafeInteger(e.changeset)&&e.changeset>0);assert(Number.isFinite(Date.parse(e.timestamp))&&Date.parse(e.timestamp)<=Date.parse(row.accessed_at));if(i)assert(Date.parse(e.timestamp)>=Date.parse(h[i-1].timestamp));}return {row,h};
}
export function reconcileTransitions(prior,rows,acceptedRaw){
 const index=indexRows(rows),matrix=[],acceptedIndex=osmElementIndex(acceptedRaw);
 for(const old of prior.matrix){
  const id=old.relation_id,{row,h}=history(index,id),latest=h.at(-1),visible=h.filter(e=>e.visible!==false).at(-1);assert(visible,'No last visible relation');
  const retired=old.current_state==='OFFICIALLY_RETIRED',current=requireRow(index,`relation/${id}.json`,retired?410:200);
  if(retired)assert.equal(latest.visible,false,'410 must agree with invisible terminal history');else {const e=current.elements.find(x=>x.type==='relation'&&x.id===id);assert(e&&latest.visible!==false,'Current relation not visible');for(const k of ['version','timestamp','changeset','tags','members'])assert(equal(e[k],latest[k]),'Current relation disagrees with terminal history');}
  const accepted=retired?h.filter(e=>Date.parse(e.timestamp)<=Date.parse(prior.baseline_snapshot_at)).at(-1):null;
  if(retired){assert.equal(accepted?.version,old.relation_version_at_accepted_epoch,'Accepted epoch history drift');const a=acceptedIndex.get('relation/'+id);assert(a&&equal(a.tags,accepted.tags)&&equal(a.members,accepted.members),'Accepted source/history payload mismatch');}
  matrix.push({relation_id:id,name:visible.tags?.name??null,old_version:old.relation_version_at_accepted_epoch??null,current_version:latest.version,old_status:retired?'IN_ACCEPTED_REFERENCE_INVENTORY':'NOT_IN_ACCEPTED_REFERENCE_INVENTORY',current_status:retired?'OFFICIALLY_RETIRED':'CURRENT_OSM_ADDITION',source_timestamp:latest.timestamp,changeset_id:latest.changeset,accessed_at:current.accessed_at,cuatm_context:visible.tags?.['ref:cuatm:codunic']??visible.tags?.cuatm??null,current_http:current.http_status,candidate_geometry_status:retired?'NO_CURRENT_RELATION; NO_HISTORICAL_COPY':'BOUNDED_GRAPH_AUDITED_SEPARATELY',topology_status:retired?'CURRENT_GEOMETRY_NOT_APPLICABLE':'BOUNDED_GRAPH_AUDITED_SEPARATELY',evidence_sha256:{current_original:current.raw_sha256,history_original:row.raw_sha256,history_sanitized:sha(h)},transition_classification:retired?'OSM_RETIREMENT_DEMONSTRATED':'NEW_CARTOGRAPHIC_OBJECT_NOT_ACTUAL_IDENTITY',legal_identity_status:'UNRESOLVED',oct18_direct_membership:'ORIGINAL_CANDIDATE_UNAVAILABLE; NOT_PROVEN_BY_OCT20_PROXY'});
 }
 assert.equal(matrix.length,13);assert.equal(new Set(matrix.map(x=>x.relation_id)).size,13);assert.equal(matrix.filter(x=>x.current_http===410).length,12);
 const current=matrix.find(x=>x.relation_id===21515245),old=matrix.find(x=>x.relation_id===18967907);assert(current&&old);
 const graph=requireRow(index,'relation/21515245/full.json'),graphRoot=graph.elements.find(e=>e.type==='relation'&&e.id===21515245),currentRoot=requireRow(index,'relation/21515245.json').elements.find(e=>e.type==='relation'&&e.id===21515245);assert(graphRoot&&currentRoot);for(const k of ['version','timestamp','changeset','visible','tags','members'])assert(equal(graphRoot[k],currentRoot[k]),'Addition full graph/current root disagreement: '+k);
 const closure=auditOsmClosure({elements:graph.elements},[21515245],'MD');assert.equal(closure.missing_reference_count,0);assert.equal(closure.invalid_coordinate_count,0);assert.equal(closure.topology_issue_count,0);const geometry=relationGeometry(osmElementIndex({elements:graph.elements}),21515245);
 return {matrix,accounting:{accepted_md_master:2596,candidate_md_master_observed:2585,retired:12,added:1,net_deficit:11,equation:'2596 - 12 + 1 = 2585',exact_oct18_candidate_replayed:false},successor:{from:18967907,to:21515245,same_cuatm:old.cuatm_context===current.cuatm_context,same_changeset:old.changeset_id===current.changeset_id,same_timestamp:old.source_timestamp===current.source_timestamp,verdict:old.cuatm_context===current.cuatm_context&&old.changeset_id===current.changeset_id&&old.source_timestamp===current.source_timestamp?'CARTOGRAPHIC_LINK_SUPPORTED_NOT_LEGAL_SUCCESSION':'UNRESOLVED',legal_identity_status:'UNRESOLVED'},addition_graph:{closure,geometry_valid:true,geometry_sha256:sha(geometry),scope:'One current relation only; not a complete country source'}};
}
export function connectivityWitness(rows,id,observedAt){
 const row=requireRow(indexRows(rows),`relation/${id}/full.json`),index=osmElementIndex({elements:row.elements}),r=index.get('relation/'+id);assert(r);const ways=r.members.filter(m=>m.type==='way').map(m=>{const w=index.get('way/'+m.ref);assert(w);return w;});assert(ways.length);
 const objects=[r,...ways];for(const e of objects)assert(Number.isFinite(Date.parse(e.timestamp))&&Date.parse(e.timestamp)<=Date.parse(observedAt));
 const since=objects.map(e=>e.timestamp).sort().at(-1),cutoff=new Date(Date.parse(observedAt)-14*86400000).toISOString();
 return {relation_id:id,connectivity_unchanged_since:since,observed_at:observedAt,freshness_window_start:cutoff,objects:objects.map(e=>({type:e.type,id:e.id,version:e.version,timestamp:e.timestamp})),connectivity_signature_sha256:sha({members:r.members,ways:ways.map(w=>({id:w.id,nodes:w.nodes}))}),current_connectivity_predates_freshness_window:Date.parse(since)<Date.parse(cutoff),scope:'Relation membership and way node-ID order; not a global geometric or legal certificate'};
}
