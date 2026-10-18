import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P9.0.7.2.16 Chromium: all source-only OSM evidence survives removal of redundant catalog UI',{timeout:180000},async t=>{
  await page.viewport(1280,800);await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.entityById.size===5848 && !!document.querySelector('#hierarchy-tree [data-entity-id=\"view-nistrenia\"]')"),'verified ACTUAL and NI tree',30000);
  await t.test('85 role identities remain bound to ACTUAL, no second filter catalog',async()=>{
   const data=await page.evaluate("({rootCount:qaApp.hierarchyNodeById.size,roleCount:[...qaApp.entityById.values()].filter(e=>e.jurisdiction==='MD'&&e.representation?.source==='OpenStreetMap'&&e.representation?.osm_relation_id>0).length,obsolete:!!document.querySelector('#osm-roles-panel,#osm-roles-list,#osm-roles-search'),filters:!!document.getElementById('filter-list')})");
   assert.equal(data.rootCount,5848);
   assert(data.roleCount>=85);
   assert.equal(data.obsolete,false);assert.equal(data.filters,true);
  });
  await t.test('Bender OSM name collision remains two distinct relations and source cards',async()=>{
   for(const [id,relation] of [['osm-r9581354','9581354'],['osm-r12463379','12463379']]){
    await page.evaluate("qaApp.selectEntity('"+id+"',{source:'web-r1b4',zoom:false})");
    await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='"+id+"' && document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='"+id+"'"),'verified card for '+id,30000);
    const data=await page.evaluate("({card:document.querySelector('.osm-role-evidence')?.textContent,legal:document.querySelector('[data-provenance=official]')?.textContent,link:document.querySelector('.osm-role-evidence a')?.href})");
    assert.match(data.card,/OpenStreetMap/);assert.match(data.card,/Neacordată/);
    assert.match(data.legal,/Identitate oficială/);
    assert.equal(data.link,'https://www.openstreetmap.org/relation/'+relation);
   }
  });
  await t.test('Phone retains descriptive role evidence with no UI overflow',async()=>{
   await page.viewport(390,844);await page.openPanel('entities');
   const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,catalog:!!document.querySelector('#osm-roles-panel'),evidence:document.querySelector('.osm-role-evidence')?.textContent})");
   assert.equal(state.overflow,false);assert.equal(state.catalog,false);
   assert.match(state.evidence,/OpenStreetMap/);
  });
  await t.test('No extra OSM polygons or JS failures',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.requests.map(x=>new URL(x.url).pathname).filter(p=>p.endsWith('.geojson')&&!p.startsWith('/public/geo/actual/')),[]);
  });
 });
}finally{await browser.close();}
