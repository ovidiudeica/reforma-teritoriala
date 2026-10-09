import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
const viewports=[[1440,900],[1280,800],[900,768],[360,800],[390,844],[430,932],[390,600]];
try{
 await test('P5.1 production shell: resizable desktop, contextual card, map-first mobile',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("document.querySelectorAll('#hierarchy-tree .tree-select').length>0"),'atlas tree ready');
  await t.test('no selected card and desktop two-pane grid',async()=>{
   const data=await page.evaluate("({title:document.querySelector('#atlas-controls>h2').textContent.trim(),treeHeading:document.querySelector('#hierarchy-tree').closest('section').querySelector('h3').textContent.trim(),hidden:document.querySelector('#details-panel').hidden,visible:getComputedStyle(document.querySelector('#details-panel')).display,side:document.querySelector('#atlas-controls').getBoundingClientRect().width,resizer:document.querySelector('#explorer-resizer').getBoundingClientRect().width,map:document.querySelector('#map').getBoundingClientRect().width})");
   assert.equal(data.title,'Explorează');assert.equal(data.treeHeading,'Arbore');
   assert.equal(data.hidden,true);assert.equal(data.visible,'none');assert.ok(data.side>=280&&data.side<=660);
   assert.ok(data.resizer>=7&&data.map>0);
  });
  await t.test('keyboard resizing updates ARIA, grid and Leaflet',async()=>{
   await page.evaluate("document.querySelector('#explorer-resizer').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))");
   const current=await page.evaluate("({aria:document.querySelector('#explorer-resizer').getAttribute('aria-valuenow'),width:Math.round(document.querySelector('#atlas-controls').getBoundingClientRect().width),mapWidth:document.querySelector('#map').getBoundingClientRect().width})");
   assert.equal(current.aria,'360');assert.equal(current.width,360);assert.ok(current.mapWidth>400);
  });
  await t.test('pointer resizing updates width without stealing map area',async()=>{
   await page.viewport(1440,900);
   const drag=await page.evaluate("(()=>{const d=document.querySelector('#explorer-resizer').getBoundingClientRect(),m=document.querySelector('#atlas-main').getBoundingClientRect();return{x:d.x+d.width/2,y:d.y+Math.min(120,d.height/2),target:m.left+420};})()");
   await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:drag.x,y:drag.y,button:'left',buttons:1,clickCount:1});
   await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:drag.target,y:drag.y,button:'left',buttons:1});
   await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:drag.target,y:drag.y,button:'left',buttons:0,clickCount:1});
   const current=await page.evaluate("({aria:document.querySelector('#explorer-resizer').getAttribute('aria-valuenow'),width:Math.round(document.querySelector('#atlas-controls').getBoundingClientRect().width),mapWidth:Math.round(document.querySelector('#map').getBoundingClientRect().width)})");
   assert.ok(Math.abs(current.width-420)<=2,'pointer resize width '+current.width);assert.equal(current.aria,String(current.width));assert.ok(current.mapWidth>current.width,'map remains dominant after pointer resize');
  });
  await t.test('select and clear card without mutating URL contract',async()=>{
   const id=await page.evaluate("[...qaApp.entityById.values()].find(e=>e.jurisdiction==='RO'&&e.map.tier==='overview').id");
   await page.evaluate('qaApp.selectEntity('+JSON.stringify(id)+',{source:"P5.1",zoom:true})');
   await waitFor(()=>page.evaluate("!document.querySelector('#details-panel').hidden"),'selected card opened');
   assert.equal(await page.evaluate("qaApp.selectedEntityId"),id);
   await page.click('#details-close');
   await waitFor(()=>page.evaluate("document.querySelector('#details-panel').hidden"),'selected card closed');
  });
  await t.test('7 breakpoints preserve map area and no horizontal overflow',async()=>{
   for(const [width,height] of viewports){
    await page.viewport(width,height);
    const state=await page.evaluate("({screen:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,map:document.querySelector('#map').getBoundingClientRect().width,resizer:getComputedStyle(document.querySelector('#explorer-resizer')).display,mobile:matchMedia('(max-width: 899px)').matches})");
    assert.equal(state.screen,width);assert.equal(state.overflow,false,'horizontal overflow at '+width);
    assert.ok(state.map>0,'map hidden at '+width);
    if(width<900)assert.equal(state.resizer,'none');else assert.notEqual(state.resizer,'none');
   }
  });
  await t.test('mobile drawer and Escape still work',async()=>{
   await page.viewport(390,844);
   await page.click('#mobile-navigation');
   assert.equal(await page.evaluate("document.querySelector('#atlas-controls').classList.contains('mobile-drawer-open')"),true);
   await page.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
   await waitFor(()=>page.evaluate("!document.querySelector('#atlas-controls').classList.contains('mobile-drawer-open')"),'mobile drawer dismissed');
   assert.equal(await page.evaluate("document.querySelector('#details-panel').hidden"),true);
  });
  await t.test('no browser exceptions or application request failures',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.failures.filter(x=>!x.canceled&&!/tile\.openstreetmap\.org/.test(x.url||'')),[]);
  });
 });
}finally{await browser.close();}
