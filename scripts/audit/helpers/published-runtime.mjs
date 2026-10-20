import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const base='https://ovidiudeica.github.io/reforma-teritoriala/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function publishedRuntimeFiles(root){
 const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',maxBuffer:5000000}).split('\0').filter(Boolean);
 const files=tracked.filter(file=>file==='index.html'||/^[^/]+\.(?:mjs|js|css)$/.test(file)||/^public\/data\/.+\.json$/.test(file)||/^public\/geo\/.+\.geojson$/.test(file)||['data/current/actual-release-manifest.json','data/current/actual-release-gate.json'].includes(file)).sort();
 assert.ok(files.includes('index.html')&&files.includes('app.js'),'Runtime source inventory is incomplete');
 for(const file of files)assert.ok(!path.isAbsolute(file)&&!file.includes('\\')&&file.split('/').every(s=>s!=='.'&&s!=='..'),'Unsafe tracked runtime path');
 return files;
}
export async function verifyPublishedRuntime(root,{fetcher=fetch,concurrency=6}={}){
 assert.ok(Number.isSafeInteger(concurrency)&&concurrency>=1&&concurrency<=8,'Invalid read-only fetch concurrency');
 const files=publishedRuntimeFiles(root),records=new Array(files.length);let next=0,firstError;
 async function worker(){while(!firstError){const index=next++;if(index>=files.length)return;const file=files[index],url=new URL(file,base).href;try{
   const response=await fetcher(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});
   records[index]={file,url,httpStatus:response.status,contentType:response.headers.get('content-type'),status:'FAIL'};
   assert.equal(response.status,200,'Published runtime HTTP '+file);
   const remote=Buffer.from(await response.arrayBuffer()),expected=await readFile(path.join(root,file)),sha256=hash(remote),expectedSha256=hash(expected);
   Object.assign(records[index],{bytes:remote.length,sha256,expectedSha256});
   assert.equal(sha256,expectedSha256,'Published runtime bytes differ: '+file);
   records[index].status='PASS';
  }catch(error){records[index]??={file,url,status:'FAIL'};records[index].error=String(error.message||error);firstError??=error;}}
 }
 await Promise.all(Array.from({length:Math.min(concurrency,files.length)},worker));
 const result={status:firstError?'FAIL':'PASS',expectedFiles:files.length,checkedFiles:records.filter(Boolean).length,geojsonFiles:files.filter(f=>f.endsWith('.geojson')).length,jsonFiles:files.filter(f=>f.endsWith('.json')).length,totalBytes:records.reduce((n,r)=>n+(r?.bytes||0),0),records:records.filter(Boolean)};
 if(firstError){firstError.inventory=result;throw firstError;}return result;
}
