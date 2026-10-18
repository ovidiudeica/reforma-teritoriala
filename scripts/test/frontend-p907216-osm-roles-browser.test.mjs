import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();

try{
 await test('P9.0.7.2.16 Chrome: 85 OSM roles remain validated after redundant catalog UI removal',{timeout:180000},async t=>{
  await page.viewport(1280,800);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.osmRoleById?.size===85&&qaApp.nistreniaView?.roleIds?.size===85"),'85 OSM roles validated',30000);

  await t.test('catalog/search/filter presentation is absent while runtime contract stays intact',async()=>{
   const state=await page.evaluate("({panel:!!document.querySelector('#osm-roles-panel'),search:!!document.querySelector('#osm-roles-search'),filter:!!document.querySelector('#osm-roles-filter'),list:!!document.querySelector('#osm-roles-list'),roles:qaApp.osmRoleById.size,nistreniaRoles:qaApp.nistreniaView.roleIds.size,groups:qaApp.nistreniaView.groupIds.length,officialNodes:qaApp.nistreniaView.officialNodeCount,defaultIds:[...qaApp.visibleEntityIds].sort(),defaultOperational:[...qaApp.visibleOperationalOutlineIds].sort(),p91:qaApp.nistreniaCatalog.p91_import_allowed,semantic:qaApp.nistreniaCatalog.legal_semantic_acceptance,actualMutation:qaApp.nistreniaCatalog.actual_mutation_allowed})");
   assert.deepEqual([state.panel,state.search,state.filter,state.list],[false,false,false,false]);
   assert.equal(state.roles,85);assert.equal(state.nistreniaRoles,85);assert.equal(state.groups,7);assert.equal(state.officialNodes,5848);
   assert.deepEqual(state.defaultIds,['osm-r58974','osm-r90689'].sort());
   assert.deepEqual(state.defaultOperational,['view-nistrenia']);
   assert.equal(state.p91,false);assert.equal(state.semantic,'BLOCKED_INCOMPLETE');assert.equal(state.actualMutation,false);
  });

  await t.test('name collisions and descriptive roles remain distinct in validated metadata',async()=>{
   const rows=await page.evaluate("[...qaApp.osmRoleById.values()].filter(row=>['Bender','Hlinaia'].some(name=>(row.display_name||'').includes(name)||(row.osm_name||'').includes(name))).map(row=>({id:row.id,name:row.display_name,role:row.role_label,legal:row.legal_de_facto_certified,geometry:row.geometry_source}))");
   const bender=rows.filter(row=>(row.name||'').includes('Bender'));
   const hlinaia=rows.filter(row=>(row.name||'').includes('Hlinaia'));
   assert.deepEqual(bender.map(row=>row.id).sort(),['osm-r12463379','osm-r9581354']);
   assert.equal(hlinaia.length,2);
   assert(rows.every(row=>row.legal===false&&row.geometry==='EXISTING_ACTUAL_PUBLIC_GEOJSON_ONLY'));
  });

  await t.test('known OSM role still selects exact ACTUAL entity and renders separate provenance card',async()=>{
   await page.call(async function(){await qaApp.selectEntity('osm-r9581354',{zoom:false,source:'p907216-regression'});});
   await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r9581354'&&document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='osm-r9581354'"),'OSM provenance card',30000);
   const state=await page.evaluate("({checked:qaApp.visibleEntityIds.has('osm-r9581354'),card:document.querySelector('.osm-role-evidence')?.textContent,legal:document.querySelector('[data-provenance=official]')?.textContent,link:document.querySelector('.osm-role-evidence a')?.href,rootCount:qaApp.hierarchyNodeById.size})");
   assert.match(state.card,/OpenStreetMap/);assert.match(state.card,/Neacordată/);
   assert.match(state.legal,/Identitate oficială/);
   assert.equal(state.link,'https://www.openstreetmap.org/relation/9581354');
   assert.equal(state.rootCount,5848);
   const requests=page.requests.map(x=>new URL(x.url).pathname).filter(x=>x.endsWith('.geojson'));
   assert(requests.every(url=>url.startsWith('/public/geo/actual/')),'Fetched an additional P9 geometry resource');
  });

  await t.test('mobile Filters remains clean and horizontally contained without removed catalog controls',async()=>{
   await page.viewport(390,844);await page.openPanel('filters');
   const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,panel:!!document.querySelector('#osm-roles-panel'),search:!!document.querySelector('#osm-roles-search'),filter:!!document.querySelector('#osm-roles-filter'),resetHeight:document.querySelector('#filters-reset').getBoundingClientRect().height})");
   assert.equal(state.overflow,false);assert.equal(state.panel,false);assert.equal(state.search,false);assert.equal(state.filter,false);assert(state.resetHeight>=44);
  });

  await t.test('no uncaught JavaScript, console or non-tile HTTP errors',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(x=>x.status>=400&&!['a.tile.openstreetmap.org','b.tile.openstreetmap.org','c.tile.openstreetmap.org'].includes(new URL(x.url).hostname)),[]);
  });
 });
}finally{await browser.close();}
