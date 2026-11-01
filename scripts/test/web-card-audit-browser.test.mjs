import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=process.env.WEB_CARD_QA_OUTPUT||path.join(root,'outputs','web-card-qa');await mkdir(output,{recursive:true});
const browser=await launchBrowser(root),page=await browser.page();const evidence=[];
try{
 await test('WEB-CARD.1 Chromium desktop/mobile: cards, safety and unchanged interaction state',{timeout:240000},async t=>{
  for(const [label,w,h]of [['desktop',1440,900],['mobile',390,844]])await t.test(label,async()=>{
   await page.viewport(w,h);await page.navigate(browser.server.url);
   const start=Date.now();await page.call(async function(){await qaApp.selectEntity('osm-r18967570',{zoom:false,source:'web-card-qa'});});
   if(w<900)await page.click('#sheet-expand');
   const before=await page.evaluate("({id:qaApp.selectedEntityId,url:location.href,visible:[...qaApp.visibleEntityIds].sort(),nodes:qaApp.hierarchyNodeById.size,roots:qaApp.nistreniaView.rootIds,niParent:qaApp.nistreniaView.root.parent_id})");
   await page.screenshot(path.join(output,label+'-A-closed.png'));
   await page.call(function(){const d=document.querySelector('[data-card-audit]');d.open=true;});
   await waitFor(()=>page.evaluate("document.querySelector('[data-card-audit]')?.textContent.includes('Certificarea hotarului juridic')"),'card loaded');
   const opened=await page.evaluate("({text:document.querySelector('[data-card-audit]').textContent,overflow:document.documentElement.scrollWidth>innerWidth,details:document.querySelectorAll('[data-card-audit] details').length,busy:!!document.querySelector('[data-card-audit] [aria-busy]'),id:qaApp.selectedEntityId,url:location.href,visible:[...qaApp.visibleEntityIds].sort(),nodes:qaApp.hierarchyNodeById.size,niParent:qaApp.nistreniaView.root.parent_id})");
   assert.match(opened.text,/Grigorăuca/);assert.match(opened.text,/părintele juridic/);assert.match(opened.text,/Neacordată/);assert.equal(opened.overflow,false);assert.equal(opened.busy,false);assert.equal(opened.id,before.id);assert.equal(opened.url,before.url);assert.deepEqual(opened.visible,before.visible);assert.equal(opened.nodes,5848);assert.equal(opened.niParent,'osm-r58974');
   await page.call(function(){const panel=document.querySelector('[data-card-audit]');for(const d of panel.querySelectorAll('details'))d.open=true;panel.scrollIntoView({block:'start'});});await page.screenshot(path.join(output,label+'-B-open.png'));
   const ax=await page.send('Accessibility.getFullAXTree');assert(ax.nodes.some(n=>n.name?.value==='Geometrie, OSMB și audit'));
   // Untrusted strings are inserted as text, never executable markup; personal metadata is absent.
   await page.call(async function(){const {createCardAudit,cardAuditBinding}=await import('./atlas-card-audit.mjs');const entity={id:'osm-r1',jurisdiction:'MD',legal:null,representation:{},validation:{}};const panel=document.createElement('div');panel.id='injection-probe';document.body.append(panel);createCardAudit({document,getManifest:()=>({snapshot_id:cardAuditBinding.snapshot,release_fingerprint_sha256:cardAuditBinding.fingerprint}),getEntity:()=>null,fetch:async()=>({ok:true,json:async()=>({schema:'web-card-audit-v1',snapshot:cardAuditBinding.snapshot,fingerprint:cardAuditBinding.fingerprint,records:{'osm-r1':{id:'osm-r1',jurisdiction:'MD',legal_registry:null,legal_id:null,geometry:{valid:true},osmb_tags:{name:'<img src=x onerror="window.injected=1">',email:'private@example.test','ref:rson:idno':'1234567890123'},osmb_present:true}}})})}).render(panel,entity).open=true;});
   await waitFor(()=>page.evaluate("document.querySelector('#injection-probe')?.textContent.includes('<img')"),'text escaping');
   const safe=await page.evaluate("({injected:window.injected||false,img:!!document.querySelector('#injection-probe img'),private:document.querySelector('#injection-probe').textContent.includes('private@example.test'),idno:document.querySelector('#injection-probe').textContent.includes('1234567890123')})");assert.deepEqual(safe,{injected:false,img:false,private:false,idno:false});await page.evaluate("document.querySelector('#injection-probe').remove()");
   await page.call(async function(){await qaApp.selectEntity('osm-r18968043',{zoom:false,source:'web-card-qa'});});await page.call(function(){document.querySelector('[data-card-audit]').open=true;});await waitFor(()=>page.evaluate("document.querySelector('[data-card-audit]')?.textContent.includes('Cișmichioi')"),'second card');
   await page.evaluate('history.back()');await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r18967570'"),'Back selection');await page.evaluate('history.forward()');await waitFor(()=>page.evaluate("qaApp.selectedEntityId==='osm-r18968043'"),'Forward selection');
   const requests=page.requests.filter(r=>r.url.includes('/web-card-audit/'));evidence.push({viewport:label,elapsed_ms:Date.now()-start,requests:requests.length,identity_and_visibility_unchanged:true,security:safe,ax_nodes:ax.nodes.length});
  });
  assert.deepEqual(page.errors,[]);assert.deepEqual(page.responses.filter(r=>r.status>=400&&!/tile\.openstreetmap\.org/.test(r.url)),[]);
 });
 await writeFile(path.join(output,'evidence.json'),JSON.stringify({browser:browser.version,evidence,errors:page.errors,external_tile_warnings:page.externalTileWarnings},null,2));
}finally{await browser.close();}
