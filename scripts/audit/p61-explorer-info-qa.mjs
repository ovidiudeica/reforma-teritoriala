import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
try{
 await test('P6.1 explorer UX and information dialog (real Chrome, local production assets)',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url+'/');
  await waitFor(()=>page.evaluate('qaApp.entityById.size===5848'),'P6.1 full entity index');
  const baseline=await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),selection:qaApp.selectedEntityId,basemap:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),url:location.search})");
  await t.test('technical sections moved out of explorer; alert stays discoverable',async()=>{
   const s=await page.evaluate("({inside:document.querySelector('#entities-panel .status'),legend:!!document.querySelector('#atlas-info-dialog #atlas-legend'),provenance:!!document.querySelector('#atlas-info-dialog #global-provenance'),detail:!!document.querySelector('#atlas-info-dialog .status'),alert:!!document.querySelector('#atlas-controls #geometry-load-status'),closed:!!document.querySelector('#atlas-info-dialog').hidden,sideHeight:document.querySelector('#atlas-controls').scrollHeight})");
   assert.equal(s.inside,null);assert.ok(s.legend&&s.provenance&&s.detail&&s.alert&&s.closed);assert.ok(s.sideHeight<1100,'sidebar still too tall '+s.sideHeight);
  });
  await t.test('dialog contains rendered legend and release; Escape restores desktop focus',async()=>{
   await page.openPanel('info');
   const s=await page.evaluate("({open:!document.querySelector('#atlas-info-dialog').hidden,focused:document.activeElement.id,legend:document.querySelector('#atlas-legend').textContent.length,provenance:document.querySelector('#global-provenance').textContent.length})");
   assert.equal(s.open,true);assert.equal(s.focused,'drawer-close');assert.ok(s.legend>0&&s.provenance>0);
   await page.key('Escape');
   assert.equal(await page.evaluate("!document.querySelector('#atlas-info-dialog').hidden"),false);
   assert.equal(await page.evaluate('document.activeElement.id'),'info-toggle');
  });
  await t.test('opening information closes filters without changing checked geometries',async()=>{
   await page.click('#filters-toggle');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),false);
   await page.openPanel('info');
   const s=await page.evaluate("({dialog:!document.querySelector('#atlas-info-dialog').hidden,filters:document.querySelector('#filters-panel').hidden,trigger:document.querySelector('#filters-toggle').getAttribute('aria-expanded')})");
   assert.equal(s.dialog,true);assert.equal(s.filters,true);assert.equal(s.trigger,'false');
   await page.click('#drawer-close');
   assert.deepEqual(await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),selection:qaApp.selectedEntityId,basemap:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),url:location.search})"),baseline);
  });
  await t.test('responsive tablet and mobile drawer focus recovery; no horizontal overflow',async()=>{
   for(const [width,height] of [[900,768],[768,860],[390,844],[360,800]]){
    await page.viewport(width,height);
    const s=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,map:document.querySelector('#map').getBoundingClientRect().width,mobile:qaApp.atlasMobile.state.mobile})");
    assert.equal(s.overflow,false,'overflow at '+width);assert.ok(s.map>0);assert.equal(s.mobile,width<900);
    if(width===900)continue;
    await page.click('#mobile-navigation');
    await page.openPanel('info');
    assert.equal(await page.evaluate("!document.querySelector('#atlas-info-dialog').hidden"),true);
    assert.equal(await page.evaluate("qaApp.atlasMobile.state.drawer"),true);
    assert.equal(await page.evaluate('document.activeElement.id'),'drawer-close');
    await page.key('Escape');
    assert.equal(await page.evaluate("!document.querySelector('#atlas-info-dialog').hidden"),false);
    assert.equal(await page.evaluate('document.activeElement.id'),width<600?'navigation-more':'info-toggle');
   }
  });
  await t.test('no application JS errors or own resource 404',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(c=>c.type==='error'||c.level==='error'),[]);
   assert.deepEqual(page.responses.filter(r=>r.status>=400&&r.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
