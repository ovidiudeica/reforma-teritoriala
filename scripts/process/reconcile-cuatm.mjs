#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as XLSX from 'xlsx';

const URL=process.env.CUATM_URL||'https://statistica.gov.md/files/files/Clasificatoare/CUATM_25.xlsx';
const SNAPSHOT='data/sources/cuatm-current.json';
const OUTPUT='data/current/md-cuatm-reconciliation.json';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const digits=v=>String(v??'').replace(/\.0$/,'').trim();
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const entities=(catalog.entities||[]).filter(e=>e.jurisdiction==='MD');

async function fetchOfficial(){
 const r=await fetch(URL,{headers:{'user-agent':'reforma-teritoriala-cuatm/1.0'}});
 if(!r.ok)throw new Error('CUATM download failed: HTTP '+r.status);
 const buf=Buffer.from(await r.arrayBuffer());
 if(buf.length<10000)throw new Error('CUATM download is unexpectedly small: '+buf.length+' bytes');
 const wb=XLSX.read(buf,{type:'buffer',cellDates:false});
 const rows=[];
 for(const sheetName of wb.SheetNames){
  const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:false});
  for(let i=0;i<matrix.length;i++){
   const row=matrix[i]; if(!row?.length)continue;
   const cells=row.map(x=>String(x??'').trim());
   const codeIndex=cells.findIndex(x=>/^\d{3,10}$/.test(x.replace(/\s/g,'')));
   if(codeIndex<0)continue;
   const code=digits(cells[codeIndex]).replace(/\s/g,'');
   const text=cells.filter((x,j)=>j!==codeIndex&&x&&!/^\d+$/.test(x)).sort((a,b)=>b.length-a.length)[0]||null;
   if(!text)continue;
   rows.push({code,name:text,sheet:sheetName,row:i+1});
  }
 }
 const uniq=[...new Map(rows.map(x=>[x.code+'|'+norm(x.name),x])).values()];
 if(uniq.length<500)throw new Error('CUATM parse produced too few records: '+uniq.length);
 return {source_url:URL,fetched_at:new Date().toISOString(),record_count:uniq.length,records:uniq};
}
function legalType(name){
 const n=norm(name);
 if(n.includes('municipiul'))return 'municipality';
 if(n.includes('raionul'))return 'district';
 if(n.includes('sectorul'))return 'sector';
 if(n.includes('orasul'))return 'town';
 if(n.includes('comuna'))return 'commune';
 if(n.includes('satul')||n.includes('sat '))return 'village';
 return 'administrative_or_territorial_unit';
}
const official=await fetchOfficial();
await mkdir('data/sources',{recursive:true});
await writeFile(SNAPSHOT,JSON.stringify(official,null,2)+'\n');
const byCode=new Map();
for(const r of official.records){if(!byCode.has(r.code))byCode.set(r.code,[]);byCode.get(r.code).push(r);}
const matches=entities.map(e=>{
 const keys=[e.osm?.cuatm_unique_id,e.osm?.cuatm_code].filter(Boolean).map(digits);
 let hit=null,key=null;
 for(const k of keys){const hs=byCode.get(k)||[];if(hs.length===1){hit=hs[0];key=k;break;}}
 if(hit)return {id:e.id,name:e.name,osm_relation_id:e.osm?.relation_id??null,cuatm_key:key,legal_id:hit.code,legal_name:hit.name,legal_type:legalType(hit.name),legal_source:'BNS CUATM',legal_source_url:URL,match_method:'explicit_cuatm_key',confidence:'high',official_sheet:hit.sheet,official_row:hit.row};
 return {id:e.id,name:e.name,osm_relation_id:e.osm?.relation_id??null,cuatm_key:keys[0]||null,legal_id:null,legal_name:null,legal_type:null,legal_source:'BNS CUATM',legal_source_url:URL,match_method:null,confidence:null};
});
const matched=matches.filter(x=>x.legal_id);
const out={generated_at:new Date().toISOString(),classifier_version:catalog.classifier_version||null,jurisdiction:'MD',official_source:'BNS CUATM',official_source_url:URL,official_snapshot_records:official.record_count,entity_count:matches.length,matched_count:matched.length,unmatched_count:matches.length-matched.length,policy:'Only a unique exact official CUATM-code match assigns legal fields automatically. Name/fuzzy matching is not used for automatic legal classification.',matches};
if(!matched.length)throw new Error('CUATM reconciliation produced zero verified matches');
await writeFile(OUTPUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({official_records:official.record_count,entities:matches.length,matched:matched.length,unmatched:matches.length-matched.length},null,2));
