import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
import {geometryClass} from '../../geometry-taxonomy.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const entities=JSON.parse(readFileSync(path.join(root,'public/data/actual-entities.json'),'utf8')).entities;
const county=entities.find(e=>e.jurisdiction==='RO'&&e.map?.tier==='overview'&&
 geometryClass(e)==='regional'&&e.roles.includes('statistical')&&Number(e.statistical?.level)===3);
const md=entities.find(e=>e.jurisdiction==='MD'&&e.map?.tier==='overview'&&e.display_type==='district');
const local=entities.find(e=>e.jurisdiction==='RO'&&e.map?.tier==='local'&&e.category!=='statistical');
const official=entities.find(e=>e.jurisdiction==='RO'&&String(e.legal?.id||'').length>=5);
assert.ok(county&&md&&local&&official,'Missing representative ACTUAL sample');
const evidence={contract:'p5-navigation-prototype-qa-v1',commit:process.env.GITHUB_SHA||null,
 examples:{county:county.id,md:md.id,local:local.id,official:official.id},browser:null,
 outcomes:[],errors:[],screenshots:2};
const browser=await launchBrowser(root);
const page=await browser.page();evidence.browser=browser.version.Browser;
const out=path.join(tmpdir(),'p5-navigation-qa');
const get=()=>page.evaluate('window.__p5Prototype.readState()');
async function check(t,name,fn){
 await t.test(name,{timeout:120000},async()=>{try{await fn();evidence.outcomes.push({scenario:name,status:'PASS'});}
 catch(err){evidence.outcomes.push({scenario:name,status:'FAIL',error:String(err)});evidence.errors.push(String(err));throw err;}});
}
async function choose(id){
 await page.evaluate('window.__p5Prototype.openPath('+JSON.stringify(id)+')');
 await page.click('[data-select-id="'+id+'"]');
 await waitFor(async()=>{const s=await get();return s.selectedId===id&&s.drawnId===id;},'prototype polygon selection '+id,45000);
 assert.equal(await page.evaluate('new URL(location.href).searchParams.get("e")'),id);
}
try{
 await test('P5.0 isolated navigation prototype · real RO+MD fixtures',{timeout:600000},async t=>{
  await check(t,'load unmodified ACTUAL hierarchy + entity index and visible two roots',async()=>{
   await page.viewport(1440,900);
   await page.send('Page.navigate',{url:browser.server.url+'/prototypes/p5-navigation/'});
   await waitFor(()=>page.evaluate('window.__p5Prototype?.readState().ready'),'P5.0 real-data prototype ready',90000);
   const s=await get();assert.equal(s.nodes,5848);assert.equal(s.entities,5848);
   assert.equal(s.open.length,2);assert.equal(s.tab,'tree');
   const stats=await page.evaluate("({roots:document.querySelectorAll('#tree>.tree-node').length,map:!!document.querySelector('.leaflet-map-pane'),width:document.documentElement.scrollWidth,inner:innerWidth,sidebar:document.querySelector('#sidebar').getBoundingClientRect().width})");
   assert.equal(stats.roots,2);assert.ok(stats.map);assert.ok(stats.width<=stats.inner,'desktop horizontal overflow');
   assert.ok(stats.sidebar>=390&&stats.sidebar<=430);
   await mkdir(out,{recursive:true});await page.screenshot(path.join(out,'p50-desktop.png'));
  });
  await check(t,'official code and diacritics-insensitive search with disambiguation',async()=>{
   const count=await page.evaluate('window.__p5Prototype.findMatches('+JSON.stringify(String(official.legal.id))+').length');
   assert.ok(count>0,'official ID lookup returned no entities');
   const matched=await page.evaluate('window.__p5Prototype.findMatches('+JSON.stringify(String(official.legal.id))+').some(r=>r.id==='+JSON.stringify(official.id)+')');
   assert.ok(matched,'exact official SIRUTA entity missing');
   await page.evaluate("(()=>{let i=document.querySelector('#search');i.value='romania';i.dispatchEvent(new Event('input',{bubbles:true}));})()");
   await waitFor(()=>page.evaluate("document.querySelector('#search').getAttribute('aria-expanded')==='true'"),'search suggestions');
   assert.ok(await page.evaluate("document.querySelectorAll('#search-results .result-row').length")>0);
   await page.evaluate("(()=>{let i=document.querySelector('#search');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()");
  });
  await check(t,'separate disclosure, exact RO/MD polygon selection and URL',async()=>{
   await choose(county.id);
   assert.equal(await page.evaluate("document.querySelectorAll('.tree-row.is-selected').length"),1);
   assert.ok(await page.evaluate("document.querySelectorAll('#map .leaflet-interactive').length")>0);
   await choose(md.id);
   assert.equal((await get()).selectedId,md.id);
   assert.equal((await get()).drawnId,md.id);
  });
  await check(t,'entity visibility checkbox does not delete selection or URL',async()=>{
   await choose(county.id);
   const before=(await get()).geometryRequests;
   await page.click('[data-entity-id="'+county.id+'"] .geo-checkbox');
   await waitFor(async()=>(await get()).drawnId===null,'individually hidden polygon');
   assert.equal((await get()).selectedId,county.id);
   assert.equal(await page.evaluate("new URL(location.href).searchParams.get('e')"),county.id);
   await page.click('[data-entity-id="'+county.id+'"] .geo-checkbox');
   await waitFor(async()=>(await get()).drawnId===county.id,'restored polygon');
   assert.equal((await get()).geometryRequests,before,'geometry refetched instead of using cache');
  });
  await check(t,'administrative / statistical OR semantics and separate filters panel',async()=>{
   await page.click('#tab-filters');
   assert.equal((await get()).tab,'filters');
   await page.click('#panel-filters input[aria-label="Unități regionale"]');
   assert.equal((await get()).drawnId,county.id,'NUTS3 must retain reused administrative geometry');
   await page.click('#panel-filters input[aria-label="Nivel statistic 3"]');
   await waitFor(async()=>(await get()).drawnId===null,'disabled both roles removes polygon');
   assert.equal((await get()).selectedId,county.id,'selection lost after filtering');
   await page.click('#reset-filters');
   await waitFor(async()=>(await get()).drawnId===county.id,'default geometry restored');
   await page.click('#tab-tree');
  });
  await check(t,'original local chunk fetch (lazy) with selected entity ID',async()=>{
   await page.evaluate('window.__p5Prototype.selectEntity('+JSON.stringify(local.id)+')');
   await waitFor(async()=>(await get()).drawnId===local.id,'real local chunk polygon',45000);
   const s=await get();assert.equal(s.selectedId,local.id);
   assert.ok(s.geometryRequests>=2,'no new lazy geometry requested');
  });
  await check(t,'mobile drawer, tab accessibility and contextual details',async()=>{
   await page.viewport(390,844);
   await page.click('#nav-open');
   assert.equal((await get()).drawer,true);
   assert.equal(await page.evaluate("document.querySelector('#nav-open').getAttribute('aria-expanded')"),'true');
   await page.click('#tab-filters');
   assert.equal((await get()).tab,'filters');
   await page.click('#tab-tree');
   await page.evaluate('window.__p5Prototype.openPath('+JSON.stringify(md.id)+')');
   await page.click('[data-select-id="'+md.id+'"]');
   await waitFor(async()=>(await get()).drawnId===md.id,'mobile selection',45000);
   const ui=await page.evaluate("({drawer:document.querySelector('#sidebar').classList.contains('open'),details:!document.querySelector('#details').hidden,overflow:document.documentElement.scrollWidth>innerWidth,mode:getComputedStyle(document.querySelector('#nav-open')).display})");
   assert.equal(ui.drawer,false);assert.ok(ui.details);assert.equal(ui.overflow,false);assert.notEqual(ui.mode,'none');
   await page.screenshot(path.join(out,'p50-mobile.png'));
   await page.click('#details-close');assert.equal((await get()).selectedId,null);
  });
  await check(t,'app JS console and fetch remain healthy',async()=>{
   assert.equal(page.errors.length,0,'uncaught JavaScript exceptions');
   const bad=page.console.filter(c=>c.type==='error'&&!/tile.openstreetmap.org/i.test(c.text||''));
   assert.deepEqual(bad,[],'app console errors');
   const failed=page.failures.filter(f=>!f.canceled&&!/tile\.openstreetmap\.org/i.test(f.url||''));
   assert.deepEqual(failed,[],'app fetch failures');
  });
 });
}finally{
 await mkdir(out,{recursive:true});
 await writeFile(path.join(out,'p50-navigation-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 await browser.close();
}
