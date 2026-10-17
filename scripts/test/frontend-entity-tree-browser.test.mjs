import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
import {formatEntityName} from '../../atlas-name-format.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const browser=await launchBrowser(root);
const page=await browser.page();
const county='osm-r91733'; // Real released JUDEȚUL CLUJ identity.
const roots=['osm-r58974','osm-r90689'].sort();
const cb='.tree-visibility-toggle[data-entity-id="'+county+'"]';
try{
 await test('P5.2.1 real Chrome: default roots, per-ID geometry, URL/history and seven viewports',{timeout:180000},async t=>{
  await page.viewport(1440,900);
  await page.navigate(browser.server.url);
  await waitFor(()=>page.evaluate("qaApp.entityById.size===5848&&document.querySelectorAll('.tree-select').length>0"),'released entities and tree');
  await t.test('only RO/MD checked; name-only rows and no selection',async()=>{
   const s=await page.evaluate("({ids:[...qaApp.visibleEntityIds].sort(),checked:[...document.querySelectorAll('#hierarchy-tree .tree-visibility-toggle')].filter(e=>e.checked).map(e=>e.dataset.entityId).sort(),selected:qaApp.selectedEntityId,card:document.querySelector('#details-panel').hidden,labels:document.querySelectorAll('#hierarchy-tree .tree-role,#hierarchy-tree .tree-code,#hierarchy-tree .tree-identity').length,rendered:document.querySelectorAll('.tree-select').length})");
   assert.deepEqual(s.ids,roots);assert.deepEqual(s.checked,roots);
   assert.equal(s.selected,null);assert.equal(s.card,true);assert.equal(s.labels,0);assert.ok(s.rendered<100);
  });
  await t.test('hidden name selection keeps geometry unchecked and official card intact',async()=>{
   await page.selectQuery(county);
   const s=await page.evaluate('({id:qaApp.selectedEntityId,selected:document.querySelector(".tree-select[aria-pressed=true]")?.dataset.entityId,name:document.querySelector(".tree-select[data-entity-id=\\"'+county+'\\"] .tree-name")?.textContent,check:document.querySelector('+JSON.stringify(cb)+')?.checked,hidden:document.querySelector("#selection-visibility").textContent,card:document.querySelector("#details-panel").hidden,roots:[...qaApp.visibleEntityIds].sort()})');
   assert.equal(s.id,county);assert.equal(s.selected,county);assert.equal(s.name,'Cluj');assert.equal(s.check,false);
   assert.match(s.hidden,/ascuns/i);assert.equal(s.card,false);assert.deepEqual(s.roots,roots);
  });
  await t.test('checkbox toggles only its own geometry and URL x; Back/Forward restores it',async()=>{
   await page.click(cb);
   await waitFor(()=>page.evaluate('qaApp.visibleEntityIds.has('+JSON.stringify(county)+')'),'county visible');
   assert.equal(await page.evaluate('document.querySelector('+JSON.stringify(cb)+').checked'),true);
   assert.equal(await page.evaluate("new URL(location.href).searchParams.get('x')"),county);
   assert.deepEqual(await page.evaluate('[...qaApp.visibleEntityIds].sort()'),[...roots,county].sort());
   await page.evaluate('history.back()');
   await waitFor(()=>page.evaluate('!qaApp.visibleEntityIds.has('+JSON.stringify(county)+')'),'history hides county');
   assert.equal(await page.evaluate('document.querySelector('+JSON.stringify(cb)+').checked'),false);
   await page.evaluate('history.forward()');
   await waitFor(()=>page.evaluate('qaApp.visibleEntityIds.has('+JSON.stringify(county)+')'),'history restores county');
   assert.equal(await page.evaluate('document.querySelector('+JSON.stringify(cb)+').checked'),true);
  });
  await t.test('jurisdiction controls hide but never erase explicit checkbox',async()=>{
   if(await page.evaluate("document.querySelector('#filters-panel').hidden"))await page.click('#filters-toggle');await page.click('#layer-ro');
   assert.equal(await page.evaluate('document.querySelector('+JSON.stringify(cb)+').checked'),true);
   assert.match(await page.evaluate('document.querySelector("#selection-visibility").textContent'),/ascuns/i);
   if(await page.evaluate("document.querySelector('#filters-panel').hidden"))await page.click('#filters-toggle');await page.click('#layer-ro');assert.equal(await page.evaluate('document.querySelector('+JSON.stringify(cb)+').checked'),true);
  });
  await t.test('P9.0.9.3 MD11/MD12 tree shows only short labels; full official names remain in source and tooltip',async()=>{
   for(const [id,name,expected] of [
    ['stat-MD11','Partea de Vest (partea dreapta a Nistrului)','Partea de Vest'],
    ['stat-MD12','Partea de Est (partea stîngă a Nistrului)','Partea de Est']
   ]){
    await page.selectQuery(id);
    const state=await page.evaluate("((id)=>{const el=document.querySelector('.tree-select[data-entity-id=\\\"'+id+'\\\"]');const original=qaApp.hierarchyNodeById.get(id);return {caption:el?.querySelector('.tree-name')?.textContent,tooltip:el?.title,official:original?.display_name,selected:qaApp.selectedEntityId};})("+JSON.stringify(id)+")");
    assert.equal(state.caption,expected,id+' tree caption');
    assert.equal(state.tooltip,formatEntityName(name),id+' full official tooltip (normal presentation capitalization)');
    assert.equal(state.official,name,id+' immutable hierarchy identity');
    assert.equal(state.selected,id,id+' selection still works');
   }
  });
  await t.test('all seven viewports retain map, tree and prevent horizontal overflow',async()=>{
   for(const [w,h] of [[1440,900],[1280,800],[900,768],[360,800],[390,844],[430,932],[390,600]]){
    await page.viewport(w,h);
    const s=await page.evaluate("({w:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,map:document.querySelector('#map').getBoundingClientRect().width,checkbox:document.querySelector('.tree-visibility-toggle')!==null})");
    assert.equal(s.w,w);assert.equal(s.overflow,false,w+' overflow');assert.ok(s.map>0&&s.checkbox);
   }
  });
  await t.test('zero JS/console/app-network errors',async()=>{
   assert.deepEqual(page.errors,[]);
   assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[]);
   assert.deepEqual(page.responses.filter(x=>x.status>=400&&!['tile.openstreetmap.org','a.tile.openstreetmap.org','b.tile.openstreetmap.org','c.tile.openstreetmap.org'].includes(new URL(x.url).hostname)),[]);
  });
 });
}finally{await browser.close();}
