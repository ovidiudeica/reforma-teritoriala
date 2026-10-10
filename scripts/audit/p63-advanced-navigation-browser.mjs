import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
const idsState="({ids:[...qaApp.visibleEntityIds].sort(),classes:[...qaApp.activeGeometryClasses].sort(),subtypes:[...qaApp.activeGeometrySubtypes].sort(),raster:document.querySelector('#basemap-toggle').getAttribute('aria-pressed')})";
try{
 await test('P6.3 advanced navigator in real Chrome: explicit geometry, search, compare, history, responsive',{timeout:180000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');
  await waitFor(()=>page.evaluate('qaApp.entityById.size===5848 && qaApp.atlasAdvanced?.state'),'P6.3 controller');
  await t.test('checked layers lists only explicit ROOT defaults and close returns focus',async()=>{
   const before=await page.evaluate(idsState);
   await page.click('#advanced-visible');
   const state=await page.evaluate("({open:document.querySelector('#atlas-advanced-dialog').open,focus:document.activeElement.id,rows:[...document.querySelectorAll('#atlas-advanced-content .atlas-advanced-row')].map(el=>el.textContent)})");
   assert.equal(state.open,true);assert.equal(state.focus,'advanced-close');assert.equal(state.rows.length,2);
   await page.key('Escape');
   assert.equal(await page.evaluate("document.querySelector('#atlas-advanced-dialog').open"),false);
   assert.equal(await page.evaluate('document.activeElement.id'),'advanced-visible');
   assert.deepEqual(await page.evaluate(idsState),before);
  });
  await t.test('visible layers checkbox acts only on one exact ID and does not change taxonomy',async()=>{
   const original=await page.evaluate(idsState);
   await page.click('#advanced-visible');
   await page.click('#atlas-advanced-content .atlas-advanced-row-actions button:first-child');
   const changed=await page.evaluate(idsState);
   assert.equal(changed.ids.length,1);assert.deepEqual(changed.classes,original.classes);assert.deepEqual(changed.subtypes,original.subtypes);assert.equal(changed.raster,original.raster);
   await page.click('#atlas-advanced-content > button');
   assert.deepEqual(await page.evaluate(idsState),original);
   await page.click('#advanced-close');
  });
  await t.test('search highlights normalized query safely and retains jurisdiction grouping',async()=>{
   await page.evaluate("(()=>{let el=document.getElementById('entity-search');el.value='bucur';el.dispatchEvent(new Event('input',{bubbles:true}));})()");
   const result=await page.evaluate("({marks:[...document.querySelectorAll('#search-results mark')].map(el=>el.textContent).slice(0,10),options:document.querySelectorAll('#search-results [role=option]').length,expanded:document.getElementById('entity-search').getAttribute('aria-expanded')})");
   assert.ok(result.options>0);assert.ok(result.marks.length>0);assert.equal(result.expanded,'true');
   await page.key('Escape');
  });
  await t.test('recent selection remains local and does not check hidden geometry',async()=>{
   const id=await page.evaluate("[...qaApp.entityById.values()].find(e=>e.jurisdiction==='RO'&&e.map?.bbox&&!qaApp.visibleEntityIds.has(e.id)).id");
   const before=await page.evaluate(idsState);
   await page.evaluate('qaApp.selectEntity('+JSON.stringify(id)+",{source:'map',zoom:false})");
   await waitFor(()=>page.evaluate("qaApp.atlasAdvanced.state.recent.length>0"),'recent history');
   await page.click('#advanced-recent');
   const recent=await page.evaluate("({recent:qaApp.atlasAdvanced.state.recent,items:document.querySelectorAll('#atlas-advanced-content .atlas-advanced-row').length})");
   assert.equal(recent.recent[0],id);assert.ok(recent.items>0);
   assert.deepEqual(await page.evaluate(idsState),before);
   await page.click('#advanced-close');
  });
  await t.test('comparison requires explicit additions; pair metadata and map fit never checks geometry',async()=>{
   const first=await page.evaluate('qaApp.selectedEntityId');
   const second=await page.evaluate("([...qaApp.entityById.values()].find(e=>e.id!==qaApp.selectedEntityId&&e.map?.bbox&&e.jurisdiction==='MD'&&!qaApp.visibleEntityIds.has(e.id))).id");
   const before=await page.evaluate(idsState);
   await page.click('#compare-selected');
   assert.equal(await page.evaluate("qaApp.atlasAdvanced.state.pair.length"),1);
   await page.click('#advanced-close');
   await page.evaluate('qaApp.selectEntity('+JSON.stringify(second)+",{source:'map',zoom:false})");
   await page.click('#compare-selected');
   const pair=await page.evaluate("({ids:qaApp.atlasAdvanced.state.pair,cards:document.querySelectorAll('.atlas-comparison-card').length,canFit:!document.querySelector('#atlas-advanced-content > button')?.disabled})");
   assert.deepEqual(pair.ids,[first,second]);assert.equal(pair.cards,2);
   assert.deepEqual(await page.evaluate(idsState),before);
   await page.click('#atlas-advanced-content > button');
   assert.deepEqual(await page.evaluate(idsState),before);
   await page.click('#advanced-close');
  });
  await t.test('map home centers RO/MD without mutating selection, checkboxes or raster',async()=>{
   const before=await page.evaluate(idsState);
   await page.click('#map-home');
   const result=await page.evaluate("(()=>{const map=qaApp.map,bboxes=['osm-r58974','osm-r90689'].map(id=>qaApp.entityById.get(id).map.bbox),west=Math.min(...bboxes.map(b=>b[0])),east=Math.max(...bboxes.map(b=>b[2])),south=Math.min(...bboxes.map(b=>b[1])),north=Math.max(...bboxes.map(b=>b[3])),nw=map.latLngToContainerPoint([north,west]),se=map.latLngToContainerPoint([south,east]),size=map.getSize();return {nw:[nw.x,nw.y],se:[se.x,se.y],size:[size.x,size.y],selected:qaApp.selectedEntityId}})()");
   assert.ok(result.nw[0]>=10&&result.nw[1]>=24&&result.se[0]<=result.size[0]-10&&result.se[1]<=result.size[1]-24,'RO+MD root geometry bbox fully visible '+JSON.stringify(result));
   assert.deepEqual(await page.evaluate(idsState),before);
  });
  await t.test('desktop sidebar collapse and restore retain map, controls and active state',async()=>{
   const before=await page.evaluate(idsState);
   const oldWidth=await page.evaluate("document.getElementById('map').getBoundingClientRect().width");
   await page.click('#explorer-collapse');
   const hidden=await page.evaluate("({collapsed:qaApp.atlasExplorerShell.collapsed,inert:document.querySelector('#atlas-controls').inert,pressed:document.querySelector('#explorer-collapse').getAttribute('aria-pressed'),width:document.getElementById('map').getBoundingClientRect().width})");
   assert.ok(hidden.collapsed&&hidden.inert);assert.equal(hidden.pressed,'true');assert.ok(hidden.width>oldWidth);
   await page.click('#explorer-collapse');
   assert.equal(await page.evaluate('qaApp.atlasExplorerShell.collapsed'),false);
   assert.deepEqual(await page.evaluate(idsState),before);
  });
  await t.test('mobile dialog remains accessible with focus recovered and never opens hidden drawer',async()=>{
   await page.viewport(390,844);
   await page.click('#mobile-navigation');
   await page.click('#advanced-visible');
   assert.equal(await page.evaluate('qaApp.atlasMobile.state.drawer'),false);
   assert.equal(await page.evaluate("document.querySelector('#atlas-advanced-dialog').open"),true);
   await page.key('Escape');
   assert.equal(await page.evaluate('document.activeElement.id'),'mobile-navigation');
   assert.equal(await page.evaluate("document.querySelector('#atlas-advanced-dialog').open"),false);
   assert.equal(await page.evaluate("document.documentElement.scrollWidth>innerWidth"),false);
  });
  await t.test('no browser errors or own-site 404s',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
