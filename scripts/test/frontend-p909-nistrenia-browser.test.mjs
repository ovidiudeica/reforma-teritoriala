import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor,delay} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();

try{
 await test('P9.0.9 Chromium: Nistrenia lives only in the hierarchy with independent geometry controls',{timeout:180000},async t=>{
  await page.viewport(1280,800);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.nistreniaView?.groupIds?.length===7&&qaApp.nistreniaView?.roleIds?.size===85&&qaApp.nistreniaOutlines?.has('view-nistrenia')"),'Nistrenia hierarchy ready',30000);

  await t.test('redundant Nistrenia OSM presentation is absent and operational tree contract remains complete',async()=>{
   const state=await page.evaluate("({toggle:!!document.getElementById('nistrenia-osm-toggle'),panel:!!document.getElementById('nistrenia-osm-panel'),rootIds:qaApp.nistreniaView.rootIds,groups:qaApp.nistreniaView.groupIds.length,roles:qaApp.nistreniaView.roleIds.size,nodes:qaApp.nistreniaView.nodes.size,official:qaApp.nistreniaView.officialNodeCount,rootName:qaApp.nistreniaView.root.display_name,defaultOperational:[...qaApp.visibleOperationalOutlineIds]})");
   assert.equal(state.toggle,false);assert.equal(state.panel,false);
   assert.equal(state.rootName,'Nistrenia');assert.equal(state.groups,7);assert.equal(state.roles,85);
   assert.equal(state.nodes,5848+1+7+85);assert.equal(state.official,5848);
   assert.deepEqual(state.rootIds.slice(0,2).sort(),['osm-r58974','osm-r90689'].sort());
   assert.equal(state.rootIds[2],'view-nistrenia');
   assert.deepEqual(state.defaultOperational,['view-nistrenia']);
  });

  await t.test('selecting Nistrenia or a district selects only its own outline and never bulk-activates descendants',async()=>{
   const before=await page.evaluate("({actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort()})");
   await page.call(async function(){await qaApp.selectEntity('view-nistrenia',{zoom:false,source:'p909-regression'});});
   let state=await page.evaluate("({selected:qaApp.selectedEntityId,actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort(),title:document.querySelector('#details-title').textContent,body:document.querySelector('#details-body').textContent})");
   assert.equal(state.selected,'view-nistrenia');assert.deepEqual(state.actual,before.actual);assert.deepEqual(state.operational,before.operational);
   assert.match(state.title,/Nistrenia/);assert.match(state.body,/Conturul OSM este independent de cele 85 de geometrii ACTUAL componente/);

   const group=await page.evaluate("qaApp.nistreniaView.groupIds[0]");
   await page.call(async function(group){await qaApp.selectEntity(group,{zoom:false,source:'p909-regression'});},group);
   state=await page.evaluate("({selected:qaApp.selectedEntityId,actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort()})");
   assert.equal(state.selected,group);assert.deepEqual(state.actual,before.actual);assert.deepEqual(state.operational,before.operational);
  });

  await t.test('root, district and role checkboxes remain independent in the tree',async()=>{
   await page.openPanel('entities');
   const ids=await page.evaluate("(()=>{const group=qaApp.nistreniaView.groupIds[0],actual=qaApp.nistreniaView.groups[0].role_ids[0];return {root:'view-nistrenia',group,actual,alias:'view-nistrenia-role-'+actual}})()");
   await page.call(function(ids){qaApp.atlasTree.setOpenIds([ids.root,ids.group]);document.querySelector('#hierarchy-tree').scrollTop=0;},ids);
   await delay(120);
   await waitFor(()=>page.call(function(ids){return Boolean(document.querySelector('.tree-visibility-toggle[data-entity-id="'+ids.alias+'"]'));},ids),'role checkbox mounted',10000);

   const before=await page.call(function(ids){return {root:qaApp.visibleOperationalOutlineIds.has(ids.root),group:qaApp.visibleOperationalOutlineIds.has(ids.group),role:qaApp.visibleEntityIds.has(ids.actual),actualSize:qaApp.visibleEntityIds.size};},ids);
   assert.equal(before.root,true);assert.equal(before.group,false);assert.equal(before.role,false);

   await page.click('.tree-visibility-toggle[data-entity-id="'+ids.group+'"]');
   await page.click('.tree-visibility-toggle[data-entity-id="'+ids.alias+'"]');
   const after=await page.call(function(ids){return {root:qaApp.visibleOperationalOutlineIds.has(ids.root),group:qaApp.visibleOperationalOutlineIds.has(ids.group),role:qaApp.visibleEntityIds.has(ids.actual),actualSize:qaApp.visibleEntityIds.size};},ids);
   assert.equal(after.root,true);assert.equal(after.group,true);assert.equal(after.role,true);
   assert.equal(after.actualSize,before.actualSize+1);

   await page.click('.tree-visibility-toggle[data-entity-id="'+ids.alias+'"]');
   const final=await page.call(function(ids){return {root:qaApp.visibleOperationalOutlineIds.has(ids.root),group:qaApp.visibleOperationalOutlineIds.has(ids.group),role:qaApp.visibleEntityIds.has(ids.actual)};},ids);
   assert.deepEqual(final,{root:true,group:true,role:false});
  });

  await t.test('Bender homonyms remain separate source roles and provenance survives ordinary entity selection',async()=>{
   const roles=await page.evaluate("[...qaApp.osmRoleById.values()].filter(row=>(row.display_name||'').includes('Bender')).map(row=>({id:row.id,role:row.role_label}))");
   assert.deepEqual(roles.map(row=>row.id).sort(),['osm-r12463379','osm-r9581354']);
   await page.call(async function(){await qaApp.selectEntity('osm-r9581354',{zoom:false,source:'p909-regression'});});
   await waitFor(()=>page.evaluate("document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='osm-r9581354'"),'Bender provenance',30000);
   assert.match(await page.evaluate("document.querySelector('.osm-role-evidence').textContent"),/Neacordată/);
  });

  await t.test('mobile hierarchy remains reachable, 44px reset target and no horizontal overflow',async()=>{
   await page.viewport(390,844);await page.openPanel('entities');
   const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,reset:document.getElementById('geometries-reset').getBoundingClientRect(),oldToggle:!!document.getElementById('nistrenia-osm-toggle'),tree:document.getElementById('hierarchy-tree').getBoundingClientRect()})");
   assert.equal(state.overflow,false);assert.equal(state.oldToggle,false);
   assert(state.reset.width>=44&&state.reset.height>=44);
   assert(state.tree.width>0&&state.tree.height>0);
  });

  await t.test('No extra OSM polygon resources or JavaScript failures',async()=>{
   const bad=page.requests.map(x=>new URL(x.url).pathname).filter(p=>p.endsWith('.geojson')&&!p.startsWith('/public/geo/actual/'));
   assert.deepEqual(bad,[]);
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
