import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {launchBrowser,delay} from '../test/helpers/atlas-browser.mjs';
import {auditEvidenceDirectory} from '../test/helpers/atlas-evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=auditEvidenceDirectory();
await mkdir(out,{recursive:true});
const browser=await launchBrowser(root),page=await browser.page();
const preserved=function(){return {selected:qaApp.selectedEntityId,card:document.querySelector('#details-title').textContent,cardHidden:document.querySelector('#details-panel').hidden,sheet:document.querySelector('#details-panel').dataset.sheet,open:qaApp.atlasTree.getOpenIds(),scroll:document.querySelector('#hierarchy-tree').scrollTop,filters:[...qaApp.activeGeometrySubtypes].sort(),classes:[...qaApp.activeGeometryClasses].sort(),levels:[...qaApp.activeStatisticalLevels].sort(),osm:qaApp.captureUrlState().osmBasemapVisible,center:qaApp.map.getCenter(),zoom:qaApp.map.getZoom()};};
const checks=function(){return [...document.querySelectorAll('.tree-visibility-toggle')].every(e=>e.checked===qaApp.visibleEntityIds.has(e.dataset.entityId));};
try{await test('P8.0.1 geometry reset preserves independent atlas state',{timeout:180000},async t=>{
 await page.viewport(1440,900);await page.navigate(browser.server.url+'/');await page.openPanel('entities');
 await t.test('default is disabled; ten extra identities reset in one history action',async()=>{
  assert.equal(await page.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')==='true'"),true);
  await page.call(async function(){
   window.p801Roots=[...qaApp.visibleEntityIds].sort();window.p801Map=qaApp.map;window.p801Tree=qaApp.atlasTree;
   window.p801Extras=[...qaApp.entityById.values()].filter(e=>e.map?.bbox&&!qaApp.visibleEntityIds.has(e.id)).slice(0,10).map(e=>e.id);
   await qaApp.selectEntity(window.p801Extras[0],{zoom:false,source:'map'});
   for(const id of window.p801Extras)qaApp.visibleEntityIds.add(id);
   qaApp.refreshGeometryVisibility();await qaApp.syncTiers();qaApp.atlasUrl.commit('push');
   qaApp.atlasTree.setOpenIds([...qaApp.hierarchyNodeById].filter(([,n])=>n.child_ids.length).map(([id])=>id));
   qaApp.atlasUrl.commit('replace');document.querySelector('#hierarchy-tree').scrollTop=2500;
  });await delay(180);
  const before=await page.call(preserved),length=await page.evaluate('history.length');
  await page.call(function(){document.querySelector('#geometries-reset').focus();});await page.key('Enter');await delay(120);
  assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),await page.evaluate('window.p801Roots'));
  assert.deepEqual(await page.call(preserved),before);assert.equal(await page.evaluate('history.length'),length+1);
  assert.equal(await page.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')==='true'"),true);
  assert.equal(await page.evaluate('qaApp.map===window.p801Map&&qaApp.atlasTree===window.p801Tree'),true);
  assert.ok(await page.call(checks));assert.match(await page.evaluate("document.querySelector('#geometries-reset-status').textContent"),/România și Moldova/);
 });
 await t.test('Back restores all prior checks; Forward resets them and updates disabled state',async()=>{
  await page.evaluate('history.back()');await delay(100);await page.evaluate('qaApp.atlasUrl.whenIdle()');
  assert.equal(await page.evaluate('qaApp.visibleEntityIds.size'),12);assert.equal(await page.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')==='true'"),false);assert.ok(await page.call(checks));
  await page.evaluate('history.forward()');await delay(100);await page.evaluate('qaApp.atlasUrl.whenIdle()');
  assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),await page.evaluate('window.p801Roots'));assert.ok(await page.call(checks));
  assert.equal(await page.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')==='true'"),true);
 });
 await t.test('virtualized rows reappear with current checks; filters and raster stay independent',async()=>{
  await page.call(function(){document.querySelector('#hierarchy-tree').scrollTop=100000;qaApp.activeGeometrySubtypes.clear();qaApp.refreshGeometryVisibility();document.querySelector('#basemap-toggle').click();qaApp.visibleEntityIds.add(window.p801Extras[1]);qaApp.refreshGeometryVisibility();qaApp.atlasUrl.commit('push');});await delay(150);
  const before=await page.call(preserved);await page.click('#geometries-reset');await delay(100);assert.deepEqual(await page.call(preserved),before);assert.ok(await page.call(checks));
  await page.call(function(){document.querySelector('#hierarchy-tree').scrollTop=0;});await delay(120);assert.ok(await page.call(checks));
 });
 await t.test('phone tablet desktop targets and native Space activation',async()=>{
  for(const [width,height]of [[360,640],[844,390],[768,1024],[1440,900]]){
   await page.viewport(width,height);await page.openPanel('entities');await page.call(function(){qaApp.visibleEntityIds.add(window.p801Extras[2]);qaApp.refreshGeometryVisibility();document.querySelector('#geometries-reset').focus();});await delay(100);
   const target=await page.call(function(){const e=document.querySelector('#geometries-reset'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,hit:e===hit||e.contains(hit)};});assert.ok(target.width>=44&&target.height>=44&&target.hit);
   await page.key(' ');await delay(80);assert.equal(await page.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')==='true'"),true);assert.equal(await page.evaluate('document.activeElement.id'),'geometries-reset');assert.ok(await page.call(checks));await page.screenshot(path.join(out,'p801-'+width+'x'+height+'.png'));
  }
 });
 await t.test('card and Layers changes sync availability; disabled activation is a no-op',async()=>{
  await page.viewport(1440,900);await page.call(function(){qaApp.atlasPanels.close({focus:false});});
  await page.click('#selection-visibility-action');
  assert.equal(await page.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')==='true'"),false);
  await page.openPanel('entities');await page.click('#geometries-reset');
  const before=await page.call(preserved),length=await page.evaluate('history.length');
  await page.key('Enter');assert.equal(await page.evaluate('history.length'),length);assert.deepEqual(await page.call(preserved),before);
  await page.openPanel('visible');await page.call(function(){const row=[...document.querySelectorAll('#atlas-advanced-content [data-entity-id]')].find(e=>e.dataset.entityId===window.p801Roots[0]);const action=[...row.querySelectorAll('button')].find(e=>e.textContent==='Ascunde');action.click();});
  assert.equal(await page.evaluate("document.querySelector('#geometries-reset').getAttribute('aria-disabled')==='true'"),false);
  await page.openPanel('entities');await page.click('#geometries-reset');assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),await page.evaluate('window.p801Roots'));assert.ok(await page.call(checks));
 });
 assert.deepEqual(page.errors,[]);
});}finally{await browser.close();}
