import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
try {
 await test('WEB-R1b: independent accordions, rail and map command responsive QA',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url+'/');
  await page.openPanel('filters');
  await t.test('desktop grouped rail, close X, filters do not mutate map or URL',async()=>{
   const d=await page.evaluate(`(()=>{
    const nav=[...document.querySelectorAll('#atlas-navigation-rail>button')].map(x=>x.id);
    const x=document.querySelector('#drawer-close'),r=x.getBoundingClientRect();
    return {nav,close:x.textContent.trim(),aria:x.getAttribute('aria-label'),width:r.width,height:r.height,
      section:document.querySelector('#filters-panel .atlas-panel-disclosure')?.tagName,
      token:getComputedStyle(document.documentElement).getPropertyValue('--atlas-type-body').trim()};
   })()`);
   assert.deepEqual(d.nav.slice(0,5),['mobile-navigation','mobile-search','advanced-visible','filters-toggle','navigation-more']);
   assert.equal(d.close,'×');assert.match(d.aria,/Închide/);assert.ok(d.width>=44&&d.height>=44);
   assert.equal(d.section,'DETAILS');assert.equal(d.token,'13px');
   const old=await page.evaluate('location.href');
   await page.click('#filters-panel .atlas-panel-disclosure>summary');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel .atlas-panel-disclosure').open"),false);
   assert.equal(await page.evaluate('location.href'),old);
   await page.click('#filters-panel .atlas-panel-disclosure>summary');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel .atlas-panel-disclosure').open"),true);
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-desktop-filters.png'));
  });
  await t.test('phone five primary targets, More focus, Escape and drawer close',async()=>{
   await page.viewport(390,844);await page.evaluate('qaApp.atlasPanels.close({focus:false})');
   const p=await page.evaluate(`[...document.querySelectorAll('#atlas-navigation-rail>button')]
    .filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none')
    .map(e=>({id:e.id,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))`);
   assert.deepEqual(p.map(x=>x.id),['mobile-navigation','mobile-search','advanced-visible','filters-toggle','navigation-more']);
   assert.ok(p.every(x=>x.w>=44&&x.h>=44));
   await page.click('#navigation-more');
   assert.equal(await page.evaluate('qaApp.atlasPanels.state.menu'),true);
   assert.equal(await page.evaluate('document.activeElement.id'),'identify-toggle');
   const count=await page.evaluate(`[...document.querySelectorAll('#atlas-navigation-rail>button')]
     .filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none').length`);
   assert.equal(count,11);
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-mobile-more.png'));
   await page.key('Escape');
   assert.equal(await page.evaluate('document.activeElement.id'),'navigation-more');
   await page.click('#filters-toggle');
   assert.equal(await page.evaluate("document.querySelector('#atlas-controls').dataset.panel"),'filters');
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-mobile-filters.png'));
   await page.click('#drawer-close');
  });
  await t.test('compact landscape remains touch sized and card provenance is collapsible',async()=>{
   await page.viewport(640,360);await page.evaluate('qaApp.atlasPanels.close({focus:false})');
   const p=await page.evaluate(`[...document.querySelectorAll('#atlas-navigation-rail>button')]
    .filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none')
    .map(e=>({id:e.id,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))`);
   assert.equal(p.length,5);assert.ok(p.every(x=>x.w>=44&&x.h>=44));
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-landscape-640x360.png'));
   await page.viewport(1440,900);
   await page.evaluate("qaApp.selectEntity('osm-r58974',{source:'WEB-R1b',zoom:false})");
   await waitFor(()=>page.evaluate("!document.querySelector('#details-panel').hidden"),'card');
   const d=await page.evaluate(`[...document.querySelectorAll('#details-body .details-section')]
     .map(e=>({tag:e.tagName,summary:e.querySelector('summary')?.textContent.trim()}))`);
   assert.equal(d.length,3);assert.ok(d.every(x=>x.tag==='DETAILS'&&x.summary));
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','web-r1b-desktop-card.png'));
  });
  await t.test('no runtime errors',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  });
 });
}finally{await browser.close();}
