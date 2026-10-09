import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P5.4.2 Pages production performance and mobile telemetry',{timeout:150000},async t=>{
  await page.viewport(1440,900);
  await page.navigate('https://ovidiudeica.github.io/reforma-teritoriala/');
  for(const [width,height] of [[1440,900],[900,768],[899,768],[390,844]]){
   await t.test('viewport '+width+'x'+height,async()=>{
    await page.viewport(width,height);
    const metrics=await page.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0];const r=performance.getEntriesByType('resource');return {viewport:[innerWidth,innerHeight],deviceMobile:matchMedia('(max-width: 899px)').matches,appMobile:qaApp.atlasMobile.state.mobile,entities:qaApp.entityById.size,treeButtons:document.querySelectorAll('.tree-select').length,loadedGeometryLayers:document.querySelectorAll('.leaflet-overlay-pane path').length,domNodes:document.querySelectorAll('*').length,resourceCount:r.length,transferSizeBytes:r.reduce((s,x)=>s+(x.transferSize||0),0),navigationDurationMs:Math.round(n?.duration||0),dclMs:Math.round(n?.domContentLoadedEventEnd||0),mapWidth:Math.round(document.querySelector('#map').getBoundingClientRect().width),overflow:document.documentElement.scrollWidth>innerWidth}})()");
    assert.equal(metrics.entities,5848);
    assert.equal(metrics.appMobile,metrics.deviceMobile);
    assert.ok(metrics.mapWidth>0);
    assert.equal(metrics.overflow,false);
    assert.ok(metrics.loadedGeometryLayers>0);
    console.log('P5.4.2 PERF '+JSON.stringify(metrics));
   });
  }
  assert.deepEqual(page.errors,[]);
  assert.deepEqual(page.responses.filter(r=>r.status>=400&&r.url.startsWith('https://ovidiudeica.github.io/reforma-teritoriala/')),[]);
 });
}finally{await browser.close();}
