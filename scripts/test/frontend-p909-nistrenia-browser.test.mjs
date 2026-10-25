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
  await waitFor(()=>page.evaluate("qaApp.nistreniaView?.groupIds?.length===9&&qaApp.nistreniaView?.roleIds?.size===85&&qaApp.nistreniaOutlines?.has('view-nistrenia')"),'Nistrenia hierarchy ready',30000);

  await t.test('redundant Nistrenia OSM presentation is absent and operational tree contract remains complete',async()=>{
   const state=await page.evaluate("({toggle:!!document.getElementById('nistrenia-osm-toggle'),panel:!!document.getElementById('nistrenia-osm-panel'),rootIds:qaApp.nistreniaView.rootIds,groups:qaApp.nistreniaView.groupIds.length,roles:qaApp.nistreniaView.roleIds.size,nodes:qaApp.nistreniaView.nodes.size,official:qaApp.nistreniaView.officialNodeCount,rootName:qaApp.nistreniaView.root.display_name,defaultOperational:[...qaApp.visibleOperationalOutlineIds]})");
   assert.equal(state.toggle,false);assert.equal(state.panel,false);
   assert.equal(state.rootName,'Nistrenia');assert.equal(state.groups,9);assert.equal(state.roles,85);
   // U1.4 adds one explicitly non-administrative navigation folder plus 85 aliases,
   // not 86 administrative units or copies of ACTUAL geometry.
   assert.equal(state.nodes,5848+242+86);assert.equal(state.official,5848);
   assert.deepEqual(state.rootIds.slice(0,2).sort(),['osm-r58974','osm-r90689'].sort());
   assert.equal(state.rootIds[2],'view-nistrenia');
   assert.deepEqual(state.defaultOperational,['view-nistrenia']);
  });

  await t.test('selecting Nistrenia or a district selects only its own outline and never bulk-activates descendants',async()=>{
   const before=await page.evaluate("({actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort()})");
   await page.call(async function(){await qaApp.selectEntity('view-nistrenia',{zoom:false,source:'p909-regression'});});
   let state=await page.evaluate("({selected:qaApp.selectedEntityId,actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort(),title:document.querySelector('#details-title').textContent,body:document.querySelector('#details-body').textContent})");
   assert.equal(state.selected,'view-nistrenia');assert.deepEqual(state.actual,before.actual);assert.deepEqual(state.operational,before.operational);
   assert.match(state.title,/Nistrenia/);assert.match(state.body,/conturul OSM nu demonstrează controlul efectiv/);

   const group=await page.evaluate("qaApp.nistreniaView.groupIds[0]");
   await page.call(async function(group){await qaApp.selectEntity(group,{zoom:false,source:'p909-regression'});},group);
   state=await page.evaluate("({selected:qaApp.selectedEntityId,actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort()})");
   assert.equal(state.selected,group);assert.deepEqual(state.actual,before.actual);assert.deepEqual(state.operational,before.operational);
  });

  await t.test('root, district and canonical resource controls remain independent',async()=>{
   await page.openPanel('entities');
   await page.call(async function(){await qaApp.selectEntity('view-nistrenia',{zoom:false});});
   const before=await page.evaluate('({actual:[...qaApp.visibleEntityIds].sort(),own:[...qaApp.visibleOperationalOutlineIds].sort()})');
   await page.click('[data-ni-resource="osm-r9581354"]');
   const after=await page.evaluate('({actual:[...qaApp.visibleEntityIds].sort(),own:[...qaApp.visibleOperationalOutlineIds].sort()})');
   assert.deepEqual(after.own,before.own);assert.deepEqual(after.actual,[...before.actual,'osm-r9581354'].sort());
   await page.click('[data-ni-resource="osm-r9581354"]');
   assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),before.actual);
   await page.openPanel('entities');
   await page.call(function(){qaApp.atlasTree.select('view-nistrenia-group-osm-r1702216');});
   await page.click('.tree-visibility-toggle[data-entity-id="view-nistrenia-group-osm-r1702216"]');
   assert.deepEqual(await page.evaluate('[...qaApp.visibleOperationalOutlineIds].sort()'),['view-nistrenia','view-nistrenia-group-osm-r1702216']);
   assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),before.actual);
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
   const state=await page.evaluate("(()=>{const reset=document.getElementById('geometries-reset').getBoundingClientRect(),tree=document.getElementById('hierarchy-tree').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,reset:{width:reset.width,height:reset.height},oldToggle:!!document.getElementById('nistrenia-osm-toggle'),tree:{width:tree.width,height:tree.height}}})()");
   assert.equal(state.overflow,false);assert.equal(state.oldToggle,false);
   assert(state.reset.width>=44&&state.reset.height>=44,JSON.stringify(state));
   assert(state.tree.width>0&&state.tree.height>0,JSON.stringify(state));
  });

  await t.test('No extra OSM polygon resources or JavaScript failures',async()=>{
   const bad=page.requests.map(x=>new URL(x.url).pathname).filter(p=>p.endsWith('.geojson')&&!p.startsWith('/public/geo/actual/'));
   assert.deepEqual(bad,[]);
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
