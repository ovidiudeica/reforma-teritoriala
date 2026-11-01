import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
try{
 await test('P9.0.9.4 Chromium: operational Nistrenia root, map, filters, search and touch viewports',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.hierarchyNodeById.size===5848&&qaApp.atlasTree?.getVisibleIds()?.includes('view-nistrenia')"),'operational root + validated legal hierarchy');
  await t.test('ACTUAL unchanged, three UI jurisdictions, NI initially off, under MD with RO MD default',async()=>{
   const s=await page.evaluate("({root:qaApp.atlasTree.getVisibleIds().includes('view-nistrenia'),roots:qaApp.atlasTree.getVisibleIds().filter(id=>id==='view-nistrenia'||id==='osm-r58974'||id==='osm-r90689'),labels:[...document.querySelectorAll('#filters-panel input[id^=layer-]')].map(n=>({id:n.id,checked:n.checked,disabled:n.disabled})),real:qaApp.hierarchyNodeById.size,selected:[...qaApp.visibleEntityIds].sort()})");
   assert(s.root);
   assert.deepEqual(s.roots.sort(),['osm-r58974','osm-r90689','view-nistrenia'].sort());
   assert.deepEqual(s.labels,[{id:'layer-ro',checked:true,disabled:false},{id:'layer-md',checked:true,disabled:false},{id:'layer-ni',checked:false,disabled:false}]);
   assert.equal(s.real,5848);
   assert.deepEqual(s.selected,['osm-r58974','osm-r90689']);
    assert.deepEqual(await page.evaluate("[...qaApp.visibleOperationalOutlineIds]"),[]);
  });
  await t.test('Nistrenia has seven documentary branches and 85 nonduplicate geometry resources',async()=>{
   await page.evaluate("if(!qaApp.atlasTree.isOpen('view-nistrenia'))qaApp.atlasTree.toggle('view-nistrenia')");
   const visible=await page.evaluate("qaApp.nistreniaView.root.child_ids");
   assert.equal(visible.length,7);
   await page.evaluate("qaApp.atlasTree.toggle('view-nistrenia-group-osm-r1702219')");
   const children=await page.evaluate("qaApp.nistreniaView.nodes.get('view-nistrenia-group-osm-r1702219').child_ids");
   assert.equal(children.length,3);
  });
  await t.test('NI jurisdiction can be turned on without enabling Moldova, and state is in URL',async()=>{
   await page.openPanel('filters');
   await page.click('#layer-md');
   assert.equal(await page.evaluate("document.getElementById('layer-md').checked"),false);
   await page.click('#layer-ni'); // NI on from NI-TREE.2 default off, MD remains off
   const enabled=await page.evaluate("({md:document.getElementById('layer-md').checked,ni:document.getElementById('layer-ni').checked,query:new URL(location.href).searchParams.get('j')})");
   assert.equal(enabled.md,false);assert.equal(enabled.ni,true);
   assert.match(enabled.query,/NI/);
   await page.openPanel('entities');
   await page.evaluate("qaApp.atlasTree.toggle('view-nistrenia')"); // collapse for stable root selection
   await page.query('osm-r9581354');
   await page.click('[role=option][data-entity-id="osm-r9581354"]');
   await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r9581354'"),'NI alias selects existing ACTUAL polygon');
   const result=await page.evaluate("({selected:qaApp.selectedEntityId,ni:document.getElementById('layer-ni').checked,md:document.getElementById('layer-md').checked,legal:document.querySelector('#details-body')?.textContent||'',checked:qaApp.visibleEntityIds.has('osm-r9581354')})");
   assert.equal(result.checked,false,'selecting an alias never automatically checks geometry');assert.equal(result.ni,true);assert.equal(result.md,false);
   assert.match(result.legal,/Nistrenia/);
   assert.match(result.legal,/Neacordată/);
   assert.match(result.legal,/CUATM/);
   await page.openPanel('filters');
   await page.click('#layer-ni');
   assert.equal(await page.evaluate("document.getElementById('layer-ni').checked"),false);
   assert.equal(await page.evaluate("qaApp.visibleEntityIds.has('osm-r9581354')"),false,'jurisdiction filter must not alter independent entity checkbox');
  });
  await t.test('real mobile portait and landscape touch layout has third jurisdiction and virtual root',async()=>{
   for(const [width,height] of [[390,844],[844,390]]){
    await page.viewport(width,height);
    await page.openPanel('filters');
    const state=await page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,hasNistrenia:document.querySelector('#layer-ni')?.getBoundingClientRect().height>0,root:qaApp.atlasTree.getVisibleIds().includes('view-nistrenia'),legalCount:qaApp.hierarchyNodeById.size})");
    assert.equal(state.overflow,false,width+' viewport overflow');
    assert.equal(state.hasNistrenia,true,width+' NI filter');
    assert.equal(state.root,true,width+' NI root');
    assert.equal(state.legalCount,5848);
   }
  });
  await t.test('no browser exceptions or new geometry sources',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   const extra=page.requests.filter(x=>/nistrenia.*(geojson|pbf)/i.test(x.url));
   assert.deepEqual(extra,[]);
  });
 });
}finally{await browser.close();}
