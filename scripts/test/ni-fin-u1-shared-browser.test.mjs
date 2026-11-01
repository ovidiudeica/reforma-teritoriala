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
await test('NI-TREE.1: all 85 canonical geometries appear in the correct NI documentary subtrees and share MD visibility',{timeout:240000},async()=>{
 const browser=await launchBrowser(root);report.browser=browser.version.Browser;
 try{
  const p=await browser.page();
  if(mode==='published'){assert.equal(source.trackedSourcesClean,true);report.publishedSource=await verifyPublishedSource(root);}
  await p.viewport(1440,900);
  await p.navigate(mode==='published'?'https://ovidiudeica.github.io/reforma-teritoriala/':browser.server.url);
  report.catalog=await p.call(async function(){
   const a=qaApp,v=a.nistreniaView;
   if(v.associationByResource.size!==85||v.roleIds.size!==85||v.root.child_ids.length!==7||v.nodes.has('view-nistrenia-cartographic-navigation'))throw Error('unified NI tree contract');
   const refs=[...v.geometryByNode.values()].flat();
   if(refs.length!==85||new Set(refs).size!==85||v.geometryByNode.has('view-nistrenia'))throw Error('duplicate/root OSM geometry references');
   globalThis.__webNiSharedBefore={visible:JSON.stringify([...a.visibleEntityIds].sort()),official:JSON.stringify([...a.entityById])};
   await a.selectEntity('view-nistrenia',{zoom:false});
   const root=document.getElementById('details-body');
   if(root.querySelectorAll('[data-ni-resource]').length!==0||root.querySelector('[data-ni-cartographic]'))throw Error('root lists descendant geometry');
   return {topLevel:7,mappedRoles:85,geometryNodes:v.geometryByNode.size,rootResourceButtons:0};
  });
  report.references=[];
  // Preserve 85/85 per-ID interaction coverage rather than weakening the old
  // four-way regression; card buttons and the MD tree control the same ID.
  for(const [canonical,association] of await p.evaluate('[...qaApp.nistreniaView.associationByResource]')){
   report.references.push(await p.call(async function(id,nodeId,evidence){
    const a=qaApp,pause=()=>new Promise(r=>setTimeout(r,90));
    const before=JSON.stringify([...a.visibleEntityIds].sort());
    const original=a.entityById.get(id);
    if(!original||original.jurisdiction!=='MD'||a.nistreniaView.mappedGeometryToNode.get(id)!==nodeId)throw Error('missing canonical identity '+id);
    const node=a.nistreniaView.nodes.get(nodeId);
    if(!node)throw Error('unreachable NI documentary node '+id);
    if(!a.nistreniaView.roleIds.has(id))throw Error('lost role '+id);
    if(id==='osm-r19001619'){
     a.atlasTree.select(nodeId);
     const checkbox=a.atlasTree.getNode(nodeId)?.checkbox;
     if(!checkbox||checkbox.disabled)throw Error('Lunga reference-only checkbox unavailable');
     checkbox.click();await pause();
     if(!a.visibleEntityIds.has(id))throw Error('Lunga on did not use canonical ID');
     checkbox.click();await pause();
    }else{
     await a.selectEntity(nodeId,{zoom:false});await pause();
     if(a.selectedEntityId!==nodeId)throw Error('documentary card redirect '+id);
     const button=document.querySelector('[data-ni-resource="'+id+'"]');
     if(!button)throw Error('OSM resource missing from NI entity card '+id+' on '+nodeId);
     button.click();await pause();
     if(!a.visibleEntityIds.has(id))throw Error('NI card on did not use canonical MD identity '+id);
     button.click();await pause();
    }
    if(before!==JSON.stringify([...a.visibleEntityIds].sort()))throw Error('NI card changed a different geometry '+id);
    return {canonical_id:id,node_id:nodeId,association:evidence,canonical_shared_geometry:true,toggle_roundtrip:true};
   },canonical,association.nodeId,association.evidence));
  }
  assert.equal(report.references.length,85);
  assert.equal(new Set(report.references.map(x=>x.canonical_id)).size,85);
  assert.equal(report.references.filter(x=>x.association!=='UNIQUE_NAME_IN_OSM_GEOMETRIC_GROUP').length,7);
  assert.equal(await p.evaluate(`(()=>{const a=qaApp,b=globalThis.__webNiSharedBefore;const same=b.visible===JSON.stringify([...a.visibleEntityIds].sort())&&b.official===JSON.stringify([...a.entityById]);delete globalThis.__webNiSharedBefore;return same;})()`),true,'canonical state and official corpus remain intact');
  // Bender's two canonical roles are deliberately visible in one Bender card.
  await p.call(async function(){await qaApp.selectEntity('view-nistrenia-group-osm-r944727',{zoom:false});});
  assert.deepEqual(await p.evaluate("[...document.querySelectorAll('[data-ni-resource]')].map(b=>b.dataset.niResource).sort()"),['osm-r12463379','osm-r9581354']);
  report.errors=p.errors;report.console=p.console;
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.console.filter(x=>x.type==='error'||x.level==='error'),[]);
  report.status='PASS';
 }catch(error){report.error={message:error.message,stack:error.stack};throw error;}
 finally{await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
});
