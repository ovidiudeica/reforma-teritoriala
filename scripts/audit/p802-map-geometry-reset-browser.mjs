import test from 'node:test';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';import {mkdir} from 'node:fs/promises';import path from 'node:path';
import {launchBrowser,delay,waitFor} from '../test/helpers/atlas-browser.mjs';
import {auditEvidenceDirectory} from '../test/helpers/atlas-evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=auditEvidenceDirectory();
await mkdir(out,{recursive:true});const b=await launchBrowser(root),p=await b.page();
const preserved=()=>p.call(function(){return {selection:qaApp.selectedEntityId,card:document.getElementById('details-title').textContent,filters:[...qaApp.activeGeometrySubtypes].sort(),classes:[...qaApp.activeGeometryClasses].sort(),levels:[...qaApp.activeStatisticalLevels].sort(),osm:qaApp.captureUrlState().osmBasemapVisible,zoom:qaApp.map.getZoom(),center:qaApp.map.getCenter()};});
try{
 await test('P8.0.2 adapted WEB-R3.2: single geometry reset owner, map navigation-only',{timeout:240000},async t=>{
  await p.viewport(1440,900);await p.navigate(b.server.url+'/');
  await waitFor(()=>p.evaluate('qaApp.entityById.size===5848'),'P802 app');
  await p.call(function(){window.p802Roots=[...qaApp.visibleEntityIds].sort();window.p802Extras=[...qaApp.entityById.keys()].filter(id=>!qaApp.visibleEntityIds.has(id)).slice(0,10);window.p802Map=qaApp.map;window.p802Tree=qaApp.atlasTree;});
  await t.test('one contextual reset and exactly three map navigation controls',async()=>{
   assert.equal(await p.evaluate('document.querySelectorAll("#geometries-reset").length'),1);
   assert.equal(await p.evaluate('document.getElementById("map-geometries-reset")'),null);
   assert.deepEqual(await p.evaluate("[...document.querySelector('.leaflet-control-zoom').children].map(e=>e.id||e.className)"),['leaflet-control-zoom-in','leaflet-control-zoom-out','map-home']);
   assert.equal(await p.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')"),'true');
  });
  await t.test('keyboard reset preserves selection, viewport, filters and adds one History entry',async()=>{
   await p.call(async function(){await qaApp.selectEntity(window.p802Extras[0],{zoom:false,source:'map'});for(const id of window.p802Extras)qaApp.visibleEntityIds.add(id);qaApp.refreshGeometryVisibility();await qaApp.syncTiers();qaApp.atlasUrl.commit('push');});
   await p.openPanel('entities');const before=await preserved(),historyLength=await p.evaluate('history.length');
   assert.equal(await p.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')"),'false');
   await p.call(function(){document.getElementById('geometries-reset').focus();});await p.key('Enter');await delay(150);
   assert.deepEqual(await preserved(),before);assert.deepEqual(await p.evaluate('[...qaApp.visibleEntityIds].sort()'),await p.evaluate('window.p802Roots'));
   assert.equal(await p.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')"),'true');
   assert.equal(await p.evaluate('document.activeElement.id'),'geometries-reset');
   assert.equal(await p.evaluate('history.length'),historyLength+1);
   assert.equal(await p.evaluate('qaApp.map===window.p802Map&&qaApp.atlasTree===window.p802Tree'),true);
  });
  await t.test('Back and Forward restore per-ID checkboxes and reset state',async()=>{
   await p.evaluate('history.back()');await waitFor(()=>p.evaluate('qaApp.visibleEntityIds.size===12'),'back checks');
   assert.equal(await p.evaluate("document.getElementById('geometries-reset').getAttribute('aria-disabled')"),'false');
   await p.evaluate('history.forward()');await waitFor(()=>p.evaluate('qaApp.visibleEntityIds.size===2'),'forward checks');
   assert.equal(await p.evaluate("document.getElementById('geometries-reset').getAttribute('aria-disabled')"),'true');
  });
  await t.test('desktop and mobile panel reset and navigation targets remain reachable',async()=>{
   for(const [w,h] of [[360,640],[390,844],[844,390],[768,1024],[900,768],[1440,900]]){
    await p.viewport(w,h);await p.openPanel('entities');
    const r=await p.call(function(){const e=document.getElementById('geometries-reset'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,hit:e===hit||e.contains(hit)};});
    assert.ok(r.width>=44&&r.height>=44&&r.hit,JSON.stringify({w,h,r}));
    await p.screenshot(path.join(out,'p802-r32-'+w+'x'+h+'.png'));
    await p.click('#drawer-close');
    const ids=await p.evaluate("[...document.querySelector('.leaflet-control-zoom').children].map(e=>e.id||e.className)");
    assert.deepEqual(ids,['leaflet-control-zoom-in','leaflet-control-zoom-out','map-home']);
   }
  });
  await t.test('no application errors',()=>{assert.deepEqual(p.errors,[]);assert.deepEqual(p.console.filter(x=>x.type==='error'),[]);});
 });
}finally{await b.close();}
