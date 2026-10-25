import {osmElementIndex,mergeOsmElements} from './osm-element-index.mjs';
// Sequential and bounded: split a failed chunk, then use authoritative full
// responses at leaves. Successful but incomplete responses also fail closed.
export function assertRelationClosure(raw, ids) {
 const byKey=osmElementIndex(raw);
 const visit=(type,id,seen=new Set())=>{
  const key=`${type}/${id}`;
  if(seen.has(key))return;
  seen.add(key);
  const e=byKey.get(key);
  if(!e)throw new Error(`Incomplete OSM dependency ${key}`);
  if(type==='relation')for(const m of e.members||[])visit(m.type,m.ref,seen);
  if(type==='way')for(const n of e.nodes||[])visit('node',n,seen);
 };
 for(const id of ids)visit('relation',id);
}
export async function fetchAdaptiveRelations(ids,{fetchChunk,fetchFull,attempts,purpose='relations'}) {
 if(!Array.isArray(ids)||ids.length===0||!ids.every(id=>Number.isSafeInteger(id)&&id>0)||new Set(ids).size!==ids.length)throw new Error('OSM selection must be non-empty distinct positive integer IDs');
 try {
  const result=await fetchChunk(ids,purpose);
  attempts.push(...result.attempts);
  assertRelationClosure(result.raw,ids);
  return result.raw;
 } catch(error) {
  if(error.transportBudgetExceeded)throw error;
  attempts.push(...(error.attempts||[]),{purpose,status:'adaptive_fallback',relation_ids:ids,error:error.message});
  if(ids.length===1){
   const result=await fetchFull(ids[0]);
   attempts.push(...result.attempts);
   assertRelationClosure(result.raw,ids);
   return result.raw;
  }
  const mid=Math.floor(ids.length/2),elements=new Map();
  for(const [index,part] of [ids.slice(0,mid),ids.slice(mid)].entries()){
   const raw=await fetchAdaptiveRelations(part,{fetchChunk,fetchFull,attempts,purpose:`${purpose}.${index+1}`});
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
