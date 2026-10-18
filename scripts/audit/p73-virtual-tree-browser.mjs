import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {auditEvidenceDirectory} from '../test/helpers/atlas-evidence.mjs';
import {launchBrowser,delay,waitFor} from '../test/helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),browser=await launchBrowser(root),page=await browser.page();
const output=auditEvidenceDirectory();await mkdir(output,{recursive:true});
const metrics=()=>page.call(function(){const host=document.querySelector('#hierarchy-tree'),rows=[...host.querySelectorAll('.tree-node')],h=host.getBoundingClientRect();return {visible:qaApp.atlasTree.getVisibleCount(),mounted:rows.length,dom:host.querySelectorAll('*').length,height:host.clientHeight,width:host.clientWidth,scrollWidth:host.scrollWidth,scrollTop:host.scrollTop,selected:qaApp.selectedEntityId,rows:rows.map(row=>({id:row.dataset.entityId,index:Number(row.getAttribute('aria-rowindex')),level:Number(row.getAttribute('aria-level'))})),targets:[...host.querySelectorAll('button,input')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,inViewport:r.top>=h.top&&r.bottom<=h.bottom,hit:r.top>=h.top&&r.bottom<=h.bottom?(e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)||e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))):true};})};});
const reports=[];
try{
 await test('P7.3 virtual hierarchy browser acceptance',async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url);await page.openPanel('entities');
  await t.test('default geometry intent is only Romania and Moldova',async()=>{assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),['osm-r58974','osm-r90689']);});
  await t.test('all 5848 immutable ACTUAL identities plus 1 Nistrenia UI root keep bounded DOM',async()=>{
   await page.call(function(){qaApp.atlasTree.setOpenIds([...qaApp.hierarchyNodeById.values()].filter(node=>node.child_ids.length).map(node=>node.id));});await delay(100);
   for(const fraction of [0,.1,.5,.9,1]){await page.call(function(fraction){const host=document.querySelector('#hierarchy-tree');host.scrollTop=(host.scrollHeight-host.clientHeight)*fraction;},fraction);await delay(100);const result=await metrics();reports.push(result);assert.equal(result.visible,5849);assert.equal(await page.evaluate('qaApp.hierarchyNodeById.size'),5848);assert.equal(await page.evaluate("qaApp.atlasTree.getVisibleIds().filter(id=>id==='view-nistrenia').length"),1);assert.ok(result.mounted<40);assert.ok(result.dom<350);assert.equal(result.scrollWidth,result.width);assert.equal(new Set(result.rows.map(row=>row.id)).size,result.rows.length);}
  });
  await t.test('small forward and reverse scroll preserve logical accessibility order',async()=>{
   for(const top of [0,88,176,88,44,0]){await page.call(function(top){document.querySelector('#hierarchy-tree').scrollTop=top;},top);await delay(80);const result=await metrics();assert.deepEqual(result.rows.map(row=>row.index),result.rows.map(row=>row.index).sort((a,b)=>a-b));}
  });
  await t.test('rapid phone and exact desktop transitions wait for the actual observed frame',async()=>{
   for(let i=0;i<6;i++)for(const width of [390,900]){
    await page.viewport(width,768);const state=await page.call(function(){const frame=document.querySelector('#atlas-viewport');return {dom:[frame.clientWidth,frame.clientHeight],effective:qaApp.atlasLayout.size,mobile:qaApp.atlasMobile.state.mobile};});
    assert.equal(state.effective.width,state.dom[0]);assert.equal(state.effective.height,state.dom[1]);assert.equal(state.mobile,width<900);
   }
  });
  await t.test('long names wrap with 44px targets across eight responsive viewports',async()=>{
   const id=await page.call(function(){return [...qaApp.hierarchyNodeById.values()].filter(node=>node.depth===5).sort((a,b)=>b.display_name.length-a.display_name.length)[0].id;});
   for(const [width,height] of [[360,640],[390,844],[430,932],[844,390],[768,1024],[899,768],[900,768],[1440,900]]){
    await page.viewport(width,height);await page.openPanel('entities');await page.call(function(id){qaApp.atlasTree.select(id);},id);await delay(120);const result=await metrics();reports.push({viewport:[width,height],...result});assert.ok(result.height>=44,"tree viewport must show at least one complete touch row");assert.equal(result.width,result.scrollWidth);assert.ok(result.targets.every(target=>target.width>=44&&target.height>=44&&target.hit),JSON.stringify({viewport:[width,height],badTargets:result.targets.filter(target=>target.width<44||target.height<44||!target.hit)}));
    const text=await page.call(function(id){const e=qaApp.atlasTree.getNode(id).button;const r=e.getBoundingClientRect(),host=document.querySelector('#hierarchy-tree'),h=host.getBoundingClientRect();return {height:r.height,width:e.clientWidth,scrollWidth:e.scrollWidth,whiteSpace:getComputedStyle(e).whiteSpace,fullyVisible:r.top>=h.top+host.clientTop-1&&r.bottom<=h.top+host.clientTop+host.clientHeight+1,hostHeight:host.clientHeight};},id);if(text.height<=text.hostHeight)assert.equal(text.fullyVisible,true,'selected wrapped row must remain fully visible after measurement');assert.equal(text.whiteSpace,'normal');assert.ok(text.scrollWidth<=text.width);await page.screenshot(path.join(output,'p73-'+width+'x'+height+'.png'));
   }
  });
  await t.test('unnamed identity has a human menu fallback without changing the corpus',async()=>{
   const state=await page.call(function(){const id='osm-r12104636';qaApp.atlasTree.select(id);const button=qaApp.atlasTree.getNode(id).button;return {text:button.textContent,title:button.title,original:qaApp.hierarchyNodeById.get(id).display_name,id:button.dataset.entityId};});
   assert.equal(state.text,'Entitate fără nume');assert.equal(state.title,'Entitate fără nume');assert.equal(state.original,'osm-r12104636');assert.equal(state.id,'osm-r12104636');
  });
  await t.test('native Enter Space and complete row-column keyboard commands keep independent intent',async()=>{
   await page.viewport(1440,900);await page.openPanel('entities');const before=await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometrySubtypes].sort()})');
   await page.call(function(){qaApp.atlasTree.reveal('osm-r90689');qaApp.atlasTree.getNode('osm-r90689').toggle.focus();});await page.key('Enter');assert.equal(await page.evaluate('qaApp.atlasTree.isOpen("osm-r90689")'),false);assert.equal(await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometrySubtypes].sort()})'),before);await page.key('Enter');assert.equal(await page.evaluate('qaApp.atlasTree.getVisibleCount()'),5849);
   await page.key('ArrowRight');assert.equal(await page.evaluate('document.activeElement.className'),'tree-visibility-toggle');await page.key(' ');assert.equal(await page.evaluate('qaApp.visibleEntityIds.has("osm-r90689")'),false);assert.equal(await page.evaluate('qaApp.selectedEntityId'),null);await page.key(' ');assert.equal(await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometrySubtypes].sort()})'),before);
   await page.key('ArrowRight');await page.key('Enter');assert.equal(await page.evaluate('qaApp.selectedEntityId'),'osm-r90689');assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),['osm-r58974','osm-r90689']);
   await page.key('ArrowDown');const start=await page.evaluate('Number(document.activeElement.closest(".tree-node").getAttribute("aria-rowindex"))');await page.key('PageDown');const next=await page.evaluate('Number(document.activeElement.closest(".tree-node").getAttribute("aria-rowindex"))');assert.ok(next>start);await page.key('PageUp');assert.ok(await page.evaluate('Number(document.activeElement.closest(".tree-node").getAttribute("aria-rowindex"))')<next);
   await page.key('ArrowLeft');assert.equal(await page.evaluate('document.activeElement.className'),'tree-visibility-toggle');await page.key('Home');assert.equal(await page.evaluate('document.activeElement.className'),'tree-toggle');await page.key('End');assert.ok(await page.evaluate('document.activeElement.classList.contains("tree-select")'));
   await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',modifiers:2});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',modifiers:2});assert.equal(await page.evaluate('Number(document.activeElement.closest(".tree-node").getAttribute("aria-rowindex"))'),1);
  });
  await t.test('keyboard navigation changes focus without changing selection or geometry intent',async()=>{
   await page.viewport(1440,900);await page.openPanel('entities');await page.call(function(){qaApp.atlasTree.select('osm-r90689');qaApp.atlasTree.getNode('osm-r90689').button.focus();});const before=await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort()})');
   await page.key('ArrowDown');await page.key('End');await page.key('ArrowUp');assert.equal(await page.evaluate('JSON.stringify({selected:qaApp.selectedEntityId,checked:[...qaApp.visibleEntityIds].sort()})'),before);
   await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',modifiers:2});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',modifiers:2});await delay(100);assert.equal(await page.evaluate('Number(document.activeElement.closest(".tree-node").getAttribute("aria-rowindex"))'),5849);
  });
  await t.test('focused row stays mounted when scrolling away and returns predictably',async()=>{const id=await page.evaluate('document.activeElement.dataset.entityId');await page.evaluate('document.querySelector("#hierarchy-tree").scrollTop=0');await delay(100);assert.equal(await page.evaluate('document.activeElement.dataset.entityId'),id);assert.ok((await metrics()).mounted<40);await page.key('ArrowUp');await delay(100);assert.equal(await page.evaluate('Number(document.activeElement.closest(".tree-node").getAttribute("aria-rowindex"))'),5848);});
  await t.test('no JavaScript errors or missing application resources',()=>{assert.deepEqual(page.errors,[]);assert.deepEqual(page.responses.filter(response=>response.url.startsWith(browser.server.url)&&response.status>=400),[]);});
 });
}finally{await writeFile(path.join(output,'p73-dom-report.json'),JSON.stringify(reports,null,2));await browser.close();}
