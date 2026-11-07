import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';
import {toggleSecondaryBasemap} from '../test/helpers/web-r32-basemap.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
const snapshot=()=>page.call(function(){
 const controls=[...document.querySelector('.leaflet-control-zoom').children].map(e=>e.id||e.className);
 const button=document.getElementById('basemap-toggle');
 const tiles=Object.values(qaApp.map._layers).filter(layer=>typeof layer._url==='string'&&layer._url.includes('tile.openstreetmap.org')).length;
 return {controls,osm:button.getAttribute('aria-pressed'),tiles,location:location.href,
  ids:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,
  center:qaApp.map.getCenter(),zoom:qaApp.map.getZoom(),secondaryParent:!!button.closest('#map-secondary-tools'),
  defaultsCollapsed:!document.getElementById('map-secondary-tools').open,
  noDuplicate:!document.getElementById('map-geometries-reset')};
});
const expected=['leaflet-control-zoom-in','leaflet-control-zoom-out','map-home'];
try{
 await test('P6.4.2 adapted WEB-R3.2: raster in retractable Filters section, map commands independent',{timeout:240000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');
  await waitFor(()=>page.evaluate('qaApp.entityById.size===5848'),'P642 app');
  await t.test('native map commands reduced to zoom and country fit in eight viewports',async()=>{
   for(const [w,h] of [[390,844],[360,640],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900]]){
    await page.viewport(w,h);await page.navigate(browser.server.url+'/');
    const s=await snapshot();assert.deepEqual(s.controls,expected,w+'x'+h);
    assert.equal(s.secondaryParent,true);assert.equal(s.defaultsCollapsed,true);assert.equal(s.noDuplicate,true);
    assert.equal(s.osm,'true');assert.equal(s.tiles,1);
    const hits=await page.call(function(){return [...document.querySelector('.leaflet-control-zoom').children].map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {w:r.width,h:r.height,hit:e===hit||e.contains(hit)};});});
    assert.ok(hits.every(x=>x.w>=44&&x.h>=44&&x.hit),JSON.stringify({w,h,hits}));
   }
  });
  await t.test('real pointer toggles only the OSM background and preserves geometry and selection',async()=>{
   await page.viewport(390,844);await page.navigate(browser.server.url+'/');const initial=await snapshot();
   await toggleSecondaryBasemap(page);const off=await snapshot();
   assert.equal(off.osm,'false');assert.equal(off.tiles,0);assert.deepEqual(off.ids,initial.ids);
   assert.equal(off.selected,initial.selected);assert.equal(off.zoom,initial.zoom);assert.deepEqual(off.center,initial.center);
   assert.equal(new URL(off.location).searchParams.get('m'),'0');
   await toggleSecondaryBasemap(page);const on=await snapshot();
   assert.equal(on.osm,'true');assert.equal(on.tiles,1);assert.deepEqual(on.ids,initial.ids);
   assert.equal(new URL(on.location).searchParams.has('m'),false);
   await page.evaluate('history.back()');await waitFor(()=>page.evaluate("document.getElementById('basemap-toggle').getAttribute('aria-pressed')==='false'"),'Back OSM off');
   await page.evaluate('history.forward()');await waitFor(()=>page.evaluate("document.getElementById('basemap-toggle').getAttribute('aria-pressed')==='true'"),'Forward OSM on');
  });
  await t.test('keyboard Enter activates expanded native disclosure button',async()=>{
   await page.viewport(1440,900);await page.navigate(browser.server.url+'/');
   await page.openPanel('filters');await page.call(function(){document.getElementById('map-secondary-tools').open=true;document.getElementById('basemap-toggle').focus();});
   assert.equal(await page.evaluate('document.activeElement.id'),'basemap-toggle');
   const rect=await page.call(function(){const e=document.getElementById('basemap-toggle'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {w:r.width,h:r.height,hit:e===hit||e.contains(hit)};});
   assert.ok(rect.w>=44&&rect.h>=44&&rect.hit,JSON.stringify(rect));
   await page.key('Enter');assert.equal((await snapshot()).osm,'false');
   await page.key('Enter');assert.equal((await snapshot()).osm,'true');
   assert.equal(await page.evaluate('document.activeElement.id'),'basemap-toggle');
   await page.key('Escape');assert.equal(await page.evaluate('qaApp.atlasPanels.state.active'),null);
  });
  await t.test('zero browser errors or failed own assets',()=>{
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
