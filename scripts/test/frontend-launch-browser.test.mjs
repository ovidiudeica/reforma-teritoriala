import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const index=JSON.parse(await readFile(new URL('../../public/data/actual-entities.json',import.meta.url),'utf8'));
const cuatm=JSON.parse(await readFile(new URL('../../data/sources/cuatm-current.json',import.meta.url),'utf8'));
const siruta=JSON.parse(await readFile(new URL('../../data/sources/ro-siruta-current.json',import.meta.url),'utf8'));
const documentary=JSON.parse(await readFile(new URL('../../views/nistrenia/administration.json',import.meta.url),'utf8'));
const mdIds=new Set(index.entities.filter(e=>e.jurisdiction==='MD').map(e=>e.legal?.id));
const niCounts=Object.fromEntries(['GEOMETRY_CANDIDATE','NO_GEOMETRY_EVIDENCE'].map(status=>[status,documentary.nodes.filter(n=>n.geometry_status===status).length]));
test('launch: direct selection framing and honest coverage on desktop and mobile',{timeout:180000},async()=>{
 const browser=await launchBrowser(root);
 try{
  for(const [width,height] of [[1440,900],[390,844]]){
   const page=await browser.page();
   await page.navigate(browser.server.url+'/');
   // about:blank has no viewport meta and uses a 980px mobile layout viewport.
   // Resize only after the atlas document exists; cold-device startup is covered
   // independently by the existing performance/navigation acceptance matrix.
   await page.viewport(width,height);
   await page.openPanel('modules');
   const coverage=await page.call(function(){return document.querySelector('#launch-coverage').textContent;});
   for(const n of [index.entity_count,...Object.values(index.entity_count_by_jurisdiction)])assert.ok(coverage.includes(new Intl.NumberFormat('ro-RO').format(n)));
   for(const n of [siruta.records.filter(r=>r.level===3).length,cuatm.records.filter(r=>!mdIds.has(r.code)).length,...Object.values(niCounts),Object.values(niCounts).reduce((a,b)=>a+b,0)])assert.ok(coverage.includes(new Intl.NumberFormat('ro-RO').format(n)));
   assert.match(coverage,/fără a afirma acoperirea juridică exhaustivă/);
   // Sector 1 has a cartographic card without a direct level-3 SIRUTA ID
   // binding: an ID-join gap must never be described as an absent card.
   assert.ok(siruta.records.some(r=>r.siruta==='179141'&&r.level===3));
   assert.ok(index.entities.some(e=>e.id==='osm-r7960954'));
   assert.match(coverage,/înregistrări SIRUTA de nivel 3 fără legătură directă prin ID-ul oficial/);
   assert.match(coverage,/nu dovedește absența unei fișe cartografice sau a unei geometrii/);
   assert.ok(!coverage.includes('nu au fișe proprii'));
   assert.match(await page.call(function(){return document.querySelector('#module-istoric-description').textContent;}),/Amânat/);
   assert.equal(await page.call(function(){return document.querySelector('[data-mode=istoric]').disabled;}),true);
   await page.openPanel('search');await page.selectQuery('Sector 1');
   await page.call(function(){qaApp.atlasPanels.close({focus:false});qaApp.atlasMobile.setSheet('expanded');});
   const before=await page.call(function(){return {id:qaApp.selectedEntityId,visible:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometrySubtypes].sort(),jurisdictions:['ro','md','ni'].map(j=>document.querySelector('#layer-'+j).checked),raster:document.querySelector('#basemap-toggle').getAttribute('aria-pressed')};});
   assert.equal(before.id,'osm-r7960954');assert.ok(!before.visible.includes(before.id));
   const target=await page.call(function(){const b=document.querySelector('#zoom-selected');b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {count:document.querySelectorAll('#zoom-selected').length,disclosure:!!b.closest('details'),hit:b===hit||b.contains(hit),width:r.width,height:r.height};});
   assert.equal(target.count,1);assert.equal(target.disclosure,false);assert.equal(target.hit,true);assert.ok(target.width>=44&&target.height>=44);
   await page.click('#zoom-selected');
   await waitFor(()=>page.call(function(){return qaApp.map.getBounds().contains([44.5,26.05])&&qaApp.map.getZoom()>=10;}),'selected entity framed');
   const after=await page.call(function(){return {id:qaApp.selectedEntityId,visible:[...qaApp.visibleEntityIds].sort(),filters:[...qaApp.activeGeometrySubtypes].sort(),jurisdictions:['ro','md','ni'].map(j=>document.querySelector('#layer-'+j).checked),raster:document.querySelector('#basemap-toggle').getAttribute('aria-pressed')};});
   assert.deepEqual(after,before,'framing must not enable hidden geometry, change selection or filters');
   assert.deepEqual(page.errors,[]);await page.close();
  }
 }finally{await browser.close();}
});
