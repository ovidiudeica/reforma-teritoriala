import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';

test('execute workflow preflight against adversarial Git objects',{skip:process.platform==='win32'},async()=>{
 const newline=String.fromCharCode(10);
 const workflow=await readFile('.github/workflows/actual-promote-candidate.yml','utf8');
 const lines=workflow.split(newline);
 const start=lines.findIndex(line=>line.includes('python3 - ')&&line.includes('candidate-preexecution-paths.txt'));
 assert.ok(start>=0,'execute the actual workflow preflight');
 const end=lines.findIndex((line,index)=>index>start&&line.trim()==='PY');
 assert.ok(end>start);
 const code=lines.slice(start+1,end).map(line=>line.slice(10)).join(newline);
 const dir=await mkdtemp(join(tmpdir(),'actual-preflight-'));
 try{
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
  git('init');
  const blob=execFileSync('git',['hash-object','-w','--stdin'],{cwd:dir,input:'{}'+newline,encoding:'utf8'}).trim();
  const fixtures=[
   ['100644','data/current/valid.json',true],
   ['100644','data/current/name'+newline+'with-newline.json',true],
   ['100755','data/current/executable.json',false],
   ['120000','data/current/link.json',false],
   ['100644','scripts/process/evil.mjs',false],
   ['100644','data/current/actual-release-persisted.json',false],
   ['100644','data/current/actual-candidate-promotion-audit.json',false]
  ];
  for(const [mode,path,allowed] of fixtures){
   git('read-tree','--empty');
   git('update-index','--add','--cacheinfo',mode,blob,path);
   const tree=git('write-tree');
   const list=join(dir,'paths.bin');
   await writeFile(list,path+String.fromCharCode(0));
   const result=spawnSync('python3',['-',list],{cwd:dir,input:code,encoding:'utf8',env:{...process.env,EXPECTED_CANDIDATE_COMMIT:tree}});
   assert.equal(result.status,allowed?0:1,mode+' '+path+' '+result.stderr);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
