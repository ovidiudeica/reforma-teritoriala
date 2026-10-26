import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performanceSource} from '../audit/helpers/performance-source.mjs';
import {verifyPublishedSource} from '../audit/helpers/published-source.mjs';
import {auditEvidenceDirectory} from './helpers/atlas-evidence.mjs';
import {launchBrowser} from './helpers/atlas-browser.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const out=path.join(auditEvidenceDirectory(),'ni-fin','u1-shared');
const mode=process.env.NI_FIN_BROWSER_MODE||'local';assert(['local','published'].includes(mode));
const source=performanceSource(root);
const report={status:'FAIL',sourceSha:source.sha,trackedSourcesClean:source.trackedSourcesClean,mode};
await test('U1.4 all85 shared geometries have canonical cards, names and four-way checkbox synchronization',{timeout:240000},async()=>{
 const browser=await launchBrowser(root);report.browser=browser.version.Browser;
 try{
  const p=await browser.page();
  if(mode==='published'){assert.equal(source.trackedSourcesClean,true);report.publishedSource=await verifyPublishedSource(root);}
  await p.viewport(1440,900);
  await p.navigate(mode==='published'?'https://ovidiudeica.github.io/reforma-teritoriala/':browser.server.url);
  report.catalog=await p.call(async function(){
   const a=qaApp,v=a.nistreniaView;
   if(v.toActual.size!==85||v.root.child_ids.length!==9||v.navigationRoot.child_ids.length!==10)throw Error('documentary/navigation contracts');
   globalThis.__webNiSharedBefore={visible:JSON.stringify([...a.visibleEntityIds].sort()),official:JSON.stringify([...a.entityById])};
   await a.selectEntity(v.cartographicNavigationId,{zoom:false});
   const catalog=document.getElementById('details-body');
   if(!catalog.querySelector('[data-ni-cartographic]')||catalog.querySelectorAll('[data-ni-resource]').length!==85||catalog.textContent.includes('Organizare administrativă documentată')||catalog.textContent.includes('Părinte documentar')||!a.atlasTree.getNode(v.cartographicNavigationId).checkbox.disabled)throw Error('cartographic folder presented as an administrative unit');
   return {documentaryUnits:9,cartographicReferences:85,administrativeUnit:false};
  });
  report.references=[];
  // Each ID stays below the existing CDP command deadline. Keep all85 cases,
  // preserve partial per-ID evidence and pace History below Chromium's limit.
  for(const [alias,id] of await p.evaluate('[...qaApp.nistreniaView.toActual]')){
   report.references.push(await p.call(async function(alias,id){
    const a=qaApp,pause=()=>new Promise(r=>setTimeout(r,170));
    const entry=id=>{a.atlasTree.select(id);const e=a.atlasTree.getNode(id);if(!e||e.checkbox.disabled)throw Error('unavailable reference '+id);return e;};
    const state=JSON.stringify([...a.visibleEntityIds].sort());
    await a.selectEntity(alias,{zoom:false});await pause();
    if(a.selectedEntityId!==id||document.querySelectorAll('#details-panel').length!==1||document.querySelectorAll('[data-card-perspective="NI"]').length!==1)throw Error('noncanonical card '+alias);
    if(state!==JSON.stringify([...a.visibleEntityIds].sort()))throw Error('card changed checkbox '+alias);
    const niName=entry(alias).button.querySelector('.tree-name').textContent,mdName=entry(id).button.querySelector('.tree-name').textContent;
    if(niName!==mdName)throw Error('different canonical names '+id);
    if(a.visibleEntityIds.has(id))throw Error('unexpected selected descendant '+id);
    entry(id).checkbox.click();await pause();
    if(!entry(alias).checkbox.checked||!a.visibleEntityIds.has(id))throw Error('MD on -> NI on '+id);
    entry(alias).checkbox.click();await pause();
    if(entry(id).checkbox.checked||a.visibleEntityIds.has(id))throw Error('NI off -> MD off '+id);
    entry(alias).checkbox.click();await pause();
    if(!entry(id).checkbox.checked||!a.visibleEntityIds.has(id))throw Error('NI on -> MD on '+id);
    entry(id).checkbox.click();await pause();
    if(entry(alias).checkbox.checked||a.visibleEntityIds.has(id)||a.visibleEntityIds.has(alias))throw Error('MD off -> NI off '+id);
    return {alias,canonical_id:id,name:mdName,canonical_card:true,four_way_sync:true};
   },alias,id));
  }
  assert.equal(await p.evaluate(`(()=>{const a=qaApp,b=globalThis.__webNiSharedBefore;const same=b.visible===JSON.stringify([...a.visibleEntityIds].sort())&&b.official===JSON.stringify([...a.entityById]);delete globalThis.__webNiSharedBefore;return same;})()`),true,'canonical state and official corpus remain intact');
  assert.equal(report.references.length,85);assert.equal(new Set(report.references.map(r=>r.canonical_id)).size,85);
  assert.ok(report.references.some(r=>r.canonical_id==='osm-r19001619'),'unassociated Lunga geometry remains accessible');
  report.errors=p.errors;report.console=p.console;
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  report.status='PASS';
 }catch(error){report.error={message:error.message,stack:error.stack};throw error;}
 finally{await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
});
