import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P9.0.9 Chromium: visible Nistrenia OSM navigation and geometry reuse desktop/mobile',{timeout:180000},async t=>{
  await page.viewport(1280,800);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("document.querySelectorAll('#nistrenia-osm-groups .nistrenia-osm-subgroup').length===7"),'seven OSM Nistrenia groups',30000);
  await t.test('Nistrenia appears in Entities without opening the Filter catalog or changing RO+MD defaults',async()=>{
   const state=await page.evaluate("({trigger:document.getElementById('nistrenia-osm-toggle')?.textContent,triggerHeight:document.getElementById('nistrenia-osm-toggle')?.getBoundingClientRect().height,hidden:document.getElementById('nistrenia-osm-panel').hidden,roots:[...qaApp.visibleEntityIds].sort(),tree:qaApp.hierarchyNodeById.size,groups:[...document.querySelectorAll('.nistrenia-osm-subgroup')].map(g=>({name:g.querySelector('summary').textContent,count:g.querySelectorAll('[data-osm-role-id]').length}))})");
   assert.match(state.trigger,/Nistrenia · OSM/);
   assert(state.triggerHeight>=44);assert.equal(state.hidden,true);
   assert.deepEqual(state.roots,['osm-r58974','osm-r90689'].sort());
   assert.equal(state.tree,5848);
   assert.deepEqual(state.groups.map(x=>x.count),[13,23,10,16,3,16,4]);
  });
  await page.openPanel('entities');
  await page.click('#nistrenia-osm-toggle');
  assert.equal(await page.evaluate("document.getElementById('nistrenia-osm-panel').hidden"),false);
  assert.equal(await page.evaluate("document.getElementById('nistrenia-osm-toggle').getAttribute('aria-expanded')"),'true');
  await page.click('.nistrenia-osm-subgroup[data-osm-group-id="osm-r1702219"] > summary');
  await t.test('Tiraspol group activates only existing ACTUAL geometry IDs',async()=>{
   await page.click('.nistrenia-osm-subgroup[data-osm-group-id="osm-r1702219"] .nistrenia-osm-show');
   await waitFor(()=>page.evaluate("qaApp.visibleEntityIds.has('osm-r9581299')||document.getElementById('nistrenia-osm-status').textContent.includes('geometrii ACTUAL selectate')"),'Tiraspol existing geometry activation',30000);
   const state=await page.evaluate("({status:document.getElementById('nistrenia-osm-status').textContent,visible:[...qaApp.visibleEntityIds],rootCount:qaApp.hierarchyNodeById.size,groupCount:document.querySelectorAll('.nistrenia-osm-subgroup').length})");
   assert.match(state.status,/3 geometrii ACTUAL selectate/);
   assert.equal(state.rootCount,5848);assert.equal(state.groupCount,7);
  });
  await t.test('Bender homonyms remain separately selectable with source-only card',async()=>{
   await page.click('.nistrenia-osm-subgroup[data-osm-group-id="osm-r944727"] > summary');
   await page.click('#nistrenia-osm-panel [data-osm-role-id="osm-r9581354"]');
    await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r9581354'&&document.querySelector('.osm-role-evidence')?.dataset.osmRoleId==='osm-r9581354'"),'existing ACTUAL Bender card',30000);
   const state=await page.evaluate("({selected:qaApp.selectedEntityId,card:document.querySelector('.osm-role-evidence')?.textContent,root:document.getElementById('nistrenia-osm-panel').open})");
   assert.equal(state.selected,'osm-r9581354');assert.match(state.card,/Neacordată/);
  });
  await t.test('Mobile Nistrenia entry remains reachable, accessible and free of viewport overflow',async()=>{
   await page.viewport(390,844);
   await page.openPanel('entities');
   const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,triggerHeight:document.getElementById('nistrenia-osm-toggle').getBoundingClientRect().height,triggerText:document.getElementById('nistrenia-osm-toggle').textContent,groupCount:document.querySelectorAll('.nistrenia-osm-subgroup').length})");
   assert.equal(state.overflow,false);assert(state.triggerHeight>=44);
   assert.match(state.triggerText,/Nistrenia/);assert.equal(state.groupCount,7);
   await page.click('#nistrenia-osm-toggle');
   assert.equal(await page.evaluate("document.getElementById('nistrenia-osm-panel').hidden"),true);
   await page.click('#nistrenia-osm-toggle');
   assert.equal(await page.evaluate("document.getElementById('nistrenia-osm-panel').hidden"),false);
  });
  await t.test('No extra OSM polygon resources or JavaScript failures',async()=>{
   const bad=page.requests.map(x=>new URL(x.url).pathname).filter(p=>p.endsWith('.geojson')&&!p.startsWith('/public/geo/actual/'));
   assert.deepEqual(bad,[]);
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
