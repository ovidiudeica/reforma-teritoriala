// Fetch unique referenced objects, not the same recursive geometry per relation.
// Transport buckets confer no administrative or legal meaning.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {assertCaptureEpoch,mergeOsmElements} from './osm-capture-session.mjs';
import {assertRelationClosure} from './osm-adaptive-transport.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const positive=id=>Number.isSafeInteger(id)&&id>0;
const sorted=ids=>[...new Set(ids)].sort((a,b)=>a-b);
export function objectQuery(type,ids,epoch){
 assert.ok(['relation','way','node'].includes(type));assert.ok(ids.length>0&&ids.every(positive));
 const date=new Date(epoch).toISOString();
 return `[out:json][timeout:15][date:"${date}"];${type}(id:${ids.join(',')});out meta;`;
}
export function assertObjectBatch(raw,type,ids,epoch){
 assert.ok(['relation','way','node'].includes(type)&&ids.length>0&&ids.every(positive),'Invalid typed object batch identity');
 assertCaptureEpoch(raw,epoch);
 assert.deepEqual(sorted(ids),[...ids].sort((a,b)=>a-b),'Duplicate requested object identity');
 assert.ok(raw.elements.every(e=>e.type===type),'Unexpected object type in explicit batch');
 assert.deepEqual(raw.elements.map(e=>e.id).sort((a,b)=>a-b),[...ids].sort((a,b)=>a-b),'Missing, duplicate or unexpected OSM object');
 for(const e of raw.elements){
  if(type==='node')assert.ok(Number.isFinite(e.lat)&&Math.abs(e.lat)<=90&&Number.isFinite(e.lon)&&Math.abs(e.lon)<=180,'Invalid node coordinates');
  if(type==='way')assert.ok(Array.isArray(e.nodes)&&e.nodes.every(positive),'Invalid way node references');
  if(type==='relation')assert.ok(Array.isArray(e.members)&&e.members.every(m=>['relation','way','node'].includes(m.type)&&positive(m.ref)&&typeof m.role==='string'),'Invalid relation members');
 }
}
export async function acquireLayeredClosure(inventory,{epoch,fetchObjects,fetchOne,loadPart,savePart,budget=()=>{},relationSize=100,waySize=200,nodeSize=2000,onBatch=()=>{}}){
 const roots=inventory.elements.map(e=>e.id);assertObjectBatch(inventory,'relation',roots,epoch);
 for(const size of [relationSize,waySize,nodeSize])assert.ok(Number.isInteger(size)&&size>0);
 const elements=new Map();mergeOsmElements(elements,inventory.elements);
 const batch=async(type,ids)=>{
  budget();const cached=await loadPart?.(type,ids);
  // A corrupt cached response is an integrity error, never a network fallback.
  if(cached){assertObjectBatch(cached.raw,type,ids,epoch);return cached.raw;}
  let result;
  try{result=await fetchObjects(type,ids,epoch);assert.ok(result.raw.osm3s?.timestamp_osm_base,'Missing object response replication watermark');assertObjectBatch(result.raw,type,ids,epoch);}
  catch(error){
   if(error.transportBudgetExceeded)throw error;
   if(ids.length===1){
    if(!fetchOne)throw error;
    const one=await fetchOne(type,ids[0]);assertCaptureEpoch(one.raw,epoch);
    result={raw:{...one.raw,elements:one.raw.elements.filter(e=>e.type===type&&e.id===ids[0])},attempts:one.attempts};
    assertObjectBatch(result.raw,type,ids,epoch);
   }else{
    const middle=Math.floor(ids.length/2),merged=new Map();
    for(const part of [ids.slice(0,middle),ids.slice(middle)])mergeOsmElements(merged,(await batch(type,part)).elements);
    result={raw:{version:0.6,elements:[...merged.values()]},attempts:[]};
    assertObjectBatch(result.raw,type,ids,epoch);
   }
  }
  // Failed persistence must stop the capture; it cannot be reclassified as HTTP.
  await savePart?.(type,ids,result);onBatch(type,ids,result);return result.raw;
 };
 const collect=async(type,ids,size)=>{
  const missing=sorted(ids).filter(id=>!elements.has(type+'/'+id));
  for(let i=0;i<missing.length;i+=size)mergeOsmElements(elements,(await batch(type,missing.slice(i,i+size))).elements);
  return missing.length;
 };
 while(true){
  const childIds=[...elements.values()].filter(e=>e.type==='relation').flatMap(e=>e.members.filter(m=>m.type==='relation').map(m=>m.ref));
  if(!(await collect('relation',childIds,relationSize)))break;
 }
 const members=[...elements.values()].filter(e=>e.type==='relation').flatMap(e=>e.members);
 await collect('way',members.filter(m=>m.type==='way').map(m=>m.ref),waySize);
 const nodeIds=[...members.filter(m=>m.type==='node').map(m=>m.ref),...[...elements.values()].filter(e=>e.type==='way').flatMap(e=>e.nodes)];
 await collect('node',nodeIds,nodeSize);
 const raw={version:0.6,elements:[...elements.values()]};
 assertCaptureEpoch(raw,epoch);assertRelationClosure(raw,roots);return raw;
}
// Same exact-head, one-hour restore boundary as the relation-shard transport.
// The archive layout stays compatible; the schema/scope deliberately reject a
// legacy or foreign transport checkpoint rather than relabeling its epoch.
export async function openObjectCheckpoint({directory,country,sourceSha,scopeSha,resume=false,now=Date.now}){
 assert.match(country,/^(RO|MD)$/);assert.match(sourceSha,/^[a-f0-9]{40}$/);assert.match(scopeSha,/^[a-f0-9]{64}$/);
 const root=path.resolve(directory,country);assert.ok(root.startsWith(path.resolve('outputs')+path.sep));await mkdir(root,{recursive:true});
 let state,folder;
 if(resume){
  const pointer=JSON.parse(await readFile(path.join(root,'latest.json'),'utf8'));assert.match(pointer.session,/^session-\d+$/);assert.match(pointer.state,/^state-[a-f0-9]{64}\.json$/);
  folder=path.join(root,pointer.session);const body=await readFile(path.join(folder,pointer.state));assert.equal(hash(body),pointer.sha256);
  state=JSON.parse(body);assert.equal(state.schema,'osm-object-capture-v1');assert.equal(state.country,country);assert.equal(state.source_sha,sourceSha);assert.equal(state.scope_sha256,scopeSha);
  assert.ok(Number.isFinite(Date.parse(state.started_at))&&now()>=Date.parse(state.started_at)&&now()-Date.parse(state.started_at)<=3600000,'Checkpoint expired or future');
 }else{
  folder=path.join(root,'session-'+now());await mkdir(folder,{recursive:true});state={schema:'osm-object-capture-v1',country,source_sha:sourceSha,scope_sha256:scopeSha,started_at:new Date(now()).toISOString(),epoch:null,inventory:null,objects:{},plan:null,complete:false};
 }
 const persist=async()=>{
  const bytes=Buffer.from(JSON.stringify(state,null,2)+'\n'),name='state-'+hash(bytes)+'.json';await writeFile(path.join(folder,name),bytes);
  const pointer=JSON.stringify({session:path.basename(folder),state:name,sha256:hash(bytes)},null,2)+'\n',tmp=path.join(root,'latest.tmp');await writeFile(tmp,pointer);await rename(tmp,path.join(root,'latest.json'));
 };
 const load=async record=>{
  assert.match(record.file,/^[a-f0-9]{64}\.json\.gz$/);const packed=await readFile(path.join(folder,record.file));assert.equal(hash(packed),record.compressed_sha256,'Compressed checkpoint SHA mismatch');
  const body=gunzipSync(packed,{maxOutputLength:64*1024*1024});assert.equal(hash(body),record.body_sha256,'Original checkpoint SHA mismatch');const raw=JSON.parse(body);assertCaptureEpoch(raw,state.epoch);
  return {raw,body:body.toString(),attempts:record.attempts,endpoint:record.endpoint};
 };
 const save=async result=>{
  assertCaptureEpoch(result.raw,state.epoch);const body=Buffer.from(result.body??JSON.stringify(result.raw));assert.equal(JSON.stringify(JSON.parse(body)),JSON.stringify(result.raw),'Captured body/raw mismatch');
  const packed=gzipSync(body,{level:9}),file=hash(packed)+'.json.gz';await writeFile(path.join(folder,file),packed);
  return {file,compressed_sha256:hash(packed),body_sha256:hash(body),attempts:result.attempts??[],endpoint:result.endpoint??null,body_representation:result.body?'ORIGINAL_HTTP_RESPONSE':'ASSEMBLED_VALIDATED_OSM_ELEMENTS'};
 };
 return {state,async inventory(result){
  if(!result){assert.ok(state.inventory);const saved=await load(state.inventory);assertObjectBatch(saved.raw,'relation',saved.raw.elements.map(e=>e.id),state.epoch);return saved;}
  state.epoch=result.raw.osm3s?.timestamp_osm_base;assert.ok(Number.isFinite(Date.parse(state.epoch))&&Date.parse(state.epoch)<=now(),'Missing/future inventory epoch');
  assert.ok(now()-Date.parse(state.epoch)<=14*86400000,'Historical inventory exceeds unchanged source freshness policy');
  assertObjectBatch(result.raw,'relation',result.raw.elements.map(e=>e.id),state.epoch);state.inventory=await save(result);await persist();return result;
 },async plan(ids){
  assert.ok(ids.length&&ids.every(positive));assert.equal(sorted(ids).length,ids.length);
  if(state.plan)assert.deepEqual(state.plan,sorted(ids),'Restored selected relation plan differs');else{state.plan=sorted(ids);await persist();}
 },async objects(type,ids,result){
  const key=hash(JSON.stringify([type,ids]));
  if(!result){const record=state.objects[key];if(!record)return null;assert.equal(record.type,type);assert.deepEqual(record.ids,ids);const loaded=await load(record);assertObjectBatch(loaded.raw,type,ids,state.epoch);return loaded;}
  assertObjectBatch(result.raw,type,ids,state.epoch);state.objects[key]={...await save(result),type,ids};await persist();return result;
 },async finish(ids,raw){
  assert.ok(state.plan);assert.equal(ids.length,sorted(ids).length,'Duplicate final selected identity');assert.deepEqual(state.plan,sorted(ids),'Final selected relation plan differs');assertCaptureEpoch(raw,state.epoch);assertRelationClosure(raw,ids);
  // Closure alone is insufficient: every final object must also be backed by
  // independently hash-verified persisted inventory/batch bytes. Reconstruct
  // those bytes rather than trusting an assembled final graph from the caller.
  const original=await load(state.inventory),backing=new Map();mergeOsmElements(backing,original.raw.elements);
  for(const record of Object.values(state.objects)){
   const saved=await load(record);assertObjectBatch(saved.raw,record.type,record.ids,state.epoch);mergeOsmElements(backing,saved.raw.elements);
  }
  assertRelationClosure({elements:[...backing.values()]},ids);
  assert.deepEqual([...backing.keys()].sort(),raw.elements.map(e=>e.type+'/'+e.id).sort(),'Final object inventory differs from checkpoint backing');
  mergeOsmElements(backing,raw.elements);
  state.complete=true;await persist();
 }};
}
