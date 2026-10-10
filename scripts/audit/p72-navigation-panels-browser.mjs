import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {tmpdir} from 'node:os';import path from 'node:path';
import {launchBrowser,waitFor,delay} from '../test/helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),browser=await launchBrowser(root),page=await browser.page();
const semantic=()=>page.evaluate("JSON.stringify(qaApp.captureUrlState(),(k,v)=>v instanceof Set?[...v].sort():['lat','lon'].includes(k)?Number(v.toFixed(5)):v)");
const snapshot=()=>page.evaluate(`(()=>{
 const frame=document.querySelector('#atlas-controls'),r=frame.getBoundingClientRect();
 const buttons=[...document.querySelectorAll('#atlas-navigation-rail button')].map(e=>{const b=e.getBoundingClientRect();if(!b.width||!b.height)return null;const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {id:e.id,width:b.width,height:b.height,left:b.left,right:b.right,top:b.top,bottom:b.bottom,clear:hit===e||e.contains(hit),name:e.getAttribute('aria-label')}}).filter(Boolean);
 return {state:qaApp.atlasPanels.state,focus:document.activeElement.id,hidden:frame.hidden,inert:frame.inert,bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},panes:[...frame.querySelectorAll(':scope>section')].filter(e=>e.id!=='search-panel').map(e=>({id:e.id,hidden:e.hidden,inert:e.inert})),buttons,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,mapWidth:qaApp.map.getSize().x,mapDom:document.querySelector('#map').clientWidth};
})()`);
const clear=s=>{assert.equal(s.overflow,false);assert.ok(s.buttons.every(b=>b.width>=44&&b.height>=44&&b.left>=0&&b.right<=s.width&&b.top>=0&&b.bottom<=s.height&&b.clear&&b.name),'rail targets must be named, touch-sized and unobscured');};
try{
 await test('P7.2 shared contextual navigation lifecycle',{timeout:300000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');
  await t.test('eight desktop icons and one resizable principal pane',async()=>{
   const s=await snapshot();clear(s);assert.equal(s.buttons.length,8);assert.equal(s.state.active,'entities');assert.equal(s.panes.filter(p=>!p.hidden).length,1);
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-desktop.png'));
  });
  await t.test('all eight routes preserve semantic state, one map and geometry cache',async()=>{
   await page.evaluate("window.p72Map=qaApp.map;qaApp.selectEntity('osm-r58974',{source:'map',zoom:false})");await delay(200);
   const before=await semantic(),url=await page.evaluate('location.href'),requests=page.requests.filter(x=>x.url.includes('/public/geo/actual/')).length;
   for(const key of ['entities','search','filters','visible','recent','compare','share','info']){
    if((await snapshot()).state.active===key)await page.click('[data-panel='+key+']');
    await page.click('[data-panel='+key+']');await delay(150);const s=await snapshot();clear(s);assert.equal(s.state.active,key);assert.equal(s.panes.filter(p=>!p.hidden).length,1);assert.ok(s.panes.filter(p=>p.hidden).every(p=>p.inert));
    const placement=await page.evaluate("(()=>{const c=document.querySelector('#atlas-controls').getBoundingClientRect(),p=[...document.querySelectorAll('#atlas-controls>section')].find(e=>!e.hidden&&e.id!=='search-panel'),r=p.getBoundingClientRect();return {inside:r.left>=c.left&&r.right<=c.right&&r.top>=c.top&&r.bottom<=c.bottom,position:getComputedStyle(p).position}})()");
    assert.ok(placement.inside,'content escapes shared pane: '+key);assert.equal(placement.position,'static');

    assert.equal(await semantic(),before);assert.equal(await page.evaluate('location.href'),url);assert.equal(await page.evaluate('qaApp.map===window.p72Map'),true);
    await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-panel-'+key+'.png'));
   }
   assert.equal(page.requests.filter(x=>x.url.includes('/public/geo/actual/')).length,requests);
   await page.key('Escape');assert.equal((await snapshot()).state.active,null);assert.equal((await snapshot()).focus,'info-toggle');assert.equal(await semantic(),before);
  });
  await t.test('native keyboard search and Escape restore a reachable origin',async()=>{
   await page.evaluate("document.querySelector('#mobile-search').focus()");await page.key('Enter');assert.equal((await snapshot()).state.active,'search');assert.equal((await snapshot()).focus,'entity-search');
   await page.key('Escape');assert.equal((await snapshot()).state.active,null);assert.equal((await snapshot()).focus,'mobile-search');
  });
  await t.test('eight physical viewport shapes keep rail and native map controls reachable',async()=>{
   for(const [w,h]of [[360,640],[390,844],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900]]){
    await page.viewport(w,h);await delay(150);const s=await snapshot();clear(s);assert.equal(s.state.mobile,w<900);assert.equal(s.mapWidth,s.mapDom);
    const hits=await page.evaluate("([...document.querySelectorAll('.leaflet-control-zoom a')].map(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {clear:h===e||e.contains(h),width:r.width,height:r.height}}))");assert.ok(hits.every(x=>x.clear&&x.width>=44&&x.height>=44),'native map controls obscured at '+w+'x'+h);
    await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-auto-'+w+'x'+h+'.png'));
   }
  });
  await t.test('selection sheets keep all four native map controls reachable at every mobile snap',async()=>{
   for(const [w,h]of [[360,640],[390,844],[430,932],[844,390],[768,1024],[899,768]]){
    await page.viewport(w,h);await page.evaluate("qaApp.atlasPanels.close({focus:false})");
    for(const snap of ['peek','half','expanded']){
     await page.evaluate("qaApp.atlasMobile.setSheet("+JSON.stringify(snap)+")");await delay(100);
     const clear=await page.evaluate("([...document.querySelectorAll('.leaflet-control-zoom>a,.leaflet-control-zoom>button')].every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit)}))");
     assert.equal(clear,true,'native controls covered by '+snap+' sheet at '+w+'x'+h);
    }
   }
   await page.evaluate("qaApp.atlasMobile.setSheet('peek')");
  });
  await t.test('phone More exposes extra routes and returns focus to a visible control',async()=>{
   await page.viewport(1440,900);await page.evaluate("document.querySelector('#info-toggle').focus()");await page.viewport(390,844);assert.equal((await snapshot()).focus,'navigation-more');await page.click('#navigation-more');let s=await snapshot();clear(s);assert.equal(s.state.menu,true);assert.equal(s.buttons.length,9);
   await page.openPanel('info');s=await snapshot();assert.equal(s.state.active,'info');assert.equal(s.state.menu,false);assert.equal(s.focus,'drawer-close');assert.ok(s.bounds.left>=0&&s.bounds.right<=390&&s.bounds.bottom<780);
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-phone-info.png'));
   await page.key('Escape');s=await snapshot();assert.equal(s.state.active,null);assert.equal(s.focus,'navigation-more');clear(s);
   await page.click('#mobile-navigation');assert.equal((await snapshot()).state.active,'entities');await page.click('#drawer-close');assert.equal((await snapshot()).focus,'mobile-navigation');
  });
  await t.test('no own-asset, console or application failures',()=>{
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
