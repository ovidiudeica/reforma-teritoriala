import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('NI-TREE.1 Chromium: one seven-branch documentary tree, 85 canonical OSM references, independent controls',{timeout:180000},async t=>{
  await page.viewport(1280,800);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.nistreniaView?.groupIds?.length===7&&qaApp.nistreniaView?.roleIds?.size===85&&qaApp.nistreniaOutlines?.has('view-nistrenia')"),'unified Nistrenia tree ready',30000);

  await t.test('single tree has seven direct NI children and 85 nonduplicated geometry references',async()=>{
   const state=await page.evaluate("({toggle:!!document.getElementById('nistrenia-osm-toggle'),panel:!!document.getElementById('nistrenia-osm-panel'),roots:qaApp.nistreniaView.rootIds,groups:qaApp.nistreniaView.groupIds.length,roles:qaApp.nistreniaView.roleIds.size,mapped:qaApp.nistreniaView.associationByResource.size,nodes:qaApp.nistreniaView.nodes.size,official:qaApp.nistreniaView.officialNodeCount,rootChildren:qaApp.nistreniaView.root.child_ids,hasCatalog:qaApp.nistreniaView.nodes.has('view-nistrenia-cartographic-navigation'),defaultOperational:[...qaApp.visibleOperationalOutlineIds]})");
   assert.equal(state.toggle,false);assert.equal(state.panel,false);
   assert.equal(state.groups,7);assert.equal(state.roles,85);assert.equal(state.mapped,85);
   assert.equal(state.nodes,5848+243);assert.equal(state.official,5848);
   assert.equal(state.rootChildren.length,7);assert.equal(state.hasCatalog,false);
   assert.deepEqual(state.roots.slice(0,2).sort(),['osm-r58974','osm-r90689'].sort());
   assert.equal(state.roots.length,2);\n   assert.deepEqual(await page.evaluate("qaApp.nistreniaView.nodes.get('osm-r58974').child_ids.slice(0,3)"),['view-nistrenia','stat-MD11','stat-MD12']);
   assert.deepEqual(state.defaultOperational,[]);
  });

  await t.test('NI root card contains only Nistrenia and a district selection never bulk-activates descendants',async()=>{
   const before=await page.evaluate("({actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort()})");
   await page.call(async function(){await qaApp.selectEntity('view-nistrenia',{zoom:false,source:'ni-tree1-regression'});});
   let state=await page.evaluate("({selected:qaApp.selectedEntityId,actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort(),title:document.querySelector('#details-title').textContent,body:document.querySelector('#details-body').textContent,resources:document.querySelectorAll('[data-ni-resource]').length})");
   assert.equal(state.selected,'view-nistrenia');assert.equal(state.resources,0);
   assert.deepEqual(state.actual,before.actual);assert.deepEqual(state.operational,before.operational);
   assert.match(state.title,/Nistrenia/);assert.match(state.body,/conturul OSM nu demonstrează controlul efectiv/);
   const district='view-nistrenia-group-osm-r1702216';
   await page.call(async function(id){await qaApp.selectEntity(id,{zoom:false});},district);
   state=await page.evaluate("({selected:qaApp.selectedEntityId,actual:[...qaApp.visibleEntityIds].sort(),operational:[...qaApp.visibleOperationalOutlineIds].sort()})");
   assert.equal(state.selected,district);assert.deepEqual(state.actual,before.actual);assert.deepEqual(state.operational,before.operational);
  });

  await t.test('homonymous city geometry is attached to local NI place, not to raion and not a catalogue alias',async()=>{
   const node='view-nistrenia-place-110',canonical='osm-r19015110';
   await page.openPanel('entities');
   await page.call(async function(id){await qaApp.selectEntity(id,{zoom:false});},node);
   const initial=await page.evaluate("(()=>{const v=qaApp.nistreniaView;const n='view-nistrenia-place-110';const item=qaApp.atlasTree.getNode(n);return {target:v.primaryGeometryForNode(n),parent:v.nodes.get(n).parent_id,available:!!item&&!item.checkbox.disabled,checked:qaApp.visibleEntityIds.has('osm-r19015110'),resources:[...document.querySelectorAll('[data-ni-resource]')].map(e=>e.dataset.niResource)}})()");
   assert.equal(initial.target,canonical);assert.equal(initial.available,true);assert.equal(initial.checked,false);
   assert.deepEqual(initial.resources,[canonical]);
   const before=await page.evaluate('[...qaApp.visibleOperationalOutlineIds].sort()');
   await page.click('.tree-visibility-toggle[data-entity-id="'+node+'"]');
   assert.equal(await page.evaluate("qaApp.visibleEntityIds.has('osm-r19015110')"),true);
   assert.deepEqual(await page.evaluate('[...qaApp.visibleOperationalOutlineIds].sort()'),before);
   // Explicitly enable NI: the default now contains only RO and MD.\n   await page.call(function(){const el=document.getElementById('layer-ni');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});\n   // A shared MD canonical polygon is still visible if MD is unchecked but NI stays on.
   await page.call(function(){const el=document.getElementById('layer-md');el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});
   assert.equal(await page.evaluate("qaApp.atlasTree.getNode('view-nistrenia-place-110')?.outer.classList.contains('tree-geometry-hidden')"),false);
   await page.call(function(){const el=document.getElementById('layer-ni');el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});
   assert.equal(await page.evaluate("qaApp.visibleEntityIds.has('osm-r19015110')"),true,'independent checkbox survives jurisdiction filter');
   assert.equal(await page.evaluate("qaApp.atlasTree.getNode('view-nistrenia-place-110')?.outer.classList.contains('tree-geometry-hidden')"),true);
   await page.call(function(){const el=document.getElementById('layer-md');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
   assert.equal(await page.evaluate("qaApp.atlasTree.getNode('view-nistrenia-place-110')?.outer.classList.contains('tree-geometry-hidden')"),false);
   await page.click('.tree-visibility-toggle[data-entity-id="'+node+'"]');
   assert.equal(await page.evaluate("qaApp.visibleEntityIds.has('osm-r19015110')"),false);
   await page.call(function(){const el=document.getElementById('layer-ni');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
   assert.deepEqual(await page.evaluate('[...qaApp.visibleOperationalOutlineIds].sort()'),before);
  });

  await t.test('two Bender OSM roles remain distinct within one Bender administrative card',async()=>{
   const roles=await page.evaluate("[...qaApp.osmRoleById.values()].filter(row=>(row.display_name||'').includes('Bender')).map(row=>row.id).sort()");
   assert.deepEqual(roles,['osm-r12463379','osm-r9581354']);
   await page.call(async function(){await qaApp.selectEntity('view-nistrenia-group-osm-r944727',{zoom:false});});
   const buttons=await page.evaluate("[...document.querySelectorAll('[data-ni-resource]')].map(e=>e.dataset.niResource).sort()");
   assert.deepEqual(buttons,roles);
   await page.call(async function(){await qaApp.selectEntity('osm-r9581354',{zoom:false});});
   await waitFor(()=>page.evaluate("document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='osm-r9581354'"),'canonical Bender provenance');
   assert.match(await page.evaluate("document.querySelector('.osm-role-evidence').textContent"),/Neacordată/);
  });

  await t.test('mobile tree remains accessible and has no horizontal overflow',async()=>{
   await page.viewport(390,844);await page.openPanel('entities');
   const state=await page.evaluate("(()=>{const reset=document.getElementById('geometries-reset').getBoundingClientRect(),tree=document.getElementById('hierarchy-tree').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,reset:{width:reset.width,height:reset.height},tree:{width:tree.width,height:tree.height},niVisible:document.querySelector('#layer-ni')?.getBoundingClientRect().height>0}})()");
   assert.equal(state.overflow,false);assert(state.reset.width>=44&&state.reset.height>=44);
   assert(state.tree.width>0&&state.tree.height>0);
  });

  await t.test('no extra polygon resources or JavaScript errors',async()=>{
   const bad=page.requests.map(x=>new URL(x.url).pathname).filter(p=>p.endsWith('.geojson')&&!p.startsWith('/public/geo/actual/'));
   assert.deepEqual(bad,[]);assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
