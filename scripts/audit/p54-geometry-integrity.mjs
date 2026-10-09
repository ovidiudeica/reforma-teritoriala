import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const git=process.env.GIT_EXECUTABLE||'git';
const base=new URL('https://ovidiudeica.github.io/reforma-teritoriala/');
const lines=execFileSync(git,['ls-files','-s','--','public/geo/actual/'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const tracked=lines.map(line=>{
 const match=line.match(/^100644 ([0-9a-f]{40}) 0\t(.+)$/);
 if(!match)throw Error('Unexpected git-stage record');
 return {sha:match[1],file:match[2]};
}).filter(item=>item.file.endsWith('.geojson'));
const evidence={testedCommit:execFileSync(git,['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),publicUrl:base.href,files:[],failures:[]};
let next=0;
async function checkAsset(entry){
 let message='';
 for(let attempt=0;attempt<3;attempt++){
  try{
   const uri=new URL(entry.file,base);
   assert.equal(uri.hostname,'ovidiudeica.github.io');
   const response=await fetch(uri,{signal:AbortSignal.timeout(90000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=Buffer.from(await response.arrayBuffer());
   const blob=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
   const sha256=createHash('sha256').update(data).digest('hex');
   const ok=blob===entry.sha;
   evidence.files.push({path:entry.file,bytes:data.length,sha256,gitBlobSha:blob,pass:ok});
   if(!ok)evidence.failures.push({file:entry.file,expected:entry.sha,actual:blob});
   return;
  }catch(error){message=String(error);if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}
 }
 evidence.failures.push({file:entry.file,error:message});
}
async function worker(){while(next<tracked.length){const index=next++;await checkAsset(tracked[index]);}}
await test('P5.4 public ACTUAL geometry: 123/123 live Git-blob byte identity',{timeout:240000},async()=>{
 assert.equal(tracked.length,123,'Expected full 115 chunks + 8 tier/statistical assets');
 await Promise.all(Array.from({length:5},worker));
 evidence.files.sort((a,b)=>a.path.localeCompare(b.path));
 evidence.totalBytes=evidence.files.reduce((sum,item)=>sum+item.bytes,0);
 evidence.passed=evidence.files.filter(item=>item.pass).length;
 const destination=process.env.P54_EVIDENCE_PATH||path.join(tmpdir(),'p54-public-geometry-integrity.json');
 writeFileSync(destination,JSON.stringify(evidence,null,2));
 console.log('P5.4 ACTUAL public:',evidence.passed+'/'+tracked.length,'bytes',evidence.totalBytes,'evidence:',destination);
 assert.deepEqual(evidence.failures,[],'Live ACTUAL byte mismatch or unavailable asset');
 assert.equal(evidence.passed,123);
});
