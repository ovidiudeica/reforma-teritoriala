#!/usr/bin/env node
import {resolveOsmSourceScopeConflicts} from '../lib/osm-source-scope-conflicts.mjs';
import {fetchAdaptiveRelations,retryAfterMs,completeOsmDependencies} from '../lib/osm-adaptive-transport.mjs';
import {previousScopedRelationsNeedingLiveVerification} from '../lib/osm-source-continuity.mjs';
import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile,appendFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {osmManifestPath} from '../lib/osm-source-paths.mjs';
import {execFileSync} from 'node:child_process';
import {createOverpassTransport,openCaptureCheckpoint,partitionInventory,mergeOsmElements,assertCaptureEpoch} from '../lib/osm-capture-session.mjs';

const MANIFEST=osmManifestPath(process.env.OSM_MANIFEST_PATH||'data/sources/osm-current.json');
const SNAPSHOT_DIR='data/sources/osm-snapshots';
const QUERY_VERSION=1;
const MANIFEST_SCHEMA_VERSION=2;
const DEFAULT_ENDPOINTS=[
 'https://overpass-api.de/api/interpreter',
 'https://overpass.kumi.systems/api/interpreter',
 'https://overpass.private.coffee/api/interpreter'
];
const ENDPOINTS=[...DEFAULT_ENDPOINTS];
const OSM_API_BASE='https://api.openstreetmap.org/api/0.6';
const OSM_API_REQUEST_TIMEOUT_MS=30000;
const OSM_API_RETRIES=2;
const OVERPASS_RETRIES_PER_ENDPOINT=1;
const OVERPASS_REQUEST_TIMEOUT_MS=60000;
const OVERPASS_RETRY_BACKOFF_MS=5000;
const OVERPASS_CHUNK_SIZE=100;
const RETRY_BACKOFF_MS=OVERPASS_RETRY_BACKOFF_MS;
const countries={
 RO:{name:'România',iso:'RO',levels:[4,8,9],requiredLevels:[4,8,9],requiredRelations:[],minElements:10000},
 MD:{name:'Republica Moldova',iso:'MD',levels:[4,6,8,9],requiredLevels:[4,8,9],requiredRelations:[1813306,1813297,58512,1813315,1813316,18968071,1691800,1691801,18822134],minElements:10000}
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const captureStarted=Date.now(),captureEpochByCountry=new Map();
const captureBudget=()=>{if(Date.now()-captureStarted>=22*60000)throw Object.assign(Error('OSM capture deadline exhausted; incomplete checkpoint retained'),{transportBudgetExceeded:true});};
const checkpointDirectory='outputs/osm-capture-checkpoint';
async function preserveHttpBody(record,body){await mkdir(checkpointDirectory+'/http',{recursive:true});const digest=createHash('sha256').update(body).digest('hex');await writeFile(checkpointDirectory+'/http/'+digest+'.response.gz',gzipSync(Buffer.from(body),{level:9}));await appendFile(checkpointDirectory+'/http/receipts.jsonl',JSON.stringify({...record,body_sha256:digest,body_bytes:Buffer.byteLength(body),stored_as:digest+'.response.gz'})+'\n');}
const transport=createOverpassTransport({endpoints:ENDPOINTS,timeoutMs:OVERPASS_REQUEST_TIMEOUT_MS,onAttempt:record=>console.log(JSON.stringify({osm_transport:record})),onResponse:preserveHttpBody});
const sha256=value=>createHash('sha256').update(value).digest('hex');
const snapshotPath=(code,semanticSha)=>`${SNAPSHOT_DIR}/${code.toLowerCase()}-${semanticSha}.json.gz`;
const maxIsoTimestamp=values=>{
 const dates=values.filter(Boolean).map(x=>new Date(x)).filter(x=>Number.isFinite(x.getTime()));
 return (dates.length?new Date(Math.max(...dates.map(x=>x.getTime()))):new Date(0)).toISOString();
};
const canonicalize=value=>{
 if(Array.isArray(value))return value.map(canonicalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalize(value[k])]));
 return value;
};
const typeOrder={node:0,way:1,relation:2};
const queryScopeFor=({iso,levels,requiredRelations=[]})=>{
 const filters=levels.map(l=>`relation(area.country)["boundary"="administrative"]["admin_level"="${l}"];`).join('\n');
 const required=requiredRelations.map(id=>`relation(${id});`).join('\n');
 return `relation["ISO3166-1"="${iso}"]["boundary"="administrative"]->.countryRel;.countryRel map_to_area ->.country;(.countryRel;${filters}${required ? `\n${required}` : ''});`;
};
const queryFor=cfg=>`[out:json][timeout:25];${queryScopeFor(cfg)}out meta;>;out meta qt;`;
const inventoryQueryFor=cfg=>`[out:json][timeout:25];${queryScopeFor(cfg)}out meta;`;
const explicitRelationsQuery=(ids,epoch)=>`[out:json][timeout:25][date:"${epoch}"];relation(id:${ids.join(',')});out meta;>;out meta qt;`;
function canonicalRaw(raw){
 const elements=[...raw.elements].sort((a,b)=>{
  const typeDelta=(typeOrder[a.type]??9)-(typeOrder[b.type]??9);
  if(typeDelta)return typeDelta;
  return Number(a.id)-Number(b.id);
 });
 return JSON.stringify(canonicalize({version:0.6,elements}));
}
function validateRaw(raw,code,cfg){
 if(!raw||!Array.isArray(raw.elements))throw new Error(`OSM ${code} snapshot has no elements array`);
 if(raw.elements.length<cfg.minElements)throw new Error(`OSM ${code} snapshot is unexpectedly small: ${raw.elements.length}`);
 const seen=new Set();
 for(const element of raw.elements){
  if(!['node','way','relation'].includes(element?.type)||!Number.isInteger(Number(element?.id)))throw new Error(`OSM ${code} snapshot contains an invalid element`);
  const key=`${element.type}/${element.id}`;
  if(seen.has(key))throw new Error(`OSM ${code} snapshot contains duplicate ${key}`);
  seen.add(key);
 }
 const relations=raw.elements.filter(x=>x.type==='relation');
 const country=relations.find(x=>x.tags?.['ISO3166-1']===cfg.iso&&x.tags?.boundary==='administrative');
 if(!country)throw new Error(`OSM ${code} snapshot is missing the country administrative relation`);
 for(const level of cfg.requiredLevels){
  if(!relations.some(x=>String(x.tags?.admin_level||'')===String(level)))throw new Error(`OSM ${code} snapshot has no required administrative relation at level ${level}`);
 }
 for(const id of cfg.requiredRelations){
  if(!relations.some(x=>Number(x.id)===id))throw new Error(`OSM ${code} snapshot is missing required relation ${id}`);
 }
 return {element_count:raw.elements.length,relation_count:relations.length};
}
function validateManifestEntry(code,entry){
 if(!/^[a-f0-9]{64}$/.test(String(entry?.semantic_sha256||'')))throw new Error(`invalid ${code} semantic_sha256`);
 if(!/^[a-f0-9]{64}$/.test(String(entry?.compressed_sha256||'')))throw new Error(`invalid ${code} compressed_sha256`);
 if(!Number.isFinite(new Date(entry?.snapshot_at).getTime()))throw new Error(`invalid ${code} snapshot_at`);
 const expected=snapshotPath(code,entry.semantic_sha256);
 if(entry.snapshot_path!==expected)throw new Error(`invalid ${code} snapshot_path`);
}
async function readPreviousManifest(){
 try{
  const parsed=JSON.parse(await readFile(MANIFEST,'utf8'));
  if(parsed.schema_version!==MANIFEST_SCHEMA_VERSION||parsed.query_version!==QUERY_VERSION||!parsed.countries?.RO||!parsed.countries?.MD)throw new Error('invalid schema');
  for(const code of Object.keys(countries))validateManifestEntry(code,parsed.countries[code]);
  return parsed;
 }catch(error){
  if(error?.code==='ENOENT')return null;
  throw new Error(`Existing OSM source manifest is invalid: ${error.message}`);
 }
}

async function readPreviousRaw(previous,code){
 const entry=previous?.countries?.[code];
 if(!entry)return null;
 const compressed=await readFile(entry.snapshot_path);
 if(sha256(compressed)!==entry.compressed_sha256)throw new Error(`Previous OSM ${code} compressed snapshot hash mismatch`);
 const canonical=gunzipSync(compressed);
 if(sha256(canonical)!==entry.semantic_sha256)throw new Error(`Previous OSM ${code} semantic snapshot hash mismatch`);
 const raw=JSON.parse(canonical.toString('utf8'));
 validateRaw(raw,code,countries[code]);
 return raw;
}
const relationMatchesScope=(relation,cfg)=>Boolean(
 relation?.type==='relation'
 && relation.tags?.boundary==='administrative'
 && (
  relation.tags?.['ISO3166-1']===cfg.iso
  || cfg.levels.includes(Number(relation.tags?.admin_level))
  || cfg.requiredRelations.includes(Number(relation.id))
 )
);
async function fetchRelationFullFromOsmApi(relationId,code,{allowMissing=false,type='relation'}={}){
 captureBudget();
 if(!['relation','way','node'].includes(type)||!Number.isSafeInteger(Number(relationId))||Number(relationId)<=0)throw new Error('Invalid authoritative OSM element identity');
 const attempts=[];
 let lastError=null;
 for(let attempt=1;attempt<=OSM_API_RETRIES;attempt++){
  captureBudget();let retryDelay=0,httpStatus=null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),OSM_API_REQUEST_TIMEOUT_MS);
  const startedAt=new Date().toISOString(),started=Date.now();
  const url=`${OSM_API_BASE}/${type}/${Number(relationId)}${type==='node'?'':'/full'}.json`;
  try{
   const response=await fetch(url,{headers:{accept:'application/json','user-agent':'reforma-teritoriala-osm-source/1.0'},signal:controller.signal});
   httpStatus=response.status;retryDelay=retryAfterMs(response.headers.get('retry-after'));
    const body=await response.text();
   await preserveHttpBody({url,element_type:type,element_id:relationId,http_status:response.status,started_at:startedAt,duration_ms:Date.now()-started},body);
   if(allowMissing&&(response.status===404||response.status===410)){
    attempts.push({relation_id:relationId,url,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'not_found',http_status:response.status});
    return {status:'not_found',raw:null,attempts};
   }
   if(!response.ok)throw new Error(`HTTP ${response.status}: ${body.slice(0,240).replace(/\s+/g,' ')}`);
   const parsed=JSON.parse(body);
   if(!Array.isArray(parsed?.elements)||!parsed.elements.some(x=>x.type===type&&Number(x.id)===Number(relationId)))throw new Error('authoritative element response is incomplete');
   const cutoff=captureEpochByCountry.get(code)||[...captureEpochByCountry.values()].sort()[0];
   if(cutoff)assertCaptureEpoch(parsed,cutoff);
   attempts.push({relation_id:relationId,url,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'success',element_count:parsed.elements.length,body_sha256:sha256(body),body_bytes:Buffer.byteLength(body),capture_epoch:cutoff});
   console.log(`OSM API ${code}: authoritative relation ${relationId} accepted on attempt ${attempt}/${OSM_API_RETRIES}`);
   return {status:'success',raw:parsed,attempts};
  }catch(error){
   clearTimeout(timer);
   if(error.transportBudgetExceeded)throw error;
   const timedOut=controller.signal.aborted;
   const message=timedOut?`request timeout after ${OSM_API_REQUEST_TIMEOUT_MS}ms`:String(error?.message||error);
   lastError=new Error(`OSM API ${code} relation ${relationId} attempt ${attempt}/${OSM_API_RETRIES}: ${message}`);
   attempts.push({relation_id:relationId,url,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'failure',http_status:httpStatus,timeout:timedOut,error:message});
   console.warn(lastError.message);
   if(error.code==='ERR_ASSERTION')throw error;
   if(attempt<OSM_API_RETRIES)await sleep(Math.max(retryDelay,RETRY_BACKOFF_MS*attempt));
  }finally{clearTimeout(timer);}
 }
 throw new Error(`Authoritative OSM relation refresh failed closed for ${code} relation ${relationId}: ${lastError?.message||'unknown error'}`);
}
async function closeRawDependencies(raw,ids,code,attempts,deferredSubareas=new Set()){
 return completeOsmDependencies(raw,ids,{deferredSubareas,fetchMissing:async(type,id)=>{
  const fetched=await fetchRelationFullFromOsmApi(id,code,{type});
  attempts.push(...fetched.attempts.map(a=>({...a,element_type:type,purpose:'dependency_closure'})));
  return fetched.raw;
 }});
}
async function recoverPreviousScopeRelations(raw,previousRaw,code,cfg){
 if(!previousRaw)return {raw,attempts:[],recovered_relation_ids:[],retired_relation_ids:[]};
 const byKey=new Map(raw.elements.map(x=>[`${x.type}/${x.id}`,x]));
 const missingIds=previousScopedRelationsNeedingLiveVerification(previousRaw,raw,relation=>relationMatchesScope(relation,cfg));
 const attempts=[],recovered_relation_ids=[],retired_relation_ids=[];
 for(const relationId of missingIds){
  const fetched=await fetchRelationFullFromOsmApi(relationId,code,{allowMissing:true});
  attempts.push(...fetched.attempts);
  if(fetched.status==='not_found'){retired_relation_ids.push(relationId);continue;}
  const relation=fetched.raw.elements.find(x=>x.type==='relation'&&Number(x.id)===relationId);
  if(!relationMatchesScope(relation,cfg)){retired_relation_ids.push(relationId);continue;}
  mergeOsmElements(byKey,fetched.raw.elements);
  recovered_relation_ids.push(relationId);
  console.warn(`OSM ${code}: recovered previous in-scope relation ${relationId} after Overpass omission or out-of-scope retag`);
 }
 return {raw:{...raw,elements:[...byKey.values()]},attempts,recovered_relation_ids,retired_relation_ids};
}
async function fetchOverpassJson(query,code,purpose,options){
 captureBudget();return transport(query,code+':'+purpose,options);
}
async function fetchCountryChunked(code,cfg,previousRaw,bulkAttempts=[]){
 console.warn('OSM '+code+': bounded categorized relation shards, complete inventory required');
 let resumeCountry=process.env.OSM_CAPTURE_RESUME==='1';
 if(resumeCountry)try{await readFile(checkpointDirectory+'/'+code+'/latest.json');}catch(error){if(error.code==='ENOENT')resumeCountry=false;else throw error;}
 const deferredSubareas=new Set();
 const checkpoint=await openCaptureCheckpoint({deferredSubareas,directory:checkpointDirectory,country:code,scopeSha:sha256(JSON.stringify({manifest:MANIFEST,cfg,query:inventoryQueryFor(cfg)})),sourceSha,resume:resumeCountry});
 const inventory=resumeCountry?await checkpoint.inventory():await checkpoint.inventory(await fetchOverpassJson(inventoryQueryFor(cfg),code,'inventory',{maxAttempts:3}));
 captureEpochByCountry.set(code,checkpoint.state.epoch);
 const continuity=await recoverPreviousScopeRelations(inventory.raw,previousRaw,code,cfg);
 const relations=continuity.raw.elements.filter(x=>relationMatchesScope(x,cfg));
 for(const r of relations)deferredSubareas.add(r.id);
 if(!relations.length)throw Error('Empty OSM '+code+' inventory');
 const shards=partitionInventory(relations,OVERPASS_CHUNK_SIZE),relationIds=shards.flatMap(s=>s.ids).sort((a,b)=>a-b),byKey=new Map(relations.map(r=>[`relation/${r.id}`,r])),chunkAttempts=[],allShardAttempts=[];
 for(const [index,shard] of shards.entries()){
  captureBudget();let captured=await checkpoint.chunk(shard.ids);
  if(!captured){
   const firstAttempt=chunkAttempts.length;
   const raw=await fetchAdaptiveRelations(shard.ids,{fetchChunk:(ids,purpose)=>fetchOverpassJson(explicitRelationsQuery(ids,checkpoint.state.epoch),code,purpose,{maxAttempts:Math.min(2,ENDPOINTS.length*OVERPASS_RETRIES_PER_ENDPOINT)}),fetchFull:async id=>{const fetched=await fetchRelationFullFromOsmApi(id,code);fetched.raw=await closeRawDependencies(fetched.raw,[id],code,fetched.attempts,deferredSubareas);return fetched;},attempts:chunkAttempts,purpose:'shard-'+(index+1)+'-'+shard.category,preferFullAtSingleton:true,deferredSubareas});
   assertCaptureEpoch(raw,checkpoint.state.epoch);captured={raw,attempts:chunkAttempts.slice(firstAttempt),endpoint:null};await checkpoint.chunk(shard.ids,captured);
  }
  allShardAttempts.push(...captured.attempts);
  mergeOsmElements(byKey,captured.raw.elements);
  console.log('OSM '+code+': verified shard '+(index+1)+'/'+shards.length+'; '+shard.ids.length+' relations; epoch '+checkpoint.state.epoch);
 }
 let raw={version:0.6,elements:[...byKey.values()]};
 const finalContinuity=await recoverPreviousScopeRelations(raw,previousRaw,code,cfg);raw=finalContinuity.raw;
 const authoritative=await refreshRequiredRelationsFromOsmApi(raw,code,cfg);raw=authoritative.raw;
 const selectedRelationIds=[...new Set(raw.elements.filter(x=>relationMatchesScope(x,cfg)).map(x=>Number(x.id)))].sort((a,b)=>a-b);
 raw=await closeRawDependencies(raw,selectedRelationIds,code,authoritative.attempts);assertCaptureEpoch(raw,checkpoint.state.epoch);
 const counts=validateRaw(raw,code,cfg);
 const canonical=canonicalRaw(raw);
 const compressed=gzipSync(Buffer.from(canonical),{level:9,mtime:0});
 await checkpoint.finish(relationIds,raw);
 return {canonical,compressed,semanticSha:sha256(canonical),compressedSha:sha256(compressed),counts,endpoint:inventory.endpoint,querySha256:sha256(queryFor(cfg)),selectedRelationIds,attempts:[...bulkAttempts,...inventory.attempts,...allShardAttempts],authoritativeRelationAttempts:authoritative.attempts,continuityRelationAttempts:[...continuity.attempts,...finalContinuity.attempts],continuityRecoveredRelationIds:[...new Set([...continuity.recovered_relation_ids,...finalContinuity.recovered_relation_ids])].sort((a,b)=>a-b),continuityRetiredRelationIds:[...new Set([...continuity.retired_relation_ids,...finalContinuity.retired_relation_ids])].sort((a,b)=>a-b),fetchMode:'categorized_pinned_epoch_shards',captureEpoch:checkpoint.state.epoch,captureStartedAt:checkpoint.state.started_at,captureResumed:resumeCountry};
}
async function refreshRequiredRelationsFromOsmApi(raw,code,cfg){
 if(!cfg.requiredRelations?.length)return {raw,attempts:[]};
 const byKey=new Map(raw.elements.map(x=>[`${x.type}/${x.id}`,x]));
 const attempts=[];
 for(const relationId of cfg.requiredRelations){
  const fetched=await fetchRelationFullFromOsmApi(relationId,code);
  attempts.push(...fetched.attempts);
  mergeOsmElements(byKey,fetched.raw.elements);
 }
 return {raw:{...raw,elements:[...byKey.values()]},attempts};
}
async function fetchCountry(code,cfg,previousRaw){
 // Inventory first: the failed live run spent 25 minutes inside a recursive
 // monolithic retry matrix. Bounded category/regional shards retain progress.
 return fetchCountryChunked(code,cfg,previousRaw);
}
async function writeAtomic(path,bytes){
 const tmp=`${path}.tmp-${process.pid}`;
 await writeFile(tmp,bytes);
 await rename(tmp,path);
}
async function materializeContentAddressedSnapshot(code,result){
 const path=snapshotPath(code,result.semanticSha);
 try{
  const existing=await readFile(path);
  const canonical=gunzipSync(existing);
  if(sha256(canonical)!==result.semanticSha)throw new Error(`OSM ${code} content-addressed snapshot collision at ${path}`);
  result.compressed=existing;
  result.compressedSha=sha256(existing);
  return path;
 }catch(error){
  if(error?.code!=='ENOENT')throw error;
 }
 await writeAtomic(path,result.compressed);
 return path;
}
async function main(){
 await mkdir(checkpointDirectory,{recursive:true});
 await writeFile(checkpointDirectory+'/capture-attempt.json',JSON.stringify({source_sha:sourceSha,started_at:new Date(captureStarted).toISOString(),status:'IN_PROGRESS_NOT_A_VALIDATED_SNAPSHOT',source_promoted:false},null,2)+'\n');
 const previous=await readPreviousManifest();
 await mkdir(SNAPSHOT_DIR,{recursive:true});
 const previousRawByCode={};
 for(const code of Object.keys(countries))previousRawByCode[code]=await readPreviousRaw(previous,code);
 const fresh={};
 for(const [code,cfg] of Object.entries(countries))fresh[code]=await fetchCountry(code,cfg,previousRawByCode[code]);
 const scope=await resolveOsmSourceScopeConflicts({
  inventories:Object.fromEntries(Object.entries(fresh).map(([code,result])=>[code,{relation_ids:result.selectedRelationIds,raw:JSON.parse(result.canonical)}])),
  fetchAuthoritativeRelation:id=>fetchRelationFullFromOsmApi(id,'scope-collision'),
  matchesScope:(relation,code)=>relationMatchesScope(relation,countries[code])
 });
 for(const [code,result] of Object.entries(fresh))result.selectedRelationIds=scope.relation_ids[code];
 for(const [code,result] of Object.entries(fresh)){
  result.snapshotPath=await materializeContentAddressedSnapshot(code,result);
  const previousEntry=previous?.countries?.[code];
  result.snapshotAt=previousEntry?.semantic_sha256===result.semanticSha
   ? previousEntry.snapshot_at
   : result.captureEpoch;
 }

 const unchanged=Boolean(previous)&&Object.keys(countries).every(code=>
  previous.countries?.[code]?.semantic_sha256===fresh[code].semanticSha
  && JSON.stringify(previous.countries?.[code]?.selected_relation_ids)===JSON.stringify(fresh[code].selectedRelationIds)
  && previous.countries?.[code]?.selected_relation_count===fresh[code].selectedRelationIds.length
 );
 const status=unchanged?'UNCHANGED':'UPDATED';
 const authenticFetchStartedAt=Object.values(fresh).map(r=>r.captureStartedAt).sort()[0];
 const manifest=unchanged?previous:{
  schema_version:MANIFEST_SCHEMA_VERSION,
  source:'OpenStreetMap',
  transport:'Overpass API',
  query_version:QUERY_VERSION,
  fetched_at:authenticFetchStartedAt,
  snapshot_at:maxIsoTimestamp(Object.values(fresh).map(x=>x.snapshotAt)),
  snapshot_directory:SNAPSHOT_DIR,
  countries:Object.fromEntries(Object.entries(countries).map(([code,cfg])=>[code,{
   name:cfg.name,
   iso:cfg.iso,
   levels:cfg.levels,
   required_levels:cfg.requiredLevels,
   required_relations:cfg.requiredRelations,
   snapshot_path:fresh[code].snapshotPath,
   snapshot_at:fresh[code].snapshotAt,
   semantic_sha256:fresh[code].semanticSha,
   compressed_sha256:fresh[code].compressedSha,
   query_sha256:fresh[code].querySha256,
   element_count:fresh[code].counts.element_count,
   relation_count:fresh[code].counts.relation_count,
   selected_relation_count:fresh[code].selectedRelationIds.length,
   selected_relation_ids:fresh[code].selectedRelationIds,
   source_scope_collision_resolutions:scope.resolutions.filter(r=>r.selected_jurisdiction===code||r.excluded_jurisdictions.includes(code)),
   source_scope_collision_authoritative_attempts:scope.attempts,
   endpoint:fresh[code].endpoint,
   fetch_mode:fresh[code].fetchMode,
   capture_epoch:fresh[code].captureEpoch,
   capture_started_at:fresh[code].captureStartedAt,
   capture_was_resumed:fresh[code].captureResumed,
   capture_completed_at:new Date().toISOString(),
   acquisition_attempts:fresh[code].attempts,
   authoritative_relation_source:cfg.requiredRelations.length?OSM_API_BASE:null,
   authoritative_relation_ids:cfg.requiredRelations,
   authoritative_relation_attempts:fresh[code].authoritativeRelationAttempts,
   continuity_authoritative_source:OSM_API_BASE,
   continuity_recovered_relation_ids:fresh[code].continuityRecoveredRelationIds,
   continuity_retired_relation_ids:fresh[code].continuityRetiredRelationIds,
   continuity_relation_attempts:fresh[code].continuityRelationAttempts
  }]))
 };
 if(!unchanged)await writeAtomic(MANIFEST,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 await writeFile(checkpointDirectory+'/capture-attempt.json',JSON.stringify({source_sha:sourceSha,started_at:new Date(captureStarted).toISOString(),completed_at:new Date().toISOString(),status:'CAPTURE_COMPLETE_NOT_SOURCE_PROMOTED',country_epochs:Object.fromEntries(Object.entries(fresh).map(([code,r])=>[code,r.captureEpoch])),source_promoted:false},null,2)+'\n');
 console.log(JSON.stringify({
  status,
  manifest:MANIFEST,
  fetched_at:manifest.fetched_at,
  previous_fetched_at:previous?.fetched_at??null,
  source_scope_collision_resolutions:scope.resolutions,
  countries:Object.fromEntries(Object.keys(countries).map(code=>[code,{
   element_count:fresh[code].counts.element_count,
   relation_count:fresh[code].counts.relation_count,
   selected_relation_count:fresh[code].selectedRelationIds.length,
   semantic_sha256:fresh[code].semanticSha,
   compressed_sha256:fresh[code].compressedSha,
   snapshot_path:fresh[code].snapshotPath,
   snapshot_at:fresh[code].snapshotAt,
   endpoint:fresh[code].endpoint
  }]))
 },null,2));
}
main().catch(async error=>{console.error(error);process.exitCode=1;try{await mkdir(checkpointDirectory,{recursive:true});await writeFile(checkpointDirectory+'/capture-attempt.json',JSON.stringify({source_sha:sourceSha,started_at:new Date(captureStarted).toISOString(),failed_at:new Date().toISOString(),status:'INCOMPLETE_OR_FAILED_NOT_A_VALIDATED_SNAPSHOT',error:error.message,source_promoted:false},null,2)+'\n');}catch(e){console.error('Cannot preserve failed capture receipt:',e.message);}});
