#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {retryAfterMs} from '../lib/osm-adaptive-transport.mjs';
import {auditOsmClosure} from '../lib/osm-closure-audit.mjs';
const OUT='outputs/osm-closure-forensics';
await mkdir(OUT,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const entries=[];
for(const id of [18967493,18968082,1706978,1706979,7103068,1699032,55466]){
 const modes=[...(id===18967493||id===18968082?['full']:['current']),...(id!==55466?['history']:[])];
 for(const mode of modes){
  const suffix=mode==='current'?'':`/${mode}`;
  const url=`https://api.openstreetmap.org/api/0.6/relation/${id}${suffix}.json`;
  const attempts=[];let captured=null;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(60000),headers:{accept:'application/json','user-agent':'reforma-teritoriala-closure-forensics/1.0'}});
    const bytes=Buffer.from(await response.arrayBuffer()),hash=sha(bytes),file=OUT+'/'+hash+'.response';
    await writeFile(file,bytes);
    const receipt={url,http_status:response.status,attempt,accessed_at:new Date().toISOString(),body_path:file,body_sha256:hash,body_bytes:bytes.length,retry_after:response.headers.get('retry-after')};
    attempts.push(receipt);
    if(response.ok){captured=JSON.parse(bytes.toString('utf8'));break;}
    if(![429,502,503,504].includes(response.status))break;
    if(attempt<3)await new Promise(r=>setTimeout(r,Math.max(1000*attempt,retryAfterMs(receipt.retry_after))));
   }catch(error){attempts.push({url,attempt,accessed_at:new Date().toISOString(),error:error.message});if(attempt<3)await new Promise(r=>setTimeout(r,1000*attempt));}
  }
  const relations=(captured?.elements||[]).filter(e=>e.type==='relation'&&Number(e.id)===id);
  entries.push({relation_id:id,mode,attempts,versions:relations,closure:mode==='full'&&captured?auditOsmClosure(captured,[id],'MD'):null,status:captured?'CAPTURED':'BLOCKED_EVIDENCE'});
  await writeFile(OUT+'/index.json',JSON.stringify({schema:'osm-closure-forensics-v1',status:'CAPTURE_IN_PROGRESS',entries},null,2)+'\n');
  console.log(JSON.stringify({id,mode,status:entries.at(-1).status,http:attempts.at(-1)?.http_status,versions:relations.map(e=>e.version)}));
  await new Promise(r=>setTimeout(r,350));
 }
}
const report={schema:'osm-closure-forensics-v1',status:entries.every(e=>e.status==='CAPTURED')?'CAPTURED':'BLOCKED_EVIDENCE',entries,policy:'Evidence capture only. CAPTURED does not certify topology or promote source/ACTUAL.'};
await writeFile(OUT+'/index.json',JSON.stringify(report,null,2)+'\n');
if(report.status!=='CAPTURED')process.exitCode=1;
