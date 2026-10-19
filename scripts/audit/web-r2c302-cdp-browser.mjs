// WEB-R2c.3.0.2 — independent, audit-only CDP measurements; no app/source writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {launchBrowser,delay,waitFor} from '../test/helpers/atlas-browser.mjs';
import {navigatePerformanceProfile} from './helpers/performance-navigation.mjs';
import {performanceSource} from './helpers/performance-source.mjs';
import {performanceOutput} from './helpers/performance-output.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=performanceOutput(root,process.env.ATLAS_PERF_OUTPUT);
const source=performanceSource(root),expected=source.sha;
const report={schema:'web-r2c302-cdp-readonly-v1',sourceMain:expected,runnerSha:process.env.GITHUB_SHA||null,startedAt:new Date().toISOString(),browser:null,env:{platform:process.platform,node:process.version,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem(),cpuThrottle:1,networkThrottle:false},samples:[],failures:[],summary:null,status:'INCOMPLETE'};
report.env.trackedSourcesClean=source.trackedSourcesClean;
const stats=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const quantile=p=>{const pos=(a.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return a[lo]+(a[hi]-a[lo])*(pos-lo);};return {count:a.length,min:a[0],p50:quantile(.5),p95:quantile(.95),max:a.at(-1)};};
function netObserver(page){
 const rows=new Map();const onEvent=event=>{
  let x;try{x=JSON.parse(event.data);}catch{return;}
  const p=x.params||{},id=p.requestId;
  if(x.method==='Network.requestWillBeSent'){
   rows.set(id,{url:p.request?.url,method:p.request?.method,initiator:p.initiator,start:p.timestamp,status:null,transferBytes:0,finished:false});
  }else if(x.method==='Network.responseReceived'&&rows.has(id)){
   rows.get(id).status=p.response?.status;
   rows.get(id).mime=p.response?.mimeType;
   rows.get(id).fromDiskCache=p.response?.fromDiskCache??false;
   rows.get(id).fromServiceWorker=p.response?.fromServiceWorker??false;
  }else if(x.method==='Network.loadingFinished'&&rows.has(id)){
   const row=rows.get(id);row.transferBytes=p.encodedDataLength;row.finished=true;
  }else if(x.method==='Network.loadingFailed'&&rows.has(id)){
   rows.get(id).failure=p.errorText;
   rows.get(id).canceled=p.canceled??false;
  }
 };
 page.socket.addEventListener('message',onEvent);
 return {data:()=>[...rows.values()].filter(x=>x.url),reset:()=>rows.clear(),stop:()=>page.socket.removeEventListener('message',onEvent)};
}
async function trace(page,file){
 await page.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,loading',transferMode:'ReturnAsStream'});
 return async()=>{
  let stream;
  const listener=event=>{const value=JSON.parse(event.data);if(value.method==='Tracing.tracingComplete')stream=value.params.stream;};page.socket.addEventListener('message',listener);
  try{
   await page.send('Tracing.end');
   await waitFor(()=>stream,'Trace completion',60000);
   const chunks=[];let eof=false;
   while(!eof){const r=await page.send('IO.read',{handle:stream});chunks.push(r.base64Encoded?Buffer.from(r.data,'base64'):Buffer.from(r.data));eof=r.eof;}
   await page.send('IO.close',{handle:stream});
   await writeFile(file,Buffer.concat(chunks));
  }finally{page.socket.removeEventListener('message',listener);}
 };
}
function networkSummary(rows,origin){
 const mine=rows.filter(x=>x.url.startsWith(origin));
 const geo=mine.filter(x=>/\/public\/geo\/actual\//.test(x.url));
 const counts=new Map();for(const r of geo)counts.set(r.url,(counts.get(r.url)||0)+1);
 return {requestCount:mine.length,externalRequestCount:rows.length-mine.length,transferBytesCDP:mine.reduce((v,r)=>v+(r.transferBytes||0),0),geometryRequestCount:geo.length,geometryUniqueUrls:counts.size,geometryRepeatedUrls:[...counts].filter(([,n])=>n>1).map(([url,count])=>({url,count})),ownHttpErrors:mine.filter(r=>r.status>=400||r.failure).map(r=>({url:r.url,status:r.status,failure:r.failure,canceled:r.canceled})),externalFailures:rows.filter(r=>!r.url.startsWith(origin)&&(r.failure||r.status>=400)).map(r=>({url:r.url,status:r.status,failure:r.failure,canceled:r.canceled}))};
}
async function heap(page){
 await page.send('HeapProfiler.collectGarbage');
 const h=await page.send('Runtime.getHeapUsage');
 const m=await page.send('Performance.getMetrics');
 return {usedSize:h.usedSize,totalSize:h.totalSize,metrics:Object.fromEntries(m.metrics.filter(x=>['Nodes','JSHeapUsedSize','LayoutCount','RecalcStyleCount','TaskDuration'].includes(x.name)).map(x=>[x.name,x.value]))};
}
async function browserMetrics(page){
 return page.call(function(){
  const nav=performance.getEntriesByType('navigation')[0],paint=performance.getEntriesByType('paint');
  const tree=document.querySelector('#hierarchy-tree');
  return {navigationMs:nav?.duration??null,dclMs:nav?.domContentLoadedEventEnd??null,fcpMs:paint.find(x=>x.name==='first-contentful-paint')?.startTime??null,
   domNodes:document.querySelectorAll('*').length,treeMounted:tree?.querySelectorAll('.tree-node').length??null,treeVisible:qaApp.atlasTree.getVisibleCount(),
   svgPaths:document.querySelectorAll('.leaflet-overlay-pane path').length,
   resourceEntries:performance.getEntriesByType('resource').length,
   mapZoom:qaApp.map.getZoom(),viewport:[innerWidth,innerHeight],
   entities:qaApp.entityById.size,roles:qaApp.osmRoleById.size,niOutlines:qaApp.nistreniaOutlines?.layers?.size,
   horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
   activePanel:qaApp.atlasPanels.state.active};
 });
}
async function state(page){
 return page.call(function(){return {roMd:[...qaApp.visibleEntityIds].sort(),ni:[...qaApp.visibleOperationalOutlineIds].sort(),stat:[...document.querySelectorAll('input[data-kind="statistical"]')].map(e=>[e.dataset.filter,e.checked]),selected:qaApp.selectedEntityId,levels:[...document.querySelectorAll('input[data-kind="osm-admin-level"]:checked')].map(e=>e.dataset.filter),url:location.href};});
}
async function timed(page,type,argument){
 return page.call(async function(type,arg){
  const before=performance.now(),frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const osm=()=>{const el=[...document.querySelectorAll('#filter-list>details')].find(e=>e.querySelector('summary')?.textContent==='Nivel administrativ OSM');if(!el)throw Error('OSM filter not found');el.open=true;return el;};
  const ctr=()=>{const el=document.querySelector('.osm-level-geometry-actions');if(!el)throw Error('Geometry actions not found');return el;};
  if(type==='expand'){qaApp.atlasTree.toggle('osm-r90689');qaApp.atlasTree.toggle('osm-r90689');}
  else if(type==='large-tree'){const ids=[...qaApp.hierarchyNodeById].filter(([,n])=>n.child_ids?.length).slice(0,170).map(([id])=>id);qaApp.atlasTree.setOpenIds(ids);}
  else if(type==='scroll'){const el=document.querySelector('#hierarchy-tree');el.scrollTop=el.scrollHeight*.93;}
  else if(type==='filters'){
   const el=osm();el.querySelector('.filter-actions button:nth-child(2)').click();
   for(const input of el.querySelectorAll('input[data-kind="osm-admin-level"]'))if(arg.includes(input.dataset.filter))input.click();
  }else if(type==='panel-open'){qaApp.atlasPanels.open(arg,{focus:false});}
  else if(type==='panel-close'){qaApp.atlasPanels.close({focus:false});}
  else if(type==='preview-show'){ctr().querySelector('.osm-level-geometry-buttons button:nth-child(1)').click();}
  else if(type==='preview-hide'){ctr().querySelector('.osm-level-geometry-buttons button:nth-child(2)').click();}
  else if(type==='cancel'){ctr().querySelector('.osm-level-action-confirm button:nth-of-type(2)').click();}
  else if(type==='confirm'){ctr().querySelector('.osm-level-action-confirm button:nth-of-type(1)').click();}
  else if(type==='undo'){ctr().querySelector('.osm-level-geometry-buttons button:nth-child(3)').click();}
  else if(type==='zoom'){qaApp.map.setZoom(arg,{animate:false});}
  else if(type==='basemap'){document.querySelector('#basemap-toggle').click();}
  else if(type==='back'){history.back();}
  else if(type==='forward'){history.forward();}
  else throw Error('Unsupported audit action '+type);
  await frame();await frame();
  return {ms:performance.now()-before,treeMounted:document.querySelectorAll('#hierarchy-tree .tree-node').length,
   treeVisible:qaApp.atlasTree.getVisibleCount(),svgPaths:document.querySelectorAll('.leaflet-overlay-pane path').length,
   niChecked:qaApp.visibleOperationalOutlineIds.size,geometryChecked:qaApp.visibleEntityIds.size,href:location.href};
 },type,argument??null);
}
async function exercise(page,profile,sample){
 const actions=[];
 const add=async(type,arg)=>{const r=await timed(page,type,arg);actions.push({type,arg,...r});return r;};
 await add('panel-open','entities');
 await add('expand');
 await add('large-tree');
 await add('scroll');
 await add('panel-open','filters');
 const initial=await state(page);
 for(const levels of [['8'],['9'],['8','9'],[],['2','3','4','5','7','8','9','unknown']]){
  await add('filters',levels);
  const after=await state(page);
  assert.deepEqual(after.roMd,initial.roMd,'OSM filtering changed RO/MD checked geometry');
  assert.deepEqual(after.ni,initial.ni,'OSM filtering changed NI checked geometry');
  assert.deepEqual(after.stat,initial.stat,'OSM filtering changed statistical selection');
 }
 await add('filters',['5']);
 const pre=await state(page);
 await add('preview-show');assert.deepEqual((await state(page)).ni,pre.ni,'preview must not change geometry');
 await add('cancel');assert.deepEqual((await state(page)).ni,pre.ni,'cancel must not change geometry');
 await add('preview-show');await add('confirm');
 const committed=await state(page);assert.equal(committed.ni.length,8,'seven NI districts selected');
 // Benchmark direct Undo separately from the documented History restoration path.
 // Do not assume transaction Undo remains valid after intervening popstate.
 await add('undo');const undone=await state(page);
 assert.deepEqual(undone.ni,pre.ni,'direct Undo must recover NI');
 assert.deepEqual(undone.roMd,pre.roMd,'Undo must not mutate RO/MD');
 await add('preview-show');await add('confirm');
 assert.equal((await state(page)).ni.length,8,'repeated confirm must select NI districts');
 await add('back');await waitFor(()=>state(page).then(x=>x.ni.length===1),'History Back NI',15000);
 await add('forward');await waitFor(()=>state(page).then(x=>x.ni.length===8),'History Forward NI',15000);
 await add('back');await waitFor(()=>state(page).then(x=>x.ni.length===1),'History recovery before next sample',15000);
 if(sample===2){
  const cycles=[];
  for(let k=0;k<20;k++){
   const start=performance.now();await timed(page,'forward');await waitFor(()=>state(page).then(x=>x.ni.length===8),'History stress Forward',15000);
   const forwardVerifiedMs=performance.now()-start,backStart=performance.now();await timed(page,'back');await waitFor(()=>state(page).then(x=>x.ni.length===1),'History stress Back',15000);
   cycles.push({cycle:k+1,forwardVerifiedMs,backVerifiedMs:performance.now()-backStart});
  }
  report.samples.push({profile,sample,kind:'history-stress',timingBasis:'driver call through verified state, includes CDP transport',cycles});
 }
 await add('panel-close');
 for(const zoom of [7,10,6]){await add('zoom',zoom);await delay(500);}
 await add('basemap');await add('basemap');
 const post=await state(page);assert.deepEqual(post.roMd,pre.roMd);assert.deepEqual(post.ni,pre.ni);
 await delay(300);const beforeHeap=await heap(page);
 for(let k=0;k<20;k++){await add('panel-open','entities');await add('panel-close');}
 await delay(300);
 const afterHeap=await heap(page);
 if(sample===2){
  const series=[{cycles:0,heap:beforeHeap},{cycles:20,heap:afterHeap}];let completed=20;
  for(const total of [40,80,160]){
   // One compiled CDP function per block isolates app retention from repeated driver-function compilation.
   await page.call(async function(count){const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));for(let i=0;i<count;i++){qaApp.atlasPanels.open('entities',{focus:false});await frame();await frame();qaApp.atlasPanels.close({focus:false});await frame();await frame();}},total-completed);
   await delay(300);series.push({cycles:total,heap:await heap(page),metrics:await browserMetrics(page)});completed=total;
  }
  report.samples.push({profile,sample,kind:'panel-memory-stress',series});
 }
 report.samples.push({profile,sample,traceEnabled:sample===1,kind:'interaction',actions,heapAfterScenario:beforeHeap,heapAfterPanelCycles:afterHeap,finalMetrics:await browserMetrics(page),consoleExceptions:page.errors.length});
 if(sample===1)await page.screenshot(path.join(output,profile+'-after.png'));
}
async function oneSelectedDetailGeometry(page,profile,network,appOrigin){
 const start=await state(page),out=[];
 for(const level of [8,9]){
  await timed(page,'panel-open','filters');
  await timed(page,'filters',[String(level)]);
  await timed(page,'panel-open','entities');
  const chosen=await page.call(async function(level){
   const {osmLevelForTreeNode}=await import('./atlas-osm-admin-badges.mjs');
   const candidate=[...qaApp.hierarchyNodeById].find(([id,node])=>qaApp.entityById.has(id)&&osmLevelForTreeNode(node,{entityById:qaApp.entityById,osmRoleById:qaApp.osmRoleById})===level&&!qaApp.visibleEntityIds.has(id));
   if(!candidate)throw Error('No unchecked ACTUAL admin '+level+' node for detail profile');
   const id=candidate[0];qaApp.atlasTree.select(id);
   const entry=qaApp.atlasTree.getNode(id);if(!entry?.checkbox)throw Error('Selected virtual row missing');
   entry.checkbox.click();if(!qaApp.visibleEntityIds.has(id))throw Error('Detail checkbox failed to select '+id);
   const started=performance.now();await qaApp.selectEntity(id,{zoom:true,source:'tree'});
   return {id,level,selectAndFitMs:performance.now()-started};
  },level);
  await timed(page,'zoom',10);
  await delay(1800);
  const loaded=await browserMetrics(page),net=networkSummary(network.data(),appOrigin),memory=await heap(page);
  const restored=await page.call(function(id){
   const entry=qaApp.atlasTree.getNode(id);if(!entry?.checkbox)throw Error('Detail row lost');
   entry.checkbox.click();qaApp.clearSelection();return {unchecked:!qaApp.visibleEntityIds.has(id)};
  },chosen.id);
  assert.equal(restored.unchecked,true,'selected detail geometry must be reversible');
  out.push({target:chosen,loaded,network:net,memory});
 }
 await timed(page,'filters',['5']);
 await timed(page,'zoom',6);
 const finish=await state(page);
 assert.deepEqual(finish.roMd,start.roMd,'detail geometry profiling altered default RO/MD selection');
 assert.deepEqual(finish.ni,start.ni,'detail geometry profiling altered NI');
 assert.deepEqual(finish.stat,start.stat,'detail geometry profiling altered statistics');
 report.samples.push({profile,sample:1,kind:'admin8-admin9-selected-geometry',results:out});
 console.log('WEB-R2c.3.0.2 DETAIL_GEOMETRY '+JSON.stringify({profile,results:out.map(x=>({id:x.target.id,level:x.target.level,selectAndFitMs:x.target.selectAndFitMs,svgPaths:x.loaded.svgPaths,heapUsedBytes:x.memory.usedSize,geometryRequests:x.network.geometryRequestCount,geometryUniqueUrls:x.network.geometryUniqueUrls,geometryRepeated:x.network.geometryRepeatedUrls.length,ownHttpErrors:x.network.ownHttpErrors.length}))}));
}
let browser=null;
try{
 await mkdir(output,{recursive:true});
 browser=await launchBrowser(root,{cacheControl:'public, max-age=600'});report.browser=browser.version.Browser;
 report.env.httpCacheControl='public, max-age=600';report.env.coldCache='Network.clearBrowserCache before each independent pair';report.env.warmCache='second navigation in the same tab with HTTP caching enabled';
 const profiles=[['desktop',1440,900,6],['mobile-portrait',390,844,6],['tablet-portrait',768,1024,6],['mobile-landscape',844,390,6]];
 for(const [label,width,height,repeats] of profiles){
  for(let iteration=1;iteration<=repeats;iteration++){
   const page=await browser.page(),network=netObserver(page);let stopTrace;
   try{
    await page.send('Network.clearBrowserCache');
    await page.send('Network.setCacheDisabled',{cacheDisabled:false});
    await page.send('Performance.enable');
    if(iteration===1)stopTrace=await trace(page,path.join(output,label+'-trace.json'));
    const observedViewport=await navigatePerformanceProfile(page,browser.server.url+'/',width,height);
    await waitFor(()=>page.call(function(){return qaApp.entityById.size===5848&&qaApp.osmRoleById.size===85&&qaApp.nistreniaOutlines?.layers?.size===8;}),'RO/MD/NI ready');
    const loaded=await browserMetrics(page);
    assert.equal(loaded.entities,5848);assert.equal(loaded.roles,85);assert.equal(loaded.niOutlines,8);
    const initial=await state(page);
    assert.deepEqual(initial.roMd,['osm-r58974','osm-r90689']);
    assert.deepEqual(initial.ni,['view-nistrenia']);
    const memory=await heap(page);
    await delay(100);
    const net=networkSummary(network.data(),browser.server.url);
    assert.deepEqual(net.ownHttpErrors,[],'Self-hosted cold-load requests must succeed');
    report.samples.push({profile:label,sample:iteration,traceEnabled:iteration===1,kind:'cold-load',documentViewport:observedViewport,metrics:loaded,heap:memory,network:net});
    await writeFile(path.join(output,label+'-'+iteration+'-cold-network.json'),JSON.stringify(network.data(),null,2));
    if(iteration===1)await page.screenshot(path.join(output,label+'-before.png'));
    network.reset();
    await navigatePerformanceProfile(page,browser.server.url+'/',width,height);
    const warmNetwork=networkSummary(network.data(),browser.server.url);assert.deepEqual(warmNetwork.ownHttpErrors,[],'Self-hosted warm-load requests must succeed');
    report.samples.push({profile:label,sample:iteration,traceEnabled:iteration===1,kind:'warm-load',metrics:await browserMetrics(page),heap:await heap(page),network:warmNetwork});
    await writeFile(path.join(output,label+'-'+iteration+'-warm-network.json'),JSON.stringify(network.data(),null,2));
    {
     await exercise(page,label,iteration);
     if(iteration===1)await oneSelectedDetailGeometry(page,label,network,browser.server.url);
     report.samples.push({profile:label,sample:iteration,kind:'post-interaction-network',network:networkSummary(network.data(),browser.server.url),heap:await heap(page)});
    }
    if(page.errors.length)report.failures.push({profile:label,sample:iteration,errors:page.errors.map(e=>e.text||e.exception?.description).slice(0,5)});
    await writeFile(path.join(output,label+'-'+iteration+'-interaction-network.json'),JSON.stringify(network.data(),null,2));
    assert.deepEqual(networkSummary(network.data(),browser.server.url).ownHttpErrors,[],'Self-hosted interaction requests must succeed');
   }catch(error){report.failures.push({profile:label,sample:iteration,error:String(error?.stack||error)});throw error;}
   finally{try{if(stopTrace)await stopTrace();}finally{network.stop();await page.close();}}
  }
 }
 const groups=new Map();for(const s of report.samples)if(s.kind==='interaction'&&!s.traceEnabled)for(const a of s.actions){const name=s.profile+':'+a.type+(a.type==='filters'?':'+a.arg.join(','):'');if(!groups.has(name))groups.set(name,[]);groups.get(name).push(a.ms);}
 const navigation=Object.fromEntries([...new Set(report.samples.filter(s=>s.kind==='cold-load').map(s=>s.profile))].map(p=>[p,stats(report.samples.filter(s=>s.kind==='cold-load'&&!s.traceEnabled&&s.profile===p).map(s=>s.metrics.navigationMs))]));
 const warmNavigation=Object.fromEntries([...new Set(report.samples.filter(s=>s.kind==='warm-load').map(s=>s.profile))].map(p=>[p,stats(report.samples.filter(s=>s.kind==='warm-load'&&!s.traceEnabled&&s.profile===p).map(s=>s.metrics.navigationMs))]));
 report.env.percentilesExcludeTracedSamples=true;
 report.summary={actionLatency:Object.fromEntries([...groups].map(([name,values])=>[name,stats(values)])),navigation,warmNavigation};
 report.status=report.failures.length?'FAIL':'PASS';
 console.log('WEB-R2c.3.0.2 TELEMETRY '+JSON.stringify(report.samples.filter(x=>['cold-load','post-interaction-network'].includes(x.kind)).map(x=>({profile:x.profile,sample:x.sample,kind:x.kind,navMs:x.metrics?.navigationMs,resourceEntries:x.metrics?.resourceEntries,domNodes:x.metrics?.domNodes,treeMounted:x.metrics?.treeMounted,heapUsedBytes:x.heap?.usedSize,requestCount:x.network?.requestCount,transferBytesCDP:x.network?.transferBytesCDP,geometryRequests:x.network?.geometryRequestCount,geometryUniqueUrls:x.network?.geometryUniqueUrls,geometryRepeated:x.network?.geometryRepeatedUrls?.length,ownHttpErrors:x.network?.ownHttpErrors?.length}))));
 console.log('WEB-R2c.3.0.2 MEMORY_CYCLES '+JSON.stringify(report.samples.filter(x=>x.kind==='interaction').map(x=>({profile:x.profile,sample:x.sample,heapAfterScenario:x.heapAfterScenario?.usedSize,heapAfterPanelCycles:x.heapAfterPanelCycles?.usedSize,deltaBytes:(x.heapAfterPanelCycles?.usedSize??0)-(x.heapAfterScenario?.usedSize??0)}))));
}catch(error){report.status='FAIL';report.failures.push({stage:'runner',error:String(error?.stack||error)});process.exitCode=1;}
finally{
 report.finishedAt=new Date().toISOString();
 for(const failure of report.failures)console.error('WEB-R2c.3.0.2 DIAGNOSTIC '+JSON.stringify(failure));
 await mkdir(output,{recursive:true});
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log('WEB-R2c.3.0.2 RESULT '+JSON.stringify({status:report.status,browser:report.browser,samples:report.samples.length,failures:report.failures.length,summary:report.summary}));
 if(browser)await browser.close();
}
if(report.failures.length)process.exitCode=1;
