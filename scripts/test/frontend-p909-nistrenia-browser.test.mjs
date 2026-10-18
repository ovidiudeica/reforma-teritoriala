import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P9.0.9 Chromium: Nistrenia via consolidated tree, no parallel OSM menu',{timeout:180000},async t=>{
  await page.viewport(1280,800);await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.nistreniaOutlines?.layers.size===8&&!!qaApp.atlasTree?.getNode('view-nistrenia')"),'Nistrenia verified tree ready',30000);
  await t.test('seven verified Nistrenia groups and 85 role children reuse existing ACTUAL IDs',async()=>{
   const state=await page.evaluate("fetch('public/data/p909-nistrenia-osm-navigation.json').then(r=>r.json()).then(c=>({counts:c.groups.map(g=>g.role_ids.length),ids:new Set(c.groups.flatMap(g=>g.role_ids)).size,roleNames:[...qaApp.atlasTree.getVisibleIds()],root:!!qaApp.atlasTree.getNode('view-nistrenia'),count:qaApp.hierarchyNodeById.size,oldMenu:!!document.getElementById('nistrenia-osm-toggle')}))");
   assert.deepEqual(state.counts,[13,23,10,16,3,16,4]);assert.equal(state.ids,85);
   assert.equal(state.count,5848);assert.equal(state.root,true);assert.equal(state.oldMenu,false);
   assert.equal(await page.evaluate("qaApp.atlasTree.getVisibleIds().includes('view-nistrenia')"),true);
   assert.equal(await page.evaluate("qaApp.atlasTree.getVisibleIds().includes('view-nistrenia-group-osm-r1702216')"),true);
  });
  await t.test('root and district are independently selected via tree, without selecting all descendants',async()=>{
   await page.openPanel('entities');
   const initial=await page.evaluate("({roots:[...qaApp.visibleEntityIds].sort(),ni:[...qaApp.visibleOperationalOutlineIds]})");
   assert.deepEqual(initial.roots,['osm-r58974','osm-r90689']);assert.deepEqual(initial.ni,['view-nistrenia']);
   await page.evaluate("if(!qaApp.atlasTree.isOpen('view-nistrenia'))qaApp.atlasTree.toggle('view-nistrenia')");
   await page.click('.tree-visibility-toggle[data-entity-id="view-nistrenia-group-osm-r1702216"]');
   const out=await page.evaluate("({ni:[...qaApp.visibleOperationalOutlineIds].sort(),actual:[...qaApp.visibleEntityIds].sort()})");
   assert.deepEqual(out.ni,['view-nistrenia','view-nistrenia-group-osm-r1702216']);
   assert.deepEqual(out.actual,initial.roots);
  });
  await t.test('Bender role selects the source-only card, without a second catalog UI',async()=>{
   await page.evaluate("if(!qaApp.atlasTree.isOpen('view-nistrenia-group-osm-r944727'))qaApp.atlasTree.toggle('view-nistrenia-group-osm-r944727')");
   assert.equal(await page.evaluate("qaApp.atlasTree.getVisibleIds().includes('view-nistrenia-role-osm-r9581354')"),true);
   await page.evaluate("qaApp.atlasTree.reveal('view-nistrenia-role-osm-r9581354')");
   await page.click('.tree-select[data-entity-id="view-nistrenia-role-osm-r9581354"]');
   await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r9581354'&&document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='osm-r9581354'"),'Bender source card',30000);
   const state=await page.evaluate("({text:document.querySelector('.osm-role-evidence')?.textContent,menu:!!document.getElementById('nistrenia-osm-panel')})");
   assert.match(state.text,/Neacordată/);assert.equal(state.menu,false);
  });
  await t.test('mobile portrait and landscape: NI tree and reset command remain visible and touch-sized',async()=>{
   for(const [w,h] of [[390,844],[844,390]]){
    await page.viewport(w,h);await page.openPanel('entities');
    const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,ni:!!qaApp.atlasTree.getNode('view-nistrenia'),groups:!!qaApp.atlasTree.getNode('view-nistrenia-group-osm-r1702216'),reset:document.getElementById('geometries-reset').getBoundingClientRect().height,absent:document.querySelectorAll('#nistrenia-osm-toggle,#nistrenia-osm-panel').length})");
    assert.equal(state.overflow,false);assert.equal(state.ni,true);assert.equal(state.groups,true);
    assert(state.reset>=44);assert.equal(state.absent,0);
   }
  });
  await t.test('no new polygon, external OSM API request or browser errors',async()=>{
   assert.equal(page.requests.filter(r=>/api\.openstreetmap\.org|overpass-api\.de|nistrenia.*geojson/i.test(r.url)).length,0);
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
