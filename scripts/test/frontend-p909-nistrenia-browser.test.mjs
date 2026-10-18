import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('WEB-R1b.4 Nistrenia tree replaces redundant OSM shortcut without losing 85 verified identities',{timeout:180000},async t=>{
  await page.viewport(1280,800);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("!!document.querySelector('#hierarchy-tree [data-entity-id=\"view-nistrenia\"]') && qaApp.entityById.size===5848 && qaApp.nistreniaOutlines?.layers?.size>=8"),'verified Nistrenia operational tree',30000);
  await t.test('No legacy OSM controls, no duplicate OSM geometries',async()=>{
   const state=await page.evaluate("({niButton:document.getElementById('nistrenia-osm-toggle'),niPanel:document.getElementById('nistrenia-osm-panel'),rolesPanel:document.getElementById('osm-roles-panel'),roots:[...qaApp.visibleEntityIds].sort(),tree:qaApp.hierarchyNodeById.size})");
   assert.equal(state.niButton,null);assert.equal(state.niPanel,null);assert.equal(state.rolesPanel,null);
   assert.deepEqual(state.roots,['osm-r58974','osm-r90689'].sort());
   assert.equal(state.tree,5848);
  });
  await t.test('The seven districts remain directly beneath the Nistrenia tree node',async()=>{
   await page.openPanel('entities');
   await page.evaluate("qaApp.atlasTree.setOpenIds(['view-nistrenia'])");
   // The tree is virtualized: not all 7 children are mounted in the DOM
   // simultaneously. Assert the complete logical rows, then reveal each
   // child and verify its label in the actual rendered tree.
   const ids=await page.evaluate("qaApp.atlasTree.getVisibleIds().filter(id=>id.startsWith('view-nistrenia-group-'))");
   assert.equal(ids.length,7);
   const groups=[];
   for(const id of ids){
    await page.call(function(id){qaApp.atlasTree.reveal(id);},id);
    const label=await page.call(function(id){return qaApp.atlasTree.getNode(id)?.outer?.textContent||'';},id);
    assert(label,'virtualized district not reachable: '+id);
    groups.push(label);
   }
   for(const name of ['Camenca','Rîbnița','Dubăsari','Grigoriopol','Tiraspol','Slobozia','Bender'])assert(groups.some(label=>label.includes(name)),name);
  });
  await t.test('Bender keeps OSM provenance in its normal ACTUAL card',async()=>{
   await page.evaluate("qaApp.selectEntity('osm-r9581354',{source:'web-r1b4',zoom:false})");
   await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r9581354' && document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='osm-r9581354'"),'Bender provenance card',30000);
   const data=await page.evaluate("({card:document.querySelector('.osm-role-evidence')?.textContent,link:document.querySelector('.osm-role-evidence a')?.href,sourceCount:qaApp.entityById.size})");
   assert.match(data.card,/OpenStreetMap/);assert.match(data.card,/Neacordată/);
   assert.equal(data.link,'https://www.openstreetmap.org/relation/9581354');assert.equal(data.sourceCount,5848);
  });
  await t.test('Phone: NI hierarchy and reset remain reachable, no horizontal overflow',async()=>{
   await page.viewport(390,844);await page.openPanel('entities');
   await page.evaluate("qaApp.atlasTree.setOpenIds(['view-nistrenia'])");
   const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,root:!!document.querySelector('#hierarchy-tree [data-entity-id=\"view-nistrenia\"]'),reset:document.querySelector('#entities-panel > .atlas-panel-reset-row > #geometries-reset')?.getBoundingClientRect().height,toolbar:document.getElementById('map-geometries-reset')!==null})");
   assert.equal(state.overflow,false);assert.equal(state.root,true);
   assert(state.reset>=44);assert(state.toolbar);
  });
  await t.test('No new polygon asset requests or JS errors',async()=>{
   const bad=page.requests.map(x=>new URL(x.url).pathname).filter(p=>p.endsWith('.geojson')&&!p.startsWith('/public/geo/actual/'));
   assert.deepEqual(bad,[]);assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
