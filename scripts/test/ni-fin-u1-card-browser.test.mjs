import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performanceSource} from '../audit/helpers/performance-source.mjs';
import {auditEvidenceDirectory} from './helpers/atlas-evidence.mjs';
import {verifyPublishedSource} from '../audit/helpers/published-source.mjs';
import {launchBrowser} from './helpers/atlas-browser.mjs';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=path.join(auditEvidenceDirectory(),'ni-fin','u1-card');
const mode=process.env.NI_FIN_BROWSER_MODE||'local';assert(['local','published'].includes(mode));
const source=performanceSource(root),report={status:'FAIL',sourceSha:source.sha,trackedSourcesClean:source.trackedSourcesClean,mode,scenarios:[],captures:[]};
await test('WEB-NI-U1.2 real canonical MD/NI cards for all85 roles and8 outlines',{timeout:240000},async()=>{
 const browser=await launchBrowser(root);let p;report.browser=browser.version.Browser;
try{
 p=await browser.page();
 if(mode==='published'){assert.equal(source.trackedSourcesClean,true);report.publishedSource=await verifyPublishedSource(root);}
 await p.viewport(1440,900);await p.navigate(mode==='published'?'https://ovidiudeica.github.io/reforma-teritoriala/':browser.server.url);
 report.cards=await p.evaluate(`(async()=>{const before=JSON.stringify([...qaApp.visibleEntityIds].sort()),official=JSON.stringify([...qaApp.entityById]),ids=[...qaApp.nistreniaView.roleIds].sort(),rows=[];for(const id of ids){await qaApp.selectEntity(id,{zoom:false});const panel=document.getElementById('details-panel'),body=document.getElementById('details-body'),ni=body.querySelectorAll('[data-card-perspective="NI"]');if(qaApp.selectedEntityId!==id||document.querySelectorAll('#details-panel').length!==1||ni.length!==1)throw Error('canonical card '+id);if(!body.textContent.includes('Republica Moldova')||!ni[0].textContent.includes('2023')||!ni[0].textContent.includes('nu sunt certificate'))throw Error('missing scoped perspectives '+id);if(['PROVISIONAL','PENDING','OSM_'].some(token=>ni[0].textContent.includes(token)))throw Error('untranslated documentary status '+id);rows.push({id,niSections:ni.length,title:document.getElementById('details-title').textContent});await new Promise(resolve=>setTimeout(resolve,130));}if(before!==JSON.stringify([...qaApp.visibleEntityIds].sort()))throw Error('card selection changed visibility');if(official!==JSON.stringify([...qaApp.entityById]))throw Error('official identities mutated');return rows;})()`);
 assert.equal(report.cards.length,85);assert.equal(new Set(report.cards.map(r=>r.id)).size,85);report.scenarios.push('all85 canonical cards retain MD identity and one scoped NI section, without checking geometry');
 report.labels=await p.evaluate(`(async()=>{const rows=[];for(const [id,kind] of [['view-nistrenia-unit-15','Oraș'],['view-nistrenia-unit-16','Oraș'],['view-nistrenia-group-osm-r1702215','Raion'],['view-nistrenia-group-osm-r1702217','Raion']]){await qaApp.selectEntity(id,{zoom:false});const e=document.querySelector('.tree-select[data-entity-id="'+id+'"]'),n=qaApp.hierarchyNodeById.get(id);if(!e?.getAttribute('aria-description')?.startsWith(kind)||/[—–]|\\((?:raion|oraș)\\)/iu.test(n.display_name))throw Error('homonym context '+id);rows.push({id,name:n.display_name,context:e.getAttribute('aria-description')});}return rows;})()`);
 report.outlines=await p.evaluate(`(async()=>{const rows=[];for(const r of qaApp.nistreniaView.model.geometry_resources.filter(r=>r.kind==='OSM_OUTLINE')){await qaApp.selectEntity(r.canonical_id,{zoom:false});if(document.getElementById('details-body').textContent.includes('Republica Moldova'))throw Error('artificial MD section '+r.canonical_id);rows.push(r.canonical_id);}return rows;})()`);assert.equal(report.outlines.length,8);
 for(const [w,h] of [[1440,900],[390,844],[844,390]]){
  await p.viewport(w,h);await p.evaluate("qaApp.selectEntity('osm-r9581354',{zoom:false})");
  if(w<900&&await p.evaluate("!!document.getElementById('sheet-expand')?.getClientRects().length && document.getElementById('sheet-expand').textContent.trim()==='Extinde'"))await p.click('#sheet-expand');
  const layout=await p.evaluate(`(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=document.getElementById('details-body');return {page:document.documentElement.scrollWidth<=innerWidth,body:b.scrollWidth<=b.clientWidth+1,selected:qaApp.selectedEntityId,ni:b.querySelectorAll('[data-card-perspective="NI"]').length};})()`);assert.equal(layout.page,true);assert.equal(layout.body,true);assert.equal(layout.ni,1);report.scenarios.push({viewport:[w,h],layout});const file='unified-card-'+w+'x'+h+'.png';await p.screenshot(path.join(out,file));report.captures.push(file);
 }
 assert.deepEqual(p.errors,[]);report.errors=p.errors;report.console=p.console;report.status='PASS';
}catch(error){report.error={message:error.message,stack:error.stack};throw error;}finally{await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
});
