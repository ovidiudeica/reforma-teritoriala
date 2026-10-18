import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

// The 85 verified OSM roles remain sourced and legally caveated in cards;
// the duplicate catalog in Filters has intentionally been removed.
const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P9.0.7.2.16 Chrome: 85 verified roles survive without redundant catalog UI',{timeout:180000},async t=>{
  await page.viewport(1280,800);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.nistreniaOutlines?.layers?.size===8 && !!qaApp.atlasTree?.getNode('view-nistrenia')"),'verified NI operational hierarchy',30000);
  await t.test('catalogs removed; 85 role identities reused with unaltered default outlines',async()=>{
   const state=await page.evaluate(`({
    removed:['osm-roles-panel','osm-roles-list','osm-roles-search','osm-roles-filter','nistrenia-osm-toggle','nistrenia-osm-panel'].every(id=>!document.getElementById(id)),
    officialCount:qaApp.hierarchyNodeById.size,
    niRoot:!!qaApp.atlasTree.getNode('view-nistrenia'),
    niGroup:qaApp.atlasTree.getVisibleIds().includes('view-nistrenia-group-osm-r944727'),
    roots:[...qaApp.visibleEntityIds].sort(),ni:[...qaApp.visibleOperationalOutlineIds]
   })`);
   assert.equal(state.removed,true);assert.equal(state.officialCount,5848);
   assert(state.niRoot&&state.niGroup);assert.deepEqual(state.ni,['view-nistrenia']);
   assert.deepEqual(state.roots,['osm-r58974','osm-r90689']);
   const roles=await page.evaluate("fetch('public/data/p907216-osm-roles.json').then(r=>r.json()).then(c=>({n:c.rows.length,ids:new Set(c.rows.map(x=>x.id)).size,certified:c.legal_de_facto_certified,newGeometries:c.no_new_geometries}))");
   assert.equal(roles.n,85);assert.equal(roles.ids,85);assert.equal(roles.certified,0);assert.equal(roles.newGeometries,true);
  });
  await t.test('Bender and Hlinaia have separate source identities without legal promotion',async()=>{
   const names=await page.evaluate("fetch('public/data/p907216-osm-roles.json').then(r=>r.json()).then(c=>({bender:c.rows.filter(r=>['osm-r12463379','osm-r9581354'].includes(r.id)).map(r=>({id:r.id,label:r.role_label})),hlinaia:c.rows.filter(r=>['osm-r8291058','osm-r9301463'].includes(r.id)).map(r=>({id:r.id,label:r.role_label}))}))");
   assert.deepEqual(names.bender.map(x=>x.id).sort(),['osm-r12463379','osm-r9581354']);
   assert.deepEqual(names.hlinaia.map(x=>x.id).sort(),['osm-r8291058','osm-r9301463']);
   assert.notEqual(names.hlinaia[0].label,names.hlinaia[1].label);
  });
  await t.test('Nistrenia tree selects exact existing ACTUAL geometry with OSM source and legal caveat',async()=>{
   await page.openPanel('entities');
   await page.evaluate("if(!qaApp.atlasTree.isOpen('view-nistrenia'))qaApp.atlasTree.toggle('view-nistrenia')");
   await page.evaluate("if(!qaApp.atlasTree.isOpen('view-nistrenia-group-osm-r944727'))qaApp.atlasTree.toggle('view-nistrenia-group-osm-r944727')");
   await page.evaluate("qaApp.atlasTree.reveal('view-nistrenia-role-osm-r9581354')");
   await page.click('.tree-select[data-entity-id="view-nistrenia-role-osm-r9581354"]');
   await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r9581354'&&document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='osm-r9581354'"),'Bender source details',30000);
   const state=await page.evaluate("({selected:qaApp.selectedEntityId,role:document.querySelector('.osm-role-evidence')?.textContent,link:document.querySelector('.osm-role-evidence a')?.href,official:document.querySelector('[data-provenance=official]')?.textContent,officialCount:qaApp.hierarchyNodeById.size})");
   assert.equal(state.selected,'osm-r9581354');assert.equal(state.officialCount,5848);
   assert.match(state.role,/OpenStreetMap/);assert.match(state.role,/Neacordată/);
   assert.equal(state.link,'https://www.openstreetmap.org/relation/9581354');assert.match(state.official,/Identitate oficială/);
  });
  await t.test('mobile Filter panel contains no duplicate OSM catalog or overflow',async()=>{
   await page.viewport(390,844);await page.openPanel('filters');
   const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,duplicates:document.querySelectorAll('#osm-roles-panel,#nistrenia-osm-toggle').length,reset:document.getElementById('filters-reset').getBoundingClientRect().height,ni:document.getElementById('layer-ni').checked})");
   assert.equal(state.overflow,false);assert.equal(state.duplicates,0);assert(state.reset>=44);assert.equal(state.ni,true);
  });
  await t.test('no extra polygon resources or uncaught errors',async()=>{
   const bad=page.requests.map(x=>new URL(x.url).pathname).filter(p=>p.endsWith('.geojson')&&!p.startsWith('/public/geo/actual/'));
   assert.deepEqual(bad,[]);assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
