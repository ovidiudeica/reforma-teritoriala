import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
const screenshotDir=path.join(tmpdir(),'atlas-p5-prototype-evidence');
try{
 await test('P5.0 isolated real-data prototype Chrome/CDP', {timeout:420000},async t=>{
  await t.test('bootstrap released RO/MD index and consolidated hierarchy',async()=>{
   await page.viewport(1440,900);
   await page.send('Page.navigate',{url:browser.server.url+'/prototypes/p5-navigation/'});
   await waitFor(()=>page.evaluate("document.documentElement.dataset.p5Ready==='true'"),'P5 prototype ready',90000);
   const report=await page.evaluate("({count:p5Navigation.ready,roots:document.querySelectorAll('#hierarchy-tree > .tree-node').length,tree:document.querySelector('#p5-panel-tree').hidden,filters:document.querySelector('#p5-panel-filters').hidden,pins:document.querySelectorAll('.tree-pin').length,map:!!p5Navigation.map,overflow:document.documentElement.scrollWidth>innerWidth})");
   // qaApp isn't declared by the prototype; count comes from the production module on the next call.
   assert.ok(report.map);assert.equal(report.roots,2);assert.equal(report.tree,false);assert.equal(report.filters,true);
   assert.ok(report.pins>=2);assert.equal(report.overflow,false);
   const count=await page.evaluate("document.querySelector('#p5-count-label').textContent");
   assert.match(count,/5[.\s]?848/);
   await page.screenshot(path.join(screenshotDir,'p50-desktop-tree.png'));
  });
  await t.test('separate tabs and actual jurisdiction filters',async()=>{
   await page.click('#p5-tab-filters');
   assert.deepEqual(await page.evaluate("({tree:document.querySelector('#p5-panel-tree').hidden,filters:document.querySelector('#p5-panel-filters').hidden,selected:document.querySelector('#p5-tab-filters').getAttribute('aria-selected')})"),
     {tree:true,filters:false,selected:'true'});
   await page.click('#layer-ro');
   assert.equal(await page.evaluate("document.querySelector('#layer-ro').checked"),false);
   assert.equal(await page.evaluate("document.querySelector('#p5-filter-count').hidden"),false);
   await page.click('#layer-ro');
   await page.click('#p5-tab-tree');
   assert.equal(await page.evaluate("document.querySelector('#p5-panel-tree').hidden"),false);
  });
  await t.test('selection through the real hierarchy remains distinct from overlay checkbox',async()=>{
   await page.click('#hierarchy-tree .tree-select');
   await waitFor(()=>page.evaluate("document.body.dataset.p5Selection==='entity'"),'entity selected',30000);
   const state=await page.evaluate("({id:new URL(location.href).searchParams.get('e'),title:document.querySelector('#details-title').textContent,pins:p5Navigation.selectedBoundaryIds.size})");
   assert.ok(state.id?.startsWith('osm-'));assert.notEqual(state.title,'Nicio selecție');assert.equal(state.pins,0);
   await page.click('#hierarchy-tree .tree-pin');
   await waitFor(()=>page.evaluate("p5Navigation.visibleOverlays.size===1"),'exact geometry pinned',30000);
   const added=await page.evaluate("({count:p5Navigation.selectedBoundaryIds.size,geo:[...p5Navigation.visibleOverlays.values()][0].getLayers().length,selected:document.body.dataset.p5Selection})");
   assert.equal(added.count,1);assert.ok(added.geo>=1);assert.equal(added.selected,'entity');
   await page.screenshot(path.join(screenshotDir,'p50-desktop-pinned.png'));
   await page.click('#p5-clear-pins');
   assert.equal(await page.evaluate('p5Navigation.selectedBoundaryIds.size'),0);
  });
  await t.test('keyboard resizing and tab navigation remain accessible',async()=>{
   await page.click('#p5-resize-handle');
   const initial=Number(await page.evaluate("document.querySelector('#p5-resize-handle').getAttribute('aria-valuenow')"));
   await page.key('ArrowRight');
   const changed=Number(await page.evaluate("document.querySelector('#p5-resize-handle').getAttribute('aria-valuenow')"));
   assert.equal(changed,initial+24);
   const panelWidth=await page.evaluate("Math.round(document.querySelector('#atlas-controls').getBoundingClientRect().width)");
   assert.equal(panelWidth,changed);
   await page.key('ArrowLeft');
   await page.click('#p5-tab-tree');
   await page.key('ArrowRight');
   assert.equal(await page.evaluate("document.querySelector('#p5-panel-filters').hidden"),false);
   await page.key('ArrowLeft');
   assert.equal(await page.evaluate("document.querySelector('#p5-panel-tree').hidden"),false);
  });
  await t.test('layout stays within seven desktop/tablet/mobile viewports',async()=>{
   for(const [width,height] of [[1440,900],[1280,800],[900,768],[720,900],[430,932],[390,844],[360,800]]){
    await page.viewport(width,height);
    const v=await page.evaluate("({scroll:document.documentElement.scrollWidth,width:innerWidth,map:document.querySelector('#map').getBoundingClientRect().width})");
    assert.ok(v.scroll<=width,'horizontal overflow at '+width);
    assert.ok(v.map>250,'map unavailable at '+width);
    await page.screenshot(path.join(screenshotDir,'p50-'+width+'x'+height+'.png'));
   }
   await page.viewport(1440,900);
  });
  await t.test('mobile drawer, filters, tree and full-screen map',async()=>{
   await page.viewport(390,844);
   const state=await page.evaluate("({mobile:matchMedia('(max-width:720px)').matches,hidden:document.querySelector('#atlas-controls').hidden,map:document.querySelector('#map').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth})");
   assert.equal(state.mobile,true);assert.equal(state.hidden,true);assert.equal(state.map,390);assert.equal(state.overflow,false);
   await page.click('#p5-show-filters');
   await waitFor(()=>page.evaluate("!document.querySelector('#atlas-controls').hidden && !document.querySelector('#p5-panel-filters').hidden"),'mobile filter drawer');
   await page.screenshot(path.join(screenshotDir,'p50-mobile-filters.png'));
   await page.click('#p5-tab-tree');
   await page.screenshot(path.join(screenshotDir,'p50-mobile-tree.png'));
   await page.key('Escape');
   await waitFor(()=>page.evaluate("document.querySelector('#atlas-controls').hidden"),'mobile escape closes drawer');
  });
  await t.test('zero application JS errors and no malformed app responses',async()=>{
   const scriptErrors=page.errors;
   const appHttp=page.responses.filter(x=>x.url.startsWith(browser.server.url)&&x.status>=400);
   const appFail=page.failures.filter(x=>x.url?.startsWith(browser.server.url)&&!x.canceled);
   assert.equal(scriptErrors.length,0,JSON.stringify(scriptErrors.slice(0,3)));
   assert.deepEqual(appHttp,[],JSON.stringify(appHttp.slice(0,10)));
   assert.deepEqual(appFail,[]);
  });
 });
}finally{await browser.close();}
