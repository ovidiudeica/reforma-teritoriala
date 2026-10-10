import test from 'node:test';
import assert from 'node:assert/strict';
import {Page,browserExecutable} from './helpers/atlas-browser.mjs';

test('panel keys reject selector/code payloads before any CDP command',async()=>{
 const page=Object.create(Page.prototype);
 let commands=0;page.send=async()=>{commands++;throw Error('Unexpected CDP command');};
 for(const key of ['x]','#info-toggle','constructor','__proto__','info"],body,[x="','";globalThis.injected=true;//','info\n',null,{},['info']]){
  await assert.rejects(page.openPanel(key),/Unknown navigation panel/);
 }
 assert.equal(commands,0);
});
test('CDP separates hostile selector data from function source and releases object',async()=>{
 const page=Object.create(Page.prototype),calls=[];
 page.send=async(method,params)=>{calls.push({method,params});if(method==='Runtime.evaluate')return {result:{objectId:'global'}};return {result:{value:'safe'}};};
 const payload='"];globalThis.injected=true;//\n\u2028\u2029`';
 const fn=function(value){return value;};
 assert.equal(await page.call(fn,payload),'safe');
 const invocation=calls.find(c=>c.method==='Runtime.callFunctionOn');
 assert.equal(invocation.params.functionDeclaration,fn.toString());
 assert.deepEqual(invocation.params.arguments,[{value:payload}]);
 assert.equal(invocation.params.functionDeclaration.includes('injected'),false);
 assert.equal(calls.at(-1).method,'Runtime.releaseObject');
});
test('CDP exceptions propagate and still release object',async()=>{
 const page=Object.create(Page.prototype),calls=[];
 page.send=async(method)=>{calls.push(method);if(method==='Runtime.evaluate')return {result:{objectId:'global'}};if(method==='Runtime.callFunctionOn')return {exceptionDetails:{text:'Invalid selector'}};return {};};
 await assert.rejects(page.call(function(value){return value;},'bad'),/Invalid selector/);
 assert.equal(calls.at(-1),'Runtime.releaseObject');
});

test('real Chrome treats hostile JavaScript text as data',async()=>{
 const {launchBrowser}=await import('./helpers/atlas-browser.mjs');
 const browser=await launchBrowser(new URL('../../',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
 try{
  const page=await browser.page();
  const payload='"];globalThis.injected=true;//\n\u2028\u2029`';
  assert.equal(await page.call(function(value){return value;},payload),payload);
  assert.equal(await page.evaluate('globalThis.injected===undefined'),true);
  await assert.rejects(page.click(payload),/SyntaxError|valid selector/);
  assert.equal(await page.evaluate('globalThis.injected===undefined'),true);
 }finally{await browser.close();}
});

test('browser configuration cannot select an arbitrary executable or shell payload',()=>{
 const previous=process.env.BROWSER_EXECUTABLE;
 try{
  delete process.env.BROWSER_EXECUTABLE;
  const installed=browserExecutable();
  process.env.BROWSER_EXECUTABLE=installed;assert.equal(browserExecutable(),installed);
  if(process.platform==='win32'){
   process.env.BROWSER_EXECUTABLE=installed.replaceAll('/','\\').toUpperCase();
   assert.equal(browserExecutable(),installed);
  }
  for(const payload of [process.execPath,'/tmp/untrusted-chrome','chrome; echo injected','cmd.exe','/usr/bin/google-chrome --flag','"/usr/bin/google-chrome"']){
   process.env.BROWSER_EXECUTABLE=payload;
   assert.throws(()=>browserExecutable(),/Unsupported browser executable/);
  }
 }finally{if(previous===undefined)delete process.env.BROWSER_EXECUTABLE;else process.env.BROWSER_EXECUTABLE=previous;}
});
