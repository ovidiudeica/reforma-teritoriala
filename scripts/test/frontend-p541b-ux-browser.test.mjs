import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P5.4.1b real UX remediation: strict 900px, filters reset, hidden geometry and persistence',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.entityById.size===5848"),'5,848 entities loaded');
  await t.test('disabled PROPUNERI, touch targets, default filters and roots',async()=>{
   const s=await page.evaluate("({proposal:document.querySelector('[data-mode=propuneri]').disabled,actual:document.querySelector('[data-mode=actual]').disabled,filters:document.querySelector('#filters-count').textContent,reset:document.querySelector('#filters-reset').disabled,roots:[...qaApp.visibleEntityIds].sort(),target:document.querySelector('#filters-toggle').getBoundingClientRect().height})");
   assert.equal(s.proposal,true);assert.equal(s.actual,false);assert.equal(s.filters,'');assert.equal(s.reset,true);assert.deepEqual(s.roots,['osm-r58974','osm-r90689'].sort());assert.ok(s.target>=44);
  });
  await t.test('sidebar width survives reload and CSS breakpoint is strictly below 900',async()=>{
   await page.evaluate("document.querySelector('#explorer-resizer').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))");
   assert.equal(await page.evaluate("localStorage.getItem('reforma-teritoriala.explorer-width.v1')"),'360');
   await page.navigate(browser.server.url);
   assert.equal(await page.evaluate("document.querySelector('#explorer-resizer').getAttribute('aria-valuenow')"),'360');
   for(const [width,height,mobile] of [[900,768,false],[899,768,true],[768,860,true],[720,800,true],[390,844,true],[900,768,false]]){
    await page.viewport(width,height);
    const s=await page.evaluate("({mobile:qaApp.atlasMobile.state.mobile,drawerTriggerHidden:document.querySelector('#mobile-navigation').hidden,divider:getComputedStyle(document.querySelector('#explorer-resizer')).display,overflow:document.documentElement.scrollWidth>innerWidth,map:document.querySelector('#map').getBoundingClientRect().width})");
    assert.equal(s.mobile,mobile,'breakpoint '+width);assert.equal(s.drawerTriggerHidden,false);
    assert.equal(s.divider==='none',mobile);assert.equal(s.overflow,false);assert.ok(s.map>0);
   }
   await page.viewport(1440,900);
   assert.equal(await page.evaluate("document.querySelector('#explorer-resizer').getAttribute('aria-valuenow')"),'360');
  });
  await t.test('hidden geometry action checks one entity, does not alter filters or parent checkbox',async()=>{
   const id=await page.evaluate("(()=>{const e=[...qaApp.entityById.values()].find(x=>x.map?.bbox&&x.jurisdiction==='RO'&&!qaApp.visibleEntityIds.has(x.id)&&x.map?.tier==='overview');return e?.id||[...qaApp.entityById.values()].find(x=>x.map?.bbox&&!qaApp.visibleEntityIds.has(x.id)).id})()");
   assert.ok(id);
   await page.evaluate("qaApp.selectEntity("+JSON.stringify(id)+",{source:'P5.4.1b',zoom:false})");
   await waitFor(()=>page.evaluate("!document.querySelector('#selection-visibility-action').hidden"),'hidden action shown');
   assert.equal(await page.evaluate("document.querySelector('#selection-visibility-action').dataset.action"),'show');
   const before=await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),classes:[...qaApp.activeGeometryClasses].sort(),subtypes:[...qaApp.activeGeometrySubtypes].sort()})");
   await page.click('#selection-visibility-action');
   const after=await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),classes:[...qaApp.activeGeometryClasses].sort(),subtypes:[...qaApp.activeGeometrySubtypes].sort(),entity:qaApp.selectedEntityId})");
   assert.deepEqual(after.ids,[...before.ids,id].sort());assert.deepEqual(after.classes,before.classes);assert.deepEqual(after.subtypes,before.subtypes);assert.equal(after.entity,id);
   assert.equal(await page.evaluate("document.querySelector('#selection-visibility-action').hidden"),true);
  });
  await t.test('reset restores jurisdiction, class, subtype, statistical level; never changes per-ID or raster preference',async()=>{
   await page.click('#basemap-toggle');
   await page.click('#filters-toggle');
   await page.click('#layer-ro');
   const sub=await page.evaluate("document.querySelector('[data-kind=geometry-subtype]').dataset.filter");
   await page.evaluate("id=>{document.querySelector('[data-kind=geometry-subtype][data-filter=\"'+id+'\"]').closest('details').open=true;}",sub);
   await page.click('[data-kind=geometry-subtype][data-filter="'+sub+'"]');
   const levels=await page.evaluate("({level:document.querySelector('[data-kind=statistical]').dataset.filter,reset:document.querySelector('#filters-reset').disabled})");
   assert.equal(levels.reset,false);
   await page.click('[data-kind=statistical][data-filter="'+levels.level+'"]');
   const before=await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,baseline:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),count:document.querySelector('#filters-count').textContent})");
   assert.match(before.count,/dezactivate|dezactivat/);
   await page.click('#filters-reset');
   const after=await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,baseline:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),reset:document.querySelector('#filters-reset').disabled,count:document.querySelector('#filters-count').textContent,ro:document.querySelector('#layer-ro').checked,md:document.querySelector('#layer-md').checked,stat:[...qaApp.activeStatisticalLevels].sort(),subtypes:[...qaApp.activeGeometrySubtypes].length})");
   assert.deepEqual(after.ids,before.ids);assert.equal(after.selected,before.selected);assert.equal(after.baseline,'false');assert.equal(after.count,'');assert.equal(after.reset,true);assert.equal(after.ro,true);assert.equal(after.md,true);assert.deepEqual(after.stat,[1,2,3,'unclassified'].sort());assert.ok(after.subtypes>0);
   await page.click('#drawer-close');
   assert.equal(await page.evaluate("document.activeElement.id"),'filters-toggle');
  });
  await t.test('selected checked geometry hidden by filters offers explicit filter action without unchecking',async()=>{
   await page.click('#filters-toggle');await page.click('#layer-ro');await page.click('#drawer-close');
   assert.equal(await page.evaluate("document.querySelector('#selection-visibility-action').dataset.action"),'filters');
   await page.click('#selection-visibility-action');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),false);
   await page.click('#filters-reset');
   await page.click('#drawer-close');
  });
  await t.test('compact disabled modes fit mobile header and hidden geometry can be activated from sheet',async()=>{
   await page.viewport(390,844);
   const header=await page.evaluate("({bottom:document.querySelector('header').getBoundingClientRect().bottom,modes:[...document.querySelectorAll('header .mode')].map(e=>{const r=e.getBoundingClientRect();return {bottom:r.bottom,right:r.right}})})");
   assert.ok(header.modes.every(r=>r.bottom<=header.bottom+1&&r.right<=390),'mode overlap '+JSON.stringify(header));
   await page.click('#mobile-navigation');await page.click('#filters-toggle');
   assert.ok(await page.evaluate("document.querySelector('#filters-panel .filter-actions button').getBoundingClientRect().height>=44"),'mobile filter touch target');
   await page.click('#drawer-close');
   const id=await page.evaluate("[...qaApp.entityById.values()].find(x=>x.map?.bbox&&!qaApp.visibleEntityIds.has(x.id)).id");
   await page.evaluate("qaApp.selectEntity("+JSON.stringify(id)+",{source:'map',zoom:false})");
   await waitFor(()=>page.evaluate("qaApp.atlasMobile.state.sheet==='peek'"),'selected sheet peek');
   assert.equal(await page.evaluate("document.querySelector('#selection-visibility-action').dataset.action"),'show');
   await page.click('#selection-visibility-action');
   assert.equal(await page.evaluate("qaApp.visibleEntityIds.has("+JSON.stringify(id)+")"),true);
   assert.equal(await page.evaluate("qaApp.atlasMobile.state.sheet"),'peek');
  });
  await t.test('no browser exceptions or app resource failures',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(r=>r.status>=400&&r.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
