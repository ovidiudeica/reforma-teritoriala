import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {launchBrowser,waitFor,delay} from '../test/helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root),page=await browser.page();
const state=()=>page.evaluate(`(()=>{
 const v=document.querySelector('#atlas-viewport'),stage=document.querySelector('#atlas-stage'),r=v.getBoundingClientRect();
 const buttons=[...document.querySelectorAll('#atlas-preview-toolbar button')].filter(e=>!e.hidden).map(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {width:b.width,height:b.height,left:b.left,right:b.right,clear:hit===e||e.contains(hit)}});
 return {preview:qaApp.atlasPreview.state,width:v.clientWidth,height:v.clientHeight,mobile:qaApp.atlasMobile.state.mobile,cssMobile:getComputedStyle(document.querySelector('#atlas-main')).display==='block',mapWidth:qaApp.map.getSize().x,
  semantic:JSON.stringify(qaApp.captureUrlState(),(k,v)=>v instanceof Set?[...v].sort():['lat','lon'].includes(k)?Number(v.toFixed(5)):v),
  url:location.href,iframes:document.querySelectorAll('iframe').length,maps:document.querySelectorAll('.leaflet-container').length,buttons,overflow:document.documentElement.scrollWidth>innerWidth,scrollLeft:stage.scrollLeft,scrollTop:stage.scrollTop,rotateDisabled:document.querySelector('#preview-rotate').disabled,focus:document.activeElement.id};
})()`);
const ready=(width,height)=>waitFor(async()=>{const s=await state();return s.width===width&&s.height===height&&s.mobile===(width<900)&&s.cssMobile===s.mobile;},'logical CSS/JS viewport '+width+'x'+height);
const clear=s=>{assert.equal(s.overflow,false);assert.equal(s.iframes,0);assert.equal(s.maps,1);assert.ok(s.buttons.every(b=>b.width>=44&&b.height>=44&&b.left>=0&&b.right<=9000&&b.clear),'preview controls must be touch-sized and clear');};
try{
 await test('P7.1 single-instance responsive preview and semantic invariants',{timeout:300000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');
  await t.test('auto stays responsive in eight physical viewports with clear native controls',async()=>{
   for(const [w,h]of [[360,640],[390,844],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900]]){
    await page.viewport(w,h);const s=await state();clear(s);assert.equal(s.preview.mode,'auto');assert.equal(s.width,w);assert.equal(s.mobile,w<900);assert.equal(s.cssMobile,w<900);assert.equal(s.rotateDisabled,true);
    assert.ok(s.buttons.every(b=>b.right<=w),'toolbar overflows physical screen');
    await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p71-auto-'+w+'x'+h+'.png'));
   }
  });
  await t.test('device modes and both orientations preserve one map, URL, selection and geometry requests',async()=>{
   await page.evaluate("window.p71Map=qaApp.map;qaApp.selectEntity('osm-r58974',{source:'map',zoom:false})");await delay(300);
   const before=await state(),requests=page.requests.filter(x=>x.url.includes('/public/geo/actual/')).length;
   for(const [mode,w,h]of [['phone',390,844],['tablet',768,1024],['desktop',1440,900]]){
    await page.click('[data-preview-mode='+mode+']');await ready(w,h);let s=await state();clear(s);assert.equal(s.semantic,before.semantic);assert.equal(s.url,before.url);
    await page.click('#preview-rotate');await ready(h,w);s=await state();clear(s);assert.equal(s.semantic,before.semantic);assert.equal(s.url,before.url);
    await page.click('#preview-rotate');await ready(w,h);
   }
   assert.equal(await page.evaluate('qaApp.map===window.p71Map'),true);
   assert.equal(page.requests.filter(x=>x.url.includes('/public/geo/actual/')).length,requests,'preview must not redownload geometry');
   await page.click('[data-preview-mode=auto]');assert.equal((await state()).preview.mode,'auto');assert.equal((await state()).semantic,before.semantic);
  });
  await t.test('desktop on phone is usable at 1:1 through keyboard and pointer frame panning',async()=>{
   await page.viewport(390,844);await page.navigate(browser.server.url+'/');
   const before=await state();
   await page.click('[data-preview-mode=desktop]');await ready(1440,900);let s=await state();clear(s);assert.ok(s.buttons.every(b=>b.right<=390));assert.equal(s.semantic,before.semantic);
   await page.click('#preview-pan');assert.equal((await state()).preview.panning,true);assert.equal((await state()).focus,'atlas-stage');
   await page.key('ArrowRight');assert.ok((await state()).scrollLeft>0);assert.equal((await state()).semantic,before.semantic);
   const left=(await state()).scrollLeft;
   await page.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:260,y:280});
   await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:160,y:250});
   await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:160,y:250});await delay(100);
   assert.ok((await state()).scrollLeft>left);
   await page.key('Escape');assert.equal((await state()).preview.panning,false);assert.equal((await state()).focus,'preview-pan');
   await page.click('[data-preview-mode=auto]');await ready(390,780);s=await state();clear(s);assert.equal(s.scrollLeft,0);assert.equal(s.scrollTop,0);assert.equal(s.semantic,before.semantic);
  });
  await t.test('rotation is keyboard accessible and auto restores responsive layout',async()=>{
   await page.click('[data-preview-mode=phone]');await ready(390,844);
   await page.evaluate("document.querySelector('#preview-rotate').focus()");await page.key('Enter');await ready(844,390);assert.equal((await state()).focus,'preview-rotate');
   await page.click('[data-preview-mode=auto]');assert.equal((await state()).rotateDisabled,true);
  });
  await t.test('modal remains physically reachable in a larger preview and returns focus',async()=>{
   await page.viewport(390,844);await page.click('[data-preview-mode=desktop]');await ready(1440,900);
   await page.evaluate("document.querySelector('#info-toggle').click()");
   await waitFor(()=>page.evaluate("document.querySelector('#atlas-info-dialog').open"),'information opened');
   const bounds=await page.evaluate("(()=>{const r=document.querySelector('#atlas-info-dialog').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()");
   assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.top>=0&&bounds.bottom<=bounds.height,'modal must fit physical screen in desktop preview');
   await page.key('Escape');assert.equal(await page.evaluate("document.querySelector('#atlas-info-dialog').open"),false);
   assert.equal((await state()).focus,'info-toggle');
   await page.click('[data-preview-mode=auto]');await ready(390,780);
  });
  await t.test('no JavaScript, own-asset or console failures',()=>{
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
