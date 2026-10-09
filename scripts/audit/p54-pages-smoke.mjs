import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const publicUrl='https://ovidiudeica.github.io/reforma-teritoriala/';
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P5.4 public Pages production smoke — P5.3 merge',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(publicUrl);
  await t.test('live release, default RO/MD only, no selected entity',async()=>{
   const s=await page.evaluate("({count:qaApp.entityById.size,visible:[...qaApp.visibleEntityIds].sort(),card:document.querySelector('#details-panel').hidden,selected:qaApp.selectedEntityId,basename:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),tiles:document.querySelectorAll('.leaflet-tile-pane img').length,polygons:document.querySelectorAll('.leaflet-overlay-pane path').length})");
   assert.equal(s.count,5848);
   assert.deepEqual(s.visible,['osm-r58974','osm-r90689'].sort());
   assert.equal(s.selected,null);
   assert.equal(s.card,true);
   assert.equal(s.basename,'true');
   assert.ok(s.polygons>0,'public vector polygons not rendered '+JSON.stringify(s));
  });
  await t.test('OSM raster OFF preserves visible vector polygons; Back/Forward restores',async()=>{
   const before=await page.evaluate("({polygons:document.querySelectorAll('.leaflet-overlay-pane path').length,ids:[...qaApp.visibleEntityIds].sort()})");
   await page.click('#basemap-toggle');
   await waitFor(()=>page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')==='false'"),'OSM OFF');
   const off=await page.evaluate("({polygons:document.querySelectorAll('.leaflet-overlay-pane path').length,tiles:document.querySelectorAll('.leaflet-tile-pane img').length,ids:[...qaApp.visibleEntityIds].sort(),m:new URL(location.href).searchParams.get('m')})");
   assert.equal(off.tiles,0);assert.equal(off.polygons,before.polygons);assert.deepEqual(off.ids,before.ids);assert.equal(off.m,'0');
   await page.click('#basemap-toggle');
   await page.evaluate('history.back()');
   await waitFor(()=>page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')==='false'"),'Back returns OFF');
   await page.evaluate('history.forward()');
   await waitFor(()=>page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')==='true'"),'Forward returns ON');
  });
  await t.test('search tab and filters retain exact entities',async()=>{
   await page.click('#filters-toggle');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),false);
   await page.click('#filters-close');
   await page.query('Cluj');
   assert.equal(await page.evaluate("document.querySelector('#tab-results').getAttribute('aria-selected')"),'true');
   await page.selectQuery('osm-r91733');
   assert.equal(await page.evaluate("qaApp.selectedEntityId"),'osm-r91733');
   assert.equal(await page.evaluate("document.querySelector('#tab-entities').getAttribute('aria-selected')"),'true');
   assert.equal(await page.evaluate("document.querySelector('.tree-visibility-toggle[data-entity-id=\"osm-r91733\"]').checked"),false);
  });
  await t.test('seven real deployed viewports, UI and console errors',async()=>{
   for(const [width,height] of [[1440,900],[1280,800],[900,768],[360,800],[390,844],[430,932],[390,600]]){
    await page.viewport(width,height);
    const s=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,map:document.querySelector('#map').getBoundingClientRect().width,trigger:document.querySelector('#mobile-navigation').hidden,basemap:document.querySelector('#basemap-toggle').getBoundingClientRect().width})");
    assert.equal(s.overflow,false,width+' scroll overflow');assert.ok(s.map>0&&s.basemap>0);
    assert.equal(s.trigger,width>720,'navigation trigger '+width);
   }
   assert.deepEqual(page.errors,[]);
   const localBad=page.responses.filter(r=>{const uri=new URL(r.url);return r.status>=400&&uri.hostname==='ovidiudeica.github.io'&&uri.pathname.startsWith('/reforma-teritoriala/');});
   assert.deepEqual(localBad,[]);
   assert.deepEqual(page.console.filter(c=>c.type==='error'||c.level==='error'),[]);
  });
 });
}finally{await browser.close();}
