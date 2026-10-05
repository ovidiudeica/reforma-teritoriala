#!/usr/bin/env node
import {readFile} from 'node:fs/promises';

const current=JSON.parse(await readFile('public/geo/current/md-administrative.geojson','utf8'));
const currentRows=current.features.map(f=>{
 const tags=f.properties?.tags||f.properties||{};
 return {
  relation_id:Number(String(f.properties?.catalog_id||'').replace(/^osm-r/,'')),
  id:f.properties?.catalog_id,
  name:tags['name:ro']||tags.name||null,
  admin_level:Number(tags.admin_level||0)
 };
}).filter(x=>Number.isFinite(x.relation_id));
const currentById=new Map(currentRows.map(x=>[x.relation_id,x]));
const required=new Set([1813306,1813297,58512,1813315,1813316]);
const live=new Map();
const batchSize=75;
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
for(let i=0;i<currentRows.length;i+=batchSize){
 const ids=currentRows.slice(i,i+batchSize).map(x=>x.relation_id).join(',');
 const url='https://api.openstreetmap.org/api/0.6/relations?relations='+ids;
 let body=null,lastErr=null;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const r=await fetch(url,{headers:{'user-agent':'reforma-teritoriala-md-authoritative-inventory-audit/1.0'},signal:AbortSignal.timeout(60000)});
   if(!r.ok)throw new Error('HTTP '+r.status);
   body=await r.text();break;
  }catch(e){lastErr=e;await new Promise(r=>setTimeout(r,1500*attempt));}
 }
 if(body==null)throw new Error('batch failed: '+String(lastErr?.message||lastErr));
 for(const m of body.matchAll(/<relation\s+([^>]*\bid="(\d+)"[^>]*)>([\s\S]*?)<\/relation>/g)){
  const id=Number(m[2]),inner=m[3],tags={};
  for(const t of inner.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g))tags[decode(t[1])]=decode(t[2]);
  live.set(id,{id,tags});
 }
 console.log('authoritative batch',Math.floor(i/batchSize)+1,'/',Math.ceil(currentRows.length/batchSize),'returned',live.size);
}
const missing=[],retagged=[];
for(const [id,row] of currentById){
 const r=live.get(id);
 if(!r){missing.push(row);continue;}
 const admin=Number(r.tags.admin_level||0);
 if(!required.has(id)&&(r.tags.boundary!=='administrative'||![4,6,8,9].includes(admin))){
  retagged.push({...row,current_boundary:r.tags.boundary||null,current_admin_level:admin||null,current_name:r.tags['name:ro']||r.tags.name||null});
 }
}
console.log(JSON.stringify({checked:currentRows.length,returned:live.size,missing,retagged},null,2));
