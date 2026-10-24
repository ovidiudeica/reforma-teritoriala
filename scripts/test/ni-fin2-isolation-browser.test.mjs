import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
const b=await launchBrowser(fileURLToPath(new URL('../../',import.meta.url)));
try{for(const code of [200,503])await test('invalid NI model '+code+' fails closed for NI while official RO/MD remain usable',{timeout:90000},async()=>{
 const p=await b.page();try{
  await p.viewport(1280,800);await p.send('Fetch.enable',{patterns:[{urlPattern:'*views/nistrenia/administration.json',requestStage:'Request'}]});
  await p.send('Page.navigate',{url:b.server.url});const paused=await waitFor(()=>p.paused.find(x=>x.request.url.endsWith('/views/nistrenia/administration.json')),'NI model request');
  await p.send('Fetch.fulfillRequest',{requestId:paused.requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{}').toString('base64')});await p.send('Fetch.disable');
  await p.evaluate("import('./app.js').then(async m=>{await m.frontendReady;window.qaApp=m;return true;})");
  assert.deepEqual(await p.evaluate("({count:qaApp.entityById.size,tree:!!qaApp.atlasTree,ni:qaApp.nistreniaView,disabled:document.getElementById('layer-ni').disabled,checked:[...qaApp.visibleEntityIds].sort()})"),{count:5848,tree:true,ni:null,disabled:true,checked:['osm-r58974','osm-r90689']});
  await p.evaluate("qaApp.selectEntity('osm-r58974',{zoom:false})");assert.equal(await p.evaluate('qaApp.selectedEntityId'),'osm-r58974');assert.deepEqual(p.errors,[]);
 }finally{await p.close();}
 });}finally{await b.close();}
