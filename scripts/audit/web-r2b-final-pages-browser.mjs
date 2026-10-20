// WEB-R2b final: exercise the *published* GitHub Pages application, not a local build.
// Browser mutations are client-side only. No ACTUAL source or server write is permitted.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';
import {performanceSource} from './helpers/performance-source.mjs';
import {verifyPublishedSource} from './helpers/published-source.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const url=process.env.ATLAS_LIVE_URL||'https://ovidiudeica.github.io/reforma-teritoriala/';
if(new URL(url).origin!=='https://ovidiudeica.github.io'||new URL(url).pathname!=='/reforma-teritoriala/')throw Error('Refuse non-public audit target');
const out=path.join(root,'outputs','WEB-R2b-final-live');
if(process.env.ATLAS_E2E_OUTPUT&&path.resolve(process.env.ATLAS_E2E_OUTPUT)!==out)throw Error('Published audit output must remain inside the fixed evidence directory');
const source=performanceSource(root);
const report={schema:'web-r2b-final-published-e2e-v2',url,expectedMain:source.sha,trackedSourcesClean:source.trackedSourcesClean,status:'FAIL',browser:null,checks:[],captures:[],errors:[],started_at:new Date().toISOString()};
const mark=(name,result)=>{report.checks.push({name,status:'PASS',...result});console.log('PASS '+name);};
let browser;
async function screenshot(page,name){await page.screenshot(path.join(out,name+'.png'));report.captures.push(name+'.png');}
async function snapshot(page){return page.call(function(){return {
 actual:[...qaApp.visibleEntityIds].sort(),ni:[...qaApp.visibleOperationalOutlineIds].sort(),
 selection:qaApp.selectedEntityId,
 stat:[...document.querySelectorAll('input[data-kind="statistical"]')].map(x=>[x.dataset.filter,x.checked]),
 filters:[...document.querySelectorAll('input[data-kind="osm-admin-level"]')].filter(x=>x.checked).map(x=>x.dataset.filter),
 visibleTree:qaApp.atlasTree.getVisibleIds(),url:location.href
};});}
async function setLevels(page,levels){return page.call(function(levels){
 const section=[...document.querySelectorAll('#filter-list>details')].find(x=>x.querySelector('summary')?.textContent==='Nivel administrativ OSM');
 if(!section)throw Error('OSM filter absent');section.open=true;
 section.querySelector('.filter-actions button:nth-child(2)').click();
 for(const input of section.querySelectorAll('input[data-kind="osm-admin-level"]'))
  if(levels.includes(input.dataset.filter))input.click();
 return {selection:[...section.querySelectorAll('input[data-kind="osm-admin-level"]:checked')].map(x=>x.dataset.filter),help:section.querySelector('.osm-level-geometry-actions>.hint')?.textContent};
},levels.map(String));}
async function controls(page,action){return page.call(function(action){
 const wrap=document.querySelector('.osm-level-geometry-actions');
 if(!wrap)throw Error('Missing bulk action component');
 if(action==='show')wrap.querySelector('.osm-level-geometry-buttons button:nth-child(1)').click();
 else if(action==='hide')wrap.querySelector('.osm-level-geometry-buttons button:nth-child(2)').click();
 else if(action==='undo')wrap.querySelector('.osm-level-geometry-buttons button:nth-child(3)').click();
 else if(action==='confirm')wrap.querySelector('.osm-level-action-confirm button:nth-of-type(1)').click();
 else if(action==='cancel')wrap.querySelector('.osm-level-action-confirm button:nth-of-type(2)').click();
 else throw Error('Unknown action');
 return {open:!wrap.querySelector('.osm-level-action-confirm').hidden,scope:wrap.querySelector('.osm-level-action-confirm p')?.textContent,notice:wrap.querySelector('[role="status"]')?.textContent,undoDisabled:wrap.querySelector('.osm-level-geometry-buttons button:nth-child(3)').disabled};
},action);}
try{
 report.publishedSource=await verifyPublishedSource(root);
 mark('published-source-matches-exact-checkout',{files:report.publishedSource.length,sha:source.sha});
 browser=await launchBrowser(root);report.browser=browser.version.Browser;
 for(const [width,height] of [[1440,900],[390,844]]){
  const page=await browser.page();
  try{
   // A blank Chrome mobile tab has a 980px layout viewport until the site's meta viewport loads.
   await page.navigate(url);
   await page.viewport(width,height);
   await waitFor(()=>page.call(function(){return qaApp.entityById.size===5848&&qaApp.osmRoleById.size===85&&qaApp.nistreniaOutlines?.layers?.size===8;}),'verified actual RO MD, NI outlines and reused roles');
   const start=await snapshot(page);
   assert.deepEqual(start.actual,['osm-r58974','osm-r90689']);
   assert.deepEqual(start.ni,['view-nistrenia']);
   assert.equal(start.selection,null);
   // The badges must belong to the actual virtual tree, not merely to static text.
   await page.openPanel('entities');
   const badges=await page.call(function(){
    const b=id=>document.querySelector('.tree-select[data-entity-id="'+id+'"] .tree-osm-admin-badge')?.textContent;
    if(!qaApp.atlasTree.isOpen('view-nistrenia'))qaApp.atlasTree.toggle('view-nistrenia');
    return {ro:b('osm-r90689'),md:b('osm-r58974'),ni:b('view-nistrenia'),group:b('view-nistrenia-group-osm-r1702216')};
   });
   assert.equal(badges.ro,'2');assert.equal(badges.md,'2');assert.equal(badges.ni,'3');
   await waitFor(()=>page.call(function(){return document.querySelector('.tree-select[data-entity-id="view-nistrenia-group-osm-r1702216"] .tree-osm-admin-badge')?.textContent==='5';}),'NI level 5 badge visible');
   mark('badges-'+width,{levels:{...badges,group:'5'}});
   await page.openPanel('filters');await screenshot(page,'start-'+width);
   const selection=await setLevels(page,['3','5']);
   assert.deepEqual(selection.selection,['3','5']);
   const filtered=await snapshot(page);
   assert.ok(filtered.visibleTree.includes('view-nistrenia'));
   assert.ok(filtered.visibleTree.some(id=>id.startsWith('view-nistrenia-group-osm-r')));
   assert.deepEqual(filtered.actual,start.actual);
   assert.deepEqual(filtered.ni,start.ni);
   assert.deepEqual(filtered.stat,start.stat);
   assert.equal(filtered.selection,start.selection);
   assert.deepEqual(new URL(filtered.url).searchParams.get('a')?.split(','),['3','5']);
   mark('multiselect-'+width,{visibleTree:filtered.visibleTree.length,independent:true});
   await screenshot(page,'filter-'+width);
   // The unknown option is not an implicit command to hide all unclassified entities.
   await setLevels(page,['unknown']);const unknown=await controls(page,'hide');
   assert.equal(unknown.open,false);
   assert.deepEqual((await snapshot(page)).actual,start.actual);
   mark('unknown-excluded-'+width,{});
   await setLevels(page,['5']);
   const planned=await controls(page,'show');
   assert.equal(planned.open,true);
   assert.match(planned.scope,/contururi NI 7/);
   assert.match(planned.scope,/roluri NI reutilizate excluse/);
   assert.deepEqual((await snapshot(page)).actual,start.actual);
   assert.deepEqual((await snapshot(page)).ni,start.ni);
   await page.call(function(){document.querySelector('.osm-level-action-confirm').scrollIntoView({block:'center',behavior:'instant'});});
   await screenshot(page,'confirm-ni-'+width);
   await controls(page,'cancel');
   assert.deepEqual((await snapshot(page)).ni,start.ni,'cancel leaves outlines unchanged');
   await controls(page,'show');await controls(page,'confirm');
   const shown=await snapshot(page);
   assert.equal(shown.ni.length,8);
   assert.deepEqual(shown.actual,start.actual);
   assert.deepEqual(shown.stat,start.stat);
   assert.equal(shown.selection,start.selection);
   assert.ok(new URL(shown.url).searchParams.getAll('o').length>=7);
   mark('show-ni-'+width,{niCount:shown.ni.length,sourceAliasesUntouched:true});
   await screenshot(page,'shown-ni-'+width);
   await controls(page,'undo');
   const undone=await snapshot(page);
   assert.deepEqual(undone.ni,start.ni);
   assert.deepEqual(undone.actual,start.actual);
   mark('undo-ni-'+width,{restored:true});
   await controls(page,'show');await controls(page,'confirm');
   assert.equal((await snapshot(page)).ni.length,8);
   await page.evaluate('history.back()');
   await waitFor(()=>page.call(function(){return qaApp.visibleOperationalOutlineIds.size===1;}),'Back restores single NI outline',20000);
   const back=await snapshot(page);assert.deepEqual(back.ni,start.ni);
   assert.deepEqual(back.filters,['5']);
   await screenshot(page,'url-back-'+width);
   await page.evaluate('history.forward()');
   await waitFor(()=>page.call(function(){return qaApp.visibleOperationalOutlineIds.size===8;}),'Forward restores NI seven districts',20000);
   const forward=await snapshot(page);
   assert.deepEqual(forward.ni,shown.ni);
   assert.deepEqual(forward.actual,start.actual);
   assert.deepEqual(forward.filters,['5']);
   mark('history-ni-'+width,{back:back.ni.length,forward:forward.ni.length});
   await screenshot(page,'url-forward-'+width);
   // Explicit RO/MD level 2 operations use existing x= URL toggles.
   await setLevels(page,['2']);
   const rootPlan=await controls(page,'hide');assert.equal(rootPlan.open,true);
   assert.match(rootPlan.scope,/RO 1, MD 1/);
   await screenshot(page,'confirm-ro-md-'+width);
   await controls(page,'confirm');
   const hidden=await snapshot(page);
   assert.deepEqual(hidden.actual,[]);
   assert.equal(new URL(hidden.url).searchParams.getAll('x').length,2);
   assert.equal(hidden.ni.length,8,'NI source-only outlines survive RO/MD hide');
   await controls(page,'undo');
   const reset=await snapshot(page);
   assert.deepEqual(reset.actual,start.actual);
   assert.deepEqual(reset.ni,shown.ni);
   mark('hide-undo-ro-md-'+width,{reverted:true});
   assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'no horizontal overflow');
   const consoleErrors=page.errors.map(x=>x.text||x.exception?.description);
   assert.deepEqual(consoleErrors,[],'no uncaught app exceptions');
   assert.deepEqual(page.responses.filter(x=>x.url.startsWith(url)&&x.status>=400),[],'no own HTTP errors');
   assert.deepEqual(page.failures.filter(x=>x.url?.startsWith(url)&&!x.canceled),[],'no own network failures');
   report.checks.push({name:'runtime-'+width,status:'PASS',consoleErrors:0,failedRequests:page.failures.filter(x=>x.url?.startsWith(url)).length});
  }finally{await page.close();}
 }
 const release=await fetch(url+'data/current/actual-release-manifest.json',{cache:'no-store'});
 assert.equal(release.status,200);
 const manifest=await release.json();
 assert.equal(manifest.snapshot_id,'actual-a9e5a4ddcb5277ef');
 assert.equal(manifest.release_fingerprint_sha256,'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446');
 mark('ACTUAL-fingerprint',{snapshot:manifest.snapshot_id,fingerprint:manifest.release_fingerprint_sha256});
 report.status='PASS';
}catch(error){report.errors.push({message:String(error?.stack||error)});console.error('FAIL WEB-R2b final live audit:',error);process.exitCode=1;}
finally{report.completed_at=new Date().toISOString();await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();}
console.log(JSON.stringify({status:report.status,checks:report.checks.length,captures:report.captures.length,errors:report.errors},null,2));
