// WEB-R2c.3.0.2 — independent, audit-only CDP measurements; no app/source writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {launchBrowser,delay,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=process.env.ATLAS_PERF_OUTPUT||'outputs/web-r2c302-cdp';
const expected='55cccd747fa5e3f5d244b4a1044f1addd1535115';
const report={schema:'web-r2c302-cdp-readonly-v1',sourceMain:expected,runnerSha:process.env.GITHUB_SHA||null,startedAt:new Date().toISOString(),browser:null,env:{platform:process.platform,node:process.version},samples:[],failures:[],summary:null,status:'INCOMPLETE'};
const stats=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const quantile=p=>{const pos=(a.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return a[lo]+(a[hi]-a[lo])*(pos-lo);};return {count:a.length,min:a[0],p50:quantile(.5),p95:quantile(.95),max:a.at(-1)};};
function netObserver(page){
 const rows=new Map();const onEvent=event=>{
  let x;try{x=JSON.parse(event.data);}catch{return;}
  const p=x.params||{},id=p.requestId;
  if(x.method==='Network.requestWillBeSent'){
   rows.set(id,{url:p.request?.url,method:p.request?.method,initiator:p.initiator?.type,start:p.timestamp,status:null,transferBytes:0,finished:false});
  }else if(x.method==='Network.responseReceived'&&rows.has(id)){
   rows.get(id).status=p.response?.status;
   rows.get(id).mime=p.response?.mimeType;
  }else if(x.method==='Network.loadingFinished'&&rows.has(id)){
   const row=rows.get(id);row.transferBytes=p.encodedDataLength;row.finished=true;
  }else if(x.method==='Network.loadingFailed'&&rows.has(id)){
   rows.get(id).failure=p.errorText;
  }
 };
 page.socket.addEventListener('message',onEvent);
 return {data:()=>[...rows.values()].filter(x=>x.url),stop:()=>page.socket.removeEventListener('message',onEvent)};
}
function networkSummary(rows,origin){
 const mine=rows.filter(x=>x.url.startsWith(origin));
 const geo=mine.filter(x=>/\/public\/geo\/actual\//.test(x.url));
 const counts=new Map();for(const r of geo)counts.set(r.url,(counts.get(r.url)||0)+1);
 return {requestCount:mine.length,externalRequestCount:rows.length-mine.length,transferBytesCDP:mine.reduce((v,r)=>v+(r.transferBytes||0),0),geometryRequestCount:geo.length,geometryUniqueUrls:counts.size,geometryRepeatedUrls:[...counts].filter(([,n])=>n>1).map(([url,count])=>({url,count})),ownHttpErrors:mine.filter(r=>r.status>=400||r.failure).map(r=>({url:r.url,status:r.status,failure:r.failure})),externalFailures:rows.filter(r=>!r.url.startsWith(origin)&&r.failure).length};
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
 await add('back');await waitFor(()=>state(page).then(x=>x.ni.length===1),'History Back NI',15000);
 await add('forward');await waitFor(()=>state(page).then(x=>x.ni.length===8),'History Forward NI',15000);
 await add('undo');const undone=await state(page);
 assert.deepEqual(undone.ni,pre.ni,'Undo must recover NI');
 assert.deepEqual(undone.roMd,pre.roMd,'Undo must not mutate RO/MD');
 await add('panel-close');
 for(const zoom of [7,10,6]){await add('zoom',zoom);await delay(500);}
 await add('basemap');await add('basemap');
 const post=await state(page);assert.deepEqual(post.roMd,pre.roMd);assert.deepEqual(post.ni,pre.ni);
 const beforeHeap=await heap(page);
 for(let k=0;k<10;k++){await add('panel-open','entities');await add('panel-close');}
 const afterHeap=await heap(page);
 report.samples.push({profile,sample,kind:'interaction',actions,heapAfterScenario:beforeHeap,heapAfterPanelCycles:afterHeap,finalMetrics:await browserMetrics(page),consoleExceptions:page.errors.length});
 if(['desktop','mobile-portrait'].includes(profile)&&sample===1)await page.screenshot(path.join(output,profile+'-after.png'));
}
let browser=null;
try{
 await mkdir(output,{recursive:true});
 browser=await launchBrowser(root);report.browser=browser.version.Browser;
 const profiles=[['desktop',1440,900,5],['mobile-portrait',390,844,5],['tablet-portrait',768,1024,1],['mobile-landscape',844,390,1]];
 for(const [label,width,height,repeats] of profiles){
  for(let iteration=1;iteration<=repeats;iteration++){
   const page=await browser.page(),network=netObserver(page);
   try{
    await page.send('Network.clearBrowserCache');
    await page.send('Performance.enable');
    await page.navigate(browser.server.url+'/');
    await page.viewport(width,height);
    await waitFor(()=>page.call(function(){return qaApp.entityById.size===5848&&qaApp.osmRoleById.size===85&&qaApp.nistreniaOutlines?.layers?.size===8;}),'RO/MD/NI ready');
    const loaded=await browserMetrics(page);
    assert.equal(loaded.entities,5848);assert.equal(loaded.roles,85);assert.equal(loaded.niOutlines,8);
    const initial=await state(page);
    assert.deepEqual(initial.roMd,['osm-r58974','osm-r90689']);
    assert.deepEqual(initial.ni,['view-nistrenia']);
    const memory=await heap(page);
    await delay(100);
    const net=networkSummary(network.data(),browser.server.url);
    report.samples.push({profile:label,sample:iteration,kind:'cold-load',metrics:loaded,heap:memory,network:net});
    if(label==='desktop'||label==='mobile-portrait')await exercise(page,label,iteration);
    if(page.errors.length)report.failures.push({profile:label,sample:iteration,errors:page.errors.map(e=>e.text||e.exception?.description).slice(0,5)});
    if(iteration===1&&label==='tablet-portrait'){
     // CDP page scale 2 is pinch/visual zoom; not browser text zoom.
     await page.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
     report.samples.push({profile:label,sample:iteration,kind:'pinch-scale-2x',metrics:await browserMetrics(page)});
     await page.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    }
   }catch(error){report.failures.push({profile:label,sample:iteration,error:String(error?.stack||error)});throw error;}
   finally{network.stop();await page.close();}
  }
 }
 const groups=new Map();for(const s of report.samples)if(s.kind==='interaction')for(const a of s.actions){const name=s.profile+':'+a.type+(a.type==='filters'?':'+a.arg.join(','):'');if(!groups.has(name))groups.set(name,[]);groups.get(name).push(a.ms);}
 const navigation=Object.fromEntries([...new Set(report.samples.filter(s=>s.kind==='cold-load').map(s=>s.profile))].map(p=>[p,stats(report.samples.filter(s=>s.kind==='cold-load'&&s.profile===p).map(s=>s.metrics.navigationMs))]));
 report.summary={actionLatency:Object.fromEntries([...groups].map(([name,values])=>[name,stats(values)])),navigation};
 report.status=report.failures.length?'FAIL':'PASS';
}catch(error){report.status='FAIL';report.failures.push({stage:'runner',error:String(error?.stack||error)});process.exitCode=1;}
finally{
 report.finishedAt=new Date().toISOString();
 await mkdir(output,{recursive:true});
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log('WEB-R2c.3.0.2 RESULT '+JSON.stringify({status:report.status,browser:report.browser,samples:report.samples.length,failures:report.failures.length,summary:report.summary}));
 if(browser)await browser.close();
}
if(report.failures.length)process.exitCode=1;
