import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {launchBrowser,waitFor,delay} from '../test/helpers/atlas-browser.mjs';
import {performanceSource} from './helpers/performance-source.mjs';
import {navigatePerformanceProfile} from './helpers/performance-navigation.mjs';
import {publishedSourceContext,verifyPublishedSource} from './helpers/published-source.mjs';
import {verifyPublishedRuntime} from './helpers/published-runtime.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const mode=process.env.ATLAS_HARDENING_MODE||'local';assert.ok(mode==='local'||mode==='published','Unsupported audit target mode');
const published=mode==='published',context=published?publishedSourceContext(root):null;
const out=published?path.join(root,'outputs','web-r2c4-published'):path.join(root,'outputs','web-r2c32-hardening');
const source=context?.auditor||performanceSource(root);
const target=browser=>published?'https://ovidiudeica.github.io/reforma-teritoriala/':browser.server.url;
const report={schema:published?'web-r2c4-published-v1':'web-r2c32-hardening-v1',sourceSha:source.sha,trackedSourcesClean:source.trackedSourcesClean,mode,expectedPublishedSha:context?.published.sha,coverage:context?.coverage,status:'FAIL',startedAt:new Date().toISOString(),checks:[],captures:[],network:[],errors:[],limitations:['No physical screen reader is available; Chrome AX tree checks are not a screen reader certification.','Device viewport profiles run in real Chromium, not on physical mobile devices.']};
await mkdir(out,{recursive:true});
const mark=(name,data={})=>{report.checks.push({name,status:'PASS',...data});console.log('PASS '+name);};
const state=function(){return {actual:[...qaApp.visibleEntityIds].sort(),ni:[...qaApp.visibleOperationalOutlineIds].sort(),selected:qaApp.selectedEntityId,stat:[...document.querySelectorAll('input[data-kind="statistical"]')].map(e=>[e.dataset.filter,e.checked]),levels:[...document.querySelectorAll('input[data-kind="osm-admin-level"]:checked')].map(e=>e.dataset.filter),url:location.href};};
const levels=function(values){const section=[...document.querySelectorAll('#filter-list>details')].find(e=>e.querySelector('summary')?.textContent==='Nivel administrativ OSM');assertSection(section);function assertSection(e){if(!e)throw Error('OSM level controls absent');}section.open=true;section.querySelector('.filter-actions button:nth-child(2)').click();for(const input of section.querySelectorAll('input[data-kind="osm-admin-level"]'))if(values.includes(input.dataset.filter))input.click();};
const bulk=function(action){const wrap=document.querySelector('.osm-level-geometry-actions'),selectors={show:'.osm-level-geometry-buttons button:nth-child(1)',hide:'.osm-level-geometry-buttons button:nth-child(2)',undo:'.osm-level-geometry-buttons button:nth-child(3)',confirm:'.osm-level-action-confirm button:nth-of-type(1)',cancel:'.osm-level-action-confirm button:nth-of-type(2)'};const e=wrap?.querySelector(selectors[action]);if(!e||e.disabled)throw Error('Unavailable bulk command '+action);e.click();return {pending:!wrap.querySelector('.osm-level-action-confirm').hidden,scope:wrap.querySelector('.osm-level-action-confirm p').textContent};};
async function capture(p,name){await p.screenshot(path.join(out,name+'.png'));report.captures.push(name+'.png');}
async function accessible(p,label){
 const tree=await p.send('Accessibility.getFullAXTree');
 const unnamed=tree.nodes.filter(n=>!n.ignored&&['button','checkbox','combobox','textbox','link'].includes(n.role?.value)&&!n.name?.value?.trim()).map(n=>({role:n.role.value,nodeId:n.nodeId}));
 assert.deepEqual(unnamed,[],'interactive AX nodes require accessible names');
 const layout=await p.call(function(){const header=document.querySelector('header'),title=header?.querySelector('h1'),r=title?.getBoundingClientRect(),h=header?.getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport.scale},modalDrawer:qaApp.atlasPanels.state.drawer,overflow:document.documentElement.scrollWidth>innerWidth,titleContained:!!r&&!!h&&r.top>=h.top&&r.bottom<=h.bottom,controls:[...document.querySelectorAll('.leaflet-control-zoom a,.leaflet-control-zoom button')].map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:e.getAttribute('aria-label')||e.title||e.textContent,width:r.width,height:r.height,hit:hit===e||e.contains(hit)};})};});
 report.checks.push({name:'raw-layout-'+label,...layout});
 assert.equal(layout.overflow,false,'horizontal overflow');assert.equal(layout.titleContained,true,'header title clipping');assert.ok(layout.controls.every(c=>c.width>=44&&c.height>=44&&(layout.modalDrawer||c.hit)),'map commands require 44px targets, with hit testing when the map owns interaction');
 mark(label,{...layout,axInteractive:tree.nodes.filter(n=>!n.ignored&&['button','checkbox','textbox','link'].includes(n.role?.value)).length});
}
async function contrast(p,label){
 const samples=await p.call(function(){
  const parse=c=>{const v=c.match(/[\d.]+/g)?.map(Number);return v?.length>=3?[...v.slice(0,3),v[3]??1]:null;};
  const blend=(a,b)=>a.slice(0,3).map((x,i)=>x*a[3]+b[i]*(1-a[3]));
  function background(e){if(!e)return [255,255,255];const c=parse(getComputedStyle(e).backgroundColor);if(!c)return background(e.parentElement);return c[3]===1?c.slice(0,3):blend(c,background(e.parentElement));}
  const lum=c=>c.map(x=>{const s=x/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  return [...document.querySelectorAll('header *,#atlas-controls *,#details-panel *,#atlas-navigation-rail *')].filter(e=>e.namespaceURI==='http://www.w3.org/1999/xhtml'&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest(':disabled,[aria-disabled="true"]')).flatMap(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height||r.bottom<=0||r.top>=innerHeight||s.visibility!=='visible'||Number(s.opacity)===0)return [];const x=Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.y+r.height/2)),hit=document.elementFromPoint(x,y);if(hit!==e&&!e.contains(hit))return [];const bg=background(e),fg=parse(s.color);if(!fg)throw Error('Unsupported CSS text color '+s.color);const f=lum(blend(fg,bg)),b=lum(bg),ratio=(Math.max(f,b)+.05)/(Math.min(f,b)+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.666&&Number(s.fontWeight)>=700);return [{tag:e.tagName,id:e.id,text:e.textContent.trim().slice(0,90),ratio,minimum:large?3:4.5,color:s.color,background:bg,fontSize:s.fontSize}];});
 });
 report.checks.push({name:'contrast-'+label,status:samples.every(s=>s.ratio>=s.minimum)?'PASS':'FAIL',samples});
 assert.ok(samples.length>0);assert.deepEqual(samples.filter(s=>s.ratio<s.minimum),[],'text contrast below WCAG AA');
}
async function network(p,label,url){const ownErrors=p.responses.filter(r=>r.url.startsWith(url)&&r.status>=400),ownFailures=p.failures.filter(r=>r.url?.startsWith(url)&&!r.canceled);report.network.push({label,requests:p.requests,responses:p.responses,failures:p.failures,externalTileWarnings:p.externalTileWarnings,console:p.console,exceptions:p.errors});assert.deepEqual(ownErrors,[]);assert.deepEqual(ownFailures,[]);assert.deepEqual(p.errors,[]);assert.deepEqual(p.console.filter(e=>e.type==='error'||e.level==='error'),[]);mark('network-'+label,{ownErrors:0,ownFailures:0,exceptions:0,externalTileWarnings:p.externalTileWarnings.length});}
let browser;
try{
 if(published){report.publishedSource=await verifyPublishedSource(context.sourceRoot);report.publishedInventory=await verifyPublishedRuntime(context.sourceRoot);mark('published-runtime-integrity',{files:report.publishedInventory.checkedFiles,geojson:report.publishedInventory.geojsonFiles,bytes:report.publishedInventory.totalBytes,expectedPublishedSha:context.published.sha,coverage:context.coverage});}
 browser=await launchBrowser(root);report.browser=browser.version;
 for(const [label,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844],['landscape',844,390]]){
  const p=await browser.page();
  try{
   await navigatePerformanceProfile(p,target(browser),width,height);await p.send('Accessibility.enable');
   const baseline=await p.call(state);assert.deepEqual(baseline.actual,['osm-r58974','osm-r90689']);assert.deepEqual(baseline.ni,published?['view-nistrenia']:[]);
   await accessible(p,label+'-initial');await contrast(p,label+'-initial');await capture(p,label+'-initial');
   await p.openPanel('entities');
   for(const id of ['osm-r90689','osm-r58974','view-nistrenia']){
    await p.openPanel('entities');await p.click('.tree-select[data-entity-id="'+id+'"]');assert.equal((await p.call(state)).selected,id);
   }
   await capture(p,label+'-ni-card');
   if(published){
    // Revealing a virtual row changes scroll only; selection remains a separate pointer action.
    await p.openPanel('entities');
    const ids=await p.call(function(){if(!qaApp.atlasTree.isOpen('view-nistrenia'))qaApp.atlasTree.toggle('view-nistrenia');return ['osm-r90689','osm-r58974',...qaApp.nistreniaOutlineFeatures.keys()];});
    for(const id of ids){
     await p.call(function(id){qaApp.atlasTree.reveal(id);},id);
     await waitFor(()=>p.call(function(id){return !!qaApp.atlasTree.getNode(id);},id),'mounted individual row '+id);
     const before=await p.call(state),selector='.tree-visibility-toggle[data-entity-id="'+id+'"]';
     await p.click(selector);const after=await p.call(state),actual=id.startsWith('osm-'),key=actual?'actual':'ni',other=actual?'ni':'actual';
     const expected=new Set(before[key]);if(expected.has(id))expected.delete(id);else expected.add(id);
     assert.deepEqual(after[key],[...expected].sort());assert.deepEqual(after[other],before[other]);assert.equal(after.selected,before.selected);
     await p.click(selector);const restored=await p.call(state);assert.deepEqual(restored.actual,before.actual);assert.deepEqual(restored.ni,before.ni);
    }
    await capture(p,label+'-individual');mark('individual-geometry-'+label,{actualRoots:2,operationalOutlines:8,independent:true});
   }
   await p.openPanel('filters');await p.call(levels,['8','9']);let filtered=await p.call(state);assert.deepEqual(filtered.levels,['8','9']);assert.deepEqual(filtered.actual,baseline.actual);assert.deepEqual(filtered.ni,baseline.ni);assert.deepEqual(filtered.stat,baseline.stat);assert.equal(filtered.selected,'view-nistrenia');
   if(published){
    const selector='input[data-kind="statistical"][data-filter="1"]';
    await p.call(function(selector){document.querySelector(selector).closest('details').open=true;},selector);
    await p.click(selector);const statistical=await p.call(state);assert.notDeepEqual(statistical.stat,baseline.stat);assert.deepEqual(statistical.levels,['8','9']);assert.deepEqual(statistical.actual,baseline.actual);assert.deepEqual(statistical.ni,baseline.ni);assert.equal(statistical.selected,filtered.selected);
    await capture(p,label+'-statistical');await p.click(selector);assert.deepEqual((await p.call(state)).stat,baseline.stat);
    await p.call(function(){document.querySelector('input[data-kind="osm-admin-level"][data-filter="8"]').scrollIntoView({block:'center',behavior:'instant'});});mark('statistical-filter-independence-'+label);
   }
   await capture(p,label+'-osm89');
   await p.call(levels,['5']);let plan=await p.call(bulk,'show');assert.ok(plan.pending);assert.match(plan.scope,/contururi NI 7/);assert.match(plan.scope,/roluri NI reutilizate excluse/);
   await p.call(function(){document.querySelector('.osm-level-action-confirm').scrollIntoView({block:'center',behavior:'instant'});});
   await accessible(p,label+'-confirm');await contrast(p,label+'-confirm');await capture(p,label+'-confirm');
   assert.equal(await p.evaluate('document.activeElement.id'),'osm-geometry-confirmation-scope');await p.key('Tab');assert.equal(await p.evaluate("document.activeElement===document.querySelector('.osm-level-action-confirm button')"),true);
   const focusTarget=await p.call(function(){const e=document.activeElement,r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,whole:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,hit:hit===e||e.contains(hit)};});assert.ok(focusTarget.width>=44&&focusTarget.height>=44&&focusTarget.whole&&focusTarget.hit,JSON.stringify(focusTarget));mark('confirm-keyboard-target-'+label,focusTarget);
   await p.key('Escape');
   const escaped=await p.call(function(){return {pending:!document.querySelector('.osm-level-action-confirm').hidden,panel:qaApp.atlasPanels.state.active,focused:document.activeElement===document.querySelector('.osm-level-geometry-buttons button')};});
   report.checks.push({name:'confirmation-escape-'+label,...escaped});await capture(p,label+'-escape');
   assert.deepEqual(escaped,{pending:false,panel:'filters',focused:true},'Escape cancels inline confirmation and returns focus without closing the filters panel');assert.deepEqual((await p.call(state)).ni,baseline.ni);
   await p.call(bulk,'show');await p.call(bulk,'cancel');assert.deepEqual((await p.call(state)).ni,baseline.ni);
   await p.call(bulk,'show');await p.call(bulk,'confirm');await waitFor(()=>p.call(function(){return qaApp.visibleOperationalOutlineIds.size===(published?8:7);},published),'selected NI outlines for current baseline');let shown=await p.call(state);assert.deepEqual(shown.actual,baseline.actual);assert.deepEqual(shown.stat,baseline.stat);
   if(published){
    const before=await p.call(state);
    for(const jurisdiction of ['ro','md','ni']){
     await p.click('#layer-'+jurisdiction);const off=await p.call(state);assert.deepEqual(off.actual,before.actual);assert.deepEqual(off.ni,before.ni);assert.deepEqual(off.levels,before.levels);assert.deepEqual(off.stat,before.stat);assert.equal(off.selected,before.selected);
     if(jurisdiction==='ni')assert.equal(await p.call(function(){return [...qaApp.nistreniaOutlines.layers.values()].filter(layer=>qaApp.map.hasLayer(layer)).length;}),0);
     await p.click('#layer-'+jurisdiction);
    }
    assert.equal(await p.call(function(){return [...qaApp.nistreniaOutlines.layers.values()].filter(layer=>qaApp.map.hasLayer(layer)).length;}),8);mark('jurisdiction-filter-independence-'+label);
   }
   await capture(p,label+'-shown');
   await p.call(bulk,'undo');assert.deepEqual((await p.call(state)).ni,baseline.ni);
   for(let i=0;i<12;i++){await p.call(bulk,'show');await p.call(bulk,'cancel');}assert.deepEqual((await p.call(state)).ni,baseline.ni);
   await p.call(bulk,'show');await p.call(bulk,'confirm');await p.evaluate('history.back()');await waitFor(()=>p.call(function(){return qaApp.visibleOperationalOutlineIds.size===(published?1:0);},published),'Back NI');await p.evaluate('history.forward()');await waitFor(()=>p.call(function(){return qaApp.visibleOperationalOutlineIds.size===(published?8:7);},published),'Forward NI');
   await p.call(levels,['2']);await p.call(bulk,'hide');await p.call(bulk,'confirm');assert.deepEqual((await p.call(state)).actual,[]);assert.equal((await p.call(state)).ni.length,published?8:7);await p.call(bulk,'undo');assert.deepEqual((await p.call(state)).actual,baseline.actual);
   const shared=(await p.call(state)).url;await p.navigate(shared);const restored=await p.call(state);assert.deepEqual(restored.actual,baseline.actual);assert.equal(restored.ni.length,published?8:7);assert.equal(restored.selected,'view-nistrenia');
   await p.openPanel('share');await p.click('#share-entity');const link=await p.evaluate("document.querySelector('#share-url').value");assert.equal(new URL(link).searchParams.get('e'),'view-nistrenia');await p.navigate(link);assert.equal((await p.call(state)).selected,'view-nistrenia');
   const selected=await p.selectQuery('Cremenciug');assert.ok(selected);await capture(p,label+'-search-card');
   await p.call(function(){qaApp.atlasPanels.close({focus:false});});
   const basemap=await p.call(function(){return qaApp.captureUrlState().osmBasemapVisible;});
   // The public basemap control is exercised by pointer; no geometry reset is coupled to it.
   const mapButton=await p.call(function(){return [...document.querySelectorAll('.leaflet-control-zoom button,.leaflet-control-zoom a')].find(e=>/OSM|fundal/i.test((e.title||'')+' '+(e.getAttribute('aria-label')||'')))?.className;});
   if(!mapButton)throw Error('Missing OSM map command');
   const button=await p.call(function(){const e=[...document.querySelectorAll('.leaflet-control-zoom button,.leaflet-control-zoom a')].find(e=>/OSM|fundal/i.test((e.title||'')+' '+(e.getAttribute('aria-label')||'')));return {id:e.id,selector:e.tagName.toLowerCase()+'.'+[...e.classList].join('.')};});
   const before=await p.call(state);await p.click(button.id?'#'+button.id:button.selector);assert.equal(await p.call(function(){return qaApp.captureUrlState().osmBasemapVisible;}),!basemap);await capture(p,label+'-basemap-off');const off=await p.call(state);assert.deepEqual(off.actual,before.actual);assert.deepEqual(off.ni,before.ni);await p.click(button.id?'#'+button.id:button.selector);assert.equal(await p.call(function(){return qaApp.captureUrlState().osmBasemapVisible;}),basemap);
   await p.send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'},{name:'prefers-reduced-motion',value:'reduce'}]});await p.openPanel('entities');await p.call(function(){qaApp.atlasTree.select('osm-r90689');qaApp.atlasTree.getNode('osm-r90689').button.focus();});await p.key('ArrowDown');
   assert.ok(await p.call(function(){return document.activeElement.classList.contains('tree-select')&&getComputedStyle(document.activeElement).outlineStyle!=='none'&&matchMedia('(forced-colors: active)').matches;}));await capture(p,label+'-forced');await p.send('Emulation.setEmulatedMedia',{features:[]});
   if(published){
    await p.openPanel('entities');const before=await p.call(state);await p.click('#geometries-reset');const reset=await p.call(state);assert.deepEqual(reset.actual,baseline.actual);assert.deepEqual(reset.ni,baseline.ni);assert.equal(reset.selected,before.selected);assert.deepEqual(reset.levels,before.levels);assert.deepEqual(reset.stat,before.stat);
    await p.openPanel('filters');await p.click('#filters-reset');const filters=await p.call(state);assert.deepEqual(filters.levels,baseline.levels);assert.deepEqual(filters.stat,baseline.stat);assert.deepEqual(filters.actual,reset.actual);assert.deepEqual(filters.ni,reset.ni);assert.equal(filters.selected,reset.selected);
    await capture(p,label+'-reset');mark('independent-resets-'+label);
   }
   await network(p,label,target(browser));mark('combined-'+label,{rapidCancelCycles:12,basemapInitial:basemap,geometryIndependence:true,history:true,shareRefresh:true});
  }finally{await p.close();}
 }
 await browser.close();browser=null;
 // A new browser profile is used. Setting Chrome's own Page zoom selector changes
 // layout zoom; no device metrics or pinch-scale emulation is used in this test.
 browser=await launchBrowser(root);const settings=await browser.page();await settings.send('Page.navigate',{url:'chrome://settings/appearance'});
 await waitFor(()=>settings.call(function(){function find(root){const s=root.querySelector('select#zoomLevel');if(s)return true;return [...root.querySelectorAll('*')].some(e=>e.shadowRoot&&find(e.shadowRoot));}return find(document);}),'Chrome page zoom setting');
 const zoom=await settings.call(function(){function find(root){const s=root.querySelector('select#zoomLevel');if(s)return s;for(const e of root.querySelectorAll('*'))if(e.shadowRoot){const s=find(e.shadowRoot);if(s)return s;}}const s=find(document);if(![...s.options].some(e=>e.value==='2'))throw Error('Native 200% setting absent');s.value='2';s.dispatchEvent(new Event('change',{bubbles:true}));return {setting:s.value,label:s.selectedOptions[0].textContent.trim()};});assert.equal(zoom.setting,'2');
 await delay(300);
 for(const [width,height] of [[1440,900],[1280,1024]]){
  const p=await browser.page();try{
   const info=await p.send('Browser.getWindowForTarget',{targetId:p.targetId});await p.send('Browser.setWindowBounds',{windowId:info.windowId,bounds:{width,height,windowState:'normal'}});await p.navigate(target(browser));await p.send('Accessibility.enable');
   const metrics=await p.call(function(){return {dpr:devicePixelRatio,scale:visualViewport.scale,width:innerWidth,outerWidth};});assert.equal(metrics.dpr,2);assert.equal(metrics.scale,1);assert.ok(metrics.width<width*.6);mark('native-zoom200-'+width,{setting:zoom,...metrics});
   await accessible(p,'native200-layout-'+width);await capture(p,'native200-'+width+'-initial');await p.openPanel('entities');await accessible(p,'native200-tree-'+width);await capture(p,'native200-'+width+'-tree');await p.key('Escape');
   await p.openPanel('modules');await p.key('Escape');assert.equal(await p.evaluate('document.activeElement.id'),'modules-toggle');await network(p,'native200-'+width,target(browser));
  }finally{await p.close();}
 }
 report.status='PASS';
}catch(e){if(e.inventory)report.publishedInventory=e.inventory;if(e.navigationFailure)report.network.push({label:'navigation-failure',...e.navigationFailure});report.errors.push(String(e.stack||e));console.error(e);process.exitCode=1;}
finally{report.completedAt=new Date().toISOString();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();}
