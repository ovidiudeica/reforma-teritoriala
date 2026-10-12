import test from 'node:test';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,delay,waitFor} from '../test/helpers/atlas-browser.mjs';
import {auditEvidenceDirectory} from '../test/helpers/atlas-evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=auditEvidenceDirectory();
await mkdir(output,{recursive:true});
const browser=await launchBrowser(root),page=await browser.page(),reports=[];
const shapes=[[360,640],[390,844],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900],[640,360]];
const semantic=()=>page.call(function(){return JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometrySubtypes].sort(),raster:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),center:qaApp.map.getCenter(),zoom:qaApp.map.getZoom(),url:location.href});});
const geometry=function(){
 const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 const map=rect(document.querySelector('#map')),group=rect(document.querySelector('.leaflet-control-zoom'));
 const controls=[...document.querySelector('.leaflet-control-zoom').children].map(e=>{const r=rect(e),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {id:e.id||e.className,...r,hit:e===hit||e.contains(hit),name:e.getAttribute('aria-label')};});
 const obstacles=['atlas-navigation-rail','details-panel','atlas-preview-toolbar'].map(id=>document.getElementById(id)).filter(e=>!e.hidden).map(e=>({id:e.id,...rect(e)}));
 const annotations=[...document.querySelectorAll('.leaflet-control-scale,.leaflet-control-attribution')].map(e=>({name:e.className,...rect(e)}));
 const issues=[];for(const c of [group,...annotations]){if(c.left<map.left||c.right>map.right||c.top<map.top||c.bottom>map.bottom)issues.push({outside:c});for(const o of obstacles)if(overlaps(c,o))issues.push({control:c,obstacle:o});}
 for(let i=0;i<annotations.length;i++)if(overlaps(group,annotations[i]))issues.push({annotation:annotations[i]});
 return {map,group,controls,annotations,issues,mobile:qaApp.atlasLayout.media.matches,logical:qaApp.atlasLayout.size};
};
try{
 await test('P7.5 modules and adaptive single-owner Leaflet commands',{timeout:300000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');
  await t.test('one named module trigger uses the shared panel and native Escape return',async()=>{
   const before=await semantic();await page.call(function(){window.p75Map=qaApp.map;document.querySelector('#modules-toggle').focus();});await page.key('Enter');
   assert.equal(await page.evaluate('qaApp.atlasPanels.state.active'),'modules');assert.equal(await page.evaluate('document.activeElement.id'),'drawer-close');
   const state=await page.call(function(){return {headers:document.querySelectorAll('header [data-panel=modules]').length,oldHeaderButtons:document.querySelectorAll('header [data-mode]').length,modes:[...document.querySelectorAll('#modules-panel [data-mode]')].map(e=>({id:e.dataset.mode,disabled:e.disabled,pressed:e.getAttribute('aria-pressed'),described:!!document.getElementById(e.getAttribute('aria-describedby'))})),panes:[...document.querySelectorAll('#atlas-controls>section,#results-panel')].filter(e=>e.id!=='search-panel'&&!e.hidden).map(e=>e.id)};});
   assert.equal(state.headers,1);assert.equal(state.oldHeaderButtons,0);assert.deepEqual(state.panes,['modules-panel']);assert.deepEqual(state.modes.map(e=>[e.id,e.disabled,e.pressed]),[['actual',false,'true'],['istoric',true,'false'],['propuneri',true,'false']]);assert.ok(state.modes.every(e=>e.described));
   assert.equal(await semantic(),before);await page.key('Escape');assert.equal(await page.evaluate('document.activeElement.id'),'modules-toggle');assert.equal(await page.evaluate('qaApp.atlasPanels.state.active'),null);
  });
  await t.test('module availability and named targets are usable in every native shape',async()=>{
   const before=await semantic(),requests=page.requests.filter(r=>r.url.includes('/public/geo/actual/')).length;
   for(const [width,height] of shapes){await page.viewport(width,height);await page.openPanel('modules');
    const state=await page.call(function(){const trigger=document.querySelector('#modules-toggle'),r=trigger.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {trigger:{width:r.width,height:r.height,hit:trigger===hit||trigger.contains(hit),right:r.right,bottom:r.bottom,headerBottom:document.querySelector('header').getBoundingClientRect().bottom},overflow:document.documentElement.scrollWidth>innerWidth,panelOverflow:document.querySelector('#modules-panel').scrollWidth>document.querySelector('#modules-panel').clientWidth,targets:[...document.querySelectorAll('#modules-panel button')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,disabled:e.disabled}))};});
    assert.ok(state.trigger.width>=44&&state.trigger.height>=44&&state.trigger.hit&&state.trigger.right<=width&&state.trigger.bottom<=state.trigger.headerBottom);assert.equal(state.overflow,false);assert.equal(state.panelOverflow,false);assert.ok(state.targets.every(e=>e.width>=44&&e.height>=44));
    reports.push({modules:{width,height},...state});await page.screenshot(path.join(output,'p75-'+width+'x'+height+'-modules.png'));await page.key('Escape');assert.equal(await page.evaluate('document.activeElement.id'),'modules-toggle');
   }
   assert.equal(await semantic(),before);assert.equal(page.requests.filter(r=>r.url.includes('/public/geo/actual/')).length,requests);assert.equal(await page.evaluate('qaApp.map===window.p75Map'),true);
  });
  await t.test('ACTUAL selection closes the menu without mutating the atlas or URL',async()=>{const before=await semantic();await page.openPanel('modules');await page.call(function(){document.querySelector('[data-mode=actual]').focus();});await page.key('Enter');assert.equal(await page.evaluate('qaApp.atlasPanels.state.active'),null);assert.equal(await page.evaluate('document.activeElement.id'),'modules-toggle');assert.equal(await semantic(),before);});
  await t.test('adaptive corners reserve commands independently of all three card states',async()=>{
   await page.call(function(){qaApp.selectEntity('osm-r9846233',{source:'map',zoom:false});});await delay(150);
   for(const [width,height] of shapes){await page.viewport(width,height);await page.call(function(){qaApp.atlasPanels.close({focus:false});});
    for(const snap of ['peek','half','expanded']){await page.call(function(snap){qaApp.atlasMobile.setSheet(snap);},snap);await delay(70);const state=await page.call(geometry);
     assert.deepEqual(state.issues,[],JSON.stringify({width,height,snap,issues:state.issues}));assert.equal(state.controls.length,5);assert.ok(state.controls.every(e=>e.width>=44&&e.height>=44&&e.hit&&e.name));assert.ok(state.controls[0].id.includes('zoom-in'));assert.ok(state.controls[1].id.includes('zoom-out'));assert.equal(state.controls[2].id,'map-home');assert.equal(state.controls[3].id,'basemap-toggle');assert.equal(state.controls[4].id,'map-geometries-reset');
     if(state.mobile){assert.ok(Math.abs(state.group.left-state.map.left-10)<=1&&Math.abs(state.group.top-state.map.top-10)<=1);}else{assert.ok(Math.abs(state.map.right-state.group.right-10)<=1&&Math.abs(state.map.bottom-state.group.bottom-10)<=1);}
     reports.push({commands:{width,height,snap},...state});if(snap==='expanded')await page.screenshot(path.join(output,'p75-'+width+'x'+height+'-commands.png'));
    }
   }
  });
  await t.test('desktop commands remain separate from open or resized contextual panes',async()=>{
   for(const [width,height] of [[900,768],[1440,900]]){await page.viewport(width,height);for(const panel of ['entities','search','filters','visible','recent','compare','share','info','modules']){await page.openPanel(panel);const state=await page.call(geometry);assert.deepEqual(state.issues,[]);assert.ok(state.controls.every(e=>e.hit));const fit=await page.call(function(){const a=document.querySelector('#atlas-controls').getBoundingClientRect(),b=document.querySelector('.leaflet-control-zoom').getBoundingClientRect();return a.right<=b.left;});assert.ok(fit);reports.push({desktopPanel:{width,height,panel},...state});}await page.key('Escape');}
  });
  await t.test('repeated mobile desktop and preview rotation preserve the same command nodes',async()=>{
   await page.call(function(){window.p75Commands=[...document.querySelector('.leaflet-control-zoom').children];qaApp.atlasPanels.close({focus:false});document.querySelector('#map-home').focus();});const before=await semantic();
   for(const [width,height] of [[390,844],[1440,900],[768,1024],[844,390],[900,768],[360,640],[1440,900]]){await page.viewport(width,height);await page.call(function(){qaApp.atlasPanels.close({focus:false});});const state=await page.call(geometry);assert.deepEqual(state.issues,[]);assert.ok(state.controls.every(e=>e.hit));assert.equal(await page.evaluate("window.p75Commands.every((e,i)=>e===document.querySelector('.leaflet-control-zoom').children[i])"),true);assert.equal(await page.evaluate('document.activeElement.id'),'map-home');assert.equal(await semantic(),before);}
   for(const mode of ['phone','desktop','tablet']){await page.call(function(mode){qaApp.atlasPreview.setMode(mode)},mode);await delay(160);for(let rotated=0;rotated<2;rotated++){if(rotated){await page.click('#preview-rotate');await delay(120);}await page.call(function(){qaApp.atlasPanels.close({focus:false});});const state=await page.call(geometry);assert.deepEqual(state.issues,[]);assert.equal(await semantic(),before);reports.push({preview:{mode,rotated},...state});await page.screenshot(path.join(output,'p75-preview-'+mode+'-'+rotated+'.png'));}}
   await page.call(function(){qaApp.atlasPreview.setMode('auto');});await delay(160);assert.equal(await semantic(),before);
  });
  await t.test('all commands remain physically reachable through native Tab in oversized previews',async()=>{
   for(const [width,height] of [[390,844],[844,390],[1440,900]]){
    await page.call(function(){qaApp.atlasPreview.setMode('auto');});await page.viewport(width,height);const before=await semantic();
    for(const mode of ['desktop','tablet','phone']){await page.call(function(mode){qaApp.atlasPreview.setMode(mode)},mode);await delay(160);
     for(let rotation=0;rotation<2;rotation++){if(rotation){await page.click('#preview-rotate');await delay(120);}await page.call(function(){qaApp.atlasPanels.close({focus:false});document.querySelector('.leaflet-control-zoom-in').focus();});
      for(let index=0;index<5;index++){if(index)await page.key('Tab');const hit=await page.call(function(index){const target=document.querySelector('.leaflet-control-zoom').children[index],r=target.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {focused:document.activeElement===target,hit:target===hit||target.contains(hit),width:r.width,height:r.height,x:r.x+r.width/2,y:r.y+r.height/2};},index);assert.ok(hit.focused&&hit.hit&&hit.width>=44&&hit.height>=44&&hit.x>=0&&hit.x<=width&&hit.y>=0&&hit.y<=height,JSON.stringify({width,height,mode,rotation,index,hit}));}
      assert.equal(await semantic(),before);reports.push({physicalPreview:{width,height,mode,rotation},commands:5,nativeTab:'PASS'});await page.screenshot(path.join(output,'p75-physical-preview-'+width+'-'+mode+'-'+rotation+'.png'));
     }
    }
    await page.call(function(){qaApp.atlasPreview.setMode('auto');});await delay(160);assert.equal(await semantic(),before);
   }
  });
  await t.test('no JavaScript errors or missing own resources',async()=>{assert.deepEqual(page.errors,[]);assert.deepEqual(page.console.filter(e=>e.type==='error'),[]);assert.deepEqual(page.responses.filter(e=>e.status>=400&&e.url.startsWith(browser.server.url)),[]);});
 });
}finally{await writeFile(path.join(output,'p75-dom-report.json'),JSON.stringify(reports,null,2));await browser.close();}
