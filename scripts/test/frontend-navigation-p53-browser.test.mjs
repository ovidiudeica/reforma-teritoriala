import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P5.3 real Chrome: filters, search tabs, OSM tiles and history',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.entityById.size===5848&&document.querySelectorAll('.tree-select').length>0"),'ACTUAL ready');
  await t.test('initial P5.2 geometry and P5.3 controls remain independent',async()=>{
   const s=await page.evaluate("({roots:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,filters:document.querySelector('#filters-panel').hidden,tab:document.querySelector('#mobile-navigation').getAttribute('aria-pressed'),basemap:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),tiles:document.querySelectorAll('.leaflet-tile-pane img').length})");
   assert.deepEqual(s.roots,['osm-r58974','osm-r90689'].sort());assert.equal(s.selected,null);assert.equal(s.filters,true);assert.equal(s.tab,'true');assert.equal(s.basemap,'true');
  });
  await t.test('basemap toggles independently and History restores without checkbox changes',async()=>{
   await page.click('#basemap-toggle');
   assert.equal(await page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')"),'false');
   assert.equal(await page.evaluate("new URL(location.href).searchParams.get('m')"),'0');
   assert.deepEqual(await page.evaluate("[...qaApp.visibleEntityIds].sort()"),['osm-r58974','osm-r90689'].sort());
   assert.equal(await page.evaluate("document.querySelector('#map .leaflet-tile-pane').querySelectorAll('img').length"),0);
   await page.click('#basemap-toggle');
   assert.equal(await page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')"),'true');
   assert.equal(await page.evaluate("new URL(location.href).searchParams.get('m')"),null);
   await page.evaluate('history.back()');
   await waitFor(()=>page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')==='false'"),'back restore map');
   await page.evaluate('history.forward()');
   await waitFor(()=>page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')==='true'"),'forward restore map');
  });
  await t.test('filters independently open and preserve geometry checks',async()=>{
   await page.click('#filters-toggle');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),false);
   assert.equal(await page.evaluate("document.querySelector('#filters-toggle').getAttribute('aria-expanded')"),'true');
   await page.click('#layer-md');
   assert.equal(await page.evaluate("document.querySelector('#layer-md').checked"),false);
   assert.deepEqual(await page.evaluate("[...qaApp.visibleEntityIds].sort()"),['osm-r58974','osm-r90689'].sort());
   await page.click('#layer-md');
   await page.click('#drawer-close');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),true);
   assert.equal(await page.evaluate("document.activeElement.id"),'filters-toggle');
  });
  await t.test('search results tab and official selection preserve geometry and no duplicate IDs',async()=>{
   await page.query('Cluj');
   assert.equal(await page.evaluate("document.querySelector('#mobile-search').getAttribute('aria-pressed')"),'true');
   assert.equal(await page.evaluate("document.querySelector('#results-panel').hidden"),false);
   const ids=await page.evaluate("[...document.querySelectorAll('#search-results [role=option]')].map(e=>e.dataset.entityId)");
   assert.ok(ids.length>0);assert.equal(new Set(ids).size,ids.length);
   await page.key('ArrowDown');await page.key('Enter');
   await waitFor(()=>page.evaluate("qaApp.selectedEntityId!==null"),'search select');
   assert.equal(await page.evaluate("document.querySelector('#mobile-navigation').getAttribute('aria-pressed')"),'true');
   assert.equal(await page.evaluate("document.querySelector('#results-panel').hidden"),true);
  });
  await t.test('seven viewports preserve map and controls; no runtime errors',async()=>{
   for(const [w,h] of [[1440,900],[1280,800],[900,768],[360,800],[390,844],[430,932],[390,600]]){
    await page.viewport(w,h);
    const s=await page.evaluate("({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,map:document.querySelector('#map').getBoundingClientRect().width,basemap:document.querySelector('#basemap-toggle').getBoundingClientRect().width})");
    assert.equal(s.width,w);assert.equal(s.overflow,false,w+' overflow');assert.ok(s.map>0&&s.basemap>0);
   }
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
  await t.test('mobile filter subpanel Escape priority and drawer focus',async()=>{
   await page.viewport(390,844);
   await page.click('#mobile-navigation');
   await page.click('#filters-toggle');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),false);
   assert.equal(await page.evaluate("qaApp.atlasMobile.state.drawer"),true);
   await page.key('Escape');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),true);
   assert.equal(await page.evaluate("qaApp.atlasMobile.state.drawer"),false);
   assert.equal(await page.evaluate('document.activeElement.id'),'filters-toggle');
  });
 });
}finally{await browser.close();}
