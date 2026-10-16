import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
const observed=()=>page.evaluate("({items:document.querySelectorAll('#osm-roles-list li').length,selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort(),path:document.querySelector('#details-body [data-osm-role-id]')?.dataset.osmRoleId||null})");

try{
 await test('P9.0.7.2.16 Chrome: 85 source-only roles reuse ACTUAL polygons with no new jurisdiction',{timeout:180000},async t=>{
  await page.viewport(1280,800);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("document.querySelectorAll('#osm-roles-list li').length===85"),'85 OSM roles indexed',25000);
  await t.test('85 visible only in collapsed optional catalog; default RO+MD unaffected',async()=>{
   const state=await page.evaluate("({closed:!document.querySelector('#osm-roles-panel').open,items:document.querySelectorAll('#osm-roles-list li').length,defaultIds:[...qaApp.visibleEntityIds].sort(),status:document.querySelector('#osm-roles-status').textContent,tree:document.querySelector('.tree-select')!==null})");
   assert.equal(state.closed,true);assert.equal(state.items,85);assert.equal(state.tree,true);
   assert.deepEqual(state.defaultIds,['osm-r58974','osm-r90689'].sort());assert.match(state.status,/85 de relații/);
   assert.equal(await page.evaluate("document.querySelectorAll('.osm-role-evidence').length"),0);
  });
  await page.openPanel('filters');
  await page.click('#osm-roles-panel > summary');
  await t.test('name collision Bender has two distinct source roles and IDs',async()=>{
   await page.evaluate("(()=>{let el=document.getElementById('osm-roles-search');el.value='Bender';el.dispatchEvent(new Event('input',{bubbles:true}));})()");
   const states=await page.evaluate("[...document.querySelectorAll('#osm-roles-list li')].map(el=>({id:el.querySelector('button').dataset.osmRoleId,text:el.textContent}))");
   assert.equal(states.length,2);
   assert.deepEqual(states.map(x=>x.id).sort(),['osm-r12463379','osm-r9581354']);
   assert(states.some(x=>x.text.includes('nivel 4')));
   assert(states.some(x=>x.text.includes('Limită de oraș')));
  });
  await t.test('explicit show selects exact released geometry and shows OSM provenance separately from legal card',async()=>{
   await page.click('#osm-roles-list [data-osm-role-id="osm-r9581354"]');
   await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r9581354'&&document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='osm-r9581354'"),'select reused ACTUAL municipality',30000);
   const state=await page.evaluate("({checked:qaApp.visibleEntityIds.has('osm-r9581354'),card:document.querySelector('.osm-role-evidence')?.textContent,legal:document.querySelector('[data-provenance=official]')?.textContent,link:document.querySelector('.osm-role-evidence a')?.href,rows:document.querySelectorAll('#osm-roles-list li').length,rootCount:qaApp.hierarchyNodeById.size})");
   assert(state.checked);assert.match(state.card,/OpenStreetMap/);assert.match(state.card,/Neacordată/);
   assert.match(state.legal,/Identitate oficială/);
   assert.equal(state.link,'https://www.openstreetmap.org/relation/9581354');
   assert.equal(state.rows,2);assert.equal(state.rootCount,5848);
   const requests=page.requests.map(x=>new URL(x.url).pathname).filter(x=>x.endsWith('.geojson'));
   assert(requests.every(url=>url.startsWith('/public/geo/actual/')),'Fetched an additional P9 geometry resource');
  });
  await t.test('Hlinaia is two distinct councils; filtering never asserts a village polygon',async()=>{
   await page.openPanel('filters');
   await page.evaluate("(()=>{let el=document.getElementById('osm-roles-search');el.value='Hlinaia';el.dispatchEvent(new Event('input',{bubbles:true}));})()");
   const matches=await page.evaluate("[...document.querySelectorAll('#osm-roles-list li')].map(e=>e.textContent)");
   assert.equal(matches.length,2);assert(matches.some(x=>x.includes('consiliu sătesc')));assert(matches.some(x=>x.includes('consiliu al așezării')));
  });
  await t.test('mobile opt-in catalog preserves accessible controls and legal caveat',async()=>{
   await page.viewport(390,844);
   await page.openPanel('filters');
   const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,hasSearch:!!document.querySelector('#osm-roles-search'),hasFilters:!!document.querySelector('#osm-roles-filter'),label:document.querySelector('#osm-roles-panel .hint')?.textContent,remaining:document.querySelectorAll('#osm-roles-list li').length})");
   assert.equal(state.overflow,false);assert(state.hasSearch&&state.hasFilters);
   assert.match(state.label,/nu este certificată/i);assert.equal(state.remaining,2);
  });
  await t.test('no uncaught JavaScript, console or non-tile HTTP errors',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(x=>x.status>=400&&!['a.tile.openstreetmap.org','b.tile.openstreetmap.org','c.tile.openstreetmap.org'].includes(new URL(x.url).hostname)),[]);
  });
 });
}finally{await browser.close();}
