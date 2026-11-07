import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,waitFor,delay} from '../test/helpers/atlas-browser.mjs';
import {auditEvidenceDirectory} from '../test/helpers/atlas-evidence.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const out=auditEvidenceDirectory();
await mkdir(out,{recursive:true});
const browser=await launchBrowser(root),page=await browser.page();
const viewports=[['desktop',1440,900],['telefon',390,844],['peisaj',844,390],['tableta',768,1024]];
const evidence=[];
const navCore=['mobile-navigation','mobile-search','advanced-visible','filters-toggle','navigation-more'];
const commands=['leaflet-control-zoom-in','leaflet-control-zoom-out','map-home'];
const state=()=>page.call(function(){return {
 checked:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,
 filters:[...qaApp.activeGeometrySubtypes].sort(),raster:document.getElementById('basemap-toggle').getAttribute('aria-pressed'),
 url:location.search,zoom:qaApp.map.getZoom(),center:qaApp.map.getCenter(),
 active:qaApp.atlasPanels.state.active,menu:qaApp.atlasPanels.state.menu
};});
const visual=()=>page.call(function(){
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const clickTargets=['#navigation-more','#filters-toggle','#mobile-navigation','#modules-toggle','#drawer-close'];
 const targets=clickTargets.map(selector=>{const e=document.querySelector(selector),r=rect(e);
  const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return {id:e.id,...r,visible:r.width>0&&r.height>0,hit:e===hit||e.contains(hit),aria:e.getAttribute('aria-label')};});
 return {overflow:document.documentElement.scrollWidth>innerWidth,viewport:[innerWidth,innerHeight],
  map:rect(document.getElementById('map')),
  commands:[...document.querySelector('.leaflet-control-zoom').children].map(e=>{const r=rect(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id||e.className,...r,hit:e===hit||e.contains(hit),label:e.getAttribute('aria-label')};}),
  cardHidden:document.getElementById('details-panel').hidden,
  panelHidden:document.getElementById('atlas-controls').hidden,targets};
});
async function shot(name){await page.screenshot(path.join(out,'web-r33-'+name+'.png'));}
let success=false;
try {
 await test('WEB-R3.3 — audit funcțional și vizual Chromium desktop/mobil',{timeout:300000},async t=>{
  for(const [label,w,h] of viewports){
   await t.test(label+' '+w+'x'+h,async()=>{
    await page.viewport(w,h);await page.navigate(browser.server.url+'/');
    await waitFor(()=>page.evaluate('qaApp.entityById.size===5848'),'ACTUAL '+label);
    const initial=await state();
    const base=await visual();
    assert.equal(base.overflow,false,label+' overflow initial');
    assert.equal(base.cardHidden,true,label+' selection card initially hidden');
    assert.ok(base.map.width>0&&base.map.height>0);
    assert.deepEqual(base.commands.map(x=>x.id),commands,label+' map toolbar');
    assert.ok(base.commands.every(x=>x.width>=44&&x.height>=44&&x.hit&&x.label),JSON.stringify({label,commands:base.commands}));
    assert.equal(await page.evaluate('document.getElementById("map-geometries-reset")'),null);
    assert.equal(await page.evaluate('document.getElementById("map-secondary-tools").open'),false);
    const nav=await page.call(function(){return [...document.querySelectorAll('#atlas-navigation-rail>button')].filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none').map(e=>e.id);});
    assert.deepEqual(nav,navCore,label+' five primary rail buttons');
    await shot(label+'-harta-initiala');
    await page.click('#navigation-more');
    assert.equal(await page.evaluate('qaApp.atlasPanels.state.menu'),true);
    const expanded=await page.call(function(){return ['advanced-recent','advanced-compare','identify-toggle','measure-toggle','share-toggle'].every(id=>document.getElementById(id).getBoundingClientRect().width>=44);});
    assert.equal(expanded,true,label+' expanded secondary navigation');
    await shot(label+'-instrumente-extinse');
    await page.key('Escape');
    assert.equal(await page.evaluate('qaApp.atlasPanels.state.menu'),false);
    assert.equal(await page.evaluate('document.activeElement.id'),'navigation-more');
    for(const key of ['entities','search','visible','filters','modules']){
     await page.openPanel(key);
     const pane=await page.call(function(key){const host=document.getElementById('atlas-controls'),active=[...host.querySelectorAll(':scope>section')].filter(x=>!x.hidden&&x.id!=='search-panel');
      return {active:qaApp.atlasPanels.state.active,title:document.getElementById('atlas-panel-title').textContent,hidden:host.hidden,expanded:document.querySelector('[data-panel="'+key+'"]').getAttribute('aria-expanded'),panes:active.map(x=>x.id),closeFocusSize:document.getElementById('drawer-close').getBoundingClientRect().height};},key);
     assert.equal(pane.active,key);assert.equal(pane.hidden,false);assert.equal(pane.expanded,'true');assert.equal(pane.panes.length,1);
     assert.ok(pane.closeFocusSize>=44);
     if(key==='modules'){
      const modes=await page.call(function(){return [...document.querySelectorAll('#modules-panel [data-mode]')].map(e=>[e.dataset.mode,e.disabled]);});
      assert.deepEqual(modes,[['actual',false],['istoric',true],['propuneri',true]]);
      await shot(label+'-module');
     }
    }
    await page.openPanel('filters');
    const beforeFilter=await state();
    await page.click('#layer-md');
    assert.equal(await page.evaluate('document.getElementById("layer-md").checked'),false);
    assert.deepEqual((await state()).checked,beforeFilter.checked);
    await page.click('#layer-md');
    assert.equal(await page.evaluate('document.getElementById("layer-md").checked'),true);
    const details=await page.call(function(){const e=document.getElementById('map-secondary-tools'),button=document.getElementById('basemap-toggle');return {closed:!e.open,inside:!!button.closest('#filters-panel'),notOnMap:!button.closest('.leaflet-control-zoom')};});
    assert.deepEqual(details,{closed:true,inside:true,notOnMap:true});
    await page.click('#map-secondary-tools>summary');
    const rasterTarget=await page.call(function(){const e=document.getElementById('basemap-toggle'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,hit:hit===e||e.contains(hit)};});
    assert.ok(rasterTarget.width>=44&&rasterTarget.height>=44&&rasterTarget.hit,JSON.stringify({label,rasterTarget}));
    await page.click('#basemap-toggle');
    assert.equal(await page.evaluate('document.getElementById("basemap-toggle").getAttribute("aria-pressed")'),'false');
    assert.deepEqual((await state()).checked,beforeFilter.checked);
    await page.click('#basemap-toggle');
    assert.equal(await page.evaluate('document.getElementById("basemap-toggle").getAttribute("aria-pressed")'),'true');
    await shot(label+'-filtre-instrumente');
    await page.click('#drawer-close');
    assert.equal(await page.evaluate('qaApp.atlasPanels.state.active'),null);
    await page.call(function(){qaApp.selectEntity('osm-r58974',{source:'map',zoom:false});});
    await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r58974'&&!document.getElementById('details-panel').hidden"),'selection '+label);
    const card=await page.call(function(){const el=document.getElementById('details-panel'),close=document.getElementById('details-close'),r=close.getBoundingClientRect();return {hidden:el.hidden,inert:el.inert,title:document.getElementById('details-title').textContent,closeHeight:r.height};});
    assert.equal(card.hidden,false);assert.equal(card.inert,false);assert.ok(card.title.length>0);assert.ok(card.closeHeight>=44);
    await shot(label+'-entitate-selectata');
    await page.click('#details-close');
    assert.equal(await page.evaluate('document.getElementById("details-panel").hidden'),true);
    assert.equal(await page.evaluate('qaApp.selectedEntityId'),null);
    const ending=await state();
    assert.deepEqual(ending.checked,initial.checked,label+' preserve checked IDs');
    assert.deepEqual(ending.filters,initial.filters,label+' preserve filters');
    assert.equal(ending.raster,initial.raster,label+' raster restored');
    assert.equal(ending.active,null);
    const endingVisual=await visual();
    assert.equal(endingVisual.overflow,false,label+' no overflow after interactions');
    evidence.push({view:label,width:w,height:h,initial:base,final:endingVisual,checks:['map-only-three','rail-more','panel-open-close','modules','filter-jurisdiction','secondary-raster','entity-card','accessibility','no-overflow']});
   });
  }
  await t.test('no runtime errors or failed application requests',()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(e=>e.type==='error'||e.level==='error'),[]);
   assert.deepEqual(page.responses.filter(e=>e.status>=400&&e.url.startsWith(browser.server.url)),[]);
  });
 });
 success=true;
}finally{
 await writeFile(path.join(out,'web-r33-audit.json'),JSON.stringify({test:'WEB-R3.3',complete:success,pass:success,viewports:viewports.map(([name,w,h])=>({name,w,h})),evidence,errors:page.errors},null,2)+'\n');
 await browser.close();
}
