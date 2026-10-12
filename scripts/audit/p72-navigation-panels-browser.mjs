import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {tmpdir} from 'node:os';import path from 'node:path';
import {launchBrowser,waitFor,delay} from '../test/helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),browser=await launchBrowser(root),page=await browser.page();
const semantic=()=>page.evaluate("JSON.stringify(qaApp.captureUrlState(),(k,v)=>v instanceof Set?[...v].sort():['lat','lon'].includes(k)?Number(v.toFixed(5)):v)");
const snapshot=()=>page.evaluate(`(()=>{
 const frame=document.querySelector('#atlas-controls'),r=frame.getBoundingClientRect(),title=document.querySelector('#details-title'),card=document.querySelector('#details-panel');
 const buttons=[...document.querySelectorAll('#atlas-navigation-rail button')].map(e=>{const b=e.getBoundingClientRect();if(!b.width||!b.height)return null;const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {id:e.id,width:b.width,height:b.height,left:b.left,right:b.right,top:b.top,bottom:b.bottom,clear:hit===e||e.contains(hit),name:e.getAttribute('aria-label')}}).filter(Boolean);
 return {fullTitle:card.hidden||title.scrollWidth<=title.clientWidth,state:qaApp.atlasPanels.state,focus:document.activeElement.id,hidden:frame.hidden,inert:frame.inert,bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},panes:[...frame.querySelectorAll(':scope>section,#results-panel')].filter(e=>e.id!=='search-panel').map(e=>({id:e.id,hidden:e.hidden,inert:e.inert})),buttons,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,mapWidth:qaApp.map.getSize().x,mapDom:document.querySelector('#map').clientWidth};
})()`);
const placement=function(){
 const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 const map=rect(document.querySelector('#map'));
 const obstacles=['atlas-navigation-rail','details-panel','atlas-preview-toolbar'].map(id=>document.getElementById(id)).filter(e=>e&&!e.hidden).map(e=>({id:e.id,...rect(e)}));
 const controls=[...document.querySelectorAll('.leaflet-control')].map(e=>({name:e.className,...rect(e)}));
 const issues=[];
 for(const c of controls){
  if(!c.width||!c.height)continue;
  if(c.left<map.left||c.right>map.right||c.top<map.top||c.bottom>map.bottom)issues.push({control:c.name,outsideMap:true,map,rect:c});
  for(const o of obstacles)if(o.width&&o.height&&overlap(c,o))issues.push({control:c.name,obstacle:o.id,controlRect:c,obstacleRect:o});
 }
 for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++)if(controls[i].width&&controls[j].width&&overlap(controls[i],controls[j]))issues.push({betweenControls:[controls[i].name,controls[j].name]});
 return {map,controls,obstacles,issues};
};
const clear=s=>{assert.equal(s.overflow,false);assert.equal(s.fullTitle,true,'selected title truncated');assert.ok(s.buttons.every(b=>b.width>=44&&b.height>=44&&b.left>=0&&b.right<=s.width&&b.top>=0&&b.bottom<=s.height&&b.clear&&b.name),'rail targets must be named, touch-sized and unobscured');};
try{
 await test('P7.2 shared contextual navigation lifecycle',{timeout:300000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');
  await t.test('nine desktop icons and one resizable principal pane',async()=>{
   const s=await snapshot();clear(s);assert.equal(s.buttons.length,9);assert.equal(s.state.active,'entities');assert.equal(s.panes.filter(p=>!p.hidden).length,1);
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-desktop.png'));
  });
  await t.test('all eight routes preserve semantic state, one map and geometry cache',async()=>{
   await page.evaluate("window.p72Map=qaApp.map;qaApp.selectEntity('osm-r58974',{source:'map',zoom:false})");await delay(200);
   const before=await semantic(),url=await page.evaluate('location.href'),requests=page.requests.filter(x=>x.url.includes('/public/geo/actual/')).length;
   for(const key of ['entities','search','filters','visible','recent','compare','share','info']){
    if((await snapshot()).state.active===key)await page.click('[data-panel='+key+']');
    await page.click('[data-panel='+key+']');await delay(150);const s=await snapshot();clear(s);assert.equal(s.state.active,key);assert.equal(s.panes.filter(p=>!p.hidden).length,1);assert.ok(s.panes.filter(p=>p.hidden).every(p=>p.inert));
    const placement=await page.evaluate("(()=>{const c=document.querySelector('#atlas-controls').getBoundingClientRect(),p=[...document.querySelectorAll('#atlas-controls>section,#results-panel')].find(e=>!e.hidden&&e.id!=='search-panel'),r=p.getBoundingClientRect();return {inside:r.left>=c.left&&r.right<=c.right&&r.top>=c.top&&r.bottom<=c.bottom,position:getComputedStyle(p).position}})()");
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
  await t.test('advanced content keeps accessible action targets on desktop and phone',async()=>{
   await page.evaluate("qaApp.atlasAdvanced.addCompare('osm-r58974');qaApp.atlasAdvanced.addCompare('osm-r90689')");
   for(const [w,h]of [[1440,900],[390,844]]){
    await page.viewport(w,h);
    for(const key of ['visible','recent','compare']){
     await page.openPanel(key);
     const targets=await page.evaluate("([...document.querySelectorAll('#atlas-advanced-content button')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,name:e.textContent.trim()}}))");
     assert.ok(targets.length>0,'advanced content has no actions: '+key);
     assert.ok(targets.every(t=>t.width>=44&&t.height>=44&&t.name),'advanced content action below 44px at '+w+'x'+h+': '+JSON.stringify(targets));
    }
    await page.key('Escape');
   }
  });
  await t.test('mobile overlay excludes covered map and selection card from native Tab traversal',async()=>{
   const before=await semantic();
   for(const [w,h]of [[390,844],[768,1024],[844,390]]){
    await page.viewport(w,h);await page.openPanel('info');
    assert.equal(await page.evaluate("document.querySelector('#map').inert"),true);
    assert.equal(await page.evaluate("document.querySelector('#details-panel').inert"),true);
    for(let step=0;step<30;step++){
     await page.key('Tab');
     assert.equal(await page.evaluate("!!document.activeElement.closest('#map,#details-panel')"),false,'covered background receives Tab at '+w+'x'+h);
    }
    await page.key('Escape');
    assert.equal(await page.evaluate("document.querySelector('#map').inert"),false);
    assert.equal(await page.evaluate("document.querySelector('#details-panel').inert"),false);
   }
   await page.viewport(1440,900);await page.openPanel('info');
   assert.equal(await page.evaluate("document.querySelector('#map').inert||document.querySelector('#details-panel').inert"),false);
   await page.key('Escape');assert.equal(await semantic(),before);
  });
  await t.test('eight physical viewport shapes keep rail and native map controls reachable',async()=>{
   for(const [w,h]of [[360,640],[390,844],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900]]){
    await page.viewport(w,h);await delay(150);const s=await snapshot();clear(s);assert.equal(s.state.mobile,w<900);assert.equal(s.mapWidth,s.mapDom);
    const bounds=await page.evaluate("(()=>{const map=document.querySelector('#map').getBoundingClientRect(),host=document.querySelector('#atlas-main').getBoundingClientRect(),credits=document.querySelector('.leaflet-control-attribution').getBoundingClientRect();return {mapInside:map.left>=host.left&&map.right<=host.right&&map.top>=host.top&&map.bottom<=host.bottom,creditsInside:credits.left>=map.left&&credits.right<=Math.min(map.right,host.right),map:{left:map.left,right:map.right},host:{left:host.left,right:host.right},credits:{left:credits.left,right:credits.right}}})()");
    assert.ok(bounds.mapInside&&bounds.creditsInside,'map or credits clipped at '+w+'x'+h+': '+JSON.stringify(bounds));
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
     const p=await page.call(placement);assert.deepEqual(p.issues,[],'whole control rectangles overlap at '+snap+' '+w+'x'+h+': '+JSON.stringify(p.issues));
    }
   }
   await page.evaluate("qaApp.atlasMobile.setSheet('peek')");
  });
  await t.test('phone More exposes extra routes and returns focus to a visible control',async()=>{
   await page.viewport(1440,900);await page.evaluate("document.querySelector('#info-toggle').focus()");await page.viewport(390,844);await waitFor(async()=>(await snapshot()).focus==='navigation-more','responsive focus restoration');await page.click('#navigation-more');let s=await snapshot();clear(s);assert.equal(s.state.menu,true);assert.equal(s.buttons.length,9);
   await page.openPanel('info');s=await snapshot();assert.equal(s.state.active,'info');assert.equal(s.state.menu,false);assert.equal(s.focus,'drawer-close');assert.ok(s.bounds.left>=0&&s.bounds.right<=390&&s.bounds.bottom<780);
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-phone-info.png'));
   await page.key('Escape');s=await snapshot();assert.equal(s.state.active,null);assert.equal(s.focus,'navigation-more');clear(s);
   await page.openPanel('info');await page.click('#navigation-more');
   assert.equal((await snapshot()).state.active,null);assert.equal((await snapshot()).state.menu,true);
   assert.equal(await page.evaluate("document.querySelector('#map').inert&&document.querySelector('#details-panel').inert"),true);
   for(let step=0;step<30;step++){await page.key('Tab');assert.equal(await page.evaluate("!!document.activeElement.closest('#map,#details-panel')"),false,'More exposes covered background');}
   await page.key('Escape');assert.equal((await snapshot()).focus,'navigation-more');
   assert.equal(await page.evaluate("document.querySelector('#map').inert||document.querySelector('#details-panel').inert"),false);
   await page.click('#mobile-navigation');assert.equal((await snapshot()).state.active,'entities');await page.click('#drawer-close');assert.equal((await snapshot()).focus,'mobile-navigation');
  });
  await t.test('selection card exposes whole named touch targets and a usable expanded body in compact views',async()=>{
   const id=await page.evaluate("[...qaApp.entityById.values()].find(e=>e.jurisdiction==='RO'&&e.map?.bbox&&!qaApp.visibleEntityIds.has(e.id)).id");
   await page.call(function(id){qaApp.selectEntity(id,{source:'map',zoom:false});},id);
   await waitFor(()=>page.call(function(id){return qaApp.selectedEntityId===id&&!document.querySelector('#details-panel').hidden;},id),'selection card ready');
   for(const [width,height]of [[360,640],[390,844],[600,390],[640,360],[844,390],[768,1024]]){
    await page.viewport(width,height);await page.evaluate('qaApp.atlasPanels.close({focus:false})');
    let peekHeight;
    for(const snap of ['peek','half','expanded']){
     await page.call(function(snap){qaApp.atlasMobile.setSheet(snap);},snap);await delay(100);
     const state=await page.call(function(){
      const card=document.querySelector('#details-panel').getBoundingClientRect(),body=document.querySelector('#details-body');
      const targets=[...document.querySelectorAll('#details-panel .details-head button,#sheet-drag')].filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,name:e.getAttribute('aria-label')||e.textContent.trim(),width:r.width,height:r.height,inside:r.left>=card.left&&r.right<=card.right&&r.top>=card.top&&r.bottom<=card.bottom,clear:hit===e||e.contains(hit)};});
      const title=document.querySelector('#details-title');return {fullTitle:title.scrollWidth<=title.clientWidth,targets,cardHeight:card.height,bodyHidden:body.hidden,bodyHeight:document.querySelector('#details-content').clientHeight};
     });
     const p=await page.call(placement);assert.deepEqual(p.issues,[],'control overlap at '+width+'x'+height+' '+snap);
     if(snap==='peek')peekHeight=state.cardHeight;else if(height>540)assert.ok(state.cardHeight>peekHeight,'expanded state must grow beyond peek at '+width+'x'+height);
     assert.equal(state.fullTitle,true,'selected title truncated at '+width+'x'+height);assert.equal(state.targets.length,4);assert.ok(state.targets.every(t=>t.name&&t.width>=44&&t.height>=44&&t.inside&&t.clear),'card target clipped at '+width+'x'+height+' '+snap+': '+JSON.stringify(state));
     if(snap!=='peek')assert.ok(state.bodyHeight>=44&&!state.bodyHidden,'expanded body cannot expose one complete control at '+width+'x'+height+' '+snap+': '+JSON.stringify(state));
     await page.evaluate("document.querySelector('#selection-visibility-action').focus()");
     const action=await page.call(function(){const e=document.querySelector('#selection-visibility-action'),r=e.getBoundingClientRect(),c=document.querySelector('#details-content').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {focused:document.activeElement===e,inside:r.top>=c.top&&r.bottom<=c.bottom&&r.left>=c.left&&r.right<=c.right,clear:hit===e||e.contains(hit),width:r.width,height:r.height};});
     assert.ok(action.focused&&action.inside&&action.clear&&action.width>=44&&action.height>=44,'focused action clipped after snap/rotation '+width+'x'+height+' '+snap+': '+JSON.stringify(action));
    }
   }
   await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-card-tablet-expanded.png'));
  });
  await t.test('long desktop selection cards reserve complete map commands with explorer open and closed',async()=>{
   for(const [width,height]of [[900,768],[1024,768],[1440,900]])for(const opened of [true,false]){
    await page.viewport(width,height);
    if(opened)await page.openPanel('entities');else await page.evaluate('qaApp.atlasPanels.close({focus:false})');
    const p=await page.call(placement);assert.deepEqual(p.issues,[],'desktop card/control overlap '+width+'x'+height+' explorer='+opened+': '+JSON.stringify(p.issues));
    await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-desktop-card-'+width+'-'+opened+'.png'));
   }
  });
  await t.test('scale labels remain readable at every zoom without covering attribution',async()=>{
   await page.viewport(360,640);await page.evaluate('qaApp.atlasPanels.close({focus:false})');
   const view=await page.call(function(){return {center:qaApp.map.getCenter(),zoom:qaApp.map.getZoom()};});
   try{
    for(let zoom=0;zoom<=19;zoom++){
     await page.call(function(zoom){qaApp.map.setZoom(zoom,{animate:false});},zoom);await delay(100);
     const scale=await page.call(function(){const e=document.querySelector('.leaflet-control-scale-line');return {label:e.textContent,width:e.clientWidth,scroll:e.scrollWidth};});
     assert.ok(scale.label&&scale.width>0&&scale.scroll<=scale.width,'scale label overflow at zoom '+zoom+': '+JSON.stringify(scale));
     assert.deepEqual((await page.call(placement)).issues,[],'scale collision at zoom '+zoom);
    }
    await page.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-readable-scale-360.png'));
   }finally{await page.call(function(view){qaApp.map.setView(view.center,view.zoom,{animate:false});},view);}
  });
  await t.test('mobile-first bootstrap keeps Leaflet commands anchored after desktop transitions',async()=>{
   const cold=await browser.page();
   try{
    await cold.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
    await cold.navigate(browser.server.url+'/');assert.equal(await cold.evaluate('qaApp.atlasPanels.state.mobile'),true);
    for(const [width,height]of [[1440,900],[1024,768],[768,1024]]){
     await cold.viewport(width,height);await cold.evaluate('qaApp.atlasPanels.close({focus:false})');
     const p=await cold.call(placement);assert.deepEqual(p.issues,[],'mobile-first '+width+'x'+height+': '+JSON.stringify(p.issues));
    }
    await cold.screenshot(path.join(tmpdir(),'atlas-browser-evidence','p72-mobile-first-tablet.png'));
   }finally{await cold.close();}
  });
  await t.test('no own-asset, console or application failures',()=>{
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[]);
  });
 });
}finally{await browser.close();}
