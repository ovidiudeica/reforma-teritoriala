import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import path from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,delay,waitFor} from './helpers/atlas-browser.mjs';import {auditEvidenceDirectory} from './helpers/atlas-evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(auditEvidenceDirectory(),'p9095-selection'),reports=[];await mkdir(out,{recursive:true});const b=await launchBrowser(root),p=await b.page();
const ni='view-nistrenia',district='view-nistrenia-group-osm-r1702216',actualRoots=['osm-r58974','osm-r90689'];
const state=function(){return {selected:qaApp.selectedEntityId,urlEntity:qaApp.captureUrlState().entityId,param:new URL(location.href).searchParams.get('e'),href:location.href,title:document.getElementById('details-title').textContent,body:document.getElementById('details-body').textContent,hidden:document.getElementById('details-panel').hidden,mobile:qaApp.atlasMobile.state,panel:qaApp.atlasPanels.state,actual:[...qaApp.visibleEntityIds].sort(),own:[...qaApp.visibleOperationalOutlineIds].sort(),shown:[...qaApp.nistreniaOutlines.layers].filter(([id,l])=>qaApp.map.hasLayer(l)).map(([id])=>id).sort(),identities:qaApp.entityById.size,hierarchy:qaApp.hierarchyNodeById.size,recent:qaApp.atlasAdvanced.state.recent,ni:document.getElementById('layer-ni').checked,action:document.getElementById('selection-visibility-action').dataset.action};};
const snap=async(label,w,h)=>{const s=await p.call(state);reports.push({label,w,h,...s});await p.screenshot(path.join(out,label+'-'+w+'x'+h+'.png'));return s;};
const selected=async(id,title)=>{await waitFor(()=>p.call(function(id){return qaApp.selectedEntityId===id&&!document.getElementById('details-panel').hidden;},id),'selected visible '+id);const s=await p.call(state);assert.equal(s.selected,id);assert.equal(s.urlEntity,id);assert.equal(s.param,id);assert.match(s.title,title);assert.equal(s.hidden,false);assert.equal(s.mobile.selected,id);assert.equal(s.identities,5848);assert.equal(s.hierarchy,5848);assert.deepEqual(s.actual,actualRoots);if(s.mobile.mobile){assert.equal(s.mobile.sheet,'peek');assert.equal(s.panel.drawer,false);}return s;};
try{await test('P9.0.9.5 parent selection lifecycle, independent geometry and canonical URL/share',{timeout:240000},async()=>{
 await p.viewport(1440,900);
 for(const [w,h]of [[1440,900],[390,844]]){
  await p.viewport(w,h);await p.navigate(b.server.url);await p.openPanel('entities');await p.click('.tree-select[data-entity-id="'+ni+'"]');const cold=await snap('cold-root',w,h);assert.equal(cold.hidden,false,'a cold NI selection must open its own card');await selected(ni,/Nistrenia/);assert.deepEqual(cold.own,[ni]);assert.match(cold.body,/Republicii Moldova/);
  await p.openPanel('entities');await p.click('.tree-select[data-entity-id="osm-r58974"]');await selected('osm-r58974',/Moldova/);await p.openPanel('entities');await p.click('.tree-select[data-entity-id="'+ni+'"]');await selected(ni,/Nistrenia/);
  await p.evaluate('history.back()');await selected('osm-r58974',/Moldova/);await p.evaluate('history.forward()');await selected(ni,/Nistrenia/);
  await p.openPanel('entities');await p.evaluate("if(!qaApp.atlasTree.isOpen('view-nistrenia'))qaApp.atlasTree.toggle('view-nistrenia')");await p.click('.tree-select[data-entity-id="'+district+'"]');const group=await selected(district,/Camenca/);assert.deepEqual(group.own,[ni],'a parent name must not check itself or descendants');assert.deepEqual(group.shown,[ni]);assert.equal(group.recent[0],district);await snap('district-name',w,h);
  await p.click('#selection-visibility-action');let s=await p.call(state);assert.deepEqual(s.own,[ni,district]);assert.deepEqual(s.actual,actualRoots);assert.deepEqual(s.shown,[ni,district]);
  await p.openPanel('filters');await p.click('#layer-ni');await p.evaluate('qaApp.atlasPanels.close({focus:false})');s=await p.call(state);assert.equal(s.ni,false);assert.deepEqual(s.own,[ni,district]);assert.deepEqual(s.shown,[]);assert.equal(s.action,'filters');const full=s.href;await p.navigate(full);s=await selected(district,/Camenca/);assert.equal(s.ni,false);assert.deepEqual(s.own,[ni,district]);assert.deepEqual(s.shown,[]);await snap('filtered-url',w,h);
  await p.openPanel('filters');await p.click('#layer-ni');await p.openPanel('entities');await p.click('#geometries-reset');await p.evaluate('qaApp.atlasPanels.close({focus:false})');s=await selected(district,/Camenca/);assert.deepEqual(s.own,[ni]);
  await p.openPanel('share');assert.equal(await p.evaluate("document.getElementById('share-entity').disabled"),false);await p.click('#share-entity');const link=await p.evaluate("document.getElementById('share-url').value");assert.equal(new URL(link).searchParams.get('v'),'2');assert.equal(new URL(link).searchParams.get('e'),district);await p.navigate(link);s=await selected(district,/Camenca/);assert.deepEqual(s.own,[ni]);await snap('entity-share',w,h);
  const outlines=await p.evaluate('[...qaApp.nistreniaOutlineFeatures.keys()]');assert.equal(outlines.length,8);
  for(const id of outlines){
   await p.openPanel('entities');await p.evaluate("if(!qaApp.atlasTree.isOpen('view-nistrenia'))qaApp.atlasTree.toggle('view-nistrenia')");
   const toggle='.tree-visibility-toggle[data-entity-id="'+id+'"]';
   // Each tree checkbox changes exactly one own outline, never the 85 ACTUAL roles.
   await p.click(toggle);let own=id===ni?[]:[ni,id].sort();s=await p.call(state);assert.deepEqual(s.own,own);assert.deepEqual(s.actual,actualRoots);
   await p.click(toggle);s=await p.call(state);assert.deepEqual(s.own,[ni]);
   await p.click('.tree-select[data-entity-id="'+id+'"]');s=await selected(id,/./);assert.deepEqual(s.own,[ni]);
   if(id!==ni){await p.click('#selection-visibility-action');own=[ni,id].sort();}
   else own=[ni];
   await p.openPanel('visible');await p.click('.atlas-advanced-row[data-entity-id="'+id+'"] [data-action-key="'+id+'|geometry"]');
   s=await p.call(state);assert.deepEqual(s.own,own.filter(x=>x!==id));assert.deepEqual(s.actual,actualRoots);
   await p.click('#advanced-undo-hide');s=await p.call(state);assert.deepEqual(s.own,own);
   await p.click('.atlas-advanced-row[data-entity-id="'+id+'"] .atlas-advanced-entity');s=await selected(id,/./);assert.deepEqual(s.own,own);
   if(id!==ni){await p.openPanel('entities');await p.click(toggle);}
  }
  await snap('eight-independent-outlines',w,h);
  await p.query('Nistrenia');await p.click('[role=option][data-entity-id="'+ni+'"]');await selected(ni,/Nistrenia/);
  await p.openPanel('visible');await p.click('.atlas-advanced-row[data-entity-id="'+ni+'"] .atlas-advanced-entity');s=await selected(ni,/Nistrenia/);assert.deepEqual(s.own,[ni]);
  await p.click('#details-close');s=await p.call(state);assert.equal(s.selected,null);assert.equal(s.param,null);assert.equal(s.hidden,true);assert.deepEqual(s.own,[ni]);assert.deepEqual(s.actual,actualRoots);await snap('cleared',w,h);
 }
 assert.deepEqual(p.errors,[]);assert.deepEqual(p.console.filter(e=>e.type==='error'||e.level==='error'),[]);
 });}finally{await writeFile(path.join(out,'report.json'),JSON.stringify({browser:b.version.Browser,reports},null,2));await b.close();}
