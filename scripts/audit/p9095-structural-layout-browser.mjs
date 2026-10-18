import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,delay} from '../test/helpers/atlas-browser.mjs';
import {auditEvidenceDirectory} from '../test/helpers/atlas-evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(auditEvidenceDirectory(),'p9095-structural');
const shapes=[[360,640],[390,844],[430,932],[600,390],[640,360],[844,390],[768,1024],[899,768],[900,768],[1440,900]];
const inspect=function(){
 const rect=e=>{const r=e.getBoundingClientRect();return Object.fromEntries(['left','right','top','bottom','width','height'].map(k=>[k,r[k]]));};
 const visible=e=>e&&!e.hidden&&e.getClientRects().length;
 const overlap=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
 const panel=document.getElementById('details-panel'),card=rect(panel),map=rect(document.getElementById('map'));
 const controls=[...document.querySelectorAll('#details-panel .details-head button,#sheet-drag,.leaflet-control-zoom>*')].filter(visible).map(e=>{const r=rect(e),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return {id:e.id||e.className,...r,name:e.getAttribute('aria-label')||e.textContent.trim(),hit:hit===e||e.contains(hit),inside:!panel.contains(e)||(r.left>=card.left-.5&&r.right<=card.right+.5&&r.top>=card.top-.5&&r.bottom<=card.bottom+.5)};});
 const annotations=[...document.querySelectorAll('.leaflet-control-scale,.leaflet-control-attribution')].map(e=>({name:e.className,...rect(e),scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
 const obstacles=[{name:'card',...card},{name:'rail',...rect(document.getElementById('atlas-navigation-rail'))}];
 const issues=[];
 for(const c of annotations){if(c.left<map.left-.5||c.right>map.right+.5||c.top<map.top-.5||c.bottom>map.bottom+.5)issues.push({outsideMap:c});for(const o of obstacles)if(overlap(c,o))issues.push({annotation:c.name,obstacle:o.name});}
 if(overlap(annotations[0],annotations[1]))issues.push({annotationOverlap:true});
 const title=document.getElementById('details-title');
 return {viewport:[innerWidth,innerHeight],sheet:panel.dataset.sheet,card,map,controls,annotations,issues,title:{text:title.textContent,client:title.clientWidth,scroll:title.scrollWidth},outerScroll:{top:panel.scrollTop,height:panel.scrollHeight,client:panel.clientHeight},stage:{scroll:document.getElementById('atlas-stage').scrollTop},identities:qaApp.entityById.size,outlines:qaApp.nistreniaOutlines.layers.size};
};
await mkdir(out,{recursive:true});const reports=[],b=await launchBrowser(root),p=await b.page();
try{await test('P9.0.9.5 structural Chromium matrix, full annotations and stable sheet focus',{timeout:300000},async()=>{
 await p.viewport(1440,900);await p.navigate(b.server.url);
 const id=await p.evaluate("[...qaApp.entityById.values()].find(e=>e.jurisdiction==='RO'&&e.map?.bbox&&!qaApp.visibleEntityIds.has(e.id)).id");
 for(const text200 of [false,true])for(const [w,h]of shapes){
  if(text200&&![[360,640],[640,360],[1440,900]].some(([x,y])=>x===w&&y===h))continue;
  await p.viewport(w,h);
  if(text200){await p.navigate(b.server.url);await p.call(function(){const sizes=[...document.querySelectorAll('body *')].filter(e=>e.namespaceURI==='http://www.w3.org/1999/xhtml').map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const [e,size]of sizes)e.style.setProperty('font-size',size*2+'px','important');});}
  await p.call(async function(id){await qaApp.selectEntity(id,{source:'map',zoom:false});qaApp.atlasPanels.close({focus:false});document.getElementById('atlas-stage').scrollTop=0;},text200?'osm-r58974':id);await delay(200);
  for(const sheet of w<900?['peek','half','expanded']:['desktop']){
   if(w<900)await p.call(function(sheet){qaApp.atlasMobile.setSheet(sheet);},sheet);await delay(150);
   const before=await p.call(inspect);reports.push({text200,w,h,sheet,phase:'before-focus',...before});
   await p.screenshot(path.join(out,`${text200?'text200':'native'}-${w}x${h}-${sheet}.png`));
   assert.equal(before.identities,5848);assert.equal(before.outlines,8);
   assert.deepEqual(before.issues,[]);assert.ok(before.controls.every(c=>c.width>=44&&c.height>=44&&c.name&&c.hit&&c.inside),JSON.stringify(before));assert.ok(before.title.scroll<=before.title.client);
   assert.ok(before.annotations.every(a=>a.scrollHeight<=a.clientHeight+1&&a.scrollWidth<=a.clientWidth+1),'complete annotations '+JSON.stringify(before.annotations));
   const ids=await p.evaluate("[...document.querySelectorAll('#details-panel .details-head button,#sheet-drag,#selection-visibility-action')].filter(e=>!e.hidden&&e.getClientRects().length).map(e=>e.id)");
   for(const target of ids){await p.call(function(id){document.getElementById(id).focus();},target);const after=await p.call(inspect);reports.push({text200,w,h,sheet,phase:'focus',target,...after});assert.ok(after.controls.every(c=>c.inside),'focus must not scroll the outer card');assert.equal(after.outerScroll.top,0);}
   // Focus must expose complete map and navigation targets through the stage
   // when enlarged intrinsic content is taller than the physical frame.
   const outsideIds=await p.evaluate("[...document.querySelectorAll('#atlas-navigation-rail button,.leaflet-control-zoom>*')].filter(e=>!e.hidden&&e.getClientRects().length).map(e=>e.id||'.'+e.classList[0])");
   for(const target of outsideIds){const focused=await p.call(function(target){const e=target.startsWith('.')?document.querySelector(target):document.getElementById(target);e.focus();const r=e.getBoundingClientRect(),s=document.getElementById('atlas-stage').getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {target,name:e.getAttribute('aria-label'),width:r.width,height:r.height,top:r.top,bottom:r.bottom,hit:e===hit||e.contains(hit),whole:r.top>=Math.max(0,s.top)&&r.bottom<=Math.min(innerHeight,s.bottom),focused:document.activeElement===e};},target);reports.push({text200,w,h,sheet,phase:'external-focus',...focused});assert.ok(focused.hit&&focused.whole&&focused.focused&&focused.name&&focused.width>=44&&focused.height>=44,JSON.stringify(focused));}
   if(w<900){await p.call(function(){document.getElementById('sheet-drag').focus();});await p.key('End');assert.equal(await p.evaluate('qaApp.atlasMobile.state.sheet'),'expanded');await p.key('Home');assert.equal(await p.evaluate('qaApp.atlasMobile.state.sheet'),'peek');}
  }
 }
 assert.deepEqual(p.errors,[]);
 });}finally{await writeFile(path.join(out,'report.json'),JSON.stringify({browser:b.version.Browser,reports},null,2));await b.close();}
