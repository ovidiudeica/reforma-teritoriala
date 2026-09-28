#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';

const MANIFEST='data/sources/osm-current.json';
const SNAPSHOT_DIR='data/sources/osm-snapshots';
const QUERY_VERSION=1;
const MANIFEST_SCHEMA_VERSION=2;
const DEFAULT_ENDPOINTS=[
 'https://overpass-api.de/api/interpreter',
 'https://overpass.kumi.systems/api/interpreter',
 'https://overpass.private.coffee/api/interpreter'
];
const positiveInt=(value,fallback)=>{
 const n=Number(value);
 return Number.isInteger(n)&&n>0?n:fallback;
};
const ENDPOINTS=(process.env.OVERPASS_ENDPOINTS||'').split(',').map(x=>x.trim()).filter(Boolean);
if(!ENDPOINTS.length)ENDPOINTS.push(...DEFAULT_ENDPOINTS);
const RETRIES_PER_ENDPOINT=positiveInt(process.env.OVERPASS_RETRIES_PER_ENDPOINT,2);
const REQUEST_TIMEOUT_MS=positiveInt(process.env.OVERPASS_REQUEST_TIMEOUT_MS,90000);
const RETRY_BACKOFF_MS=positiveInt(process.env.OVERPASS_RETRY_BACKOFF_MS,5000);
const countries={
 RO:{name:'România',iso:'RO',levels:[4,8,9],requiredLevels:[4,8,9],requiredRelations:[],minElements:10000},
 MD:{name:'Republica Moldova',iso:'MD',levels:[4,6,8,9],requiredLevels:[4,8,9],requiredRelations:[1813306,1813297,58512,1813315,1813316],minElements:10000}
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sha256=value=>createHash('sha256').update(value).digest('hex');
const snapshotPath=(code,semanticSha)=>`${SNAPSHOT_DIR}/${code.toLowerCase()}-${semanticSha}.json.gz`;
const canonicalize=value=>{
 if(Array.isArray(value))return value.map(canonicalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalize(value[k])]));
 return value;
};
const typeOrder={node:0,way:1,relation:2};
const queryFor=({iso,levels,requiredRelations=[]})=>{
 const filters=levels.map(l=>`relation(area.country)["boundary"="administrative"]["admin_level"="${l}"];`).join('\n');
 const required=requiredRelations.map(id=>`relation(${id});`).join('\n');
 return `[out:json][timeout:300];relation["ISO3166-1"="${iso}"]["boundary"="administrative"]->.countryRel;.countryRel map_to_area ->.country;(.countryRel;${filters}${required ? `\n${required}` : ''});out body;>;out skel qt;`;
};
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
async function fetchCountry(code,cfg){
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
    const body=await response.text();
    if(!response.ok)throw new Error(`${endpoint} HTTP ${response.status}: ${body.slice(0,240).replace(/\s+/g,' ')}`);
    let raw;
    try{raw=JSON.parse(body);}catch(error){throw new Error(`${endpoint} returned invalid JSON: ${error.message}`);}
    const counts=validateRaw(raw,code,cfg);
    const canonical=canonicalRaw(raw);
    const semanticSha=sha256(canonical);
    const compressed=gzipSync(Buffer.from(canonical),{level:9,mtime:0});
    const compressedSha=sha256(compressed);
    attempts.push({endpoint,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'success',element_count:counts.element_count});
    console.log(`Overpass ${code}: accepted ${counts.element_count} elements from ${endpoint} on attempt ${attempt}/${RETRIES_PER_ENDPOINT}`);
    return {canonical,compressed,semanticSha,compressedSha,counts,endpoint,querySha256:sha256(query),attempts};
   }catch(error){
    const timedOut=controller.signal.aborted;
    const message=timedOut?`request timeout after ${REQUEST_TIMEOUT_MS}ms`:String(error?.message||error);
    lastError=new Error(`Overpass ${code} failed at ${endpoint} attempt ${attempt}/${RETRIES_PER_ENDPOINT}: ${message}`);
    attempts.push({endpoint,attempt,started_at:startedAt,duration_ms:Date.now()-started,status:'failure',timeout:timedOut,error:message});
    console.warn(lastError.message);
    if(attempt<RETRIES_PER_ENDPOINT)await sleep(RETRY_BACKOFF_MS*attempt);
   }finally{
    clearTimeout(timer);
   }
  }
 }
 throw new Error(`All Overpass endpoints failed closed for ${code}: ${JSON.stringify(attempts)}`,{cause:lastError});
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
  const existingSha=sha256(existing);
  if(existingSha!==result.compressedSha)throw new Error(`OSM ${code} content-addressed snapshot collision at ${path}`);
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
 const fresh={};
 for(const [code,cfg] of Object.entries(countries))fresh[code]=await fetchCountry(code,cfg);
 for(const [code,result] of Object.entries(fresh))result.snapshotPath=await materializeContentAddressedSnapshot(code,result);

 const unchanged=Boolean(previous)&&Object.keys(countries).every(code=>
  previous.countries?.[code]?.semantic_sha256===fresh[code].semanticSha&&
  previous.countries?.[code]?.compressed_sha256===fresh[code].compressedSha
 );
 const status=unchanged?'UNCHANGED':'UPDATED';
 const manifest=unchanged?previous:{
  schema_version:MANIFEST_SCHEMA_VERSION,
  source:'OpenStreetMap',
  transport:'Overpass API',
  query_version:QUERY_VERSION,
  fetched_at:fetchedAt,
  snapshot_directory:SNAPSHOT_DIR,
  countries:Object.fromEntries(Object.entries(countries).map(([code,cfg])=>[code,{
   name:cfg.name,
   iso:cfg.iso,
   levels:cfg.levels,
   required_levels:cfg.requiredLevels,
   required_relations:cfg.requiredRelations,
   snapshot_path:fresh[code].snapshotPath,
   semantic_sha256:fresh[code].semanticSha,
   compressed_sha256:fresh[code].compressedSha,
   query_sha256:fresh[code].querySha256,
   element_count:fresh[code].counts.element_count,
   relation_count:fresh[code].counts.relation_count,
   endpoint:fresh[code].endpoint
  }]))
 };
 if(!unchanged)await writeAtomic(MANIFEST,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 console.log(JSON.stringify({
  status,
  manifest:MANIFEST,
  fetched_at:manifest.fetched_at,
  previous_fetched_at:previous?.fetched_at??null,
  countries:Object.fromEntries(Object.keys(countries).map(code=>[code,{
   element_count:fresh[code].counts.element_count,
   relation_count:fresh[code].counts.relation_count,
   semantic_sha256:fresh[code].semanticSha,
   compressed_sha256:fresh[code].compressedSha,
   snapshot_path:fresh[code].snapshotPath,
   endpoint:fresh[code].endpoint
  }]))
 },null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
