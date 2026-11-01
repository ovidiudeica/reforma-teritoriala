import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,waitFor} from './helpers/atlas-browser.mjs';
import {auditEvidenceDirectory} from './helpers/atlas-evidence.mjs';
import {performanceSource} from '../audit/helpers/performance-source.mjs';
import {verifyPublishedSource} from '../audit/helpers/published-source.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const mode=process.env.NI_FIN_BROWSER_MODE||'local';assert(['local','published'].includes(mode));
const source=performanceSource(root),out=path.join(auditEvidenceDirectory(),'ni-fin','u1-acceptance');
const id='osm-r9581354',alias='view-nistrenia-group-osm-r944727'; // NI-TREE.1: Bender document node, no obsolete geometry alias
const report={schema:'web-ni-u1-coupled-browser-v1',status:'FAIL',sourceSha:source.sha,
 trackedSourcesClean:source.trackedSourcesClean,applicationBaselineSha:'e8373371aa7504a206fa6c8020ed421060fc84e4',mode,checks:[],captures:[],
 limitations:['Real Chromium viewports, not physical phones. Chrome accessibility tree is not a physical screen-reader certification.','An audit-tool commit is not claimed to be the published application commit; published application bytes are checked independently.']};
const mark=(name,data={})=>report.checks.push({name,status:'PASS',...data});
const state=()=>({actual:[...qaApp.visibleEntityIds].sort(),ni:[...qaApp.visibleOperationalOutlineIds].sort(),selected:qaApp.selectedEntityId});
await test('WEB-NI-U1.5 coupled canonical navigation, History, filters, Undo, export and visible NI cards',{timeout:360000},async()=>{
 const browser=await launchBrowser(root);report.browser=browser.version.Browser;
 try{
  const p=await browser.page();
  if(mode==='published'){assert(source.trackedSourcesClean);report.publishedSource=await verifyPublishedSource(root);}
  await p.viewport(1440,900);await p.navigate(mode==='published'?'https://ovidiudeica.github.io/reforma-teritoriala/':browser.server.url);
  assert.deepEqual(await p.call(state),{actual:['osm-r58974','osm-r90689'],ni:[],selected:null});mark('two-default-roots-without-NI-descendants');
  // Opt into NI intentionally for legacy coupled checks. This is not the initial state.
  await p.call(function(){
   const filter=document.getElementById('layer-ni');filter.checked=true;filter.dispatchEvent(new Event('change',{bubbles:true}));
   qaApp.atlasTree.getNode('view-nistrenia').checkbox.click();
  });
  await waitFor(()=>p.evaluate("qaApp.visibleOperationalOutlineIds.has('view-nistrenia')&&document.getElementById('layer-ni').checked"),'NI explicitly enabled for coupled regression');
  await p.call(async function(id){await qaApp.selectEntity(id,{zoom:false});},id);
  assert.equal((await p.call(state)).selected,id);assert.equal(await p.call(function(id){return qaApp.visibleEntityIds.has(id);},id),false);
  await p.openPanel('entities');await p.click('.tree-visibility-toggle[data-entity-id="'+id+'"]');
  await waitFor(()=>p.call(function(id){return qaApp.visibleEntityIds.has(id)&&new URL(location.href).searchParams.getAll('x').includes(id);},id),'canonical checkbox and URL');
  assert.equal(await p.call(function(alias){return new URL(location.href).searchParams.getAll('x').includes(alias);},alias),false);
  await p.evaluate('history.back()');await waitFor(()=>p.call(function(id){return !qaApp.visibleEntityIds.has(id);},id),'Back restores shared checkbox');
  await p.evaluate('history.forward()');await waitFor(()=>p.call(function(id){return qaApp.visibleEntityIds.has(id);},id),'Forward restores shared checkbox');
  mark('canonical-selection-url-and-back-forward-without-duplicate-alias');

  const checked=await p.call(state);await p.openPanel('filters');
  for(const [control,shown] of [['md',true],['ni',false],['md',true],['ni',true]]){
   await p.click('#layer-'+control);
   const result=await p.call(function(id){qaApp.atlasTree.select(id);const e=qaApp.atlasTree.getNode(id);return {shown:!e.outer.classList.contains('tree-geometry-hidden'),checked:e.checkbox.checked,actual:[...qaApp.visibleEntityIds].sort()};},id);
   assert.equal(result.shown,shown);assert.equal(result.checked,true);assert.deepEqual(result.actual,checked.actual);
  }
  mark('md-only-ni-only-both-and-neither-preserve-one-checkbox');
  await p.call(function(){document.getElementById('basemap-toggle').click();});
  assert.equal(await p.evaluate('qaApp.captureUrlState().osmBasemapVisible'),false);
  await p.call(async function(id){await qaApp.selectEntity(id,{zoom:false});await qaApp.syncTiers();},id);
  await waitFor(()=>p.call(function(id){let n=0;qaApp.map.eachLayer(l=>{if(l.feature?.properties?.entity_id===id)n++;});return n===1;},id),'one canonical Bender map feature');
  mark('no-duplicate-map-feature-with-both-perspectives-and-no-basemap');

  report.geojson=await p.call(async function(id){
   const a=qaApp,source=a.exportSource(id),collection=await a.geometryResources.read(source.path),expected=collection.features.find(f=>f.properties.entity_id===id);
   if(!expected)throw Error('canonical source feature missing');
   const before=JSON.stringify({state:a.captureUrlState(),url:location.href,history:history.length}),blobs=[],create=URL.createObjectURL;
   URL.createObjectURL=b=>{blobs.push(b);return create(b);};
   try{
    const d=document.querySelector('#details-body .atlas-export-actions');d.open=true;
    const b=[...d.querySelectorAll('button')].find(b=>b.textContent==='Descarcă GeoJSON');if(!b||b.disabled)throw Error('canonical GeoJSON unavailable');
    b.click();while(b.disabled)await new Promise(r=>setTimeout(r,30));
    const data=JSON.parse(await blobs[0].text());
    if(data.type!=='Feature'||data.id!==id||JSON.stringify(data.geometry)!==JSON.stringify(expected.geometry))throw Error('noncanonical or changed export');
    if(before!==JSON.stringify({state:a.captureUrlState(),url:location.href,history:history.length}))throw Error('export mutated navigation');
    const raw=new TextEncoder().encode(JSON.stringify(data.geometry)),hash=await crypto.subtle.digest('SHA-256',raw);
    return {id:data.id,type:data.type,source,geometrySha256:[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''),unchanged:true};
   }finally{URL.createObjectURL=create;}
  },id);mark('real-geojson-export-canonical-and-byte-equal-geometry');

  await p.call(function(){const section=[...document.querySelectorAll('#filter-list>details')].find(e=>e.querySelector('summary')?.textContent==='Nivel administrativ OSM');section.open=true;section.querySelector('.filter-actions button:nth-child(2)').click();section.querySelector('input[data-filter="5"]').click();const b=document.querySelector('.osm-level-geometry-buttons button');b.click();});
  const scope=await p.evaluate("document.getElementById('osm-geometry-confirmation-scope').textContent");
  assert.match(scope,/7 dintre 7 geometrii eligibile/);assert.match(scope,/contururi NI 7/);
  assert.match(scope,/Niveluri OSM: 5\. 0 roluri NI reutilizate excluse/);
  await p.call(function(){document.querySelector('.osm-level-action-confirm button').click();});
  await waitFor(()=>p.evaluate('qaApp.visibleOperationalOutlineIds.size===8'),'all independent NI outlines');
  assert.deepEqual((await p.call(state)).actual,checked.actual);
  await p.call(function(){document.querySelector('.osm-level-geometry-buttons button:nth-child(3)').click();});
  assert.deepEqual((await p.call(state)).ni,['view-nistrenia']);assert.deepEqual((await p.call(state)).actual,checked.actual);
  await p.call(function(){const section=[...document.querySelectorAll('#filter-list>details')].find(e=>e.querySelector('summary')?.textContent==='Nivel administrativ OSM');section.querySelector('.filter-actions button').click();});
  mark('osm-filter-explicit-action-and-undo-preserve-shared-geometry');

  await p.openPanel('entities');await p.click('#map-geometries-reset');
  assert.deepEqual((await p.call(state)).actual,['osm-r58974','osm-r90689']);assert.equal((await p.call(state)).selected,id);
  assert.equal(await p.evaluate('qaApp.captureUrlState().osmBasemapVisible'),false);
  await p.evaluate('history.back()');await waitFor(()=>p.call(function(id){return qaApp.visibleEntityIds.has(id);},id),'Back reverses shared reset');
  await p.evaluate('history.forward()');await waitFor(()=>p.call(function(id){return !qaApp.visibleEntityIds.has(id);},id),'Forward reapplies reset');
  mark('shared-reset-and-history-preserve-card-filters-and-basemap');

  await p.query('Lunga');await p.click('[role=option][data-entity-id="view-nistrenia-role-osm-r19001619"]');
  await waitFor(()=>p.evaluate("qaApp.selectedEntityId==='osm-r19001619'"),'unassociated Lunga search canonical card');
  assert.deepEqual((await p.call(state)).actual,['osm-r58974','osm-r90689']);mark('human-name-search-for-unassociated-lunga');
  await p.openPanel('entities');await p.call(function(id){qaApp.atlasTree.select(id);qaApp.atlasTree.getNode(id).button.focus();},id);await p.key('Enter');
  await waitFor(()=>p.call(function(id){return qaApp.selectedEntityId===id;},id),'keyboard canonical shared card');mark('keyboard-canonical-reference-without-checking');

  await p.call(async function(id){qaApp.atlasTree.select(id);qaApp.atlasTree.getNode(id).checkbox.click();await qaApp.syncTiers();},id);
  await waitFor(()=>p.call(function(id){let found=false;qaApp.map.eachLayer(l=>{if(l.feature?.properties?.entity_id===id&&l.getElement?.())found=true;});return found;},id),'canonical SVG map feature');
  await p.call(function(id){qaApp.clearSelection();let target;qaApp.map.eachLayer(l=>{if(l.feature?.properties?.entity_id===id&&l.getElement?.())target=l.getElement();});const r=target.getBoundingClientRect();target.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));},id);
  await waitFor(()=>p.call(function(id){return qaApp.selectedEntityId===id;},id),'canonical selection from SVG map event');mark('map-feature-click-resolves-canonical-card',{input:'MouseEvent on the actual Leaflet SVG feature'});
  await p.call(function(){document.querySelector('.geometric-data button').click();});
  await waitFor(()=>p.evaluate("document.querySelector('.geometric-data').textContent.includes('Suprafață OSM')"),'shared geometry measurements',120000);mark('shared-card-measurements');
  await p.call(function(){document.getElementById('neighbors-toggle').click();});
  await waitFor(()=>p.call(function(id){return qaApp.atlasNeighbors.state.report?.id===id;},id),'canonical shared neighbors',120000);
  report.neighbors=await p.call(function(){const r=qaApp.atlasNeighbors.state.report;if(r.neighbors.some(n=>!qaApp.entityById.has(n.other)))throw Error('noncanonical neighbor');return {id:r.id,neighbors:r.neighbors.length,anomalies:r.anomalies.length};});mark('canonical-neighbors',report.neighbors);
  await p.call(async function(alias,id){await qaApp.selectEntity(alias,{zoom:false});if(qaApp.selectedEntityId!==alias)throw Error('documentary Bender card lost');await qaApp.selectEntity(id,{zoom:false});qaApp.atlasAdvanced.addCompare(qaApp.selectedEntityId);await qaApp.selectEntity(id,{zoom:false});qaApp.atlasAdvanced.addCompare(qaApp.selectedEntityId);},alias,id);
  assert.deepEqual(await p.evaluate('qaApp.atlasAdvanced.state.pair'),[id]);mark('documentary-Bender-and-canonical-geometry-do-not-duplicate-comparison');
  await p.call(function(){qaApp.atlasAdvanced.addCompare('osm-r12463379');[...document.querySelectorAll('.geometric-comparison button')].find(b=>b.textContent==='Calculează comparația').click();});
  await waitFor(()=>p.evaluate("!![...document.querySelectorAll('.geometric-comparison button')].find(b=>b.textContent==='Exportă rezultatele JSON')"),'shared comparison export',120000);
  report.comparison=await p.call(async function(){const blobs=[],create=URL.createObjectURL;URL.createObjectURL=b=>{blobs.push(b);return create(b);};try{const b=[...document.querySelectorAll('.geometric-comparison button')].find(b=>b.textContent==='Exportă rezultatele JSON');b.click();while(b.disabled)await new Promise(r=>setTimeout(r,20));const r=JSON.parse(await blobs[0].text());return {a:r.a.entity.id,b:r.b.entity.id,validation:r.validation};}finally{URL.createObjectURL=create;}});
  assert.equal(report.comparison.a,id);assert.equal(report.comparison.b,'osm-r12463379');assert(report.comparison.validation);mark('canonical-comparison-and-report-export');
  report.vector=await p.call(async function(){const {mapSvg}=await import('./atlas-export-visual.mjs'),a=qaApp,before=JSON.stringify(a.captureUrlState()),svg=mapSvg({map:a.map,L:window.L,snapshotId:'ACTUAL',selection:['Bender'],legend:[]});if(before!==JSON.stringify(a.captureUrlState())||!svg.includes('OpenStreetMap contributors')||svg.includes('view-nistrenia-role-'))throw Error('vector export changed canonical state');const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(svg));return {bytes:new TextEncoder().encode(svg).length,sha256:[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''),unchanged:true};});mark('vector-map-export-preserves-state',report.vector);

  for(const [w,h] of [[1440,900],[900,768],[390,844],[844,390]]){
   await p.viewport(w,h);await p.call(async function(id){qaApp.atlasPanels.close({focus:false});await qaApp.selectEntity(id,{zoom:false});qaApp.atlasMobile.setSheet('expanded');const ni=document.querySelector('[data-card-perspective="NI"]');ni.scrollIntoView({block:'start',behavior:'instant'});await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},id);
   const layout=await p.call(function(){const ni=document.querySelector('[data-card-perspective="NI"]'),heading=ni.querySelector('h3'),r=heading.getBoundingClientRect(),panel=document.getElementById('details-panel').getBoundingClientRect(),body=document.getElementById('details-body');return {heading:heading.textContent,headingVisible:r.height>0&&r.top>=Math.max(0,panel.top)-1&&r.bottom<=Math.min(innerHeight,panel.bottom)+1,pageOverflow:document.documentElement.scrollWidth>innerWidth,bodyOverflow:body.scrollWidth>body.clientWidth+1,canonical:qaApp.selectedEntityId};});
   assert.equal(layout.headingVisible,true);assert.equal(layout.pageOverflow,false);assert.equal(layout.bodyOverflow,false);assert.equal(layout.canonical,id);
   const file='ni-section-'+w+'x'+h+'.png';await p.screenshot(path.join(out,file));report.captures.push(file);mark('ni-section-visible-'+w+'x'+h,layout);
  }
  report.errors=p.errors;report.console=p.console;report.networkFailures=p.failures;report.externalTileWarnings=p.externalTileWarnings;
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.console.filter(e=>e.type==='error'||e.level==='error'),[]);
  const own=mode==='published'?'https://ovidiudeica.github.io/reforma-teritoriala/':browser.server.url;
  assert.deepEqual(p.failures.filter(f=>f.url?.startsWith(own)&&!f.canceled),[]);assert.deepEqual(p.responses.filter(r=>r.url.startsWith(own)&&r.status>=400),[]);
  mark('no-own-network-or-javascript-errors');report.status='PASS';
 }catch(error){report.error={message:error.message,stack:error.stack};throw error;}
 finally{await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
});
