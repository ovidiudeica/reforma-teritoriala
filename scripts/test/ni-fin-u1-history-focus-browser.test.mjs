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
await test('History closes a focused NI reference branch and restores canonical state without tree errors',{timeout:180000},async()=>{
 const browser=await launchBrowser(root);report.browser=browser.version.Browser;
 try{
  if(mode==='published'){assert(source.trackedSourcesClean);report.publishedSource=await verifyPublishedSource(root);}
  for(const [width,height] of [[1440,900],[390,844]]){
   const p=await browser.page();
   try{
    await p.viewport(width,height);await p.navigate(mode==='published'?'https://ovidiudeica.github.io/reforma-teritoriala/':browser.server.url);
    await p.call(async function(){await qaApp.selectEntity('view-nistrenia-role-osm-r9581354',{zoom:false});});
    await p.openPanel('entities');await p.click('.tree-visibility-toggle[data-entity-id="view-nistrenia-role-osm-r9581354"]');
    const before=await p.evaluate("({focused:document.activeElement?.dataset.entityId,checked:qaApp.visibleEntityIds.has('osm-r9581354'),open:qaApp.atlasTree.isOpen(qaApp.nistreniaView.cartographicNavigationId)})");
    assert.equal(before.focused,'view-nistrenia-role-osm-r9581354');assert.equal(before.checked,true);assert.equal(before.open,true);
    await p.evaluate('history.back()');
    await waitFor(()=>p.evaluate("!qaApp.visibleEntityIds.has('osm-r9581354')&&!qaApp.atlasTree.isOpen(qaApp.nistreniaView.cartographicNavigationId)"),'Back closes focused reference branch');
    assert.equal(await p.evaluate("document.activeElement.isConnected&&!document.activeElement.disabled&&!!document.activeElement.closest('#hierarchy-tree')"),true);
    assert.deepEqual(p.console.filter(e=>e.type==='error'||e.level==='error'),[]);
    await p.evaluate('history.forward()');
    await waitFor(()=>p.evaluate("qaApp.visibleEntityIds.has('osm-r9581354')&&qaApp.atlasTree.isOpen(qaApp.nistreniaView.cartographicNavigationId)"),'Forward restores reference and checked canonical geometry');
    assert.equal(await p.evaluate("qaApp.selectedEntityId==='osm-r9581354'&&!qaApp.visibleEntityIds.has('view-nistrenia-role-osm-r9581354')"),true);
    assert.deepEqual(p.errors,[]);assert.deepEqual(p.console.filter(e=>e.type==='error'||e.level==='error'),[]);
    report.viewports.push({width,height,before,back:true,forward:true,canonicalState:true,errors:p.errors,console:p.console});
    const name='history-focus-'+width+'x'+height+'.png';await p.screenshot(path.join(out,name));report.captures.push(name);
   }finally{await p.close();}
  }
  report.status='PASS';
 }catch(error){report.error={message:error.message,stack:error.stack};throw error;}
 finally{await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
});
