#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import * as XLSX from 'xlsx';

const URL=process.env.CUATM_URL||'https://statistica.gov.md/files/files/Clasificatoare/CUATM_25.xlsx';
const SNAPSHOT='data/sources/cuatm-current.json';
const positiveInt=(value,fallback)=>{
 const n=Number(value);
 return Number.isInteger(n)&&n>0?n:fallback;
};
const REQUEST_TIMEOUT_MS=positiveInt(process.env.CUATM_REQUEST_TIMEOUT_MS,60000);
const RETRIES=positiveInt(process.env.CUATM_RETRIES,2);
const RETRY_BACKOFF_MS=positiveInt(process.env.CUATM_RETRY_BACKOFF_MS,3000);
const REQUIRED=['CodUnic','ParentCodUnic','CodStatistic','ParentCodStatistic','Statut','DenumireRO','DenumireRU'];
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[„”"'’]/g,'').replace(/\b(municipiul|municipiu|orasul|oras|comuna|satul|sat|raionul|raion|sectorul|sector)\b/g,' ').replace(/[^a-z0-9ăâîșț]+/gi,' ').trim().replace(/\s+/g,' ');
const digits=v=>String(v??'').replace(/\.0$/,'').replace(/\s/g,'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha256=value=>createHash('sha256').update(value).digest('hex');

function validateSnapshot(snapshot,label='snapshot'){
 if(!snapshot||typeof snapshot!=='object')throw new Error(label+' must be an object');
 if(snapshot.source_url!==URL&&label==='downloaded snapshot')throw new Error(label+' source_url mismatch');
 if(!snapshot.schema||REQUIRED.some(name=>!Object.values(snapshot.schema).includes(name)))throw new Error(label+' CUATM schema mapping is incomplete');
 if(!Array.isArray(snapshot.records)||snapshot.records.length<500)throw new Error(label+' contains too few records');
 if(Number(snapshot.record_count)!==snapshot.records.length)throw new Error(label+' record_count mismatch');
 const seen=new Set();
 for(const row of snapshot.records){
  if(!/^\d{3,10}$/.test(String(row.code||'')))throw new Error(label+' contains invalid CUATM code');
  if(!String(row.name||'').trim())throw new Error(label+' contains empty CUATM name');
  if(seen.has(row.code))throw new Error(label+' contains duplicate CUATM code '+row.code);
  seen.add(row.code);
 }
 return snapshot;
}

function parseWorkbook(buffer){
 if(buffer.length<10000)throw new Error('CUATM download unexpectedly small: '+buffer.length);
 const workbook=XLSX.read(buffer,{type:'buffer'});
 const records=[];
 for(const sheet of workbook.SheetNames){
  const matrix=XLSX.utils.sheet_to_json(workbook.Sheets[sheet],{header:1,defval:null,raw:false,blankrows:false});
  if(!matrix.length)continue;
  const headers=(matrix[0]||[]).map(v=>String(v??'').replace(/^\uFEFF/,'').trim());
  const col=name=>headers.indexOf(name);
  const missing=REQUIRED.filter(name=>col(name)<0);
  if(missing.length)throw new Error('CUATM schema missing columns in '+sheet+': '+missing.join(', '));
  for(let i=1;i<matrix.length;i++){
   const row=matrix[i]||[];
   const code=digits(row[col('CodUnic')]),name=String(row[col('DenumireRO')]??'').trim();
   if(!/^\d{3,10}$/.test(code)||!name)continue;
   records.push({
    code,
    parent_code:digits(row[col('ParentCodUnic')])||null,
    statistical_code:digits(row[col('CodStatistic')])||null,
    parent_statistical_code:digits(row[col('ParentCodStatistic')])||null,
    status_code:digits(row[col('Statut')])||null,
    name,
    name_ru:String(row[col('DenumireRU')]??'').trim()||null,
    normalized_name:norm(name),
    sheet,
    row:i+1
   });
  }
 }
 const deduped=[...new Map(records.map(x=>[x.code,x])).values()];
 if(deduped.length<500)throw new Error('CUATM parse produced too few records: '+deduped.length);
 const byCode=new Map(deduped.map(x=>[x.code,x]));
 for(const row of deduped)row.parent_name=row.parent_code?byCode.get(row.parent_code)?.name||null:null;
 return deduped;
}

async function fetchBuffer(){
 let lastError=null;
 for(let attempt=1;attempt<=RETRIES;attempt++){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new Error('CUATM request timeout after '+REQUEST_TIMEOUT_MS+'ms')),REQUEST_TIMEOUT_MS);
  try{
   const response=await fetch(URL,{
    headers:{'user-agent':'reforma-teritoriala-cuatm/2.0'},
    signal:controller.signal
   });
   if(!response.ok)throw new Error('CUATM download failed: HTTP '+response.status);
   return Buffer.from(await response.arrayBuffer());
  }catch(error){
   const message=controller.signal.aborted?'CUATM request timeout after '+REQUEST_TIMEOUT_MS+'ms':String(error?.message||error);
   lastError=new Error('CUATM attempt '+attempt+'/'+RETRIES+' failed: '+message);
   console.warn(lastError.message);
   if(attempt<RETRIES)await sleep(RETRY_BACKOFF_MS*attempt);
  }finally{
   clearTimeout(timer);
  }
 }
 throw lastError||new Error('CUATM download failed');
}

let previous=null;
try{previous=validateSnapshot(JSON.parse(await readFile(SNAPSHOT,'utf8')),'existing snapshot');}catch(error){
 if(error?.code!=='ENOENT')console.warn('Existing CUATM snapshot is not reusable:',String(error?.message||error));
}

let downloaded;
try{
 const buffer=await fetchBuffer();
 const records=parseWorkbook(buffer);
 downloaded=validateSnapshot({
  source_url:URL,
  fetched_at:new Date().toISOString(),
  schema:{
   legal_id:'CodUnic',
   parent_code:'ParentCodUnic',
   statistical_code:'CodStatistic',
   parent_statistical_code:'ParentCodStatistic',
   status_code:'Statut',
   name:'DenumireRO',
   name_ru:'DenumireRU'
  },
  record_count:records.length,
  records
 },'downloaded snapshot');
}catch(error){
 if(previous){
  console.warn('Official CUATM workbook unavailable; preserving last valid official snapshot:',String(error?.message||error));
  console.log(JSON.stringify({
   status:'PRESERVED_LAST_OFFICIAL_SNAPSHOT',
   record_count:previous.record_count,
   source_url:previous.source_url,
   previous_fetched_at:previous.fetched_at,
   semantic_sha256:sha256(JSON.stringify(previous.records)),
   error:String(error?.message||error)
  },null,2));
  process.exit(0);
 }
 throw error;
}

const semanticSha256=sha256(JSON.stringify(downloaded.records));
const previousSemanticSha256=previous?sha256(JSON.stringify(previous.records)):null;
if(previous&&previousSemanticSha256===semanticSha256){
 console.log(JSON.stringify({
  status:'UNCHANGED',
  record_count:previous.record_count,
  source_url:downloaded.source_url,
  semantic_sha256:semanticSha256,
  previous_fetched_at:previous.fetched_at
 },null,2));
 process.exit(0);
}

await mkdir('data/sources',{recursive:true});
await writeFile(SNAPSHOT,JSON.stringify(downloaded,null,2)+'\n');
console.log(JSON.stringify({
 status:'UPDATED',
 record_count:downloaded.record_count,
 source_url:downloaded.source_url,
 semantic_sha256:semanticSha256,
 previous_semantic_sha256:previousSemanticSha256
},null,2));
