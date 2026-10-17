import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P9.0.9.5 Chromium: OSM root/district one-checkbox/one-own-feature parity with RO/MD',{timeout:180000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.nistreniaOutlines?.layers?.size===8&&qaApp.atlasTree?.getVisibleIds().includes('view-nistrenia')"),'eight verified independent source outlines');
  await t.test('default has three country outlines selected and NI has no checked subdivisions',async()=>{
   const state=await page.evaluate(`({
    root:qaApp.visibleOperationalOutlineIds.has('view-nistrenia'),
    others:[...qaApp.visibleOperationalOutlineIds].filter(x=>x!=='view-nistrenia'),
    act:[...qaApp.visibleEntityIds].sort(),
    checked:['ro','md','ni'].map(j=>document.querySelector('#layer-'+j).checked),
    sourceLayers:[...qaApp.nistreniaOutlines.layers].filter(([id,l])=>qaApp.map.hasLayer(l)).map(([id])=>id)
   })`);
   assert.equal(state.root,true);assert.deepEqual(state.others,[]);
   assert.deepEqual(state.act,['osm-r58974','osm-r90689']);
   assert.deepEqual(state.checked,[true,true,true]);
   assert.deepEqual(state.sourceLayers,['view-nistrenia']);
  });
  await t.test('root and district checkboxes operate on only their own outlines, never on children',async()=>{
   await page.openPanel('entities');
   await page.click('.tree-visibility-toggle[data-entity-id="view-nistrenia"]');
   let state=await page.evaluate("({out:[...qaApp.visibleOperationalOutlineIds],ids:[...qaApp.visibleEntityIds],on:[...qaApp.nistreniaOutlines.layers].filter(([id,l])=>qaApp.map.hasLayer(l)).map(([id])=>id)})");
   assert.deepEqual(state.out,[]);assert.equal(state.ids.length,2);assert.deepEqual(state.on,[]);
   await page.click('.tree-visibility-toggle[data-entity-id="view-nistrenia"]');
   await page.evaluate("if(!qaApp.atlasTree.isOpen('view-nistrenia'))qaApp.atlasTree.toggle('view-nistrenia')");
   await page.click('.tree-visibility-toggle[data-entity-id="view-nistrenia-group-osm-r1702216"]');
   state=await page.evaluate("({out:[...qaApp.visibleOperationalOutlineIds].sort(),ids:[...qaApp.visibleEntityIds],on:[...qaApp.nistreniaOutlines.layers].filter(([id,l])=>qaApp.map.hasLayer(l)).map(([id])=>id).sort(),ni:document.getElementById('layer-ni').checked})");
   assert.deepEqual(state.out,['view-nistrenia','view-nistrenia-group-osm-r1702216']);
   assert.deepEqual(state.on,state.out);assert.equal(state.ids.length,2);assert.equal(state.ni,true);
  });
  await t.test('click Camenca NAME centers own OSM outline without checking 13 components',async()=>{
   await page.click('.tree-select[data-entity-id="view-nistrenia-group-osm-r1702216"]');
   const a=await page.evaluate("({out:[...qaApp.visibleOperationalOutlineIds],ids:[...qaApp.visibleEntityIds],details:document.querySelector('#details-body')?.textContent,source:qaApp.nistreniaOutlines.layers.get('view-nistrenia-group-osm-r1702216').toGeoJSON()?.features?.length})");
   assert.equal(a.out.length,2);assert.equal(a.ids.length,2);assert.match(a.details,/OSM/);assert.match(a.details,/Republicii Moldova/);
  });
  await t.test('NI Filter does not change independent geometry checkbox states; Straturi has NI',async()=>{
   await page.openPanel('filters');await page.click('#layer-ni');
   let a=await page.evaluate("({checked:[...qaApp.visibleOperationalOutlineIds].sort(),shown:[...qaApp.nistreniaOutlines.layers].filter(([id,l])=>qaApp.map.hasLayer(l)).length})");
   assert.equal(a.checked.length,2);assert.equal(a.shown,0);
   await page.click('#layer-ni');
   a=await page.evaluate("({checked:[...qaApp.visibleOperationalOutlineIds].sort(),shown:[...qaApp.nistreniaOutlines.layers].filter(([id,l])=>qaApp.map.hasLayer(l)).length})");
   assert.equal(a.shown,2);assert.equal(a.checked.length,2);
   await page.openPanel('visible');
   const text=await page.evaluate("document.getElementById('atlas-advanced-content')?.textContent||''");
   assert.match(text,/Nistrenia/);assert.match(text,/Camenca/);
  });
  await t.test('Reset returns to RO+MD+NI root only; URL roundtrip of district and independent filters',async()=>{
   await page.evaluate("qaApp.atlasTree.getNode('view-nistrenia-group-osm-r1702216')?.checkbox.click()");
   await page.evaluate("qaApp.atlasTree.getNode('view-nistrenia-group-osm-r1702216')?.checkbox.click()");
   const url=await page.evaluate("new URL(location.href).search");
   assert.match(url,/o=view-nistrenia-group-osm-r1702216/);
   await page.openPanel('entities');
   await page.click('#geometries-reset');
   const after=await page.evaluate("({out:[...qaApp.visibleOperationalOutlineIds],act:[...qaApp.visibleEntityIds].sort()})");
   assert.deepEqual(after.out,['view-nistrenia']);assert.deepEqual(after.act,['osm-r58974','osm-r90689']);
  });
  await t.test('portrait and landscape mobile: visible NI root/raion and independent filters',async()=>{
   for(const [w,h]of [[390,844],[844,390]]){
    await page.viewport(w,h);await page.openPanel('filters');
    const a=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,ni:document.querySelector('#layer-ni')?.checked,visible:document.querySelector('#layer-ni')?.getBoundingClientRect().height>0,roots:qaApp.nistreniaOutlines?.layers.size})");
    assert.equal(a.overflow,false);assert.equal(a.ni,true);assert.equal(a.visible,true);assert.equal(a.roots,8);
    await page.openPanel('entities');
    assert.equal(await page.evaluate("qaApp.atlasTree.getVisibleIds().includes('view-nistrenia-group-osm-r1702216')"),true);
   }
  });
  await t.test('no extra ACTUAL geometry, runtime external OSM API or browser exceptions',async()=>{
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.equal(page.requests.filter(r=>/api\.openstreetmap\.org|overpass-api\.de|nistrenia.*geojson/i.test(r.url)).length,0);
  });
 });
}finally{await browser.close();}
