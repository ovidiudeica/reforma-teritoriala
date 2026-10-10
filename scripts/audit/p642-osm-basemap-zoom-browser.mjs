import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
const state=()=>page.evaluate(`(()=>{
 const map=qaApp.map,zoom=document.querySelector('.leaflet-control-zoom'),button=document.querySelector('#basemap-toggle');
 const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
 const scale=document.querySelector('.leaflet-control-scale')?.getBoundingClientRect();
 const zoomRect=zoom.getBoundingClientRect();
 const scaleOverlapsZoom=!!scale&&scale.left<zoomRect.right&&scale.right>zoomRect.left&&scale.top<zoomRect.bottom&&scale.bottom>zoomRect.top;
 const controlsClear=[...zoom.children].every(control=>{
  const box=control.getBoundingClientRect(),at=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
  return at===control||control.contains(at);
 });
 const raster=Object.values(map._layers).filter(l=>typeof l._url==='string'&&l._url.includes('tile.openstreetmap.org')).length;
 const visible=[...qaApp.visibleEntityIds].sort(),selected=qaApp.selectedEntityId;
 return {order:[...zoom.children].map(e=>e.id||e.className),parent:button.parentElement===zoom,
  width:r.width,height:r.height,hit:hit===button||button.contains(hit),controlsClear,scaleOverlapsZoom,svg:!!button.querySelector('svg'),
  svgHidden:button.querySelector('svg')?.getAttribute('aria-hidden'),slash:getComputedStyle(button.querySelector('.atlas-osm-off-mark')).display,
  pressed:button.getAttribute('aria-pressed'),label:button.getAttribute('aria-label'),title:button.title,
  raster,visible,selected,zoom:map.getZoom(),center:[map.getCenter().lat,map.getCenter().lng],
  scroll:document.documentElement.scrollWidth>innerWidth,url:location.href,focused:document.activeElement.id};
})()`);
const ready=()=>waitFor(()=>page.evaluate('qaApp.entityById.size===5848 && !!document.querySelector(".leaflet-control-zoom #basemap-toggle")'),'P642 app');
const order=['leaflet-control-zoom-in','leaflet-control-zoom-out','map-home','basemap-toggle'];
const assertControl=(s,where)=>{assert.deepEqual(s.order,order,where);assert.ok(s.parent&&s.svg&&s.svgHidden==='true',where+' SVG+parent');assert.ok(s.width>=44&&s.height>=44,where+' touch area');assert.ok(s.hit&&s.controlsClear,where+' control covered');assert.equal(s.scaleOverlapsZoom,false,where+' Leaflet scale intersects zoom/home/OSM group');assert.equal(s.scroll,false,where+' overflow');};
try{
 await test('P6.4.2 OSM icon integrated below zoom/home and raster independent',{timeout:240000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');await ready();
  await t.test('four native Leaflet controls accessible on all 8 responsive shapes',async()=>{
   for(const [w,h] of [[390,844],[360,640],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900]]){
    await page.viewport(w,h);await page.navigate(browser.server.url+'/');await ready();
    const s=await state();assertControl(s,w+'x'+h);assert.equal(s.pressed,'true');assert.equal(s.raster,1);
    assert.equal(s.slash,'none');assert.deepEqual(s.visible,['osm-r58974','osm-r90689'].sort());
   }
  });
  await t.test('toggle off/on removes only OSM tile layer, retaining polygons and checked IDs',async()=>{
   await page.viewport(390,844);await page.navigate(browser.server.url+'/');await ready();
   const before=await state(),polygonCount=await page.evaluate("document.querySelectorAll('.leaflet-overlay-pane path').length");
   assert.ok(polygonCount>=2);
   await page.click('#basemap-toggle');
   const off=await state();assertControl(off,'OSM off');assert.equal(off.pressed,'false');assert.equal(off.raster,0);
   assert.equal(off.slash,'block');assert.match(off.label,/dezactivat/);assert.match(off.title,/Activează/);
   assert.match(new URL(off.url).searchParams.get('m')||'',/^0$/);
   assert.deepEqual(off.visible,before.visible);assert.equal(off.selected,before.selected);
   assert.equal(off.zoom,before.zoom);assert.deepEqual(off.center,before.center);
   assert.equal(await page.evaluate("document.querySelectorAll('.leaflet-overlay-pane path').length"),polygonCount);
   await page.click('#basemap-toggle');
   const on=await state();assert.equal(on.pressed,'true');assert.equal(on.raster,1);assert.equal(on.slash,'none');
   assert.match(on.label,/activ/);assert.equal(new URL(on.url).searchParams.has('m'),false);
   assert.deepEqual(on.visible,before.visible);assert.equal(on.selected,before.selected);
  });
  await t.test('URL m=0 restores OSM disabled and browser Back/Forward preserves toggle',async()=>{
   await page.viewport(844,390);await page.navigate(browser.server.url+'/?v=1&lat=46&lon=27&z=8');await ready();
   const before=await state();assert.equal(before.raster,1);assert.equal(before.zoom,8);
   await page.click('#basemap-toggle');const off=await state();assert.equal(off.raster,0);
   await page.evaluate('history.back()');
   await waitFor(()=>page.evaluate("document.getElementById('basemap-toggle').getAttribute('aria-pressed')==='true'"),'Back OSM on');
   const back=await state();assert.equal(back.raster,1);assert.equal(back.zoom,8);
   await page.evaluate('history.forward()');
   await waitFor(()=>page.evaluate("document.getElementById('basemap-toggle').getAttribute('aria-pressed')==='false'"),'Forward OSM off');
   assert.equal((await state()).raster,0);
   await page.navigate(browser.server.url+'/?m=0&v=1&lat=46&lon=27&z=8');await ready();
   assert.equal((await state()).raster,0);assert.equal((await state()).pressed,'false');
  });
  await t.test('selected entity and country-fit icon do not alter OSM toggle or visibility',async()=>{
   await page.viewport(844,390);await page.navigate(browser.server.url+'/');await ready();
   const id=await page.evaluate("[...qaApp.entityById.values()].find(e=>e.jurisdiction==='RO'&&!qaApp.visibleEntityIds.has(e.id)&&e.map?.bbox).id");
   await page.evaluate('qaApp.selectEntity('+JSON.stringify(id)+",{source:'map',zoom:false})");
   const before=await state();assertControl(before,'selected landscape');
   await page.click('#basemap-toggle');const off=await state();
   assert.equal(off.selected,id);assert.deepEqual(off.visible,before.visible);assert.equal(off.raster,0);
   await page.click('#map-home');const fit=await state();assertControl(fit,'fit after OSM off');
   assert.equal(fit.raster,0);assert.equal(fit.selected,id);assert.deepEqual(fit.visible,before.visible);
  });
  await t.test('native keyboard Enter toggles with focus and pressed state intact',async()=>{
   await page.viewport(1440,900);await page.navigate(browser.server.url+'/');await ready();
   await page.evaluate("document.getElementById('basemap-toggle').focus()");
   assert.equal((await state()).focused,'basemap-toggle');
   await page.key('Enter');
   await waitFor(()=>page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')==='false'"),'keyboard off');
   const s=await state();assert.equal(s.focused,'basemap-toggle');assert.equal(s.raster,0);
   await page.key('Enter');await waitFor(()=>page.evaluate("document.querySelector('#basemap-toggle').getAttribute('aria-pressed')==='true'"),'keyboard on');
   assert.equal((await state()).raster,1);
  });
  await t.test('desktop collapsed explorer keeps basemap button inside zoom bar',async()=>{
   await page.openPanel('entities');await page.click('#mobile-navigation');const s=await state();assertControl(s,'collapsed desktop');
   await page.click('#basemap-toggle');assert.equal((await state()).raster,0);
  });
  await t.test('no own-asset errors or browser application exceptions',()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
