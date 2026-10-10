import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {launchBrowser,waitFor} from '../test/helpers/atlas-browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const output=process.env.ATLAS_QA_OUTPUT||path.join(tmpdir(),'atlas-browser-evidence');
const browser=await launchBrowser(root),page=await browser.page();
const evidence={baseline:'P6.3',browser:browser.version?.Browser||'Chromium',profiles:[],checks:[]};
const provenance=()=>page.evaluate("({entities:qaApp.entityById.size,checked:[...qaApp.visibleEntityIds].sort(),selected:qaApp.selectedEntityId,basemap:document.querySelector('#basemap-toggle').getAttribute('aria-pressed'),classes:[...qaApp.activeGeometryClasses].sort(),subtypes:[...qaApp.activeGeometrySubtypes].sort()})");
function failNoAppErrors(prefix){assert.deepEqual(page.errors,[],prefix+' JavaScript exceptions');assert.deepEqual(page.console.filter(x=>x.type==='error'||x.level==='error'),[],prefix+' JS console');assert.deepEqual(page.responses.filter(x=>x.status>=400&&x.url.startsWith(browser.server.url)),[],prefix+' own resources');}
async function profile(label,w,h){
 await page.viewport(w,h);
 await waitFor(()=>page.evaluate('qaApp.entityById.size===5848'),'catalog loaded');
 const state=await page.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource'),r=document.querySelector('#map').getBoundingClientRect(),paint=performance.getEntriesByType('paint');return {viewport:[innerWidth,innerHeight],mobile:qaApp.atlasMobile.state.mobile,navMs:Math.round(n?.duration||0),dclMs:Math.round(n?.domContentLoadedEventEnd||0),fcpMs:Math.round(paint.find(e=>e.name==='first-contentful-paint')?.startTime||0),resourceCount:resources.length,transferBytes:resources.reduce((sum,e)=>sum+(e.transferSize||0),0),domNodes:document.querySelectorAll('*').length,geometryPaths:document.querySelectorAll('.leaflet-overlay-pane path').length,overflow:document.documentElement.scrollWidth>innerWidth,mapWidth:Math.round(r.width),mapHeight:Math.round(r.height),treeSelects:document.querySelectorAll('.tree-select').length}})()");
 assert.equal(state.mobile,w<900);assert.ok(state.mapWidth>0&&state.mapHeight>0);assert.equal(state.overflow,false,'horizontal overflow at '+w);
 assert.equal(state.mobile,w<900,'breakpoint '+w);assert.ok(state.domNodes<20000,'excessive DOM nodes');
 assert.ok(state.geometryPaths>0,'visible vector geometries');assert.ok(state.resourceCount<250,'unexpected request count');
 evidence.profiles.push({label,...state});
 return state;
}
try{
 await test('P6.4 performance, accessibility and end-to-end UI acceptance',{timeout:220000},async t=>{
  await page.viewport(1440,900);await page.navigate(browser.server.url+'/');
  const defaultState=await provenance();
  await t.test('cold desktop performance baseline and independent checked geometries',async()=>{
   const p=await profile('desktop-cold',1440,900);
   assert.equal(p.mapWidth>600,true);assert.equal(defaultState.entities,5848);
   assert.deepEqual(defaultState.checked,['osm-r58974','osm-r90689'].sort());
   assert.equal(defaultState.selected,null);assert.equal(defaultState.basemap,'true');
  });
  await t.test('warm repeat navigation retains semantic state and does not duplicate root geometry downloads',async()=>{
   await page.navigate(browser.server.url+'/');
   await profile('desktop-warm',1440,900);
   const requests=page.requests.map(x=>x.url).filter(x=>x.includes('/public/geo/actual/'));
   const duplicates=new Map();for(const url of requests)duplicates.set(url,(duplicates.get(url)||0)+1);
   // Two independent page navigations may request every immutable root once each; no extra render-trigger fetches.
   assert.ok([...duplicates.values()].every(count=>count<=2),'duplicate geometry requests within a page load');
   assert.deepEqual(await provenance(),defaultState);
  });
  await t.test('tablet/phone landscape and portrait have accessible navigation and no overflow',async()=>{
   for(const [w,h] of [[1024,768],[900,768],[899,768],[768,1024],[844,390],[390,844],[360,640]]){
    const p=await profile('responsive-'+w+'x'+h,w,h);
    assert.ok(p.mapWidth>=w*.3);
    if(w<900){const ux=await page.evaluate("(()=>{const dock=document.getElementById('atlas-mobile-toolbar'),buttons=['mobile-navigation','mobile-search','mobile-filters'];return {dockVisible:!dock.hidden,targets:buttons.map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return {width:r.width,height:r.height,name:el.textContent.trim()}})}})()");
     assert.equal(ux.dockVisible,true);assert.ok(ux.targets.every(x=>x.width>=44&&x.height>=44&&x.name));
    }
   }
   assert.deepEqual(await provenance(),defaultState);
  });
  await t.test('accessible labels, contrast, focus and ARIA for advanced desktop/modal navigation',async()=>{
   await page.viewport(1440,900);
   await page.navigate(browser.server.url+'/');
   await page.evaluate("document.getElementById('map').focus()");
   const ax=await page.send('Accessibility.getFullAXTree');
   const names=new Set(ax.nodes.filter(n=>!n.ignored).map(n=>n.name?.value).filter(Boolean));
   for(const label of ['Hartă teritorial România și Republica Moldova','Navigare entități și rezultate','Entități','Rezultate']){
    assert.ok(names.has(label),'missing accessibility node '+label);
   }
   const focus=await page.evaluate("(()=>{let e=document.querySelector('#advanced-visible');e.focus();return document.activeElement===e&&e.getAttribute('aria-haspopup')==='dialog'})()");
   assert.equal(focus,true);
   await page.click('#advanced-visible');
   const modal=await page.evaluate("(()=>{let d=document.getElementById('atlas-advanced-dialog'),t=document.getElementById('advanced-tab-visible');return {open:d.open,focus:document.activeElement.id,role:t.getAttribute('role'),selected:t.getAttribute('aria-selected'),labelled:document.getElementById('atlas-advanced-content').getAttribute('aria-labelledby')}})()");
   assert.deepEqual([modal.open,modal.focus,modal.role,modal.selected],[true,'advanced-close','tab','true']);
   assert.equal(modal.labelled,'advanced-tab-visible');
   await page.key('Escape');
   assert.equal(await page.evaluate('document.activeElement.id'),'advanced-visible');
  });
  await t.test('contrast and reduced-motion preferences leave visible keyboard focus',async()=>{
   await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'forced-colors',value:'active'}]});
   await page.click('#advanced-visible');
   await page.key('Tab');
   const appearance=await page.evaluate("(()=>{const btn=document.activeElement;const css=getComputedStyle(btn);return {focused:!!btn.closest('#atlas-advanced-dialog'),outline:css.outlineStyle,outlineWidth:css.outlineWidth,visible:btn.matches(':focus-visible'),forced:matchMedia('(forced-colors: active)').matches,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}})()");
   assert.ok(appearance.focused&&appearance.visible&&appearance.forced&&appearance.reduced,JSON.stringify(appearance));
   assert.notEqual(appearance.outline,'none');
   await page.key('Escape');
   await page.send('Emulation.setEmulatedMedia',{features:[]});
  });
  await t.test('keyboard layer hide/undo and independent background toggle conserve identity and URL state',async()=>{
   const before=await provenance();
   await page.click('#advanced-visible');
   await page.click('#atlas-advanced-content .atlas-advanced-row-actions button:first-child');
   assert.equal((await provenance()).checked.length,1);
   await page.click('#atlas-advanced-content > button');
   assert.deepEqual(await provenance(),before);
   await page.click('#advanced-close');
   await page.click('#basemap-toggle');
   const changed=await provenance();assert.equal(changed.basemap,'false');assert.deepEqual(changed.checked,before.checked);
   await page.click('#basemap-toggle');assert.deepEqual(await provenance(),before);
  });
  await t.test('final browser accessibility and resource errors are empty',async()=>{failNoAppErrors('P6.4');});
  await mkdir(output,{recursive:true});await writeFile(path.join(output,'p64-performance-accessibility.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log('P6.4 acceptance evidence '+JSON.stringify({browser:evidence.browser,profiles:evidence.profiles}));
 });
}finally{await browser.close();}
