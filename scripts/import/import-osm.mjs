#!/usr/bin/env node
import {resolveOsmSourceScopeConflicts} from '../lib/osm-source-scope-conflicts.mjs';
import {fetchAdaptiveRelations,retryAfterMs} from '../lib/osm-adaptive-transport.mjs';
import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';

const MANIFEST='data/sources/osm-current.json';
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
const OVERPASS_RETRIES_PER_ENDPOINT=2;
const OVERPASS_REQUEST_TIMEOUT_MS=90000;
const OVERPASS_RETRY_BACKOFF_MS=5000;
const OVERPASS_CHUNK_SIZE=300;
const RETRIES_PER_ENDPOINT=OVERPASS_RETRIES_PER_ENDPOINT;
const REQUEST_TIMEOUT_MS=OVERPASS_REQUEST_TIMEOUT_MS;
const RETRY_BACKOFF_MS=OVERPASS_RETRY_BACKOFF_MS;
const countries={
 RO:{name:'România',iso:'RO',levels:[4,8,9],requiredLevels:[4,8,9],requiredRelations:[],minElements:10000},
 MD:{name:'Republica Moldova',iso:'MD',levels:[4,6,8,9],requiredLevels:[4,8,9],requiredRelations:[1813306,1813297,58512,1813315,1813316,18968071,1691800,1691801,18822134],minElements:10000}
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
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
const queryFor=cfg=>`[out:json][timeout:300];${queryScopeFor(cfg)}out body;>;out skel qt;`;
const inventoryQueryFor=cfg=>`[out:json][timeout:300];${queryScopeFor(cfg)}out body;`;
const explicitRelationsQuery=ids=>`[out:json][timeout:300];relation(id:${ids.join(',')});out body;>;out skel qt;`;
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
async function fetchRelationFullFromOsmApi(relationId,code,{allowMissing=false}={}){
 const attempts=[];
 let lastError=null;
 for(let attempt=1;attempt<=OSM_API_RETRIES;attempt++){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),OSM_API_REQUEST_TIMEOUT_MS);
  const startedAt=new Date().toISOString(),started=Date.now();
  const url=`${OSM_API_BASE}/relation/${relationId}/full.json`;
  try{
   const response=await fetch(url,{headers:{accept:'application/json','user-agent':'reforma-teritoriala-osm-source/1.0'},signal:controller.signal});
   const retryDelay=retryAfterMs(response.headers.get('retry-after'));
    if(!response.ok&&retryDelay)await sleep(retryDelay);
    const body=await response.text();
   if(allowMissing&&(response.status===404||response.status===410)){
    attempts.push({relation_id:relationId,url,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'not_found',http_status:response.status});
    return {status:'not_found',raw:null,attempts};
   }
   if(!response.ok)throw new Error(`HTTP ${response.status}: ${body.slice(0,240).replace(/\s+/g,' ')}`);
   const parsed=JSON.parse(body);
   if(!Array.isArray(parsed?.elements)||!parsed.elements.some(x=>x.type==='relation'&&Number(x.id)===relationId))throw new Error('authoritative relation/full response is incomplete');
   attempts.push({relation_id:relationId,url,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'success',element_count:parsed.elements.length});
   console.log(`OSM API ${code}: authoritative relation ${relationId} accepted on attempt ${attempt}/${OSM_API_RETRIES}`);
   return {status:'success',raw:parsed,attempts};
  }catch(error){
   if(error.transportBudgetExceeded)throw error;
   const timedOut=controller.signal.aborted;
   const message=timedOut?`request timeout after ${OSM_API_REQUEST_TIMEOUT_MS}ms`:String(error?.message||error);
   lastError=new Error(`OSM API ${code} relation ${relationId} attempt ${attempt}/${OSM_API_RETRIES}: ${message}`);
   attempts.push({relation_id:relationId,url,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'failure',timeout:timedOut,error:message});
   console.warn(lastError.message);
   if(attempt<OSM_API_RETRIES)await sleep(RETRY_BACKOFF_MS*attempt);
  }finally{clearTimeout(timer);}
 }
 throw new Error(`Authoritative OSM relation refresh failed closed for ${code} relation ${relationId}: ${lastError?.message||'unknown error'}`);
}
async function recoverPreviousScopeRelations(raw,previousRaw,code,cfg){
 if(!previousRaw)return {raw,attempts:[],recovered_relation_ids:[],retired_relation_ids:[]};
 const byKey=new Map(raw.elements.map(x=>[`${x.type}/${x.id}`,x]));
 const currentRelationIds=new Set(raw.elements.filter(x=>x.type==='relation').map(x=>Number(x.id)));
 const previousRelations=previousRaw.elements.filter(x=>relationMatchesScope(x,cfg));
 const missingIds=previousRelations.map(x=>Number(x.id)).filter(id=>!currentRelationIds.has(id));
 const attempts=[],recovered_relation_ids=[],retired_relation_ids=[];
 for(const relationId of missingIds){
  const fetched=await fetchRelationFullFromOsmApi(relationId,code,{allowMissing:true});
  attempts.push(...fetched.attempts);
  if(fetched.status==='not_found'){retired_relation_ids.push(relationId);continue;}
  const relation=fetched.raw.elements.find(x=>x.type==='relation'&&Number(x.id)===relationId);
  if(!relationMatchesScope(relation,cfg)){retired_relation_ids.push(relationId);continue;}
  for(const element of fetched.raw.elements)byKey.set(`${element.type}/${element.id}`,element);
  recovered_relation_ids.push(relationId);
  console.warn(`OSM ${code}: recovered previous in-scope relation ${relationId} omitted by Overpass area index`);
 }
 return {raw:{...raw,elements:[...byKey.values()]},attempts,recovered_relation_ids,retired_relation_ids};
}
async function fetchOverpassJson(query,code,purpose){
 const attempts=[];
 let lastError=null;
 for(const endpoint of ENDPOINTS){
  for(let attempt=1;attempt<=RETRIES_PER_ENDPOINT;attempt++){
   const controller=new AbortController();
   const startedAt=new Date().toISOString(),started=Date.now();
   const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
   try{
    const response=await fetch(endpoint,{
     method:'POST',
     headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-osm-source/1.0'},
     body:new URLSearchParams({data:query}),
     signal:controller.signal
    });
    const retryDelay=retryAfterMs(response.headers.get('retry-after'));
    if(!response.ok&&retryDelay)await sleep(retryDelay);
    const body=await response.text();
    if(!response.ok)throw new Error(`${endpoint} HTTP ${response.status}: ${body.slice(0,240).replace(/\s+/g,' ')}`);
    const raw=JSON.parse(body);
    if(!Array.isArray(raw?.elements))throw new Error('Overpass response has no elements array');
    attempts.push({purpose,endpoint,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'success',element_count:raw.elements.length});
    return {raw,endpoint,attempts};
   }catch(error){
    if(error.transportBudgetExceeded)throw error;
    const timedOut=controller.signal.aborted;
    const message=timedOut?`request timeout after ${REQUEST_TIMEOUT_MS}ms`:String(error?.message||error);
    lastError=new Error(`Overpass ${code} ${purpose} failed at ${endpoint} attempt ${attempt}/${RETRIES_PER_ENDPOINT}: ${message}`);
    attempts.push({purpose,endpoint,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'failure',timeout:timedOut,error:message});
    console.warn(lastError.message);
    if(attempt<RETRIES_PER_ENDPOINT)await sleep(RETRY_BACKOFF_MS*attempt);
   }finally{clearTimeout(timer);}
  }
 }
 throw Object.assign(new Error(`All Overpass endpoints failed closed for ${code} ${purpose}: ${JSON.stringify(attempts)}`,{cause:lastError}),{attempts});
}
async function fetchCountryChunked(code,cfg,previousRaw,bulkAttempts=[]){
 console.warn(`OSM ${code}: falling back to chunked explicit-relation Overpass fetch`);
 const inventory=await fetchOverpassJson(inventoryQueryFor(cfg),code,'inventory');
 const continuity=await recoverPreviousScopeRelations(inventory.raw,previousRaw,code,cfg);
 const relationIds=[...new Set(continuity.raw.elements.filter(x=>x.type==='relation'&&relationMatchesScope(x,cfg)).map(x=>Number(x.id)))].sort((a,b)=>a-b);
 if(!relationIds.length)throw new Error(`OSM ${code} chunked fallback produced no relation inventory`);
 const byKey=new Map();
 const chunkAttempts=[];
 for(let i=0;i<relationIds.length;i+=OVERPASS_CHUNK_SIZE){
  const ids=relationIds.slice(i,i+OVERPASS_CHUNK_SIZE);
  const part=await fetchAdaptiveRelations(ids,{fetchChunk:(part,purpose)=>fetchOverpassJson(explicitRelationsQuery(part),code,purpose),fetchFull:id=>fetchRelationFullFromOsmApi(id,code),attempts:chunkAttempts,purpose:`relations-${i/OVERPASS_CHUNK_SIZE+1}`});
  for(const element of part.elements)byKey.set(`${element.type}/${element.id}`,element);
 }
 for(const relationId of continuity.recovered_relation_ids){
  if(byKey.has(`relation/${relationId}`))continue;
  const fetched=await fetchRelationFullFromOsmApi(relationId,code);
  continuity.attempts.push(...fetched.attempts);
  for(const element of fetched.raw.elements)byKey.set(`${element.type}/${element.id}`,element);
 }
 let raw={version:0.6,elements:[...byKey.values()]};
 const finalContinuity=await recoverPreviousScopeRelations(raw,previousRaw,code,cfg);
 raw=finalContinuity.raw;
 const authoritative=await refreshRequiredRelationsFromOsmApi(raw,code,cfg);
 raw=authoritative.raw;
 const counts=validateRaw(raw,code,cfg);
 const canonical=canonicalRaw(raw);
 const compressed=gzipSync(Buffer.from(canonical),{level:9,mtime:0});
 return {
  canonical,compressed,semanticSha:sha256(canonical),compressedSha:sha256(compressed),counts,
  endpoint:inventory.endpoint,querySha256:sha256(queryFor(cfg)),
  selectedRelationIds:[...new Set(raw.elements.filter(x=>relationMatchesScope(x,cfg)).map(x=>Number(x.id)))].sort((a,b)=>a-b),
  attempts:[...bulkAttempts,...inventory.attempts,...chunkAttempts],
  authoritativeRelationAttempts:authoritative.attempts,
  continuityRelationAttempts:[...continuity.attempts,...finalContinuity.attempts],
  continuityRecoveredRelationIds:[...new Set([...continuity.recovered_relation_ids,...finalContinuity.recovered_relation_ids])].sort((a,b)=>a-b),
  continuityRetiredRelationIds:[...new Set([...continuity.retired_relation_ids,...finalContinuity.retired_relation_ids])].sort((a,b)=>a-b),
  fetchMode:'chunked_explicit_relations'
 };
}
async function refreshRequiredRelationsFromOsmApi(raw,code,cfg){
 if(!cfg.requiredRelations?.length)return {raw,attempts:[]};
 const byKey=new Map(raw.elements.map(x=>[`${x.type}/${x.id}`,x]));
 const attempts=[];
 for(const relationId of cfg.requiredRelations){
  const fetched=await fetchRelationFullFromOsmApi(relationId,code);
  attempts.push(...fetched.attempts);
  for(const element of fetched.raw.elements)byKey.set(`${element.type}/${element.id}`,element);
 }
 return {raw:{...raw,elements:[...byKey.values()]},attempts};
}
async function fetchCountry(code,cfg,previousRaw){
 const query=queryFor(cfg);
 const attempts=[];
 let lastError;
 for(const endpoint of ENDPOINTS){
  for(let attempt=1;attempt<=RETRIES_PER_ENDPOINT;attempt++){
   const controller=new AbortController();
   const startedAt=new Date().toISOString();
   const started=Date.now();
   const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
   try{
    const response=await fetch(endpoint,{
     method:'POST',
     headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-osm-source/1.0'},
     body:new URLSearchParams({data:query}),
     signal:controller.signal
    });
    const retryDelay=retryAfterMs(response.headers.get('retry-after'));
    if(!response.ok&&retryDelay)await sleep(retryDelay);
    const body=await response.text();
    if(!response.ok)throw new Error(`${endpoint} HTTP ${response.status}: ${body.slice(0,240).replace(/\s+/g,' ')}`);
    let raw;
    try{raw=JSON.parse(body);}catch(error){throw new Error(`${endpoint} returned invalid JSON: ${error.message}`);}
    const continuity=await recoverPreviousScopeRelations(raw,previousRaw,code,cfg);
    raw=continuity.raw;
    validateRaw(raw,code,cfg);
    const authoritative=await refreshRequiredRelationsFromOsmApi(raw,code,cfg);
    raw=authoritative.raw;
    const counts=validateRaw(raw,code,cfg);
    const canonical=canonicalRaw(raw);
    const semanticSha=sha256(canonical);
    const compressed=gzipSync(Buffer.from(canonical),{level:9,mtime:0});
    const compressedSha=sha256(compressed);
    attempts.push({purpose:'bulk',endpoint,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'success',element_count:counts.element_count});
    console.log(`Overpass ${code}: accepted ${counts.element_count} elements from ${endpoint} on attempt ${attempt}/${RETRIES_PER_ENDPOINT}`);
    return {
     canonical,compressed,semanticSha,compressedSha,counts,endpoint,querySha256:sha256(query),attempts,
     selectedRelationIds:[...new Set(raw.elements.filter(x=>relationMatchesScope(x,cfg)).map(x=>Number(x.id)))].sort((a,b)=>a-b),
     authoritativeRelationAttempts:authoritative.attempts,
     continuityRelationAttempts:continuity.attempts,
     continuityRecoveredRelationIds:continuity.recovered_relation_ids,
     continuityRetiredRelationIds:continuity.retired_relation_ids,
     fetchMode:'bulk'
    };
   }catch(error){
    if(error.transportBudgetExceeded)throw error;
    const timedOut=controller.signal.aborted;
    const message=timedOut?`request timeout after ${REQUEST_TIMEOUT_MS}ms`:String(error?.message||error);
    lastError=new Error(`Overpass ${code} failed at ${endpoint} attempt ${attempt}/${RETRIES_PER_ENDPOINT}: ${message}`);
    attempts.push({purpose:'bulk',endpoint,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'failure',timeout:timedOut,error:message});
    console.warn(lastError.message);
    if(attempt<RETRIES_PER_ENDPOINT)await sleep(RETRY_BACKOFF_MS*attempt);
   }finally{
    clearTimeout(timer);
   }
  }
 }
 console.warn(`All monolithic Overpass endpoints failed for ${code}; using chunked fallback`);
 try{return await fetchCountryChunked(code,cfg,previousRaw,attempts);}
 catch(error){throw new Error(`OSM ${code} bulk and chunked refresh failed closed: ${error.message}`,{cause:lastError});}
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
 const previous=await readPreviousManifest();
 await mkdir(SNAPSHOT_DIR,{recursive:true});
 const fetchedAt=new Date().toISOString();
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
   : fetchedAt;
 }

 const unchanged=Boolean(previous)&&Object.keys(countries).every(code=>
  previous.countries?.[code]?.semantic_sha256===fresh[code].semanticSha
  && JSON.stringify(previous.countries?.[code]?.selected_relation_ids)===JSON.stringify(fresh[code].selectedRelationIds)
  && previous.countries?.[code]?.selected_relation_count===fresh[code].selectedRelationIds.length
 );
 const status=unchanged?'UNCHANGED':'UPDATED';
 const manifest=unchanged?previous:{
  schema_version:MANIFEST_SCHEMA_VERSION,
  source:'OpenStreetMap',
  transport:'Overpass API',
  query_version:QUERY_VERSION,
  fetched_at:fetchedAt,
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
main().catch(error=>{console.error(error);process.exitCode=1;});
