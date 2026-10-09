import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
const snapshots=[];
const geometryState="({ids:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,filters:[...qaApp.activeGeometryClasses].sort(),subtypes:[...qaApp.activeGeometrySubtypes].sort(),raster:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),url:location.search})";
try{
 await test('P6.2 real Chrome mobile/tablet ergonomics, swipe/keyboard and geometry invariants',{timeout:180000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');await page.viewport(390,844);
  await waitFor(()=>page.evaluate('qaApp.entityById.size===5848'),'public ACTUAL catalog');
  await t.test('phone uses visible three-action dock, unobscured map and touch targets',async()=>{
   const state=await page.evaluate("(()=>{const dock=document.querySelector('#atlas-mobile-toolbar'),map=document.querySelector('#map'),controls=['mobile-navigation','mobile-search','mobile-filters'];return {visible:!dock.hidden,buttons:controls.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,hidden:e.hidden,height:r.height,width:r.width}}),map:map.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth,selected:qaApp.selectedEntityId,ids:[...qaApp.visibleEntityIds].sort()}})()");
   assert.equal(state.visible,true);assert.ok(state.buttons.every(b=>!b.hidden&&b.height>=44&&b.width>=44));assert.equal(state.map,390);assert.equal(state.overflow,false);assert.equal(state.selected,null);assert.deepEqual(state.ids,['osm-r58974','osm-r90689'].sort());
  });
  await t.test('mobile search shortcut opens drawer and focuses search; Escape returns dock',async()=>{
   await page.click('#mobile-search');
   assert.equal(await page.evaluate('qaApp.atlasMobile.state.drawer'),true);
   assert.equal(await page.evaluate('document.activeElement.id'),'entity-search');
   await page.key('Escape');
   assert.equal(await page.evaluate('qaApp.atlasMobile.state.drawer'),false);
   assert.equal(await page.evaluate('document.activeElement.id'),'mobile-search');
  });
  await t.test('mobile filters shortcut opens existing filter panel and retains independent geometry checks',async()=>{
   const before=await page.evaluate(geometryState);
   await page.click('#mobile-filters');
   assert.equal(await page.evaluate("qaApp.atlasMobile.state.drawer && !document.querySelector('#filters-panel').hidden"),true);
   assert.equal(await page.evaluate('document.activeElement.id'),'filters-close');
   await page.key('Escape');
   assert.equal(await page.evaluate("document.querySelector('#filters-panel').hidden"),true);
   await page.key('Escape');
   assert.equal(await page.evaluate('qaApp.atlasMobile.state.drawer'),false);
   assert.equal(await page.evaluate('document.activeElement.id'),'mobile-filters');
   assert.deepEqual(await page.evaluate(geometryState),before);
  });
  await t.test('selected sheet starts minimized and supports middle and full heights without URL changes',async()=>{
   const id=await page.evaluate("[...qaApp.entityById.values()].find(e=>e.jurisdiction==='RO'&&e.map?.bbox&&!qaApp.visibleEntityIds.has(e.id)).id");
   await page.evaluate('qaApp.selectEntity('+JSON.stringify(id)+",{source:'map',zoom:false})");
   await waitFor(()=>page.evaluate("qaApp.atlasMobile.state.sheet==='peek'"),'peek sheet');
   const before=await page.evaluate(geometryState);
   const peekHeight=await page.evaluate("document.querySelector('#details-panel').getBoundingClientRect().height");
   const frame=await page.evaluate("(()=>{const dock=document.querySelector('#atlas-mobile-toolbar').getBoundingClientRect(),sheet=document.querySelector('#details-panel').getBoundingClientRect(),handle=document.querySelector('#sheet-drag').getBoundingClientRect();return {dockTop:dock.top,sheetBottom:sheet.bottom,handleHeight:handle.height}})()");
   assert.ok(frame.handleHeight>=44,'touch-safe drag handle');
   assert.ok(frame.sheetBottom<=frame.dockTop-2,'card must not cover mobile actions');
   assert.equal(await page.evaluate("document.querySelector('#details-body').hidden"),true);
   await page.click('#sheet-half');
   assert.equal(await page.evaluate("qaApp.atlasMobile.state.sheet"),'half');
   assert.equal(await page.evaluate("document.querySelector('#details-body').hidden"),false);
   const halfHeight=await page.evaluate("document.querySelector('#details-panel').getBoundingClientRect().height");
   assert.ok(halfHeight>peekHeight,'middle sheet height '+halfHeight+' > '+peekHeight);
   await page.click('#sheet-expand');
   assert.equal(await page.evaluate("qaApp.atlasMobile.state.sheet"),'expanded');
   const fullHeight=await page.evaluate("document.querySelector('#details-panel').getBoundingClientRect().height");
   assert.ok(fullHeight>halfHeight,'full sheet height '+fullHeight+' > '+halfHeight);
   await page.click('#sheet-expand');
   assert.equal(await page.evaluate("qaApp.atlasMobile.state.sheet"),'peek');
   assert.deepEqual(await page.evaluate(geometryState),before);
  });
  await t.test('slider keyboard and swipe each move one snap position; never manipulate geometry',async()=>{
   const before=await page.evaluate(geometryState);
   await page.evaluate("document.querySelector('#sheet-drag').focus()");
   await page.key('ArrowUp');
   assert.equal(await page.evaluate('qaApp.atlasMobile.state.sheet'),'half');
   assert.equal(await page.evaluate("document.querySelector('#sheet-drag').getAttribute('aria-valuetext')"),'Jumătate');
   await page.key('End');
   assert.equal(await page.evaluate('qaApp.atlasMobile.state.sheet'),'expanded');
   await page.key('Home');
   assert.equal(await page.evaluate('qaApp.atlasMobile.state.sheet'),'peek');
   const center=await page.evaluate("(()=>{const r=document.querySelector('#sheet-drag').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
   await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:center.x,y:center.y,button:'left',buttons:1,clickCount:1});
   await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:center.x,y:center.y-75,button:'left',buttons:1});
   await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:center.x,y:center.y-75,button:'left',buttons:0,clickCount:1});
   await waitFor(()=>page.evaluate("qaApp.atlasMobile.state.sheet==='half'"),'drag increases one step');
   assert.deepEqual(await page.evaluate(geometryState),before);
  });
  await t.test('portrait/landscape tablet and exact 899/900px transitions retain map and selection',async()=>{
   const baseline=await page.evaluate(geometryState);
   for(const [w,h] of [[844,390],[768,1024],[1024,768],[900,768],[899,768],[360,640],[390,844]]){
    await page.viewport(w,h);
    const state=await page.evaluate("({mobile:qaApp.atlasMobile.state.mobile,toolbar:document.querySelector('#atlas-mobile-toolbar').hidden,overflow:document.documentElement.scrollWidth>innerWidth,map:document.querySelector('#map').getBoundingClientRect().width,sheet:qaApp.atlasMobile.state.sheet,details:document.querySelector('#details-panel').getBoundingClientRect().height})");
    snapshots.push({viewport:w+'x'+h,...state});
    assert.equal(state.mobile,w<900);assert.equal(state.toolbar,w>=900);
    assert.equal(state.overflow,false,'horizontal overflow '+w+'x'+h);assert.ok(state.map>0);
    if(w<900)assert.ok(state.details>0);
    const nonViewport=state=>{const params=new URLSearchParams(state.url);for(const key of ['lat','lon','z'])params.delete(key);return {...state,url:params.toString()};};
    assert.deepEqual(nonViewport(await page.evaluate(geometryState)),nonViewport(baseline));
   }
  });
  await t.test('closing selection restores map without changing checked geometries',async()=>{
   const before=await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometryClasses].sort()})");
   await page.click('#details-close');
   assert.equal(await page.evaluate('qaApp.atlasMobile.state.sheet'),'closed');
   assert.equal(await page.evaluate("document.querySelector('#details-panel').hidden"),true);
   assert.deepEqual(await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometryClasses].sort()})"),before);
  });
  await t.test('no JS exceptions, console errors or own 404',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[]);
  });
  console.log('P6.2 responsive evidence',JSON.stringify(snapshots));
 });
}finally{await browser.close();}
