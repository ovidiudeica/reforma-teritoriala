import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,delay,waitFor} from '../test/helpers/atlas-browser.mjs';
import {auditEvidenceDirectory} from '../test/helpers/atlas-evidence.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=auditEvidenceDirectory();
const targetUrl=browser=>browser.server.url;
await mkdir(output,{recursive:true});
const reports={conditions:{freshProfilePerCold:true,cacheDisabled:false,cpuThrottle:false,networkThrottle:false,usable:'observed upper bound after frontendReady and helper settling; not standardized TTI',text:'explicit 200% computed-font enlargement, not native browser zoom',resourceBytes:'ResourceTiming transferSize; cross-origin resources without TAO can report zero'},loads:[],layouts:[],text:[]};
const shapes=[[360,640],[390,844],[430,932],[844,390],[640,360],[768,1024],[899,768],[900,768],[1440,900]];
const observerSource=`window.__p76Performance={lcp:null,longTasks:[]};
for(const type of ['largest-contentful-paint','longtask']){
 if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
 new PerformanceObserver(list=>{for(const entry of list.getEntries()){
  if(type==='largest-contentful-paint')window.__p76Performance.lcp=entry.startTime;
  else window.__p76Performance.longTasks.push({start:entry.startTime,duration:entry.duration});
 }}).observe({type,buffered:true});
}`;
const layout=function(){
 const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const header=rect(document.querySelector('header'));
 const title=rect(document.querySelector('h1'));
 const main=rect(document.querySelector('#atlas-main'));
 const controls=[...document.querySelector('.leaflet-control-zoom').children].map(e=>{const r=rect(e),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {...r,name:e.getAttribute('aria-label'),hit:e===hit||e.contains(hit)};});
 return {header,title,main,controls,overflow:document.documentElement.scrollWidth>innerWidth,logical:qaApp.atlasLayout.size};
};
try{
 await test('P7.6 final acceptance supplements',{timeout:300000},async t=>{
  for(const [width,height] of [[390,844],[844,390],[1440,900]]){
   await t.test('genuine fresh-profile cold and cached warm '+width+'x'+height,async()=>{
    const browser=await launchBrowser(root),page=await browser.page();
    try{
     await page.send('Performance.enable');
     await page.send('Network.clearBrowserCache');
     await page.send('Network.setCacheDisabled',{cacheDisabled:false});
     // Apply mobile metrics before the very first navigation: blank pages lack the viewport meta tag.
     await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
     await page.send('Page.addScriptToEvaluateOnNewDocument',{source:observerSource});
     for(const temperature of ['cold','warm']){
      page.requests=[];page.responses=[];
      await page.navigate(targetUrl(browser));
      await waitFor(()=>page.call(function(width){return innerWidth===width&&qaApp.atlasLayout.size.width===width;},width),'cold viewport observed');
      const metrics=await page.call(function(){const navigation=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource');return {
       observedUsableMs:performance.now(),fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,lcpMs:window.__p76Performance.lcp,
       dclMs:navigation.domContentLoadedEventEnd,longTasks:window.__p76Performance.longTasks,resourceCount:resources.length,transferBytes:resources.reduce((sum,r)=>sum+r.transferSize,0),encodedBytes:resources.reduce((sum,r)=>sum+r.encodedBodySize,0),
       domNodes:document.querySelectorAll('*').length,treeRows:document.querySelectorAll('.tree-node').length,viewport:[innerWidth,innerHeight],checked:[...qaApp.visibleEntityIds].sort(),identities:qaApp.entityById.size,hierarchy:qaApp.hierarchyNodeById.size,
       geometryRequests:resources.filter(r=>new URL(r.name).pathname.endsWith('.geojson')).map(r=>({url:r.name,transfer:r.transferSize,encoded:r.encodedBodySize}))
      };});
      const processMetrics=(await page.send('Performance.getMetrics')).metrics;
      reports.loads.push({temperature,width,height,browser:browser.version.Browser,source:targetUrl(browser),...metrics,jsHeapUsed:processMetrics.find(m=>m.name==='JSHeapUsedSize')?.value??null,requestCount:page.requests.length});
      assert.deepEqual(metrics.viewport,[width,height]);assert.deepEqual(metrics.checked,['osm-r58974','osm-r90689']);assert.equal(metrics.identities,5848);assert.equal(metrics.hierarchy,5848);assert.ok(metrics.treeRows<40);assert.ok(metrics.fcpMs>0);assert.ok(metrics.observedUsableMs>=metrics.fcpMs);
      assert.deepEqual(metrics.geometryRequests.map(r=>new URL(r.url).pathname.split('/').at(-1)).toSorted(),['md-overview.geojson','md-statistical.geojson','ro-overview.geojson','ro-statistical.geojson']);
      const state=await page.call(layout);assert.equal(state.overflow,false);assert.ok(state.controls.every(c=>c.width>=44&&c.height>=44&&c.hit));
      await page.screenshot(path.join(output,'p76-'+temperature+'-'+width+'x'+height+'.png'));
     }
     assert.deepEqual(page.errors,[]);assert.deepEqual(page.responses.filter(r=>r.url.startsWith(targetUrl(browser))&&r.status>=400),[]);
    }finally{await browser.close();}
   });
  }
  const browser=await launchBrowser(root),page=await browser.page();
  try{
   await page.viewport(1440,900);await page.navigate(targetUrl(browser));
   await t.test('all identities retain reciprocal hierarchy with bounded forward and reverse DOM',async()=>{
    const state=await page.call(function(){const broken=[];for(const node of qaApp.hierarchyNodeById.values())for(const id of node.child_ids)if(qaApp.hierarchyNodeById.get(id)?.parent_id!==node.id)broken.push(id);const start=performance.now();qaApp.atlasTree.setOpenIds([...qaApp.hierarchyNodeById.values()].filter(n=>n.child_ids.length).map(n=>n.id));return {broken,expandMs:performance.now()-start,identities:qaApp.entityById.size};});assert.deepEqual(state.broken,[]);assert.equal(state.identities,5848);
    for(const fraction of [0,.25,.5,.75,1,.75,.5,.25,0]){
     await page.call(function(fraction){const host=document.querySelector('#hierarchy-tree');host.scrollTop=(host.scrollHeight-host.clientHeight)*fraction;},fraction);await delay(80);
     const metrics=await page.call(function(){const host=document.querySelector('#hierarchy-tree'),rows=[...host.querySelectorAll('.tree-node')];return {mounted:rows.length,dom:host.querySelectorAll('*').length,visible:qaApp.atlasTree.getVisibleCount(),indices:rows.map(r=>Number(r.getAttribute('aria-rowindex')))};});assert.equal(metrics.visible,5848);assert.ok(metrics.mounted<40);assert.ok(metrics.dom<350);assert.deepEqual(metrics.indices,metrics.indices.toSorted((a,b)=>a-b));reports.layouts.push({tree:fraction,...state,...metrics});
    }
   });
   await t.test('nine native profiles and repeated transitions retain accessible commands and header',async()=>{
    await page.call(function(){qaApp.atlasPanels.close({focus:false});window.p76Map=qaApp.map;window.p76Commands=[...document.querySelector('.leaflet-control-zoom').children];});
    for(const [width,height] of [...shapes,[390,844],[768,1024],[1440,900],[390,844],[844,390],[390,844]]){
     await page.viewport(width,height);const state=await page.call(layout);reports.layouts.push({width,height,...state});assert.equal(state.overflow,false);assert.ok(state.title.top>=state.header.top&&state.title.bottom<=state.header.bottom);assert.ok(state.controls.every(c=>c.width>=44&&c.height>=44&&c.hit));assert.ok(await page.call(function(){return p76Map===qaApp.map&&p76Commands.every((e,i)=>e===document.querySelector('.leaflet-control-zoom').children[i]);}));
     await page.openPanel('modules');await page.key('Escape');assert.equal(await page.evaluate('document.activeElement.id'),'modules-toggle');await page.screenshot(path.join(output,'p76-native-'+width+'x'+height+'.png'));
    }
   });
   await t.test('forced colors and reduced motion preserve named native focus targets',async()=>{
    await page.send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'},{name:'prefers-reduced-motion',value:'reduce'}]});await page.openPanel('entities');
    await page.call(function(){qaApp.atlasTree.select('osm-r90689');qaApp.atlasTree.getNode('osm-r90689').button.focus();});await page.key('ArrowDown');
    const state=await page.call(function(){const button=document.activeElement;return {forced:matchMedia('(forced-colors: active)').matches,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,focused:button.classList.contains('tree-select'),outline:getComputedStyle(button).outlineStyle,name:button.textContent};});assert.ok(state.forced&&state.reduced&&state.focused);assert.notEqual(state.outline,'none');assert.ok(state.name);await page.screenshot(path.join(output,'p76-forced-colors.png'));await page.key('Escape');await page.send('Emulation.setEmulatedMedia',{features:[]});
   });
   await t.test('extreme pane width preserves usable map/card and reversibly restores the preferred width',async()=>{
    await page.viewport(900,768);await page.openPanel('entities');await page.call(async function(){qaApp.atlasExplorerShell.setWidth(660);await qaApp.selectEntity('osm-r58974',{source:'map',zoom:false});});await delay(200);
    const fit=await page.call(function(){const card=document.querySelector('#details-panel'),button=document.querySelector('#details-close'),r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {pane:qaApp.atlasExplorerShell.width,map:document.querySelector('#map').clientWidth,card:card.clientWidth,scroll:card.scrollWidth,close:{width:r.width,height:r.height,hit:button===hit||button.contains(hit)}};});assert.ok(fit.pane<660&&fit.map>=320);assert.equal(fit.card,fit.scroll);assert.ok(fit.close.width>=44&&fit.close.height>=44&&fit.close.hit);reports.layouts.push({extremePane:fit});
    await page.screenshot(path.join(output,'p76-pane-limit-900.png'));await page.viewport(1440,900);await waitFor(()=>page.evaluate('qaApp.atlasExplorerShell.width===660'),'restore wide preference');await page.viewport(900,768);await waitFor(()=>page.evaluate('qaApp.atlasExplorerShell.width<660'),'reapply narrow limit');await page.call(function(){qaApp.atlasExplorerShell.setWidth(340);qaApp.clearSelection();});
   });
   await t.test('explicit 200 percent text enlargement keeps the complete header and module focus accessible',async()=>{
    for(const [width,height] of [[360,640],[640,360],[1440,900]]){
     await page.viewport(width,height);await page.navigate(targetUrl(browser));await page.call(async function(){await qaApp.selectEntity('osm-r58974',{source:'map',zoom:false});qaApp.atlasPanels.close({focus:false});});
     await page.call(function(){const sizes=[...document.querySelectorAll('body *')].filter(e=>e.namespaceURI==='http://www.w3.org/1999/xhtml').map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const [e,size] of sizes)e.style.setProperty('font-size',size*2+'px','important');});await delay(200);
     await waitFor(()=>page.call(function(){const element=document.querySelector('#map'),size=qaApp.map.getSize();return size.x===element.clientWidth&&size.y===element.clientHeight;}),'map follows intrinsic header');
     const state=await page.call(layout);reports.text.push({width,height,...state});assert.equal(state.overflow,false);assert.ok(state.title.top>=state.header.top&&state.title.bottom<=state.header.bottom,'enlarged title must not be clipped');
     await page.call(function(){document.querySelector('#modules-toggle').focus();});await page.key('Enter');assert.equal(await page.evaluate('document.activeElement.id'),'drawer-close');await page.key('Escape');assert.equal(await page.evaluate('document.activeElement.id'),'modules-toggle');await page.screenshot(path.join(output,'p76-text200-'+width+'x'+height+'.png'));
     if(width<900)for(const sheet of ['peek','half','expanded']){
      await page.call(function(sheet){qaApp.atlasMobile.setSheet(sheet);},sheet);await delay(100);
      const fit=await page.call(function(){const rect=e=>e.getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,card=rect(document.querySelector('#details-panel')),rail=rect(document.querySelector('#atlas-navigation-rail')),scale=rect(document.querySelector('.leaflet-control-scale')),credit=rect(document.querySelector('.leaflet-control-attribution'));return {card:{top:card.top,bottom:card.bottom,height:card.height},rail:overlap(card,rail),scale:overlap(card,scale),credit:overlap(card,credit),annotationOverlap:overlap(scale,credit)};});assert.ok(!fit.rail&&!fit.scale&&!fit.credit&&!fit.annotationOverlap,JSON.stringify({width,sheet,fit}));reports.text.push({width,height,sheet,...fit});await page.screenshot(path.join(output,'p76-text200-card-'+width+'-'+sheet+'.png'));
      const targets=await page.call(function(){return [...document.querySelectorAll('#details-panel .details-head button')].filter(e=>!e.hidden&&e.getClientRects().length).map(e=>e.id);});
      for(const id of targets){await page.call(function(id){document.getElementById(id).focus();},id);const target=await page.call(function(id){const e=document.getElementById(id),r=e.getBoundingClientRect(),card=document.querySelector('#details-panel').getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {id,width:r.width,height:r.height,whole:r.top>=card.top&&r.bottom<=card.bottom,hit:e===hit||e.contains(hit)};},id);assert.ok(target.width>=44&&target.height>=44&&target.whole&&target.hit,JSON.stringify({width,sheet,target}));reports.text.push({width,height,sheet,cardFocus:target});}
     }
     await page.openPanel('entities');await page.call(function(){qaApp.atlasTree.select('osm-r90689');qaApp.atlasTree.getNode('osm-r90689').button.focus();document.querySelector('#atlas-controls').scrollTop=0;});await page.key('ArrowDown');
     const target=await page.call(function(){const e=document.activeElement,r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {height:document.querySelector('#hierarchy-tree').clientHeight,width:r.width,hit:e===hit||e.contains(hit),focused:e.classList.contains('tree-select'),panelScroll:document.querySelector('#atlas-controls').scrollTop};});assert.ok(target.height>=44&&target.width>=44&&target.hit&&target.focused,JSON.stringify(target));reports.text.push({width,height,tree:target});await page.screenshot(path.join(output,'p76-text200-tree-'+width+'x'+height+'.png'));await page.key('Escape');
    }
   });
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.responses.filter(r=>r.url.startsWith(targetUrl(browser))&&r.status>=400),[]);
  }finally{await browser.close();}
 });
}finally{await writeFile(path.join(output,'p76-final-report.json'),JSON.stringify(reports,null,2));}
