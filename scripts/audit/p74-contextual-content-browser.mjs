import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {auditEvidenceDirectory} from '../test/helpers/atlas-evidence.mjs';
import {launchBrowser,delay} from '../test/helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),browser=await launchBrowser(root),page=await browser.page();
const output=auditEvidenceDirectory();await mkdir(output,{recursive:true});const reports=[];
try{
 await test('P7.4 contextual content browser acceptance',async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url);
  await t.test('search and results have one owner; clearing preserves geometry and selection',async()=>{
   await page.openPanel('search');const before=await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort()})');
   await page.call(function(){qaApp.atlasSearch.setQuery('Victoria');});assert.equal(await page.evaluate('document.querySelector("#search-panel").contains(document.querySelector("#results-panel"))'),true);
   await page.call(function(){document.querySelector('#search-clear').focus();document.querySelector('#search-clear').click();});assert.equal(await page.evaluate('qaApp.atlasSearch.state.query'),'');assert.equal(await page.evaluate('document.activeElement.id'),'entity-search');assert.equal(await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort()})'),before);
   await page.call(function(){qaApp.atlasSearch.setQuery('România');document.querySelector('#entity-search').focus();});await page.key('ArrowDown');await page.key('Enter');await delay(150);assert.equal(await page.evaluate('qaApp.selectedEntityId'),'osm-r90689');assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),['osm-r58974','osm-r90689']);
  });
  await t.test('comparison removal keeps focus in its live panel',async()=>{
   await page.call(function(){qaApp.atlasAdvanced.addCompare('osm-r90689');qaApp.atlasAdvanced.addCompare('osm-r58974');const button=[...document.querySelectorAll('#atlas-advanced-content button')].find(e=>e.textContent==='Elimină');button.focus();button.click();});
   assert.equal(await page.evaluate('document.activeElement.id'),'drawer-close');assert.equal(await page.evaluate('qaApp.atlasAdvanced.state.pair.length'),1);await page.key('Escape');assert.equal(await page.evaluate('document.activeElement.id'),'advanced-compare');
  });
  await t.test('comparison columns follow the resized panel, not the desktop viewport',async()=>{
   await page.call(function(){qaApp.atlasAdvanced.addCompare('osm-r90689');});
   const columns=()=>page.evaluate('getComputedStyle(document.querySelector(".atlas-comparison-cards")).gridTemplateColumns.split(" ").length');
   assert.equal(await columns(),1);await page.call(function(){document.querySelector('#explorer-resizer').focus();});await page.key('End');await delay(100);assert.equal(await columns(),2);await page.key('Home');await delay(100);assert.equal(await columns(),1);await page.call(function(){qaApp.atlasExplorerShell.setWidth(340);});
  });
  await t.test('geometry actions retain focus when their visible caption changes',async()=>{
   const before=await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometrySubtypes].sort()})');
   await page.call(function(){document.querySelector('.atlas-comparison-actions button').focus();});const id=await page.evaluate('document.activeElement.closest(".atlas-comparison-card").dataset.entityId');
   for(let i=0;i<2;i++){await page.key('Enter');assert.equal(await page.evaluate('document.activeElement.closest(".atlas-comparison-card")?.dataset.entityId'),id);assert.match(await page.evaluate('document.activeElement.getAttribute("aria-label")'),/geometria/);}
   assert.equal(await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometrySubtypes].sort()})'),before);
  });
  await t.test('progressive layer pagination keeps focus as its remaining count changes',async()=>{
   const original=await page.evaluate('[...qaApp.visibleEntityIds]');
   try{
    await page.call(function(){qaApp.visibleEntityIds.clear();for(const id of [...qaApp.entityById.keys()].slice(0,151))qaApp.visibleEntityIds.add(id);qaApp.atlasAdvanced.open('visible');const button=[...document.querySelectorAll('#atlas-advanced-content button')].find(e=>e.textContent.startsWith('Mai multe'));button.focus();});
    const beforePage=await page.call(function(){const button=document.activeElement,match=button.textContent.match(/^Mai multe \\((\\d+) rămase\\)$/);return {rows:document.querySelectorAll('.atlas-advanced-row').length,remaining:match?Number(match[1]):null};});
    assert.equal(beforePage.rows,50);assert.ok(Number.isInteger(beforePage.remaining)&&beforePage.remaining>0);await page.key('Enter');
    const afterPage=await page.call(function(){const button=document.activeElement,match=button.textContent.match(/^Mai multe \\((\\d+) rămase\\)$/);return {rows:document.querySelectorAll('.atlas-advanced-row').length,remaining:match?Number(match[1]):null};});
    assert.equal(afterPage.rows,100);assert.equal(afterPage.remaining,beforePage.remaining-(afterPage.rows-beforePage.rows));assert.equal(afterPage.rows+afterPage.remaining,beforePage.rows+beforePage.remaining);assert.equal(await page.evaluate('qaApp.visibleEntityIds.size'),151);
   }finally{await page.call(function(ids){qaApp.visibleEntityIds.clear();for(const id of ids)qaApp.visibleEntityIds.add(id);qaApp.atlasAdvanced.refresh();},original);await page.key('Escape');}
  });
  await t.test('view/entity/copy/email links are independent of semantic state',async()=>{
   await page.openPanel('share');const before=await page.evaluate('JSON.stringify(qaApp.captureUrlState())'),historyBefore=await page.evaluate('JSON.stringify({href:location.href,length:history.length})');
   await page.call(function(){globalThis.qaCopied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{globalThis.qaCopied=value;}}});document.querySelector('#share-entity').click();});
   await page.call(function(){document.querySelector('#copy-link').click();});await delay(50);const data=await page.call(function(){return {copied:qaCopied,email:document.querySelector('#share-email').href,manual:document.querySelector('#share-url').value,open:document.querySelector('#share-open').href};});
   assert.equal(new URL(data.copied).searchParams.get('e'),'osm-r90689');assert.deepEqual([...new URL(data.copied).searchParams.keys()],['v','e']);assert.equal(data.copied,data.manual);assert.equal(data.open,data.copied);assert.ok(new URL(data.email).searchParams.get('body').includes(data.copied));assert.equal(await page.evaluate('JSON.stringify(qaApp.captureUrlState())'),before);assert.equal(await page.evaluate('JSON.stringify({href:location.href,length:history.length})'),historyBefore);
   await page.call(function(){document.querySelector('#share-view').click();});assert.equal(await page.evaluate('document.querySelector("#share-url").value'),await page.evaluate('qaApp.atlasUrl.shareUrl()'));
   for(let i=0;i<2;i++){await page.click('#basemap-toggle');const live=await page.evaluate('qaApp.atlasUrl.shareUrl()');assert.equal(await page.evaluate('document.querySelector("#share-url").value'),live);assert.equal(await page.evaluate('document.querySelector("#share-open").href'),live);assert.equal(new URL(await page.evaluate('document.querySelector("#share-email").href')).searchParams.get('body').split('\r\n').at(-1),live);}
   assert.equal(await page.evaluate('JSON.stringify(qaApp.captureUrlState())'),before);
  });
  await t.test('legend, methodology and provenance remain available on demand',async()=>{
   for(const [width,height] of [[1440,900],[390,844]]){
    await page.viewport(width,height);await page.openPanel('info');await page.call(function(){for(const details of document.querySelectorAll('#atlas-info-dialog details'))details.open=true;const legend=document.querySelector('#atlas-legend');legend.scrollIntoView({block:'start'});});
    const info=await page.call(function(){return {legend:document.querySelectorAll('#atlas-legend .atlas-legend li').length,provenance:document.querySelector('#global-provenance').textContent,overflow:document.querySelector('#atlas-info-dialog').scrollWidth>document.querySelector('#atlas-info-dialog').clientWidth};});assert.ok(info.legend>0);assert.ok(info.provenance.length>50);assert.equal(info.overflow,false);await page.screenshot(path.join(output,'p74-info-expanded-'+width+'.png'));
   }
  });
  await t.test('expanded filter subtypes remain reachable and preserve checked geometry',async()=>{
   await page.viewport(390,844);await page.openPanel('filters');const before=await page.evaluate('JSON.stringify([...qaApp.visibleEntityIds].sort())');
   await page.call(function(){for(const details of document.querySelectorAll('#filters-panel details'))details.open=true;});
   const target=await page.call(function(){const e=document.querySelector('#filters-panel input[data-kind="geometry-subtype"]');e.scrollIntoView({block:'center'});e.focus();return e.checked;});
   await page.key(' ');assert.equal(await page.evaluate('document.querySelector("#filters-panel input[data-kind=geometry-subtype]").checked'),!target);assert.equal(await page.evaluate('JSON.stringify([...qaApp.visibleEntityIds].sort())'),before);await page.key(' ');
   const hits=await page.call(function(){return [...document.querySelectorAll('#filters-panel input,#filters-panel summary,#filters-panel button')].filter(e=>!e.disabled&&e.checkVisibility()).map(e=>{e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:e.getAttribute('aria-label')||e.textContent,width:r.width,height:r.height,hit:e===hit||e.contains(hit)};});});
   assert.ok(hits.every(e=>e.width>=44&&e.height>=44&&e.hit),JSON.stringify(hits.filter(e=>!e.hit||e.width<44||e.height<44)));reports.push({expandedFilterHits:hits});
   await page.call(function(){document.querySelector('#filters-panel').scrollTop=0;});
  });
  await t.test('panels have touch targets, bounded scroll and responsive comparison columns',async()=>{
   for(const [width,height] of [[360,640],[390,844],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900],[640,360]]){
    await page.viewport(width,height);
    for(const panel of ['search','filters','visible','recent','compare','share','info']){
     await page.openPanel(panel);if(panel==='search')await page.call(function(){qaApp.atlasSearch.setQuery('Victoria');});await delay(40);
     if(panel==='search'){
      const fit=await page.call(function(){qaApp.atlasSearch.moveActive(1);const host=document.querySelector('#search-results'),row=host.querySelector('.search-result'),r=row.getBoundingClientRect(),h=host.getBoundingClientRect();return {height:host.clientHeight,rowHeight:r.height,whole:r.top>=h.top&&r.bottom<=h.bottom};});
      assert.ok(fit.height>=fit.rowHeight&&fit.whole,'search must show a complete wrapped result: '+JSON.stringify({width,height,fit}));
     }
     const result=await page.call(function(panel){const host=document.querySelector('#atlas-controls'),r=host.getBoundingClientRect();const targets=[...host.querySelectorAll('button,input,summary,a[href]')].filter(e=>!e.disabled&&!e.closest('[hidden],[inert]')&&e.checkVisibility()&&e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();let top=r.top,bottom=r.bottom;for(let parent=e.parentElement;parent&&parent!==host;parent=parent.parentElement){if(/auto|scroll|hidden/.test(getComputedStyle(parent).overflowY)){const clip=parent.getBoundingClientRect();top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}}const inside=b.top>=top&&b.bottom<=bottom&&b.left>=r.left&&b.right<=r.right;return {label:e.getAttribute('aria-label')||e.textContent,width:b.width,height:b.height,inside,hit:!inside||e===document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)||e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};});return {panel,width:host.clientWidth,scrollWidth:host.scrollWidth,targets,columns:panel==='compare'?getComputedStyle(document.querySelector('.atlas-comparison-cards')).gridTemplateColumns:null};},panel);
     reports.push({viewport:[width,height],...result});assert.ok(result.scrollWidth<=result.width+1,'panel horizontal overflow');assert.ok(result.targets.every(e=>e.width>=44&&e.height>=44),JSON.stringify(result.targets.filter(e=>e.width<44||e.height<44)));assert.ok(result.targets.every(e=>e.hit),'covered controls');
     await page.screenshot(path.join(output,'p74-'+width+'x'+height+'-'+panel+'.png'));
     if(panel==='search'){
      const empty=await page.call(function(){document.querySelector('#search-clear').click();const host=document.querySelector('#results-panel');host.scrollTop=host.scrollHeight;const h=host.getBoundingClientRect(),r=document.querySelector('#search-empty').getBoundingClientRect();return {visible:!document.querySelector('#search-empty').hidden,reachable:r.bottom<=h.bottom+1,width:host.clientWidth,scrollWidth:host.scrollWidth};});assert.ok(empty.visible&&empty.reachable&&empty.scrollWidth<=empty.width,'empty search instructions must remain reachable');
     }
    }
   }
  });
  await t.test('search and share survive preview modes, rotation and return to automatic layout',async()=>{
   const before=await page.evaluate('JSON.stringify(qaApp.captureUrlState(),(k,v)=>v instanceof Set?[...v].sort():["lat","lon"].includes(k)?Number(v.toFixed(5)):v)');
   for(const [width,height] of [[390,844],[844,390],[1440,900]]){
    await page.call(function(){qaApp.atlasPreview.setMode('auto');});await page.viewport(width,height);
    for(const mode of ['desktop','tablet','phone']){
     await page.call(function(mode){qaApp.atlasPreview.setMode(mode);},mode);await delay(180);
     for(let rotation=0;rotation<2;rotation++){
      if(rotation){await page.call(function(){document.querySelector('#preview-rotate').click();});await delay(180);}
      for(const panel of ['search','share']){
       await page.openPanel(panel);if(panel==='search')await page.call(function(){qaApp.atlasSearch.setQuery('Victoria');});
       const fit=await page.call(function(panel){const host=document.querySelector('#atlas-controls'),e=document.querySelector(panel==='search'?'#search-clear':'#copy-link');e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,hit:hit===e||e.contains(hit),overflow:host.scrollWidth>host.clientWidth};},panel);
       assert.ok(fit.width>=44&&fit.height>=44&&fit.hit&&!fit.overflow,JSON.stringify({width,height,mode,rotation,panel,fit}));reports.push({preview:{width,height,mode,rotation,panel},...fit});
       if(panel==='share')await page.screenshot(path.join(output,'p74-preview-'+width+'-'+mode+'-'+rotation+'.png'));
      }
     }
    }
   }
   await page.call(function(){qaApp.atlasPreview.setMode('auto');});
   assert.equal(await page.evaluate('JSON.stringify(qaApp.captureUrlState(),(k,v)=>v instanceof Set?[...v].sort():["lat","lon"].includes(k)?Number(v.toFixed(5)):v)'),before);
  });
  await t.test('no JavaScript errors or missing application resources',()=>{assert.deepEqual(page.errors,[]);assert.deepEqual(page.responses.filter(r=>r.url.startsWith(browser.server.url)&&r.status>=400),[]);});
 });
}finally{await writeFile(path.join(output,'p74-dom-report.json'),JSON.stringify(reports,null,2));await browser.close();}
