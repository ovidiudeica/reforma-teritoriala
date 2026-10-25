import test from 'node:test';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';import {mkdir,writeFile,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';import {auditEvidenceDirectory} from './helpers/atlas-evidence.mjs';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
import {performanceSource} from '../audit/helpers/performance-source.mjs';
import {verifyPublishedSource} from '../audit/helpers/published-source.mjs';
import {fetchPublishedWithRetry} from '../audit/helpers/published-runtime.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),mode=process.env.NI_FIN_BROWSER_MODE||'local';
assert.ok(['local','published'].includes(mode),'Unsupported NI acceptance mode');
const source=performanceSource(root),publishedBase='https://ovidiudeica.github.io/reforma-teritoriala/';
const out=path.join(auditEvidenceDirectory(),'ni-fin');await mkdir(out,{recursive:true});
const b=await launchBrowser(root),p=await b.page(),target=mode==='published'?publishedBase:b.server.url,report={status:'FAIL',sourceSha:source.sha,trackedSourcesClean:source.trackedSourcesClean,mode,browser:b.version.Browser,scenarios:[],screenshots:[]};
try{await test('NI-FIN real Chromium documentary tree, independent geometry, URL and responsive cards',{timeout:240000},async()=>{
 if(mode==='published'){
  assert.equal(source.trackedSourcesClean,true,'Published NI acceptance requires exact committed sources');
  report.publishedSource=await verifyPublishedSource(root);report.virtualAssets=[];
  for(const file of ['views/nistrenia/administration.json','views/nistrenia/manifest.json']){
   const {response,attempts,httpHistory}=await fetchPublishedWithRetry(new URL(file,publishedBase).href);assert.equal(response.status,200,'Published NI asset '+file);
   const remote=Buffer.from(await response.arrayBuffer()),local=await readFile(path.join(root,file));assert.deepEqual(remote,local,'Published NI asset bytes '+file);
   report.virtualAssets.push({file,bytes:remote.length,sha256:createHash('sha256').update(remote).digest('hex'),attempts,httpHistory});
  }
 }
 await p.viewport(1440,900);await p.navigate(target);
 assert.deepEqual(await p.evaluate('({actual:qaApp.entityById.size,official:qaApp.hierarchyNodeById.size,nodes:qaApp.nistreniaView.virtualIds.size,units:qaApp.nistreniaView.groupIds.length,roles:qaApp.nistreniaView.roleIds.size,outlines:qaApp.nistreniaOutlines.layers.size,checked:[...qaApp.visibleEntityIds].sort(),own:[...qaApp.visibleOperationalOutlineIds]})'),{actual:5848,official:5848,nodes:242,units:9,roles:85,outlines:8,checked:['osm-r58974','osm-r90689'],own:['view-nistrenia']});
 report.scenarios.push('5848 official + 242 documentary nodes; 9 units, 85 roles, 8 independent outlines; three roots only');
 const checked=await p.evaluate('[...qaApp.visibleEntityIds].sort()');
 await p.evaluate("(async()=>{for(const id of qaApp.nistreniaView.virtualIds){await qaApp.selectEntity(id,{zoom:false});if(!document.getElementById('details-body').textContent.includes('2023'))throw Error('missing provenance '+id);if([...document.querySelectorAll('#details-body dt,#details-body dd')].some(x=>!x.closest('dl')))throw Error('invalid definition list '+id);await new Promise(resolve=>setTimeout(resolve,125));}return true;})()");
 assert.deepEqual(await p.evaluate('[...qaApp.visibleEntityIds].sort()'),checked);assert.deepEqual(await p.evaluate('[...qaApp.visibleOperationalOutlineIds]'),['view-nistrenia']);
 report.scenarios.push('all242cards select without checking any descendant or candidate; paced below Chromium IPC flooding protection');
 await p.evaluate("document.getElementById('details-panel').scrollTop=500;qaApp.selectEntity('view-nistrenia-council-29',{zoom:false})");await p.openPanel('entities');
 assert.equal(await p.evaluate("document.getElementById('details-panel').scrollTop"),0,'new documentary card starts at its heading');
 assert.equal(await p.evaluate("qaApp.atlasTree.getNode('view-nistrenia-council-29').checkbox.disabled"),true);
 await p.evaluate("qaApp.atlasTree.getNode('view-nistrenia-council-29').button.focus()");await p.key('ArrowLeft');
 assert.equal(await p.evaluate("document.activeElement===qaApp.atlasTree.getNode('view-nistrenia-council-29').toggle"),true);
 await p.key('ArrowRight');assert.equal(await p.evaluate("document.activeElement===qaApp.atlasTree.getNode('view-nistrenia-council-29').button"),true);
 report.scenarios.push('no-polygon checkbox disabled; keyboard skips it in both directions');
 const url=await p.evaluate('location.href');await p.navigate(url);assert.equal(await p.evaluate('qaApp.selectedEntityId'),'view-nistrenia-council-29');
 await p.evaluate("qaApp.selectEntity('view-nistrenia-unit-15',{zoom:false})");await p.evaluate('history.back()');await waitFor(()=>p.evaluate("qaApp.selectedEntityId==='view-nistrenia-council-29'"),'documentary Back');await p.evaluate('history.forward()');await waitFor(()=>p.evaluate("qaApp.selectedEntityId==='view-nistrenia-unit-15'"),'documentary Forward');
 report.scenarios.push('text-only URL hydration, Back/Forward');
 await p.evaluate("qaApp.selectEntity('view-nistrenia',{zoom:false})");
 assert.equal(await p.evaluate("document.querySelectorAll('[data-ni-resource]').length"),85);
 await p.click('[data-ni-resource="osm-r9581354"]');assert.equal(await p.evaluate("qaApp.visibleEntityIds.has('osm-r9581354')"),true);assert.equal(await p.evaluate('qaApp.selectedEntityId'),'view-nistrenia');await p.click('[data-ni-resource="osm-r9581354"]');
 assert.deepEqual(await p.evaluate('[...qaApp.visibleEntityIds].sort()'),checked);
 report.scenarios.push('85 canonical resource buttons; explicit Bender toggle without duplicate or administrative identity promotion');
 for(const [w,h] of [[1440,900],[900,768],[390,844],[844,390],[360,800]]){
  await p.viewport(w,h);await p.evaluate("qaApp.selectEntity('view-nistrenia-council-29',{zoom:false})");
  assert.equal(await p.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'overflow '+w+'x'+h);
  const file='council-'+w+'x'+h+'.png';await p.screenshot(path.join(out,file));report.screenshots.push(file);
  if(w<900){await p.click('#sheet-expand');const expanded='expanded-'+w+'x'+h+'.png';await p.screenshot(path.join(out,expanded));report.screenshots.push(expanded);}
 }
 report.scenarios.push('desktop/tablet/mobile portrait+landscape without horizontal overflow');
 for(const id of ['osm-r58974','osm-r90689']){await p.call(async function(id){await qaApp.selectEntity(id,{zoom:false});},id);assert.equal(await p.evaluate('qaApp.selectedEntityId'),id);}
 assert.deepEqual(p.errors,[]);assert.ok(!p.console.some(x=>/Throttling navigation/.test(x.text||'')),'audit must respect Chromium flooding protection');assert.deepEqual(p.console.filter(x=>x.type==='error'||x.level==='error'),[]);
 report.scenarios.push('RO/MD canonical selection intact; zero JavaScript/console errors');report.status='PASS';
 });}finally{report.errors=p.errors;report.console=p.console;report.responses=p.responses;await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await b.close();}
