#!/usr/bin/env node
// Independent source acquisition; no NI-JUR acceptance or ACTUAL writes.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const baseline=JSON.parse(await readFile('public/data/p9095-osm-outlines-manifest.json','utf8'));
if(baseline.relations.length!==8||new Set(baseline.relations.map(r=>r.osm_relation_id)).size!==8)throw Error('Expected eight distinct outline source identities');
const dir='outputs/ni-outline-source-acquisition';await mkdir(dir,{recursive:true});const rows=[];
for(const pinned of baseline.relations){
 const id=Number(pinned.osm_relation_id);if(!Number.isSafeInteger(id)||id<=0)throw Error('Invalid outline relation identity');
 const url='https://api.openstreetmap.org/api/0.6/relation/'+id+'/full.json';
 const attempts=[];let raw=null;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(90000),headers:{accept:'application/json','user-agent':'reforma-teritoriala-ni-source-acquisition/1.0'}});
   const bytes=Buffer.from(await response.arrayBuffer()),hash=sha(bytes),bodyPath=dir+'/'+hash+'.response';await writeFile(bodyPath,bytes);
   attempts.push({attempt,url,accessed_at:new Date().toISOString(),http_status:response.status,body_path:bodyPath,body_bytes:bytes.length,body_sha256:hash});
   if(response.ok){raw=JSON.parse(bytes.toString('utf8'));break;}
   if(![429,502,503,504].includes(response.status))break;
  }catch(error){attempts.push({attempt,url,accessed_at:new Date().toISOString(),error:error.message});}
  if(attempt<3)await new Promise(r=>setTimeout(r,1500*attempt));
 }
 const relation=raw?.elements?.find(e=>e.type==='relation'&&Number(e.id)===id);
 const members=relation?.members?.map(m=>({type:m.type,ref:String(m.ref),role:m.role||''}));
 rows.push({id:pinned.id,osm_relation_id:id,status:relation?'CAPTURED_NOT_NI_ACCEPTANCE':'BLOCKED_EVIDENCE',attempts,pinned,current:relation?{version:relation.version,timestamp:relation.timestamp,tags:relation.tags,members,ordered_members_sha256:sha(JSON.stringify(members)),element_counts:Object.fromEntries(['node','way','relation'].map(t=>[t,raw.elements.filter(e=>e.type===t).length]))}:null,version_equals_historical:relation?.version===pinned.relation_version,members_equal_historical:members?sha(JSON.stringify(members))===pinned.members_sha256:false,geometry_and_topology_verdict:'PENDING_NI_JUR_1',legal_or_effective_control:'UNKNOWN'});
 await writeFile(dir+'/index.json',JSON.stringify({schema:'ni-outline-source-acquisition-v1',status:'CAPTURE_IN_PROGRESS',source_atomic:false,rows},null,2)+'\n');
 console.log(JSON.stringify({id,status:rows.at(-1).status,version:relation?.version,historical_version:pinned.relation_version}));await new Promise(r=>setTimeout(r,450));
}
const status=rows.every(r=>r.status==='CAPTURED_NOT_NI_ACCEPTANCE')?'CAPTURED_NOT_NI_ACCEPTANCE':'BLOCKED_EVIDENCE';
await writeFile(dir+'/index.json',JSON.stringify({schema:'ni-outline-source-acquisition-v1',status,source_atomic:false,rows,actual_mutation_allowed:false,p91_import_allowed:false,semantic_acceptance:'BLOCKED_INCOMPLETE'},null,2)+'\n');
if(status==='BLOCKED_EVIDENCE')process.exitCode=1;
