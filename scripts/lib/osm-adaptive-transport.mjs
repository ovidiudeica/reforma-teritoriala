// Sequential and bounded: split a failed chunk, then use authoritative full
// responses at leaves. Successful but incomplete responses also fail closed.
import {mergeOsmElements} from './osm-element-merge.mjs';
function checkRelationClosure(raw, ids, deferredSubareas) {
 const byKey=new Map((raw?.elements||[]).map(e=>[`${e.type}/${e.id}`,e]));
 const visit=(type,id,seen=new Set())=>{
  const key=`${type}/${id}`;
  if(seen.has(key))return;
  seen.add(key);
  const e=byKey.get(key);
  if(!e)throw new Error(`Incomplete OSM dependency ${key}`);
  if(type==='node'&&(!Number.isFinite(e.lat)||!Number.isFinite(e.lon)))throw new Error(`Incomplete OSM coordinates ${key}`);
  if(type==='relation')for(const m of e.members||[]){if(m.type==='relation'&&m.role==='subarea'&&deferredSubareas.has(Number(m.ref)))continue;visit(m.type,m.ref,seen);}
  if(type==='way')for(const n of e.nodes||[])visit('node',n,seen);
 };
 for(const id of ids)visit('relation',id);
}
export function assertRelationClosure(raw,ids){checkRelationClosure(raw,ids,new Set());}
// Only explicitly inventoried non-geometric subarea relations can wait for
// their own shards. The final whole-source check never uses this deferral.
export function assertShardClosure(raw,ids,deferredSubareas){checkRelationClosure(raw,ids,deferredSubareas);}
// relation/full includes child relations without recursively expanding their
// ways/nodes. Recover only real referenced objects; never invent closure.
export async function completeOsmDependencies(raw,ids,{fetchMissing,maxRequests=1000,deferredSubareas=new Set()}){
 const byKey=new Map((raw?.elements||[]).map(e=>[`${e.type}/${e.id}`,e]));
 const queue=ids.map(id=>({type:'relation',id})),seen=new Set();let requests=0;
 for(let i=0;i<queue.length;i++){
  const {type,id}=queue[i],key=`${type}/${id}`;
  if(!['relation','way','node'].includes(type)||!Number.isSafeInteger(Number(id))||Number(id)<=0)throw new Error('Invalid OSM dependency '+key);
  if(seen.has(key))continue;
  let element=byKey.get(key);
  if(!element||(type==='node'&&(!Number.isFinite(element.lat)||!Number.isFinite(element.lon)))){
   if(++requests>maxRequests)throw new Error('OSM dependency recovery request budget exhausted at '+key);
   const fetched=await fetchMissing(type,Number(id));
   if(!fetched?.elements?.some(e=>e.type===type&&Number(e.id)===Number(id)))throw new Error('Incomplete authoritative OSM dependency '+key);
   mergeOsmElements(byKey,fetched.elements);
   element=byKey.get(key);
   if(type==='node'&&(!Number.isFinite(element.lat)||!Number.isFinite(element.lon)))throw new Error('Incomplete authoritative OSM coordinates '+key);
  }
  seen.add(key);
  if(type==='relation')for(const m of element.members||[]){if(m.type==='relation'&&m.role==='subarea'&&deferredSubareas.has(Number(m.ref)))continue;queue.push({type:m.type,id:m.ref});}
  if(type==='way')for(const n of element.nodes||[])queue.push({type:'node',id:n});
 }
 const result={...raw,elements:[...byKey.values()]};
 assertShardClosure(result,ids,deferredSubareas);
 return result;
}
export async function fetchAdaptiveRelations(ids,options) {
 const {loadPart,savePart,attempts,deferredSubareas=new Set()}=options;
 // Persistence errors must propagate, rather than being mistaken for an
 // overloaded endpoint and silently falling back to an unverified capture.
 const cached=await loadPart?.(ids);
 if(cached){assertShardClosure(cached.raw,ids,deferredSubareas);attempts.push(...cached.attempts);return cached.raw;}
 const first=attempts.length,raw=await fetchUncachedRelations(ids,options);
 assertShardClosure(raw,ids,deferredSubareas);
 await savePart?.(ids,raw,attempts.slice(first));
 return raw;
}
async function fetchUncachedRelations(ids,{fetchChunk,fetchFull,attempts,purpose='relations',preferFullAtSingleton=false,deferredSubareas=new Set(),loadPart,savePart}) {
 if(ids.length===1&&preferFullAtSingleton){const result=await fetchFull(ids[0]);attempts.push(...result.attempts);assertShardClosure(result.raw,ids,deferredSubareas);return result.raw;}
 try {
  const result=await fetchChunk(ids,purpose);
  attempts.push(...result.attempts);
  assertShardClosure(result.raw,ids,deferredSubareas);
  return result.raw;
 } catch(error) {
  if(error.transportBudgetExceeded)throw error;
  attempts.push(...(error.attempts||[]),{purpose,status:'adaptive_fallback',relation_ids:ids,error:error.message});
  if(ids.length===1){
   const result=await fetchFull(ids[0]);
   attempts.push(...result.attempts);
   assertShardClosure(result.raw,ids,deferredSubareas);
   return result.raw;
  }
  const mid=Math.floor(ids.length/2),elements=new Map();
  for(const [index,part] of [ids.slice(0,mid),ids.slice(mid)].entries()){
   const raw=await fetchAdaptiveRelations(part,{fetchChunk,fetchFull,attempts,purpose:`${purpose}.${index+1}`,preferFullAtSingleton,deferredSubareas,loadPart,savePart});
   mergeOsmElements(elements,raw.elements);
  }
  return {version:0.6,elements:[...elements.values()]};
 }
}
export function retryAfterMs(value,now=Date.now()) {
 if(value==null)return 0;
 const seconds=Number(value);
 const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
 if(!Number.isFinite(delay)||delay<0)return 0;
 // Never retry earlier than the server permits; excessive waits fail closed.
 if(delay>60000)throw Object.assign(new Error('Retry-After exceeds bounded 60000ms transport budget'),{transportBudgetExceeded:true});
 return delay;
}
