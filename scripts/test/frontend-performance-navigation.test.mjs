import test from 'node:test';
import assert from 'node:assert/strict';
import {navigatePerformanceProfile} from '../audit/helpers/performance-navigation.mjs';
import {staticServer} from './helpers/atlas-browser.mjs';
import {performanceSource} from '../audit/helpers/performance-source.mjs';
import {performanceOutput} from '../audit/helpers/performance-output.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

function page(observed){const calls=[];return {calls,async send(name,args){calls.push([name,args]);return {identifier:'probe'};},async navigate(url){calls.push(['navigate',url]);},async viewport(w,h){calls.push(['viewport',w,h]);},async call(){return observed;}};}
test('performance loads configure the device before navigation and verify the document-start viewport',async()=>{
 for(const [w,h] of [[1440,900],[768,1024],[390,844],[844,390]]){
  const p=page({width:w,height:h,mobile:w<900});
  await navigatePerformanceProfile(p,'http://127.0.0.1/',w,h);
  assert.equal(p.calls[0][0],'Emulation.setDeviceMetricsOverride');
  assert.ok(p.calls.findIndex(x=>x[0]==='Emulation.setDeviceMetricsOverride')<p.calls.findIndex(x=>x[0]==='navigate'));
  assert.equal(p.calls.at(-1)[0],'Page.removeScriptToEvaluateOnNewDocument');
 }
});
test('a desktop initial document cannot be reported as a mobile load',async()=>{
 const p=page({width:1440,height:900,mobile:false});
 await assert.rejects(navigatePerformanceProfile(p,'http://127.0.0.1/',390,844),/Viewport at DOMContentLoaded/);
 assert.equal(p.calls.at(-1)[0],'Page.removeScriptToEvaluateOnNewDocument');
});
test('invalid device dimensions fail before any browser mutation',async()=>{
 const p=page(null);await assert.rejects(navigatePerformanceProfile(p,'http://127.0.0.1/',NaN,844));assert.equal(p.calls.length,0);
});
test('only the performance fixture enables HTTP caching; ordinary browser QA remains no-store',async()=>{
 for(const [options,expected] of [[undefined,'no-store'],[{cacheControl:'public, max-age=600'},'public, max-age=600']]){
  const server=await staticServer(process.cwd(),options);
  try{const response=await fetch(server.url+'/package.json');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),expected);await response.text();}finally{await server.close();}
 }
 await assert.rejects(staticServer(process.cwd(),{cacheControl:'unreviewed'}),/Unsupported audit cache policy/);
});
test('an unchanged HEAD cannot certify modified tracked audit sources',async()=>{
 const prefix=path.join(tmpdir(),'atlas-perf-provenance-'),root=await mkdtemp(prefix);
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
 try{
  git(['init']);git(['config','core.autocrlf','false']);
  await writeFile(path.join(root,'input.txt'),'certified\n');git(['add','input.txt']);git(['-c','user.name=Audit fixture','-c','user.email=audit@example.invalid','commit','-m','fixture']);
  const before=performanceSource(root,{ci:true});assert.equal(before.trackedSourcesClean,true);
  await writeFile(path.join(root,'input.txt'),'modified\n');
  const after=performanceSource(root,{ci:false});assert.equal(after.sha,before.sha);assert.equal(after.trackedSourcesClean,false);
  assert.throws(()=>performanceSource(root,{ci:true}),/clean tracked sources/);
 }finally{assert.ok(root.startsWith(prefix));await rm(root,{recursive:true,force:true});}
});
test('environment output paths cannot redirect CDP artifacts outside the reviewed fixture directory',()=>{
 const root=path.resolve('fixture-root'),expected=path.join(root,'outputs','web-r2c302-cdp');
 assert.equal(performanceOutput(root,undefined),expected);
 assert.equal(performanceOutput(root,'outputs/web-r2c302-cdp'),expected);
 assert.equal(performanceOutput(root,expected),expected);
 for(const input of ['../escape','outputs/../../escape',path.resolve('outside'),'/etc/passwd','outputs/other'])assert.throws(()=>performanceOutput(root,input),/Unsupported benchmark output/);
});
