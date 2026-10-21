import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import {retryAfterMs,assertRelationClosure,assertShardClosure} from './osm-adaptive-transport.mjs';
export {mergeOsmElements} from './osm-element-merge.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const canonical=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])):x);
export function assertCaptureEpoch(raw,epoch){
 const cutoff=Date.parse(epoch);assert.ok(Number.isFinite(cutoff),'Missing authentic OSM capture epoch');
 if(raw.osm3s?.timestamp_osm_base)assert.ok(Date.parse(raw.osm3s.timestamp_osm_base)>=cutoff,'Endpoint replication predates capture epoch');
 assert.ok(Array.isArray(raw.elements)&&!raw.remark,'Partial Overpass response or missing elements');
 for(const e of raw.elements){assert.ok(['node','way','relation'].includes(e.type)&&Number.isSafeInteger(e.id)&&e.id>0,'Invalid source element identity');assert.ok(Number.isInteger(e.version)&&e.version>0,`Missing version ${e.type}/${e.id}`);assert.ok(Number.isFinite(Date.parse(e.timestamp))&&Date.parse(e.timestamp)<=cutoff,`Element outside pinned capture epoch ${e.type}/${e.id}`);}
}
export function validateResumeEnvelope(run,artifacts,{id,sha,repo}){
 assert.equal(repo,'ovidiudeica/reforma-teritoriala');assert.equal(run.status,'completed');assert.equal(run.head_sha,sha);assert.equal(run.head_repository.full_name,repo);assert.equal(run.path.split('@')[0],'.github/workflows/osm-live-source-probe.yml');
 const matches=artifacts.filter(a=>a.name==='osm-capture-checkpoint-'+id);assert.equal(matches.length,1);const a=matches[0];assert.equal(a.expired,false);assert.match(a.digest,/^sha256:[a-f0-9]{64}$/);assert.ok(a.size_in_bytes<512*1024*1024);return a;
}
export function classifyStagedCapture(capture,sha){const complete=capture?.source_sha===sha&&capture.status==='CAPTURE_COMPLETE_NOT_SOURCE_PROMOTED';return {capture_complete:complete,stage_kind:complete?'COMPLETE_CAPTURE_PENDING_SOURCE_VALIDATION':'HISTORICAL_INPUT_ONLY_CAPTURE_INCOMPLETE',capture_country_epochs:complete?capture.country_epochs:null,source_promoted:false};}
// One sequential request at a time. A query has a total attempt budget, rather
// than restarting the complete endpoint/retry matrix at every bisection.
export function createOverpassTransport({endpoints,fetchFn=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,timeoutMs=60000,maxSessionMs=22*60000,onAttempt=()=>{},onResponse=async()=>{}}){
 assert.ok(endpoints.length>0);let cursor=0;const started=now(),cooldown=new Map(),failures=new Map();
 return async function request(query,purpose,{maxAttempts=2}={}){
  const attempts=[];let last;
  for(let attempt=0;attempt<maxAttempts;attempt++){
   if(now()-started>=maxSessionMs)throw Object.assign(Error('OSM acquisition session deadline exhausted; checkpoint retained'),{transportBudgetExceeded:true,attempts});
   const ordered=endpoints.map((_,i)=>endpoints[(cursor+i)%endpoints.length]);
   // Rotation breaks ties, but an expired cooldown does not erase a history
   // of failures when another eligible endpoint has actually succeeded.
   let endpoint=ordered.filter(e=>(cooldown.get(e)||0)<=now()).sort((a,b)=>(failures.get(a)||0)-(failures.get(b)||0))[0];
   if(!endpoint){endpoint=ordered.reduce((a,b)=>(cooldown.get(a)||0)<=(cooldown.get(b)||0)?a:b);const delay=cooldown.get(endpoint)-now();if(now()-started+delay>=maxSessionMs)throw Object.assign(Error('Endpoint cooldown exceeds capture deadline'),{transportBudgetExceeded:true,attempts});await sleep(delay);}
   cursor=(endpoints.indexOf(endpoint)+1)%endpoints.length;
   const controller=new AbortController(),at=now(),timer=setTimeout(()=>controller.abort(),timeoutMs);let wait=0,observed;
   try{
    const response=await fetchFn(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'reforma-teritoriala-osm-source/1.0'},body:new URLSearchParams({data:query}),signal:controller.signal});
    const body=await response.text(),record={purpose,endpoint,query_sha256:hash(query),attempt:attempt+1,started_at:new Date(at).toISOString(),duration_ms:now()-at,http_status:response.status,body_bytes:Buffer.byteLength(body),body_sha256:hash(body)};
    observed=record;await onResponse(record,body);
    wait=retryAfterMs(response.headers.get('retry-after'),now());
    if(!response.ok){const error=Error(`Overpass HTTP ${response.status}`);error.record=record;error.retryable=[429,500,502,503,504].includes(response.status);throw error;}
    const raw=JSON.parse(body);assert.ok(Array.isArray(raw.elements)&&!raw.remark,'Partial Overpass response or missing elements');
    failures.delete(endpoint);cooldown.delete(endpoint);
    Object.assign(record,{status:'success',element_count:raw.elements.length,osm_timestamp:raw.osm3s?.timestamp_osm_base??null});attempts.push(record);onAttempt(record);return {raw,body,endpoint,attempts};
   }catch(error){
    last=error;const consecutive=(failures.get(endpoint)||0)+1;failures.set(endpoint,consecutive);const healthDelay=Math.max(wait,Math.min(300000,2000*2**Math.min(consecutive-1,8)));cooldown.set(endpoint,now()+healthDelay);const record={...observed,...error.record,purpose,endpoint,attempt:attempt+1,started_at:new Date(at).toISOString(),duration_ms:now()-at,status:'failure',timeout:controller.signal.aborted,consecutive_failures:consecutive,cooldown_ms:healthDelay,error:error.message};attempts.push(record);onAttempt(record);
    if(error.transportBudgetExceeded)throw Object.assign(error,{attempts});
    if(error.retryable===false)break;
   }finally{clearTimeout(timer);}
   if(attempt+1<maxAttempts){const delay=Math.max(wait,Math.min(10000,2000*2**attempt));if(now()-started+delay>=maxSessionMs)throw Object.assign(Error('OSM retry exceeds session deadline; checkpoint retained'),{transportBudgetExceeded:true,attempts});await sleep(delay);}
  }
  throw Object.assign(Error(`Overpass ${purpose} failed after ${attempts.length} bounded attempts: ${last?.message}`),{attempts});
 };
}
// Categories are transport buckets only. Regional hints require explicit source
// subarea membership; unassigned relations remain in a complete fallback bucket.
export function partitionInventory(relations,size=100){
 assert.ok(Number.isInteger(size)&&size>0);const regions=new Map();for(const r of relations.filter(r=>String(r.tags?.admin_level)==='4'))for(const m of r.members||[])if(m.type==='relation'&&m.role==='subarea'&&!regions.has(Number(m.ref)))regions.set(Number(m.ref),r.id);
 const buckets=new Map(),seen=new Set();for(const r of relations){assert.ok(!seen.has(r.id),'Duplicate inventory relation');seen.add(r.id);const k=`${r.tags?.admin_level??'country'}:${regions.get(r.id)??'unassigned'}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r.id);}
 const chunks=[];for(const [category,ids] of [...buckets].sort(([a],[b])=>a.localeCompare(b))){ids.sort((a,b)=>a-b);for(let i=0;i<ids.length;i+=size)chunks.push({category,ids:ids.slice(i,i+size)});}assert.deepEqual(chunks.flatMap(c=>c.ids).sort((a,b)=>a-b),[...seen].sort((a,b)=>a-b));return chunks;
}
export async function openCaptureCheckpoint({directory,country,scopeSha,sourceSha,resume=false,now=Date.now,deferredSubareas=new Set()}){
 assert.match(country,/^[A-Z]{2}$/);assert.match(scopeSha,/^[a-f0-9]{64}$/);assert.match(sourceSha,/^[a-f0-9]{40}$/);
 const outputRoot=path.resolve('outputs')+path.sep,root=path.resolve(directory,country);assert.ok(root.startsWith(outputRoot),'Capture checkpoint must stay below outputs/');await mkdir(root,{recursive:true});let state,folder;
 if(resume){const pointer=JSON.parse(await readFile(path.join(root,'latest.json'),'utf8'));assert.match(pointer.session,/^session-\d+$/);assert.match(pointer.state,/^state-[a-f0-9]{64}\.json$/);folder=path.join(root,pointer.session);const b=await readFile(path.join(folder,pointer.state));assert.equal(hash(b),pointer.sha256,'Checkpoint state hash mismatch');state=JSON.parse(b);assert.equal(state.schema,'osm-capture-checkpoint-v1');assert.equal(state.scope_sha256,scopeSha);assert.equal(state.source_sha,sourceSha);assert.equal(state.country,country);assert.ok(now()-Date.parse(state.started_at)<=3600000&&now()>=Date.parse(state.started_at),'Capture checkpoint expired or timestamp is in the future');}
 else{folder=path.join(root,`session-${now()}`);await mkdir(folder,{recursive:true});state={schema:'osm-capture-checkpoint-v1',country,scope_sha256:scopeSha,source_sha:sourceSha,started_at:new Date(now()).toISOString(),epoch:null,inventory:null,chunks:{},complete:false};}
 const persist=async()=>{const b=Buffer.from(JSON.stringify(state,null,2)+'\n'),name=`state-${hash(b)}.json`;await writeFile(path.join(folder,name),b);const pointer=JSON.stringify({session:path.basename(folder),state:name,sha256:hash(b)},null,2)+'\n',tmp=path.join(root,'latest.tmp');await writeFile(tmp,pointer);await rename(tmp,path.join(root,'latest.json'));};
 const load=async record=>{assert.match(record.file,/^[a-f0-9]{64}\.json\.gz$/);const packed=await readFile(path.join(folder,record.file));assert.equal(hash(packed),record.compressed_sha256,'Checkpoint compressed hash mismatch');const body=gunzipSync(packed);assert.equal(hash(body),record.body_sha256,'Checkpoint original body hash mismatch');const raw=JSON.parse(body);assertCaptureEpoch(raw,state.epoch);return {raw,body:body.toString(),endpoint:record.endpoint,attempts:record.attempts};};
 const save=async(result,ids)=>{assertCaptureEpoch(result.raw,state.epoch);if(ids)assertShardClosure(result.raw,ids,deferredSubareas);const body=Buffer.from(result.body??JSON.stringify(result.raw));assert.equal(canonical(JSON.parse(body)),canonical(result.raw),'Checkpoint bytes differ from captured response');const packed=gzipSync(body,{level:9}),file=hash(packed)+'.json.gz';await writeFile(path.join(folder,file),packed);return {file,body_representation:result.body?'ORIGINAL_HTTP_RESPONSE':'ASSEMBLED_VALIDATED_OSM_ELEMENTS',compressed_sha256:hash(packed),body_sha256:hash(body),endpoint:result.endpoint??null,attempts:result.attempts??[],ids};};
 const part=async(ids,result)=>{const key=hash(JSON.stringify(ids));if(!result){const entry=state.subchunks?.[key];if(!entry)return null;assert.deepEqual(entry.ids,ids);const loaded=await load(entry);assertShardClosure(loaded.raw,ids,deferredSubareas);return loaded;}const saved=await save(result,ids);state.subchunks??={};state.subchunks[key]=saved;await persist();return result;};
 return {state,subchunk:part,async inventory(result){if(!result){assert.ok(state.inventory,'Missing resumed inventory');return load(state.inventory);}state.epoch=result.raw.osm3s?.timestamp_osm_base;assert.ok(state.epoch&&Date.parse(state.epoch)<=now(),'Missing or future inventory watermark');state.inventory=await save(result);await persist();return result;},async chunk(ids,result){const key=hash(JSON.stringify(ids));if(!result){const entry=state.chunks[key];if(!entry)return null;assert.deepEqual(entry.ids,ids);const loaded=await load(entry);assertShardClosure(loaded.raw,ids,deferredSubareas);return loaded;}state.chunks[key]=await save(result,ids);await persist();return result;},async finish(ids,finalRaw){assert.deepEqual(Object.values(state.chunks).flatMap(c=>c.ids).sort((a,b)=>a-b),[...ids].sort((a,b)=>a-b),'Incomplete checkpoint inventory coverage');assertCaptureEpoch(finalRaw,state.epoch);assertRelationClosure(finalRaw,ids);state.complete=true;await persist();},async persist(){await persist();}};
}
