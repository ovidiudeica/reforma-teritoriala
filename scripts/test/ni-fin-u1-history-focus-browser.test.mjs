import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
import {auditEvidenceDirectory} from './helpers/atlas-evidence.mjs';
import {performanceSource} from '../audit/helpers/performance-source.mjs';
import {verifyPublishedSource} from '../audit/helpers/published-source.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),mode=process.env.NI_FIN_BROWSER_MODE||'local';
assert(['local','published'].includes(mode));
const source=performanceSource(root),out=path.join(auditEvidenceDirectory(),'ni-fin','u1-history-focus');
const report={status:'FAIL',sourceSha:source.sha,trackedSourcesClean:source.trackedSourcesClean,mode,viewports:[],captures:[]};
await test('History restores independent NI Bender resource visibility without navigation-only subtree',{timeout:180000},async()=>{
 const browser=await launchBrowser(root);report.browser=browser.version.Browser;
 try{
  if(mode==='published'){assert(source.trackedSourcesClean);report.publishedSource=await verifyPublishedSource(root);}
  for(const [width,height] of [[1440,900],[390,844]]){
   const p=await browser.page();
   try{
    await p.navigate(mode==='published'?'https://ovidiudeica.github.io/reforma-teritoriala/':browser.server.url);await p.viewport(width,height);
    const bender='view-nistrenia-group-osm-r944727',canonical='osm-r9581354';
    await p.call(async function(id){await qaApp.selectEntity(id,{zoom:false});},bender);
    const before=await p.evaluate("({selected:qaApp.selectedEntityId,rootChildren:qaApp.nistreniaView.root.child_ids.length,resourceButtons:document.querySelectorAll('[data-ni-resource]').length})");
    assert.equal(before.selected,bender);assert.equal(before.rootChildren,7);assert.equal(before.resourceButtons,2);
    assert.equal(await p.evaluate("qaApp.visibleEntityIds.has('osm-r9581354')"),false);
    await p.evaluate("document.querySelector('[data-ni-resource=\"osm-r9581354\"]').click()");
    await waitFor(()=>p.evaluate("qaApp.visibleEntityIds.has('osm-r9581354')"),'Bender OSM resource enabled');
    await p.evaluate('history.back()');
    await waitFor(()=>p.evaluate("!qaApp.visibleEntityIds.has('osm-r9581354')"),'Back restores shared canonical geometry off');
    await p.evaluate('qaApp.atlasUrl.whenIdle()');
    const restoredFocus=await p.evaluate("(()=>{const e=document.activeElement;return {id:e.id,entityId:e.dataset.entityId,connected:e.isConnected,disabled:!!e.disabled,visible:!!e.getClientRects().length,body:e===document.body,inTree:!!e.closest('#hierarchy-tree'),panel:qaApp.atlasPanels.state.active,mobile:qaApp.atlasPanels.state.mobile};})()");
    assert(restoredFocus.connected&&!restoredFocus.disabled,JSON.stringify(restoredFocus));
    assert.deepEqual(p.console.filter(e=>e.type==='error'||e.level==='error'),[]);
    await p.evaluate('history.forward()');
    await waitFor(()=>p.evaluate("qaApp.visibleEntityIds.has('osm-r9581354')"),'Forward restores canonical NI geometry');
    assert.equal(await p.evaluate("qaApp.selectedEntityId==='view-nistrenia-group-osm-r944727'&&!qaApp.visibleEntityIds.has('view-nistrenia-role-osm-r9581354')"),true);
    assert.deepEqual(p.errors,[]);assert.deepEqual(p.console.filter(e=>e.type==='error'||e.level==='error'),[]);
    report.viewports.push({width,height,before,restoredFocus,back:true,forward:true,canonicalState:true,errors:p.errors,console:p.console});
    const name='history-focus-'+width+'x'+height+'.png';await p.screenshot(path.join(out,name));report.captures.push(name);
   }finally{await p.close();}
  }
  report.status='PASS';
 }catch(error){report.error={message:error.message,stack:error.stack};throw error;}
 finally{await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
});
